import sqlite3
import pandas as pd
import joblib
import logging

logger = logging.getLogger(__name__)

def backfill_xg(conn: sqlite3.Connection):
    """Calculate expected goals for all shots and sum them by player_id, updating player_season_stats."""
    logger.info("Starting xG backfill...")
    
    try:
        xg_model = joblib.load('xg_model_pipeline.pkl')
        logger.info("xG model loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load xG model. Make sure xg_model_pipeline.pkl exists in the root directory. Error: {e}")
        return
        
    # Fetch shots for the latest season
    query = """
        SELECT 
            ps.shot_id,
            ps.player_id,
            ps.distance_m, 
            ps.angle_rad, 
            ps.body_part, 
            ps.situation
        FROM player_shots ps
        WHERE ps.season_id = (SELECT MAX(season_id) FROM matches)
    """
    
    df = pd.read_sql_query(query, conn)
    
    if df.empty:
        logger.info("No shots found in database for latest season.")
        return
        
    # Apply exactly the same preprocessing as in player_repo.py
    def group_situation(sit):
        if sit == 'fast-break': return 'regular'
        elif sit == 'throw-in-set-piece': return 'set-piece'
        return sit
        
    df['situation_grouped'] = df['situation'].apply(group_situation)
    
    logger.info(f"Running predictions for {len(df)} shots...")
    non_penalty_mask = df['situation'] != 'penalty'
    
    # Model predictions for non-penalties
    X_pred = df.loc[non_penalty_mask, ['distance_m', 'angle_rad', 'body_part', 'situation_grouped']]
    df.loc[non_penalty_mask, 'calculated_xg'] = xg_model.predict_proba(X_pred)[:, 1]
    
    # Standard penalty conversion probability
    df.loc[~non_penalty_mask, 'calculated_xg'] = 0.79
    
    # Aggregate by player
    player_xg = df.groupby('player_id')['calculated_xg'].sum().reset_index()
    player_xg['calculated_xg'] = player_xg['calculated_xg'].round(3)
    
    cursor = conn.cursor()
    
    # Initialize all players to 0.0 to eliminate NULLs
    logger.info("Initializing expected_goals to 0.0 for all players in player_season_stats...")
    cursor.execute("UPDATE player_season_stats SET expected_goals = 0.0")
    
    records = player_xg.to_dict(orient='records')
    logger.info(f"Updating expected_goals for {len(records)} players...")
    
    update_query = """
        UPDATE player_season_stats 
        SET expected_goals = ? 
        WHERE player_id = ?
    """
    
    # Create tuples (expected_goals, player_id)
    update_data = [(rec['calculated_xg'], rec['player_id']) for rec in records]
    cursor.executemany(update_query, update_data)
    conn.commit()
    
    logger.info("xG backfill complete.")

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    conn = sqlite3.connect('liga1.db')
    backfill_xg(conn)
    conn.close()
