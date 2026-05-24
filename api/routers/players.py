import sqlite3
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from ..core.database import get_db
from ..schemas.player import PlayerProfile, PlayerSeasonStats, PlayerMatchStats
from ..repositories import player_repo

router = APIRouter(prefix="/players", tags=["Players"])

@router.get("/{player_id}", response_model=PlayerProfile)
def get_player(player_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Get player profile and current team info."""
    profile = player_repo.get_player_profile(db, player_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    return profile

@router.get("/{player_id}/season-stats", response_model=PlayerSeasonStats)
def get_player_season_stats(player_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Get player's season aggregate statistics."""
    stats = player_repo.get_player_season_stats(db, player_id)
    if not stats:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Season stats not found for player")
    return stats

@router.get("/{player_id}/match-stats", response_model=List[PlayerMatchStats])
def get_player_match_stats(player_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Get player's match-by-match statistics."""
    # We verify the player exists first to return 404 if invalid
    profile = player_repo.get_player_profile(db, player_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
        
    return player_repo.get_player_match_stats(db, player_id)
