import { apiClient } from './apiClient';
import type { TeamBase, TeamNextMatch } from './playersApi';
import { teamTacticalApi } from './teamTacticalApi';

export type VenueFilter = 'all' | 'home' | 'away';
export type ContextFilter = 'all' | 'vs_elite' | 'vs_rest' | 'altitude' | 'sea_level';

export interface TeamMetricEntry {
  // Standings & Club Info
  team_id: number;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  logo_url: string | null;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  points_per_match: number | null;
  goals_scored: number;
  goals_conceded: number;
  goal_difference: number;

  // A. Ofensivas / Tiro (10 metrics)
  total_shots: number;
  shots_on_target: number;
  shots_inside_box: number;
  shots_outside_box: number;
  xg: number;
  npxg: number;
  xg_per_shot: number | null;
  goals_minus_xg: number | null;
  conversion_rate_pct: number | null;

  // B. Circulación y Progresión (9 metrics)
  possession_pct: number | null;
  passes_completed: number;
  pass_accuracy_pct: number | null;
  progressive_passes: number;
  passes_into_final_third: number;
  passes_into_box: number;
  crosses_completed: number;
  progressive_carries: number;
  successful_dribbles: number;

  // C. Dominio Territorial y Estilo (3 metrics)
  field_tilt: number | null;
  verticality_ratio_pct: number | null;
  avg_shot_distance: number | null;

  // D. Presión y Fase Defensiva (6 metrics)
  ppda: number | null;
  high_recoveries: number;
  defensive_actions: number;
  tackles: number;
  interceptions: number;
  clearances: number;

  // E. Concesión / Rival (6 metrics)
  shots_conceded: number;
  shots_on_target_conceded: number;
  shots_conceded_inside_box: number;
  xga: number;
  xgd: number;
  defensive_resistance_ratio: number | null;

  // Backwards compatibility / convenience extras
  passes_total: number;
  xg_per_match: number | null;
  xga_per_match: number | null;
  field_tilt_pct: number | null;
  conversion_ratio: number | null;
  set_piece_xg?: number;
  set_piece_xg_p90?: number;
  set_piece_xg_per_match?: number;
  progressive_passes_p90?: number;
  final_third_passes_p90?: number;
}

export interface TeamMatchItem {
  match_id: number;
  round: number;
  tournament: string;
  date: string;
  opponent_id: number;
  opponent_name: string;
  opponent_tricode: string;
  is_home: boolean;
  team_score: number;
  opponent_score: number;
  label: string;
}

export interface MostUsedXIPlayer {
  slot: string;
  player_id: number;
  name: string;
  shirt_number: number | null;
  position_group: string;
  age: number | null;
  appearances: number;
  apps: number;
  starts: number;
  minutes_played: number;
  minutes_pct: number;
  minutes_share: number;
  goals: number;
  assists: number;
  xg: number;
  shots_p90?: number;
  total_shots?: number;
  yellow_cards?: number;
  red_cards?: number;
  fouls?: number;
  fouls_p90?: number;
  set_piece_roles?: string[];
  saves?: number;
  saves_p90?: number;
  g_plus_a: number;
  goal_contributions: number;
  pitch_x: number;
  pitch_y: number;
  avg_x: number;
  avg_y: number;
}

export interface MostUsedXIResponse {
  team_id: number;
  tournament: string;
  venue: string;
  formation: string;
  total_matches: number;
  max_minutes: number;
  players: MostUsedXIPlayer[];
}

export interface GoalContributorItem {
  player_id: number;
  name: string;
  shirt_number: number | null;
  position_group: string;
  minutes_played: number;
  matches_played: number;
  goals: number;
  assists: number;
  actual_total: number;
  xg: number;
  xa: number;
  expected_total: number;
}

export interface GoalContributionsResponse {
  team_id: number;
  tournament: string;
  contributors: GoalContributorItem[];
  set_piece_summary: {
    total_goals: number;
    corner_goals: number;
    corner_goals_pct: number;
    peak_interval: string;
    peak_goals: number;
  };
}

