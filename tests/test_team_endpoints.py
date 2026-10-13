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
    assert "progressive_passes" in alianza
    assert "set_piece_xg" in alianza
    assert alianza["set_piece_xg"] > 0.0
    assert "set_piece_xg_p90" in alianza
    assert "progressive_passes_p90" in alianza

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


def test_get_team_attack_zones_repo():
    import sqlite3
    from api.core.config import settings
    from api.repositories import team_repo

    with sqlite3.connect(f"file:{settings.DB_PATH}?mode=ro", uri=True) as db:
        db.row_factory = sqlite3.Row

        # 1. Mode 'for' (actions performed by team_id)
        res_for = team_repo.get_team_attack_zones(db, team_id=2311, tournament="all", mode="for")
        assert res_for is not None
        assert res_for["team_id"] == 2311
        assert res_for["mode"] == "for"
        assert res_for["tournament"] == "all"
        assert res_for["match_id"] is None
        assert len(res_for["channels"]) == 5

        channel_ids = [c["channel_id"] for c in res_for["channels"]]
        expected_channels = ["left_flank", "left_half_space", "center", "right_half_space", "right_flank"]
        assert channel_ids == expected_channels

        # Validate channel fields and 100% percentage sums
        for ch in res_for["channels"]:
            assert ch["channel_id"] in expected_channels
            assert ch["channel_name"] in (
                "Banda Izquierda", "Medio-Espacio Izquierdo", "Carril Central",
                "Medio-Espacio Derecho", "Banda Derecha"
            )
            assert ch["entries_count"] >= 0
            assert 0.0 <= ch["share_pct"] <= 100.0
            assert ch["box_infiltrations"] >= 0
            assert ch["threat_xg"] >= 0.0
            assert 0.0 <= ch["threat_pct"] <= 100.0
            assert isinstance(ch["top_players"], list)
            assert len(ch["top_players"]) <= 2
            for p in ch["top_players"]:
                assert "name" in p and len(p["name"]) > 0
                assert "actions_count" in p and p["actions_count"] > 0

        # Channel percentage sums equal 100% (within rounding)
        share_pct_sum = sum(c["share_pct"] for c in res_for["channels"])
        assert abs(share_pct_sum - 100.0) <= 0.5, f"Expected share_pct sum ~100%, got {share_pct_sum}"

        threat_pct_sum = sum(c["threat_pct"] for c in res_for["channels"])
        assert abs(threat_pct_sum - 100.0) <= 0.5, f"Expected threat_pct sum ~100%, got {threat_pct_sum}"

        # Summary metrics verification
        summary = res_for["summary"]
        assert summary["total_entries"] == sum(c["entries_count"] for c in res_for["channels"])
        assert summary["box_entries_total"] == sum(c["box_infiltrations"] for c in res_for["channels"])
        expected_conv = round((summary["box_entries_total"] / summary["total_entries"]) * 100.0, 1)
        assert summary["box_entry_conversion_pct"] == expected_conv
        assert summary["dominant_channel"] in expected_channels
        assert summary["most_dangerous_channel"] in expected_channels

        # Top-level metric parity
        assert res_for["total_entries"] == summary["total_entries"]
        assert res_for["box_entries_total"] == summary["box_entries_total"]
        assert res_for["box_entry_conversion_pct"] == summary["box_entry_conversion_pct"]
        assert res_for["dominant_channel"] == summary["dominant_channel"]
        assert res_for["most_dangerous_channel"] == summary["most_dangerous_channel"]

        # 2. Mode 'against' (actions conceded to opponents)
        res_against = team_repo.get_team_attack_zones(db, team_id=2311, tournament="all", mode="against")
        assert res_against is not None
        assert res_against["team_id"] == 2311
        assert res_against["mode"] == "against"
        assert len(res_against["channels"]) == 5
        assert res_against["total_entries"] > 0
        assert res_against["box_entries_total"] > 0

        share_against_sum = sum(c["share_pct"] for c in res_against["channels"])
        assert abs(share_against_sum - 100.0) <= 0.5, f"Expected share_pct sum ~100%, got {share_against_sum}"

        threat_against_sum = sum(c["threat_pct"] for c in res_against["channels"])
        assert abs(threat_against_sum - 100.0) <= 0.5, f"Expected threat_pct sum ~100%, got {threat_against_sum}"

        # 3. 2026 Season isolation enforcement
        # Querying an old non-2026 season fixture should return None
        old_match = db.execute("""
            SELECT match_id FROM matches 
            WHERE (home_team_id = 2311 OR away_team_id = 2311) 
              AND season_id != 88529 AND strftime('%Y', match_date) != '2026'
            LIMIT 1
        """).fetchone()
        if old_match:
            old_match_id = old_match["match_id"]
            assert team_repo.get_team_attack_zones(db, team_id=2311, match_id=old_match_id) is None

        # 4. Tournament filtering ('Apertura' and 'Clausura')
        res_ap = team_repo.get_team_attack_zones(db, team_id=2311, tournament="Apertura", mode="for")
        assert res_ap is not None
        assert res_ap["tournament"] == "Apertura"
        assert res_ap["total_entries"] > 0
        ap_sum = sum(c["share_pct"] for c in res_ap["channels"])
        assert abs(ap_sum - 100.0) <= 0.5

        res_cl = team_repo.get_team_attack_zones(db, team_id=2311, tournament="Clausura", mode="for")
        assert res_cl is not None
        assert res_cl["tournament"] == "Clausura"
        assert res_cl["total_entries"] > 0
        cl_sum = sum(c["share_pct"] for c in res_cl["channels"])
        assert abs(cl_sum - 100.0) <= 0.5

        assert res_ap["total_entries"] + res_cl["total_entries"] == res_for["total_entries"]

        # 5. Single match fixture filter
        matches = team_repo.get_team_matches(db, 2311)
        assert matches and len(matches) > 0
        target_match_id = matches[0]["match_id"]

        res_match = team_repo.get_team_attack_zones(db, team_id=2311, match_id=target_match_id, mode="for")
        assert res_match is not None
        assert res_match["team_id"] == 2311
        assert res_match["match_id"] == target_match_id
        assert len(res_match["channels"]) == 5

        # 6. Dual signature verification (without explicit db connection)
        res_standalone_for = team_repo.get_team_attack_zones(2311, tournament="Apertura", mode="for")
        assert res_standalone_for is not None
        assert res_standalone_for["team_id"] == 2311
        assert res_standalone_for["total_entries"] == res_ap["total_entries"]

        res_standalone_against = team_repo.get_team_attack_zones(2311, mode="against")
        assert res_standalone_against is not None
        assert res_standalone_against["team_id"] == 2311
        assert res_standalone_against["mode"] == "against"
        assert res_standalone_against["total_entries"] == res_against["total_entries"]

        # 7. Non-existent team returns None
        assert team_repo.get_team_attack_zones(db, 9999999) is None
        assert team_repo.get_team_attack_zones(9999999) is None


