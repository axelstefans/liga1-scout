export type TournamentFilter = 'all' | 'Apertura' | 'Clausura';
export type ClubViewMode = 'general' | 'match_report';
export type MatchReportSheetId = '01' | '02' | '03';

export interface MatchReportSheetDef {
  id: MatchReportSheetId;
  label: string;
  subtitle: string;
  disabled?: boolean;
}

export const MATCH_REPORT_SHEETS: MatchReportSheetDef[] = [
  { id: '01', label: '01 · Ocasiones & xG', subtitle: 'The result and the chances' },
  { id: '02', label: '02 · Construcción', subtitle: 'Build-up and box access' },
  { id: '03', label: '03 · Data Hub', subtitle: 'Pressing and turnovers' },
];

export type ChartId = 'radar' | 'pass_network' | 'shot_map' | 'attack_zones' | 'defensive_actions';

export interface ChartConfig {
  id: ChartId;
  label: string;
  floor: 1 | 2;
  defaultActive: boolean;
}

export const AVAILABLE_CHARTS: ChartConfig[] = [
  { id: 'radar', label: 'Perfil de Estilo Táctico', floor: 1, defaultActive: true },
  { id: 'pass_network', label: 'Red de Pases', floor: 1, defaultActive: true },
  { id: 'shot_map', label: 'Mapa de Tiros xG', floor: 1, defaultActive: true },
  { id: 'attack_zones', label: 'Zonas de Infiltración', floor: 2, defaultActive: false },
  { id: 'defensive_actions', label: 'Acciones Defensivas', floor: 2, defaultActive: false },
];
