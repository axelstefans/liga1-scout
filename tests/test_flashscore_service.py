"""
Tests for Flashscore match-level analytics service and FastAPI endpoint.
"""

import sqlite3
import pytest
from fastapi.testclient import TestClient

from api.main import app
from services.flashscore_service import get_match_flashscore_stats
from scraper.flashscore_parser import ALL_STAT_COLUMNS

client = TestClient(app)


@pytest.fixture
def mock_match_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row

    # Setup tables
    conn.execute(
        """
        CREATE TABLE teams (
            team_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            short_name TEXT,
            slug TEXT,
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
            season_id INTEGER
        )
        """
    )

    # Minimal schema for flashscore_match_team_stats with all stat columns
    cols_def = ", ".join([f"{col} REAL" for col in ALL_STAT_COLUMNS])
    conn.execute(
        f"""
        CREATE TABLE flashscore_match_team_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            flashscore_event_id TEXT,
            team_id INTEGER,
            flashscore_team_id TEXT,
            period TEXT,
            {cols_def}
        )
        """
    )

    # Insert teams: Alianza Lima (Home, 2311) and ADT (Away, 335557)
    conn.execute(
        "INSERT INTO teams (team_id, name, short_name, flashscore_id) VALUES (2311, 'Alianza Lima', 'Alianza', 'tSWpiWmI')"
    )
    conn.execute(
        "INSERT INTO teams (team_id, name, short_name, flashscore_id) VALUES (335557, 'Asociación Deportiva Tarma', 'ADT', 'EsfgJz9N')"
    )

    # Insert match
    conn.execute(
        """
        INSERT INTO matches (match_id, home_team_id, away_team_id, match_date, round, home_score, away_score, status, season_id)
        VALUES (16280829, 2311, 335557, '2026-09-19T01:00:00', 10, 2, 0, 'played', 88529)
        """
    )

    # Insert 6 rows (2 teams x 3 periods)
    sample_rows = [
        # Alianza Lima (Home)
        (16280829, "bgxhYwW6", 2311, "tSWpiWmI", "1T", 0.4221, 0.35, 6, 2, 58.0),
        (16280829, "bgxhYwW6", 2311, "tSWpiWmI", "2T", 1.1082, 0.90, 8, 3, 52.0),
        (16280829, "bgxhYwW6", 2311, "tSWpiWmI", "ALL", 1.5303, 1.25, 14, 5, 55.0),
        # ADT (Away)
        (16280829, "bgxhYwW6", 335557, "EsfgJz9N", "1T", 0.3079, 0.20, 4, 1, 42.0),
        (16280829, "bgxhYwW6", 335557, "EsfgJz9N", "2T", 0.0766, 0.05, 3, 0, 48.0),
        (16280829, "bgxhYwW6", 335557, "EsfgJz9N", "ALL", 0.3845, 0.25, 7, 1, 45.0),
    ]

    for r in sample_rows:
        conn.execute(
            """
            INSERT INTO flashscore_match_team_stats (
                match_id, flashscore_event_id, team_id, flashscore_team_id, period,
                xg, xgot, shots_total, shots_on_target, possession
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            r,
        )

    conn.commit()
    yield conn
    conn.close()


def test_get_match_flashscore_stats_service(mock_match_db):
    result = get_match_flashscore_stats(mock_match_db, match_id=16280829)

    assert result is not None
    assert result["match_id"] == 16280829
    assert result["flashscore_event_id"] == "bgxhYwW6"

    # Verify home & away identification
    assert result["home_team"]["team_id"] == 2311
    assert result["home_team"]["name"] == "Alianza Lima"
    assert result["home_team"]["flashscore_id"] == "tSWpiWmI"

    assert result["away_team"]["team_id"] == 335557
    assert result["away_team"]["name"] == "Asociación Deportiva Tarma"
    assert result["away_team"]["flashscore_id"] == "EsfgJz9N"

    # Verify periods segregation
    assert set(result["periods"].keys()) == {"1T", "2T", "ALL"}

    all_period = result["periods"]["ALL"]
    assert all_period["home"]["xg"] == pytest.approx(1.5303, 0.001)
    assert all_period["home"]["shots_total"] == 14
    assert all_period["home"]["possession"] == 55.0

    assert all_period["away"]["xg"] == pytest.approx(0.3845, 0.001)
    assert all_period["away"]["shots_total"] == 7
    assert all_period["away"]["possession"] == 45.0

    # Verify 1T and 2T segregation
    t1_period = result["periods"]["1T"]
    assert t1_period["home"]["xg"] == pytest.approx(0.4221, 0.001)
    assert t1_period["away"]["xg"] == pytest.approx(0.3079, 0.001)

    t2_period = result["periods"]["2T"]
    assert t2_period["home"]["xg"] == pytest.approx(1.1082, 0.001)
    assert t2_period["away"]["xg"] == pytest.approx(0.0766, 0.001)

    # All 44 columns should be keys in the metric dictionary
    for col in ALL_STAT_COLUMNS:
        assert col in all_period["home"]
        assert col in all_period["away"]


def test_get_match_flashscore_stats_nonexistent(mock_match_db):
    result = get_match_flashscore_stats(mock_match_db, match_id=99999999)
    assert result is None


def test_api_endpoint_match_flashscore_stats_success():
    # Uses live match 16280829 present in liga1.db
    response = client.get("/api/matches/16280829/flashscore-stats")
    assert response.status_code == 200
    data = response.json()

    assert data["match_id"] == 16280829
    assert data["flashscore_event_id"] == "bgxhYwW6"
    assert data["home_team"]["team_id"] == 2311
    assert data["away_team"]["team_id"] == 335557

    assert "1T" in data["periods"]
    assert "2T" in data["periods"]
    assert "ALL" in data["periods"]

    assert data["periods"]["ALL"]["home"]["xg"] is not None
    assert data["periods"]["ALL"]["away"]["xg"] is not None


def test_api_endpoint_match_flashscore_stats_v1_prefix():
    # Also test /api/v1 prefix
    response = client.get("/api/v1/matches/16280829/flashscore-stats")
    assert response.status_code == 200


def test_api_endpoint_match_flashscore_stats_404():
    response = client.get("/api/matches/99999999/flashscore-stats")
    assert response.status_code == 404
    assert response.json()["detail"] == "Flashscore stats not found for this match"


def test_get_team_flashscore_summary_service(mock_match_db):
    from services.flashscore_service import get_team_flashscore_summary

    result = get_team_flashscore_summary(mock_match_db, team_id=2311)

    assert result is not None
    assert result["team_id"] == 2311
    assert result["team_name"] == "Alianza Lima"
    assert result["matches_analyzed"] == 1

    # Check ALL period
    all_period = result["periods"]["ALL"]
    assert all_period["avg_xg"] == pytest.approx(1.5303, 0.001)
    assert all_period["avg_xg_conceded"] == pytest.approx(0.3845, 0.001)
    assert all_period["avg_shots_total"] == 14.0
    assert all_period["avg_shots_on_target"] == 5.0
    assert all_period["avg_possession"] == 55.0

    # Check 1T and 2T splits
    t1 = result["periods"]["1T"]
    t2 = result["periods"]["2T"]
    assert t1["avg_xg"] == pytest.approx(0.4221, 0.001)
    assert t2["avg_xg"] == pytest.approx(1.1082, 0.001)

    # Validate mathematical consistency between halves and full match
    assert t1["avg_xg"] + t2["avg_xg"] == pytest.approx(all_period["avg_xg"], 0.001)
    assert t1["avg_shots_total"] + t2["avg_shots_total"] == pytest.approx(all_period["avg_shots_total"], 0.01)

    # Check goalkeeper efficiency
    gk = result["goalkeeper_efficiency"]
    assert gk["xgot_faced"] == pytest.approx(0.25, 0.001)
    assert gk["goals_conceded"] == 0
    assert gk["goals_prevented"] == pytest.approx(0.25, 0.001)
    assert gk["prevented_per_match"] == pytest.approx(0.25, 0.001)


def test_get_team_flashscore_summary_zero_matches(mock_match_db):
    from services.flashscore_service import get_team_flashscore_summary

    # Insert a team with no matches
    mock_match_db.execute(
        "INSERT INTO teams (team_id, name, short_name, flashscore_id) VALUES (2302, 'Club Sporting Cristal', 'Cristal', 'rVwaK9XN')"
    )
    mock_match_db.commit()

    result = get_team_flashscore_summary(mock_match_db, team_id=2302)

    assert result is not None
    assert result["team_id"] == 2302
    assert result["team_name"] == "Club Sporting Cristal"
    assert result["matches_analyzed"] == 0
    assert result["periods"]["ALL"]["avg_xg"] == 0.0
    assert result["goalkeeper_efficiency"]["goals_conceded"] == 0


def test_get_team_flashscore_summary_nonexistent(mock_match_db):
    from services.flashscore_service import get_team_flashscore_summary

    result = get_team_flashscore_summary(mock_match_db, team_id=99999999)
    assert result is None


def test_api_endpoint_team_flashscore_summary_success():
    response = client.get("/api/teams/2311/flashscore-summary")
    assert response.status_code == 200
    data = response.json()

    assert data["team_id"] == 2311
    assert data["team_name"] == "Alianza Lima"
    assert data["matches_analyzed"] >= 1
    assert "1T" in data["periods"]
    assert "2T" in data["periods"]
    assert "ALL" in data["periods"]
    assert "goalkeeper_efficiency" in data
    assert data["periods"]["ALL"]["avg_xg"] > 0


def test_api_endpoint_team_flashscore_summary_v1_prefix():
    response = client.get("/api/v1/teams/2311/flashscore-summary")
    assert response.status_code == 200


def test_api_endpoint_team_flashscore_summary_404():
    response = client.get("/api/teams/99999999/flashscore-summary")
    assert response.status_code == 404
    assert response.json()["detail"] == "Team not found"

