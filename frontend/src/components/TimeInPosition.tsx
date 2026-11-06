import React, { useMemo } from 'react';
import { PlayerMatchStats } from '../services/api';
import { ScoutingLang, TRANSLATIONS } from '../i18n/scoutingReport';

interface TimeInPositionProps {
  matchStats: PlayerMatchStats[] | undefined;
  themeColor?: string;
  title?: string;
  titleClassName?: string;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  playerName?: string;
  minPctThreshold?: number;
  lang?: ScoutingLang;
}

const VERTICAL_POSITION_COORDS: Record<string, { x: number; y: number }> = {
  // Goalkeeper
  GK: { x: 100, y: 285 },
  G: { x: 100, y: 285 },

  // Defenders (defending at bottom: Y = 242)
  LB: { x: 36, y: 242 },
  LCB: { x: 68, y: 242 },
  CB: { x: 100, y: 242 },
  RCB: { x: 132, y: 242 },
  RB: { x: 164, y: 242 },
  D: { x: 100, y: 242 },
  CD: { x: 100, y: 242 },

  // Wingbacks & Defensive Midfielders
  LWB: { x: 36, y: 168 },
  RWB: { x: 164, y: 168 },
  LDM: { x: 68, y: 205 },
  CDM: { x: 100, y: 205 },
  RDM: { x: 132, y: 205 },
  DM: { x: 100, y: 205 },

  // Central Midfielders & Wide Midfielders
  LM: { x: 36, y: 115 },
  LCM: { x: 68, y: 155 },
  CM: { x: 100, y: 155 },
  M: { x: 100, y: 155 },
  RCM: { x: 132, y: 155 },
  RM: { x: 164, y: 115 },

  // Attacking Midfielders
  LAM: { x: 68, y: 105 },
  CAM: { x: 100, y: 105 },
  RAM: { x: 132, y: 105 },
  AM: { x: 100, y: 105 },

  // Forwards & Wingers (attacking at top: Y = 50 - 60)
  LW: { x: 36, y: 60 },
  LS: { x: 68, y: 55 },
  CF: { x: 100, y: 50 },
  ST: { x: 100, y: 50 },
  F: { x: 100, y: 50 },
  RS: { x: 132, y: 55 },
  RW: { x: 164, y: 60 },
};

const POSITION_ALIASES: Record<string, string> = {
  CD: 'CB',
  CF: 'ST',
};

const GENERIC_POSITIONS = new Set(['D', 'M', 'F', 'G']);

const MIN_PCT_THRESHOLD = 8;

const getSphereRadius = (pct: number) => {
  const clamped = Math.max(1, Math.min(100, pct));
  return 10.2 + Math.sqrt(clamped / 100) * 5.0; // Rango: 11.2px (4%) hasta 14.2px (65%) y 15.2px (100%)
};

const getSphereOpacity = (pct: number, isPrimary: boolean) => {
  if (isPrimary || pct >= 50) return 0.95;
  return Math.max(0.30, Math.min(0.85, 0.25 + (pct / 100) * 0.65));
};

