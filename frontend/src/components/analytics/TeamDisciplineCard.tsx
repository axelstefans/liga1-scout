import React from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { TeamMetricEntry, VenueFilter } from '../../services/api';
import { useTeamPeriodMetrics } from '../../hooks/useTeam';

export interface TeamDisciplineCardProps {
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
}

export const TeamDisciplineCard: React.FC<TeamDisciplineCardProps> = ({
  activeTeam,
  tournament = 'all',
  venue = 'all',
}) => {
  const { data, isLoading, isError } = useTeamPeriodMetrics(
    activeTeam?.team_id,
    tournament,
    venue
  );

  const allPeriod = data?.periods?.['ALL'];
  const firstPeriod = data?.periods?.['1ST'];
  const secondPeriod = data?.periods?.['2ND'];

  // Tarjetas Amarillas y Rojas
  const yellowCardsTotal = allPeriod?.total_yellow_cards ?? 0;
  const yellowCardsPM = allPeriod?.avg_yellow_cards ?? 0;

  const redCardsTotal = allPeriod?.total_red_cards ?? 0;
  const redCardsPM = allPeriod?.avg_red_cards ?? 0;

  // Faltas Cometidas y Recibidas
  const foulsCommittedPM = allPeriod?.avg_fouls ?? 0;
  const foulsReceivedPM = allPeriod?.avg_fouls_received ?? 0;
  const foulsDiff = foulsReceivedPM - foulsCommittedPM;

  // Amarillas 1T vs 2T
  const yellow1TPM = firstPeriod?.avg_yellow_cards ?? 0;
  const yellow2TPM = secondPeriod?.avg_yellow_cards ?? 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
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
          <div className="grid grid-cols-2 gap-3 flex-1">
            {/* 1. Tarjetas Amarillas / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Tarjetas Amarillas
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {yellowCardsPM.toFixed(1)}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  ({yellowCardsTotal} total)
                </span>
              </div>
            </div>

            {/* 2. Tarjetas Rojas / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Tarjetas Rojas
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {redCardsPM.toFixed(2)}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  ({redCardsTotal} total)
                </span>
              </div>
            </div>

            {/* 3. Faltas Cometidas / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Faltas Cometidas
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {foulsCommittedPM.toFixed(1)}
                </span>
                <span className="text-xs font-medium text-slate-500">/ pj</span>
              </div>
            </div>

            {/* 4. Faltas Recibidas / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Faltas Recibidas
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {foulsReceivedPM.toFixed(1)}
                </span>
                <span className="text-xs font-medium text-slate-500">/ pj</span>
              </div>
            </div>

            {/* 5. Amarillas en 1T / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Amarillas en 1T
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {yellow1TPM.toFixed(1)}
                </span>
                <span className="text-xs font-medium text-slate-500">/ pj</span>
              </div>
            </div>

            {/* 6. Amarillas en 2T / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Amarillas en 2T
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {yellow2TPM.toFixed(1)}
                </span>
                <span className="text-xs font-medium text-slate-500">/ pj</span>
              </div>
            </div>
          </div>

          {/* Bottom row: Fouls Differential */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Diferencial de faltas
            </span>
            <span className="text-xs font-bold text-slate-800">
              {foulsDiff >= 0 ? `+${foulsDiff.toFixed(1)} provocadas / pj` : `${foulsDiff.toFixed(1)} cometidas / pj`}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default TeamDisciplineCard;
