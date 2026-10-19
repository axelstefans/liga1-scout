import React from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { TeamFlashscoreSummaryResponse } from '../../types/flashscore';
import { useTeamMostUsedXI } from '../../hooks/useTeam';

export interface TeamGoalkeeperCardProps {
  data?: TeamFlashscoreSummaryResponse;
  isLoading?: boolean;
  goalkeeperName?: string;
  teamId?: number;
}

export const TeamGoalkeeperCard: React.FC<TeamGoalkeeperCardProps> = ({
  data,
  isLoading = false,
  goalkeeperName,
  teamId,
}) => {
  const gk = data?.goalkeeper_efficiency;
  const hasData = Boolean(data && data.matches_analyzed > 0 && gk);

  const effectiveTeamId = teamId ?? data?.team_id;
  const { data: xiData } = useTeamMostUsedXI(
    goalkeeperName ? undefined : effectiveTeamId
  );
  const startingGkName =
    goalkeeperName ||
    xiData?.players?.find((p) => p.slot === 'GK' || p.position_group === 'Goalkeeper')?.name;

  const goalsPrevented = gk?.goals_prevented ?? 0;
  const preventedPerMatch = gk?.prevented_per_match ?? 0;
  const xgotFaced = gk?.xgot_faced ?? 0;
  const goalsConceded = gk?.goals_conceded ?? 0;

  const isPositive = goalsPrevented >= 0;

  return (
    <div className="flex flex-col justify-between h-full min-h-[425px] bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
            Rendimiento de Portería
          </h3>
        </div>
        <span
          className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100/90 px-2 py-0.5 rounded border border-slate-200/80 truncate max-w-[190px]"
          title={startingGkName ? `Portero Titular: ${startingGkName}` : 'Eficiencia Bajo Palos'}
        >
          {startingGkName ? `PORTERO: ${startingGkName}` : 'Eficiencia Bajo Palos'}
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
        <div className="flex-1 flex flex-col justify-between gap-2.5">
          {/* 1. Goles Prevenidos Totales */}
          <div className="bg-slate-50/50 rounded-lg border border-slate-200/60 p-3.5 flex flex-col justify-between">
            <div className="flex items-baseline justify-between mb-1">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Goles Prevenidos Totales
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  xGOT recibido vs Goles concedidos
                </span>
              </div>
              <span
                className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${
                  isPositive ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {isPositive ? `+${goalsPrevented.toFixed(2)}` : goalsPrevented.toFixed(2)}
              </span>
            </div>

            {/* Goles Salvados / PJ */}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200/60">
              <span className="text-xs font-semibold text-slate-600">Goles Salvados / PJ</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono border ${
                  preventedPerMatch >= 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                    : 'bg-rose-50 text-rose-700 border-rose-200/60'
                }`}
              >
                {preventedPerMatch >= 0 ? `+${preventedPerMatch.toFixed(2)}` : preventedPerMatch.toFixed(2)} / pj
              </span>
            </div>
          </div>

          {/* 2. Exigencia vs Concesión */}
          <div className="bg-slate-50/50 rounded-lg border border-slate-200/60 p-3.5 flex flex-col justify-between flex-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              Exigencia vs Concesión
            </span>

            {/* 2-Column Integrated Tabular Block */}
            <div className="grid grid-cols-2 divide-x divide-slate-200/60 bg-slate-50/50 rounded-lg border border-slate-200/60 overflow-hidden text-center py-2.5">
              <div className="px-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  xGOT Recibido a Puerta
                </span>
                <span className="text-xl font-bold font-mono text-slate-800 tabular-nums">
                  {xgotFaced.toFixed(2)}
                </span>
                <span className="block text-[10px] text-slate-500 font-sans mt-0.5">
                  Dificultad de tiros rivales
                </span>
              </div>

              <div className="px-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Goles Concedidos Reales
                </span>
                <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                  {goalsConceded}
                </span>
                <span className="block text-[10px] text-slate-500 font-sans mt-0.5">
                  Goles recibidos en muestra
                </span>
              </div>
            </div>

            {/* Diagnóstico */}
            <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs px-0.5 pb-0.5">
              <span className="text-slate-500 font-medium">Diagnóstico:</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium font-mono whitespace-nowrap border ${
                  isPositive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                    : 'bg-rose-50 text-rose-700 border-rose-200/60'
                }`}
              >
                {isPositive ? 'Superávit (+)' : 'Sobre lo esperado (-)'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamGoalkeeperCard;
