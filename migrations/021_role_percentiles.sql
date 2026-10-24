-- Migration 021: Tactical Role Percentiles and Metric Quality Tables

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
