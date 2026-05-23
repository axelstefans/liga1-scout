# Feature Specification: Liga 1 Peruana 2025 Data Pipeline

**Feature Branch**: `001-sofascore-pipeline`
**Created**: 2026-05-23
**Status**: Draft
**Input**: User description: "Build a data pipeline that discovers and stores all Liga 1 Peruana 2025 season data locally."

---

## Overview

Build an end-to-end data pipeline that pulls Liga 1 Peruana 2025 season data from SofaScore's
undocumented public API, stores it in a local SQLite database (`liga1.db`), and makes every
record queryable by player, team, match, and position.

This is the **foundation layer** of the liga1-scout project. No frontend or API server is
built in this feature — only the scraper modules and the database schema.

Target identifiers:
- **League ID**: 406 (Liga 1 Peruana)
- **Season ID**: 88529 (2025 season)

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Bootstrap the database from zero (Priority: P1)

A developer clones the repo on a fresh machine and runs a single command to populate the
entire `liga1.db` database with all Liga 1 2025 data: teams, players, season stats, and
match stats.

**Why this priority**: Everything else (API, dashboard, analytics) depends on data existing
in the database. This is the unblocking story.

**Independent Test**: Run `python -m scraper.run --full` on an empty `liga1.db`. After it
completes, open the database and verify the `teams`, `players`, `player_season_stats`, and
`player_match_stats` tables are non-empty with correct row counts (18 teams, ~500+ players).

**Acceptance Scenarios**:

1. **Given** an empty `liga1.db`, **When** the full pipeline is run, **Then** all 18 Liga 1
   teams are stored with their SofaScore IDs, names, and short names.
2. **Given** teams are stored, **When** the squad scraper runs, **Then** every player on each
   team roster is stored with their SofaScore player ID, name, position, nationality, and
   jersey number.
3. **Given** players are stored, **When** the season stats scraper runs, **Then** each player
   who appeared in at least one Liga 1 2025 match has a row in `player_season_stats` with
   goals, assists, rating, minutes played, and all available SofaScore fields.
4. **Given** matches are stored, **When** the match stats scraper runs, **Then** each player's
   stats for every individual match they played are stored in `player_match_stats`.

---

### User Story 2 — Incremental refresh without re-scraping cached data (Priority: P2)

A developer runs the pipeline again after two days. Only new matches (played since the last
run) are fetched from SofaScore. Previously scraped data is not re-requested.

**Why this priority**: Responsible scraping (per constitution Principle III) requires caching.
This also keeps subsequent runs fast (seconds, not hours).

**Independent Test**: Run the pipeline twice. Capture the HTTP request count both times.
Second run should make zero requests for already-scraped resources (within the 24h cache window).

**Acceptance Scenarios**:

1. **Given** `liga1.db` already has scraped data, **When** the pipeline runs again within 24
   hours, **Then** no HTTP requests are made for resources with a `scraped_at` timestamp
   within the last 24 hours.
2. **Given** a new match was played since the last run, **When** the pipeline runs, **Then**
   only that match's data is fetched and stored (old rows are not touched).
3. **Given** a scrape request returns HTTP 429, **When** this happens, **Then** the scraper
   logs the error, waits with exponential back-off, retries up to 3 times, and marks the
   resource as `failed` in a `scrape_log` table rather than crashing.

---

### User Story 3 — Query player data by multiple dimensions (Priority: P3)

A developer can answer analytics questions using raw SQL without writing any application
code. The schema is normalized enough to support joins across player, team, match, and position.

**Why this priority**: The database schema must be designed for the analytics use cases
from day one. Retrofitting a schema after scraping is expensive.

**Independent Test**: Run the four SQL queries listed in the Acceptance Scenarios against
a populated `liga1.db`. All must return correct, non-empty results without requiring any
application code.

**Acceptance Scenarios**:

1. **Given** a populated database, **When** running
   `SELECT * FROM player_season_stats WHERE player_id = <X>`,
   **Then** one row is returned with all season aggregate stats for that player.
