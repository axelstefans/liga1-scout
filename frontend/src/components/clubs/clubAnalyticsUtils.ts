import { TeamMatchItem, TeamMetricEntry } from '../../services/api';
import { formatEditorialDate } from './MatchReportSheet01';

export function formatMatchSelectorLabel(m: TeamMatchItem, clubDisplayName: string): string {
  const roundPrefix = m.round ? `Fecha ${m.round}: ` : '';
  const homeName = m.is_home ? clubDisplayName : m.opponent_name;
  const awayName = m.is_home ? m.opponent_name : clubDisplayName;
  const homeScore = m.is_home ? (m.team_score ?? '—') : (m.opponent_score ?? '—');
  const awayScore = m.is_home ? (m.opponent_score ?? '—') : (m.team_score ?? '—');
  const venueCode = m.is_home ? 'L' : 'V';
  const datePart = m.date ? ` • ${formatEditorialDate(m.date)}` : '';
  return `${roundPrefix}${homeName} ${homeScore} – ${awayScore} ${awayName} (${venueCode})${datePart}`;
}

export interface EmptyTeamBaseInput {
  team_id: number;
  name: string;
  short_name: string | null;
  primary_color?: string | null;
  logo_url: string | null;
}

export const createEmptyTeam = (base: EmptyTeamBaseInput): TeamMetricEntry => ({
  team_id: base.team_id,
  name: base.name,
  short_name: base.short_name,
  primary_color: base.primary_color ?? null,
  logo_url: base.logo_url,
  matches_played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
  points_per_match: 0,
  goals_scored: 0,
  goals_conceded: 0,
  goal_difference: 0,
  total_shots: 0,
  shots_on_target: 0,
  shots_inside_box: 0,
  shots_outside_box: 0,
  xg: 0,
  npxg: 0,
  xg_per_shot: 0,
  goals_minus_xg: 0,
  conversion_rate_pct: 0,
  possession_pct: 0,
  passes_completed: 0,
  passes_total: 0,
  pass_accuracy_pct: 0,
  progressive_passes: 0,
  passes_into_final_third: 0,
  passes_into_box: 0,
  crosses_completed: 0,
  progressive_carries: 0,
  successful_dribbles: 0,
  field_tilt: 0,
  field_tilt_pct: 0,
  verticality_ratio_pct: 0,
  avg_shot_distance: 0,
  ppda: 0,
  high_recoveries: 0,
  defensive_actions: 0,
  tackles: 0,
  interceptions: 0,
  clearances: 0,
  shots_conceded: 0,
  shots_on_target_conceded: 0,
  shots_conceded_inside_box: 0,
  xga: 0,
  xgd: 0,
  defensive_resistance_ratio: 0,
  xg_per_match: 0,
  xga_per_match: 0,
  conversion_ratio: 0,
});
