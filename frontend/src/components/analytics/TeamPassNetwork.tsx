import React, { useId, useMemo, useRef, useState } from 'react';
import { AlertCircle, Download, Loader2, Network, RefreshCw } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  type ContextFilter,
  type PassNetworkNode,
  type TeamMetricEntry,
  type VenueFilter,
} from '../../services/api';
import { useTeamPassNetwork } from '../../hooks/useTeam';
import { useTeamMatchSync } from '../../hooks/useTeamMatchSync';
import { getTeamThemeColor } from '../../utils/teams';
import { SoccerPitchCanvas } from './pitch/SoccerPitchCanvas';
import {
  DEFAULT_PASS_NETWORK_DIMENSIONS,
  PASS_THRESHOLD_OPTIONS,
  PassNetworkGraphOverlay,
  PassNetworkLegend,
  PassNetworkSvgDefs,
  PassNetworkTooltip,
  buildEdgeLookupSet,
  buildRelaxedNodeMap,
  computeMappedPassEdges,
  computePassNetworkMetrics,
  computeTopPassPartners,
} from './passNetwork';

export interface TeamPassNetworkProps {
  teams?: TeamMetricEntry[];
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
  contextFilter?: ContextFilter;
  viewMode?: 'cumulative' | 'match';
  selectedMatchId?: number | null;
}