def test_get_team_attack_zones_endpoint():
    # 1. Cumulative scope (default / all, mode='for')
    resp = client.get("/api/teams/2311/attack-zones")
    assert resp.status_code == 200
    data = resp.json()

    assert data["team_id"] == 2311
    assert data["mode"] == "for"
    assert data["tournament"] == "all"
    assert data["match_id"] is None

    # Validate summary fields
    summary = data["summary"]
    for key in (
        "total_entries", "box_entries_total", "box_entry_conversion_pct",
        "dominant_channel", "most_dangerous_channel"
    ):
        assert key in summary

    assert len(data["channels"]) == 5
    for ch in data["channels"]:
        for key in (
            "channel_id", "channel_name", "entries_count", "share_pct",
            "box_infiltrations", "threat_xg", "threat_pct", "top_players"
        ):
            assert key in ch

    # Test /api/v1 prefix parity
    resp_v1 = client.get("/api/v1/teams/2311/attack-zones")
    assert resp_v1.status_code == 200
    assert resp_v1.json()["total_entries"] == data["total_entries"]
    assert len(resp_v1.json()["channels"]) == len(data["channels"])

    # 2. Mode 'against' (actions conceded)
    resp_against = client.get("/api/teams/2311/attack-zones?mode=against")
    assert resp_against.status_code == 200
    data_against = resp_against.json()
    assert data_against["team_id"] == 2311
    assert data_against["mode"] == "against"
    assert data_against["total_entries"] > 0

    # 3. Tournament filtering (Apertura / Clausura)
    resp_ap = client.get("/api/teams/2311/attack-zones?tournament=Apertura")
    assert resp_ap.status_code == 200
    data_ap = resp_ap.json()
    assert data_ap["tournament"] == "Apertura"
    assert data_ap["total_entries"] > 0

    resp_cl = client.get("/api/teams/2311/attack-zones?tournament=Clausura")
    assert resp_cl.status_code == 200
    data_cl = resp_cl.json()
    assert data_cl["tournament"] == "Clausura"
    assert data_cl["total_entries"] > 0

    assert data_ap["total_entries"] + data_cl["total_entries"] == data["total_entries"]

    # 4. Single match with match_id
    matches_resp = client.get("/api/teams/2311/matches")
    assert matches_resp.status_code == 200
    matches = matches_resp.json()
    assert len(matches) > 0
    target_match_id = matches[0]["match_id"]

    resp_match = client.get(f"/api/teams/2311/attack-zones?match_id={target_match_id}")
    assert resp_match.status_code == 200
    data_match = resp_match.json()
    assert data_match["team_id"] == 2311
    assert data_match["match_id"] == target_match_id
    assert len(data_match["channels"]) == 5

    # 5. Error handling
    # Non-existent team -> 404
    resp_bad_team = client.get("/api/teams/9999999/attack-zones")
    assert resp_bad_team.status_code == 404

    # Non-existent match -> 404
    resp_bad_match = client.get("/api/teams/2311/attack-zones?match_id=999999999")
    assert resp_bad_match.status_code == 404

    # Invalid mode regex validation -> 422
    resp_bad_mode = client.get("/api/teams/2311/attack-zones?mode=invalid")
    assert resp_bad_mode.status_code == 422


