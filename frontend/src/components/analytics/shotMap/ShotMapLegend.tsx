import React from 'react';

export interface ShotMapLegendProps {
  isCumulative: boolean;
  className?: string;
}

/**
 * Bottom strip component showing attacking direction and xG bubble size reference scale.
 */
export const ShotMapLegend: React.FC<ShotMapLegendProps> = ({
  isCumulative,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-1.5 px-3.5 my-1 bg-slate-50/90 border border-slate-200/70 rounded-lg text-xs w-full ${className}`}
    >
      {/* Direction Indicator placed cleanly at pitch base */}
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 select-none">
        Dirección de Ataque ↑
      </span>

      {/* xG Bubble Size Scale */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
          Calidad xG:
        </span>
        <div className="flex items-center gap-3 text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <span
              className={`rounded-full border border-slate-300 bg-slate-200/90 ${
                isCumulative ? 'w-1.5 h-1.5' : 'w-2 h-2'
              }`}
            />
            <span className="font-mono text-slate-500 text-[10.5px]">0.05</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`rounded-full border border-slate-300 bg-slate-200/90 ${
                isCumulative ? 'w-2.5 h-2.5' : 'w-3 h-3'
              }`}
            />
            <span className="font-mono text-slate-500 text-[10.5px]">0.15</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`rounded-full border border-slate-300 bg-slate-200/90 ${
                isCumulative ? 'w-3.5 h-3.5' : 'w-4 h-4'
              }`}
            />
            <span className="font-mono text-slate-500 text-[10.5px]">0.35+</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShotMapLegend;