export interface TeamPeriodStatsItem {
  matches_count: number;
  avg_corner_kicks: number;
  avg_fouls: number;
  avg_possession: number;
  total_goals: number;
  avg_goals: number;
  total_yellow_cards: number;
  avg_yellow_cards: number;
  total_red_cards: number;
  avg_red_cards: number;
  goals_conceded: number;
  avg_goals_conceded: number;
  avg_corners_against?: number;
  avg_fouls_received?: number;
  avg_corners_home?: number;
  avg_corners_away?: number;
  avg_xg?: number;
}

export interface TeamSetPieceDetail {
  corner_goals: number;
  corner_goals_per_match: number;
  corner_goals_pct: number;
  corner_goals_conceded?: number;
  set_piece_shots: number;
  set_piece_goals: number;
  set_piece_goals_per_match: number;
  set_piece_goals_conceded?: number;
  set_piece_goals_conceded_per_match?: number;
  set_piece_xg: number;
  set_piece_xg_per_match: number;
  penalties_awarded?: number;
  penalties_scored?: number;
  penalties_conceded?: number;
}

export interface GoalIntervalItem {
  interval: string;
  goals: number;
  corner_goals: number;
  percentage: number;
}

export interface GoalDistributionDetail {
  total_goals: number;
  intervals: GoalIntervalItem[];
  peak_interval: string;
  peak_goals: number;
  peak_pct: number;
}

export interface HTOutcomes {
  ht_won: number;
  ht_drawn: number;
  ht_lost: number;
}

export interface FirstGoalRecord {
  scored_first_count: number;
  scored_first_record: string;
  conceded_first_count: number;
  conceded_first_record: string;
}

export interface FrequencyCount {
  count: number;
  total: number;
}

export interface CornerStats {
  corners_for_avg: number;
  corners_against_avg: number;
  corners_total_avg: number;
  corners_1t_avg?: number;
  corners_2t_avg?: number;
  over_8_5_corners: FrequencyCount;
  over_9_5_corners: FrequencyCount;
  over_4_5_corners_for?: FrequencyCount;
  over_4_5_corners_for_count?: number;
  over_4_5_corners_for_pct?: number;
  over_5_5_corners_for?: FrequencyCount;
  over_5_5_corners_for_count?: number;
  over_5_5_corners_for_pct?: number;
  corners_conceded_over_4_5?: FrequencyCount;
  corners_conceded_over_4_5_count?: number;
  corners_conceded_over_4_5_pct?: number;
  set_piece_goals: number;
  corner_goals: number;
}

export interface TimeSplits {
  goals_1t: number;
  goals_2t: number;
  pct_goals_2t: number;
  peak_scoring_interval: string;
  corners_1t_avg?: number;
  corners_2t_avg?: number;
}

export interface RecordBreakdown {
  wins: number;
  draws: number;
  losses: number;
}

export interface DynamicEventRecord {
  count: number;
  total: number;
  record: string;
  breakdown: RecordBreakdown;
}

export interface MatchDynamics {
  btts: FrequencyCount;
  clean_sheets?: FrequencyCount;
  clean_sheets_pct?: number;
  failed_to_score?: FrequencyCount;
  failed_to_score_pct?: number;
  conceded_early_0_20?: FrequencyCount;
  conceded_early_0_20_pct?: number;
  ht_won: FrequencyCount;
  ht_drawn: FrequencyCount;
  ht_lost: FrequencyCount;
  scored_first: DynamicEventRecord;
  conceded_first: DynamicEventRecord;
}

export interface DisciplineStats {
  fouls_committed_avg: number;
  fouls_drawn_avg: number;
  cards_for_avg: number;
  cards_forced_avg: number;
  cards_match_total_avg: number;
  red_cards_total?: number;
  red_cards_avg?: number;
  over_3_5_cards: FrequencyCount;
  over_4_5_cards?: FrequencyCount;
  over_4_5_cards_count?: number;
  over_4_5_cards_pct?: number;
  cards_2h_pct?: number;
}

