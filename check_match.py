import sqlite3
import pandas as pd
import numpy as np

conn = sqlite3.connect('liga1.db')

# 1. Find the match date
match = conn.execute("""
    SELECT match_id, match_date, home_score, away_score, season_id, home_team_id, away_team_id 
    FROM matches 
    WHERE home_team_id IN (SELECT team_id FROM teams WHERE name LIKE '%Sullana%') 
    AND away_team_id IN (SELECT team_id FROM teams WHERE name LIKE '%Cienciano%') 
    AND home_score IS NOT NULL
    ORDER BY match_date DESC LIMIT 1
""").fetchone()

if not match:
    print("Match not found")
else:
    match_id, match_date, home_score, away_score, season_id, h_id, a_id = match
    print(f"Match Date: {match_date}, Score: {home_score}-{away_score}, ID: {match_id}")
    
    # 2. Check effective sample size
    target_dt = pd.to_datetime(match_date)
    
    # Cienciano matches prior to this
    c_matches = pd.read_sql_query(f"""
        SELECT match_date FROM matches 
        WHERE (home_team_id = {a_id} OR away_team_id = {a_id}) 
        AND match_date < '{match_date}'
        ORDER BY match_date DESC LIMIT 30
    """, conn)
    
    if not c_matches.empty:
        c_matches['match_date'] = pd.to_datetime(c_matches['match_date'])
        c_matches['days_ago'] = (target_dt - c_matches['match_date']).dt.days
        c_matches['weight'] = 0.5 ** (c_matches['days_ago'] / 120.0)
        eff_size = c_matches['weight'].sum()
        print(f"Cienciano Effective Sample Size (last 30 matches): {eff_size:.2f}")
        
    # Sullana matches prior to this
    s_matches = pd.read_sql_query(f"""
        SELECT match_date FROM matches 
        WHERE (home_team_id = {h_id} OR away_team_id = {h_id}) 
        AND match_date < '{match_date}'
        ORDER BY match_date DESC LIMIT 30
    """, conn)
    
    if not s_matches.empty:
        s_matches['match_date'] = pd.to_datetime(s_matches['match_date'])
        s_matches['days_ago'] = (target_dt - s_matches['match_date']).dt.days
        s_matches['weight'] = 0.5 ** (s_matches['days_ago'] / 120.0)
        eff_size = s_matches['weight'].sum()
        print(f"Sullana Effective Sample Size (last 30 matches): {eff_size:.2f}")

conn.close()
