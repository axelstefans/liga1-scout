"""
Orchestrator script to synchronize discovered Flashscore matches into SQLite.

Reads discovered event IDs from JSON, filters out already synced events,
and processes pending matches using FlashscoreClient with defensive rate limiting,
cooldown blocks, and circuit breaker protection.
"""

import argparse
import json
import logging
import os
import sqlite3
import sys
from typing import Any, Dict, List, Optional, Set, Tuple

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from scraper.db import get_connection
from scraper.flashscore_client import (
    FlashscoreClient,
    discover_tournament_matches,
    extract_event_ids_from_text,
)

DEFAULT_EVENTS_FILE = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "tools", "discovered_matches.json")
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("sync_discovered_matches")


def load_discovered_events(json_path: str) -> List[str]:
    """Loads list of discovered Flashscore event IDs from a JSON file."""
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Discovered matches file not found: {json_path}")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON list of event IDs in {json_path}, got {type(data)}")
    return [str(item).strip() for item in data if item]


def merge_discovered_events(events_file: str, new_ids: List[str]) -> Tuple[List[str], int]:
    """
    Merges newly discovered event IDs into the events JSON file without losing existing IDs.
    Preserves original ID order, appends newly discovered IDs, and persists updates to disk.

    Args:
        events_file: Path to JSON file storing event IDs.
        new_ids: List of newly discovered event IDs.

    Returns:
        Tuple of (merged_list_of_ids, count_of_newly_added_ids).
    """
    existing_ids: List[str] = []
    if os.path.exists(events_file):
        try:
            existing_ids = load_discovered_events(events_file)
        except Exception as e:
            logger.warning(f"Could not load existing events from {events_file}: {e}")
            existing_ids = []

    existing_set = set(existing_ids)
    added_count = 0
    merged_list = list(existing_ids)

    for eid in new_ids:
        if eid not in existing_set:
            existing_set.add(eid)
            merged_list.append(eid)
            added_count += 1

    if added_count > 0:
        dir_path = os.path.dirname(os.path.abspath(events_file))
        if dir_path:
            os.makedirs(dir_path, exist_ok=True)
        with open(events_file, "w", encoding="utf-8") as f:
            json.dump(merged_list, f, indent=4)
            f.write("\n")
        logger.info(
            f"Merged {added_count} new event IDs into {events_file} (Total: {len(merged_list)})"
        )

    return merged_list, added_count


def get_synced_event_ids(conn: sqlite3.Connection) -> Set[str]:
    """Retrieves set of flashscore_event_id already stored in flashscore_match_team_stats."""
    try:
        cursor = conn.cursor()
        rows = cursor.execute(
            "SELECT DISTINCT flashscore_event_id FROM flashscore_match_team_stats WHERE flashscore_event_id IS NOT NULL"
        ).fetchall()
        return {r[0] for r in rows if r[0]}
    except sqlite3.OperationalError as e:
        logger.warning(f"Could not query flashscore_match_team_stats: {e}")
        return set()


def filter_pending_events(
    discovered_ids: List[str],
    synced_ids: Set[str],
    limit: Optional[int] = None,
) -> List[str]:
    """
    Filters out already synced event IDs and optionally limits the batch size.
    Preserves original discovery order.
    """
    pending = [eid for eid in discovered_ids if eid not in synced_ids]
    if limit is not None and limit > 0:
        pending = pending[:limit]
    return pending


