import React from 'react';
import type { MatchSheetModule06TeamStats } from '../../../services/api';
import type { MatchSheet01Translations } from '../../../i18n/scoutingReport';
import { SVG_FONT_SANS, buildM06Rows, computeNiceCountAxis } from '../matchReportSheet01Utils';
import { resolveM06DumbbellCoords } from './sheet01GeometryAndUtils';

export interface ShotOutcomesModule06Props {
  m06Home: MatchSheetModule06TeamStats | null;
  m06Away: MatchSheetModule06TeamStats | null;
  homeTri: string;
  awayTri: string;
  homeColor: string;
  awayColor: string;
  areColorsSimilar: boolean;
  ms: MatchSheet01Translations;
}

export const ShotOutcomesModule06: React.FC<ShotOutcomesModule06Props> = ({
  m06Home,
  m06Away,
  homeTri,
  awayTri,
  homeColor,
  awayColor,
  areColorsSimilar,
  ms,
}) => {
  const m06Rows = buildM06Rows(m06Home, m06Away, ms);
  const rawMaxCount = Math.max(0, ...m06Rows.flatMap((r) => [r.homeVal, r.awayVal]));
  const { axisMax: m06MaxCount, ticks: m06XTicks } = computeNiceCountAxis(rawMaxCount);

  const VB_W = 460;
  const VB_H = 210;
  const originX = 95;
  const PLOT_W = 320;
  const AXIS_Y = 175;
  const ROW_START_Y = 28;
  const ROW_STEP_Y = 34;

  const offTargetRow = m06Rows.find((r) => r.key === 'off_target');
  const hasWoodwork =
    (offTargetRow?.woodworkHome ?? 0) > 0 || (offTargetRow?.woodworkAway ?? 0) > 0;

  const maxScale = m06XTicks.length > 0 ? m06XTicks[m06XTicks.length - 1] : Math.max(1, m06MaxCount);
  const safeMax = Math.max(1, maxScale);
  const numSteps = m06XTicks.length > 1 ? m06XTicks.length - 1 : 1;
  const gridStep = PLOT_W / (numSteps + 0.4);
  const leftPadding = gridStep * 0.35;

  const getX = (val: number) => originX + leftPadding + (val / safeMax) * (numSteps * gridStep);

  return (
    <div className="col-span-6 flex flex-col justify-between">
      <div>
        <div className="flex flex-col border-b border-slate-200 pb-2 mb-2.5">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs font-bold text-slate-400">{ms.module06.number}</span>
            <h2 className="text-xs font-bold tracking-[0.04em] text-slate-900">
              {ms.module06.title}
            </h2>
          </div>
          <p className="font-mono text-[10px] text-slate-500 mt-0.5">
            {ms.module06.subtitle}
          </p>
        </div>

        {!m06Home || !m06Away ? (
          <div className="h-[180px] flex items-center justify-center font-mono text-xs text-slate-400">
            — {ms.module06.empty} —
          </div>
        ) : (
          <div>
            <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-auto block select-none">
              {m06Rows.map((_, idx) => (
                <line
                  key={`m06-grid-h-${idx}`}
                  x1={originX}
                  y1={ROW_START_Y + idx * ROW_STEP_Y}
                  x2={originX + PLOT_W}
                  y2={ROW_START_Y + idx * ROW_STEP_Y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
              ))}
              {m06XTicks.map((tv) => (
                <line
                  key={`m06-grid-v-${tv}`}
                  x1={getX(tv)}
                  y1={22}
                  x2={getX(tv)}
                  y2={AXIS_Y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
              ))}

              <line x1={originX} y1={22} x2={originX} y2={AXIS_Y} stroke="#cbd5e1" strokeWidth="1" />
              <line x1={originX} y1={AXIS_Y} x2={originX + PLOT_W} y2={AXIS_Y} stroke="#cbd5e1" strokeWidth="1" />

              {m06Rows.map((row, idx) => {
                const rowY = ROW_START_Y + idx * ROW_STEP_Y;
                const hNull = row.homeVal === null || row.homeVal === undefined;
                const aNull = row.awayVal === null || row.awayVal === undefined;
                const hx = !hNull ? getX(row.homeVal) : getX(0);
                const ax = !aNull ? getX(row.awayVal) : getX(0);
                const { renderHx, renderAx, labelHx, labelAx } = resolveM06DumbbellCoords(
                  row.homeVal ?? 0,
                  row.awayVal ?? 0,
                  hx,
                  ax
                );

                return (
                  <g key={`m06-row-${row.key}`}>
                    {!hNull && !aNull && (
                      <line
                        key={`m06-dumbbell-${row.key}`}
                        x1={Math.min(renderHx, renderAx)}
                        y1={rowY}
                        x2={Math.max(renderHx, renderAx)}
                        y2={rowY}
                        stroke="#94a3b8"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    )}
                    {!aNull && (
                      <rect
                        x={renderAx - 4}
                        y={rowY - 4}
                        width="8"
                        height="8"
                        fill={areColorsSimilar ? '#ffffff' : awayColor}
                        stroke={awayColor}
                        strokeWidth="1.5"
                      />
                    )}
                    {!hNull && (
                      <circle
                        cx={renderHx}
                        cy={rowY}
                        r="4.5"
                        fill={homeColor}
                        stroke="#ffffff"
                        strokeWidth="1"
                      />
                    )}
                    <text
                      x={originX - 14}
                      y={rowY}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fontSize="11"
                      fontFamily={SVG_FONT_SANS}
                      fontWeight="600"
                      fill="#334155"
                    >
                      {row.label}
                    </text>
                    <text
                      x={labelHx}
                      y={rowY - 7}
                      textAnchor="middle"
                      fontSize="10"
                      fontFamily={SVG_FONT_SANS}
                      fontWeight="700"
                      fill={homeColor}
                    >
                      {hNull ? '—' : row.homeVal}
                    </text>
                    <text
                      x={labelAx}
                      y={rowY + 13}
                      textAnchor="middle"
                      fontSize="10"
                      fontFamily={SVG_FONT_SANS}
                      fontWeight="700"
                      fill={awayColor}
                    >
                      {aNull ? '—' : row.awayVal}
                    </text>
                  </g>
                );
              })}

              {m06XTicks.map((tv) => (
                <text
                  key={`m06-tick-label-${tv}`}
                  x={getX(tv)}
                  y={AXIS_Y + 14}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontFamily={SVG_FONT_SANS}
                  fill="#94a3b8"
                >
                  {tv}
                </text>
              ))}

              <text
                x={originX + PLOT_W / 2}
                y={AXIS_Y + 28}
                textAnchor="middle"
                fontSize="9"
                fontFamily={SVG_FONT_SANS}
                fontWeight="600"
                fill="#94a3b8"
                className="uppercase tracking-wider"
              >
                {ms.module06.xAxisLabel}
              </text>
            </svg>

            {hasWoodwork && offTargetRow && (
              <div className="flex items-center justify-between gap-2 font-mono text-[9px] text-slate-500 mt-1">
                <span>
                  {ms.module06.woodworkBadge(offTargetRow.woodworkHome)} ({homeTri}) ·{' '}
                  {ms.module06.woodworkBadge(offTargetRow.woodworkAway)} ({awayTri})
                </span>
                <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-300 text-amber-900 font-semibold">
                  ⊂ {ms.module06.categories.offTarget}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
