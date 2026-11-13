import React from 'react';
import type { MatchSheetModule05TeamStats } from '../../../services/api';
import type { MatchSheet01Translations } from '../../../i18n/scoutingReport';
import { SVG_FONT_MONO, SVG_FONT_SANS, computeNiceXgAxis } from '../matchReportSheet01Utils';
import { resolveM05LabelOffset } from './sheet01GeometryAndUtils';

export interface ChanceToGoalModule05Props {
  m05Home: MatchSheetModule05TeamStats | null;
  m05Away: MatchSheetModule05TeamStats | null;
  hasXgot: boolean;
  homeColor: string;
  awayColor: string;
  areColorsSimilar: boolean;
  ms: MatchSheet01Translations;
}

export const ChanceToGoalModule05: React.FC<ChanceToGoalModule05Props> = ({
  m05Home,
  m05Away,
  hasXgot,
  homeColor,
  awayColor,
  areColorsSimilar,
  ms,
}) => {
  const VB_W = 460;
  const VB_H = 210;
  const originX = 95;
  const PLOT_W = 320;
  const AXIS_Y = 175;
  const PLOT_T = 22;
  const PLOT_H = AXIS_Y - PLOT_T;

  const rawMax = Math.max(
    m05Home?.created_xg ?? 0,
    m05Home?.on_frame_xg ?? 0,
    m05Home?.struck_xgot ?? 0,
    m05Home?.scored_goals ?? 0,
    m05Away?.created_xg ?? 0,
    m05Away?.on_frame_xg ?? 0,
    m05Away?.struck_xgot ?? 0,
    m05Away?.scored_goals ?? 0
  );
  const { axisMax: m05MaxVal, ticks: m05YTicks } = computeNiceXgAxis(rawMax);

  const padX = 28;
  const usableW = PLOT_W - 2 * padX;
  const stepX = usableW / 3;
  const getStageX = (idx: number) => originX + padX + idx * stepX;

  const m05ValToY = (v: number) => AXIS_Y - (Math.max(0, v) / m05MaxVal) * PLOT_H;

  const homeStops: Array<number | null> = m05Home
    ? [m05Home.created_xg, m05Home.on_frame_xg, m05Home.struck_xgot, m05Home.scored_goals]
    : [null, null, null, null];
  const awayStops: Array<number | null> = m05Away
    ? [m05Away.created_xg, m05Away.on_frame_xg, m05Away.struck_xgot, m05Away.scored_goals]
    : [null, null, null, null];

  const stopLabels = [
    ms.module05.editorialStops.created,
    ms.module05.editorialStops.onFrame,
    ms.module05.editorialStops.struck,
    ms.module05.editorialStops.scored,
  ];

  return (
    <div className="col-span-6 pr-6 border-r border-slate-200 flex flex-col justify-between">
      <div>
        <div className="flex flex-col border-b border-slate-200 pb-2 mb-2.5">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs font-bold text-slate-400">{ms.module05.number}</span>
            <h2 className="text-xs font-bold tracking-[0.04em] text-slate-900">
              {ms.module05.title}
            </h2>
          </div>
          <p className="font-mono text-[10px] text-slate-500 mt-0.5">
            {ms.module05.subtitle}
          </p>
        </div>

        {!m05Home || !m05Away ? (
          <div className="h-[180px] flex items-center justify-center font-mono text-xs text-slate-400">
            — {ms.module05.empty} —
          </div>
        ) : (
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-auto block select-none">
            {m05YTicks.map((yv) => {
              const y = m05ValToY(yv);
              return (
                <g key={`m05-yg-${yv}`}>
                  <line x1={originX} y1={y} x2={originX + PLOT_W} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                  <text
                    x={originX - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="8.5"
                    fontFamily={SVG_FONT_MONO}
                    fontWeight="500"
                    fill="#94a3b8"
                  >
                    {yv.toFixed(1)}
                  </text>
                </g>
              );
            })}

            <text
              x="12"
              y={PLOT_T + PLOT_H / 2}
              textAnchor="middle"
              transform={`rotate(-90 12 ${PLOT_T + PLOT_H / 2})`}
              fontSize="8.5"
              fontFamily={SVG_FONT_SANS}
              fontWeight="600"
              fill="#94a3b8"
              className="uppercase tracking-wider"
            >
              {ms.module05.yAxisLabel}
            </text>

            <line x1={originX} y1={PLOT_T} x2={originX} y2={AXIS_Y} stroke="#cbd5e1" strokeWidth="1" />
            <line x1={originX} y1={AXIS_Y} x2={originX + PLOT_W} y2={AXIS_Y} stroke="#cbd5e1" strokeWidth="1" />

            {[0, 1, 2, 3].map((idx) => {
              const x = getStageX(idx);
              return (
                <g key={`m05-col-${idx}`}>
                  <line
                    x1={x}
                    y1={PLOT_T}
                    x2={x}
                    y2={AXIS_Y}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                    strokeDasharray={idx === 2 && !hasXgot ? '3 3' : undefined}
                  />
                  <text
                    x={x}
                    y={AXIS_Y + 16}
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="Inter, sans-serif"
                    fontWeight="600"
                    fill="#64748b"
                  >
                    {stopLabels[idx]}
                  </text>
                </g>
              );
            })}

            {[
              { stops: homeStops, color: homeColor, isAway: false },
              { stops: awayStops, color: awayColor, isAway: true },
            ].map(({ stops, color, isAway }) => {
              const segments: Array<[number, number, number, number]> = [];
              for (let i = 0; i < 3; i++) {
                const v1 = stops[i];
                const v2 = stops[i + 1];
                if (v1 !== null && v2 !== null) {
                  segments.push([getStageX(i), m05ValToY(v1), getStageX(i + 1), m05ValToY(v2)]);
                }
              }

              return (
                <g key={`m05-series-${isAway ? 'away' : 'home'}`}>
                  {segments.map(([x1, y1, x2, y2], sIdx) => (
                    <line
                      key={`seg-${sIdx}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth={isAway ? 2.2 : 2.5}
                      strokeDasharray={isAway && areColorsSimilar ? '5 3' : undefined}
                    />
                  ))}

                  {stops.map((val, idx) => {
                    const x = getStageX(idx);
                    if (val === null) {
                      return (
                        <text
                          key={`null-${idx}`}
                          x={x}
                          y={PLOT_T + PLOT_H / 2 + (isAway ? 10 : -6)}
                          textAnchor="middle"
                          fontSize="10"
                          fontFamily={SVG_FONT_MONO}
                          fontWeight="700"
                          fill={color}
                        >
                          —
                        </text>
                      );
                    }
                    const y = m05ValToY(val);
                    const oppVal = isAway ? homeStops[idx] : awayStops[idx];
                    const oppY = oppVal !== null && oppVal !== undefined ? m05ValToY(oppVal) : null;
                    const { labelOffsetX, labelOffsetY } = resolveM05LabelOffset(
                      y,
                      oppY,
                      AXIS_Y,
                      isAway
                    );

                    return (
                      <g key={`pt-${idx}`}>
                        <circle
                          cx={x}
                          cy={y}
                          r="4.2"
                          fill={isAway && areColorsSimilar ? '#ffffff' : color}
                          stroke={color}
                          strokeWidth="1.8"
                        />
                        <text
                          x={x + labelOffsetX}
                          y={y + labelOffsetY}
                          textAnchor="middle"
                          fontSize="9"
                          fontFamily={SVG_FONT_MONO}
                          fontWeight="700"
                          fill={color}
                        >
                          {idx === 3 ? String(Math.round(val)) : val.toFixed(2)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {(!hasXgot || ((m05Home?.own_goals_for ?? 0) > 0 || (m05Away?.own_goals_for ?? 0) > 0)) && (
        <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between font-mono text-[9.5px] text-slate-400">
          <span>{!hasXgot ? ms.module05.xgotMissingNote : ''}</span>
          {((m05Home?.own_goals_for ?? 0) > 0 || (m05Away?.own_goals_for ?? 0) > 0) && (
            <span className="text-slate-600">
              {ms.module05.ownGoalNote(
                (m05Home?.own_goals_for ?? 0) + (m05Away?.own_goals_for ?? 0)
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
