import { apiClient } from './apiClient';

// ---------------------------------------------------------------------------
// Match Report Sheet 01 / 04 ("The result and the chances") API
// ---------------------------------------------------------------------------

export interface MatchSheetTeamInfo {
  team_id: number;
  name: string;
  short_name: string;
  logo_url: string | null;
  primary_color: string | null;
  score: number;
}

export interface MatchSheetTeamMetrics {
  goals: number;
  xg: number;
  npxg: number;
  xgot: number | null;
  shots_total: number;
  shots_on_target: number;
  shots_inside_box: number;
  shots_outside_box: number;
  xg_per_shot: number;
  big_chances: number;
}

export interface MatchSheetXgFlowPoint {
  minute: number;
  home_xg: number;
  away_xg: number;
  event_type: 'start' | 'shot' | 'goal' | 'own_goal' | 'end';
  is_home: boolean | null;
  shot_xg: number;
  player_name: string | null;
  result: string | null;
  shot_id: number | null;
}

export type MatchSheetShotOutcome = 'goal' | 'saved' | 'blocked' | 'off_target';

export interface MatchSheetShotItem {
  index: number;
  shot_id: number;
  is_home: boolean;
  team_id: number;
  x: number;
  raw_x: number;
  y: number;
  distance_m: number;
  xg: number;
  result: 'goal' | 'saved' | 'miss' | 'blocked';
  outcome: MatchSheetShotOutcome;
  raw_outcome: string;
  is_goal: boolean;
  is_woodwork: boolean;
  from_own_half: boolean;
  situation: 'open_play' | 'set_piece' | 'corner' | 'penalty' | 'fast_break';
  body_part: 'right_foot' | 'left_foot' | 'head' | 'other';
  player: string;
  player_name: string;
  player_jersey: number | null;
  minute: number | null;
  added_time: number | null;
  period: '1T' | '2T' | null;
  incident_type: 'regular' | 'penalty' | 'ownGoal' | null;
}

export interface MatchSheetScoreboardTeamKpi {
  xg: number | null;
  xgot: number | null;
  shots: number | null;
  on_target: number | null;
}

export interface MatchSheetScoreboardKpis {
  home: MatchSheetScoreboardTeamKpi;
  away: MatchSheetScoreboardTeamKpi;
}

export interface MatchSheetModule01GoalItem {
  minute: number;
  added_time: number | null;
  period: '1T' | '2T' | null;
  team_id: number;
  is_home: boolean;
  player_name: string;
  incident_type: 'regular' | 'penalty' | 'ownGoal';
  shot_xg: number;
  cum_team_xg: number;
}

export interface MatchSheetModule01XgFlow {
  points: MatchSheetXgFlowPoint[];
  goals: MatchSheetModule01GoalItem[];
}

export interface MatchSheetModule02TeamStats {
  goals: number;
  xg_per_shot: number | null;
  big_chances: number | null;
  shots_inside_box: number;
  shots_outside_box: number;
  box_entries: number | null;
  passes_into_box: number | null;
  carries_into_box: number | null;
  field_tilt_pct: number | null;
  deep_completions: number | null;
}

export type MatchSheetBoxEntriesSource =
  | 'passes_and_carries'
  | 'passes_only'
  | 'carries_only'
  | null;

export interface MatchSheetModule02ChanceBalance {
  home: MatchSheetModule02TeamStats;
  away: MatchSheetModule02TeamStats;
  box_entries_source: MatchSheetBoxEntriesSource;
  big_chances_source: 'flashscore' | 'derived_xg_030' | null;
}

export interface MatchSheetDensityCell {
  row: number;
  col: number;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  count: number;
  intensity: number;
}

export interface MatchSheetDensityContourLevel {
  level: number;
  threshold: number;
  svg_path: string;
  point_count: number;
}

export interface MatchSheetDensityGrid {
  rows: number;
  cols: number;
  grid: number[][];
  normalized_grid: number[][];
  cells: MatchSheetDensityCell[];
  max_count: number;
  team_max_count: number;
  total_actions: number;
  density_source: 'full_pitch_ball_actions' | 'opponent_half_ball_actions' | string;
  contours?: MatchSheetDensityContourLevel[] | null;
}

export interface MatchSheetShotMapModule {
  shots: MatchSheetShotItem[];
  own_half_shots_count: number;
  density: MatchSheetDensityGrid | null;
}

export interface MatchSheetModule05TeamStats {
  created_xg: number;
  on_frame_xg: number;
  struck_xgot: number | null;
  scored_goals: number;
  shot_goals: number;
  own_goals_for: number;
}

export interface MatchSheetModule05ChanceToGoal {
  home: MatchSheetModule05TeamStats;
  away: MatchSheetModule05TeamStats;
}

export interface MatchSheetModule06TeamStats {
  total: number;
  goals: number;
  saved: number;
  blocked: number;
  off_target: number;
  woodwork: number;
}

