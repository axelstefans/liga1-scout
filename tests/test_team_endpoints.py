import time
import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_get_team_metrics_all():
    t0 = time.perf_counter()
    response = client.get("/api/teams/metrics")
    t1 = time.perf_counter()
    latency_ms = (t1 - t0) * 1000

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 18, f"Expected 18 teams, got {len(data)}"
    assert latency_ms < 150.0, f"Query exceeded 150ms: {latency_ms:.2f}ms"

    alianza = next(t for t in data if t["team_id"] == 2311)
    assert alianza["name"] == "Alianza Lima"
    assert alianza["matches_played"] == 27
    assert alianza["points"] == 56
    assert alianza["goals_scored"] == 44
    assert alianza["goals_conceded"] == 18
    assert round(alianza["ppda"], 2) == 8.18
    assert alianza["field_tilt_pct"] > 60.0
    assert alianza["xg"] > 40.0
    assert alianza["defensive_resistance_ratio"] is not None
    assert alianza["conversion_ratio"] is not None

def test_get_team_metrics_tournament_filters():
    # Apertura
    t0 = time.perf_counter()
    resp_ap = client.get("/api/teams/metrics?tournament=Apertura")
    t1 = time.perf_counter()
    assert resp_ap.status_code == 200
    data_ap = resp_ap.json()
    assert len(data_ap) == 18
    assert (t1 - t0) * 1000 < 50.0

    alianza_ap = next(t for t in data_ap if t["team_id"] == 2311)
    assert alianza_ap["matches_played"] == 17
    assert alianza_ap["points"] == 40
    assert alianza_ap["goals_scored"] == 30
    assert alianza_ap["goals_conceded"] == 8

    # Clausura
    t0 = time.perf_counter()
    resp_cl = client.get("/api/teams/metrics?tournament=Clausura")
    t1 = time.perf_counter()
    assert resp_cl.status_code == 200
    data_cl = resp_cl.json()
    assert len(data_cl) == 18
    assert (t1 - t0) * 1000 < 50.0

    alianza_cl = next(t for t in data_cl if t["team_id"] == 2311)
    assert alianza_cl["matches_played"] == 10
    assert alianza_cl["points"] == 16
    assert alianza_cl["goals_scored"] == 14
    assert alianza_cl["goals_conceded"] == 10

def test_get_team_shot_zones():
    t0 = time.perf_counter()
    response = client.get("/api/teams/2311/shot-zones")
    t1 = time.perf_counter()
    latency_ms = (t1 - t0) * 1000

    assert response.status_code == 200
    data = response.json()
    assert latency_ms < 150.0, f"Shot zones exceeded 150ms: {latency_ms:.2f}ms"

    assert data["team_id"] == 2311
    assert data["team_name"] == "Alianza Lima"
    assert data["total_shots_taken"] == 430
    assert data["total_shots_conceded"] == 242
    assert data["grid"]["rows"] == 6
    assert data["grid"]["cols"] == 5
    assert len(data["shots_taken"]) == 30
    assert len(data["shots_conceded"]) == 30

    # Zone 7 (Central box, 6-12m) should be highest volume zone for Alianza Lima
    zone_7 = next(z for z in data["shots_taken"] if z["zone_id"] == 7)
    assert zone_7["row"] == 1
    assert zone_7["col"] == 2
    assert zone_7["count"] > 90
    assert zone_7["goals"] >= 10

def test_api_v1_and_api_prefix_consistency():
    r1 = client.get("/api/teams/metrics")
    r2 = client.get("/api/v1/teams/metrics")
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert len(r1.json()) == len(r2.json())

    z1 = client.get("/api/teams/2311/shot-zones")
    z2 = client.get("/api/v1/teams/2311/shot-zones")
    assert z1.status_code == 200
    assert z2.status_code == 200
    assert z1.json()["total_shots_taken"] == z2.json()["total_shots_taken"]

