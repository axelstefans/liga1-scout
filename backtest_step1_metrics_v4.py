import pandas as pd
import sqlite3

def load_xg_data(csv_path='match_team_xg.csv'):
    df = pd.read_csv(csv_path)
    
    # Compute dynamic scaling factor
    conn = sqlite3.connect('liga1.db')
    query = """
        SELECT match_id, home_score, away_score
        FROM matches
        WHERE home_score IS NOT NULL AND away_score IS NOT NULL
    """
    matches_db = pd.read_sql_query(query, conn)
    conn.close()
    
    # Only keep matches that are in our xG dataframe
    valid_match_ids = df['match_id'].unique()
    matches_db = matches_db[matches_db['match_id'].isin(valid_match_ids)]
    
    # For apples-to-apples scaling, we should only sum xG for the matches we just found scores for
    df_filtered = df[df['match_id'].isin(matches_db['match_id'])]
    
    total_actual_goals = matches_db['home_score'].sum() + matches_db['away_score'].sum()
    total_xg = df_filtered['team_xg'].sum()
    
    scaling_factor = total_actual_goals / total_xg if total_xg > 0 else 1.0
    print(f"Computed dynamic scaling factor: {scaling_factor:.4f} ({total_actual_goals} actual goals / {total_xg:.2f} total xG)")
    
    # Scale the raw xG BEFORE structuring it
    df['team_xg'] = df['team_xg'] * scaling_factor
    
    home_df = df[df['is_home'] == 1][['match_id', 'match_date', 'team_id', 'team_xg']].rename(
        columns={'team_id': 'home_team_id', 'team_xg': 'home_xg'}
    )
    away_df = df[df['is_home'] == 0][['match_id', 'team_id', 'team_xg']].rename(
        columns={'team_id': 'away_team_id', 'team_xg': 'away_xg'}
    )
    matches_df = pd.merge(home_df, away_df, on='match_id', how='inner')
    return matches_df

def obtener_metricas_equipo_historico_v4(matches_df, team_id, target_date):
    past_matches = matches_df[matches_df['match_date'] < target_date]
    
    if len(past_matches) == 0:
        return {'matches_played': 0, 'attack_strength': None, 'defense_strength': None, 'league_avg_home_xg': None, 'league_avg_away_xg': None}
    
    league_avg_home_xg = past_matches['home_xg'].mean()
    league_avg_away_xg = past_matches['away_xg'].mean()
    league_avg_overall = (league_avg_home_xg + league_avg_away_xg) / 2
    
    home_games = past_matches[past_matches['home_team_id'] == team_id]
    away_games = past_matches[past_matches['away_team_id'] == team_id]
    
    total_matches = len(home_games) + len(away_games)
    
    if total_matches == 0:
        return {'matches_played': 0, 'attack_strength': None, 'defense_strength': None, 'league_avg_home_xg': league_avg_home_xg, 'league_avg_away_xg': league_avg_away_xg}
        
    team_total_xgf = home_games['home_xg'].sum() + away_games['away_xg'].sum()
    team_total_xga = home_games['away_xg'].sum() + away_games['home_xg'].sum()
    
    team_avg_xgf = team_total_xgf / total_matches
    team_avg_xga = team_total_xga / total_matches
    
    attack_strength = team_avg_xgf / league_avg_overall if league_avg_overall > 0 else 1.0
    defense_strength = team_avg_xga / league_avg_overall if league_avg_overall > 0 else 1.0
    
    return {
        'matches_played': total_matches,
        'attack_strength': attack_strength,
        'defense_strength': defense_strength,
        'league_avg_home_xg': league_avg_home_xg,
        'league_avg_away_xg': league_avg_away_xg
    }
