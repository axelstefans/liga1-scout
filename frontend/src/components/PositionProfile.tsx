import React, { useMemo } from 'react';
import { PlayerProfile, PlayerMatchStats } from '../services/api';

interface PositionProfileProps {
  profile: PlayerProfile;
  matchStats?: PlayerMatchStats[];
}

// Map single-letter API positions to standard pitch positions
const primaryPosMap: Record<string, string> = {
  F: 'ST',
  D: 'CB',
  M: 'CM',
  G: 'GK',
};

// Horizontal pitch coordinates (x: 0-400, y: 0-260)
// Goal areas are left (x=0, defense) and right (x=400, attack)
const pitchCoords: Record<string, { x: number; y: number }> = {
  GK: { x: 20, y: 130 },
  CB: { x: 100, y: 130 },
  LCB: { x: 100, y: 70 },
  RCB: { x: 100, y: 190 },
  LB: { x: 100, y: 30 },
  RB: { x: 100, y: 230 },
  LWB: { x: 140, y: 30 },
  RWB: { x: 140, y: 230 },
  CDM: { x: 150, y: 130 },
  LDM: { x: 150, y: 70 },
  RDM: { x: 150, y: 190 },
  CM: { x: 200, y: 130 },
  LCM: { x: 200, y: 80 },
  RCM: { x: 200, y: 180 },
  CAM: { x: 250, y: 130 },
  LAM: { x: 250, y: 70 },
  RAM: { x: 250, y: 190 },
  LM: { x: 220, y: 30 },
  RM: { x: 220, y: 230 },
  LW: { x: 300, y: 30 },
  RW: { x: 300, y: 230 },
  SS: { x: 270, y: 130 },
  CF: { x: 310, y: 130 },
  ST: { x: 300, y: 130 },
};

const PositionProfile: React.FC<PositionProfileProps> = ({ profile, matchStats }) => {
  console.log("profile.position:", profile.position);

  // Resolve primary position label
  const rawPrimaryPos = profile.position || '';
  const mappedPrimaryPos = primaryPosMap[rawPrimaryPos] || rawPrimaryPos;

  // Count positions from matchStats
  const { secondaryPositions, positionPercentages } = useMemo(() => {
    if (!matchStats || matchStats.length === 0) {
      return { secondaryPositions: [], positionPercentages: [] };
    }
    
    const counts: Record<string, number> = {};
    let totalPositions = 0;
    
    matchStats.forEach(match => {
      if (match.position) {
        counts[match.position] = (counts[match.position] || 0) + 1;
        totalPositions++;
      }
    });

    const percentages = Object.entries(counts)
      .map(([pos, count]) => ({
        pos,
        count,
        pct: Math.round((count / totalPositions) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    // Filter to positions appearing >= 2 times, exclude primary position
    const secondary = Object.entries(counts)
      .filter(([pos, count]) => count >= 2 && pos !== mappedPrimaryPos)
      .map(([pos]) => pos);

    return { secondaryPositions: secondary, positionPercentages: percentages };
  }, [matchStats, mappedPrimaryPos]);

  return (
    <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
      <h3 className="text-xl font-display mb-4 text-navy">POSITION PROFILE</h3>
      
      <div className="w-full mx-auto" style={{ maxWidth: '400px' }}>
        <svg viewBox="0 0 400 260" className="w-full h-auto bg-[#1a1f2e] rounded-lg overflow-hidden border-4 border-[#1a1f2e]">
          {/* Pitch Lines */}
          {/* Center line */}
          <line x1="200" y1="0" x2="200" y2="260" stroke="#4a5568" strokeWidth="2" />
          {/* Center circle */}
          <circle cx="200" cy="130" r="40" stroke="#4a5568" strokeWidth="2" fill="none" />
          <circle cx="200" cy="130" r="3" fill="#4a5568" />
          
          {/* Left Penalty Area */}
          <rect x="0" y="55" width="65" height="150" stroke="#4a5568" strokeWidth="2" fill="none" />
          {/* Left Goal Area */}
          <rect x="0" y="95" width="20" height="70" stroke="#4a5568" strokeWidth="2" fill="none" />
          {/* Left D Arc */}
          <path d="M 65 95 A 40 40 0 0 1 65 165" stroke="#4a5568" strokeWidth="2" fill="none" />

          {/* Right Penalty Area */}
          <rect x="335" y="55" width="65" height="150" stroke="#4a5568" strokeWidth="2" fill="none" />
          {/* Right Goal Area */}
          <rect x="380" y="95" width="20" height="70" stroke="#4a5568" strokeWidth="2" fill="none" />
          {/* Right D Arc */}
          <path d="M 335 95 A 40 40 0 0 0 335 165" stroke="#4a5568" strokeWidth="2" fill="none" />

          {/* Secondary Positions */}
          {secondaryPositions.map(pos => {
            const coords = pitchCoords[pos];
            if (!coords) return null;
            return (
              <g key={`sec-${pos}`}>
                <circle cx={coords.x} cy={coords.y} r="12" fill="#38bdf8" opacity="0.6" />
                <text x={coords.x} y={coords.y} fill="white" fontSize="9" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                  {pos}
                </text>
              </g>
            );
          })}

          {/* Primary Position */}
          {mappedPrimaryPos && pitchCoords[mappedPrimaryPos] && (
            <g key={`pri-${mappedPrimaryPos}`}>
              <circle cx={pitchCoords[mappedPrimaryPos].x} cy={pitchCoords[mappedPrimaryPos].y} r="18" fill="#38bdf8" />
              <text x={pitchCoords[mappedPrimaryPos].x} y={pitchCoords[mappedPrimaryPos].y} fill="#0D1B2A" fontSize="12" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                {mappedPrimaryPos}
              </text>
            </g>
          )}
        </svg>
      </div>
      
      {/* Percentage Chips */}
      {positionPercentages.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {positionPercentages.map((p) => (
            <div key={p.pos} className="flex items-center space-x-2 bg-gray-100 rounded-full px-3 py-1 border border-border">
              <span className="w-2 h-2 rounded-full bg-[#38bdf8]"></span>
              <span className="text-xs font-bold text-navy">{p.pos}</span>
              <span className="text-xs text-gray-500">{p.pct}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs">
          {mappedPrimaryPos && (
            <div className="flex items-center space-x-1">
              <span className="w-3 h-3 rounded-full bg-[#38bdf8]"></span>
              <span className="text-gray-600">Primary Position</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PositionProfile;
