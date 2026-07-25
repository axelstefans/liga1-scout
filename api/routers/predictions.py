import sqlite3
from fastapi import APIRouter, Depends, HTTPException, status
from ..core.database import get_db
from ..schemas.prediction import MatchPredictionRequest, MatchPredictionResponse
from ..services.poisson_service import calculate_match_odds

router = APIRouter(prefix="/predictions", tags=["Predictions"])

@router.post("/simulate", response_model=MatchPredictionResponse)
def simulate_match(request: MatchPredictionRequest, db: sqlite3.Connection = Depends(get_db)):
    try:
        result = calculate_match_odds(db, request.home_team, request.away_team)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
