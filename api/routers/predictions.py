import sqlite3
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from ..core.database import get_db
from ..schemas.prediction import MatchPredictionRequest, MatchPredictionResponse, PlayerPredictionStat
from ..services.poisson_service import calculate_match_odds, get_team_prediction_roster

router = APIRouter(prefix="/predictions", tags=["Predictions"])

@router.post("/simulate", response_model=MatchPredictionResponse)
def simulate_match(request: MatchPredictionRequest, db: sqlite3.Connection = Depends(get_db)):
    try:
        result = calculate_match_odds(
            db, 
            request.home_team, 
            request.away_team, 
            request.home_custom_xg, 
            request.away_custom_xg
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/roster", response_model=List[PlayerPredictionStat])
def get_prediction_roster(team_name: str, db: sqlite3.Connection = Depends(get_db)):
    roster = get_team_prediction_roster(db, team_name)
    if not roster:
        raise HTTPException(status_code=404, detail=f"No roster found for team '{team_name}'")
    return roster
