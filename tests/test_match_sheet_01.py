"""
Unit and integration tests for Match Report Sheet 01 / 04 ('The result and the chances')
(`_build_sheet_01_chances` in `api/routers/matches.py`).
"""

import os
import sys
import sqlite3
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.routers.matches import _build_sheet_01_chances


def _create_temp_match_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.executescript(
        """
        CREATE TABLE teams (
            team_id INTEGER PRIMARY KEY,
            name TEXT,
            short_name TEXT,
            logo_url TEXT,
            primary_color TEXT
        );

        CREATE TABLE players (
            player_id INTEGER PRIMARY KEY,
            name TEXT,
            shirt_number INTEGER
        );

        CREATE TABLE matches (
            match_id INTEGER PRIMARY KEY,
            home_team_id INTEGER,
            away_team_id INTEGER,
            match_date TEXT,
            round INTEGER,
            home_score INTEGER,
            away_score INTEGER,
            status TEXT,
            season_id INTEGER
        );

        CREATE TABLE player_match_stats (
            match_id INTEGER,
            player_id INTEGER,
            team_id INTEGER,
            minutes_played INTEGER
        );

        CREATE TABLE team_match_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            team_id INTEGER,
            is_home INTEGER,
            goals_for INTEGER,
            goals_against INTEGER,
            shots_for INTEGER,
            shots_on_target_for INTEGER,
            shots_inside_box_for INTEGER,
            shots_outside_box_for INTEGER,
            xg_for REAL,
            npxg_for REAL,
            passes_total INTEGER,
            passes_completed INTEGER,
            final_third_passes_for INTEGER,
            final_third_passes_against INTEGER,
            passes_into_box INTEGER,
            progressive_passes INTEGER
        );

        CREATE TABLE flashscore_match_team_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            team_id INTEGER,
            period TEXT,
            xg REAL,
            xgot REAL,
            big_chances INTEGER
        );

        CREATE TABLE player_shots (
            shot_id INTEGER PRIMARY KEY,
            player_id INTEGER,
            match_id INTEGER,
            is_home INTEGER,
            shot_type TEXT,
            situation TEXT,
            body_part TEXT,
            coord_x REAL,
            coord_y REAL,
            distance_m REAL,
            goal_mouth_y REAL,
            goal_mouth_z REAL
        );

        CREATE TABLE player_shots_xg (
            shot_id INTEGER PRIMARY KEY,
            calculated_xg REAL
        );

        CREATE TABLE match_goal_incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            team_id INTEGER,
            player_name TEXT,
            minute INTEGER,
            period TEXT,
            is_corner_origin INTEGER,
            incident_type TEXT
        );

        CREATE TABLE player_passes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            player_id INTEGER,
            x_start REAL,
            y_start REAL,
            x_end REAL,
            y_end REAL,
            is_successful INTEGER
        );

        CREATE TABLE player_ball_carries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            player_id INTEGER,
            x_start REAL,
            y_start REAL,
            x_end REAL,
            y_end REAL,
            is_home INTEGER
        );

        CREATE TABLE player_dribbles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            player_id INTEGER,
            x REAL,
            y REAL,
            is_successful INTEGER
        );

        CREATE TABLE player_defensive_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            player_id INTEGER,
            x REAL,
            y REAL,
            action_type TEXT,
            end_x REAL,
            end_y REAL,
            is_home INTEGER
        );
        """
    )

    cur.executemany(
        "INSERT INTO teams (team_id, name, short_name, logo_url, primary_color) VALUES (?, ?, ?, ?, ?)",
        [
            (100, "Club Local", "Local", "https://example.com/100.png", "#112233"),
            (200, "Club Visita", "Visita", "https://example.com/200.png", "#445566"),
        ],
    )
    cur.executemany(
        "INSERT INTO players (player_id, name, shirt_number) VALUES (?, ?, ?)",
        [
            (1, "Delantero Local", 9),
            (2, "Volante Local", 10),
            (3, "Delantero Visita", 11),
            (4, "Defensa Visita", 4),
        ],
    )
    conn.commit()
    return conn


