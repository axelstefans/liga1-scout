from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TeamRef(BaseModel):
    id: int
    name: str
    short_name: Optional[str] = None
    logo_url: Optional[str] = None


class YellowCardsSplit(BaseModel):
    total: int
    first_half: int = 0
    second_half: int = 0


class RefereeSummary(BaseModel):
    referee_id: int
    name: str
    slug: Optional[str] = None
    country: str = "Peru"
    category: Optional[str] = "FIFA / CONAR"
    matches_count: int
    yellow_cards_total: int
    yellow_cards_avg: float
    red_cards_total: int
    red_cards_avg: float
    cards_avg: float  # (yellow + red per match)
    cards_1t_avg: float = 0.0  # cards in first half per match
    cards_2t_avg: float = 0.0  # cards in second half per match
    over_1_5_cards_1t_pct: float = 0.0  # percentage of matches with > 1.5 cards in 1T
    over_1_5_cards_1t_count: int = 0  # matches with > 1.5 cards in 1T
    penalties_total: int
    penalties_avg: float
    fouls_avg: float
    over_4_5_cards_pct: float  # percentage of matches with > 4.5 total cards
    home_cards_pct: float  # cards shown to home team vs total
    sample_label: str = "Suficiente"  # "Suficiente" (>= 3 PJ) o "Muestra en construcción" (< 3 PJ)
    is_sample_sufficient: bool = True  # True si matches_count >= 3


class RefereeMatchItem(BaseModel):
    match_id: int
    date: str
    tournament: str
    round: Optional[int] = None
    home_team: TeamRef
    away_team: TeamRef
    home_score: Optional[int] = 0
    away_score: Optional[int] = 0
    yellow_cards: int
    yellow_cards_split: Optional[YellowCardsSplit] = None
    red_cards: int
    fouls: int
    penalties: int
    over_4_5_cards: bool


class RefereeDetailResponse(BaseModel):
    referee: RefereeSummary
    recent_matches: List[RefereeMatchItem]
    total_matches: int