export interface MatchSheetModule06ShotOutcomes {
  home: MatchSheetModule06TeamStats;
  away: MatchSheetModule06TeamStats;
}

export interface MatchSheet01EditorialResponse {
  match_id: number;
  match_date: string;
  round: number | null;
  tournament: string;
  season: string;
  has_xgot: boolean;
  has_flashscore_big_chances: boolean;
  final_minute: number;
  home_team: MatchSheetTeamInfo;
  away_team: MatchSheetTeamInfo;
  metrics: {
    home: MatchSheetTeamMetrics;
    away: MatchSheetTeamMetrics;
  };
  xg_flow: MatchSheetXgFlowPoint[];
  shots: {
    home: MatchSheetShotItem[];
    away: MatchSheetShotItem[];
  };
  scoreboard_kpis: MatchSheetScoreboardKpis | null;
  module_01_xg_flow: MatchSheetModule01XgFlow | null;
  module_02_chance_balance: MatchSheetModule02ChanceBalance | null;
  module_03_home_shots: MatchSheetShotMapModule | null;
  module_04_away_shots: MatchSheetShotMapModule | null;
  module_05_chance_to_goal: MatchSheetModule05ChanceToGoal | null;
  module_06_shot_outcomes: MatchSheetModule06ShotOutcomes | null;
}

export type MatchSheet01Response = MatchSheet01EditorialResponse;

// ---------------------------------------------------------------------------
// Match Report Sheet 02 ("Build-up and box access") API
// ---------------------------------------------------------------------------

export interface TeamKpiFloat {
  home: number | null;
  away: number | null;
}

export interface TeamKpiInt {
  home: number | null;
  away: number | null;
}

export interface MatchSheet02TeamInfo {
  team_id: number;
  name: string;
  short_name: string | null;
  score: number;
  logo_url: string | null;
  primary_color: string | null;
}

export interface MatchSheet02Metadata {
  match_id: number;
  tournament: string | null;
  round: number | null;
  match_date: string | null;
  home_team: MatchSheet02TeamInfo;
  away_team: MatchSheet02TeamInfo;
}

export interface MatchSheet02Kpis {
  field_tilt: TeamKpiFloat;
  progressive_passes: TeamKpiInt;
  line_breaking_passes: TeamKpiInt;
  box_entries: TeamKpiInt;
  home?: Record<string, number | null>;
  away?: Record<string, number | null>;
}

export interface PassingShapeSector {
  angle_deg: number;
  pass_count: number;
  completion_pct: number;
  median_distance_m: number;
}

export interface PassingShapeSummary {
  total_passes: number;
  forward_pct: number;
  completed_pct: number;
}

export interface PassingShapeModule {
  team_id: number;
  team_name: string;
  is_home: boolean;
  summary: PassingShapeSummary;
  sectors: PassingShapeSector[];
}

export interface BoxEntryVector {
  id: number;
  entry_type: 'pass' | 'cross' | 'carry';
  x_start: number;
  y_start: number;
  x_end: number;
  y_end: number;
}

export interface BoxEntriesModule {
  team_id: number;
  team_name: string;
  is_home: boolean;
  total_entries: number;
  entries: BoxEntryVector[];
  density?: MatchSheetDensityGrid | null;
}

export interface DumbbellStageRow {
  key: string;
  label: string;
  home_val: number;
  away_val: number;
}

export interface NestedPossessionStagesModule {
  stages: DumbbellStageRow[];
  max_val: number;
}

export interface EntryOriginLaneModule {
  lanes: DumbbellStageRow[];
  max_val: number;
}

export interface MatchSheet02Response {
  match_id: number;
  metadata: MatchSheet02Metadata;
  kpis: MatchSheet02Kpis;
  module_01_home_passing_shape: PassingShapeModule;
  module_02_away_passing_shape: PassingShapeModule;
  module_03_home_box_entries: BoxEntriesModule;
  module_04_away_box_entries: BoxEntriesModule;
  module_05_nested_possession_stages: NestedPossessionStagesModule;
  module_06_entry_origin_lane: EntryOriginLaneModule;
}

// ---------------------------------------------------------------------------
// Match Report Sheet 03 ("Data Hub: Pressing & Turnovers") API
// ---------------------------------------------------------------------------

export interface DataHubMetricRow {
  key: string;
  label: string;
  home_val: number | string;
  away_val: number | string;
  source: 'sofascore' | 'flashscore' | 'consensus' | 'derived';
  unit?: string | null;
  higher_is_better: boolean;
}

export interface PlayerMatchPerformance {
  player_id: number;
  jersey_number?: number | null;
  name: string;
  position: string;
  was_substitute: boolean;
  minutes_played: number;
  subbed_in_minute?: number | null;
  replaced_player_name?: string | null;
  sofascore_rating?: number | null;
  goals: number;
  assists: number;
  calculated_xg: number;
  total_shots: number;
  shots_on_target: number;
  key_passes: number;
  passes_completed: number;
  passes_total: number;
  accurate_passes_pct?: number | null;
  tackles: number;
  interceptions: number;
  recoveries: number;
  clearances: number;
  saves: number;
  goals_conceded: number;
  fouls?: number;
  was_fouled?: number;
}

