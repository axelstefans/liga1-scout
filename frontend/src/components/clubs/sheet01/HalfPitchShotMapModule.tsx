import React from 'react';
import type { MatchSheetShotItem, MatchSheetShotMapModule } from '../../../services/api';
import type { MatchSheet01Translations } from '../../../i18n/scoutingReport';
import { buildStarPoints, scalePathToField } from '../matchReportSheet01Utils';
import {
  FP_ARC_DY,
  FP_BOTTOM,
  FP_BOX_LEN,
  FP_BOX_WID,
  FP_BOX_Y,
  FP_CENTER_X,
  FP_CENTER_Y,
  FP_CIRCLE_R,
  FP_GOAL_WID,
  FP_GOAL_Y,
  FP_H,
  FP_LEFT,
  FP_PEN_DIST,
  FP_RIGHT,
  FP_SIX_LEN,
  FP_SIX_WID,
  FP_SIX_Y,
  FP_TOP,
  FP_W,
  SHOT_MAP_VB_H,
  SHOT_MAP_VB_W,
  type MappedShotBubble,
} from './sheet01GeometryAndUtils';

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
