import React from 'react';
import { HeatmapPoint } from '../../../services/api';
import { FullPitchMarkings } from './scoutingFloor02Utils';

export interface PitchHeatmapCardProps {
  playerName: string;
  title: string;
  subtitle: string;
  sampleHeatmapPoints: HeatmapPoint[];
  clubThemeColor: string;
}

export const PitchHeatmapCard: React.FC<PitchHeatmapCardProps> = ({
  playerName,
  title,
  subtitle,
  sampleHeatmapPoints,
  clubThemeColor,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 flex flex-col justify-between shadow-sm h-full">
      <div className="flex flex-col items-center justify-center text-center mb-2 gap-0.5">
        <div className="font-sans font-semibold text-slate-800 text-[12px] tracking-normal normal-case">
          {playerName} — {title}
        </div>
        <p className="text-[10.5px] font-medium text-slate-500 font-sans mt-0.5">{subtitle}</p>
      </div>

      <div className="relative w-full aspect-[68/105] max-w-[215px] mx-auto overflow-hidden">
        <svg viewBox="0 0 68 105" className="w-full h-full block pointer-events-auto">
          <defs>
            <filter id="pitch-heatmap-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
          </defs>

          <rect x="0" y="0" width="68" height="105" fill="#f5f7f4" stroke="#363835" strokeWidth="0.28" />

          {/* Action density cloud */}
          <g filter="url(#pitch-heatmap-blur)">
            {sampleHeatmapPoints.map((pt, idx) => {
              const cx = Math.max(2.0, Math.min(66.0, (1.0 - pt.y / 100) * 68));
              const cy = Math.max(2.0, Math.min(103.0, (1.0 - pt.x / 100) * 105));
              const r = 4.0 + Math.min(2.5, (pt.count || 1) * 0.6);
              const opacity = Math.min(0.22, 0.09 + (pt.count || 1) * 0.03);

              return (
                <circle
                  key={`heat-point-${idx}`}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={clubThemeColor}
                  fillOpacity={opacity}
                />
              );
            })}
          </g>

          <FullPitchMarkings />
        </svg>
      </div>
    </div>
  );
};

export default PitchHeatmapCard;
