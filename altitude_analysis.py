import pandas as pd
import numpy as np
from stadium_altitudes import ALTITUDES

def get_alt(team_name):
    if team_name in ALTITUDES:
        return ALTITUDES[team_name]
    return None

def main():
    df = pd.read_csv('backtest_results_production_final.csv')
    
    df['home_alt'] = df['home_team'].apply(get_alt)
    df['away_alt'] = df['away_team'].apply(get_alt)
    
    # Drop unverified teams
    initial_count = len(df)
    df = df.dropna(subset=['home_alt', 'away_alt'])
    
    # Exclude Moquegua home matches as requested
    df = df[df['home_team'] != 'CD Moquegua']
    
    print(f"Total matches analyzed: {len(df)} (out of {initial_count})")
    
    df['alt_diff'] = df['home_alt'] - df['away_alt']
    
    bins = [-float('inf'), -2500, -1500, -500, 500, 1500, 2500, float('inf')]
    labels = ['< -2500m (Away extreme altitude)', 
              '-2500m to -1500m (Away high altitude)', 
              '-1500m to -500m (Away moderate altitude)', 
              '-500m to 500m (Similar altitude)', 
              '500m to 1500m (Home moderate altitude)', 
              '1500m to 2500m (Home high altitude)', 
              '> 2500m (Home extreme altitude)']
              
    # For newer pandas
    df['bucket'] = pd.cut(df['alt_diff'], bins=bins, labels=labels)
    
    df['actual_home_win'] = (df['actual_home_score'] > df['actual_away_score']).astype(int)
    df['actual_total_goals'] = df['actual_home_score'] + df['actual_away_score']
    df['pred_total_goals'] = df['lambda_home'] + df['lambda_away']
    
    # Format the probability to percentages
    summary = df.groupby('bucket', observed=False).agg(
        matches=('match_id', 'count'),
        pred_home_win=('prob_home', lambda x: f"{x.mean()*100:.1f}%"),
        actual_home_win=('actual_home_win', lambda x: f"{x.mean()*100:.1f}%"),
        pred_goals=('pred_total_goals', lambda x: f"{x.mean():.2f}"),
        actual_goals=('actual_total_goals', lambda x: f"{x.mean():.2f}")
    ).reset_index()
    
    summary = summary[summary['matches'] > 0]
    
    print("\nAltitude Differential = Home Altitude - Away Altitude")
    print(summary.to_string(index=False))

if __name__ == "__main__":
    main()
