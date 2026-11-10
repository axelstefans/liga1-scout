import React from 'react';

export type PitchOrientation = 'vertical' | 'horizontal';
export type PitchTheme = 'light' | 'dark' | 'tactical-dark' | 'warm-ivory';

export interface PitchThemeConfig {
  bg: string;
  line: string;
  outerStroke: string;
  outerRx: number;
}

export const PITCH_THEMES: Record<PitchTheme, PitchThemeConfig> = {
  light: {
    bg: '#f8fafc',
    line: '#cbd5e1',
    outerStroke: '#cbd5e1',
    outerRx: 8,
  },
  dark: {
    bg: '#0f172a',
    line: '#334155',
    outerStroke: '#334155',
    outerRx: 8,
  },
  'tactical-dark': {
    bg: '#0b0f19',
    line: '#1e293b',
    outerStroke: '#334155',
    outerRx: 8,
  },
  'warm-ivory': {
    bg: '#FAF8F5',
    line: '#4A3525',
    outerStroke: '#4A3525',
    outerRx: 4,
  },
};

export interface SoccerPitchCanvasProps {
  orientation?: PitchOrientation;
  half?: boolean;
  theme?: PitchTheme;
  className?: string;
  svgClassName?: string;
  viewBox?: string;
  pitchX?: number;
  pitchY?: number;
  pitchWidth?: number;
  pitchHeight?: number;
  showPenaltySpots?: boolean;
  showCenterCircle?: boolean;
  showGoalBoxes?: boolean;
  showCornerArcs?: boolean;
  showPenaltyArcs?: boolean;
  showGoalNets?: boolean;
  strokeWidth?: number;
  defs?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
}

/**
 * Standard regulation soccer pitch SVG canvas component (Opta / StatsBomb proportions).
 * Supports vertical/horizontal orientation, full/half pitch modes, and customizable tactical themes.
 */
