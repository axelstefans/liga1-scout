import React from 'react';
import {
  MatchSheetModule02ChanceBalance,
  MatchSheetModule05TeamStats,
  MatchSheetModule06TeamStats,
  MatchSheetShotItem,
  MatchSheetShotMapModule,
} from '../../services/api';
import { MatchSheet01Translations } from '../../i18n/scoutingReport';
import {
  SVG_FONT_MONO,
  SVG_FONT_SANS,
  buildM02Rows,
  buildM06Rows,
  buildStarPoints,
  computeNiceCountAxis,
  computeNiceXgAxis,
  scalePathToField,
} from './matchReportSheet01Utils';

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

const FP_PEN_DIST = (11.0 / 105.0) * FP_W;
const FP_BOX_LEN = (16.5 / 105.0) * FP_W;
const FP_BOX_WID = (40.32 / 68.0) * FP_H;
const FP_BOX_Y = FP_CENTER_Y - FP_BOX_WID / 2;
const FP_SIX_LEN = (5.5 / 105.0) * FP_W;
const FP_SIX_WID = (18.32 / 68.0) * FP_H;
const FP_SIX_Y = FP_CENTER_Y - FP_SIX_WID / 2;
const FP_CIRCLE_R = (9.15 / 105.0) * FP_W;
const FP_GOAL_WID = (7.32 / 68.0) * FP_H;
const FP_GOAL_Y = FP_CENTER_Y - FP_GOAL_WID / 2;
const FP_ARC_DX = FP_BOX_LEN - FP_PEN_DIST;
const FP_ARC_DY = Math.sqrt(Math.max(0, FP_CIRCLE_R * FP_CIRCLE_R - FP_ARC_DX * FP_ARC_DX));

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

                    {/* Left: Metric label in Sentence case */}
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

                    {/* Center: Parallel stacked bars starting from same origin BAR_X */}
                    <rect x={BAR_X} y="3" width={BAR_MAX_W} height="8" fill="#f1f5f9" />
                    <rect x={BAR_X} y="15" width={BAR_MAX_W} height="8" fill="#f1f5f9" />

                    {/* Home bar (top, solid) */}
                    {hWidth > 0 && (
                      <rect
                        x={BAR_X}
                        y="3"
                        width={hWidth}
                        height="8"
                        fill={homeColor}
                      />
                    )}

                    {/* Away bar (bottom, diagonal hatch pattern) */}
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

                    {/* Right: Figures rigidly aligned in extreme right column */}
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

export interface MappedShotBubble {
  shot: MatchSheetShotItem;
  px: number;
  py: number;
  r: number;
}

export interface HalfPitchShotMapModuleProps {
  matchId: number;
  moduleNumber: string;
  teamName: string;
  teamTri: string;
  teamColor: string;
  isAwayModule: boolean;
  areColorsSimilar: boolean;
  moduleData: MatchSheetShotMapModule | null;
  mappedShots: MappedShotBubble[];
  ms: MatchSheet01Translations;
  onHoverShot: (shot: MatchSheetShotItem | null) => void;
}

