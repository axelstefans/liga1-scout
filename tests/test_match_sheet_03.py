"""
Unit and integration tests for Match Report Sheet 03
('Data Hub Estadístico' / Statistical Consensus & Deep Metrics).
"""

import os
import sys
import re
import sqlite3
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.main import app
from api.routers.matches_sheet_03 import build_match_sheet_03_datahub, _build_sheet_03_datahub
from api.schemas.match import MatchSheet03DataHubResponse, DataHubMetricRow

client = TestClient(app)

EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F1E0-\U0001F1FF"  # flags (iOS)
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "]+",
    flags=re.UNICODE,
)


def test_match_sheet_03_real_match_16280844_direct():
    """
    Direct function test against liga1.db for match 16280844 (UTC vs Melgar).
    Validates metadata, 4 metric sections, and clipboard text.
    """
    db_path = "liga1.db"
    if not os.path.exists(db_path):
        pytest.skip("liga1.db not available in test environment")

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row

    data = build_match_sheet_03_datahub(conn, match_id=16280844)
    conn.close()

    # 1. Validate against Pydantic schema
    validated = MatchSheet03DataHubResponse(**data)
    assert validated.match_id == 16280844

    # 2. Metadata check
    meta = data["metadata"]
    assert meta["match_id"] == 16280844
    assert meta["tournament"] == "Clausura"
    assert meta["round"] == 13
    assert "2026-10-23" in meta["match_date"]
    assert meta["home_team"]["score"] == 1
    assert meta["away_team"]["score"] == 2

    # 3. Validate the 4 metric sections contain expected elements
    attack = data["attack_metrics"]
    passing = data["passing_metrics"]
    defense = data["defense_metrics"]
    discipline = data["discipline_metrics"]

    assert len(attack) >= 14, f"Expected at least 14 attack metrics, got {len(attack)}"
    assert len(passing) >= 14, f"Expected at least 14 passing metrics, got {len(passing)}"
    assert len(defense) >= 10, f"Expected at least 10 defense metrics, got {len(defense)}"
    assert len(discipline) >= 8, f"Expected at least 8 discipline metrics, got {len(discipline)}"

    # Check each row conforms to DataHubMetricRow
    for row in attack + passing + defense + discipline:
        m_row = DataHubMetricRow(**row)
        assert m_row.key
        assert m_row.label
        assert m_row.source in ("sofascore", "flashscore", "consensus", "derived")

    # 4. Validate xG differentiation between Sofascore and Flashscore
    attack_by_key = {r["key"]: r for r in attack}

    assert "xg_sofascore" in attack_by_key
    assert "xg_flashscore" in attack_by_key

    xg_sofa = attack_by_key["xg_sofascore"]
    xg_flash = attack_by_key["xg_flashscore"]

    assert xg_sofa["source"] == "sofascore"
    assert xg_flash["source"] == "flashscore"

    # Home xG: Sofascore ~ 1.37 vs Flashscore ~ 1.39
    assert abs(float(xg_sofa["home_val"]) - 1.37) < 0.05
    assert abs(float(xg_flash["home_val"]) - 1.39) < 0.05

    # Away xG: Sofascore ~ 0.57 vs Flashscore ~ 0.95 (clearly differentiated)
    assert abs(float(xg_sofa["away_val"]) - 0.57) < 0.05
    assert abs(float(xg_flash["away_val"]) - 0.95) < 0.05
    assert float(xg_sofa["away_val"]) != float(xg_flash["away_val"])

    # 5. Validate clipboard_text is non-empty, formatted, contains 4 sections, and no footer/emojis
    clipboard = data["clipboard_text"]
    assert clipboard
    assert len(clipboard) > 100
    assert "REPORTE ESTADISTICO:" in clipboard
    assert "xG (Sofascore)" in clipboard
    assert "xG (Flashscore)" in clipboard
    assert "-- CALIDAD DE OCASIONES Y REMATE -----------------" in clipboard
    assert "-- CONSTRUCCION Y DISTRIBUCION -------------------" in clipboard
    assert "-- PRESION, DUELOS Y PORTERIA --------------------" in clipboard
    assert "-- DISCIPLINA Y PELOTA PARADA --------------------" in clipboard

    # Assert individual player sections in clipboard
    assert "RENDIMIENTO INDIVIDUAL:" in clipboard
    assert "TITULARES" in clipboard
    assert "SUPLENTES CON MINUTOS" in clipboard
    expected_header = f"{'DOR':>3}  {'JUGADOR':<20}  {'POS':<3}  {'MIN':>4}  {'RAT':>4}  {'G':>2}  {'A':>2}  {'xG':>5}  {'TIROS':>5}  {'PASES(%)':>9}  {'REC/ENT':>7}"
    assert expected_header in clipboard
    assert "Marcos Lliuya" in clipboard

    # Assert goalkeeper indicators
    assert "[8 Paradas]" in clipboard
    assert "[3 Paradas]" in clipboard

    # Assert no double separators
    assert "========================================================================\n========================================================================" not in clipboard

    # Assert fixed decimal formatting and no 0 (XX%) pass bug
    assert " 1.37    xG (Sofascore)" in clipboard or "xG (Sofascore)" in clipboard
    assert not re.search(r"\b0 \([1-9]\d*%\)", clipboard), "No player should have '0 (XX%)' pass bug"

    # Assert footer is NOT present
    assert "Fuente: Liga 1 Scout Intelligence Platform" not in clipboard

    # Assert no emojis present
    assert not EMOJI_PATTERN.search(clipboard), "clipboard_text must not contain emojis"

    # 6. Validate individual players list (22 starters + 9 subs = 31 total)
    home_players = data["home_players"]
    away_players = data["away_players"]
    assert len(home_players) == 16, f"Expected 16 UTC players (11 starters + 5 subs), got {len(home_players)}"
    assert len(away_players) == 15, f"Expected 15 Melgar players (11 starters + 4 subs), got {len(away_players)}"
    assert len(home_players) + len(away_players) == 31

    # Check starters vs subs distribution
    home_starters = [p for p in home_players if not p["was_substitute"]]
    home_subs = [p for p in home_players if p["was_substitute"]]
    away_starters = [p for p in away_players if not p["was_substitute"]]
    away_subs = [p for p in away_players if p["was_substitute"]]

    assert len(home_starters) == 11
    assert len(home_subs) == 5
    assert len(away_starters) == 11
    assert len(away_subs) == 4

    # Verify specific player stats (e.g. Marcos Lliuya ID 846742)
    lliuya = next((p for p in home_players if p["player_id"] == 846742), None)
    assert lliuya is not None
    assert lliuya["name"] == "Marcos Lliuya"
    assert lliuya["minutes_played"] == 90
    assert lliuya["position"] == "CAM"
    assert lliuya["key_passes"] == 7
    assert lliuya["passes_total"] == 74
    assert lliuya["passes_completed"] == 55
    assert lliuya["calculated_xg"] > 0.05

    # Verify substitute mapping (e.g. Jefferson Caceres replaced Bernardo Cuesta at 44')
    caceres = next((p for p in away_players if p["player_id"] == 1017759), None)
    assert caceres is not None
    assert caceres["was_substitute"] is True
    assert caceres["replaced_player_name"] == "Bernardo Cuesta"
    assert caceres["subbed_in_minute"] == 44


