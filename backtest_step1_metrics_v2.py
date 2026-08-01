import pandas as pd
import sqlite3

def load_xg_data(csv_path='match_team_xg.csv'):
    """
    Loads match_team_xg.csv and pivots it so each match is a single row 
    with home_team_id, away_team_id, home_xg, away_xg.
    """
    df = pd.read_csv(csv_path)
    
    home_df = df[df['is_home'] == 1][['match_id', 'match_date', 'team_id', 'team_xg']].rename(
        columns={'team_id': 'home_team_id', 'team_xg': 'home_xg'}
    )
    away_df = df[df['is_home'] == 0][['match_id', 'team_id', 'team_xg']].rename(
        columns={'team_id': 'away_team_id', 'team_xg': 'away_xg'}
    )
    
    matches_df = pd.merge(home_df, away_df, on='match_id', how='inner')
    return matches_df

def obtener_metricas_equipo_historico_v2(matches_df, team_id, target_date):
    """
    Point-in-time safe calculation of a team's xGF and xGA.
    It only looks at matches strictly before target_date.
    """
    # 1. Filter by date
    past_matches = matches_df[matches_df['match_date'] < target_date]
    
    # 2. Extract Home matches
    home_games = past_matches[past_matches['home_team_id'] == team_id]
    home_xgf = home_games['home_xg'].sum()
    home_xga = home_games['away_xg'].sum()
    home_count = len(home_games)
    
    # 3. Extract Away matches
    away_games = past_matches[past_matches['away_team_id'] == team_id]
    away_xgf = away_games['away_xg'].sum()
    away_xga = away_games['home_xg'].sum()
    away_count = len(away_games)
    
    total_matches = home_count + away_count
    
    if total_matches == 0:
        return {'matches_played': 0, 'xGF': None, 'xGA': None}
        
    avg_xgf = (home_xgf + away_xgf) / total_matches
    avg_xga = (home_xga + away_xga) / total_matches
    
    return {
        'matches_played': total_matches,
        'xGF': avg_xgf,
        'xGA': avg_xga
    }

if __name__ == '__main__':
    matches_df = load_xg_data('match_team_xg.csv')
    conn = sqlite3.connect('liga1.db')
    
    # Fetch proper team names and IDs from DB to use in our test
    teams_query = "SELECT team_id, name FROM teams WHERE name IN ('Universitario de Deportes', 'Alianza Lima', 'Club Sporting Cristal')"
    teams = pd.read_sql_query(teams_query, conn)
    
    test_cases = [
        # Date in 2023 season
        {'name': 'Universitario de Deportes', 'target_date': '2023-09-01T00:00:00'},
        # Date in 2024 season
        {'name': 'Alianza Lima', 'target_date': '2024-05-01T00:00:00'},
        # Date in 2025 season
        {'name': 'Club Sporting Cristal', 'target_date': '2025-10-01T00:00:00'}
    ]
    
    print("="*60)
    print(" POINT-IN-TIME LOGIC WITH CSV SOURCE (v2)")
    print("="*60)
    
    for case in test_cases:
        team_name = case['name']
        # Extract ID safely
        matching_teams = teams[teams['name'] == team_name]
        if matching_teams.empty:
            print(f"Error: Could not find team ID for {team_name}")
            continue
        team_id = matching_teams.iloc[0]['team_id']
        target_date = case['target_date']
        
        stats = obtener_metricas_equipo_historico_v2(matches_df, team_id, target_date)
        
        print(f"Team: {team_name}")
        print(f"Target Date: {target_date}")
        print(f"  -> Matches Played (before date): {stats['matches_played']}")
        if stats['matches_played'] > 0:
            print(f"  -> Avg xGF: {stats['xGF']:.2f}")
            print(f"  -> Avg xGA: {stats['xGA']:.2f}")
        else:
            print("  -> Avg xGF: None\n  -> Avg xGA: None")
        print("-" * 40)
        
    conn.close()
