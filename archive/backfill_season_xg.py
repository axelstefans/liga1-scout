import sqlite3
import pandas as pd
import joblib
import os

def main():
    db_path = 'liga1.db'
    model_path = 'xg_model_pipeline.pkl'

    if not os.path.exists(db_path):
        print(f"Database {db_path} not found.")
        return

    if not os.path.exists(model_path):
        print(f"Model {model_path} not found.")
        return

    conn = sqlite3.connect(db_path)

    import sys
    season_id_filter = ""
    if len(sys.argv) > 1:
        season_id = int(sys.argv[1])
        season_id_filter = f"AND m.season_id = {season_id}"

    # Retrieve shots only for matches that have not been processed yet
    query = f"""
        SELECT shot_id, match_id, player_id, distance_m, angle_rad, body_part, situation
        FROM player_shots
        WHERE match_id IN (
            SELECT DISTINCT m.match_id
            FROM matches m
            JOIN player_match_stats pms ON m.match_id = pms.match_id
            WHERE 1=1 {season_id_filter}
            GROUP BY m.match_id
            HAVING MAX(pms.expected_goals) IS NULL OR MAX(pms.expected_goals) = 0
        )
    """
    df = pd.read_sql(query, conn)

    if df.empty:
        print("No shots found in database.")
        conn.close()
        return

    def group_situation(sit):
        if sit == 'fast-break': return 'regular'
        elif sit == 'throw-in-set-piece': return 'set-piece'
        return sit

    df['situation_grouped'] = df['situation'].apply(group_situation)

    # Load model
    xg_model = joblib.load(model_path)

    # Apply model to non-penalty shots
    non_penalty_mask = df['situation'] != 'penalty'

    # Initialize calculated_xg column
    df['calculated_xg'] = 0.0

    if non_penalty_mask.any():
        X_pred = df.loc[non_penalty_mask, ['distance_m', 'angle_rad', 'body_part', 'situation_grouped']]
        df.loc[non_penalty_mask, 'calculated_xg'] = xg_model.predict_proba(X_pred)[:, 1]

    # Set penalty xG to 0.79
    df.loc[~non_penalty_mask, 'calculated_xg'] = 0.79

    # Group by match_id and player_id and sum xG (UPDATED)
    player_match_xg = df.groupby(['match_id', 'player_id'])['calculated_xg'].sum().round(2).reset_index()

    cursor = conn.cursor()
    update_count = 0

    # Update player_match_stats (UPDATED)
    for _, row in player_match_xg.iterrows():
        match_id = int(row['match_id'])
        player_id = int(row['player_id'])
        xg = float(row['calculated_xg'])
        
        cursor.execute("""
            UPDATE player_match_stats
            SET expected_goals = ?
            WHERE match_id = ? AND player_id = ?
        """, (xg, match_id, player_id))

        # Only count if a row was actually updated
        if cursor.rowcount > 0:
            update_count += 1

    conn.commit()
    conn.close()

    print(f"Successfully updated expected_goals for {update_count} player-match records.")

if __name__ == '__main__':
    main()