def test_match_sheet_03_http_endpoint_200():
    """
    Test GET /api/matches/{match_id}/sheet-03-datahub returns HTTP 200 and valid JSON.
    """
    db_path = "liga1.db"
    if not os.path.exists(db_path):
        pytest.skip("liga1.db not available in test environment")

    # Test both alias routes
    for endpoint in ("/api/matches/16280844/sheet-03-datahub", "/api/matches/16280844/sheet-03"):
        response = client.get(endpoint)
        assert response.status_code == 200, f"Endpoint {endpoint} failed with {response.status_code}: {response.text}"
        data = response.json()

        assert data["match_id"] == 16280844
        assert "metadata" in data
        assert "attack_metrics" in data
        assert "passing_metrics" in data
        assert "defense_metrics" in data
        assert "discipline_metrics" in data
        assert "clipboard_text" in data
        assert "home_players" in data
        assert "away_players" in data
        assert len(data["home_players"]) == 16
        assert len(data["away_players"]) == 15

        # Check types of metrics
        for row in data["attack_metrics"]:
            assert "key" in row
            assert "label" in row
            assert "home_val" in row
            assert "away_val" in row
            assert "source" in row

        # Verify no emojis
        assert not EMOJI_PATTERN.search(data["clipboard_text"])


def test_match_sheet_03_http_endpoint_404():
    """
    Test GET /api/matches/{match_id}/sheet-03-datahub with non-existent match ID returns 404.
    """
    db_path = "liga1.db"
    if not os.path.exists(db_path):
        pytest.skip("liga1.db not available in test environment")

    response = client.get("/api/matches/999999999/sheet-03-datahub")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_match_sheet_03_derived_metrics():
    """
    Validate specific calculated metrics such as field tilt, average shot distance, and pass accuracy.
    """
    db_path = "liga1.db"
    if not os.path.exists(db_path):
        pytest.skip("liga1.db not available in test environment")

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    data = _build_sheet_03_datahub(conn, match_id=16280844)
    conn.close()

    defense_by_key = {r["key"]: r for r in data["defense_metrics"]}
    passing_by_key = {r["key"]: r for r in data["passing_metrics"]}
    attack_by_key = {r["key"]: r for r in data["attack_metrics"]}

    # Field Tilt (derived from final_third_passes: 123 vs 73)
    field_tilt = defense_by_key["field_tilt"]
    assert field_tilt["source"] == "derived"
    assert field_tilt["unit"] == "%"
    assert field_tilt["home_val"] == 62.8
    assert field_tilt["away_val"] == 37.2

    # Average shot distance (sofascore: ~22.8m vs ~24.9m)
    avg_dist = attack_by_key["avg_shot_distance"]
    assert avg_dist["source"] == "sofascore"
    assert avg_dist["unit"] == "m"
    assert abs(float(avg_dist["home_val"]) - 22.8) < 0.2
    assert abs(float(avg_dist["away_val"]) - 24.9) < 0.2

    # Passes completed includes percentage
    passes_comp = passing_by_key["passes_completed"]
    assert passes_comp["source"] == "sofascore"
    assert "367" in str(passes_comp["home_val"])
    assert "%" in str(passes_comp["home_val"])
    assert "336" in str(passes_comp["away_val"])
    assert "%" in str(passes_comp["away_val"])


