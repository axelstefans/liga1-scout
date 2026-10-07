from pydantic import BaseModel
from typing import Optional, List, Dict, Any

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

class TeamMetricEntry(BaseModel):
    # Standings & Club Info
    team_id: int
    name: str
    short_name: Optional[str] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None
    matches_played: int
    wins: int
    draws: int
    losses: int
    points: int
    points_per_match: Optional[float] = None
    goals_conceded: int
    goal_difference: int

    # A. Ofensivas / Tiro (10 metrics)
    total_shots: int
    shots_on_target: int
    shots_inside_box: int
    shots_outside_box: int
    goals_scored: int
    xg: float
    npxg: float
    xg_per_shot: Optional[float] = None
    goals_minus_xg: Optional[float] = None
    conversion_rate_pct: Optional[float] = None

    # B. Circulación y Progresión (9 metrics)
    possession_pct: Optional[float] = None
    passes_completed: int
    pass_accuracy_pct: Optional[float] = None
    progressive_passes: int
    passes_into_final_third: int
    passes_into_box: int
    crosses_completed: int
    progressive_carries: int
    successful_dribbles: int

    # C. Dominio Territorial y Estilo (3 metrics)
    field_tilt: Optional[float] = None
    verticality_ratio_pct: Optional[float] = None
    avg_shot_distance: Optional[float] = None

    # D. Presión y Fase Defensiva (6 metrics)
    ppda: Optional[float] = None
    high_recoveries: int
    defensive_actions: int
    tackles: int
    interceptions: int
    clearances: int

    # E. Concesión / Rival (6 metrics)
    shots_conceded: int
    shots_on_target_conceded: int
    shots_conceded_inside_box: int
    xga: float
    xgd: float
    defensive_resistance_ratio: Optional[float] = None

    # Backwards compatibility / convenience extras
    passes_total: Optional[int] = None
    xg_per_match: Optional[float] = None
    xga_per_match: Optional[float] = None
    field_tilt_pct: Optional[float] = None
    conversion_ratio: Optional[float] = None

class ShotZoneCell(BaseModel):
    zone_id: int
    row: int
    col: int
    x_min: float
    x_max: float
    y_min: float
    y_max: float
    count: int
    xg: float
    xg_per_shot: float
    pct_of_total: float
    goals: int

class ShotTacticsSummary(BaseModel):
    total_shots: int
    non_penalty_shots: int
    avg_distance_m: float
    pct_inside_box: float
    pct_set_piece: float
    pct_fast_break: float

class TeamShotZonesResponse(BaseModel):
    team_id: int
    team_name: str
    tournament: Optional[str] = None
    total_shots_taken: int
    total_xg_taken: float
    total_shots_conceded: int
    total_xg_conceded: float
    grid: Dict[str, int]
    shots_taken: List[ShotZoneCell]
    shots_conceded: List[ShotZoneCell]
    tactics_taken: Optional[ShotTacticsSummary] = None
    tactics_conceded: Optional[ShotTacticsSummary] = None

class PassNetworkNode(BaseModel):
    player_id: int
    name: str
    jersey: Optional[int] = None
    x: float
    y: float
    total_passes: int

class PassNetworkEdge(BaseModel):
    passer_id: int
    receiver_id: int
    pass_count: int

class TeamPassNetworkResponse(BaseModel):
    team_id: int
    tournament: str
    match_id: Optional[int] = None
    nodes: List[PassNetworkNode]
    edges: List[PassNetworkEdge]

class TeamMatchItem(BaseModel):
    match_id: int
    round: Optional[int] = None
    tournament: str
    date: str
    opponent_id: int
    opponent_name: str
    opponent_tricode: str
    is_home: bool
    team_score: Optional[int] = None
    opponent_score: Optional[int] = None
    label: str

class DefensiveEventItem(BaseModel):
    event_id: int
    type: str  # 'won_tackle' | 'lost_tackle' | 'interception' | 'clearance' | 'blocked_pass' | 'recovery' | 'foul'
    x: float
    y: float
    is_success: bool
    player_name: str
    jersey: Optional[int] = None

class DefensiveSummary(BaseModel):
    total_events: int
    won_tackles: int = 0
    lost_tackles: int = 0
    interceptions: int = 0
    clearances: int = 0
    blocked_passes: int = 0
    recoveries: int = 0
    high_recoveries: int = 0
    tackles_won_pct: float = 0.0

class TeamDefensiveActionsResponse(BaseModel):
    team_id: int
    tournament: str
    match_id: Optional[int] = None
    block_height_pct: float
    block_height_m: float
    block_classification: str
    summary: DefensiveSummary
    events: List[DefensiveEventItem]
    avg_x: Optional[float] = None
    tactical_classification: Optional[str] = None


class ShotItem(BaseModel):
    shot_id: int
    minute: Optional[int] = None
    x: float
    y: float
    xg: float
    result: str  # 'goal' | 'saved' | 'miss' | 'blocked'
    body_part: Optional[str] = None
    situation: Optional[str] = None
    player_name: str
    player_jersey: Optional[int] = None


class ShotMapSummary(BaseModel):
    total_shots: int
    goals: int
    total_xg: float
    xg_per_shot: float
    shots_on_target: int
    on_target_pct: float
    xg_difference: float


class TeamShotMapResponse(BaseModel):
    team_id: int
    mode: str  # 'for' | 'against'
    tournament: str
    match_id: Optional[int] = None
    summary: ShotMapSummary
    shots: List[ShotItem]


class AttackZoneTopPlayer(BaseModel):
    name: str
    actions_count: int


class AttackZoneChannel(BaseModel):
    channel_id: str  # 'left_flank' | 'left_half_space' | 'center' | 'right_half_space' | 'right_flank'
    channel_name: str
    entries_count: int
    share_pct: float
    box_infiltrations: int
    threat_xg: float
    threat_pct: float
    top_players: List[AttackZoneTopPlayer]


class AttackZonesSummary(BaseModel):
    total_entries: int
    box_entries_total: int
    box_entry_conversion_pct: float
    dominant_channel: str
    most_dangerous_channel: str


class TeamAttackZonesResponse(BaseModel):
    team_id: int
    team_name: Optional[str] = None
    mode: str
    tournament: str
    match_id: Optional[int] = None
    total_entries: int
    box_entries_total: int
    box_entry_conversion_pct: float
    dominant_channel: str
    most_dangerous_channel: str
    summary: AttackZonesSummary
    channels: List[AttackZoneChannel]





