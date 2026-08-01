import pandas as pd

def load_xg_data(csv_path='match_team_xg.csv'):
    df = pd.read_csv(csv_path)
    home_df = df[df['is_home'] == 1][['match_id', 'match_date', 'team_id', 'team_xg']].rename(
        columns={'team_id': 'home_team_id', 'team_xg': 'home_xg'}
    )
    away_df = df[df['is_home'] == 0][['match_id', 'team_id', 'team_xg']].rename(
        columns={'team_id': 'away_team_id', 'team_xg': 'away_xg'}
    )
    matches_df = pd.merge(home_df, away_df, on='match_id', how='inner')
    return matches_df

def obtener_metricas_equipo_historico_v3(matches_df, team_id, target_date):
    """
    Point-in-time calculation using a multiplicative attack/defense strength model.
    Falls back to overall attack/defense strength (instead of splitting home/away specifically)
    to maintain a stable sample size, but scales it against proper home/away baselines.
    """
    past_matches = matches_df[matches_df['match_date'] < target_date]
    
    if len(past_matches) == 0:
        return {'matches_played': 0, 'attack_strength': None, 'defense_strength': None, 'league_avg_home_xg': None, 'league_avg_away_xg': None}
    
    # 1. Compute Point-in-Time League Baselines
    league_avg_home_xg = past_matches['home_xg'].mean()
    league_avg_away_xg = past_matches['away_xg'].mean()
    league_avg_overall = (league_avg_home_xg + league_avg_away_xg) / 2
    
    # 2. Extract Team matches (overall, to avoid small sample size issues)
    home_games = past_matches[past_matches['home_team_id'] == team_id]
    away_games = past_matches[past_matches['away_team_id'] == team_id]
    
    total_matches = len(home_games) + len(away_games)
    
    if total_matches == 0:
        return {'matches_played': 0, 'attack_strength': None, 'defense_strength': None, 'league_avg_home_xg': league_avg_home_xg, 'league_avg_away_xg': league_avg_away_xg}
        
    team_total_xgf = home_games['home_xg'].sum() + away_games['away_xg'].sum()
    team_total_xga = home_games['away_xg'].sum() + away_games['home_xg'].sum()
    
    team_avg_xgf = team_total_xgf / total_matches
    team_avg_xga = team_total_xga / total_matches
    
    # 3. Compute strengths relative to the league average
    # We use overall attack/defense relative to the overall league average.
    # This prevents extreme variance from teams who only played a few home games so far.
    attack_strength = team_avg_xgf / league_avg_overall if league_avg_overall > 0 else 1.0
    defense_strength = team_avg_xga / league_avg_overall if league_avg_overall > 0 else 1.0
    
    return {
        'matches_played': total_matches,
        'attack_strength': attack_strength,
        'defense_strength': defense_strength,
        'league_avg_home_xg': league_avg_home_xg,
        'league_avg_away_xg': league_avg_away_xg
    }
