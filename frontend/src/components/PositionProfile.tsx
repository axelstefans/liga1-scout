import React, { useMemo } from 'react';
import { PlayerProfile, PlayerMatchStats } from '../services/api';

interface PositionProfileProps {
  profile: PlayerProfile;
  matchStats?: PlayerMatchStats[];
}

const pitchCoords: Record<string, { x: number; y: number }> = {
  GK: { x: 50, y: 92 },
  CB: { x: 50, y: 75 },
  LCB: { x: 30, y: 75 },
  RCB: { x: 70, y: 75 },
  LB: { x: 15, y: 72 },
  RB: { x: 85, y: 72 },
  LWB: { x: 12, y: 58 },
  RWB: { x: 88, y: 58 },
  CDM: { x: 50, y: 62 },
  LDM: { x: 35, y: 62 },
  RDM: { x: 65, y: 62 },
  CM: { x: 50, y: 50 },
  LCM: { x: 30, y: 50 },
  RCM: { x: 70, y: 50 },
  CAM: { x: 50, y: 38 },
  LAM: { x: 30, y: 38 },
  RAM: { x: 70, y: 38 },
  LM: { x: 15, y: 45 },
  RM: { x: 85, y: 45 },
  LW: { x: 15, y: 25 },
  RW: { x: 85, y: 25 },
  SS: { x: 50, y: 28 },
  CF: { x: 50, y: 18 },
  ST: { x: 50, y: 12 },
};

const PositionProfile: React.FC<PositionProfileProps> = ({ profile, matchStats }) => {
  // Count positions from matchStats
  const secondaryPositions = useMemo(() => {
    if (!matchStats) return [];
    
    const counts: Record<string, number> = {};
    matchStats.forEach(match => {
      if (match.position) {
        counts[match.position] = (counts[match.position] || 0) + 1;
      }
    });

    const primaryPos = profile.position || '';
    
    // Filter to positions appearing >= 2 times, exclude primary position
    return Object.entries(counts)
      .filter(([pos, count]) => count >= 2 && pos !== primaryPos)
      .map(([pos]) => pos);
  }, [matchStats, profile.position]);

  const primaryPos = profile.position;

  return (
    <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
      <h3 className="text-xl font-display mb-4 text-navy">POSITION PROFILE</h3>
      
      <div className="w-full max-w-[280px] mx-auto">
        <svg viewBox="0 0 100 100" className="w-full h-auto bg-[#FAFAF7] rounded border-2" style={{ borderColor: '#1B4F8A' }}>
          {/* Pitch Markings */}
          <line x1="0" y1="50" x2="100" y2="50" stroke="#1B4F8A" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="10" stroke="#1B4F8A" strokeWidth="0.5" fill="none" />
          
          <rect x="25" y="85" width="50" height="15" stroke="#1B4F8A" strokeWidth="0.5" fill="none" />
          <rect x="40" y="94" width="20" height="6" stroke="#1B4F8A" strokeWidth="0.5" fill="none" />
          
          <rect x="25" y="0" width="50" height="15" stroke="#1B4F8A" strokeWidth="0.5" fill="none" />
          <rect x="40" y="0" width="20" height="6" stroke="#1B4F8A" strokeWidth="0.5" fill="none" />

          <path d="M 40 85 A 10 10 0 0 1 60 85" stroke="#1B4F8A" strokeWidth="0.5" fill="none" />
          <path d="M 40 15 A 10 10 0 0 0 60 15" stroke="#1B4F8A" strokeWidth="0.5" fill="none" />

          {/* Secondary Positions */}
          {secondaryPositions.map(pos => {
            const coords = pitchCoords[pos];
            if (!coords) return null;
            return (
              <g key={`sec-${pos}`}>
                <circle cx={coords.x} cy={coords.y} r="7" fill="#9CA3AF" />
                <text x={coords.x} y={coords.y} textAnchor="middle" dy=".3em" fontSize="4" fill="white" fontWeight="bold">
                  {pos}
                </text>
              </g>
            );
          })}

          {/* Primary Position */}
          {primaryPos && pitchCoords[primaryPos] && (
            <g key={`pri-${primaryPos}`}>
              <circle cx={pitchCoords[primaryPos].x} cy={pitchCoords[primaryPos].y} r="12" fill="#0D1B2A" />
              <text x={pitchCoords[primaryPos].x} y={pitchCoords[primaryPos].y} textAnchor="middle" dy=".3em" fontSize="6" fill="white" fontWeight="bold">
                {primaryPos}
              </text>
            </g>
          )}
        </svg>
      </div>
      
      {/* Legend below the pitch */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs">
        {primaryPos && (
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 rounded-full bg-[#0D1B2A]"></span>
            <span className="text-gray-600">Primary</span>
          </div>
        )}
        {secondaryPositions.length > 0 && (
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 rounded-full bg-[#9CA3AF]"></span>
            <span className="text-gray-600">Secondary (2+ matches)</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PositionProfile;
