import pandas as pd
import numpy as np
from sklearn.metrics import brier_score_loss, log_loss
import warnings
warnings.filterwarnings('ignore')

def compute_metrics(y_true, y_prob):
    # Log loss clipping to avoid infinite loss on 0/1 predictions
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
    # Define bins 0-10%, 10-20%, ... 90-100%
    bins = np.linspace(0, 1, 11)
    df = pd.DataFrame({'y_true': y_true, 'y_prob': y_prob})
    
    # We use right=False so that bins are [0, 0.1), [0.1, 0.2)... but include 1 in the last bin
    # We can handle string labels for easier reading
    labels = [f"[{i*10}% - {(i+1)*10}%]" for i in range(10)]
    df['bucket'] = pd.cut(df['y_prob'], bins=bins, labels=labels, right=False, include_lowest=True)
    
    cal_table = df.groupby('bucket', observed=False).agg(
        count=('y_true', 'count'),
        avg_pred=('y_prob', 'mean'),
        actual_freq=('y_true', 'mean')
    ).reset_index()
    
    return cal_table

def main():
    df = pd.read_csv('backtest_results.csv')
    
    # Define actual outcomes
    df['actual_home_win'] = (df['actual_home_score'] > df['actual_away_score']).astype(int)
    df['actual_over_25'] = ((df['actual_home_score'] + df['actual_away_score']) > 2.5).astype(int)
    
    # Global metrics
    global_brier_hw, global_ll_hw = compute_metrics(df['actual_home_win'], df['prob_home'])
    global_brier_over, global_ll_over = compute_metrics(df['actual_over_25'], df['prob_over_25'])
    
    # Per-season metrics
    seasons = sorted(df['season_id'].unique())
    season_metrics = []
    for s in seasons:
        s_df = df[df['season_id'] == s]
        b_hw, l_hw = compute_metrics(s_df['actual_home_win'], s_df['prob_home'])
        b_over, l_over = compute_metrics(s_df['actual_over_25'], s_df['prob_over_25'])
        season_metrics.append({
            'Season': s,
            'Matches': len(s_df),
            'HomeWin_Brier': b_hw,
            'HomeWin_LogLoss': l_hw,
            'Over25_Brier': b_over,
            'Over25_LogLoss': l_over
        })
        
    # Calibration tables
    cal_hw = calibration_table(df['actual_home_win'], df['prob_home'])
    cal_over = calibration_table(df['actual_over_25'], df['prob_over_25'])
    
    # Write report
    with open('calibration_report.md', 'w') as f:
        f.write("# Backtest Calibration Report\n\n")
        f.write("## 1. Global Metrics\n\n")
        f.write(f"- **Home Win**: Brier Score = {global_brier_hw:.4f} | Log-Loss = {global_ll_hw:.4f}\n")
        f.write(f"- **Over 2.5**: Brier Score = {global_brier_over:.4f} | Log-Loss = {global_ll_over:.4f}\n\n")
        
        f.write("## 2. Per-Season Trend\n\n")
        f.write("| Season | Matches | Home Win Brier | Home Win LogLoss | Over 2.5 Brier | Over 2.5 LogLoss |\n")
        f.write("|--------|---------|----------------|------------------|----------------|------------------|\n")
        for m in season_metrics:
            f.write(f"| {m['Season']} | {m['Matches']} | {m['HomeWin_Brier']:.4f} | {m['HomeWin_LogLoss']:.4f} | {m['Over25_Brier']:.4f} | {m['Over25_LogLoss']:.4f} |\n")
            
        f.write("\n## 3. Calibration Table: Home Win\n\n")
        f.write("| Probability Bucket | Count | Avg Predicted Prob | Actual Frequency | Diff (Pred - Actual) |\n")
        f.write("|--------------------|-------|--------------------|------------------|----------------------|\n")
        for _, row in cal_hw.iterrows():
            bucket = row['bucket']
            cnt = row['count']
            if cnt > 0:
                avg_p = row['avg_pred']
                avg_a = row['actual_freq']
                diff = avg_p - avg_a
                f.write(f"| {bucket} | {cnt} | {avg_p:.1%} | {avg_a:.1%} | {diff:+.1%} |\n")
            else:
                f.write(f"| {bucket} | {cnt} | N/A | N/A | N/A |\n")

        f.write("\n## 4. Calibration Table: Over 2.5\n\n")
        f.write("| Probability Bucket | Count | Avg Predicted Prob | Actual Frequency | Diff (Pred - Actual) |\n")
        f.write("|--------------------|-------|--------------------|------------------|----------------------|\n")
        for _, row in cal_over.iterrows():
            bucket = row['bucket']
            cnt = row['count']
            if cnt > 0:
                avg_p = row['avg_pred']
                avg_a = row['actual_freq']
                diff = avg_p - avg_a
                f.write(f"| {bucket} | {cnt} | {avg_p:.1%} | {avg_a:.1%} | {diff:+.1%} |\n")
            else:
                f.write(f"| {bucket} | {cnt} | N/A | N/A | N/A |\n")

        f.write("\n## 5. Summary & Analysis\n\n")
        
        def analyze_calibration(cal_df, market_name):
            f.write(f"### {market_name} Calibration Analysis\n")
            issues = 0
            for _, row in cal_df.iterrows():
                # Only flag buckets with decent sample size
                if row['count'] >= 30:
                    diff = row['avg_pred'] - row['actual_freq']
                    if diff > 0.05:
                        f.write(f"- **{row['bucket']} (Overconfident)**: Predicted ~{row['avg_pred']:.1%} but occurred {row['actual_freq']:.1%} of the time.\n")
                        issues += 1
                    elif diff < -0.05:
                        f.write(f"- **{row['bucket']} (Underconfident)**: Predicted ~{row['avg_pred']:.1%} but occurred {row['actual_freq']:.1%} of the time.\n")
                        issues += 1
            if issues == 0:
                f.write("- The model is generally well-calibrated across bins with significant sample sizes (deviation < 5%).\n")
        
        analyze_calibration(cal_hw, "Home Win")
        f.write("\n")
        analyze_calibration(cal_over, "Over 2.5")

    print("Scoring complete. Results saved to calibration_report.md")
    
    # Read the markdown file and print it to the console so we can see it
    with open('calibration_report.md', 'r') as f:
        print("\n" + f.read())

if __name__ == '__main__':
    main()
