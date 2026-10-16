import axios from 'axios';

const BASE_URL = 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface PlayerSearchResult {
  player_id: number;
  name: string;
  position_group: string | null;
  team_name: string | null;
  team_logo_url: string | null;
}

export interface TeamBase {
  team_id: number;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  primary_color?: string | null;
}

export interface TeamNextMatch {
  match_date: string;
  opponent_name: string;
  opponent_logo_url: string | null;
  home_away: string;
  match_id: number;
}

export interface PlayerProfile {
  player_id: number;
  name: string;
  date_of_birth: string | null;
  nationality: string | null;
  position: string | null;
  position_group: string | null;
  shirt_number: number | null;
  height?: number | null;
  preferred_foot?: string | null;
  team: TeamBase | null;
  market_value_eur: number | null;
  market_value_str: string | null;
}

export interface PlayerSeasonStats {
  player_id: number;
  appearances: number | null;
  started: number | null;
  minutes_played: number | null;
  goals: number | null;
  goals_pct?: number | null;
  assists: number | null;
  assists_pct?: number | null;
  rating: number | null;
  rating_pct?: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  shots_on_target: number | null;
  shots_on_target_pct?: number | null;
  successful_dribbles: number | null;
  successful_dribbles_pct?: number | null;
  accurate_passes_percentage: number | null;
  accurate_passes_percentage_pct?: number | null;
  ground_duels_won_percentage: number | null;
  ground_duels_won_percentage_pct?: number | null;
  aerial_duels_won: number | null;
  aerial_duels_won_pct?: number | null;
  key_passes: number | null;
  key_passes_pct?: number | null;
  interceptions: number | null;
  interceptions_pct?: number | null;
  tackles: number | null;
  tackles_pct?: number | null;
  saves: number | null;
  saves_pct?: number | null;
  clean_sheets: number | null;
  clean_sheets_pct?: number | null;
  minutes_played_pct?: number | null;
  expected_goals?: number | null;
  expected_goals_pct?: number | null;
  accurate_final_third_passes?: number | null;
  accurate_final_third_passes_pct?: number | null;
  clearances?: number | null;
  clearances_pct?: number | null;
  total_shots?: number | null;
  accurate_passes?: number | null;
  big_chances_created?: number | null;
}

export interface PlayerMatchStats {
  match_id: number;
  match_date: string;
  opponent_name: string;
  opponent_logo_url: string | null;  // Team logo for the opponent
  is_home: boolean;
  minutes_played: number | null;
  sofascore_rating: number | null;
  goals: number | null;
  assists: number | null;
  shots_on_target: number | null;
  key_passes?: number | null;
  accurate_passes_pct: number | null;
  result: string | null;   // 'W' | 'D' | 'L'
  score: string | null;    // e.g. '2-1' from player's team perspective
  position?: string | null; // e.g. 'CM', 'ST'
  round?: number | null;
  tournament_name?: string | null;
}


export interface PlayerRankingEntry {
  rank: number;
  player_id: number;
  name: string;
  team_name: string;
  team_logo_url: string | null;
  position_group: string | null;
  position: string | null;
  minutes_played: number | null;
  value: number | string;
  accurate_passes_percentage?: number | null;
  date_of_birth?: string | null;
  age?: number | null;
}

export interface HeatmapPoint {
  x: number;
  y: number;
  count: number;
}

export interface PlayerShot {
  shot_id: string | number;
  shot_type: string;
  situation: string;
  body_part: string;
  distance_m: number;
  angle_rad: number;
  x: number;
  y: number;
  calculated_xg: number;
  goal_mouth_x?: number | null;
  goal_mouth_y?: number | null;
  goal_mouth_z?: number | null;
  goal_mouth_location?: string | null;
}

export interface PlayerPass {
  id: number;
  match_id: number;
  player_id: number;
  x_start: number | null;
  y_start: number | null;
  x_end: number | null;
  y_end: number | null;
  is_successful: boolean;
  created_at: string;
}

