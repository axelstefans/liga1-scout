import React, { useMemo } from 'react';
import { PieChart, Pie, Sector, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PlayerProfile } from '../services/api';

interface KeyStrengthsProps {
  profile: PlayerProfile;
  seasonStats: any;
}

const renderPizzaSlice = (props: any) => {
  const { cx, cy, startAngle, endAngle, fill, payload, outerRadius } = props;
  const score = payload.score ?? payload.payload?.score ?? 0;
  const maxRadius = outerRadius || 80;
  const dynamicRadius = Math.max(maxRadius * 0.15, (score / 100) * maxRadius); 
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={10}
      outerRadius={dynamicRadius}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="#fff"
      strokeWidth={2}
    />
  );
};

const renderActivePizzaSlice = (props: any) => {
  const { cx, cy, startAngle, endAngle, fill, payload, outerRadius } = props;
  const score = payload.score ?? payload.payload?.score ?? 0;
  const maxRadius = outerRadius || 80;
  const dynamicRadius = Math.max(maxRadius * 0.15, (score / 100) * maxRadius); 
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={10}
        outerRadius={dynamicRadius + 5}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#fff"
        strokeWidth={2}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={10}
        outerRadius={dynamicRadius + 15}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.3}
      />
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-border p-2 rounded shadow text-xs">
        <p className="font-bold text-navy">{data.name}</p>
        <p>Value (per 90): <span className="font-bold text-navy-blue">{data.rawVal.toFixed(2)}</span></p>
        <p>Score: <span className="font-bold text-green-600">{Math.round(data.score)} / 100</span></p>
      </div>
    );
  }
  return null;
};

