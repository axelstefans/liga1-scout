import React, { useState } from 'react';
import { usePlayerDefending, usePlayerMatchStats } from '../hooks/usePlayer';
import { PlayerDribble, PlayerBallCarry } from '../services/api';

interface PossessionTabProps {
  playerId: number;
  themeColor: string;
}

const PossessionTab: React.FC<PossessionTabProps> = ({ playerId, themeColor }) => {
  const { data, isLoading, isError } = usePlayerDefending(playerId);
  const { data: matchStats } = usePlayerMatchStats(playerId);
  
  const [activeView, setActiveView] = useState<'dribbles' | 'carries'>('dribbles');
  const [selectedMatch, setSelectedMatch] = useState<string>('all');
  const [dribbleFilter, setDribbleFilter] = useState<'all' | 'successful' | 'unsuccessful'>('all');
  const [carryFilter, setCarryFilter] = useState<'all' | 'progressive'>('all');

  const [hoveredDribble, setHoveredDribble] = useState<PlayerDribble | null>(null);
  const [hoveredCarry, setHoveredCarry] = useState<PlayerBallCarry | null>(null);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p className="text-xl text-navy">Loading possession data...</p></div>;
  }

  if (isError || !data) {
    return <div className="text-center text-red-500 mt-10">Error loading possession data.</div>;
  }

  const { dribbles, ball_carries } = data;

  const matchOptions = matchStats?.map(m => ({
    id: m.match_id,
    label: `${m.match_date.split('T')[0]} vs ${m.opponent_name}`
  })) || [];

  const matchFilteredDribbles = selectedMatch === 'all' 
    ? dribbles 
    : dribbles.filter(d => d.match_id === parseInt(selectedMatch));
  
  const filteredDribbles = dribbleFilter === 'all' 
    ? matchFilteredDribbles 
    : matchFilteredDribbles.filter(d => dribbleFilter === 'successful' ? d.is_successful : !d.is_successful);

  const matchFilteredCarries = selectedMatch === 'all' 
    ? ball_carries 
    : ball_carries.filter(c => c.match_id === parseInt(selectedMatch));
    
  const filteredCarries = carryFilter === 'all' 
    ? matchFilteredCarries 
    : matchFilteredCarries.filter(c => c.x_start != null && c.x_end != null && (c.x_end - c.x_start) > 10);

  // Computed Summary Stats
  const totalDribbles = matchFilteredDribbles.length;
  const successfulDribbles = matchFilteredDribbles.filter(d => d.is_successful).length;
  const dribbleSuccessRate = totalDribbles > 0 ? `${((successfulDribbles / totalDribbles) * 100).toFixed(1)}%` : 'N/A';

  const totalCarries = matchFilteredCarries.length;
  const progressiveCarries = matchFilteredCarries.filter(c => c.x_start != null && c.x_end != null && (c.x_end - c.x_start) > 10).length;
  
  const validCarries = matchFilteredCarries.filter(c => c.x_start != null && c.x_end != null && c.y_start != null && c.y_end != null);
  const totalCarryDist = validCarries.reduce((sum, c) => {
    const dx = c.x_end! - c.x_start!;
    const dy = c.y_end! - c.y_start!;
    return sum + Math.sqrt(dx * dx + dy * dy);
  }, 0);
  const avgCarryDist = validCarries.length > 0 ? `${(totalCarryDist / validCarries.length).toFixed(1)}m` : 'N/A';


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
        
        {/* Sub Navigation */}
        <div className="flex space-x-2 mb-6 border-b border-border pb-4">
          <button 
            onClick={() => setActiveView('dribbles')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${activeView === 'dribbles' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Dribbles / Take-ons
          </button>
          <button 
            onClick={() => setActiveView('carries')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${activeView === 'carries' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Ball Carries
          </button>
        </div>

        {/* Content Wrapper */}
        <div className="flex flex-col items-center flex-1 w-full">
          {activeView === 'dribbles' && (
            <div className="flex flex-col items-center w-full">
              <h3 className="text-xl font-display mb-2 text-navy text-center">Dribbles / Take-ons</h3>
              <p className="text-sm text-gray-500 mb-4">{filteredDribbles.length} Attempted Dribbles</p>

              <div className="relative w-full max-w-md h-auto aspect-[68/105] bg-[#fdfdfd] rounded border-2 border-gray-300 shadow-inner overflow-visible">
                <svg viewBox="0 0 68 105" className="absolute inset-0 w-full h-full text-gray-300" preserveAspectRatio="none">
                  
                  {renderPitchOverlay()}

                  {/* Dribbles Plot */}
                  {filteredDribbles.map(dribble => {
                    if (dribble.x == null || dribble.y == null) return null;
                    
                    // Map raw coordinates (0-100) to scaled pitch geometry
                    const cx = (dribble.y / 100) * 68;
                    const cy = 105 - (dribble.x / 100) * 105;

                    if (dribble.is_successful) {
                      return (
                        <circle
                          key={`drib-${dribble.id}`}
                          cx={cx}
                          cy={cy}
                          r="1"
                          fill="#10b981"
                          stroke="#047857"
                          strokeWidth="0.2"
                          opacity="0.9"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredDribble(dribble)}
                          onMouseLeave={() => setHoveredDribble(null)}
                        />
                      );
                    } else {
                      return (
                        <g 
                          key={`drib-${dribble.id}`} 
                          opacity="0.9"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredDribble(dribble)}
                          onMouseLeave={() => setHoveredDribble(null)}
                        >
                          <circle
                            cx={cx}
                            cy={cy}
                            r="1"
                            fill="#ef4444"
                            stroke="#b91c1c"
                            strokeWidth="0.2"
                          />
                          <path 
                            d={`M ${cx - 0.5} ${cy - 0.5} L ${cx + 0.5} ${cy + 0.5} M ${cx + 0.5} ${cy - 0.5} L ${cx - 0.5} ${cy + 0.5}`}
                            stroke="white"
                            strokeWidth="0.3"
                          />
                        </g>
                      );
                    }
                  })}
                </svg>

                {/* Dribble Tooltip */}
                {hoveredDribble && hoveredDribble.x != null && hoveredDribble.y != null && (
                  <div 
                    className="absolute z-20 bg-gray-900 text-white text-xs p-3 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 w-48"
                    style={{
                      left: `${hoveredDribble.y}%`,
                      top: `${100 - hoveredDribble.x}%`,
                    }}
                  >
                    <div className="font-bold border-b border-gray-700 pb-1 mb-1">
                      {hoveredDribble.is_successful ? 'Successful Dribble' : 'Unsuccessful Dribble'}
                    </div>
                    <div className="text-gray-300">
                      Match: {matchOptions.find(m => m.id === hoveredDribble.match_id)?.label || hoveredDribble.match_id}
                    </div>
                  </div>
                )}
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
          )}

          {activeView === 'carries' && (
            <div className="flex flex-col items-center w-full">
              <h3 className="text-xl font-display mb-2 text-navy text-center">Ball Carries</h3>
              <p className="text-sm text-gray-500 mb-4">{filteredCarries.length} Carries</p>
              <div className="relative w-full max-w-md h-auto aspect-[68/105] bg-[#fdfdfd] rounded border-2 border-gray-300 shadow-inner overflow-visible">
                <svg viewBox="0 0 68 105" className="absolute inset-0 w-full h-full text-gray-300" preserveAspectRatio="none">
                  
                  {renderPitchOverlay()}

                  {/* Ball Carries Plot */}
                  {filteredCarries.map(carry => {
                    if (carry.x_start == null || carry.y_start == null || carry.x_end == null || carry.y_end == null) return null;
                    
                    // Map raw coordinates (0-100) to scaled pitch geometry
                    const startCx = (carry.y_start / 100) * 68;
                    const startCy = 105 - (carry.x_start / 100) * 105;
                    const endCx = (carry.y_end / 100) * 68;
                    const endCy = 105 - (carry.x_end / 100) * 105;

                    return (
                      <g 
                        key={`carry-${carry.id}`} 
                        opacity="0.7"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredCarry(carry)}
                        onMouseLeave={() => setHoveredCarry(null)}
                      >
                        <line 
                          x1={startCx} 
                          y1={startCy} 
                          x2={endCx} 
                          y2={endCy} 
                          stroke="#3b82f6" 
                          strokeWidth="0.2" 
                        />
                        <circle 
                          cx={startCx} 
                          cy={startCy} 
                          r="0.3" 
                          fill="#3b82f6" 
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Carry Tooltip */}
                {hoveredCarry && hoveredCarry.x_start != null && hoveredCarry.y_start != null && (
                  <div 
                    className="absolute z-20 bg-gray-900 text-white text-xs p-3 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 w-48"
                    style={{
                      left: `${hoveredCarry.y_start}%`,
                      top: `${100 - hoveredCarry.x_start}%`,
                    }}
                  >
                    <div className="font-bold border-b border-gray-700 pb-1 mb-1">
                      Ball Carry
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-gray-400">Distance:</span>
                      <span className="font-mono">
                        {hoveredCarry.x_end != null && hoveredCarry.y_end != null 
                          ? `${Math.round(Math.sqrt(Math.pow(hoveredCarry.x_end - hoveredCarry.x_start, 2) + Math.pow(hoveredCarry.y_end - hoveredCarry.y_start, 2)))}m`
                          : 'N/A'
                        }
                      </span>
                    </div>
                    <div className="mt-1 text-gray-300">
                      Match: {matchOptions.find(m => m.id === hoveredCarry.match_id)?.label || hoveredCarry.match_id}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* RIGHT COLUMN: Sidebar (Filters & Summary) */}
      <div className="space-y-6">
        
        {/* Filters Card */}
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

            {activeView === 'dribbles' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Result</label>
                <div className="flex flex-col space-y-2">
                  {['all', 'successful', 'unsuccessful'].map(f => (
                    <button 
                      key={f}
                      onClick={() => setDribbleFilter(f as any)}
                      className="w-full px-3 py-2 text-sm rounded-lg border transition-colors text-left font-medium"
                      style={{
                        backgroundColor: dribbleFilter === f ? themeColor : 'transparent',
                        color: dribbleFilter === f ? '#fff' : '#4b5563',
                        borderColor: dribbleFilter === f ? themeColor : '#d1d5db'
                      }}
                    >
                      {f.replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeView === 'carries' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Type</label>
                <div className="flex flex-col space-y-2">
                  {['all', 'progressive'].map(f => (
                    <button 
                      key={f}
                      onClick={() => setCarryFilter(f as any)}
                      className="w-full px-3 py-2 text-sm rounded-lg border transition-colors text-left font-medium"
                      style={{
                        backgroundColor: carryFilter === f ? themeColor : 'transparent',
                        color: carryFilter === f ? '#fff' : '#4b5563',
                        borderColor: carryFilter === f ? themeColor : '#d1d5db'
                      }}
                    >
                      {f.replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Possession Summary Card */}
        <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-display mb-4 text-navy">Possession Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            
            {activeView === 'dribbles' && (
              <>
                <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center col-span-2">
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider text-center mb-1">Total Dribbles</span>
                  <span className="text-3xl font-bold text-navy">{totalDribbles}</span>
                </div>
                
                <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center col-span-2">
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider text-center mb-1">Success Rate</span>
                  <span className="text-3xl font-bold text-navy">{dribbleSuccessRate}</span>
                </div>
              </>
            )}

            {activeView === 'carries' && (
              <>
                <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center col-span-2">
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider text-center mb-1">Total Carries</span>
                  <span className="text-3xl font-bold text-navy">{totalCarries}</span>
                </div>

                <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center col-span-2">
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider text-center mb-1">Progressive Carries</span>
                  <span className="text-2xl font-bold text-navy">{progressiveCarries}</span>
                </div>

                <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center col-span-2">
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider text-center mb-1">Avg Carry Distance</span>
                  <span className="text-2xl font-bold text-navy">{avgCarryDist}</span>
                </div>
              </>
            )}
            
          </div>
        </div>

      </div>

    </div>
  );
};

export default PossessionTab;
