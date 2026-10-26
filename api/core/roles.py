"""
Role and Tactical Cohort Definitions for Liga 1 Scout Dashboard.
Single source of truth for mapping player_match_stats positions to tactical role groups.
"""

import sqlite3
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Configurable constants
MIN_CLASSIFIED_MINUTES = 180
MIN_COHORT_SIZE = 25
MIN_QUALIFIED_MINUTES = 450

# Mapping: (code, position_group, role_group)
ROLE_MAPPINGS = [
    # Defender
    ('CB', 'Defender', 'Centre Back'),
    ('LCB', 'Defender', 'Centre Back'),
    ('RCB', 'Defender', 'Centre Back'),
    ('LB', 'Defender', 'Full Back'),
    ('RB', 'Defender', 'Full Back'),
    ('LWB', 'Defender', 'Full Back'),
    ('RWB', 'Defender', 'Full Back'),
    # Midfielder
    ('LDM', 'Midfielder', 'Defensive Mid'),
    ('RDM', 'Midfielder', 'Defensive Mid'),
    ('CDM', 'Midfielder', 'Defensive Mid'),
    ('LCDM', 'Midfielder', 'Defensive Mid'),
    ('RCDM', 'Midfielder', 'Defensive Mid'),
    ('LCM', 'Midfielder', 'Central Mid'),
    ('RCM', 'Midfielder', 'Central Mid'),
    ('CM', 'Midfielder', 'Central Mid'),
    ('CAM', 'Midfielder', 'Wide/AM'),
    ('LAM', 'Midfielder', 'Wide/AM'),
    ('RAM', 'Midfielder', 'Wide/AM'),
    ('LCAM', 'Midfielder', 'Wide/AM'),
    ('LM', 'Midfielder', 'Wide/AM'),
    ('RM', 'Midfielder', 'Wide/AM'),
    ('LW', 'Midfielder', 'Wide/AM'),
    ('RW', 'Midfielder', 'Wide/AM'),
    ('LWM', 'Midfielder', 'Wide/AM'),
    ('RWM', 'Midfielder', 'Wide/AM'),
    ('LW', 'Forward', 'Wide/AM'),
    ('RW', 'Forward', 'Wide/AM'),
    # Striker
    ('ST', 'Forward', 'Striker'),
    ('CF', 'Forward', 'Striker'),
    ('SS', 'Forward', 'Striker'),
    ('RS', 'Forward', 'Striker'),
    ('LS', 'Forward', 'Striker'),
    ('ST', 'Midfielder', 'Striker'),
    ('CF', 'Midfielder', 'Striker'),
    ('SS', 'Midfielder', 'Striker'),
    ('RS', 'Midfielder', 'Striker'),
    ('LS', 'Midfielder', 'Striker'),
]

INIT_ROLE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS position_role_map (
    code TEXT NOT NULL,
    position_group TEXT NOT NULL,
    role_group TEXT NOT NULL,
    PRIMARY KEY (code, position_group)
);
"""

INIT_ROLE_VIEW_SQL = f"""
DROP VIEW IF EXISTS player_role_groups;
CREATE VIEW player_role_groups AS
WITH player_roles AS (
    SELECT 
        p.player_id,
        prm.role_group,
        SUM(COALESCE(pms.minutes_played, 0)) as role_minutes
    FROM players p
    JOIN player_match_stats pms ON p.player_id = pms.player_id
    JOIN position_role_map prm ON pms.position = prm.code AND p.position_group = prm.position_group
    GROUP BY p.player_id, prm.role_group
),
player_totals AS (
    SELECT 
        player_id,
        SUM(role_minutes) as classified_minutes,
        MAX(role_minutes) as max_minutes
    FROM player_roles
    GROUP BY player_id
),
top_roles AS (
    SELECT 
        pr.player_id,
        pr.role_group,
        pt.classified_minutes,
        COUNT(*) OVER (PARTITION BY pr.player_id) as top_role_count
    FROM player_roles pr
    JOIN player_totals pt ON pr.player_id = pt.player_id AND pr.role_minutes = pt.max_minutes
)
SELECT 
    p.player_id,
    CASE 
        WHEN tr.classified_minutes < {MIN_CLASSIFIED_MINUTES} THEN NULL
        WHEN tr.top_role_count > 1 THEN NULL
        ELSE tr.role_group
    END as role_group,
    COALESCE(tr.classified_minutes, 0) as classified_minutes
FROM players p
LEFT JOIN top_roles tr ON p.player_id = tr.player_id
GROUP BY p.player_id;
"""

INIT_ROLE_PERCENTILES_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS player_season_role_percentiles (
    player_id INTEGER PRIMARY KEY,
    role_group TEXT,
    cohort_size INTEGER,
    goals_pct REAL,
    assists_pct REAL,
    key_passes_pct REAL,
    successful_dribbles_pct REAL,
    tackles_pct REAL,
    interceptions_pct REAL,
    rating_pct REAL,
    minutes_played_pct REAL,
    accurate_passes_percentage_pct REAL,
    ground_duels_won_percentage_pct REAL,
    saves_pct REAL,
    clean_sheets_pct REAL,
    expected_goals_pct REAL,
    accurate_final_third_passes_pct REAL,
    clearances_pct REAL,
    shots_on_target_pct REAL,
    aerial_duels_won_pct REAL,
    FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS role_metric_quality (
    role_group TEXT NOT NULL,
    metric TEXT NOT NULL,
    cohort_size INTEGER NOT NULL,
    zero_share REAL NOT NULL,
    tie_share REAL NOT NULL,
    low_confidence INTEGER NOT NULL,
    PRIMARY KEY (role_group, metric)
);
"""

def init_roles_schema(conn: sqlite3.Connection) -> None:
    """
    Idempotent initialization of position_role_map table, player_role_groups view,
    player_season_role_percentiles table, and role_metric_quality table.
    Safe to run repeatedly on startup or migration.
    """
    cursor = conn.cursor()
    cursor.execute(INIT_ROLE_TABLE_SQL)
    cursor.executemany(
        """
        INSERT OR REPLACE INTO position_role_map (code, position_group, role_group)
        VALUES (?, ?, ?);
        """,
        ROLE_MAPPINGS
    )
    cursor.executescript(INIT_ROLE_VIEW_SQL)
    cursor.executescript(INIT_ROLE_PERCENTILES_TABLES_SQL)
    conn.commit()
    logger.info("Position role map table, player_role_groups view, and role percentiles tables initialized successfully.")

def get_cohort_role_group(db: sqlite3.Connection, role_group: Optional[str]) -> Optional[str]:
    """
    Helper to check if a player's role_group qualifies as a cohort_role_group.
    Returns role_group only if it is not None and has >= MIN_COHORT_SIZE qualified players (>= MIN_QUALIFIED_MINUTES).
    Otherwise returns None.
    """
    if not role_group:
        return None

    count_query = """
        SELECT COUNT(*)
        FROM player_season_stats pss
        JOIN player_role_groups prg ON pss.player_id = prg.player_id
        WHERE prg.role_group = ? AND pss.minutes_played >= ?
    """
    row = db.execute(count_query, (role_group, MIN_QUALIFIED_MINUTES)).fetchone()
    count = row[0] if row else 0
    return role_group if count >= MIN_COHORT_SIZE else None