const KeyStrengths: React.FC<KeyStrengthsProps> = ({ profile, seasonStats }) => {
  const chartData = useMemo(() => {
    if (!seasonStats || !seasonStats.minutes_played) return null;
    
    const p90 = (val: number) => (val / seasonStats.minutes_played) * 90;
    const normalize = (val: number, max: number) => Math.min(100, Math.max(0, (val / max) * 100));

    const pos = (profile.position_group || '').toUpperCase();
    
    let dataset1: any[] = [];
    let dataset2: any[] = [];
    let title1 = '';
    let title2 = '';

    if (pos.includes('DEFENDER') || pos === 'D') {
      title1 = "Defending";
      dataset1 = [
        { name: 'Tackles', rawVal: p90(seasonStats.tackles || 0), score: normalize(p90(seasonStats.tackles || 0), 4), fill: '#3b82f6' }, // blue-500
        { name: 'Interceptions', rawVal: p90(seasonStats.interceptions || 0), score: normalize(p90(seasonStats.interceptions || 0), 3), fill: '#2563eb' }, // blue-600
        { name: 'Clearances', rawVal: p90(seasonStats.clearances || 0), score: normalize(p90(seasonStats.clearances || 0), 6), fill: '#1d4ed8' }, // blue-700
        { name: 'Aerials Won', rawVal: p90(seasonStats.aerial_duels_won || 0), score: normalize(p90(seasonStats.aerial_duels_won || 0), 4), fill: '#1e40af' }, // blue-800
      ];
      title2 = "On The Ball";
      dataset2 = [
        { name: 'Pass Acc %', rawVal: seasonStats.accurate_passes_percentage || 0, score: normalize(seasonStats.accurate_passes_percentage || 0, 100), fill: '#10b981' }, // emerald-500
        { name: 'Key Passes', rawVal: p90(seasonStats.key_passes || 0), score: normalize(p90(seasonStats.key_passes || 0), 1.5), fill: '#059669' }, // emerald-600
        { name: 'Ground Duels', rawVal: p90(seasonStats.ground_duels_won || 0), score: normalize(p90(seasonStats.ground_duels_won || 0), 5), fill: '#047857' }, // emerald-700
      ];
    } else if (pos.includes('MIDFIELDER') || pos === 'M') {
      title1 = "Creation";
      dataset1 = [
        { name: 'Pass Acc %', rawVal: seasonStats.accurate_passes_percentage || 0, score: normalize(seasonStats.accurate_passes_percentage || 0, 100), fill: '#10b981' },
        { name: 'Key Passes', rawVal: p90(seasonStats.key_passes || 0), score: normalize(p90(seasonStats.key_passes || 0), 3), fill: '#059669' },
        { name: 'Assists', rawVal: p90(seasonStats.assists || 0), score: normalize(p90(seasonStats.assists || 0), 0.5), fill: '#047857' },
      ];
      title2 = "Work Rate";
      dataset2 = [
        { name: 'Tackles', rawVal: p90(seasonStats.tackles || 0), score: normalize(p90(seasonStats.tackles || 0), 4), fill: '#8b5cf6' }, // violet-500
        { name: 'Interceptions', rawVal: p90(seasonStats.interceptions || 0), score: normalize(p90(seasonStats.interceptions || 0), 3), fill: '#7c3aed' }, // violet-600
        { name: 'Succ. Dribbles', rawVal: p90(seasonStats.successful_dribbles || seasonStats.dribbles_succeeded || 0), score: normalize(p90(seasonStats.successful_dribbles || seasonStats.dribbles_succeeded || 0), 3), fill: '#6d28d9' }, // violet-700
      ];
    } else {
      // Attackers
      title1 = "Goal Threat";
      dataset1 = [
        { name: 'Goals', rawVal: p90(seasonStats.goals || 0), score: normalize(p90(seasonStats.goals || 0), 0.8), fill: '#ef4444' }, // red-500
        { name: 'Shots on Target', rawVal: p90(seasonStats.shots_on_target || 0), score: normalize(p90(seasonStats.shots_on_target || 0), 2.5), fill: '#dc2626' }, // red-600
        { name: 'Total Shots', rawVal: p90(seasonStats.shots_total || seasonStats.shots_on_target || 0), score: normalize(p90(seasonStats.shots_total || seasonStats.shots_on_target || 0), 4), fill: '#b91c1c' }, // red-700
      ];
      title2 = "Impact";
      dataset2 = [
        { name: 'Key Passes', rawVal: p90(seasonStats.key_passes || 0), score: normalize(p90(seasonStats.key_passes || 0), 2), fill: '#f59e0b' }, // amber-500
        { name: 'Succ. Dribbles', rawVal: p90(seasonStats.successful_dribbles || seasonStats.dribbles_succeeded || 0), score: normalize(p90(seasonStats.successful_dribbles || seasonStats.dribbles_succeeded || 0), 3), fill: '#d97706' }, // amber-600
        { name: 'Ground Duels', rawVal: p90(seasonStats.ground_duels_won || 0), score: normalize(p90(seasonStats.ground_duels_won || 0), 5), fill: '#b45309' }, // amber-700
      ];
    }

    // Add equal angle value
    dataset1 = dataset1.map(d => ({ ...d, angleVal: 1 }));
    dataset2 = dataset2.map(d => ({ ...d, angleVal: 1 }));

    return { title1, dataset1, title2, dataset2 };
  }, [profile, seasonStats]);

  return (
    <div className="bg-card border border-border p-6 rounded-lg shadow-sm h-full">
      <h3 className="text-xl font-display text-navy mb-1 uppercase">Key Strengths</h3>
      <p className="text-xs text-gray-500 mb-6">Normalized tactical metrics (per 90)</p>
      
      {!chartData ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-500">No data available</div>
      ) : (
        <div className="flex flex-col xl:flex-row h-auto xl:h-[280px] gap-6">
          {/* Chart 1 */}
          <div className="flex-1 flex flex-col items-center">
            <h4 className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">{chartData.title1}</h4>
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie
                    data={chartData.dataset1}
                    dataKey="angleVal"
                    cx="50%"
                    cy="50%"
                    activeShape={renderActivePizzaSlice}
                    shape={renderPizzaSlice}
                    isAnimationActive={false}
                  >
                    {chartData.dataset1.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
              {chartData.dataset1.map(d => (
                <div key={d.name} className="flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }}></span>
                  {d.name}
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden xl:block w-px bg-gray-100 my-4"></div>

          {/* Chart 2 */}
          <div className="flex-1 flex flex-col items-center">
            <h4 className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">{chartData.title2}</h4>
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie
                    data={chartData.dataset2}
                    dataKey="angleVal"
                    cx="50%"
                    cy="50%"
                    activeShape={renderActivePizzaSlice}
                    shape={renderPizzaSlice}
                    isAnimationActive={false}
                  >
                    {chartData.dataset2.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
              {chartData.dataset2.map(d => (
                <div key={d.name} className="flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }}></span>
                  {d.name}
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default KeyStrengths;
