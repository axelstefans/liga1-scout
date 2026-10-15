import React from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { TeamFlashscoreSummaryResponse } from '../../types/flashscore';

export interface TeamGoalkeeperCardProps {
  data?: TeamFlashscoreSummaryResponse;
  isLoading?: boolean;
}

export const TeamGoalkeeperCard: React.FC<TeamGoalkeeperCardProps> = ({
  data,
  isLoading = false,
}) => {
  const gk = data?.goalkeeper_efficiency;
  const hasData = Boolean(data && data.matches_analyzed > 0 && gk);

  const goalsPrevented = gk?.goals_prevented ?? 0;
  const preventedPerMatch = gk?.prevented_per_match ?? 0;
  const xgotFaced = gk?.xgot_faced ?? 0;
  const goalsConceded = gk?.goals_conceded ?? 0;

  const isPositive = goalsPrevented >= 0;

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm flex flex-col justify-between h-full min-h-[385px]">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <span>Rendimiento de Portería</span>
          </h3>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Eficiencia Bajo Palos
          </span>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 flex-1 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400 mb-2" />
            <span className="text-xs text-slate-400 font-medium">Cargando métricas de portería...</span>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-16 text-center flex-1 text-slate-400">
            <span className="text-xs text-slate-400 font-medium">Sin registros disponibles para este equipo</span>
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {/* 1. Goles Prevenidos Totales */}
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
              <div className="flex items-baseline justify-between mb-1">
                <div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                    Goles Prevenidos Totales
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    xGOT recibido vs Goles concedidos
                  </span>
                </div>
                <span
                  className={`text-2xl font-bold tracking-tight ${
                    isPositive ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {isPositive ? `+${goalsPrevented.toFixed(2)}` : goalsPrevented.toFixed(2)}
                </span>
              </div>

              {/* Goles Salvados / PJ */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                <span className="text-xs font-semibold text-slate-600">Goles Salvados / PJ</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${
                    preventedPerMatch >= 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {preventedPerMatch >= 0 ? `+${preventedPerMatch.toFixed(2)}` : preventedPerMatch.toFixed(2)} / pj
                </span>
              </div>
            </div>

            {/* 2. 2-Column Split: xGOT Recibido vs Goles Concedidos Reales */}
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-2">
                Exigencia vs Concesión
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white border border-slate-200/80 rounded-md p-2.5 text-center">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                    xGOT Recibido a Puerta
                  </span>
                  <span className="text-xl font-bold text-slate-800">
                    {xgotFaced.toFixed(2)}
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    Dificultad de tiros rivales
                  </span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-md p-2.5 text-center">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                    Goles Concedidos Reales
                  </span>
                  <span className="text-xl font-bold text-slate-900">
                    {goalsConceded}
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    Goles recibidos en muestra
                  </span>
                </div>
              </div>

              {/* Diagnóstico */}
              <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-medium">
                <span className="text-slate-500">Diagnóstico:</span>
                <span className={isPositive ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                  {isPositive ? 'Atajador en superávit (+)' : 'Concesión sobre lo esperado (-)'}
                </span>
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

export default TeamGoalkeeperCard;