export const TeamPassNetwork: React.FC<TeamPassNetworkProps> = ({
  activeTeam,
  tournament = 'all',
  venue = 'all',
  contextFilter = 'all',
  viewMode: propViewMode,
  selectedMatchId: propSelectedMatchId,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const rawUid = useId();
  const svgPrefix = useMemo(() => `passnet-${rawUid.replace(/:/g, '')}`, [rawUid]);

  const [isExporting, setIsExporting] = useState(false);
  const [internalViewMode] = useState<'cumulative' | 'match'>('cumulative');
  const [internalSelectedMatchId, setInternalSelectedMatchId] = useState<number | null>(null);
  const [minPassThreshold, setMinPassThreshold] = useState<number>(10);
  const [hoveredNode, setHoveredNode] = useState<PassNetworkNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const viewMode = propViewMode ?? internalViewMode;
  const effectiveSelectedMatchId =
    propSelectedMatchId !== undefined ? propSelectedMatchId : internalSelectedMatchId;

  const teamColor = useMemo(
    () =>
      activeTeam
        ? getTeamThemeColor(activeTeam.name, activeTeam.primary_color, activeTeam.team_id)
        : '#0284c7',
    [activeTeam]
  );

  const { isLoadingMatches, validMatchId, activeMatch, isMatchValid } = useTeamMatchSync({
    teamId: activeTeam?.team_id,
    tournament,
    selectedMatchId: effectiveSelectedMatchId,
    onSelectMatch: (matchId) => {
      if (propSelectedMatchId === undefined) {
        setInternalSelectedMatchId(matchId);
      }
    },
    viewMode,
  });

  const isPassNetworkEnabled = viewMode === 'cumulative' || (viewMode === 'match' && isMatchValid);

  const { data, isLoading, isError, error, refetch } = useTeamPassNetwork(
    activeTeam?.team_id,
    tournament,
    viewMode === 'match' ? validMatchId : null,
    venue,
    isPassNetworkEnabled,
    contextFilter
  );

  const isWaitingForMatch = viewMode === 'match' && (!isMatchValid || isLoadingMatches);
  const showLoading = isLoading || isWaitingForMatch;

  const nodes = data?.nodes || [];
  const edges = data?.edges || [];

  const nodeMap = useMemo(
    () => buildRelaxedNodeMap(nodes, DEFAULT_PASS_NETWORK_DIMENSIONS),
    [nodes]
  );

  const filteredEdges = useMemo(
    () => edges.filter((e) => e.pass_count >= minPassThreshold),
    [edges, minPassThreshold]
  );

  const edgePairSet = useMemo(() => buildEdgeLookupSet(filteredEdges), [filteredEdges]);

  const mappedEdges = useMemo(
    () => computeMappedPassEdges(filteredEdges, nodeMap, edgePairSet),
    [filteredEdges, nodeMap, edgePairSet]
  );

  const hoveredPartners = useMemo(
    () => computeTopPassPartners(hoveredNode, edges, nodeMap, 2),
    [hoveredNode, edges, nodeMap]
  );

  const metrics = useMemo(
    () => computePassNetworkMetrics(nodes, filteredEdges),
    [nodes, filteredEdges]
  );

  const handleNodeHover = (node: PassNetworkNode, targetEl: SVGGElement) => {
    const rect = targetEl.getBoundingClientRect();
    const cardRect = cardRef.current?.getBoundingClientRect();
    if (cardRect) {
      setTooltipPos({
        x: rect.left - cardRect.left + rect.width / 2,
        y: rect.top - cardRect.top,
      });
    }
    setHoveredNode(node);
  };

  const handleNodeLeave = () => {
    setHoveredNode(null);
    setTooltipPos(null);
  };

  const handleExportPNG = async () => {
    if (isExporting || !cardRef.current) return;
    try {
      setIsExporting(true);
      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 80));
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#ffffff',
        filter: (node) =>
          !(node instanceof HTMLElement && node.classList.contains('export-ignore')),
      });
      const link = document.createElement('a');
      const cleanName = activeTeam.name.replace(/\s+/g, '_');
      const cleanScope =
        viewMode === 'match' && activeMatch
          ? `F${activeMatch.round}_vs_${activeMatch.opponent_tricode}`
          : tournament === 'all'
          ? 'Temporada'
          : tournament;
      link.download = `Red_Pases_${cleanName}_${cleanScope}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error al exportar PNG de red de pases:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className="flex flex-col justify-between h-full min-h-[650px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 relative select-none"
    >
      {/* 1. Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <Network className="w-4 h-4 text-slate-700" />
            Red de Pases e Interacciones
          </h3>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            {viewMode === 'cumulative'
              ? `Posición media y circuitos del XI base (${tournament === 'all' ? 'Temporada Completa' : tournament})`
              : `XI Titular y circuitos específicos — ${activeMatch ? activeMatch.label : 'Partido seleccionado'}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto export-ignore">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 text-xs">
            {PASS_THRESHOLD_OPTIONS.map((threshold) => (
              <button
                key={threshold}
                type="button"
                onClick={() => setMinPassThreshold(threshold)}
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  minPassThreshold === threshold
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title={`Mostrar conexiones con al menos ${threshold} pases`}
              >
                ≥ {threshold}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportPNG}
            disabled={isExporting}
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

      {/* 2. Main Pitch Canvas */}
      <div className="flex-1 flex items-center justify-center min-h-[460px] lg:min-h-[500px] w-full overflow-hidden relative my-auto py-1">
        {showLoading ? (
          <div className="flex flex-col items-center justify-center py-24 w-full">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-2" />
            <span className="text-xs text-slate-500 font-medium">
              {viewMode === 'match'
                ? 'Calculando red de pases del partido...'
                : 'Calculando red de pases del XI base...'}
            </span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center w-full px-4">
            <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
            <p className="text-xs text-rose-700 max-w-sm mb-3">
              {error instanceof Error ? error.message : 'Error al obtener datos de red de pases.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs">
            No se registraron suficientes pases espaciales para este club en el torneo seleccionado.
          </div>
        ) : (
          <SoccerPitchCanvas
            orientation="vertical"
            half={false}
            theme="light"
            className="w-full max-w-[432px] mx-auto"
            svgClassName="w-full h-auto max-h-[480px] block overflow-visible select-none"
            defs={<PassNetworkSvgDefs teamColor={teamColor} idPrefix={svgPrefix} />}
          >
            <PassNetworkGraphOverlay
              dimensions={DEFAULT_PASS_NETWORK_DIMENSIONS}
              nodeMap={nodeMap}
              mappedEdges={mappedEdges}
              edges={edges}
              minPassThreshold={minPassThreshold}
              hoveredNode={hoveredNode}
              teamColor={teamColor}
              idPrefix={svgPrefix}
              onNodeHover={handleNodeHover}
              onNodeLeave={handleNodeLeave}
            />
          </SoccerPitchCanvas>
        )}

        <PassNetworkTooltip
          hoveredNode={hoveredNode}
          tooltipPos={tooltipPos}
          hoveredPartners={hoveredPartners}
        />
      </div>

      {/* 3. Diagnostic Legend & Footer Strip */}
      <PassNetworkLegend metrics={metrics} viewMode={viewMode} teamColor={teamColor} />
    </div>
  );
};

export default TeamPassNetwork;
