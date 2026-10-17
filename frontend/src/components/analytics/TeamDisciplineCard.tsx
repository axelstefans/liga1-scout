import React from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { TeamMetricEntry, VenueFilter, ContextFilter } from '../../services/api';
import { useTeamPeriodMetrics } from '../../hooks/useTeam';

export interface TeamDisciplineCardProps {
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
  contextFilter?: ContextFilter;
}

export const TeamDisciplineCard: React.FC<TeamDisciplineCardProps> = ({
  activeTeam,
  tournament = 'all',
  venue = 'all',
  contextFilter = 'all',
}) => {
  const { data, isLoading, isError } = useTeamPeriodMetrics(
    activeTeam?.team_id,
    tournament,
    venue,
    'for',
    true,
    contextFilter
  );

  const allPeriod = data?.periods?.['ALL'];
  const discipline = data?.discipline_stats;
  const totalMatches = discipline?.over_3_5_cards?.total ?? (data?.matches_count ?? 0);

  // Faltas Cometidas y Recibidas / Provocadas
  const foulsCommittedPM = discipline?.fouls_committed_avg ?? (allPeriod?.avg_fouls ?? 0);
  const foulsDrawnPM = discipline?.fouls_drawn_avg ?? (allPeriod?.avg_fouls_received ?? 0);
  const foulsDiff = foulsCommittedPM - foulsDrawnPM;

  // Tarjetas para el equipo y provocadas al rival
  const cardsForPM = discipline?.cards_for_avg ?? ((allPeriod?.avg_yellow_cards ?? 0) + (allPeriod?.avg_red_cards ?? 0));
  const cardsForcedPM = discipline?.cards_forced_avg ?? 0;
  const redCardsTotal = discipline?.red_cards_total ?? (data?.red_cards_total ?? (allPeriod?.total_red_cards ?? 0));

  // Línea Over 3.5 tarjetas
  const over35CardsCount = discipline?.over_3_5_cards?.count ?? 0;

  // Concentración de tarjetas en 2T
  const cards2HPct = discipline?.cards_2h_pct ?? 0;

  return (
    <div className="flex flex-col justify-between h-full min-h-[425px] bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Disciplina & Faltas
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Por Partido
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 flex-1">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin mb-2" />
          <span className="text-xs text-slate-400 font-medium">Cargando métricas...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center flex-1">
          <p className="text-xs text-rose-600 font-medium">Información no disponible temporalmente</p>
        </div>
      ) : (
        <>
          {/* Integrated 2x2 Tabular Grid */}
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-200/60 bg-slate-50/50 rounded-lg border border-slate-200/60 overflow-hidden flex-1">
            {/* 1. Tarjetas Propias / PJ */}
            <div className="p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Tarjetas Propias
              </span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums">
                  {cardsForPM.toFixed(1)}
                </span>
                <span className="text-xs font-normal text-slate-500 font-sans">/ pj</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60 shadow-2xs ml-auto">
                  <span className="inline-block w-1.5 h-2 bg-rose-600 rounded-[1px]" />
                  {redCardsTotal} {redCardsTotal === 1 ? 'Roja' : 'Rojas'}
                </span>
              </div>
            </div>

            {/* 2. Tarjetas Provocadas / PJ */}
            <div className="p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Tarjetas Provocadas
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline gap-1">
                <span>{cardsForcedPM.toFixed(1)}</span>
                <span className="text-xs font-normal text-slate-500 font-sans">al rival / pj</span>
              </div>
            </div>

            {/* 3. Faltas Cometidas / PJ */}
            <div className="p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Faltas Cometidas
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline gap-1">
                <span>{foulsCommittedPM.toFixed(1)}</span>
                <span className="text-xs font-normal text-slate-500 font-sans">/ pj</span>
              </div>
            </div>

            {/* 4. Faltas Recibidas / PJ */}
            <div className="p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Faltas Recibidas
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline gap-1">
                <span>{foulsDrawnPM.toFixed(1)}</span>
                <span className="text-xs font-normal text-slate-500 font-sans">/ pj</span>
              </div>
            </div>
          </div>

          {/* Integrated 2-Column Tabular Strip: Concentración 2T y Línea Over 3.5 */}
          <div className="mt-2.5 grid grid-cols-2 divide-x divide-slate-200/60 bg-slate-50/50 rounded-lg border border-slate-200/60 py-2 px-2 text-center">
            <div className="flex items-center justify-between px-2 gap-2">
              <div className="flex flex-col text-left min-w-0">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider truncate">
                  Concentración 2T
                </span>
                <span className="text-xs font-bold font-mono text-slate-800 truncate">
                  {totalMatches > 0 ? `${cards2HPct}% tarjetas` : '—'}
                </span>
              </div>
              <div className="w-16 sm:w-20 h-1.5 bg-slate-200/80 rounded-full overflow-hidden shrink-0">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{ width: `${totalMatches > 0 ? Math.min(100, Math.max(0, cards2HPct)) : 0}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col items-center justify-center px-1">
              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider truncate">
                Línea +3.5 Tarjetas
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono text-xs sm:text-sm font-bold text-amber-700">
                  {totalMatches > 0 ? `${Math.round((over35CardsCount / totalMatches) * 100)}%` : '—'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  ({over35CardsCount}/{totalMatches})
                </span>
              </div>
            </div>
          </div>

          {/* Bottom row: Fouls Differential */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate mr-2">
              Diferencial de faltas
            </span>
            <span className="text-xs font-bold font-mono text-slate-800 shrink-0">
              {totalMatches > 0
                ? (foulsDiff > 0
                    ? `+${foulsDiff.toFixed(1)} cometidas vs recibidas`
                    : foulsDiff < 0
                      ? `+${Math.abs(foulsDiff).toFixed(1)} recibidas vs cometidas`
                      : '0.0 balance neutro')
                : '—'}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default TeamDisciplineCard;
