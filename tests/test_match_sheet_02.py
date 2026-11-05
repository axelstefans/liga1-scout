"""
Unit and integration tests for Match Report Sheet 02 / 04
('Build-up and penalty-area access' / 'Passing Shape & KPIs').
"""

import os
import sys
import sqlite3
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.main import app
from api.routers.matches import _build_sheet_02_buildup
from api.schemas.match import MatchSheet02Response

client = TestClient(app)


def test_match_sheet_02_real_match_16280844():
    """
    Integration test against liga1.db for match 16280844 (UTC vs Melgar).
    Validates metadata, 4 KPIs, and 16-sector polar passing shapes.
    """
    db_path = "liga1.db"
    if not os.path.exists(db_path):
        pytest.skip("liga1.db not available in test environment")

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row

    data = _build_sheet_02_buildup(conn, match_id=16280844)
    conn.close()

    # Validate against Pydantic schema
    validated = MatchSheet02Response(**data)
    assert validated.match_id == 16280844

    # 1. Metadata
    meta = data["metadata"]
    assert meta["match_id"] == 16280844
    assert meta["tournament"] == "Clausura"
    assert meta["round"] == 13
    assert "2026-10-23" in meta["match_date"]
    assert "Cajamarca" in meta["home_team"]["name"]
    assert meta["home_team"]["score"] == 1
    assert "Melgar" in meta["away_team"]["name"]
    assert meta["away_team"]["score"] == 2

    # 2. KPIs
    kpis = data["kpis"]
    assert kpis["field_tilt"]["home"] == 62.8
    assert kpis["field_tilt"]["away"] == 37.2
    assert kpis["progressive_passes"]["home"] == 56
    assert kpis["progressive_passes"]["away"] == 45
    assert kpis["line_breaking_passes"]["home"] == 27
    assert kpis["line_breaking_passes"]["away"] == 13
    assert kpis["box_entries"]["home"] == 19
    assert kpis["box_entries"]["away"] == 13

    # 3. Module 01 (Home Passing Shape - UTC)
    m01 = data["module_01_home_passing_shape"]
    assert m01["is_home"] is True
    assert m01["summary"]["total_passes"] == 466
    assert m01["summary"]["forward_pct"] == 66.5
    assert m01["summary"]["completed_pct"] == 78.8

    assert len(m01["sectors"]) == 16
    sec_0_home = m01["sectors"][0]
    assert sec_0_home["angle_deg"] == 0.0
    assert sec_0_home["pass_count"] == 34
    assert sec_0_home["completion_pct"] == 67.6
    assert sec_0_home["median_distance_m"] == 18.6

    sec_4_home = m01["sectors"][4]
    assert sec_4_home["angle_deg"] == 90.0
    assert sec_4_home["pass_count"] == 41

    # 4. Module 02 (Away Passing Shape - Melgar)
    m02 = data["module_02_away_passing_shape"]
    assert m02["is_home"] is False
    assert m02["summary"]["total_passes"] == 407
    assert m02["summary"]["forward_pct"] == 63.4
    assert m02["summary"]["completed_pct"] == 82.6

    assert len(m02["sectors"]) == 16
    sec_0_away = m02["sectors"][0]
    assert sec_0_away["angle_deg"] == 0.0
    assert sec_0_away["pass_count"] == 24
    assert sec_0_away["completion_pct"] == 62.5
    assert sec_0_away["median_distance_m"] == 19.6

    # 5. Module 03 (Home Box Entries - UTC)
    m03 = data["module_03_home_box_entries"]
    assert m03["is_home"] is True
    assert m03["total_entries"] == 19
    assert len(m03["entries"]) == 19
    passes_h = sum(1 for e in m03["entries"] if e["entry_type"] == "pass")
    crosses_h = sum(1 for e in m03["entries"] if e["entry_type"] == "cross")
    carries_h = sum(1 for e in m03["entries"] if e["entry_type"] == "carry")
    assert passes_h == 11
    assert crosses_h == 2
    assert carries_h == 6
    assert m03["density"] is not None
    assert len(m03["density"]["contours"]) == 3
    assert [c["level"] for c in m03["density"]["contours"]] == [0.25, 0.50, 0.75]
    for c in m03["density"]["contours"]:
        assert isinstance(c["svg_path"], str) and len(c["svg_path"]) > 0

    # 6. Module 04 (Away Box Entries - Melgar)
    m04 = data["module_04_away_box_entries"]
    assert m04["is_home"] is False
    assert m04["total_entries"] == 13
    assert len(m04["entries"]) == 13
    passes_a = sum(1 for e in m04["entries"] if e["entry_type"] == "pass")
    crosses_a = sum(1 for e in m04["entries"] if e["entry_type"] == "cross")
    carries_a = sum(1 for e in m04["entries"] if e["entry_type"] == "carry")
    assert passes_a == 2
    assert crosses_a == 6
    assert carries_a == 5
    assert m04["density"] is not None
    assert len(m04["density"]["contours"]) == 3
    assert [c["level"] for c in m04["density"]["contours"]] == [0.25, 0.50, 0.75]
    for c in m04["density"]["contours"]:
        assert isinstance(c["svg_path"], str) and len(c["svg_path"]) > 0

    # 7. Module 05 (Nested Possession Stages)
    m05 = data["module_05_nested_possession_stages"]
    assert len(m05["stages"]) == 5
    assert m05["max_val"] == 159

    stages_by_key = {s["key"]: s for s in m05["stages"]}
    assert set(stages_by_key.keys()) == {"possessions", "reached_third", "then_box", "then_shot", "on_target"}

    # Home stages (UTC)
    s_pos_h = stages_by_key["possessions"]["home_val"]
    s_third_h = stages_by_key["reached_third"]["home_val"]
    s_box_h = stages_by_key["then_box"]["home_val"]
    s_shot_h = stages_by_key["then_shot"]["home_val"]
    s_tgt_h = stages_by_key["on_target"]["home_val"]

    assert s_pos_h == 158
    assert s_third_h == 66
    assert s_box_h == 19
    assert s_shot_h in (5, 6)
    assert s_tgt_h == 3
    assert s_pos_h >= s_third_h >= s_box_h >= s_shot_h >= s_tgt_h

    # Away stages (Melgar)
    s_pos_a = stages_by_key["possessions"]["away_val"]
    s_third_a = stages_by_key["reached_third"]["away_val"]
    s_box_a = stages_by_key["then_box"]["away_val"]
    s_shot_a = stages_by_key["then_shot"]["away_val"]
    s_tgt_a = stages_by_key["on_target"]["away_val"]

    assert s_pos_a == 159
    assert s_third_a == 42
    assert s_box_a == 13
    assert s_shot_a == 3
    assert s_tgt_a == 2
    assert s_pos_a >= s_third_a >= s_box_a >= s_shot_a >= s_tgt_a

    # 8. Module 06 (Entry Origin Lane)
    m06 = data["module_06_entry_origin_lane"]
    assert len(m06["lanes"]) == 3
    assert m06["max_val"] == 11

    lanes_by_key = {lane["key"]: lane for lane in m06["lanes"]}
    assert set(lanes_by_key.keys()) == {"left", "centre", "right"}

    assert lanes_by_key["left"]["home_val"] == 3
    assert lanes_by_key["centre"]["home_val"] == 5
    assert lanes_by_key["right"]["home_val"] == 11
    assert (
        lanes_by_key["left"]["home_val"]
        + lanes_by_key["centre"]["home_val"]
        + lanes_by_key["right"]["home_val"]
    ) == m03["total_entries"]

    assert lanes_by_key["left"]["away_val"] == 8
    assert lanes_by_key["centre"]["away_val"] == 3
    assert lanes_by_key["right"]["away_val"] == 2
    assert (
        lanes_by_key["left"]["away_val"]
        + lanes_by_key["centre"]["away_val"]
        + lanes_by_key["right"]["away_val"]
    ) == m04["total_entries"]


