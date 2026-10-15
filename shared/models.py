from dataclasses import dataclass
from typing import Optional

@dataclass
class Team:
    team_id: int
    name: str
    short_name: Optional[str]
    country: Optional[str]
    logo_url: Optional[str]
    tm_team_id: Optional[int]
    tm_team_name: Optional[str]
    flashscore_id: Optional[str] = None

@dataclass
class Player:
    player_id: int
    team_id: int
    name: str
    date_of_birth: Optional[str]
    nationality: Optional[str]
    position: Optional[str]
    position_group: Optional[str]
    shirt_number: Optional[int]

@dataclass
class Match:
    match_id: int
    home_team_id: int
    away_team_id: int
    match_date: str
    round: Optional[int]
    home_score: Optional[int]
    away_score: Optional[int]
    status: str
    match_url: Optional[str]
    season_id: int