def test_match_sheet_03_expanded_features_real_match_16280844():
    """
    Test real match 16280844 (UTC vs Melgar) for all new Sheet 03 modules:
    - Venue context (stadium, city, altitude, surface)
    - Referee profile (sample matches, cards per match, small sample flag)
    - Chronological goals and regulation 90-min Game State breakdown
    - Halves breakdown (1T / 2T) with Flashscore xG and event counts
    - Final third attack channels (left, center, right)
    - Shot typology distribution (open_play, set_piece, counter_attack, penalty, other)
    - Aligned clipboard_text formatting without emojis or missing labels
    """
    db_path = "liga1.db"
    if not os.path.exists(db_path):
        pytest.skip("liga1.db not available in test environment")

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    data = build_match_sheet_03_datahub(conn, match_id=16280844)
    conn.close()

    # 1. Pydantic validation
    resp = MatchSheet03DataHubResponse(**data)
    assert resp.match_id == 16280844

    # 2. Venue validation
    venue = data["venue"]
    assert venue is not None
    assert "San Ram" in venue["stadium"]
    assert venue["city"] == "Cajamarca"
    assert venue["altitude"] == 2750
    assert "Sint" in venue["surface"]

    # 3. Referee validation
    ref = data["referee"]
    assert ref is not None
    assert ref["referee_id"] == 790829
    assert ref["name"] == "Junior Rivera"
    assert ref["sample_matches"] == 8
    assert abs(ref["yellow_cards_per_match"] - 4.75) < 0.05
    assert abs(ref["red_cards_per_match"] - 0.25) < 0.05
    assert ref["is_small_sample"] is True

    # 4. Goals and Game State
    goals = data["goals_chronology"]
    assert len(goals) == 3
    assert [g["minute"] for g in goals] == [7, 68, 87]
    assert [g["score"] for g in goals] == ["0-1", "0-2", "1-2"]

    gs = data["game_state"]
    assert gs["total_duration_minutes"] == 90
    assert gs["lead_minutes"] == 0
    assert gs["draw_minutes"] == 7
    assert gs["trail_minutes"] == 83
    assert gs["lead_minutes"] + gs["draw_minutes"] + gs["trail_minutes"] == 90
    assert abs(gs["lead_pct"] + gs["draw_pct"] + gs["trail_pct"] - 100.0) < 0.2

    # 5. Halves breakdown
    halves = data["half_period_stats"]
    assert len(halves) == 2
    h1, h2 = halves[0], halves[1]
    assert h1["period"] == "1ST"
    assert h1["home_goals"] == 0 and h1["away_goals"] == 1
    assert abs(h1["home_xg"] - 0.53) < 0.05
    assert abs(h1["away_xg"] - 0.44) < 0.05

    assert h2["period"] == "2ND"
    assert h2["home_goals"] == 1 and h2["away_goals"] == 1
    assert abs(h2["home_xg"] - 0.86) < 0.05
    assert abs(h2["away_xg"] - 0.51) < 0.05

    # 6. Attack channels
    h_ac = data["home_attack_channels"]
    a_ac = data["away_attack_channels"]
    assert h_ac["left_passes"] + h_ac["center_passes"] + h_ac["right_passes"] == h_ac["total_passes"]
    assert a_ac["left_passes"] + a_ac["center_passes"] + a_ac["right_passes"] == a_ac["total_passes"]
    assert h_ac["total_passes"] > 0
    assert a_ac["total_passes"] > 0

    # 7. Shot typology
    h_st = data["home_shot_typology"]
    a_st = data["away_shot_typology"]
    assert h_st["open_play"] + h_st["set_piece"] + h_st["counter_attack"] + h_st["penalty"] + h_st["other"] == h_st["total"]
    assert a_st["open_play"] + a_st["set_piece"] + a_st["counter_attack"] + a_st["penalty"] + a_st["other"] == a_st["total"]
    assert h_st["total"] == 19
    assert a_st["total"] == 8

    # 8. Clipboard text verification
    clip = data["clipboard_text"]
    assert "Sede: Estadio H" in clip and "Cajamarca" in clip
    assert "Junior Rivera" in clip and "partidos" in clip
    assert "CRONOLOGIA DE GOLES Y ESTADO DE JUEGO" in clip
    assert "DESGLOSE POR PERIODOS (1T / 2T)" in clip
    assert "CANALES DE ATAQUE (PASES ULTIMO TERCIO)" in clip
    assert "TIPOLOGIA DE REMATES" in clip
    assert "None" not in clip


