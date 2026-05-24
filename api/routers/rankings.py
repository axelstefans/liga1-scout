import sqlite3
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from ..core.database import get_db
from ..schemas.ranking import PlayerRankingEntry
from ..repositories import ranking_repo

router = APIRouter(prefix="/rankings", tags=["Rankings"])

@router.get("/players", response_model=List[PlayerRankingEntry])
def get_player_rankings(
    stat: str = Query(..., description="The statistic to rank by (e.g. goals, rating)"),
    limit: int = Query(10, ge=1, le=500, description="Number of players to return"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get league-wide player rankings for a specific statistic."""
    try:
        return ranking_repo.get_player_rankings(db, stat, limit)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
