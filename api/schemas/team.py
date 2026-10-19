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
    set_piece_xg: Optional[float] = 0.0
    set_piece_xg_p90: Optional[float] = 0.0
    set_piece_xg_per_match: Optional[float] = 0.0
    progressive_passes_p90: Optional[float] = None
    final_third_passes_p90: Optional[float] = None

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
    is_pivot: Optional[bool] = False
    defensive_actions_p90: Optional[float] = None
    is_exposed_pivot: Optional[bool] = False

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
    shots_per_match: Optional[float] = None
    xg_per_match: Optional[float] = None


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

class MostUsedXIPlayer(BaseModel):
    slot: str
    player_id: int
    name: str
    shirt_number: Optional[int] = None
    position_group: str
    age: Optional[int] = None
    appearances: int
    apps: int
    starts: int = 0
    minutes_played: int
    minutes_pct: float
    minutes_share: int
    goals: int
    assists: int
    xg: float = 0.0
    shots_p90: float = 0.0
    total_shots: int = 0
    yellow_cards: int = 0
    g_plus_a: int
    goal_contributions: int
    pitch_x: float
    pitch_y: float
    avg_x: float
    avg_y: float
    saves: Optional[int] = None
    saves_p90: Optional[float] = None


class MostUsedXIResponse(BaseModel):
    team_id: int
    tournament: str
    venue: str
    formation: str
    total_matches: int
    max_minutes: int
    players: List[MostUsedXIPlayer]


class HTOutcomes(BaseModel):
    ht_won: int
    ht_drawn: int
    ht_lost: int


class FirstGoalRecord(BaseModel):
    scored_first_count: int
    scored_first_record: str
    conceded_first_count: int
    conceded_first_record: str


class TeamPeriodStatsItem(BaseModel):
    matches_count: int
    avg_corner_kicks: float
    avg_fouls: float
    avg_possession: float
    total_goals: int
    avg_goals: float
    total_yellow_cards: int
    avg_yellow_cards: float
    total_red_cards: int
    avg_red_cards: float
    goals_conceded: int
    avg_goals_conceded: float
    avg_corners_against: Optional[float] = None
    avg_fouls_received: Optional[float] = None
    avg_corners_home: Optional[float] = None
    avg_corners_away: Optional[float] = None
    avg_xg: Optional[float] = None


class TeamSetPieceDetail(BaseModel):
    corner_goals: int
    corner_goals_per_match: float
    corner_goals_pct: float
    corner_goals_conceded: int = 0
    set_piece_shots: int
    set_piece_goals: int
    set_piece_goals_per_match: float
    set_piece_goals_conceded: int = 0
    set_piece_goals_conceded_per_match: float = 0.0
    set_piece_xg: float
    set_piece_xg_per_match: float
    penalties_awarded: int = 0
    penalties_scored: int = 0
    penalties_conceded: int = 0


class GoalIntervalItem(BaseModel):
    interval: str
    goals: int
    corner_goals: int
    percentage: float


class GoalDistributionDetail(BaseModel):
    total_goals: int
    intervals: List[GoalIntervalItem]
    peak_interval: str
    peak_goals: int
    peak_pct: float


class FrequencyCount(BaseModel):
    count: int
    total: int


class CornerStats(BaseModel):
    corners_for_avg: float
    corners_against_avg: float
    corners_total_avg: float
    corners_1t_avg: Optional[float] = 0.0
    corners_2t_avg: Optional[float] = 0.0
    over_8_5_corners: FrequencyCount
    over_9_5_corners: FrequencyCount
    over_4_5_corners_for: Optional[FrequencyCount] = None
    over_4_5_corners_for_count: int = 0
    over_4_5_corners_for_pct: float = 0.0
    over_5_5_corners_for: Optional[FrequencyCount] = None
    over_5_5_corners_for_count: int = 0
    over_5_5_corners_for_pct: float = 0.0
    corners_conceded_over_4_5: Optional[FrequencyCount] = None
    corners_conceded_over_4_5_count: int = 0
    corners_conceded_over_4_5_pct: float = 0.0
    set_piece_goals: int
    corner_goals: int


