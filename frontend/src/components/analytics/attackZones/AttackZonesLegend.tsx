import React from 'react';
import { FlankDistribution } from './attackZonesGeometry';

export interface AttackZonesLegendProps {
  distribution: FlankDistribution;
  className?: string;
}

/**
 * Compact macro corridor distribution strip summarizing attacking shares across
 * Left Flank (Banda + M.E. Izq), Center Lane, and Right Flank (Banda + M.E. Der).
 */
export const AttackZonesLegend: React.FC<AttackZonesLegendProps> = ({
  distribution,
  className = '',
}) => {
  const { leftPct, centerPct, rightPct, leftEntries, centerEntries, rightEntries } = distribution;

  return (
    <div
      className={`w-full grid grid-cols-3 divide-x divide-slate-200/70 py-1.5 px-2 mt-1.5 bg-slate-50/90 border border-slate-200/70 rounded-lg text-[11px] ${className}`}
    >
      {/* Left Flank */}
      <div className="flex items-center justify-between px-2.5 gap-2">
        <span className="font-semibold text-slate-500 truncate">Flanco Izq.</span>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="font-mono font-bold text-slate-900">{leftPct}%</span>
          <span className="text-[10px] text-slate-400 font-mono">({leftEntries})</span>
        </div>
      </div>

      {/* Center */}
      <div className="flex items-center justify-between px-2.5 gap-2">
        <span className="font-semibold text-slate-500 truncate">Centro</span>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="font-mono font-bold text-amber-700">{centerPct}%</span>
          <span className="text-[10px] text-slate-400 font-mono">({centerEntries})</span>
        </div>
      </div>

      {/* Right Flank */}
      <div className="flex items-center justify-between px-2.5 gap-2">
        <span className="font-semibold text-slate-500 truncate">Flanco Der.</span>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="font-mono font-bold text-slate-900">{rightPct}%</span>
          <span className="text-[10px] text-slate-400 font-mono">({rightEntries})</span>
        </div>
      </div>
    </div>
  );
};

export default AttackZonesLegend;
