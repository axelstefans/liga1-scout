import React, { useState } from 'react';
import { usePlayerPasses, usePlayerMatchStats } from '../hooks/usePlayer';
import { PlayerPass } from '../services/api';

interface PassingTabProps {
  playerId: number;
  themeColor: string;
  playerName: string;
}

const PassingTab: React.FC<PassingTabProps> = ({ playerId, themeColor, playerName }) => {
  const { data: passData, isLoading } = usePlayerPasses(playerId);
  const { data: matchStats } = usePlayerMatchStats(playerId);
  
  const [hoveredPass, setHoveredPass] = useState<PlayerPass | null>(null);
  
  // Left Column Sub-tab
  const [activeMap, setActiveMap] = useState<'vectors' | 'starts' | 'endings'>('vectors');
  
  // Controls
  const [filter, setFilter] = useState<'all' | 'successful' | 'unsuccessful' | 'forward' | 'final_third'>('forward');
  const [selectedMatch, setSelectedMatch] = useState<string>('all');

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p className="text-xl text-navy">Loading pass data...</p></div>;
  }

  // Derive match options from the player's full match history
  const matchOptions = matchStats?.map(m => ({
    id: m.match_id,
    label: `${m.match_date.split('T')[0]} vs ${m.opponent_name}`
  })) || [];

  const safePassData = passData || [];

  // Filter pass data based on selected match
  const currentPassData = selectedMatch === 'all' 
    ? safePassData 
    : safePassData.filter(p => p.match_id === parseInt(selectedMatch));

  // Calculate high-level stats based on currentPassData
  const totalPasses = currentPassData.length;
  const successfulPasses = currentPassData.filter(p => p.is_successful).length;
  const completionRate = totalPasses > 0 ? (successfulPasses / totalPasses) * 100 : 0;
  
  // Forward passes (arbitrary definition: end_x is greater than start_x by > 10)
  const forwardPasses = currentPassData.filter(p => p.x_end !== null && p.x_start !== null && (p.x_end - p.x_start) > 10).length;
  const finalThirdPasses = currentPassData.filter(p => p.x_end !== null && p.x_end > 66.6).length;

  // Grid Calculation Logic for Zonal Heatmaps
  const numCols = 5;
  const numRows = 6;
  const colWidth = 100 / numCols;
  const rowHeight = 100 / numRows;

  const gridStarts = Array.from({ length: numRows }, () => Array(numCols).fill(0));
  const gridEnds = Array.from({ length: numRows }, () => Array(numCols).fill(0));

  let validPassesCount = 0;
  currentPassData.forEach(p => {
    if (p.x_start != null && p.y_start != null && p.x_end != null && p.y_end != null) {
      validPassesCount++;
      
      const startCol = Math.min(numCols - 1, Math.max(0, Math.floor(p.y_start / colWidth)));
      const startRow = Math.min(numRows - 1, Math.max(0, Math.floor((100 - p.x_start) / rowHeight)));
      gridStarts[startRow][startCol]++;

      const endCol = Math.min(numCols - 1, Math.max(0, Math.floor(p.y_end / colWidth)));
      const endRow = Math.min(numRows - 1, Math.max(0, Math.floor((100 - p.x_end) / rowHeight)));
      gridEnds[endRow][endCol]++;
    }
  });

  const toPct = (grid: number[][]) => grid.flat().map(count => validPassesCount > 0 ? (count / validPassesCount) * 100 : 0);
  const sharedMaxPct = Math.max(...toPct(gridStarts), ...toPct(gridEnds));

  const renderZonalGrid = (grid: number[][], titleSuffix: string, sharedMaxPct: number) => {
    return (
    <div className="w-full flex flex-col items-center">
      <div className="text-center mb-4">
        <h3 className="font-bold text-lg text-navy">{playerName} — {titleSuffix}</h3>
        <p className="text-sm text-gray-500">{validPassesCount} Open Play Passes</p>
      </div>
      <div className="relative w-full max-w-md h-auto aspect-[68/105] bg-[#fdfdfd] rounded border-2 border-gray-300 shadow-inner overflow-hidden mx-auto">
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-gray-300" preserveAspectRatio="none">
          
          {/* Render Heatmap Cells FIRST */}
          {Array.from({ length: numRows }).map((_, r) => 
            Array.from({ length: numCols }).map((_, c) => {
              const count = grid[r][c];
              const pct = validPassesCount > 0 ? (count / validPassesCount) * 100 : 0;
              const alpha = pct > 0 ? 0.08 + Math.pow(pct / sharedMaxPct, 0.55) * 0.77 : 0;
              
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
                {pct > 0 && (
                  <text 
                    x={c * colWidth + colWidth / 2} 
                    y={r * rowHeight + rowHeight / 2} 
                    fontSize="3.8" 
                    fontWeight="bold" 
                    fill={alpha > 0.5 ? '#ffffff' : '#111827'} 
                    textAnchor="middle" 
                    dominantBaseline="middle"
                  >
                    {pct.toFixed(1)}%
                  </text>
                )}
              </g>
            );
          })
        )}
        
        {/* Vertical Pitch Overlay (Drawn AFTER grids so it stays on top) */}
        <g stroke="rgba(0,0,0,0.5)" strokeWidth="0.5" fill="none" pointerEvents="none">
          <rect x="0" y="0" width="100" height="100" />
          <line x1="0" y1="50" x2="100" y2="50" />
          {/* Vertical pitch ellipse math: ry = rx * 68 / 105 */}
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
      </svg>
    </div>
    </div>
  );
};

  const filteredPasses = currentPassData.filter(p => {
    if (filter === 'successful') return p.is_successful;
    if (filter === 'unsuccessful') return !p.is_successful;
    if (filter === 'forward') return p.x_end !== null && p.x_start !== null && (p.x_end - p.x_start) > 10;
    if (filter === 'final_third') return p.x_end !== null && p.x_end > 66.6;
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 animate-in fade-in duration-300">
      
      {/* LEFT COLUMN: VISUALIZATION */}
      <div className="bg-card border border-border p-6 rounded-lg shadow-sm flex flex-col">
        {/* Sub Navigation */}
        <div className="flex space-x-2 mb-6 border-b border-border pb-4">
          <button 
            onClick={() => setActiveMap('vectors')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${activeMap === 'vectors' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Pass Vectors
          </button>
          <button 
            onClick={() => setActiveMap('starts')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${activeMap === 'starts' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Pass Starts
          </button>
          <button 
            onClick={() => setActiveMap('endings')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${activeMap === 'endings' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Pass Endings
          </button>
        </div>

        {/* Pitch Container */}
        <div className="flex-1 flex flex-col justify-center w-full">
          {activeMap === 'vectors' && (
            <div className="relative w-full h-auto aspect-[100/68] bg-[#fdfdfd] rounded border-2 border-gray-300 shadow-inner overflow-visible">
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-gray-300" preserveAspectRatio="none">
                
                {/* Pitch outline */}
                <g stroke="rgba(0,0,0,0.15)" strokeWidth="0.4" fill="none" pointerEvents="none">
                  <rect x="0" y="0" width="100" height="100" />
                  <line x1="50" y1="0" x2="50" y2="100" />
                  {/* Horizontal pitch ellipse math: ry = rx * 100 / 68 */}
                  <ellipse cx="50" cy="50" rx="9.15" ry="13.455" />
                  <ellipse cx="50" cy="50" rx="0.4" ry="0.588" fill="rgba(0,0,0,0.15)" />
                  
                  <rect x="0" y="21.1" width="16.5" height="57.8" />
                  <rect x="0" y="36.8" width="5.5" height="26.4" />
                  <path d="M 16.5 39.4 A 9.15 13.455 0 0 1 16.5 60.6" />
                  <ellipse cx="11" cy="50" rx="0.4" ry="0.588" fill="rgba(0,0,0,0.15)" />
                  
                  <rect x="83.5" y="21.1" width="16.5" height="57.8" />
                  <rect x="94.5" y="36.8" width="5.5" height="26.4" />
                  <path d="M 83.5 39.4 A 9.15 13.455 0 0 0 83.5 60.6" />
                  <ellipse cx="89" cy="50" rx="0.4" ry="0.588" fill="rgba(0,0,0,0.15)" />
                </g>

                {/* Passes */}
                {filteredPasses.map((pass) => {
                  if (pass.x_start == null || pass.y_start == null || pass.x_end == null || pass.y_end == null) return null;
                  
                  const isSuccess = pass.is_successful;
                  
                  const dx = pass.x_end - pass.x_start;
                  const dy = pass.y_end - pass.y_start;
                  const L = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  
                  return (
                    <g 
                      key={pass.id} 
                      onMouseEnter={() => setHoveredPass(pass)}
                      onMouseLeave={() => setHoveredPass(null)}
                      className="cursor-pointer"
                    >
                      {/* Invisible thicker line for better hover hit area */}
                      <line 
                        x1={pass.x_start} 
                        y1={pass.y_start} 
                        x2={pass.x_end} 
                        y2={pass.y_end} 
                        stroke="transparent" 
                        strokeWidth="3" 
                      />
                      
                      {isSuccess ? (
                        <>
                          {/* Successful Pass: Comet tail polygon */}
                          <g transform={`translate(${pass.x_start}, ${pass.y_start}) rotate(${angle})`}>
                            <polygon points={`0,-0.4 0,0.4 ${L},0`} fill={themeColor} opacity="0.8" />
                          </g>
                          {/* Origin Node: Ellipse calculated to be perfectly circular */}
                          <ellipse 
                            cx={pass.x_start} 
                            cy={pass.y_start} 
                            rx="0.6" 
                            ry="0.88" 
                            fill={themeColor}
                            stroke="#111827"
                            strokeWidth="0.25"
                            opacity="0.95" 
                          />
                        </>
                      ) : (
                        <>
                          {/* Missed Pass: Thin dashed line */}
                          <line 
                            x1={pass.x_start} 
                            y1={pass.y_start} 
                            x2={pass.x_end} 
                            y2={pass.y_end} 
                            stroke="#9ca3af" 
                            strokeWidth="0.2" 
                            strokeDasharray="1, 1"
                            opacity="0.8"
                          />
                          {/* Origin Node */}
                          <ellipse 
                            cx={pass.x_start} 
                            cy={pass.y_start} 
                            rx="0.5" 
                            ry="0.73" 
                            fill="#9ca3af"
                            stroke="#111827"
                            strokeWidth="0.2"
                            opacity="0.9" 
                          />
                          {/* Missed pass 'X' */}
                          <g stroke="#6b7280" strokeWidth="0.5" opacity="0.9">
                            <line x1={pass.x_end - 0.7} y1={pass.y_end - 1.0} x2={pass.x_end + 0.7} y2={pass.y_end + 1.0} />
                            <line x1={pass.x_end - 0.7} y1={pass.y_end + 1.0} x2={pass.x_end + 0.7} y2={pass.y_end - 1.0} />
                          </g>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip */}
              {hoveredPass && hoveredPass.x_start != null && hoveredPass.x_end != null && hoveredPass.y_start != null && hoveredPass.y_end != null && (
                <div 
                  className="absolute z-20 bg-gray-900 text-white text-xs p-3 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 w-48"
                  style={{
                    left: `${hoveredPass.x_end}%`,
                    top: `${hoveredPass.y_end}%`,
                  }}
                >
                  <div 
                    className="font-bold border-b border-gray-700 pb-1 mb-1"
                    style={{ color: hoveredPass.is_successful ? themeColor : '#9ca3af' }}
                  >
                    {hoveredPass.is_successful ? 'Successful Pass' : 'Unsuccessful Pass'}
                  </div>
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    <span className="text-gray-400">Start (X,Y):</span>
                    <span className="text-right font-mono">{Math.round(hoveredPass.x_start)}, {Math.round(hoveredPass.y_start)}</span>
                    <span className="text-gray-400">End (X,Y):</span>
                    <span className="text-right font-mono">{Math.round(hoveredPass.x_end)}, {Math.round(hoveredPass.y_end)}</span>
                    <span className="text-gray-400">Distance:</span>
                    <span className="text-right font-mono">
                      {Math.round(Math.sqrt(Math.pow(hoveredPass.x_end - hoveredPass.x_start, 2) + Math.pow(hoveredPass.y_end - hoveredPass.y_start, 2)))} m
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeMap === 'starts' && (
            <div className="flex flex-col items-center w-full">
              {renderZonalGrid(gridStarts, 'Pass Starts', sharedMaxPct)}
            </div>
          )}

          {activeMap === 'endings' && (
            <div className="flex flex-col items-center w-full">
              {renderZonalGrid(gridEnds, 'Pass Endings', sharedMaxPct)}
            </div>
          )}

          {/* Direction Indicator */}
          {activeMap === 'vectors' && (
            <div className="mt-4 flex items-center justify-center text-sm font-semibold text-gray-500 tracking-wider uppercase">
              Direction of Play
              <svg className="ml-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: CONTROLS & SUMMARY */}
      <div className="space-y-6">
        
        {/* Controls Card */}
        <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-display mb-4 text-navy">Filters</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Match</label>
              <select
                value={selectedMatch}
                onChange={(e) => setSelectedMatch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm shadow-sm focus:outline-none focus:border-navy"
              >
                <option value="all">All Matches</option>
                {matchOptions.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            {activeMap === 'vectors' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pass Type</label>
                <div className="flex flex-col space-y-2">
                  {['forward', 'final_third', 'successful', 'unsuccessful', 'all'].map(f => (
                    <button 
                      key={f}
                      onClick={() => setFilter(f as any)}
                      className="w-full px-3 py-2 text-sm rounded-lg border transition-colors text-left font-medium"
                      style={{
                        backgroundColor: filter === f ? themeColor : 'transparent',
                        color: filter === f ? '#fff' : '#4b5563',
                        borderColor: filter === f ? themeColor : '#d1d5db'
                      }}
                    >
                      {f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-display mb-4 text-navy">Passing Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center col-span-2">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Total Passes</span>
              <span className="text-3xl font-bold text-navy">{totalPasses}</span>
            </div>
            
            <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Completed</span>
              <span className="text-2xl font-bold" style={{ color: themeColor }}>{successfulPasses}</span>
            </div>
            
            <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Accuracy</span>
              <span className="text-2xl font-bold text-navy">{completionRate.toFixed(1)}%</span>
            </div>

            <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 text-center">Forward<br/>(+10m)</span>
              <span className="text-2xl font-bold text-navy">{forwardPasses}</span>
            </div>
            
            <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 text-center">To Final<br/>3rd</span>
              <span className="text-2xl font-bold text-navy">{finalThirdPasses}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PassingTab;
