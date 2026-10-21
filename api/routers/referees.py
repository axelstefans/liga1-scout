"""
FastAPI router for referee statistics and profile analytics.
"""

import sqlite3
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..core.database import get_db
from ..schemas.referee import RefereeSummary, RefereeMatchItem, RefereeDetailResponse
from ..repositories.referee_repo import get_referees_summary, get_referee_matches, get_referee_detail

router = APIRouter(prefix="/referees", tags=["Referees"])


@router.get("", response_model=List[RefereeSummary])
def list_referees(
    tournament: Optional[str] = Query(None, description="Filter by tournament ('Apertura' or 'Clausura')"),
    db: sqlite3.Connection = Depends(get_db)
):
    """
    Get summary list of referees with aggregate disciplinary and match statistics.
    """
    return get_referees_summary(db=db, tournament=tournament)


@router.get("/{referee_id}", response_model=RefereeDetailResponse)
def get_referee(
    referee_id: int,
    limit: Optional[int] = Query(5, description="Number of recent matches to return (use 0 or null for all)"),
    db: sqlite3.Connection = Depends(get_db)
):
    """
    Get referee profile, aggregate averages, and recent match details.
    """
    detail = get_referee_detail(db=db, referee_id=referee_id, limit=limit)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Referee with ID {referee_id} not found",
        )
    return detail


@router.get("/{referee_id}/matches", response_model=List[RefereeMatchItem])
def get_referee_match_history(
    referee_id: int,
    limit: Optional[int] = Query(None, description="Limit number of matches returned"),
    db: sqlite3.Connection = Depends(get_db)
):
    """
    Get full or paginated match history for a specific referee.
    """
    return get_referee_matches(db=db, referee_id=referee_id, limit=limit)
