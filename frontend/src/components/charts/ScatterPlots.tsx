import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, LabelList } from 'recharts';
import { useLeagueRankings } from '../../hooks/usePlayer';
import { PlayerRankingEntry } from '../../services/api';

interface ScatterPlotsProps {
  playerId: number;
  playerName: string;
  playerStats: any; // Kept for compatibility but unused
  positionGroup?: string | null;
}

const ScatterPlots: React.FC<ScatterPlotsProps> = ({ playerId, playerName, positionGroup }) => {
  const { data: goalsRanking, isLoading: loadingGoals } = useLeagueRankings('goals', 200);
  const { data: assistsRanking, isLoading: loadingAssists } = useLeagueRankings('assists', 200);

  const mergedData = useMemo(() => {
    if (!goalsRanking || !assistsRanking) return [];

    const map = new Map<number, any>();

    const ensurePlayer = (p: PlayerRankingEntry) => {
      if (!map.has(p.player_id)) {
        map.set(p.player_id, {
          player_id: p.player_id,
          name: p.name,
          position_group: p.position_group,
          goalsPer90: 0,
          assistsPer90: 0,
          isTarget: p.player_id === playerId,
          z: p.player_id === playerId ? 150 : 40,
        });
      }
      return map.get(p.player_id);
    };

    goalsRanking.forEach(g => {
      const p = ensurePlayer(g);
      if (g.minutes_played && g.minutes_played > 0) {
        p.goalsPer90 = parseFloat(((Number(g.value) / g.minutes_played) * 90).toFixed(2));
      }
    });

    assistsRanking.forEach(a => {
      const p = ensurePlayer(a);
      if (a.minutes_played && a.minutes_played > 0) {
        p.assistsPer90 = parseFloat(((Number(a.value) / a.minutes_played) * 90).toFixed(2));
      }
    });

    return Array.from(map.values());
  }, [goalsRanking, assistsRanking, playerId]);

  const loading = loadingGoals || loadingAssists;

  const targetData = mergedData.filter(d => d.isTarget);
  const otherData = mergedData.filter(d => 
    !d.isTarget && 
    (d.goalsPer90 > 0 || d.assistsPer90 > 0) &&
    (!positionGroup || d.position_group === positionGroup)
  );

  const positionLabel = positionGroup ? `${positionGroup}s` : 'Players';

  return (
    <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
      <h3 className="text-xl font-display text-navy mb-1">LEAGUE DISTRIBUTION</h3>
      <p className="text-xs text-gray-500 mb-6">Goals vs Assists per 90 · Liga 1 {positionLabel} 2026</p>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-500">Loading distribution...</div>
      ) : mergedData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-500">No data available</div>
      ) : (
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E0" />
              <XAxis 
                type="number" 
                dataKey="goalsPer90" 
                name="Goals per 90" 
                domain={[0, 1.2]}
                allowDataOverflow={true}
                tick={{fontSize: 10}} 
                label={{ value: 'Goals per 90', position: 'insideBottom', offset: -10, fontSize: 12 }} 
              />
              <YAxis 
                type="number" 
                dataKey="assistsPer90" 
                name="Assists per 90" 
                domain={[0, 0.8]}
                allowDataOverflow={true}
                tick={{fontSize: 10}}
                label={{ value: 'Assists per 90', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' }, fontSize: 12 }}
              />
              <ZAxis type="number" dataKey="z" range={[40, 150]} />
              
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-border p-2 rounded shadow text-xs z-50">
                        <p className="font-bold text-navy">{data.name}</p>
                        <p>Goals per 90: {data.goalsPer90}</p>
                        <p>Assists per 90: {data.assistsPer90}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              
              <Scatter data={otherData} fill="#9CA3AF" fillOpacity={0.3} />
              {targetData.length > 0 && (
                <Scatter data={targetData} fill="#1B4F8A" fillOpacity={1.0}>
                  <LabelList dataKey="name" position="top" fill="#1B4F8A" fontSize={12} fontWeight="bold" />
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