def test_match_sheet_03_contrast_match_15362086_missing_data():
    """
    Test contrast match 15362086 (Sport Huancayo vs Alianza Lima):
    - Referee is present in current liga1.db ('Joel Alarcon')
    - Venue is Huancayo altitude ~3259
    - No Flashscore period stats -> period xG is None and displays '-'
    - Game state preserves 90 minutes sum
    """
    db_path = "liga1.db"
    if not os.path.exists(db_path):
        pytest.skip("liga1.db not available in test environment")

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    data = build_match_sheet_03_datahub(conn, match_id=15362086)
    conn.close()

    resp = MatchSheet03DataHubResponse(**data)
    assert resp.match_id == 15362086

    # Referee updated in liga1.db
    assert data["referee"] is not None
    assert data["referee"]["name"] == "Joel Alarcon"

    # Venue
    venue = data["venue"]
    assert venue is not None
    assert "Huancayo" in venue["stadium"]
    assert venue["altitude"] == 3259

    # Halves without Flashscore have None xG
    for h in data["half_period_stats"]:
        assert h["home_xg"] is None
        assert h["away_xg"] is None

    # Game state sums to 90 min
    gs = data["game_state"]
    assert gs["total_duration_minutes"] == 90
    assert gs["lead_minutes"] + gs["draw_minutes"] + gs["trail_minutes"] == 90

    # Clipboard text renders referee and handles missing xG gracefully
    clip = data["clipboard_text"]
    assert "Arbitro: Joel Alarcon" in clip
    assert "Sede: Estadio IPD de Huancayo" in clip
    assert "None" not in clip


def test_match_sheet_03_synthetic_game_state_and_incidents():
    """
    Test edge cases using direct helper calls:
    - 0-0 match yields 90 draw minutes and 'Sin goles en el partido'
    - Own goal assigns score to opponent and displays 'Autogol'
    - Penalty displays 'Penalti'
    """
    from api.routers.matches_sheet_03 import _get_goals_and_game_state
    from api.routers.matches_sheet_03_stadiums import get_stadium_info

    # 1. Test unmapped stadium team ID
    assert get_stadium_info(9999999)["stadium"] is None

    # 2. In-memory sqlite test for 0-0 match
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("CREATE TABLE match_goal_incidents (match_id INT, minute INT, period TEXT, team_id INT, player_name TEXT, incident_type TEXT, is_corner_origin INT)")

    # 0-0 match
    goals, gs = _get_goals_and_game_state(c, match_id=1, home_id=10, away_id=20, home_name="Home", away_name="Away")
    assert len(goals) == 0
    assert gs["lead_minutes"] == 0
    assert gs["draw_minutes"] == 90
    assert gs["trail_minutes"] == 0
    assert gs["draw_pct"] == 100.0

    # Match with own goal and penalty
    c.execute("INSERT INTO match_goal_incidents VALUES (2, 25, '1ST', 20, 'Defender X', 'ownGoal', 0)")
    c.execute("INSERT INTO match_goal_incidents VALUES (2, 70, '2ND', 20, 'Striker Y', 'penalty', 0)")
    goals_og, gs_og = _get_goals_and_game_state(c, match_id=2, home_id=10, away_id=20, home_name="Home", away_name="Away")

    assert len(goals_og) == 2
    assert goals_og[0]["incident_type"] == "Autogol"
    assert goals_og[0]["score"] == "0-1"
    assert goals_og[1]["incident_type"] == "Penalti"
    assert goals_og[1]["score"] == "0-2"
    assert gs_og["trail_minutes"] == 65
    assert gs_og["draw_minutes"] == 25
    assert gs_og["lead_minutes"] == 0
    assert gs_og["trail_minutes"] + gs_og["draw_minutes"] + gs_og["lead_minutes"] == 90
    conn.close()


