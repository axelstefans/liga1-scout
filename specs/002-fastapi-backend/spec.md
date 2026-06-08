# Spec 002: FastAPI Backend API

## Goal
Build a FastAPI REST API that serves player analytics data from the local `liga1.db` SQLite database.

## Requirements
The API must expose endpoints for:
1. Player profile (stats, team, position)
2. Player season stats
3. Player match-by-match stats
4. Team roster
5. League-wide player rankings by stat

## Architectural Constraints
- **Framework**: FastAPI
- **Database**: SQLite (`liga1.db`) via `sqlite3` standard library with NO ORM.
- **Routing**: One router per data domain.
- **Data Access**: Clean separation between data extraction (SQL) layer and API layer.
- **Code Style**: Write highly readable SQL (multi-line, named variables, comments). Parameterize all queries.
- **Role**: Serves as the data layer for a React dashboard.
