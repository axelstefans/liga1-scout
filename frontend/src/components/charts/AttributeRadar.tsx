import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { PlayerSeasonStats } from '../../services/api';

interface AttributeRadarProps {
  stats: PlayerSeasonStats;
  positionGroup: string | null;
}

// Very rough normalization function to generate 0-100 scores based on raw values.
// In a real app, this would use league percentiles.
const normalize = (value: number | null, max: number) => {
  if (value === null || value === undefined) return 0;
  return Math.min(Math.round((value / max) * 100), 100);
};

const AttributeRadar: React.FC<AttributeRadarProps> = ({ stats, positionGroup }) => {
  
  const data = useMemo(() => {
    // Generate scores (these max values are arbitrary approximations for Liga 1 per season)
    const attacking = normalize((stats.goals || 0) * 5 + (stats.assists || 0) * 3, 50);
    const passing = normalize(stats.accurate_passes_percentage || 0, 100);
    const defending = normalize((stats.tackles || 0) * 2 + (stats.interceptions || 0) * 2, 80);
    const physical = normalize(stats.ground_duels_won_percentage || 0, 100);
    const creative = normalize(stats.key_passes || 0, 40);
    const retention = normalize(stats.successful_dribbles || 0, 50);

    return [
      { subject: 'Attacking', A: attacking, fullMark: 100 },
      { subject: 'Passing', A: passing, fullMark: 100 },
      { subject: 'Creative', A: creative, fullMark: 100 },
      { subject: 'Defending', A: defending, fullMark: 100 },
      { subject: 'Physical', A: physical, fullMark: 100 },
      { subject: 'Retention', A: retention, fullMark: 100 },
    ];
  }, [stats]);

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#E8E8E0" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#0D1B2A', fontSize: 12, fontWeight: 600 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#FAFAF7', borderColor: '#E8E8E0', borderRadius: '8px' }}
            itemStyle={{ color: '#1B4F8A', fontWeight: 'bold' }}
          />
          <Radar
            name="Score"
            dataKey="A"
            stroke="#1B4F8A"
            fill="#1B4F8A"
            fillOpacity={0.4}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AttributeRadar;
