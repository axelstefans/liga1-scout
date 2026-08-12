import pandas as pd
import numpy as np

from stadium_altitudes import ALTITUDES

def get_alt(team_name):
    if team_name in ALTITUDES:
        return ALTITUDES[team_name]
    return None

def compute_brier(actual, prob):
    return np.mean((prob - actual) ** 2)

def logit(p):
    # clamp p to avoid inf
    p = np.clip(p, 1e-15, 1 - 1e-15)
    return np.log(p / (1 - p))

def expit(x):
    return 1 / (1 + np.exp(-x))

def main():
    df = pd.read_csv('backtest_results_production_final.csv')
    
    # Process altitudes
    df['home_alt'] = df['home_team'].apply(get_alt)
    df['away_alt'] = df['away_team'].apply(get_alt)
    df = df.dropna(subset=['home_alt', 'away_alt'])
    df = df[df['home_team'] != 'CD Moquegua']
    df['alt_diff'] = df['home_alt'] - df['away_alt']
    
    df['actual_home_win'] = (df['actual_home_score'] > df['actual_away_score']).astype(int)
    df['pred_log_odds'] = logit(df['prob_home'])
    
    # Train test split
    train_df = df[df['season_id'].isin([48078, 57741, 70962])].copy()
    test_df = df[df['season_id'] == 88529].copy()
    
    print(f"Train matches (2023-2025): {len(train_df)}")
    print(f"Test matches (2026): {len(test_df)}")
    
    # Logistic Regression
    from sklearn.linear_model import LogisticRegression
    
    train_df['abs_alt_diff'] = train_df['alt_diff'].abs()
    test_df['abs_alt_diff'] = test_df['alt_diff'].abs()
    
    X_train = train_df[['pred_log_odds', 'abs_alt_diff']]
    y_train = train_df['actual_home_win']
    
    model = LogisticRegression(penalty=None, solver='lbfgs') # No penalty for direct recalibration
    model.fit(X_train, y_train)
    
    print("\n--- Logistic Regression Coefficients ---")
    print(f"Intercept: {model.intercept_[0]:.4f}")
    print(f"Pred Log-Odds Coef: {model.coef_[0][0]:.4f}")
    print(f"Alt Diff Coef: {model.coef_[0][1]:.6f}")
    
    # Apply to test set
    X_test = test_df[['pred_log_odds', 'abs_alt_diff']]
    
    test_df['recal_prob_home'] = model.predict_proba(X_test)[:, 1]
    
    brier_orig = compute_brier(test_df['actual_home_win'], test_df['prob_home'])
    brier_recal = compute_brier(test_df['actual_home_win'], test_df['recal_prob_home'])
    
    print(f"\n--- 2026 Brier Score (Home Win) ---")
    print(f"Original: {brier_orig:.4f}")
    print(f"Recalibrated: {brier_recal:.4f}")
    
    # Altitude buckets on test set
    bins = [-float('inf'), -2500, -1500, -500, 500, 1500, 2500, float('inf')]
    labels = ['< -2500m', '-2500m to -1500m', '-1500m to -500m', '-500m to 500m', 
              '500m to 1500m', '1500m to 2500m', '> 2500m']
    test_df['bucket'] = pd.cut(test_df['alt_diff'], bins=bins, labels=labels)
    
    summary = test_df.groupby('bucket', observed=False).agg(
        matches=('match_id', 'count'),
        actual_home_win=('actual_home_win', lambda x: f"{x.mean()*100:.1f}%"),
        orig_pred=('prob_home', lambda x: f"{x.mean()*100:.1f}%"),
        recal_pred=('recal_prob_home', lambda x: f"{x.mean()*100:.1f}%")
    ).reset_index()
    
    summary = summary[summary['matches'] > 0]
    print("\n--- 2026 Altitude Bucket Performance ---")
    print(summary.to_string(index=False))

if __name__ == "__main__":
    main()
