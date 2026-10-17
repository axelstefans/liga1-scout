import React from 'react';
import { Split, Loader2 } from 'lucide-react';
import { TeamFlashscoreSummaryResponse } from '../../types/flashscore';

export interface TeamPeriodDominanceCardProps {
  data?: TeamFlashscoreSummaryResponse;
  isLoading?: boolean;
}

export const TeamPeriodDominanceCard: React.FC<TeamPeriodDominanceCardProps> = ({
  data,
  isLoading = false,
}) => {
  const p1T = data?.periods?.['1T'];
  const p2T = data?.periods?.['2T'];
  const hasData = Boolean(data && data.matches_analyzed > 0 && p1T && p2T);

  // Net xG calculations (avg_xg - avg_xg_conceded)
  const netXg1T = (p1T?.avg_xg ?? 0) - (p1T?.avg_xg_conceded ?? 0);
  const netXg2T = (p2T?.avg_xg ?? 0) - (p2T?.avg_xg_conceded ?? 0);

  // Comparison metrics: Possession %, Passes Completed, Shots on Target
  const poss1T = p1T?.avg_possession ?? 0;
  const poss2T = p2T?.avg_possession ?? 0;
  const possTotal = poss1T + poss2T > 0 ? poss1T + poss2T : 100;
  const possRatio1T = (poss1T / possTotal) * 100;

  const passes1T = p1T?.avg_passes_completed ?? 0;
  const passes2T = p2T?.avg_passes_completed ?? 0;
  const totalPasses = passes1T + passes2T;
  const passRatio1T = totalPasses > 0 ? (passes1T / totalPasses) * 100 : 50;

  const shotsOnTarget1T = p1T?.avg_shots_on_target ?? 0;
  const shotsOnTarget2T = p2T?.avg_shots_on_target ?? 0;
  const totalShots = shotsOnTarget1T + shotsOnTarget2T;
  const shotRatio1T = totalShots > 0 ? (shotsOnTarget1T / totalShots) * 100 : 50;

  return (
    <div className="flex flex-col justify-between h-full min-h-[425px] bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Split className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            Balance Táctico (1T vs 2T)
          </h3>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Diferencial Neto
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 flex-1 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400 mb-2" />
          <span className="text-xs text-slate-400 font-medium">Cargando balance táctico...</span>
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-16 text-center flex-1 text-slate-400">
          <span className="text-xs text-slate-400 font-medium">Sin registros disponibles para este equipo</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between gap-2.5">
          {/* 1. Integrated 2-Column Tabular Block: Net xG 1T vs 2T */}
          <div className="grid grid-cols-2 divide-x divide-slate-200/60 bg-slate-50/50 rounded-lg border border-slate-200/60 overflow-hidden text-center py-2.5">
            {/* xG Neto 1T */}
            <div className="px-2">
              <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                xG Neto 1T
              </span>
              <span
                className={`text-2xl font-bold font-mono tracking-tight tabular-nums block ${
                  netXg1T >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {netXg1T >= 0 ? `+${netXg1T.toFixed(2)}` : netXg1T.toFixed(2)}
              </span>
              <span className="block text-[10px] font-mono text-slate-500 mt-1">
                {p1T?.avg_xg.toFixed(2)} fav · {p1T?.avg_xg_conceded.toFixed(2)} con
              </span>
            </div>

            {/* xG Neto 2T */}
            <div className="px-2">
              <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                xG Neto 2T
              </span>
              <span
                className={`text-2xl font-bold font-mono tracking-tight tabular-nums block ${
                  netXg2T >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {netXg2T >= 0 ? `+${netXg2T.toFixed(2)}` : netXg2T.toFixed(2)}
              </span>
              <span className="block text-[10px] font-mono text-slate-500 mt-1">
                {p2T?.avg_xg.toFixed(2)} fav · {p2T?.avg_xg_conceded.toFixed(2)} con
              </span>
            </div>
          </div>

          {/* 2. Comparison Rows: Evolución de Dominio */}
          <div className="bg-slate-50/50 rounded-lg border border-slate-200/60 p-3 space-y-2.5 flex-1 flex flex-col justify-between">
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Evolución de Dominio
            </span>

            {/* Row A: Posesión % */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-xs font-semibold text-slate-600">Posesión de Balón</span>
                <div className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600">
                  <span>1T: <strong className="text-slate-900 font-bold tabular-nums">{poss1T.toFixed(1)}%</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>2T: <strong className="text-slate-900 font-bold tabular-nums">{poss2T.toFixed(1)}%</strong></span>
                </div>
              </div>
              {/* Visual Balance Bar */}
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden flex">
                <div
                  className="bg-amber-500 h-full rounded-l-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, possRatio1T))}%` }}
                />
                <div
                  className="bg-slate-300 h-full rounded-r-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, 100 - possRatio1T))}%` }}
                />
              </div>
            </div>

            {/* Row B: Pases Completados */}
            <div className="pt-2 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-xs font-semibold text-slate-600">Pases Completados</span>
                <div className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600">
                  <span>1T: <strong className="text-slate-900 font-bold tabular-nums">{passes1T.toFixed(0)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>2T: <strong className="text-slate-900 font-bold tabular-nums">{passes2T.toFixed(0)}</strong></span>
                </div>
              </div>
              {/* Visual Balance Bar */}
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden flex">
                <div
                  className="bg-sky-600 h-full rounded-l-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, passRatio1T))}%` }}
                />
                <div
                  className="bg-slate-300 h-full rounded-r-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, 100 - passRatio1T))}%` }}
                />
              </div>
            </div>

            {/* Row C: Tiros a Puerta / Mitad */}
            <div className="pt-2 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-xs font-semibold text-slate-600">Tiros a Puerta / Mitad</span>
                <div className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600">
                  <span>1T: <strong className="text-slate-900 font-bold tabular-nums">{shotsOnTarget1T.toFixed(1)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>2T: <strong className="text-slate-900 font-bold tabular-nums">{shotsOnTarget2T.toFixed(1)}</strong></span>
                </div>
              </div>
              {/* Visual Balance Bar */}
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden flex">
                <div
                  className="bg-indigo-600 h-full rounded-l-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, shotRatio1T))}%` }}
                />
                <div
                  className="bg-slate-300 h-full rounded-r-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, 100 - shotRatio1T))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamPeriodDominanceCard;
