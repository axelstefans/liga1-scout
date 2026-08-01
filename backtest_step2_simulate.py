import pandas as pd
import sqlite3
import numpy as np
from scipy.stats import poisson
import backtest_step1_metrics_v2 as metrics_v2

def main():
    # Strict threshold: at least 5 prior matches for BOTH teams
    MIN_MATCHES_HISTORY = 5
    
    conn = sqlite3.connect('liga1.db')
    
    # 1. Load matches that exist in match_team_xg.csv
    # We join with matches table to get scores and dates
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
    
    # Load match_team_xg to ensure we only look at matches we have xG for
    xg_df = pd.read_csv('match_team_xg.csv')
    valid_match_ids = xg_df['match_id'].unique()
    
    matches_db = matches_db[matches_db['match_id'].isin(valid_match_ids)]
    
    # Pre-load matches_df for fast point-in-time lookups
    matches_xg_pivot = metrics_v2.load_xg_data('match_team_xg.csv')
    
    results = []
    skipped = {'not_enough_history': 0, 'missing_stats': 0}
    simulated_by_season = {}
    
    total_matches = len(matches_db)
    
    print(f"Starting simulation over {total_matches} available matches...")
    
    for idx, row in matches_db.iterrows():
        match_id = row['match_id']
        date = row['match_date']
        season_id = row['season_id']
        h_team_id = row['home_team_id']
        a_team_id = row['away_team_id']
        
        # 2. Get historical stats (point-in-time safe)
        h_stats = metrics_v2.obtener_metricas_equipo_historico_v2(matches_xg_pivot, h_team_id, date)
        a_stats = metrics_v2.obtener_metricas_equipo_historico_v2(matches_xg_pivot, a_team_id, date)
        
        if h_stats['matches_played'] < MIN_MATCHES_HISTORY or a_stats['matches_played'] < MIN_MATCHES_HISTORY:
            skipped['not_enough_history'] += 1
            continue
            
        if pd.isna(h_stats['xGF']) or pd.isna(a_stats['xGF']):
            skipped['missing_stats'] += 1
            continue
            
        # 3. Compute Lambdas (using logic identical to calculadora_poisson.py)
        lambda_home = (h_stats['xGF'] + a_stats['xGA']) / 2
        lambda_away = (a_stats['xGF'] + h_stats['xGA']) / 2
        
        # 4. Poisson Simulation
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
                    
        # 5. Save simulated match data
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
        
        simulated_by_season[season_id] = simulated_by_season.get(season_id, 0) + 1

    conn.close()
    
    # Save to CSV
    results_df = pd.DataFrame(results)
    results_df.to_csv('backtest_results.csv', index=False)
    
    # 6. Final Print Output
    print("\n" + "="*60)
    print(" BACKTEST SIMULATION COMPLETE")
    print("="*60)
    print(f"Total Matches Simulated: {len(results_df)}")
    print("Simulated Matches by Season:")
    for season, count in sorted(simulated_by_season.items()):
        print(f"  - Season {season}: {count} matches")
        
    print("\nSkipped Matches:")
    print(f"  - Not enough history (< {MIN_MATCHES_HISTORY} matches): {skipped['not_enough_history']}")
    print(f"  - Missing stats (NaN values): {skipped['missing_stats']}")
    
    print("\n" + "="*60)
    print(" PREVIEW OF FIRST 5 ROWS:")
    print("="*60)
    print(results_df.head().to_string())
    
if __name__ == '__main__':
    main()
