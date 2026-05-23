<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan

## Project Constitution
The guiding principles for this project are defined in:
`.specify/memory/constitution.md`

Key rules at a glance:
- SQLite (`liga1.db`) is the single source of truth — all data lives there
- Three layers: `scraper/` → SQLite → `api/` → `frontend/` — never skip or reverse
- Scraping requires 2-5s random delays and 24h caching; no silent failures
- Write readable SQL (multi-line, named variables, comments) — this is a learning project
- Python backend: FastAPI with one router per data domain
- React frontend: functional components, React Query for data fetching, Recharts for charts
<!-- SPECKIT END -->