def test_get_team_period_metrics_mode():
    # 1. Default (mode=for)
    resp_for = client.get("/api/teams/2311/period-metrics?mode=for")
    assert resp_for.status_code == 200
    data_for = resp_for.json()
    assert data_for["mode"] == "for"
    assert data_for["periods"]["ALL"]["avg_goals"] > 0
    assert data_for["periods"]["ALL"]["avg_xg"] > 0
    assert data_for["goal_distribution"]["total_goals"] > 0

    # 2. mode=against
    resp_against = client.get("/api/teams/2311/period-metrics?mode=against")
    assert resp_against.status_code == 200
    data_against = resp_against.json()
    assert data_against["mode"] == "against"
    assert data_against["periods"]["ALL"]["avg_goals"] == data_against["periods"]["ALL"]["avg_goals_conceded"]
    assert data_against["goal_distribution"]["total_goals"] == data_against["periods"]["ALL"]["goals_conceded"]

    # 3. Invalid mode -> 422
    resp_invalid = client.get("/api/teams/2311/period-metrics?mode=invalid")
    assert resp_invalid.status_code == 422


def test_get_team_set_pieces_mode():
    # 1. Default (mode=for)
    resp_for = client.get("/api/teams/2311/set-pieces?mode=for")
    assert resp_for.status_code == 200
    data_for = resp_for.json()
    assert data_for["mode"] == "for"
    assert "corner_goals" in data_for

    # 2. mode=against
    resp_against = client.get("/api/teams/2311/set-pieces?mode=against")
    assert resp_against.status_code == 200
    data_against = resp_against.json()
    assert data_against["mode"] == "against"
    assert "corner_goals" in data_against

    # 3. Invalid mode -> 422
    resp_invalid = client.get("/api/teams/2311/set-pieces?mode=invalid")
    assert resp_invalid.status_code == 422


