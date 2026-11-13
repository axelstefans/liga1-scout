import { ShotItem } from '../../../services/api';

export type ShotMode = 'for' | 'against';
export type ResultFilterType = 'all' | 'goal' | 'saved' | 'blocked' | 'miss';

export interface ShotPitchDimensions {
  SVG_WIDTH: number;
  SVG_HEIGHT: number;
  PITCH_X: number;
  PITCH_Y: number;
  PITCH_WIDTH: number;
  PITCH_HEIGHT: number;
}

export interface MappedShotItem {
  shot: ShotItem;
  px: number;
  py: number;
  radius: number;
}

export interface ShotSummaryStats {
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

export interface ShotCounts {
  all: number;
  goal: number;
  saved: number;
  blocked: number;
  miss: number;
}

export const SHOT_PITCH_DIMENSIONS: ShotPitchDimensions = {
  SVG_WIDTH: 540,
  SVG_HEIGHT: 480,
  PITCH_X: 45,
  PITCH_Y: 35,
  PITCH_WIDTH: 450,
  PITCH_HEIGHT: 380,
};

export const RESULT_CONFIG: Record<
  string,
  {
    label: string;
    singular: string;
    fill: string;
    stroke: string;
    strokeWidth: number;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  goal: {
    label: 'Goles',
    singular: 'Gol',
    fill: '#10B981',
    stroke: '#065F46',
    strokeWidth: 2.5,
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
  },
  saved: {
    label: 'Atajados',
    singular: 'Atajado',
    fill: '#3B82F6',
    stroke: '#1D4ED8',
    strokeWidth: 1.5,
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
  },
  miss: {
    label: 'Desviados',
    singular: 'Desviado (Fuera)',
    fill: 'none',
    stroke: '#EF4444',
    strokeWidth: 1.8,
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
  },
  blocked: {
    label: 'Bloqueados',
    singular: 'Bloqueado',
    fill: '#94A3B8',
    stroke: '#475569',
    strokeWidth: 1.2,
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300',
  },
};

export const SITUATION_LABELS: Record<string, string> = {
  open_play: 'Jugada abierta',
  set_piece: 'Balón parado',
  corner: 'Tiro de esquina',
  penalty: 'Penal',
  fast_break: 'Contraataque',
};

export const BODY_PART_LABELS: Record<string, string> = {
  right_foot: 'Pie derecho',
  left_foot: 'Pie izquierdo',
  head: 'Cabeza',
  other: 'Otro',
};

export const SHOT_LAYER_PRIORITY: Record<string, number> = {
  blocked: 1,
  miss: 2,
  saved: 3,
  goal: 4,
};

/**
 * Rounds a floating point number to a given number of decimals.
 */
export function roundDecimals(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Calculates bubble radius proportional to xG with adaptive density:
 * - Single fixture: standard scale (4.0 to 17px)
 * - Cumulative tournament (>80 shots): scaled down (3.5 to 11px) to prevent clutter
 * - Minimum radius is 3.5px so low-xG events don't disappear
 */
export function getShotRadius(xg: number, isCumulative: boolean): number {
  return isCumulative
    ? Math.max(3.5, Math.min(11, Math.sqrt(Math.max(0, xg)) * 16))
    : Math.max(4.0, Math.min(17, Math.sqrt(Math.max(0, xg)) * 24));
}

/**
 * Maps single shot coordinates to vertical attacking half pitch SVG canvas (midfield at bottom, goal at top).
 */
export function mapShotCoordinates(
  shot: ShotItem,
  isCumulative: boolean,
  dimensions = SHOT_PITCH_DIMENSIONS
): MappedShotItem {
  const clampedX = Math.max(48, Math.min(100, shot.x));
  const clampedY = Math.max(0, Math.min(100, shot.y));

  const svgX = dimensions.PITCH_X + (clampedY / 100) * dimensions.PITCH_WIDTH;
  const svgY = dimensions.PITCH_Y + ((100 - clampedX) / 50) * dimensions.PITCH_HEIGHT;
  const radius = getShotRadius(shot.xg, isCumulative);

  return {
    shot,
    px: Math.max(dimensions.PITCH_X + radius, Math.min(dimensions.PITCH_X + dimensions.PITCH_WIDTH - radius, svgX)),
    py: Math.max(dimensions.PITCH_Y + radius, Math.min(dimensions.PITCH_Y + dimensions.PITCH_HEIGHT - radius, svgY)),
    radius,
  };
}

/**
 * Applies anti-collision jitter to overlapping goal markers so both emerald halos remain visible.
 */
export function applyGoalJitter(mappedList: MappedShotItem[]): MappedShotItem[] {
  const list = [...mappedList];
  const goalIndices: number[] = [];

  for (let i = 0; i < list.length; i++) {
    if (list[i].shot.result === 'goal') {
      goalIndices.push(i);
    }
  }

  for (let i = 0; i < goalIndices.length; i++) {
    for (let j = i + 1; j < goalIndices.length; j++) {
      const idx1 = goalIndices[i];
      const idx2 = goalIndices[j];
      const g1 = list[idx1];
      const g2 = list[idx2];
      const dx = g2.px - g1.px;
      const dy = g2.py - g1.py;
      const dist = Math.hypot(dx, dy);

      if (dist < 8) {
        const angle = dist > 0.001 ? Math.atan2(dy, dx) : (Math.PI / 4) * (i + 1);
        const perpAngle = angle + Math.PI / 2;
        const offset = 3;

        list[idx1] = {
          ...g1,
          px: g1.px - Math.cos(perpAngle) * (offset / 2),
          py: g1.py - Math.sin(perpAngle) * (offset / 2),
        };
        list[idx2] = {
          ...g2,
          px: g2.px + Math.cos(perpAngle) * (offset / 2),
          py: g2.py + Math.sin(perpAngle) * (offset / 2),
        };
      }
    }
  }

  return list;
}

/**
 * Maps all shots, applies jitter, and returns transformed list.
 */
export function mapAndJitterShots(
  shots: ShotItem[],
  isCumulative: boolean,
  dimensions = SHOT_PITCH_DIMENSIONS
): MappedShotItem[] {
  const mapped = shots.map((s) => mapShotCoordinates(s, isCumulative, dimensions));
  return applyGoalJitter(mapped);
}

/**
 * Sorts mapped shots by tactical layer priority: goals on top, hovered shot on absolute top.
 */
export function sortShotsByPriority(
  mappedShots: MappedShotItem[],
  hoveredShotId?: number | null
): MappedShotItem[] {
  return [...mappedShots].sort((a, b) => {
    if (hoveredShotId === a.shot.shot_id) return 1;
    if (hoveredShotId === b.shot.shot_id) return -1;
    return (SHOT_LAYER_PRIORITY[a.shot.result] || 0) - (SHOT_LAYER_PRIORITY[b.shot.result] || 0);
  });
}

/**
 * Computes reactive KPI summary when filtered by player or scope.
 */
export function computeActiveSummary(
  playerShots: ShotItem[],
  selectedPlayer: string,
  fallbackSummary: ShotSummaryStats | undefined,
  matchesCount: number = 1
): ShotSummaryStats {
  if (selectedPlayer === 'all') {
    return (
      fallbackSummary || {
        total_shots: 0,
        goals: 0,
        total_xg: 0,
        xg_per_shot: 0,
        shots_on_target: 0,
        on_target_pct: 0,
        xg_difference: 0,
        shots_per_match: 0,
        xg_per_match: 0,
      }
    );
  }

  const total_shots = playerShots.length;
  const goals = playerShots.filter((s) => s.result === 'goal').length;
  const total_xg = roundDecimals(playerShots.reduce((acc, s) => acc + s.xg, 0), 2);
  const xg_per_shot = total_shots > 0 ? roundDecimals(total_xg / total_shots, 2) : 0;
  const shots_on_target = playerShots.filter((s) => s.result === 'goal' || s.result === 'saved').length;
  const on_target_pct = total_shots > 0 ? roundDecimals((shots_on_target / total_shots) * 100, 1) : 0;
  const xg_difference = roundDecimals(goals - total_xg, 2);

  const shots_per_match = roundDecimals(total_shots / matchesCount, 1);
  const xg_per_match = roundDecimals(total_xg / matchesCount, 2);

  return {
    total_shots,
    goals,
    total_xg,
    xg_per_shot,
    shots_on_target,
    on_target_pct,
    xg_difference,
    shots_per_match,
    xg_per_match,
  };
}