def test_complete_34_metrics_suite():
    required_34_metrics = [
        # A. Ofensivas / Tiro (10)
        "total_shots",
        "shots_on_target",
        "shots_inside_box",
        "shots_outside_box",
        "goals_scored",
        "xg",
        "npxg",
        "xg_per_shot",
        "goals_minus_xg",
        "conversion_rate_pct",

        # B. Circulación y Progresión (9)
        "possession_pct",
        "passes_completed",
        "pass_accuracy_pct",
        "progressive_passes",
        "passes_into_final_third",
        "passes_into_box",
        "crosses_completed",
        "progressive_carries",
        "successful_dribbles",

        # C. Dominio Territorial y Estilo (3)
        "field_tilt",
        "verticality_ratio_pct",
        "avg_shot_distance",

        # D. Presión y Fase Defensiva (6)
        "ppda",
        "high_recoveries",
        "defensive_actions",
        "tackles",
        "interceptions",
        "clearances",

        # E. Concesión / Rival (6)
        "shots_conceded",
        "shots_on_target_conceded",
        "shots_conceded_inside_box",
        "xga",
        "xgd",
        "defensive_resistance_ratio",
    ]

    assert len(required_34_metrics) == 34, f"Expected exactly 34 metrics, got {len(required_34_metrics)}"

    # Test full season
    t0 = time.perf_counter()
    resp = client.get("/api/teams/metrics")
    latency_ms = (time.perf_counter() - t0) * 1000
    assert resp.status_code == 200
    assert latency_ms < 50.0, f"Query latency {latency_ms:.2f}ms exceeded 50ms"

    teams = resp.json()
    assert len(teams) == 18, f"Expected 18 teams, got {len(teams)}"

    for team in teams:
        for metric in required_34_metrics:
            assert metric in team, f"Missing metric '{metric}' for team {team.get('name')}"
            assert team[metric] is not None, f"Metric '{metric}' is None for team {team.get('name')}"

    # Test tournament filter
    resp_tourn = client.get("/api/teams/metrics?tournament=Clausura")
    assert resp_tourn.status_code == 200
    teams_tourn = resp_tourn.json()
    assert len(teams_tourn) == 18

    for team in teams_tourn:
        for metric in required_34_metrics:
            assert metric in team, f"Missing metric '{metric}' in Clausura for {team.get('name')}"
            assert team[metric] is not None, f"Metric '{metric}' is None in Clausura for {team.get('name')}"

def test_get_team_pass_network():
    # 1. Full Season
    t0 = time.perf_counter()
    resp = client.get("/api/teams/2311/pass-network")
    latency_ms = (time.perf_counter() - t0) * 1000
    assert resp.status_code == 200
    assert latency_ms < 600.0, f"Pass network latency {latency_ms:.2f}ms too high"

    data = resp.json()
    assert data["team_id"] == 2311
    assert data["tournament"] == "all"
    assert len(data["nodes"]) == 11, f"Expected 11 XI Base nodes, got {len(data['nodes'])}"
    assert len(data["edges"]) > 0, "Expected at least 1 edge"

    # Node validation
    for node in data["nodes"]:
        assert "player_id" in node
        assert "name" in node and len(node["name"]) > 0
        assert "jersey" in node
        assert 0.0 <= node["x"] <= 100.0
        assert 0.0 <= node["y"] <= 100.0
        assert node["total_passes"] > 0

    # Edge validation
    node_ids = set(n["player_id"] for n in data["nodes"])
    for edge in data["edges"]:
        assert edge["passer_id"] in node_ids
        assert edge["receiver_id"] in node_ids
        assert edge["passer_id"] != edge["receiver_id"]
        assert edge["pass_count"] >= 1

    # 2. Tournament filter (Apertura)
    resp_ap = client.get("/api/teams/2311/pass-network?tournament=Apertura")
    assert resp_ap.status_code == 200
    data_ap = resp_ap.json()
    assert data_ap["tournament"] == "Apertura"
    assert len(data_ap["nodes"]) == 11
    assert len(data_ap["edges"]) > 0

    # 3. Specifically test Cusco FC (team_id 63760): Carlos Gamarra NOT in XI for 'all', Ampuero IS present
    resp_cusco = client.get("/api/teams/63760/pass-network?tournament=all")
    assert resp_cusco.status_code == 200
    cusco_data = resp_cusco.json()
    assert len(cusco_data["nodes"]) == 11, f"Expected exactly 11 nodes for Cusco FC, got {len(cusco_data['nodes'])}"
    cusco_names = [n["name"] for n in cusco_data["nodes"]]
    assert any("Ampuero" in n for n in cusco_names), f"Alvaro Ampuero should be in starting XI: {cusco_names}"
    assert not any("Gamarra" in n for n in cusco_names), f"Carlos Gamarra should NOT be in starting XI for 'all': {cusco_names}"

    # 4. Strict check across all 18 teams and scopes ('all', 'Apertura', 'Clausura')
    resp_teams = client.get("/api/teams/")
    assert resp_teams.status_code == 200
    all_teams = resp_teams.json()
    assert len(all_teams) == 18

    for t in all_teams:
        tid = t["team_id"]
        for scope in ["all", "Apertura", "Clausura"]:
            r = client.get(f"/api/teams/{tid}/pass-network?tournament={scope}")
            assert r.status_code == 200
            pn = r.json()
            assert len(pn["nodes"]) == 11, f"Team {t['name']} ({tid}) in scope '{scope}' returned {len(pn['nodes'])} nodes instead of 11"
            # Ensure edges only connect nodes within the 11
            pn_node_ids = set(n["player_id"] for n in pn["nodes"])
            for e in pn["edges"]:
                assert e["passer_id"] in pn_node_ids, f"Edge passer {e['passer_id']} outside XI"
                assert e["receiver_id"] in pn_node_ids, f"Edge receiver {e['receiver_id']} outside XI"

    # 5. Non-existent team should return 404
    resp_404 = client.get("/api/teams/9999999/pass-network")
    assert resp_404.status_code == 404

