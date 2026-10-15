-- Migration 020: Create table for Flashscore match team statistics

CREATE TABLE IF NOT EXISTS flashscore_match_team_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER,
    flashscore_event_id TEXT NOT NULL,
    team_id INTEGER,
    flashscore_team_id TEXT NOT NULL,
    period TEXT NOT NULL, -- '1T', '2T', 'ALL'

    -- Shot & Attacking metrics
    xg REAL,
    xgot REAL,
    shots_total INT,
    shots_on_target INT,
    shots_off_target INT,
    shots_blocked INT,
    shots_inside_box INT,
    shots_outside_box INT,
    big_chances INT,
    big_chances_scored INT,
    big_chances_missed INT,
    hit_woodwork INT,
    headed_goals INT,

    -- Possession & Passing metrics
    possession REAL,
    passes_total INT,
    passes_completed INT,
    passes_final_third_total INT,
    passes_final_third_completed INT,
    crosses_total INT,
    crosses_completed INT,
    long_balls_total INT,
    long_balls_completed INT,
    xa REAL,
    key_passes INT,
    touches_in_box INT,
    throw_ins INT,

    -- Defending & Duels metrics
    fouls INT,
    free_kicks INT,
    duels_won INT,
    tackles_total INT,
    tackles_won INT,
    interceptions INT,
    clearances INT,
    offsides INT,
    corner_kicks INT,
    errors_lead_to_shot INT,
    errors_lead_to_goal INT,

    -- Goalkeeping metrics
    saves INT,
    xgot_faced REAL,
    goals_prevented REAL,
    goal_kicks INT,
    goals_conceded INT,

    -- Discipline
    yellow_cards INT,
    red_cards INT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (flashscore_event_id, flashscore_team_id, period)
);

CREATE INDEX IF NOT EXISTS idx_fmts_match_id ON flashscore_match_team_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_fmts_event_id ON flashscore_match_team_stats(flashscore_event_id);
CREATE INDEX IF NOT EXISTS idx_fmts_team_id ON flashscore_match_team_stats(team_id);
