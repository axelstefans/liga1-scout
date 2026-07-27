from typing import Optional
from pydantic import BaseModel

class MatchPredictionRequest(BaseModel):
    home_team: str
    away_team: str
    home_custom_xg: Optional[float] = None
    away_custom_xg: Optional[float] = None

class ProjectedGoals(BaseModel):
    home: float
    away: float

class MatchWinnerOdds(BaseModel):
    home: float
    draw: float
    away: float

class OverUnderOdds(BaseModel):
    over: float
    under: float

class ProbabilitiesPercent(BaseModel):
    home: float
    draw: float
    away: float
    over_25: float
    under_25: float

class MatchPredictionResponse(BaseModel):
    projected_goals: ProjectedGoals
    match_winner_odds: MatchWinnerOdds
    over_under_25_odds: OverUnderOdds
    probabilities_percent: ProbabilitiesPercent

class PlayerPredictionStat(BaseModel):
    player_id: Optional[int] = None
    player_name: str
    position: Optional[str] = None
    total_minutes: int
    total_xg: float
    xg90: float
