import sqlite3
from typing import List, Dict, Any

# Strict whitelist of allowed fields to sort by to prevent SQL injection
ALLOWED_RANKING_STATS = {
    "goals": "pss.goals",
    "assists": "pss.assists",
    "rating": "pss.rating",
    "minutes_played": "pss.minutes_played",
    "shots_on_target": "pss.shots_on_target",
    "total_shots": "pss.total_shots",
    "successful_dribbles": "pss.successful_dribbles",
    "accurate_passes_percentage": "pss.accurate_passes_percentage",
    "accurate_passes": "pss.accurate_passes",
    "ground_duels_won_percentage": "pss.ground_duels_won_percentage",
    "ground_duels_won": "pss.ground_duels_won",
    "aerial_duels_won": "pss.aerial_duels_won",
    "key_passes": "pss.key_passes",
    "interceptions": "pss.interceptions",
    "clearances": "pss.clearances",
    "crosses": "pss.accurate_crosses",
    "total_crosses": "pss.accurate_crosses",
    "accurate_crosses": "pss.accurate_crosses",
    "tackles": "pss.tackles",
    "saves": "pss.saves",
    "clean_sheets": "pss.clean_sheets"
}

def get_player_rankings(db: sqlite3.Connection, stat: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Fetch top players for a specific stat.
    Uses a strict whitelist to prevent SQL injection in the ORDER BY clause.
    """
    if stat not in ALLOWED_RANKING_STATS:
        raise ValueError(f"Stat '{stat}' is not allowed for ranking.")
        
    order_column = ALLOWED_RANKING_STATS[stat]
    
    # The ORDER BY clause is constructed safely using only whitelisted internal mapping
    query = f"""
        SELECT 
            p.player_id,
            p.name,
            t.name as team_name,
            t.logo_url as team_logo_url,
            p.position_group,
            p.position,
            pss.minutes_played,
            pss.accurate_passes_percentage,
            {order_column} as value
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        LEFT JOIN teams t ON p.team_id = t.team_id
        WHERE {order_column} IS NOT NULL
        ORDER BY {order_column} DESC
        LIMIT ?
    """
    
    rows = db.execute(query, (limit,)).fetchall()
    
    results = []
    for idx, row in enumerate(rows):
        d = dict(row)
        d['rank'] = idx + 1
        results.append(d)
        
    return results
