import { apiClient } from './apiClient';
import type { VenueFilter, ContextFilter } from './teamsApi';

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

export const teamTacticalApi = {
  getShotZones: async (teamId: number, tournament?: 'Apertura' | 'Clausura'): Promise<TeamShotZonesResponse> => {
    const url = tournament ? `/teams/${teamId}/shot-zones?tournament=${tournament}` : `/teams/${teamId}/shot-zones`;
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
};