def test_coordinate_normalization_and_rule_4a_own_half():
    """
    Verify coordinate normalization x' = 100 - (coord_x / 105) * 100 and Rule 4A:
    shots from own half (coord_x > 52.5m => raw_x < 50.0) are clamped to x = 50.0 with from_own_half = True.
    """
    conn = _create_temp_match_db()
    cur = conn.cursor()

    cur.execute(
        "INSERT INTO matches VALUES (1001, 100, 200, '2026-08-10T20:00:00', 5, 1, 0, 'played', 88529)"
    )
    cur.executemany(
        "INSERT INTO player_match_stats VALUES (?, ?, ?, ?)",
        [(1001, 1, 100, 90), (1001, 3, 200, 90)],
    )

    # 1 home goal close to goal line (coord_x = 10.5m => raw_x = 90.0)
    # 1 away shot from own half (coord_x = 63.0m => raw_x = 40.0 => clamped x = 50.0, from_own_half = True)
    cur.executemany(
        "INSERT INTO player_shots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)",
        [
            (1, 1, 1001, 1, "goal", "open-play", "right-foot", 10.5, 48.5, 10.6),
            (2, 3, 1001, 0, "save", "open-play", "left-foot", 63.0, 30.0, 63.2),
        ],
    )
    cur.executemany(
        "INSERT INTO player_shots_xg VALUES (?, ?)",
        [(1, 0.35), (2, 0.01)],
    )
    cur.execute(
        "INSERT INTO match_goal_incidents (match_id, team_id, player_name, minute, period, is_corner_origin, incident_type) VALUES (1001, 100, 'Delantero Local', 24, '1T', 0, 'regular')"
    )
    conn.commit()

    payload = _build_sheet_01_chances(conn, match_id=1001)

    home_shot = payload["module_03_home_shots"]["shots"][0]
    assert home_shot["raw_x"] == 90.0
    assert home_shot["x"] == 90.0
    assert home_shot["y"] == 48.5
    assert home_shot["from_own_half"] is False
    assert home_shot["is_goal"] is True
    assert home_shot["outcome"] == "goal"

    away_shot = payload["module_04_away_shots"]["shots"][0]
    assert away_shot["raw_x"] == 40.0
    assert away_shot["x"] == 50.0
    assert away_shot["y"] == 30.0
    assert away_shot["from_own_half"] is True
    assert payload["module_04_away_shots"]["own_half_shots_count"] == 1


