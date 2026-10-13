import React from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { TeamMetricEntry, VenueFilter, ContextFilter } from '../../services/api';
import { useTeamPeriodMetrics } from '../../hooks/useTeam';

export interface TeamSetPiecesCardProps {
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
  mode?: 'for' | 'against';
  contextFilter?: ContextFilter;
}

export const TeamSetPiecesCard: React.FC<TeamSetPiecesCardProps> = ({
  activeTeam,
  tournament = 'all',
  venue = 'all',
  mode = 'for',
  contextFilter = 'all',
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col justify-between h-full min-h-[385px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
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
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 flex-1">
            {/* 1. Córners a Favor / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Córners a Favor
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {cornersFor.toFixed(1)}
                </span>
                <span className="text-[11px] font-medium text-slate-500">/ pj</span>
              </div>
            </div>

            {/* 2. Córners Concedidos / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Córners Concedidos
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {cornersAgainst.toFixed(1)}
                </span>
                <span className="text-[11px] font-medium text-slate-500">/ pj</span>
              </div>
            </div>

            {/* 3. Total Córners Partido / PJ */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Total Córners / PJ
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {cornersTotal.toFixed(1)}
                </span>
                <span className="text-[11px] font-medium text-slate-500">en partido</span>
              </div>
            </div>

            {/* 4. Goles de Balón Parado (A favor & Concedidos) */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                Goles Balón Parado
              </span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {setPieceGoals}
                </span>
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/60">
                  {setPieceGoalsScoredAvg.toFixed(2)}/pj fav
                </span>
                <span className="text-[11px] font-medium text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200/60">
                  {setPieceGoalsConceded} rec ({setPieceGoalsConcededAvg.toFixed(2)}/pj)
                </span>
              </div>
            </div>
          </div>

          {/* Frecuencias de Líneas Over & Concesión Córners (3-column micro-grid) */}
          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-50/80 border border-slate-100 rounded-md p-2.5 flex items-center justify-between gap-1.5">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">Línea +8.5 Córners</span>
                <span className="text-xs font-bold text-slate-800">
                  {totalMatches > 0 ? `${over85Count} de ${totalMatches} PJ` : '—'}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-sky-700 bg-white px-2 py-0.5 rounded border border-slate-200/70 shadow-2xs shrink-0">
                {totalMatches > 0 ? `${Math.round((over85Count / totalMatches) * 100)}%` : '—'}
              </span>
            </div>

            <div className="bg-slate-50/80 border border-slate-100 rounded-md p-2.5 flex items-center justify-between gap-1.5">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">Línea +9.5 Córners</span>
                <span className="text-xs font-bold text-slate-800">
                  {totalMatches > 0 ? `${over95Count} de ${totalMatches} PJ` : '—'}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-sky-700 bg-white px-2 py-0.5 rounded border border-slate-200/70 shadow-2xs shrink-0">
                {totalMatches > 0 ? `${Math.round((over95Count / totalMatches) * 100)}%` : '—'}
              </span>
            </div>

            <div className="bg-slate-50/80 border border-slate-100 rounded-md p-2.5 flex items-center justify-between gap-1.5">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">Concedió +4.5 Córn.</span>
                <span className="text-xs font-bold text-slate-800">
                  {totalMatches > 0 ? `${concededOver45Count} de ${totalMatches} PJ` : '—'}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-sky-700 bg-white px-2 py-0.5 rounded border border-slate-200/70 shadow-2xs shrink-0">
                {totalMatches > 0 ? `${concededOver45Pct}%` : '—'}
              </span>
            </div>
          </div>

          {/* Bottom row: Corner origin goals & Penalties balance */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-500">
            <div className="flex items-center gap-1 text-[11px] truncate">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">
                {isAgainst ? 'Goles Córner Rec.:' : 'Goles Córner:'}
              </span>
              <span className="font-bold text-slate-800">
                {cornerGoals} ({setPieceGoals > 0 ? Math.round((cornerGoals / setPieceGoals) * 100) : 0}% a balón parado)
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] shrink-0">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Penales:</span>
              <span className="font-bold text-slate-800">
                {penaltiesAwarded} a favor ({penaltiesScored} conv.) | {penaltiesConceded} en contra
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TeamSetPiecesCard;
