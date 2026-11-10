import React from 'react';

/**
 * Renders pure SVG geometric shape markers according to tactical event type.
 */
export function renderDefensiveShape(
  type: string,
  cx: number = 0,
  cy: number = 0,
  scale: number = 1.0,
  isHovered: boolean = false
): React.ReactElement {
  switch (type) {
    case 'won_tackle': {
      // Blue diamond
      const r = 4.8 * scale;
      return (
        <polygon
          points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
          fill="#93C5FD"
          stroke="#2563EB"
          strokeWidth={1.5}
          filter={isHovered ? 'url(#defDotHalo)' : undefined}
        />
      );
    }
    case 'lost_tackle': {
      // Orange circle
      const r = 3.8 * scale;
      return (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="#FB923C"
          stroke="#EA580C"
          strokeWidth={1.5}
          filter={isHovered ? 'url(#defDotHalo)' : undefined}
        />
      );
    }
    case 'interception': {
      // Solid green square
      const s = 7.0 * scale;
      return (
        <rect
          x={cx - s / 2}
          y={cy - s / 2}
          width={s}
          height={s}
          fill="#22C55E"
          stroke="#15803D"
          strokeWidth={1.5}
          filter={isHovered ? 'url(#defDotHalo)' : undefined}
        />
      );
    }
    case 'clearance': {
      // Semi-transparent grey square with border
      const s = 7.0 * scale;
      return (
        <rect
          x={cx - s / 2}
          y={cy - s / 2}
          width={s}
          height={s}
          fill="#D1D5DB"
          fillOpacity={0.6}
          stroke="#4B5563"
          strokeWidth={1.5}
        />
      );
    }
    case 'blocked_pass': {
      // Inverted grey triangle
      const r = 4.4 * scale;
      return (
        <polygon
          points={`${cx - r},${cy - r * 0.75} ${cx + r},${cy - r * 0.75} ${cx},${cy + r * 1.05}`}
          fill="#F3F4F6"
          stroke="#6B7280"
          strokeWidth={1.2}
        />
      );
    }
    case 'recovery': {
      // Subtle grey cross (×)
      const r = 3.6 * scale;
      return (
        <g stroke="#9CA3AF" strokeWidth={1.2 * Math.max(0.8, scale)} strokeLinecap="round" opacity={0.85}>
          <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} />
          <line x1={cx - r} y1={cy + r} x2={cx + r} y2={cy - r} />
        </g>
      );
    }
    case 'foul': {
      // Rose triangle
      const r = 4.2 * scale;
      return (
        <polygon
          points={`${cx},${cy - r * 1.05} ${cx + r},${cy + r * 0.75} ${cx - r},${cy + r * 0.75}`}
          fill="#FDA4AF"
          stroke="#E11D48"
          strokeWidth={1.2}
        />
      );
    }
    default: {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={3.8 * scale}
          fill="#9CA3AF"
          stroke="#4B5563"
          strokeWidth={1.2}
        />
      );
    }
  }
}

export default renderDefensiveShape;
