"""
Flashscore HTTP client for automated fetching and pipeline synchronization.

Uses curl_cffi with Chrome impersonation, DNS fallback for global.ds.lsapp.eu,
strict defensive rate limiting, human jitter, cooldown blocks, and circuit breaker
mechanisms to protect IP reputation against WAF/rate-limiting blocks.
"""

import logging
import random
import re
import sqlite3
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from curl_cffi import requests
from curl_cffi.curl import CurlOpt

from .flashscore_parser import process_and_save_flashscore_stats

logger = logging.getLogger(__name__)

# Pattern to capture 8-character alphanumeric Flashscore event IDs from HTML / Feed / URLs
EVENT_ID_REGEX = re.compile(
    r'(?:~AA÷|AA÷|g_1_|mid[=:]\s*["\']?|data-(?:event-id|mid)=["\']?|/(?:partido|match)/)([a-zA-Z0-9]{8})(?![a-zA-Z0-9_])'
)


def extract_event_ids_from_text(text: str) -> List[str]:
    """
    Extracts Flashscore match event IDs (8-char alphanumeric) from raw HTML or feed text.
    Deduplicates IDs while preserving original discovery order.

    Args:
        text: Raw HTML, JSON or feed text from Flashscore.

    Returns:
        List of unique 8-character event IDs in order of discovery.
    """
    seen: Set[str] = set()
    discovered: List[str] = []
    for match in EVENT_ID_REGEX.finditer(text):
        eid = match.group(1)
        if eid not in seen:
            seen.add(eid)
            discovered.append(eid)
    return discovered


# Default DNS fallback mapping to bypass Windows DNS resolution timeouts on global.ds.lsapp.eu
DEFAULT_RESOLVE: Dict[str, str] = {
    "global.ds.lsapp.eu:443": "34.110.235.253",
}

DEFAULT_HEADERS: Dict[str, str] = {
    "Origin": "https://www.flashscore.pe",
    "Referer": "https://www.flashscore.pe/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "es-PE,es-419;q=0.9,es;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
}