def test_get_team_shot_map_per_match_metrics():
    # Cumulative mode
    resp = client.get("/api/teams/2311/shot-map?mode=for")
    assert resp.status_code == 200
    data = resp.json()
    summary = data["summary"]
    assert "shots_per_match" in summary
    assert "xg_per_match" in summary
    assert summary["shots_per_match"] > 0
    assert summary["xg_per_match"] > 0

    # Against mode
    resp_ag = client.get("/api/teams/2311/shot-map?mode=against")
    assert resp_ag.status_code == 200
    summary_ag = resp_ag.json()["summary"]
    assert "shots_per_match" in summary_ag
    assert "xg_per_match" in summary_ag
    assert summary_ag["shots_per_match"] > 0
    assert summary_ag["xg_per_match"] > 0


def test_get_team_most_used_xi():
    # 1. Full cohort (Alianza Lima)
    resp = client.get("/api/teams/2311/most-used-xi")
    assert resp.status_code == 200
    data = resp.json()
    assert data["team_id"] == 2311
    assert "formation" in data
    assert len(data["formation"]) >= 3
    outfield_sum = sum(int(p) for p in data["formation"].split("-") if p.isdigit())
    assert outfield_sum == 10
    assert len(data["players"]) == 11
    assert data["total_matches"] > 0
    assert data["max_minutes"] == data["total_matches"] * 90

    # Verify player slot fields
    first_player = data["players"][0]
    assert "slot" in first_player
    assert "name" in first_player
    assert "pitch_x" in first_player
    assert "pitch_y" in first_player
    assert "minutes_share" in first_player
    assert "apps" in first_player
    assert "starts" in first_player
    assert "g_plus_a" in first_player
    assert "xg" in first_player
    assert "shots_p90" in first_player
    assert "total_shots" in first_player
    assert "yellow_cards" in first_player
    assert first_player["starts"] >= 0
    assert first_player["xg"] >= 0.0
    assert first_player["shots_p90"] >= 0.0
    assert first_player["yellow_cards"] >= 0
    assert first_player["minutes_share"] <= 100

    # Verify GK has saves field
    gk_player = next((p for p in data["players"] if p["slot"] in ("GK", "G")), None)
    if gk_player:
        assert "saves" in gk_player
        assert "saves_p90" in gk_player

    # 2. Filtered cohort (home venue and Apertura)
    resp_venue = client.get("/api/teams/2311/most-used-xi?tournament=Apertura&venue=home")
    assert resp_venue.status_code == 200
    data_venue = resp_venue.json()
    assert len(data_venue["players"]) == 11
    assert data_venue["venue"] == "home"
    venue_outfield_sum = sum(int(p) for p in data_venue["formation"].split("-") if p.isdigit())
    assert venue_outfield_sum == 10

    # 3. UTC Clausura: Verify valid 10-outfield formation (e.g. 4-1-4-1, not 4-1-2-1) and Marcos Lliuya in midfield
    resp_utc = client.get("/api/teams/87854/most-used-xi?tournament=Clausura")
    assert resp_utc.status_code == 200
    data_utc = resp_utc.json()
    utc_outfield_sum = sum(int(p) for p in data_utc["formation"].split("-") if p.isdigit())
    assert utc_outfield_sum == 10
    assert len(data_utc["players"]) == 11
    # Ensure Lliuya is in midfield, not ST
    lliuya = next((p for p in data_utc["players"] if "Lliuya" in p["name"]), None)
    if lliuya:
        assert lliuya["slot"] in ("LCM", "RCM", "CAM", "LM", "RM", "CDM")

    # 4. Universitario (5-1-2-2 / 3-5-2): Verify central defender vertical clearance >= 18%
    resp_uni = client.get("/api/teams/2305/most-used-xi")
    assert resp_uni.status_code == 200
    data_uni = resp_uni.json()
    assert len(data_uni["players"]) == 11
    uni_slots = {p["slot"]: p for p in data_uni["players"]}
    if "LCB" in uni_slots and "CB" in uni_slots and "RCB" in uni_slots:
        lcb_y = uni_slots["LCB"]["pitch_y"]
        cb_y = uni_slots["CB"]["pitch_y"]
        rcb_y = uni_slots["RCB"]["pitch_y"]
        assert abs(lcb_y - cb_y) >= 18.0, f"LCB-CB clearance too small: {abs(lcb_y - cb_y)}"
        assert abs(cb_y - rcb_y) >= 18.0, f"CB-RCB clearance too small: {abs(cb_y - rcb_y)}"


