import type { MatchSheetShotItem } from '../../../services/api';

// Regulation full-pitch geometry (attacks ->)
export const SHOT_MAP_VB_W = 460;
export const SHOT_MAP_VB_H = 264;
export const FP_LEFT = 18;
export const FP_TOP = 12;
export const FP_W = 424;
export const FP_H = 240;
export const FP_RIGHT = FP_LEFT + FP_W;
export const FP_BOTTOM = FP_TOP + FP_H;
export const FP_CENTER_X = FP_LEFT + FP_W / 2;
export const FP_CENTER_Y = FP_TOP + FP_H / 2;

// Aliases for compatibility
export const HP_LEFT = FP_LEFT;
export const HP_TOP = FP_TOP;
export const HP_W = FP_W;
export const HP_H = FP_H;

export const FP_PEN_DIST = (11.0 / 105.0) * FP_W;
export const FP_BOX_LEN = (16.5 / 105.0) * FP_W;
export const FP_BOX_WID = (40.32 / 68.0) * FP_H;
export const FP_BOX_Y = FP_CENTER_Y - FP_BOX_WID / 2;
export const FP_SIX_LEN = (5.5 / 105.0) * FP_W;
export const FP_SIX_WID = (18.32 / 68.0) * FP_H;
export const FP_SIX_Y = FP_CENTER_Y - FP_SIX_WID / 2;
export const FP_CIRCLE_R = (9.15 / 105.0) * FP_W;
export const FP_GOAL_WID = (7.32 / 68.0) * FP_H;
export const FP_GOAL_Y = FP_CENTER_Y - FP_GOAL_WID / 2;
export const FP_ARC_DX = FP_BOX_LEN - FP_PEN_DIST;
export const FP_ARC_DY = Math.sqrt(Math.max(0, FP_CIRCLE_R * FP_CIRCLE_R - FP_ARC_DX * FP_ARC_DX));

export interface MappedShotBubble {
  shot: MatchSheetShotItem;
  px: number;
  py: number;
  r: number;
}

/**
 * Computes anti-collision horizontal & vertical label offsets for Module 05 stage markers.
 */
export function resolveM05LabelOffset(
  y: number,
  oppY: number | null,
  axisY: number,
  isAway: boolean
): { labelOffsetX: number; labelOffsetY: number } {
  const isCollisionRisk = oppY !== null && Math.abs(y - oppY) < 14;
  if (isCollisionRisk && oppY !== null) {
    if (y < oppY) {
      return { labelOffsetY: -8, labelOffsetX: isAway ? 7 : -7 };
    }
    if (y > oppY) {
      return { labelOffsetY: 13, labelOffsetX: isAway ? 7 : -7 };
    }
    return { labelOffsetY: isAway ? 13 : -8, labelOffsetX: isAway ? 8 : -8 };
  }
  return {
    labelOffsetY: isAway ? (y > axisY - 16 ? -8 : 12) : -7,
    labelOffsetX: isAway ? 7 : -7,
  };
}

/**
 * Computes anti-overlap glyph & numeric label coordinates for Module 06 dumbbell pairs.
 */
export function resolveM06DumbbellCoords(
  homeVal: number,
  awayVal: number,
  hx: number,
  ax: number
): {
  renderHx: number;
  renderAx: number;
  labelHx: number;
  labelAx: number;
} {
  const delta = ax - hx;
  let renderHx = hx;
  let renderAx = ax;

  if (Math.abs(delta) < 9) {
    const shift = (9 - Math.abs(delta)) / 2;
    renderHx = hx - (delta >= 0 ? shift : -shift);
    renderAx = ax + (delta >= 0 ? shift : -shift);
  }

  let labelHx = renderHx;
  let labelAx = renderAx;
  if (Math.abs(delta) < 12) {
    if (homeVal < awayVal) {
      labelHx = renderHx - 3;
      labelAx = renderAx + 3;
    } else if (homeVal > awayVal) {
      labelHx = renderHx + 3;
      labelAx = renderAx - 3;
    } else {
      labelHx = renderHx - 4;
      labelAx = renderAx + 4;
    }
  }

  return { renderHx, renderAx, labelHx, labelAx };
}
