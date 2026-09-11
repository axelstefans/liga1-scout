import React, { useState } from 'react';
import { usePlayerShotmap } from '../hooks/usePlayer';
import { PlayerShot } from '../services/api';

interface ShootingTabProps {
  playerId: number;
  themeColor: string;
}

const ShootingTab: React.FC<ShootingTabProps> = ({ playerId, themeColor }) => {
  const { data: shotData, isLoading } = usePlayerShotmap(playerId);
  const [hoveredShot, setHoveredShot] = useState<PlayerShot | null>(null);
  const [hoveredGoalMouthShot, setHoveredGoalMouthShot] = useState<PlayerShot | null>(null);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p className="text-xl text-navy">Loading shot data...</p></div>;
  }

  if (!shotData || shotData.length === 0) {
    return (
      <div className="bg-card border border-border p-6 rounded-lg shadow-sm text-center">
        <p className="text-gray-500">No shot data available for this player.</p>
      </div>
    );
  }

  // Calculate stats
  const totalShots = shotData.length;
  const goals = shotData.filter(s => s.shot_type.toLowerCase() === 'goal').length;
  const totalXG = shotData.reduce((sum, s) => sum + (s.calculated_xg || 0), 0);
  
  // Breakdown by body part
  const bodyParts = shotData.reduce((acc, shot) => {
    const part = shot.body_part || 'Unknown';
    if (!acc[part]) acc[part] = { count: 0, goals: 0 };
    acc[part].count += 1;
    if (shot.shot_type.toLowerCase() === 'goal') acc[part].goals += 1;
    return acc;
  }, {} as Record<string, { count: number, goals: number }>);

  // Breakdown by situation
  const situations = shotData.reduce((acc, shot) => {
    const sit = shot.situation || 'Unknown';
    if (!acc[sit]) acc[sit] = { count: 0, goals: 0 };
    acc[sit].count += 1;
    if (shot.shot_type.toLowerCase() === 'goal') acc[sit].goals += 1;
    return acc;
  }, {} as Record<string, { count: number, goals: number }>);

  const onTargetShots = shotData.filter(
    (s) => s.shot_type.toLowerCase() === 'goal' || s.shot_type.toLowerCase() === 'save'
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
      {/* Left Column: Shot Map Visual */}
      <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
        <h3 className="text-xl font-display mb-4 text-navy">Shot Map</h3>
        
        <div className="relative w-full aspect-[100/100] max-w-md mx-auto bg-transparent rounded border-2 border-gray-300 shadow-inner">
          {/* Pitch SVG Background */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-gray-300" preserveAspectRatio="none">
            {/* Pitch outline */}
            <rect x="0" y="0" width="100" height="100" fill="none" stroke="currentColor" strokeWidth="0.5" />
            {/* Penalty area: width ~ 44%, height ~ 16% */}
            <rect x="28" y="0" width="44" height="16" fill="none" stroke="currentColor" strokeWidth="0.5" />
            {/* Goal area: width ~ 20%, height ~ 5.5% */}
            <rect x="40" y="0" width="20" height="5.5" fill="none" stroke="currentColor" strokeWidth="0.5" />
            {/* Goal: width 11%, height 2% */}
            <rect x="44.5" y="-2" width="11" height="2" fill="currentColor" />
            {/* Penalty spot: 11m/105m ~ 10% */}
            <circle cx="50" cy="10" r="0.4" fill="currentColor" />
            {/* Penalty arc */}
            <path d="M 41.5 16 A 10 10 0 0 0 58.5 16" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </svg>

          {/* Shot Points */}
          <div className="absolute inset-0">
            {shotData.map((shot, idx) => {
              const isGoal = shot.shot_type.toLowerCase() === 'goal';
              const isBlocked = shot.shot_type.toLowerCase() === 'block' || shot.shot_type.toLowerCase() === 'blocked';
              
              // Size proportional to xG
              const xg = shot.calculated_xg || 0.02;
              const r = 3 + (xg * 15);

              let fill = 'transparent';
              let stroke = '#fff';

              if (isGoal) {
                fill = '#10b981'; // green-500
                stroke = '#047857';
              } else if (isBlocked) {
                fill = '#ef4444'; // red-500
                stroke = '#b91c1c';
              } else {
                stroke = '#9ca3af'; // gray-400
                fill = '#e5e7eb'; // gray-200
              }

              return (
                <div
                  key={idx}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-150 z-10"
                  style={{
                    left: `${shot.y}%`,
                    top: `${shot.x * 2}%`,
                  }}
                  onMouseEnter={() => setHoveredShot(shot)}
                  onMouseLeave={() => setHoveredShot(null)}
                >
                  <svg width={r * 4} height={r * 4} viewBox={`0 0 ${r*4} ${r*4}`} className="overflow-visible">
                    {isBlocked ? (
                      <path 
                        d={`M ${r*0.8} ${r*0.8} L ${r*3.2} ${r*3.2} M ${r*3.2} ${r*0.8} L ${r*0.8} ${r*3.2}`} 
                        stroke={stroke} 
                        strokeWidth="1.5" 
                      />
                    ) : (
                      <circle cx={r*2} cy={r*2} r={r*1.5} fill={fill} stroke={stroke} strokeWidth="1" />
                    )}
                  </svg>
                </div>
              );
            })}
          </div>

          {/* Tooltip */}
          {hoveredShot && (
            <div 
              className="absolute z-20 bg-gray-900 text-white text-xs p-3 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 w-48"
              style={{
                left: `${hoveredShot.y}%`,
                top: `${hoveredShot.x * 2}%`,
              }}
            >
              <div className="font-bold border-b border-gray-700 pb-1 mb-1 capitalize">
                {hoveredShot.shot_type}
              </div>
              <div className="grid grid-cols-2 gap-1 mt-2">
                <span className="text-gray-400">xG:</span>
                <span className="text-right font-mono">{hoveredShot.calculated_xg?.toFixed(2) || 'N/A'}</span>
                <span className="text-gray-400">Distance:</span>
                <span className="text-right font-mono">{hoveredShot.distance_m ? `${hoveredShot.distance_m.toFixed(1)}m` : 'N/A'}</span>
                <span className="text-gray-400">Body Part:</span>
                <span className="text-right capitalize">{hoveredShot.body_part || 'N/A'}</span>
                <span className="text-gray-400">Situation:</span>
                <span className="text-right capitalize">{hoveredShot.situation || 'N/A'}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-center space-x-4 mt-6 text-xs text-gray-600">
           <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#10b981] border border-[#047857] mr-1"></div> Goal</div>
           <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#e5e7eb] border border-[#9ca3af] mr-1"></div> Miss/Save</div>
           <div className="flex items-center">
             <svg width="12" height="12" className="mr-1"><path d="M 2 2 L 10 10 M 10 2 L 2 10" stroke="#ef4444" strokeWidth="2" /></svg> Blocked
           </div>
           <div className="flex items-center ml-2 border-l border-gray-300 pl-2">
             <div className="w-2 h-2 rounded-full border border-gray-500 mr-1"></div>
             <div className="w-4 h-4 rounded-full border border-gray-500 mr-1"></div> Size = xG
           </div>
        </div>
      </div>

      {/* Right Column: Statistical Breakdown */}
      <div className="space-y-6">
        <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
           <h3 className="text-xl font-display mb-4 text-navy">Shooting Summary</h3>
           <div className="grid grid-cols-2 gap-4">
             <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center">
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Total Goals</span>
                <span className="text-3xl font-bold text-navy">{goals}</span>
             </div>
             <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center">
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Total xG</span>
                <span className="text-3xl font-bold text-navy">{totalXG.toFixed(2)}</span>
             </div>
             <div className="bg-cream p-4 rounded border border-border flex flex-col items-center justify-center col-span-2">
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Total Shots</span>
                <span className="text-2xl font-bold text-navy">{totalShots}</span>
             </div>
           </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
           <h3 className="text-lg font-display mb-3 text-navy">By Body Part</h3>
           <div className="space-y-3">
             {Object.entries(bodyParts).map(([part, stats]) => (
               <div key={part} className="flex items-center justify-between">
                 <span className="capitalize text-gray-700 text-sm">{part}</span>
                 <div className="flex items-center space-x-4">
                   <span className="text-xs text-gray-500 w-16 text-right">{stats.goals} goals</span>
                   <span className="text-sm font-bold text-navy w-12 text-right">{stats.count} sh</span>
                   <div className="w-24 bg-gray-200 rounded-full h-2">
                     <div 
                       className="h-2 rounded-full" 
                       style={{ width: `${(stats.count / totalShots) * 100}%`, backgroundColor: themeColor }}
                     ></div>
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
           <h3 className="text-lg font-display mb-3 text-navy">By Situation</h3>
           <div className="space-y-3">
             {Object.entries(situations).map(([sit, stats]) => (
               <div key={sit} className="flex items-center justify-between">
                 <span className="capitalize text-gray-700 text-sm">{sit}</span>
                 <div className="flex items-center space-x-4">
                   <span className="text-xs text-gray-500 w-16 text-right">{stats.goals} goals</span>
                   <span className="text-sm font-bold text-navy w-12 text-right">{stats.count} sh</span>
                   <div className="w-24 bg-gray-200 rounded-full h-2">
                     <div 
                       className="h-2 rounded-full" 
                       style={{ width: `${(stats.count / totalShots) * 100}%`, backgroundColor: themeColor }}
                     ></div>
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
           <h3 className="text-lg font-display mb-3 text-navy">Goal Mouth (On Target)</h3>
           <div className="relative w-full max-w-sm mx-auto aspect-[100/60]">
             <svg viewBox="0 0 100 60" className="w-full h-auto text-gray-400">
               {/* Goal frame: posts and crossbar */}
               <path d="M 10 55 L 10 5 L 90 5 L 90 55" fill="none" stroke="currentColor" strokeWidth="1" />
               
               {/* Shots */}
               {onTargetShots.map((shot, idx) => {
                 if (shot.goal_mouth_y == null || shot.goal_mouth_z == null) return null;
                 
                 const GOAL_Y_MIN = 45.2;
                 const GOAL_Y_MAX = 54.8;
                 let cx = 10 + ((shot.goal_mouth_y - GOAL_Y_MIN) / (GOAL_Y_MAX - GOAL_Y_MIN)) * 80;
                 cx = Math.max(10, Math.min(90, cx));
                 
                 const GOAL_Z_MAX = 36.7;
                 let cy = 55 - (Math.min(shot.goal_mouth_z, GOAL_Z_MAX) / GOAL_Z_MAX) * 50;
                 cy = Math.max(5, Math.min(55, cy));
                 
                 const isGoal = shot.shot_type.toLowerCase() === 'goal';
                 const fill = isGoal ? '#10b981' : '#9ca3af';
                 
                 return (
                   <circle
                     key={`gm-${idx}`}
                     cx={cx}
                     cy={cy}
                     r={1.5}
                     fill={fill}
                     fillOpacity={0.65}
                     stroke="#fff"
                     strokeWidth={0.3}
                     className="cursor-pointer hover:opacity-80"
                     onMouseEnter={() => setHoveredGoalMouthShot(shot)}
                     onMouseLeave={() => setHoveredGoalMouthShot(null)}
                   />
                 );
               })}
             </svg>

             {/* Goal Mouth Tooltip */}
             {hoveredGoalMouthShot !== null && (
               <div className="absolute z-20 bg-gray-900 text-white text-xs p-3 rounded shadow-lg pointer-events-none transform -translate-x-1/2 left-1/2 mt-2 w-48">
                 <div className="font-bold border-b border-gray-700 pb-1 mb-1 capitalize">
                   {hoveredGoalMouthShot.shot_type}
                 </div>
                 <div className="grid grid-cols-2 gap-1 mt-2">
                   <span className="text-gray-400">Situation:</span>
                   <span className="text-right capitalize">{hoveredGoalMouthShot.situation || 'N/A'}</span>
                   <span className="text-gray-400">Body Part:</span>
                   <span className="text-right capitalize">{hoveredGoalMouthShot.body_part || 'N/A'}</span>
                 </div>
               </div>
             )}
           </div>

           <div className="flex items-center justify-center space-x-4 mt-6 text-xs text-gray-600">
             <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#10b981] mr-1"></div> Goal</div>
             <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#9ca3af] mr-1"></div> Save</div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ShootingTab;
