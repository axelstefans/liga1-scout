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

const POSITION_COORDS: Record<string, { x: number, y: number }> = {
  // Arquero
  'GK': { x: 30, y: 130 },
  'G': { x: 30, y: 130 },

  // Defensores (Banda Izquierda arriba y Banda Derecha abajo)
  'LB': { x: 80, y: 45 },
  'LCB': { x: 70, y: 70 },
  'CB': { x: 65, y: 130 },
  'RCB': { x: 70, y: 190 },
  'RB': { x: 80, y: 215 },
  'D': { x: 70, y: 130 },

  // Mediocampistas Defensivos
  'LDM': { x: 140, y: 85 },
  'CDM': { x: 130, y: 130 },
  'RDM': { x: 140, y: 175 },

  // Mediocampistas Centrales y Carrileros
  'LWB': { x: 150, y: 35 },
  'LM': { x: 200, y: 35 },
  'LCM': { x: 190, y: 70 },
  'CM': { x: 180, y: 130 },
  'M': { x: 190, y: 130 },
  'RCM': { x: 190, y: 190 },
  'RM': { x: 200, y: 225 },
  'RWB': { x: 150, y: 225 },

  // Mediocampistas Ofensivos
  'LAM': { x: 250, y: 70 },
  'CAM': { x: 240, y: 130 },
  'RAM': { x: 250, y: 190 },

  // Delanteros y Extremos
  'LW': { x: 310, y: 45 },
  'LS': { x: 330, y: 70 },
  'CF': { x: 320, y: 130 },
  'ST': { x: 340, y: 130 },
  'F': { x: 330, y: 130 },
  'RS': { x: 330, y: 190 },
  'RW': { x: 310, y: 215 },
};

const VERTICAL_POSITION_COORDS: Record<string, { x: number, y: number }> = {
  // Goalkeeper
  'GK': { x: 100, y: 285 },
  'G': { x: 100, y: 285 },

  // Defenders (defending at bottom: Y = 242)
  'LB': { x: 36, y: 242 },
  'LCB': { x: 68, y: 242 },
  'CB': { x: 100, y: 242 },
  'RCB': { x: 132, y: 242 },
  'RB': { x: 164, y: 242 },
  'D': { x: 100, y: 242 },
  'CD': { x: 100, y: 242 },

  // Wingbacks & Defensive Midfielders
  'LWB': { x: 36, y: 168 },
  'RWB': { x: 164, y: 168 },
  'LDM': { x: 68, y: 205 },
  'CDM': { x: 100, y: 205 },
  'RDM': { x: 132, y: 205 },
  'DM': { x: 100, y: 205 },

  // Central Midfielders & Wide Midfielders
  'LM': { x: 36, y: 115 },
  'LCM': { x: 68, y: 155 },
  'CM': { x: 100, y: 155 },
  'M': { x: 100, y: 155 },
  'RCM': { x: 132, y: 155 },
  'RM': { x: 164, y: 115 },

  // Attacking Midfielders
  'LAM': { x: 68, y: 105 },
  'CAM': { x: 100, y: 105 },
  'RAM': { x: 132, y: 105 },
  'AM': { x: 100, y: 105 },

  // Forwards & Wingers (attacking at top: Y = 50 - 60)
  'LW': { x: 36, y: 60 },
  'LS': { x: 68, y: 55 },
  'CF': { x: 100, y: 50 },
  'ST': { x: 100, y: 50 },
  'F': { x: 100, y: 50 },
  'RS': { x: 132, y: 55 },
  'RW': { x: 164, y: 60 },
};

const HORIZONTAL_POSITION_ALIASES: Record<string, string> = {
  'F': 'ST',
  'CF': 'ST',
  'D': 'CB',
  'CD': 'CB',
  'M': 'CM',
  'G': 'GK'
};

const POSITION_ALIASES: Record<string, string> = {
  'CD': 'CB',
  'CF': 'ST',
};

const GENERIC_POSITIONS = new Set(['D', 'M', 'F', 'G']);

