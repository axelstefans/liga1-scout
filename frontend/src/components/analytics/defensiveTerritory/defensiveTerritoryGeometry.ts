import { DefensiveEventItem } from '../../../services/api';

export type ActionFilterType =
  | 'all'
  | 'tackle'
  | 'interception'
  | 'recovery'
  | 'clearance'
  | 'blocked_pass'
  | 'foul';

export interface Point2D {
  x: number;
  y: number;
}

export interface MappedDefensiveEvent {
  event: DefensiveEventItem;
  px: number;
  py: number;
}

export interface DefensiveCentroid {
  cx: number;
  cy: number;
  dispersion: number;
}

export interface TerritoryPolygon {
  points: Point2D[];
  pathD: string;
  area: number;
}

export const DEFENSIVE_PITCH_DIMENSIONS = {
  SVG_WIDTH: 960,
  SVG_HEIGHT: 560,
  PITCH_X: 50,
  PITCH_Y: 40,
  PITCH_WIDTH: 860,
  PITCH_HEIGHT: 440,
} as const;

export const ACTION_CONFIG: Record<
  string,
  {
    label: string;
    singular: string;
    color: string;
    strokeColor: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
  }
> = {
  won_tackle: {
    label: 'Entrada Ganada',
    singular: 'Entrada Ganada',
    color: '#93C5FD',
    strokeColor: '#2563EB',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  lost_tackle: {
    label: 'Entrada Perdida',
    singular: 'Entrada Perdida',
    color: '#FB923C',
    strokeColor: '#EA580C',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
  },
  interception: {
    label: 'Intercepciones',
    singular: 'Intercepción',
    color: '#22C55E',
    strokeColor: '#15803D',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  clearance: {
    label: 'Despejes',
    singular: 'Despeje',
    color: '#D1D5DB',
    strokeColor: '#4B5563',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-300',
  },
  blocked_pass: {
    label: 'Bloqueos',
    singular: 'Bloqueo de pase',
    color: '#F3F4F6',
    strokeColor: '#6B7280',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
  },
  recovery: {
    label: 'Recuperaciones',
    singular: 'Recuperación',
    color: '#9CA3AF',
    strokeColor: '#9CA3AF',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
    borderColor: 'border-slate-200',
  },
  foul: {
    label: 'Faltas',
    singular: 'Falta cometida',
    color: '#FDA4AF',
    strokeColor: '#E11D48',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
  },
};

export const FILTER_CATEGORIES = [
  { key: 'tackle', label: 'Entradas', shapeType: 'won_tackle', color: '#93C5FD', bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
  { key: 'interception', label: 'Intercepciones', shapeType: 'interception', color: '#22C55E', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
  { key: 'recovery', label: 'Recuperaciones', shapeType: 'recovery', color: '#9CA3AF', bgColor: 'bg-slate-100', textColor: 'text-slate-600', borderColor: 'border-slate-200' },
  { key: 'clearance', label: 'Despejes', shapeType: 'clearance', color: '#D1D5DB', bgColor: 'bg-slate-100', textColor: 'text-slate-700', borderColor: 'border-slate-300' },
  { key: 'blocked_pass', label: 'Bloqueos', shapeType: 'blocked_pass', color: '#F3F4F6', bgColor: 'bg-slate-100', textColor: 'text-slate-700', borderColor: 'border-slate-200' },
  { key: 'foul', label: 'Faltas', shapeType: 'foul', color: '#FDA4AF', bgColor: 'bg-rose-50', textColor: 'text-rose-700', borderColor: 'border-rose-200' },
] as const;

export const LAYER_PRIORITY: Record<string, number> = {
  recovery: 1,      // bottom layer
  clearance: 2,     // bottom layer
  foul: 3,          // middle layer
  blocked_pass: 4,  // middle layer
  lost_tackle: 5,   // upper middle
  interception: 6,  // top layer
  won_tackle: 7,    // top layer
};

/**
 * Maps normalized Opta 0-100 coordinates to SVG canvas coordinates for horizontal pitch (left to right).
 */
export function mapOptaToSvg(
  x: number,
  y: number,
  dimensions = DEFENSIVE_PITCH_DIMENSIONS
): { px: number; py: number } {
  const clampedX = Math.max(0, Math.min(100, x));
  const clampedY = Math.max(0, Math.min(100, y));

  const svgX = dimensions.PITCH_X + (clampedX / 100) * dimensions.PITCH_WIDTH;
  const svgY = dimensions.PITCH_Y + (clampedY / 100) * dimensions.PITCH_HEIGHT;

  return {
    px: Math.max(dimensions.PITCH_X + 6, Math.min(dimensions.PITCH_X + dimensions.PITCH_WIDTH - 6, svgX)),
    py: Math.max(dimensions.PITCH_Y + 6, Math.min(dimensions.PITCH_Y + dimensions.PITCH_HEIGHT - 6, svgY)),
  };
}

/**
 * Calculates the X-coordinate for the defensive line of engagement (block height).
 */
export function computeBlockHeightLineX(
  blockHeightPct: number,
  dimensions = DEFENSIVE_PITCH_DIMENSIONS
): number {
  const clampedPct = Math.max(0, Math.min(100, blockHeightPct));
  return dimensions.PITCH_X + (clampedPct / 100) * dimensions.PITCH_WIDTH;
}

/**
 * Computes centroid and spatial dispersion (standard distance) of defensive action coordinates.
 */
export function computeDefensiveCentroid(points: Point2D[]): DefensiveCentroid | null {
  if (points.length === 0) return null;

  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }

  const cx = sumX / points.length;
  const cy = sumY / points.length;

  let sumSqDist = 0;
  for (const p of points) {
    sumSqDist += Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2);
  }
  const dispersion = Math.sqrt(sumSqDist / points.length);

  return { cx, cy, dispersion };
}

/**
 * Computes 2D Convex Hull using Andrew's Monotone Chain algorithm (O(n log n)).
 */
export function computeConvexHull(points: Point2D[]): Point2D[] {
  if (points.length <= 2) return [...points];

  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

  const cross = (o: Point2D, a: Point2D, b: Point2D) => {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  };

  const lower: Point2D[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point2D[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Converts a list of 2D points into an SVG polygon path data string.
 */
export function pointsToSvgPath(points: Point2D[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)} ` +
    rest.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
    ' Z';
}
