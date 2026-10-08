-- Migration 019: Ensure match_period_stats and match_goal_incidents tables exist

CREATE TABLE IF NOT EXISTS match_period_stats (
    match_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    period TEXT NOT NULL,
    possession REAL,
    corner_kicks INTEGER,
    fouls INTEGER,
    yellow_cards INTEGER,
    red_cards INTEGER,
    goals INTEGER,
    PRIMARY KEY (match_id, team_id, period)
);

CREATE TABLE IF NOT EXISTS match_goal_incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    player_name TEXT,
    minute INTEGER,
    period TEXT,
    is_corner_origin BOOLEAN,
    incident_type TEXT
);

CREATE INDEX IF NOT EXISTS idx_mps_match ON match_period_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_mgi_match ON match_goal_incidents(match_id);
