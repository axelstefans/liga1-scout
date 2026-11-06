import React from 'react';
import { FullPitchMarkings } from './scoutingFloor02Utils';

export interface PitchPassZonalCardProps {
  title: string;
  subtitle: string;
  grid: number[][];
  totalCount: number;
  getCellFill: (pct: number) => string;
}

export const PitchPassZonalCard: React.FC<PitchPassZonalCardProps> = ({
  title,
  subtitle,
  grid,
  totalCount,
  getCellFill,
}) => {
  const numPassCols = 5;
  const numPassRows = 6;
  const passColWidth = 68 / numPassCols; // 13.6
  const passRowHeight = 105 / numPassRows; // 17.5

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 flex flex-col justify-between shadow-sm h-full">
      <div className="flex flex-col items-center justify-center text-center mb-2 gap-0.5">
        <div className="font-sans font-semibold text-slate-800 text-[12px] tracking-normal normal-case">
          {title}
        </div>
        <p className="text-[10.5px] font-medium text-slate-500 font-sans mt-0.5">{subtitle}</p>
      </div>

      <div className="relative w-full aspect-[68/105] max-w-[215px] mx-auto overflow-hidden">
        <svg viewBox="0 0 68 105" className="w-full h-full block pointer-events-auto">
          <rect x="0" y="0" width="68" height="105" fill="#f5f7f4" stroke="#363835" strokeWidth="0.28" />

          {/* Zonal matrix grid */}
          <g>
            {grid.map((row, r) =>
              row.map((count, c) => {
                const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
                const fill = getCellFill(pct);

                return (
                  <rect
                    key={`pass-zone-${r}-${c}`}
                    x={c * passColWidth}
                    y={r * passRowHeight}
                    width={passColWidth}
                    height={passRowHeight}
                    fill={fill}
                    stroke="none"
                  />
                );
              })
            )}
          </g>

          <FullPitchMarkings />

          {/* Percentage labels */}
          <g pointerEvents="none">
            {grid.map((row, r) =>
              row.map((count, c) => {
                const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
                const cellCenterX = c * passColWidth + passColWidth / 2;
                const cellCenterY = r * passRowHeight + passRowHeight / 2;

                const isDark = pct > 7;
                const textFill = isDark ? '#FFFFFF' : '#111827';
                const textStroke = isDark ? '#111827' : '#FFFFFF';
                const strokeW = isDark ? 0.2 : 0.22;

                if (pct <= 0) return null;

                return (
                  <text
                    key={`pass-zone-txt-${r}-${c}`}
                    x={cellCenterX}
                    y={cellCenterY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="2.7"
                    fill={textFill}
                    stroke={textStroke}
                    strokeWidth={strokeW}
                    paintOrder="stroke fill"
                    strokeLinejoin="round"
                    fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                    fontWeight="700"
                    letterSpacing="-0.02em"
                    className="select-none pointer-events-none"
                  >
                    {pct.toFixed(1)}%
                  </text>
                );
              })
            )}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default PitchPassZonalCard;
