import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Download, Loader2, AlertCircle, RefreshCw, Target } from 'lucide-react';
import { toPng } from 'html-to-image';
import { TeamMetricEntry, ShotItem, VenueFilter, ContextFilter } from '../../services/api';
import { useTeamShotMap } from '../../hooks/useTeam';
import { useTeamMatchSync } from '../../hooks/useTeamMatchSync';
import { SoccerPitchCanvas } from './pitch/SoccerPitchCanvas';
import {
  ShotMode,
  ResultFilterType,
  ShotCounts,
  ShotTooltipPosition,
  SHOT_PITCH_DIMENSIONS,
  mapAndJitterShots,
  sortShotsByPriority,
  computeActiveSummary,
  ShotMarker,
  ShotMapLegend,
  ShotMapTooltip,
  ShotEfficiencyBadge,
  ShotMapFilterPills,
  ShotMapKpiStrip,
} from './shotMap';

export interface TeamShotMapProps {
  teams?: TeamMetricEntry[];
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
  contextFilter?: ContextFilter;
  mode?: ShotMode;
  viewMode?: 'cumulative' | 'match';
  selectedMatchId?: number | null;
  selectedPlayer?: string;
}

export const TeamShotMap: React.FC<TeamShotMapProps> = ({
  activeTeam,
  tournament = 'all',
  venue = 'all',
  contextFilter = 'all',
  mode: propMode,
  viewMode: propViewMode,
  selectedMatchId: propSelectedMatchId,
  selectedPlayer: propSelectedPlayer,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [internalMode] = useState<ShotMode>('for');
  const [internalViewMode] = useState<'cumulative' | 'match'>('cumulative');
  const [internalSelectedMatchId, setInternalSelectedMatchId] = useState<number | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilterType>('all');
  const [internalSelectedPlayer, setInternalSelectedPlayer] = useState<string>('all');
  const [hoveredShot, setHoveredShot] = useState<ShotItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<ShotTooltipPosition | null>(null);

  const mode = propMode ?? internalMode;
  const viewMode = propViewMode ?? internalViewMode;
  const selectedMatchId = propSelectedMatchId !== undefined ? propSelectedMatchId : internalSelectedMatchId;
  const selectedPlayer = propSelectedPlayer ?? internalSelectedPlayer;

  const handleSetSelectedMatchId = (val: number | null) => {
    if (propSelectedMatchId === undefined) {
      setInternalSelectedMatchId(val);
    }
  };

  const handleSetSelectedPlayer = (val: string) => {
    if (propSelectedPlayer === undefined) {
      setInternalSelectedPlayer(val);
    }
  };

  // Synchronize matches fixture with shared hook
  const { matches, isLoadingMatches, validMatchId, activeMatch, isMatchValid } = useTeamMatchSync({
    teamId: activeTeam?.team_id,
    tournament,
    selectedMatchId,
    onSelectMatch: handleSetSelectedMatchId,
    viewMode,
  });

  // Reset player filter when mode or match changes
  useEffect(() => {
    handleSetSelectedPlayer('all');
  }, [mode, selectedMatchId]);

  const isMatchMode = viewMode === 'match';
  const isQueryEnabled = !isMatchMode || isMatchValid;

  // Fetch Shot Map data from API
  const { data, isLoading, isError, error, refetch } = useTeamShotMap(
    activeTeam?.team_id,
    tournament,
    isMatchMode ? validMatchId : null,
    mode,
    venue,
    isQueryEnabled,
    contextFilter
  );

  const isWaitingForMatch = isMatchMode && (!isMatchValid || isLoadingMatches);
  const showLoading = isLoading || isWaitingForMatch;

  const rawShots = data?.shots || [];

  // Filter shots by selected player
  const playerShots = useMemo(() => {
    if (selectedPlayer === 'all') return rawShots;
    return rawShots.filter((s) => s.player_name === selectedPlayer);
  }, [rawShots, selectedPlayer]);

  // Filter shots by outcome result
  const filteredShots = useMemo(() => {
    if (resultFilter === 'all') return playerShots;
    return playerShots.filter((s) => s.result === resultFilter);
  }, [playerShots, resultFilter]);

  // Reactive KPI summary
  const activeSummary = useMemo(() => {
    const matchesCount = matches?.length || activeTeam?.matches_played || 1;
    return computeActiveSummary(playerShots, selectedPlayer, data?.summary, matchesCount);
  }, [selectedPlayer, playerShots, data?.summary, matches?.length, activeTeam?.matches_played]);

  // Counts for outcome pill badges
  const counts: ShotCounts = useMemo(() => {
    return {
      all: playerShots.length,
      goal: playerShots.filter((s) => s.result === 'goal').length,
      saved: playerShots.filter((s) => s.result === 'saved').length,
      blocked: playerShots.filter((s) => s.result === 'blocked').length,
      miss: playerShots.filter((s) => s.result === 'miss').length,
    };
  }, [playerShots]);

  const isCumulative = rawShots.length > 80;

  // Map and sort shots with anti-collision jitter on goal markers
  const sortedMappedShots = useMemo(() => {
    const jittered = mapAndJitterShots(filteredShots, isCumulative, SHOT_PITCH_DIMENSIONS);
    return sortShotsByPriority(jittered, hoveredShot?.shot_id);
  }, [filteredShots, isCumulative, hoveredShot?.shot_id]);

  // PNG Export Handler
  const handleExportPNG = async () => {
    if (!cardRef.current || isExporting) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList.contains('export-ignore')) {
            return false;
          }
          return true;
        },
      });
      const link = document.createElement('a');
      const sanitizedName = activeTeam.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const scopeLabel = isMatchMode && activeMatch ? `m${activeMatch.match_id}` : tournament;
      const playerLabel = selectedPlayer !== 'all' ? `-${selectedPlayer.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '';
      link.download = `mapa-de-tiros-${mode}-${sanitizedName}-${scopeLabel}${playerLabel}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export shot map PNG', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className="flex flex-col justify-between h-full min-h-[650px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 relative select-none transition-all"
    >
      {/* 1. Header & Controls */}
      <div className="flex flex-col gap-2.5 pb-2.5 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Title Block */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <Target className="w-4 h-4 text-slate-700" />
                Mapa de Tiros y Calidad (xG)
              </h3>
              <ShotEfficiencyBadge xgDifference={activeSummary.xg_difference} mode={mode} />
            </div>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              {viewMode === 'cumulative'
                ? `Distribución espacial y calidad de remates (${tournament === 'all' ? 'Temporada Completa' : tournament})`
                : `Remates y calidad xG — ${activeMatch ? activeMatch.label : 'Partido seleccionado'}`}
            </p>
          </div>

          {/* Action Bar (Top Right) */}
          <div className="flex items-center gap-2 self-start sm:self-auto export-ignore">
            <button
              type="button"
              onClick={handleExportPNG}
              disabled={isExporting || showLoading || rawShots.length === 0}
              className="export-ignore inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-colors border border-slate-200/60 shadow-xs cursor-pointer disabled:opacity-50"
              title="Exportar imagen PNG"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>PNG</span>
            </button>
          </div>
        </div>

        {/* Tier 1: Outcome Filter Pills */}
        <ShotMapFilterPills
          resultFilter={resultFilter}
          counts={counts}
          onSelectFilter={setResultFilter}
        />

        {/* Tier 2: Opta-Style Tabular KPI Strip */}
        <ShotMapKpiStrip
          summary={activeSummary}
          mode={mode}
          viewMode={viewMode}
        />
      </div>

      {/* 2. Vertical Attacking Pitch Canvas & Shot Markers */}
      <div className="flex-1 flex items-center justify-center min-h-[460px] lg:min-h-[500px] w-full overflow-hidden relative my-auto py-1">
        {showLoading ? (
          <div className="flex flex-col items-center justify-center py-28 w-full">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-2" />
            <span className="text-xs text-slate-500 font-medium">
              {isMatchMode
                ? 'Cargando mapa de tiros del partido...'
                : 'Cargando tiros acumulados del torneo...'}
            </span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center w-full px-4">
            <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
            <p className="text-xs text-rose-700 max-w-sm mb-3">
              {error instanceof Error ? error.message : 'Error al obtener datos de tiros.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          </div>
        ) : rawShots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 text-xs">
            No se registraron tiros para este club en el periodo seleccionado.
          </div>
        ) : (
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <SoccerPitchCanvas
              orientation="vertical"
              half={true}
              theme="warm-ivory"
              viewBox={`0 0 ${SHOT_PITCH_DIMENSIONS.SVG_WIDTH} ${SHOT_PITCH_DIMENSIONS.SVG_HEIGHT}`}
              pitchX={SHOT_PITCH_DIMENSIONS.PITCH_X}
              pitchY={SHOT_PITCH_DIMENSIONS.PITCH_Y}
              pitchWidth={SHOT_PITCH_DIMENSIONS.PITCH_WIDTH}
              pitchHeight={SHOT_PITCH_DIMENSIONS.PITCH_HEIGHT}
              svgClassName="max-h-[480px] w-auto mx-auto overflow-visible select-none rounded-lg"
              defs={
                <>
                  <filter id="shotGoalHalo" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#047857" floodOpacity="0.55" />
                  </filter>
                  <filter id="shotHoverGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#0f172a" floodOpacity="0.45" />
                  </filter>
                </>
              }
            >
              {/* Shot Bubbles Rendered with Hierarchical Layering */}
              {sortedMappedShots.map((item) => (
                <ShotMarker
                  key={item.shot.shot_id}
                  item={item}
                  isHovered={hoveredShot?.shot_id === item.shot.shot_id}
                  isCumulative={isCumulative}
                  onHover={(_, coords) => {
                    setHoveredShot(item.shot);
                    setTooltipPos(coords);
                  }}
                  onLeave={() => {
                    setHoveredShot(null);
                    setTooltipPos(null);
                  }}
                />
              ))}
            </SoccerPitchCanvas>

            {/* Bottom Reference Strip with Direction Indicator & xG Bubble Scale */}
            <ShotMapLegend isCumulative={isCumulative} />

            {/* Floating Hover Tooltip with Adaptive Placement */}
            <ShotMapTooltip hoveredShot={hoveredShot} tooltipPos={tooltipPos} />
          </div>
        )}
      </div>

      {/* 3. Footer */}
      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="font-medium text-slate-400">Liga 1 Scout | Datos Oficiales</span>
        <span className="text-slate-400 font-normal">
          {filteredShots.length} {filteredShots.length === 1 ? 'remate registrado' : 'remates registrados'}
        </span>
      </div>
    </div>
  );
};

export default TeamShotMap;