export interface PlayerDefensiveAction {
  id: number;
  match_id: number;
  player_id: number;
  x: number | null;
  y: number | null;
  action_type: string | null;
  end_x: number | null;
  end_y: number | null;
  is_home: boolean | null;
  created_at: string;
}

export interface PlayerDribble {
  id: number;
  match_id: number;
  player_id: number;
  x: number | null;
  y: number | null;
  is_successful: boolean;
  created_at: string;
}

export interface PlayerBallCarry {
  id: number;
  match_id: number;
  player_id: number;
  x_start: number | null;
  y_start: number | null;
  x_end: number | null;
  y_end: number | null;
  is_home: boolean;
  created_at: string;
}

export interface PlayerDefendingStats {
  defensive_actions: PlayerDefensiveAction[];
  dribbles: PlayerDribble[];
  ball_carries: PlayerBallCarry[];
}

export interface SimilarPlayer {
  player_id: number;
  name: string;
  team_name: string | null;
  team_id: number | null;
  position: string | null;
  similarity_pct: number;
  minutes_played: number | null;
  shirt_number: number | null;
  date_of_birth?: string | null;
  age?: number | null;
}

export const playersApi = {
  search: async (query: string): Promise<PlayerSearchResult[]> => {
    const response = await apiClient.get(`/players/search?q=${query}`);
    return response.data;
  },
  getProfile: async (id: number): Promise<PlayerProfile> => {
    const response = await apiClient.get(`/players/${id}`);
    return response.data;
  },
  getSeasonStats: async (id: number): Promise<PlayerSeasonStats> => {
    const response = await apiClient.get(`/players/${id}/season-stats`);
    return response.data;
  },
  getMatchStats: async (id: number): Promise<PlayerMatchStats[]> => {
    const response = await apiClient.get(`/players/${id}/match-stats`);
    return response.data;
  },
  getHeatmap: async (id: number): Promise<HeatmapPoint[]> => {
    const response = await apiClient.get(`/players/${id}/heatmap`);
    return response.data;
  },
  getShotmap: async (id: number): Promise<PlayerShot[]> => {
    const response = await apiClient.get(`/players/${id}/shotmap`);
    return response.data;
  },
  getPasses: async (id: number, matchId?: number): Promise<PlayerPass[]> => {
    const url = matchId ? `/players/${id}/passes?match_id=${matchId}` : `/players/${id}/passes`;
    const response = await apiClient.get(url);
    return response.data;
  },
  getDefending: async (id: number): Promise<PlayerDefendingStats> => {
    const response = await apiClient.get(`/players/${id}/defending`);
    return response.data;
  },
  getSimilarPlayers: async (id: number, limit: number = 10): Promise<SimilarPlayer[]> => {
    const response = await apiClient.get(`/players/${id}/similar?limit=${limit}`);
    return response.data;
  },
};

export const rankingsApi = {
  getTopPlayers: async (stat: string, limit: number = 100, positionGroup?: string, minMinutes?: number): Promise<PlayerRankingEntry[]> => {
    let url = `/rankings/players?stat=${stat}&limit=${limit}`;
    if (positionGroup) url += `&position_group=${encodeURIComponent(positionGroup)}`;
    if (minMinutes !== undefined) url += `&min_minutes=${minMinutes}`;
    const response = await apiClient.get(url);
    return response.data;
  }
};

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

export interface ShotZoneCell {
  zone_id: number;
  row: number;
  col: number;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  count: number;
  xg: number;
  xg_per_shot: number;
  pct_of_total: number;
  goals: number;
}

export interface ShotTacticsSummary {
  total_shots: number;
  non_penalty_shots: number;
  avg_distance_m: number;
  pct_inside_box: number;
  pct_set_piece: number;
  pct_fast_break: number;
}

