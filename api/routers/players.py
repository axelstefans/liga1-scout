import sqlite3
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from ..core.database import get_db
from ..schemas.player import PlayerProfile, PlayerSeasonStats, PlayerMatchStats, PlayerSearchResult, PlayerPass, SimilarPlayer
from ..repositories import player_repo

router = APIRouter(prefix="/players", tags=["Players"])

@router.get("/search", response_model=List[PlayerSearchResult])
def search_players(q: str, db: sqlite3.Connection = Depends(get_db)):
    """Search for players by name."""
    if not q or len(q) < 2:
        return []
    return player_repo.search_players(db, q)

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

@router.get("/{player_id}/heatmap", response_model=List[Dict[str, Any]])
def get_player_heatmap(player_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Get player's season heatmap coordinates from the database."""
    profile = player_repo.get_player_profile(db, player_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
        
    return player_repo.get_player_heatmap(db, player_id)

@router.get("/{player_id}/shotmap", response_model=List[Dict[str, Any]])
def get_player_shotmap(player_id: int, season_id: Optional[int] = None, db: sqlite3.Connection = Depends(get_db)):
    """Get player's shot map with coordinates and dynamically calculated expected goals (xG)."""
    # Verificamos que el jugador exista primero
    profile = player_repo.get_player_profile(db, player_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    # Delegamos la tarea al repositorio donde está el modelo de IA
    return player_repo.get_player_shotmap(db, player_id, season_id)

@router.get("/{player_id}/passes", response_model=List[PlayerPass])
def get_player_passes(player_id: int, match_id: Optional[int] = None, db: sqlite3.Connection = Depends(get_db)):
    """Get player's spatial pass data."""
    profile = player_repo.get_player_profile(db, player_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
        
    return player_repo.get_player_passes(db, player_id, match_id)

@router.get("/{player_id}/defending", response_model=Dict[str, List[Dict[str, Any]]])
def get_player_defending(
    player_id: int, 
    season_id: Optional[int] = Query(None, description="Filter by season ID (defaults to latest)"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get player's spatial defensive actions and dribbles."""
    profile = player_repo.get_player_profile(db, player_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
        
    return player_repo.get_player_defending_stats(db, player_id, season_id)

@router.get("/{player_id}/similar", response_model=List[SimilarPlayer])
def get_similar_players(
    player_id: int,
    limit: int = Query(10, ge=1, le=50, description="Maximum number of similar players to return"),
    min_minutes: int = Query(300, ge=0, description="Minimum minutes played for candidates"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Find players with the most similar percentile performance profiles."""
    similar = player_repo.get_similar_players(db, player_id, limit=limit, min_minutes=min_minutes)
    if similar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    return similar