export interface TeamPeriodMetricsResponse {
  team_id: number;
  tournament: string;
  venue?: string;
  mode?: string;
  matches_count: number;
  periods: {
    '1ST': TeamPeriodStatsItem;
    '2ND': TeamPeriodStatsItem;
    'ALL': TeamPeriodStatsItem;
  };
  clean_sheets_count?: number;
  clean_sheets_pct?: number;
  failed_to_score_count?: number;
  failed_to_score_pct?: number;
  conceded_early_0_20_count?: number;
  conceded_early_0_20_pct?: number;
  red_cards_total?: number;
  red_cards_avg?: number;
  penalties_awarded?: number;
  penalties_scored?: number;
  penalties_conceded?: number;
  corners_conceded_over_4_5_count?: number;
  corners_conceded_over_4_5_pct?: number;
  over_4_5_corners_for_count?: number;
  over_4_5_corners_for_pct?: number;
  over_5_5_corners_for_count?: number;
  over_5_5_corners_for_pct?: number;
  over_4_5_cards_count?: number;
  over_4_5_cards_pct?: number;
  corners_1t_avg?: number;
  corners_2t_avg?: number;
  ht_won?: number;
  ht_drawn?: number;
  ht_lost?: number;
  ht_outcomes?: HTOutcomes;
  scored_first_count?: number;
  scored_first_record?: string;
  conceded_first_count?: number;
  conceded_first_record?: string;
  first_goal?: FirstGoalRecord;
  set_pieces: TeamSetPieceDetail;
  goal_distribution: GoalDistributionDetail;
  corner_stats?: CornerStats;
  time_splits?: TimeSplits;
  match_dynamics?: MatchDynamics;
  discipline_stats?: DisciplineStats;
}

export interface FlashscorePeriodStats {
  avg_xg: number;
  avg_xg_conceded: number;
  avg_shots_total: number;
  avg_shots_on_target: number;
  avg_corner_kicks?: number;
  avg_xgot: number;
  avg_possession: number;
  avg_passes_completed: number;
  avg_passes_final_third_completed: number;
  avg_touches_in_box: number;
  xgot_faced: number;
  goals_conceded: number;
  goals_prevented: number;
  avg_crosses_total?: number;
  avg_crosses_completed?: number;
  cross_accuracy_pct?: number;
  total_headed_goals?: number;
  total_big_chances?: number;
  total_big_chances_scored?: number;
  total_big_chances_missed?: number;
  big_chances_conversion_pct?: number;
}

export interface FlashscoreGoalkeeperEfficiency {
  xgot_faced: number;
  goals_conceded: number;
  goals_prevented: number;
  prevented_per_match: number;
}

export interface TeamFlashscoreSummaryResponse {
  team_id: number;
  team_name: string;
  tournament?: string;
  matches_analyzed: number;
  periods: {
    '1T': FlashscorePeriodStats;
    '2T': FlashscorePeriodStats;
    'ALL': FlashscorePeriodStats;
  };
  goalkeeper_efficiency: FlashscoreGoalkeeperEfficiency;
}

