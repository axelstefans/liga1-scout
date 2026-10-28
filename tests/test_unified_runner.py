"""
Comprehensive unit and integration tests for scraper/unified_runner.py.
Uses in-memory / temporary databases and mocks to guarantee ZERO real network calls or writes.
"""

import hashlib
import os
import sqlite3
from unittest.mock import MagicMock, patch
import pytest

from scraper.unified_runner import (
    parse_args,
    is_pid_alive,
    RunnerLock,
    RunnerLockedError,
    create_snapshot_backup,
    query_scoped_matches,
    run_pipeline,
)


@pytest.fixture
def temp_db(tmp_path):
    """Creates a temporary SQLite database initialized with minimal Liga 1 schema."""
    db_file = tmp_path / "test_liga1.db"
    conn = sqlite3.connect(str(db_file), isolation_level=None)
    conn.row_factory = sqlite3.Row

    conn.executescript("""
    CREATE TABLE teams (
        team_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        flashscore_id TEXT
    );

    CREATE TABLE matches (
        match_id INTEGER PRIMARY KEY,
        home_team_id INTEGER REFERENCES teams(team_id),
        away_team_id INTEGER REFERENCES teams(team_id),
        match_date TEXT NOT NULL,
        round INTEGER,
        home_score INTEGER,
        away_score INTEGER,
        status TEXT NOT NULL,
        match_url TEXT,
        season_id INTEGER,
        scraped_at TEXT,
        referee_id INTEGER
    );

    CREATE TABLE flashscore_match_team_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER,
        flashscore_event_id TEXT NOT NULL,
        team_id INTEGER NOT NULL,
        flashscore_team_id TEXT NOT NULL,
        period TEXT NOT NULL,
        xg REAL,
        shots_total INTEGER,
        possession REAL,
        UNIQUE (flashscore_event_id, team_id, period)
    );

    CREATE TABLE scrape_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_type TEXT NOT NULL,
        resource_key TEXT NOT NULL,
        scraped_at TEXT NOT NULL,
        status TEXT NOT NULL,
        http_status_code INTEGER,
        error_message TEXT,
        response_size_bytes INTEGER
    );

    CREATE TABLE team_match_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER,
        team_id INTEGER,
        season_id INTEGER,
        opponent_team_id INTEGER
    );
    """)

    # Seed teams
    conn.execute("INSERT INTO teams VALUES (2311, 'Alianza Lima', 'tSWpiWmI')")
    conn.execute("INSERT INTO teams VALUES (2305, 'Universitario', 'xhw3JTnU')")

    # Seed matches: Clausura Round 13 (2026-10-24)
    conn.execute(
        "INSERT INTO matches VALUES (101, 2311, 2305, '2026-10-24T20:00:00', 13, 2, 1, 'played', 'url1', 88529, '2026-10-24', 786583)"
    )
    # Seed matches: Clausura Round 14 (2026-10-28)
    conn.execute(
        "INSERT INTO matches VALUES (102, 2305, 2311, '2026-10-28T20:00:00', 14, NULL, NULL, 'scheduled', 'url2', 88529, '2026-10-28', NULL)"
    )
    conn.close()
    return str(db_file)


