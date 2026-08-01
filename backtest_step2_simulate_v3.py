import pandas as pd
import sqlite3
import numpy as np
from scipy.stats import poisson
import backtest_step1_metrics_v4 as metrics_v4

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
    
    matches_xg_pivot = metrics_v4.load_xg_data('match_team_xg.csv')
    
    results = []
    print(f"Starting V3 simulation over {len(matches_db)} available matches...")
    
    for idx, row in matches_db.iterrows():
        match_id = row['match_id']
        date = row['match_date']
        season_id = row['season_id']
        h_team_id = row['home_team_id']
        a_team_id = row['away_team_id']
        
        h_stats = metrics_v4.obtener_metricas_equipo_historico_v4(matches_xg_pivot, h_team_id, date)
        a_stats = metrics_v4.obtener_metricas_equipo_historico_v4(matches_xg_pivot, a_team_id, date)
        
        if h_stats['matches_played'] < MIN_MATCHES_HISTORY or a_stats['matches_played'] < MIN_MATCHES_HISTORY:
            continue
            
        if pd.isna(h_stats['attack_strength']) or pd.isna(a_stats['attack_strength']):
            continue
            
        lambda_home = h_stats['attack_strength'] * a_stats['defense_strength'] * h_stats['league_avg_home_xg']
        lambda_away = a_stats['attack_strength'] * h_stats['defense_strength'] * h_stats['league_avg_away_xg']
        
        max_goles = 6
        prob_matrix = np.zeros((max_goles, max_goles))
        for i in range(max_goles):
            for j in range(max_goles):
                prob_matrix[i][j] = poisson.pmf(i, lambda_home) * poisson.pmf(j, lambda_away)
                
        prob_home = np.sum(np.tril(prob_matrix, -1))
        prob_draw = np.sum(np.diag(prob_matrix))
        prob_away = np.sum(np.triu(prob_matrix, 1))
        
        prob_over_25 = 0
        prob_under_25 = 0
        for i in range(max_goles):
            for j in range(max_goles):
                if (i + j) > 2.5:
                    prob_over_25 += prob_matrix[i][j]
                else:
                    prob_under_25 += prob_matrix[i][j]
                    
        results.append({
            'match_id': match_id,
            'match_date': date,
            'season_id': season_id,
            'home_team': row['home_team_name'],
            'away_team': row['away_team_name'],
            'prob_home': round(float(prob_home), 4),
            'prob_draw': round(float(prob_draw), 4),
            'prob_away': round(float(prob_away), 4),
            'lambda_home': round(float(lambda_home), 4),
            'lambda_away': round(float(lambda_away), 4),
            'prob_over_25': round(float(prob_over_25), 4),
            'prob_under_25': round(float(prob_under_25), 4),
            'actual_home_score': int(row['home_score']),
            'actual_away_score': int(row['away_score'])
        })

    conn.close()
    results_df = pd.DataFrame(results)
    results_df.to_csv('backtest_results_v3.csv', index=False)
    print(f"Saved {len(results_df)} simulated matches to backtest_results_v3.csv")

if __name__ == '__main__':
    main()
