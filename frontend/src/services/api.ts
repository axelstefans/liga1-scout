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
  assists: number | null;
  rating: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  shots_on_target: number | null;
  successful_dribbles: number | null;
  accurate_passes_percentage: number | null;
  ground_duels_won_percentage: number | null;
  aerial_duels_won: number | null;
  key_passes: number | null;
  interceptions: number | null;
  tackles: number | null;
  saves: number | null;
  clean_sheets: number | null;
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

export interface PlayerDefendingStats {
  defensive_actions: PlayerDefensiveAction[];
  dribbles: PlayerDribble[];
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
};

export const rankingsApi = {
  getTopPlayers: async (stat: string, limit: number = 100): Promise<PlayerRankingEntry[]> => {
    const response = await apiClient.get(`/rankings/players?stat=${stat}&limit=${limit}`);
    return response.data;
  }
};

export const teamsApi = {
  getAll: async (): Promise<TeamBase[]> => {
    const response = await apiClient.get(`/teams/`);
    return response.data;
  },
  getNextMatch: async (teamId: number): Promise<TeamNextMatch> => {
    const response = await apiClient.get(`/teams/${teamId}/next-match`);
    return response.data;
  }
};

export interface PredictionResponse {
  projected_goals: {
    home: number;
    away: number;
  };
  match_winner_odds: {
    home: number;
    draw: number;
    away: number;
  };
  over_under_25_odds: {
    over: number;
    under: number;
  };
  probabilities_percent: {
    home: number;
    draw: number;
    away: number;
    over_25: number;
    under_25: number;
  };
}

export const simulateMatch = async (homeTeam: string, awayTeam: string, homeCustomXg?: number, awayCustomXg?: number): Promise<PredictionResponse> => {
  const response = await apiClient.post('/predictions/simulate', {
    home_team: homeTeam,
    away_team: awayTeam,
    home_custom_xg: homeCustomXg,
    away_custom_xg: awayCustomXg
  });
  return response.data;
};

export interface PlayerPredictionStat {
  player_id: number;
  player_name: string;
  position: string | null;
  total_minutes: number;
  total_xg: number;
  xg90: number;
}

export const fetchTeamRoster = async (teamName: string): Promise<PlayerPredictionStat[]> => {
  const response = await apiClient.get(`/predictions/roster?team_name=${encodeURIComponent(teamName)}`);
  return response.data;
};
