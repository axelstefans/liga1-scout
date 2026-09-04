import React, { useMemo } from 'react';
import { PlayerSeasonStats } from '../services/api';

interface DossierRadarProps {
  stats: PlayerSeasonStats;
  themeColor?: string;
}

const formatVal = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return 'N/A';
  return val.toFixed(1).replace(/\.0$/, '');
};

const DossierRadar: React.FC<DossierRadarProps> = ({ stats, themeColor }) => {
  
  const data = useMemo(() => {
    return [
      { subject: 'Goals', A: stats.goals_pct || 0, rawValue: formatVal(stats.goals) },
      { subject: 'Exp. Goals', A: stats.expected_goals_pct || 0, rawValue: formatVal(stats.expected_goals) },
      { subject: 'Shots on Target', A: stats.shots_on_target_pct || 0, rawValue: formatVal(stats.shots_on_target) },
      { subject: 'Assists', A: stats.assists_pct || 0, rawValue: formatVal(stats.assists) },
      { subject: 'Key Passes', A: stats.key_passes_pct || 0, rawValue: formatVal(stats.key_passes) },
      { subject: 'Acc. Pass %', A: stats.accurate_passes_percentage_pct || 0, rawValue: formatVal(stats.accurate_passes_percentage) },
      { subject: 'Final 3rd Passes', A: stats.accurate_final_third_passes_pct || 0, rawValue: formatVal(stats.accurate_final_third_passes) },
      { subject: 'Succ. Dribbles', A: stats.successful_dribbles_pct || 0, rawValue: formatVal(stats.successful_dribbles) },
      { subject: 'Ground Duels %', A: stats.ground_duels_won_percentage_pct || 0, rawValue: formatVal(stats.ground_duels_won_percentage) },
      { subject: 'Aerial Duels', A: stats.aerial_duels_won_pct || 0, rawValue: formatVal(stats.aerial_duels_won) },
      { subject: 'Tackles', A: stats.tackles_pct || 0, rawValue: formatVal(stats.tackles) },
      { subject: 'Interceptions', A: stats.interceptions_pct || 0, rawValue: formatVal(stats.interceptions) },
      { subject: 'Clearances', A: stats.clearances_pct || 0, rawValue: formatVal(stats.clearances) },
    ];
  }, [stats]);

  // SVG Geometry Constants
  const cx = 300;
  const cy = 300;
  const maxRadius = 200;
  const sliceAngle = (2 * Math.PI) / data.length;

  return (
    <div className="w-full h-full min-h-[600px] flex items-center justify-center">
      <svg width="600" height="600" viewBox="0 0 600 600" className="overflow-visible">
        
        {/* Background Grids */}
        {/* 100% Mark */}
        <circle cx={cx} cy={cy} r={maxRadius} fill="none" stroke="#e5e7eb" strokeWidth="2" strokeDasharray="4 4" />
        
        {/* 50% Benchmark Line */}
        <circle cx={cx} cy={cy} r={maxRadius / 2} fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="6 6" />
        
        {/* Slices (Petals) */}
        {data.map((item, index) => {
          // Mid angle starts at top (-90 degrees or -Math.PI / 2)
          const midAngle = -Math.PI / 2 + index * sliceAngle;
          const startAngle = midAngle - sliceAngle / 2;
          const endAngle = midAngle + sliceAngle / 2;
          
          // Map 0-100 to 0-200px radius
          const r = (item.A / 100) * maxRadius;
          
          // Calculate path points
          const x1 = cx + r * Math.cos(startAngle);
          const y1 = cy + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle);
          const y2 = cy + r * Math.sin(endAngle);
          
          // Path string (M = move to center, L = line to edge, A = arc to next edge, Z = close)
          const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
          
          // Calculate text position for rawValue
          const textX = cx + (r * 0.65) * Math.cos(midAngle);
          const textY = cy + (r * 0.65) * Math.sin(midAngle);
          
          return (
            <g key={`slice-group-${index}`}>
              <path
                d={path}
                fill={themeColor || '#ef4444'}
                fillOpacity={0.7}
                stroke="white"
                strokeWidth="2"
                className="transition-all duration-300 hover:fill-opacity-90 cursor-pointer"
              />
              <text
                x={textX}
                y={textY}
                fill="white"
                fontWeight="bold"
                fontSize="18"
                textAnchor="middle"
                alignmentBaseline="middle"
                style={{ pointerEvents: 'none' }}
              >
                {item.rawValue}
              </text>
            </g>
          );
        })}
        
        {/* Labels */}
        {data.map((item, index) => {
          const midAngle = -Math.PI / 2 + index * sliceAngle;
          const labelRadius = maxRadius + 30; // 30px padding outside the max radius
          
          const labelX = cx + labelRadius * Math.cos(midAngle);
          const labelY = cy + labelRadius * Math.sin(midAngle);
          
          // Determine text anchor based on X position to avoid clipping
          let textAnchor = "middle";
          if (Math.abs(Math.cos(midAngle)) > 0.1) {
            textAnchor = Math.cos(midAngle) > 0 ? "start" : "end";
          }
          
          return (
            <text
              key={`label-${index}`}
              x={labelX}
              y={labelY}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              className="text-2xl font-bold fill-slate-800"
            >
              {item.subject}
            </text>
          );
        })}
        
        {/* Center dot */}
        <circle cx={cx} cy={cy} r="4" fill="#334155" />
      </svg>
    </div>
  );
};

export default DossierRadar;
