import React from 'react';
import { Crosshair, Loader2 } from 'lucide-react';
import { TeamFlashscoreSummaryResponse } from '../../types/flashscore';

export interface TeamBoxControlCardProps {
  data?: TeamFlashscoreSummaryResponse;
  isLoading?: boolean;
}

export const TeamBoxControlCard: React.FC<TeamBoxControlCardProps> = ({
  data,
  isLoading = false,
}) => {
  const pAll = data?.periods?.ALL;
  const p1T = data?.periods?.['1T'];
  const p2T = data?.periods?.['2T'];
  const hasData = Boolean(data && data.matches_analyzed > 0 && pAll);

  // Metrics
  const touchesBoxAll = pAll?.avg_touches_in_box ?? 0;
  const touchesBox1T = p1T?.avg_touches_in_box ?? 0;
  const touchesBox2T = p2T?.avg_touches_in_box ?? 0;

  const avgXg = pAll?.avg_xg ?? 0;
  const avgXgot = pAll?.avg_xgot ?? 0;
  const xgotDelta = avgXgot - avgXg;

  const passesFinalThirdAll = pAll?.avg_passes_final_third_completed ?? 0;
  const passesFinalThird1T = p1T?.avg_passes_final_third_completed ?? 0;
  const passesFinalThird2T = p2T?.avg_passes_final_third_completed ?? 0;

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm flex flex-col justify-between h-full min-h-[385px]">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-slate-500" />
            <span>Presencia en Área & Calidad</span>
          </h3>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Por Partido
          </span>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 flex-1 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400 mb-2" />
            <span className="text-xs text-slate-400 font-medium">Cargando métricas de área...</span>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-16 text-center flex-1 text-slate-400">
            <span className="text-xs text-slate-400 font-medium">Sin registros disponibles para este equipo</span>
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {/* 1. Toques en Área Rival */}
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Toques en Área Rival
                </span>
                <span className="text-2xl font-bold text-slate-900 tracking-tight">
                  {touchesBoxAll.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60">
                <span className="text-xs font-semibold text-slate-600">Por tiempo</span>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <span>1T: <strong className="text-slate-900 font-bold">{touchesBox1T.toFixed(1)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>2T: <strong className="text-slate-900 font-bold">{touchesBox2T.toFixed(1)}</strong></span>
                </div>
              </div>
            </div>

            {/* 2. Calidad de Tiro (xGOT vs xG) */}
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Calidad de Tiro (xGOT vs xG)
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                    xgotDelta >= 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {xgotDelta >= 0 ? `+${xgotDelta.toFixed(2)}` : xgotDelta.toFixed(2)} delta
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white border border-slate-200/80 rounded-md p-2 text-center">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                    xGOT a Puerta
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    {avgXgot.toFixed(2)}
                  </span>
                  <span className="block text-[10px] text-slate-500">Colocación efectiva</span>
                </div>
                <div className="bg-white border border-slate-200/80 rounded-md p-2 text-center">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                    xG Pre-Remate
                  </span>
                  <span className="text-lg font-bold text-slate-700">
                    {avgXg.toFixed(2)}
                  </span>
                  <span className="block text-[10px] text-slate-500">Peligro generado</span>
                </div>
              </div>
            </div>

            {/* 3. Pases en Último Tercio */}
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Pases Último Tercio
                </span>
                <span className="text-2xl font-bold text-slate-900 tracking-tight">
                  {passesFinalThirdAll.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60">
                <span className="text-xs font-semibold text-slate-600">Por tiempo</span>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <span>1T: <strong className="text-slate-900 font-bold">{passesFinalThird1T.toFixed(1)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>2T: <strong className="text-slate-900 font-bold">{passesFinalThird2T.toFixed(1)}</strong></span>
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

export default TeamBoxControlCard;