export const SoccerPitchCanvas: React.FC<SoccerPitchCanvasProps> = ({
  orientation = 'vertical',
  half = false,
  theme = 'light',
  className = '',
  svgClassName = 'w-full h-auto overflow-visible select-none',
  viewBox: propViewBox,
  pitchX: propPitchX,
  pitchY: propPitchY,
  pitchWidth: propPitchWidth,
  pitchHeight: propPitchHeight,
  showPenaltySpots = true,
  showCenterCircle = true,
  showGoalBoxes = true,
  showCornerArcs = true,
  showPenaltyArcs = true,
  showGoalNets = true,
  strokeWidth = 1.5,
  defs,
  children,
  onClick,
}) => {
  const themeCfg = PITCH_THEMES[theme] || PITCH_THEMES.light;

  // Resolve dimensions based on mode if not explicitly overridden
  let defaultViewBox = '0 0 540 600';
  let defaultX = 45;
  let defaultY = 40;
  let defaultWidth = 450;
  let defaultHeight = 520;

  if (orientation === 'vertical') {
    if (half) {
      defaultViewBox = '0 0 540 450';
      defaultX = 45;
      defaultY = 35;
      defaultWidth = 450;
      defaultHeight = 375;
    } else {
      defaultViewBox = '0 0 540 600';
      defaultX = 45;
      defaultY = 40;
      defaultWidth = 450;
      defaultHeight = 520;
    }
  } else {
    // horizontal
    if (half) {
      defaultViewBox = '0 0 540 540';
      defaultX = 45;
      defaultY = 40;
      defaultWidth = 450;
      defaultHeight = 460;
    } else {
      defaultViewBox = '0 0 960 540';
      defaultX = 45;
      defaultY = 40;
      defaultWidth = 870;
      defaultHeight = 460;
    }
  }

  const viewBox = propViewBox || defaultViewBox;
  const px = propPitchX !== undefined ? propPitchX : defaultX;
  const py = propPitchY !== undefined ? propPitchY : defaultY;
  const pw = propPitchWidth !== undefined ? propPitchWidth : defaultWidth;
  const ph = propPitchHeight !== undefined ? propPitchHeight : defaultHeight;

  const centerX = px + pw / 2;
  const centerY = py + ph / 2;

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox={viewBox}
        className={svgClassName}
        onClick={onClick}
      >
        <defs>
          {defs}
        </defs>

        {/* Outer Pitch Boundary Canvas */}
        <rect
          x={px}
          y={py}
          width={pw}
          height={ph}
          rx={themeCfg.outerRx}
          fill={themeCfg.bg}
          stroke={themeCfg.outerStroke}
          strokeWidth={strokeWidth}
        />

        {/* =================================================================== */}
        {/* CASE 1: VERTICAL HALF PITCH (ATTACKING UPWARDS)                     */}
        {/* =================================================================== */}
        {orientation === 'vertical' && half && (
          <g stroke={themeCfg.line} strokeWidth={strokeWidth} fill="none">
            {/* Halfway Line (at bottom) */}
            <line x1={px} y1={py + ph} x2={px + pw} y2={py + ph} />

            {/* Center Circle Arc (at bottom) */}
            {showCenterCircle && (
              <>
                <path d={`M ${centerX - 54} ${py + ph} A 54 54 0 0 1 ${centerX + 54} ${py + ph}`} />
                <circle cx={centerX} cy={py + ph} r={2.5} fill={themeCfg.line} stroke="none" />
              </>
            )}

            {/* Top Penalty Box (Attacking 18-Yard Box) */}
            {showGoalBoxes && (
              <>
                <rect
                  x={centerX - 133.4}
                  y={py}
                  width={266.8}
                  height={119.4}
                />
                {/* Top 6-Yard Goal Box */}
                <rect
                  x={centerX - 60.6}
                  y={py}
                  width={121.2}
                  height={39.8}
                />
              </>
            )}

            {/* Penalty Spot (Top) */}
            {showPenaltySpots && (
              <circle cx={centerX} cy={py + 79.6} r={2.5} fill={themeCfg.line} stroke="none" />
            )}

            {/* Penalty Arc (D) */}
            {showPenaltyArcs && (
              <path d={`M ${centerX - 52.9} ${py + 119.4} A 66.2 66.2 0 0 0 ${centerX + 52.9} ${py + 119.4}`} />
            )}

            {/* Goal Mouth Net (Top) */}
            {showGoalNets && (
              <rect
                x={centerX - 24.25}
                y={py - 14}
                width={48.5}
                height={14}
              />
            )}

            {/* Corner Arcs (Top Left & Top Right) */}
            {showCornerArcs && (
              <>
                <path d={`M ${px} ${py + 9} A 9 9 0 0 1 ${px + 9} ${py}`} />
                <path d={`M ${px + pw - 9} ${py} A 9 9 0 0 1 ${px + pw} ${py + 9}`} />
              </>
            )}
          </g>
        )}

        {/* =================================================================== */}
        {/* CASE 2: VERTICAL FULL PITCH                                         */}
        {/* =================================================================== */}
        {orientation === 'vertical' && !half && (
          <g stroke={themeCfg.line} strokeWidth={strokeWidth} fill="none">
            {/* Halfway Horizontal Line */}
            <line x1={px} y1={centerY} x2={px + pw} y2={centerY} />

            {/* Center Circle & Spot */}
            {showCenterCircle && (
              <>
                <circle cx={centerX} cy={centerY} r={46} />
                <circle cx={centerX} cy={centerY} r={2.5} fill={themeCfg.line} stroke="none" />
              </>
            )}

            {/* Top Penalty Box & 6-Yard Box */}
            {showGoalBoxes && (
              <>
                <rect
                  x={centerX - 90}
                  y={py}
                  width={180}
                  height={74}
                />
                <rect
                  x={centerX - 42}
                  y={py}
                  width={84}
                  height={26}
                />
              </>
            )}

            {/* Top Penalty Spot */}
            {showPenaltySpots && (
              <circle cx={centerX} cy={py + 50} r={2.5} fill={themeCfg.line} stroke="none" />
            )}

            {/* Top Penalty Arc */}
            {showPenaltyArcs && (
              <path d={`M ${centerX - 36} ${py + 74} A 42 42 0 0 0 ${centerX + 36} ${py + 74}`} />
            )}

            {/* Top Goal Net */}
            {showGoalNets && (
              <rect
                x={centerX - 26}
                y={py - 6}
                width={52}
                height={6}
              />
            )}

            {/* Bottom Penalty Box & 6-Yard Box */}
            {showGoalBoxes && (
              <>
                <rect
                  x={centerX - 90}
                  y={py + ph - 74}
                  width={180}
                  height={74}
                />
                <rect
                  x={centerX - 42}
                  y={py + ph - 26}
                  width={84}
                  height={26}
                />
              </>
            )}

            {/* Bottom Penalty Spot */}
            {showPenaltySpots && (
              <circle cx={centerX} cy={py + ph - 50} r={2.5} fill={themeCfg.line} stroke="none" />
            )}

            {/* Bottom Penalty Arc */}
            {showPenaltyArcs && (
              <path d={`M ${centerX - 36} ${py + ph - 74} A 42 42 0 0 1 ${centerX + 36} ${py + ph - 74}`} />
            )}

            {/* Bottom Goal Net */}
            {showGoalNets && (
              <rect
                x={centerX - 26}
                y={py + ph}
                width={52}
                height={6}
              />
            )}

            {/* Corner Arcs */}
            {showCornerArcs && (
              <>
                <path d={`M ${px} ${py + 10} A 10 10 0 0 1 ${px + 10} ${py}`} />
                <path d={`M ${px + pw - 10} ${py} A 10 10 0 0 1 ${px + pw} ${py + 10}`} />
                <path d={`M ${px} ${py + ph - 10} A 10 10 0 0 0 ${px + 10} ${py + ph}`} />
                <path d={`M ${px + pw - 10} ${py + ph} A 10 10 0 0 0 ${px + pw} ${py + ph - 10}`} />
              </>
            )}
          </g>
        )}

        {/* =================================================================== */}
        {/* CASE 3: HORIZONTAL FULL PITCH                                       */}
        {/* =================================================================== */}
        {orientation === 'horizontal' && !half && (
          <g stroke={themeCfg.line} strokeWidth={strokeWidth} fill="none">
            {/* Halfway Vertical Line */}
            <line x1={centerX} y1={py} x2={centerX} y2={py + ph} />

            {/* Center Circle & Spot */}
            {showCenterCircle && (
              <>
                <circle cx={centerX} cy={centerY} r={65} />
                <circle cx={centerX} cy={centerY} r={3} fill={themeCfg.line} stroke="none" />
              </>
            )}

            {/* Left Penalty Box & 6-Yard Box */}
            {showGoalBoxes && (
              <>
                <rect
                  x={px}
                  y={centerY - 130.5}
                  width={135}
                  height={261}
                />
                <rect
                  x={px}
                  y={centerY - 59.25}
                  width={45}
                  height={118.5}
                />
              </>
            )}

            {/* Left Penalty Spot */}
            {showPenaltySpots && (
              <circle cx={px + 95} cy={centerY} r={2.8} fill={themeCfg.line} stroke="none" />
            )}

            {/* Left Penalty Arc (D) */}
            {showPenaltyArcs && (
              <path d={`M ${px + 135} ${centerY - 46.9} A 65 65 0 0 1 ${px + 135} ${centerY + 46.9}`} />
            )}

            {/* Left Goal Mouth */}
            {showGoalNets && (
              <rect
                x={px - 12}
                y={centerY - 32}
                width={12}
                height={64}
              />
            )}

            {/* Right Penalty Box & 6-Yard Box */}
            {showGoalBoxes && (
              <>
                <rect
                  x={px + pw - 135}
                  y={centerY - 130.5}
                  width={135}
                  height={261}
                />
                <rect
                  x={px + pw - 45}
                  y={centerY - 59.25}
                  width={45}
                  height={118.5}
                />
              </>
            )}

            {/* Right Penalty Spot */}
            {showPenaltySpots && (
              <circle cx={px + pw - 95} cy={centerY} r={2.8} fill={themeCfg.line} stroke="none" />
            )}

            {/* Right Penalty Arc (D) */}
            {showPenaltyArcs && (
              <path d={`M ${px + pw - 135} ${centerY - 46.9} A 65 65 0 0 0 ${px + pw - 135} ${centerY + 46.9}`} />
            )}

            {/* Right Goal Mouth */}
            {showGoalNets && (
              <rect
                x={px + pw}
                y={centerY - 32}
                width={12}
                height={64}
              />
            )}

            {/* Corner Arcs */}
            {showCornerArcs && (
              <>
                <path d={`M ${px + 12} ${py} A 12 12 0 0 0 ${px} ${py + 12}`} />
                <path d={`M ${px} ${py + ph - 12} A 12 12 0 0 0 ${px + 12} ${py + ph}`} />
                <path d={`M ${px + pw - 12} ${py} A 12 12 0 0 1 ${px + pw} ${py + 12}`} />
                <path d={`M ${px + pw} ${py + ph - 12} A 12 12 0 0 1 ${px + pw - 12} ${py + ph}`} />
              </>
            )}
          </g>
        )}

        {/* Projected Children (D3 Elements, Players, Shots, Zones, Halos, Legend) */}
        {children}
      </svg>
    </div>
  );
};

export default SoccerPitchCanvas;
