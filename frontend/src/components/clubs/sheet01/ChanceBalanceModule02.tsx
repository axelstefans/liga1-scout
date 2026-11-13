import React from 'react';
import type { MatchSheetModule02ChanceBalance } from '../../../services/api';
import type { MatchSheet01Translations } from '../../../i18n/scoutingReport';
import { SVG_FONT_MONO, SVG_FONT_SANS, buildM02Rows } from '../matchReportSheet01Utils';

export interface ChanceBalanceModule02Props {
  matchId: number;
  module02: MatchSheetModule02ChanceBalance | null;
  homeColor: string;
  awayColor: string;
  ms: MatchSheet01Translations;
}

export const ChanceBalanceModule02: React.FC<ChanceBalanceModule02Props> = ({
  matchId,
  module02,
  homeColor,
  awayColor,
  ms,
}) => {
  const m02Rows = buildM02Rows(module02, ms);
  const BAR_X = 115;
  const BAR_MAX_W = 205;

  return (
    <div className="col-span-5 flex flex-col justify-between">
      <div>
        <div className="border-b border-slate-200 pb-2 mb-3">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs font-bold text-slate-400">
              {ms.module02.number}
            </span>
            <h2 className="text-xs font-bold tracking-[0.04em] text-slate-900">
              {ms.module02.title}
            </h2>
          </div>
          <p className="font-mono text-[10px] text-slate-500 mt-0.5">{ms.module02.subtitle}</p>
        </div>

        {!module02 ? (
          <div className="h-[235px] flex items-center justify-center font-mono text-xs text-slate-400">
            — {ms.module02.empty} —
          </div>
        ) : (
          <div className="space-y-2.5">
            {m02Rows.map((row) => {
              const hNull = row.homeVal === null || row.homeVal === undefined;
              const aNull = row.awayVal === null || row.awayVal === undefined;
              const rawMax = Math.max(hNull ? 0 : row.homeVal ?? 0, aNull ? 0 : row.awayVal ?? 0);
              const hWidth =
                !hNull && rawMax > 0 && (row.homeVal ?? 0) > 0
                  ? Math.max(3, ((row.homeVal || 0) / rawMax) * BAR_MAX_W)
                  : 0;
              const aWidth =
                !aNull && rawMax > 0 && (row.awayVal ?? 0) > 0
                  ? Math.max(3, ((row.awayVal || 0) / rawMax) * BAR_MAX_W)
                  : 0;
              const hatchId = `m02-hatch-${matchId}-${row.key}`;

              return (
                <div
                  key={row.key}
                  className="border-b border-slate-100 pb-1.5 last:border-b-0 last:pb-0"
                >
                  <svg viewBox="0 0 380 26" className="w-full h-[26px] block select-none">
                    <defs>
                      <pattern
                        id={hatchId}
                        width="4.5"
                        height="4.5"
                        patternTransform="rotate(45)"
                        patternUnits="userSpaceOnUse"
                      >
                        <rect width="4.5" height="4.5" fill={awayColor} fillOpacity="0.16" />
                        <line
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="4.5"
                          stroke={awayColor}
                          strokeWidth="1.5"
                        />
                      </pattern>
                    </defs>

                    <text
                      x="0"
                      y="16"
                      fontSize="10"
                      fontFamily={SVG_FONT_SANS}
                      fontWeight="600"
                      className="font-mono text-[10px] font-semibold fill-slate-800"
                    >
                      {row.label}
                    </text>

                    <rect x={BAR_X} y="3" width={BAR_MAX_W} height="8" fill="#f1f5f9" />
                    <rect x={BAR_X} y="15" width={BAR_MAX_W} height="8" fill="#f1f5f9" />

                    {hWidth > 0 && (
                      <rect
                        x={BAR_X}
                        y="3"
                        width={hWidth}
                        height="8"
                        fill={homeColor}
                      />
                    )}

                    {aWidth > 0 && (
                      <rect
                        x={BAR_X}
                        y="15"
                        width={aWidth}
                        height="8"
                        fill={`url(#${hatchId})`}
                        stroke={awayColor}
                        strokeWidth="0.7"
                      />
                    )}

                    <text
                      x="376"
                      y="10"
                      textAnchor="end"
                      fontSize="9.5"
                      fontFamily={SVG_FONT_MONO}
                      fontWeight="700"
                      className="font-mono text-[9.5px] font-bold tabular-nums"
                      fill={homeColor}
                    >
                      {row.format(row.homeVal)}
                    </text>
                    <text
                      x="376"
                      y="22"
                      textAnchor="end"
                      fontSize="9.5"
                      fontFamily={SVG_FONT_MONO}
                      fontWeight="700"
                      className="font-mono text-[9.5px] font-bold tabular-nums"
                      fill={awayColor}
                    >
                      {row.format(row.awayVal)}
                    </text>
                  </svg>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
