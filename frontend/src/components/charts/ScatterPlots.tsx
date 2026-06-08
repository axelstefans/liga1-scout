import React, { useState, useMemo, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, LabelList } from 'recharts';
import { useLeagueRankings } from '../../hooks/usePlayer';
import { PlayerRankingEntry } from '../../services/api';

interface ScatterPlotsProps {
  playerId: number;
  playerName: string;
  playerStats: any;
  positionGroup?: string | null;
  position?: string | null;
  themeColor?: string;
}

interface TabConfig {
  name: string;
  x: string;
  y: string;
  xLabel: string;
  yLabel: string;
  xPer90: boolean;
  yPer90: boolean;
}

const getTabsForPosition = (position: string | null): TabConfig[] => {
  const pos = (position || '').toUpperCase();
  
  if (pos === 'CB') {
    return [
      { name: 'Defensa Proactiva', x: 'interceptions', y: 'tackles', xLabel: 'Interceptions per 90', yLabel: 'Tackles per 90', xPer90: true, yPer90: true },
      { name: 'Duelos', x: 'aerial_duels_won', y: 'ground_duels_won', xLabel: 'Aerial Duels Won per 90', yLabel: 'Ground Duels Won per 90', xPer90: true, yPer90: true },
      { name: 'Salida', x: 'accurate_passes_percentage', y: 'successful_dribbles', xLabel: 'Pass Accuracy %', yLabel: 'Succ. Dribbles per 90', xPer90: false, yPer90: true }
    ];
  }
  
  if (['RB', 'LB', 'RWB', 'LWB'].includes(pos)) {
    return [
      { name: 'Defensa', x: 'interceptions', y: 'tackles', xLabel: 'Interceptions per 90', yLabel: 'Tackles per 90', xPer90: true, yPer90: true },
      { name: 'Conducción', x: 'ground_duels_won', y: 'successful_dribbles', xLabel: 'Ground Duels Won per 90', yLabel: 'Succ. Dribbles per 90', xPer90: true, yPer90: true },
      { name: 'Creación', x: 'key_passes', y: 'crosses', xLabel: 'Key Passes per 90', yLabel: 'Crosses per 90', xPer90: true, yPer90: true }
    ];
  }

  if (['CDM', 'CM'].includes(pos)) {
    return [
      { name: 'Destrucción', x: 'interceptions', y: 'tackles', xLabel: 'Interceptions per 90', yLabel: 'Tackles per 90', xPer90: true, yPer90: true },
      { name: 'Distribución', x: 'accurate_passes_percentage', y: 'key_passes', xLabel: 'Pass Accuracy %', yLabel: 'Key Passes per 90', xPer90: false, yPer90: true },
      { name: 'Duelos', x: 'aerial_duels_won', y: 'ground_duels_won', xLabel: 'Aerial Duels Won per 90', yLabel: 'Ground Duels Won per 90', xPer90: true, yPer90: true }
    ];
  }

  if (['CAM', 'RM', 'LM', 'RW', 'LW'].includes(pos)) {
    return [
      { name: 'Creación', x: 'crosses', y: 'key_passes', xLabel: 'Crosses per 90', yLabel: 'Key Passes per 90', xPer90: true, yPer90: true },
      { name: 'Desequilibrio', x: 'ground_duels_won', y: 'successful_dribbles', xLabel: 'Ground Duels Won per 90', yLabel: 'Succ. Dribbles per 90', xPer90: true, yPer90: true },
      { name: 'Amenaza', x: 'total_shots', y: 'shots_on_target', xLabel: 'Total Shots per 90', yLabel: 'Shots on Target per 90', xPer90: true, yPer90: true }
    ];
  }

  if (['ST', 'CF'].includes(pos)) {
    return [
      { name: 'Amenaza de Gol', x: 'goals', y: 'shots_on_target', xLabel: 'Goals per 90', yLabel: 'Shots on Target per 90', xPer90: true, yPer90: true },
      { name: 'Asociación', x: 'accurate_passes_percentage', y: 'key_passes', xLabel: 'Pass Accuracy %', yLabel: 'Key Passes per 90', xPer90: false, yPer90: true },
      { name: 'Imposición', x: 'aerial_duels_won', y: 'ground_duels_won', xLabel: 'Aerial Duels Won per 90', yLabel: 'Ground Duels Won per 90', xPer90: true, yPer90: true }
    ];
  }

  // Fallback
  return [
    { name: 'Distribución', x: 'accurate_passes_percentage', y: 'key_passes', xLabel: 'Pass Accuracy %', yLabel: 'Key Passes per 90', xPer90: false, yPer90: true },
    { name: 'Duelos', x: 'aerial_duels_won', y: 'ground_duels_won', xLabel: 'Aerial Duels Won per 90', yLabel: 'Ground Duels Won per 90', xPer90: true, yPer90: true },
    { name: 'Amenaza', x: 'total_shots', y: 'shots_on_target', xLabel: 'Total Shots per 90', yLabel: 'Shots on Target per 90', xPer90: true, yPer90: true }
  ];
};