def test_module_05_and_06_coherence_and_missing_xgot():
    """
    Verify:
    - Module 06 categories sum to total: goals + saved + blocked + off_target == total
    - woodwork <= off_target (post is grouped inside off_target per Option 2A)
    - Module 05 created_xg >= on_frame_xg
    - Missing Flashscore stats produce struck_xgot = None and scoreboard_kpis.{home|away}.xgot = None
    - Module 02 Option 1A: box_entries = passes_into_box + carries_into_box and deep_completions <= 20m (excluding crosses)
    """
    conn = _create_temp_match_db()
    cur = conn.cursor()

    cur.execute(
        "INSERT INTO matches VALUES (1002, 100, 200, '2026-04-12T15:00:00', 8, 2, 1, 'played', 88529)"
    )
    cur.executemany(
        "INSERT INTO player_match_stats VALUES (?, ?, ?, ?)",
        [(1002, 1, 100, 90), (1002, 2, 100, 90), (1002, 3, 200, 90), (1002, 4, 200, 90)],
    )

    # Home shots: 1 goal (0.40), 1 save (0.20), 1 block (0.08), 1 miss (0.05), 1 post (0.15) -> total 5
    # Away shots: 1 goal (0.30), 1 blocked-off-line (0.25), 1 post (0.10) -> total 3
    cur.executemany(
        "INSERT INTO player_shots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)",
        [
            (10, 1, 1002, 1, "goal", "open-play", "right-foot", 9.0, 50.0, 9.0),
            (11, 1, 1002, 1, "save", "open-play", "right-foot", 14.0, 45.0, 14.5),
            (12, 2, 1002, 1, "block", "open-play", "left-foot", 18.0, 52.0, 18.1),
            (13, 2, 1002, 1, "miss", "set-piece", "head", 11.0, 55.0, 11.5),
            (14, 1, 1002, 1, "post", "open-play", "right-foot", 12.0, 48.0, 12.1),
            (15, 3, 1002, 0, "goal", "penalty", "right-foot", 11.0, 50.0, 11.0),
            (16, 3, 1002, 0, "blocked-off-line", "corner", "head", 5.0, 49.0, 5.1),
            (17, 3, 1002, 0, "post", "open-play", "left-foot", 20.0, 60.0, 21.0),
        ],
    )
    cur.executemany(
        "INSERT INTO player_shots_xg VALUES (?, ?)",
        [
            (10, 0.40),
            (11, 0.20),
            (12, 0.08),
            (13, 0.05),
            (14, 0.15),
            (15, 0.76),
            (16, 0.25),
            (17, 0.10),
        ],
    )
    # Home has 1 regular goal + 1 ownGoal from away defender -> official home_score = 2
    cur.executemany(
        "INSERT INTO match_goal_incidents (match_id, team_id, player_name, minute, period, is_corner_origin, incident_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (1002, 100, "Delantero Local", 18, "1T", 0, "regular"),
            (1002, 100, "Defensa Visita", 45, "1T", 0, "ownGoal"),
            (1002, 200, "Delantero Visita", 90, "2T", 0, "penalty"),
        ],
    )

    # Spatial passes for Module 02 & density:
    # Home:
    # - 1 non-cross pass into box & within 20m of goal: (75, 50) -> (90, 50) [dist = 10.5m <= 20m]
    # - 1 completed cross into box: (70, 10) -> (90, 50) [is cross -> excluded from deep_completions, included in passes_into_box]
    # Away:
    # - 1 completed pass in final third but outside 20m: (60, 20) -> (70, 20)
    cur.executemany(
        "INSERT INTO player_passes (match_id, player_id, x_start, y_start, x_end, y_end, is_successful) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (1002, 1, 75.0, 50.0, 90.0, 50.0, 1),
            (1002, 2, 70.0, 10.0, 90.0, 50.0, 1),
            (1002, 3, 60.0, 20.0, 70.0, 20.0, 1),
        ],
    )
    # Carries into box: Home has 1 carry entering box (80, 50) -> (86, 50)
    cur.executemany(
        "INSERT INTO player_ball_carries (match_id, player_id, x_start, y_start, x_end, y_end, is_home) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (1002, 1, 80.0, 50.0, 86.0, 50.0, 1),
            (1002, 3, 55.0, 40.0, 65.0, 40.0, 0),
        ],
    )
    conn.commit()

    payload = _build_sheet_01_chances(conn, match_id=1002)

    # xGOT must be None (no Flashscore rows)
    assert payload["has_xgot"] is False
    assert payload["scoreboard_kpis"]["home"]["xgot"] is None
    assert payload["scoreboard_kpis"]["away"]["xgot"] is None
    assert payload["module_05_chance_to_goal"]["home"]["struck_xgot"] is None
    assert payload["module_05_chance_to_goal"]["away"]["struck_xgot"] is None

    # Module 06 invariants
    m06_h = payload["module_06_shot_outcomes"]["home"]
    assert m06_h == {
        "total": 5,
        "goals": 1,
        "saved": 1,
        "blocked": 1,
        "off_target": 2,
        "woodwork": 1,
    }
    assert m06_h["goals"] + m06_h["saved"] + m06_h["blocked"] + m06_h["off_target"] == m06_h["total"]
    assert m06_h["woodwork"] <= m06_h["off_target"]

    m06_a = payload["module_06_shot_outcomes"]["away"]
    assert m06_a == {
        "total": 3,
        "goals": 1,
        "saved": 0,
        "blocked": 1,
        "off_target": 1,
        "woodwork": 1,
    }
    assert m06_a["goals"] + m06_a["saved"] + m06_a["blocked"] + m06_a["off_target"] == m06_a["total"]

    # Module 05 coherence
    m05_h = payload["module_05_chance_to_goal"]["home"]
    assert m05_h["created_xg"] == 0.88
    assert m05_h["on_frame_xg"] == 0.60
    assert m05_h["created_xg"] >= m05_h["on_frame_xg"]
    assert m05_h["scored_goals"] == 2
    assert m05_h["shot_goals"] == 1
    assert m05_h["own_goals_for"] == 1

    # Module 02 Option 1A checks
    m02 = payload["module_02_chance_balance"]
    assert m02["box_entries_source"] == "passes_and_carries"
    assert m02["home"]["passes_into_box"] == 2
    assert m02["home"]["carries_into_box"] == 1
    assert m02["home"]["box_entries"] == 3
    assert m02["home"]["deep_completions"] == 1  # Cross excluded!
    assert m02["home"]["field_tilt_pct"] == 66.7
    assert m02["away"]["field_tilt_pct"] == 33.3

    # Module 03 & 04 density checks
    d_home = payload["module_03_home_shots"]["density"]
    assert d_home is not None
    assert d_home["rows"] == 7
    assert d_home["cols"] == 10
    assert d_home["density_source"] in ("full_pitch_ball_actions", "opponent_half_ball_actions")
    assert d_home["max_count"] >= d_home["team_max_count"]

    # Verify vector density contours contract
    assert "contours" in d_home
    assert isinstance(d_home["contours"], list)
    assert len(d_home["contours"]) == 3
    for idx, expected_lvl in enumerate([0.25, 0.50, 0.75]):
        c = d_home["contours"][idx]
        assert c["level"] == expected_lvl
        assert isinstance(c["threshold"], (int, float))
        assert c["threshold"] > 0
        assert isinstance(c["svg_path"], str)
        assert isinstance(c["point_count"], int)
        if c["svg_path"]:
            assert c["svg_path"].startswith("M ")
            assert c["svg_path"].endswith(" Z")
            assert c["point_count"] >= 3

    d_away = payload["module_04_away_shots"]["density"]
    assert d_away is not None
    assert "contours" in d_away
    assert len(d_away["contours"]) == 3


