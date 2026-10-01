import sqlite3
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from ..core.database import get_db
from ..schemas.team import RosterPlayer, TeamNextMatch, TeamProfile, TeamMetricEntry, TeamShotZonesResponse
from ..repositories import team_repo

router = APIRouter(prefix="/teams", tags=["Teams"])

@router.get("/", response_model=List[TeamProfile])
def get_all_teams(db: sqlite3.Connection = Depends(get_db)):
    """Get all active teams."""
    return team_repo.get_all_teams(db)

@router.get("/metrics", response_model=List[TeamMetricEntry])
def get_team_metrics(
    tournament: Optional[str] = Query(None, description="Filter by tournament: Apertura or Clausura"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get aggregated metrics for all 18 Liga 1 clubs, supporting optional tournament filter."""
    return team_repo.get_team_metrics(db, tournament)

@router.get("/{team_id}/shot-zones", response_model=TeamShotZonesResponse)
def get_team_shot_zones(
    team_id: int,
    tournament: Optional[str] = Query(None, description="Filter by tournament: Apertura or Clausura"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get spatial shot distribution across a 5x6 pitch grid for both shots taken and conceded."""
    zones = team_repo.get_team_shot_zones(db, team_id, tournament)
    if not zones:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team {team_id} not found")
    return zones

@router.get("/{team_id}/roster", response_model=List[RosterPlayer])
def get_team_roster(team_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Get all players currently in the team's roster."""
    profile = team_repo.get_team_profile(db, team_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        
    return team_repo.get_team_roster(db, team_id)

@router.get("/{team_id}/next-match", response_model=TeamNextMatch)
def get_team_next_match(team_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Get the team's next scheduled match."""
    match = team_repo.get_team_next_match(db, team_id)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Next match not found")
    return match
