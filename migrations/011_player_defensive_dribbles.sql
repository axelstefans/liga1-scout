CREATE TABLE IF NOT EXISTS player_defensive_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER REFERENCES matches(match_id),
    player_id INTEGER REFERENCES players(player_id),
    x REAL,
    y REAL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_defensive_actions_match ON player_defensive_actions(match_id);
CREATE INDEX IF NOT EXISTS idx_player_defensive_actions_player ON player_defensive_actions(player_id);

CREATE TABLE IF NOT EXISTS player_dribbles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER REFERENCES matches(match_id),
    player_id INTEGER REFERENCES players(player_id),
    x REAL,
    y REAL,
    is_successful BOOLEAN,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_dribbles_match ON player_dribbles(match_id);
CREATE INDEX IF NOT EXISTS idx_player_dribbles_player ON player_dribbles(player_id);