class FlashscoreClient:
    """
    Automated fetcher and synchronization manager for Flashscore match statistics.
    Equipped with defensive pacing, cooldown blocks, and circuit breaker protection.
    """

    def __init__(
        self,
        base_url: str = "https://global.ds.lsapp.eu/pq_graphql",
        headers: Optional[Dict[str, str]] = None,
        impersonate: str = "chrome124",
        timeout: float = 15.0,
        max_retries: int = 3,
        resolve: Optional[Dict[str, str]] = None,
    ):
        self.base_url = base_url
        self.headers = dict(DEFAULT_HEADERS)
        if headers:
            self.headers.update(headers)
        self.impersonate = impersonate
        self.timeout = timeout
        self.max_retries = max_retries
        self.resolve = resolve if resolve is not None else dict(DEFAULT_RESOLVE)

        # Circuit breaker state
        self.circuit_breaker_triggered: bool = False
        self.last_status_code: Optional[int] = None

    def reset_circuit_breaker(self) -> None:
        """Resets the circuit breaker state for a fresh execution session."""
        self.circuit_breaker_triggered = False
        self.last_status_code = None

    def _build_curl_options(self) -> Dict[Any, Any]:
        """Builds curl_options dictionary including CURLOPT_RESOLVE if configured."""
        curl_options: Dict[Any, Any] = {}
        if self.resolve:
            resolves: List[str] = []
            for host_port, ip in self.resolve.items():
                if ":" in host_port:
                    host, port = host_port.split(":", 1)
                else:
                    host, port = host_port, "443"
                resolves.append(f"{host}:{port}:{ip}")
            curl_options[CurlOpt.RESOLVE] = resolves
        return curl_options

    def fetch_match_team_stats_raw(self, event_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetches the raw JSON statistics for a match event from Flashscore's pq_graphql endpoint.

        If HTTP 429 or 403 is received, trips the circuit breaker immediately without aggressive retries.

        Args:
            event_id: Flashscore event identifier (e.g. 'QPinjf7b').

        Returns:
            Dictionary containing the GraphQL response, or None if the request failed or was aborted.
        """
        if self.circuit_breaker_triggered:
            logger.warning(
                f"[CIRCUIT BREAKER] Circuit breaker already active. Skipping request for event {event_id}."
            )
            return None

        url = f"{self.base_url}?_hash=dts&eventId={event_id}&providerId=101"
        curl_options = self._build_curl_options()

        consecutive_timeouts = 0

        for attempt in range(1, self.max_retries + 1):
            try:
                logger.debug(
                    f"Fetching Flashscore stats for event {event_id} (attempt {attempt}/{self.max_retries})"
                )
                response = requests.get(
                    url,
                    headers=self.headers,
                    impersonate=self.impersonate,
                    timeout=self.timeout,
                    curl_options=curl_options if curl_options else None,
                )
                self.last_status_code = response.status_code

                if response.status_code == 200:
                    try:
                        data = response.json()
                        return data
                    except Exception as json_err:
                        logger.warning(f"Error parsing JSON for event {event_id}: {json_err}")
                        return None

                # Circuit breaker trigger: 429 (Rate Limit) or 403 (Forbidden / Cloudflare WAF block)
                if response.status_code in (429, 403):
                    self.circuit_breaker_triggered = True
                    logger.critical(
                        f"[CIRCUIT BREAKER] Potential anti-bot/rate-limit trigger detected "
                        f"(HTTP {response.status_code}). Aborting remaining batch to protect IP."
                    )
                    return None

                if response.status_code == 404:
                    logger.warning(f"Received HTTP 404 for event {event_id}. Event not found.")
                    return None

                logger.warning(
                    f"HTTP {response.status_code} for event {event_id} on attempt {attempt}/{self.max_retries}"
                )

            except Exception as e:
                consecutive_timeouts += 1
                logger.warning(
                    f"Network error fetching event {event_id} on attempt {attempt}/{self.max_retries}: {e}"
                )

            if attempt < self.max_retries:
                sleep_time = 1.5 * attempt
                time.sleep(sleep_time)

        # If all retries failed due to repeated network timeouts/anomalies, trip circuit breaker
        if consecutive_timeouts >= self.max_retries:
            self.circuit_breaker_triggered = True
            logger.critical(
                f"[CIRCUIT BREAKER] Repeated timeout anomalies detected ({consecutive_timeouts} failures). "
                f"Aborting batch to protect IP."
            )

        logger.error(f"Failed to fetch Flashscore stats for event {event_id} after {self.max_retries} attempts.")
        return None

    def sync_match_stats(
        self,
        db_conn: sqlite3.Connection,
        event_id: str,
        delay_seconds: float = 2.5,
    ) -> Dict[str, Any]:
        """
        Downloads raw data, processes and resolves match and team IDs, and stores stats in SQLite.
        Enforces defensive delay pauses.

        Args:
            db_conn: Active SQLite connection.
            event_id: Flashscore event identifier (e.g. 'QPinjf7b').
            delay_seconds: Defensive pause (default 2.5s) to avoid fast-bursts in standalone calls.

        Returns:
            Summary dictionary: {
                "event_id": event_id,
                "success": bool,
                "rows_inserted": int,
                "match_id": Optional[int],
                "circuit_breaker_triggered": bool
            }
        """
        raw_data = self.fetch_match_team_stats_raw(event_id)

        if not raw_data:
            if delay_seconds > 0 and not self.circuit_breaker_triggered:
                time.sleep(delay_seconds)
            return {
                "event_id": event_id,
                "success": False,
                "rows_inserted": 0,
                "match_id": None,
                "error": (
                    f"Anti-bot trigger detected (HTTP {self.last_status_code})"
                    if self.circuit_breaker_triggered
                    else "Failed to fetch stats payload from Flashscore"
                ),
                "circuit_breaker_triggered": self.circuit_breaker_triggered,
            }

        try:
            saved_rows = process_and_save_flashscore_stats(
                db_conn=db_conn,
                raw_data=raw_data,
                flashscore_event_id=event_id,
            )

            resolved_match_id = None
            if saved_rows and saved_rows[0].get("match_id"):
                resolved_match_id = saved_rows[0]["match_id"]

            if delay_seconds > 0:
                time.sleep(delay_seconds)

            return {
                "event_id": event_id,
                "success": True,
                "rows_inserted": len(saved_rows),
                "match_id": resolved_match_id,
                "circuit_breaker_triggered": False,
            }

        except Exception as e:
            logger.error(f"Error processing stats for event {event_id}: {e}", exc_info=True)
            if delay_seconds > 0:
                time.sleep(delay_seconds)
            return {
                "event_id": event_id,
                "success": False,
                "rows_inserted": 0,
                "match_id": None,
                "error": str(e),
                "circuit_breaker_triggered": self.circuit_breaker_triggered,
            }

    def sync_batch_matches(
        self,
        db_conn: sqlite3.Connection,
        event_ids: List[str],
        delay_range: Tuple[float, float] = (3.5, 6.0),
        cooldown_every: int = 5,
        cooldown_range: Tuple[float, float] = (12.0, 18.0),
    ) -> List[Dict[str, Any]]:
        """
        Iterates over a list of match event IDs with human-like jitter delays,
        batch cooldown intervals, and fail-fast circuit breaker protection.

        Args:
            db_conn: Active SQLite connection.
            event_ids: List of Flashscore event IDs.
            delay_range: Range (min_sec, max_sec) for random jitter sleep between requests.
            cooldown_every: Number of matches processed before triggering a cooldown pause.
            cooldown_range: Range (min_sec, max_sec) for extended cooldown sleep.

        Returns:
            List of summary result dictionaries collected prior to completion or circuit breaker halt.
        """
        results: List[Dict[str, Any]] = []
        total = len(event_ids)

        for idx, event_id in enumerate(event_ids, 1):
            # Check circuit breaker before starting next request
            if self.circuit_breaker_triggered:
                logger.critical("[CIRCUIT BREAKER] Halting remaining batch execution early.")
                break

            jitter_delay = random.uniform(delay_range[0], delay_range[1])
            logger.info(f"Syncing match {idx}/{total}: {event_id} (delay: {jitter_delay:.2f}s)")

            res = self.sync_match_stats(
                db_conn=db_conn,
                event_id=event_id,
                delay_seconds=jitter_delay,
            )
            results.append(res)

            # Check if circuit breaker tripped during this sync
            if res.get("circuit_breaker_triggered") or self.circuit_breaker_triggered:
                skipped = total - idx
                logger.critical(
                    f"[CIRCUIT BREAKER] Potential anti-bot/rate-limit trigger detected on event {event_id}. "
                    f"Aborting remaining batch ({skipped} matches skipped) to protect IP."
                )
                break

            # Cooldown block after every `cooldown_every` processed matches (unless it's the final match)
            if cooldown_every > 0 and idx % cooldown_every == 0 and idx < total:
                cooldown_sleep = random.uniform(cooldown_range[0], cooldown_range[1])
                logger.info(
                    f"[COOLDOWN] Pausing batch for {cooldown_sleep:.2f}s after {idx} matches "
                    f"to maintain human-like cadence..."
                )
                time.sleep(cooldown_sleep)

        return results

    def discover_tournament_matches(
        self,
        tournament_url: str = "https://www.flashscore.pe/futbol/peru/liga-1/resultados/",
    ) -> List[str]:
        """
        Discovers match event IDs from a Flashscore tournament results page or feed.

        Uses curl_cffi with Chrome impersonation, extracts 8-char event IDs
        (via regex matching g_1_, mid=, ~AA÷, /partido/, data-event-id),
        deduplicates them preserving order, and logs the discovery count.

        Args:
            tournament_url: URL to tournament results page or feed.

        Returns:
            List of unique 8-character Flashscore event IDs in discovery order.
        """
        if self.circuit_breaker_triggered:
            logger.warning("[CIRCUIT BREAKER] Circuit breaker active. Skipping match discovery.")
            return []

        logger.info(f"Discovering match event IDs from {tournament_url}...")
        try:
            headers = dict(self.headers)
            headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"

            curl_options = None
            if self.resolve and any(host.split(":")[0] in tournament_url for host in self.resolve):
                curl_options = self._build_curl_options()

            response = requests.get(
                tournament_url,
                headers=headers,
                impersonate=self.impersonate,
                timeout=self.timeout,
                curl_options=curl_options,
            )
            self.last_status_code = response.status_code

            if response.status_code in (429, 403):
                self.circuit_breaker_triggered = True
                logger.critical(
                    f"[CIRCUIT BREAKER] Potential anti-bot/rate-limit trigger detected during match discovery "
                    f"(HTTP {response.status_code}). Aborting."
                )
                return []

            if response.status_code != 200:
                logger.warning(
                    f"HTTP {response.status_code} fetching tournament page: {tournament_url}"
                )
                return []

            event_ids = extract_event_ids_from_text(response.text)
            logger.info(f"Discovered {len(event_ids)} event IDs from {tournament_url}")
            return event_ids

        except Exception as e:
            logger.warning(f"Error during tournament match discovery from {tournament_url}: {e}")
            return []


def discover_tournament_matches(
    tournament_url: str = "https://www.flashscore.pe/futbol/peru/liga-1/resultados/",
    client: Optional[FlashscoreClient] = None,
) -> List[str]:
    """
    Convenience module-level function to discover tournament matches.

    Args:
        tournament_url: Target results page or feed URL.
        client: Optional FlashscoreClient instance (created if None).

    Returns:
        List of unique 8-character Flashscore event IDs.
    """
    if client is None:
        client = FlashscoreClient()
    return client.discover_tournament_matches(tournament_url=tournament_url)