export const HalfPitchShotMapModule: React.FC<HalfPitchShotMapModuleProps> = ({
  matchId,
  moduleNumber,
  teamName,
  teamTri: _teamTri,
  teamColor,
  isAwayModule,
  areColorsSimilar,
  moduleData,
  mappedShots,
  ms,
  onHoverShot,
}) => {
  const density = moduleData?.density ?? null;
  const patternId = `shot-hatch-${matchId}-${moduleNumber}`;
  const clipId = `pitch-clip-${matchId}-${isAwayModule ? 'away' : 'home'}-${moduleNumber}`;

  return (
    <div
      className={`col-span-6 flex flex-col justify-between ${
        !isAwayModule ? 'pr-6 border-r border-slate-200' : ''
      }`}
    >
      <div>
        <div className="border-b border-slate-200 pb-2 mb-2.5">
          <h2 className="text-xs font-bold tracking-[0.04em] text-slate-900">
            {moduleNumber} {teamName} · {ms.module0304.shotMapTitle(teamName).includes('tiros') ? 'tiros' : 'shots'}
          </h2>
          <p className="font-mono text-[10px] text-slate-500 mt-0.5">
            {ms.module0304.shotMapSubtitle}
          </p>
        </div>

        {!moduleData ? (
          <div className="h-[240px] flex items-center justify-center font-mono text-xs text-slate-400">
            — {ms.module0304.emptyShots} —
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${SHOT_MAP_VB_W} ${SHOT_MAP_VB_H}`}
            className="w-full h-auto block select-none"
          >
            <defs>
              <pattern
                id={patternId}
                width="5"
                height="5"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="5" stroke={teamColor} strokeWidth="2.2" />
              </pattern>
              <clipPath id={clipId}>
                <rect x={FP_LEFT} y={FP_TOP} width={FP_W} height={FP_H} rx="2" />
              </clipPath>
            </defs>

            {/* Pitch Base */}
            <rect x={FP_LEFT} y={FP_TOP} width={FP_W} height={FP_H} fill="#f8fafc" />

            {/* Smooth vector touch density contours (attacks ->) */}
            {density?.contours && (
              <g clipPath={`url(#${clipId})`}>
                {[...density.contours]
                  .sort((a, b) => a.level - b.level)
                  .map((contour, idx) => {
                    if (!contour.svg_path) return null;
                    const scaledD = scalePathToField(contour.svg_path, FP_LEFT, FP_TOP, FP_W, FP_H);
                    if (!scaledD) return null;
                    const opacity = contour.level <= 0.26 ? 0.08 : contour.level <= 0.51 ? 0.12 : 0.18;
                    return (
                      <path
                        key={`contour-${contour.level}-${idx}`}
                        d={scaledD}
                        fill={teamColor}
                        fillOpacity={opacity}
                        fillRule="evenodd"
                        stroke="none"
                      />
                    );
                  })}
              </g>
            )}

            {/* Full Regulation Pitch Markings unified in #94a3b8 1.2px */}
            <g stroke="#94a3b8" strokeWidth="1.2" fill="none">
              <rect x={FP_LEFT} y={FP_TOP} width={FP_W} height={FP_H} />
              <line x1={FP_CENTER_X} y1={FP_TOP} x2={FP_CENTER_X} y2={FP_BOTTOM} />
              <circle cx={FP_CENTER_X} cy={FP_CENTER_Y} r={FP_CIRCLE_R} />
              <circle cx={FP_CENTER_X} cy={FP_CENTER_Y} r="1.8" fill="#94a3b8" stroke="none" />

              {/* Left Penalty Area & Goal Area (own half) */}
              <rect x={FP_LEFT} y={FP_BOX_Y} width={FP_BOX_LEN} height={FP_BOX_WID} />
              <rect x={FP_LEFT} y={FP_SIX_Y} width={FP_SIX_LEN} height={FP_SIX_WID} />
              <circle cx={FP_LEFT + FP_PEN_DIST} cy={FP_CENTER_Y} r="1.6" fill="#94a3b8" stroke="none" />
              <path
                d={`M ${FP_LEFT + FP_BOX_LEN} ${FP_CENTER_Y - FP_ARC_DY} A ${FP_CIRCLE_R} ${FP_CIRCLE_R} 0 0 1 ${FP_LEFT + FP_BOX_LEN} ${FP_CENTER_Y + FP_ARC_DY}`}
              />

              {/* Right Penalty Area & Goal Area (opponent/attacking half) */}
              <rect x={FP_RIGHT - FP_BOX_LEN} y={FP_BOX_Y} width={FP_BOX_LEN} height={FP_BOX_WID} />
              <rect x={FP_RIGHT - FP_SIX_LEN} y={FP_SIX_Y} width={FP_SIX_LEN} height={FP_SIX_WID} />
              <circle cx={FP_RIGHT - FP_PEN_DIST} cy={FP_CENTER_Y} r="1.6" fill="#94a3b8" stroke="none" />
              <path
                d={`M ${FP_RIGHT - FP_BOX_LEN} ${FP_CENTER_Y - FP_ARC_DY} A ${FP_CIRCLE_R} ${FP_CIRCLE_R} 0 0 0 ${FP_RIGHT - FP_BOX_LEN} ${FP_CENTER_Y + FP_ARC_DY}`}
              />

              {/* External Goals */}
              <rect x={FP_LEFT - 6} y={FP_GOAL_Y} width="6" height={FP_GOAL_WID} fill="#f1f5f9" />
              <rect x={FP_RIGHT} y={FP_GOAL_Y} width="6" height={FP_GOAL_WID} fill="#f1f5f9" />
            </g>

            {/* Shots */}
            {mappedShots.map(({ shot, px, py, r }) => {
              const isGoal = shot.is_goal;
              const isSaved = shot.outcome === 'saved';
              const isBlocked = shot.outcome === 'blocked';
              return (
                <g
                  key={shot.shot_id}
                  className="cursor-pointer"
                  onMouseEnter={() => onHoverShot(shot)}
                  onMouseLeave={() => onHoverShot(null)}
                >
                  {isGoal ? (
                    <g>
                      <circle
                        cx={px}
                        cy={py}
                        r={r}
                        fill={isAwayModule && areColorsSimilar ? `url(#${patternId})` : teamColor}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <polygon
                        points={buildStarPoints(px, py, r * 0.62, r * 0.28)}
                        fill="#ffffff"
                      />
                    </g>
                  ) : isSaved ? (
                    <circle
                      cx={px}
                      cy={py}
                      r={r}
                      fill={isAwayModule && areColorsSimilar ? `url(#${patternId})` : teamColor}
                      fillOpacity={0.8}
                      stroke={teamColor}
                      strokeWidth="1.3"
                    />
                  ) : isBlocked ? (
                    <circle
                      cx={px}
                      cy={py}
                      r={r}
                      fill="#e2e8f0"
                      fillOpacity={0.85}
                      stroke="#475569"
                      strokeWidth="1.2"
                      strokeDasharray="2 1.5"
                    />
                  ) : (
                    <circle
                      cx={px}
                      cy={py}
                      r={r}
                      fill="#ffffff"
                      fillOpacity={0.88}
                      stroke={teamColor}
                      strokeWidth="1.3"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};

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
  const PLOT_H = AXIS_Y - PLOT_T; // 153

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

  // Distribución simétrica de las 4 etapas con sangría equilibrada de 28 px
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
            {/* 1. Guías horizontales de la retícula y valores Y */}
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

            {/* 2. Rótulo vertical del eje Y */}
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

            {/* 3. Estructura de ejes abiertos en L */}
            <line x1={originX} y1={PLOT_T} x2={originX} y2={AXIS_Y} stroke="#cbd5e1" strokeWidth="1" />
            <line x1={originX} y1={AXIS_Y} x2={originX + PLOT_W} y2={AXIS_Y} stroke="#cbd5e1" strokeWidth="1" />

            {/* 4. Guías verticales en las 4 etapas y etiquetas centradas */}
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

            {/* 5. Series y marcadores de equipos */}
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
                    const isCollisionRisk = oppY !== null && Math.abs(y - oppY) < 14;

                    let labelOffsetY: number;
                    let labelOffsetX: number;

                    if (isCollisionRisk) {
                      if (y < oppY!) {
                        labelOffsetY = -8;
                        labelOffsetX = isAway ? 7 : -7;
                      } else if (y > oppY!) {
                        labelOffsetY = 13;
                        labelOffsetX = isAway ? 7 : -7;
                      } else {
                        labelOffsetY = isAway ? 13 : -8;
                        labelOffsetX = isAway ? 8 : -8;
                      }
                    } else {
                      labelOffsetY = isAway ? (y > AXIS_Y - 16 ? -8 : 12) : -7;
                      labelOffsetX = isAway ? 7 : -7;
                    }

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
  const leftPadding = gridStep * 0.35; // Sangría fina del 35%

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
              {/* 1. Retícula interna tenue */}
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

              {/* 2. Ejes abiertos en L */}
              <line x1={originX} y1={22} x2={originX} y2={AXIS_Y} stroke="#cbd5e1" strokeWidth="1" />
              <line x1={originX} y1={AXIS_Y} x2={originX + PLOT_W} y2={AXIS_Y} stroke="#cbd5e1" strokeWidth="1" />

              {/* 3. Filas: Dumbbells, Marcadores y Textos con Lógica Anti-Colisión */}
              {m06Rows.map((row, idx) => {
                const rowY = ROW_START_Y + idx * ROW_STEP_Y;
                const hNull = row.homeVal === null || row.homeVal === undefined;
                const aNull = row.awayVal === null || row.awayVal === undefined;
                const hx = !hNull ? getX(row.homeVal) : getX(0);
                const ax = !aNull ? getX(row.awayVal) : getX(0);
                const delta = ax - hx;

                // Anti-fusión de glifos: separación mínima garantizada de 9 px
                let renderHx = hx;
                let renderAx = ax;
                if (Math.abs(delta) < 9) {
                  const shift = (9 - Math.abs(delta)) / 2;
                  renderHx = hx - (delta >= 0 ? shift : -shift);
                  renderAx = ax + (delta >= 0 ? shift : -shift);
                }

                // Desvío horizontal de cifras numéricas próximas (< 12 px)
                let labelHx = renderHx;
                let labelAx = renderAx;
                if (Math.abs(delta) < 12) {
                  if ((row.homeVal ?? 0) < (row.awayVal ?? 0)) {
                    labelHx = renderHx - 3;
                    labelAx = renderAx + 3;
                  } else if ((row.homeVal ?? 0) > (row.awayVal ?? 0)) {
                    labelHx = renderHx + 3;
                    labelAx = renderAx - 3;
                  } else {
                    labelHx = renderHx - 4;
                    labelAx = renderAx + 4;
                  }
                }

                return (
                  <g key={`m06-row-${row.key}`}>
                    {/* Conector horizontal */}
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
                    {/* Cuadrado visitante (fondo) */}
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
                    {/* Local: Círculo r=4.5 con borde blanco */}
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
                    {/* Categoría alineada a la derecha en originX - 14 */}
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
                    {/* Cifra local arriba */}
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
                    {/* Cifra visitante abajo */}
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

              {/* 4. Ticks del Eje X */}
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

              {/* 5. Rótulo inferior del Eje X («Shots» / i18n) */}
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
