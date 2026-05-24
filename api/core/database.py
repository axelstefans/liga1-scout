import sqlite3
import logging
from typing import Generator
from fastapi import HTTPException, status
from .config import settings

logger = logging.getLogger(__name__)

def get_db() -> Generator[sqlite3.Connection, None, None]:
    """
    Dependency that yields a read-only SQLite connection per request.
    Uses the standard library `sqlite3` as mandated by the constitution.
    Routes using this dependency must be standard `def` (not `async def`)
    so FastAPI runs them in a threadpool to prevent event loop blocking.
    """
    conn = None
    try:
        # Use URI to open in read-only mode for safety
        conn = sqlite3.connect(
            f"file:{settings.DB_PATH}?mode=ro",
            uri=True,
            check_same_thread=False
        )
        
        # Performance PRAGMAs (read-only safe)
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.execute("PRAGMA temp_store = MEMORY")
        conn.execute("PRAGMA mmap_size = 30000000000")
        
        # Return dict-like rows
        conn.row_factory = sqlite3.Row
        
        yield conn
    except sqlite3.Error as e:
        logger.error(f"Database connection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed"
        )
    finally:
        if conn:
            conn.close()
