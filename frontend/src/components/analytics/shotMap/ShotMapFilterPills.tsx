import React from 'react';
import { ResultFilterType, ShotCounts } from './shotMapGeometry';

export interface ShotMapFilterPillsProps {
  resultFilter: ResultFilterType;
  counts: ShotCounts;
  onSelectFilter: (filter: ResultFilterType) => void;
}

/**
 * Outcome filter pill buttons for single-line switching between shot results.
 */
export const ShotMapFilterPills: React.FC<ShotMapFilterPillsProps> = ({
  resultFilter,
  counts,
  onSelectFilter,
}) => {
  return (
    <div className="flex flex-nowrap items-center justify-between gap-1 p-1 bg-slate-100/70 rounded-lg border border-slate-200/60 overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden export-ignore">
      <button
        type="button"
        onClick={() => onSelectFilter('all')}
        className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex-1 ${
          resultFilter === 'all'
            ? 'bg-white text-slate-900 shadow-xs font-semibold'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
        }`}
      >
        <span>Todos</span>
        <span className="font-mono text-[10px] opacity-75">({counts.all})</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectFilter('goal')}
        className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex-1 ${
          resultFilter === 'goal'
            ? 'bg-white text-emerald-700 shadow-xs font-semibold'
            : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-200/60'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        <span>Goles</span>
        <span className="font-mono text-[10px] opacity-75">({counts.goal})</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectFilter('saved')}
        className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex-1 ${
          resultFilter === 'saved'
            ? 'bg-white text-blue-700 shadow-xs font-semibold'
            : 'text-slate-600 hover:text-blue-700 hover:bg-slate-200/60'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
        <span>Atajados</span>
        <span className="font-mono text-[10px] opacity-75">({counts.saved})</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectFilter('blocked')}
        className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex-1 ${
          resultFilter === 'blocked'
            ? 'bg-white text-slate-800 shadow-xs font-semibold'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-xs bg-slate-500 shrink-0" />
        <span>Bloqueados</span>
        <span className="font-mono text-[10px] opacity-75">({counts.blocked})</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectFilter('miss')}
        className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex-1 ${
          resultFilter === 'miss'
            ? 'bg-white text-rose-700 shadow-xs font-semibold'
            : 'text-slate-600 hover:text-rose-700 hover:bg-slate-200/60'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full border border-rose-500 bg-transparent shrink-0" />
        <span>Desviados</span>
        <span className="font-mono text-[10px] opacity-75">({counts.miss})</span>
      </button>
    </div>
  );
};

export default ShotMapFilterPills;
