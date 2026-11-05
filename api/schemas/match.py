"""
Pydantic schemas for Match Report endpoints.
"""

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class TeamKpiFloat(BaseModel):
    home: Optional[float] = None
    away: Optional[float] = None


class TeamKpiInt(BaseModel):
    home: Optional[int] = None
    away: Optional[int] = None


class MatchSheet02TeamInfo(BaseModel):
    team_id: int
    name: str
    short_name: Optional[str] = None
    score: int = 0
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None


class MatchSheet02Metadata(BaseModel):
    match_id: int
    tournament: Optional[str] = None
    round: Optional[int] = None
    match_date: Optional[str] = None
    home_team: MatchSheet02TeamInfo
    away_team: MatchSheet02TeamInfo


class MatchSheet02Kpis(BaseModel):
    field_tilt: TeamKpiFloat = Field(
        description="Relative % of passes and touches in final third (x >= 66.7) for each team"
    )
    progressive_passes: TeamKpiInt = Field(
        description="Completed passes where distance to opponent goal center (100, 50) is reduced by at least 25%"
    )
    line_breaking_passes: TeamKpiInt = Field(
        description="Completed forward passes with x_start <= 60.0, x_end >= 65.0, and dx >= 15.0"
    )
    box_entries: TeamKpiInt = Field(
        description="Sum of completed passes and ball carries with origin outside opponent penalty box and destination inside"
    )
    home: Optional[Dict[str, Any]] = None
    away: Optional[Dict[str, Any]] = None


class PassingShapeSector(BaseModel):
    angle_deg: float = Field(
        description="Central angle of 22.5 deg sector: 0.0 (FWD), 90.0 (LEFT), 180.0 (BACK), 270.0 (RIGHT)"
    )
    pass_count: int = Field(description="Total passes attempted in this sector")
    completion_pct: float = Field(description="Pass completion percentage (0.0 to 100.0%)")
    median_distance_m: float = Field(
        description="Median pass length in meters (x scaled to 105m, y to 68m)"
    )


class PassingShapeSummary(BaseModel):
    total_passes: int
    forward_pct: float = Field(description="% of passes with forward progression (dx > 0)")
    completed_pct: float = Field(description="Overall pass completion percentage")


class PassingShapeModule(BaseModel):
    team_id: int
    team_name: str
    is_home: bool
    summary: PassingShapeSummary
    sectors: List[PassingShapeSector]


class MatchSheetDensityContour(BaseModel):
    level: float
    threshold: float
    svg_path: Optional[str] = None
    point_count: int = 0


class MatchSheetDensityCell(BaseModel):
    row: int
    col: int
    x_min: float
    x_max: float
    y_min: float
    y_max: float
    count: int
    intensity: float


class MatchSheetDensityGrid(BaseModel):
    rows: int
    cols: int
    grid: List[List[int]]
    normalized_grid: List[List[float]]
    cells: List[MatchSheetDensityCell]
    max_count: int
    team_max_count: int
    total_actions: int
    density_source: str
    contours: Optional[List[MatchSheetDensityContour]] = None


class BoxEntryVector(BaseModel):
    id: int
    entry_type: str  # 'pass' | 'cross' | 'carry'
    x_start: float
    y_start: float
    x_end: float
    y_end: float


class BoxEntriesModule(BaseModel):
    team_id: int
    team_name: str
    is_home: bool
    total_entries: int
    entries: List[BoxEntryVector]
    density: Optional[MatchSheetDensityGrid] = None


class DumbbellStageRow(BaseModel):
    key: str
    label: str
    home_val: int
    away_val: int


class NestedPossessionStagesModule(BaseModel):
    stages: List[DumbbellStageRow]
    max_val: int


class EntryOriginLaneModule(BaseModel):
    lanes: List[DumbbellStageRow]
    max_val: int


class MatchSheet02Response(BaseModel):
    match_id: int
    metadata: MatchSheet02Metadata
    kpis: MatchSheet02Kpis
    module_01_home_passing_shape: PassingShapeModule
    module_02_away_passing_shape: PassingShapeModule
    module_03_home_box_entries: BoxEntriesModule
    module_04_away_box_entries: BoxEntriesModule
    module_05_nested_possession_stages: NestedPossessionStagesModule
    module_06_entry_origin_lane: EntryOriginLaneModule


class DataHubMetricRow(BaseModel):
    key: str
    label: str
    home_val: Union[float, int, str]
    away_val: Union[float, int, str]
    source: str  # 'sofascore' | 'flashscore' | 'consensus' | 'derived'
    unit: Optional[str] = None  # '%', 'm', None
    higher_is_better: bool = True


