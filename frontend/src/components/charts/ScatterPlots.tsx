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

type TabKey = 'Defense' | 'Possession' | 'Creation' | 'Attack';

const TABS: Record<TabKey, { x: string, y: string, xLabel: string, yLabel: string, xPer90: boolean, yPer90: boolean }> = {
  Defense: { x: 'tackles', y: 'interceptions', xLabel: 'Tackles per 90', yLabel: 'Interceptions per 90', xPer90: true, yPer90: true },
  Possession: { x: 'accurate_passes_percentage', y: 'successful_dribbles', xLabel: 'Pass Accuracy %', yLabel: 'Succ. Dribbles per 90', xPer90: false, yPer90: true },
  Creation: { x: 'key_passes', y: 'assists', xLabel: 'Key Passes per 90', yLabel: 'Assists per 90', xPer90: true, yPer90: true },
  Attack: { x: 'goals', y: 'shots_on_target', xLabel: 'Goals per 90', yLabel: 'Shots on Target per 90', xPer90: true, yPer90: true }
};

const ScatterPlots: React.FC<ScatterPlotsProps> = ({ playerId, playerName, positionGroup }) => {
  // Smart Default
  const [activeTab, setActiveTab] = useState<TabKey>('Possession');

  useEffect(() => {
    if (positionGroup) {
      const p = positionGroup.toUpperCase();
      if (p.includes('DEFENDER') || p === 'D') setActiveTab('Defense');
      else if (p.includes('MIDFIELDER') || p === 'M') setActiveTab('Possession');
      else if (p.includes('FORWARD') || p === 'F' || p.includes('ATTACKER')) setActiveTab('Attack');
    }
  }, [positionGroup]);

  const activeMetrics = TABS[activeTab];
  
  const { data: xRanking, isLoading: loadingX } = useLeagueRankings(activeMetrics.x, 600);
  const { data: yRanking, isLoading: loadingY } = useLeagueRankings(activeMetrics.y, 600);

  const mergedData = useMemo(() => {
    if (!xRanking || !yRanking) return [];

    const map = new Map<number, any>();

    const ensurePlayer = (p: PlayerRankingEntry) => {
      if (!map.has(p.player_id)) {
        map.set(p.player_id, {
          player_id: p.player_id,
          name: p.name,
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

    xRanking.forEach(x => {
      const p = ensurePlayer(x);
      if (p.minutes_played >= 600 || p.isTarget) {
        if (activeMetrics.xPer90 && p.minutes_played > 0) {
          p.xValue = parseFloat(((Number(x.value) / p.minutes_played) * 90).toFixed(2));
        } else {
          p.xValue = parseFloat(Number(x.value).toFixed(2));
        }
      }
    });

    yRanking.forEach(y => {
      const p = ensurePlayer(y);
      if (p.minutes_played >= 600 || p.isTarget) {
        if (activeMetrics.yPer90 && p.minutes_played > 0) {
          p.yValue = parseFloat(((Number(y.value) / p.minutes_played) * 90).toFixed(2));
        } else {
          p.yValue = parseFloat(Number(y.value).toFixed(2));
        }
      }
    });

    return Array.from(map.values()).filter(p => p.minutes_played >= 600 || p.isTarget);
  }, [xRanking, yRanking, playerId, activeMetrics]);

  const loading = loadingX || loadingY;

  const targetData = mergedData.filter(d => d.isTarget);
  const otherData = mergedData.filter(d => 
    !d.isTarget && 
    (d.xValue > 0 || d.yValue > 0) &&
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
          {(Object.keys(TABS) as TabKey[]).map(tab => (
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
                tick={{fontSize: 10, fill: '#64748b'}} 
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                label={{ value: activeMetrics.xLabel, position: 'insideBottom', offset: -10, fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} 
              />
              <YAxis 
                type="number" 
                dataKey="yValue" 
                name={activeMetrics.yLabel} 
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
