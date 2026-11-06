import React, { useState } from 'react';
import { ScoutingTranslations } from '../../../i18n/scoutingReport';
import { ChanceEvent, AttackingHalfPitchMarkings } from './scoutingFloor02Utils';

export interface PitchChancesCardProps {
  playerName: string;
  chancesList: ChanceEvent[];
  bigChancesCount: number;
  chancesCount: number;
  assistsCount: number;
  t: ScoutingTranslations;
}

export const PitchChancesCard: React.FC<PitchChancesCardProps> = ({
  playerName,
  chancesList,
  bigChancesCount,
  chancesCount,
  assistsCount,
  t,
}) => {
  const [hoveredChance, setHoveredChance] = useState<ChanceEvent | null>(null);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 flex flex-col justify-between shadow-sm h-full">
      <div className="flex flex-col items-center justify-center text-center mb-2 gap-0.5">
        <div className="font-sans font-semibold text-slate-800 text-[12px] tracking-normal normal-case">
          {playerName} — {t.floor2.chancesTitle}
        </div>
        <p className="text-[10.5px] font-medium text-slate-500 font-sans mt-0.5">
          {t.floor2.chancesSubtitle(bigChancesCount, chancesCount, assistsCount)}
        </p>
        <div className="flex items-center justify-center gap-3 mt-1 text-[9px] text-slate-600 font-medium">
          <span>
            <span className="inline-block w-2.5 h-0.5 bg-emerald-500 mr-1 align-middle" />
            {t.floor2.openPlay}
          </span>
          <span>
            <span className="inline-block w-2.5 h-0.5 border-t border-dashed border-cyan-500 mr-1 align-middle" />
            {t.floor2.cross}
          </span>
          <span>
            <span className="inline-block w-2.5 h-0.5 bg-teal-400 mr-1 align-middle" />
            {t.floor2.setPlay}
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1 align-middle" />
            {t.floor2.assist}
          </span>
        </div>
      </div>

      <div className="relative w-full aspect-[70/56] max-w-[225px] mx-auto overflow-visible">
        <svg viewBox="-1 -2.5 70 56" className="w-full h-full block pointer-events-auto overflow-visible">
          <defs>
            <marker
              id="chance-arrow-emerald"
              viewBox="0 0 3 3"
              refX="2"
              refY="1.5"
              markerWidth="3"
              markerHeight="3"
              orient="auto-start-reverse"
            >
              <path d="M 0 0.5 L 2.5 1.5 L 0 2.5 z" fill="#10B981" />
            </marker>
            <marker
              id="chance-arrow-cyan"
              viewBox="0 0 3 3"
              refX="2"
              refY="1.5"
              markerWidth="3"
              markerHeight="3"
              orient="auto-start-reverse"
            >
              <path d="M 0 0.5 L 2.5 1.5 L 0 2.5 z" fill="#06B6D4" />
            </marker>
            <marker
              id="chance-arrow-teal"
              viewBox="0 0 3 3"
              refX="2"
              refY="1.5"
              markerWidth="3"
              markerHeight="3"
              orient="auto-start-reverse"
            >
              <path d="M 0 0.5 L 2.5 1.5 L 0 2.5 z" fill="#14B8A6" />
            </marker>
            <marker
              id="chance-arrow-assist"
              viewBox="0 0 3 3"
              refX="2"
              refY="1.5"
              markerWidth="3"
              markerHeight="3"
              orient="auto-start-reverse"
            >
              <path d="M 0 0.5 L 2.5 1.5 L 0 2.5 z" fill="#EAB308" />
            </marker>
          </defs>

          <AttackingHalfPitchMarkings />

          {/* Chance Vectors */}
          {[...chancesList]
            .sort((a, b) => (a.isAssist === b.isAssist ? 0 : a.isAssist ? 1 : -1))
            .map((chance) => {
              const rawXStart = (1.0 - chance.y_start / 100) * 68;
              const rawYStart = (1.0 - chance.x_start / 100) * 105;
              const rawXEnd = (1.0 - chance.y_end / 100) * 68;
              const rawYEnd = (1.0 - chance.x_end / 100) * 105;

              const xStart = Math.max(2.0, Math.min(66.0, rawXStart));
              const yStart = Math.max(2.0, Math.min(51.0, rawYStart));
              const xEnd = Math.max(2.0, Math.min(66.0, rawXEnd));
              const yEnd = Math.max(2.0, Math.min(51.0, rawYEnd));

              const isHovered = hoveredChance?.id === chance.id;

              let strokeColor = '#10B981';
              let markerId = 'url(#chance-arrow-emerald)';
              let isDashed = false;
              let strokeWidth = 0.6;

              if (chance.isAssist) {
                strokeColor = '#EAB308';
                markerId = 'url(#chance-arrow-assist)';
                strokeWidth = 0.8;
              } else if (chance.type === 'Cross') {
                strokeColor = '#06B6D4';
                markerId = 'url(#chance-arrow-cyan)';
                isDashed = true;
                strokeWidth = 0.6;
              } else if (chance.type === 'Set Play') {
                strokeColor = '#14B8A6';
                markerId = 'url(#chance-arrow-teal)';
                strokeWidth = 0.6;
              }

              return (
                <g key={chance.id} className="cursor-pointer">
                  <line
                    x1={xStart}
                    y1={yStart}
                    x2={xEnd}
                    y2={yEnd}
                    stroke="transparent"
                    strokeWidth="3.5"
                    onMouseEnter={() => setHoveredChance(chance)}
                    onMouseLeave={() => setHoveredChance(null)}
                  />
                  <circle cx={xStart} cy={yStart} r="0.6" fill={strokeColor} fillOpacity={isHovered ? 1 : 0.8} />
                  <line
                    x1={xStart}
                    y1={yStart}
                    x2={xEnd}
                    y2={yEnd}
                    stroke={strokeColor}
                    strokeWidth={isHovered ? strokeWidth + 0.25 : strokeWidth}
                    strokeDasharray={isDashed ? '1.5,1.5' : undefined}
                    strokeOpacity={isHovered ? 1 : 0.85}
                    markerEnd={markerId}
                    pointerEvents="none"
                  />
                  {chance.isAssist && (
                    <circle
                      cx={xEnd}
                      cy={yEnd}
                      r={isHovered ? 1.5 : 1.2}
                      fill="#EAB308"
                      stroke="#CA8A04"
                      strokeWidth="0.4"
                      onMouseEnter={() => setHoveredChance(chance)}
                      onMouseLeave={() => setHoveredChance(null)}
                    />
                  )}
                </g>
              );
            })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredChance && (() => {
          const rawXEnd = (1.0 - hoveredChance.y_end / 100) * 68;
          const rawYEnd = (1.0 - hoveredChance.x_end / 100) * 105;
          const xEnd = Math.max(2.0, Math.min(66.0, rawXEnd));
          const yEnd = Math.max(2.0, Math.min(51.0, rawYEnd));

          const leftPct = Math.max(12, Math.min(88, (xEnd / 68) * 100));
          const topPct = Math.max(6, Math.min(92, (yEnd / 52.5) * 100));

          return (
            <div
              className="absolute z-30 transform -translate-x-1/2 -translate-y-full mb-1 text-[9px] bg-slate-900/90 text-white px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap flex items-center gap-1 border border-slate-700/80"
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            >
              <span
                className={
                  hoveredChance.isAssist ? 'text-amber-300 font-semibold' : 'text-emerald-400 font-medium'
                }
              >
                {t.floor2.chanceTypes[hoveredChance.type] || hoveredChance.type}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-200">
                {t.floor2.chanceRecipients[hoveredChance.recipient || 'Pass'] ||
                  hoveredChance.recipient ||
                  'Pass'}
              </span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-slate-300">xA: {(hoveredChance.xa || 0.05).toFixed(2)}</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default PitchChancesCard;
