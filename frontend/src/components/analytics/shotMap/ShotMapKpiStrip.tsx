import React from 'react';
import { ShotMode, ShotSummaryStats } from './shotMapGeometry';

export interface ShotMapKpiStripProps {
  summary: ShotSummaryStats;
  mode: ShotMode;
  viewMode: 'cumulative' | 'match';
}

/**
 * Opta-style tabular KPI metrics strip showing key finishing and volume indicators.
 */
export const ShotMapKpiStrip: React.FC<ShotMapKpiStripProps> = ({
  summary,
  mode,
  viewMode,
}) => {
  return (
    <div className="grid grid-cols-5 divide-x divide-slate-200/60 py-1.5 px-1 bg-slate-50/70 rounded-lg border border-slate-200/60 text-center">
      {/* 1. Remates */}
      <div className="flex flex-col items-center justify-center px-1">
        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
          Remates
        </span>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="font-mono text-xs sm:text-sm font-bold text-slate-900">
            {summary.total_shots}
          </span>
          {viewMode === 'cumulative' && summary.shots_per_match !== undefined && (
            <span className="text-[10px] font-mono text-slate-400">
              {summary.shots_per_match.toFixed(1)}/pj
            </span>
          )}
        </div>
      </div>

      {/* 2. Goles / GC */}
      <div className="flex flex-col items-center justify-center px-1">
        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
          {mode === 'against' ? 'GC' : 'Goles'}
        </span>
        <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 mt-0.5">
          {summary.goals}
        </span>
      </div>

      {/* 3. xG Total / xGA Total */}
      <div className="flex flex-col items-center justify-center px-1">
        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
          {mode === 'against' ? 'xGA Total' : 'xG Total'}
        </span>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="font-mono text-xs sm:text-sm font-bold text-slate-900">
            {summary.total_xg.toFixed(2)}
          </span>
          {viewMode === 'cumulative' && summary.xg_per_match !== undefined && (
            <span className="text-[10px] font-mono text-slate-400">
              {summary.xg_per_match.toFixed(2)}/pj
            </span>
          )}
        </div>
      </div>

      {/* 4. xG / Tiro */}
      <div className="flex flex-col items-center justify-center px-1">
        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
          xG / Tiro
        </span>
        <span className="font-mono text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">
          {summary.xg_per_shot.toFixed(2)}
        </span>
      </div>

      {/* 5. % a Puerta */}
      <div className="flex flex-col items-center justify-center px-1">
        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
          % a Puerta
        </span>
        <span className="font-mono text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">
          {summary.on_target_pct}%
        </span>
      </div>
    </div>
  );
};

export default ShotMapKpiStrip;
