import React, { useState, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, LabelList } from 'recharts';
import { useLeagueRankings } from '../../hooks/usePlayer';

interface ScatterPlotsProps {
  playerId: number;
  playerName: string;
  playerStats: any;
  positionGroup?: string | null;
  position?: string | null;
  themeColor?: string;
}

const METRIC_GROUPS = [
  { group: "Attacking", metrics: [
    { label: "Goals", key: "goals" }, { label: "Expected Goals (xG)", key: "expected_goals" }, { label: "Assists", key: "assists" }, { label: "Shots Total", key: "total_shots" }, { label: "Shots On Target", key: "shots_on_target" }, { label: "Big Chances Missed", key: "big_chances_missed" }
  ]},
  { group: "Passing", metrics: [
    { label: "Key Passes", key: "key_passes" }, { label: "Crosses Accurate", key: "accurate_crosses" }, { label: "Pass Accuracy %", key: "accurate_passes_percentage", isPercentage: true }, { label: "Passes in Final Third", key: "accurate_final_third_passes" }, { label: "Long Balls", key: "accurate_long_balls" }
  ]},
  { group: "Dribbling", metrics: [
    { label: "Dribbles Completed", key: "successful_dribbles" }, { label: "Dribble Success %", key: "successful_dribbles_percentage", isPercentage: true }
  ]},
  { group: "Defensive", metrics: [
    { label: "Tackles", key: "tackles" }, { label: "Interceptions", key: "interceptions" }, { label: "Clearances", key: "clearances" }, { label: "Duels Won", key: "total_duels_won" }, { label: "Duels Won %", key: "total_duels_won_percentage", isPercentage: true }, { label: "Aerials Won", key: "aerial_duels_won" }
  ]},
  { group: "Creative", metrics: [
    { label: "Big Chances Created", key: "big_chances_created" }
  ]},
  { group: "Other", metrics: [
    { label: "Fouls Drawn", key: "was_fouled" }, { label: "Fouls Committed", key: "fouls" }, { label: "Rating", key: "rating", isPercentage: true }
  ]}
];

const extractMetric = (obj: any, baseKey: string) => {
  if (!obj) return 0;
  // Ranking API standard
  if (obj.value !== undefined && obj.value !== null) return Number(obj.value);
  // Direct key lookup
  if (obj[baseKey] !== undefined && obj[baseKey] !== null) return Number(obj[baseKey]);
  // Fallbacks for common variations just in case
  const fallbacks: Record<string, string[]> = {
    'total_shots': ['shots_total', 'shots'],
    'accurate_crosses': ['total_crosses', 'crosses'],
    'successful_dribbles': ['dribbles_succeeded', 'dribbles'],
    'accurate_passes_percentage': ['pass_accuracy']
  };
  const keys = fallbacks[baseKey] || [];
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return Number(obj[k]);
  }
  return 0;
};