2. **Given** a populated database, **When** running
   `SELECT * FROM player_match_stats JOIN matches ON ... WHERE team_id = <Y> ORDER BY match_date`,
   **Then** all per-match rows for that team's players are returned in chronological order.
3. **Given** a populated database, **When** running
   `SELECT * FROM players WHERE position_group = 'Forward'`,
   **Then** all forwards across all 18 teams are returned.
4. **Given** a populated database, **When** running a per-90-minutes query
   `SELECT player_id, (goals * 90.0 / minutes_played) AS goals_per_90 FROM player_season_stats WHERE minutes_played > 0`,
   **Then** valid decimal results are returned for every player with playing time.

---

### Edge Cases

- **Player with zero minutes**: A player registered in a squad but who never played must
  exist in `players` but have no row in `player_season_stats` (or a row with all zeros —
  TBD, see Assumptions).
- **Mid-season transfer**: A player who moved teams mid-season must have `player_match_stats`
  rows linked to the correct team for each match date.
- **SofaScore API returning 404**: Some player IDs may be stale. The scraper must log the
  failure and continue rather than crashing the full run.
- **Null/missing stat fields**: SofaScore sometimes omits fields for players with limited
  appearances. All stat columns must be `NULLABLE` so partial data is stored without errors.
- **Goalkeeper vs outfield stats**: Goalkeepers have different relevant fields (saves, goals
  conceded). The schema must accommodate both field sets in the same table using nullable
  columns.
- **Resumed/postponed matches**: Some matches may appear as "postponed" in the fixture list.
  The scraper must store the match status and skip fetching player stats for unplayed matches.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The scraper MUST discover all 18 Liga 1 2025 teams from SofaScore API endpoint
  `GET /api/v1/unique-tournament/{LEAGUE_ID}/season/{SEASON_ID}/teams` and store them in the
  `teams` table.
- **FR-002**: The scraper MUST fetch each team's squad from
  `GET /api/v1/team/{team_id}/players` and store all players in the `players` table with their
  SofaScore player ID, name, position, and shirt number.
- **FR-003**: The scraper MUST fetch season-level statistics for players from
  `GET /api/v1/unique-tournament/{LEAGUE_ID}/season/{SEASON_ID}/statistics/player` (paginated)
  and store them in `player_season_stats`. Fields to capture are listed in Key Entities.
- **FR-004**: The scraper MUST fetch all Liga 1 2025 match events from
  `GET /api/v1/unique-tournament/{LEAGUE_ID}/season/{SEASON_ID}/events` and store them in
  the `matches` table.
- **FR-005**: For every played match, the scraper MUST fetch per-player match statistics from
  `GET /api/v1/event/{event_id}/player-statistics` and store them in `player_match_stats`.
  The lineups endpoint (`GET /api/v1/event/{event_id}/lineups`) is fetched separately to
  capture substitution data (`was_substitute` field).
- **FR-006**: Every HTTP request MUST include a delay of 2–5 seconds (randomized) between
  consecutive requests to the same domain, enforced at the `PoliteRequester` level.
- **FR-007**: Every scraped resource MUST be cached by storing its `scraped_at` timestamp in
  the `scrape_log` table. Resources with a `scraped_at` younger than 24 hours MUST NOT be
  re-fetched (unless `--force` flag is passed).
- **FR-008**: The scraper MUST NOT silently swallow errors. Every failed request MUST be logged
  to `scrape_log` with status `failed` and the HTTP status code or exception message.
- **FR-009**: The pipeline MUST be runnable end-to-end with a single command:
  `python -m scraper.run` (full mode) or with `--teams-only`, `--squads-only`,
  `--season-stats-only`, `--match-stats-only` flags for partial runs.
- **FR-010**: The database MUST be initialized from migration files in `migrations/` in
  numeric order. Running migrations on a database that is already up to date MUST be a
  no-op (idempotent).
