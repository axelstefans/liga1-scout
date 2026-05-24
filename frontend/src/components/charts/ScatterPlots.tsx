import React, { useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { useLeagueRankings } from '../../hooks/usePlayer';
import { PlayerSeasonStats } from '../../services/api';

interface ScatterPlotsProps {
  playerId: number;
  playerName: string;
  playerStats: PlayerSeasonStats;
}

const StatDistributionPlot: React.FC<{ statKey: string; label: string; playerId: number; playerName: string; playerValue: number | null }> = ({ statKey, label, playerId, playerName, playerValue }) => {
  const { data: rankings, isLoading } = useLeagueRankings(statKey);

  if (isLoading) return <div className="h-48 flex items-center justify-center text-sm text-gray-500">Loading distribution...</div>;
  if (!rankings || rankings.length === 0) return null;

  // Find the player's rank in this list
  const playerRankEntry = rankings.find(r => r.player_id === playerId);
  
  // Format data for Recharts (Rank vs Value)
  const chartData = rankings.map(r => ({
    x: r.rank,
    y: typeof r.value === 'number' ? r.value : parseFloat(r.value as string),
    name: r.name,
    isTarget: r.player_id === playerId
  }));

  // Compute Y-axis domain from actual data with 15% padding so points spread vertically
  const yValues = chartData.map(d => d.y).filter(v => !isNaN(v));
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const yPadding = (yMax - yMin) * 0.15 || 1; // fallback 1 if all values are equal
  const yDomain: [number, number] = [
    Math.max(0, parseFloat((yMin - yPadding).toFixed(2))),
    parseFloat((yMax + yPadding).toFixed(2))
  ];

  // Ensure the target player is rendered on top
  const targetData = chartData.filter(d => d.isTarget);
  const otherData = chartData.filter(d => !d.isTarget);

  return (
    <div className="w-full h-64 mt-4">
      <h4 className="text-sm font-bold text-navy text-center mb-2">{label} Distribution (Top 100)</h4>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E0" />
          <XAxis type="number" dataKey="x" name="Rank" reversed tick={{fontSize: 10}} label={{ value: 'Rank', position: 'insideBottom', offset: -10, fontSize: 10 }} />
          {/* domain derived from actual data min/max with padding to prevent vertical compression */}
          <YAxis type="number" dataKey="y" name="Value" domain={yDomain} tick={{fontSize: 10}} />

          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-cream border border-border p-2 rounded shadow text-xs">
                    <p className="font-bold text-navy">{data.name}</p>
                    <p>Rank: {data.x}</p>
                    <p>{label}: {data.y}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Scatter data={otherData} fill="#1B4F8A" fillOpacity={0.4} />
          {targetData.length > 0 && (
            <Scatter data={targetData} fill="#ff4d4f" shape="diamond" />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

const ScatterPlots: React.FC<ScatterPlotsProps> = ({ playerId, playerName, playerStats }) => {
  const [selectedStat, setSelectedStat] = useState<string>('rating');

  const statOptions = [
    { key: 'rating', label: 'Rating' },
    { key: 'goals', label: 'Goals' },
    { key: 'assists', label: 'Assists' },
    { key: 'accurate_passes_percentage', label: 'Pass Accuracy %' },
    { key: 'tackles', label: 'Tackles' }
  ];

  // Get the actual value for the current player from their season stats
  const getPlayerValue = (key: string) => {
    return (playerStats as any)[key] || null;
  };

  return (
    <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <h3 className="text-xl font-display text-navy">League Distribution</h3>
        <select 
          className="mt-2 sm:mt-0 bg-cream border border-border text-navy text-sm rounded focus:ring-navy-blue focus:border-navy-blue block p-2"
          value={selectedStat}
          onChange={(e) => setSelectedStat(e.target.value)}
        >
          {statOptions.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>
      
      <p className="text-xs text-gray-500 mb-2">The diamond (<span className="text-[#ff4d4f]">◆</span>) represents {playerName}'s position in the league curve.</p>

      <StatDistributionPlot 
        statKey={selectedStat} 
        label={statOptions.find(o => o.key === selectedStat)?.label || selectedStat}
        playerId={playerId}
        playerName={playerName}
        playerValue={getPlayerValue(selectedStat)}
      />
    </div>
  );
};

export default ScatterPlots;