export interface TeamShotZonesResponse {
  team_id: number;
  team_name: string;
  tournament: string | null;
  total_shots_taken: number;
  total_xg_taken: number;
  total_shots_conceded: number;
  total_xg_conceded: number;
  grid: {
    rows: number;
    cols: number;
  };
  shots_taken: ShotZoneCell[];
  shots_conceded: ShotZoneCell[];
  tactics_taken?: ShotTacticsSummary | null;
  tactics_conceded?: ShotTacticsSummary | null;
}

export interface PassNetworkNode {
  player_id: number;
  name: string;
  jersey: number | null;
  x: number;
  y: number;
  total_passes: number;
  is_pivot?: boolean;
  defensive_actions_p90?: number | null;
  is_exposed_pivot?: boolean;
}

export interface PassNetworkEdge {
  passer_id: number;
  receiver_id: number;
  pass_count: number;
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

export interface TeamPassNetworkResponse {
  team_id: number;
  tournament: string;
  match_id?: number | null;
  nodes: PassNetworkNode[];
  edges: PassNetworkEdge[];
}

export interface DefensiveEventItem {
  event_id: number;
  type: 'won_tackle' | 'lost_tackle' | 'interception' | 'clearance' | 'blocked_pass' | 'recovery' | 'foul';
  x: number;
  y: number;
  is_success: boolean;
  player_name: string;
  jersey: number | null;
}

export interface DefensiveSummary {
  total_events: number;
  won_tackles: number;
  lost_tackles: number;
  interceptions: number;
  clearances: number;
  blocked_passes: number;
  recoveries: number;
  high_recoveries: number;
  tackles_won_pct: number;
  fouls?: number;
}

export interface TeamDefensiveActionsResponse {
  team_id: number;
  tournament: string;
  match_id: number | null;
  block_height_pct: number;
  block_height_m: number;
  block_classification: string;
  summary: DefensiveSummary;
  events: DefensiveEventItem[];
}

export interface ShotItem {
  shot_id: number;
  minute: number | null;
  x: number;
  y: number;
  xg: number;
  result: 'goal' | 'saved' | 'miss' | 'blocked';
  body_part?: string | null;
  situation?: string | null;
  player_name: string;
  player_jersey?: number | null;
}

export interface ShotMapSummary {
  total_shots: number;
  goals: number;
  total_xg: number;
  xg_per_shot: number;
  shots_on_target: number;
  on_target_pct: number;
  xg_difference: number;
  shots_per_match?: number;
  xg_per_match?: number;
}

export interface TeamShotMapResponse {
  team_id: number;
  mode: 'for' | 'against';
  tournament: string;
  match_id: number | null;
  summary: ShotMapSummary;
  shots: ShotItem[];
}

export interface AttackZoneTopPlayer {
  name: string;
  actions_count: number;
}

export interface AttackZoneChannel {
  channel_id: 'left_flank' | 'left_half_space' | 'center' | 'right_half_space' | 'right_flank';
  channel_name: string;
  entries_count: number;
  share_pct: number;
  box_infiltrations: number;
  threat_xg: number;
  threat_pct: number;
  top_players: AttackZoneTopPlayer[];
}

export interface AttackZonesSummary {
  total_entries: number;
  box_entries_total: number;
  box_entry_conversion_pct: number;
  dominant_channel: string;
  most_dangerous_channel: string;
}

export interface TeamAttackZonesResponse {
  team_id: number;
  mode: 'for' | 'against';
  tournament: string;
  match_id: number | null;
  summary: AttackZonesSummary;
  channels: AttackZoneChannel[];
}

export type VenueFilter = 'all' | 'home' | 'away';
export type ContextFilter = 'all' | 'vs_elite' | 'vs_rest' | 'altitude' | 'sea_level';

export const teamsApi = {
  getAll: async (): Promise<TeamBase[]> => {
    const response = await apiClient.get(`/teams/`);
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
  getShotZones: async (teamId: number, tournament?: 'Apertura' | 'Clausura'): Promise<TeamShotZonesResponse> => {
    const url = tournament ? `/teams/${teamId}/shot-zones?tournament=${tournament}` : `/teams/${teamId}/shot-zones`;
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
  getPassNetwork: async (
    teamId: number,
    tournament?: 'Apertura' | 'Clausura' | 'all',
    matchId?: number | null,
    venue?: VenueFilter,
    contextFilter?: ContextFilter
  ): Promise<TeamPassNetworkResponse> => {
    const params = new URLSearchParams();
    if (tournament && tournament !== 'all') {
      params.append('tournament', tournament);
    }
    if (matchId) {
      params.append('match_id', matchId.toString());
    }
    if (venue && venue !== 'all') {
      params.append('venue', venue);
    }
    if (contextFilter && contextFilter !== 'all') {
      params.append('context_filter', contextFilter);
    }
    const queryString = params.toString();
    const url = queryString ? `/teams/${teamId}/pass-network?${queryString}` : `/teams/${teamId}/pass-network`;
    const response = await apiClient.get(url);
    return response.data;
  },
  getDefensiveActions: async (
    teamId: number,
    tournament: string = 'all',
    matchId?: number | null,
    venue?: VenueFilter,
    contextFilter?: ContextFilter
  ): Promise<TeamDefensiveActionsResponse> => {
    const params = new URLSearchParams();
    if (tournament && tournament !== 'all') {
      params.append('tournament', tournament);
    }
    if (matchId) {
      params.append('match_id', matchId.toString());
    }
    if (venue && venue !== 'all') {
      params.append('venue', venue);
    }
    if (contextFilter && contextFilter !== 'all') {
      params.append('context_filter', contextFilter);
    }
    const queryString = params.toString();
    const url = queryString
      ? `/teams/${teamId}/defensive-actions?${queryString}`
      : `/teams/${teamId}/defensive-actions`;
    const response = await apiClient.get(url);
    return response.data;
  },
  getShotMap: async (
    teamId: number,
    tournament?: string,
    matchId?: number | null,
    mode: 'for' | 'against' = 'for',
    venue?: VenueFilter,
    contextFilter?: ContextFilter
  ): Promise<TeamShotMapResponse> => {
    const params = new URLSearchParams();
    if (tournament && tournament !== 'all') {
      params.append('tournament', tournament);
    }
    if (matchId) {
      params.append('match_id', matchId.toString());
    }
    if (mode) {
      params.append('mode', mode);
    }
    if (venue && venue !== 'all') {
      params.append('venue', venue);
    }
    if (contextFilter && contextFilter !== 'all') {
      params.append('context_filter', contextFilter);
    }
    const queryString = params.toString();
    const url = queryString
      ? `/teams/${teamId}/shot-map?${queryString}`
      : `/teams/${teamId}/shot-map`;
    const response = await apiClient.get(url);
    return response.data;
  },
  getAttackZones: async (
    teamId: number,
    tournament?: string,
    matchId?: number | null,
    mode: 'for' | 'against' = 'for',
    venue?: VenueFilter,
    contextFilter?: ContextFilter
  ): Promise<TeamAttackZonesResponse> => {
    const params = new URLSearchParams();
    if (tournament && tournament !== 'all') {
      params.append('tournament', tournament);
    }
    if (matchId) {
      params.append('match_id', matchId.toString());
    }
    if (mode) {
      params.append('mode', mode);
    }
    if (venue && venue !== 'all') {
      params.append('venue', venue);
    }
    if (contextFilter && contextFilter !== 'all') {
      params.append('context_filter', contextFilter);
    }
    const queryString = params.toString();
    const url = queryString
      ? `/teams/${teamId}/attack-zones?${queryString}`
      : `/teams/${teamId}/attack-zones`;
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
  }
};

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
  over_8_5_corners: FrequencyCount;
  over_9_5_corners: FrequencyCount;
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

