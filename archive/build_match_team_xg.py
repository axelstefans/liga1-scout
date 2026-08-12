import sqlite3
import pandas as pd
import joblib

def group_situation(sit):
    if sit == 'fast-break': return 'regular'
    elif sit == 'throw-in-set-piece': return 'set-piece'
    return sit

def main():
    conn = sqlite3.connect('liga1.db')
    
    # 1. Pull all rows from player_shots joined with matches
    query = """
        SELECT s.shot_id, s.match_id, s.is_home, s.distance_m, s.angle_rad, s.body_part, s.situation,
               m.home_team_id, m.away_team_id, m.match_date, m.season_id, m.home_score, m.away_score
        FROM player_shots s
        JOIN matches m ON s.match_id = m.match_id
    """
    df = pd.read_sql_query(query, conn)
    
    if df.empty:
        print("No shots found.")
        conn.close()
        return

    # 2. Map situation feature for the model exactly as the pipeline expects
    df['situation_grouped'] = df['situation'].apply(group_situation)
    
    # Load model pipeline
    xg_model = joblib.load('xg_model_pipeline.pkl')
    df['calculated_xg'] = 0.0
    
    # Predict xG for non-penalties
    non_penalty_mask = df['situation'] != 'penalty'
    if non_penalty_mask.any():
        X_pred = df.loc[non_penalty_mask, ['distance_m', 'angle_rad', 'body_part', 'situation_grouped']]
        df.loc[non_penalty_mask, 'calculated_xg'] = xg_model.predict_proba(X_pred)[:, 1]
    
    # Hardcode penalties to 0.79
    df.loc[~non_penalty_mask, 'calculated_xg'] = 0.79
    
    # 3. Determine team_id for each shot based on is_home
    df['team_id'] = df.apply(lambda row: row['home_team_id'] if row['is_home'] == 1 else row['away_team_id'], axis=1)
    
    # 4 & 5. Group by match_id and team_id, and attach match_date and season_id
    grouped = df.groupby(['match_id', 'match_date', 'season_id', 'team_id', 'is_home']).agg(
        team_xg=('calculated_xg', 'sum'),
        home_score=('home_score', 'first'),
        away_score=('away_score', 'first')
    ).reset_index()
    
    grouped['team_xg'] = grouped['team_xg'].round(2)
    
    # 6. Save to local CSV
    output_cols = ['match_id', 'match_date', 'season_id', 'team_id', 'is_home', 'team_xg']
    grouped[output_cols].to_csv('match_team_xg.csv', index=False)
    print("Saved results to match_team_xg.csv\n")
    
    # 7. Sanity check
    total_match_ids = grouped['match_id'].nunique()
    total_rows = len(grouped)
    
    print("="*60)
    print(f" TOTAL MATCHES COVERED: {total_match_ids}")
    print(f" TOTAL TEAM-MATCH ROWS: {total_rows} (Expected ~ {total_match_ids * 2})")
    print("="*60)
    print(" SPOT CHECK: 3 RANDOM MATCHES")
    print("="*60)
    
    sample_matches = grouped['match_id'].drop_duplicates().sample(3, random_state=42)
    
    for match_id in sample_matches:
        match_data = grouped[grouped['match_id'] == match_id]
        home_row = match_data[match_data['is_home'] == 1]
        away_row = match_data[match_data['is_home'] == 0]
        
        home_xg = home_row['team_xg'].values[0] if not home_row.empty else 0.0
        away_xg = away_row['team_xg'].values[0] if not away_row.empty else 0.0
        
        h_score = match_data['home_score'].iloc[0]
        a_score = match_data['away_score'].iloc[0]
        date = match_data['match_date'].iloc[0]
        
        home_team_id = home_row['team_id'].values[0] if not home_row.empty else match_data['team_id'].iloc[0] # Fallback if empty
        away_team_id = away_row['team_id'].values[0] if not away_row.empty else match_data['team_id'].iloc[0]
        
        # Get actual team names
        h_name = pd.read_sql_query("SELECT name FROM teams WHERE team_id = ?", conn, params=(int(home_row['team_id'].values[0]) if not home_row.empty else -1,)).iloc[0]['name'] if not home_row.empty else "Unknown Home"
        a_name = pd.read_sql_query("SELECT name FROM teams WHERE team_id = ?", conn, params=(int(away_row['team_id'].values[0]) if not away_row.empty else -1,)).iloc[0]['name'] if not away_row.empty else "Unknown Away"
        
        print(f"Match ID: {match_id} | Date: {date}")
        print(f"  {h_name} vs {a_name}")
        print(f"  Actual Score: {h_score} - {a_score}")
        print(f"  Expected xG:  {home_xg:.2f} - {away_xg:.2f}")
        print("-" * 40)
        
    conn.close()

if __name__ == '__main__':
    main()
