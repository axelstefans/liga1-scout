import sqlite3
from typing import List, Dict, Any, Optional
from datetime import datetime, date

# Metrics that are counting / volume stats and should be normalized Per 90:
# Formula: ROUND((CAST(COALESCE(stat_col, 0) AS FLOAT) / pss.minutes_played) * 90.0, 2)
VOLUME_STATS = {
    # --- MÉTRICAS ORIGINALES ---
    "goals": "pss.goals",
    "assists": "pss.assists",
    "expected_goals": "pss.expected_goals",
    "shots_on_target": "pss.shots_on_target",
    "total_shots": "pss.total_shots",
    "successful_dribbles": "pss.successful_dribbles",
    "accurate_passes": "pss.accurate_passes",
    "ground_duels_won": "pss.ground_duels_won",
    "aerial_duels_won": "pss.aerial_duels_won",
    "key_passes": "pss.key_passes",
    "interceptions": "pss.interceptions",
    "clearances": "pss.clearances",
    "crosses": "pss.accurate_crosses",
    "total_crosses": "COALESCE(pss.total_crosses, pss.accurate_crosses)",
    "accurate_crosses": "pss.accurate_crosses",
    "tackles": "pss.tackles",
    "saves": "pss.saves",
    "clean_sheets": "pss.clean_sheets",
    
    # --- MÉTRICAS ADICIONALES ---
    "big_chances_missed": "pss.big_chances_missed",
    "accurate_final_third_passes": "pss.accurate_final_third_passes",
    "accurate_long_balls": "pss.accurate_long_balls",
    "total_duels_won": "pss.total_duels_won",
    "big_chances_created": "pss.big_chances_created",
    "was_fouled": "pss.was_fouled",
    "fouls": "pss.fouls",
}

# Metrics that are percentages and must be qualified by a minimum sample volume
# to prevent 1-attempt 100% distortions:
PERCENTAGE_STATS = {
    "accurate_passes_percentage": {
        "col": "pss.accurate_passes_percentage",
        "sample_filter": "pss.accurate_passes >= 100",
    },
    "ground_duels_won_percentage": {
        "col": "pss.ground_duels_won_percentage",
        "sample_filter": "pss.ground_duels_won >= 20",
    },
    "aerial_duels_won_percentage": {
        "col": "pss.aerial_duels_won_percentage",
        "sample_filter": "pss.aerial_duels_won >= 10",
    },
    "successful_dribbles_percentage": {
        "col": "pss.successful_dribbles_percentage",
        "sample_filter": "pss.successful_dribbles >= 10",
    },
    "total_duels_won_percentage": {
        "col": "pss.total_duels_won_percentage",
        "sample_filter": "pss.total_duels_won >= 30",
    },
    "accurate_crosses_percentage": {
        "col": "pss.accurate_crosses_percentage",
        "sample_filter": "pss.accurate_crosses >= 10",
    },
    "accurate_long_balls_percentage": {
        "col": "pss.accurate_long_balls_percentage",
        "sample_filter": "pss.accurate_long_balls >= 15",
    },
    "goal_conversion_percentage": {
        "col": "pss.goal_conversion_percentage",
        "sample_filter": "pss.total_shots >= 15",
    },
}

# Metrics that are direct numbers without per-90 conversion:
DIRECT_STATS = {
    "rating": "ROUND(pss.rating, 2)",
    "minutes_played": "pss.minutes_played",
}

# Strict whitelist of allowed fields to sort by to prevent SQL injection
ALLOWED_RANKING_STATS = {
    **{k: v for k, v in VOLUME_STATS.items()},
    **{k: v["col"] for k, v in PERCENTAGE_STATS.items()},
    **DIRECT_STATS,
}

def get_player_rankings(
    db: sqlite3.Connection,
    stat: str,
    limit: int = 10,
    position_group: Optional[str] = None,
    min_minutes: int = 450
) -> List[Dict[str, Any]]:
    """
    Fetch top players for a specific stat.
    - Applies minimum minutes threshold (default 450) to exclude insignificant sample sizes.
    - Normalizes volume/counting stats to Per 90 (P90) rounded to 2 decimal places.
    - Applies minimum sample size thresholds to percentage stats (e.g. passes >= 100).
    - Safely supports optional position_group filtering.
    """
    if stat not in ALLOWED_RANKING_STATS:
        raise ValueError(f"Stat '{stat}' is not allowed for ranking.")

    params: List[Any] = []
    where_clauses: List[str] = []

    # 1. Base minutes threshold
    if min_minutes > 0:
        where_clauses.append("pss.minutes_played >= ?")
        params.append(min_minutes)

    # 2. Position group filter
    if position_group:
        normalized_pos = position_group.strip().lower()
        if normalized_pos in ("full back", "full backs", "full-back", "full-backs", "defender", "defenders"):
            where_clauses.append("p.position_group = 'Defender'")
        elif normalized_pos in ("midfielder", "midfielders"):
            where_clauses.append("p.position_group = 'Midfielder'")
        elif normalized_pos in ("forward", "forwards", "attacker", "attackers"):
            where_clauses.append("p.position_group = 'Forward'")
        elif normalized_pos in ("goalkeeper", "goalkeepers"):
            where_clauses.append("p.position_group = 'Goalkeeper'")
        else:
            where_clauses.append("p.position_group = ?")
            params.append(position_group)

    # 3. Determine value expression, sort expression, and extra sample filters
    if stat in VOLUME_STATS:
        raw_col = VOLUME_STATS[stat]
        # P90 formula: (total / minutes_played) * 90.0
        val_expr = f"ROUND((CAST(COALESCE({raw_col}, 0) AS FLOAT) / pss.minutes_played) * 90.0, 2)"
        where_clauses.append("pss.minutes_played > 0")
        where_clauses.append(f"{raw_col} IS NOT NULL")
        order_expr = val_expr
    elif stat in PERCENTAGE_STATS:
        info = PERCENTAGE_STATS[stat]
        col = info["col"]
        val_expr = f"ROUND({col}, 2)"
        where_clauses.append(f"{col} IS NOT NULL")
        if info.get("sample_filter"):
            where_clauses.append(info["sample_filter"])
        order_expr = val_expr
    else:
        col = DIRECT_STATS[stat]
        val_expr = col
        where_clauses.append(f"{ALLOWED_RANKING_STATS[stat]} IS NOT NULL")
        order_expr = val_expr

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
    params.append(limit)

    query = f"""
        SELECT 
            p.player_id,
            p.name,
            p.date_of_birth,
            t.name as team_name,
            t.logo_url as team_logo_url,
            p.position_group,
            p.position,
            pss.minutes_played,
            ROUND(pss.accurate_passes_percentage, 2) as accurate_passes_percentage,
            {val_expr} as value
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        LEFT JOIN teams t ON p.team_id = t.team_id
        WHERE {where_sql}
        ORDER BY {order_expr} DESC
        LIMIT ?
    """

    rows = db.execute(query, tuple(params)).fetchall()

    today = date.today()
    results = []
    for idx, row in enumerate(rows):
        d = dict(row)
        d['rank'] = idx + 1
        dob = d.get('date_of_birth')
        if dob:
            try:
                b_date = datetime.strptime(str(dob)[:10], '%Y-%m-%d').date()
                d['age'] = today.year - b_date.year - ((today.month, today.day) < (b_date.month, b_date.day))
            except Exception:
                d['age'] = None
        else:
            d['age'] = None
        results.append(d)

    return results
