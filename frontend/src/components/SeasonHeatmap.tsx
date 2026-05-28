import React, { useMemo } from 'react';
import { usePlayerHeatmap } from '../hooks/usePlayer';

interface SeasonHeatmapProps {
  playerId: number;
}

const SeasonHeatmap: React.FC<SeasonHeatmapProps> = ({ playerId }) => {
  const { data, isLoading, error } = usePlayerHeatmap(playerId);

  const maxCount = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return Math.max(...data.map(d => d.count));
  }, [data]);

  const getRadius = (count: number) => {
    if (maxCount === 0) return 3;
    return 3 + (count / maxCount) * 9; // Scales between 3 and 12
  };

  const getOpacity = (count: number) => {
    if (maxCount === 0) return 0.2;
    return 0.2 + (count / maxCount) * 0.8; // Scales between 0.2 and 1.0
  };

  return (
    <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
      <h3 className="text-xl font-display mb-4 text-navy">SEASON HEATMAP</h3>
      
      {isLoading && (
        <div className="h-64 flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
          <p className="text-sm text-gray-500 text-center">
            Fetching heatmap data...<br />
            <span className="text-xs opacity-75">(This launches an internal scraper and may take a few seconds)</span>
          </p>
        </div>
      )}

      {error && !isLoading && (
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-red-500">Failed to load heatmap data.</p>
        </div>
      )}

      {!isLoading && !error && (!data || data.length === 0) && (
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-gray-500">Heatmap data not available for this player.</p>
        </div>
      )}

      {!isLoading && !error && data && data.length > 0 && (
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

            {/* Heatmap Points */}
            {data.map((point, idx) => {
              // Convert 0-100 scale to 0-400 (x) and 0-260 (y)
              const cx = (point.x / 100) * 400;
              const cy = (point.y / 100) * 260;
              
              return (
                <circle
                  key={`heat-${idx}`}
                  cx={cx}
                  cy={cy}
                  r={getRadius(point.count)}
                  fill="#38bdf8"
                  opacity={getOpacity(point.count)}
                />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};

export default SeasonHeatmap;
