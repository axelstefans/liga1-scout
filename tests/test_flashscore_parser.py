import json
import os
import sqlite3
import pytest

from scraper.flashscore_parser import (
    parse_flashscore_team_stats,
    resolve_match_id,
    insert_flashscore_team_stats,
    process_and_save_flashscore_stats,
    STAGE_TO_PERIOD,
    TYPE_ID_MAP,
    ALL_STAT_COLUMNS,
)
from scraper.flashscore_mapping import (
    KNOWN_FLASHSCORE_TEAMS,
    FLASHSCORE_TO_TEAM_ID,
    seed_flashscore_team_mappings,
    get_flashscore_team_mapping,
)

SAMPLE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "tools", "raw_stats_sample.json"
)
MIGRATION_020_PATH = os.path.join(
    os.path.dirname(__file__), "..", "migrations", "020_flashscore_match_team_stats.sql"
)
MIGRATION_021_PATH = os.path.join(
    os.path.dirname(__file__), "..", "migrations", "021_add_flashscore_id_to_teams.sql"
)


@pytest.fixture
def raw_sample_data():
    with open(SAMPLE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def memory_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row

    # Setup base reference tables: teams, matches
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

    # Apply migration 020 for flashscore_match_team_stats
    with open(MIGRATION_020_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    # Insert baseline Liga 1 test teams
    test_teams = [
        (2311, "Alianza Lima", "Alianza Lima", "alianza-lima"),
        (63760, "Cusco FC", "Cusco", "cusco-fc"),
        (335557, "Asociación Deportiva Tarma", "ADT", "asociacion-deportiva-tarma"),
        (2305, "Universitario de Deportes", "Universitario", "universitario"),
        (511206, "ACD Juan Pablo II", "Juan Pablo II", "adc-juan-pablo-ii"),
    ]
    conn.executemany(
        "INSERT INTO teams (team_id, name, short_name, slug, scraped_at) VALUES (?, ?, ?, ?, datetime())",
        test_teams,
    )

    # Insert baseline match (Cusco FC vs Alianza Lima)
    conn.execute(
        """
        INSERT INTO matches (match_id, home_team_id, away_team_id, match_date, round, status, season_id, scraped_at)
        VALUES (16280833, 63760, 2311, '2026-10-11T23:30:00', 11, 'scheduled', 88529, datetime())
        """
    )
    conn.commit()

    yield conn
    conn.close()


def test_flashscore_mapping_seed_and_lookup(memory_db):
    # Before seeding, flashscore_id is None
    row = memory_db.execute(
        "SELECT flashscore_id FROM teams WHERE team_id = 2311"
    ).fetchone()
    assert row["flashscore_id"] is None

    # Run seed
    updated = seed_flashscore_team_mappings(memory_db)
    assert updated == 5

    # Check that Alianza Lima got 'tSWpiWmI'
    row_alianza = memory_db.execute(
        "SELECT flashscore_id FROM teams WHERE team_id = 2311"
    ).fetchone()
    assert row_alianza["flashscore_id"] == "tSWpiWmI"

    # Check Cusco FC got 'zDuHd68m'
    row_cusco = memory_db.execute(
        "SELECT flashscore_id FROM teams WHERE team_id = 63760"
    ).fetchone()
    assert row_cusco["flashscore_id"] == "zDuHd68m"

    # Check ADT, Universitario, Juan Pablo II
    mapping = get_flashscore_team_mapping(memory_db)
    assert mapping["tSWpiWmI"] == 2311
    assert mapping["zDuHd68m"] == 63760
    assert mapping["EsfgJz9N"] == 335557
    assert mapping["xhw3JTnU"] == 2305
    assert mapping["bXJtZt18"] == 511206


def test_resolve_match_id(memory_db):
    seed_flashscore_team_mappings(memory_db)

    # 1. Exact match with date
    resolved = resolve_match_id(
        db_conn=memory_db,
        flashscore_event_id="QPinjf7b",
        home_fs_id="zDuHd68m",  # Cusco FC
        away_fs_id="tSWpiWmI",  # Alianza Lima
        match_date="2026-10-11",
    )
    assert resolved == 16280833

    # 2. Match without date (resolves latest fixture for matchup)
    resolved_no_date = resolve_match_id(
        db_conn=memory_db,
        flashscore_event_id="QPinjf7b",
        home_fs_id="zDuHd68m",
        away_fs_id="tSWpiWmI",
    )
    assert resolved_no_date == 16280833

    # 3. Match with non-existent team returns None
    assert (
        resolve_match_id(
            db_conn=memory_db,
            flashscore_event_id="QPinjf7b",
            home_fs_id="unknown_hash",
            away_fs_id="tSWpiWmI",
        )
        is None
    )


def test_parse_flashscore_team_stats_counts_and_structure(raw_sample_data):
    team_mapping = {"zDuHd68m": 63760, "tSWpiWmI": 2311}
    rows = parse_flashscore_team_stats(
        raw_data=raw_sample_data,
        match_id=16280833,
        flashscore_event_id="QPinjf7b",
        team_mapping=team_mapping,
    )

    # Exactly 2 teams x 3 periods = 6 rows
    assert len(rows) == 6

    # Verify periods and teams represented
    keys = {(r["flashscore_team_id"], r["period"]) for r in rows}
    expected_keys = {
        ("zDuHd68m", "ALL"),
        ("zDuHd68m", "1T"),
        ("zDuHd68m", "2T"),
        ("tSWpiWmI", "ALL"),
        ("tSWpiWmI", "1T"),
        ("tSWpiWmI", "2T"),
    }
    assert keys == expected_keys

    # Verify team_id and event_id mapping
    for r in rows:
        assert r["match_id"] == 16280833
        assert r["flashscore_event_id"] == "QPinjf7b"
        if r["flashscore_team_id"] == "zDuHd68m":
            assert r["team_id"] == 63760
        elif r["flashscore_team_id"] == "tSWpiWmI":
            assert r["team_id"] == 2311


def test_parse_flashscore_team_stats_metrics(raw_sample_data):
    rows = parse_flashscore_team_stats(
        raw_data=raw_sample_data,
        match_id=16280833,
        flashscore_event_id="QPinjf7b",
    )

    by_key = {(r["flashscore_team_id"], r["period"]): r for r in rows}

    # 1. Alianza Lima (tSWpiWmI) ALL
    alianza_all = by_key[("tSWpiWmI", "ALL")]
    assert alianza_all["xg"] == pytest.approx(0.8208, 0.001)
    assert alianza_all["xgot"] == pytest.approx(0.6353, 0.001)
    assert alianza_all["goals_prevented"] == pytest.approx(-0.7292, 0.001)
    assert alianza_all["shots_total"] == 13
    assert alianza_all["shots_on_target"] == 4
    assert alianza_all["shots_off_target"] == 5
    assert alianza_all["shots_blocked"] == 4
    assert alianza_all["passes_total"] == 351
    assert alianza_all["passes_completed"] == 287
    assert alianza_all["possession"] == 43.0
    assert alianza_all["corner_kicks"] == 2
    assert alianza_all["throw_ins"] == 9
    assert alianza_all["yellow_cards"] == 1
    assert alianza_all["red_cards"] == 0
    assert alianza_all["saves"] == 0

    # 2. Cusco FC (zDuHd68m) 1T
    cusco_1t = by_key[("zDuHd68m", "1T")]
    assert cusco_1t["xg"] == pytest.approx(0.1897, 0.001)
    assert cusco_1t["shots_total"] == 7
    assert cusco_1t["possession"] == 61.0
    assert cusco_1t["goals_prevented"] == pytest.approx(-0.375, 0.001)
    assert cusco_1t["period"] == "1T"

    # 3. Cusco FC (zDuHd68m) ALL
    cusco_all = by_key[("zDuHd68m", "ALL")]
    assert cusco_all["possession"] == 57.0
    assert cusco_all["shots_total"] == 9
    assert cusco_all["xg"] == pytest.approx(0.2311, 0.001)
    assert cusco_all["goals_prevented"] == pytest.approx(-0.3647, 0.001)


def test_process_and_save_flashscore_stats_end_to_end(memory_db, raw_sample_data):
    # Seed teams first
    seed_flashscore_team_mappings(memory_db)

    # Process and save without explicit match_id or team_mapping:
    # the function resolves team_ids and match_id automatically from memory_db
    saved_rows = process_and_save_flashscore_stats(
        db_conn=memory_db,
        raw_data=raw_sample_data,
        flashscore_event_id="QPinjf7b",
        match_date="2026-10-11",
    )

    assert len(saved_rows) == 6

    # Verify rows in database
    cursor = memory_db.execute(
        "SELECT match_id, team_id, flashscore_team_id, period, xg, possession FROM flashscore_match_team_stats"
    )
    db_records = cursor.fetchall()
    assert len(db_records) == 6

    for r in db_records:
        assert r["match_id"] == 16280833
        if r["flashscore_team_id"] == "zDuHd68m":
            assert r["team_id"] == 63760
        elif r["flashscore_team_id"] == "tSWpiWmI":
            assert r["team_id"] == 2311

    # Query Alianza Lima ALL from database
    alianza_row = memory_db.execute(
        """
        SELECT xg, xgot, shots_total, possession, passes_completed, goals_prevented
        FROM flashscore_match_team_stats
        WHERE flashscore_team_id = 'tSWpiWmI' AND period = 'ALL'
        """
    ).fetchone()

    assert alianza_row["xg"] == pytest.approx(0.8208, 0.001)
    assert alianza_row["xgot"] == pytest.approx(0.6353, 0.001)
    assert alianza_row["shots_total"] == 13
    assert alianza_row["possession"] == 43.0
    assert alianza_row["passes_completed"] == 287
    assert alianza_row["goals_prevented"] == pytest.approx(-0.7292, 0.001)


def test_empty_or_malformed_input():
    # Empty dict
    assert parse_flashscore_team_stats({}) == []
    # No entries
    assert parse_flashscore_team_stats({"data": {"findEventById": {}}}) == []
    # Direct list with unknown stage
    unknown_stage_entry = [
        {"eventStageId": 999, "teamId": "xyz", "typeId": "xg", "value": "1.0"}
    ]
    assert parse_flashscore_team_stats(unknown_stage_entry) == []


def test_all_18_liga1_teams_mapped_and_seeded():
    # 1. Verify dictionary contains all 18 teams
    assert len(KNOWN_FLASHSCORE_TEAMS) == 18

    expected_hashes = {
        "tSWpiWmI": 2311,     # Alianza Lima
        "zDuHd68m": 63760,    # Cusco FC
        "EsfgJz9N": 335557,   # ADT
        "xhw3JTnU": 2305,     # Universitario
        "bXJtZt18": 511206,   # Juan Pablo II
        "rVwaK9XN": 2302,     # Sporting Cristal
        "pQ8DJXPR": 458584,   # Deportivo Garcilaso
        "GlLFjAIU": 2307,     # Alianza Atlético
        "hEX4iScl": 33895,    # Sport Huancayo
        "IZO9NXIh": 2308,     # Melgar
        "URZfLkIH": 2312,     # Sport Boys
        "6o4srhvP": 282538,   # Atlético Grau
        "82OXAD3n": 2301,     # Cienciano
        "0EDzFnkQ": 1082002,  # FC Cajamarca
        "ABEwYY2S": 213609,   # Comerciantes Unidos
        "hfMxvE6a": 252254,   # Los Chankas CYC
        "OtSVKjtb": 492848,   # CD Moquegua
        "6cko2SpQ": 87854,    # UTC
    }

    for fs_id, expected_tid in expected_hashes.items():
        assert fs_id in KNOWN_FLASHSCORE_TEAMS
        assert KNOWN_FLASHSCORE_TEAMS[fs_id]["team_id"] == expected_tid
        assert FLASHSCORE_TO_TEAM_ID[fs_id] == expected_tid

    # 2. Test in-memory database seeding of all 18 teams
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
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
    for fs_id, info in KNOWN_FLASHSCORE_TEAMS.items():
        conn.execute(
            "INSERT INTO teams (team_id, name, short_name, slug) VALUES (?, ?, ?, ?)",
            (info["team_id"], info["name"], info["short_name"], info["slug"]),
        )
    conn.commit()

    # Execute seed
    updated = seed_flashscore_team_mappings(conn)
    assert updated == 18

    # Verify all 18 have flashscore_id set
    rows = conn.execute("SELECT team_id, flashscore_id FROM teams").fetchall()
    assert len(rows) == 18
    for r in rows:
        assert r["flashscore_id"] is not None
        assert expected_hashes[r["flashscore_id"]] == r["team_id"]

    # Check mapping function returns all 18
    db_mapping = get_flashscore_team_mapping(conn)
    assert len(db_mapping) == 18
    for fs_id, expected_tid in expected_hashes.items():
        assert db_mapping[fs_id] == expected_tid

    conn.close()

