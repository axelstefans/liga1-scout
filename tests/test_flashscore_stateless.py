"""
Tests for stateless Flashscore synchronization, retry limits, ID validation,
and atomic 6-block transactions.
"""

import json
import os
import sqlite3
import pytest
from unittest.mock import MagicMock, patch

from scraper.sources.flashscore import (
    is_valid_flashscore_event_id,
    get_failed_attempt_count,
    get_pending_flashscore_matches,
    sync_single_match_by_event_id,
    BLACK_LISTED_NAVIGATION_WORDS,
)
from scraper.flashscore_parser import insert_flashscore_team_stats

SAMPLE_PATH = os.path.join(
    os.path.dirname(__file__), "fixtures", "raw_stats_sample.json"
)


@pytest.fixture
def memory_db():
    conn = sqlite3.connect(":memory:", isolation_level=None)
    conn.row_factory = sqlite3.Row

    conn.executescript("""
    CREATE TABLE teams (
        team_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        short_name TEXT,
        slug TEXT,
        country TEXT,
        logo_url TEXT,
        tm_team_id INTEGER,
        tm_team_name TEXT,
        scraped_at TEXT,
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
        xgot REAL,
        shots_total INTEGER,
        shots_on_target INTEGER,
        shots_off_target INTEGER,
        shots_blocked INTEGER,
        shots_inside_box INTEGER,
        shots_outside_box INTEGER,
        big_chances INTEGER,
        big_chances_scored INTEGER,
        big_chances_missed INTEGER,
        hit_woodwork INTEGER,
        headed_goals INTEGER,
        possession REAL,
        passes_total INTEGER,
        passes_completed INTEGER,
        passes_final_third_total INTEGER,
        passes_final_third_completed INTEGER,
        crosses_total INTEGER,
        crosses_completed INTEGER,
        long_balls_total INTEGER,
        long_balls_completed INTEGER,
        xa REAL,
        key_passes INTEGER,
        touches_in_box INTEGER,
        throw_ins INTEGER,
        fouls INTEGER,
        free_kicks INTEGER,
        duels_won INTEGER,
        tackles_total INTEGER,
        tackles_won INTEGER,
        interceptions INTEGER,
        clearances INTEGER,
        offsides INTEGER,
        corner_kicks INTEGER,
        errors_lead_to_shot INTEGER,
        errors_lead_to_goal INTEGER,
        saves INTEGER,
        xgot_faced REAL,
        goals_prevented REAL,
        goal_kicks INTEGER,
        goals_conceded INTEGER,
        yellow_cards INTEGER,
        red_cards INTEGER,
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
    """)

    # Seed 2 teams
    conn.execute("INSERT INTO teams (team_id, name, flashscore_id) VALUES (2311, 'Alianza Lima', 'tSWpiWmI')")
    conn.execute("INSERT INTO teams (team_id, name, flashscore_id) VALUES (63760, 'Cusco FC', 'zDuHd68m')")
    return conn


