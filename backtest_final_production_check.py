import pandas as pd
import sqlite3
import numpy as np
from api.services.poisson_service import calculate_match_odds, _get_all_matches_xg

def main():
    MIN_MATCHES_HISTORY = 5
    conn = sqlite3.connect('liga1.db')
    
    query = """
        SELECT m.match_id, m.match_date, m.season_id, 
               m.home_team_id, m.away_team_id,
               th.name as home_team_name, ta.name as away_team_name,
               m.home_score, m.away_score
        FROM matches m
        JOIN teams th ON m.home_team_id = th.team_id
        JOIN teams ta ON m.away_team_id = ta.team_id
        WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
        ORDER BY m.match_date ASC
    """
    matches_db = pd.read_sql_query(query, conn)
    xg_df = pd.read_csv('match_team_xg.csv')
    valid_match_ids = xg_df['match_id'].unique()
    matches_db = matches_db[matches_db['match_id'].isin(valid_match_ids)]
    
    print(f"Starting Final Production check over {len(matches_db)} available matches...")
    
    full_matches_df = _get_all_matches_xg(conn)
    results = []
    
    for idx, row in matches_db.iterrows():
        match_id = row['match_id']
        date = row['match_date']
        season_id = row['season_id']
        h_team = row['home_team_name']
        a_team = row['away_team_name']
        h_team_id = row['home_team_id']
        a_team_id = row['away_team_id']
        
        past_matches = full_matches_df[full_matches_df['match_date'] < date]
        h_history = len(past_matches[past_matches['home_team_id'] == h_team_id]) + len(past_matches[past_matches['away_team_id'] == h_team_id])
        a_history = len(past_matches[past_matches['home_team_id'] == a_team_id]) + len(past_matches[past_matches['away_team_id'] == a_team_id])
        
        if h_history < MIN_MATCHES_HISTORY or a_history < MIN_MATCHES_HISTORY:
            continue
            
        try:
            odds = calculate_match_odds(conn, h_team, a_team, target_date=date)
        except Exception as e:
            continue
            
        prob_home = odds['probabilities_percent']['home'] / 100
        prob_draw = odds['probabilities_percent']['draw'] / 100
        prob_away = odds['probabilities_percent']['away'] / 100
        
        prob_over_25 = odds['probabilities_percent']['over_25'] / 100
        prob_under_25 = odds['probabilities_percent']['under_25'] / 100
        
        lambda_home = odds['projected_goals']['home']
        lambda_away = odds['projected_goals']['away']
        
        results.append({
            'match_id': match_id,
            'match_date': date,
            'season_id': season_id,
            'home_team': h_team,
            'away_team': a_team,
            'prob_home': prob_home,
            'prob_draw': prob_draw,
            'prob_away': prob_away,
            'lambda_home': lambda_home,
            'lambda_away': lambda_away,
            'prob_over_25': prob_over_25,
            'prob_under_25': prob_under_25,
            'actual_home_score': int(row['home_score']),
            'actual_away_score': int(row['away_score'])
        })
        
    conn.close()
    results_df = pd.DataFrame(results)
    results_df.to_csv('backtest_results_production_final.csv', index=False)
    print(f"Saved {len(results_df)} simulated matches to backtest_results_production_final.csv")
    
if __name__ == '__main__':
    main()
