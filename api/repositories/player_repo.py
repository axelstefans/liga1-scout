import sqlite3
from typing import Optional, List, Dict, Any

def get_player_profile(db: sqlite3.Connection, player_id: int) -> Optional[Dict[str, Any]]:
    """Fetch base player profile including team and market value."""
    query = """
        SELECT 
            p.player_id, p.name, p.date_of_birth, p.nationality,
            p.position, p.position_group, p.shirt_number,
            t.team_id, t.name as team_name, t.short_name as team_short_name, t.logo_url as team_logo_url,
            pmv.market_value_eur, pmv.market_value_str
        FROM players p
        LEFT JOIN teams t ON p.team_id = t.team_id
        LEFT JOIN player_market_values pmv ON p.player_id = pmv.player_id
        WHERE p.player_id = ?
    """
    row = db.execute(query, (player_id,)).fetchone()
    if not row:
        return None
        
    data = dict(row)
    
    # Restructure into nested team object
    profile = {
        "player_id": data["player_id"],
        "name": data["name"],
        "date_of_birth": data["date_of_birth"],
        "nationality": data["nationality"],
        "position": data["position"],
        "position_group": data["position_group"],
        "shirt_number": data["shirt_number"],
        "market_value_eur": data["market_value_eur"],
        "market_value_str": data["market_value_str"]
    }
    
    if data["team_id"]:
        profile["team"] = {
            "team_id": data["team_id"],
            "name": data["team_name"],
            "short_name": data["team_short_name"],
            "logo_url": data["team_logo_url"]
        }
        
    return profile

def search_players(db: sqlite3.Connection, query: str) -> List[Dict[str, Any]]:
    """Search for players by name."""
    sql = """
        SELECT 
            p.player_id, p.name, p.position_group,
            t.name as team_name, t.logo_url as team_logo_url
        FROM players p
        LEFT JOIN teams t ON p.team_id = t.team_id
        WHERE p.name LIKE ?
        ORDER BY p.name ASC
        LIMIT 20
    """
    rows = db.execute(sql, (f"%{query}%",)).fetchall()
    return [dict(row) for row in rows]

def get_player_season_stats(db: sqlite3.Connection, player_id: int) -> Optional[Dict[str, Any]]:
    """Fetch aggregate season stats for a player."""
    query = """
        SELECT *
        FROM player_season_stats
        WHERE player_id = ?
    """
    row = db.execute(query, (player_id,)).fetchone()
    return dict(row) if row else None

def get_player_match_stats(db: sqlite3.Connection, player_id: int) -> List[Dict[str, Any]]:
    """Fetch match-by-match stats for a player, including match details and opponent."""
    query = """
        SELECT 
            pms.match_id,
            m.match_date,
            pms.minutes_played,
            pms.sofascore_rating,
            pms.goals,
            pms.assists,
            pms.shots_on_target,
            pms.accurate_passes_pct,
            -- Determine if player's team was home
            CASE WHEN m.home_team_id = pms.team_id THEN 1 ELSE 0 END as is_home,
            -- Determine opponent name
            CASE WHEN m.home_team_id = pms.team_id THEN away_t.name ELSE home_t.name END as opponent_name
        FROM player_match_stats pms
        JOIN matches m ON pms.match_id = m.match_id
        JOIN teams home_t ON m.home_team_id = home_t.team_id
        JOIN teams away_t ON m.away_team_id = away_t.team_id
        WHERE pms.player_id = ?
        ORDER BY m.match_date DESC
    """
    rows = db.execute(query, (player_id,)).fetchall()
    
    results = []
    for row in rows:
        d = dict(row)
        d['is_home'] = bool(d['is_home'])
        results.append(d)
        
    return results
