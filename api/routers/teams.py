import sqlite3
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from ..core.database import get_db
from ..schemas.team import (
    RosterPlayer, TeamNextMatch, TeamProfile, TeamMetricEntry, 
    TeamShotZonesResponse, TeamPassNetworkResponse, TeamMatchItem,
    TeamDefensiveActionsResponse, TeamShotMapResponse, TeamAttackZonesResponse
)
from ..repositories import team_repo

router = APIRouter(prefix="/teams", tags=["Teams"])

@router.get("/", response_model=List[TeamProfile])
def get_all_teams(db: sqlite3.Connection = Depends(get_db)):
    """Get all active teams."""
    return team_repo.get_all_teams(db)

@router.get("/metrics", response_model=List[TeamMetricEntry])
def get_team_metrics(
    tournament: Optional[str] = Query(None, description="Filter by tournament: Apertura or Clausura"),
    venue: str = Query("all", pattern="^(all|home|away)$", description="Filter by venue: all, home, or away"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get aggregated metrics for all 18 Liga 1 clubs, supporting optional tournament filter."""
    return team_repo.get_team_metrics(db, tournament, venue=venue)

@router.get("/{team_id}/matches", response_model=List[TeamMatchItem])
def get_team_matches(
    team_id: int,
    tournament: Optional[str] = Query("all", description="Filter by tournament: all, Apertura, or Clausura"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get all played matches for a team, optionally filtered by tournament."""
    matches = team_repo.get_team_matches(db, team_id, tournament)
    if matches is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team {team_id} not found")
    return matches

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

@router.get("/{team_id}/pass-network", response_model=TeamPassNetworkResponse)
def get_team_pass_network(
    team_id: int,
    tournament: str = Query("all", description="Filter by tournament: all, Apertura, or Clausura"),
    match_id: Optional[int] = Query(None, description="Filter by a specific fixture match_id"),
    venue: str = Query("all", pattern="^(all|home|away)$", description="Filter by venue: all, home, or away"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get pass network (nodes and edges) for a team's Base XI or a single fixture."""
    network = team_repo.get_team_pass_network(db, team_id, tournament, match_id=match_id, venue=venue)
    if not network:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team {team_id} not found or match not found")
    return network

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

@router.get("/{team_id}/defensive-actions", response_model=TeamDefensiveActionsResponse)
def get_team_defensive_actions(
    team_id: int,
    tournament: str = Query("all", description="Filter by tournament: all, Apertura, or Clausura"),
    match_id: Optional[int] = Query(None, description="Filter by a specific fixture match_id"),
    venue: str = Query("all", pattern="^(all|home|away)$", description="Filter by venue: all, home, or away"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get defensive actions (tackles, interceptions, recoveries, fouls) and block height metrics."""
    data = team_repo.get_team_defensive_actions(db, team_id, tournament, match_id=match_id, venue=venue)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team {team_id} not found or match {match_id} not found for this team"
        )
    return data

@router.get("/{team_id}/shot-map", response_model=TeamShotMapResponse)
def get_team_shot_map(
    team_id: int,
    tournament: str = Query("all", description="Filter by tournament: all, Apertura, or Clausura"),
    match_id: Optional[int] = Query(None, description="Filter by a specific fixture match_id"),
    mode: str = Query("for", pattern="^(for|against)$", description="Mode: 'for' (shots taken) or 'against' (shots conceded)"),
    venue: str = Query("all", pattern="^(all|home|away)$", description="Filter by venue: all, home, or away"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get shot map events and summary metrics for a team (shots taken or conceded)."""
    data = team_repo.get_team_shot_map(db, team_id, tournament=tournament, match_id=match_id, mode=mode, venue=venue)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team {team_id} not found or match {match_id} not found for this team"
        )
    return data


@router.get("/{team_id}/attack-zones", response_model=TeamAttackZonesResponse)
def get_team_attack_zones(
    team_id: int,
    tournament: str = Query("all", description="Filter by tournament: all, Apertura, or Clausura"),
    match_id: Optional[int] = Query(None, description="Filter by a specific fixture match_id"),
    mode: str = Query("for", pattern="^(for|against)$", description="Mode: 'for' (actions performed) or 'against' (actions conceded)"),
    venue: str = Query("all", pattern="^(all|home|away)$", description="Filter by venue: all, home, or away"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get attack & threat infiltration zones per channel and summary metrics."""
    data = team_repo.get_team_attack_zones(db, team_id, tournament=tournament, match_id=match_id, mode=mode, venue=venue)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team {team_id} not found or match {match_id} not found for this team"
        )
    return data


@router.get("/{team_id}/period-metrics")
def get_team_period_metrics(
    team_id: int,
    tournament: Optional[str] = Query("all", description="Filter by tournament: all, Apertura, or Clausura"),
    venue: str = Query("all", pattern="^(all|home|away)$", description="Filter by venue: all, home, or away"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get team averages and totals grouped by period ('1ST', '2ND', 'ALL')."""
    profile = team_repo.get_team_profile(db, team_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team {team_id} not found")
    return team_repo.get_team_period_metrics(db, team_id, tournament=tournament or "all", venue=venue)


@router.get("/{team_id}/set-pieces")
def get_team_set_piece_metrics(
    team_id: int,
    tournament: Optional[str] = Query("all", description="Filter by tournament: all, Apertura, or Clausura"),
    venue: str = Query("all", pattern="^(all|home|away)$", description="Filter by venue: all, home, or away"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get set-piece metrics (corner origin goals and 15-minute goal distribution)."""
    profile = team_repo.get_team_profile(db, team_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team {team_id} not found")
    return team_repo.get_team_set_piece_metrics(db, team_id, tournament=tournament or "all", venue=venue)


@router.get("/{team_id}/most-used-xi")
def get_team_most_used_xi(
    team_id: int,
    tournament: str = Query("all", description="Filter by tournament: all, Apertura, or Clausura"),
    venue: str = Query("all", pattern="^(all|home|away)$", description="Filter by venue: all, home, or away"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get the 11 players with the highest minutes played for a team."""
    profile = team_repo.get_team_profile(db, team_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team {team_id} not found")
    return team_repo.get_team_most_used_xi(db, team_id, tournament, venue=venue)


@router.get("/{team_id}/goal-contributions")
def get_team_goal_contributions(
    team_id: int,
    tournament: str = Query("all", description="Filter by tournament: all, Apertura, or Clausura"),
    limit: int = Query(8, ge=1, le=20),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get the top goal & assist contributors (actual G+A vs expected xG+xA)."""
    profile = team_repo.get_team_profile(db, team_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team {team_id} not found")
    return team_repo.get_team_goal_contributions(db, team_id, tournament, limit)





