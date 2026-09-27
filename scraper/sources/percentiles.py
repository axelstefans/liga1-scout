import sqlite3
import pandas as pd
import numpy as np
from scipy import stats
import logging

logger = logging.getLogger(__name__)

VOLUME_STATS = [
    'goals', 'assists', 'key_passes', 'successful_dribbles',
    'tackles', 'interceptions', 'saves', 'clean_sheets',
    'expected_goals', 'accurate_final_third_passes', 'clearances',
    'shots_on_target', 'aerial_duels_won'
]

NON_VOLUME_STATS = [
    'rating', 'minutes_played', 'accurate_passes_percentage', 'ground_duels_won_percentage'
]

def compute_and_store_percentiles(conn: sqlite3.Connection):
    logger.info("Computing player season percentiles...")
    
    # Extract data
    query = """
        SELECT 
            pss.player_id, 
            p.position_group,
            pss.minutes_played,
            pss.goals, pss.assists, pss.key_passes, pss.successful_dribbles,
            pss.tackles, pss.interceptions, pss.saves, pss.clean_sheets,
            pss.expected_goals, pss.accurate_final_third_passes, pss.clearances,
            pss.shots_on_target, pss.aerial_duels_won,
            pss.rating, pss.accurate_passes_percentage, pss.ground_duels_won_percentage
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
    """
    df = pd.read_sql_query(query, conn)
    
    if df.empty:
        logger.info("No player season stats found. Skipping percentiles.")
        return

    # Fill NA with 0 for computation purposes
    df = df.fillna(0)
    
    # Apply 90-minute floor to minutes_played for per-90 conversion denominator
    df['minutes_denom'] = df['minutes_played'].clip(lower=90)

    # Convert volume stats to per-90
    for stat in VOLUME_STATS:
        df[f'{stat}_p90'] = (df[stat] / df['minutes_denom']) * 90

    metrics_to_rank = [f'{stat}_p90' for stat in VOLUME_STATS] + NON_VOLUME_STATS

    # Build qualified pool (strict 450+ minutes qualification threshold)
    qualified_df = df[df['minutes_played'] >= 450].copy()
    unqualified_df = df[df['minutes_played'] < 450].copy()
    
    # Compute percentiles for qualified pool
    result_records = []
    
    # Store qualified distributions for scipy
    distributions = {}

    for pos_group in df['position_group'].unique():
        pos_qual = qualified_df[qualified_df['position_group'] == pos_group].copy()
        
        if len(pos_qual) == 0:
            continue
            
        distributions[pos_group] = {}
        
        for metric in metrics_to_rank:
            # Rank (pct=True) gives 0-1, so multiply by 100
            pos_qual[f'{metric}_pct'] = pos_qual[metric].rank(pct=True) * 100
            # Save the distribution array for unqualified scoring
            distributions[pos_group][metric] = pos_qual[metric].values

        result_records.extend(pos_qual.to_dict('records'))
        
    # Process unqualified players
    for _, row in unqualified_df.iterrows():
        pos = row['position_group']
        rec = row.to_dict()
        
        for metric in metrics_to_rank:
            if pos in distributions and len(distributions[pos][metric]) > 0:
                pct = stats.percentileofscore(distributions[pos][metric], row[metric], kind='weak')
            else:
                # If no qualified players in this position group, just give 50
                pct = 50.0
            rec[f'{metric}_pct'] = pct
            
        result_records.append(rec)
        
    if not result_records:
        return
        
    # Prepare for UPSERT
    final_df = pd.DataFrame(result_records)
    
    # Map back to final column names
    column_mapping = {f'{s}_p90_pct': f'{s}_pct' for s in VOLUME_STATS}
    for s in NON_VOLUME_STATS:
        column_mapping[f'{s}_pct'] = f'{s}_pct'
        
    # Select player_id and the percentile columns
    cols_to_keep = ['player_id'] + list(column_mapping.values())
    
    # Rename
    final_df = final_df.rename(columns=column_mapping)
    final_df = final_df[cols_to_keep]
    
    # Insert into database
    records = final_df.to_dict('records')
    
    cursor = conn.cursor()
    
    # UPSERT query
    columns = ", ".join(cols_to_keep)
    placeholders = ", ".join(["?"] * len(cols_to_keep))
    updates = ", ".join([f"{col} = excluded.{col}" for col in cols_to_keep if col != 'player_id'])
    
    sql = f"""
        INSERT INTO player_season_percentiles ({columns})
        VALUES ({placeholders})
        ON CONFLICT(player_id) DO UPDATE SET
        {updates}
    """
    
    data_tuples = [tuple(rec[col] for col in cols_to_keep) for rec in records]
    
    cursor.executemany(sql, data_tuples)
    conn.commit()
    
    logger.info(f"Computed and stored percentiles for {len(records)} players.")
