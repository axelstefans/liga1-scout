import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { PlayerSeasonStats } from '../../services/api';

interface AttributeRadarProps {
  stats: PlayerSeasonStats;
  positionGroup: string | null;
  themeColor?: string;
}

const avg = (...values: (number | null | undefined)[]) => {
  const valid = values.filter((v): v is number => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
};

const AttributeRadar: React.FC<AttributeRadarProps> = ({ stats, themeColor }) => {
  
  const data = useMemo(() => {
    const attacking = avg(stats.goals_pct, stats.assists_pct);
    const passing = avg(stats.accurate_passes_percentage_pct);
    const defending = avg(stats.tackles_pct, stats.interceptions_pct);
    const physical = avg(stats.ground_duels_won_percentage_pct);
    const creative = avg(stats.key_passes_pct);
    const retention = avg(stats.successful_dribbles_pct);

    return [
      { subject: attacking === null ? 'Attacking (N/A)' : 'Attacking', A: attacking || 0, fullMark: 100 },
      { subject: passing === null ? 'Passing (N/A)' : 'Passing', A: passing || 0, fullMark: 100 },
      { subject: creative === null ? 'Creative (N/A)' : 'Creative', A: creative || 0, fullMark: 100 },
      { subject: defending === null ? 'Defending (N/A)' : 'Defending', A: defending || 0, fullMark: 100 },
      { subject: physical === null ? 'Physical (N/A)' : 'Physical', A: physical || 0, fullMark: 100 },
      { subject: retention === null ? 'Retention (N/A)' : 'Retention', A: retention || 0, fullMark: 100 },
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
            stroke={themeColor || "#1B4F8A"}
            fill={themeColor || "#1B4F8A"}
            fillOpacity={0.4}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AttributeRadar;