const TimeInPosition: React.FC<TimeInPositionProps> = ({
  matchStats,
  themeColor,
  title,
  className,
  playerName,
  minPctThreshold = MIN_PCT_THRESHOLD,
  lang = 'en',
}) => {
  const t1 = TRANSLATIONS[lang].floor1;
  const resolvedTitle = title ?? t1.timeInPositionTitle;
  const formatPos = (pos: string) => t1.posAbbr[pos] || pos;

  const { positionStats, pitchStats, totalMinutes } = useMemo(() => {
    if (!matchStats || matchStats.length === 0) {
      // Graceful fallback for Marco Huamán / demo mode
      const demoPitch = [
        { pos: 'LB', mins: 1499, pct: 70.08 },
        { pos: 'LWB', mins: 360, pct: 16.83 },
        { pos: 'RB', mins: 270, pct: 12.62 },
      ];
      return {
        positionStats: [
          { pos: 'LB', mins: 1499, pct: 70 },
          { pos: 'LWB', mins: 360, pct: 17 },
          { pos: 'RB', mins: 270, pct: 13 },
        ],
        pitchStats: demoPitch,
        totalMinutes: 2139,
      };
    }

    let totalSeasonMins = 0;
    const minsByPos: Record<string, number> = {};

    matchStats.forEach((m) => {
      if (m.position && m.minutes_played) {
        let pos = m.position.toUpperCase().trim();
        if (POSITION_ALIASES[pos]) {
          pos = POSITION_ALIASES[pos];
        }
        minsByPos[pos] = (minsByPos[pos] || 0) + m.minutes_played;
        totalSeasonMins += m.minutes_played;
      }
    });

    if (totalSeasonMins === 0) {
      return {
        positionStats: [],
        pitchStats: [],
        totalMinutes: 0,
      };
    }

    // 1. Calculate genuine season-share percentages strictly relative to totalSeasonMins
    const rawStats = Object.entries(minsByPos)
      .map(([pos, mins]) => ({
        pos,
        mins,
        pct: (mins / totalSeasonMins) * 100,
      }))
      .sort((a, b) => b.mins - a.mins);

    // 2. Pitch SVG: all positions with recognizable tactical coordinates
    const validPitchStats = rawStats.filter((stat) => {
      if (GENERIC_POSITIONS.has(stat.pos)) return false;
      const coords = VERTICAL_POSITION_COORDS[stat.pos];
      return coords !== undefined && coords !== null;
    });

    // 3. Bottom table: tactical positions with pctSeason >= minPctThreshold (fallback #1, max 5)
    const tacticalRoles = rawStats.filter((stat) => !GENERIC_POSITIONS.has(stat.pos));
    const qualified = tacticalRoles.filter((stat) => stat.pct >= (minPctThreshold ?? MIN_PCT_THRESHOLD));
    const selectedRoles = (qualified.length > 0 ? qualified : tacticalRoles.slice(0, 1)).slice(0, 5);

    // 4. Hare-Niemeyer normalization (Largest Remainder Method) over sumQualifiedMins
    const sumQualifiedMins = selectedRoles.reduce((sum, r) => sum + r.mins, 0);
    let tableStats: Array<{ pos: string; mins: number; pct: number }> = [];

    if (sumQualifiedMins > 0) {
      if (selectedRoles.length === 1) {
        tableStats = [{ pos: selectedRoles[0].pos, mins: selectedRoles[0].mins, pct: 100 }];
      } else {
        const rawShares = selectedRoles.map((r) => (r.mins / sumQualifiedMins) * 100);
        const floors = rawShares.map(Math.floor);
        const remainder = 100 - floors.reduce((a, b) => a + b, 0);

        const remaindersWithMeta = rawShares
          .map((share, idx) => ({
            rem: share - floors[idx],
            mins: selectedRoles[idx].mins,
            idx,
          }))
          .sort((a, b) => {
            if (Math.abs(b.rem - a.rem) > 1e-6) {
              return b.rem - a.rem;
            }
            return b.mins - a.mins;
          });

        const adjustedPcts = [...floors];
        for (let i = 0; i < remainder; i++) {
          adjustedPcts[remaindersWithMeta[i].idx] += 1;
        }

        tableStats = selectedRoles.map((r, idx) => ({
          pos: r.pos,
          mins: r.mins,
          pct: adjustedPcts[idx],
        }));
      }
    }

    return {
      positionStats: tableStats,
      pitchStats: validPitchStats,
      totalMinutes: totalSeasonMins,
    };
  }, [matchStats, minPctThreshold]);

  const topStats = positionStats;
  const primaryColor = themeColor || '#1e3a8a';

  return (
    <div className={className || 'w-full h-full flex-1 flex flex-col gap-[8px] min-h-0'}>
      {/* Top Card (Pitch - 3/4 vertical proportion) */}
      <div className="bg-[#fafafa] border border-[#e0e0e0] rounded-[6px] p-2 flex-[3] flex flex-col justify-between min-h-0">
        {/* Header */}
        <div className="px-1">
          <div className="text-xs font-bold text-slate-900 text-center">
            {playerName ? `${playerName} — ${t1.timeInPositionTitle}` : resolvedTitle}
          </div>
          <div className="text-[10px] text-slate-500 text-center mb-1">
            {t1.minutesAcrossPositions(totalMinutes.toLocaleString(), pitchStats.length)}
          </div>
        </div>

        {pitchStats.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-xs text-slate-400">{t1.noPositionalData}</p>
          </div>
        ) : (
          /* Pitch SVG (viewBox="0 0 200 310") */
          <svg viewBox="0 0 200 310" className="w-full h-full flex-1 min-h-0 object-contain select-none">
            {/* Outer boundary with tactical turf fill #F5F7F4 */}
            <rect x="6" y="6" width="188" height="298" rx="3" fill="#F5F7F4" stroke="#1e293b" strokeWidth="1.1" />

            {/* Pitch Halfway Line, Center Circle & Center Spot */}
            <line x1="6" y1="155" x2="194" y2="155" stroke="#1e293b" strokeWidth="1.1" />
            <circle cx="100" cy="155" r="26" stroke="#1e293b" strokeWidth="1.1" fill="none" />
            <circle cx="100" cy="155" r="1.5" fill="#1e293b" />

            {/* Attacking Penalty Area & Goal Area (Top: Y = 6 to 54) */}
            <rect x="45" y="6" width="110" height="48" fill="none" stroke="#1e293b" strokeWidth="1.1" />
            <rect x="73" y="6" width="54" height="18" fill="none" stroke="#1e293b" strokeWidth="1.1" />
            <path d="M 82 54 A 20 20 0 0 0 118 54" stroke="#1e293b" strokeWidth="1.1" fill="none" />

            {/* Defending Penalty Area & Goal Area (Bottom: Y = 250 to 304, Upward Facing D-Arc) */}
            <rect x="45" y="250" width="110" height="54" fill="none" stroke="#1e293b" strokeWidth="1.1" />
            <rect x="73" y="286" width="54" height="18" fill="none" stroke="#1e293b" strokeWidth="1.1" />
            <path d="M 82 250 A 20 20 0 0 1 118 250" stroke="#1e293b" strokeWidth="1.1" fill="none" />

            {/* Corner Arcs */}
            <path d="M 6 11 A 5 5 0 0 0 11 6" stroke="#1e293b" strokeWidth="1.1" fill="none" />
            <path d="M 189 6 A 5 5 0 0 0 194 11" stroke="#1e293b" strokeWidth="1.1" fill="none" />
            <path d="M 6 299 A 5 5 0 0 1 11 304" stroke="#1e293b" strokeWidth="1.1" fill="none" />
            <path d="M 189 304 A 5 5 0 0 1 194 299" stroke="#1e293b" strokeWidth="1.1" fill="none" />

            {/* Pitch Position Nodes (Concentric 3-Layer Elastic Markers) */}
            {[...pitchStats].reverse().map((stat) => {
              const isPrimary = stat.pos === pitchStats[0]?.pos;
              const coords = VERTICAL_POSITION_COORDS[stat.pos];
              if (!coords) return null;

              const radius = getSphereRadius(stat.pct);
              const secondaryOpacity = getSphereOpacity(stat.pct, isPrimary);
              const displayPos = formatPos(stat.pos);

              return (
                <g key={stat.pos}>
                  {/* Capa 1: Borde exterior fino con color del club */}
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={radius}
                    fill="none"
                    stroke={primaryColor}
                    strokeWidth="0.85"
                    strokeOpacity={isPrimary ? 1.0 : Math.min(0.9, secondaryOpacity + 0.25)}
                  />

                  {/* Capa 2: Aro blanco intermedio separador contiguo */}
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={radius - 0.6}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="0.65"
                  />

                  {/* Capa 3: Núcleo interior con color y opacidad del club */}
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={radius - 1.05}
                    fill={primaryColor}
                    fillOpacity={secondaryOpacity}
                  />

                  {/* Capa 4: Porcentaje con tipografía uniforme fija y contorno negro definido */}
                  <text
                    x={coords.x}
                    y={coords.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#FFFFFF"
                    stroke="#000000"
                    strokeWidth={0.85}
                    strokeLinejoin="round"
                    style={{ paintOrder: 'stroke fill' }}
                    fontSize="7.5"
                    fontWeight="bold"
                    className="select-none pointer-events-none"
                  >
                    {Math.round(stat.pct)}%
                  </text>

                  {/* Capa 5: Código de posición debajo de la esfera */}
                  <text
                    x={coords.x}
                    y={coords.y + radius + 8.2}
                    textAnchor="middle"
                    fill="#1a1d1c"
                    fontWeight="bold"
                    fontSize="7.8"
                    className="select-none pointer-events-none"
                  >
                    {displayPos}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Bottom Card (Minutes List - normalized to 100%, comfortable padding) */}
      {topStats.length > 0 && (
        <div className="bg-[#fafafa] border border-[#e0e0e0] rounded-[6px] p-4 flex-[1] flex flex-col justify-start min-h-0 overflow-hidden">
          {topStats.map((stat) => {
            const displayPos = formatPos(stat.pos);
            return (
              <div
                key={stat.pos}
                className="grid grid-cols-[auto_1fr_auto] gap-3 items-center py-[4px] text-[11px]"
              >
                <span
                  className="w-[24px] h-[24px] rounded-full text-[9px] font-bold flex items-center justify-center font-sans text-white shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {displayPos}
                </span>
                <span className="tabular-nums font-semibold text-[#1a1d1c] text-center">
                  {stat.mins.toLocaleString()}
                </span>
                <span className="tabular-nums text-[#888888] text-right font-medium">
                  {Math.round(stat.pct)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimeInPosition;