def test_get_team_period_metrics_ht_and_first_goal():
    """Verify that /teams/{team_id}/period-metrics returns HT outcomes and first-goal dynamics."""
    resp = client.get("/api/teams/2301/period-metrics")
    assert resp.status_code == 200
    data = resp.json()

    # Verify HT state fields
    assert "ht_won" in data
    assert "ht_drawn" in data
    assert "ht_lost" in data
    assert isinstance(data["ht_won"], int)
    assert isinstance(data["ht_drawn"], int)
    assert isinstance(data["ht_lost"], int)

    # Verify First Goal dynamic fields
    assert "scored_first_count" in data
    assert "scored_first_record" in data
    assert "conceded_first_count" in data
    assert "conceded_first_record" in data
    assert isinstance(data["scored_first_count"], int)
    assert isinstance(data["conceded_first_count"], int)
    assert "V-" in data["scored_first_record"]
    assert "V-" in data["conceded_first_record"]

    # Verify in 'against' mode
    resp_against = client.get("/api/teams/2301/period-metrics?mode=against")
    assert resp_against.status_code == 200
    data_against = resp_against.json()
    assert "ht_won" in data_against
    assert "scored_first_record" in data_against


    # Verify Floor 2 Estimation & Frequency metrics
    assert "corner_stats" in data
    cs = data["corner_stats"]
    assert "corners_for_avg" in cs
    assert "corners_against_avg" in cs
    assert "corners_total_avg" in cs
    assert "over_8_5_corners" in cs
    assert "count" in cs["over_8_5_corners"]
    assert "total" in cs["over_8_5_corners"]
    assert "over_9_5_corners" in cs
    assert "corners_conceded_over_4_5" in cs
    assert "count" in cs["corners_conceded_over_4_5"]
    assert "total" in cs["corners_conceded_over_4_5"]
    assert "corners_conceded_over_4_5_count" in data
    assert "corners_conceded_over_4_5_pct" in data
    assert "penalties_awarded" in data
    assert "penalties_scored" in data
    assert "penalties_conceded" in data
    assert isinstance(data["penalties_awarded"], int)
    assert isinstance(data["penalties_scored"], int)
    assert isinstance(data["penalties_conceded"], int)
    assert "set_pieces" in data
    assert data["set_pieces"]["penalties_awarded"] == data["penalties_awarded"]
    assert "set_piece_goals_conceded" in data["set_pieces"]
    assert "set_piece_goals_conceded_per_match" in data["set_pieces"]
    assert isinstance(data["set_pieces"]["set_piece_goals_conceded"], int)
    assert isinstance(data["set_pieces"]["set_piece_goals_conceded_per_match"], float)

    assert "time_splits" in data
    ts = data["time_splits"]
    assert "goals_1t" in ts
    assert "goals_2t" in ts
    assert "pct_goals_2t" in ts
    assert "peak_scoring_interval" in ts

    assert "match_dynamics" in data
    md = data["match_dynamics"]
    assert "btts" in md
    assert "clean_sheets" in md
    assert "clean_sheets_pct" in md
    assert "failed_to_score" in md
    assert "failed_to_score_pct" in md
    assert "conceded_early_0_20" in md
    assert "conceded_early_0_20_pct" in md
    assert "ht_won" in md
    assert "scored_first" in md
    assert "conceded_first" in md
    assert "breakdown" in md["scored_first"]
    assert "wins" in md["scored_first"]["breakdown"]

    assert "clean_sheets_count" in data
    assert "clean_sheets_pct" in data
    assert "failed_to_score_count" in data
    assert "failed_to_score_pct" in data
    assert "conceded_early_0_20_count" in data
    assert "conceded_early_0_20_pct" in data

    assert "discipline_stats" in data
    ds = data["discipline_stats"]
    assert "fouls_committed_avg" in ds
    assert "fouls_drawn_avg" in ds
    assert ds["fouls_committed_avg"] >= 9.0, f"Expected realistic fouls committed (>= 9.0), got {ds['fouls_committed_avg']}"
    assert ds["fouls_drawn_avg"] >= 7.0, f"Expected realistic fouls drawn (>= 7.0), got {ds['fouls_drawn_avg']}"
    assert data["periods"]["ALL"]["avg_fouls"] >= 9.0
    assert data["periods"]["ALL"]["avg_fouls_received"] >= 7.0
    assert "cards_for_avg" in ds
    assert "cards_forced_avg" in ds
    assert "cards_match_total_avg" in ds
    assert "red_cards_total" in ds
    assert "red_cards_avg" in ds
    assert "red_cards_total" in data
    assert "red_cards_avg" in data
    assert "over_3_5_cards" in ds
    assert "cards_2h_pct" in ds
    assert 0.0 <= ds["cards_2h_pct"] <= 100.0


