import React from 'react';
import { DEFENSIVE_PITCH_DIMENSIONS } from './defensiveTerritoryGeometry';

export interface DefensiveTerritoryLegendProps {
  ppdaVal: string;
  teamName: string;
}

/**
 * Floating Ivory boxed legend and editorial footer strip for the horizontal defensive territory pitch.
 */
export const DefensiveTerritoryLegend: React.FC<DefensiveTerritoryLegendProps> = ({
  ppdaVal,
  teamName,
}) => {
  return (
    <>
      {/* Floating Ivory Boxed Legend (Bottom-Right corner inside pitch) */}
      <g className="select-none pointer-events-none">
        <rect
          x={690}
          y={384}
          width={208}
          height={82}
          rx={5}
          fill="#FAF8F5"
          fillOpacity={0.96}
          stroke="#4A3525"
          strokeWidth={1}
        />
        <text
          x={700}
          y={398}
          className="text-[8.5px] font-bold fill-[#4A3525] uppercase tracking-wider"
        >
          Acciones Defensivas
        </text>

        {/* Col 1 */}
        <g transform="translate(706, 413)">
          <polygon points="0,-3.8 3.8,0 0,3.8 -3.8,0" fill="#93C5FD" stroke="#2563EB" strokeWidth={1.4} />
          <text x={8} y={3} className="text-[9.5px] font-medium fill-[#4A3525]">Won Tackle</text>
        </g>
        <g transform="translate(706, 429)">
          <rect x={-3} y={-3} width={6} height={6} fill="#22C55E" stroke="#15803D" strokeWidth={1.4} />
          <text x={8} y={3} className="text-[9.5px] font-medium fill-[#4A3525]">Interception</text>
        </g>
        <g transform="translate(706, 445)">
          <polygon points="-3,-2.2 3,-2.2 0,3.2" fill="#F3F4F6" stroke="#6B7280" strokeWidth={1.2} />
          <text x={8} y={3} className="text-[9.5px] font-medium fill-[#4A3525]">Blocked Pass</text>
        </g>

        {/* Col 2 */}
        <g transform="translate(798, 413)">
          <circle r={3} fill="#FB923C" stroke="#EA580C" strokeWidth={1.4} />
          <text x={8} y={3} className="text-[9.5px] font-medium fill-[#4A3525]">Lost Tackle</text>
        </g>
        <g transform="translate(798, 429)">
          <rect x={-3} y={-3} width={6} height={6} fill="#D1D5DB" fillOpacity={0.6} stroke="#4B5563" strokeWidth={1.4} />
          <text x={8} y={3} className="text-[9.5px] font-medium fill-[#4A3525]">Clearance</text>
        </g>
        <g transform="translate(798, 445)">
          <g stroke="#9CA3AF" strokeWidth={1.2} strokeLinecap="round">
            <line x1={-2.8} y1={-2.8} x2={2.8} y2={2.8} />
            <line x1={-2.8} y1={2.8} x2={2.8} y2={-2.8} />
          </g>
          <text x={8} y={3} className="text-[9.5px] font-medium fill-[#4A3525]">Recovery</text>
        </g>

        {/* Line of Engagement Row */}
        <g transform="translate(700, 458)">
          <line x1={0} y1={0} x2={16} y2={0} stroke="#D4A344" strokeWidth={2.2} />
          <text x={22} y={3} className="text-[9px] font-semibold fill-[#4A3525]">
            Avg Height (excl. clears)
          </text>
        </g>
      </g>

      {/* Clean Non-Overlapping Editorial Footer Strip */}
      <g className="select-none">
        <text x={DEFENSIVE_PITCH_DIMENSIONS.PITCH_X} y={536} className="text-xs font-semibold fill-[#4A3525]">
          PPDA: {ppdaVal}
        </text>
        <text x={DEFENSIVE_PITCH_DIMENSIONS.PITCH_X + 85} y={536} className="text-[11px] font-medium fill-[#8C7A6B]">
          • Liga 1 Scout
        </text>

        <text
          x={DEFENSIVE_PITCH_DIMENSIONS.PITCH_X + DEFENSIVE_PITCH_DIMENSIONS.PITCH_WIDTH / 2}
          y={536}
          textAnchor="middle"
          className="text-xs font-semibold fill-[#4A3525] tracking-wider"
        >
          Direction of Attack ────►
        </text>

        <text
          x={DEFENSIVE_PITCH_DIMENSIONS.PITCH_X + DEFENSIVE_PITCH_DIMENSIONS.PITCH_WIDTH}
          y={536}
          textAnchor="end"
          className="text-xs font-semibold fill-[#4A3525]"
        >
          {teamName}
        </text>
      </g>
    </>
  );
};

export default DefensiveTerritoryLegend;
