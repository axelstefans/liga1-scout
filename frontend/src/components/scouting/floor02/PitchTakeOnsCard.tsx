import React, { useState } from 'react';
import { PlayerDribble } from '../../../services/api';
import { ScoutingTranslations } from '../../../i18n/scoutingReport';
import { AttackingHalfPitchMarkings } from './scoutingFloor02Utils';

export interface PitchTakeOnsCardProps {
  playerName: string;
  takeOnsList: PlayerDribble[];
  successfulCount: number;
  totalTakeOns: number;
  successPct: number;
  t: ScoutingTranslations;
}

export const PitchTakeOnsCard: React.FC<PitchTakeOnsCardProps> = ({
  playerName,
  takeOnsList,
  successfulCount,
  totalTakeOns,
  successPct,
  t,
}) => {
  const [hoveredDribble, setHoveredDribble] = useState<PlayerDribble | null>(null);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 flex flex-col justify-between shadow-sm h-full">
      <div className="flex flex-col items-center justify-center text-center mb-2 gap-0.5">
        <div className="font-sans font-semibold text-slate-800 text-[12px] tracking-normal normal-case">
          {playerName} — {t.floor2.takeOnsTitle}
        </div>
        <p className="text-[10.5px] font-medium text-slate-500 font-sans mt-0.5">
          {t.floor2.takeOnsSubtitle(successfulCount, totalTakeOns, successPct)}
        </p>
        <div className="flex items-center justify-center gap-4 mt-1 text-[10px] text-slate-600 font-medium">
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 align-middle" />
            {t.floor2.successful}
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1.5 align-middle" />
            {t.floor2.unsuccessful}
          </span>
        </div>
      </div>

      <div className="relative w-full aspect-[70/56] max-w-[225px] mx-auto overflow-visible">
        <svg viewBox="-1 -2.5 70 56" className="w-full h-full block pointer-events-auto overflow-visible">
          <defs>
            <marker
              id="dribble-arrow-emerald"
              viewBox="0 0 3 3"
              refX="2"
              refY="1.5"
              markerWidth="3"
              markerHeight="3"
              orient="auto-start-reverse"
            >
              <path d="M 0 0.5 L 2.5 1.5 L 0 2.5 z" fill="#10B981" />
            </marker>
          </defs>

          <AttackingHalfPitchMarkings />

          {/* Take-on Vectors */}
          {[...takeOnsList]
            .sort((a, b) => (a.is_successful === b.is_successful ? 0 : a.is_successful ? 1 : -1))
            .map((d, idx) => {
              const rawX = d.x ?? 50;
              const rawY = d.y ?? 50;

              const rawXStart = (1.0 - rawY / 100) * 68;
              const rawYStart = (1.0 - rawX / 100) * 105;

              const lateralProg = rawXStart < 34 ? 1.5 : -1.5;
              const rawXEnd =
                (d as any).end_y != null ? (1.0 - (d as any).end_y / 100) * 68 : rawXStart + lateralProg;

              const vertProg = d.is_successful ? 4.2 : 2.5;
              const rawYEnd =
                (d as any).end_x != null ? (1.0 - (d as any).end_x / 100) * 105 : rawYStart - vertProg;

              const xStart = Math.max(2.0, Math.min(66.0, rawXStart));
              const yStart = Math.max(2.0, Math.min(51.0, rawYStart));
              const xEnd = Math.max(2.0, Math.min(66.0, rawXEnd));
              const yEnd = Math.max(2.0, Math.min(51.0, rawYEnd));

              const isHovered = (hoveredDribble && hoveredDribble.id === d.id) || hoveredDribble === d;

              if (d.is_successful) {
                return (
                  <g key={`takeon-${d.id || idx}`} className="cursor-pointer">
                    <line
                      x1={xStart}
                      y1={yStart}
                      x2={xEnd}
                      y2={yEnd}
                      stroke="transparent"
                      strokeWidth="3.5"
                      onMouseEnter={() => setHoveredDribble(d)}
                      onMouseLeave={() => setHoveredDribble(null)}
                    />
                    <circle cx={xStart} cy={yStart} r="0.6" fill="#10B981" fillOpacity={isHovered ? 1 : 0.8} />
                    <line
                      x1={xStart}
                      y1={yStart}
                      x2={xEnd}
                      y2={yEnd}
                      stroke="#10B981"
                      strokeWidth={isHovered ? 0.9 : 0.65}
                      strokeOpacity={isHovered ? 1 : 0.85}
                      markerEnd="url(#dribble-arrow-emerald)"
                      pointerEvents="none"
                    />
                    <circle
                      cx={xEnd}
                      cy={yEnd}
                      r={isHovered ? 1.2 : 0.9}
                      fill="#10B981"
                      stroke="#047857"
                      strokeWidth="0.3"
                      onMouseEnter={() => setHoveredDribble(d)}
                      onMouseLeave={() => setHoveredDribble(null)}
                    />
                  </g>
                );
              }

              return (
                <g key={`takeon-${d.id || idx}`} className="cursor-pointer">
                  <line
                    x1={xStart}
                    y1={yStart}
                    x2={xEnd}
                    y2={yEnd}
                    stroke="transparent"
                    strokeWidth="3.5"
                    onMouseEnter={() => setHoveredDribble(d)}
                    onMouseLeave={() => setHoveredDribble(null)}
                  />
                  <circle cx={xStart} cy={yStart} r="0.6" fill="#F43F5E" fillOpacity={isHovered ? 1 : 0.75} />
                  <line
                    x1={xStart}
                    y1={yStart}
                    x2={xEnd}
                    y2={yEnd}
                    stroke="#F43F5E"
                    strokeWidth={isHovered ? 0.85 : 0.6}
                    strokeDasharray="1.5,1.5"
                    strokeOpacity={isHovered ? 1 : 0.75}
                    pointerEvents="none"
                  />
                  <circle
                    cx={xEnd}
                    cy={yEnd}
                    r={isHovered ? 1.1 : 0.8}
                    fill="#F43F5E"
                    stroke="#BE123C"
                    strokeWidth="0.3"
                    onMouseEnter={() => setHoveredDribble(d)}
                    onMouseLeave={() => setHoveredDribble(null)}
                  />
                </g>
              );
            })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredDribble && (() => {
          const rawX = hoveredDribble.x ?? 50;
          const rawY = hoveredDribble.y ?? 50;
          const x = Math.max(2.0, Math.min(66.0, (1.0 - rawY / 100) * 68));
          const y = Math.max(2.0, Math.min(51.0, (1.0 - rawX / 100) * 105));

          const leftPct = Math.max(12, Math.min(88, (x / 68) * 100));
          const topPct = Math.max(6, Math.min(92, (y / 52.5) * 100));

          const outcomeText = hoveredDribble.is_successful ? t.floor2.successful : t.floor2.unsuccessful;
          const minuteText = (hoveredDribble as any).minute
            ? `${(hoveredDribble as any).minute}'`
            : t.floor2.takeOnFallback;

          return (
            <div
              className="absolute z-30 transform -translate-x-1/2 -translate-y-full mb-1 text-[9px] bg-slate-900/90 text-white px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap flex items-center gap-1 border border-slate-700/80"
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            >
              <span
                className={
                  hoveredDribble.is_successful ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-medium'
                }
              >
                {outcomeText}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-200">{minuteText}</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default PitchTakeOnsCard;