def test_get_team_matches():
    # 1. Full matches list for Alianza Lima (2311)
    resp = client.get("/api/teams/2311/matches")
    assert resp.status_code == 200
    matches = resp.json()
    assert len(matches) > 0
    assert len(matches) == 27, f"Expected 27 played matches, got {len(matches)}"

    # Validate schema of match items
    first = matches[0]
    for key in [
        "match_id", "round", "tournament", "date", "opponent_id",
        "opponent_name", "opponent_tricode", "is_home", "team_score",
        "opponent_score", "label"
    ]:
        assert key in first, f"Missing key '{key}' in match item"

    assert len(first["opponent_tricode"]) == 3
    assert first["opponent_tricode"].isupper()
    assert first["date"] and len(first["date"]) == 10
    assert first["label"].startswith("F") or "vs" in first["label"]

    # 2. Tournament filter (Apertura)
    resp_ap = client.get("/api/teams/2311/matches?tournament=Apertura")
    assert resp_ap.status_code == 200
    matches_ap = resp_ap.json()
    assert len(matches_ap) > 0
    assert all(m["tournament"] == "Apertura" for m in matches_ap)

    # 3. Tournament filter (Clausura)
    resp_cl = client.get("/api/teams/2311/matches?tournament=Clausura")
    assert resp_cl.status_code == 200
    matches_cl = resp_cl.json()
    assert len(matches_cl) > 0
    assert all(m["tournament"] == "Clausura" for m in matches_cl)
    assert len(matches_ap) + len(matches_cl) == len(matches)

    # 4. Non-existent team
    resp_404 = client.get("/api/teams/9999999/matches")
    assert resp_404.status_code == 404

def test_get_team_pass_network_single_match():
    # 1. Fetch real match for Alianza Lima
    resp_m = client.get("/api/teams/2311/matches?tournament=Clausura")
    assert resp_m.status_code == 200
    matches = resp_m.json()
    assert len(matches) > 0
    target_match = matches[0]
    match_id = target_match["match_id"]

    # 2. Query single-match pass network
    resp = client.get(f"/api/teams/2311/pass-network?match_id={match_id}")
    assert resp.status_code == 200
    data = resp.json()

    assert data["team_id"] == 2311
    assert data["match_id"] == match_id
    assert data["tournament"] == target_match["tournament"]

    # Assert exactly 11 nodes corresponding to the starters of that fixture
    assert len(data["nodes"]) == 11, f"Expected 11 starters, got {len(data['nodes'])}"
    for node in data["nodes"]:
        assert "player_id" in node
        assert "name" in node and len(node["name"]) > 0
        assert 0.0 <= node["x"] <= 100.0
        assert 0.0 <= node["y"] <= 100.0

    # Assert edges connect valid starting XI player IDs
    node_ids = set(n["player_id"] for n in data["nodes"])
    assert len(data["edges"]) > 0
    for edge in data["edges"]:
        assert edge["passer_id"] in node_ids
        assert edge["receiver_id"] in node_ids
        assert edge["passer_id"] != edge["receiver_id"]
        assert edge["pass_count"] >= 1

    # 3. Non-existent match_id returns 404
    resp_bad = client.get("/api/teams/2311/pass-network?match_id=999999999")
    assert resp_bad.status_code == 404