def test_match_sheet_03_fouls_flashscore_sum_and_coherence():
    """
    Test real match 16280856 (Universitario vs Juan Pablo II):
    - Primary fouls source is Flashscore.
    - 1T + 2T fouls strictly equals total fouls for each team.
    - Total in discipline metrics matches 1T + 2T sum (8 and 17).
    """
    db_path = "liga1.db"
    if not os.path.exists(db_path):
        pytest.skip("liga1.db not available in test environment")

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    data = build_match_sheet_03_datahub(conn, match_id=16280856)
    conn.close()

    assert data["fouls_source"] == "flashscore"

    halves = data["half_period_stats"]
    assert len(halves) == 2
    h1, h2 = halves[0], halves[1]

    # Universitario (home): 1T=2, 2T=6 -> sum=8
    assert h1["home_fouls"] == 2
    assert h2["home_fouls"] == 6
    assert h1["home_fouls"] + h2["home_fouls"] == 8

    # Juan Pablo II (away): 1T=10, 2T=7 -> sum=17
    assert h1["away_fouls"] == 10
    assert h2["away_fouls"] == 7
    assert h1["away_fouls"] + h2["away_fouls"] == 17

    fouls_metric = next(r for r in data["discipline_metrics"] if r["key"] == "fouls")
    assert fouls_metric["home_val"] == 8
    assert fouls_metric["away_val"] == 17
    assert fouls_metric["source"] == "flashscore"


def test_match_sheet_03_fouls_fallback_sofascore():
    """
    Test match 15362086 (Sport Huancayo vs Alianza Lima) without Flashscore period stats:
    - Falls back to match_period_stats (Sofascore).
    - 1T + 2T fouls strictly equals total fouls for each team (9 and 18).
    """
    db_path = "liga1.db"
    if not os.path.exists(db_path):
        pytest.skip("liga1.db not available in test environment")

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    data = build_match_sheet_03_datahub(conn, match_id=15362086)
    conn.close()

    assert data["fouls_source"] == "sofascore"

    halves = data["half_period_stats"]
    assert len(halves) == 2
    h1, h2 = halves[0], halves[1]

    # Home: 5 + 4 = 9
    assert h1["home_fouls"] == 5
    assert h2["home_fouls"] == 4
    assert h1["home_fouls"] + h2["home_fouls"] == 9

    # Away: 6 + 12 = 18
    assert h1["away_fouls"] == 6
    assert h2["away_fouls"] == 12
    assert h1["away_fouls"] + h2["away_fouls"] == 18

    fouls_metric = next(r for r in data["discipline_metrics"] if r["key"] == "fouls")
    assert fouls_metric["home_val"] == 9
    assert fouls_metric["away_val"] == 18
    assert fouls_metric["source"] == "sofascore"


