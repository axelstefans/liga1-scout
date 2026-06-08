from pydantic import BaseModel
from typing import Optional, Any

class PlayerRankingEntry(BaseModel):
    rank: int
    player_id: int
    name: str
    team_name: str
    team_logo_url: Optional[str] = None
    position_group: Optional[str] = None
    position: Optional[str] = None
    minutes_played: Optional[int] = None
    value: Any  # The value of the stat being ranked (could be int or float)
    accurate_passes_percentage: Optional[float] = None