def test_get_team_defensive_actions_repo():
    import sqlite3
    from api.core.config import settings
    from api.repositories import team_repo

    with sqlite3.connect(f"file:{settings.DB_PATH}?mode=ro", uri=True) as db:
        db.row_factory = sqlite3.Row

        # 1. Cumulative tournament scope ('all')
        res = team_repo.get_team_defensive_actions(db, team_id=2311, tournament="all")
        assert res is not None
        assert res["team_id"] == 2311
        assert res["tournament"] == "all"
        assert res["match_id"] is None
        assert len(res["events"]) > 0

        # Validate summary fields
        summary = res["summary"]
        assert summary["total_events"] == len(res["events"])
        assert "won_tackles" in summary
        assert "lost_tackles" in summary
        assert "interceptions" in summary
        assert "clearances" in summary
        assert "blocked_passes" in summary
        assert "recoveries" in summary
        assert "high_recoveries" in summary
        assert "tackles_won_pct" in summary

        # Opta Line of Engagement / Block Height calculation:
        # Exclude clearances and passive GK recoveries (x <= 6.0)
        valid_opta_types = (
            "won_tackle", "lost_tackle", "interception", "clearance",
            "blocked_pass", "recovery", "foul"
        )
        for ev in res["events"][:30]:
            assert "event_id" in ev
            assert ev["type"] in valid_opta_types
            assert 0.0 <= ev["x"] <= 100.0
            assert 0.0 <= ev["y"] <= 100.0
            assert isinstance(ev["is_success"], bool)
            assert ev["player_name"] and len(ev["player_name"]) > 0
            if ev["jersey"] is not None:
                assert isinstance(ev["jersey"], int)

        assert 0.0 <= res["avg_x"] <= 100.0
        assert res["block_height_m"] == round((res["avg_x"] / 100.0) * 105.0, 1)

        # Tactical classification check (Opta thresholds: 46% and 38%)
        if res["avg_x"] >= 46.0:
            assert res["block_classification"] == "Presión Alta / Bloque Alto"
        elif res["avg_x"] >= 38.0:
            assert res["block_classification"] == "Bloque Medio"
        else:
            assert res["block_classification"] == "Bloque Bajo / Repliegue"

        # Validate summary counts
        total_tackles = summary["won_tackles"] + summary["lost_tackles"]
        if total_tackles > 0:
            expected_pct = round((summary["won_tackles"] / total_tackles) * 100.0, 1)
            assert summary["tackles_won_pct"] == expected_pct

        expected_interceptions = sum(1 for e in res["events"] if e["type"] == "interception")
        assert summary["interceptions"] == expected_interceptions

        expected_high_rec = sum(1 for e in res["events"] if e["type"] == "recovery" and e["x"] > 65.0)
        assert summary["high_recoveries"] == expected_high_rec

        # 2. Tournament filter ('Apertura' and 'Clausura')
        res_ap = team_repo.get_team_defensive_actions(db, team_id=2311, tournament="Apertura")
        assert res_ap is not None
        assert res_ap["tournament"] == "Apertura"
        assert len(res_ap["events"]) > 0

        res_cl = team_repo.get_team_defensive_actions(db, team_id=2311, tournament="Clausura")
        assert res_cl is not None
        assert res_cl["tournament"] == "Clausura"
        assert len(res_cl["events"]) > 0

        # Sum of events in Apertura + Clausura should equal total cumulative events
        assert len(res_ap["events"]) + len(res_cl["events"]) == len(res["events"])

        # 3. Match-specific defensive actions
        # Pick first match
        matches = team_repo.get_team_matches(db, 2311)
        assert matches and len(matches) > 0
        match_id = matches[0]["match_id"]

        res_match = team_repo.get_team_defensive_actions(db, team_id=2311, match_id=match_id)
        assert res_match is not None
        assert res_match["team_id"] == 2311
        assert res_match["match_id"] == match_id
        assert len(res_match["events"]) > 0
        assert res_match["summary"]["total_events"] == len(res_match["events"])

        # 4. Standalone signature without explicit db argument: get_team_defensive_actions(team_id, ...)
        res_standalone = team_repo.get_team_defensive_actions(2311, tournament="Apertura")
        assert res_standalone is not None
        assert res_standalone["team_id"] == 2311
        assert res_standalone["tournament"] == "Apertura"
        assert len(res_standalone["events"]) == len(res_ap["events"])

        # 5. Non-existent team returns None
        assert team_repo.get_team_defensive_actions(db, 99999999) is None
        assert team_repo.get_team_defensive_actions(99999999) is None

