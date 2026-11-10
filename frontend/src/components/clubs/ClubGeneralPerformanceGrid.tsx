import React from 'react';
import { Loader2, AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { VenueFilter, ContextFilter, TeamMetricEntry, MostUsedXIResponse, MostUsedXIPlayer } from '../../services/api';
import { TournamentFilter, ChartId } from './clubAnalyticsTypes';
import TeamTacticalRadar from '../analytics/TeamTacticalRadar';
import TeamPassNetwork from '../analytics/TeamPassNetwork';
import TeamShotMap from '../analytics/TeamShotMap';
import TeamAttackZones from '../analytics/TeamAttackZones';
import TeamDefensiveTerritory from '../analytics/TeamDefensiveTerritory';
import TeamSetPiecesCard from '../analytics/TeamSetPiecesCard';
import TeamPeriodMetricsCard from '../analytics/TeamPeriodMetricsCard';
import TeamDisciplineCard from '../analytics/TeamDisciplineCard';
import TeamMostUsedXICard from '../team/TeamMostUsedXICard';
import { TeamBoxControlCard } from './TeamBoxControlCard';
import { TeamGoalkeeperCard } from './TeamGoalkeeperCard';
import { TeamPeriodDominanceCard } from './TeamPeriodDominanceCard';

export interface ClubGeneralPerformanceGridProps {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  activeTeam: TeamMetricEntry | null;
  teams: TeamMetricEntry[] | undefined;
  selectedTournament: TournamentFilter;
  aggregationMode: 'cumulative' | 'match';
  validMatchId: number | null;
  venue: VenueFilter;
  contextFilter: ContextFilter;
  perspective: 'for' | 'against';
  selectedPlayer: string;
  visibleCharts: Record<ChartId, boolean>;
  hasFloor1Charts: boolean;
  hasFloor2Charts: boolean;
  bothFloor2Active: boolean;
  handleReset: () => void;
  flashscoreSummary: any;
  isFlashscoreLoading: boolean;
  mostUsedXIData?: MostUsedXIResponse;
}

export const ClubGeneralPerformanceGrid: React.FC<ClubGeneralPerformanceGridProps> = ({
  isLoading,
  isError,
  error,
  refetch,
  activeTeam,
  teams,
  selectedTournament,
  aggregationMode,
  validMatchId,
  venue,
  contextFilter,
  perspective,
  selectedPlayer,
  visibleCharts,
  hasFloor1Charts,
  hasFloor2Charts,
  bothFloor2Active,
  handleReset,
  flashscoreSummary,
  isFlashscoreLoading,
  mostUsedXIData,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-slate-200/80 shadow-xs">
        <Loader2 className="w-9 h-9 text-slate-400 animate-spin mb-3" />
        <p className="text-xs font-medium text-slate-500">
          Cargando información del club...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-rose-50 rounded-xl border border-rose-200 text-center px-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
        <h3 className="text-sm font-bold text-rose-900">Error al conectar con la base de datos</h3>
        <p className="text-xs text-rose-700 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'No se pudo cargar el perfil del club.'}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      </div>
    );
  }

  if (!activeTeam) {
    return (
      <div className="text-center py-16 text-slate-500 bg-white border border-slate-200 rounded-xl">
        No se encontraron datos para el torneo seleccionado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* FLOOR 1: BASE TRIO (3-COLUMN RESPONSIVE GRID) */}
      {hasFloor1Charts && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 items-stretch">
          {visibleCharts.radar && (
            <div className="w-full flex flex-col h-full min-h-[650px]">
              <TeamTacticalRadar
                teams={teams || []}
                activeTeam={activeTeam}
                tournament={selectedTournament}
              />
            </div>
          )}

          {visibleCharts.pass_network && (
            <div className="w-full flex flex-col h-full min-h-[650px]">
              <TeamPassNetwork
                teams={teams || []}
                activeTeam={activeTeam}
                tournament={selectedTournament}
                viewMode={aggregationMode}
                selectedMatchId={validMatchId}
                venue={venue}
                contextFilter={contextFilter}
              />
            </div>
          )}

          {visibleCharts.shot_map && (
            <div className="w-full flex flex-col h-full min-h-[650px] [&>div]:!col-span-1">
              <TeamShotMap
                teams={teams}
                activeTeam={activeTeam}
                tournament={selectedTournament}
                mode={perspective}
                viewMode={aggregationMode}
                selectedMatchId={validMatchId}
                selectedPlayer={selectedPlayer}
                venue={venue}
                contextFilter={contextFilter}
              />
            </div>
          )}
        </div>
      )}

      {/* FLOOR 2: EXECUTIVE ANALYTICAL CARDS (/PJ) (3-COLUMN GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 items-stretch">
        <TeamSetPiecesCard
          activeTeam={activeTeam}
          tournament={selectedTournament}
          venue={venue}
          mode={perspective}
          contextFilter={contextFilter}
          flashscoreSummary={flashscoreSummary}
        />
        <TeamPeriodMetricsCard
          activeTeam={activeTeam}
          tournament={selectedTournament}
          venue={venue}
          mode={perspective}
          contextFilter={contextFilter}
        />
        <TeamDisciplineCard
          activeTeam={activeTeam}
          tournament={selectedTournament}
          venue={venue}
          contextFilter={contextFilter}
        />
      </div>

      {/* FLOOR 2.5: FLASHSCORE ADVANCED ANALYTICS (3-COLUMN GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TeamBoxControlCard data={flashscoreSummary} isLoading={isFlashscoreLoading} />
        <TeamGoalkeeperCard
          data={flashscoreSummary}
          isLoading={isFlashscoreLoading}
          goalkeeperName={mostUsedXIData?.players?.find((p: MostUsedXIPlayer) => p.slot === 'GK' || p.position_group === 'Goalkeeper')?.name}
          teamId={activeTeam?.team_id}
        />
        <TeamPeriodDominanceCard data={flashscoreSummary} isLoading={isFlashscoreLoading} />
      </div>

      {/* MOST-USED XI SECTION */}
      <div className="w-full">
        <TeamMostUsedXICard
          activeTeam={activeTeam}
          tournament={selectedTournament}
          venue={venue}
          contextFilter={contextFilter}
        />
      </div>

      {/* FLOOR 3: EXPANDED PITCH VIEWS */}
      {hasFloor2Charts && (
        <div
          className={
            bothFloor2Active
              ? 'grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-stretch'
              : 'grid grid-cols-1 max-w-5xl mx-auto gap-3.5 items-stretch'
          }
        >
          {visibleCharts.attack_zones && (
            <div className="w-full flex flex-col [&>div]:h-full [&>div]:!col-span-1">
              <TeamAttackZones
                teams={teams}
                activeTeam={activeTeam}
                tournament={selectedTournament}
                mode={perspective}
                viewMode={aggregationMode}
                selectedMatchId={validMatchId}
                venue={venue}
                contextFilter={contextFilter}
              />
            </div>
          )}

          {visibleCharts.defensive_actions && (
            <div className="w-full flex flex-col [&>div]:h-full [&>div]:!col-span-1">
              <TeamDefensiveTerritory
                teams={teams}
                activeTeam={activeTeam}
                tournament={selectedTournament}
                viewMode={aggregationMode}
                selectedMatchId={validMatchId}
                venue={venue}
                contextFilter={contextFilter}
              />
            </div>
          )}
        </div>
      )}

      {!hasFloor1Charts && !hasFloor2Charts && (
        <div className="py-16 text-center text-slate-500 bg-white border border-slate-200 rounded-xl space-y-2">
          <p className="text-sm font-semibold text-slate-700">No hay gráficos seleccionados para visualizar</p>
          <p className="text-xs text-slate-400">Usa el menú desplegable superior para activar las vistas tácticas deseadas.</p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer Trío Base
          </button>
        </div>
      )}
    </div>
  );
};

export default ClubGeneralPerformanceGrid;
