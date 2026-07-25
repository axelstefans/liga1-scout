CREATE TABLE IF NOT EXISTS player_passes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER REFERENCES matches(match_id),
    player_id INTEGER REFERENCES players(player_id),
    x_start REAL,
    y_start REAL,
    x_end REAL,
    y_end REAL,
    is_successful BOOLEAN,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_player_passes_match ON player_passes(match_id);
CREATE INDEX idx_player_passes_player ON player_passes(player_id);