def test_get_team_defensive_actions_endpoint():
    # 1. Cumulative scope (default / all)
    resp = client.get("/api/teams/2311/defensive-actions")
    assert resp.status_code == 200
    data = resp.json()

    assert data["team_id"] == 2311
    assert data["tournament"] == "all"
    assert data["match_id"] is None
    assert isinstance(data["block_height_pct"], float)
    assert isinstance(data["block_height_m"], float)
    assert data["block_classification"] in (
        "Presión Alta / Bloque Alto", "Bloque Medio", "Bloque Bajo / Repliegue"
    )
    assert "summary" in data
    summary = data["summary"]
    for key in (
        "total_events", "won_tackles", "lost_tackles", "interceptions",
        "clearances", "blocked_passes", "recoveries", "high_recoveries", "tackles_won_pct"
    ):
        assert key in summary

    assert len(data["events"]) > 0
    first_ev = data["events"][0]
    for key in ("event_id", "type", "x", "y", "is_success", "player_name"):
        assert key in first_ev
    valid_opta_types = (
        "won_tackle", "lost_tackle", "interception", "clearance",
        "blocked_pass", "recovery", "foul"
    )
    assert first_ev["type"] in valid_opta_types
    assert 0.0 <= first_ev["x"] <= 100.0
    assert 0.0 <= first_ev["y"] <= 100.0
    assert 0.0 <= first_ev["x"] <= 100.0
    assert 0.0 <= first_ev["y"] <= 100.0

    # Test /api/v1 prefix parity
    resp_v1 = client.get("/api/v1/teams/2311/defensive-actions")
    assert resp_v1.status_code == 200
    assert resp_v1.json()["summary"]["total_events"] == data["summary"]["total_events"]
    assert len(resp_v1.json()["events"]) == len(data["events"])

    # 2. Tournament filter (Apertura)
    resp_ap = client.get("/api/teams/2311/defensive-actions?tournament=Apertura")
    assert resp_ap.status_code == 200
    data_ap = resp_ap.json()
    assert data_ap["tournament"] == "Apertura"
    assert len(data_ap["events"]) > 0

    # 3. Tournament filter (Clausura)
    resp_cl = client.get("/api/teams/2311/defensive-actions?tournament=Clausura")
    assert resp_cl.status_code == 200
    data_cl = resp_cl.json()
    assert data_cl["tournament"] == "Clausura"
    assert len(data_cl["events"]) > 0
    assert len(data_ap["events"]) + len(data_cl["events"]) == len(data["events"])

    # 4. Single match with match_id
    matches_resp = client.get("/api/teams/2311/matches")
    assert matches_resp.status_code == 200
    matches = matches_resp.json()
    assert len(matches) > 0
    target_match_id = matches[0]["match_id"]

    resp_match = client.get(f"/api/teams/2311/defensive-actions?match_id={target_match_id}")
    assert resp_match.status_code == 200
    data_match = resp_match.json()
    assert data_match["team_id"] == 2311
    assert data_match["match_id"] == target_match_id
    assert len(data_match["events"]) > 0
    assert data_match["summary"]["total_events"] == len(data_match["events"])

    # 5. Error handling (HTTP 404)
    # Invalid team_id
    resp_bad_team = client.get("/api/teams/9999999/defensive-actions")
    assert resp_bad_team.status_code == 404

    # Mismatching or non-existent match_id
    resp_bad_match = client.get("/api/teams/2311/defensive-actions?match_id=999999999")
    assert resp_bad_match.status_code == 404

