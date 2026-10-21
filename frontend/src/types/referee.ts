export interface TeamRef {
  id: number;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
}

export interface YellowCardsSplit {
  total: number;
  first_half: number;
  second_half: number;
}

export interface RefereeSummary {
  referee_id: number;
  name: string;
  slug?: string | null;
  country: string;
  matches_count: number;
  yellow_cards_total: number;
  yellow_cards_avg: number;
  red_cards_total: number;
  red_cards_avg: number;
  cards_avg: number;
  penalties_total: number;
  penalties_avg: number;
  fouls_avg: number;
  over_4_5_cards_pct: number;
  home_cards_pct: number;
}

export interface RefereeMatchItem {
  match_id: number;
  date: string;
  tournament: string;
  round?: number | null;
  home_team: TeamRef;
  away_team: TeamRef;
  home_score: number;
  away_score: number;
  yellow_cards: number;
  yellow_cards_split?: YellowCardsSplit | null;
  red_cards: number;
  fouls: number;
  penalties: number;
  over_4_5_cards: boolean;
}

export interface RefereeDetailResponse {
  referee: RefereeSummary;
  recent_matches: RefereeMatchItem[];
  total_matches: number;
}