const extractMetric = (obj: any, baseKey: string) => {
  if (!obj) return 0;
  const fallbacks: Record<string, string[]> = {
    'tackles': ['tackles', 'total_tackles', 'totalTackles'],
    'interceptions': ['interceptions', 'total_interceptions', 'totalInterceptions'],
    'accurate_passes_percentage': ['accurate_passes_percentage', 'pass_accuracy', 'accuratePassesPercentage', 'passAccuracy'],
    'successful_dribbles': ['successful_dribbles', 'dribbles_succeeded', 'successfulDribbles', 'dribbles'],
    'key_passes': ['key_passes', 'total_key_passes', 'keyPasses'],
    'assists': ['assists', 'total_assists', 'totalAssists'],
    'goals': ['goals', 'total_goals', 'totalGoals'],
    'shots_on_target': ['shots_on_target', 'shots_on_goal', 'shotsOnTarget'],
    'total_shots': ['total_shots', 'shots_total', 'totalShots', 'shots'],
    'aerial_duels_won': ['aerial_duels_won', 'duels_won_aerial', 'aerialDuelsWon'],
    'ground_duels_won': ['ground_duels_won', 'duels_won_ground', 'groundDuelsWon'],
    'crosses': ['accurate_crosses', 'accurateCrosses', 'total_crosses', 'totalCrosses', 'crosses'],
    'clearances': ['clearances', 'total_clearances', 'totalClearances']
  };
  
  const keys = fallbacks[baseKey] || [baseKey];
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return Number(obj[k]);
  }
  // API rankings return value directly in .value
  if (obj.value !== undefined && obj.value !== null) return Number(obj.value);
  return 0;
};

