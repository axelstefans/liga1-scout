import pandas as pd
import numpy as np

def compute_brier(actual, prob):
    return np.mean((prob - actual) ** 2)

def compute_log_loss(actual, prob):
    prob = np.clip(prob, 1e-15, 1 - 1e-15)
    return -np.mean(actual * np.log(prob) + (1 - actual) * np.log(1 - prob))

def calibration_table(actuals, probs, bins=10):
    df = pd.DataFrame({'actual': actuals, 'prob': probs})
    df['bin'] = pd.cut(df['prob'], bins=np.linspace(0, 1, bins+1), include_lowest=True)
    cal_table = df.groupby('bin').agg(
        count=('prob', 'count'),
        avg_prob=('prob', 'mean'),
        actual_freq=('actual', 'mean')
    ).reset_index()
    cal_table = cal_table[cal_table['count'] > 0]
    return cal_table

def main():
    df = pd.read_csv('backtest_results_production_final.csv')
    df['is_home_win'] = (df['actual_home_score'] > df['actual_away_score']).astype(int)
    df['is_over_25'] = ((df['actual_home_score'] + df['actual_away_score']) > 2.5).astype(int)
    
    brier_home = compute_brier(df['is_home_win'], df['prob_home'])
    ll_home = compute_log_loss(df['is_home_win'], df['prob_home'])
    
    brier_over = compute_brier(df['is_over_25'], df['prob_over_25'])
    ll_over = compute_log_loss(df['is_over_25'], df['prob_over_25'])
    
    print(f"Total Matches: {len(df)}")
    print(f"Overall Home Win Brier: {brier_home:.4f}, Log-Loss: {ll_home:.4f}")
    print(f"Overall Over 2.5 Brier: {brier_over:.4f}, Log-Loss: {ll_over:.4f}")
    
    print("\n--- Calibration Table: Home Win ---")
    print(calibration_table(df['is_home_win'], df['prob_home']))
    
    print("\n--- Calibration Table: Over 2.5 ---")
    print(calibration_table(df['is_over_25'], df['prob_over_25']))

if __name__ == '__main__':
    main()
