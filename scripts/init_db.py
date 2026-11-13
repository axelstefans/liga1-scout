"""
Inicializa el esquema de la base de datos SQLite de L1Scan y aplica todas
las migraciones secuenciales de migrations/ (001 a 024) de forma idempotente.
"""

import logging
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

load_dotenv(PROJECT_ROOT / ".env")

from scraper.db import get_connection, run_migrations

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("scripts.init_db")


def init_database(db_path: str | None = None) -> int:
    """Inicializa la base de datos SQLite y aplica las migraciones pendientes."""
    target_db = db_path or os.getenv("DB_PATH", "liga1.db")
    migrations_dir = str(PROJECT_ROOT / "migrations")

    if not os.path.exists(migrations_dir):
        raise FileNotFoundError(f"Directorio de migraciones no encontrado: {migrations_dir}")

    conn = get_connection(target_db)
    try:
        run_migrations(conn, migrations_dir)
        version_row = conn.execute("SELECT MAX(version) FROM schema_version").fetchone()
        final_version = int(version_row[0]) if version_row and version_row[0] is not None else 0
        tables_count = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchone()[0]
        views_count = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='view'"
        ).fetchone()[0]
        print(
            f"Base de datos '{target_db}' lista — schema_version={final_version} "
            f"({tables_count} tablas, {views_count} vistas)."
        )
        return final_version
    finally:
        conn.close()


if __name__ == "__main__":
    init_database()
