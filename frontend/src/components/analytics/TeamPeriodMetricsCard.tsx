import React, { useState } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { TeamMetricEntry, VenueFilter, ContextFilter } from '../../services/api';
import { useTeamPeriodMetrics } from '../../hooks/useTeam';

export interface TeamPeriodMetricsCardProps {
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
  mode?: 'for' | 'against';
  contextFilter?: ContextFilter;
}

export const TeamPeriodMetricsCard: React.FC<TeamPeriodMetricsCardProps> = ({
  activeTeam,
  tournament = 'all',
  venue = 'all',
  mode = 'for',
  contextFilter = 'all',
}) => {
  const [activeTab, setActiveTab] = useState<'splits' | 'dynamics'>('splits');
  const isAgainst = mode === 'against';
  const { data, isLoading, isError } = useTeamPeriodMetrics(
    activeTeam?.team_id,
    tournament,
    venue,
    mode,
    true,
    contextFilter
  );

  const firstPeriod = data?.periods?.['1ST'];
  const secondPeriod = data?.periods?.['2ND'];
  const goalDist = data?.goal_distribution;
  const timeSplits = data?.time_splits;
  const dynamics = data?.match_dynamics;

  const totalMatches = data?.matches_count ?? (activeTeam?.matches_played ?? 0);

  // Tab A (Time Splits)
  const goals1T = timeSplits?.goals_1t ?? (firstPeriod?.total_goals ?? 0);
  const goals2T = timeSplits?.goals_2t ?? (secondPeriod?.total_goals ?? 0);
  const goals1TPM = firstPeriod?.avg_goals ?? (totalMatches > 0 ? goals1T / totalMatches : 0);
  const goals2TPM = secondPeriod?.avg_goals ?? (totalMatches > 0 ? goals2T / totalMatches : 0);
  const xg1TPM = firstPeriod?.avg_xg ?? 0;
  const xg2TPM = secondPeriod?.avg_xg ?? 0;
  const pctGoals2T = timeSplits?.pct_goals_2t ?? (
    (goals1T + goals2T) > 0 ? Math.round((goals2T / (goals1T + goals2T)) * 100) : 0
  );
  const peakInterval = timeSplits?.peak_scoring_interval ?? (goalDist?.peak_interval ?? '76-90+');
  const peakGoals = goalDist?.peak_goals ?? 0;

  // Tab B (Dynamics & State)
  const bttsCount = dynamics?.btts?.count ?? 0;
  const bttsTotal = dynamics?.btts?.total ?? totalMatches;

  const htWonCount = dynamics?.ht_won?.count ?? (data?.ht_won ?? 0);
  const htDrawnCount = dynamics?.ht_drawn?.count ?? (data?.ht_drawn ?? 0);
  const htLostCount = dynamics?.ht_lost?.count ?? (data?.ht_lost ?? 0);
  const htTotal = dynamics?.ht_won?.total ?? totalMatches;

  const scoredFirstCount = dynamics?.scored_first?.count ?? (data?.scored_first_count ?? 0);
  const scoredFirstTotal = dynamics?.scored_first?.total ?? totalMatches;
  const scoredFirstBreakdown = dynamics?.scored_first?.breakdown;
  const scoredFirstRecord = dynamics?.scored_first?.record ?? data?.scored_first_record ?? '0V-0E-0D';

  const concededFirstCount = dynamics?.conceded_first?.count ?? (data?.conceded_first_count ?? 0);
  const concededFirstTotal = dynamics?.conceded_first?.total ?? totalMatches;
  const concededFirstBreakdown = dynamics?.conceded_first?.breakdown;
  const concededFirstRecord = dynamics?.conceded_first?.record ?? data?.conceded_first_record ?? '0V-0E-0D';

  // Clean sheets, failed to score, early conceded goals (0-20 min)
  const cleanSheetsCount = dynamics?.clean_sheets?.count ?? (data?.clean_sheets_count ?? 0);
  const cleanSheetsTotal = dynamics?.clean_sheets?.total ?? totalMatches;
  const cleanSheetsPct = dynamics?.clean_sheets_pct ?? (
    cleanSheetsTotal > 0 ? Math.round((cleanSheetsCount / cleanSheetsTotal) * 100) : 0
  );

  const failedToScoreCount = dynamics?.failed_to_score?.count ?? (data?.failed_to_score_count ?? 0);
  const failedToScoreTotal = dynamics?.failed_to_score?.total ?? totalMatches;
  const failedToScorePct = dynamics?.failed_to_score_pct ?? (
    failedToScoreTotal > 0 ? Math.round((failedToScoreCount / failedToScoreTotal) * 100) : 0
  );

  const concededEarlyCount = dynamics?.conceded_early_0_20?.count ?? (data?.conceded_early_0_20_count ?? 0);
  const concededEarlyTotal = dynamics?.conceded_early_0_20?.total ?? totalMatches;
  const concededEarlyPct = dynamics?.conceded_early_0_20_pct ?? (
    concededEarlyTotal > 0 ? Math.round((concededEarlyCount / concededEarlyTotal) * 100) : 0
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col justify-between h-full min-h-[385px]">
      {/* Header with View Toggle Pill */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            Goles & Dinámica
          </h3>
        </div>

        {/* Tab Toggle: [ 1T / 2T | Dinámica ] */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
          <button
            type="button"
            onClick={() => setActiveTab('splits')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'splits'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            1T / 2T
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dynamics')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'dynamics'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Dinámica
          </button>
        </div>
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
      ) : activeTab === 'splits' ? (
        /* ======================================================== */
        /* TAB A: TIME SPLITS (1T vs 2T)                            */
        /* ======================================================== */
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 flex-1">
            {/* 1. Goles en 1T */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                {isAgainst ? 'Goles Recibidos 1T' : 'Goles Anotados 1T'}
              </span>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
                  {goals1T}
                </span>
                <span className="text-xs font-medium text-slate-500 mt-1">
                  {goals1TPM.toFixed(2)} / pj
                </span>
              </div>
            </div>

            {/* 2. Goles en 2T */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                {isAgainst ? 'Goles Recibidos 2T' : 'Goles Anotados 2T'}
              </span>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
                  {goals2T}
                </span>
                <span className="text-xs font-medium text-slate-500 mt-1">
                  {goals2TPM.toFixed(2)} / pj
                </span>
              </div>
            </div>

            {/* 3. Peligro xG / xGA en 1T */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                {isAgainst ? 'Peligro xGA 1T' : 'Peligro xG 1T'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
                  {xg1TPM.toFixed(2)}
                </span>
                <span className="text-xs font-medium text-slate-500">/ pj</span>
              </div>
            </div>

            {/* 4. Peligro xG / xGA en 2T */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                {isAgainst ? 'Peligro xGA 2T' : 'Peligro xG 2T'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
                  {xg2TPM.toFixed(2)}
                </span>
                <span className="text-xs font-medium text-slate-500">/ pj</span>
              </div>
            </div>
          </div>

          {/* Micro-bar: Concentración en Segundos Tiempos */}
          <div className="mt-2.5 bg-slate-50/80 border border-slate-100 rounded-md px-2.5 py-2 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Concentración en 2T
              </span>
              <span className="text-xs font-bold text-slate-800">
                {totalMatches > 0 ? `${pctGoals2T}% de los goles (${goals2T} de ${goals1T + goals2T})` : '—'}
              </span>
            </div>
            <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-sky-600 h-full rounded-full"
                style={{ width: `${totalMatches > 0 ? Math.min(100, Math.max(0, pctGoals2T)) : 0}%` }}
              />
            </div>
          </div>

          {/* Bottom row: Peak interval info */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate mr-2">
              {isAgainst ? 'Tramo +goles recibidos' : 'Tramo con más goles'}
            </span>
            <span className="text-xs font-bold text-slate-800 shrink-0">
              {totalMatches > 0 ? `Minutos ${peakInterval.replace('+', "'+")} (${peakGoals} ${peakGoals === 1 ? 'gol' : 'goles'})` : '—'}
            </span>
          </div>
        </>
      ) : (
        /* ======================================================== */
        /* TAB B: DYNAMICS & MATCH ESTIMATIONS                      */
        /* ======================================================== */
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 flex-1">
            {/* 1. Ambos Equipos Anotan (BTTS) */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Ambos Anotan (BTTS)
              </span>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
                  {totalMatches > 0 ? bttsCount : '—'}
                </span>
                <span className="text-xs font-medium text-slate-500 mt-1">
                  {totalMatches > 0 && bttsTotal > 0 ? `de ${bttsTotal} PJ (${Math.round((bttsCount / bttsTotal) * 100)}%)` : '—'}
                </span>
              </div>
            </div>

            {/* 2. Ganando al Descanso (HT) */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Lideró al Descanso (HT)
              </span>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
                  {totalMatches > 0 ? htWonCount : '—'}
                </span>
                <span className="text-xs font-medium text-slate-500 mt-1">
                  {totalMatches > 0 && htTotal > 0 ? `de ${htTotal} PJ (${Math.round((htWonCount / htTotal) * 100)}%)` : '—'}
                </span>
              </div>
            </div>

            {/* 3. Anotó 1º (Primer Gol) */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Anotó 1º (Primer Gol)
              </span>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
                    {totalMatches > 0 ? scoredFirstCount : '—'}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {totalMatches > 0 && scoredFirstTotal > 0 ? `de ${scoredFirstTotal} PJ` : '—'}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-semibold text-emerald-700 mt-1">
                  {totalMatches > 0
                    ? (scoredFirstBreakdown
                        ? `${scoredFirstBreakdown.wins}V · ${scoredFirstBreakdown.draws}E · ${scoredFirstBreakdown.losses}D`
                        : scoredFirstRecord)
                    : '—'}
                </span>
              </div>
            </div>

            {/* 4. Recibió 1º (Gol Rival) */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Recibió 1º (Gol Rival)
              </span>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
                    {totalMatches > 0 ? concededFirstCount : '—'}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {totalMatches > 0 && concededFirstTotal > 0 ? `de ${concededFirstTotal} PJ` : '—'}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-semibold text-rose-700 mt-1">
                  {totalMatches > 0
                    ? (concededFirstBreakdown
                        ? `${concededFirstBreakdown.wins}V · ${concededFirstBreakdown.draws}E · ${concededFirstBreakdown.losses}D`
                        : concededFirstRecord)
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Micro-grid: Valla Invicta & Gol Recibido 0-20' */}
          <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50/80 border border-slate-100 rounded-md p-2.5 flex items-center justify-between gap-1.5">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">
                  Valla Invicta
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {totalMatches > 0 && cleanSheetsTotal > 0 ? `${cleanSheetsCount} de ${cleanSheetsTotal} PJ` : '—'}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded border border-slate-200/70 shadow-2xs shrink-0">
                {totalMatches > 0 ? `${cleanSheetsPct}%` : '—'}
              </span>
            </div>

            <div className="bg-slate-50/80 border border-slate-100 rounded-md p-2.5 flex items-center justify-between gap-1.5">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">
                  {isAgainst ? 'Gol Anotado 0-20\'' : 'Gol Rec. 0-20\''}
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {totalMatches > 0 && concededEarlyTotal > 0 ? `${concededEarlyCount} de ${concededEarlyTotal} PJ` : '—'}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-amber-700 bg-white px-2 py-0.5 rounded border border-slate-200/70 shadow-2xs shrink-0">
                {totalMatches > 0 ? `${concededEarlyPct}%` : '—'}
              </span>
            </div>
          </div>

          {/* Bottom row: Resumen HT y Sin Anotar */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate mr-2">
              HT: {totalMatches > 0 && htTotal > 0 ? `${htWonCount}V · ${htDrawnCount}E · ${htLostCount}D (${htTotal} PJ)` : '—'}
            </span>
            <span className="text-xs font-bold text-slate-800 shrink-0">
              Sin Anotar: {totalMatches > 0 && failedToScoreTotal > 0 ? `${failedToScoreCount} de ${failedToScoreTotal} (${failedToScorePct}%)` : '—'}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default TeamPeriodMetricsCard;
