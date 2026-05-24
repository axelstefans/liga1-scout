import sqlite3
import os
import glob
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

def get_connection(db_path: str) -> sqlite3.Connection:
    """Returns a SQLite connection configured for concurrent safety and dictionary-like rows."""
    conn = sqlite3.connect(db_path, isolation_level=None) # We handle transactions manually where needed
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.row_factory = sqlite3.Row
    return conn

def run_migrations(conn: sqlite3.Connection, migrations_dir: str):
    """Discovers and runs SQL migrations in numerical order."""
    conn.execute('''
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        )
    ''')
    
    current_version = conn.execute("SELECT MAX(version) FROM schema_version").fetchone()[0]
    if current_version is None:
        current_version = 0

    migration_files = sorted(glob.glob(os.path.join(migrations_dir, "*.sql")))
    
    for file_path in migration_files:
        filename = os.path.basename(file_path)
        try:
            version = int(filename.split('_')[0])
        except ValueError:
            logger.warning(f"Skipping migration file with invalid format: {filename}")
            continue
            
        if version > current_version:
            logger.info(f"Applying migration: {filename}")
            with open(file_path, 'r', encoding='utf-8') as f:
                sql_script = f.read()
            try:
                conn.executescript(sql_script)
                conn.execute(
                    "INSERT INTO schema_version (version, applied_at) VALUES (?, ?)",
                    (version, datetime.utcnow().isoformat())
                )
                logger.info(f"Migration {filename} applied successfully.")
            except Exception as e:
                logger.error(f"Error applying migration {filename}: {e}")
                raise

def log_scrape(conn: sqlite3.Connection, resource_type: str, resource_key: str, status: str, http_status_code: int = None, error_message: str = None, response_size_bytes: int = None):
    """Logs an attempted HTTP/browser fetch."""
    try:
        conn.execute('''
            INSERT INTO scrape_log (resource_type, resource_key, scraped_at, status, http_status_code, error_message, response_size_bytes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (resource_type, resource_key, datetime.utcnow().isoformat(), status, http_status_code, error_message, response_size_bytes))
    except Exception as e:
        logger.error(f"Failed to log scrape for {resource_type}/{resource_key}: {e}")

def is_cached(conn: sqlite3.Connection, resource_type: str, resource_key: str, max_age_hours: int = 24) -> bool:
    """Checks if a resource has been successfully scraped within the max age limit."""
    cutoff_time = (datetime.utcnow() - timedelta(hours=max_age_hours)).isoformat()
    row = conn.execute('''
        SELECT 1 FROM scrape_log
        WHERE resource_type = ? AND resource_key = ? AND status = 'success' AND scraped_at >= ?
        LIMIT 1
    ''', (resource_type, resource_key, cutoff_time)).fetchone()
    return bool(row)