export const teamsApi = {
  getAll: async (): Promise<TeamBase[]> => {
    const response = await apiClient.get(`/teams/`);
    return response.data;
  },
  getTeams: async (): Promise<TeamBase[]> => {
    const response = await apiClient.get(`/teams/`);
    return response.data;
  },
  getTeam: async (teamId: number): Promise<TeamBase> => {
    const response = await apiClient.get(`/teams/${teamId}`);
    return response.data;
  },
  getNextMatch: async (teamId: number): Promise<TeamNextMatch> => {
    const response = await apiClient.get(`/teams/${teamId}/next-match`);
    return response.data;
  },
  getMetrics: async (tournament?: 'Apertura' | 'Clausura', venue?: VenueFilter, contextFilter?: ContextFilter): Promise<TeamMetricEntry[]> => {
    const params = new URLSearchParams();
    if (tournament) params.append('tournament', tournament);
    if (venue && venue !== 'all') params.append('venue', venue);
    if (contextFilter && contextFilter !== 'all') params.append('context_filter', contextFilter);
    const queryString = params.toString();
    const url = queryString ? `/teams/metrics?${queryString}` : `/teams/metrics`;
    const response = await apiClient.get(url);
    return response.data;
  },
  getTeamMatches: async (teamId: number, tournament?: 'Apertura' | 'Clausura' | 'all'): Promise<TeamMatchItem[]> => {
    const url = tournament && tournament !== 'all'
      ? `/teams/${teamId}/matches?tournament=${tournament}`
      : `/teams/${teamId}/matches`;
    const response = await apiClient.get(url);
    return response.data;
  },
  getMostUsedXI: async (
    teamId: number,
    tournament?: 'Apertura' | 'Clausura' | 'all',
    venue?: VenueFilter,
    contextFilter?: ContextFilter
  ): Promise<MostUsedXIResponse> => {
    const params = new URLSearchParams();
    if (tournament && tournament !== 'all') {
      params.append('tournament', tournament);
    }
    if (venue && venue !== 'all') {
      params.append('venue', venue);
    }
    if (contextFilter && contextFilter !== 'all') {
      params.append('context_filter', contextFilter);
    }
    const queryString = params.toString();
    const url = queryString
      ? `/teams/${teamId}/most-used-xi?${queryString}`
      : `/teams/${teamId}/most-used-xi`;
    const response = await apiClient.get(url);
    return response.data;
  },
  getGoalContributions: async (
    teamId: number,
    tournament?: 'Apertura' | 'Clausura' | 'all',
    limit: number = 8
  ): Promise<GoalContributionsResponse> => {
    const url = tournament && tournament !== 'all'
      ? `/teams/${teamId}/goal-contributions?tournament=${tournament}&limit=${limit}`
      : `/teams/${teamId}/goal-contributions?limit=${limit}`;
    const response = await apiClient.get(url);
    return response.data;
  },
  getPeriodMetrics: async (
    teamId: number,
    tournament?: 'Apertura' | 'Clausura' | 'all',
    venue?: VenueFilter,
    mode: 'for' | 'against' = 'for',
    contextFilter?: ContextFilter
  ): Promise<TeamPeriodMetricsResponse> => {
    const params = new URLSearchParams();
    if (tournament && tournament !== 'all') {
      params.append('tournament', tournament);
    }
    if (venue && venue !== 'all') {
      params.append('venue', venue);
    }
    if (mode) {
      params.append('mode', mode);
    }
    if (contextFilter && contextFilter !== 'all') {
      params.append('context_filter', contextFilter);
    }
    const queryString = params.toString();
    const url = queryString
      ? `/teams/${teamId}/period-metrics?${queryString}`
      : `/teams/${teamId}/period-metrics`;
    const response = await apiClient.get(url);
    return response.data;
  },
  getSetPieces: async (
    teamId: number,
    tournament?: 'Apertura' | 'Clausura' | 'all',
    venue?: VenueFilter,
    mode: 'for' | 'against' = 'for',
    contextFilter?: ContextFilter
  ): Promise<any> => {
    const params = new URLSearchParams();
    if (tournament && tournament !== 'all') {
      params.append('tournament', tournament);
    }
    if (venue && venue !== 'all') {
      params.append('venue', venue);
    }
    if (mode) {
      params.append('mode', mode);
    }
    if (contextFilter && contextFilter !== 'all') {
      params.append('context_filter', contextFilter);
    }
    const queryString = params.toString();
    const url = queryString
      ? `/teams/${teamId}/set-pieces?${queryString}`
      : `/teams/${teamId}/set-pieces`;
    const response = await apiClient.get(url);
    return response.data;
  },
  getTeamFlashscoreSummary: async (teamId: number, tournament?: string): Promise<TeamFlashscoreSummaryResponse> => {
    const params = new URLSearchParams();
    if (tournament && tournament !== 'all') {
      params.append('tournament', tournament);
    }
    const queryString = params.toString();
    const url = queryString
      ? `/teams/${teamId}/flashscore-summary?${queryString}`
      : `/teams/${teamId}/flashscore-summary`;
    const response = await apiClient.get(url);
    return response.data;
  },
  // Spatial methods from teamTacticalApi merged for backwards compatibility
  ...teamTacticalApi,
};
