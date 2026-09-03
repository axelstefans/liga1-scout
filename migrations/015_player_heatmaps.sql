CREATE TABLE IF NOT EXISTS player_heatmaps (
    player_id INTEGER REFERENCES players(player_id),
    season_id INTEGER,
    heatmap_json TEXT,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_id, season_id)
);
