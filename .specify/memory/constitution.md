# Liga 1 Scout Constitution

## Core Principles

### I. SQLite as Single Source of Truth
All persistent data lives in a single SQLite database file (`liga1.db`). No other databases, caches, or flat-file stores (JSON, CSV, pickle) are used as primary storage. Raw scraped data, cleaned data, and computed metrics all reside in the same file under separate tables.

- Migrations are numbered sequential SQL files (`migrations/001_initial.sql`, `002_add_xg.sql`, etc.)
- Schema changes always go through a migration — never alter tables manually
- The database is the record of truth; the API only reads from it
- Beginners must be able to understand every table by reading its `CREATE TABLE` statement alone — descriptive column names and inline comments are mandatory

### II. Strict Layer Separation
The project is divided into three layers that must not bleed into each other:

- **Scraper layer** (`scraper/`): Fetches raw HTML/JSON from external sources and writes raw data to SQLite. No business logic. No HTTP responses go directly to the API.
- **API layer** (`api/`): FastAPI application. Reads from SQLite only. No network calls, no scraping, no file writes.
- **Frontend layer** (`frontend/`): React SPA. Calls the API only. No direct database access, no scraping.

Imports that cross layer boundaries in the wrong direction are forbidden. A router file in `api/` must never import anything from `scraper/`.

### III. Responsible Scraping (NON-NEGOTIABLE)
Scraping is a privilege, not a right. The scraper must be a good citizen:

- Every request includes a descriptive `User-Agent` string identifying the project
- A mandatory delay of **2–5 seconds** (randomized) between consecutive requests to the same domain
- Scraped data is cached in SQLite with a `scraped_at` timestamp; re-scraping the same resource within 24 hours is forbidden unless forced explicitly
- No scraping during Liga 1 blackout hours if known (respect `robots.txt` spirit)
- Failures are logged and retried with exponential back-off; never silently swallowed

### IV. Readability Over Cleverness
This project is a learning environment for SQLite and data analytics. SQL must teach, not impress. Python and React code prioritize conciseness and efficiency instead — the learning focus of this project is the database layer, not general-purpose code style. 

- SQL queries are written in full, multi-line format 
— never concatenated strings or one-liners 
- Every non-trivial SQL query has a comment explaining *why* it does what it does, not just *what* 
- Python and React: no comments that restate the obvious; comment only where a decision is non-evident. No emojis. 
- Variable names are explicit in all layers (`match_home_team_goals`, not `hg`; `cursor` not `c`) 
- Raw SQL is preferred over ORM magic for all queries so the developer can learn SQL directly 
- No metaprogramming, decorator chains, or abstractions that hide SQL from the reader

### V. Modular Python Backend
The backend is a collection of small, focused modules — not a monolith:

- Each data domain has its own router (`api/routers/matches.py`, `api/routers/teams.py`, `api/routers/standings.py`)
- Each scraper target has its own module (`scraper/sources/flashscore.py`, `scraper/sources/sofascore.py`)
- Shared utilities live in `shared/` and have zero dependencies on `api/` or `scraper/`
- Dependencies are injected via FastAPI's `Depends()` — no global state except the DB path constant
- Every module has a `__main__` block or CLI entry point so it can be run and tested independently

### VI. React Frontend with Data Visualization
The frontend is a clean, functional dashboard — not a design showcase:

- React with functional components and hooks only (no class components)
- Data fetching via `React Query` or `SWR` — no raw `useEffect` + `fetch` patterns
- Charts use `Recharts` or `Chart.js` — one library, not both
- The UI updates automatically when the API returns new data (polling or manual refresh button)
- No CSS-in-JS; use plain CSS modules or a single global stylesheet
- Mobile responsiveness is nice-to-have, not a priority for v1

---

## Technology Stack

| Layer     | Technology          | Version Target |
|-----------|---------------------|----------------|
| Database  | SQLite              | 3.40+          |
| Backend   | Python + FastAPI    | Python 3.11+   |
| Scraping  | httpx + BeautifulSoup / Playwright | Latest stable |
| Frontend  | React + Vite        | React 18+      |
| Charts    | Recharts            | Latest stable  |
| Dev Tools | uv (Python env), pnpm (Node env) | Latest stable |

---

## Development Workflow

- **Start small**: Get one data source working end-to-end (scraper → DB → API → UI) before adding a second
- **Migrations first**: Any feature that changes the schema starts with writing the migration SQL before any Python
- **Manual testing is valid**: Automated tests are encouraged but not required in v1; correctness over coverage
- **Commit often**: Each logical unit of work (new migration, new router, new scraper module) is a separate commit
- **Environment variables**: Database path and scraper settings live in `.env`; never hardcoded

---

## Governance

This constitution supersedes all other conventions. When in doubt, ask: *"Does this make the code easier to understand for someone learning SQLite for the first time?"* If no, reconsider.

- Any new external dependency requires a one-line justification comment in `requirements.txt` / `package.json`
- If a principle causes friction in a specific case, document the exception in a `DECISIONS.md` file rather than silently breaking the rule
- Principles I (SQLite as truth), II (Layer separation), and III (Responsible scraping) are non-negotiable and cannot be excepted

**Version**: 1.0.0 | **Ratified**: 2026-05-23 | **Last Amended**: 2026-05-23
