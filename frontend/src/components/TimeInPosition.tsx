import React, { useMemo } from 'react';
import { PlayerMatchStats } from '../services/api';

interface TimeInPositionProps {
  matchStats: PlayerMatchStats[] | undefined;
  themeColor?: string;
  title?: string;
  titleClassName?: string;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  playerName?: string;
  minPctThreshold?: number;
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

const POSITION_ALIASES: Record<string, string> = {
  'F': 'ST',
  'CF': 'ST',
  'D': 'CB',
  'CD': 'CB',
  'M': 'CM',
  'G': 'GK'
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0,
  };
};

const TimeInPosition: React.FC<TimeInPositionProps> = ({ 
  matchStats, 
  themeColor,
  title = 'Time in Position',
  titleClassName = 'font-sans font-semibold text-slate-800 text-[12px] tracking-normal normal-case mb-2',
  className = 'bg-white border border-slate-200 p-3 rounded-lg shadow-2xs',
  orientation = 'horizontal',
  playerName,
  minPctThreshold = 10,
}) => {
  const isVertical = orientation === 'vertical';

  const { positionStats, totalMinutes } = useMemo(() => {
    if (!matchStats || matchStats.length === 0) {
      // Graceful fallback for Marco Huamán / demo mode
      return {
        positionStats: [
          { pos: 'LB', mins: 689, pct: 36.86 },
          { pos: 'CB', mins: 640, pct: 34.24 },
          { pos: 'LWB', mins: 360, pct: 19.26 },
        ],
        totalMinutes: 1869,
      };
    }
    
    let totalSeasonMins = 0;
    const minsByPos: Record<string, number> = {};
    
    matchStats.forEach(m => {
      if (m.position && m.minutes_played) {
        let pos = m.position.toUpperCase();
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

    // 2. Global Threshold Filter:
    // Filter out incidental roles where stat.percentage < 10%
    const qualifiedRaw = rawStats.filter(stat => stat.pct >= minPctThreshold);

    // Fallback: Ensure every player always renders at least their #1 primary position
    // Display a maximum of the top 2 or 3 qualified positions
    const qualifiedRoles = (qualifiedRaw.length > 0 ? qualifiedRaw : rawStats.slice(0, 1)).slice(0, 3);

    return {
      positionStats: qualifiedRoles,
      totalMinutes: totalSeasonMins,
    };
  }, [matchStats, minPctThreshold]);

  const top3Stats = positionStats;

  // --------------------------------------------------------------------------
  // VERTICAL ORIENTATION (Michael Olise Clean Editorial Style)
  // --------------------------------------------------------------------------
  if (isVertical) {
    const positionCount = top3Stats.length;
    const activeColor = themeColor || '#4A729D';
    const { r, g, b } = hexToRgb(activeColor);

    return (
      <div className={className || "w-full lg:w-[280px] shrink-0 flex flex-col gap-3 justify-start"}>
        {/* Card Top (Pitch Card) */}
        <div className="bg-white rounded-xl border border-slate-200/90 px-2 pt-2.5 pb-2 shadow-2xs flex flex-col">
          {/* Header */}
          <div className="px-1">
            <div className="text-[12px] font-bold text-slate-800 text-center tracking-tight">
              {playerName ? `${playerName} — Time in Position` : title}
            </div>
            <div className="text-[10px] text-slate-400 text-center mt-0.5">
              {totalMinutes.toLocaleString()} minutes across {positionCount} {positionCount === 1 ? 'position' : 'positions'}
            </div>
          </div>

          {top3Stats.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-xs text-slate-400">No positional data available.</p>
            </div>
          ) : (
            /* Pitch SVG (viewBox="0 0 200 310") */
            <svg viewBox="0 0 200 310" className="w-full h-auto mt-1 select-none">
              {/* Outer boundary */}
              <rect x="6" y="6" width="188" height="298" rx="3" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />

              {/* Pitch Halfway Line, Center Circle & Center Spot */}
              <line x1="6" y1="155" x2="194" y2="155" stroke="#CBD5E1" strokeWidth="1" />
              <circle cx="100" cy="155" r="26" stroke="#CBD5E1" strokeWidth="1" fill="none" />
              <circle cx="100" cy="155" r="1.5" fill="#CBD5E1" />

              {/* Attacking Penalty Area & Goal Area (Top: Y = 6 to 54) */}
              <rect x="45" y="6" width="110" height="48" fill="none" stroke="#CBD5E1" strokeWidth="1" />
              <rect x="73" y="6" width="54" height="18" fill="none" stroke="#CBD5E1" strokeWidth="1" />
              <path d="M 82 54 A 20 20 0 0 0 118 54" stroke="#CBD5E1" strokeWidth="1" fill="none" />

              {/* Defending Penalty Area & Goal Area (Bottom: Y = 250 to 304, Upward Facing D-Arc) */}
              <rect x="45" y="250" width="110" height="54" fill="none" stroke="#CBD5E1" strokeWidth="1" />
              <rect x="73" y="286" width="54" height="18" fill="none" stroke="#CBD5E1" strokeWidth="1" />
              <path d="M 82 250 A 20 20 0 0 1 118 250" stroke="#CBD5E1" strokeWidth="1" fill="none" />

              {/* Corner Arcs */}
              <path d="M 6 11 A 5 5 0 0 0 11 6" stroke="#CBD5E1" strokeWidth="1" fill="none" />
              <path d="M 189 6 A 5 5 0 0 0 194 11" stroke="#CBD5E1" strokeWidth="1" fill="none" />
              <path d="M 6 299 A 5 5 0 0 1 11 304" stroke="#CBD5E1" strokeWidth="1" fill="none" />
              <path d="M 189 304 A 5 5 0 0 1 194 299" stroke="#CBD5E1" strokeWidth="1" fill="none" />

              {/* Pitch Position Nodes (Hugo Siquet Concentric Double-Ring Floating Style) */}
              {[...top3Stats].reverse().map((stat) => {
                const rank = top3Stats.findIndex(s => s.pos === stat.pos);
                const coords = VERTICAL_POSITION_COORDS[stat.pos] || VERTICAL_POSITION_COORDS['CM'];
                const isPrimary = rank === 0;

                // Proportional dynamic radius based on role percentage
                let radius = 14;
                if (!isPrimary) {
                  if (stat.pct < 20) {
                    radius = 10;
                  } else if (stat.pct < 35) {
                    radius = 11;
                  } else {
                    radius = 12;
                  }
                }

                const labelY = coords.y + radius + 13 > 302 
                  ? coords.y - radius - 6 
                  : coords.y + radius + 13;

                return (
                  <g key={stat.pos}>
                    {/* Layer 0: Solid white disc to cleanly mask any underlying pitch lines */}
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={radius + 3}
                      fill="#FFFFFF"
                    />

                    {/* Layer 1: Outermost contour circle (Floating Border) */}
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={radius + 3}
                      fill="none"
                      stroke={activeColor}
                      strokeWidth="1.2"
                      opacity="0.8"
                    />

                    {/* Layer 2: White spacer ring / halo gap */}
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={radius + 1.5}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                    />

                    {/* Layer 3: Main inner core bubble */}
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={radius}
                      fill={isPrimary ? activeColor : `rgba(${r}, ${g}, ${b}, ${stat.pct < 20 ? 0.12 : 0.16})`}
                      stroke={isPrimary ? 'none' : activeColor}
                      strokeWidth="1.2"
                    />

                    {/* Layer 4: INSIDE percentage number, single-line centered */}
                    <text
                      x={coords.x}
                      y={coords.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={isPrimary ? '#FFFFFF' : activeColor}
                      fontSize={isPrimary ? "9" : radius <= 10 ? "8" : "8.5"}
                      fontWeight="bold"
                      fontFamily="sans-serif"
                      className="select-none pointer-events-none"
                    >
                      {Math.round(stat.pct)}%
                    </text>

                    {/* Layer 5: OUTSIDE position label directly underneath outer ring */}
                    <text
                      x={coords.x}
                      y={labelY}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight={isPrimary ? "bold" : "semibold"}
                      fill={isPrimary ? "#334155" : "#64748b"}
                      fontFamily="sans-serif"
                      className="select-none pointer-events-none"
                    >
                      {stat.pos}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Card Bottom (Breakdown Card) */}
        {top3Stats.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col">
            <div className="space-y-1.5">
              {top3Stats.map((stat, idx) => (
                <div key={stat.pos} className="flex items-center justify-between py-1.5 pr-3.5">
                  <div className="w-12 flex justify-start">
                    <span 
                      className="w-7 h-5 rounded-full flex items-center justify-center text-[7.5px] font-bold font-sans"
                      style={
                        idx === 0
                          ? { backgroundColor: activeColor, color: '#ffffff' }
                          : idx === 1
                          ? { backgroundColor: `rgba(${r}, ${g}, ${b}, 0.22)`, color: activeColor }
                          : { backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`, color: activeColor }
                      }
                    >
                      {stat.pos}
                    </span>
                  </div>
                  <span className="text-center flex-1 text-[11px] font-medium text-slate-700 font-sans">
                    {stat.mins.toLocaleString()}
                  </span>
                  <span className="text-right w-12 text-[11px] font-bold text-slate-900 font-mono">
                    {Math.round(stat.pct)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={titleClassName}>{title}</div>
      
      {positionStats.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-gray-500">No positional data available.</p>
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
                          {stat.pos}
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
                    {stat.pos}
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
