import React, { useMemo } from 'react';
import { PlayerMatchStats } from '../services/api';

interface TimeInPositionProps {
  matchStats: PlayerMatchStats[] | undefined;
}

const POSITION_COORDS: Record<string, { x: number, y: number }> = {
  // Arquero
  'GK': { x: 30, y: 130 },
  'G': { x: 30, y: 130 },

  // Defensores (Banda Izquierda arriba y Banda Derecha abajo)
  'LB': { x: 80, y: 45 },
  'LCB': { x: 70, y: 95 },
  'CB': { x: 65, y: 130 },
  'RCB': { x: 70, y: 165 },
  'RB': { x: 80, y: 215 },
  'D': { x: 70, y: 130 },

  // Mediocampistas Defensivos
  'LDM': { x: 140, y: 85 },
  'CDM': { x: 130, y: 130 },
  'RDM': { x: 140, y: 175 },

  // Mediocampistas Centrales y Carrileros
  'LWB': { x: 150, y: 35 },
  'LM': { x: 200, y: 40 },
  'LCM': { x: 190, y: 95 },
  'CM': { x: 180, y: 130 },
  'M': { x: 190, y: 130 },
  'RCM': { x: 190, y: 165 },
  'RM': { x: 200, y: 220 },
  'RWB': { x: 150, y: 225 },

  // Mediocampistas Ofensivos
  'LAM': { x: 250, y: 85 },
  'CAM': { x: 240, y: 130 },
  'RAM': { x: 250, y: 175 },

  // Delanteros y Extremos
  'LW': { x: 310, y: 45 },
  'LS': { x: 330, y: 95 },
  'CF': { x: 320, y: 130 },
  'ST': { x: 340, y: 130 },
  'F': { x: 330, y: 130 },
  'RS': { x: 330, y: 165 },
  'RW': { x: 310, y: 215 },
};

const TimeInPosition: React.FC<TimeInPositionProps> = ({ matchStats }) => {
  const positionStats = useMemo(() => {
    if (!matchStats) return [];
    
    let totalMinutes = 0;
    const minsByPos: Record<string, number> = {};
    
    matchStats.forEach(m => {
      if (m.position && m.minutes_played) {
        const pos = m.position.toUpperCase();
        minsByPos[pos] = (minsByPos[pos] || 0) + m.minutes_played;
        totalMinutes += m.minutes_played;
      }
    });
    
    if (totalMinutes === 0) return [];
    
    return Object.entries(minsByPos)
      .map(([pos, mins]) => ({
        pos,
        mins,
        pct: (mins / totalMinutes) * 100
      }))
      .sort((a, b) => b.mins - a.mins);
  }, [matchStats]);

  const totalMinutes = positionStats.reduce((sum, stat) => sum + stat.mins, 0);

  return (
    <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
      <h3 className="text-xl font-display text-navy mb-1">TIME IN POSITION</h3>
      
      {positionStats.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-gray-500">No positional data available.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {totalMinutes} minutes across {positionStats.length} positions
          </p>

          <div className="w-full mx-auto mb-6" style={{ maxWidth: '400px' }}>
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
              {positionStats.map((stat, idx) => {
                const coords = POSITION_COORDS[stat.pos] || POSITION_COORDS['CM']; 
                const isTop3 = idx < 3;
                const r = isTop3 ? 16 : 8;
                const opacity = isTop3 ? 0.85 : 0.3;

                return (
                  <g key={stat.pos}>
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={r}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="2"
                      opacity={opacity}
                    />
                    {isTop3 && (
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
                  <div className="w-3 h-3 rounded-full bg-[#ef4444] shadow-sm border border-white"></div>
                  <span className="font-bold text-navy w-8">{stat.pos}</span>
                  <span className="text-gray-500 text-sm">{stat.mins}&apos;</span>
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
