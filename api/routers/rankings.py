import sqlite3
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from ..core.database import get_db
from ..schemas.ranking import PlayerRankingEntry
from ..repositories import ranking_repo

router = APIRouter(prefix="/rankings", tags=["Rankings"])

@router.get("/players", response_model=List[PlayerRankingEntry])
def get_player_rankings(
    stat: str = Query(..., description="The statistic to rank by (e.g. goals, rating)"),
    limit: int = Query(10, ge=1, le=500, description="Number of players to return"),
    position_group: Optional[str] = Query(None, description="Filter by position group (e.g. Defender, Midfielder, Forward, Goalkeeper)"),
    min_minutes: int = Query(450, ge=0, description="Minimum minutes played threshold"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get league-wide player rankings for a specific statistic with qualification threshold and per-90 normalization."""
    try:
        return ranking_repo.get_player_rankings(
            db=db,
            stat=stat,
            limit=limit,
            position_group=position_group,
            min_minutes=min_minutes
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
