import sqlite3
from unittest.mock import MagicMock
from scraper.sources.matches import scrape_and_store_matches


def test_scrape_and_store_matches_upsert_preserves_referee_id():
    """
    Verifies that scrape_and_store_matches uses UPSERT (ON CONFLICT DO UPDATE SET)
    and does NOT overwrite or erase an existing referee_id in the matches table.
    """
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Create schema
    cursor.execute("""
        CREATE TABLE matches (
            match_id INTEGER PRIMARY KEY,
            home_team_id INTEGER,
            away_team_id INTEGER,
            match_date TEXT NOT NULL,
            round INTEGER,
            home_score INTEGER,
            away_score INTEGER,
            status TEXT NOT NULL,
            match_url TEXT,
            season_id INTEGER NOT NULL,
            scraped_at TEXT NOT NULL,
            referee_id INTEGER
        )
    """)
    cursor.execute("""
        CREATE TABLE scrape_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resource_type TEXT NOT NULL,
            resource_key TEXT NOT NULL,
            scraped_at TEXT NOT NULL,
            status TEXT NOT NULL,
            http_status_code INTEGER,
            error_message TEXT,
            response_size_bytes INTEGER
        )
    """)

    # 2. Insert match with pre-existing referee_id and score 0-0
    cursor.execute("""
        INSERT INTO matches (
            match_id, home_team_id, away_team_id, match_date, round,
            home_score, away_score, status, match_url, season_id, scraped_at, referee_id
        ) VALUES (
            99901, 2301, 2302, '2026-10-23T18:00:00', 13,
            0, 0, 'scheduled', 'https://sofascore.com/test', 88529, '2026-10-20T10:00:00', 786640
        )
    """)
    conn.commit()

    # Verify initial state
    init_row = cursor.execute("SELECT status, home_score, referee_id FROM matches WHERE match_id = 99901").fetchone()
    assert init_row["status"] == "scheduled"
    assert init_row["home_score"] == 0
    assert init_row["referee_id"] == 786640

    # 3. Mock api_client to return round 13 with updated score and status 'finished'
    mock_api = MagicMock()
    mock_api.get_rounds.return_value = {
        "rounds": [{"round": 13, "prefix": "Clausura"}]
    }
    mock_api.get_matches_by_round.return_value = [
        {
            "id": 99901,
            "homeTeam": {"id": 2301, "slug": "cienciano"},
            "awayTeam": {"id": 2302, "slug": "cristal"},
            "startTimestamp": 1792778400,
            "homeScore": {"current": 3},
            "awayScore": {"current": 1},
            "status": {"code": 100, "type": "finished"}
        }
    ]

    # 4. Execute scrape_and_store_matches
    scrape_and_store_matches(conn, mock_api)

    # 5. Assert updated fields and preserved referee_id
    updated_row = cursor.execute("SELECT status, home_score, away_score, referee_id FROM matches WHERE match_id = 99901").fetchone()
    assert updated_row["status"] == "played"
    assert updated_row["home_score"] == 3
    assert updated_row["away_score"] == 1
    assert updated_row["referee_id"] == 786640, "referee_id must be strictly preserved by UPSERT!"

    conn.close()