export interface CardIncident {
  id?: number | null;
  minute: number;
  minute_display: string;
  extra_minute?: number;
  team_id: number;
  player_id: number;
  player_name?: string | null;
  card_type: string;
  reason?: string | null;
  rescinded?: boolean;
}

export interface SubstitutionIncident {
  id?: number | null;
  minute: number;
  minute_display: string;
  extra_minute?: number;
  team_id: number;
  player_in_id: number;
  player_in_name?: string | null;
  player_out_id: number;
  player_out_name?: string | null;
}

export interface MatchVenueInfo {
  stadium?: string | null;
  city?: string | null;
  altitude?: number | null;
  surface?: string | null;
}

export interface MatchRefereeInfo {
  referee_id?: number | null;
  name?: string | null;
  country?: string | null;
  sample_matches?: number | null;
  yellow_cards_per_match?: number | null;
  red_cards_per_match?: number | null;
  is_small_sample?: boolean | null;
}

export interface GoalIncident {
  minute: number;
  minute_display: string;
  period: string;
  team_id: number;
  player_name: string;
  incident_type: string;
  assister_name?: string | null;
  score: string;
}

export interface GameStateSummary {
  total_duration_minutes: number;
  lead_minutes: number;
  lead_pct: number;
  draw_minutes: number;
  draw_pct: number;
  trail_minutes: number;
  trail_pct: number;
  criterion: string;
}

export interface HalfPeriodStats {
  period: '1ST' | '2ND' | string;
  home_goals: number;
  away_goals: number;
  home_corners: number;
  away_corners: number;
  home_fouls?: number | null;
  away_fouls?: number | null;
  home_yellow_cards: number;
  away_yellow_cards: number;
  home_possession: number;
  away_possession: number;
  home_shots?: number | null;
  away_shots?: number | null;
  home_shots_on_target?: number | null;
  away_shots_on_target?: number | null;
  home_xg?: number | null;
  away_xg?: number | null;
  home_xgot?: number | null;
  away_xgot?: number | null;
  fouls_source?: string | null;
  shots_source?: string | null;
}

export interface AttackChannelBreakdown {
  left_passes: number;
  left_passes_completed: number;
  left_pct?: number | null;
  center_passes: number;
  center_passes_completed: number;
  center_pct?: number | null;
  right_passes: number;
  right_passes_completed: number;
  right_pct?: number | null;
  total_passes: number;
}

export interface ShotTypologySummary {
  open_play: number;
  set_piece: number;
  counter_attack: number;
  penalty: number;
  other: number;
  total: number;
}

export interface MatchSheet03DataHubResponse {
  match_id: number;
  metadata: MatchSheet02Metadata;
  attack_metrics: DataHubMetricRow[];
  passing_metrics: DataHubMetricRow[];
  defense_metrics: DataHubMetricRow[];
  discipline_metrics: DataHubMetricRow[];
  clipboard_text: string;
  home_players: PlayerMatchPerformance[];
  away_players: PlayerMatchPerformance[];
  venue?: MatchVenueInfo | null;
  referee?: MatchRefereeInfo | null;
  goals_chronology?: GoalIncident[];
  game_state?: GameStateSummary | null;
  half_period_stats?: HalfPeriodStats[];
  home_attack_channels?: AttackChannelBreakdown | null;
  away_attack_channels?: AttackChannelBreakdown | null;
  home_shot_typology?: ShotTypologySummary | null;
  away_shot_typology?: ShotTypologySummary | null;
  fouls_source?: string | null;
  shots_source?: string | null;
  card_incidents?: CardIncident[];
  substitution_incidents?: SubstitutionIncident[];
}

export const matchesApi = {
  getSheet01Chances: async (matchId: number): Promise<MatchSheet01EditorialResponse> => {
    const response = await apiClient.get<MatchSheet01EditorialResponse>(`/matches/${matchId}/sheet-01-chances`);
    return response.data;
  },
  getSheet02Buildup: async (matchId: number): Promise<MatchSheet02Response> => {
    const response = await apiClient.get<MatchSheet02Response>(`/matches/${matchId}/sheet-02`);
    return response.data;
  },
  getSheet03DataHub: async (matchId: number): Promise<MatchSheet03DataHubResponse> => {
    const response = await apiClient.get<MatchSheet03DataHubResponse>(`/matches/${matchId}/sheet-03-datahub`);
    return response.data;
  },
};

// Legacy standalone functions exported for full backward compatibility
export const getMatchReportSheet02 = matchesApi.getSheet02Buildup;
export const getMatchSheet03DataHub = matchesApi.getSheet03DataHub;
