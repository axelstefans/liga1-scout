import React from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { TeamMetricEntry, VenueFilter, ContextFilter } from '../../services/api';
import { TeamFlashscoreSummaryResponse } from '../../types/flashscore';
import { useTeamPeriodMetrics } from '../../hooks/useTeam';

export interface TeamSetPiecesCardProps {
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
  mode?: 'for' | 'against';
  contextFilter?: ContextFilter;
  flashscoreSummary?: TeamFlashscoreSummaryResponse;
}

export const TeamSetPiecesCard: React.FC<TeamSetPiecesCardProps> = ({
  activeTeam,
  tournament = 'all',
  venue = 'all',
  mode = 'for',
  contextFilter = 'all',
  flashscoreSummary,
}) => {
  const isAgainst = mode === 'against';
  const { data, isLoading, isError } = useTeamPeriodMetrics(
    activeTeam?.team_id,
    tournament,
    venue,
    mode,
    true,
    contextFilter
  );

  const allPeriod = data?.periods?.['ALL'];
  const setPieces = data?.set_pieces;
  const cornerStats = data?.corner_stats;

  // 1. Córners A Favor / Concedidos / Total partido
  const cornersFor = cornerStats?.corners_for_avg ?? (allPeriod?.avg_corner_kicks ?? 0);
  const cornersAgainst = cornerStats?.corners_against_avg ?? (allPeriod?.avg_corners_against ?? 0);
  const cornersTotal = cornerStats?.corners_total_avg ?? (cornersFor + cornersAgainst);

  // 2. Líneas Over / Concesión / Totales
  const totalMatches = cornerStats?.over_8_5_corners?.total ?? (data?.matches_count ?? 0);
  const over85Count = cornerStats?.over_8_5_corners?.count ?? 0;
  const over95Count = cornerStats?.over_9_5_corners?.count ?? 0;
  const concededOver45Count = cornerStats?.corners_conceded_over_4_5?.count ?? cornerStats?.corners_conceded_over_4_5_count ?? 0;
  const concededOver45Pct = cornerStats?.corners_conceded_over_4_5_pct ?? (totalMatches > 0 ? Math.round((concededOver45Count / totalMatches) * 100) : 0);

  // 3. Goles de córner y balón parado
  const cornerGoals = cornerStats?.corner_goals ?? (setPieces?.corner_goals ?? 0);
  const setPieceGoals = cornerStats?.set_piece_goals ?? (setPieces?.set_piece_goals ?? 0);
  const setPieceGoalsConceded = setPieces?.set_piece_goals_conceded ?? 0;
  const setPieceGoalsScoredAvg = setPieces?.set_piece_goals_per_match ?? (totalMatches > 0 ? setPieceGoals / totalMatches : 0);
  const setPieceGoalsConcededAvg = setPieces?.set_piece_goals_conceded_per_match ?? (totalMatches > 0 ? setPieceGoalsConceded / totalMatches : 0);

  // 4. Penales
  const penaltiesAwarded = setPieces?.penalties_awarded ?? data?.penalties_awarded ?? 0;
  const penaltiesScored = setPieces?.penalties_scored ?? data?.penalties_scored ?? 0;
  const penaltiesConceded = setPieces?.penalties_conceded ?? data?.penalties_conceded ?? 0;

  return (
    <div className="flex flex-col justify-between h-full min-h-[425px] bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Balón Parado & Córners
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
            {/* 1. Córners a Favor */}
            <div className="p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Córners a Favor
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline gap-1">
                <span>{cornersFor.toFixed(1)}</span>
                <span className="text-xs font-normal text-slate-500 font-sans">/ pj</span>
              </div>
            </div>

            {/* 2. Córners Concedidos */}
            <div className="p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Córners Concedidos
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline gap-1">
                <span>{cornersAgainst.toFixed(1)}</span>
                <span className="text-xs font-normal text-slate-500 font-sans">/ pj</span>
              </div>
            </div>

            {/* 3. Total Córners Partido */}
            <div className="p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Total Córners / PJ
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline gap-1">
                <span>{cornersTotal.toFixed(1)}</span>
                <span className="text-xs font-normal text-slate-500 font-sans">en partido</span>
              </div>
            </div>

            {/* 4. Goles Balón Parado */}
            <div className="p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Goles Balón Parado
              </span>
              <div>
                <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums block mb-1">
                  {setPieceGoals}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-medium font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                    {setPieceGoalsScoredAvg.toFixed(2)}/pj fav
                  </span>
                  <span className="text-[10px] font-medium font-mono text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60">
                    {setPieceGoalsConceded} rec ({setPieceGoalsConcededAvg.toFixed(2)}/pj)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Frecuencias de Líneas Over & Concesión Córners (Integrated 3-Column Tabular Strip) */}
          <div className="mt-2.5 grid grid-cols-3 divide-x divide-slate-200/60 bg-slate-50/50 rounded-lg border border-slate-200/60 py-2 px-1 text-center">
            <div className="flex flex-col items-center justify-center px-1">
              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider truncate">
                Línea +8.5
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono text-xs sm:text-sm font-bold text-sky-700">
                  {totalMatches > 0 ? `${Math.round((over85Count / totalMatches) * 100)}%` : '—'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  ({over85Count}/{totalMatches})
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center px-1">
              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider truncate">
                Línea +9.5
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono text-xs sm:text-sm font-bold text-sky-700">
                  {totalMatches > 0 ? `${Math.round((over95Count / totalMatches) * 100)}%` : '—'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  ({over95Count}/{totalMatches})
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center px-1">
              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider truncate">
                Concedió +4.5
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono text-xs sm:text-sm font-bold text-sky-700">
                  {totalMatches > 0 ? `${concededOver45Pct}%` : '—'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  ({concededOver45Count}/{totalMatches})
                </span>
              </div>
            </div>
          </div>

          {/* Bottom row: Corner origin goals & Penalties balance */}
          <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500">
            <div className="flex items-center gap-1 truncate">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">
                {isAgainst ? 'Goles Córner Rec.:' : 'Goles Córner:'}
              </span>
              <span className="font-bold font-mono text-slate-800">
                {cornerGoals} ({setPieceGoals > 0 ? Math.round((cornerGoals / setPieceGoals) * 100) : 0}% bp)
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">PENALES:</span>
              <span className="font-bold font-mono text-slate-800">
                {penaltiesAwarded} fav ({penaltiesScored} conv.) | {penaltiesConceded} rec
              </span>
            </div>
          </div>

          {/* Flashscore Aerial & Cross Accuracy Strip */}
          {flashscoreSummary && flashscoreSummary.matches_analyzed > 0 && (
            <div className="text-[11px] text-slate-600 border-t border-slate-100 pt-1.5 mt-1.5 flex items-center justify-between">
              <span className="truncate">
                <span className="font-semibold uppercase tracking-wider text-slate-500">CENTROS:</span>{' '}
                <strong className="font-bold font-mono text-slate-800">
                  {(flashscoreSummary.periods.ALL?.avg_crosses_completed ?? 0).toFixed(1)} / {(flashscoreSummary.periods.ALL?.avg_crosses_total ?? 0).toFixed(1)}
                </strong>{' '}
                <span className="font-mono">({(flashscoreSummary.periods.ALL?.cross_accuracy_pct ?? 0).toFixed(1)}%)</span>
              </span>
              <span className="shrink-0">
                <span className="font-semibold uppercase tracking-wider text-slate-500">GOLES CABEZA:</span>{' '}
                <strong className="font-bold font-mono text-slate-800">
                  {flashscoreSummary.periods.ALL?.total_headed_goals ?? 0}
                </strong>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TeamSetPiecesCard;