- **FR-011**: All SQL queries in the scraper and database layer MUST use parameterized queries
  (`?` placeholders). String-concatenated SQL is forbidden.
- **FR-012**: The pipeline MUST enable SQLite WAL mode and foreign key enforcement at
  connection startup.

### Key Entities *(include if feature involves data)*

- **Team**: Represents a Liga 1 club. Attributes: `team_id` (SofaScore ID), `name`,
  `short_name`, `country`, `logo_url`. Relates to: Players (one team → many players),
  Matches (home/away team per match).

- **Player**: Represents an individual footballer. Attributes: `player_id` (SofaScore ID),
  `name`, `date_of_birth`, `nationality`, `position` (SofaScore string e.g. "F", "M", "D",
  "G"), `position_group` (derived: Forward/Midfielder/Defender/Goalkeeper), `shirt_number`,
  `team_id` (current team). Note: position_group is derived at insert time from SofaScore's
  position field.

- **Match**: Represents a Liga 1 match event. Attributes: `match_id` (SofaScore event ID),
  `home_team_id`, `away_team_id`, `match_date`, `round`, `home_score`, `away_score`,
  `status` (played/postponed/cancelled), `season_id`.

- **PlayerSeasonStats**: One row per player for the full 2025 season aggregate.
  Key numeric fields: `appearances`, `minutes_played`, `goals`, `assists`,
  `yellow_cards`, `red_cards`, `average_sofascore_rating`, `shots_on_target`, `shots_total`,
  `key_passes`, `accurate_passes`, `accurate_passes_percentage`, `dribbles_attempted`,
  `dribbles_succeeded`, `ground_duels_won`, `aerial_duels_won`, `tackles`, `interceptions`,
  `clearances`, `saves` (GK), `goals_conceded` (GK), `expected_goals` (xG),
  `expected_assists` (xA). All stat columns are `REAL` or `INTEGER`, nullable.

- **PlayerMatchStats**: One row per (player × match) combination.
  Key fields: same stat fields as PlayerSeasonStats but for a single match, plus:
  `minutes_played_in_match`, `was_substitute`, `sofascore_rating_in_match`, `match_id`,
  `player_id`, `team_id`.

- **ScrapeLog**: Audit trail for every HTTP request attempted. Fields: `url`, `scraped_at`,
  `status` (success/failed/skipped), `http_status_code`, `error_message`, `response_size_bytes`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a full pipeline run, `liga1.db` contains exactly 18 rows in the `teams`
  table corresponding to the 18 Liga 1 2025 clubs.
- **SC-002**: After a full pipeline run, the `players` table contains at least 400 rows
  (18 teams × ~22 squad players minimum).
- **SC-003**: After a full pipeline run, `player_season_stats` contains at least one row for
  every player who has appeared in a Liga 1 2025 match (expected: 350–500 players).
- **SC-004**: After a full pipeline run, `player_match_stats` contains one row per
  player-per-match (expected: thousands of rows once the season is well underway).
- **SC-005**: A second pipeline run within 24 hours completes without making any HTTP requests
  to api.sofascore.com (verified by counting rows added to `scrape_log`).
- **SC-006**: All four analytical SQL queries from User Story 3 return non-empty, correct
  results without errors.
- **SC-007**: The pipeline does not crash when SofaScore returns a 404 or 429 for a single
  resource — it logs the failure and continues to the next resource.
- **SC-008**: All database inserts use parameterized queries — verified by code review
  (no string concatenation into SQL strings in the codebase).

---

## Assumptions

- SofaScore's public API (api.sofascore.com) does not require authentication for the endpoints
  listed in FR-001 through FR-005. These are the same endpoints the SofaScore mobile app uses
  and are widely documented in the open-source community.
- The SofaScore API returns JSON responses and does not require JavaScript execution (plain
  `httpx` or `requests` is sufficient; Playwright is not needed for this data source).
