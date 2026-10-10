import React from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { TeamMetricEntry, VenueFilter } from '../../services/api';
import { useTeamPeriodMetrics } from '../../hooks/useTeam';

export interface TeamSetPiecesCardProps {
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
  mode?: 'for' | 'against';
}

export const TeamSetPiecesCard: React.FC<TeamSetPiecesCardProps> = ({
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
  const setPieces = data?.set_pieces;

  const cornersFor = allPeriod?.avg_corner_kicks ?? 0;
  const cornersAgainst = allPeriod?.avg_corners_against ?? 0;
  const cornersHome = allPeriod?.avg_corners_home ?? 0;
  const cornersAway = allPeriod?.avg_corners_away ?? 0;
  const corners1T = firstPeriod?.avg_corner_kicks ?? 0;

  const cornerGoals = setPieces?.corner_goals ?? 0;
  const cornerGoalsPct = setPieces?.corner_goals_pct ?? 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
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
          <div className="grid grid-cols-2 gap-3 flex-1">
          {/* 1. Córners a Favor / PJ */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Córners a Favor
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {cornersFor.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-slate-500">/ pj</span>
            </div>
          </div>

          {/* 2. Córners Concedidos / PJ */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Córners Concedidos
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {cornersAgainst.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-slate-500">/ pj</span>
            </div>
          </div>

          {/* 3. Córners Local / PJ */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Córners Local
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {cornersHome.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-slate-500">/ pj</span>
            </div>
          </div>

          {/* 4. Córners Visitante / PJ */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Córners Visitante
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {cornersAway.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-slate-500">/ pj</span>
            </div>
          </div>

          {/* 5. Córners en 1T / PJ */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Córners en 1T
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {corners1T.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-slate-500">/ pj</span>
            </div>
          </div>

          {/* 6. Goles de Córner / Recibidos (Total y %) */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              {isAgainst ? 'Goles de córner recibidos' : 'Goles de Córner'}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {cornerGoals}
              </span>
              <span className="text-xs font-medium text-slate-500">
                ({cornerGoalsPct.toFixed(1)}%)
              </span>
            </div>
          </div>
          </div>

          {/* Bottom row: Set pieces total goals */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {isAgainst ? 'Goles recibidos a balón parado' : 'Goles a balón parado'}
            </span>
            <span className="text-xs font-bold text-slate-800">
              {setPieces?.set_piece_goals ?? 0} ({((setPieces?.set_piece_goals_per_match ?? 0)).toFixed(2)} / pj)
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default TeamSetPiecesCard;
