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

TEAM_TRICODES: Dict[int, str] = {
    2311: "ALI",
    2305: "UNI",
    2302: "CRI",
    2308: "MEL",
    63760: "CUS",
    2301: "CIE",
    335557: "ADT",
    282538: "GRA",
    2307: "AAT",
    2312: "SBO",
    33895: "SHU",
    252254: "CHA",
    458584: "GAR",
    87854: "UTC",
    213609: "COM",
    511206: "JPA",
    1082002: "CAJ",
    492848: "MOQ",
}

def get_team_tricode(team_id: Optional[int], team_name: Optional[str]) -> str:
    """Resolve 3-letter uppercase tricode for a team."""
    if team_id and team_id in TEAM_TRICODES:
        return TEAM_TRICODES[team_id]
    if not team_name:
        return "L1"
    name = team_name.lower()
    if "alianza lima" in name: return "ALI"
    if "universitario" in name: return "UNI"
    if "cristal" in name: return "CRI"
    if "melgar" in name: return "MEL"
    if "cusco" in name: return "CUS"
    if "cienciano" in name: return "CIE"
    if "adt" in name or "tarma" in name: return "ADT"
    if "grau" in name: return "GRA"
    if "sullana" in name or "atlético" in name or "atletico" in name: return "AAT"
    if "boys" in name: return "SBO"
    if "huancayo" in name: return "SHU"
    if "chankas" in name: return "CHA"
    if "garcilaso" in name: return "GAR"
    if "utc" in name: return "UTC"
    if "comerciantes" in name: return "COM"
    if "juan pablo" in name: return "JPA"
    if "cajamarca" in name: return "CAJ"
    if "moquegua" in name: return "MOQ"
    return team_name[:3].upper()

def get_team_matches(
    db: sqlite3.Connection,
    team_id: int,
    tournament: Optional[str] = "all"
) -> Optional[List[Dict[str, Any]]]:
    """Fetch all played matches for a team with scores, opponent info, and formatted labels."""
    team_row = db.execute("SELECT name FROM teams WHERE team_id = ?", (team_id,)).fetchone()
    if not team_row:
        return None

    tourn_clause = ""
    params: List[Any] = [team_id, team_id]
    if tournament and tournament.strip().lower() in ("apertura", "clausura"):
        norm_tourn = "Apertura" if tournament.strip().lower() == "apertura" else "Clausura"
        tourn_clause = "AND CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END = ?"
        params.append(norm_tourn)

    query = f"""
        SELECT 
            m.match_id,
            m.round,
            m.match_date,
            m.home_team_id,
            m.away_team_id,
            m.home_score,
            m.away_score,
            CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END as tournament,
            ht.name as ht_name,
            ht.short_name as ht_short_name,
            at.name as at_name,
            at.short_name as at_short_name
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.team_id
        JOIN teams at ON m.away_team_id = at.team_id
        WHERE (m.home_team_id = ? OR m.away_team_id = ?) 
          AND m.status = 'played'
          AND m.season_id = 88529
          {tourn_clause}
        ORDER BY m.match_date DESC, m.round DESC
    """
    rows = db.execute(query, params).fetchall()

    results = []
    for r in rows:
        is_home = (r["home_team_id"] == team_id)
        opp_id = r["away_team_id"] if is_home else r["home_team_id"]
        opp_name = (r["at_short_name"] or r["at_name"]) if is_home else (r["ht_short_name"] or r["ht_name"])
        opp_tri = get_team_tricode(opp_id, opp_name)
        team_score = r["home_score"] if is_home else r["away_score"]
        opp_score = r["away_score"] if is_home else r["home_score"]

        rnd = r["round"]
        prefix = f"F{rnd}: " if rnd is not None else ""
        score_str = f" ({team_score}-{opp_score})" if team_score is not None and opp_score is not None else ""
        label = f"{prefix}vs {opp_name}{score_str}"

        date_str = r["match_date"][:10] if r["match_date"] else ""

        results.append({
            "match_id": r["match_id"],
            "round": rnd,
            "tournament": r["tournament"],
            "date": date_str,
            "opponent_id": opp_id,
            "opponent_name": opp_name,
            "opponent_tricode": opp_tri,
            "is_home": is_home,
            "team_score": team_score,
            "opponent_score": opp_score,
            "label": label
        })

    return results