@pytest.fixture
def raw_sample_data():
    with open(SAMPLE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# ==========================================
# 1. ID Validator Tests
# ==========================================
def test_id_validator_valid_hashes():
    assert is_valid_flashscore_event_id("QPinjf7b") is True
    assert is_valid_flashscore_event_id("29HRVPLq") is True
    assert is_valid_flashscore_event_id("AinlF1tR") is True
    assert is_valid_flashscore_event_id("xbzaMImf") is True


def test_id_validator_rejects_blacklisted_navigation_words():
    for word in BLACK_LISTED_NAVIGATION_WORDS:
        assert is_valid_flashscore_event_id(word) is False
        assert is_valid_flashscore_event_id(word.upper()) is False


def test_id_validator_rejects_invalid_lengths_and_chars():
    assert is_valid_flashscore_event_id("short") is False
    assert is_valid_flashscore_event_id("waytoolongidentifier") is False
    assert is_valid_flashscore_event_id("inv@lid!") is False
    assert is_valid_flashscore_event_id("") is False
    assert is_valid_flashscore_event_id(None) is False


# ==========================================
# 2. Selection Query & Retry Limit Tests
# ==========================================
def test_get_pending_matches_respects_states_and_retry_limits(memory_db):
    # Setup 4 matches
    for mid in range(101, 105):
        memory_db.execute(
            "INSERT INTO matches (match_id, home_team_id, away_team_id, match_date, round, status, season_id) "
            "VALUES (?, 2311, 63760, '2026-05-10', 1, 'played', 88529)",
            (mid,)
        )

    # Match 101: 1 failed attempt -> MUST be included
    memory_db.execute(
        "INSERT INTO scrape_log (resource_type, resource_key, scraped_at, status, error_message) "
        "VALUES ('flashscore', '101', '2026-10-27T10:00:00', 'failed', '[intento 1/3] Timeout')"
    )

    # Match 102: 3 failed attempts -> MUST be excluded (limit reached)
    for i in range(3):
        memory_db.execute(
            "INSERT INTO scrape_log (resource_type, resource_key, scraped_at, status, error_message) "
            "VALUES ('flashscore', '102', '2026-10-27T10:00:00', 'failed', '[intento 3/3] Timeout')"
        )

    # Match 103: permanent 'not_available' -> MUST be excluded
    memory_db.execute(
        "INSERT INTO scrape_log (resource_type, resource_key, scraped_at, status) "
        "VALUES ('flashscore', '103', '2026-10-27T10:00:00', 'not_available')"
    )

    # Match 104: 0 entries -> MUST be included
    pending = get_pending_flashscore_matches(memory_db, season_id=88529)
    pending_ids = [m["match_id"] for m in pending]

    assert 101 in pending_ids, "Match 101 (1 failed attempt) should be eligible for retry"
    assert 104 in pending_ids, "Match 104 (clean) should be eligible"
    assert 102 not in pending_ids, "Match 102 (3 failed attempts) must be blocked"
    assert 103 not in pending_ids, "Match 103 (not_available) must be permanently excluded"


def test_failed_attempt_count_helper(memory_db):
    assert get_failed_attempt_count(memory_db, 999) == 0
    memory_db.execute("INSERT INTO scrape_log (resource_type, resource_key, scraped_at, status) VALUES ('flashscore', '999', '2026-10-27', 'failed')")
    assert get_failed_attempt_count(memory_db, 999) == 1
    memory_db.execute("INSERT INTO scrape_log (resource_type, resource_key, scraped_at, status) VALUES ('flashscore', '999', '2026-10-27', 'failed')")
    assert get_failed_attempt_count(memory_db, 999) == 2


# ==========================================
# 3. In-Memory Retry & Transient Failure
# ==========================================
def test_sync_single_match_in_memory_retry_success(memory_db, raw_sample_data):
    memory_db.execute(
        "INSERT INTO matches (match_id, home_team_id, away_team_id, match_date, round, status, season_id) "
        "VALUES (101, 2311, 63760, '2026-10-11T23:30:00', 11, 'played', 88529)"
    )

    mock_client = MagicMock()
    # First attempt fails, second succeeds
    mock_client.fetch_match_team_stats_raw.side_effect = [None, raw_sample_data]
    mock_client.last_status_code = 200

    res = sync_single_match_by_event_id(
        conn=memory_db,
        event_id="QPinjf7b",
        target_match_id=101,
        client=mock_client,
        max_memory_retries=3,
        backoff_factor=0.01,
    )

    assert res["status"] == "success"
    assert res["rows_inserted"] == 6
    assert mock_client.fetch_match_team_stats_raw.call_count == 2

    # Check scrape_log has 'success'
    log_row = memory_db.execute("SELECT status FROM scrape_log WHERE resource_key = '101'").fetchone()
    assert log_row["status"] == "success"


def test_sync_single_match_transient_exhaustion(memory_db):
    mock_client = MagicMock()
    mock_client.fetch_match_team_stats_raw.return_value = None
    mock_client.last_status_code = 504

    res = sync_single_match_by_event_id(
        conn=memory_db,
        event_id="QPinjf7b",
        target_match_id=202,
        client=mock_client,
        max_memory_retries=3,
        backoff_factor=0.01,
    )

    assert res["status"] == "failed"
    assert "[intento 3/3]" in res["error_message"]
    assert mock_client.fetch_match_team_stats_raw.call_count == 3

    log_row = memory_db.execute("SELECT status, error_message FROM scrape_log WHERE resource_key = '202'").fetchone()
    assert log_row["status"] == "failed"
    assert "[intento 3/3]" in log_row["error_message"]


# ==========================================
# 4. Atomic 6-Blocks Transaction Tests
# ==========================================
def test_insert_flashscore_team_stats_atomic_rollback_on_partial(memory_db):
    # Create 3 rows (partial blocks, expected 6)
    partial_rows = [
        {"match_id": 303, "flashscore_event_id": "test1234", "team_id": 2311, "flashscore_team_id": "tSWpiWmI", "period": "ALL"},
        {"match_id": 303, "flashscore_event_id": "test1234", "team_id": 2311, "flashscore_team_id": "tSWpiWmI", "period": "1T"},
        {"match_id": 303, "flashscore_event_id": "test1234", "team_id": 2311, "flashscore_team_id": "tSWpiWmI", "period": "2T"},
    ]

    with pytest.raises(ValueError, match="Atomic constraint violation: expected exactly 6 blocks"):
        insert_flashscore_team_stats(memory_db, partial_rows, enforce_six_blocks=True)

    # Verify that NOTHING was inserted
    count = memory_db.execute("SELECT COUNT(*) FROM flashscore_match_team_stats WHERE match_id = 303").fetchone()[0]
    assert count == 0, "No partial blocks should have been inserted into the database"


def test_success_after_previous_failed_attempt(memory_db, raw_sample_data):
    memory_db.execute(
        "INSERT INTO matches (match_id, home_team_id, away_team_id, match_date, round, status, season_id) "
        "VALUES (404, 2311, 63760, '2026-10-11T23:30:00', 11, 'played', 88529)"
    )

    # Simulate 1 historical failed attempt
    memory_db.execute(
        "INSERT INTO scrape_log (resource_type, resource_key, scraped_at, status, error_message) "
        "VALUES ('flashscore', '404', '2026-10-26T12:00:00', 'failed', '[intento 1/3] Previous timeout')"
    )

    mock_client = MagicMock()
    mock_client.fetch_match_team_stats_raw.return_value = raw_sample_data
    mock_client.last_status_code = 200

    res = sync_single_match_by_event_id(
        conn=memory_db,
        event_id="QPinjf7b",
        target_match_id=404,
        client=mock_client,
        max_memory_retries=3,
        backoff_factor=0.01,
    )

    assert res["status"] == "success"
    assert res["rows_inserted"] == 6

    # Verify both rows exist in scrape_log: 1 failed, 1 success
    rows = memory_db.execute(
        "SELECT status, error_message FROM scrape_log WHERE resource_key = '404' ORDER BY id ASC"
    ).fetchall()
    assert len(rows) == 2
    assert rows[0]["status"] == "failed"
    assert rows[1]["status"] == "success"
