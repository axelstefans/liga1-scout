-- Per-match player statistics (one row per player per match).

CREATE TABLE IF NOT EXISTS player_match_stats (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id              INTEGER NOT NULL REFERENCES players(player_id),
    match_id               INTEGER NOT NULL REFERENCES matches(match_id),
    team_id                INTEGER NOT NULL REFERENCES teams(team_id),
    -- Playing time
    minutes_played         INTEGER,
    was_substitute         INTEGER,    -- 0 = starter, 1 = sub
    sofascore_rating       REAL,
    -- Goals & assists
    goals                  INTEGER,
    assists                INTEGER,
    -- Cards
    yellow_cards           INTEGER,
    red_cards              INTEGER,
    -- Shooting
    total_shots            INTEGER,
    shots_on_target        INTEGER,
    expected_goals         REAL,
    -- Passing
    accurate_passes        INTEGER,
    accurate_passes_pct    REAL,
    key_passes             INTEGER,
    big_chances_created    INTEGER,
    -- Duels
    ground_duels_won       INTEGER,
    aerial_duels_won       INTEGER,
    successful_dribbles    INTEGER,
    -- Defending
    tackles                INTEGER,
    interceptions          INTEGER,
    clearances             INTEGER,
    -- GK only
    saves                  INTEGER,
    goals_conceded         INTEGER,
    scraped_at             TEXT NOT NULL,
    UNIQUE(player_id, match_id)    -- prevent duplicates
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_pms_match    ON player_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_pms_player   ON player_match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_pms_team     ON player_match_stats(team_id);
