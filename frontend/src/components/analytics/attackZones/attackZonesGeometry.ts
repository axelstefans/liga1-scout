import {
  AttackZoneChannel,
  AttackZonesSummary,
  TeamMatchItem,
  TeamMetricEntry,
} from '../../../services/api';
import { formatOptaName } from '../../../utils/playerFormatters';

export type AttackZoneMode = 'for' | 'against';
export type AttackZonesViewMode = 'cumulative' | 'match';
export type AttackZoneChannelId =
  | 'left_flank'
  | 'left_half_space'
  | 'center'
  | 'right_half_space'
  | 'right_flank';

export type AttackZoneData = AttackZoneChannel;
export type ZoneMetricSummary = AttackZonesSummary;

export interface AttackZoneDimensions {
  SVG_WIDTH: number;
  SVG_HEIGHT: number;
  PITCH_X: number;
  PITCH_Y: number;
  PITCH_WIDTH: number;
  PITCH_HEIGHT: number;
  MIDFIELD_Y: number;
  FINAL_THIRD_Y: number;
  LANE_WIDTH: number;
}

export interface AttackZoneConfigItem {
  id: AttackZoneChannelId;
  name: string;
  abbr: string;
}

export interface FlankDistribution {
  leftPct: number;
  centerPct: number;
  rightPct: number;
  leftEntries: number;
  centerEntries: number;
  rightEntries: number;
}

export interface LaneGeometryRect {
  channelId: AttackZoneChannelId;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
}

export const ATTACK_ZONES_PITCH_DIMENSIONS: AttackZoneDimensions = {
  SVG_WIDTH: 540,
  SVG_HEIGHT: 500,
  PITCH_X: 45,
  PITCH_Y: 40,
  PITCH_WIDTH: 450,
  PITCH_HEIGHT: 410,
  MIDFIELD_Y: 450,
  FINAL_THIRD_Y: 327, // depth: 287px (corresponds to x >= 65%)
  LANE_WIDTH: 90,
};

export const CHANNEL_CONFIG: readonly AttackZoneConfigItem[] = [
  { id: 'left_flank', name: 'Banda Izquierda', abbr: 'Banda Izq.' },
  { id: 'left_half_space', name: 'Medio-Espacio Izquierdo', abbr: 'M.E. Izq.' },
  { id: 'center', name: 'Carril Central', abbr: 'Centro' },
  { id: 'right_half_space', name: 'Medio-Espacio Derecho', abbr: 'M.E. Der.' },
  { id: 'right_flank', name: 'Banda Derecha', abbr: 'Banda Der.' },
] as const;

export const CHANNEL_NAME_MAP: Record<string, string> = {
  left_flank: 'Banda Izquierda',
  left_half_space: 'Medio-Espacio Izquierdo',
  center: 'Carril Central',
  right_half_space: 'Medio-Espacio Derecho',
  right_flank: 'Banda Derecha',
};

/**
 * Computes SVG bounding box coordinates for each of the 5 vertical attacking channels.
 */
export function getLaneGeometry(
  idx: number,
  channelId: AttackZoneChannelId,
  dimensions: AttackZoneDimensions = ATTACK_ZONES_PITCH_DIMENSIONS
): LaneGeometryRect {
  const x = dimensions.PITCH_X + idx * dimensions.LANE_WIDTH;
  return {
    channelId,
    x,
    y: dimensions.PITCH_Y,
    width: dimensions.LANE_WIDTH,
    height: dimensions.FINAL_THIRD_Y - dimensions.PITCH_Y,
    centerX: x + dimensions.LANE_WIDTH / 2,
  };
}

/**
 * Computes coropleth heatmap fill opacity proportional to channel share volume.
 */
export function computeChannelHeatmapOpacity(
  sharePct: number,
  maxShare: number,
  isHovered: boolean
): number {
  const safeMax = Math.max(maxShare, 1);
  const baseOpacity = 0.06 + (sharePct / safeMax) * 0.38;
  return isHovered ? Math.min(0.7, baseOpacity + 0.18) : baseOpacity;
}

/**
 * Returns heatmap intensity color token based on relative share intensity.
 */
export function getHeatmapIntensityColor(sharePct: number, maxShare: number): string {
  const ratio = sharePct / Math.max(maxShare, 1);
  if (ratio >= 0.85) return '#C2410C';
  if (ratio >= 0.55) return '#EA580C';
  return '#C2410C';
}

/**
 * Computes box infiltration effectiveness (%) for a given channel.
 */
export function computeBoxInfiltrationPct(entriesCount: number, boxInfiltrations: number): number {
  if (!entriesCount || entriesCount <= 0) return 0;
  return Number(((boxInfiltrations / entriesCount) * 100).toFixed(1));
}

