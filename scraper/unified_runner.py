"""
Unified Unattended Data Pipeline Runner for Liga 1.

Orchestrates incremental multi-source ingestion (Sofascore, Referees, Flashscore, Aggregates)
with atomic locking, automated snapshot backups, defensive rate limiting, and dry-run simulation.
"""

import argparse
import ctypes
import logging
import os
import sqlite3
import sys
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

# Project root setup
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from scraper.db import get_connection
from scraper.http_client import SofaScoreAPIClient
from scraper.sources.matches import scrape_and_store_matches
from scraper.sources.match_period_stats import scrape_and_store_match_period_stats
from scraper.sources.shotmap import scrape_and_store_shotmaps
from scraper.sources.referees import scrape_and_store_referees
from scraper.sources.team_metrics import recompute_match_team_metrics
from scraper.sources.flashscore import (
    get_pending_flashscore_matches,
    sync_single_match_by_event_id,
    get_failed_attempt_count,
    is_valid_flashscore_event_id,
)
from scraper.flashscore_client import FlashscoreClient

DEFAULT_DB_PATH = os.path.join(PROJECT_ROOT, "liga1.db")
DEFAULT_LOCK_FILE = os.path.join(PROJECT_ROOT, ".runner.lock")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("scraper.unified_runner")


def is_pid_alive(pid: int) -> bool:
    """Checks whether a process with the given PID is currently active."""
    if pid <= 0:
        return False
    if os.name == "nt":
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        STILL_ACTIVE = 259
        handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if not handle:
            return False
        exit_code = ctypes.c_ulong()
        success = ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))
        ctypes.windll.kernel32.CloseHandle(handle)
        return bool(success and exit_code.value == STILL_ACTIVE)
    else:
        try:
            os.kill(pid, 0)
            return True
        except (OSError, ProcessLookupError):
            return False


class RunnerLockedError(Exception):
    """Raised when an active runner process already holds the lockfile."""
    pass


