import sqlite3
import pandas as pd
import numpy as np
from scipy.stats import poisson
import joblib
import sys
import os

try:
    from stadium_altitudes import ALTITUDES
except ImportError:
    ALTITUDES = {}

_xg_model = joblib.load('xg_model_pipeline.pkl')

def group_situation(sit):
    if sit == 'fast-break': return 'regular'
    elif sit == 'throw-in-set-piece': return 'set-piece'
    return sit

def get_dynamic_scaling_factor(conn, df_xg: pd.DataFrame) -> float:
    if df_xg.empty: return 1.0
    matches_db = pd.read_sql_query("SELECT match_id, home_score, away_score FROM matches WHERE home_score IS NOT NULL AND away_score IS NOT NULL", conn)
    valid_ids = df_xg['match_id'].unique()
    matches_db = matches_db[matches_db['match_id'].isin(valid_ids)]
    if matches_db.empty: return 1.0
    df_filtered = df_xg[df_xg['match_id'].isin(matches_db['match_id'])]
    tot_actual = matches_db['home_score'].sum() + matches_db['away_score'].sum()
    tot_xg = df_filtered['calculated_xg'].sum()
    if tot_xg > 0: return float(tot_actual / tot_xg)
    return 1.0

def get_all_matches_xg(conn) -> pd.DataFrame:
    query = """
        SELECT s.match_id, s.is_home, s.distance_m, s.angle_rad, s.body_part, s.situation,
               m.home_team_id, m.away_team_id, m.match_date, m.season_id
        FROM player_shots s
        JOIN matches m ON s.match_id = m.match_id
    """
    df = pd.read_sql_query(query, conn)
    if df.empty: return pd.DataFrame()
    df['situation_grouped'] = df['situation'].apply(group_situation)
    df['calculated_xg'] = 0.0
    nm = df['situation'] != 'penalty'
    if nm.any():
        X = df.loc[nm, ['distance_m', 'angle_rad', 'body_part', 'situation_grouped']]
        df.loc[nm, 'calculated_xg'] = _xg_model.predict_proba(X)[:, 1]
    df.loc[~nm, 'calculated_xg'] = 0.79
    
    scaling = get_dynamic_scaling_factor(conn, df)
    df['calculated_xg'] *= scaling
    df['team_id'] = df.apply(lambda r: r['home_team_id'] if r['is_home'] == 1 else r['away_team_id'], axis=1)
    
    grouped = df.groupby(['match_id', 'team_id', 'is_home']).agg(
        team_xg=('calculated_xg', 'sum'),
        home_team_id=('home_team_id', 'first'),
        away_team_id=('away_team_id', 'first'),
        match_date=('match_date', 'first'),
        season_id=('season_id', 'first')
    ).reset_index()
    
    home_df = grouped[grouped['is_home'] == 1][['match_id', 'match_date', 'season_id', 'team_id', 'team_xg']].rename(
        columns={'team_id': 'home_team_id', 'team_xg': 'home_xg'}
    )
    away_df = grouped[grouped['is_home'] == 0][['match_id', 'team_id', 'team_xg']].rename(
        columns={'team_id': 'away_team_id', 'team_xg': 'away_xg'}
    )
    return pd.merge(home_df, away_df, on='match_id', how='inner')