/**
 * Aggregates the 5 tactical channels into 3 macro spatial corridors (Left Flank, Center, Right Flank).
 */
export function computeFlankDistribution(channels: AttackZoneData[]): FlankDistribution {
  const map = new Map<string, AttackZoneData>();
  channels.forEach((c) => map.set(c.channel_id, c));

  const leftFlank = map.get('left_flank');
  const leftHalf = map.get('left_half_space');
  const center = map.get('center');
  const rightHalf = map.get('right_half_space');
  const rightFlank = map.get('right_flank');

  const leftPct = Number(((leftFlank?.share_pct ?? 0) + (leftHalf?.share_pct ?? 0)).toFixed(1));
  const centerPct = Number((center?.share_pct ?? 0).toFixed(1));
  const rightPct = Number(((rightHalf?.share_pct ?? 0) + (rightFlank?.share_pct ?? 0)).toFixed(1));

  const leftEntries = (leftFlank?.entries_count ?? 0) + (leftHalf?.entries_count ?? 0);
  const centerEntries = center?.entries_count ?? 0;
  const rightEntries = (rightHalf?.entries_count ?? 0) + (rightFlank?.entries_count ?? 0);

  return {
    leftPct,
    centerPct,
    rightPct,
    leftEntries,
    centerEntries,
    rightEntries,
  };
}

/**
 * Builds structured plain-text summary for clipboard / LLM tactical ingestion.
 */
export function buildAttackZonesSummaryText(params: {
  activeTeam: TeamMetricEntry;
  mode: AttackZoneMode;
  viewMode: AttackZonesViewMode;
  tournament: string;
  activeMatch: TeamMatchItem | null;
  summary: ZoneMetricSummary;
  channelDataMap: Map<string, AttackZoneData>;
}): string {
  const { activeTeam, mode, viewMode, tournament, activeMatch, summary, channelDataMap } = params;
  const isCumulative = viewMode === 'cumulative';
  const matchesCount = activeTeam.matches_played;
  const dominantName = CHANNEL_NAME_MAP[summary.dominant_channel] || summary.dominant_channel;
  const dangerousName = CHANNEL_NAME_MAP[summary.most_dangerous_channel] || summary.most_dangerous_channel;

  const channelRows = CHANNEL_CONFIG.map((cfg) => {
    const c = channelDataMap.get(cfg.id) || {
      share_pct: 0,
      entries_count: 0,
      box_infiltrations: 0,
      threat_xg: 0,
      threat_pct: 0,
      top_players: [],
    };
    const prefix = mode === 'for' ? 'xG' : 'xGA';
    return `- ${cfg.name}: ${c.share_pct}% vol (${c.entries_count} ent, ${c.box_infiltrations} al área) | ${prefix} ${c.threat_xg.toFixed(2)} (${c.threat_pct}%)`;
  }).join('\n');

  const topPlayersSummary = CHANNEL_CONFIG.map((cfg) => {
    const c = channelDataMap.get(cfg.id);
    const players =
      c?.top_players && c.top_players.length > 0
        ? c.top_players.map((p) => `${formatOptaName(p.name)} (${p.actions_count} act.)`).join(', ')
        : 'Sin datos';
    return `${cfg.abbr}: ${players}`;
  }).join(' | ');

  const scopeHeader = isCumulative
    ? `Alcance: ${tournament === 'all' ? 'Temporada Completa 2026' : tournament + ' 2026'} | Muestra: ${matchesCount} PJ`
    : activeMatch
    ? `Partido: ${activeMatch.label} | ${activeMatch.is_home ? 'Local' : 'Visita'} | ${activeMatch.team_score ?? '-'}-${activeMatch.opponent_score ?? '-'} | Rival: ${activeMatch.opponent_name}`
    : 'Partido: Individual';

  const dangerousLabel = mode === 'for' ? 'Más Peligroso' : 'Más Vulnerable';

  const lines = [
    `CANALES DE ATAQUE E INFILTRACIÓN | ${mode === 'for' ? `A FAVOR (ataque de ${activeTeam.name})` : `CONCEDIDOS (incursiones rivales contra ${activeTeam.name})`}`,
    scopeHeader,
    `Volumen Total: ${summary.total_entries} entradas | ${summary.box_entries_total} al área (${summary.box_entry_conversion_pct}% efectividad)`,
    `Carril Dominante: ${dominantName} | Carril ${dangerousLabel}: ${dangerousName}`,
    `Desglose por Carriles:\n${channelRows}`,
    `Principales Actores por Carril: ${topPlayersSummary}`,
  ];

  if (!isCumulative) {
    lines.push('Nota: datos de un solo partido, evaluar tendencias en muestra acumulada.');
  }

  return lines.join('\n');
}
