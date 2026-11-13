import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Compass,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Copy,
  Check,
  Download,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { TeamMetricEntry, VenueFilter, ContextFilter } from '../../services/api';
import { useTeamAttackZones } from '../../hooks/useTeam';
import { useTeamMatchSync } from '../../hooks/useTeamMatchSync';
import { SoccerPitchCanvas } from './pitch/SoccerPitchCanvas';
import {
  ATTACK_ZONES_PITCH_DIMENSIONS,
  AttackZoneChannelId,
  AttackZoneData,
  AttackZoneMode,
  AttackZonesViewMode,
  CHANNEL_CONFIG,
  CHANNEL_NAME_MAP,
  buildAttackZonesSummaryText,
  computeFlankDistribution,
  AttackZoneOverlay,
  AttackZonesLegend,
  AttackZonesTooltip,
  AttackZonesKpiStrip,
} from './attackZones';

export interface TeamAttackZonesProps {
  teams?: TeamMetricEntry[];
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
  contextFilter?: ContextFilter;
  mode?: AttackZoneMode;
  viewMode?: AttackZonesViewMode;
  selectedMatchId?: number | null;
}

export const TeamAttackZones: React.FC<TeamAttackZonesProps> = ({
  activeTeam,
  tournament = 'Clausura',
  venue = 'all',
  contextFilter = 'all',
  mode: propMode,
  viewMode: propViewMode,
  selectedMatchId: propSelectedMatchId,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const [internalMode, setInternalMode] = useState<AttackZoneMode>('for');
  const [internalViewMode, setInternalViewMode] = useState<AttackZonesViewMode>('cumulative');
  const [internalSelectedMatchId, setInternalSelectedMatchId] = useState<number | null>(null);
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);
  const [lockedChannel, setLockedChannel] = useState<string | null>(null);
  const [tooltipCoords, setTooltipCoords] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const mode = propMode ?? internalMode;
  const viewMode = propViewMode ?? internalViewMode;
  const selectedMatchId =
    propSelectedMatchId !== undefined ? propSelectedMatchId : internalSelectedMatchId;

  const setMode = (m: AttackZoneMode) => {
    if (propMode === undefined) setInternalMode(m);
  };

  const setViewMode = (vm: AttackZonesViewMode) => {
    if (propViewMode === undefined) setInternalViewMode(vm);
  };

  const handleSetSelectedMatchId = useCallback(
    (val: number | null) => {
      if (propSelectedMatchId === undefined) {
        setInternalSelectedMatchId(val);
      }
    },
    [propSelectedMatchId]
  );

  // Synchronize fixture list and active match via shared hook
  const { matches, isLoadingMatches, validMatchId, activeMatch, isMatchValid } = useTeamMatchSync({
    teamId: activeTeam?.team_id,
    tournament,
    selectedMatchId,
    onSelectMatch: handleSetSelectedMatchId,
    viewMode,
  });

  // Clear hover/lock interactions when switching club or tournament
  useEffect(() => {
    setHoveredChannel(null);
    setLockedChannel(null);
    setTooltipCoords(null);
  }, [activeTeam?.team_id, tournament]);

  const isMatchMode = viewMode === 'match';
  const isQueryEnabled = !isMatchMode || isMatchValid;

  // Fetch Attack Zones data
  const { data, isLoading, isError, error, refetch } = useTeamAttackZones(
    activeTeam?.team_id,
    tournament,
    isMatchMode ? validMatchId : null,
    mode,
    venue,
    isQueryEnabled,
    contextFilter
  );

  const showLoading = isLoading || (isMatchMode && (!isMatchValid || isLoadingMatches));

  const summary = data?.summary || {
    total_entries: 0,
    box_entries_total: 0,
    box_entry_conversion_pct: 0,
    dominant_channel: 'center',
    most_dangerous_channel: 'center',
  };

  const channels = data?.channels || [];

  const channelDataMap = useMemo(() => {
    const map = new Map<string, AttackZoneData>();
    channels.forEach((c) => map.set(c.channel_id, c));
    return map;
  }, [channels]);

  const flankDistribution = useMemo(() => computeFlankDistribution(channels), [channels]);

  const dominantChannelName =
    CHANNEL_NAME_MAP[summary.dominant_channel] || summary.dominant_channel;
  const mostDangerousChannelName =
    CHANNEL_NAME_MAP[summary.most_dangerous_channel] || summary.most_dangerous_channel;
  const maxThreatXg = (channelDataMap.get(summary.most_dangerous_channel)?.threat_xg ?? 0).toFixed(2);

  const maxShare = useMemo(() => {
    if (!channels || channels.length === 0) return 1;
    return Math.max(...channels.map((c) => c.share_pct), 1);
  }, [channels]);

  const activeChannelId = hoveredChannel || lockedChannel;
  const activeChannelData = useMemo(() => {
    if (!activeChannelId) return null;
    return channelDataMap.get(activeChannelId) || null;
  }, [activeChannelId, channelDataMap]);

  const activeChannelConfig = useMemo(() => {
    if (!activeChannelId) return null;
    return CHANNEL_CONFIG.find((cfg) => cfg.id === activeChannelId) || null;
  }, [activeChannelId]);

  const handleMouseMove = (e: React.MouseEvent<SVGGElement>, channelId: AttackZoneChannelId) => {
    setHoveredChannel(channelId);
    if (svgContainerRef.current) {
      const rect = svgContainerRef.current.getBoundingClientRect();
      setTooltipCoords({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredChannel(null);
    if (!lockedChannel) {
      setTooltipCoords(null);
    }
  };

  const handleChannelClick = (channelId: AttackZoneChannelId) => {
    setLockedChannel((prev) => (prev === channelId ? null : channelId));
  };

  // Copy structured plain-text summary for LLM/Scouting reports
  const handleCopySummary = async () => {
    const text = buildAttackZonesSummaryText({
      activeTeam,
      mode,
      viewMode,
      tournament,
      activeMatch,
      summary,
      channelDataMap,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error('Failed to copy attack zones summary', err);
    }
  };

  // High-resolution PNG export handler
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
      link.download = `zonas-de-ataque-${mode}-${sanitizedName}-${scopeLabel}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export attack zones PNG', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className="flex flex-col justify-between h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 relative select-none transition-all"
    >
      {/* 1. Header & Controls */}
      <div className="flex flex-col gap-3 pb-3 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-slate-700" />
              Zonas de Ataque e Infiltración
            </h3>
            <span className="text-xs text-slate-400 font-normal">
              • {mode === 'for' ? 'Ofensivo (A Favor)' : 'Defensivo (Concedidos)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 export-ignore">
            {/* Perspective Toggle */}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/70 text-xs">
              <button
                type="button"
                onClick={() => setMode('for')}
                className={`px-2.5 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                  mode === 'for'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                A Favor
              </button>
              <button
                type="button"
                onClick={() => setMode('against')}
                className={`px-2.5 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                  mode === 'against'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Concedidos
              </button>
            </div>

            {/* Scope Toggle */}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/70 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('cumulative')}
                className={`px-2.5 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === 'cumulative'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Acumulado
              </button>
              <button
                type="button"
                onClick={() => setViewMode('match')}
                className={`px-2.5 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === 'match'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Por Partido
              </button>
            </div>

            {/* Fixture Dropdown */}
            {isMatchMode && (
              <div className="relative inline-flex items-center">
                <select
                  value={selectedMatchId || ''}
                  onChange={(e) => handleSetSelectedMatchId(Number(e.target.value))}
                  disabled={isLoadingMatches || !matches || matches.length === 0}
                  className="appearance-none pl-2.5 pr-7 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-800 shadow-xs hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer min-w-[180px] max-w-[280px] truncate"
                >
                  {!matches || matches.length === 0 ? (
                    <option value="">No hay partidos</option>
                  ) : (
                    matches.map((m) => {
                      const roundPrefix = m.round ? `F${m.round} ` : '';
                      const venueLabel = m.is_home ? 'Local' : 'Visita';
                      const score =
                        m.team_score !== null &&
                        m.team_score !== undefined &&
                        m.opponent_score !== null &&
                        m.opponent_score !== undefined
                          ? ` · ${m.team_score}-${m.opponent_score}`
                          : '';
                      return (
                        <option key={m.match_id} value={m.match_id}>
                          {`${roundPrefix}vs ${m.opponent_name} · ${venueLabel}${score}`}
                        </option>
                      );
                    })
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>
        </div>

        {/* 2. Top Perspective-Aware KPI Strip */}
        <AttackZonesKpiStrip
          summary={summary}
          mode={mode}
          dominantChannelName={dominantChannelName}
          mostDangerousChannelName={mostDangerousChannelName}
          maxThreatXg={maxThreatXg}
        />
      </div>

      {/* 3. Main Pitch Canvas & Tactical Channels Visualization */}
      <div
        ref={svgContainerRef}
        className="relative w-full flex items-center justify-center my-auto py-4"
      >
        {showLoading ? (
          <div className="flex flex-col items-center justify-center py-28 w-full">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-2" />
            <span className="text-xs text-slate-500 font-medium">
              {isMatchMode
                ? 'Cargando zonas de ataque del partido...'
                : 'Cargando zonas de ataque acumuladas del torneo...'}
            </span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center w-full px-4">
            <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
            <p className="text-xs text-rose-700 max-w-sm mb-3">
              {error instanceof Error ? error.message : 'Error al obtener datos de zonas de ataque.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          </div>
        ) : (
          <div className="relative w-full max-w-[540px] flex flex-col items-center">
            <SoccerPitchCanvas
              orientation="vertical"
              half={true}
              theme="warm-ivory"
              outerRx={4}
              viewBox={`0 0 ${ATTACK_ZONES_PITCH_DIMENSIONS.SVG_WIDTH} ${ATTACK_ZONES_PITCH_DIMENSIONS.SVG_HEIGHT}`}
              pitchX={ATTACK_ZONES_PITCH_DIMENSIONS.PITCH_X}
              pitchY={ATTACK_ZONES_PITCH_DIMENSIONS.PITCH_Y}
              pitchWidth={ATTACK_ZONES_PITCH_DIMENSIONS.PITCH_WIDTH}
              pitchHeight={ATTACK_ZONES_PITCH_DIMENSIONS.PITCH_HEIGHT}
              className="w-full"
              svgClassName="w-full h-auto block overflow-visible select-none rounded-lg"
              defs={
                <filter id="dominantBadgeShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.12" />
                </filter>
              }
              underlay={
                <AttackZoneOverlay
                  channelDataMap={channelDataMap}
                  summary={summary}
                  maxShare={maxShare}
                  activeChannelId={activeChannelId}
                  mode={mode}
                  dimensions={ATTACK_ZONES_PITCH_DIMENSIONS}
                  onChannelMouseMove={handleMouseMove}
                  onChannelMouseLeave={handleMouseLeave}
                  onChannelClick={handleChannelClick}
                />
              }
            />

            {/* Macro Corridor Distribution Summary */}
            <AttackZonesLegend distribution={flankDistribution} />

            {/* Floating Interactive Hover Tooltip */}
            <AttackZonesTooltip
              channelData={activeChannelData}
              channelConfig={activeChannelConfig}
              tooltipCoords={tooltipCoords}
              mode={mode}
            />
          </div>
        )}
      </div>

      {/* 4. Bottom Editorial Strip & Action Buttons */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-semibold text-slate-700 tracking-tight">
            Liga 1 Scout | Datos Oficiales
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200/80">
          <span>Dirección de Ataque</span>
          <span className="text-amber-600 font-black">↑</span>
        </div>

        <div className="flex items-center gap-2 export-ignore">
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-2xs transition cursor-pointer"
            title="Copiar resumen en texto plano para prompts de LLMs o análisis"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copiar Resumen</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportPNG}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-2xs transition cursor-pointer disabled:opacity-50"
            title="Exportar gráfico de zonas de ataque en PNG"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Exportar PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamAttackZones;
