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

  // Comparison metrics: Possession % and Passes Completed
  const poss1T = p1T?.avg_possession ?? 0;
  const poss2T = p2T?.avg_possession ?? 0;

  const passes1T = p1T?.avg_passes_completed ?? 0;
  const passes2T = p2T?.avg_passes_completed ?? 0;

  const shotsOnTarget1T = p1T?.avg_shots_on_target ?? 0;
  const shotsOnTarget2T = p2T?.avg_shots_on_target ?? 0;

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm flex flex-col justify-between h-full min-h-[385px]">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Split className="w-4 h-4 text-slate-500" />
            <span>Balance Táctico (1T vs 2T)</span>
          </h3>
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
          <div className="space-y-2.5 sm:space-y-3">
            {/* 1. Net xG 1T vs 2T Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* xG Neto 1T */}
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
                <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
                  xG Neto 1T
                </span>
                <span
                  className={`text-2xl font-bold tracking-tight block ${
                    netXg1T >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {netXg1T >= 0 ? `+${netXg1T.toFixed(2)}` : netXg1T.toFixed(2)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-1">
                  {p1T?.avg_xg.toFixed(2)} fav · {p1T?.avg_xg_conceded.toFixed(2)} con
                </span>
              </div>

              {/* xG Neto 2T */}
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
                <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
                  xG Neto 2T
                </span>
                <span
                  className={`text-2xl font-bold tracking-tight block ${
                    netXg2T >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {netXg2T >= 0 ? `+${netXg2T.toFixed(2)}` : netXg2T.toFixed(2)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-1">
                  {p2T?.avg_xg.toFixed(2)} fav · {p2T?.avg_xg_conceded.toFixed(2)} con
                </span>
              </div>
            </div>

            {/* 2. Comparison Rows: Posesión % & Pases Completados */}
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-2.5">
              <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Evolución de Dominio
              </span>

              {/* Row A: Posesión % */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-xs font-semibold text-slate-600">Posesión de Balón</span>
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <span>1T: <strong className="text-slate-900 font-bold">{poss1T.toFixed(1)}%</strong></span>
                    <span className="text-slate-300">|</span>
                    <span>2T: <strong className="text-slate-900 font-bold">{poss2T.toFixed(1)}%</strong></span>
                  </div>
                </div>
                {/* Visual Ratio Bar */}
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden flex">
                  <div
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, poss1T))}%` }}
                    title={`1T: ${poss1T.toFixed(1)}%`}
                  />
                  <div
                    className="bg-slate-300 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, 100 - poss1T))}%` }}
                  />
                </div>
              </div>

              {/* Row B: Pases Completados */}
              <div className="pt-2 border-t border-slate-200/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-xs font-semibold text-slate-600">Pases Completados</span>
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <span>1T: <strong className="text-slate-900 font-bold">{passes1T.toFixed(0)}</strong></span>
                    <span className="text-slate-300">|</span>
                    <span>2T: <strong className="text-slate-900 font-bold">{passes2T.toFixed(0)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Row C: Tiros al Arco */}
              <div className="pt-2 border-t border-slate-200/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-xs font-semibold text-slate-600">Tiros a Puerta / Mitad</span>
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <span>1T: <strong className="text-slate-900 font-bold">{shotsOnTarget1T.toFixed(1)}</strong></span>
                    <span className="text-slate-300">|</span>
                    <span>2T: <strong className="text-slate-900 font-bold">{shotsOnTarget2T.toFixed(1)}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {hasData && (
        <div className="text-[11px] text-slate-400 text-right mt-2">
          Muestra: {data?.matches_analyzed} {data?.matches_analyzed === 1 ? 'partido analizado' : 'partidos analizados'}
        </div>
      )}
    </div>
  );
};

export default TeamPeriodDominanceCard;
