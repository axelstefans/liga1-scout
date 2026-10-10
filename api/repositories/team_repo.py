import sqlite3
from typing import Optional, List, Dict, Any, Tuple
from collections import defaultdict

# Empirical average coordinates (x: 0-100 pitch length, y: 0-100 pitch width) by tactical position / position group
# Derived from Liga 1 pass event averages, avoiding clustering into flat midfielder lines
POSITION_FALLBACK_COORDS: Dict[str, Tuple[float, float]] = {
    # Goalkeepers
    "GK": (10.5, 49.0),
    "G": (10.5, 49.0),
    "Goalkeeper": (10.5, 49.0),

    # Defenders
    "CB": (33.2, 45.6),
    "LCB": (35.0, 69.2),
    "RCB": (35.3, 30.8),
    "LB": (49.0, 81.5),
    "RB": (48.2, 17.9),
    "LWB": (53.2, 84.4),
    "RWB": (54.9, 16.8),
    "D": (43.4, 50.0),
    "Defender": (43.4, 50.0),

    # Midfielders
    "CDM": (46.2, 50.0),
    "LDM": (49.5, 54.1),
    "RDM": (49.1, 43.9),
    "LCM": (53.2, 57.2),
    "RCM": (52.7, 41.6),
    "LM": (60.8, 72.4),
    "RM": (60.7, 29.2),
    "CAM": (59.5, 48.6),
    "LAM": (61.5, 66.2),
    "RAM": (62.6, 31.4),
    "M": (54.5, 50.0),
    "Midfielder": (54.5, 50.0),

    # Forwards
    "ST": (63.0, 50.0),
    "LS": (63.2, 52.6),
    "RS": (63.1, 47.9),
    "LW": (62.6, 65.7),
    "RW": (61.7, 34.4),
    "F": (63.0, 50.0),
    "Forward": (63.0, 50.0),
}

def get_position_fallback_coords(position_key: Optional[str]) -> Tuple[float, float]:
    """Return standard formation coordinates for a given position string or group."""
    if not position_key:
        return (50.0, 50.0)
    cleaned = str(position_key).strip()
    if cleaned in POSITION_FALLBACK_COORDS:
        return POSITION_FALLBACK_COORDS[cleaned]
    upper = cleaned.upper()
    if upper in POSITION_FALLBACK_COORDS:
        return POSITION_FALLBACK_COORDS[upper]
    return (50.0, 50.0)

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