class PlayerMatchPerformance(BaseModel):
    player_id: int
    jersey_number: Optional[int] = None
    name: str
    position: str
    was_substitute: bool
    minutes_played: int
    subbed_in_minute: Optional[int] = None
    replaced_player_name: Optional[str] = None
    sofascore_rating: Optional[float] = None
    goals: int = 0
    assists: int = 0
    calculated_xg: float = 0.0
    total_shots: Optional[int] = 0
    shots_on_target: Optional[int] = None
    key_passes: int = 0
    passes_completed: int = 0
    passes_total: int = 0
    accurate_passes_pct: Optional[float] = None
    tackles: int = 0
    interceptions: int = 0
    recoveries: int = 0
    clearances: int = 0
    saves: Optional[int] = None
    goals_conceded: int = 0
    fouls: int = 0
    was_fouled: int = 0


class CardIncident(BaseModel):
    id: Optional[int] = None
    minute: int
    minute_display: str
    extra_minute: int = 0
    team_id: int
    player_id: int
    player_name: Optional[str] = None
    card_type: str
    reason: Optional[str] = None
    rescinded: bool = False


class SubstitutionIncident(BaseModel):
    id: Optional[int] = None
    minute: int
    minute_display: str
    extra_minute: int = 0
    team_id: int
    player_in_id: int
    player_in_name: Optional[str] = None
    player_out_id: int
    player_out_name: Optional[str] = None


class MatchVenueInfo(BaseModel):
    stadium: Optional[str] = None
    city: Optional[str] = None
    altitude: Optional[int] = None
    surface: Optional[str] = None


class MatchRefereeInfo(BaseModel):
    referee_id: Optional[int] = None
    name: Optional[str] = None
    country: Optional[str] = None
    sample_matches: Optional[int] = None
    yellow_cards_per_match: Optional[float] = None
    red_cards_per_match: Optional[float] = None
    is_small_sample: bool = False


class GoalIncident(BaseModel):
    minute: int
    minute_display: str
    period: str
    team_id: int
    player_name: str
    incident_type: str  # "regular" | "penalty" | "ownGoal" | "corner"
    assister_name: Optional[str] = None


class GameStateSummary(BaseModel):
    total_duration_minutes: int = 90
    lead_minutes: int = 0
    lead_pct: float = 0.0
    draw_minutes: int = 90
    draw_pct: float = 100.0
    trail_minutes: int = 0
    trail_pct: float = 0.0
    criterion: str = "Tiempo reglamentario estándar (90 min)"


class HalfPeriodStats(BaseModel):
    period: str  # "1ST" | "2ND"
    home_goals: int
    away_goals: int
    home_corners: int
    away_corners: int
    home_fouls: Optional[int] = None
    away_fouls: Optional[int] = None
    home_yellow_cards: int
    away_yellow_cards: int
    home_possession: float
    away_possession: float
    home_shots: Optional[int] = None
    away_shots: Optional[int] = None
    home_shots_on_target: Optional[int] = None
    away_shots_on_target: Optional[int] = None
    home_xg: Optional[float] = None
    away_xg: Optional[float] = None
    home_xgot: Optional[float] = None
    away_xgot: Optional[float] = None
    fouls_source: Optional[str] = None  # "flashscore" | "sofascore" | None
    shots_source: Optional[str] = None  # "flashscore" | None


class AttackChannelBreakdown(BaseModel):
    left_passes: int = 0
    left_passes_completed: int = 0
    left_pct: Optional[float] = None
    center_passes: int = 0
    center_passes_completed: int = 0
    center_pct: Optional[float] = None
    right_passes: int = 0
    right_passes_completed: int = 0
    right_pct: Optional[float] = None
    total_passes: int = 0


class ShotTypologySummary(BaseModel):
    open_play: int = 0
    set_piece: int = 0
    counter_attack: int = 0
    penalty: int = 0
    other: int = 0
    total: int = 0


class MatchSheet03DataHubResponse(BaseModel):
    match_id: int
    metadata: MatchSheet02Metadata
    attack_metrics: List[DataHubMetricRow]
    passing_metrics: List[DataHubMetricRow]
    defense_metrics: List[DataHubMetricRow]
    discipline_metrics: List[DataHubMetricRow]
    clipboard_text: str  # Texto plano estructurado para portapapeles (sin emojis)
    home_players: List[PlayerMatchPerformance] = []
    away_players: List[PlayerMatchPerformance] = []
    # Nuevos módulos aditivos:
    venue: Optional[MatchVenueInfo] = None
    referee: Optional[MatchRefereeInfo] = None
    goals_chronology: List[GoalIncident] = []
    game_state: Optional[GameStateSummary] = None
    half_period_stats: List[HalfPeriodStats] = []
    home_attack_channels: Optional[AttackChannelBreakdown] = None
    away_attack_channels: Optional[AttackChannelBreakdown] = None
    home_shot_typology: Optional[ShotTypologySummary] = None
    away_shot_typology: Optional[ShotTypologySummary] = None
    fouls_source: Optional[str] = None
    shots_source: Optional[str] = None
    card_incidents: List[CardIncident] = []
    substitution_incidents: List[SubstitutionIncident] = []


