import sqlite3
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from ..core.database import get_db
from ..schemas.team import RosterPlayer
from ..repositories import team_repo

router = APIRouter(prefix="/teams", tags=["Teams"])

@router.get("/{team_id}/roster", response_model=List[RosterPlayer])
def get_team_roster(team_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Get all players currently in the team's roster."""
    profile = team_repo.get_team_profile(db, team_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        
    return team_repo.get_team_roster(db, team_id)