class RunnerLock:
    """Manages an atomic filesystem lock with stale lock detection."""

    def __init__(self, lock_path: str = DEFAULT_LOCK_FILE):
        self.lock_path = lock_path
        self.fd: Optional[int] = None

    def acquire(self) -> None:
        try:
            self.fd = os.open(self.lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(self.fd, str(os.getpid()).encode("utf-8"))
        except FileExistsError:
            stale = False
            try:
                with open(self.lock_path, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                pid = int(content) if content.isdigit() else -1
                if not is_pid_alive(pid):
                    logger.warning(
                        f"Lockfile {self.lock_path} held by dead PID {pid}. Recovering stale lock."
                    )
                    stale = True
                else:
                    logger.error(
                        f"Lockfile {self.lock_path} already held by running PID {pid}. Aborting execution."
                    )
                    raise RunnerLockedError(f"Process {pid} is already running.")
            except RunnerLockedError:
                raise
            except Exception as e:
                logger.warning(f"Failed to inspect lockfile {self.lock_path} ({e}). Treating as stale.")
                stale = True

            if stale:
                try:
                    os.unlink(self.lock_path)
                except Exception:
                    pass
                self.fd = os.open(self.lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.write(self.fd, str(os.getpid()).encode("utf-8"))

    def release(self) -> None:
        if self.fd is not None:
            try:
                os.close(self.fd)
            except Exception:
                pass
            self.fd = None
        if os.path.exists(self.lock_path):
            try:
                os.unlink(self.lock_path)
            except Exception as e:
                logger.warning(f"Failed to unlink lockfile {self.lock_path}: {e}")


def create_snapshot_backup(src_conn: sqlite3.Connection, backups_dir: str = "backups") -> str:
    """Creates a point-in-time snapshot of the database using sqlite3 backup API."""
    os.makedirs(backups_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(backups_dir, f"liga1_backup_{timestamp}.db")

    dst = sqlite3.connect(backup_path)
    with dst:
        src_conn.backup(dst)

    integrity = dst.execute("PRAGMA integrity_check").fetchone()[0]
    dst.close()

    if integrity != "ok":
        raise RuntimeError(f"Snapshot backup integrity check failed: {integrity}")

    logger.info(f"Snapshot backup created and verified: {backup_path}")
    return backup_path


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    """Parses and validates CLI arguments for the unified runner."""
    parser = argparse.ArgumentParser(
        description="Unified incremental pipeline runner for Liga 1 (Sofascore, Referees, Flashscore, Aggregates)"
    )

    parser.add_argument(
        "--recent",
        nargs="?",
        const=5,
        default=None,
        type=int,
        help="Process matches from the last N days (default: 5 if flag provided without value)",
    )
    parser.add_argument(
        "--round",
        type=int,
        help="Round number to process (requires --tournament)",
    )
    parser.add_argument(
        "--tournament",
        choices=["Apertura", "Clausura"],
        help="Tournament name ('Apertura' or 'Clausura')",
    )
    parser.add_argument(
        "--only",
        choices=["sofascore", "flashscore", "aggregates"],
        help="Run only the specified pipeline phase",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate execution without modifying the database or making network calls",
    )
    parser.add_argument(
        "--db-path",
        default=DEFAULT_DB_PATH,
        help=f"Path to SQLite database (default: {DEFAULT_DB_PATH})",
    )
    parser.add_argument(
        "--lock-file",
        default=DEFAULT_LOCK_FILE,
        help=f"Path to runner lockfile (default: {DEFAULT_LOCK_FILE})",
    )

    args = parser.parse_args(argv)

    # Mutually exclusive --recent and --round (when both explicitly provided)
    # Check raw argv if passed to detect explicit --recent together with --round
    raw_argv = argv if argv is not None else sys.argv[1:]
    has_recent_explicit = any(arg.startswith("--recent") for arg in raw_argv)
    has_round_explicit = any(arg.startswith("--round") for arg in raw_argv)

    if has_recent_explicit and has_round_explicit:
        parser.error("Arguments --recent and --round are mutually exclusive")

    # If --round is provided, ensure recent is None
    if args.round is not None:
        args.recent = None
    elif args.recent is None:
        # Default to recent=5 when neither --round nor --recent specified
        args.recent = 5

    # 3. --round requires --tournament
    if args.round is not None and args.tournament is None:
        parser.error("Argument --round requires --tournament {Apertura,Clausura}")

    # 4. DIAS must be positive
    if args.recent is not None and args.recent <= 0:
        parser.error("Argument --recent DIAS must be a positive integer (> 0)")

    return args


def query_scoped_matches(
    conn: sqlite3.Connection,
    recent_days: Optional[int] = None,
    round_num: Optional[int] = None,
    tournament: Optional[str] = None,
    season_id: int = 88529,
) -> List[Dict[str, Any]]:
    """Retrieves target fixtures within the execution scope."""
    clauses = ["m.season_id = ?"]
    params: List[Any] = [season_id]

    if recent_days is not None:
        cutoff = (datetime.now() - timedelta(days=recent_days)).strftime("%Y-%m-%dT%H:%M:%S")
        clauses.append("m.match_date >= ?")
        params.append(cutoff)
    elif round_num is not None and tournament is not None:
        clauses.append("m.round = ?")
        params.append(round_num)
        clauses.append("CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END = ?")
        params.append(tournament)

    where_sql = " AND ".join(clauses)
    sql = f"""
    SELECT m.match_id, m.match_date, m.round, m.status, m.season_id,
           m.home_team_id, ht.name as home_name,
           m.away_team_id, at.name as away_name,
           m.referee_id,
           CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END as tournament
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.team_id
    JOIN teams at ON m.away_team_id = at.team_id
    WHERE {where_sql}
    ORDER BY m.match_date ASC
    """
    rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def run_pipeline(args: argparse.Namespace) -> int:
    """Main execution orchestrator."""
    start_time = time.time()
    db_path = args.db_path
    dry_run = args.dry_run

    summary: Dict[str, Any] = {
        "scope": {
            "mode": "recent" if args.recent is not None else "round",
            "recent_days": args.recent,
            "round": args.round,
            "tournament": args.tournament,
            "dry_run": dry_run,
            "only": args.only,
        },
        "phases": {
            "backup_and_lock": {"status": "skipped", "duration": 0.0},
            "sofascore": {"status": "skipped", "processed": 0, "referees_assigned": 0, "pending_referees": [], "errors": [], "duration": 0.0},
            "flashscore": {"status": "skipped", "processed": 0, "blocks_inserted": 0, "pending": [], "errors": [], "duration": 0.0},
            "aggregates": {"status": "skipped", "recomputed_matches": 0, "errors": [], "duration": 0.0},
        },
        "success": False,
        "total_duration": 0.0,
    }

    lock = RunnerLock(args.lock_file)

    # In dry-run mode, connect read-only URI to ensure zero DB writes
    if dry_run:
        uri = f"file:{os.path.abspath(db_path)}?mode=ro"
        conn = sqlite3.connect(uri, uri=True)
        conn.row_factory = sqlite3.Row
    else:
        # Phase 0: Lock acquisition
        t0 = time.time()
        try:
            lock.acquire()
        except RunnerLockedError as e:
            logger.error(f"Execution aborted: {e}")
            return 2

        conn = get_connection(db_path)
        # Snapshot backup before any write
        try:
            backup_path = create_snapshot_backup(conn)
            summary["phases"]["backup_and_lock"] = {
                "status": "success",
                "backup_path": backup_path,
                "duration": round(time.time() - t0, 3),
            }
        except Exception as e:
            logger.critical(f"Failed to create snapshot backup: {e}")
            lock.release()
            conn.close()
            return 1

    fatal_errors = 0

    try:
        scoped_matches = query_scoped_matches(
            conn,
            recent_days=args.recent,
            round_num=args.round,
            tournament=args.tournament,
        )
        summary["scoped_matches_count"] = len(scoped_matches)

        # ==========================================
        # Phase 1: Sofascore Ingestion
        # ==========================================
        if args.only in (None, "sofascore"):
            t_sofa = time.time()
            sofa_phase = summary["phases"]["sofascore"]
            sofa_phase["status"] = "running"

            if dry_run:
                # Dry run estimation
                played_in_scope = [m for m in scoped_matches if m["status"] == "played"]
                missing_refs = [m for m in played_in_scope if m["referee_id"] is None]
                sofa_phase.update({
                    "status": "dry_run",
                    "scoped_matches": len(scoped_matches),
                    "played_matches": len(played_in_scope),
                    "missing_referees_count": len(missing_refs),
                    "new_sofascore_fixtures": "no estimable en dry-run (requiere red)",
                    "duration": round(time.time() - t_sofa, 3),
                })
            else:
                api_client = SofaScoreAPIClient()
                try:
                    # 1. Update fixtures table
                    scrape_and_store_matches(conn, api_client)
                    # Re-query scoped matches after fixtures update
                    scoped_matches = query_scoped_matches(
                        conn,
                        recent_days=args.recent,
                        round_num=args.round,
                        tournament=args.tournament,
                    )
                except Exception as e:
                    logger.error(f"Sofascore fixtures update failed: {e}")
                    sofa_phase["errors"].append(f"Fixtures error: {e}")

                # 2. Period stats
                try:
                    scrape_and_store_match_period_stats(conn, api_client, matches=scoped_matches)
                except Exception as e:
                    logger.error(f"Match period stats update failed: {e}")
                    sofa_phase["errors"].append(f"Period stats error: {e}")

                # 3. Shotmaps
                try:
                    scrape_and_store_shotmaps(conn, api_client, test_mode=False)
                except Exception as e:
                    logger.error(f"Shotmaps update failed: {e}")
                    sofa_phase["errors"].append(f"Shotmap error: {e}")

                # 4. Referees
                try:
                    assigned_count = scrape_and_store_referees(conn)
                    sofa_phase["referees_assigned"] = assigned_count
                except Exception as e:
                    logger.error(f"Referee ingestion failed: {e}")
                    sofa_phase["errors"].append(f"Referee error: {e}")

                api_client.close()

                # Check played matches lacking referees
                for m in scoped_matches:
                    if m["status"] == "played" and m["referee_id"] is None:
                        sofa_phase["pending_referees"].append({
                            "match_id": m["match_id"],
                            "match_date": m["match_date"],
                            "matchup": f"{m['home_name']} vs {m['away_name']}",
                            "reason": "Referee not assigned on Sofascore source",
                        })

                sofa_phase["status"] = "success" if not sofa_phase["errors"] else "partial_error"
                sofa_phase["duration"] = round(time.time() - t_sofa, 3)

        # ==========================================
        # Phase 2: Flashscore Ingestion
        # ==========================================
        if args.only in (None, "flashscore"):
            t_fs = time.time()
            fs_phase = summary["phases"]["flashscore"]
            fs_phase["status"] = "running"

            # Query pending matches within scope
            scoped_match_ids = {m["match_id"] for m in scoped_matches if m["status"] == "played"}

            # Query all matches lacking complete 6 blocks
            pending_fs_candidates = get_pending_flashscore_matches(conn, season_id=88529)
            scoped_pending = [m for m in pending_fs_candidates if m["match_id"] in scoped_match_ids]

            if dry_run:
                fs_phase.update({
                    "status": "dry_run",
                    "pending_matches_count": len(scoped_pending),
                    "pending_matches": [
                        {
                            "match_id": m["match_id"],
                            "matchup": f"{m['home_name']} vs {m['away_name']}",
                            "match_date": m["match_date"],
                            "failed_attempts": get_failed_attempt_count(conn, m["match_id"]),
                        }
                        for m in scoped_pending
                    ],
                    "duration": round(time.time() - t_fs, 3),
                })
            else:
                fs_client = FlashscoreClient()
                for p_match in scoped_pending:
                    m_id = p_match["match_id"]
                    # Resolve event ID using FlashscoreClient discovery or mapping
                    # When event ID is not yet linked, we attempt to find it via FlashscoreClient
                    # using the team hashes
                    home_fs = p_match["home_fs_id"]
                    away_fs = p_match["away_fs_id"]
                    resolved_event_id = None

                    # If team hashes available, search team results page
                    if home_fs:
                        try:
                            team_url = f"https://www.flashscore.pe/equipo/team/{home_fs}/resultados/"
                            found_eids = fs_client.discover_tournament_matches(team_url)
                            for eid in found_eids:
                                if is_valid_flashscore_event_id(eid):
                                    # Test sync using candidate event ID
                                    res = sync_single_match_by_event_id(
                                        conn=conn,
                                        event_id=eid,
                                        target_match_id=m_id,
                                        client=fs_client,
                                    )
                                    if res["status"] == "success":
                                        resolved_event_id = eid
                                        fs_phase["processed"] += 1
                                        fs_phase["blocks_inserted"] += res["rows_inserted"]
                                        break
                        except Exception as e:
                            logger.error(f"Error discovering Flashscore event for match {m_id}: {e}")
                            fs_phase["errors"].append(f"Match {m_id}: {e}")

                    if not resolved_event_id:
                        attempts = get_failed_attempt_count(conn, m_id)
                        fs_phase["pending"].append({
                            "match_id": m_id,
                            "matchup": f"{p_match['home_name']} vs {p_match['away_name']}",
                            "reason": "Flashscore event ID could not be resolved from team feeds",
                            "failed_attempts": attempts,
                        })

                fs_phase["status"] = "success" if not fs_phase["errors"] else "partial_error"
                fs_phase["duration"] = round(time.time() - t_fs, 3)

        # ==========================================
        # Phase 3: Aggregates Recomputation
        # ==========================================
        if args.only in (None, "aggregates"):
            t_agg = time.time()
            agg_phase = summary["phases"]["aggregates"]
            agg_phase["status"] = "running"

            # Determine affected matches: played matches in scope
            played_matches = [m for m in scoped_matches if m["status"] == "played"]

            if dry_run:
                agg_phase.update({
                    "status": "dry_run",
                    "affected_matches_count": len(played_matches),
                    "affected_matches": [m["match_id"] for m in played_matches],
                    "team_metrics_action": f"Would recompute {len(played_matches) * 2} team_match_metrics rows via recompute_match_team_metrics",
                    "percentiles_note": "Player percentiles require full distribution recalculation; not triggered in incremental scope",
                    "duration": round(time.time() - t_agg, 3),
                })
            else:
                recomputed_count = 0
                for m in played_matches:
                    try:
                        recomputed_count += recompute_match_team_metrics(conn, m["match_id"])
                    except Exception as e:
                        logger.error(f"Error recomputing metrics for match {m['match_id']}: {e}")
                        agg_phase["errors"].append(f"Match {m['match_id']}: {e}")

                agg_phase["recomputed_matches"] = len(played_matches)
                agg_phase["rows_recomputed"] = recomputed_count
                agg_phase["status"] = "success" if not agg_phase["errors"] else "partial_error"
                agg_phase["duration"] = round(time.time() - t_agg, 3)

        # ==========================================
        # Phase 4: Final Database Health Check
        # ==========================================
        if not dry_run:
            integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
            if integrity != "ok":
                fatal_errors += 1
                logger.critical(f"Final PRAGMA integrity_check failed: {integrity}")
            summary["database_integrity"] = integrity

            fk_violations = conn.execute("PRAGMA foreign_key_check").fetchall()
            # Only count new violations outside player_match_stats
            table_violations = [r[0] for r in fk_violations if r[0] != "player_match_stats"]
            summary["foreign_key_violations"] = len(table_violations)
            if table_violations:
                fatal_errors += 1
                logger.error(f"Foreign key violations found in: {set(table_violations)}")

        summary["success"] = (fatal_errors == 0)

    except Exception as e:
        logger.critical(f"Fatal error during pipeline run: {e}", exc_info=True)
        fatal_errors += 1
        summary["fatal_error"] = str(e)
    finally:
        summary["total_duration"] = round(time.time() - start_time, 3)
        conn.close()
        if not dry_run:
            lock.release()

    # Print structured human-readable summary report
    print_runner_report(summary)
    return 0 if fatal_errors == 0 else 1


def print_runner_report(summary: Dict[str, Any]) -> None:
    """Formats and prints the pipeline report to stdout."""
    scope = summary["scope"]
    mode_str = " [DRY-RUN]" if scope.get("dry_run") else ""
    print("\n" + "=" * 65)
    print(f" LIGA 1 DATA PIPELINE: UNIFIED RUNNER REPORT{mode_str}")
    print("=" * 65)

    if scope["mode"] == "recent":
        print(f" Scope                : Last {scope['recent_days']} days")
    else:
        print(f" Scope                : Round {scope['round']} ({scope['tournament']})")
    print(f" Scoped Fixtures      : {summary.get('scoped_matches_count', 0)}")
    print(f" Target Phase Filter  : {scope.get('only') or 'All Phases (Full Ingestion)'}")
    print("-" * 65)

    phases = summary["phases"]

    # Phase 0: Lock & Backup
    p0 = phases["backup_and_lock"]
    print(f" [0] Lock & Snapshot  : {p0['status'].upper()} ({p0.get('duration', 0.0)}s)")
    if p0.get("backup_path"):
        print(f"     Backup Snapshot  : {p0['backup_path']}")

    # Phase 1: Sofascore
    p1 = phases["sofascore"]
    print(f" [1] Sofascore Source : {p1['status'].upper()} ({p1.get('duration', 0.0)}s)")
    if p1.get("status") == "dry_run":
        print(f"     Played Fixtures  : {p1.get('played_matches', 0)} of {p1.get('scoped_matches', 0)}")
        print(f"     Missing Referee  : {p1.get('missing_referees_count', 0)} fixtures")
        print(f"     API Fixtures Sync: {p1.get('new_sofascore_fixtures')}")
    else:
        print(f"     Referees Assigned: {p1.get('referees_assigned', 0)}")
        if p1.get("pending_referees"):
            print(f"     Pending Referees : {len(p1['pending_referees'])} fixtures")
            for pr in p1["pending_referees"][:3]:
                print(f"       * Match {pr['match_id']}: {pr['matchup']} ({pr['reason']})")

    # Phase 2: Flashscore
    p2 = phases["flashscore"]
    print(f" [2] Flashscore Source: {p2['status'].upper()} ({p2.get('duration', 0.0)}s)")
    if p2.get("status") == "dry_run":
        print(f"     Pending Matches  : {p2.get('pending_matches_count', 0)}")
        for pm in p2.get("pending_matches", [])[:3]:
            print(f"       * Match {pm['match_id']}: {pm['matchup']} (Failed: {pm['failed_attempts']}/3)")
    else:
        print(f"     Matches Synced   : {p2.get('processed', 0)}")
        print(f"     Blocks Inserted  : {p2.get('blocks_inserted', 0)}")
        if p2.get("pending"):
            print(f"     Pending Matches  : {len(p2['pending'])}")
            for pm in p2["pending"][:3]:
                print(f"       * Match {pm['match_id']}: {pm['matchup']} (Attempts: {pm['failed_attempts']}/3)")

    # Phase 3: Aggregates
    p3 = phases["aggregates"]
    print(f" [3] Aggregates       : {p3['status'].upper()} ({p3.get('duration', 0.0)}s)")
    if p3.get("status") == "dry_run":
        print(f"     Target Fixtures  : {p3.get('affected_matches_count', 0)}")
        print(f"     Team Metrics     : {p3.get('team_metrics_action')}")
        print(f"     Player Percentile: {p3.get('percentiles_note')}")
    else:
        print(f"     Metrics Updated  : {p3.get('recomputed_matches', 0)} matches ({p3.get('rows_recomputed', 0)} rows)")

    print("-" * 65)
    print(f" Total Duration       : {summary['total_duration']}s")
    if "database_integrity" in summary:
        print(f" Database Health      : Integrity={summary['database_integrity']}, FK Violations={summary.get('foreign_key_violations', 0)}")
    print("=" * 65 + "\n")


def main(argv: Optional[List[str]] = None) -> None:
    args = parse_args(argv)
    exit_code = run_pipeline(args)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