def test_zero_shot_match_returns_null_modules_cleanly():
    """
    Verify that a scheduled/postponed match with 0 shots and no metrics returns None for
    data-dependent modules without raising any exception.
    """
    conn = _create_temp_match_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO matches VALUES (1003, 100, 200, '2026-09-01T18:00:00', 10, 0, 0, 'postponed', 88529)"
    )
    conn.commit()

    payload = _build_sheet_01_chances(conn, match_id=1003)

    assert payload["match_id"] == 1003
    assert payload["scoreboard_kpis"] is None
    assert payload["module_01_xg_flow"] is None
    assert payload["module_02_chance_balance"] is None
    assert payload["module_03_home_shots"] is None
    assert payload["module_04_away_shots"] is None
    assert payload["module_05_chance_to_goal"] is None
    assert payload["module_06_shot_outcomes"] is None


def test_real_db_matches_with_and_without_xgot():
    """
    Read-only integration test on liga1.db for:
    - match_id = 16280844 (Clausura F13: UTC 1-2 Melgar, WITH xGOT)
    - match_id = 15607096 (Apertura F7: Sporting Cristal 3-0 Sport Boys, WITHOUT xGOT, with 3 posts & 1 own-half shot)
    """
    conn = sqlite3.connect("file:liga1.db?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row

    # 1. Match WITH xGOT (16280844)
    with_xgot = _build_sheet_01_chances(conn, match_id=16280844)
    assert with_xgot["has_xgot"] is True
    assert with_xgot["scoreboard_kpis"]["home"]["xgot"] == 2.06
    assert with_xgot["scoreboard_kpis"]["away"]["xgot"] == 1.70
    assert with_xgot["module_05_chance_to_goal"]["home"]["struck_xgot"] == 2.06
    assert with_xgot["module_05_chance_to_goal"]["away"]["struck_xgot"] == 1.70
    assert with_xgot["module_05_chance_to_goal"]["home"]["created_xg"] >= with_xgot["module_05_chance_to_goal"]["home"]["on_frame_xg"]
    assert with_xgot["module_05_chance_to_goal"]["away"]["created_xg"] >= with_xgot["module_05_chance_to_goal"]["away"]["on_frame_xg"]

    for side in ("home", "away"):
        m06 = with_xgot["module_06_shot_outcomes"][side]
        assert m06["goals"] + m06["saved"] + m06["blocked"] + m06["off_target"] == m06["total"]
        assert m06["woodwork"] <= m06["off_target"]

    # Verify vector density contours for match 16280844
    d_home_1628 = with_xgot["module_03_home_shots"]["density"]
    assert d_home_1628 is not None
    assert d_home_1628["contours"] is not None
    assert len(d_home_1628["contours"]) == 3
    for c in d_home_1628["contours"]:
        assert c["level"] in (0.25, 0.50, 0.75)
        assert c["threshold"] > 0
        assert c["point_count"] > 0
        assert c["svg_path"].startswith("M ")
        assert c["svg_path"].endswith(" Z")

    d_away_1628 = with_xgot["module_04_away_shots"]["density"]
    assert d_away_1628 is not None
    assert d_away_1628["contours"] is not None
    assert len(d_away_1628["contours"]) == 3
    for c in d_away_1628["contours"]:
        assert c["level"] in (0.25, 0.50, 0.75)
        assert c["threshold"] > 0

    # 2. Match WITHOUT xGOT (15607096)
    without_xgot = _build_sheet_01_chances(conn, match_id=15607096)
    assert without_xgot["has_xgot"] is False
    assert without_xgot["scoreboard_kpis"]["home"]["xgot"] is None
    assert without_xgot["scoreboard_kpis"]["away"]["xgot"] is None
    assert without_xgot["module_05_chance_to_goal"]["home"]["struck_xgot"] is None
    assert without_xgot["module_05_chance_to_goal"]["away"]["struck_xgot"] is None
    assert without_xgot["module_06_shot_outcomes"]["home"]["woodwork"] == 2
    assert without_xgot["module_06_shot_outcomes"]["away"]["woodwork"] == 1
    assert without_xgot["module_04_away_shots"]["own_half_shots_count"] == 1
    own_half_shot = [s for s in without_xgot["module_04_away_shots"]["shots"] if s["from_own_half"]][0]
    assert own_half_shot["raw_x"] == 49.0
    assert own_half_shot["x"] == 50.0

    # Contours also present in match 15607096
    assert without_xgot["module_03_home_shots"]["density"]["contours"] is not None
    assert without_xgot["module_04_away_shots"]["density"]["contours"] is not None

    conn.close()


def test_density_contours_coordinate_bounds_and_carry_origin_only():
    """
    Verify:
    1. All coordinates in contour SVG paths are bounded within [0.0, 100.0].
    2. Ball carries only count their origins (x_start, y_start) and NOT their end positions (x_end, y_end).
    """
    conn = _create_temp_match_db()
    cur = conn.cursor()

    cur.execute(
        "INSERT INTO matches VALUES (1004, 100, 200, '2026-10-01T15:00:00', 12, 1, 0, 'played', 88529)"
    )
    cur.executemany(
        "INSERT INTO player_match_stats VALUES (?, ?, ?, ?)",
        [(1004, 1, 100, 90), (1004, 3, 200, 90)],
    )

    # 5 carries for home, each with distinct x_start, y_start and different x_end, y_end
    carries = [
        (1004, 1, 20.0, 30.0, 45.0, 30.0, 1),
        (1004, 1, 22.0, 32.0, 50.0, 35.0, 1),
        (1004, 1, 21.0, 31.0, 48.0, 33.0, 1),
        (1004, 1, 23.0, 29.0, 47.0, 31.0, 1),
        (1004, 1, 20.5, 30.5, 49.0, 32.0, 1),
    ]
    cur.executemany(
        "INSERT INTO player_ball_carries (match_id, player_id, x_start, y_start, x_end, y_end, is_home) VALUES (?, ?, ?, ?, ?, ?, ?)",
        carries,
    )
    # 1 shot so module is populated
    cur.execute(
        "INSERT INTO player_shots (shot_id, player_id, match_id, is_home, shot_type, situation, body_part, coord_x, coord_y, distance_m) VALUES (99, 1, 1004, 1, 'goal', 'open-play', 'right-foot', 10.0, 50.0, 10.0)"
    )
    cur.execute("INSERT INTO player_shots_xg VALUES (99, 0.45)")
    cur.execute(
        "INSERT INTO match_goal_incidents (match_id, team_id, player_name, minute, period, is_corner_origin, incident_type) VALUES (1004, 100, 'Delantero Local', 15, '1T', 0, 'regular')"
    )
    conn.commit()

    payload = _build_sheet_01_chances(conn, match_id=1004)
    d_home = payload["module_03_home_shots"]["density"]
    assert d_home is not None

    # Total actions must be 5 carries + 1 shot = 6 actions (NOT 11 if carry ends were added!)
    assert d_home["total_actions"] == 6

    # Verify contour coordinate bounds
    assert d_home["contours"] is not None
    for c in d_home["contours"]:
        if c["svg_path"]:
            tokens = c["svg_path"].split()
            coords = [float(tok) for tok in tokens if tok not in ("M", "L", "Z")]
            # Paired as (x, y)
            for i in range(0, len(coords), 2):
                x_val = coords[i]
                y_val = coords[i + 1]
                assert 0.0 <= x_val <= 100.0, f"x={x_val} out of bounds"
                assert 0.0 <= y_val <= 100.0, f"y={y_val} out of bounds"
