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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
