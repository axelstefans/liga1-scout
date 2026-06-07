from pydantic import BaseModel
from typing import Optional, List

class TeamProfile(BaseModel):
    team_id: int
    name: str
    short_name: Optional[str] = None
    country: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None

class RosterPlayer(BaseModel):
    player_id: int
    name: str
    position_group: Optional[str] = None
    shirt_number: Optional[int] = None
    nationality: Optional[str] = None
    market_value_str: Optional[str] = None

class TeamNextMatch(BaseModel):
    match_date: str
    opponent_name: str
    opponent_logo_url: Optional[str] = None
    home_away: str
    match_id: int
