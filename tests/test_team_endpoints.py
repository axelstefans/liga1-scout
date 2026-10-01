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
    assert latency_ms < 50.0, f"Query exceeded 50ms: {latency_ms:.2f}ms"

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
    assert latency_ms < 50.0, f"Shot zones exceeded 50ms: {latency_ms:.2f}ms"

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
    assert latency_ms < 250.0, f"Pass network latency {latency_ms:.2f}ms too high"

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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
