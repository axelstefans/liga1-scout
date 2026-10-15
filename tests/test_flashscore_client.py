"""
Unit and integration tests for FlashscoreClient with rate limiting and circuit breaker protection.
"""

import json
import os
import sqlite3
from unittest.mock import MagicMock, patch, call
import pytest
from curl_cffi.requests.exceptions import Timeout

from scraper.flashscore_client import FlashscoreClient
from scraper.flashscore_mapping import seed_flashscore_team_mappings

SAMPLE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "tools", "raw_stats_sample.json"
)
MIGRATION_020_PATH = os.path.join(
    os.path.dirname(__file__), "..", "migrations", "020_flashscore_match_team_stats.sql"
)


@pytest.fixture
def raw_sample_data():
    with open(SAMPLE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def memory_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row

    # Create schema
    conn.execute(
        """
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
        )
        """
    )
    conn.execute(
        """
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
            scraped_at TEXT
        )
        """
    )

    with open(MIGRATION_020_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    # Insert Cusco FC and Alianza Lima
    conn.execute(
        "INSERT INTO teams (team_id, name, short_name, slug, scraped_at) VALUES (63760, 'Cusco FC', 'Cusco', 'cusco-fc', datetime())"
    )
    conn.execute(
        "INSERT INTO teams (team_id, name, short_name, slug, scraped_at) VALUES (2311, 'Alianza Lima', 'Alianza Lima', 'alianza-lima', datetime())"
    )

    # Insert match fixture
    conn.execute(
        """
        INSERT INTO matches (match_id, home_team_id, away_team_id, match_date, round, status, season_id, scraped_at)
        VALUES (16280833, 63760, 2311, '2026-10-11T23:30:00', 11, 'scheduled', 88529, datetime())
        """
    )
    conn.commit()

    # Seed team mappings
    seed_flashscore_team_mappings(conn)

    yield conn
    conn.close()


def test_client_initialization_defaults():
    client = FlashscoreClient()
    assert client.impersonate == "chrome124"
    assert "https://www.flashscore.pe" in client.headers["Origin"]
    assert "global.ds.lsapp.eu:443" in client.resolve
    assert client.resolve["global.ds.lsapp.eu:443"] == "34.110.235.253"
    assert client.circuit_breaker_triggered is False


@patch("curl_cffi.requests.get")
def test_fetch_match_team_stats_raw_success(mock_get, raw_sample_data):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = raw_sample_data
    mock_get.return_value = mock_resp

    client = FlashscoreClient()
    result = client.fetch_match_team_stats_raw("QPinjf7b")

    assert result is not None
    assert "data" in result
    assert mock_get.called
    call_args = mock_get.call_args
    assert "eventId=QPinjf7b" in call_args[0][0]
    assert call_args[1]["impersonate"] == "chrome124"


@patch("curl_cffi.requests.get")
def test_fetch_match_team_stats_circuit_breaker_on_429(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 429
    mock_get.return_value = mock_resp

    client = FlashscoreClient(max_retries=3)
    result = client.fetch_match_team_stats_raw("rate_limited_event")

    assert result is None
    assert client.circuit_breaker_triggered is True
    assert client.last_status_code == 429
    # Must fail fast without retrying on 429
    assert mock_get.call_count == 1


@patch("curl_cffi.requests.get")
def test_fetch_match_team_stats_circuit_breaker_on_403(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 403
    mock_get.return_value = mock_resp

    client = FlashscoreClient(max_retries=3)
    result = client.fetch_match_team_stats_raw("forbidden_event")

    assert result is None
    assert client.circuit_breaker_triggered is True
    assert client.last_status_code == 403
    # Must fail fast without retrying on 403
    assert mock_get.call_count == 1


@patch("curl_cffi.requests.get")
def test_fetch_match_team_stats_raw_timeout(mock_get):
    mock_get.side_effect = Timeout("Connection timed out")

    client = FlashscoreClient(max_retries=2)
    result = client.fetch_match_team_stats_raw("timeout_event")

    assert result is None
    assert mock_get.call_count == 2
    assert client.circuit_breaker_triggered is True


@patch.object(FlashscoreClient, "fetch_match_team_stats_raw")
def test_sync_match_stats_success(mock_fetch, memory_db, raw_sample_data):
    mock_fetch.return_value = raw_sample_data

    client = FlashscoreClient()
    summary = client.sync_match_stats(memory_db, "QPinjf7b", delay_seconds=0)

    assert summary["event_id"] == "QPinjf7b"
    assert summary["success"] is True
    assert summary["rows_inserted"] == 6
    assert summary["match_id"] == 16280833
    assert summary["circuit_breaker_triggered"] is False

    # Check SQLite persistence
    cursor = memory_db.execute(
        "SELECT COUNT(*) FROM flashscore_match_team_stats WHERE flashscore_event_id = 'QPinjf7b'"
    )
    assert cursor.fetchone()[0] == 6


@patch.object(FlashscoreClient, "fetch_match_team_stats_raw")
def test_sync_match_stats_network_failure(mock_fetch, memory_db):
    mock_fetch.return_value = None

    client = FlashscoreClient()
    summary = client.sync_match_stats(memory_db, "failed_event", delay_seconds=0)

    assert summary["event_id"] == "failed_event"
    assert summary["success"] is False
    assert summary["rows_inserted"] == 0
    assert summary["match_id"] is None
    assert "error" in summary


@patch("time.sleep")
@patch.object(FlashscoreClient, "sync_match_stats")
def test_sync_batch_matches_cooldown_and_jitter(mock_sync, mock_sleep, memory_db):
    mock_sync.side_effect = lambda db_conn, event_id, delay_seconds=0: {
        "event_id": event_id,
        "success": True,
        "rows_inserted": 6,
        "match_id": 100,
        "circuit_breaker_triggered": False,
    }

    client = FlashscoreClient()
    # Batch of 7 matches with cooldown every 5 matches
    event_ids = [f"evt_{i}" for i in range(1, 8)]
    batch_results = client.sync_batch_matches(
        db_conn=memory_db,
        event_ids=event_ids,
        delay_range=(4.0, 4.0),
        cooldown_every=5,
        cooldown_range=(15.0, 15.0),
    )

    assert len(batch_results) == 7
    assert mock_sync.call_count == 7

    # Check that cooldown pause of 15.0s was triggered once (after the 5th match)
    sleep_durations = [call_args[0][0] for call_args in mock_sleep.call_args_list]
    assert 15.0 in sleep_durations


@patch("curl_cffi.requests.get")
def test_sync_batch_circuit_breaker_stops_batch(mock_get, memory_db, raw_sample_data):
    # Match 1: 200 OK
    resp_200 = MagicMock()
    resp_200.status_code = 200
    resp_200.json.return_value = raw_sample_data

    # Match 2: 429 Too Many Requests (Trigger Circuit Breaker)
    resp_429 = MagicMock()
    resp_429.status_code = 429

    mock_get.side_effect = [resp_200, resp_429]

    client = FlashscoreClient(max_retries=1)
    event_ids = ["evt_1", "evt_2", "evt_3", "evt_4"]

    results = client.sync_batch_matches(
        db_conn=memory_db,
        event_ids=event_ids,
        delay_range=(0.0, 0.0),
    )

    # Must only process evt_1 and evt_2, halting before evt_3 and evt_4
    assert len(results) == 2
    assert results[0]["event_id"] == "evt_1"
    assert results[0]["success"] is True
    assert results[0]["circuit_breaker_triggered"] is False

    assert results[1]["event_id"] == "evt_2"
    assert results[1]["success"] is False
    assert results[1]["circuit_breaker_triggered"] is True

    assert client.circuit_breaker_triggered is True
    assert mock_get.call_count == 2


def test_filter_pending_events_skips_synced():
    from scripts.sync_discovered_matches import filter_pending_events

    discovered = ["match_1", "match_2", "match_3", "match_4", "match_5"]
    synced = {"match_2", "match_4"}

    pending = filter_pending_events(discovered, synced)
    assert pending == ["match_1", "match_3", "match_5"]

    # Test limit constraint
    limited = filter_pending_events(discovered, synced, limit=2)
    assert limited == ["match_1", "match_3"]


def test_sync_discovered_matches_skips_duplicates_end_to_end(memory_db, tmp_path):
    from scripts.sync_discovered_matches import run_sync, get_synced_event_ids

    # Insert an already synced match into memory_db
    memory_db.execute(
        """
        INSERT INTO flashscore_match_team_stats (match_id, flashscore_event_id, team_id, flashscore_team_id, period)
        VALUES (16280833, 'evt_already_synced', 63760, 'zDuHd68m', 'ALL')
        """
    )
    memory_db.commit()

    # Create a temp JSON file with discovered matches
    events_file = tmp_path / "test_discovered.json"
    events_file.write_text(json.dumps(["evt_already_synced", "evt_pending_1", "evt_pending_2"]))

    synced_ids = get_synced_event_ids(memory_db)
    assert "evt_already_synced" in synced_ids

    mock_client = MagicMock()
    mock_client.circuit_breaker_triggered = False
    mock_client.sync_batch_matches.return_value = [
        {"event_id": "evt_pending_1", "success": True, "rows_inserted": 6, "match_id": 101},
        {"event_id": "evt_pending_2", "success": True, "rows_inserted": 6, "match_id": 102},
    ]

    # Patch get_connection to return memory_db
    with patch("scripts.sync_discovered_matches.get_connection", return_value=memory_db):
        summary = run_sync(
            events_file=str(events_file),
            client=mock_client,
            limit=None,
        )

    assert summary["total_discovered"] == 3
    assert summary["already_synced"] == 1
    assert summary["pending_count"] == 2
    assert summary["queued_count"] == 2
    assert summary["processed_count"] == 2
    assert summary["success_count"] == 2

    # Verify mock_client only received pending events
    mock_client.sync_batch_matches.assert_called_once()
    dispatched_ids = mock_client.sync_batch_matches.call_args[1]["event_ids"]
    assert dispatched_ids == ["evt_pending_1", "evt_pending_2"]
    assert "evt_already_synced" not in dispatched_ids


def test_extract_event_ids_from_text():
    from scraper.flashscore_client import extract_event_ids_from_text

    mock_content = """
    <html>
        <div id="g_1_QPinjf7b" class="event__match">
            <a href="https://www.flashscore.pe/partido/QPinjf7b/#/resumen">Alianza Lima vs Cusco</a>
        </div>
        <div id="g_1_29HRVPLq" class="event__match">
            <a href="/match/29HRVPLq/">Cristal vs Universitario</a>
        </div>
        <script>
            var feedData = "~AA÷WMfflYyB¬AD÷1727730000¬AA÷AZKZT3jd¬AD÷1727733600¬";
            var params = { mid: "2mEUXCiU", other: "val" };
            var singleQuote = { mid: 'fNAMZYMH' };
        </script>
        <div class="row" data-event-id="IalvhGxn" data-mid="86CEyeh5"></div>
        <a href="/partido/xtDLi7r3/#/resumen?mid=xtDLi7r3">Match</a>

        <!-- Negative tests (should NOT be extracted) -->
        <div id="g_1_header_title_bar"></div>
        <span class="mid_longer_than_expected"></span>
        <div id="g_1_short"></div>
    </html>
    """

    extracted = extract_event_ids_from_text(mock_content)

    expected = [
        "QPinjf7b",
        "29HRVPLq",
        "WMfflYyB",
        "AZKZT3jd",
        "2mEUXCiU",
        "fNAMZYMH",
        "IalvhGxn",
        "86CEyeh5",
        "xtDLi7r3",
    ]

    assert extracted == expected
    # Ensure no non-match patterns matched
    assert "header_t" not in extracted
    assert "short" not in extracted


@patch("curl_cffi.requests.get")
def test_discover_tournament_matches_success(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = """
    <div id="g_1_QPinjf7b" class="event__match"></div>
    <div id="g_1_bgxhYwW6" class="event__match"></div>
    ~AA÷29HRVPLq¬
    """
    mock_get.return_value = mock_resp

    client = FlashscoreClient()
    discovered = client.discover_tournament_matches("https://www.flashscore.pe/futbol/peru/liga-1/resultados/")

    assert discovered == ["QPinjf7b", "bgxhYwW6", "29HRVPLq"]
    assert mock_get.called
    call_args = mock_get.call_args
    assert "https://www.flashscore.pe/futbol/peru/liga-1/resultados/" in call_args[0][0]
    assert call_args[1]["impersonate"] == "chrome124"


@patch("curl_cffi.requests.get")
def test_discover_tournament_matches_network_error_graceful(mock_get):
    mock_get.side_effect = Exception("DNS Resolution failure")

    client = FlashscoreClient()
    discovered = client.discover_tournament_matches("https://www.flashscore.pe/futbol/peru/liga-1/resultados/")

    # Should not raise exception, return empty list gracefully
    assert discovered == []


@patch("curl_cffi.requests.get")
def test_discover_tournament_matches_circuit_breaker_on_403(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 403
    mock_get.return_value = mock_resp

    client = FlashscoreClient()
    discovered = client.discover_tournament_matches("https://www.flashscore.pe/futbol/peru/liga-1/resultados/")

    assert discovered == []
    assert client.circuit_breaker_triggered is True
    assert client.last_status_code == 403


def test_merge_discovered_events(tmp_path):
    from scripts.sync_discovered_matches import merge_discovered_events, load_discovered_events

    events_file = tmp_path / "discovered.json"
    events_file.write_text(json.dumps(["evt_1", "evt_2"]))

    # Merge with overlap and new IDs
    new_ids = ["evt_2", "evt_3", "evt_4"]
    merged, added_count = merge_discovered_events(str(events_file), new_ids)

    assert added_count == 2
    assert merged == ["evt_1", "evt_2", "evt_3", "evt_4"]

    # Verify disk persistence
    reloaded = load_discovered_events(str(events_file))
    assert reloaded == ["evt_1", "evt_2", "evt_3", "evt_4"]


def test_run_sync_with_auto_discover(memory_db, tmp_path):
    from scripts.sync_discovered_matches import run_sync

    # Insert already synced match
    memory_db.execute(
        """
        INSERT INTO flashscore_match_team_stats (match_id, flashscore_event_id, team_id, flashscore_team_id, period)
        VALUES (16280833, 'evt_synced', 63760, 'zDuHd68m', 'ALL')
        """
    )
    memory_db.commit()

    events_file = tmp_path / "discovered_auto.json"
    events_file.write_text(json.dumps(["evt_synced"]))

    mock_client = MagicMock()
    mock_client.circuit_breaker_triggered = False
    # Auto discovery discovers 1 already synced and 1 new match
    mock_client.discover_tournament_matches.return_value = ["evt_synced", "evt_new_from_web"]
    mock_client.sync_batch_matches.return_value = [
        {"event_id": "evt_new_from_web", "success": True, "rows_inserted": 6, "match_id": 105}
    ]

    with patch("scripts.sync_discovered_matches.get_connection", return_value=memory_db):
        summary = run_sync(
            events_file=str(events_file),
            client=mock_client,
            auto_discover=True,
        )

    # Check auto-discovery merged new ID into file
    assert summary["total_discovered"] == 2
    assert summary["newly_discovered"] == 1
    assert summary["already_synced"] == 1
    assert summary["pending_count"] == 1
    assert summary["queued_count"] == 1
    assert summary["processed_count"] == 1
    assert summary["success_count"] == 1

    # Check file was updated on disk
    with open(str(events_file), "r", encoding="utf-8") as f:
        saved_data = json.load(f)
    assert saved_data == ["evt_synced", "evt_new_from_web"]


