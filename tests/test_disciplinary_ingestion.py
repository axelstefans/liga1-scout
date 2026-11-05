import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import sqlite3
import pandas as pd
import pytest
from unittest.mock import MagicMock
from scraper.sources.match_stats import (
    save_match_cards,
    save_match_substitutions,
    scrape_and_store_match_stats,
)


@pytest.fixture
def memory_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS teams (
            team_id INTEGER PRIMARY KEY,
            name TEXT
        );
        CREATE TABLE IF NOT EXISTS matches (
            match_id INTEGER PRIMARY KEY,
            home_team_id INTEGER,
            away_team_id INTEGER,
            status TEXT,
            season_id INTEGER,
            match_url TEXT
        );
        CREATE TABLE IF NOT EXISTS player_match_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            match_id INTEGER NOT NULL,
            team_id INTEGER NOT NULL,
            minutes_played INTEGER,
            was_substitute INTEGER,
            sofascore_rating REAL,
            goals INTEGER,
            assists INTEGER,
            yellow_cards INTEGER,
            red_cards INTEGER,
            total_shots INTEGER,
            shots_on_target INTEGER,
            expected_goals REAL,
            accurate_passes INTEGER,
            accurate_passes_pct REAL,
            key_passes INTEGER,
            big_chances_created INTEGER,
            ground_duels_won INTEGER,
            aerial_duels_won INTEGER,
            successful_dribbles INTEGER,
            tackles INTEGER,
            interceptions INTEGER,
            clearances INTEGER,
            saves INTEGER,
            goals_conceded INTEGER,
            scraped_at TEXT,
            position TEXT,
            position_source TEXT,
            replaced_player_id INTEGER,
            fouls INTEGER DEFAULT 0,
            was_fouled INTEGER DEFAULT 0,
            UNIQUE(player_id, match_id)
        );
        CREATE TABLE IF NOT EXISTS match_card_incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER NOT NULL,
            team_id INTEGER NOT NULL,
            player_id INTEGER NOT NULL,
            player_name TEXT,
            minute INTEGER NOT NULL,
            extra_minute INTEGER DEFAULT 0,
            card_type TEXT NOT NULL,
            reason TEXT,
            rescinded BOOLEAN DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_mci_match ON match_card_incidents(match_id);
        CREATE INDEX IF NOT EXISTS idx_mci_player ON match_card_incidents(player_id);

        CREATE TABLE IF NOT EXISTS match_substitution_incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER NOT NULL,
            team_id INTEGER NOT NULL,
            player_in_id INTEGER NOT NULL,
            player_in_name TEXT,
            player_out_id INTEGER NOT NULL,
            player_out_name TEXT,
            minute INTEGER NOT NULL,
            extra_minute INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_msi_match ON match_substitution_incidents(match_id);
        CREATE INDEX IF NOT EXISTS idx_msi_player_in ON match_substitution_incidents(player_in_id);
        CREATE INDEX IF NOT EXISTS idx_msi_player_out ON match_substitution_incidents(player_out_id);

        CREATE TABLE IF NOT EXISTS scrape_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resource_type TEXT,
            resource_key TEXT,
            scraped_at TEXT,
            status TEXT,
            http_status_code INTEGER,
            error_message TEXT,
            response_size_bytes INTEGER
        );
    """)
    yield conn
    conn.close()


def test_save_match_cards_filtering_and_idempotency(memory_db):
    match_id = 1001
    home_team_id = 2311
    away_team_id = 2305

    incidents = [
        # Tarjeta amarilla local con team_id explícito
        {
            "incidentType": "card",
            "incidentClass": "yellow",
            "time": 25,
            "addedTime": 0,
            "team": {"id": home_team_id},
            "player": {"id": 101, "name": "Erick Noriega"},
            "reason": "Foul",
            "rescinded": False,
        },
        # Tarjeta roja visitante deducida por isHome=False
        {
            "incidentType": "card",
            "incidentClass": "red",
            "time": 89,
            "addedTime": 3,
            "isHome": False,
            "player": {"id": 202, "name": "Williams Riveros"},
            "reason": "Violent conduct",
            "rescinded": True,
        },
        # Eventos no relacionados (deben ignorarse)
        {
            "incidentType": "goal",
            "incidentClass": "regular",
            "time": 10,
            "player": {"id": 101, "name": "Erick Noriega"},
        },
        {
            "incidentType": "substitution",
            "time": 60,
            "playerIn": {"id": 303},
            "playerOut": {"id": 101},
        },
        {
            "incidentType": "period",
            "time": 45,
            "text": "HT",
        },
    ]

    # 1. Primera ejecución
    inserted = save_match_cards(memory_db, match_id, home_team_id, away_team_id, incidents)
    assert inserted == 2

    rows = memory_db.execute(
        "SELECT * FROM match_card_incidents WHERE match_id = ? ORDER BY minute ASC",
        (match_id,)
    ).fetchall()
    assert len(rows) == 2

    # Fila 1: Amarilla local
    assert rows[0]["team_id"] == home_team_id
    assert rows[0]["player_id"] == 101
    assert rows[0]["player_name"] == "Erick Noriega"
    assert rows[0]["minute"] == 25
    assert rows[0]["extra_minute"] == 0
    assert rows[0]["card_type"] == "yellow"
    assert rows[0]["reason"] == "Foul"
    assert rows[0]["rescinded"] == 0

    # Fila 2: Roja visitante en tiempo añadido
    assert rows[1]["team_id"] == away_team_id
    assert rows[1]["player_id"] == 202
    assert rows[1]["player_name"] == "Williams Riveros"
    assert rows[1]["minute"] == 89
    assert rows[1]["extra_minute"] == 3
    assert rows[1]["card_type"] == "red"
    assert rows[1]["reason"] == "Violent conduct"
    assert rows[1]["rescinded"] == 1

    # 2. Idempotencia: re-ejecutar limpia y vuelve a insertar sin duplicar
    re_inserted = save_match_cards(memory_db, match_id, home_team_id, away_team_id, incidents)
    assert re_inserted == 2
    count = memory_db.execute(
        "SELECT COUNT(*) FROM match_card_incidents WHERE match_id = ?",
        (match_id,)
    ).fetchone()[0]
    assert count == 2


def test_save_match_substitutions_filtering_and_idempotency(memory_db):
    match_id = 1001
    home_team_id = 2311
    away_team_id = 2305

    incidents = [
        # Sustitución local
        {
            "incidentType": "substitution",
            "time": 65,
            "addedTime": 0,
            "isHome": True,
            "playerIn": {"id": 301, "name": "Hernán Barcos"},
            "playerOut": {"id": 302, "name": "Cecilio Waterman"},
        },
        # Sustitución visitante con team_id explícito y tiempo de descuento
        {
            "incidentType": "substitution",
            "time": 90,
            "addedTime": 2,
            "team": {"id": away_team_id},
            "playerIn": {"id": 401, "name": "Horacio Calcaterra"},
            "playerOut": {"id": 402, "name": "Martín Pérez Guedes"},
        },
        # Otros eventos a ignorar
        {
            "incidentType": "card",
            "time": 70,
            "player": {"id": 301},
        },
        {
            "incidentType": "injuryTime",
            "time": 90,
        },
    ]

    inserted = save_match_substitutions(memory_db, match_id, home_team_id, away_team_id, incidents)
    assert inserted == 2

    rows = memory_db.execute(
        "SELECT * FROM match_substitution_incidents WHERE match_id = ? ORDER BY minute ASC",
        (match_id,)
    ).fetchall()
    assert len(rows) == 2

    assert rows[0]["team_id"] == home_team_id
    assert rows[0]["player_in_id"] == 301
    assert rows[0]["player_in_name"] == "Hernán Barcos"
    assert rows[0]["player_out_id"] == 302
    assert rows[0]["player_out_name"] == "Cecilio Waterman"
    assert rows[0]["minute"] == 65
    assert rows[0]["extra_minute"] == 0

    assert rows[1]["team_id"] == away_team_id
    assert rows[1]["player_in_id"] == 401
    assert rows[1]["player_in_name"] == "Horacio Calcaterra"
    assert rows[1]["player_out_id"] == 402
    assert rows[1]["player_out_name"] == "Martín Pérez Guedes"
    assert rows[1]["minute"] == 90
    assert rows[1]["extra_minute"] == 2

    # Idempotencia
    save_match_substitutions(memory_db, match_id, home_team_id, away_team_id, incidents)
    count = memory_db.execute(
        "SELECT COUNT(*) FROM match_substitution_incidents WHERE match_id = ?",
        (match_id,)
    ).fetchone()[0]
    assert count == 2


def test_missing_and_malformed_incidents_handled_safely(memory_db):
    match_id = 9999
    home_team_id = 10
    away_team_id = 20

    malformed_incidents = [
        {},  # Vacío
        "not_a_dict",  # Tipo erróneo
        {"incidentType": "card"},  # Sin player ni minute
        {"incidentType": "card", "time": 10},  # Sin player
        {"incidentType": "card", "time": 15, "player": {"name": "No ID"}},  # Sin player_id
        {"incidentType": "substitution"},  # Sin players
        {"incidentType": "substitution", "time": 45, "playerIn": {"id": 1}},  # Sin playerOut
        {"incidentType": "substitution", "time": 50, "playerOut": {"id": 2}},  # Sin playerIn
    ]

    # No debe levantar excepciones y debe insertar 0 registros
    cards_count = save_match_cards(memory_db, match_id, home_team_id, away_team_id, malformed_incidents)
    subs_count = save_match_substitutions(memory_db, match_id, home_team_id, away_team_id, malformed_incidents)

    assert cards_count == 0
    assert subs_count == 0


def test_scrape_and_store_match_stats_fouls_and_incidents_integration(memory_db, monkeypatch):
    import scraper.config as scraper_config
    monkeypatch.setattr(scraper_config, "SEASON_ID", 2026)

    match_id = 5555
    home_team_id = 100
    away_team_id = 200

    match_entry = {
        "match_id": match_id,
        "match_url": "https://www.sofascore.com/match/5555",
        "home_team_id": home_team_id,
        "away_team_id": away_team_id,
        "status": "played",
        "season_id": 2026,
    }

    mock_lineups = {
        "home": {
            "formation": "4-3-3",
            "players": [
                {
                    "player": {"id": 11, "name": "Player 11"},
                    "substitute": False,
                    "position": "G",
                },
                {
                    "player": {"id": 12, "name": "Player 12"},
                    "substitute": False,
                    "position": "D",
                },
            ],
        },
        "away": {
            "formation": "4-4-2",
            "players": [
                {
                    "player": {"id": 21, "name": "Player 21"},
                    "substitute": False,
                    "position": "G",
                },
            ],
        },
    }

    mock_incidents = {
        "incidents": [
            {
                "incidentType": "card",
                "incidentClass": "yellow",
                "time": 30,
                "isHome": True,
                "player": {"id": 12, "name": "Player 12"},
                "reason": "Tactical foul",
            },
            {
                "incidentType": "substitution",
                "time": 75,
                "isHome": True,
                "playerIn": {"id": 13, "name": "Sub In 13"},
                "playerOut": {"id": 12, "name": "Player 12"},
            },
        ]
    }

    home_df = pd.DataFrame([
        {
            "id": 11,
            "substitute": False,
            "statistics.rating": 7.0,
            "statistics.fouls": 1,
            "statistics.wasFouled": 0,
            "statistics.minutesPlayed": 90,
        },
        {
            "id": 12,
            "substitute": False,
            "statistics.rating": 6.8,
            "statistics.fouls": 3,
            "statistics.wasFouled": 2,
            "statistics.minutesPlayed": 75,
        },
    ])

    away_df = pd.DataFrame([
        {
            "id": 21,
            "substitute": False,
            "statistics.rating": 7.5,
            "statistics.fouls": 0,
            "statistics.wasFouled": 1,
            "statistics.minutesPlayed": 90,
        }
    ])

    mock_lanus = MagicMock()

    def mock_sofascore_request(endpoint):
        if "lineups" in endpoint:
            return mock_lineups
        if "incidents" in endpoint:
            return mock_incidents
        return {}

    mock_lanus.sofascore_request.side_effect = mock_sofascore_request
    mock_lanus.get_players_match_stats.return_value = (home_df, away_df)

    # Ejecutar pipeline en memoria
    inserted = scrape_and_store_match_stats(memory_db, mock_lanus, [match_entry])
    assert inserted == 3

    # Verificar inserción de faltas en player_match_stats
    p11 = memory_db.execute(
        "SELECT fouls, was_fouled FROM player_match_stats WHERE player_id = 11 AND match_id = ?",
        (match_id,)
    ).fetchone()
    assert p11["fouls"] == 1
    assert p11["was_fouled"] == 0

    p12 = memory_db.execute(
        "SELECT fouls, was_fouled FROM player_match_stats WHERE player_id = 12 AND match_id = ?",
        (match_id,)
    ).fetchone()
    assert p12["fouls"] == 3
    assert p12["was_fouled"] == 2

    p21 = memory_db.execute(
        "SELECT fouls, was_fouled FROM player_match_stats WHERE player_id = 21 AND match_id = ?",
        (match_id,)
    ).fetchone()
    assert p21["fouls"] == 0
    assert p21["was_fouled"] == 1

    # Verificar persistencia de tarjeta
    cards = memory_db.execute(
        "SELECT * FROM match_card_incidents WHERE match_id = ?",
        (match_id,)
    ).fetchall()
    assert len(cards) == 1
    assert cards[0]["player_id"] == 12
    assert cards[0]["card_type"] == "yellow"
    assert cards[0]["reason"] == "Tactical foul"

    # Verificar persistencia de sustitución
    subs = memory_db.execute(
        "SELECT * FROM match_substitution_incidents WHERE match_id = ?",
        (match_id,)
    ).fetchall()
    assert len(subs) == 1
    assert subs[0]["player_in_id"] == 13
    assert subs[0]["player_out_id"] == 12
    assert subs[0]["minute"] == 75
