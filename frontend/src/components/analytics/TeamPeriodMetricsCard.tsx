import React from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { TeamMetricEntry, VenueFilter } from '../../services/api';
import { useTeamPeriodMetrics } from '../../hooks/useTeam';

export interface TeamPeriodMetricsCardProps {
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
  mode?: 'for' | 'against';
}

export const TeamPeriodMetricsCard: React.FC<TeamPeriodMetricsCardProps> = ({
  activeTeam,
  tournament = 'all',
  venue = 'all',
  mode = 'for',
}) => {
  const isAgainst = mode === 'against';
  const { data, isLoading, isError } = useTeamPeriodMetrics(
    activeTeam?.team_id,
    tournament,
    venue,
    mode
  );

  const allPeriod = data?.periods?.['ALL'];
  const firstPeriod = data?.periods?.['1ST'];
  const secondPeriod = data?.periods?.['2ND'];
  const goalDist = data?.goal_distribution;

  // 1. Goles Marcados / Concedidos / PJ
  const goalsPM =
    allPeriod?.avg_goals ??
    (isAgainst
      ? (activeTeam?.goals_conceded && activeTeam?.matches_played
        ? activeTeam.goals_conceded / activeTeam.matches_played
        : 0)
      : (activeTeam?.goals_scored && activeTeam?.matches_played
        ? activeTeam.goals_scored / activeTeam.matches_played
        : 0));

  // 2. xG / xGA / PJ
  const xgPM =
    allPeriod?.avg_xg ??
    (isAgainst
      ? (activeTeam?.xga && activeTeam?.matches_played
        ? activeTeam.xga / activeTeam.matches_played
        : (activeTeam?.xga_per_match ?? 0))
      : (activeTeam?.xg && activeTeam?.matches_played
        ? activeTeam.xg / activeTeam.matches_played
        : (activeTeam?.xg_per_match ?? 0)));

  // 3. Goles 1T / PJ & 2T / PJ
  const goals1TPM = firstPeriod?.avg_goals ?? 0;
  const goals2TPM = secondPeriod?.avg_goals ?? 0;

  // 4. xG / xGA 1T / PJ & 2T / PJ
  const xg1TPM = firstPeriod?.avg_xg ?? 0;
  const xg2TPM = secondPeriod?.avg_xg ?? 0;

  // Peak interval
  const peakInterval = goalDist?.peak_interval ?? '76-90+';
  const peakGoals = goalDist?.peak_goals ?? 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            Balance 1T vs 2T & Dinámica
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
            {/* 1. Goles Marcados / Concedidos / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                {isAgainst ? 'Goles Concedidos' : 'Goles Marcados'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {goalsPM.toFixed(2)}
                </span>
                <span className="text-xs font-medium text-slate-500">/ pj</span>
              </div>
            </div>

            {/* 2. Peligro xG / xGA / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                {isAgainst ? 'Peligro xGA' : 'Peligro xG'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {xgPM.toFixed(2)}
                </span>
                <span className="text-xs font-medium text-slate-500">/ pj</span>
              </div>
            </div>

            {/* 3. Goles en 1T / Concedidos 1T / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                {isAgainst ? 'Goles Concedidos 1T' : 'Goles en 1T'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {goals1TPM.toFixed(2)}
                </span>
                <span className="text-xs font-medium text-slate-500">/ pj</span>
              </div>
            </div>

            {/* 4. Goles en 2T / Concedidos 2T / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                {isAgainst ? 'Goles Concedidos 2T' : 'Goles en 2T'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {goals2TPM.toFixed(2)}
                </span>
                <span className="text-xs font-medium text-slate-500">/ pj</span>
              </div>
            </div>

            {/* 5. xG / xGA en 1T / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                {isAgainst ? 'xGA en 1T' : 'xG en 1T'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {xg1TPM.toFixed(2)}
                </span>
                <span className="text-xs font-medium text-slate-500">/ pj</span>
              </div>
            </div>

            {/* 6. xG / xGA en 2T / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                {isAgainst ? 'xGA en 2T' : 'xG en 2T'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {xg2TPM.toFixed(2)}
                </span>
                <span className="text-xs font-medium text-slate-500">/ pj</span>
              </div>
            </div>
          </div>

          {/* Bottom row: Peak interval info */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {isAgainst ? 'Tramo con más goles recibidos' : 'Tramo con más goles'}
            </span>
            <span className="text-xs font-bold text-slate-800">
              Minutos {peakInterval.replace('+', "'+")} ({peakGoals} {peakGoals === 1 ? 'gol' : 'goles'})
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default TeamPeriodMetricsCard;