def run_sync(
    db_path: str = "liga1.db",
    events_file: str = "tools/discovered_matches.json",
    limit: Optional[int] = None,
    dry_run: bool = False,
    client: Optional[FlashscoreClient] = None,
    delay_range: tuple = (3.5, 6.0),
    cooldown_every: int = 5,
    cooldown_range: tuple = (12.0, 18.0),
    auto_discover: bool = False,
    tournament_url: str = "https://www.flashscore.pe/futbol/peru/liga-1/resultados/",
    events_file_explicitly_set: bool = False,
) -> Dict[str, Any]:
    """
    Main orchestrator execution function.

    Args:
        db_path: Path to SQLite database.
        events_file: Path to discovered matches JSON.
        limit: Max events to process in this run.
        dry_run: If True, skips network requests and database updates.
        client: Optional FlashscoreClient instance (created if None).
        delay_range: Jitter range between consecutive match requests.
        cooldown_every: Number of matches before cooldown block.
        cooldown_range: Cooldown interval range.
        auto_discover: If True, triggers tournament match discovery before syncing.
        tournament_url: URL to tournament results page or feed for discovery.
        events_file_explicitly_set: True if events_file was passed explicitly via CLI/caller.

    Returns:
        Summary dict of synchronization metrics.
    """
    norm_events_file = os.path.normpath(os.path.abspath(events_file))
    norm_default_file = os.path.normpath(os.path.abspath(DEFAULT_EVENTS_FILE))
    is_default_file = (norm_events_file == norm_default_file) and not events_file_explicitly_set

    discovered_ids: List[str] = []
    if os.path.exists(events_file):
        discovered_ids = load_discovered_events(events_file)
    elif not auto_discover:
        discovered_ids = load_discovered_events(events_file)

    conn = get_connection(db_path)

    try:
        synced_ids = get_synced_event_ids(conn)
        pending_before_discovery = [eid for eid in discovered_ids if eid not in synced_ids]

        should_discover = auto_discover or (is_default_file and len(pending_before_discovery) == 0)
        newly_discovered_count = 0

        if should_discover and not dry_run:
            if client is None:
                client = FlashscoreClient()
            logger.info(
                f"Auto-discovery triggered (auto_discover={auto_discover}, "
                f"pending={len(pending_before_discovery)}). Discovering matches from {tournament_url}..."
            )
            discovered_from_web = client.discover_tournament_matches(tournament_url=tournament_url)
            if discovered_from_web:
                discovered_ids, newly_discovered_count = merge_discovered_events(
                    events_file, discovered_from_web
                )

        pending_ids = filter_pending_events(discovered_ids, synced_ids, limit=limit)

        summary: Dict[str, Any] = {
            "total_discovered": len(discovered_ids),
            "newly_discovered": newly_discovered_count,
            "already_synced": len(synced_ids & set(discovered_ids)),
            "pending_count": len([eid for eid in discovered_ids if eid not in synced_ids]),
            "queued_count": len(pending_ids),
            "processed_count": 0,
            "success_count": 0,
            "failed_count": 0,
            "total_rows_inserted": 0,
            "matches_linked_count": 0,
            "circuit_breaker_triggered": False,
            "dry_run": dry_run,
            "results": [],
        }

        if dry_run:
            logger.info(
                f"[DRY RUN] {len(pending_ids)} matches queued (out of {summary['pending_count']} pending). No network calls made."
            )
            return summary

        if not pending_ids:
            logger.info("No pending matches to synchronize. Everything up to date.")
            return summary

        if client is None:
            client = FlashscoreClient()

        logger.info(
            f"Starting batch synchronization of {len(pending_ids)} matches "
            f"(Pacing: {delay_range[0]}-{delay_range[1]}s jitter, Cooldown: {cooldown_every} matches)..."
        )

        batch_results = client.sync_batch_matches(
            db_conn=conn,
            event_ids=pending_ids,
            delay_range=delay_range,
            cooldown_every=cooldown_every,
            cooldown_range=cooldown_range,
        )

        summary["results"] = batch_results
        summary["processed_count"] = len(batch_results)
        summary["success_count"] = sum(1 for r in batch_results if r.get("success"))
        summary["failed_count"] = sum(1 for r in batch_results if not r.get("success"))
        summary["total_rows_inserted"] = sum(r.get("rows_inserted", 0) for r in batch_results)
        summary["matches_linked_count"] = sum(1 for r in batch_results if r.get("match_id"))
        summary["circuit_breaker_triggered"] = client.circuit_breaker_triggered

        return summary

    finally:
        conn.close()


def print_summary_report(summary: Dict[str, Any]) -> None:
    """Prints a clean human-readable summary block to stdout."""
    print("\n" + "=" * 62)
    mode_tag = " [DRY RUN]" if summary.get("dry_run") else ""
    print(f" Flashscore Discovered Matches Sync Summary{mode_tag}")
    print("=" * 62)
    print(f" Total discovered events in file : {summary['total_discovered']}")
    if summary.get("newly_discovered", 0) > 0:
        print(f" Newly discovered events         : {summary['newly_discovered']}")
    print(f" Already synced (skipped)        : {summary['already_synced']}")
    print(f" Remaining pending events        : {summary['pending_count']}")
    print(f" Events queued in current run    : {summary['queued_count']}")

    if not summary.get("dry_run"):
        print(f" Events processed                : {summary['processed_count']}")
        print(f" Succeeded                       : {summary['success_count']}")
        print(f" Failed / Aborted                : {summary['failed_count']}")
        print(f" Metric rows added (SQLite)      : {summary['total_rows_inserted']}")
        print(f" Matches linked to match_id      : {summary['matches_linked_count']}")
        cb_status = "⚠️ YES (HALTED EARLY)" if summary["circuit_breaker_triggered"] else "NO (Clean)"
        print(f" Circuit breaker triggered       : {cb_status}")
    print("=" * 62 + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Synchronize discovered Flashscore match statistics into SQLite."
    )
    parser.add_argument(
        "--db",
        type=str,
        default="liga1.db",
        help="Path to SQLite database file (default: liga1.db)",
    )
    parser.add_argument(
        "--events-file",
        type=str,
        default=None,
        help="Path to discovered matches JSON file (default: tools/discovered_matches.json)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of matches to process in this run (e.g. 9 for a single round)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Inspect queued matches and counts without making network requests",
    )
    parser.add_argument(
        "--auto-discover",
        action="store_true",
        help="Automatically discover new matches from Flashscore tournament results before syncing",
    )
    parser.add_argument(
        "--tournament-url",
        type=str,
        default="https://www.flashscore.pe/futbol/peru/liga-1/resultados/",
        help="Flashscore tournament results page or feed URL for discovery",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    events_file = args.events_file if args.events_file is not None else DEFAULT_EVENTS_FILE
    events_file_explicitly_set = (args.events_file is not None)

    try:
        summary = run_sync(
            db_path=args.db,
            events_file=events_file,
            limit=args.limit,
            dry_run=args.dry_run,
            auto_discover=args.auto_discover,
            tournament_url=args.tournament_url,
            events_file_explicitly_set=events_file_explicitly_set,
        )
        print_summary_report(summary)
    except Exception as e:
        logger.error(f"Synchronization failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

