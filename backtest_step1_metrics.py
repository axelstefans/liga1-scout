import sqlite3
import pandas as pd

def obtener_metricas_equipo_original(conn, team_name, is_home):
    """Old implementation that accidentally leaks future data"""
    columna_xGF = "home_xGF" if is_home else "away_xGF"
    columna_xGA = "away_xGF" if is_home else "home_xGF"
    team_id_col = "home_team_id" if is_home else "away_team_id"
    
    query = f"""
    WITH CleanStats AS (
        SELECT match_id, player_id, MAX(COALESCE(expected_goals, 0)) AS xG
        FROM player_match_stats GROUP BY match_id, player_id
    ),
    PlayerCounts AS (
        SELECT c.match_id, p.team_id, COUNT(c.player_id) as num_players
        FROM CleanStats c JOIN players p ON c.player_id = p.player_id GROUP BY c.match_id, p.team_id
    ),
    ValidMatchTeams AS (
        SELECT match_id, team_id FROM PlayerCounts WHERE num_players >= 10
    ),
    MatchTeam_xG AS (
        SELECT v.match_id, v.team_id, SUM(c.xG) AS team_xg
        FROM ValidMatchTeams v JOIN players p ON v.team_id = p.team_id
        JOIN CleanStats c ON p.player_id = c.player_id AND v.match_id = c.match_id
        GROUP BY v.match_id, v.team_id
    )
    SELECT 
        AVG(t1.team_xg) AS xGF,
        AVG(t2.team_xg) AS xGA
    FROM matches m
    JOIN MatchTeam_xG t1 ON m.match_id = t1.match_id AND m.{team_id_col} = t1.team_id
    JOIN MatchTeam_xG t2 ON m.match_id = t2.match_id AND m.{'away_team_id' if is_home else 'home_team_id'} = t2.team_id
    JOIN teams t ON t1.team_id = t.team_id
    WHERE t.name LIKE ?
    """
    return pd.read_sql_query(query, conn, params=(f'%{team_name}%',)).iloc[0]

def obtener_metricas_equipo_historico(conn, team_name, is_home, target_date):
    """New point-in-time safe implementation"""
    team_id_col = "home_team_id" if is_home else "away_team_id"
    opp_team_id_col = "away_team_id" if is_home else "home_team_id"
    
    query = f"""
    WITH CleanStats AS (
        SELECT match_id, player_id, MAX(COALESCE(expected_goals, 0)) AS xG
        FROM player_match_stats GROUP BY match_id, player_id
    ),
    PlayerCounts AS (
        SELECT c.match_id, p.team_id, COUNT(c.player_id) as num_players
        FROM CleanStats c JOIN players p ON c.player_id = p.player_id GROUP BY c.match_id, p.team_id
    ),
    ValidMatchTeams AS (
        SELECT match_id, team_id FROM PlayerCounts WHERE num_players >= 10
    ),
    MatchTeam_xG AS (
        SELECT v.match_id, v.team_id, SUM(c.xG) AS team_xg
        FROM ValidMatchTeams v JOIN players p ON v.team_id = p.team_id
        JOIN CleanStats c ON p.player_id = c.player_id AND v.match_id = c.match_id
        GROUP BY v.match_id, v.team_id
    )
    SELECT 
        AVG(t1.team_xg) AS xGF,
        AVG(t2.team_xg) AS xGA,
        COUNT(m.match_id) AS matches_played
    FROM matches m
    JOIN MatchTeam_xG t1 ON m.match_id = t1.match_id AND m.{team_id_col} = t1.team_id
    JOIN MatchTeam_xG t2 ON m.match_id = t2.match_id AND m.{opp_team_id_col} = t2.team_id
    JOIN teams t ON t1.team_id = t.team_id
    WHERE t.name LIKE ? AND m.match_date < ?
    """
    return pd.read_sql_query(query, conn, params=(f'%{team_name}%', target_date)).iloc[0]

if __name__ == '__main__':
    conn = sqlite3.connect('liga1.db')
    team = 'Universitario'
    
    print("="*60)
    print(f" TESTING POINT-IN-TIME LOGIC FOR: {team}")
    print("="*60)
    
    # 3 sample dates from 2026 (the only season with expected_goals populated)
    dates_to_test = [
        '2026-03-01T00:00:00', 
        '2026-06-01T00:00:00', 
        '2027-01-01T00:00:00'
    ]
    
    for d in dates_to_test:
        stats = obtener_metricas_equipo_historico(conn, team, is_home=True, target_date=d)
        print(f"Target Date: {d}")
        print(f"  -> Matches Played: {stats['matches_played']}")
        xgf = stats['xGF']
        xga = stats['xGA']
        print(f"  -> xGF: {xgf:.2f}" if pd.notna(xgf) else "  -> xGF: None")
        print(f"  -> xGA: {xga:.2f}" if pd.notna(xga) else "  -> xGA: None")
        print("-" * 40)
        
    print("\n" + "="*60)
    print(" BEFORE/AFTER COMPARISON FOR A PAST DATE: 2026-06-01")
    print("="*60)
    
    # Old logic (leaks data)
    old_stats = obtener_metricas_equipo_original(conn, team, is_home=True)
    
    # New logic
    new_stats = obtener_metricas_equipo_historico(conn, team, is_home=True, target_date='2026-06-01T00:00:00')
    
    print(f"OLD LOGIC (Leaky):")
    print(f"  -> xGF: {old_stats['xGF']:.2f} | xGA: {old_stats['xGA']:.2f}")
    
    print(f"\nNEW LOGIC (Point-in-time safe up to 2024-01-01):")
    print(f"  -> Matches Played: {new_stats['matches_played']}")
    print(f"  -> xGF: {new_stats['xGF']:.2f} | xGA: {new_stats['xGA']:.2f}")
    
    conn.close()