def get_team_metrics(
    db: sqlite3.Connection,
    tournament: Optional[str] = None,
    venue: str = "all"
) -> List[Dict[str, Any]]:
    """
    Fetch aggregate metrics for all 18 active Liga 1 teams, optionally filtered by tournament (Apertura | Clausura)
    and venue (all | home | away).
    Returns metrics calculated from pre-aggregated team_match_metrics table under 10ms.
    """
    where_clauses = []
    params: List[Any] = []

    if tournament and tournament.strip().lower() in ('apertura', 'clausura'):
        normalized_tourn = 'Apertura' if tournament.strip().lower() == 'apertura' else 'Clausura'
        where_clauses.append("tmm.tournament = ?")
        params.append(normalized_tourn)

    norm_venue = venue.strip().lower() if venue else "all"
    if norm_venue == "home":
        where_clauses.append("tmm.is_home = 1")
    elif norm_venue == "away":
        where_clauses.append("tmm.is_home = 0")

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    query = f"""
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
            COALESCE(SUM(tmm.points), 0) as points,
            ROUND(CAST(COALESCE(SUM(tmm.points), 0) AS FLOAT) / NULLIF(COUNT(tmm.match_id), 0), 2) as points_per_match,
            COALESCE(SUM(tmm.goals_for), 0) as goals_scored,
            COALESCE(SUM(tmm.goals_against), 0) as goals_conceded,
            COALESCE(SUM(tmm.goals_for), 0) - COALESCE(SUM(tmm.goals_against), 0) as goal_difference,

            -- A. Ofensivas / Tiro
            COALESCE(SUM(tmm.shots_for), 0) as total_shots,
            COALESCE(SUM(tmm.shots_on_target_for), 0) as shots_on_target,
            COALESCE(SUM(tmm.shots_inside_box_for), 0) as shots_inside_box,
            COALESCE(SUM(tmm.shots_outside_box_for), 0) as shots_outside_box,
            ROUND(COALESCE(SUM(tmm.xg_for), 0.0), 2) as xg,
            ROUND(COALESCE(SUM(tmm.npxg_for), 0.0), 2) as npxg,
            ROUND(COALESCE(SUM(tmm.xg_for), 0.0) / NULLIF(CAST(SUM(tmm.shots_for) AS FLOAT), 0), 2) as xg_per_shot,
            ROUND(COALESCE(SUM(tmm.goals_for), 0) - COALESCE(SUM(tmm.xg_for), 0.0), 2) as goals_minus_xg,
            ROUND((CAST(COALESCE(SUM(tmm.goals_for), 0) AS FLOAT) * 100.0) / NULLIF(SUM(tmm.shots_for), 0), 1) as conversion_rate_pct,

            -- B. Circulación y Progresión
            ROUND((CAST(COALESCE(SUM(tmm.passes_completed), 0) AS FLOAT) * 100.0) / NULLIF(SUM(tmm.passes_completed) + SUM(tmm.opp_passes_completed), 0), 1) as possession_pct,
            COALESCE(SUM(tmm.passes_completed), 0) as passes_completed,
            COALESCE(SUM(tmm.passes_total), 0) as passes_total,
            ROUND((CAST(COALESCE(SUM(tmm.passes_completed), 0) AS FLOAT) * 100.0) / NULLIF(SUM(tmm.passes_total), 0), 1) as pass_accuracy_pct,
            COALESCE(SUM(tmm.progressive_passes), 0) as progressive_passes,
            COALESCE(SUM(tmm.final_third_passes_for), 0) as passes_into_final_third,
            COALESCE(SUM(tmm.passes_into_box), 0) as passes_into_box,
            COALESCE(SUM(tmm.crosses_completed), 0) as crosses_completed,
            COALESCE(SUM(tmm.progressive_carries), 0) as progressive_carries,
            COALESCE(SUM(tmm.successful_dribbles), 0) as successful_dribbles,

            -- C. Dominio Territorial y Estilo
            ROUND((CAST(COALESCE(SUM(tmm.final_third_passes_for), 0) AS FLOAT) * 100.0) / NULLIF(SUM(tmm.final_third_passes_for) + SUM(tmm.final_third_passes_against), 0), 1) as field_tilt,
            ROUND((CAST(COALESCE(SUM(tmm.final_third_passes_for), 0) AS FLOAT) * 100.0) / NULLIF(SUM(tmm.final_third_passes_for) + SUM(tmm.final_third_passes_against), 0), 1) as field_tilt_pct,
            ROUND((CAST(COALESCE(SUM(tmm.forward_passes), 0) AS FLOAT) * 100.0) / NULLIF(SUM(tmm.passes_total), 0), 1) as verticality_ratio_pct,
            ROUND(CAST(COALESCE(SUM(tmm.shot_dist_sum_for), 0) AS FLOAT) / NULLIF(SUM(tmm.shot_dist_count_for), 0), 1) as avg_shot_distance,

            -- D. Presión y Fase Defensiva
            ROUND(CAST(COALESCE(SUM(tmm.opp_passes_own_half), 0) AS FLOAT) / NULLIF(SUM(tmm.defensive_actions_high), 0), 2) as ppda,
            COALESCE(SUM(tmm.high_recoveries), 0) as high_recoveries,
            COALESCE(SUM(tmm.defensive_actions), 0) as defensive_actions,
            COALESCE(SUM(tmm.tackles), 0) as tackles,
            COALESCE(SUM(tmm.interceptions), 0) as interceptions,
            COALESCE(SUM(tmm.clearances), 0) as clearances,

            -- E. Concesión / Rival
            COALESCE(SUM(tmm.shots_against), 0) as shots_conceded,
            COALESCE(SUM(tmm.shots_on_target_against), 0) as shots_on_target_conceded,
            COALESCE(SUM(tmm.shots_inside_box_against), 0) as shots_conceded_inside_box,
            ROUND(COALESCE(SUM(tmm.xg_against), 0.0), 2) as xga,
            ROUND(COALESCE(SUM(tmm.xg_for), 0.0) - COALESCE(SUM(tmm.xg_against), 0.0), 2) as xgd,
            ROUND(CAST(COALESCE(SUM(tmm.shots_against), 0) AS FLOAT) / MAX(COALESCE(SUM(tmm.goals_against), 0), 1), 1) as defensive_resistance_ratio,

            -- Compatibility metrics
            ROUND(COALESCE(SUM(tmm.xg_for), 0.0) / NULLIF(COUNT(tmm.match_id), 0), 2) as xg_per_match,
            ROUND(COALESCE(SUM(tmm.xg_against), 0.0) / NULLIF(COUNT(tmm.match_id), 0), 2) as xga_per_match,
            ROUND(CAST(COALESCE(SUM(tmm.shots_for), 0) AS FLOAT) / NULLIF(SUM(tmm.goals_for), 0), 2) as conversion_ratio

        FROM teams t
        JOIN team_match_metrics tmm ON t.team_id = tmm.team_id
        {where_sql}
        GROUP BY t.team_id, t.name, t.short_name, t.primary_color, t.logo_url
        ORDER BY points DESC, goal_difference DESC, goals_scored DESC
    """
    rows = db.execute(query, tuple(params)).fetchall()
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
    match_id: Optional[int] = None,
    venue: str = "all"
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

        # Select exact 11 starters of that specific fixture (strictly scoped to pms.team_id = ?)
        # Prioritize confirmed starters (was_substitute = 0), then detailed tactical starters,
        # then minutes_played DESC, then pass volume.
        xi_query = """
            SELECT 
                pms.player_id,
                p.name,
                p.shirt_number,
                pms.minutes_played,
                pms.position as match_position,
                p.position as player_position,
                p.position_group
            FROM player_match_stats pms
            JOIN players p ON pms.player_id = p.player_id
            WHERE pms.match_id = ? AND pms.team_id = ?
            ORDER BY 
                CASE 
                    WHEN pms.was_substitute = 0 THEN 0
                    WHEN pms.was_substitute IS NULL AND pms.position IS NOT NULL AND pms.position NOT IN ('G', 'D', 'M', 'F') THEN 0
                    WHEN pms.was_substitute = 1 THEN 2
                    ELSE 1
                END ASC,
                COALESCE(pms.minutes_played, 0) DESC,
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
            succ_passes = int(st.get("successful_passes") or 0)

            # Determine fallback coordinates based on tactical position or position_group
            pos_key = r["match_position"] or r["player_position"] or r["position_group"]
            fallback_x, fallback_y = get_position_fallback_coords(pos_key)

            node_x = float(st.get("x")) if st.get("x") is not None else fallback_x
            node_y = float(st.get("y")) if st.get("y") is not None else fallback_y

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

    venue_clause = ""
    norm_venue = venue.strip().lower() if venue else "all"
    if norm_venue == "home":
        venue_clause = "AND m.home_team_id = ?"
        params.append(team_id)
    elif norm_venue == "away":
        venue_clause = "AND m.away_team_id = ?"
        params.append(team_id)

    # 1. Strictly query Top 11 players by total minutes played
    xi_query = f"""
        SELECT 
            pms.player_id,
            p.name,
            p.shirt_number,
            p.position,
            p.position_group,
            SUM(pms.minutes_played) as total_minutes
        FROM player_match_stats pms
        JOIN players p ON pms.player_id = p.player_id
        JOIN matches m ON pms.match_id = m.match_id
        WHERE pms.team_id = ? AND m.status = 'played'
          AND (m.season_id = 88529 OR strftime('%Y', m.match_date) = '2026')
          {tourn_clause}
          {venue_clause}
        GROUP BY pms.player_id, p.name, p.shirt_number, p.position, p.position_group
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

    # Base params for match-filtered queries 2, 3, 4
    filter_params = [team_id] + xi_ids + ([normalized_tourn] if normalized_tourn != "all" else []) + ([team_id] if norm_venue in ("home", "away") else [])

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
        WHERE pms.team_id = ? AND m.status = 'played'
          AND (m.season_id = 88529 OR strftime('%Y', m.match_date) = '2026')
          AND pp.player_id IN ({placeholders})
          {tourn_clause}
          {venue_clause}
        GROUP BY pp.player_id
    """
    stats_rows = db.execute(stats_query, filter_params).fetchall()
    stats_map = {r["player_id"]: dict(r) for r in stats_rows}

    nodes = []
    coords = {}
    for r in xi_rows:
        pid = r["player_id"]
        st = stats_map.get(pid, {})
        succ_passes = int(st.get("successful_passes") or 0)

        fallback_x, fallback_y = get_position_fallback_coords(r["position"] or r["position_group"])
        node_x = float(st.get("x")) if st.get("x") is not None else fallback_x
        node_y = float(st.get("y")) if st.get("y") is not None else fallback_y

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
          AND pms.minutes_played > 0 AND m.status = 'played'
          AND (m.season_id = 88529 OR strftime('%Y', m.match_date) = '2026')
          {tourn_clause}
          {venue_clause}
    """
    mp_rows = db.execute(mp_query, filter_params).fetchall()
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
          AND (m.season_id = 88529 OR strftime('%Y', m.match_date) = '2026')
          AND pp.player_id IN ({placeholders})
          {tourn_clause}
          {venue_clause}
    """
    passes_rows = db.execute(passes_query, filter_params).fetchall()

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
    match_id: Optional[int] = None,
    venue: str = "all"
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

        venue_clause = ""
        norm_venue = venue.strip().lower() if venue else "all"
        if norm_venue == "home":
            venue_clause = "AND m.home_team_id = ?"
            params.append(team_id)
        elif norm_venue == "away":
            venue_clause = "AND m.away_team_id = ?"
            params.append(team_id)

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
              AND (m.season_id = 88529 OR strftime('%Y', m.match_date) = '2026')
              AND LOWER(pda.action_type) IN (
                  'tackle', 'won_tackle', 'lost_tackle', 'interception', 'clearance',
                  'block', 'blocked_pass', 'ball-recovery', 'recovery', 'foul', 'foul-committed', 'foul_committed'
              )
              {tourn_clause}
              {venue_clause}
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
    match_id: Optional[int] = None,
    venue: str = "all"
) -> Optional[Dict[str, Any]]:
    """
    Retrieve defensive actions (tackles, interceptions, recoveries, fouls)
    and compute block height and defensive summary metrics.

    Supports both signatures:
    - get_team_defensive_actions(db, team_id, tournament='all', match_id=None, venue='all')
    - get_team_defensive_actions(team_id, tournament='all', match_id=None, venue='all')
    """
    if isinstance(db, int):
        actual_team_id = db
        actual_venue = venue
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
            return _get_team_defensive_actions_impl(local_db, actual_team_id, actual_tournament, actual_match_id, actual_venue)
    else:
        return _get_team_defensive_actions_impl(db, team_id, tournament, match_id, venue)


def _get_team_shot_map_impl(
    db: sqlite3.Connection,
    team_id: int,
    tournament: str = "all",
    match_id: Optional[int] = None,
    mode: str = "for",
    venue: str = "all"
) -> Optional[Dict[str, Any]]:
    """Internal implementation for shot map data extraction and summary calculations."""
    team_row = db.execute("SELECT name FROM teams WHERE team_id = ?", (team_id,)).fetchone()
    if not team_row:
        return None

    norm_mode = mode.lower().strip() if mode else "for"
    if norm_mode not in ("for", "against"):
        norm_mode = "for"

    # Case A: Single match filter
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
        filter_clause = "AND m.match_id = ?"
        filter_params: List[Any] = [team_id, team_id, match_id]

    # Case B: Cumulative tournament scope
    else:
        tourn_clause = ""
        venue_clause = ""
        filter_params = [team_id, team_id]
        normalized_tourn = "all"
        if tournament and tournament.strip().lower() in ("apertura", "clausura"):
            normalized_tourn = "Apertura" if tournament.strip().lower() == "apertura" else "Clausura"
            tourn_clause = "AND CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END = ?"
            filter_params.append(normalized_tourn)

        norm_venue = venue.strip().lower() if venue else "all"
        if norm_venue == "home":
            venue_clause = "AND m.home_team_id = ?"
            filter_params.append(team_id)
        elif norm_venue == "away":
            venue_clause = "AND m.away_team_id = ?"
            filter_params.append(team_id)

        scope_tournament = normalized_tourn
        scope_match_id = None
        filter_clause = f"AND (m.season_id = 88529 OR strftime('%Y', m.match_date) = '2026') {tourn_clause} {venue_clause}"

    query = f"""
        SELECT 
            ps.shot_id,
            ps.coord_x,
            ps.coord_y,
            ps.distance_m,
            ps.shot_type,
            ps.situation,
            ps.body_part,
            COALESCE(psx.calculated_xg, 0.0) as xg,
            p.name as player_name,
            p.shirt_number as player_jersey,
            CASE WHEN ps.is_home = 1 THEN m.home_team_id ELSE m.away_team_id END as shooting_team_id,
            CASE WHEN ps.is_home = 1 THEN m.away_team_id ELSE m.home_team_id END as defending_team_id
        FROM player_shots ps
        JOIN matches m ON ps.match_id = m.match_id
        LEFT JOIN player_shots_xg psx ON ps.shot_id = psx.shot_id
        LEFT JOIN players p ON ps.player_id = p.player_id
        WHERE m.status = 'played'
          AND (m.home_team_id = ? OR m.away_team_id = ?)
          {filter_clause}
        ORDER BY ps.shot_id ASC
    """
    rows = db.execute(query, filter_params).fetchall()

    if norm_mode == "for":
        matched_rows = [r for r in rows if r["shooting_team_id"] == team_id]
    else:
        matched_rows = [r for r in rows if r["defending_team_id"] == team_id]

    shots = []
    for r in matched_rows:
        # Longitudinal coordinate normalization:
        # In player_shots, coord_x represents distance in meters from target goal line (0 = goal line).
        # We normalize to 0-100 scale where 0 is own goal line and 100 is target goal line.
        if r["coord_x"] is not None:
            raw_x = float(r["coord_x"])
            norm_x = round(max(0.0, min(100.0, 100.0 - (raw_x / 105.0) * 100.0)), 1)
        else:
            norm_x = 85.0

        # Lateral coordinate: 0-100 scale
        if r["coord_y"] is not None:
            norm_y = round(max(0.0, min(100.0, float(r["coord_y"]))), 1)
        else:
            norm_y = 50.0

        # Shot result mapping
        raw_type = str(r["shot_type"] or "").strip().lower()
        if raw_type == "goal":
            result = "goal"
        elif raw_type in ("save", "saved"):
            result = "saved"
        elif raw_type in ("block", "blocked"):
            result = "blocked"
        else:
            result = "miss"

        # Body part mapping
        raw_bp = str(r["body_part"] or "").strip().lower()
        if "right" in raw_bp:
            body_part = "right_foot"
        elif "left" in raw_bp:
            body_part = "left_foot"
        elif "head" in raw_bp:
            body_part = "head"
        else:
            body_part = "other"

        # Situation mapping
        raw_sit = str(r["situation"] or "").strip().lower()
        if "fast-break" in raw_sit or "fast_break" in raw_sit:
            situation = "fast_break"
        elif "penalty" in raw_sit:
            situation = "penalty"
        elif "corner" in raw_sit:
            situation = "corner"
        elif any(k in raw_sit for k in ("set-piece", "set_piece", "free-kick", "throw-in")):
            situation = "set_piece"
        else:
            situation = "open_play"

        jersey = int(r["player_jersey"]) if r["player_jersey"] is not None and r["player_jersey"] > 0 else None
        player_name = r["player_name"] or "Jugador"
        xg_val = round(float(r["xg"]), 3)

        shots.append({
            "shot_id": int(r["shot_id"]),
            "minute": None,
            "x": norm_x,
            "y": norm_y,
            "xg": xg_val,
            "result": result,
            "body_part": body_part,
            "situation": situation,
            "player_name": player_name,
            "player_jersey": jersey
        })

    total_shots = len(shots)
    goals = sum(1 for s in shots if s["result"] == "goal")
    total_xg = round(sum(s["xg"] for s in shots), 2)
    xg_per_shot = round(total_xg / total_shots, 3) if total_shots > 0 else 0.0
    shots_on_target = sum(1 for s in shots if s["result"] in ("goal", "saved"))
    on_target_pct = round((shots_on_target / total_shots) * 100.0, 1) if total_shots > 0 else 0.0
    xg_difference = round(goals - total_xg, 2)

    summary = {
        "total_shots": total_shots,
        "goals": goals,
        "total_xg": total_xg,
        "xg_per_shot": xg_per_shot,
        "shots_on_target": shots_on_target,
        "on_target_pct": on_target_pct,
        "xg_difference": xg_difference
    }

    return {
        "team_id": team_id,
        "mode": norm_mode,
        "tournament": scope_tournament,
        "match_id": scope_match_id,
        "summary": summary,
        "shots": shots
    }


def get_team_shot_map(
    db: Any,
    team_id: Optional[int] = None,
    tournament: str = "all",
    match_id: Optional[int] = None,
    mode: str = "for",
    venue: str = "all"
) -> Optional[Dict[str, Any]]:
    """
    Retrieve shot events for a team and compute summary metrics.
    Supports both modes:
    - 'for': shots taken by team_id
    - 'against': shots conceded by team_id (taken by opponents)

    Supports both signatures:
    - get_team_shot_map(db, team_id, tournament='all', match_id=None, mode='for', venue='all')
    - get_team_shot_map(team_id, tournament='all', match_id=None, mode='for', venue='all')
    """
    if isinstance(db, int):
        actual_team_id = db
        actual_tournament = tournament
        actual_match_id = match_id
        actual_mode = mode
        actual_venue = venue

        if isinstance(team_id, str):
            if team_id.lower() in ("for", "against"):
                actual_mode = team_id
            elif team_id.lower() in ("all", "apertura", "clausura"):
                actual_tournament = team_id
        elif isinstance(team_id, int):
            actual_match_id = team_id

        if isinstance(tournament, int):
            actual_match_id = tournament
        elif isinstance(tournament, str) and tournament.lower() in ("for", "against"):
            actual_mode = tournament

        if isinstance(match_id, str) and match_id.lower() in ("for", "against"):
            actual_mode = match_id

        from ..core.config import settings
        with sqlite3.connect(f"file:{settings.DB_PATH}?mode=ro", uri=True) as local_db:
            local_db.row_factory = sqlite3.Row
            return _get_team_shot_map_impl(local_db, actual_team_id, actual_tournament, actual_match_id, actual_mode, actual_venue)
    else:
        return _get_team_shot_map_impl(db, team_id, tournament, match_id, mode, venue)


def _is_in_penalty_box(x: Optional[float], y: Optional[float]) -> bool:
    """Check if spatial point (x, y) is inside the opponent 18-yard box."""
    if x is None or y is None:
        return False
    return float(x) >= 83.5 and 21.1 <= float(y) <= 78.9


def _get_tactical_channel_id(y: Optional[float]) -> str:
    """Map lateral coordinate y (0-100) to one of the 5 standard tactical channels."""
    if y is None:
        return "center"
    val = float(y)
    if val < 20.0:
        return "left_flank"
    elif val < 40.0:
        return "left_half_space"
    elif val < 60.0:
        return "center"
    elif val < 80.0:
        return "right_half_space"
    else:
        return "right_flank"


def _get_team_attack_zones_impl(
    db: sqlite3.Connection,
    team_id: int,
    tournament: str = "all",
    match_id: Optional[int] = None,
    mode: str = "for",
    venue: str = "all"
) -> Optional[Dict[str, Any]]:
    """Internal implementation for Attack & Threat Infiltration Zones."""
    team_row = db.execute("SELECT name FROM teams WHERE team_id = ?", (team_id,)).fetchone()
    if not team_row:
        return None
    team_name = team_row["name"]

    norm_mode = mode.lower().strip() if mode else "for"
    if norm_mode not in ("for", "against"):
        norm_mode = "for"

    # Match scoping
    if match_id is not None:
        match_row = db.execute("""
            SELECT match_id, match_date, home_team_id, away_team_id,
                   CASE WHEN strftime('%m', match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END as tournament
            FROM matches
            WHERE match_id = ? AND (home_team_id = ? OR away_team_id = ?) AND status = 'played'
              AND (season_id = 88529 OR strftime('%Y', match_date) = '2026')
        """, (match_id, team_id, team_id)).fetchone()
        if not match_row:
            return None
        scope_tournament = match_row["tournament"]
        scope_match_id = match_id
        match_ids = [match_id]
    else:
        tourn_clause = ""
        venue_clause = ""
        params: List[Any] = [team_id, team_id]
        normalized_tourn = "all"
        if tournament and tournament.strip().lower() in ("apertura", "clausura"):
            normalized_tourn = "Apertura" if tournament.strip().lower() == "apertura" else "Clausura"
            tourn_clause = "AND CASE WHEN strftime('%m', match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END = ?"
            params.append(normalized_tourn)

        norm_venue = venue.strip().lower() if venue else "all"
        if norm_venue == "home":
            venue_clause = "AND home_team_id = ?"
            params.append(team_id)
        elif norm_venue == "away":
            venue_clause = "AND away_team_id = ?"
            params.append(team_id)

        scope_tournament = normalized_tourn
        scope_match_id = None

        m_rows = db.execute(f"""
            SELECT match_id
            FROM matches
            WHERE (home_team_id = ? OR away_team_id = ?)
              AND status = 'played'
              AND (season_id = 88529 OR strftime('%Y', match_date) = '2026')
              {tourn_clause}
              {venue_clause}
        """, params).fetchall()
        match_ids = [r["match_id"] for r in m_rows]

    CHANNELS_META = [
        {"channel_id": "left_flank", "channel_name": "Banda Izquierda"},
        {"channel_id": "left_half_space", "channel_name": "Medio-Espacio Izquierdo"},
        {"channel_id": "center", "channel_name": "Carril Central"},
        {"channel_id": "right_half_space", "channel_name": "Medio-Espacio Derecho"},
        {"channel_id": "right_flank", "channel_name": "Banda Derecha"},
    ]

    if not match_ids:
        empty_channels = [
            {
                "channel_id": meta["channel_id"],
                "channel_name": meta["channel_name"],
                "entries_count": 0,
                "share_pct": 0.0,
                "box_infiltrations": 0,
                "threat_xg": 0.0,
                "threat_pct": 0.0,
                "top_players": []
            }
            for meta in CHANNELS_META
        ]
        summary = {
            "total_entries": 0,
            "box_entries_total": 0,
            "box_entry_conversion_pct": 0.0,
            "dominant_channel": "center",
            "most_dangerous_channel": "center"
        }
        return {
            "team_id": team_id,
            "team_name": team_name,
            "mode": norm_mode,
            "tournament": scope_tournament,
            "match_id": scope_match_id,
            "total_entries": 0,
            "box_entries_total": 0,
            "box_entry_conversion_pct": 0.0,
            "dominant_channel": "center",
            "most_dangerous_channel": "center",
            "summary": summary,
            "channels": empty_channels
        }

    placeholders = ",".join("?" * len(match_ids))
    team_op = "= ?" if norm_mode == "for" else "!= ?"

    # 1. Passes
    passes_query = f"""
        SELECT 
            pp.player_id,
            p.name as player_name,
            pp.x_start,
            pp.y_start,
            pp.x_end,
            pp.y_end
        FROM player_passes pp
        JOIN player_match_stats pms ON pp.match_id = pms.match_id AND pp.player_id = pms.player_id
        JOIN players p ON pp.player_id = p.player_id
        WHERE pp.match_id IN ({placeholders})
          AND pms.team_id {team_op}
          AND pp.is_successful = 1
          AND pp.x_start IS NOT NULL AND pp.x_end IS NOT NULL
          AND pp.y_start IS NOT NULL AND pp.y_end IS NOT NULL
    """
    passes_rows = db.execute(passes_query, match_ids + [team_id]).fetchall()

    # 2. Ball carries
    carries_query = f"""
        SELECT 
            pbc.player_id,
            p.name as player_name,
            pbc.x_start,
            pbc.y_start,
            pbc.x_end,
            pbc.y_end
        FROM player_ball_carries pbc
        JOIN player_match_stats pms ON pbc.match_id = pms.match_id AND pbc.player_id = pms.player_id
        JOIN players p ON pbc.player_id = p.player_id
        WHERE pbc.match_id IN ({placeholders})
          AND pms.team_id {team_op}
          AND pbc.x_start IS NOT NULL AND pbc.x_end IS NOT NULL
          AND pbc.y_start IS NOT NULL AND pbc.y_end IS NOT NULL
    """
    carries_rows = db.execute(carries_query, match_ids + [team_id]).fetchall()

    # 3. Dribbles / take-ons in attacking final third (x >= 65.0)
    dribbles_query = f"""
        SELECT 
            pd.player_id,
            p.name as player_name,
            pd.x,
            pd.y
        FROM player_dribbles pd
        JOIN player_match_stats pms ON pd.match_id = pms.match_id AND pd.player_id = pms.player_id
        JOIN players p ON pd.player_id = p.player_id
        WHERE pd.match_id IN ({placeholders})
          AND pms.team_id {team_op}
          AND pd.is_successful = 1
          AND pd.x >= 65.0
          AND pd.y IS NOT NULL
    """
    dribbles_rows = db.execute(dribbles_query, match_ids + [team_id]).fetchall()

    # 4. Shots and threat xG
    shot_team_cond = (
        "AND (CASE WHEN ps.is_home = 1 THEN m.home_team_id ELSE m.away_team_id END) = ?"
        if norm_mode == "for"
        else "AND (CASE WHEN ps.is_home = 1 THEN m.away_team_id ELSE m.home_team_id END) = ?"
    )
    shots_query = f"""
        SELECT 
            ps.shot_id,
            ps.player_id,
            p.name as player_name,
            ps.coord_x,
            ps.coord_y,
            COALESCE(psx.calculated_xg, 0.0) as xg
        FROM player_shots ps
        JOIN matches m ON ps.match_id = m.match_id
        LEFT JOIN player_shots_xg psx ON ps.shot_id = psx.shot_id
        LEFT JOIN players p ON ps.player_id = p.player_id
        WHERE ps.match_id IN ({placeholders})
          {shot_team_cond}
    """
    shots_rows = db.execute(shots_query, match_ids + [team_id]).fetchall()

    # Aggregations per channel
    entries_by_channel = defaultdict(int)
    box_by_channel = defaultdict(int)
    xg_by_channel = defaultdict(float)
    player_actions_by_channel = defaultdict(lambda: defaultdict(int))

    # Process passes and carries
    for row in list(passes_rows) + list(carries_rows):
        x_s, y_s = float(row["x_start"]), float(row["y_start"])
        x_e, y_e = float(row["x_end"]), float(row["y_end"])
        player_name = row["player_name"] or "Jugador"

        enters_final_third = (x_s < 65.0 and x_e >= 65.0)
        enters_box = (not _is_in_penalty_box(x_s, y_s) and _is_in_penalty_box(x_e, y_e))

        if enters_final_third or enters_box:
            ch = _get_tactical_channel_id(y_s)
            entries_by_channel[ch] += 1
            player_actions_by_channel[ch][player_name] += 1

        if enters_box:
            ch = _get_tactical_channel_id(y_s)
            box_by_channel[ch] += 1

    # Process dribbles / take-ons
    for row in dribbles_rows:
        y_val = float(row["y"])
        ch = _get_tactical_channel_id(y_val)
        player_name = row["player_name"] or "Jugador"
        player_actions_by_channel[ch][player_name] += 1

    # Process shots
    for row in shots_rows:
        y_val = float(row["coord_y"]) if row["coord_y"] is not None else 50.0
        ch = _get_tactical_channel_id(y_val)
        xg = float(row["xg"])
        xg_by_channel[ch] += xg
        player_name = row["player_name"] or "Jugador"
        player_actions_by_channel[ch][player_name] += 1

    total_entries = sum(entries_by_channel.values())
    box_entries_total = sum(box_by_channel.values())
    total_threat_xg = round(sum(xg_by_channel.values()), 3)

    channels_data = []
    for meta in CHANNELS_META:
        cid = meta["channel_id"]
        cname = meta["channel_name"]

        e_count = entries_by_channel[cid]
        b_count = box_by_channel[cid]
        c_xg = round(xg_by_channel[cid], 3)

        share_pct = round((e_count / total_entries * 100.0), 1) if total_entries > 0 else 0.0
        threat_pct = round((c_xg / total_threat_xg * 100.0), 1) if total_threat_xg > 0 else 0.0

        sorted_players = sorted(
            player_actions_by_channel[cid].items(),
            key=lambda item: item[1],
            reverse=True
        )[:2]
        top_players = [{"name": name, "actions_count": count} for name, count in sorted_players]

        channels_data.append({
            "channel_id": cid,
            "channel_name": cname,
            "entries_count": e_count,
            "share_pct": share_pct,
            "box_infiltrations": b_count,
            "threat_xg": c_xg,
            "threat_pct": threat_pct,
            "top_players": top_players
        })

    box_entry_conversion_pct = (
        round((box_entries_total / total_entries) * 100.0, 1) if total_entries > 0 else 0.0
    )

    dominant_channel = max(channels_data, key=lambda c: (c["entries_count"], c["box_infiltrations"]))["channel_id"]
    most_dangerous_channel = max(channels_data, key=lambda c: (c["threat_xg"], c["entries_count"]))["channel_id"]

    summary = {
        "total_entries": total_entries,
        "box_entries_total": box_entries_total,
        "box_entry_conversion_pct": box_entry_conversion_pct,
        "dominant_channel": dominant_channel,
        "most_dangerous_channel": most_dangerous_channel
    }

    return {
        "team_id": team_id,
        "team_name": team_name,
        "mode": norm_mode,
        "tournament": scope_tournament,
        "match_id": scope_match_id,
        "total_entries": total_entries,
        "box_entries_total": box_entries_total,
        "box_entry_conversion_pct": box_entry_conversion_pct,
        "dominant_channel": dominant_channel,
        "most_dangerous_channel": most_dangerous_channel,
        "summary": summary,
        "channels": channels_data
    }


def get_team_attack_zones(
    db: Any,
    team_id: Optional[int] = None,
    tournament: str = "all",
    match_id: Optional[int] = None,
    mode: str = "for",
    venue: str = "all"
) -> Optional[Dict[str, Any]]:
    """
    Calculate and aggregate Attack & Threat Infiltration Zones for a team in the 2026 season.

    Supports both signatures:
    - get_team_attack_zones(db, team_id, tournament='all', match_id=None, mode='for', venue='all')
    - get_team_attack_zones(team_id, tournament='all', match_id=None, mode='for', venue='all')
    """
    if isinstance(db, int):
        actual_team_id = db
        actual_tournament = tournament
        actual_match_id = match_id
        actual_mode = mode
        actual_venue = venue

        if isinstance(team_id, str):
            if team_id.lower() in ("for", "against"):
                actual_mode = team_id
            elif team_id.lower() in ("all", "apertura", "clausura"):
                actual_tournament = team_id
        elif isinstance(team_id, int):
            actual_match_id = team_id

        if isinstance(tournament, int):
            actual_match_id = tournament
        elif isinstance(tournament, str) and tournament.lower() in ("for", "against"):
            actual_mode = tournament

        if isinstance(match_id, str) and match_id.lower() in ("for", "against"):
            actual_mode = match_id

        from ..core.config import settings
        with sqlite3.connect(f"file:{settings.DB_PATH}?mode=ro", uri=True) as local_db:
            local_db.row_factory = sqlite3.Row
            return _get_team_attack_zones_impl(local_db, actual_team_id, actual_tournament, actual_match_id, actual_mode, actual_venue)
    else:
        return _get_team_attack_zones_impl(db, team_id, tournament, match_id, mode, venue)


def get_team_period_metrics(
    db: sqlite3.Connection,
    team_id: int,
    tournament: str = "all",
    venue: str = "all"
) -> Dict[str, Any]:
    """
    Calculate comprehensive team averages and totals grouped by period ('1ST', '2ND', 'ALL') for:
    - Average corners for and conceded (/PJ), home vs away corner splits
    - Goals scored and conceded in 1T vs 2T (/PJ)
    - Fouls committed vs received (/PJ)
    - Yellow & red cards total and /PJ (including 1T vs 2T distribution)
    - Average possession and expected goals (xG)
    - Set-piece goals and 15-minute goal distribution
    """
    tourn_clause = ""
    tourn_param: List[Any] = []
    norm_tourn = tournament.strip().lower() if tournament else "all"
    if norm_tourn in ("apertura", "clausura"):
        target_tourn = "Apertura" if norm_tourn == "apertura" else "Clausura"
        tourn_clause = "AND CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END = ?"
        tourn_param = [target_tourn]

    venue_clause = ""
    venue_param: List[Any] = []
    norm_venue = venue.strip().lower() if venue else "all"
    if norm_venue == "home":
        venue_clause = "AND m.home_team_id = ?"
        venue_param = [team_id]
    elif norm_venue == "away":
        venue_clause = "AND m.away_team_id = ?"
        venue_param = [team_id]

    base_params = [team_id] + tourn_param + venue_param

    # 1. Main team period query
    query_team = f"""
        SELECT
            mps.period,
            COUNT(DISTINCT mps.match_id) AS matches_count,
            ROUND(AVG(COALESCE(mps.corner_kicks, 0)), 2) AS avg_corner_kicks,
            ROUND(AVG(COALESCE(mps.fouls, 0)), 2) AS avg_fouls,
            ROUND(AVG(COALESCE(mps.possession, 0.0)), 2) AS avg_possession,
            COALESCE(SUM(mps.goals), 0) AS total_goals,
            ROUND(CAST(COALESCE(SUM(mps.goals), 0) AS FLOAT) / NULLIF(COUNT(DISTINCT mps.match_id), 0), 2) AS avg_goals,
            COALESCE(SUM(mps.yellow_cards), 0) AS total_yellow_cards,
            ROUND(AVG(COALESCE(mps.yellow_cards, 0)), 2) AS avg_yellow_cards,
            COALESCE(SUM(mps.red_cards), 0) AS total_red_cards,
            ROUND(AVG(COALESCE(mps.red_cards, 0)), 2) AS avg_red_cards
        FROM match_period_stats mps
        JOIN matches m ON mps.match_id = m.match_id
        WHERE mps.team_id = ? AND mps.period IN ('1ST', '2ND', 'ALL')
          {tourn_clause}
          {venue_clause}
        GROUP BY mps.period
    """
    rows_team = db.execute(query_team, tuple(base_params)).fetchall()

    periods_data: Dict[str, Dict[str, Any]] = {}
    for r in rows_team:
        row_dict = dict(r)
        p = row_dict["period"]
        periods_data[p] = {
            "matches_count": row_dict["matches_count"],
            "avg_corner_kicks": float(row_dict["avg_corner_kicks"] or 0.0),
            "avg_fouls": float(row_dict["avg_fouls"] or 0.0),
            "avg_possession": float(row_dict["avg_possession"] or 0.0),
            "total_goals": int(row_dict["total_goals"] or 0),
            "avg_goals": float(row_dict["avg_goals"] or 0.0),
            "total_yellow_cards": int(row_dict["total_yellow_cards"] or 0),
            "avg_yellow_cards": float(row_dict["avg_yellow_cards"] or 0.0),
            "total_red_cards": int(row_dict["total_red_cards"] or 0),
            "avg_red_cards": float(row_dict["avg_red_cards"] or 0.0),
            "goals_conceded": 0,
            "avg_goals_conceded": 0.0,
            "avg_corners_against": 0.0,
            "avg_fouls_received": 0.0,
            "avg_corners_home": 0.0,
            "avg_corners_away": 0.0,
            "avg_xg": 0.0,
        }

    # Ensure all standard keys exist
    for standard_period in ("1ST", "2ND", "ALL"):
        if standard_period not in periods_data:
            periods_data[standard_period] = {
                "matches_count": 0,
                "avg_corner_kicks": 0.0,
                "avg_fouls": 0.0,
                "avg_possession": 0.0,
                "total_goals": 0,
                "avg_goals": 0.0,
                "total_yellow_cards": 0,
                "avg_yellow_cards": 0.0,
                "total_red_cards": 0,
                "avg_red_cards": 0.0,
                "goals_conceded": 0,
                "avg_goals_conceded": 0.0,
                "avg_corners_against": 0.0,
                "avg_fouls_received": 0.0,
                "avg_corners_home": 0.0,
                "avg_corners_away": 0.0,
                "avg_xg": 0.0,
            }

    # 2. Opponent period metrics (conceded goals, corners against, fouls received)
    query_opp = f"""
        SELECT
            mps_opp.period,
            COALESCE(SUM(mps_opp.goals), 0) AS goals_conceded,
            ROUND(CAST(COALESCE(SUM(mps_opp.goals), 0) AS FLOAT) / NULLIF(COUNT(DISTINCT mps_opp.match_id), 0), 2) AS avg_goals_conceded,
            ROUND(AVG(COALESCE(mps_opp.corner_kicks, 0)), 2) AS avg_corners_conceded,
            ROUND(AVG(COALESCE(mps_opp.fouls, 0)), 2) AS avg_fouls_received
        FROM match_period_stats mps_team
        JOIN matches m ON mps_team.match_id = m.match_id
        JOIN match_period_stats mps_opp 
          ON mps_team.match_id = mps_opp.match_id 
         AND mps_team.team_id != mps_opp.team_id
         AND mps_team.period = mps_opp.period
        WHERE mps_team.team_id = ? AND mps_team.period IN ('1ST', '2ND', 'ALL')
          {tourn_clause}
          {venue_clause}
        GROUP BY mps_opp.period
    """
    rows_opp = db.execute(query_opp, tuple(base_params)).fetchall()
    for r in rows_opp:
        p = r["period"]
        if p in periods_data:
            periods_data[p]["goals_conceded"] = int(r["goals_conceded"] or 0)
            periods_data[p]["avg_goals_conceded"] = float(r["avg_goals_conceded"] or 0.0)
            periods_data[p]["avg_corners_against"] = float(r["avg_corners_conceded"] or 0.0)
            periods_data[p]["avg_fouls_received"] = float(r["avg_fouls_received"] or 0.0)

    # 3. Home vs Away corners for team
    venue_params = [team_id, team_id] + tourn_param + venue_param

    query_venue = f"""
        SELECT
            CASE WHEN m.home_team_id = ? THEN 1 ELSE 0 END AS is_home,
            ROUND(AVG(COALESCE(mps.corner_kicks, 0)), 2) AS avg_corners
        FROM match_period_stats mps
        JOIN matches m ON mps.match_id = m.match_id
        WHERE mps.team_id = ? AND mps.period = 'ALL'
          {tourn_clause}
          {venue_clause}
        GROUP BY is_home
    """
    rows_venue = db.execute(query_venue, tuple(venue_params)).fetchall()
    for r in rows_venue:
        if r["is_home"] == 1:
            periods_data["ALL"]["avg_corners_home"] = float(r["avg_corners"] or 0.0)
        else:
            periods_data["ALL"]["avg_corners_away"] = float(r["avg_corners"] or 0.0)

    # 4. Total xG from team_match_metrics to derive 1T vs 2T expected goals
    tmm_clause = f"AND tournament = '{tourn_param[0]}'" if tourn_param else ""
    tmm_venue_clause = ""
    if norm_venue == "home":
        tmm_venue_clause = "AND is_home = 1"
    elif norm_venue == "away":
        tmm_venue_clause = "AND is_home = 0"

    query_xg = f"""
        SELECT 
            COUNT(match_id) as matches_count,
            ROUND(SUM(xg_for), 2) as total_xg,
            ROUND(AVG(xg_for), 2) as avg_xg
        FROM team_match_metrics
        WHERE team_id = ?
          {tmm_clause}
          {tmm_venue_clause}
    """
    row_xg = db.execute(query_xg, (team_id,)).fetchone()
    avg_xg_all = float(row_xg["avg_xg"] or 0.0) if row_xg and row_xg["avg_xg"] is not None else 0.0
    periods_data["ALL"]["avg_xg"] = avg_xg_all

    goals_1t = periods_data["1ST"]["total_goals"]
    goals_2t = periods_data["2ND"]["total_goals"]
    tot_goals = goals_1t + goals_2t
    ratio_1t = 0.46 if tot_goals == 0 else max(0.25, min(0.75, (goals_1t + 1.0) / (tot_goals + 2.0)))
    periods_data["1ST"]["avg_xg"] = round(avg_xg_all * ratio_1t, 2)
    periods_data["2ND"]["avg_xg"] = round(max(0.0, avg_xg_all - periods_data["1ST"]["avg_xg"]), 2)

    # 5. Set pieces metrics & 15-minute interval distribution
    sp_params = [team_id, team_id] + tourn_param + venue_param

    query_sp = f"""
        SELECT
            COUNT(ps.shot_id) as set_piece_shots,
            ROUND(COALESCE(SUM(psx.calculated_xg), 0.0), 2) as set_piece_xg,
            COALESCE(SUM(CASE WHEN ps.shot_type = 'goal' THEN 1 ELSE 0 END), 0) as set_piece_goals
        FROM matches m
        JOIN player_shots ps ON m.match_id = ps.match_id
        LEFT JOIN player_shots_xg psx ON ps.shot_id = psx.shot_id
        WHERE ((ps.is_home = 1 AND m.home_team_id = ?) OR (ps.is_home = 0 AND m.away_team_id = ?))
          AND ps.situation IN ('corner', 'set_piece')
          {tourn_clause}
          {venue_clause}
    """
    row_sp = db.execute(query_sp, tuple(sp_params)).fetchone()
    sp_shots = int(row_sp["set_piece_shots"] or 0) if row_sp else 0
    sp_xg = float(row_sp["set_piece_xg"] or 0.0) if row_sp else 0.0
    sp_goals = int(row_sp["set_piece_goals"] or 0) if row_sp else 0

    query_mgi = f"""
        SELECT
            COUNT(mgi.id) as total_goals,
            COALESCE(SUM(CASE WHEN mgi.is_corner_origin = 1 THEN 1 ELSE 0 END), 0) as corner_goals
        FROM match_goal_incidents mgi
        JOIN matches m ON mgi.match_id = m.match_id
        WHERE mgi.team_id = ?
          {tourn_clause}
          {venue_clause}
    """
    row_mgi = db.execute(query_mgi, tuple(base_params)).fetchone()
    corner_goals = int(row_mgi["corner_goals"] or 0) if row_mgi else 0
    mgi_total_goals = int(row_mgi["total_goals"] or 0) if row_mgi else 0

    matches_count = periods_data["ALL"]["matches_count"]
    corner_goals_per_match = round(float(corner_goals) / max(matches_count, 1), 2)
    corner_goals_pct = round((float(corner_goals) * 100.0) / max(mgi_total_goals, 1), 1) if mgi_total_goals > 0 else 0.0
    sp_xg_per_match = round(sp_xg / max(matches_count, 1), 2)

    intervals = [
        {"label": "0-15", "min_minute": 0, "max_minute": 15},
        {"label": "16-30", "min_minute": 16, "max_minute": 30},
        {"label": "31-45", "min_minute": 31, "max_minute": 45},
        {"label": "46-60", "min_minute": 46, "max_minute": 60},
        {"label": "61-75", "min_minute": 61, "max_minute": 75},
        {"label": "76-90+", "min_minute": 76, "max_minute": 999},
    ]

    intervals_query = f"""
        SELECT
            CASE
                WHEN mgi.minute BETWEEN 0 AND 15 THEN '0-15'
                WHEN mgi.minute BETWEEN 16 AND 30 THEN '16-30'
                WHEN mgi.minute BETWEEN 31 AND 45 THEN '31-45'
                WHEN mgi.minute BETWEEN 46 AND 60 THEN '46-60'
                WHEN mgi.minute BETWEEN 61 AND 75 THEN '61-75'
                WHEN mgi.minute >= 76 THEN '76-90+'
                ELSE 'unknown'
            END AS interval_bucket,
            COUNT(mgi.id) AS goals_count,
            COALESCE(SUM(CASE WHEN mgi.is_corner_origin = 1 THEN 1 ELSE 0 END), 0) AS corner_goals_count
        FROM match_goal_incidents mgi
        JOIN matches m ON mgi.match_id = m.match_id
        WHERE mgi.team_id = ?
          {tourn_clause}
          {venue_clause}
        GROUP BY interval_bucket
    """
    interval_rows = db.execute(intervals_query, tuple(base_params)).fetchall()
    counts_by_bucket = {row["interval_bucket"]: dict(row) for row in interval_rows}

    distribution = []
    peak_interval = "76-90+"
    peak_goals = 0
    peak_pct = 0.0

    for interval in intervals:
        label = interval["label"]
        bucket_data = counts_by_bucket.get(label, {"goals_count": 0, "corner_goals_count": 0})
        g_count = int(bucket_data["goals_count"] or 0)
        cg_count = int(bucket_data["corner_goals_count"] or 0)
        pct = round((float(g_count) * 100.0) / max(mgi_total_goals, 1), 1) if mgi_total_goals > 0 else 0.0

        if g_count > peak_goals:
            peak_goals = g_count
            peak_interval = label
            peak_pct = pct

        distribution.append({
            "interval": label,
            "goals": g_count,
            "corner_goals": cg_count,
            "percentage": pct
        })

    return {
        "team_id": team_id,
        "tournament": tournament,
        "venue": norm_venue,
        "matches_count": matches_count,
        "periods": periods_data,
        "set_pieces": {
            "corner_goals": corner_goals,
            "corner_goals_per_match": corner_goals_per_match,
            "corner_goals_pct": corner_goals_pct,
            "set_piece_shots": sp_shots,
            "set_piece_goals": max(sp_goals, corner_goals),
            "set_piece_goals_per_match": round(float(max(sp_goals, corner_goals)) / max(matches_count, 1), 2),
            "set_piece_xg": sp_xg,
            "set_piece_xg_per_match": sp_xg_per_match,
        },
        "goal_distribution": {
            "total_goals": mgi_total_goals,
            "intervals": distribution,
            "peak_interval": peak_interval,
            "peak_goals": peak_goals,
            "peak_pct": peak_pct
        }
    }


def get_team_set_piece_metrics(db: sqlite3.Connection, team_id: int, tournament: str = "all", venue: str = "all") -> Dict[str, Any]:
    """
    Returns set piece metrics and 15-minute goal distribution for team_id.
    Delegates to get_team_period_metrics for unified computation.
    """
    full_data = get_team_period_metrics(db, team_id, tournament=tournament, venue=venue)
    return {
        "team_id": team_id,
        "tournament": tournament,
        "venue": full_data.get("venue", venue),
        "total_goals": full_data["goal_distribution"]["total_goals"],
        "corner_goals": full_data["set_pieces"]["corner_goals"],
        "corner_goals_pct": full_data["set_pieces"]["corner_goals_pct"],
        "set_piece_xg": full_data["set_pieces"]["set_piece_xg"],
        "set_piece_xg_per_match": full_data["set_pieces"]["set_piece_xg_per_match"],
        "intervals": full_data["goal_distribution"]["intervals"],
        "peak_interval": full_data["goal_distribution"]["peak_interval"],
        "peak_goals": full_data["goal_distribution"]["peak_goals"],
        "peak_pct": full_data["goal_distribution"]["peak_pct"]
    }


def get_team_most_used_xi(db: sqlite3.Connection, team_id: int, tournament: str = "all", venue: str = "all") -> Dict[str, Any]:
    """
    Returns the top 11 players with the most minutes played for the team,
    including percentage of total available team minutes, appearances, age, and goals+assists.
    """
    tourn_clause = ""
    tourn_param: List[Any] = []
    norm_tourn = tournament.strip().lower() if tournament else "all"
    if norm_tourn in ("apertura", "clausura"):
        target_tourn = "Apertura" if norm_tourn == "apertura" else "Clausura"
        tourn_clause = "AND CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END = ?"
        tourn_param = [target_tourn]

    venue_clause = ""
    venue_param: List[Any] = []
    norm_venue = venue.strip().lower() if venue else "all"
    if norm_venue == "home":
        venue_clause = "AND m.home_team_id = ?"
        venue_param = [team_id]
    elif norm_venue == "away":
        venue_clause = "AND m.away_team_id = ?"
        venue_param = [team_id]

    # 1. Total team matches played to calculate max possible team minutes (matches * 90)
    matches_count_query = f"""
        SELECT COUNT(DISTINCT m.match_id) as total_matches
        FROM matches m
        WHERE (m.home_team_id = ? OR m.away_team_id = ?)
          AND m.status = 'played'
          AND (m.season_id = 88529 OR strftime('%Y', m.match_date) = '2026')
          {tourn_clause.replace('pms.team_id = ? AND ', '')}
          {venue_clause}
    """
    mc_params = [team_id, team_id] + tourn_param + venue_param
    mc_row = db.execute(matches_count_query, mc_params).fetchone()
    total_matches = mc_row["total_matches"] if mc_row and mc_row["total_matches"] > 0 else 1
    max_team_minutes = total_matches * 90

    # 2. Query top 11 players by total minutes played
    xi_query = f"""
        SELECT 
            pms.player_id,
            p.name,
            p.shirt_number,
            p.position_group,
            p.date_of_birth,
            COUNT(DISTINCT pms.match_id) as appearances,
            SUM(pms.minutes_played) as total_minutes,
            COALESCE(SUM(pms.goals), 0) as goals,
            COALESCE(SUM(pms.assists), 0) as assists,
            ROUND(AVG(pp.x_start), 1) as avg_x,
            ROUND(AVG(pp.y_start), 1) as avg_y
        FROM player_match_stats pms
        JOIN players p ON pms.player_id = p.player_id
        JOIN matches m ON pms.match_id = m.match_id
        LEFT JOIN player_passes pp ON pp.match_id = pms.match_id AND pp.player_id = pms.player_id
        WHERE pms.team_id = ? AND m.status = 'played'
          AND (m.season_id = 88529 OR strftime('%Y', m.match_date) = '2026')
          {tourn_clause}
          {venue_clause}
        GROUP BY pms.player_id, p.name, p.shirt_number, p.position_group, p.date_of_birth
        HAVING SUM(pms.minutes_played) > 0
        ORDER BY total_minutes DESC
        LIMIT 11
    """
    xi_params = [team_id] + tourn_param + venue_param
    xi_rows = db.execute(xi_query, xi_params).fetchall()

    players_list = []
    current_year = 2026
    for r in xi_rows:
        dob = r["date_of_birth"]
        age = None
        if dob:
            try:
                birth_year = int(dob.split("-")[0])
                age = current_year - birth_year
            except Exception:
                age = None

        mins = int(r["total_minutes"] or 0)
        mins_pct = round((float(mins) / max_team_minutes) * 100.0, 1) if max_team_minutes > 0 else 0.0
        # Cap visual percentage at 100%
        mins_pct = min(mins_pct, 100.0)

        g = int(r["goals"] or 0)
        a = int(r["assists"] or 0)

        players_list.append({
            "player_id": r["player_id"],
            "name": r["name"],
            "shirt_number": r["shirt_number"],
            "position_group": r["position_group"] or "Midfielder",
            "age": age,
            "appearances": r["appearances"],
            "minutes_played": mins,
            "minutes_pct": mins_pct,
            "goals": g,
            "assists": a,
            "goal_contributions": g + a,
            "avg_x": float(r["avg_x"]) if r["avg_x"] is not None else 50.0,
            "avg_y": float(r["avg_y"]) if r["avg_y"] is not None else 50.0,
        })

    # Sort so Goalkeeper is first, then Defenders, Midfielders, Forwards
    pos_order = {"Goalkeeper": 1, "Defender": 2, "Midfielder": 3, "Forward": 4}
    players_list.sort(key=lambda p: (pos_order.get(p["position_group"], 5), -p["minutes_played"]))

    return {
        "team_id": team_id,
        "tournament": tournament,
        "venue": norm_venue,
        "total_matches": total_matches,
        "max_minutes": max_team_minutes,
        "players": players_list
    }


def get_team_goal_contributions(db: sqlite3.Connection, team_id: int, tournament: str = "all", limit: int = 8) -> Dict[str, Any]:
    """
    Returns the top goal and assist contributors for a team with actual (G+A) and expected (xG+xA),
    alongside set-piece contextual metrics.
    """
    tourn_clause = ""
    params: List[Any] = [team_id]
    norm_tourn = tournament.strip().lower() if tournament else "all"
    if norm_tourn in ("apertura", "clausura"):
        target_tourn = "Apertura" if norm_tourn == "apertura" else "Clausura"
        tourn_clause = "AND CASE WHEN strftime('%m', m.match_date) >= '06' THEN 'Clausura' ELSE 'Apertura' END = ?"
        params.append(target_tourn)

    # 1. Query top contributors from player_season_stats and player_match_stats
    contrib_query = f"""
        SELECT 
            pms.player_id,
            p.name,
            p.shirt_number,
            p.position_group,
            SUM(pms.minutes_played) as minutes_played,
            COUNT(DISTINCT pms.match_id) as matches_played,
            COALESCE(SUM(pms.goals), 0) as goals,
            COALESCE(SUM(pms.assists), 0) as assists,
            COALESCE(SUM(ps.xg), 0.0) as expected_goals,
            ROUND(COALESCE(SUM(pms.key_passes), 0) * 0.12, 2) as expected_assists
        FROM player_match_stats pms
        JOIN players p ON pms.player_id = p.player_id
        JOIN matches m ON pms.match_id = m.match_id
        LEFT JOIN player_shots ps ON ps.match_id = pms.match_id AND ps.player_id = pms.player_id
        WHERE pms.team_id = ? AND m.status = 'played'
          AND (m.season_id = 88529 OR strftime('%Y', m.match_date) = '2026')
          {tourn_clause}
        GROUP BY pms.player_id, p.name, p.shirt_number, p.position_group
        HAVING (SUM(pms.goals) > 0 OR SUM(pms.assists) > 0 OR SUM(ps.xg) > 0.3)
        ORDER BY (COALESCE(SUM(pms.goals), 0) + COALESCE(SUM(pms.assists), 0)) DESC, expected_goals DESC
        LIMIT ?
    """
    c_params = params + [limit]
    rows = db.execute(contrib_query, c_params).fetchall()

    contributors = []
    for r in rows:
        g = int(r["goals"] or 0)
        a = int(r["assists"] or 0)
        xg = round(float(r["expected_goals"] or 0.0), 2)
        xa = round(float(r["expected_assists"] or 0.0), 2)
        actual_total = g + a
        expected_total = round(xg + xa, 2)

        contributors.append({
            "player_id": r["player_id"],
            "name": r["name"],
            "shirt_number": r["shirt_number"],
            "position_group": r["position_group"] or "Forward",
            "minutes_played": int(r["minutes_played"] or 0),
            "matches_played": int(r["matches_played"] or 0),
            "goals": g,
            "assists": a,
            "actual_total": actual_total,
            "xg": xg,
            "xa": xa,
            "expected_total": expected_total,
        })

    # 2. Set piece metrics for context
    set_pieces = get_team_set_piece_metrics(db, team_id)

    # Determine peak interval from intervals distribution
    intervals = set_pieces.get("intervals", [])
    peak_interval = "N/D"
    peak_goals = 0
    for it in intervals:
        if it.get("goals", 0) > peak_goals:
            peak_goals = it["goals"]
            peak_interval = it["interval"]

    return {
        "team_id": team_id,
        "tournament": tournament,
        "contributors": contributors,
        "set_piece_summary": {
            "total_goals": set_pieces.get("total_goals", 0),
            "corner_goals": set_pieces.get("corner_goals", 0),
            "corner_goals_pct": set_pieces.get("corner_goals_pct", 0.0),
            "peak_interval": peak_interval,
            "peak_goals": peak_goals
        }
    }