def test_match_sheet_02_endpoint_api():
    """
    Test FastAPI client calling /api/matches/{match_id}/sheet-02 and /sheet-02-buildup.
    """
    response = client.get("/api/matches/16280844/sheet-02")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["match_id"] == 16280844
    assert "kpis" in json_data
    assert "module_01_home_passing_shape" in json_data
    assert "module_02_away_passing_shape" in json_data
    assert "module_03_home_box_entries" in json_data
    assert "module_04_away_box_entries" in json_data
    assert len(json_data["module_03_home_box_entries"]["entries"]) == 19
    assert len(json_data["module_04_away_box_entries"]["entries"]) == 13
    assert json_data["module_03_home_box_entries"]["density"]["contours"] is not None
    assert len(json_data["module_03_home_box_entries"]["density"]["contours"]) == 3
    assert "module_05_nested_possession_stages" in json_data
    assert len(json_data["module_05_nested_possession_stages"]["stages"]) == 5
    assert "module_06_entry_origin_lane" in json_data
    assert len(json_data["module_06_entry_origin_lane"]["lanes"]) == 3

    # Alias endpoint
    alias_res = client.get("/api/matches/16280844/sheet-02-buildup")
    assert alias_res.status_code == 200
    assert alias_res.json()["match_id"] == 16280844