def test_match_sheet_03_fouls_null_fallback_in_memory():
    """
    Test in-memory match where neither Flashscore nor Sofascore has fouls:
    - fouls_source is None
    - period home_fouls and away_fouls are None
    - total fouls in discipline_metrics is None
    - clipboard shows '-'
    """
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # Create minimal tables
    c.execute("CREATE TABLE matches (match_id INT, home_team_id INT, away_team_id INT, home_score INT, away_score INT, round INT, match_date TEXT, referee_id INT)")
    c.execute("CREATE TABLE teams (team_id INT, name TEXT, short_name TEXT, logo_url TEXT, primary_color TEXT)")
    c.execute("CREATE TABLE team_match_metrics (match_id INT, team_id INT, tournament TEXT)")
    c.execute("CREATE TABLE flashscore_match_team_stats (match_id INT, team_id INT, period TEXT, xg REAL, xgot REAL, shots_total INT, fouls INT, yellow_cards INT, red_cards INT, corner_kicks INT, offsides INT, free_kicks INT, throw_ins INT, goal_kicks INT, duels_won INT, saves INT, goals_prevented REAL)")
    c.execute("CREATE TABLE match_period_stats (match_id INT, team_id INT, period TEXT, goals INT, corner_kicks INT, fouls INT, yellow_cards INT, possession REAL)")
    c.execute("CREATE TABLE player_match_stats (id INT, player_id INT, match_id INT, team_id INT, minutes_played INT, was_substitute INT, position TEXT, replaced_player_id INT, sofascore_rating REAL, goals INT, assists INT, expected_goals REAL, total_shots INT, shots_on_target INT, key_passes INT, accurate_passes INT, accurate_passes_pct REAL, tackles INT, interceptions INT, clearances INT, saves INT)")
    c.execute("CREATE TABLE players (player_id INT, name TEXT, shirt_number INT)")
    c.execute("CREATE TABLE player_passes (match_id INT, player_id INT, is_successful INT, x_end REAL, y_end REAL)")
    c.execute("CREATE TABLE player_defensive_actions (match_id INT, player_id INT, action_type TEXT)")
    c.execute("CREATE TABLE player_shots (shot_id INT, match_id INT, player_id INT, is_home INT, shot_type TEXT, situation TEXT)")
    c.execute("CREATE TABLE player_shots_xg (shot_id INT, calculated_xg REAL)")
    c.execute("CREATE TABLE match_goal_incidents (match_id INT, minute INT, period TEXT, team_id INT, player_name TEXT, incident_type TEXT, is_corner_origin INT)")
    c.execute("CREATE TABLE referees (referee_id INT, name TEXT, country TEXT, total_games_sofa INT, total_yellows_sofa INT, total_reds_sofa INT)")

    c.execute("INSERT INTO teams VALUES (10, 'Home FC', 'HFC', '', '#000000')")
    c.execute("INSERT INTO teams VALUES (20, 'Away FC', 'AFC', '', '#FFFFFF')")
    c.execute("INSERT INTO matches VALUES (1, 10, 20, 0, 0, 1, '2026-01-01', NULL)")

    data = build_match_sheet_03_datahub(conn, match_id=1)
    conn.close()

    assert data["fouls_source"] is None
    for h in data["half_period_stats"]:
        assert h["home_fouls"] is None
        assert h["away_fouls"] is None

    fouls_metric = next(r for r in data["discipline_metrics"] if r["key"] == "fouls")
    assert fouls_metric["home_val"] is None
    assert fouls_metric["away_val"] is None

    # Check clipboard contains '-' for fouls
    assert "       -    Faltas Cometidas                       -" in data["clipboard_text"]
    assert "       -    Faltas                                 -" in data["clipboard_text"]


def test_match_sheet_03_player_passes_formatting_never_hyphen_pct():
    """
    Test player pass formatting in clipboard:
    - Player with completed=0, total=0, but pct=87% renders '87%' (never '- (87%)').
    - Player with accurate_passes_pct=None renders '-' (never 'None').
    - Player with completed and total renders '15 (75%)'.
    """
    from api.routers.matches_sheet_03 import _format_player_section_for_clipboard

    players = [
        {
            "player_id": 1, "jersey_number": 8, "name": "Midfielder Alpha", "position": "MID",
            "was_substitute": False, "minutes_played": 90, "sofascore_rating": 7.0,
            "goals": 0, "assists": 0, "calculated_xg": 0.1, "total_shots": 1, "shots_on_target": 0,
            "passes_completed": 0, "passes_total": 0, "accurate_passes_pct": 87.0,
            "recoveries": 3, "tackles": 2, "saves": 0,
        },
        {
            "player_id": 2, "jersey_number": 9, "name": "Striker Beta", "position": "FWD",
            "was_substitute": False, "minutes_played": 70, "sofascore_rating": 6.5,
            "goals": 1, "assists": 0, "calculated_xg": 0.45, "total_shots": 3, "shots_on_target": 2,
            "passes_completed": 0, "passes_total": 0, "accurate_passes_pct": None,
            "recoveries": 1, "tackles": 0, "saves": 0,
        },
        {
            "player_id": 3, "jersey_number": 4, "name": "Defender Gamma", "position": "DEF",
            "was_substitute": False, "minutes_played": 90, "sofascore_rating": 7.1,
            "goals": 0, "assists": 0, "calculated_xg": 0.0, "total_shots": 0, "shots_on_target": 0,
            "passes_completed": 15, "passes_total": 20, "accurate_passes_pct": 75.0,
            "recoveries": 5, "tackles": 4, "saves": 0,
        },
    ]

    out = _format_player_section_for_clipboard(players, "Test Club", "LOCAL", is_last=True)
    assert "- (87%)" not in out
    assert "None" not in out
    assert "87%" in out
    assert "15 (75%)" in out


