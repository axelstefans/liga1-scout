export interface BeeswarmPoint {
  player_id: number;
  name: string;
  team_name: string;
  position?: string | null;
  position_group?: string | null;
  minutes_played?: number | null;
  age?: number | null;
  val: number;
  svgX: number;
  svgY: number;
  isTarget: boolean;
  percentile?: number;
}

export interface BeeswarmTick {
  val: number;
  x: number;
  label: string;
}

export interface BeeswarmStripData {
  key: string;
  label: string;
  minVal: number;
  maxVal: number;
  domainMin?: number;
  domainMax?: number;
  medianVal: number;
  p25Val: number;
  p75Val: number;
  targetVal: number | null;
  percentile: number;
  points: BeeswarmPoint[];
  targetPoint: BeeswarmPoint | null;
  ticks?: BeeswarmTick[];
  calibrated?: boolean;
}

export interface BeeswarmHoverState {
  player_id: number;
  name: string;
  team_name: string;
  position?: string | null;
  position_group?: string | null;
  minutes_played?: number | null;
  age?: number | null;
  val: number;
  metricLabel: string;
  metricKey: string;
  svgX: number;
  svgY: number;
  isTarget: boolean;
  percentile?: number;
}

export interface ScatterPoint {
  player_id: number;
  name: string;
  team_name: string;
  position: string | null;
  position_group: string | null;
  minutes_played: number;
  x: number;
  y: number;
  svgX: number;
  svgY: number;
  isTarget: boolean;
  age?: number | null;
}

export const SCATTER_CANVAS_WIDTH = 640;
export const SCATTER_CANVAS_HEIGHT = 540;
export const SCATTER_X_MIN = 60;
export const SCATTER_X_MAX = 610;
export const SCATTER_X_WIDTH = 550;
export const SCATTER_Y_BOTTOM = 490;
export const SCATTER_Y_TOP = 30;
export const SCATTER_Y_HEIGHT = 460;

export const DOM_X_MIN = 60;
export const DOM_X_MAX = 690;
export const DOM_WIDTH = DOM_X_MAX - DOM_X_MIN; // 630
export const DOM_SWARM_Y = 101;
export const DOM_AXIS_Y = 174;

export const PEER_RING_COLORS = [
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#0ea5e9', // sky-500
  '#8b5cf6', // purple-500
  '#ec4899', // pink-500
];

export function generateNiceTicks(start: number, stop: number, count = 6): number[] {
  const span = stop - start;
  if (span <= 0 || !isFinite(span)) return [start];
  const step = span / Math.max(1, count);
  const power = Math.floor(Math.log10(step));
  const error = step / Math.pow(10, power);
  let factor = 1;
  if (error >= Math.sqrt(50)) factor = 10;
  else if (error >= Math.sqrt(12.5)) factor = 5;
  else if (error >= Math.sqrt(5)) factor = 2.5;
  else if (error >= Math.sqrt(2)) factor = 2;
  else factor = 1;
  const niceStep = factor * Math.pow(10, power);
  const firstTick = Math.ceil(start / niceStep) * niceStep;
  const ticks: number[] = [];
  const eps = niceStep / 1000;
  for (let tick = firstTick; tick <= stop + eps; tick += niceStep) {
    const rounded = Math.abs(tick) < eps ? 0 : Number(tick.toFixed(6));
    if (rounded >= start - eps && rounded <= stop + eps) {
      ticks.push(rounded);
    }
  }
  return ticks;
}

export function formatScatterTickLabel(val: number, step: number): string {
  const precision = Math.abs(step - Math.round(step)) < 1e-6
    ? 0
    : Math.abs(step * 10 - Math.round(step * 10)) < 1e-6
      ? 1
      : 2;
  const zeroStr = precision === 0 ? '0' : (0).toFixed(precision);
  if (Math.abs(val) < 1e-9) return zeroStr;
  const isNeg = val < -1e-9;
  const absVal = Math.abs(val);
  const formatted = precision === 0 ? Math.round(absVal).toString() : absVal.toFixed(precision);
  if (parseFloat(formatted) === 0) return zeroStr;
  return isNeg ? `\u2212${formatted}` : formatted;
}
