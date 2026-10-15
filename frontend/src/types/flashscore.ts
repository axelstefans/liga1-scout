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
  matches_analyzed: number;
  periods: {
    '1T': FlashscorePeriodStats;
    '2T': FlashscorePeriodStats;
    'ALL': FlashscorePeriodStats;
  };
  goalkeeper_efficiency: FlashscoreGoalkeeperEfficiency;
}