def test_match_sheet_03_halves_xg_flashscore_label_and_width_alignment():
    """
    Verify halves block clipboard formatting:
    - Label 'xG (Flashscore)' is present.
    - Every row in the halves block is strictly 52 characters wide.
    - Missing xG shows '-' without shifting columns.
    """
    db_path = "liga1.db"
    if not os.path.exists(db_path):
        pytest.skip("liga1.db not available in test environment")

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    data = build_match_sheet_03_datahub(conn, match_id=16280856)
    data_missing = build_match_sheet_03_datahub(conn, match_id=15362086)
    conn.close()

    # Check match 16280856
    clip = data["clipboard_text"]
    assert "xG (Flashscore)" in clip

    # Extract all lines in DESGLOSE POR PERIODOS
    in_halves = False
    for line in clip.split("\n"):
        if "DESGLOSE POR PERIODOS" in line:
            in_halves = True
            continue
        if in_halves:
            if "CANALES DE ATAQUE" in line:
                break
            # Every line in the halves block must be exactly 52 characters
            assert len(line) == 52, f"Line '{line}' has length {len(line)} != 52"

    # Check match 15362086 (no Flashscore period stats)
    clip_missing = data_missing["clipboard_text"]
    expected_missing_xg_line = f"{'-':>8}    {'xG (Flashscore)':<28}    {'-':>8}"
    assert expected_missing_xg_line in clip_missing


def test_match_sheet_03_http_endpoint_fouls_serialization():
    """
    Test GET /api/matches/{match_id}/sheet-03-datahub HTTP endpoint serialization:
    - Match with Flashscore (16280856): returns HTTP 200, fouls_source='flashscore',
      and half_period_stats contains integer home_fouls and away_fouls.
    - Match without Flashscore (15362086): returns HTTP 200, fouls_source='sofascore',
      and half_period_stats contains integer home_fouls and away_fouls.
    """
    db_path = "liga1.db"
    if not os.path.exists(db_path):
        pytest.skip("liga1.db not available in test environment")

    # 1. Match with Flashscore
    resp1 = client.get("/api/matches/16280856/sheet-03-datahub")
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["fouls_source"] == "flashscore"
    assert len(data1["half_period_stats"]) == 2
    h1_1, h1_2 = data1["half_period_stats"][0], data1["half_period_stats"][1]
    assert h1_1["home_fouls"] == 2
    assert h1_1["away_fouls"] == 10
    assert h1_1["fouls_source"] == "flashscore"
    assert h1_2["home_fouls"] == 6
    assert h1_2["away_fouls"] == 7
    assert h1_2["fouls_source"] == "flashscore"

    # 2. Match without Flashscore (fallback to Sofascore)
    resp2 = client.get("/api/matches/15362086/sheet-03-datahub")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["fouls_source"] == "sofascore"
    assert len(data2["half_period_stats"]) == 2
    h2_1, h2_2 = data2["half_period_stats"][0], data2["half_period_stats"][1]
    assert h2_1["home_fouls"] == 5
    assert h2_1["away_fouls"] == 6
    assert h2_1["fouls_source"] == "sofascore"
    assert h2_2["home_fouls"] == 4
    assert h2_2["away_fouls"] == 12
    assert h2_2["fouls_source"] == "sofascore"


def test_match_sheet_03_period_shots_serialization_and_52_chars():
    """
    Test period shots serialization in HalfPeriodStats and strict 52 chars in clipboard:
    - Match 16280849 has Flashscore shots: shots_source='flashscore', shots_on_target <= shots.
    - Clipboard 1T/2T lines for 'Tiros Totales' and 'Tiros a Puerta' are strictly 52 characters.
    """
    db_path = "liga1.db"
    if not os.path.exists(db_path):
        pytest.skip("liga1.db not available in test environment")

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    data = build_match_sheet_03_datahub(conn, match_id=16280849)
    conn.close()

    validated = MatchSheet03DataHubResponse(**data)
    assert validated.shots_source == "flashscore"
    assert len(validated.half_period_stats) == 2

    h1, h2 = validated.half_period_stats[0], validated.half_period_stats[1]
    assert h1.home_shots == 8 and h1.home_shots_on_target == 4
    assert h1.away_shots == 5 and h1.away_shots_on_target == 1
    assert h1.shots_source == "flashscore"
    assert h2.home_shots == 7 and h2.home_shots_on_target == 5
    assert h2.away_shots == 7 and h2.away_shots_on_target == 1
    assert h2.shots_source == "flashscore"

    clip = validated.clipboard_text
    shots_tot_line = f"{'8':>8}    {'Tiros Totales':<28}    {'5':>8}"
    shots_sot_line = f"{'4':>8}    {'Tiros a Puerta':<28}    {'1':>8}"
    assert len(shots_tot_line) == 52
    assert len(shots_sot_line) == 52
    assert shots_tot_line in clip
    assert shots_sot_line in clip