def test_context_filter_metrics():
    # 1. vs_elite filter
    resp_elite = client.get("/api/teams/metrics?context_filter=vs_elite")
    assert resp_elite.status_code == 200
    data_elite = resp_elite.json()
    assert len(data_elite) == 18
    # In Liga 1, non-elite teams play at most 4-8 matches vs elite
    cienciano_elite = next(t for t in data_elite if t["team_id"] == 2301)
    assert cienciano_elite["matches_played"] <= 8

    # 2. altitude filter
    resp_alt = client.get("/api/teams/metrics?context_filter=altitude")
    assert resp_alt.status_code == 200
    data_alt = resp_alt.json()
    assert len(data_alt) == 18

    # 3. sea_level filter
    resp_sea = client.get("/api/teams/metrics?context_filter=sea_level")
    assert resp_sea.status_code == 200
    data_sea = resp_sea.json()
    assert len(data_sea) == 18

    # Total matches across altitude + sea_level should equal all matches for a team
    resp_all = client.get("/api/teams/metrics?context_filter=all")
    data_all = resp_all.json()
    alianza_all = next(t for t in data_all if t["team_id"] == 2311)
    alianza_alt = next(t for t in data_alt if t["team_id"] == 2311)
    alianza_sea = next(t for t in data_sea if t["team_id"] == 2311)
    assert alianza_alt["matches_played"] + alianza_sea["matches_played"] == alianza_all["matches_played"]


def test_pass_network_exposed_pivot():
    # Test pass network returns pivot tags
    resp = client.get("/api/teams/2311/pass-network?tournament=Clausura")
    assert resp.status_code == 200
    data = resp.json()
    assert "nodes" in data
    assert len(data["nodes"]) > 0

    # Verify at least one node is tagged as pivot
    pivot_nodes = [n for n in data["nodes"] if n.get("is_pivot")]
    assert len(pivot_nodes) >= 1

    for p in pivot_nodes:
        assert "defensive_actions_p90" in p
        assert p["defensive_actions_p90"] is not None
        assert "is_exposed_pivot" in p
        # Exposure condition: def_p90 < 2.0
        assert p["is_exposed_pivot"] == (p["defensive_actions_p90"] < 2.0)

    # Test with context_filter
    resp_ctx = client.get("/api/teams/2311/pass-network?context_filter=vs_elite")
    assert resp_ctx.status_code == 200
    data_ctx = resp_ctx.json()
    assert len(data_ctx["nodes"]) > 0


def test_context_filter_across_analytic_endpoints():
    # Period metrics
    resp_pm = client.get("/api/teams/2311/period-metrics?context_filter=vs_rest")
    assert resp_pm.status_code == 200
    data_pm = resp_pm.json()
    assert "periods" in data_pm

    # Most used XI
    resp_xi = client.get("/api/teams/2311/most-used-xi?context_filter=altitude")
    assert resp_xi.status_code == 200
    data_xi = resp_xi.json()
    assert "players" in data_xi
    assert len(data_xi["players"]) == 11

    # Shot map
    resp_sm = client.get("/api/teams/2311/shot-map?context_filter=sea_level")
    assert resp_sm.status_code == 200
    data_sm = resp_sm.json()
    assert "shots" in data_sm

    # Defensive actions
    resp_def = client.get("/api/teams/2311/defensive-actions?context_filter=vs_elite")
    assert resp_def.status_code == 200
    data_def = resp_def.json()
    assert "summary" in data_def


if __name__ == "__main__":
    pytest.main([__file__, "-v"])






