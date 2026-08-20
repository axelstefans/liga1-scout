import React, { useState } from 'react';
import { usePlayerDefending, usePlayerMatchStats } from '../hooks/usePlayer';
import { PlayerDefensiveAction } from '../services/api';

interface DefendingTabProps {
  playerId: number;
  themeColor: string;
}

const DefendingTab: React.FC<DefendingTabProps> = ({ playerId, themeColor }) => {
  const { data, isLoading, isError } = usePlayerDefending(playerId);
  const { data: matchStats } = usePlayerMatchStats(playerId);

  const [selectedMatch, setSelectedMatch] = useState<string>('all');
  const [activeView, setActiveView] = useState<'zonal' | 'clearances'>('zonal');
  const [actionTypeFilter, setActionTypeFilter] = useState<'all' | 'tackle' | 'interception' | 'clearance' | 'ball-recovery' | 'block'>('all');
  const [hoveredClearance, setHoveredClearance] = useState<PlayerDefensiveAction | null>(null);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p className="text-xl text-navy">Loading defending data...</p></div>;
  }

  if (isError || !data) {
    return <div className="text-center text-red-500 mt-10">Error loading defending data.</div>;
  }

  const { defensive_actions } = data;

  // Derive match options from the player's full match history
  const matchOptions = matchStats?.map(m => ({
    id: m.match_id,
    label: `${m.match_date.split('T')[0]} vs ${m.opponent_name}`
  })) || [];

  const safeDefensiveActions = defensive_actions || [];

  // Filter actions based on selected match
  const currentDefensiveActions = selectedMatch === 'all' 
    ? safeDefensiveActions 
    : safeDefensiveActions.filter(a => a.match_id === parseInt(selectedMatch));

  const zonalFilteredActions = actionTypeFilter === 'all' 
    ? currentDefensiveActions 
    : currentDefensiveActions.filter(a => a.action_type === actionTypeFilter);

  // Grid Calculation Logic for Defensive Actions Zonal Heatmap
  const numCols = 5;
  const numRows = 6;
  const colWidth = 68 / numCols;
  const rowHeight = 105 / numRows;

  const tackles = currentDefensiveActions.filter(a => a.action_type === 'tackle').length;
  const interceptions = currentDefensiveActions.filter(a => a.action_type === 'interception').length;
  const clearances = currentDefensiveActions.filter(a => a.action_type === 'clearance').length;
  const recoveries = currentDefensiveActions.filter(a => a.action_type === 'ball-recovery').length;
  const blocks = currentDefensiveActions.filter(a => a.action_type === 'block').length;

  const clearanceActions = currentDefensiveActions.filter(
    a => a.action_type === 'clearance' && a.end_x != null && a.end_y != null && a.x != null && a.y != null
  );

  const grid = Array.from({ length: numRows }, () => Array(numCols).fill(0));

  let validActionsCount = 0;

  zonalFilteredActions.forEach(action => {
    if (action.x != null && action.y != null) {
      validActionsCount++;
      
      const cx = (action.y / 100) * 68;
      const cy = 105 - (action.x / 100) * 105;
      
      const col = Math.min(numCols - 1, Math.max(0, Math.floor(cx / colWidth)));
      const row = Math.min(numRows - 1, Math.max(0, Math.floor(cy / rowHeight)));
      grid[row][col]++;
    }
  });

  const maxCount = Math.max(...grid.flat());

  // Pitch SVG markup generator (Vertical Pitch 68x105)
  const renderPitchOverlay = () => (
    <g stroke="rgba(0,0,0,0.5)" strokeWidth="0.34" fill="none" pointerEvents="none">
      <rect x="0" y="0" width="68" height="105" />
      <line x1="0" y1="52.5" x2="68" y2="52.5" />
      <ellipse cx="34" cy="52.5" rx="6.222" ry="6.222" />
      <ellipse cx="34" cy="52.5" rx="0.272" ry="0.272" fill="rgba(0,0,0,0.5)" />
      
      <rect x="14.348" y="87.675" width="39.304" height="17.325" />
      <rect x="25.024" y="99.225" width="17.952" height="5.775" />
      <path d="M 26.792 87.675 A 6.222 6.222 0 0 1 41.208 87.675" />
      <ellipse cx="34" cy="93.45" rx="0.272" ry="0.272" fill="rgba(0,0,0,0.5)" />

      <rect x="14.348" y="0" width="39.304" height="17.325" />
      <rect x="25.024" y="0" width="17.952" height="5.775" />
      <path d="M 26.792 17.325 A 6.222 6.222 0 0 0 41.208 17.325" />
      <ellipse cx="34" cy="11.55" rx="0.272" ry="0.272" fill="rgba(0,0,0,0.5)" />

      <path d="M 0 1.575 A 1.02 1.575 0 0 0 1.02 0" />
      <path d="M 66.98 0 A 1.02 1.575 0 0 0 68 1.575" />
      <path d="M 68 103.425 A 1.02 1.575 0 0 0 66.98 105" />
      <path d="M 1.02 105 A 1.02 1.575 0 0 0 0 103.425" />
    </g>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 animate-in fade-in duration-300">
      
      {/* LEFT COLUMN: Main Visual */}
      <div className="bg-card border border-border p-6 rounded-lg shadow-sm flex flex-col">
        
        <div className="flex space-x-2 mb-6 border-b border-border pb-4">
          <button 
            onClick={() => setActiveView('zonal')} 
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${activeView === 'zonal' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Zonal Map
          </button>
          <button 
            onClick={() => setActiveView('clearances')} 
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${activeView === 'clearances' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Clearances
          </button>
        </div>

        {/* PANEL 1: Defensive Actions Zonal Heatmap */}
        {activeView === 'zonal' && (
          <div className="flex flex-col items-center">
            <h3 className="text-xl font-display mb-2 text-navy text-center">Defensive Actions (Zonal)</h3>
            <p className="text-sm text-gray-500 mb-4">{validActionsCount} Actions Logged</p>
            
            <div className="relative w-full max-w-sm h-auto aspect-[68/105] bg-[#fdfdfd] rounded border-2 border-gray-300 shadow-inner overflow-hidden">
              <svg viewBox="0 0 68 105" className="absolute inset-0 w-full h-full text-gray-300" preserveAspectRatio="none">
                
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
                            fontSize="2.6" 
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
          </div>
        )}

        {activeView === 'clearances' && (
          <div className="flex flex-col items-center w-full">
            <h3 className="text-xl font-display mb-2 text-navy text-center">Clearances</h3>
            <p className="text-sm text-gray-500 mb-4">{clearanceActions.length} Clearances Logged</p>
            
            <div className="relative w-full max-w-sm h-auto aspect-[68/105] bg-[#fdfdfd] rounded border-2 border-gray-300 shadow-inner overflow-visible">
              <svg viewBox="0 0 68 105" className="absolute inset-0 w-full h-full text-gray-300" preserveAspectRatio="none">
                {renderPitchOverlay()}
                
                {clearanceActions.map(action => {
                  const startCx = (action.y! / 100) * 68;
                  const startCy = 105 - (action.x! / 100) * 105;
                  const endCx = (action.end_x! / 100) * 68;
                  const endCy = 105 - (action.end_y! / 100) * 105;

                  return (
                    <g 
                      key={`clear-${action.id}`} 
                      opacity="0.7"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredClearance(action)}
                      onMouseLeave={() => setHoveredClearance(null)}
                    >
                      <line x1={startCx} y1={startCy} x2={endCx} y2={endCy} stroke="#f97316" strokeWidth="0.4" />
                      <circle cx={startCx} cy={startCy} r="1" fill="#f97316" />
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip */}
              {hoveredClearance && (
                <div 
                  className="absolute z-50 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-10px] w-max"
                  style={{ 
                    left: `${((hoveredClearance.y! / 100) * 68 / 68) * 100}%`, 
                    top: `${((105 - (hoveredClearance.x! / 100) * 105) / 105) * 100}%` 
                  }}
                >
                  <div className="font-bold mb-1 border-b border-gray-700 pb-1">Clearance</div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400">Distance:</span>
                    <span>{Math.round(Math.sqrt((hoveredClearance.end_x! - hoveredClearance.x!)**2 + (hoveredClearance.end_y! - hoveredClearance.y!)**2))}m</span>
                  </div>
                  <div className="flex justify-between gap-4 mt-1">
                    <span className="text-gray-400">Match:</span>
                    <span>{matchOptions.find(m => m.id === hoveredClearance.match_id)?.label || 'Unknown'}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center space-x-2">
                <svg width="24" height="6" className="overflow-visible">
                  <line x1="4" y1="3" x2="20" y2="3" stroke="#f97316" strokeWidth="2" />
                  <circle cx="4" cy="3" r="3" fill="#f97316" />
                </svg>
                <span>Clearance</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* RIGHT COLUMN: Sidebar (Filters & Summary) */}
      <div className="space-y-6">
        
        {/* FILTERS CARD */}
        <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-display mb-4 text-navy">Filters</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Match</label>
              <select 
                className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-blue"
                value={selectedMatch}
                onChange={(e) => setSelectedMatch(e.target.value)}
              >
                <option value="all">All Matches</option>
                {matchOptions.map(match => (
                  <option key={match.id} value={match.id.toString()}>{match.label}</option>
                ))}
              </select>
            </div>

            {activeView === 'zonal' && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Type</label>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'tackle', 'interception', 'clearance', 'ball-recovery', 'block'] as const).map(type => {
                    const isActive = actionTypeFilter === type;
                    const labelMap: Record<string, string> = {
                      'all': 'All',
                      'tackle': 'Tackle',
                      'interception': 'Interception',
                      'clearance': 'Clearance',
                      'ball-recovery': 'Ball Recovery',
                      'block': 'Block'
                    };
                    return (
                      <button
                        key={type}
                        onClick={() => setActionTypeFilter(type)}
                        style={{
                          backgroundColor: isActive ? themeColor : 'transparent',
                          color: isActive ? '#fff' : '#4b5563',
                          borderColor: isActive ? themeColor : '#d1d5db'
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${!isActive && 'hover:bg-gray-50'}`}
                      >
                        {labelMap[type]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SUMMARY CARD */}
        <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-display mb-4 text-navy">Defending Summary</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center col-span-2">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider text-center mb-1">Total Actions</span>
              <span className="text-3xl font-bold text-navy">{validActionsCount}</span>
            </div>
            
            <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider text-center mb-1">Tackles</span>
              <span className="text-2xl font-bold text-navy">{tackles}</span>
            </div>

            <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider text-center mb-1">Interceptions</span>
              <span className="text-2xl font-bold text-navy">{interceptions}</span>
            </div>

            <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider text-center mb-1">Clearances</span>
              <span className="text-2xl font-bold text-navy">{clearances}</span>
            </div>

            <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider text-center mb-1">Recoveries</span>
              <span className="text-2xl font-bold text-navy">{recoveries}</span>
            </div>

            <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center col-span-2">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider text-center mb-1">Blocks</span>
              <span className="text-2xl font-bold text-navy">{blocks}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default DefendingTab;