def get_historical_team_metrics_decay(matches_df, team_id, target_date, half_life, league_avg_home_xg, league_avg_away_xg):
    target_dt = pd.to_datetime(target_date)
    
    home_games = matches_df[matches_df['home_team_id'] == team_id].copy()
    away_games = matches_df[matches_df['away_team_id'] == team_id].copy()
    
    if half_life is None:
        home_games['weight'] = 1.0
        away_games['weight'] = 1.0
    else:
        home_games['match_date'] = pd.to_datetime(home_games['match_date'])
        home_games['days_ago'] = (target_dt - home_games['match_date']).dt.days.clip(lower=0)
        home_games['weight'] = np.exp(-np.log(2) * home_games['days_ago'] / half_life)
        
        away_games['match_date'] = pd.to_datetime(away_games['match_date'])
        away_games['days_ago'] = (target_dt - away_games['match_date']).dt.days.clip(lower=0)
        away_games['weight'] = np.exp(-np.log(2) * away_games['days_ago'] / half_life)
        
    w_home = home_games['weight'].sum()
    w_away = away_games['weight'].sum()
    w_total = w_home + w_away
    
    if w_total == 0:
        return {'shrunk_xGF_home': 0.0, 'shrunk_xGA_home': 0.0, 'shrunk_xGF_away': 0.0, 'shrunk_xGA_away': 0.0, 'overall_xGF': 0.0, 'overall_xGA': 0.0}
        
    overall_xgf = ((home_games['home_xg'] * home_games['weight']).sum() + (away_games['away_xg'] * away_games['weight']).sum()) / w_total if w_total > 0 else 0
    overall_xga = ((home_games['away_xg'] * home_games['weight']).sum() + (away_games['home_xg'] * away_games['weight']).sum()) / w_total if w_total > 0 else 0
    
    raw_xGF_home = (home_games['home_xg'] * home_games['weight']).sum() / w_home if w_home > 0 else overall_xgf
    raw_xGA_home = (home_games['away_xg'] * home_games['weight']).sum() / w_home if w_home > 0 else overall_xga
    raw_xGF_away = (away_games['away_xg'] * away_games['weight']).sum() / w_away if w_away > 0 else overall_xgf
    raw_xGA_away = (away_games['home_xg'] * away_games['weight']).sum() / w_away if w_away > 0 else overall_xga
    
    k = 8.0
    league_avg_overall_xg = (league_avg_home_xg + league_avg_away_xg) / 2.0
    if league_avg_overall_xg == 0: league_avg_overall_xg = 1.0
        
    home_xgf_prior = overall_xgf * (league_avg_home_xg / league_avg_overall_xg)
    away_xgf_prior = overall_xgf * (league_avg_away_xg / league_avg_overall_xg)
    
    home_xga_prior = overall_xga * (league_avg_away_xg / league_avg_overall_xg)
    away_xga_prior = overall_xga * (league_avg_home_xg / league_avg_overall_xg)
    
    return {
        'shrunk_xGF_home': (w_home * raw_xGF_home + k * home_xgf_prior) / (w_home + k),
        'shrunk_xGA_home': (w_home * raw_xGA_home + k * home_xga_prior) / (w_home + k),
        'shrunk_xGF_away': (w_away * raw_xGF_away + k * away_xgf_prior) / (w_away + k),
        'shrunk_xGA_away': (w_away * raw_xGA_away + k * away_xga_prior) / (w_away + k),
        'overall_xGF': overall_xgf,
        'overall_xGA': overall_xga
    }

