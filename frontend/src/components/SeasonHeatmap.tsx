import React, { useMemo } from 'react';
import { usePlayerHeatmap } from '../hooks/usePlayer';

interface SeasonHeatmapProps {
  playerId: number;
}

const SeasonHeatmap: React.FC<SeasonHeatmapProps> = ({ playerId }) => {
  const { data, isLoading, error } = usePlayerHeatmap(playerId);

  const gridCells = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Create a 20x13 grid
    const cols = 20;
    const rows = 13;
    const grid: { x: number, y: number, count: number }[] = [];
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        grid.push({ x, y, count: 0 });
      }
    }

    // Assign points to grid cells
    data.forEach(point => {
      // Convert 0-100 coordinates to grid indices
      let cx = Math.floor((point.x / 100) * cols);
      let cy = Math.floor((point.y / 100) * rows);
      
      // Ensure bounds
      if (cx >= cols) cx = cols - 1;
      if (cy >= rows) cy = rows - 1;
      if (cx < 0) cx = 0;
      if (cy < 0) cy = 0;
      
      const idx = cx * rows + cy;
      grid[idx].count += point.count;
    });

    return grid;
  }, [data]);

  const maxCellCount = useMemo(() => {
    if (gridCells.length === 0) return 0;
    return Math.max(...gridCells.map(c => c.count));
  }, [gridCells]);

  const getCellColor = (count: number) => {
    if (count === 0 || maxCellCount === 0) return 'transparent';
    const ratio = count / maxCellCount;
    if (ratio < 0.33) return 'rgba(59,130,246,0.3)'; // low = blue
    if (ratio < 0.66) return 'rgba(234,179,8,0.7)'; // medium = yellow
    return 'rgba(239,68,68,1.0)'; // high = red
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
            {/* Heatmap Density Grid (Drawn first to be UNDER the pitch lines) */}
            {gridCells.map((cell, idx) => (
              <rect
                key={`cell-${idx}`}
                x={cell.x * 20}
                y={cell.y * 20}
                width={20}
                height={20}
                fill={getCellColor(cell.count)}
              />
            ))}

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
          </svg>
        </div>
      )}
    </div>
  );
};

export default SeasonHeatmap;
