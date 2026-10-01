import sqlite3
from typing import Optional, List, Dict, Any
from collections import defaultdict

def get_team_profile(db: sqlite3.Connection, team_id: int) -> Optional[Dict[str, Any]]:
    """Fetch basic team information."""
    query = "SELECT team_id, name, short_name, country, logo_url, primary_color FROM teams WHERE team_id = ?"
    row = db.execute(query, (team_id,)).fetchone()
    return dict(row) if row else None

def get_all_teams(db: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Fetch all active teams for the current season."""
    query = "SELECT * FROM teams WHERE is_active = 1 ORDER BY name ASC"
    rows = db.execute(query).fetchall()
    return [dict(row) for row in rows]

def get_team_roster(db: sqlite3.Connection, team_id: int) -> List[Dict[str, Any]]:
    """Fetch all players currently assigned to the team."""
    query = """
        SELECT 
            p.player_id, 
            p.name, 
            p.position_group, 
            p.shirt_number, 
            p.nationality,
            pmv.market_value_str
        FROM players p
        LEFT JOIN player_market_values pmv ON p.player_id = pmv.player_id
        WHERE p.team_id = ?
        ORDER BY 
            -- Order by position generally (G, D, M, F)
            CASE p.position_group 
                WHEN 'Goalkeeper' THEN 1
                WHEN 'Defender' THEN 2
                WHEN 'Midfielder' THEN 3
                WHEN 'Forward' THEN 4
                ELSE 5
            END,
            p.shirt_number
    """
    rows = db.execute(query, (team_id,)).fetchall()
    return [dict(row) for row in rows]

def get_team_next_match(db: sqlite3.Connection, team_id: int) -> Optional[Dict[str, Any]]:
    """Fetch the next scheduled match for a team."""
    query = """
        SELECT 
            m.match_date,
            m.match_id,
            CASE WHEN m.home_team_id = ? THEN 'H' ELSE 'A' END as home_away,
            CASE WHEN m.home_team_id = ? THEN away_t.name ELSE home_t.name END as opponent_name,
            CASE WHEN m.home_team_id = ? THEN away_t.logo_url ELSE home_t.logo_url END as opponent_logo_url
        FROM matches m
        JOIN teams home_t ON m.home_team_id = home_t.team_id
        JOIN teams away_t ON m.away_team_id = away_t.team_id
        WHERE (m.home_team_id = ? OR m.away_team_id = ?)
          AND m.status = 'scheduled'
        ORDER BY m.match_date ASC
        LIMIT 1
    """
    row = db.execute(query, (team_id, team_id, team_id, team_id, team_id)).fetchone()
    return dict(row) if row else None

def get_team_metrics(db: sqlite3.Connection, tournament: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetch aggregate metrics for all 18 active Liga 1 teams, optionally filtered by tournament (Apertura | Clausura).
    Returns metrics calculated from pre-aggregated team_match_metrics table & view under 10ms.
    """
    if tournament and tournament.strip().lower() in ('apertura', 'clausura'):
        normalized_tourn = 'Apertura' if tournament.strip().lower() == 'apertura' else 'Clausura'
        query = """
            SELECT 
                t.team_id,
                t.name,
                t.short_name,
                t.primary_color,
                t.logo_url,
                COUNT(tmm.match_id) as matches_played,
                SUM(CASE WHEN tmm.result = 'W' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN tmm.result = 'D' THEN 1 ELSE 0 END) as draws,
                SUM(CASE WHEN tmm.result = 'L' THEN 1 ELSE 0 END) as losses,
                SUM(tmm.points) as points,
                ROUND(CAST(SUM(tmm.points) AS FLOAT) / COUNT(tmm.match_id), 2) as points_per_match,
                SUM(tmm.goals_for) as goals_scored,
                SUM(tmm.goals_against) as goals_conceded,
                SUM(tmm.goals_for) - SUM(tmm.goals_against) as goal_difference,

                -- A. Ofensivas / Tiro
                SUM(tmm.shots_for) as total_shots,
                SUM(tmm.shots_on_target_for) as shots_on_target,
                SUM(tmm.shots_inside_box_for) as shots_inside_box,
                SUM(tmm.shots_outside_box_for) as shots_outside_box,
                ROUND(SUM(tmm.xg_for), 2) as xg,
                ROUND(SUM(tmm.npxg_for), 2) as npxg,
                ROUND(SUM(tmm.xg_for) / NULLIF(CAST(SUM(tmm.shots_for) AS FLOAT), 0), 2) as xg_per_shot,
                ROUND(SUM(tmm.goals_for) - SUM(tmm.xg_for), 2) as goals_minus_xg,
                ROUND((CAST(SUM(tmm.goals_for) AS FLOAT) * 100.0) / NULLIF(SUM(tmm.shots_for), 0), 1) as conversion_rate_pct,

                -- B. Circulación y Progresión
                ROUND((CAST(SUM(tmm.passes_completed) AS FLOAT) * 100.0) / NULLIF(SUM(tmm.passes_completed) + SUM(tmm.opp_passes_completed), 0), 1) as possession_pct,
                SUM(tmm.passes_completed) as passes_completed,
                SUM(tmm.passes_total) as passes_total,
                ROUND((CAST(SUM(tmm.passes_completed) AS FLOAT) * 100.0) / NULLIF(SUM(tmm.passes_total), 0), 1) as pass_accuracy_pct,
                SUM(tmm.progressive_passes) as progressive_passes,
                SUM(tmm.final_third_passes_for) as passes_into_final_third,
                SUM(tmm.passes_into_box) as passes_into_box,
                SUM(tmm.crosses_completed) as crosses_completed,
                SUM(tmm.progressive_carries) as progressive_carries,
                SUM(tmm.successful_dribbles) as successful_dribbles,

                -- C. Dominio Territorial y Estilo
                ROUND((CAST(SUM(tmm.final_third_passes_for) AS FLOAT) * 100.0) / NULLIF(SUM(tmm.final_third_passes_for) + SUM(tmm.final_third_passes_against), 0), 1) as field_tilt,
                ROUND((CAST(SUM(tmm.final_third_passes_for) AS FLOAT) * 100.0) / NULLIF(SUM(tmm.final_third_passes_for) + SUM(tmm.final_third_passes_against), 0), 1) as field_tilt_pct,
                ROUND((CAST(SUM(tmm.forward_passes) AS FLOAT) * 100.0) / NULLIF(SUM(tmm.passes_total), 0), 1) as verticality_ratio_pct,
                ROUND(CAST(SUM(tmm.shot_dist_sum_for) AS FLOAT) / NULLIF(SUM(tmm.shot_dist_count_for), 0), 1) as avg_shot_distance,

                -- D. Presión y Fase Defensiva
                ROUND(CAST(SUM(tmm.opp_passes_own_half) AS FLOAT) / NULLIF(SUM(tmm.defensive_actions_high), 0), 2) as ppda,
                SUM(tmm.high_recoveries) as high_recoveries,
                SUM(tmm.defensive_actions) as defensive_actions,
                SUM(tmm.tackles) as tackles,
                SUM(tmm.interceptions) as interceptions,
                SUM(tmm.clearances) as clearances,

                -- E. Concesión / Rival
                SUM(tmm.shots_against) as shots_conceded,
                SUM(tmm.shots_on_target_against) as shots_on_target_conceded,
                SUM(tmm.shots_inside_box_against) as shots_conceded_inside_box,
                ROUND(SUM(tmm.xg_against), 2) as xga,
                ROUND(SUM(tmm.xg_for) - SUM(tmm.xg_against), 2) as xgd,
                ROUND(CAST(SUM(tmm.shots_against) AS FLOAT) / MAX(SUM(tmm.goals_against), 1), 1) as defensive_resistance_ratio,

                -- Compatibility metrics
                ROUND(SUM(tmm.xg_for) / COUNT(tmm.match_id), 2) as xg_per_match,
                ROUND(SUM(tmm.xg_against) / COUNT(tmm.match_id), 2) as xga_per_match,
                ROUND(CAST(SUM(tmm.shots_for) AS FLOAT) / NULLIF(SUM(tmm.goals_for), 0), 2) as conversion_ratio

            FROM teams t
            JOIN team_match_metrics tmm ON t.team_id = tmm.team_id
            WHERE tmm.tournament = ?
            GROUP BY t.team_id, t.name, t.short_name, t.primary_color, t.logo_url
            ORDER BY points DESC, goal_difference DESC, goals_scored DESC
        """
        rows = db.execute(query, (normalized_tourn,)).fetchall()
    else:
        query = "SELECT * FROM vw_team_metrics ORDER BY points DESC, goal_difference DESC, goals_scored DESC"
        rows = db.execute(query).fetchall()

    return [dict(row) for row in rows]

def get_team_shot_zones(
    db: sqlite3.Connection,
    team_id: int,
    tournament: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Fetch spatial shot distribution for a team across a 5x6 pitch grid (rows x cols)
    for both shots taken (attacking) and shots conceded (defending).
    """
    team_row = db.execute("SELECT name FROM teams WHERE team_id = ?", (team_id,)).fetchone()
    if not team_row:
        return None
    team_name = team_row["name"]

    params: List[Any] = [team_id, team_id]
    tourn_clause = ""
    if tournament and tournament.strip().lower() in ('apertura', 'clausura'):
        normalized_tourn = 'Apertura' if tournament.strip().lower() == 'apertura' else 'Clausura'
        tourn_clause = "AND CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END = ?"
        params.append(normalized_tourn)

    query = f"""
        SELECT 
            ps.coord_x,
            ps.coord_y,
            ps.distance_m,
            ps.situation,
            ps.shot_type,
            COALESCE(psx.calculated_xg, 0.0) as xg,
            CASE WHEN ps.is_home = 1 THEN m.home_team_id ELSE m.away_team_id END as shooting_team_id,
            CASE WHEN ps.is_home = 1 THEN m.away_team_id ELSE m.home_team_id END as defending_team_id
        FROM matches m
        JOIN player_shots ps ON m.match_id = ps.match_id
        LEFT JOIN player_shots_xg psx ON ps.shot_id = psx.shot_id
        WHERE m.season_id = 88529
          AND (m.home_team_id = ? OR m.away_team_id = ?)
          {tourn_clause}
    """
    rows = db.execute(query, tuple(params)).fetchall()

    shots_taken_raw = []
    shots_conceded_raw = []
    for r in rows:
        d = dict(r)
        if d["shooting_team_id"] == team_id:
            shots_taken_raw.append(d)
        if d["defending_team_id"] == team_id:
            shots_conceded_raw.append(d)

    # 5 width columns x 6 depth rows
    x_bins = [0.0, 6.0, 12.0, 18.0, 25.0, 35.0, 120.0]
    y_bins = [0.0, 20.0, 40.0, 60.0, 80.0, 100.1]

    def bin_shots(shot_list: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], int, float]:
        total_shots = len(shot_list)
        total_xg = sum(s["xg"] for s in shot_list)
        cells = []
        for r_idx in range(6):
            x_min, x_max = x_bins[r_idx], x_bins[r_idx + 1]
            for c_idx in range(5):
                y_min, y_max = y_bins[c_idx], y_bins[c_idx + 1]
                zone_shots = [
                    s for s in shot_list
                    if (s["coord_x"] is not None and s["coord_y"] is not None)
                    and x_min <= s["coord_x"] < x_max
                    and y_min <= s["coord_y"] < y_max
                ]
                count = len(zone_shots)
                c_xg = sum(s["xg"] for s in zone_shots)
                c_goals = sum(1 for s in zone_shots if str(s["shot_type"]).lower() == 'goal')
                cells.append({
                    "zone_id": r_idx * 5 + c_idx,
                    "row": r_idx,
                    "col": c_idx,
                    "x_min": x_min,
                    "x_max": x_max,
                    "y_min": y_min,
                    "y_max": y_max,
                    "count": count,
                    "xg": round(c_xg, 3),
                    "xg_per_shot": round(c_xg / count, 3) if count > 0 else 0.0,
                    "pct_of_total": round((count / total_shots * 100), 2) if total_shots > 0 else 0.0,
                    "goals": c_goals
                })
        return cells, total_shots, round(total_xg, 2)

    def compute_tactics(shot_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        total = len(shot_list)
        if total == 0:
            return {
                "total_shots": 0,
                "non_penalty_shots": 0,
                "avg_distance_m": 0.0,
                "pct_inside_box": 0.0,
                "pct_set_piece": 0.0,
                "pct_fast_break": 0.0,
            }
        non_penalty = sum(1 for s in shot_list if str(s.get("situation") or "").lower() != "penalty")
        valid_dists = [s["distance_m"] for s in shot_list if s.get("distance_m") is not None]
        avg_dist = sum(valid_dists) / len(valid_dists) if valid_dists else 0.0
        inside_box = sum(1 for s in shot_list if s.get("distance_m") is not None and s["distance_m"] <= 16.5)
        set_piece_situations = {"corner", "free-kick", "set-piece", "throw-in-set-piece"}
        set_pieces = sum(1 for s in shot_list if str(s.get("situation") or "").lower() in set_piece_situations)
        fast_breaks = sum(1 for s in shot_list if str(s.get("situation") or "").lower() == "fast-break")
        
        return {
            "total_shots": total,
            "non_penalty_shots": non_penalty,
            "avg_distance_m": round(avg_dist, 1),
            "pct_inside_box": round((inside_box * 100.0) / total, 1),
            "pct_set_piece": round((set_pieces * 100.0) / total, 1),
            "pct_fast_break": round((fast_breaks * 100.0) / total, 1),
        }

    taken_cells, t_count, t_xg = bin_shots(shots_taken_raw)
    conceded_cells, c_count, c_xg = bin_shots(shots_conceded_raw)

    return {
        "team_id": team_id,
        "team_name": team_name,
        "tournament": tournament or "All",
        "total_shots_taken": t_count,
        "total_xg_taken": t_xg,
        "total_shots_conceded": c_count,
        "total_xg_conceded": c_xg,
        "grid": {"rows": 6, "cols": 5},
        "shots_taken": taken_cells,
        "shots_conceded": conceded_cells,
        "tactics_taken": compute_tactics(shots_taken_raw),
        "tactics_conceded": compute_tactics(shots_conceded_raw)
    }

def get_team_pass_network(
    db: sqlite3.Connection,
    team_id: int,
    tournament: Optional[str] = "all"
) -> Optional[Dict[str, Any]]:
    """
    Compute pass network for a team's Base XI (strictly top 11 players by total minutes played).
    Calculates average (x, y) coordinates for nodes and successful pass volume between pairs.
    """
    team_row = db.execute("SELECT name FROM teams WHERE team_id = ?", (team_id,)).fetchone()
    if not team_row:
        return None

    tourn_clause = ""
    params: List[Any] = [team_id]
    normalized_tourn = "all"
    if tournament and tournament.strip().lower() in ("apertura", "clausura"):
        normalized_tourn = "Apertura" if tournament.strip().lower() == "apertura" else "Clausura"
        tourn_clause = "AND CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END = ?"
        params.append(normalized_tourn)

    # 1. Strictly query Top 11 players by total minutes played (without Cartesian join explosion)
    xi_query = f"""
        SELECT 
            pms.player_id,
            p.name,
            p.shirt_number,
            SUM(pms.minutes_played) as total_minutes
        FROM player_match_stats pms
        JOIN players p ON pms.player_id = p.player_id
        JOIN matches m ON pms.match_id = m.match_id
        WHERE pms.team_id = ? AND m.status = 'played' {tourn_clause}
        GROUP BY pms.player_id, p.name, p.shirt_number
        HAVING SUM(pms.minutes_played) > 0
        ORDER BY total_minutes DESC
        LIMIT 11
    """
    xi_rows = db.execute(xi_query, params).fetchall()
    if not xi_rows:
        return {
            "team_id": team_id,
            "tournament": normalized_tourn,
            "nodes": [],
            "edges": []
        }

    xi_ids = [r["player_id"] for r in xi_rows]
    xi_id_set = set(xi_ids)
    placeholders = ",".join("?" * len(xi_ids))

    # 2. Query spatial pass statistics ONLY for those 11 players
    stats_query = f"""
        SELECT 
            pp.player_id,
            COUNT(pp.id) as total_passes_attempted,
            SUM(CASE WHEN pp.is_successful = 1 THEN 1 ELSE 0 END) as successful_passes,
            ROUND(AVG(pp.x_start), 1) as x,
            ROUND(AVG(pp.y_start), 1) as y
        FROM player_passes pp
        JOIN player_match_stats pms ON pp.match_id = pms.match_id AND pp.player_id = pms.player_id
        JOIN matches m ON pp.match_id = m.match_id
        WHERE pms.team_id = ? AND m.status = 'played' AND pp.player_id IN ({placeholders})
          {tourn_clause}
        GROUP BY pp.player_id
    """
    stats_params = [team_id] + xi_ids + ([normalized_tourn] if normalized_tourn != "all" else [])
    stats_rows = db.execute(stats_query, stats_params).fetchall()
    stats_map = {r["player_id"]: dict(r) for r in stats_rows}

    nodes = []
    coords = {}
    for r in xi_rows:
        pid = r["player_id"]
        st = stats_map.get(pid, {})
        node_x = float(st.get("x")) if st.get("x") is not None else 50.0
        node_y = float(st.get("y")) if st.get("y") is not None else 50.0
        succ_passes = int(st.get("successful_passes") or 0)

        nodes.append({
            "player_id": pid,
            "name": r["name"],
            "jersey": int(r["shirt_number"]) if r["shirt_number"] is not None and r["shirt_number"] > 0 else None,
            "x": node_x,
            "y": node_y,
            "total_passes": succ_passes
        })
        coords[pid] = (node_x, node_y)

    # 3. Matches played by the XI
    mp_query = f"""
        SELECT pms.match_id, pms.player_id
        FROM player_match_stats pms
        JOIN matches m ON pms.match_id = m.match_id
        WHERE pms.team_id = ? AND pms.player_id IN ({placeholders})
          AND pms.minutes_played > 0 AND m.status = 'played' {tourn_clause}
    """
    mp_params = [team_id] + xi_ids + ([normalized_tourn] if normalized_tourn != "all" else [])
    mp_rows = db.execute(mp_query, mp_params).fetchall()
    match_players = defaultdict(set)
    for r in mp_rows:
        match_players[r["match_id"]].add(r["player_id"])

    # 4. Successful passes made ONLY by the 11 players
    passes_query = f"""
        SELECT pp.match_id, pp.player_id, pp.x_end, pp.y_end
        FROM player_passes pp
        JOIN player_match_stats pms ON pp.match_id = pms.match_id AND pp.player_id = pms.player_id
        JOIN matches m ON pp.match_id = m.match_id
        WHERE pms.team_id = ? AND m.status = 'played' AND pp.is_successful = 1
          AND pp.player_id IN ({placeholders})
          {tourn_clause}
    """
    passes_params = [team_id] + xi_ids + ([normalized_tourn] if normalized_tourn != "all" else [])
    passes_rows = db.execute(passes_query, passes_params).fetchall()

    edges_dict = defaultdict(int)
    for p in passes_rows:
        passer_id = p["player_id"]
        m_id = p["match_id"]
        x_end = p["x_end"]
        y_end = p["y_end"]
        if x_end is None or y_end is None:
            continue

        # Candidates are strictly other XI players who were active in that match
        candidates = [pid for pid in match_players.get(m_id, set()) if pid != passer_id]
        if not candidates:
            # Fallback to other XI players
            candidates = [pid for pid in xi_id_set if pid != passer_id]

        best_cand = None
        min_d = float("inf")
        for cand in candidates:
            cx, cy = coords[cand]
            d = (cx - x_end) ** 2 + (cy - y_end) ** 2
            if d < min_d:
                min_d = d
                best_cand = cand
        if best_cand is not None:
            edges_dict[(passer_id, best_cand)] += 1

    edges = [
        {
            "passer_id": k[0],
            "receiver_id": k[1],
            "pass_count": v
        }
        for k, v in edges_dict.items()
        if v >= 1
    ]
    edges.sort(key=lambda x: x["pass_count"], reverse=True)

    return {
        "team_id": team_id,
        "tournament": normalized_tourn,
        "nodes": nodes,
        "edges": edges
    }