def get_team_pass_network(
    db: sqlite3.Connection,
    team_id: int,
    tournament: Optional[str] = "all",
    match_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Compute pass network for a team's Base XI (cumulative tournament scope)
    or for a single match (exact 11 starters of that fixture).
    Calculates average (x, y) coordinates for nodes and successful pass volume between pairs.
    """
    team_row = db.execute("SELECT name FROM teams WHERE team_id = ?", (team_id,)).fetchone()
    if not team_row:
        return None

    # Case A: Single match pass network
    if match_id is not None:
        match_row = db.execute("""
            SELECT match_id, match_date, home_team_id, away_team_id,
                   CASE WHEN strftime('%m', match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END as tournament
            FROM matches
            WHERE match_id = ? AND (home_team_id = ? OR away_team_id = ?) AND status = 'played'
        """, (match_id, team_id, team_id)).fetchone()
        if not match_row:
            return None
        match_tourn = match_row["tournament"]

        # Select exact 11 starters of that specific fixture (ordered by minutes played & pass count)
        xi_query = """
            SELECT 
                pms.player_id,
                p.name,
                p.shirt_number,
                pms.minutes_played
            FROM player_match_stats pms
            JOIN players p ON pms.player_id = p.player_id
            WHERE pms.match_id = ? AND pms.team_id = ?
            ORDER BY 
                pms.minutes_played DESC,
                (SELECT COUNT(*) FROM player_passes pp WHERE pp.match_id = pms.match_id AND pp.player_id = pms.player_id) DESC,
                pms.player_id ASC
            LIMIT 11
        """
        xi_rows = db.execute(xi_query, (match_id, team_id)).fetchall()
        if not xi_rows:
            return {
                "team_id": team_id,
                "tournament": match_tourn,
                "match_id": match_id,
                "nodes": [],
                "edges": []
            }

        xi_ids = [r["player_id"] for r in xi_rows]
        placeholders = ",".join("?" * len(xi_ids))

        # Query spatial pass statistics ONLY for those 11 players in this match
        stats_query = f"""
            SELECT 
                pp.player_id,
                COUNT(pp.id) as total_passes_attempted,
                SUM(CASE WHEN pp.is_successful = 1 THEN 1 ELSE 0 END) as successful_passes,
                ROUND(AVG(pp.x_start), 1) as x,
                ROUND(AVG(pp.y_start), 1) as y
            FROM player_passes pp
            WHERE pp.match_id = ? AND pp.player_id IN ({placeholders})
            GROUP BY pp.player_id
        """
        stats_rows = db.execute(stats_query, [match_id] + xi_ids).fetchall()
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

        # Successful passes made ONLY by those 11 players in this match
        passes_query = f"""
            SELECT pp.player_id, pp.x_end, pp.y_end
            FROM player_passes pp
            WHERE pp.match_id = ? AND pp.is_successful = 1
              AND pp.player_id IN ({placeholders})
        """
        passes_rows = db.execute(passes_query, [match_id] + xi_ids).fetchall()

        edges_dict = defaultdict(int)
        for p in passes_rows:
            passer_id = p["player_id"]
            x_end = p["x_end"]
            y_end = p["y_end"]
            if x_end is None or y_end is None:
                continue

            candidates = [pid for pid in xi_ids if pid != passer_id]
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
            "tournament": match_tourn,
            "match_id": match_id,
            "nodes": nodes,
            "edges": edges
        }

    # Case B: Cumulative tournament scope (default)
    tourn_clause = ""
    params: List[Any] = [team_id]
    normalized_tourn = "all"
    if tournament and tournament.strip().lower() in ("apertura", "clausura"):
        normalized_tourn = "Apertura" if tournament.strip().lower() == "apertura" else "Clausura"
        tourn_clause = "AND CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END = ?"
        params.append(normalized_tourn)

    # 1. Strictly query Top 11 players by total minutes played
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
            "match_id": None,
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
        "match_id": None,
        "nodes": nodes,
        "edges": edges
    }


def _get_team_defensive_actions_impl(
    db: sqlite3.Connection,
    team_id: int,
    tournament: str = "all",
    match_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """Internal implementation for defensive data retrieval and block height calculations."""
    team_row = db.execute("SELECT name FROM teams WHERE team_id = ?", (team_id,)).fetchone()
    if not team_row:
        return None

    # Case A: Single match defensive actions
    if match_id is not None:
        match_row = db.execute("""
            SELECT match_id, match_date, home_team_id, away_team_id,
                   CASE WHEN strftime('%m', match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END as tournament
            FROM matches
            WHERE match_id = ? AND (home_team_id = ? OR away_team_id = ?) AND status = 'played'
        """, (match_id, team_id, team_id)).fetchone()
        if not match_row:
            return None
        scope_tournament = match_row["tournament"]
        scope_match_id = match_id

        query = """
            SELECT 
                pda.id as event_id,
                pda.action_type,
                pda.x,
                pda.y,
                p.name as player_name,
                p.shirt_number as jersey,
                p.position_group
            FROM player_defensive_actions pda
            JOIN player_match_stats pms ON pda.match_id = pms.match_id AND pda.player_id = pms.player_id
            JOIN players p ON pda.player_id = p.player_id
            JOIN matches m ON pda.match_id = m.match_id
            WHERE pms.team_id = ? AND pda.match_id = ?
              AND m.status = 'played'
              AND LOWER(pda.action_type) IN (
                  'tackle', 'won_tackle', 'lost_tackle', 'interception', 'clearance',
                  'block', 'blocked_pass', 'ball-recovery', 'recovery', 'foul', 'foul-committed', 'foul_committed'
              )
            ORDER BY pda.id ASC
        """
        rows = db.execute(query, (team_id, match_id)).fetchall()

    # Case B: Cumulative tournament scope
    else:
        tourn_clause = ""
        params: List[Any] = [team_id]
        normalized_tourn = "all"
        if tournament and tournament.strip().lower() in ("apertura", "clausura"):
            normalized_tourn = "Apertura" if tournament.strip().lower() == "apertura" else "Clausura"
            tourn_clause = "AND CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END = ?"
            params.append(normalized_tourn)

        scope_tournament = normalized_tourn
        scope_match_id = None

        query = f"""
            SELECT 
                pda.id as event_id,
                pda.action_type,
                pda.x,
                pda.y,
                p.name as player_name,
                p.shirt_number as jersey,
                p.position_group
            FROM player_defensive_actions pda
            JOIN player_match_stats pms ON pda.match_id = pms.match_id AND pda.player_id = pms.player_id
            JOIN players p ON pda.player_id = p.player_id
            JOIN matches m ON pda.match_id = m.match_id
            WHERE pms.team_id = ?
              AND m.status = 'played'
              AND LOWER(pda.action_type) IN (
                  'tackle', 'won_tackle', 'lost_tackle', 'interception', 'clearance',
                  'block', 'blocked_pass', 'ball-recovery', 'recovery', 'foul', 'foul-committed', 'foul_committed'
              )
              {tourn_clause}
            ORDER BY pda.id ASC
        """
        rows = db.execute(query, params).fetchall()

    events = []
    gk_flags = []
    for r in rows:
        raw_action = (r["action_type"] or "").strip().lower()
        is_gk = (r["position_group"] or "").strip().lower() == "goalkeeper"
        is_success = True

        if raw_action in ("won_tackle", "tackle"):
            ev_type = "won_tackle"
            is_success = True
        elif raw_action == "lost_tackle":
            ev_type = "lost_tackle"
            is_success = False
        elif raw_action == "interception":
            ev_type = "interception"
            is_success = True
        elif raw_action == "clearance":
            ev_type = "clearance"
            is_success = True
        elif raw_action in ("block", "blocked_pass"):
            ev_type = "blocked_pass"
            is_success = True
        elif "recovery" in raw_action:
            ev_type = "recovery"
            is_success = True
        elif "foul" in raw_action:
            ev_type = "foul"
            is_success = False
        else:
            continue

        norm_x = round(max(0.0, min(100.0, float(r["x"]))), 1) if r["x"] is not None else 50.0
        norm_y = round(max(0.0, min(100.0, float(r["y"]))), 1) if r["y"] is not None else 50.0
        jersey = int(r["jersey"]) if r["jersey"] is not None and r["jersey"] > 0 else None

        events.append({
            "event_id": r["event_id"],
            "type": ev_type,
            "x": norm_x,
            "y": norm_y,
            "is_success": is_success,
            "player_name": r["player_name"],
            "jersey": jersey
        })
        gk_flags.append(is_gk)

    # Opta Line of Engagement / Block Height methodology:
    # 1. Exclude clearances (type != 'clearance')
    # 2. Exclude passive goalkeeper recoveries deep in the 6-yard box (x <= 6.0)
    engagement_x = []
    for ev, is_gk_flag in zip(events, gk_flags):
        if ev["type"] == "clearance":
            continue
        if ev["type"] == "recovery" and is_gk_flag and ev["x"] <= 6.0:
            continue
        engagement_x.append(ev["x"])

    if engagement_x:
        avg_x = round(sum(engagement_x) / len(engagement_x), 1)
    elif events:
        non_clearances = [e["x"] for e in events if e["type"] != "clearance"]
        avg_x = round(sum(non_clearances) / len(non_clearances), 1) if non_clearances else round(sum(e["x"] for e in events) / len(events), 1)
    else:
        avg_x = 0.0

    block_height_m = round((avg_x / 100.0) * 105.0, 1)

    if avg_x >= 46.0:
        block_classification = "Presión Alta / Bloque Alto"
    elif avg_x >= 38.0:
        block_classification = "Bloque Medio"
    else:
        block_classification = "Bloque Bajo / Repliegue"

    total_events = len(events)
    won_tackles = sum(1 for e in events if e["type"] == "won_tackle")
    lost_tackles = sum(1 for e in events if e["type"] == "lost_tackle")
    interceptions = sum(1 for e in events if e["type"] == "interception")
    clearances = sum(1 for e in events if e["type"] == "clearance")
    blocked_passes = sum(1 for e in events if e["type"] == "blocked_pass")
    recoveries = sum(1 for e in events if e["type"] == "recovery")
    high_recoveries = sum(1 for e in events if e["type"] == "recovery" and e["x"] > 65.0)

    total_tackles = won_tackles + lost_tackles
    tackles_won_pct = round((won_tackles / total_tackles) * 100.0, 1) if total_tackles > 0 else 0.0

    summary = {
        "total_events": total_events,
        "won_tackles": won_tackles,
        "lost_tackles": lost_tackles,
        "interceptions": interceptions,
        "clearances": clearances,
        "blocked_passes": blocked_passes,
        "recoveries": recoveries,
        "high_recoveries": high_recoveries,
        "tackles_won_pct": tackles_won_pct
    }

    return {
        "team_id": team_id,
        "tournament": scope_tournament,
        "match_id": scope_match_id,
        "events": events,
        "avg_x": avg_x,
        "block_height_pct": avg_x,
        "block_height_m": block_height_m,
        "tactical_classification": block_classification,
        "block_classification": block_classification,
        "summary": summary
    }


def get_team_defensive_actions(
    db: Any,
    team_id: Optional[int] = None,
    tournament: str = "all",
    match_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Retrieve defensive actions (tackles, interceptions, recoveries, fouls)
    and compute block height and defensive summary metrics.

    Supports both signatures:
    - get_team_defensive_actions(db, team_id, tournament='all', match_id=None)
    - get_team_defensive_actions(team_id, tournament='all', match_id=None)
    """
    if isinstance(db, int):
        actual_team_id = db
        if isinstance(team_id, str):
            actual_tournament = team_id
        else:
            actual_tournament = tournament

        if isinstance(team_id, int):
            actual_match_id = team_id
        elif isinstance(tournament, int):
            actual_match_id = tournament
        else:
            actual_match_id = match_id

        from ..core.config import settings
        with sqlite3.connect(f"file:{settings.DB_PATH}?mode=ro", uri=True) as local_db:
            local_db.row_factory = sqlite3.Row
            return _get_team_defensive_actions_impl(local_db, actual_team_id, actual_tournament, actual_match_id)
    else:
        return _get_team_defensive_actions_impl(db, team_id, tournament, match_id)


