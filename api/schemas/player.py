from pydantic import BaseModel
from typing import Optional, List

class TeamBase(BaseModel):
    team_id: int
    name: str
    short_name: Optional[str] = None
    logo_url: Optional[str] = None

class PlayerProfile(BaseModel):
    player_id: int
    name: str
    date_of_birth: Optional[str] = None
    nationality: Optional[str] = None
    position: Optional[str] = None
    position_group: Optional[str] = None
    shirt_number: Optional[int] = None
    team: Optional[TeamBase] = None
    market_value_eur: Optional[int] = None
    market_value_str: Optional[str] = None

class PlayerSearchResult(BaseModel):
    player_id: int
    name: str
    position_group: Optional[str] = None
    team_name: Optional[str] = None
    team_logo_url: Optional[str] = None

class PlayerSeasonStats(BaseModel):
    player_id: int
    appearances: Optional[int] = None
    started: Optional[int] = None
    minutes_played: Optional[int] = None
    goals: Optional[int] = None
    assists: Optional[int] = None
    rating: Optional[float] = None
    yellow_cards: Optional[int] = None
    red_cards: Optional[int] = None
    shots_on_target: Optional[int] = None
    successful_dribbles: Optional[int] = None
    accurate_passes_percentage: Optional[float] = None
    ground_duels_won_percentage: Optional[float] = None
    aerial_duels_won: Optional[int] = None
    key_passes: Optional[int] = None
    interceptions: Optional[int] = None
    tackles: Optional[int] = None
    saves: Optional[int] = None
    clean_sheets: Optional[int] = None

class PlayerMatchStats(BaseModel):
    match_id: int
    match_date: str
    opponent_name: str
    opponent_logo_url: Optional[str] = None  # Team logo for opponent
    is_home: bool
    minutes_played: Optional[int] = None
    sofascore_rating: Optional[float] = None
    goals: Optional[int] = None
    assists: Optional[int] = None
    shots_on_target: Optional[int] = None
    key_passes: Optional[int] = None
    accurate_passes_pct: Optional[float] = None
    result: Optional[str] = None   # W / D / L
    score: Optional[str] = None    # e.g. "2-1" from player team's perspective
    round: Optional[int] = None    # League round number

