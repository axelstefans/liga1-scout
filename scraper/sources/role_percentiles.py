"""
Role-based Tactical Cohort Percentiles and Metric Quality Generator.
Calculates percentiles within tactical role groups without altering player_season_percentiles.
"""

import sqlite3
import logging
from typing import Dict, Any, List
import pandas as pd
import numpy as np
from scipy import stats

from api.core.roles import (
    MIN_QUALIFIED_MINUTES,
    MIN_COHORT_SIZE,
    init_roles_schema
)

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

ALL_STATS = VOLUME_STATS + NON_VOLUME_STATS

ROLE_PERCENTILE_COLUMNS = [
    'player_id', 'role_group', 'cohort_size',
    'goals_pct', 'assists_pct', 'key_passes_pct', 'successful_dribbles_pct',
    'tackles_pct', 'interceptions_pct', 'rating_pct', 'minutes_played_pct',
    'accurate_passes_percentage_pct', 'ground_duels_won_percentage_pct',
    'saves_pct', 'clean_sheets_pct', 'expected_goals_pct',
    'accurate_final_third_passes_pct', 'clearances_pct',
    'shots_on_target_pct', 'aerial_duels_won_pct'
]

def compute_and_store_role_percentiles(conn: sqlite3.Connection) -> None:
    """
    Compute percentiles within tactical role cohorts and populate:
    1. player_season_role_percentiles
    2. role_metric_quality
    """
    logger.info("Computing player season tactical role percentiles...")
    init_roles_schema(conn)

    query = """
        SELECT 
            pss.player_id, 
            p.position_group,
            prg.role_group,
            pss.minutes_played,
            pss.goals, pss.assists, pss.key_passes, pss.successful_dribbles,
            pss.tackles, pss.interceptions, pss.saves, pss.clean_sheets,
            pss.expected_goals, pss.accurate_final_third_passes, pss.clearances,
            pss.shots_on_target, pss.aerial_duels_won,
            pss.rating, pss.accurate_passes_percentage, pss.ground_duels_won_percentage
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        LEFT JOIN player_role_groups prg ON p.player_id = prg.player_id
    """
    df = pd.read_sql_query(query, conn)
    if df.empty:
        logger.info("No player season stats found. Skipping role percentiles.")
        return

    # Fill NA for numeric metrics
    for stat in ALL_STATS:
        df[stat] = df[stat].fillna(0)

    # Per-90 normalization for volume stats with 90-minute floor
    df['minutes_denom'] = df['minutes_played'].clip(lower=90)
    for stat in VOLUME_STATS:
        df[f'{stat}_p90'] = (df[stat] / df['minutes_denom']) * 90

    # Load current player_season_percentiles for fallback
    cur_pcts_df = pd.read_sql_query("SELECT * FROM player_season_percentiles", conn)
    cur_pcts_map = {int(row['player_id']): row for _, row in cur_pcts_df.iterrows()}

    # Split qualified vs unqualified
    qual_df = df[df['minutes_played'] >= MIN_QUALIFIED_MINUTES].copy()
    unqual_df = df[df['minutes_played'] < MIN_QUALIFIED_MINUTES].copy()

    # Fallback cohort sizes by position_group
    pos_cohort_sizes = qual_df.groupby('position_group').size().to_dict()

    # Valid role cohorts (must have >= MIN_COHORT_SIZE qualified players and be outfield defense/midfield)
    role_counts = qual_df[qual_df['role_group'].notna()].groupby('role_group').size().to_dict()
    valid_roles = {r for r, count in role_counts.items() if count >= MIN_COHORT_SIZE and r not in ('Forward', 'Goalkeeper')}

    result_records: List[Dict[str, Any]] = []
    distributions: Dict[str, Dict[str, np.ndarray]] = {}

    # 1. Qualified players in valid tactical roles
    for role in sorted(valid_roles):
        role_qual = qual_df[qual_df['role_group'] == role].copy()
        c_size = len(role_qual)
        distributions[role] = {}

        for stat in VOLUME_STATS:
            col = f'{stat}_p90'
            role_qual[f'{stat}_pct'] = role_qual[col].rank(pct=True) * 100
            distributions[role][stat] = role_qual[col].values

        for stat in NON_VOLUME_STATS:
            role_qual[f'{stat}_pct'] = role_qual[stat].rank(pct=True) * 100
            distributions[role][stat] = role_qual[stat].values

        for _, row in role_qual.iterrows():
            rec = {
                'player_id': int(row['player_id']),
                'role_group': role,
                'cohort_size': c_size
            }
            for stat in ALL_STATS:
                rec[f'{stat}_pct'] = float(row[f'{stat}_pct'])
            result_records.append(rec)

    # 2. Qualified fallback players (role is None, or not in valid roles, or Forward/Goalkeeper)
    fallback_qual = qual_df[~qual_df['role_group'].isin(valid_roles)].copy()
    for _, row in fallback_qual.iterrows():
        pid = int(row['player_id'])
        pos = row['position_group']
        c_size = pos_cohort_sizes.get(pos, 0)
        cur_pct = cur_pcts_map.get(pid)
        rec = {
            'player_id': pid,
            'role_group': None,
            'cohort_size': c_size
        }
        for stat in ALL_STATS:
            rec[f'{stat}_pct'] = float(cur_pct[f'{stat}_pct']) if cur_pct is not None else 50.0
        result_records.append(rec)

    # 3. Unqualified players (< 450 min)
    for _, row in unqual_df.iterrows():
        pid = int(row['player_id'])
        role = row['role_group']
        pos = row['position_group']
        cur_pct = cur_pcts_map.get(pid)

        if role in distributions:
            c_size = len(distributions[role][ALL_STATS[0]])
            rec = {
                'player_id': pid,
                'role_group': role,
                'cohort_size': c_size
            }
            for stat in ALL_STATS:
                col = f'{stat}_p90' if stat in VOLUME_STATS else stat
                pct = stats.percentileofscore(distributions[role][stat], row[col], kind='weak')
                rec[f'{stat}_pct'] = float(pct)
        else:
            c_size = pos_cohort_sizes.get(pos, 0)
            rec = {
                'player_id': pid,
                'role_group': None,
                'cohort_size': c_size
            }
            for stat in ALL_STATS:
                rec[f'{stat}_pct'] = float(cur_pct[f'{stat}_pct']) if cur_pct is not None else 50.0
        result_records.append(rec)

    cursor = conn.cursor()

    # UPSERT player_season_role_percentiles
    cols = ", ".join(ROLE_PERCENTILE_COLUMNS)
    placeholders = ", ".join(["?"] * len(ROLE_PERCENTILE_COLUMNS))
    updates = ", ".join([f"{c} = excluded.{c}" for c in ROLE_PERCENTILE_COLUMNS if c != 'player_id'])

    upsert_role_pct_sql = f"""
        INSERT INTO player_season_role_percentiles ({cols})
        VALUES ({placeholders})
        ON CONFLICT(player_id) DO UPDATE SET
        {updates};
    """
    tuples = [tuple(r.get(c) for c in ROLE_PERCENTILE_COLUMNS) for r in result_records]
    cursor.executemany(upsert_role_pct_sql, tuples)

    # 4. Compute role_metric_quality for valid roles and fallback position groups
    quality_records = []

    # Valid tactical roles
    for role in sorted(valid_roles):
        sub = qual_df[qual_df['role_group'] == role]
        c_size = len(sub)
        for stat in ALL_STATS:
            col = f'{stat}_p90' if stat in VOLUME_STATS else stat
            zero_share = float((sub[col] == 0).mean())
            tie_share = float(sub[col].duplicated(keep=False).mean())
            low_conf = 1 if (zero_share >= 0.30 or c_size < 40) else 0
            quality_records.append((role, stat, c_size, round(zero_share, 4), round(tie_share, 4), low_conf))

    # Fallback position groups
    for pos in sorted(pos_cohort_sizes.keys()):
        sub = qual_df[qual_df['position_group'] == pos]
        c_size = len(sub)
        for stat in ALL_STATS:
            col = f'{stat}_p90' if stat in VOLUME_STATS else stat
            zero_share = float((sub[col] == 0).mean())
            tie_share = float(sub[col].duplicated(keep=False).mean())
            low_conf = 1 if (zero_share >= 0.30 or c_size < 40) else 0
            quality_records.append((pos, stat, c_size, round(zero_share, 4), round(tie_share, 4), low_conf))

    upsert_quality_sql = """
        INSERT OR REPLACE INTO role_metric_quality (role_group, metric, cohort_size, zero_share, tie_share, low_confidence)
        VALUES (?, ?, ?, ?, ?, ?);
    """
    cursor.executemany(upsert_quality_sql, quality_records)

    conn.commit()
    logger.info(f"Stored role percentiles for {len(result_records)} players and {len(quality_records)} metric quality entries.")
