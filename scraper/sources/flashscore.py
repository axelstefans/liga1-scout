"""
Stateless Flashscore synchronization module guided directly by SQLite.

Decoupled from filesystem JSON stores (discovered_matches.json).
Selects pending matches from matches table, resolves Flashscore event IDs,
enforces defensive rate limiting, validates IDs against navigation blacklists,
ensures 6-block atomic insertions, and maintains audit trails in scrape_log.
"""

import logging
import re
import sqlite3
import time
from typing import Any, Dict, List, Optional, Tuple

from scraper.db import log_scrape
from scraper.flashscore_client import FlashscoreClient
from scraper.flashscore_mapping import get_flashscore_team_mapping
from scraper.flashscore_parser import (
    insert_flashscore_team_stats,
    parse_flashscore_team_stats,
    resolve_match_id,
)

logger = logging.getLogger(__name__)

# Explicit list of navigation and sports menu words to reject
BLACK_LISTED_NAVIGATION_WORDS = {
    "voleibol",
    "baseball",
    "baloncesto",
    "ciclismo",
    "natacion",
    "badminto",
    "handball",
    "softbol",
    "waterpolo",
}

FLASHSCORE_EVENT_ID_REGEX = re.compile(r"^[a-zA-Z0-9]{8}$")


def is_valid_flashscore_event_id(event_id: str) -> bool:
    """
    Validates that a Flashscore event ID is strictly an 8-character alphanumeric hash,
    and is not a blacklisted navigation / sports menu word.
    """
    if not event_id or not isinstance(event_id, str):
        return False
    clean = event_id.strip()
    if clean.lower() in BLACK_LISTED_NAVIGATION_WORDS:
        return False
    return bool(FLASHSCORE_EVENT_ID_REGEX.match(clean))


def get_failed_attempt_count(conn: sqlite3.Connection, match_id: int) -> int:
    """Returns number of accumulated failed attempts recorded in scrape_log for a match."""
    row = conn.execute(
        """
        SELECT COUNT(*) FROM scrape_log 
        WHERE resource_type = 'flashscore' AND resource_key = ? AND status = 'failed'
        """,
        (str(match_id),),
    ).fetchone()
    return int(row[0]) if row else 0


def get_pending_flashscore_matches(
    conn: sqlite3.Connection,
    season_id: Optional[int] = 88529,
    limit: Optional[int] = None,
    max_failed_retries: int = 3,
) -> List[Dict[str, Any]]:
    """
    Queries finished matches from SQLite that lack Flashscore statistics,
    ignoring terminal states (success, not_available, ambiguous) and blocking
    matches that have reached max_failed_retries attempts.

    Args:
        conn: Active SQLite connection.
        season_id: Target season ID (default 88529 for Liga 1 2026, None for all).
        limit: Optional maximum matches to retrieve.
        max_failed_retries: Maximum accumulated failed attempts before match is skipped.

    Returns:
        List of match dictionaries.
    """
    query = """
    SELECT m.match_id, m.match_date, m.round, m.home_team_id, m.away_team_id,
           ht.name as home_name, at.name as away_name,
           ht.flashscore_id as home_fs_id, at.flashscore_id as away_fs_id
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.team_id
    JOIN teams at ON m.away_team_id = at.team_id
    WHERE (? IS NULL OR m.season_id = ?)
      AND m.status = 'played'
      AND m.match_id NOT IN (
          SELECT DISTINCT match_id FROM flashscore_match_team_stats WHERE match_id IS NOT NULL
      )
      AND m.match_id NOT IN (
          SELECT CAST(resource_key AS INTEGER) FROM scrape_log 
          WHERE resource_type = 'flashscore' AND status IN ('success', 'not_available', 'ambiguous')
      )
      AND m.match_id NOT IN (
          SELECT CAST(resource_key AS INTEGER) FROM scrape_log 
          WHERE resource_type = 'flashscore' AND status = 'failed'
          GROUP BY resource_key
          HAVING COUNT(*) >= ?
      )
    ORDER BY m.round DESC, m.match_date DESC
    """
    params = [season_id, season_id, max_failed_retries]
    if limit is not None and limit > 0:
        query += f" LIMIT {int(limit)}"

    rows = conn.execute(query, params).fetchall()
    results = []
    for r in rows:
        results.append(
            {
                "match_id": r["match_id"],
                "match_date": r["match_date"],
                "round": r["round"],
                "home_team_id": r["home_team_id"],
                "away_team_id": r["away_team_id"],
                "home_name": r["home_name"],
                "away_name": r["away_name"],
                "home_fs_id": r["home_fs_id"],
                "away_fs_id": r["away_fs_id"],
            }
        )
    return results