class TimeSplits(BaseModel):
    goals_1t: int
    goals_2t: int
    pct_goals_2t: float
    peak_scoring_interval: str
    corners_1t_avg: Optional[float] = 0.0
    corners_2t_avg: Optional[float] = 0.0


class RecordBreakdown(BaseModel):
    wins: int
    draws: int
    losses: int


class DynamicEventRecord(BaseModel):
    count: int
    total: int
    record: str
    breakdown: RecordBreakdown


class MatchDynamics(BaseModel):
    btts: FrequencyCount
    clean_sheets: Optional[FrequencyCount] = None
    clean_sheets_pct: Optional[float] = 0.0
    failed_to_score: Optional[FrequencyCount] = None
    failed_to_score_pct: Optional[float] = 0.0
    conceded_early_0_20: Optional[FrequencyCount] = None
    conceded_early_0_20_pct: Optional[float] = 0.0
    ht_won: FrequencyCount
    ht_drawn: FrequencyCount
    ht_lost: FrequencyCount
    scored_first: DynamicEventRecord
    conceded_first: DynamicEventRecord


class DisciplineStats(BaseModel):
    fouls_committed_avg: float
    fouls_drawn_avg: float
    cards_for_avg: float
    cards_forced_avg: float
    cards_match_total_avg: float
    red_cards_total: int = 0
    red_cards_avg: float = 0.0
    over_3_5_cards: FrequencyCount
    over_4_5_cards: Optional[FrequencyCount] = None
    over_4_5_cards_count: Optional[int] = 0
    over_4_5_cards_pct: Optional[float] = 0.0
    cards_2h_pct: float = 0.0


class TeamPeriodMetricsResponse(BaseModel):
    team_id: int
    mode: str = "for"
    tournament: str
    venue: str
    matches_count: int
    periods: Dict[str, TeamPeriodStatsItem]
    clean_sheets_count: Optional[int] = None
    clean_sheets_pct: Optional[float] = None
    failed_to_score_count: Optional[int] = None
    failed_to_score_pct: Optional[float] = None
    conceded_early_0_20_count: Optional[int] = None
    conceded_early_0_20_pct: Optional[float] = None
    red_cards_total: Optional[int] = None
    red_cards_avg: Optional[float] = None
    penalties_awarded: Optional[int] = None
    penalties_scored: Optional[int] = None
    penalties_conceded: Optional[int] = None
    corners_conceded_over_4_5_count: Optional[int] = None
    corners_conceded_over_4_5_pct: Optional[float] = None
    over_4_5_corners_for_count: Optional[int] = None
    over_4_5_corners_for_pct: Optional[float] = None
    over_5_5_corners_for_count: Optional[int] = None
    over_5_5_corners_for_pct: Optional[float] = None
    over_4_5_cards_count: Optional[int] = None
    over_4_5_cards_pct: Optional[float] = None
    corners_1t_avg: Optional[float] = None
    corners_2t_avg: Optional[float] = None
    ht_won: int = 0
    ht_drawn: int = 0
    ht_lost: int = 0
    ht_outcomes: Optional[HTOutcomes] = None
    scored_first_count: int = 0
    scored_first_record: str = "0V-0E-0D"
    conceded_first_count: int = 0
    conceded_first_record: str = "0V-0E-0D"
    first_goal: Optional[FirstGoalRecord] = None
    set_pieces: TeamSetPieceDetail
    goal_distribution: GoalDistributionDetail
    corner_stats: Optional[CornerStats] = None
    time_splits: Optional[TimeSplits] = None
    match_dynamics: Optional[MatchDynamics] = None
    discipline_stats: Optional[DisciplineStats] = None