- The LEAGUE_ID (406) and SEASON_ID (88529) are correct and stable for the Liga 1 2025 season.
  These constants are stored in `scraper/config.py` and must be easily changeable for future seasons.
- The developer is running Python 3.11+ and `uv` is available for environment management.
- The initial full scrape (all teams, all squads, all season stats, all match stats) will
  take 30–90 minutes due to the mandatory politeness delays. This is expected and acceptable.
- Match stats for future (unplayed) matches will not be scraped — the scraper checks
  match `status` before attempting to fetch lineup/stats data.
- Player statistics for a mid-season transfer will be attributed to their team at the time of
  the match, not their current team. The `player_match_stats.team_id` field captures this.
- Out-of-scope for this feature: API server, frontend, any analytics computations, similarity
  scores. Those come in later features.
- A player with no appearances in Liga 1 2025 (e.g., signed but never selected) will have a
  row in `players` but NO row in `player_season_stats`. The analytics layer will handle this
  with a LEFT JOIN.

---

## Technical Notes

### Project Directory Structure (proposed)

```
liga1-scout/
├── liga1.db                    # SQLite database (gitignored)
├── migrations/
│   ├── 001_initial_schema.sql  # Teams, players, matches tables
│   ├── 002_season_stats.sql    # player_season_stats table
│   ├── 003_match_stats.sql     # player_match_stats table
│   └── 004_scrape_log.sql      # scrape_log audit table
├── scraper/
│   ├── __init__.py
│   ├── run.py                  # CLI entry point (python -m scraper.run)
│   ├── config.py               # LEAGUE_ID, SEASON_ID, DB_PATH, delays
│   ├── db.py                   # DB connection, migration runner
│   ├── http_client.py          # PoliteRequester with delays + caching
│   └── sources/
│       ├── __init__.py
│       ├── sofascore.py        # All SofaScore API calls
│       ├── teams.py            # Team discovery pipeline step
│       ├── squads.py           # Squad/player discovery pipeline step
│       ├── season_stats.py     # Season-level stats pipeline step
│       ├── matches.py          # Match discovery pipeline step
│       └── match_stats.py      # Per-match player stats pipeline step
├── shared/
│   └── models.py               # Dataclasses for Team, Player, Match, etc.
└── .env                        # DB_PATH, LOG_LEVEL (gitignored)
```

### SofaScore API Endpoints

All requests use base URL `https://api.sofascore.com/api/v1/`. SofaScore requires
browser-like headers to avoid `403 Forbidden`. No API key or token is needed.

```python
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.sofascore.com/",
    "Origin": "https://www.sofascore.com",
}
```

| Step | Endpoint | Notes |
|------|----------|-------|
| Teams | `GET /unique-tournament/406/season/88529/teams` | Returns JSON with `teams` array |
| Squad | `GET /team/{team_id}/players` | Returns current squad; not season-specific |
| Season stats | `GET /unique-tournament/406/season/88529/statistics?limit=100&offset=0&accumulation=total&order=-rating` | Paginated with `offset`; check `hasNextPage` in response |
| Matches by round | `GET /unique-tournament/406/season/88529/events/round/{round}` | Preferred; iterate rounds 1–N until empty |
| Matches paginated | `GET /unique-tournament/406/season/88529/events/last/{page}` | Alternative; page=0,1,2... |
| Match player stats | `GET /event/{match_id}/player-statistics` | All players' stats for one match |
| Match lineups | `GET /event/{match_id}/lineups` | Starting XI + substitutes (for `was_substitute` field) |
| Standings | `GET /unique-tournament/406/season/88529/standings/total` | Optional; for context |
| Player profile | `GET /player/{player_id}` | DOB, nationality, position details |

### Database Schema Sketch