const ScatterPlots: React.FC<ScatterPlotsProps> = ({ playerId, playerName, playerStats, positionGroup, position, themeColor }) => {
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [xAxisKey, setXAxisKey] = useState("key_passes");
  const [yAxisKey, setYAxisKey] = useState("big_chances_created");
  const [minMinutes, setMinMinutes] = useState(300);

  const allMetrics = useMemo(() => METRIC_GROUPS.flatMap(g => g.metrics), []);
  const xAxisMetric = allMetrics.find(m => m.key === xAxisKey) || allMetrics[0];
  const yAxisMetric = allMetrics.find(m => m.key === yAxisKey) || allMetrics[1];

  const { data: xRanking, isLoading: loadingX } = useLeagueRankings(xAxisMetric.key, 300);
  const { data: yRanking, isLoading: loadingY } = useLeagueRankings(yAxisMetric.key, 300);

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
          isTarget: p.player_id === playerId,
          z: p.player_id === playerId ? 200 : 50,
        });
      }
      return map.get(p.player_id);
    };

    // Process X API Ranking
    xRanking.forEach(x => {
      const p = ensurePlayer(x);
      if (p) {
        const rawX = extractMetric(x, xAxisMetric.key);
        if (!xAxisMetric.isPercentage && p.minutes_played > 0) {
          p.xValue = parseFloat(((rawX / p.minutes_played) * 90).toFixed(2));
        } else {
          p.xValue = parseFloat(rawX.toFixed(2));
        }
      }
    });

    // Process Y API Ranking
    yRanking.forEach(y => {
      const p = ensurePlayer(y);
      if (p) {
        const rawY = extractMetric(y, yAxisMetric.key);
        if (!yAxisMetric.isPercentage && p.minutes_played > 0) {
          p.yValue = parseFloat(((rawY / p.minutes_played) * 90).toFixed(2));
        } else {
          p.yValue = parseFloat(rawY.toFixed(2));
        }
      }
    });

    // Inject Target Player explicitly using full stats
    if (playerStats) {
      const tp = ensurePlayer({
        player_id: playerId,
        name: playerName,
        position_group: positionGroup || null,
        minutes_played: playerStats.minutes_played || 0
      });
      if (tp) {
        const rawX = extractMetric(playerStats, xAxisMetric.key);
        if (!xAxisMetric.isPercentage && tp.minutes_played > 0) {
          tp.xValue = parseFloat(((rawX / tp.minutes_played) * 90).toFixed(2));
        } else {
          tp.xValue = parseFloat(rawX.toFixed(2));
        }

        const rawY = extractMetric(playerStats, yAxisMetric.key);
        if (!yAxisMetric.isPercentage && tp.minutes_played > 0) {
          tp.yValue = parseFloat(((rawY / tp.minutes_played) * 90).toFixed(2));
        } else {
          tp.yValue = parseFloat(rawY.toFixed(2));
        }
      }
    }

    // Filter out players who don't meet mins and filter completely null records, but allow 0s
    return Array.from(map.values()).filter(p => 
      (p.minutes_played >= minMinutes || p.isTarget) && 
      (p.xValue != null && p.yValue != null && !isNaN(p.xValue) && !isNaN(p.yValue))
    );
  }, [xRanking, yRanking, playerId, xAxisMetric, yAxisMetric, playerName, playerStats, positionGroup, minMinutes]);

  const loading = loadingX || loadingY;

  const targetData = mergedData.filter(d => d.isTarget);
  // Optional: Only show players in same generic position group to keep the scatter plot relevant
  const otherData = mergedData.filter(d => 
    !d.isTarget && 
    (!positionGroup || d.position_group === positionGroup)
  );

  const renderSelectOptions = () => (
    METRIC_GROUPS.map(group => (
      <optgroup key={group.group} label={group.group}>
        {group.metrics.map(m => (
          <option key={m.key} value={m.key}>{m.label}</option>
        ))}
      </optgroup>
    ))
  );

  const formatAxisLabel = (metric: any) => {
    return metric.isPercentage ? metric.label : `${metric.label} per 90`;
  };

  const xLabel = formatAxisLabel(xAxisMetric);
  const yLabel = formatAxisLabel(yAxisMetric);

  return (
    <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-display text-slate-800 mb-1 uppercase">League Distribution</h3>
          <p className="text-xs text-gray-500">vs Liga 1 {position || positionGroup || 'Players'} (min. {minMinutes} mins)</p>
        </div>
        
        <button
          onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-gray-100 hover:bg-gray-200 text-slate-700 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Customize
        </button>
      </div>

      {isCustomizeOpen && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-wrap gap-6 items-end animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-500 uppercase">X-Axis Metric</label>
            <select 
              value={xAxisKey}
              onChange={(e) => setXAxisKey(e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-cyan-500 outline-none bg-white"
            >
              {renderSelectOptions()}
            </select>
          </div>
          
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-500 uppercase">Y-Axis Metric</label>
            <select 
              value={yAxisKey}
              onChange={(e) => setYAxisKey(e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-cyan-500 outline-none bg-white"
            >
              {renderSelectOptions()}
            </select>
          </div>
          
          <div className="flex flex-col gap-1.5 w-32">
            <label className="text-xs font-bold text-gray-500 uppercase">Min Minutes</label>
            <input 
              type="number" 
              value={minMinutes}
              onChange={(e) => setMinMinutes(Number(e.target.value))}
              className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-cyan-500 outline-none bg-white"
              min="0"
              step="100"
            />
          </div>
        </div>
      )}

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
                name={xLabel}
                domain={[(dataMin: number) => Math.max(0, dataMin * 0.9), (dataMax: number) => dataMax * 1.1]}
                tickFormatter={(value) => Number(value).toFixed(1)}
                tick={{fontSize: 10, fill: '#64748b'}} 
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                label={{ value: xLabel, position: 'insideBottom', offset: -10, fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} 
              />
              <YAxis 
                type="number" 
                dataKey="yValue" 
                name={yLabel} 
                domain={[(dataMin: number) => Math.max(0, dataMin * 0.9), (dataMax: number) => dataMax * 1.1]}
                tickFormatter={(value) => Number(value).toFixed(1)}
                tick={{fontSize: 10, fill: '#64748b'}}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: -5, style: { textAnchor: 'middle' }, fontSize: 11, fill: '#64748b', fontWeight: 'bold' }}
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
                          <span className="text-gray-500">{xLabel}:</span>
                          <span className="text-cyan-500 font-bold">{data.xValue}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">{yLabel}:</span>
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