def sync_single_match_by_event_id(
    conn: sqlite3.Connection,
    event_id: str,
    target_match_id: Optional[int] = None,
    client: Optional[FlashscoreClient] = None,
    max_memory_retries: int = 3,
    backoff_factor: float = 1.5,
) -> Dict[str, Any]:
    """
    Synchronizes statistics for a single match given its validated Flashscore event ID.
    Performs in-memory retries with exponential backoff on transient network failures.
    Logs audit outcomes to scrape_log using resource_type = 'flashscore'.

    Returns:
        Dict summarizing result: {
            "match_id": int or None,
            "event_id": str,
            "status": 'success' | 'failed' | 'not_available' | 'ambiguous',
            "rows_inserted": int,
            "error_message": str or None
        }
    """
    resource_key = str(target_match_id) if target_match_id is not None else event_id

    # 1. Validate Flashscore event ID format and blacklist
    if not is_valid_flashscore_event_id(event_id):
        err = f"Invalid Flashscore event ID format or blacklisted word: {event_id}"
        logger.warning(err)
        log_scrape(
            conn=conn,
            resource_type="flashscore",
            resource_key=resource_key,
            status="failed",
            error_message=f"[intento 1/{max_memory_retries}] {err}",
        )
        return {
            "match_id": target_match_id,
            "event_id": event_id,
            "status": "failed",
            "rows_inserted": 0,
            "error_message": err,
        }

    if client is None:
        client = FlashscoreClient()

    # 2. Fetch raw GraphQL payload with in-memory retry and backoff
    raw_data = None
    last_error = None
    http_code = None

    for attempt in range(1, max_memory_retries + 1):
        try:
            raw_data = client.fetch_match_team_stats_raw(event_id)
            http_code = client.last_status_code
            if raw_data:
                break
            last_error = f"Empty or unparseable response from Flashscore (HTTP {http_code})"
        except Exception as e:
            last_error = str(e)
            logger.warning(f"Attempt {attempt}/{max_memory_retries} failed for event {event_id}: {e}")

        if attempt < max_memory_retries:
            sleep_time = backoff_factor * attempt
            time.sleep(sleep_time)

    # 3. Handle transient network / fetch failure
    if not raw_data:
        err_msg = f"[intento {max_memory_retries}/{max_memory_retries}] {last_error}"
        log_scrape(
            conn=conn,
            resource_type="flashscore",
            resource_key=resource_key,
            status="failed",
            http_status_code=http_code,
            error_message=err_msg,
        )
        return {
            "match_id": target_match_id,
            "event_id": event_id,
            "status": "failed",
            "rows_inserted": 0,
            "error_message": err_msg,
        }

    # 4. Parse entries from payload
    parsed_rows = parse_flashscore_team_stats(
        raw_data=raw_data,
        match_id=target_match_id,
        flashscore_event_id=event_id,
        db_conn=conn,
    )

    # Check if Flashscore has no statistics for this match (permanent)
    if not parsed_rows:
        err_msg = "Flashscore has no match team statistics entries"
        log_scrape(
            conn=conn,
            resource_type="flashscore",
            resource_key=resource_key,
            status="not_available",
            http_status_code=http_code,
            error_message=err_msg,
        )
        return {
            "match_id": target_match_id,
            "event_id": event_id,
            "status": "not_available",
            "rows_inserted": 0,
            "error_message": err_msg,
        }

    # Verify match_id resolution
    resolved_id = target_match_id or parsed_rows[0].get("match_id")
    if not resolved_id:
        err_msg = "Ambiguous or unresolvable matchup between Flashscore teams and SQLite matches"
        log_scrape(
            conn=conn,
            resource_type="flashscore",
            resource_key=resource_key,
            status="ambiguous",
            http_status_code=http_code,
            error_message=err_msg,
        )
        return {
            "match_id": None,
            "event_id": event_id,
            "status": "ambiguous",
            "rows_inserted": 0,
            "error_message": err_msg,
        }

    # Ensure all rows carry the resolved match_id
    for r in parsed_rows:
        r["match_id"] = resolved_id

    # 5. Insert atomically into flashscore_match_team_stats (strictly 6 blocks)
    try:
        inserted = insert_flashscore_team_stats(conn, parsed_rows, enforce_six_blocks=True)
        if inserted == 6:
            log_scrape(
                conn=conn,
                resource_type="flashscore",
                resource_key=str(resolved_id),
                status="success",
                http_status_code=http_code,
                error_message=None,
            )
            return {
                "match_id": resolved_id,
                "event_id": event_id,
                "status": "success",
                "rows_inserted": inserted,
                "error_message": None,
            }
        else:
            err_msg = f"Incomplete blocks inserted: expected 6, inserted {inserted}"
            log_scrape(
                conn=conn,
                resource_type="flashscore",
                resource_key=str(resolved_id),
                status="failed",
                error_message=f"[intento 1/{max_memory_retries}] {err_msg}",
            )
            return {
                "match_id": resolved_id,
                "event_id": event_id,
                "status": "failed",
                "rows_inserted": inserted,
                "error_message": err_msg,
            }
    except Exception as e:
        err_msg = f"Database insertion error: {e}"
        log_scrape(
            conn=conn,
            resource_type="flashscore",
            resource_key=str(resolved_id),
            status="failed",
            error_message=f"[intento 1/{max_memory_retries}] {err_msg}",
        )
        return {
            "match_id": resolved_id,
            "event_id": event_id,
            "status": "failed",
            "rows_inserted": 0,
            "error_message": err_msg,
        }
