CREATE TABLE IF NOT EXISTS player_ball_carries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER REFERENCES matches(match_id),
    player_id INTEGER REFERENCES players(player_id),
    season_id INTEGER,
    x_start REAL,
    y_start REAL,
    x_end REAL,
    y_end REAL,
    is_home BOOLEAN,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_ball_carries_match ON player_ball_carries(match_id);
CREATE INDEX IF NOT EXISTS idx_player_ball_carries_player ON player_ball_carries(player_id);
CREATE INDEX IF NOT EXISTS idx_player_ball_carries_lookup ON player_ball_carries(player_id, season_id);
