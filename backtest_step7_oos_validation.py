import pandas as pd
import sqlite3
import numpy as np
from scipy.stats import poisson
from sklearn.metrics import brier_score_loss, log_loss
import warnings
warnings.filterwarnings('ignore')

def compute_metrics(y_true, y_prob):
    eps = 1e-15
    y_prob_clipped = np.clip(y_prob, eps, 1 - eps)
    if len(y_true) > 0:
        brier = brier_score_loss(y_true, y_prob)
        ll = log_loss(y_true, y_prob_clipped, labels=[0, 1])
    else:
        brier = np.nan
        ll = np.nan
    return brier, ll

def calibration_table(y_true, y_prob):
    bins = np.linspace(0, 1, 11)
    df = pd.DataFrame({'y_true': y_true, 'y_prob': y_prob})
    labels = [f"[{i*10}% - {(i+1)*10}%]" for i in range(10)]
    df['bucket'] = pd.cut(df['y_prob'], bins=bins, labels=labels, right=False, include_lowest=True)
    
    cal_table = df.groupby('bucket', observed=False).agg(
        count=('y_true', 'count'),
        avg_pred=('y_prob', 'mean'),
        actual_freq=('y_true', 'mean')
    ).reset_index()
    return cal_table

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
    
    # 1. Compute scaling factor ONLY on 2023, 2024, 2025
    oos_seasons = [48078, 57741, 70962]
    matches_db_oos = matches_db[matches_db['season_id'].isin(oos_seasons)]
    
    df_filtered_oos = xg_df[xg_df['match_id'].isin(matches_db_oos['match_id'])]
    
    total_actual_goals_oos = matches_db_oos['home_score'].sum() + matches_db_oos['away_score'].sum()
    total_xg_oos = df_filtered_oos['team_xg'].sum()
    
    oos_scaling_factor = total_actual_goals_oos / total_xg_oos if total_xg_oos > 0 else 1.0
    print("="*60)
    print(f"OOS dynamic scaling factor (2023-2025 only): {oos_scaling_factor:.4f}")
    print(f"Original V3 scaling factor was: 1.4199")
    print("="*60)
    
    # Apply factor
    xg_df['team_xg'] = xg_df['team_xg'] * oos_scaling_factor
    
    home_df = xg_df[xg_df['is_home'] == 1][['match_id', 'match_date', 'team_id', 'team_xg']].rename(
        columns={'team_id': 'home_team_id', 'team_xg': 'home_xg'}
    )
    away_df = xg_df[xg_df['is_home'] == 0][['match_id', 'team_id', 'team_xg']].rename(
        columns={'team_id': 'away_team_id', 'team_xg': 'away_xg'}
    )
    matches_xg_pivot = pd.merge(home_df, away_df, on='match_id', how='inner')
    
    # 2. Simulate for 2026 only
    target_season = 88529
    matches_db_target = matches_db[matches_db['season_id'] == target_season]
    
    results = []
    print(f"Starting OOS simulation over {len(matches_db_target)} available matches for 2026...")
    
    def obtener_metricas(matches_df, team_id, target_date):
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
            return {'matches_played': 0}
            
        team_avg_xgf = (home_games['home_xg'].sum() + away_games['away_xg'].sum()) / total_matches
        team_avg_xga = (home_games['away_xg'].sum() + away_games['home_xg'].sum()) / total_matches
        
        attack_strength = team_avg_xgf / league_avg_overall if league_avg_overall > 0 else 1.0
        defense_strength = team_avg_xga / league_avg_overall if league_avg_overall > 0 else 1.0
        
        return {
            'matches_played': total_matches,
            'attack_strength': attack_strength,
            'defense_strength': defense_strength,
            'league_avg_home_xg': league_avg_home_xg,
            'league_avg_away_xg': league_avg_away_xg
        }

    for idx, row in matches_db_target.iterrows():
        match_id = row['match_id']
        date = row['match_date']
        season_id = row['season_id']
        h_team_id = row['home_team_id']
        a_team_id = row['away_team_id']
        
        h_stats = obtener_metricas(matches_xg_pivot, h_team_id, date)
        a_stats = obtener_metricas(matches_xg_pivot, a_team_id, date)
        
        if h_stats['matches_played'] < MIN_MATCHES_HISTORY or a_stats['matches_played'] < MIN_MATCHES_HISTORY:
            continue
            
        if pd.isna(h_stats.get('attack_strength')) or pd.isna(a_stats.get('attack_strength')):
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
    
    oos_df = pd.DataFrame(results)
    oos_df.to_csv('backtest_results_oos_2026.csv', index=False)
    
    # 3. Score OOS metrics
    oos_df['actual_home_win'] = (oos_df['actual_home_score'] > oos_df['actual_away_score']).astype(int)
    oos_df['actual_over_25'] = ((oos_df['actual_home_score'] + oos_df['actual_away_score']) > 2.5).astype(int)
    
    oos_brier_hw, oos_ll_hw = compute_metrics(oos_df['actual_home_win'], oos_df['prob_home'])
    oos_brier_over, oos_ll_over = compute_metrics(oos_df['actual_over_25'], oos_df['prob_over_25'])
    
    cal_hw = calibration_table(oos_df['actual_home_win'], oos_df['prob_home'])
    cal_over = calibration_table(oos_df['actual_over_25'], oos_df['prob_over_25'])
    
    # 4. Compare with V3 In-Sample 2026 metrics
    v3_df = pd.read_csv('backtest_results_v3.csv')
    v3_2026 = v3_df[v3_df['season_id'] == target_season].copy()
    v3_2026['actual_home_win'] = (v3_2026['actual_home_score'] > v3_2026['actual_away_score']).astype(int)
    v3_2026['actual_over_25'] = ((v3_2026['actual_home_score'] + v3_2026['actual_away_score']) > 2.5).astype(int)
    
    v3_brier_hw, v3_ll_hw = compute_metrics(v3_2026['actual_home_win'], v3_2026['prob_home'])
    v3_brier_over, v3_ll_over = compute_metrics(v3_2026['actual_over_25'], v3_2026['prob_over_25'])
    
    print("\n" + "="*60)
    print(" OUT-OF-SAMPLE vs IN-SAMPLE (2026 ONLY)")
    print("="*60)
    print("Home Win:")
    print(f"  V3 In-Sample (Scaled on ALL seasons): Brier = {v3_brier_hw:.4f} | LogLoss = {v3_ll_hw:.4f}")
    print(f"  OOS        (Scaled on 2023-25 only): Brier = {oos_brier_hw:.4f} | LogLoss = {oos_ll_hw:.4f}")
    print("\nOver 2.5:")
    print(f"  V3 In-Sample (Scaled on ALL seasons): Brier = {v3_brier_over:.4f} | LogLoss = {v3_ll_over:.4f}")
    print(f"  OOS        (Scaled on 2023-25 only): Brier = {oos_brier_over:.4f} | LogLoss = {oos_ll_over:.4f}")
    
    print("\n" + "="*60)
    print(" CALIBRATION TABLES (OOS 2026 ONLY)")
    print("="*60)
    print("Home Win Calibration (OOS):")
    print(cal_hw.to_string())
    print("\nOver 2.5 Calibration (OOS):")
    print(cal_over.to_string())
    
if __name__ == '__main__':
    main()
