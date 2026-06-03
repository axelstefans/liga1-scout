import React, { useState, useMemo, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, LabelList } from 'recharts';
import { useLeagueRankings } from '../../hooks/usePlayer';
import { PlayerRankingEntry } from '../../services/api';

interface ScatterPlotsProps {
  playerId: number;
  playerName: string;
  playerStats: any;
  positionGroup?: string | null;
}

type TabKey = 'Defense' | 'Possession' | 'Creation' | 'Attack' | 'Duels';

const TABS: Record<TabKey, { x: string, y: string, xLabel: string, yLabel: string, xPer90: boolean, yPer90: boolean }> = {
  Defense: { x: 'tackles', y: 'interceptions', xLabel: 'Tackles per 90', yLabel: 'Interceptions per 90', xPer90: true, yPer90: true },
  Possession: { x: 'accurate_passes_percentage', y: 'successful_dribbles', xLabel: 'Pass Accuracy %', yLabel: 'Succ. Dribbles per 90', xPer90: false, yPer90: true },
  Creation: { x: 'key_passes', y: 'assists', xLabel: 'Key Passes per 90', yLabel: 'Assists per 90', xPer90: true, yPer90: true },
  Attack: { x: 'goals', y: 'shots_on_target', xLabel: 'Goals per 90', yLabel: 'Shots on Target per 90', xPer90: true, yPer90: true },
  Duels: { x: 'aerial_duels_won', y: 'ground_duels_won', xLabel: 'Aerial Duels Won per 90', yLabel: 'Ground Duels Won per 90', xPer90: true, yPer90: true }
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
    'aerial_duels_won': ['aerial_duels_won', 'duels_won_aerial', 'aerialDuelsWon'],
    'ground_duels_won': ['ground_duels_won', 'duels_won_ground', 'groundDuelsWon']
  };
  
  const keys = fallbacks[baseKey] || [baseKey];
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return Number(obj[k]);
  }
  // API rankings return value
  if (obj.value !== undefined && obj.value !== null) return Number(obj.value);
  return 0;
};

const ScatterPlots: React.FC<ScatterPlotsProps> = ({ playerId, playerName, playerStats, positionGroup }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('Possession');

  const pos = (positionGroup || '').toUpperCase();
  let availableTabs: TabKey[] = ['Defense', 'Possession', 'Creation', 'Attack'];
  if (pos.includes('DEFENDER') || pos === 'D') {
    availableTabs = ['Defense', 'Possession', 'Duels'];
  } else if (pos.includes('FORWARD') || pos === 'F' || pos.includes('ATTACKER') || pos === 'A') {
    availableTabs = ['Possession', 'Creation', 'Attack'];
  } else if (pos.includes('MIDFIELDER') || pos === 'M') {
    availableTabs = ['Defense', 'Possession', 'Creation', 'Attack'];
  }

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [positionGroup, activeTab, availableTabs]);

  const activeMetrics = TABS[activeTab];
  
  const { data: xRanking, isLoading: loadingX } = useLeagueRankings(activeMetrics.x, 300);
  const { data: yRanking, isLoading: loadingY } = useLeagueRankings(activeMetrics.y, 300);

  const mergedData = useMemo(() => {
    if (!xRanking || !yRanking) return [];

    const map = new Map<number, any>();

    const ensurePlayer = (p: Partial<PlayerRankingEntry>) => {
      if (!p.player_id) return null;
      if (!map.has(p.player_id)) {
        map.set(p.player_id, {
          player_id: p.player_id,
          name: p.name || 'Unknown',
          position_group: p.position_group,
          minutes_played: p.minutes_played || 0,
          xValue: 0,
          yValue: 0,
          isTarget: p.player_id === playerId,
          z: p.player_id === playerId ? 200 : 50,
        });
      }
      return map.get(p.player_id);
    };

    // 1. Process X API Ranking
    xRanking.forEach(x => {
      const p = ensurePlayer(x);
      if (p && (p.minutes_played >= 600 || p.isTarget)) {
        const rawX = extractMetric(x, activeMetrics.x);
        if (activeMetrics.xPer90 && p.minutes_played > 0) {
          p.xValue = parseFloat(((rawX / p.minutes_played) * 90).toFixed(2));
        } else {
          p.xValue = parseFloat(rawX.toFixed(2));
        }
      }
    });

    // 2. Process Y API Ranking
    yRanking.forEach(y => {
      const p = ensurePlayer(y);
      if (p && (p.minutes_played >= 600 || p.isTarget)) {
        const rawY = extractMetric(y, activeMetrics.y);
        if (activeMetrics.yPer90 && p.minutes_played > 0) {
          p.yValue = parseFloat(((rawY / p.minutes_played) * 90).toFixed(2));
        } else {
          p.yValue = parseFloat(rawY.toFixed(2));
        }
      }
    });

    // 3. Inject Target Player Robustly (using full stats to avoid 0s if missing from top 300 rankings)
    if (playerStats) {
      const tp = ensurePlayer({
        player_id: playerId,
        name: playerName,
        position_group: positionGroup || null,
        minutes_played: playerStats.minutes_played || 0
      });
      if (tp) {
        // Only overwrite if it's currently 0 or we want to ensure accuracy from full stats
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

    // Filter out players who don't meet mins and rigidly filter ALL 0s from either axis
    return Array.from(map.values()).filter(p => 
      (p.minutes_played >= 600 || p.isTarget) && 
      (p.xValue > 0 && p.yValue > 0)
    );
  }, [xRanking, yRanking, playerId, activeMetrics, playerName, playerStats, positionGroup]);

  const loading = loadingX || loadingY;

  const targetData = mergedData.filter(d => d.isTarget);
  const otherData = mergedData.filter(d => 
    !d.isTarget && 
    (!positionGroup || d.position_group === positionGroup)
  );

  return (
    <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-display text-slate-800 mb-1 uppercase">League Distribution</h3>
          <p className="text-xs text-gray-500">vs Liga 1 {positionGroup ? positionGroup + 's' : 'Players'} (min. 600 mins)</p>
        </div>
        
        {/* Smart Tabs */}
        <div className="flex flex-wrap bg-gray-100 p-1 rounded-md border border-gray-200">
          {availableTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${
                activeTab === tab ? 'bg-cyan-500 text-white shadow-sm' : 'text-gray-500 hover:text-slate-800'
              }`}
            >
              {tab}
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
                domain={['auto', 'auto']}
                tick={{fontSize: 10, fill: '#64748b'}} 
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                label={{ value: activeMetrics.xLabel, position: 'insideBottom', offset: -10, fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} 
              />
              <YAxis 
                type="number" 
                dataKey="yValue" 
                name={activeMetrics.yLabel} 
                domain={['auto', 'auto']}
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
                <Scatter data={targetData} fill="#06b6d4" fillOpacity={1.0}>
                  <LabelList dataKey="name" position="top" fill="#06b6d4" fontSize={12} fontWeight="bold" />
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