def test_match_sheet_02_404_not_found():
    """
    Verify 404 is returned when requesting a non-existent match ID.
    """
    response = client.get("/api/matches/999999999/sheet-02")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_match_sheet_02_synthetic_in_memory():
    """
    Verify calculations and 16-sector binning in an isolated in-memory SQLite database.
    """
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
            tournament TEXT,
            final_third_passes_for INTEGER,
            progressive_passes INTEGER,
            passes_into_box INTEGER,
            progressive_carries INTEGER
        );

        CREATE TABLE player_passes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            player_id INTEGER,
            x_start REAL,
            y_start REAL,
            x_end REAL,
            y_end REAL,
            is_successful BOOLEAN,
            created_at TEXT
        );

        CREATE TABLE player_ball_carries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            player_id INTEGER,
            x_start REAL,
            y_start REAL,
            x_end REAL,
            y_end REAL,
            is_home BOOLEAN
        );

        INSERT INTO teams VALUES (10, 'Team Alpha', 'ALP', 'http://logo1', '#111111');
        INSERT INTO teams VALUES (20, 'Team Beta', 'BET', 'http://logo2', '#222222');
        INSERT INTO matches VALUES (5001, 10, 20, '2026-10-30T20:00:00', 5, 2, 1, 'played', 1);

        INSERT INTO player_match_stats VALUES (5001, 101, 10, 90);
        INSERT INTO player_match_stats VALUES (5001, 201, 20, 90);

        -- Pass 1: Forward line-breaking & progressive pass (x: 50 -> 75, y: 50 -> 50) => dx=25, dy=0 => angle 0 deg
        INSERT INTO player_passes VALUES (1, 5001, 101, 50.0, 50.0, 75.0, 50.0, 1, 'now');
        -- Pass 2: Lateral left pass (x: 50 -> 50, y: 50 -> 30) => dx=0, dy_sofa=-20 => dy_math=+20 => angle 90 deg
        INSERT INTO player_passes VALUES (2, 5001, 101, 50.0, 50.0, 50.0, 30.0, 1, 'now');
        -- Pass 3: Backward pass (x: 50 -> 30, y: 50 -> 50) => dx=-20, dy=0 => angle 180 deg
        INSERT INTO player_passes VALUES (3, 5001, 101, 50.0, 50.0, 30.0, 50.0, 0, 'now');
        -- Pass 4: Box entry pass (x: 70 -> 88, y: 50 -> 50) => dx=18, dy=0 => angle 0 deg
        INSERT INTO player_passes VALUES (4, 5001, 101, 70.0, 50.0, 88.0, 50.0, 1, 'now');

        -- Carry into box for team 10
        INSERT INTO player_ball_carries VALUES (1, 5001, 101, 75.0, 50.0, 85.0, 50.0, 1);
        """
    )
    conn.commit()

    data = _build_sheet_02_buildup(conn, match_id=5001)
    conn.close()

    # Verify Pydantic
    res = MatchSheet02Response(**data)
    assert res.match_id == 5001

    # KPIs
    kpis = data["kpis"]
    # 2 passes in final third (Pass 1 ends at 75, Pass 4 ends at 88), 0 for away
    assert kpis["field_tilt"]["home"] == 100.0
    assert kpis["field_tilt"]["away"] == 0.0

    # Line breaking: Pass 1 (start 50 <= 60, end 75 >= 65, dx 25 >= 15, succ 1)
    assert kpis["line_breaking_passes"]["home"] == 1
    assert kpis["line_breaking_passes"]["away"] == 0

    # Box entries: Pass 4 (start 70, end 88, y 50) + Carry 1 (start 75, end 85, y 50) = 2 entries
    assert kpis["box_entries"]["home"] == 2
    assert kpis["box_entries"]["away"] == 0

    # Module 01 Polar Rose
    m01 = data["module_01_home_passing_shape"]
    assert m01["summary"]["total_passes"] == 4
    assert m01["summary"]["completed_pct"] == 75.0  # 3 of 4 successful
    assert m01["summary"]["forward_pct"] == 50.0    # 2 forward (Pass 1, Pass 4)

    # 16 sectors
    assert len(m01["sectors"]) == 16
    # Sector 0 (0 deg): Pass 1 and Pass 4
    sec_0 = m01["sectors"][0]
    assert sec_0["angle_deg"] == 0.0
    assert sec_0["pass_count"] == 2
    assert sec_0["completion_pct"] == 100.0

    # Sector 4 (90 deg): Pass 2
    sec_4 = m01["sectors"][4]
    assert sec_4["angle_deg"] == 90.0
    assert sec_4["pass_count"] == 1

    # Sector 8 (180 deg): Pass 3 (unsuccessful)
    sec_8 = m01["sectors"][8]
    assert sec_8["angle_deg"] == 180.0
    assert sec_8["pass_count"] == 1
    assert sec_8["completion_pct"] == 0.0

    # Modules 03 & 04 Box entries
    m03_syn = data["module_03_home_box_entries"]
    assert m03_syn["total_entries"] == 2
    assert len(m03_syn["entries"]) == 2
    m04_syn = data["module_04_away_box_entries"]
    assert m04_syn["total_entries"] == 0
    assert len(m04_syn["entries"]) == 0

    # Module 05 Nested Possession Stages (clamped monotonic)
    m05_syn = data["module_05_nested_possession_stages"]
    assert len(m05_syn["stages"]) == 5
    syn_stages = {s["key"]: s for s in m05_syn["stages"]}
    assert syn_stages["possessions"]["home_val"] == 2
    assert syn_stages["reached_third"]["home_val"] == 2
    assert syn_stages["then_box"]["home_val"] == 2
    assert syn_stages["then_shot"]["home_val"] == 0
    assert syn_stages["on_target"]["home_val"] == 0
    assert syn_stages["possessions"]["away_val"] == 0
    assert syn_stages["reached_third"]["away_val"] == 0
    assert syn_stages["then_box"]["away_val"] == 0

    # Module 06 Entry Origin Lane
    m06_syn = data["module_06_entry_origin_lane"]
    assert len(m06_syn["lanes"]) == 3
    syn_lanes = {l["key"]: l for l in m06_syn["lanes"]}
    assert syn_lanes["left"]["home_val"] == 0
    assert syn_lanes["centre"]["home_val"] == 2
    assert syn_lanes["right"]["home_val"] == 0
    assert syn_lanes["left"]["away_val"] == 0
    assert syn_lanes["centre"]["away_val"] == 0
    assert syn_lanes["right"]["away_val"] == 0