const TimeInPosition: React.FC<TimeInPositionProps> = ({ 
  matchStats, 
  themeColor,
  title,
  titleClassName = 'font-sans font-semibold text-slate-800 text-[12px] tracking-normal normal-case mb-2',
  className = 'bg-white border border-slate-200 p-3 rounded-lg shadow-2xs',
  orientation = 'horizontal',
  playerName,
  minPctThreshold = 10,
  lang = 'en',
}) => {
  const isVertical = orientation === 'vertical';
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
        totalMinutes: isVertical ? 2139 : 2129,
      };
    }
    
    let totalSeasonMins = 0;
    const minsByPos: Record<string, number> = {};
    const aliases = isVertical ? POSITION_ALIASES : HORIZONTAL_POSITION_ALIASES;
    
    matchStats.forEach(m => {
      if (m.position && m.minutes_played) {
        let pos = m.position.toUpperCase().trim();
        if (aliases[pos]) {
          pos = aliases[pos];
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

    // 2. Cancha SVG: todas las posiciones con coordenadas reconocibles (sin filtro de umbral)
    const validPitchStats = rawStats.filter(stat => {
      if (GENERIC_POSITIONS.has(stat.pos)) return false;
      const coords = isVertical ? VERTICAL_POSITION_COORDS[stat.pos] : POSITION_COORDS[stat.pos];
      return coords !== undefined && coords !== null;
    });

    // 3. Tabla inferior: posiciones tácticas con pctSeason >= minPctThreshold (fallback #1, max 3)
    const tacticalRoles = rawStats.filter(stat => !GENERIC_POSITIONS.has(stat.pos));
    const qualifiedRaw = tacticalRoles.filter(stat => stat.pct >= minPctThreshold);
    const selectedRoles = (qualifiedRaw.length > 0 ? qualifiedRaw : tacticalRoles.slice(0, 1)).slice(0, 3);

    // 4. Normalización Hare-Niemeyer (Largest Remainder Method) sobre sumQualifiedMins
    const sumQualifiedMins = selectedRoles.reduce((sum, r) => sum + r.mins, 0);
    let tableStats: Array<{ pos: string; mins: number; pct: number }> = [];

    if (sumQualifiedMins > 0) {
      if (selectedRoles.length === 1) {
        tableStats = [{ pos: selectedRoles[0].pos, mins: selectedRoles[0].mins, pct: 100 }];
      } else {
        const rawShares = selectedRoles.map(r => (r.mins / sumQualifiedMins) * 100);
        const floors = rawShares.map(Math.floor);
        const remainder = 100 - floors.reduce((a, b) => a + b, 0);

        // Desempate determinista: mayor resto; si empata, mayor minutaje
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
  }, [matchStats, minPctThreshold, isVertical]);

  const top3Stats = positionStats;

  // --------------------------------------------------------------------------
  // VERTICAL ORIENTATION (Two-Card Editorial Structure)
  // --------------------------------------------------------------------------
  if (isVertical) {
    const primaryColor = themeColor || '#1e3a8a';

    return (
      <div className={className || "w-full h-full flex-1 flex flex-col justify-between gap-2.5 min-h-0"}>
        {/* Top Card (Pitch) */}
        <div className="flex-1 flex flex-col justify-between bg-white rounded-xl border border-slate-200/80 p-2.5 pt-2 pb-1 shadow-sm min-h-0">
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
              {/* Outer boundary */}
              <rect x="6" y="6" width="188" height="298" rx="3" fill="#FFFFFF" stroke="#1e293b" strokeWidth="1.1" />

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

              {/* Pitch Position Nodes (Transparent Double-Ring Markers) */}
              {[...pitchStats].reverse().map((stat) => {
                const isPrimary = stat.pos === pitchStats[0]?.pos;
                const coords = VERTICAL_POSITION_COORDS[stat.pos];
                if (!coords) return null;

                // Dynamic radius based on season percentage
                const radius = isPrimary ? 13 : Math.max(9.5, 9.5 + (stat.pct / 100) * 3);
                const secondaryOpacity = Math.max(0.20, Math.min(0.70, 0.20 + (stat.pct / 100) * 0.50));
                const displayPos = formatPos(stat.pos);

                return (
                  <g key={stat.pos}>
                    {/* Layer 1: Thin Outer Ring */}
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={radius + 2}
                      fill="none"
                      stroke={primaryColor}
                      strokeWidth="1.1"
                      strokeOpacity={isPrimary ? 1.0 : Math.min(0.8, secondaryOpacity + 0.2)}
                    />

                    {/* Layer 2: Inner Circle (Dominant vs Secondary) */}
                    {isPrimary ? (
                      <>
                        <circle
                          cx={coords.x}
                          cy={coords.y}
                          r={radius}
                          fill={primaryColor}
                          fillOpacity="0.85"
                          stroke={primaryColor}
                          strokeWidth="0.8"
                        />
                        <text
                          x={coords.x}
                          y={coords.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#FFFFFF"
                          stroke="#0F172A"
                          strokeWidth={1.2}
                          strokeLinejoin="round"
                          style={{ paintOrder: 'stroke fill' }}
                          fontWeight="bold"
                          fontSize="7.5"
                          className="font-bold select-none pointer-events-none"
                        >
                          {Math.round(stat.pct)}%
                        </text>
                      </>
                    ) : (
                      <>
                        <circle
                          cx={coords.x}
                          cy={coords.y}
                          r={radius}
                          fill={primaryColor}
                          fillOpacity={secondaryOpacity}
                          stroke={primaryColor}
                          strokeWidth="0.8"
                          strokeOpacity={secondaryOpacity + 0.25}
                        />
                        <text
                          x={coords.x}
                          y={coords.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#FFFFFF"
                          stroke="#0F172A"
                          strokeWidth={1.2}
                          strokeLinejoin="round"
                          style={{ paintOrder: 'stroke fill' }}
                          fontSize="7.5"
                          fontWeight="bold"
                          className="font-bold select-none pointer-events-none"
                        >
                          {Math.round(stat.pct)}%
                        </text>
                      </>
                    )}

                    {/* Layer 3: Label Below the Marker */}
                    <text
                      x={coords.x}
                      y={coords.y + radius + 10}
                      textAnchor="middle"
                      fill="#1e293b"
                      fontWeight="bold"
                      fontSize="7.5"
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

        {/* Bottom Card (Minutes) */}
        {top3Stats.length > 0 && (
          <div className="shrink-0 mt-auto bg-white rounded-xl border border-slate-200/80 p-3 flex flex-col justify-center shadow-sm">
            <div className="space-y-1.5">
              {top3Stats.map((stat) => {
                const displayPos = formatPos(stat.pos);
                return (
                  <div key={stat.pos} className="flex items-center justify-between text-xs py-0.5">
                    <div className="w-12 flex justify-start">
                      <span 
                        className={`w-6 h-6 rounded-full ${displayPos.length > 2 ? 'text-[7.5px] tracking-tight' : 'text-[9.5px]'} font-bold flex items-center justify-center font-sans`}
                        style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
                      >
                        {displayPos}
                      </span>
                    </div>
                    <span className="text-center flex-1 text-xs font-semibold text-slate-800 font-sans">
                      {stat.mins.toLocaleString()}
                    </span>
                    <span className="text-right w-12 text-xs text-slate-500 font-mono">
                      {Math.round(stat.pct)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={titleClassName}>{resolvedTitle}</div>
      
      {positionStats.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-gray-500">{t1.noPositionalData}</p>
        </div>
      ) : (
        <>
          <div className="w-full mx-auto mb-6 mt-4" style={{ maxWidth: '400px' }}>
            <svg viewBox="0 0 400 260" className="w-full h-auto bg-[#f9fafb] rounded-lg overflow-hidden border border-[#cbd5e1]">
              {/* Pitch Lines */}
              <line x1="200" y1="0" x2="200" y2="260" stroke="#cbd5e1" strokeWidth="2" />
              <circle cx="200" cy="130" r="40" stroke="#cbd5e1" strokeWidth="2" fill="none" />
              <circle cx="200" cy="130" r="3" fill="#cbd5e1" />
              
              <rect x="0" y="55" width="65" height="150" stroke="#cbd5e1" strokeWidth="2" fill="none" />
              <rect x="0" y="95" width="20" height="70" stroke="#cbd5e1" strokeWidth="2" fill="none" />
              <path d="M 65 95 A 40 40 0 0 1 65 165" stroke="#cbd5e1" strokeWidth="2" fill="none" />

              <rect x="335" y="55" width="65" height="150" stroke="#cbd5e1" strokeWidth="2" fill="none" />
              <rect x="380" y="95" width="20" height="70" stroke="#cbd5e1" strokeWidth="2" fill="none" />
              <path d="M 335 95 A 40 40 0 0 0 335 165" stroke="#cbd5e1" strokeWidth="2" fill="none" />

              {/* Position Circles */}
              {[...positionStats].reverse().map((stat) => {
                const rank = positionStats.findIndex(s => s.pos === stat.pos);
                const coords = POSITION_COORDS[stat.pos] || POSITION_COORDS['CM']; 
                const isTop3 = rank < 3;
                const opacity = rank === 0 ? 0.95 : rank === 1 ? 0.75 : rank === 2 ? 0.55 : 0.3;
                const displayPos = formatPos(stat.pos);

                return (
                  <g key={stat.pos} opacity={opacity}>
                    {isTop3 ? (
                      <>
                        <circle
                          cx={coords.x}
                          cy={coords.y}
                          r={18}
                          fill="none"
                          stroke="#0f172a"
                          strokeWidth="2"
                        />
                        <circle
                          cx={coords.x}
                          cy={coords.y}
                          r={16}
                          fill={themeColor || "#1e40af"}
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                        <text
                          x={coords.x}
                          y={coords.y}
                          fill="#ffffff"
                          fontSize={10}
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {Math.round(stat.pct)}%
                        </text>
                        <text
                          x={coords.x}
                          y={coords.y + 32}
                          fill="#1e293b"
                          fontSize={10}
                          fontWeight="bold"
                          textAnchor="middle"
                          style={{ textShadow: '1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white' }}
                        >
                          {displayPos}
                        </text>
                      </>
                    ) : (
                      <circle
                        cx={coords.x}
                        cy={coords.y}
                        r={8}
                        fill={themeColor || "#1e40af"}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          
          {/* Strict Top 3 Legend */}
          <div className="flex flex-col gap-2">
            {positionStats.slice(0, 3).map(stat => (
              <div key={stat.pos} className="flex items-center justify-between p-2 bg-cream rounded-md border border-border">
                <div className="flex items-center gap-3">
                  <div className="min-w-[2.5rem] h-8 px-2 flex items-center justify-center rounded-full text-white text-xs font-bold shadow-sm border border-white" style={{ backgroundColor: themeColor || '#1e40af' }}>
                    {formatPos(stat.pos)}
                  </div>
                  <span className="text-gray-500 text-sm font-medium">{stat.mins}&apos;</span>
                </div>
                <div className="font-semibold text-navy-blue">
                  {Math.round(stat.pct)}%
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default TimeInPosition;
