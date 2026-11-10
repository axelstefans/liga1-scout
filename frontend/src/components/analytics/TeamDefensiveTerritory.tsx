import React, { useState, useMemo, useRef } from 'react';
import { Download, Loader2, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { toPng } from 'html-to-image';
import { TeamMetricEntry, DefensiveEventItem, VenueFilter, ContextFilter } from '../../services/api';
import { useTeamDefensiveActions } from '../../hooks/useTeam';
import { useTeamMatchSync } from '../../hooks/useTeamMatchSync';
import { getTeamThemeColor } from '../../utils/teams';
import { SoccerPitchCanvas } from './pitch/SoccerPitchCanvas';
import {
  ActionFilterType,
  ACTION_CONFIG,
  FILTER_CATEGORIES,
  LAYER_PRIORITY,
  DEFENSIVE_PITCH_DIMENSIONS,
  mapOptaToSvg,
  computeBlockHeightLineX,
  renderDefensiveShape,
  DefensiveTerritoryLegend,
  DefensiveEventTooltip,
} from './defensiveTerritory';

export interface TeamDefensiveTerritoryProps {
  teams?: TeamMetricEntry[];
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
  contextFilter?: ContextFilter;
  viewMode?: 'cumulative' | 'match';
  selectedMatchId?: number | null;
}

export const TeamDefensiveTerritory: React.FC<TeamDefensiveTerritoryProps> = ({
  activeTeam,
  tournament = 'all',
  venue = 'all',
  contextFilter = 'all',
  viewMode: propViewMode,
  selectedMatchId: propSelectedMatchId,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [internalViewMode, setInternalViewMode] = useState<'cumulative' | 'match'>('cumulative');
  const [internalSelectedMatchId, setInternalSelectedMatchId] = useState<number | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionFilterType>('all');
  const [hoveredEvent, setHoveredEvent] = useState<DefensiveEventItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const viewMode = propViewMode ?? internalViewMode;
  const selectedMatchId = propSelectedMatchId !== undefined ? propSelectedMatchId : internalSelectedMatchId;

  const setViewMode = (vm: 'cumulative' | 'match') => {
    if (propViewMode === undefined) {
      setInternalViewMode(vm);
    }
  };

  const handleSetSelectedMatchId = (val: number | null) => {
    if (propSelectedMatchId === undefined) {
      setInternalSelectedMatchId(val);
    }
  };

  // Active club theme color
  const teamColor = useMemo(
    () => (activeTeam ? getTeamThemeColor(activeTeam.name, activeTeam.primary_color, activeTeam.team_id) : '#0284c7'),
    [activeTeam]
  );

  // Synchronize matches fixture with shared hook
  const { matches, isLoadingMatches, validMatchId, activeMatch, isMatchValid } = useTeamMatchSync({
    teamId: activeTeam?.team_id,
    tournament,
    selectedMatchId,
    onSelectMatch: handleSetSelectedMatchId,
    viewMode,
  });

  const isMatchMode = viewMode === 'match';
  const isQueryEnabled = !isMatchMode || isMatchValid;

  // Fetch Defensive Actions data from API
  const { data, isLoading, isError, error, refetch } = useTeamDefensiveActions(
    activeTeam?.team_id,
    tournament,
    isMatchMode ? validMatchId : null,
    venue,
    isQueryEnabled,
    contextFilter
  );

  const isWaitingForMatch = isMatchMode && (!isMatchValid || isLoadingMatches);
  const showLoading = isLoading || isWaitingForMatch;

  const rawEvents = data?.events || [];
  const summary = data?.summary || {
    total_events: 0,
    won_tackles: 0,
    lost_tackles: 0,
    interceptions: 0,
    clearances: 0,
    blocked_passes: 0,
    recoveries: 0,
    high_recoveries: 0,
    tackles_won_pct: 0,
  };
  const blockHeightPct = data?.block_height_pct ?? 0;
  const blockHeightM = data?.block_height_m ?? 0;
  const blockClassification = data?.block_classification || 'Bloque Medio';

  // Visual event de-cluttering: omit passive recoveries in deep defensive third (x <= 25)
  const visualEvents = useMemo(() => {
    return rawEvents.filter((e) => {
      if (e.type === 'recovery' && e.x <= 25.0) {
        return false;
      }
      return true;
    });
  }, [rawEvents]);

  // Filter plotted events by action type
  const filteredEvents = useMemo(() => {
    if (selectedAction === 'all') return visualEvents;
    if (selectedAction === 'tackle') {
      return visualEvents.filter((e) => e.type === 'won_tackle' || e.type === 'lost_tackle');
    }
    return visualEvents.filter((e) => e.type === selectedAction);
  }, [visualEvents, selectedAction]);

  // Calculate action counts for displayed events
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: visualEvents.length,
      tackle: 0,
      interception: 0,
      recovery: 0,
      clearance: 0,
      blocked_pass: 0,
      foul: 0,
    };
    for (const e of visualEvents) {
      if (e.type === 'won_tackle' || e.type === 'lost_tackle') {
        counts.tackle++;
      } else if (e.type in counts) {
        counts[e.type]++;
      }
    }
    return counts;
  }, [visualEvents]);

  // Spatial coordinate mapping for horizontal pitch canvas
  const mappedEvents = useMemo(() => {
    return filteredEvents.map((ev) => {
      const { px, py } = mapOptaToSvg(ev.x, ev.y, DEFENSIVE_PITCH_DIMENSIONS);
      return { event: ev, px, py };
    });
  }, [filteredEvents]);

  const isHighDensity = filteredEvents.length > 150;
  const baseScale = isHighDensity ? 0.78 : 1.0;
  const baseOpacity = isHighDensity ? 0.85 : 0.95;

  // Layer ordering by tactical priority
  const sortedMappedEvents = useMemo(() => {
    return [...mappedEvents].sort((a, b) => {
      if (hoveredEvent?.event_id === a.event.event_id) return 1;
      if (hoveredEvent?.event_id === b.event.event_id) return -1;
      return (LAYER_PRIORITY[a.event.type] || 0) - (LAYER_PRIORITY[b.event.type] || 0);
    });
  }, [mappedEvents, hoveredEvent]);

  // Block Height vertical line X coordinate
  const blockHeightLineX = useMemo(() => {
    return computeBlockHeightLineX(blockHeightPct, DEFENSIVE_PITCH_DIMENSIONS);
  }, [blockHeightPct]);

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
      link.download = `territorio-defensivo-${sanitizedName}-${scopeLabel}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export defensive territory PNG', err);
    } finally {
      setIsExporting(false);
    }
  };

  const ppdaVal = activeTeam?.ppda ? activeTeam.ppda.toFixed(1) : '10.4';

  return (
    <div
      ref={cardRef}
      className="flex flex-col justify-between h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 relative select-none transition-all"
    >
      {/* 1. Header & Minimalist Framing */}
      <div className="flex flex-col gap-3 pb-3 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: teamColor }}
              />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {activeTeam.name} — Acciones Defensivas
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {isMatchMode && activeMatch
                ? activeMatch.label
                : tournament === 'all'
                ? 'Torneo Completo 2026'
                : `Torneo ${tournament}`}{' '}
              • Altura de Presión: {blockHeightM}m ({blockHeightPct.toFixed(1)}%) • {blockClassification}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 export-ignore self-start sm:self-auto">
            {/* Mode Switcher */}
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
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

            {/* Match Dropdown */}
            {isMatchMode && (
              <div className="relative inline-flex items-center">
                <select
                  value={selectedMatchId || ''}
                  onChange={(e) => handleSetSelectedMatchId(Number(e.target.value))}
                  disabled={isLoadingMatches || !matches || matches.length === 0}
                  className="appearance-none pl-2.5 pr-7 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-navy cursor-pointer max-w-[185px] truncate"
                >
                  {isLoadingMatches ? (
                    <option value="">Cargando partidos...</option>
                  ) : !matches || matches.length === 0 ? (
                    <option value="">Sin partidos</option>
                  ) : (
                    matches.map((m) => (
                      <option key={`def-match-${m.match_id}`} value={m.match_id}>
                        {m.label}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
              </div>
            )}

            {/* Export PNG */}
            <button
              type="button"
              onClick={handleExportPNG}
              disabled={isExporting}
              className="export-ignore inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/80 rounded-lg text-xs font-medium transition-all shadow-2xs cursor-pointer"
              title="Descargar imagen en alta resolución (2x)"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{isExporting ? '...' : 'PNG'}</span>
            </button>
          </div>
        </div>

        {/* Minimalist Metrics & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Action Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 export-ignore">
            <button
              type="button"
              onClick={() => setSelectedAction('all')}
              className={`inline-flex items-center gap-1.5 px-2 py-0.8 rounded-md text-xs font-medium transition-all cursor-pointer ${
                selectedAction === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <span>Todas</span>
              <span className={`text-[10px] px-1 py-0.1 rounded-full ${selectedAction === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'}`}>
                {categoryCounts.all}
              </span>
            </button>

            {FILTER_CATEGORIES.map((cat) => {
              const isSelected = selectedAction === cat.key;
              const count = categoryCounts[cat.key] || 0;

              return (
                <button
                  key={`btn-filter-${cat.key}`}
                  type="button"
                  onClick={() => setSelectedAction(cat.key as ActionFilterType)}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.8 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                    isSelected
                      ? `${cat.bgColor} ${cat.textColor} ${cat.borderColor} shadow-xs ring-1 ring-inset ${cat.borderColor}`
                      : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <svg width="9" height="9" viewBox="-5 -5 10 10" className="shrink-0 overflow-visible">
                    {renderDefensiveShape(cat.shapeType, 0, 0, 0.8)}
                  </svg>
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1 py-0.1 rounded-full ${isSelected ? 'bg-white/80' : 'bg-slate-200/70 text-slate-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Discreet Metrics Strip */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-slate-400">Éxito entradas:</span>
              <span className="font-semibold text-slate-800">{summary.tackles_won_pct}%</span>
              <span className="text-[11px] text-slate-400">({summary.won_tackles}/{summary.won_tackles + summary.lost_tackles})</span>
            </span>
            <span className="text-slate-200">|</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-slate-400">Intercepciones:</span>
              <span className="font-semibold text-slate-800">{summary.interceptions}</span>
            </span>
            <span className="text-slate-200">|</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-slate-400">Recup. Altas:</span>
              <span className="font-semibold text-slate-800">{summary.high_recoveries}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Horizontal Pitch Canvas & Event Markers */}
      <div className="relative w-full flex items-center justify-center my-auto py-2">
        {showLoading ? (
          <div className="flex flex-col items-center justify-center py-28 w-full">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-2" />
            <span className="text-xs text-slate-500 font-medium">
              {isMatchMode
                ? 'Cargando acciones defensivas del partido...'
                : 'Cargando territorio defensivo acumulado...'}
            </span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center w-full px-4">
            <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
            <p className="text-xs text-rose-700 max-w-sm mb-3">
              {error instanceof Error ? error.message : 'Error al obtener datos defensivos.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          </div>
        ) : rawEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 text-xs">
            No se registraron acciones defensivas para este club en el periodo seleccionado.
          </div>
        ) : (
          <div className="relative w-full max-w-[960px]">
            <SoccerPitchCanvas
              orientation="horizontal"
              half={false}
              theme="warm-ivory"
              viewBox={`0 0 ${DEFENSIVE_PITCH_DIMENSIONS.SVG_WIDTH} ${DEFENSIVE_PITCH_DIMENSIONS.SVG_HEIGHT}`}
              pitchX={DEFENSIVE_PITCH_DIMENSIONS.PITCH_X}
              pitchY={DEFENSIVE_PITCH_DIMENSIONS.PITCH_Y}
              pitchWidth={DEFENSIVE_PITCH_DIMENSIONS.PITCH_WIDTH}
              pitchHeight={DEFENSIVE_PITCH_DIMENSIONS.PITCH_HEIGHT}
              svgClassName="w-full h-auto overflow-visible select-none rounded-lg"
              defs={
                <>
                  <filter id="defPillShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.18" />
                  </filter>
                  <filter id="defDotHalo" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#0f172a" floodOpacity="0.25" />
                  </filter>
                </>
              }
            >
              {/* Defensive Event Markers - Layer ordered by tactical priority */}
              <g className="transition-opacity duration-200">
                {sortedMappedEvents.map(({ event, px, py }) => {
                  const isHovered = hoveredEvent?.event_id === event.event_id;
                  const config = ACTION_CONFIG[event.type as keyof typeof ACTION_CONFIG] || ACTION_CONFIG.recovery;
                  const markerScale = isHovered ? baseScale * 1.35 : baseScale;
                  const markerOpacity = isHovered ? 1.0 : baseOpacity;

                  return (
                    <g
                      key={`ev-${event.event_id}`}
                      className="cursor-pointer transition-opacity duration-150"
                      opacity={markerOpacity}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredEvent(event);
                        setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onMouseLeave={() => {
                        setHoveredEvent(null);
                        setTooltipPos(null);
                      }}
                    >
                      <circle cx={px} cy={py} r={Math.max(8, 10 * markerScale)} fill="transparent" />

                      {isHovered && (
                        <circle
                          cx={px}
                          cy={py}
                          r={10 * markerScale}
                          fill={config.color}
                          fillOpacity={0.3}
                        />
                      )}

                      {renderDefensiveShape(event.type, px, py, markerScale, isHovered)}
                    </g>
                  );
                })}
              </g>

              {/* Line of Engagement (Solid Gold Line crossing top to bottom sideline) */}
              {blockHeightPct > 0 && (
                <g className="transition-all duration-300">
                  <line
                    x1={blockHeightLineX}
                    y1={DEFENSIVE_PITCH_DIMENSIONS.PITCH_Y}
                    x2={blockHeightLineX}
                    y2={DEFENSIVE_PITCH_DIMENSIONS.PITCH_Y + DEFENSIVE_PITCH_DIMENSIONS.PITCH_HEIGHT}
                    stroke="#D4A344"
                    strokeWidth={2.5}
                  />
                  <line
                    x1={blockHeightLineX}
                    y1={DEFENSIVE_PITCH_DIMENSIONS.PITCH_Y + DEFENSIVE_PITCH_DIMENSIONS.PITCH_HEIGHT}
                    x2={blockHeightLineX}
                    y2={DEFENSIVE_PITCH_DIMENSIONS.PITCH_Y + DEFENSIVE_PITCH_DIMENSIONS.PITCH_HEIGHT + 6}
                    stroke="#D4A344"
                    strokeWidth={2.5}
                  />
                  <text
                    x={blockHeightLineX}
                    y={DEFENSIVE_PITCH_DIMENSIONS.PITCH_Y + DEFENSIVE_PITCH_DIMENSIONS.PITCH_HEIGHT + 20}
                    textAnchor="middle"
                    className="text-xs font-semibold fill-[#4A3525] select-none"
                  >
                    {blockHeightPct.toFixed(1)}% up the pitch
                  </text>
                </g>
              )}

              {/* Floating Legend and Editorial Footer Strip */}
              <DefensiveTerritoryLegend ppdaVal={ppdaVal} teamName={activeTeam.name} />
            </SoccerPitchCanvas>

            {/* Interactive Floating Hover Tooltip */}
            <DefensiveEventTooltip hoveredEvent={hoveredEvent} tooltipPos={tooltipPos} />
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamDefensiveTerritory;