```sql
-- All tables use SofaScore IDs as primary keys (INTEGER, not AUTOINCREMENT)
-- so they can be referenced directly from API responses.

CREATE TABLE teams (
    team_id     INTEGER PRIMARY KEY,  -- SofaScore team ID
    name        TEXT    NOT NULL,
    short_name  TEXT,
    country     TEXT,
    logo_url    TEXT,
    scraped_at  TEXT    NOT NULL      -- ISO 8601 timestamp
);

CREATE TABLE players (
    player_id       INTEGER PRIMARY KEY,  -- SofaScore player ID
    team_id         INTEGER REFERENCES teams(team_id),
    name            TEXT    NOT NULL,
    date_of_birth   TEXT,               -- YYYY-MM-DD
    nationality     TEXT,
    position        TEXT,               -- SofaScore raw: F, M, D, G
    position_group  TEXT,               -- Derived: Forward/Midfielder/Defender/Goalkeeper
    shirt_number    INTEGER,
    scraped_at      TEXT    NOT NULL
);

CREATE TABLE matches (
    match_id        INTEGER PRIMARY KEY,  -- SofaScore event ID
    home_team_id    INTEGER REFERENCES teams(team_id),
    away_team_id    INTEGER REFERENCES teams(team_id),
    match_date      TEXT    NOT NULL,     -- ISO 8601
    round           INTEGER,
    home_score      INTEGER,
    away_score      INTEGER,
    status          TEXT    NOT NULL,     -- played | postponed | cancelled | scheduled
    season_id       INTEGER NOT NULL,
    scraped_at      TEXT    NOT NULL
);

CREATE TABLE player_season_stats (
    player_id                   INTEGER PRIMARY KEY REFERENCES players(player_id),
    team_id                     INTEGER REFERENCES teams(team_id),
    appearances                 INTEGER,
    minutes_played              INTEGER,
    goals                       INTEGER,
    assists                     INTEGER,
    yellow_cards                INTEGER,
    red_cards                   INTEGER,
    average_sofascore_rating    REAL,
    shots_on_target             INTEGER,
    shots_total                 INTEGER,
    key_passes                  INTEGER,
    accurate_passes             INTEGER,
    accurate_passes_percentage  REAL,
    dribbles_attempted          INTEGER,
    dribbles_succeeded          INTEGER,
    ground_duels_won            INTEGER,
    aerial_duels_won            INTEGER,
    tackles                     INTEGER,
    interceptions               INTEGER,
    clearances                  INTEGER,
    saves                       INTEGER,    -- GK only
    goals_conceded              INTEGER,    -- GK only
    expected_goals              REAL,       -- xG
    expected_assists            REAL,       -- xA
    scraped_at                  TEXT NOT NULL
);

CREATE TABLE player_match_stats (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id               INTEGER NOT NULL REFERENCES players(player_id),
    match_id                INTEGER NOT NULL REFERENCES matches(match_id),
    team_id                 INTEGER NOT NULL REFERENCES teams(team_id),
    minutes_played          INTEGER,
    was_substitute          INTEGER,        -- 0 or 1 (BOOLEAN)
    sofascore_rating        REAL,
    goals                   INTEGER,
    assists                 INTEGER,
    yellow_cards            INTEGER,
    red_cards               INTEGER,
    shots_on_target         INTEGER,
    shots_total             INTEGER,
    key_passes              INTEGER,
    accurate_passes         INTEGER,
    dribbles_succeeded      INTEGER,
    ground_duels_won        INTEGER,
    aerial_duels_won        INTEGER,
    tackles                 INTEGER,
    interceptions           INTEGER,
    saves                   INTEGER,        -- GK only
    goals_conceded          INTEGER,        -- GK only
    scraped_at              TEXT NOT NULL,
    UNIQUE(player_id, match_id)             -- prevent duplicate rows
);

CREATE TABLE scrape_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    url             TEXT    NOT NULL,
    scraped_at      TEXT    NOT NULL,
    status          TEXT    NOT NULL,    -- success | failed | skipped
    http_status_code INTEGER,
    error_message   TEXT,
    response_size_bytes INTEGER
);
```