const ScatterPlots: React.FC<ScatterPlotsProps> = ({ playerId, playerName, playerStats, positionGroup, position, themeColor }) => {
  const availableTabs = useMemo(() => getTabsForPosition(position), [position]);
  const [activeTabName, setActiveTabName] = useState<string>(availableTabs[0].name);

  // If position changes and active tab isn't valid for new position, reset it
  useEffect(() => {
    if (!availableTabs.some(t => t.name === activeTabName)) {
      setActiveTabName(availableTabs[0].name);
    }
  }, [availableTabs, activeTabName]);

  const activeMetrics = availableTabs.find(t => t.name === activeTabName) || availableTabs[0];
  
  const { data: xRanking, isLoading: loadingX } = useLeagueRankings(activeMetrics.x, 300);
  const { data: yRanking, isLoading: loadingY } = useLeagueRankings(activeMetrics.y, 300);

  const mergedData = useMemo(() => {
    if (!xRanking || !yRanking) return [];

    const map = new Map<number, any>();

    const ensurePlayer = (p: any) => {
      if (!p.player_id) return null;
      if (!map.has(p.player_id)) {
        map.set(p.player_id, {
          player_id: p.player_id,
          name: p.name || 'Unknown',
          position_group: p.position_group,
          minutes_played: p.minutes_played || 0,
          xValue: 0,
          yValue: 0,
          accurate_passes_percentage: p.accurate_passes_percentage,
          isTarget: p.player_id === playerId,
          z: p.player_id === playerId ? 200 : 50,
        });
      } else {
        const existing = map.get(p.player_id);
        if (p.accurate_passes_percentage !== undefined && p.accurate_passes_percentage !== null) {
          existing.accurate_passes_percentage = p.accurate_passes_percentage;
        }
      }
      return map.get(p.player_id);
    };

    // Process X API Ranking
    xRanking.forEach(x => {
      const p = ensurePlayer(x);
      if (p && (p.minutes_played >= 600 || p.isTarget)) {
        const rawX = extractMetric(x, activeMetrics.x);
        if (activeMetrics.xPer90 && p.minutes_played > 0) {
          p.xValue = parseFloat(((rawX / p.minutes_played) * 90).toFixed(2));
        } else {
          p.xValue = parseFloat(rawX.toFixed(2));
        }

        // Safety cross-check: if Y is pass accuracy, grab it from this X payload
        if (activeMetrics.y === 'accurate_passes_percentage' && p.yValue === 0) {
          p.yValue = x.accurate_passes_percentage ?? 0;
        }
      }
    });

    // Process Y API Ranking
    yRanking.forEach(y => {
      const p = ensurePlayer(y);
      if (p && (p.minutes_played >= 600 || p.isTarget)) {
        const rawY = extractMetric(y, activeMetrics.y);
        if (activeMetrics.yPer90 && p.minutes_played > 0) {
          p.yValue = parseFloat(((rawY / p.minutes_played) * 90).toFixed(2));
        } else {
          p.yValue = parseFloat(rawY.toFixed(2));
        }

        // Safety cross-check: if X is pass accuracy, grab it from this Y payload
        if (activeMetrics.x === 'accurate_passes_percentage' && p.xValue === 0) {
          p.xValue = y.accurate_passes_percentage ?? 0;
        }
      }
    });

    // Inject Target Player explicitly using full stats to avoid 0s if they missed the top 300
    if (playerStats) {
      const tp = ensurePlayer({
        player_id: playerId,
        name: playerName,
        position_group: positionGroup || null,
        minutes_played: playerStats.minutes_played || 0
      });
      if (tp) {
        const rawX = extractMetric(playerStats, activeMetrics.x);
        if (activeMetrics.xPer90 && tp.minutes_played > 0) {
          tp.xValue = parseFloat(((rawX / tp.minutes_played) * 90).toFixed(2));
        } else {
          tp.xValue = parseFloat(rawX.toFixed(2));
        }

        const rawY = extractMetric(playerStats, activeMetrics.y);
        if (activeMetrics.yPer90 && tp.minutes_played > 0) {
          tp.yValue = parseFloat(((rawY / tp.minutes_played) * 90).toFixed(2));
        } else {
          tp.yValue = parseFloat(rawY.toFixed(2));
        }
      }
    }

    // Filter out players who don't meet mins and filter completely null records, but allow 0s
    return Array.from(map.values()).filter(p => 
      (p.minutes_played >= 600 || p.isTarget) && 
      (p.xValue != null && p.yValue != null && !isNaN(p.xValue) && !isNaN(p.yValue))
    );
  }, [xRanking, yRanking, playerId, activeMetrics, playerName, playerStats, positionGroup]);

  const loading = loadingX || loadingY;

  const targetData = mergedData.filter(d => d.isTarget);
  // Optional: Only show players in same generic position group (Defenders vs Midfielders) to keep the scatter plot relevant
  const otherData = mergedData.filter(d => 
    !d.isTarget && 
    (!positionGroup || d.position_group === positionGroup)
  );

  return (
    <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-display text-slate-800 mb-1 uppercase">League Distribution</h3>
          <p className="text-xs text-gray-500">vs Liga 1 {position || positionGroup || 'Players'} (min. 600 mins)</p>
        </div>
        
        {/* Smart Tabs */}
        <div className="flex flex-wrap bg-gray-100 p-1 rounded-md border border-gray-200">
          {availableTabs.map(tab => (
            <button
              key={tab.name}
              onClick={() => setActiveTabName(tab.name)}
              className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${
                activeTabName === tab.name ? 'shadow-sm' : 'text-gray-500 hover:text-slate-800'
              }`}
              style={activeTabName === tab.name ? { backgroundColor: themeColor || '#0ea5e9', color: '#fff' } : {}}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-80 flex items-center justify-center text-sm text-gray-500">Loading analytics...</div>
      ) : mergedData.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-sm text-gray-500">No data available</div>
      ) : (
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                type="number" 
                dataKey="xValue" 
                name={activeMetrics.xLabel}
                domain={[(dataMin: number) => Math.max(0, dataMin * 0.9), (dataMax: number) => dataMax * 1.1]}
                tickFormatter={(value) => Number(value).toFixed(1)}
                tick={{fontSize: 10, fill: '#64748b'}} 
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                label={{ value: activeMetrics.xLabel, position: 'insideBottom', offset: -10, fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} 
              />
              <YAxis 
                type="number" 
                dataKey="yValue" 
                name={activeMetrics.yLabel} 
                domain={[(dataMin: number) => Math.max(0, dataMin * 0.9), (dataMax: number) => dataMax * 1.1]}
                tickFormatter={(value) => Number(value).toFixed(1)}
                tick={{fontSize: 10, fill: '#64748b'}}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                label={{ value: activeMetrics.yLabel, angle: -90, position: 'insideLeft', offset: -5, style: { textAnchor: 'middle' }, fontSize: 11, fill: '#64748b', fontWeight: 'bold' }}
              />
              <ZAxis type="number" dataKey="z" range={[50, 200]} />
              
              <Tooltip 
                cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 p-3 rounded shadow-lg text-xs z-50">
                        <p className="font-bold text-slate-800 mb-2">{data.name}</p>
                        <div className="flex justify-between gap-4 mb-1">
                          <span className="text-gray-500">{activeMetrics.xLabel}:</span>
                          <span className="text-cyan-500 font-bold">{data.xValue}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">{activeMetrics.yLabel}:</span>
                          <span className="text-cyan-500 font-bold">{data.yValue}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              
              {/* Generic League Players */}
              <Scatter data={otherData} fill="#cbd5e1" fillOpacity={0.6} />
              
              {/* Target Player */}
              {targetData.length > 0 && (
                <Scatter data={targetData} fill={themeColor || '#0ea5e9'} fillOpacity={1.0}>
                  <LabelList dataKey="name" position="top" fill={themeColor || '#0ea5e9'} fontSize={12} fontWeight="bold" />
                </Scatter>
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default ScatterPlots;
