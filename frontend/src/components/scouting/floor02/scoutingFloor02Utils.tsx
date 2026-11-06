import React from 'react';

export interface ChanceEvent {
  id: number | string;
  x_start: number;
  y_start: number;
  x_end: number;
  y_end: number;
  type: 'Open Play' | 'Cross' | 'Set Play';
  isAssist?: boolean;
  xa: number;
  recipient?: string;
}

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0,
  };
};

/**
 * Shared Pitch Markings for Attacking Half-Pitch (viewBox -1 -2.5 70 56)
 */
export const AttackingHalfPitchMarkings: React.FC = () => (
  <>
    {/* Pitch boundary */}
    <rect x="0" y="0" width="68" height="52.5" fill="#f5f7f4" stroke="#363835" strokeWidth="0.28" />
    {/* Penalty Box (16.5m deep x 40.32m wide, centered at X = 34) */}
    <rect x="13.84" y="0" width="40.32" height="16.5" fill="none" stroke="#363835" strokeWidth="0.28" />
    {/* Six-Yard Box (5.5m deep x 18.32m wide, centered at X = 34) */}
    <rect x="24.84" y="0" width="18.32" height="5.5" fill="none" stroke="#363835" strokeWidth="0.28" />
    {/* Penalty Spot (11m from goal) */}
    <circle cx="34" cy="11.0" r="0.45" fill="#363835" />
    {/* Penalty Arc (radius 9.15m centered at 34, 11) */}
    <path d="M 27.2 16.5 A 9.15 9.15 0 0 0 40.8 16.5" fill="none" stroke="#363835" strokeWidth="0.28" />
    {/* Halfway line across bottom (Y = 52.5) */}
    <line x1="0" y1="52.5" x2="68" y2="52.5" stroke="#363835" strokeWidth="0.28" />
    {/* Center circle arc (radius 9.15m centered at 34, 52.5) */}
    <path d="M 24.85 52.5 A 9.15 9.15 0 0 1 43.15 52.5" fill="none" stroke="#363835" strokeWidth="0.28" />
    <circle cx="34" cy="52.5" r="0.45" fill="#363835" />
    {/* Attacking goal outline centered along Y = 0 */}
    <rect x="30.34" y="-1.8" width="7.32" height="1.8" fill="none" stroke="#363835" strokeWidth="0.28" />
    {/* Corner arcs */}
    <path d="M 0 2 A 2 2 0 0 1 2 0" fill="none" stroke="#363835" strokeWidth="0.28" />
    <path d="M 66 0 A 2 2 0 0 1 68 2" fill="none" stroke="#363835" strokeWidth="0.28" />
  </>
);

/**
 * Shared Pitch Markings for Full Pitch (viewBox 0 0 68 105)
 */
export const FullPitchMarkings: React.FC = () => (
  <g stroke="#363835" strokeWidth="0.28" fill="none" pointerEvents="none">
    {/* Boundary: 68m x 105m */}
    <rect x="0" y="0" width="68" height="105" />
    {/* Midfield center line (Y = 52.5) and center circle (r = 9.15m) */}
    <line x1="0" y1="52.5" x2="68" y2="52.5" />
    <circle cx="34" cy="52.5" r="6.5" />
    <circle cx="34" cy="52.5" r="0.45" fill="#363835" />
    {/* Attacking Penalty Area & Six-Yard Box (Top, Y = 0) */}
    <rect x="13.84" y="0" width="40.32" height="16.5" />
    <rect x="24.84" y="0" width="18.32" height="5.5" />
    <path d="M 27.2 16.5 A 9.15 9.15 0 0 0 40.8 16.5" />
    {/* Defending Penalty Area & Six-Yard Box (Bottom, Y = 105) */}
    <rect x="13.84" y="88.5" width="40.32" height="16.5" />
    <rect x="24.84" y="99.5" width="18.32" height="5.5" />
    <path d="M 27.2 88.5 A 9.15 9.15 0 0 1 40.8 88.5" />
  </g>
);
