"""
FastAPI router for match-level statistics and analytics.
"""

import sqlite3
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status

from ..core.database import get_db
from services.flashscore_service import get_match_flashscore_stats

router = APIRouter(prefix="/matches", tags=["Matches"])


@router.get("/{match_id}/flashscore-stats", response_model=Dict[str, Any])
def get_match_flashscore_stats_endpoint(
    match_id: int,
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Get detailed Flashscore team statistics for a specific match.
    Returns segregated home/away stats across 1T, 2T, and ALL match periods.
    """
    stats = get_match_flashscore_stats(db, match_id=match_id)
    if stats is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashscore stats not found for this match",
        )
    return stats