def run_backtest():
    conn = sqlite3.connect('liga1.db')
    
    print("Loading global xG match data...")
    df_all_xg = get_all_matches_xg(conn)
    if df_all_xg.empty:
        print("No matches to backtest.")
        return
        
    query = """
        SELECT m.match_id, m.match_date, m.season_id, m.home_team_id, m.away_team_id, 
               m.home_score, m.away_score, ht.name as home_name, at.name as away_name
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.team_id
        JOIN teams at ON m.away_team_id = at.team_id
        WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
        ORDER BY m.match_date ASC
    """
    matches_db = pd.read_sql_query(query, conn)
    
    # Restrict to 2026 season only for out-of-sample validation
    train_seasons = [88529]
    matches_db = matches_db[matches_db['season_id'].isin(train_seasons)]
    
    half_lives = [None, 365]
    
    results_summary = []
    
    for hl in half_lives:
        brier_hw_sum = 0
        brier_o25_sum = 0
        valid_count = 0
        
        for idx, match in matches_db.iterrows():
            m_date = match['match_date']
            h_id = match['home_team_id']
            a_id = match['away_team_id']
            h_name = match['home_name']
            a_name = match['away_name']
            
            pit_df = df_all_xg[df_all_xg['match_date'] < m_date]
            
            h_past = len(pit_df[(pit_df['home_team_id']==h_id) | (pit_df['away_team_id']==h_id)])
            a_past = len(pit_df[(pit_df['home_team_id']==a_id) | (pit_df['away_team_id']==a_id)])
            
            if h_past < 5 or a_past < 5:
                continue
                
            league_avg_home_xg = pit_df['home_xg'].mean() if len(pit_df) > 0 else 1.0
            league_avg_away_xg = pit_df['away_xg'].mean() if len(pit_df) > 0 else 1.0
            if pd.isna(league_avg_home_xg): league_avg_home_xg = 1.0
            if pd.isna(league_avg_away_xg): league_avg_away_xg = 1.0
            league_avg_overall = (league_avg_home_xg + league_avg_away_xg) / 2
            
            h_stats = get_historical_team_metrics_decay(pit_df, h_id, m_date, hl, league_avg_home_xg, league_avg_away_xg)
            a_stats = get_historical_team_metrics_decay(pit_df, a_id, m_date, hl, league_avg_home_xg, league_avg_away_xg)
            
            atk_home = h_stats['shrunk_xGF_home'] / league_avg_home_xg
            def_home = h_stats['shrunk_xGA_home'] / league_avg_away_xg
            atk_away = a_stats['shrunk_xGF_away'] / league_avg_away_xg
            def_away = a_stats['shrunk_xGA_away'] / league_avg_home_xg
            
            xg_local = atk_home * def_away * league_avg_home_xg
            xg_visita = atk_away * def_home * league_avg_away_xg
            
            max_goles = 10
            prob_matrix = np.zeros((max_goles, max_goles))
            for i in range(max_goles):
                for j in range(max_goles):
                    prob_matrix[i][j] = poisson.pmf(i, xg_local) * poisson.pmf(j, xg_visita)
                    
            prob_local = np.sum(np.tril(prob_matrix, -1))
            prob_empate = np.sum(np.diag(prob_matrix))
            prob_visita = np.sum(np.triu(prob_matrix, 1))
            
            def _get_alt(n):
                for k,v in ALTITUDES.items():
                    if k.lower() in n.lower() or n.lower() in k.lower(): return v
                return None
                
            h_alt = _get_alt(h_name)
            a_alt = _get_alt(a_name)
            
            if h_alt is not None and a_alt is not None:
                abs_diff = abs(h_alt - a_alt)
                pc = np.clip(prob_local, 1e-15, 1 - 1e-15)
                orig_log_odds = np.log(pc / (1 - pc))
                new_log = -0.1378 + 0.8914 * orig_log_odds + 0.000173 * abs_diff
                recal_prob_local = 1 / (1 + np.exp(-new_log))
                
                rem_orig = prob_empate + prob_visita
                if rem_orig > 0:
                    scale = (1.0 - recal_prob_local) / rem_orig
                    prob_empate *= scale
                    prob_visita *= scale
                prob_local = recal_prob_local
                
            prob_over_25 = 0
            for i in range(max_goles):
                for j in range(max_goles):
                    if (i + j) > 2.5:
                        prob_over_25 += prob_matrix[i][j]
                        
            h_score = match['home_score']
            a_score = match['away_score']
            outcome_hw = 1 if h_score > a_score else 0
            outcome_o25 = 1 if (h_score + a_score) > 2.5 else 0
            
            brier_hw = (prob_local - outcome_hw) ** 2
            brier_o25 = (prob_over_25 - outcome_o25) ** 2
            
            brier_hw_sum += brier_hw
            brier_o25_sum += brier_o25
            valid_count += 1
            
        avg_brier_hw = brier_hw_sum / valid_count if valid_count > 0 else 0
        avg_brier_o25 = brier_o25_sum / valid_count if valid_count > 0 else 0
        hl_str = str(hl) if hl is not None else "Infinite (No Decay)"
        
        print(f"Half-life: {hl_str:20} | Valid Matches: {valid_count} | Brier HW: {avg_brier_hw:.5f} | Brier O2.5: {avg_brier_o25:.5f}")
        results_summary.append((hl_str, avg_brier_hw, avg_brier_o25))
        
    print("\n--- FINAL COMPARISON ---")
    best_hw = min(results_summary, key=lambda x: x[1])
    best_o25 = min(results_summary, key=lambda x: x[2])
    print(f"Best Half-life for Home Win: {best_hw[0]} (Brier: {best_hw[1]:.5f})")
    print(f"Best Half-life for Over 2.5: {best_o25[0]} (Brier: {best_o25[2]:.5f})")

if __name__ == "__main__":
    run_backtest()
