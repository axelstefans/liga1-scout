-- Market values and transfer history from Transfermarkt.

CREATE TABLE IF NOT EXISTS player_market_values (
    player_id       INTEGER PRIMARY KEY REFERENCES players(player_id),
    tm_player_id    TEXT,
    market_value_eur INTEGER,       -- in euros
    market_value_str TEXT,          -- original string from Transfermarkt (e.g. "2.5 Mill.")
    value_date      TEXT,           -- date of valuation
    scraped_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transfer_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id       INTEGER REFERENCES players(player_id),
    from_club       TEXT,
    to_club         TEXT,
    transfer_date   TEXT,
    transfer_fee    TEXT,           -- raw string (free/loan/€500K)
    transfer_type   TEXT,           -- permanent | loan | free
    scraped_at      TEXT NOT NULL
);
