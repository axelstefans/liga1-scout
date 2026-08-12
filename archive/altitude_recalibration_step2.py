import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from stadium_altitudes import ALTITUDES

def get_alt(team_name):
    if team_name in ALTITUDES:
        return ALTITUDES[team_name]
    return None

def compute_brier(actual, prob):
    return np.mean((prob - actual) ** 2)

def logit(p):
    p = np.clip(p, 1e-15, 1 - 1e-15)
    return np.log(p / (1 - p))

def main():
    df = pd.read_csv('backtest_results_production_final.csv')
    
    # Process altitudes
    df['home_alt'] = df['home_team'].apply(get_alt)
    df['away_alt'] = df['away_team'].apply(get_alt)
    df = df.dropna(subset=['home_alt', 'away_alt']).copy()
    df = df[df['home_team'] != 'CD Moquegua']
    df['abs_alt_diff'] = (df['home_alt'] - df['away_alt']).abs()
    
    df['actual_home_win'] = (df['actual_home_score'] > df['actual_away_score']).astype(int)
    df['actual_over25'] = ((df['actual_home_score'] + df['actual_away_score']) > 2.5).astype(int)
    
    # Train / Test split
    train_df = df[df['season_id'].isin([48078, 57741, 70962])].copy()
    test_df = df[df['season_id'] == 88529].copy()
    
    # --- STEP 1: 1X2 Consistency Fix ---
    train_df['pred_log_odds_hw'] = logit(train_df['prob_home'])
    X_train_hw = train_df[['pred_log_odds_hw', 'abs_alt_diff']]
    y_train_hw = train_df['actual_home_win']
    model_hw = LogisticRegression(penalty=None, solver='lbfgs')
    model_hw.fit(X_train_hw, y_train_hw)
    
    test_df['pred_log_odds_hw'] = logit(test_df['prob_home'])
    X_test_hw = test_df[['pred_log_odds_hw', 'abs_alt_diff']]
    
    test_df['recal_prob_home'] = model_hw.predict_proba(X_test_hw)[:, 1]
    
    # Rescale Draw and Away proportionally
    # Orig probabilities (they sum to 1 in Poisson, but we use the existing ones)
    test_df['orig_prob_away'] = test_df['prob_away']
    test_df['orig_prob_draw'] = test_df['prob_draw']
    
    test_df['recal_prob_away'] = test_df['orig_prob_away'] * ((1.0 - test_df['recal_prob_home']) / (test_df['orig_prob_away'] + test_df['orig_prob_draw']))
    test_df['recal_prob_draw'] = test_df['orig_prob_draw'] * ((1.0 - test_df['recal_prob_home']) / (test_df['orig_prob_away'] + test_df['orig_prob_draw']))
    test_df['recal_sum'] = test_df['recal_prob_home'] + test_df['recal_prob_away'] + test_df['recal_prob_draw']
    
    print("--- STEP 1: 1X2 Consistency Fix (Sample 2026 Matches) ---")
    for i, row in test_df.head(5).iterrows():
        print(f"Match: {row['home_team']} vs {row['away_team']} (Abs Alt Diff: {row['abs_alt_diff']:.0f}m)")
        print(f"  Orig:  Home={row['prob_home']:.3f}, Draw={row['prob_draw']:.3f}, Away={row['prob_away']:.3f}, Sum={row['prob_home']+row['prob_draw']+row['prob_away']:.3f}")
        print(f"  Recal: Home={row['recal_prob_home']:.3f}, Draw={row['recal_prob_draw']:.3f}, Away={row['recal_prob_away']:.3f}, Sum={row['recal_sum']:.3f}\n")
    
    # --- STEP 2: Over/Under Calibration Check ---
    bins = [-float('inf'), 500, 1500, 2500, float('inf')]
    labels = ['0-500m (Similar)', '500-1500m (Moderate)', '1500-2500m (High)', '>2500m (Extreme)']
    df['bucket'] = pd.cut(df['abs_alt_diff'], bins=bins, labels=labels)
    
    summary = df.groupby('bucket', observed=False).agg(
        matches=('match_id', 'count'),
        actual_over25=('actual_over25', lambda x: f"{x.mean()*100:.1f}%"),
        pred_over25=('prob_over_25', lambda x: f"{x.mean()*100:.1f}%"),
    ).reset_index()
    summary = summary[summary['matches'] > 0]
    
    print("--- STEP 2: Over/Under 2.5 Altitude Buckets (All mapped matches) ---")
    print(summary.to_string(index=False))
    
    # Let's also check training data calibration to see if we should recalibrate
    train_df['pred_log_odds_ou'] = logit(train_df['prob_over_25'])
    X_train_ou = train_df[['pred_log_odds_ou', 'abs_alt_diff']]
    y_train_ou = train_df['actual_over25']
    model_ou = LogisticRegression(penalty=None, solver='lbfgs')
    model_ou.fit(X_train_ou, y_train_ou)
    
    test_df['pred_log_odds_ou'] = logit(test_df['prob_over_25'])
    X_test_ou = test_df[['pred_log_odds_ou', 'abs_alt_diff']]
    test_df['recal_prob_over25'] = model_ou.predict_proba(X_test_ou)[:, 1]
    
    brier_orig_ou = compute_brier(test_df['actual_over25'], test_df['prob_over_25'])
    brier_recal_ou = compute_brier(test_df['actual_over25'], test_df['recal_prob_over25'])
    
    print("\n--- STEP 3: Over/Under Recalibration Validation ---")
    print(f"Logistic Regression Coefs: Intercept={model_ou.intercept_[0]:.4f}, PredLogOdds={model_ou.coef_[0][0]:.4f}, AbsAltDiff={model_ou.coef_[0][1]:.6f}")
    print(f"2026 Brier Score Orig: {brier_orig_ou:.4f}")
    print(f"2026 Brier Score Recal: {brier_recal_ou:.4f}")
    
if __name__ == "__main__":
    main()