def get_file_checksum(filepath: str) -> str:
    """Computes SHA256 checksum of a file."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            hasher.update(chunk)
    return hasher.hexdigest()


# ==========================================
# 1. CLI Parsing & Validation Tests
# ==========================================
def test_cli_parsing_recent_defaults_to_5():
    args = parse_args(["--recent"])
    assert args.recent == 5
    assert args.round is None
    assert args.tournament is None


def test_cli_parsing_recent_custom_value():
    args = parse_args(["--recent", "7"])
    assert args.recent == 7


def test_cli_parsing_round_and_tournament():
    args = parse_args(["--round", "14", "--tournament", "Clausura"])
    assert args.round == 14
    assert args.tournament == "Clausura"
    assert args.recent is None


def test_cli_parsing_no_flags_defaults_to_recent_5():
    args = parse_args([])
    assert args.recent == 5
    assert args.round is None


def test_cli_parsing_error_both_recent_and_round():
    with pytest.raises(SystemExit):
        parse_args(["--recent", "5", "--round", "14", "--tournament", "Clausura"])


def test_cli_parsing_error_round_without_tournament():
    with pytest.raises(SystemExit):
        parse_args(["--round", "14"])


def test_cli_parsing_error_negative_recent_days():
    with pytest.raises(SystemExit):
        parse_args(["--recent", "-3"])


def test_cli_parsing_only_phases():
    for phase in ["sofascore", "flashscore", "aggregates"]:
        args = parse_args(["--recent", "5", "--only", phase])
        assert args.only == phase


# ==========================================
# 2. Lockfile Tests
# ==========================================
def test_lock_clean_acquire_and_release(tmp_path):
    lock_file = str(tmp_path / ".test.lock")
    lock = RunnerLock(lock_file)
    lock.acquire()
    assert os.path.exists(lock_file)
    with open(lock_file, "r") as f:
        assert f.read().strip() == str(os.getpid())
    lock.release()
    assert not os.path.exists(lock_file)


def test_lock_recovers_stale_lock_from_dead_pid(tmp_path):
    lock_file = str(tmp_path / ".test.lock")
    # Simulate dead process lock
    with open(lock_file, "w") as f:
        f.write("9999999")

    lock = RunnerLock(lock_file)
    lock.acquire()
    assert os.path.exists(lock_file)
    with open(lock_file, "r") as f:
        assert f.read().strip() == str(os.getpid())
    lock.release()


def test_lock_aborts_on_alive_process(tmp_path):
    lock_file = str(tmp_path / ".test.lock")
    # Simulate active process with current PID
    with open(lock_file, "w") as f:
        f.write(str(os.getpid()))

    lock = RunnerLock(lock_file)
    with pytest.raises(RunnerLockedError):
        lock.acquire()
    assert os.path.exists(lock_file)
    os.unlink(lock_file)


# ==========================================
# 3. Snapshot Backup Tests
# ==========================================
def test_create_snapshot_backup_verifies_integrity(temp_db, tmp_path):
    conn = sqlite3.connect(temp_db)
    backups_dir = str(tmp_path / "backups")
    backup_file = create_snapshot_backup(conn, backups_dir=backups_dir)

    assert os.path.exists(backup_file)
    dst = sqlite3.connect(backup_file)
    integrity = dst.execute("PRAGMA integrity_check").fetchone()[0]
    dst.close()
    conn.close()
    assert integrity == "ok"


# ==========================================
# 4. Dry-Run Purity & Invariants Tests
# ==========================================
def test_dry_run_makes_zero_writes_and_no_locks_or_backups(temp_db, tmp_path):
    lock_file = str(tmp_path / ".dry.lock")
    initial_checksum = get_file_checksum(temp_db)

    args = parse_args([
        "--recent", "10",
        "--dry-run",
        "--db-path", temp_db,
        "--lock-file", lock_file,
    ])

    exit_code = run_pipeline(args)
    assert exit_code == 0

    # Invariants:
    # 1. No lockfile created
    assert not os.path.exists(lock_file)
    # 2. Database checksum unchanged
    final_checksum = get_file_checksum(temp_db)
    assert initial_checksum == final_checksum, "Database was modified during --dry-run!"


# ==========================================
# 5. Pipeline Phase Execution & --only Filter
# ==========================================
@patch("scraper.unified_runner.recompute_match_team_metrics", return_value=2)
def test_only_aggregates_runs_without_sofascore(mock_metrics, temp_db, tmp_path):
    lock_file = str(tmp_path / ".only_agg.lock")
    args = parse_args([
        "--round", "13",
        "--tournament", "Clausura",
        "--only", "aggregates",
        "--db-path", temp_db,
        "--lock-file", lock_file,
    ])

    exit_code = run_pipeline(args)
    assert exit_code == 0
    # Should call metrics recomputation for match 101 (played)
    assert mock_metrics.called


def test_pipeline_failure_code_and_lock_cleanup(temp_db, tmp_path):
    lock_file = str(tmp_path / ".fail.lock")

    args = parse_args([
        "--recent", "5",
        "--db-path", temp_db,
        "--lock-file", lock_file,
    ])

    # Force a failure during execution
    with patch("scraper.unified_runner.query_scoped_matches", side_effect=RuntimeError("Simulated query crash")):
        exit_code = run_pipeline(args)
        assert exit_code != 0

    # Lock must be cleaned up in finally block
    assert not os.path.exists(lock_file), "Lockfile was not released on pipeline failure!"


# ==========================================
# 6. Scoped Match Query Filtering
# ==========================================
def test_query_scoped_matches_tournament_and_round(temp_db):
    conn = sqlite3.connect(temp_db)
    conn.row_factory = sqlite3.Row

    # Clausura round 13
    r13 = query_scoped_matches(conn, round_num=13, tournament="Clausura")
    assert len(r13) == 1
    assert r13[0]["match_id"] == 101
    assert r13[0]["tournament"] == "Clausura"

    # Clausura round 14
    r14 = query_scoped_matches(conn, round_num=14, tournament="Clausura")
    assert len(r14) == 1
    assert r14[0]["match_id"] == 102

    # Apertura round 13 (non-existent in seeded fixture dates)
    ap13 = query_scoped_matches(conn, round_num=13, tournament="Apertura")
    assert len(ap13) == 0

    conn.close()