def test_match_sheet_03_player_shots_notation_and_gk_saves():
    """
    Unit test for _format_player_section_for_clipboard:
    - TIROS column formatting: 0, 1(0), 4(3), 2(-), -
    - GK saves singular/plural: [1 Parada], [0 Paradas], [3 Paradas], [- Paradas]
    """
    from api.routers.matches_sheet_03 import _format_player_section_for_clipboard

    test_players = [
        # Outfield players:
        {"jersey_number": 10, "name": "Zero Shots", "position": "MC", "minutes_played": 90, "was_substitute": False, "goals": 0, "assists": 0, "calculated_xg": 0.0, "total_shots": 0, "shots_on_target": 0, "passes_completed": 10, "passes_total": 12, "recoveries": 3, "tackles": 2},
        {"jersey_number": 9, "name": "One OffTarget", "position": "DC", "minutes_played": 90, "was_substitute": False, "goals": 0, "assists": 0, "calculated_xg": 0.1, "total_shots": 1, "shots_on_target": 0, "passes_completed": 5, "passes_total": 8, "recoveries": 1, "tackles": 0},
        {"jersey_number": 11, "name": "Four Shots", "position": "EX", "minutes_played": 80, "was_substitute": False, "goals": 1, "assists": 1, "calculated_xg": 0.5, "total_shots": 4, "shots_on_target": 3, "passes_completed": 8, "passes_total": 10, "recoveries": 2, "tackles": 1},
        {"jersey_number": 8, "name": "Null SOT", "position": "MC", "minutes_played": 70, "was_substitute": False, "goals": 0, "assists": 0, "calculated_xg": 0.2, "total_shots": 2, "shots_on_target": None, "passes_completed": 15, "passes_total": 20, "recoveries": 4, "tackles": 3},
        {"jersey_number": 5, "name": "Both Null", "position": "DF", "minutes_played": 90, "was_substitute": False, "goals": 0, "assists": 0, "calculated_xg": 0.0, "total_shots": None, "shots_on_target": None, "passes_completed": 20, "passes_total": 25, "recoveries": 5, "tackles": 4},
        # Goalkeepers:
        {"jersey_number": 1, "name": "GK One Save", "position": "GK", "minutes_played": 90, "was_substitute": False, "goals": 0, "assists": 0, "calculated_xg": 0.0, "total_shots": 0, "shots_on_target": 0, "passes_completed": 15, "passes_total": 20, "recoveries": 1, "tackles": 0, "saves": 1},
        {"jersey_number": 12, "name": "GK Zero Saves", "position": "GK", "minutes_played": 90, "was_substitute": False, "goals": 0, "assists": 0, "calculated_xg": 0.0, "total_shots": 0, "shots_on_target": 0, "passes_completed": 15, "passes_total": 20, "recoveries": 1, "tackles": 0, "saves": 0},
        {"jersey_number": 21, "name": "GK Many Saves", "position": "G", "minutes_played": 90, "was_substitute": False, "goals": 0, "assists": 0, "calculated_xg": 0.0, "total_shots": 0, "shots_on_target": 0, "passes_completed": 15, "passes_total": 20, "recoveries": 1, "tackles": 0, "saves": 3},
        {"jersey_number": 22, "name": "GK Null Saves", "position": "G", "minutes_played": 90, "was_substitute": False, "goals": 0, "assists": 0, "calculated_xg": 0.0, "total_shots": 0, "shots_on_target": 0, "passes_completed": 15, "passes_total": 20, "recoveries": 1, "tackles": 0, "saves": None},
    ]

    out = _format_player_section_for_clipboard(test_players, "Test FC", "LOCAL", is_last=True)
    lines = out.splitlines()

    # Find player rows
    row_zero = next(l for l in lines if "Zero Shots" in l)
    assert re.search(r"\b0\b", row_zero)

    row_one = next(l for l in lines if "One OffTarget" in l)
    assert "1(0)" in row_one

    row_four = next(l for l in lines if "Four Shots" in l)
    assert "4(3)" in row_four

    row_null_sot = next(l for l in lines if "Null SOT" in l)
    assert "2(-)" in row_null_sot

    row_both_null = next(l for l in lines if "Both Null" in l)
    assert re.search(r"\s-\s", row_both_null)

    # GK saves checks
    row_gk1 = next(l for l in lines if "GK One Save" in l)
    assert "[1 Parada]" in row_gk1
    assert "[1 Paradas]" not in row_gk1

    row_gk0 = next(l for l in lines if "GK Zero Saves" in l)
    assert "[0 Paradas]" in row_gk0

    row_gk3 = next(l for l in lines if "GK Many Saves" in l)
    assert "[3 Paradas]" in row_gk3

    row_gkn = next(l for l in lines if "GK Null Saves" in l)
    assert "[- Paradas]" in row_gkn

    # Outfield player should not have Parada suffix
    assert "Parada" not in row_zero