def test_get_team_shot_map_repo():
    import sqlite3
    from api.core.config import settings
    from api.repositories import team_repo

    with sqlite3.connect(f"file:{settings.DB_PATH}?mode=ro", uri=True) as db:
        db.row_factory = sqlite3.Row

        # 1. Mode 'for' (shots taken by team)
        res_for = team_repo.get_team_shot_map(db, team_id=2311, tournament="all", mode="for")
        assert res_for is not None
        assert res_for["team_id"] == 2311
        assert res_for["mode"] == "for"
        assert res_for["tournament"] == "all"
        assert res_for["match_id"] is None
        assert len(res_for["shots"]) > 0

        # Validate summary metrics
        summary_for = res_for["summary"]
        assert summary_for["total_shots"] == len(res_for["shots"])
        assert summary_for["goals"] == sum(1 for s in res_for["shots"] if s["result"] == "goal")
        assert summary_for["total_xg"] == round(sum(s["xg"] for s in res_for["shots"]), 2)
        assert summary_for["xg_per_shot"] == round(summary_for["total_xg"] / summary_for["total_shots"], 3)
        expected_sot = sum(1 for s in res_for["shots"] if s["result"] in ("goal", "saved"))
        assert summary_for["shots_on_target"] == expected_sot
        assert summary_for["on_target_pct"] == round((expected_sot / summary_for["total_shots"]) * 100.0, 1)
        assert summary_for["xg_difference"] == round(summary_for["goals"] - summary_for["total_xg"], 2)

        # Validate shot event fields & normalization
        for s in res_for["shots"][:30]:
            assert isinstance(s["shot_id"], int)
            assert s["minute"] is None
            assert 0.0 <= s["x"] <= 100.0
            assert 0.0 <= s["y"] <= 100.0
            assert isinstance(s["xg"], float)
            assert s["result"] in ("goal", "saved", "miss", "blocked")
            assert s["body_part"] in ("right_foot", "left_foot", "head", "other")
            assert s["situation"] in ("open_play", "set_piece", "corner", "penalty", "fast_break")
            assert s["player_name"] and len(s["player_name"]) > 0
            if s["player_jersey"] is not None:
                assert isinstance(s["player_jersey"], int)

        # 2. Mode 'against' (shots conceded by team)
        res_against = team_repo.get_team_shot_map(db, team_id=2311, tournament="all", mode="against")
        assert res_against is not None
        assert res_against["team_id"] == 2311
        assert res_against["mode"] == "against"
        assert len(res_against["shots"]) > 0
        assert res_against["summary"]["total_shots"] == len(res_against["shots"])

        # 3. Tournament filtering ('Apertura' and 'Clausura')
        res_ap = team_repo.get_team_shot_map(db, team_id=2311, tournament="Apertura", mode="for")
        assert res_ap is not None
        assert res_ap["tournament"] == "Apertura"
        assert len(res_ap["shots"]) > 0

        res_cl = team_repo.get_team_shot_map(db, team_id=2311, tournament="Clausura", mode="for")
        assert res_cl is not None
        assert res_cl["tournament"] == "Clausura"
        assert len(res_cl["shots"]) > 0
        assert len(res_ap["shots"]) + len(res_cl["shots"]) == len(res_for["shots"])

        # 4. Single match filtering with match_id
        matches = team_repo.get_team_matches(db, 2311)
        assert matches and len(matches) > 0
        target_match_id = matches[0]["match_id"]

        res_match = team_repo.get_team_shot_map(db, team_id=2311, match_id=target_match_id, mode="for")
        assert res_match is not None
        assert res_match["team_id"] == 2311
        assert res_match["match_id"] == target_match_id
        assert len(res_match["shots"]) > 0
        assert res_match["summary"]["total_shots"] == len(res_match["shots"])

        # 5. Dual signature support (without explicit db connection passed)
        res_standalone = team_repo.get_team_shot_map(2311, tournament="Apertura", mode="for")
        assert res_standalone is not None
        assert res_standalone["team_id"] == 2311
        assert len(res_standalone["shots"]) == len(res_ap["shots"])

        # 6. Non-existent team returns None
        assert team_repo.get_team_shot_map(db, 9999999) is None
        assert team_repo.get_team_shot_map(9999999) is None

