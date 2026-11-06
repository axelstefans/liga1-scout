import React, { useState } from 'react';
import { PlayerShot } from '../../../services/api';
import { ScoutingTranslations } from '../../../i18n/scoutingReport';
import { AttackingHalfPitchMarkings } from './scoutingFloor02Utils';

export interface PitchShotsCardProps {
  playerName: string;
  shots: PlayerShot[];
  goals: number;
  totalXg: number;
  t: ScoutingTranslations;
}

export const PitchShotsCard: React.FC<PitchShotsCardProps> = ({
  playerName,
  shots,
  goals,
  totalXg,
  t,
}) => {
  const [hoveredShot, setHoveredShot] = useState<PlayerShot | null>(null);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 flex flex-col justify-between shadow-sm h-full">
      <div className="flex flex-col items-center justify-center text-center mb-2 gap-0.5">
        <div className="font-sans font-semibold text-slate-800 text-[12px] tracking-normal normal-case">
          {playerName} — {t.floor2.shotsTitle}
        </div>
        <p className="text-[10.5px] font-medium text-slate-500 font-sans mt-0.5">
          {t.floor2.shotsSubtitle(shots.length, goals, totalXg.toFixed(2))}
        </p>
        <div className="flex items-center justify-center gap-4 mt-1 text-[10px] text-slate-600 font-medium">
          <span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 align-middle" />
            {t.floor2.goal}
          </span>
          <span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 align-middle" />
            {t.floor2.noGoal}
          </span>
        </div>
      </div>

      <div className="relative w-full aspect-[70/56] max-w-[225px] mx-auto overflow-visible">
        <svg viewBox="-1 -2.5 70 56" className="w-full h-full block pointer-events-auto overflow-visible">
          <AttackingHalfPitchMarkings />

          {/* Shot event markers */}
          {[...shots]
            .sort((a, b) => {
              const aIsGoal = (a.shot_type || '').toLowerCase() === 'goal';
              const bIsGoal = (b.shot_type || '').toLowerCase() === 'goal';
              if (aIsGoal === bIsGoal) return 0;
              return aIsGoal ? 1 : -1;
            })
            .map((shot, idx) => {
              const rawY = (shot as any).coord_y ?? shot.y ?? 50;
              const rawX = (shot as any).coord_x ?? shot.x ?? 0;
              const xSvg = Math.max(2.0, Math.min(66.0, (rawY / 100) * 68));
              const ySvg = shot.distance_m
                ? Math.min(Math.max(shot.distance_m, 2), 50)
                : Math.min(Math.max((rawX / 50) * 52.5, 2), 50);

              const xg = shot.calculated_xg || 0.02;
              const isGoal = (shot.shot_type || '').toLowerCase() === 'goal';
              const isHovered = (hoveredShot && hoveredShot.shot_id === shot.shot_id) || hoveredShot === shot;

              if (isGoal) {
                const r = Math.min(1.4 + xg * 4, 3.2);
                return (
                  <circle
                    key={`shot-${shot.shot_id || idx}`}
                    cx={xSvg}
                    cy={ySvg}
                    r={r}
                    fill="#10B981"
                    fillOpacity={isHovered ? 0.95 : 0.75}
                    stroke={isHovered ? '#064E3B' : '#047857'}
                    strokeWidth={isHovered ? 0.8 : 0.45}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredShot(shot)}
                    onMouseLeave={() => setHoveredShot(null)}
                  />
                );
              }

              const r = Math.min(1.1 + xg * 3, 2.2);
              return (
                <circle
                  key={`shot-${shot.shot_id || idx}`}
                  cx={xSvg}
                  cy={ySvg}
                  r={r}
                  fill="#F43F5E"
                  fillOpacity={isHovered ? 0.85 : 0.55}
                  stroke={isHovered ? '#9F1239' : '#BE123C'}
                  strokeWidth={isHovered ? 0.7 : 0.4}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredShot(shot)}
                  onMouseLeave={() => setHoveredShot(null)}
                />
              );
            })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredShot && (() => {
          const rawY = (hoveredShot as any).coord_y ?? hoveredShot.y ?? 50;
          const rawX = (hoveredShot as any).coord_x ?? hoveredShot.x ?? 0;
          const hx = Math.max(2.0, Math.min(66.0, (rawY / 100) * 68));
          const hy = hoveredShot.distance_m
            ? Math.min(Math.max(hoveredShot.distance_m, 2), 50)
            : Math.min(Math.max((rawX / 50) * 52.5, 2), 50);

          const leftPct = Math.min(Math.max((hx / 68) * 100, 18), 82);
          const topPct =
            hy < 9 ? Math.min(((hy + 5) / 52.5) * 100, 88) : Math.max(((hy - 4.5) / 52.5) * 100, 8);

          const isGoal = hoveredShot.shot_type?.toLowerCase() === 'goal';
          const outcomeText = isGoal ? t.floor2.goal : t.floor2.noGoal;
          const xgVal = (hoveredShot.calculated_xg || 0).toFixed(2);
          const distVal = hoveredShot.distance_m ? `${hoveredShot.distance_m.toFixed(1)}m` : 'N/A';
          const bodyPart = hoveredShot.body_part ? hoveredShot.body_part.replace(/_/g, ' ') : null;

          return (
            <div
              className="absolute z-30 transform -translate-x-1/2 -translate-y-1/2 text-[10px] bg-slate-900/90 text-white px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap flex items-center gap-1.5 border border-slate-700/80"
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            >
              <span className={isGoal ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-medium'}>
                {outcomeText}
              </span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-slate-200">{xgVal} xG</span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-slate-300">{distVal}</span>
              {bodyPart && (
                <>
                  <span className="text-slate-500">·</span>
                  <span className="capitalize text-slate-300">{bodyPart}</span>
                </>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default PitchShotsCard;
