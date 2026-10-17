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

  const totalBigChances = pAll?.total_big_chances ?? 0;
  const totalBigChancesScored = pAll?.total_big_chances_scored ?? 0;
  const totalBigChancesMissed = pAll?.total_big_chances_missed ?? 0;

  return (
    <div className="flex flex-col justify-between h-full min-h-[425px] bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            Presencia en Área & Calidad
          </h3>
        </div>
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
        <div className="flex-1 flex flex-col justify-between gap-2.5">
          {/* 1. Toques en Área Rival */}
          <div className="bg-slate-50/50 rounded-lg border border-slate-200/60 p-3">
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                Toques en Área Rival
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline gap-1">
                <span>{touchesBoxAll.toFixed(1)}</span>
                <span className="text-xs font-normal text-slate-500 font-sans">/ pj</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-200/60 text-xs">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">POR MITAD</span>
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600">
                <span>1T: <strong className="text-slate-900 font-bold tabular-nums">{touchesBox1T.toFixed(1)}</strong></span>
                <span className="text-slate-300">|</span>
                <span>2T: <strong className="text-slate-900 font-bold tabular-nums">{touchesBox2T.toFixed(1)}</strong></span>
              </div>
            </div>
          </div>

          {/* 2. Calidad de Tiro (xGOT vs xG) */}
          <div className="bg-slate-50/50 rounded-lg border border-slate-200/60 p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                Calidad de Tiro (xGOT vs xG)
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                  xgotDelta >= 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                    : 'bg-rose-50 text-rose-700 border-rose-200/60'
                }`}
              >
                {xgotDelta >= 0 ? `+${xgotDelta.toFixed(2)}` : xgotDelta.toFixed(2)} delta
              </span>
            </div>

            {/* 2-Column Integrated Tabular Block */}
            <div className="grid grid-cols-2 divide-x divide-slate-200/60 bg-slate-50/50 rounded-lg border border-slate-200/60 overflow-hidden text-center py-2">
              <div className="px-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  xGOT a Puerta
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {avgXgot.toFixed(2)}
                </span>
                <span className="block text-[10px] text-slate-500 font-sans">Colocación efectiva</span>
              </div>
              <div className="px-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  xG Pre-Remate
                </span>
                <span className="text-lg font-bold font-mono text-slate-700 tabular-nums">
                  {avgXg.toFixed(2)}
                </span>
                <span className="block text-[10px] text-slate-500 font-sans">Peligro generado</span>
              </div>
            </div>

            {/* Discreet Badge Bar: Grandes Ocasiones */}
            <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Grandes Ocasiones</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-emerald-700 font-semibold">{totalBigChancesScored} anotadas</span>
                <span className="text-slate-300">/</span>
                <span className="text-rose-700 font-semibold">{totalBigChancesMissed} falladas</span>
                <span className="text-slate-400 text-[10px]">({totalBigChances} tot)</span>
              </div>
            </div>
          </div>

          {/* 3. Pases en Último Tercio */}
          <div className="bg-slate-50/50 rounded-lg border border-slate-200/60 p-3">
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                Pases Último Tercio
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline gap-1">
                <span>{passesFinalThirdAll.toFixed(1)}</span>
                <span className="text-xs font-normal text-slate-500 font-sans">/ pj</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-200/60 text-xs">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">POR MITAD</span>
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600">
                <span>1T: <strong className="text-slate-900 font-bold tabular-nums">{passesFinalThird1T.toFixed(1)}</strong></span>
                <span className="text-slate-300">|</span>
                <span>2T: <strong className="text-slate-900 font-bold tabular-nums">{passesFinalThird2T.toFixed(1)}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamBoxControlCard;