def test_get_team_shot_map_endpoint():
    # 1. Cumulative scope (default / all, mode='for')
    resp = client.get("/api/teams/2311/shot-map")
    assert resp.status_code == 200
    data = resp.json()

    assert data["team_id"] == 2311
    assert data["mode"] == "for"
    assert data["tournament"] == "all"
    assert data["match_id"] is None

    # Validate summary fields
    summary = data["summary"]
    for key in (
        "total_shots", "goals", "total_xg", "xg_per_shot",
        "shots_on_target", "on_target_pct", "xg_difference"
    ):
        assert key in summary

    assert len(data["shots"]) > 0
    first_shot = data["shots"][0]
    for key in (
        "shot_id", "minute", "x", "y", "xg", "result",
        "body_part", "situation", "player_name", "player_jersey"
    ):
        assert key in first_shot

    assert first_shot["result"] in ("goal", "saved", "miss", "blocked")
    assert 0.0 <= first_shot["x"] <= 100.0
    assert 0.0 <= first_shot["y"] <= 100.0

    # Test /api/v1 prefix parity
    resp_v1 = client.get("/api/v1/teams/2311/shot-map")
    assert resp_v1.status_code == 200
    assert resp_v1.json()["summary"]["total_shots"] == data["summary"]["total_shots"]
    assert len(resp_v1.json()["shots"]) == len(data["shots"])

    # 2. Mode 'against' (shots conceded)
    resp_against = client.get("/api/teams/2311/shot-map?mode=against")
    assert resp_against.status_code == 200
    data_against = resp_against.json()
    assert data_against["team_id"] == 2311
    assert data_against["mode"] == "against"
    assert len(data_against["shots"]) > 0
    assert data_against["summary"]["total_shots"] == len(data_against["shots"])

    # 3. Tournament filtering (Apertura / Clausura)
    resp_ap = client.get("/api/teams/2311/shot-map?tournament=Apertura")
    assert resp_ap.status_code == 200
    data_ap = resp_ap.json()
    assert data_ap["tournament"] == "Apertura"
    assert len(data_ap["shots"]) > 0

    resp_cl = client.get("/api/teams/2311/shot-map?tournament=Clausura")
    assert resp_cl.status_code == 200
    data_cl = resp_cl.json()
    assert data_cl["tournament"] == "Clausura"
    assert len(data_cl["shots"]) > 0

    assert len(data_ap["shots"]) + len(data_cl["shots"]) == len(data["shots"])

    # 4. Single match with match_id
    matches_resp = client.get("/api/teams/2311/matches")
    assert matches_resp.status_code == 200
    matches = matches_resp.json()
    assert len(matches) > 0
    target_match_id = matches[0]["match_id"]

    resp_match = client.get(f"/api/teams/2311/shot-map?match_id={target_match_id}")
    assert resp_match.status_code == 200
    data_match = resp_match.json()
    assert data_match["team_id"] == 2311
    assert data_match["match_id"] == target_match_id
    assert len(data_match["shots"]) > 0
    assert data_match["summary"]["total_shots"] == len(data_match["shots"])

    # 5. Error handling
    # Non-existent team -> 404
    resp_bad_team = client.get("/api/teams/9999999/shot-map")
    assert resp_bad_team.status_code == 404

    # Non-existent match -> 404
    resp_bad_match = client.get("/api/teams/2311/shot-map?match_id=999999999")
    assert resp_bad_match.status_code == 404

    # Invalid mode regex validation -> 422
    resp_bad_mode = client.get("/api/teams/2311/shot-map?mode=invalid")
    assert resp_bad_mode.status_code == 422

if __name__ == "__main__":
    pytest.main([__file__, "-v"])




