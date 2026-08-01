import pandas as pd
import numpy as np
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
    df = pd.read_csv('backtest_results_v3.csv')
    df['actual_home_win'] = (df['actual_home_score'] > df['actual_away_score']).astype(int)
    df['actual_over_25'] = ((df['actual_home_score'] + df['actual_away_score']) > 2.5).astype(int)
    
    global_brier_hw, global_ll_hw = compute_metrics(df['actual_home_win'], df['prob_home'])
    global_brier_over, global_ll_over = compute_metrics(df['actual_over_25'], df['prob_over_25'])
    
    avg_lambda_sum = (df['lambda_home'] + df['lambda_away']).mean()
    avg_actual_goals = (df['actual_home_score'] + df['actual_away_score']).mean()
    
    with open('calibration_report_v3.md', 'w') as f:
        f.write("# Backtest Calibration Report V3 (Multiplicative + Scaled xG)\n\n")
        f.write("## 1. Global Metrics\n\n")
        f.write(f"- **Home Win**: Brier Score = {global_brier_hw:.4f} | Log-Loss = {global_ll_hw:.4f}\n")
        f.write(f"- **Over 2.5**: Brier Score = {global_brier_over:.4f} | Log-Loss = {global_ll_over:.4f}\n\n")
        
        f.write("## 2. Model Scale Gap (Average Expected vs Actual Goals)\n\n")
        f.write(f"- **Average Projected Total Goals per Match (Lambda sum)**: {avg_lambda_sum:.3f}\n")
        f.write(f"- **Average Actual Total Goals per Match**: {avg_actual_goals:.3f}\n\n")
        
        f.write("## 3. Calibration Table: Home Win\n\n")
        cal_hw = calibration_table(df['actual_home_win'], df['prob_home'])
        f.write("| Probability Bucket | Count | Avg Predicted Prob | Actual Frequency | Diff |\n")
        f.write("|--------------------|-------|--------------------|------------------|------|\n")
        for _, row in cal_hw.iterrows():
            if row['count'] > 0:
                f.write(f"| {row['bucket']} | {row['count']} | {row['avg_pred']:.1%} | {row['actual_freq']:.1%} | {row['avg_pred'] - row['actual_freq']:+.1%} |\n")
            else:
                f.write(f"| {row['bucket']} | 0 | N/A | N/A | N/A |\n")
                
        f.write("\n## 4. Calibration Table: Over 2.5\n\n")
        cal_over = calibration_table(df['actual_over_25'], df['prob_over_25'])
        f.write("| Probability Bucket | Count | Avg Predicted Prob | Actual Frequency | Diff |\n")
        f.write("|--------------------|-------|--------------------|------------------|------|\n")
        for _, row in cal_over.iterrows():
            if row['count'] > 0:
                f.write(f"| {row['bucket']} | {row['count']} | {row['avg_pred']:.1%} | {row['actual_freq']:.1%} | {row['avg_pred'] - row['actual_freq']:+.1%} |\n")
            else:
                f.write(f"| {row['bucket']} | 0 | N/A | N/A | N/A |\n")

    print("Scoring complete. Results saved to calibration_report_v3.md")
    with open('calibration_report_v3.md', 'r') as f:
        print("\n" + f.read())

if __name__ == '__main__':
    main()
