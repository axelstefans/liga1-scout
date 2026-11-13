import React from 'react';
import { MappedShotItem } from './shotMapGeometry';

export interface ShotMarkerProps {
  item: MappedShotItem;
  isHovered: boolean;
  isCumulative: boolean;
  onHover: (
    item: MappedShotItem,
    coords: { x: number; y: number; yBottom: number; svgX: number; svgY: number }
  ) => void;
  onLeave: () => void;
}

/**
 * Pure SVG shot marker component rendering glyphs based on outcome:
 * - Goal: Crisp emerald bubble with white inner ring and green halo
 * - Saved: Solid blue circle
 * - Miss: Hollow red circle
 * - Blocked: Slate rounded square
 */
export const ShotMarker: React.FC<ShotMarkerProps> = ({
  item,
  isHovered,
  isCumulative,
  onHover,
  onLeave,
}) => {
  const { shot, px, py, radius } = item;

  // Hovered shot expands to full scale (1.35 in cumulative, 1.25 in match)
  const r = isHovered ? (isCumulative ? radius * 1.35 : radius * 1.25) : radius;

  // Non-goal opacity: set fillOpacity={0.7} on non-goal markers to prevent visual clogging
  const nonGoalFillOpacity = isHovered ? 1.0 : 0.7;
  const nonGoalStrokeOpacity = isHovered ? 1.0 : 0.75;

  return (
    <g
      className="cursor-pointer transition-transform"
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onHover(item, {
          x: rect.left + rect.width / 2,
          y: rect.top,
          yBottom: rect.bottom,
          svgX: px,
          svgY: py,
        });
      }}
      onMouseLeave={onLeave}
    >
      {/* Outcome Specific Rendering with Top Hierarchy for Goals */}
      {shot.result === 'goal' ? (
        <g filter={isHovered ? 'url(#shotHoverGlow)' : 'url(#shotGoalHalo)'}>
          {(() => {
            const goalR = Math.max(6.0, r);
            return (
              <>
                <circle
                  cx={px}
                  cy={py}
                  r={goalR}
                  fill="#10B981"
                  fillOpacity={1.0}
                  stroke="#065F46"
                  strokeWidth={2.5}
                />
                <circle cx={px} cy={py} r={goalR * 0.42} fill="#ffffff" />
              </>
            );
          })()}
        </g>
      ) : shot.result === 'saved' ? (
        <circle
          cx={px}
          cy={py}
          r={r}
          fill="#3B82F6"
          fillOpacity={nonGoalFillOpacity}
          stroke="#1D4ED8"
          strokeOpacity={nonGoalStrokeOpacity}
          strokeWidth={isHovered ? 2.2 : 1.5}
          filter={isHovered ? 'url(#shotHoverGlow)' : undefined}
        />
      ) : shot.result === 'miss' ? (
        <circle
          cx={px}
          cy={py}
          r={r}
          fill="none"
          stroke="#EF4444"
          strokeOpacity={nonGoalStrokeOpacity}
          strokeWidth={isHovered ? 2.5 : 1.8}
          filter={isHovered ? 'url(#shotHoverGlow)' : undefined}
        />
      ) : (
        <rect
          x={px - (r * 1.5) / 2}
          y={py - (r * 1.5) / 2}
          width={r * 1.5}
          height={r * 1.5}
          fill="#94A3B8"
          fillOpacity={nonGoalFillOpacity}
          stroke="#475569"
          strokeOpacity={nonGoalStrokeOpacity}
          strokeWidth={1.2}
          rx={1}
          filter={isHovered ? 'url(#shotHoverGlow)' : undefined}
        />
      )}
    </g>
  );
};

export default ShotMarker;
