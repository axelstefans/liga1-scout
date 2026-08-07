import React from 'react';
import { usePlayerDefending } from '../hooks/usePlayer';

interface DefendingTabProps {
  playerId: number;
  themeColor: string;
}

const DefendingTab: React.FC<DefendingTabProps> = ({ playerId, themeColor }) => {
  const { data, isLoading, isError } = usePlayerDefending(playerId);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p className="text-xl text-navy">Loading defending data...</p></div>;
  }

  if (isError || !data) {
    return <div className="text-center text-red-500 mt-10">Error loading defending data.</div>;
  }

  const { defensive_actions, dribbles } = data;

  // Grid Calculation Logic for Defensive Actions Zonal Heatmap
  const numCols = 5;
  const numRows = 6;
  const colWidth = 100 / numCols;
  const rowHeight = 100 / numRows;

  const grid = Array.from({ length: numRows }, () => Array(numCols).fill(0));

  let validActionsCount = 0;
  defensive_actions.forEach(action => {
    if (action.x != null && action.y != null) {
      validActionsCount++;
      const col = Math.min(numCols - 1, Math.max(0, Math.floor(action.y / colWidth)));
      const row = Math.min(numRows - 1, Math.max(0, Math.floor((100 - action.x) / rowHeight)));
      grid[row][col]++;
    }
  });

  const maxCount = Math.max(...grid.flat());

  // Pitch SVG markup generator (Vertical Pitch)
  const renderPitchOverlay = () => (
    <g stroke="rgba(0,0,0,0.5)" strokeWidth="0.5" fill="none" pointerEvents="none">
      <rect x="0" y="0" width="100" height="100" />
      <line x1="0" y1="50" x2="100" y2="50" />
      <ellipse cx="50" cy="50" rx="9.15" ry="5.926" />
      <ellipse cx="50" cy="50" rx="0.4" ry="0.259" fill="rgba(0,0,0,0.5)" />
      
      <rect x="21.1" y="83.5" width="57.8" height="16.5" />
      <rect x="36.8" y="94.5" width="26.4" height="5.5" />
      <path d="M 39.4 83.5 A 9.15 5.926 0 0 1 60.6 83.5" />
      <ellipse cx="50" cy="89" rx="0.4" ry="0.259" fill="rgba(0,0,0,0.5)" />

      <rect x="21.1" y="0" width="57.8" height="16.5" />
      <rect x="36.8" y="0" width="26.4" height="5.5" />
      <path d="M 39.4 16.5 A 9.15 5.926 0 0 0 60.6 16.5" />
      <ellipse cx="50" cy="11" rx="0.4" ry="0.259" fill="rgba(0,0,0,0.5)" />

      <path d="M 0 1.5 A 1.5 1.5 0 0 0 1.5 0" />
      <path d="M 98.5 0 A 1.5 1.5 0 0 0 100 1.5" />
      <path d="M 100 98.5 A 1.5 1.5 0 0 0 98.5 100" />
      <path d="M 1.5 100 A 1.5 1.5 0 0 0 0 98.5" />
    </g>
  );

  return (
    <div className="bg-card border border-border p-6 rounded-lg shadow-sm animate-in fade-in duration-300">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* PANEL 1: Defensive Actions Zonal Heatmap */}
        <div className="flex flex-col items-center">
          <h3 className="text-xl font-display mb-2 text-navy text-center">Defensive Actions (Zonal)</h3>
          <p className="text-sm text-gray-500 mb-4">{validActionsCount} Actions Logged</p>
          
          <div className="relative w-full max-w-sm h-auto aspect-[68/105] bg-[#fdfdfd] rounded border-2 border-gray-300 shadow-inner overflow-hidden">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-gray-300" preserveAspectRatio="none">
              
              {/* Heatmap Grid */}
              {Array.from({ length: numRows }).map((_, r) => 
                Array.from({ length: numCols }).map((_, c) => {
                  const count = grid[r][c];
                  const alpha = (count > 0 && maxCount > 0) ? 0.08 + Math.pow(count / maxCount, 0.55) * 0.77 : 0;
                  
                  return (
                    <g key={`${r}-${c}`}>
                      <rect 
                        x={c * colWidth} 
                        y={r * rowHeight} 
                        width={colWidth}
                        height={rowHeight} 
                        fill={themeColor}
                        fillOpacity={alpha} 
                        stroke="none"
                      />
                      {count > 0 && (
                        <text 
                          x={c * colWidth + colWidth / 2} 
                          y={r * rowHeight + rowHeight / 2} 
                          fontSize="3.8" 
                          fontWeight="bold" 
                          fill={alpha > 0.5 ? '#ffffff' : '#111827'} 
                          textAnchor="middle" 
                          dominantBaseline="middle"
                        >
                          {count}
                        </text>
                      )}
                    </g>
                  );
                })
              )}
              
              {renderPitchOverlay()}
            </svg>
          </div>
          
          {/* Direction Indicator */}
          <div className="mt-4 flex items-center justify-center text-xs font-semibold text-gray-500 tracking-wider uppercase">
            Direction of Play
            <svg className="ml-2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
        </div>

        {/* PANEL 2: Take-ons / Dribbles Scatter Map */}
        <div className="flex flex-col items-center">
          <h3 className="text-xl font-display mb-2 text-navy text-center">Dribbles / Take-ons</h3>
          <p className="text-sm text-gray-500 mb-4">{dribbles.length} Attempted Dribbles</p>

          <div className="relative w-full max-w-sm h-auto aspect-[68/105] bg-[#fdfdfd] rounded border-2 border-gray-300 shadow-inner overflow-hidden">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-gray-300" preserveAspectRatio="none">
              
              {renderPitchOverlay()}

              {/* Dribbles Plot */}
              {dribbles.map(dribble => {
                if (dribble.x == null || dribble.y == null) return null;
                
                // Map raw coordinates to vertical pitch
                const cx = dribble.y;
                const cy = 100 - dribble.x;

                if (dribble.is_successful) {
                  return (
                    <circle
                      key={`drib-${dribble.id}`}
                      cx={cx}
                      cy={cy}
                      r="1.5"
                      fill="#10b981"
                      stroke="#047857"
                      strokeWidth="0.3"
                      opacity="0.9"
                    />
                  );
                } else {
                  return (
                    <g key={`drib-${dribble.id}`} opacity="0.9">
                      <circle
                        cx={cx}
                        cy={cy}
                        r="1.5"
                        fill="#ef4444"
                        stroke="#b91c1c"
                        strokeWidth="0.3"
                      />
                      <path 
                        d={`M ${cx - 0.7} ${cy - 0.7} L ${cx + 0.7} ${cy + 0.7} M ${cx + 0.7} ${cy - 0.7} L ${cx - 0.7} ${cy + 0.7}`}
                        stroke="white"
                        strokeWidth="0.4"
                      />
                    </g>
                  );
                }
              })}
            </svg>
          </div>
          
          {/* Direction Indicator */}
          <div className="mt-4 flex items-center justify-center text-xs font-semibold text-gray-500 tracking-wider uppercase">
            Direction of Play
            <svg className="ml-2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>

          {/* Dribble Legend */}
          <div className="flex space-x-4 mt-4">
            <div className="flex items-center space-x-2">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <circle cx="6" cy="6" r="4.5" fill="#10b981" stroke="#047857" strokeWidth="1" />
              </svg>
              <span className="text-xs font-medium text-gray-700">Successful</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <circle cx="6" cy="6" r="4.5" fill="#ef4444" stroke="#b91c1c" strokeWidth="1" />
                <path d="M 4 4 L 8 8 M 8 4 L 4 8" stroke="white" strokeWidth="1" />
              </svg>
              <span className="text-xs font-medium text-gray-700">Unsuccessful</span>
            </div>
          </div>
          
        </div>
      </div>
      
    </div>
  );
};

export default DefendingTab;
