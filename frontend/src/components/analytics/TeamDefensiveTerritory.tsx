import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Download, Loader2, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { toPng } from 'html-to-image';
import { TeamMetricEntry, DefensiveEventItem, VenueFilter, ContextFilter } from '../../services/api';
import { useTeamDefensiveActions, useTeamMatches } from '../../hooks/useTeam';
import { getTeamThemeColor } from '../../utils/teams';

export interface TeamDefensiveTerritoryProps {
  teams?: TeamMetricEntry[];
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
  contextFilter?: ContextFilter;
  viewMode?: 'cumulative' | 'match';
  selectedMatchId?: number | null;
}

type ActionFilterType = 'all' | 'tackle' | 'interception' | 'recovery' | 'clearance' | 'blocked_pass' | 'foul';

const ACTION_CONFIG: Record<
  string,
  {
    label: string;
    singular: string;
    color: string;
    strokeColor: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
  }
> = {
  won_tackle: {
    label: 'Entrada Ganada',
    singular: 'Entrada Ganada',
    color: '#93C5FD',
    strokeColor: '#2563EB',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  lost_tackle: {
    label: 'Entrada Perdida',
    singular: 'Entrada Perdida',
    color: '#FB923C',
    strokeColor: '#EA580C',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
  },
  interception: {
    label: 'Intercepciones',
    singular: 'Intercepción',
    color: '#22C55E',
    strokeColor: '#15803D',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  clearance: {
    label: 'Despejes',
    singular: 'Despeje',
    color: '#D1D5DB',
    strokeColor: '#4B5563',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-300',
  },
  blocked_pass: {
    label: 'Bloqueos',
    singular: 'Bloqueo de pase',
    color: '#F3F4F6',
    strokeColor: '#6B7280',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
  },
  recovery: {
    label: 'Recuperaciones',
    singular: 'Recuperación',
    color: '#9CA3AF',
    strokeColor: '#9CA3AF',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
    borderColor: 'border-slate-200',
  },
  foul: {
    label: 'Faltas',
    singular: 'Falta cometida',
    color: '#FDA4AF',
    strokeColor: '#E11D48',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
  },
};

const FILTER_CATEGORIES = [
  { key: 'tackle', label: 'Entradas', shapeType: 'won_tackle', color: '#93C5FD', bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
  { key: 'interception', label: 'Intercepciones', shapeType: 'interception', color: '#22C55E', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
  { key: 'recovery', label: 'Recuperaciones', shapeType: 'recovery', color: '#9CA3AF', bgColor: 'bg-slate-100', textColor: 'text-slate-600', borderColor: 'border-slate-200' },
  { key: 'clearance', label: 'Despejes', shapeType: 'clearance', color: '#D1D5DB', bgColor: 'bg-slate-100', textColor: 'text-slate-700', borderColor: 'border-slate-300' },
  { key: 'blocked_pass', label: 'Bloqueos', shapeType: 'blocked_pass', color: '#F3F4F6', bgColor: 'bg-slate-100', textColor: 'text-slate-700', borderColor: 'border-slate-200' },
  { key: 'foul', label: 'Faltas', shapeType: 'foul', color: '#FDA4AF', bgColor: 'bg-rose-50', textColor: 'text-rose-700', borderColor: 'border-rose-200' },
] as const;

const LAYER_PRIORITY: Record<string, number> = {
  recovery: 1,      // bottom layer
  clearance: 2,     // bottom layer
  foul: 3,          // middle layer
  blocked_pass: 4,  // middle layer
  lost_tackle: 5,   // upper middle
  interception: 6,  // top layer
  won_tackle: 7,    // top layer
};

/**
 * Renders pure SVG geometric shape markers.
 */
function renderDefensiveShape(
  type: string,
  cx: number = 0,
  cy: number = 0,
  scale: number = 1.0,
  isHovered: boolean = false
): React.ReactElement {
  switch (type) {
    case 'won_tackle': {
      // Blue diamond
      const r = 4.8 * scale;
      return (
        <polygon
          points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
          fill="#93C5FD"
          stroke="#2563EB"
          strokeWidth={1.5}
          filter={isHovered ? 'url(#defDotHalo)' : undefined}
        />
      );
    }
    case 'lost_tackle': {
      // Orange circle
      const r = 3.8 * scale;
      return (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="#FB923C"
          stroke="#EA580C"
          strokeWidth={1.5}
          filter={isHovered ? 'url(#defDotHalo)' : undefined}
        />
      );
    }
    case 'interception': {
      // Solid green square
      const s = 7.0 * scale;
      return (
        <rect
          x={cx - s / 2}
          y={cy - s / 2}
          width={s}
          height={s}
          fill="#22C55E"
          stroke="#15803D"
          strokeWidth={1.5}
          filter={isHovered ? 'url(#defDotHalo)' : undefined}
        />
      );
    }
    case 'clearance': {
      // Semi-transparent grey square with border
      const s = 7.0 * scale;
      return (
        <rect
          x={cx - s / 2}
          y={cy - s / 2}
          width={s}
          height={s}
          fill="#D1D5DB"
          fillOpacity={0.6}
          stroke="#4B5563"
          strokeWidth={1.5}
        />
      );
    }
    case 'blocked_pass': {
      // Inverted grey triangle
      const r = 4.4 * scale;
      return (
        <polygon
          points={`${cx - r},${cy - r * 0.75} ${cx + r},${cy - r * 0.75} ${cx},${cy + r * 1.05}`}
          fill="#F3F4F6"
          stroke="#6B7280"
          strokeWidth={1.2}
        />
      );
    }
    case 'recovery': {
      // Subtle grey cross (×)
      const r = 3.6 * scale;
      return (
        <g stroke="#9CA3AF" strokeWidth={1.2 * Math.max(0.8, scale)} strokeLinecap="round" opacity={0.85}>
          <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} />
          <line x1={cx - r} y1={cy + r} x2={cx + r} y2={cy - r} />
        </g>
      );
    }
    case 'foul': {
      // Rose triangle
      const r = 4.2 * scale;
      return (
        <polygon
          points={`${cx},${cy - r * 1.05} ${cx + r},${cy + r * 0.75} ${cx - r},${cy + r * 0.75}`}
          fill="#FDA4AF"
          stroke="#E11D48"
          strokeWidth={1.2}
        />
      );
    }
    default: {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={3.8 * scale}
          fill="#9CA3AF"
          stroke="#4B5563"
          strokeWidth={1.2}
        />
      );
    }
  }
}

function formatPlayerName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const initial = parts[0].charAt(0).toUpperCase();

  if (
    parts.length >= 3 &&
    ['di', 'de', 'del', 'da', 'la', 'dos', 'van', 'von'].includes(parts[parts.length - 2].toLowerCase())
  ) {
    return `${initial}. ${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
  }

  const surname = parts[parts.length - 1];
  return `${initial}. ${surname}`;
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

  const setSelectedMatchId = (val: number | null) => {
    if (propSelectedMatchId === undefined) {
      setInternalSelectedMatchId(val);
    }
  };

  const handleSetSelectedMatchId = setSelectedMatchId;

  // Active club theme color
  const teamColor = useMemo(
    () => activeTeam ? getTeamThemeColor(activeTeam.name, activeTeam.primary_color) : '#0284c7',
    [activeTeam]
  );

  // Matches list for the active team & tournament
  const { data: matches, isLoading: isLoadingMatches } = useTeamMatches(
    activeTeam?.team_id,
    tournament
  );

  // Reset match selection when active club or tournament changes
  useEffect(() => {
    handleSetSelectedMatchId(null);
  }, [activeTeam?.team_id, tournament]);

  // Check if selected match belongs to currently loaded matches
  const isMatchValidForTeam = useMemo(() => {
    if (viewMode !== 'match') return true;
    if (!selectedMatchId || !matches) return false;
    return matches.some((m) => m.match_id === selectedMatchId);
  }, [viewMode, matches, selectedMatchId]);

  // Auto-select latest match when entering match mode
  useEffect(() => {
    if (viewMode === 'match' && matches && matches.length > 0) {
      if (!selectedMatchId || !matches.some((m) => m.match_id === selectedMatchId)) {
        handleSetSelectedMatchId(matches[0].match_id);
      }
    }
  }, [viewMode, matches, selectedMatchId]);

  const activeMatch = useMemo(() => {
    if (!matches || !selectedMatchId || !isMatchValidForTeam) return null;
    return matches.find((m) => m.match_id === selectedMatchId) || null;
  }, [matches, selectedMatchId, isMatchValidForTeam]);

  const isQueryEnabled = viewMode === 'cumulative' || (viewMode === 'match' && isMatchValidForTeam);

  // Fetch Defensive Actions data from API
  const { data, isLoading, isError, error, refetch } = useTeamDefensiveActions(
    activeTeam?.team_id,
    tournament,
    viewMode === 'match' ? (isMatchValidForTeam ? selectedMatchId : null) : null,
    venue,
    isQueryEnabled,
    contextFilter
  );

  const isWaitingForMatch = viewMode === 'match' && (!isMatchValidForTeam || isLoadingMatches);
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

  // Horizontal Pitch SVG Canvas Proportions (viewBox="0 0 960 560")
  const SVG_WIDTH = 960;
  const SVG_HEIGHT = 560;
  const PITCH_X = 50;
  const PITCH_Y = 40;
  const PITCH_WIDTH = 860;
  const PITCH_HEIGHT = 440;

  // Visual event de-cluttering:
  // For pitch plotting: omit trivial passive recoveries in the deep defensive third (x <= 25).
  // Active recoveries beyond the defensive box (x > 25) or in opponent half are plotted cleanly.
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

  // Calculate action counts for the displayed events
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

  // Spatial coordinate mapping for Horizontal Pitch (Left to Right):
  // x=0 is own goal line (left), x=100 is opponent goal line (right).
  // y=0 to 100 is lateral touchline to touchline (top to bottom).
  const mappedEvents = useMemo(() => {
    return filteredEvents.map((ev) => {
      const clampedX = Math.max(0, Math.min(100, ev.x));
      const clampedY = Math.max(0, Math.min(100, ev.y));

      const svgX = PITCH_X + (clampedX / 100) * PITCH_WIDTH;
      const svgY = PITCH_Y + (clampedY / 100) * PITCH_HEIGHT;

      return {
        event: ev,
        px: Math.max(PITCH_X + 6, Math.min(PITCH_X + PITCH_WIDTH - 6, svgX)),
        py: Math.max(PITCH_Y + 6, Math.min(PITCH_Y + PITCH_HEIGHT - 6, svgY)),
      };
    });
  }, [filteredEvents]);

  // Visual density scaling: when accumulated events > 150, scale down to 0.78 and apply 0.85 opacity
  const isHighDensity = filteredEvents.length > 150;
  const baseScale = isHighDensity ? 0.78 : 1.0;
  const baseOpacity = isHighDensity ? 0.85 : 0.95;

  // Layer ordering by tactical priority (recoveries/clearances at bottom, tackles/interceptions on top)
  const sortedMappedEvents = useMemo(() => {
    return [...mappedEvents].sort((a, b) => {
      if (hoveredEvent?.event_id === a.event.event_id) return 1;
      if (hoveredEvent?.event_id === b.event.event_id) return -1;
      return (LAYER_PRIORITY[a.event.type] || 0) - (LAYER_PRIORITY[b.event.type] || 0);
    });
  }, [mappedEvents, hoveredEvent]);

  // Block Height vertical line X coordinate (crossing top to bottom)
  const blockHeightLineX = useMemo(() => {
    const clampedPct = Math.max(0, Math.min(100, blockHeightPct));
    return PITCH_X + (clampedPct / 100) * PITCH_WIDTH;
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
      const scopeLabel = viewMode === 'match' && activeMatch ? `m${activeMatch.match_id}` : tournament;
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
              {viewMode === 'match' && activeMatch
                ? activeMatch.label
                : tournament === 'all'
                ? 'Torneo Completo 2026'
                : `Torneo ${tournament}`}
              {' '}• Altura de Presión: {blockHeightM}m ({blockHeightPct.toFixed(1)}%) • {blockClassification}
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
            {viewMode === 'match' && (
              <div className="relative inline-flex items-center">
                <select
                  value={selectedMatchId || ''}
                  onChange={(e) => setSelectedMatchId(Number(e.target.value))}
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
              {viewMode === 'match'
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
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full h-auto overflow-visible select-none rounded-lg"
            >
              <defs>
                <filter id="defPillShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.18" />
                </filter>
                <filter id="defDotHalo" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#0f172a" floodOpacity="0.25" />
                </filter>
              </defs>

              {/* Pitch Canvas Background (Warm Ivory) */}
              <rect
                x={PITCH_X}
                y={PITCH_Y}
                width={PITCH_WIDTH}
                height={PITCH_HEIGHT}
                fill="#FAF8F5"
                stroke="#4A3525"
                strokeWidth={1.8}
                rx={4}
              />

              {/* Halfway Line */}
              <line
                x1={PITCH_X + PITCH_WIDTH / 2}
                y1={PITCH_Y}
                x2={PITCH_X + PITCH_WIDTH / 2}
                y2={PITCH_Y + PITCH_HEIGHT}
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Center Circle & Spot */}
              <circle
                cx={PITCH_X + PITCH_WIDTH / 2}
                cy={PITCH_Y + PITCH_HEIGHT / 2}
                r={65}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />
              <circle
                cx={PITCH_X + PITCH_WIDTH / 2}
                cy={PITCH_Y + PITCH_HEIGHT / 2}
                r={3}
                fill="#4A3525"
              />

              {/* Left Penalty Area (Own 18-yard box: depth=135, height=261, y=129.5) */}
              <rect
                x={PITCH_X}
                y={129.5}
                width={135}
                height={261}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Left 6-yard Goal Area (depth=45, height=118.5, y=200.75) */}
              <rect
                x={PITCH_X}
                y={200.75}
                width={45}
                height={118.5}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Left Penalty Spot & Arc (D) */}
              <circle cx={140} cy={260} r={2.8} fill="#4A3525" />
              <path
                d="M 185 213.1 A 65 65 0 0 1 185 306.9"
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Left Goal Mouth */}
              <rect
                x={PITCH_X - 12}
                y={228}
                width={12}
                height={64}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Right Penalty Area (Opponent 18-yard box) */}
              <rect
                x={PITCH_X + PITCH_WIDTH - 135}
                y={129.5}
                width={135}
                height={261}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Right 6-yard Goal Area */}
              <rect
                x={PITCH_X + PITCH_WIDTH - 45}
                y={200.75}
                width={45}
                height={118.5}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Right Penalty Spot & Arc (D) */}
              <circle cx={820} cy={260} r={2.8} fill="#4A3525" />
              <path
                d="M 775 213.1 A 65 65 0 0 0 775 306.9"
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Right Goal Mouth */}
              <rect
                x={PITCH_X + PITCH_WIDTH}
                y={228}
                width={12}
                height={64}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Corner Arcs */}
              <path
                d={`M ${PITCH_X} ${PITCH_Y + 10} A 10 10 0 0 0 ${PITCH_X + 10} ${PITCH_Y}`}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />
              <path
                d={`M ${PITCH_X} ${PITCH_Y + PITCH_HEIGHT - 10} A 10 10 0 0 1 ${PITCH_X + 10} ${PITCH_Y + PITCH_HEIGHT}`}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />
              <path
                d={`M ${PITCH_X + PITCH_WIDTH - 10} ${PITCH_Y} A 10 10 0 0 0 ${PITCH_X + PITCH_WIDTH} ${PITCH_Y + 10}`}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />
              <path
                d={`M ${PITCH_X + PITCH_WIDTH - 10} ${PITCH_Y + PITCH_HEIGHT} A 10 10 0 0 1 ${PITCH_X + PITCH_WIDTH} ${PITCH_Y + PITCH_HEIGHT - 10}`}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />

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
                      {/* Generous Transparent Hitbox for effortless hover */}
                      <circle cx={px} cy={py} r={Math.max(8, 10 * markerScale)} fill="transparent" />

                      {/* Halo glow on hover */}
                      {isHovered && (
                        <circle
                          cx={px}
                          cy={py}
                          r={10 * markerScale}
                          fill={config.color}
                          fillOpacity={0.3}
                        />
                      )}

                      {/* Pure Geometric Shape Marker */}
                      {renderDefensiveShape(event.type, px, py, markerScale, isHovered)}
                    </g>
                  );
                })}
              </g>

              {/* Line of Engagement (Solid Gold Line crossing top to bottom sideline) */}
              {blockHeightPct > 0 && (
                <g className="transition-all duration-300">
                  {/* Solid Gold Line crossing pitch vertically */}
                  <line
                    x1={blockHeightLineX}
                    y1={PITCH_Y}
                    x2={blockHeightLineX}
                    y2={PITCH_Y + PITCH_HEIGHT}
                    stroke="#D4A344"
                    strokeWidth={2.5}
                  />

                  {/* Indicator tick below bottom sideline */}
                  <line
                    x1={blockHeightLineX}
                    y1={PITCH_Y + PITCH_HEIGHT}
                    x2={blockHeightLineX}
                    y2={PITCH_Y + PITCH_HEIGHT + 6}
                    stroke="#D4A344"
                    strokeWidth={2.5}
                  />

                  {/* Precision Label below the pitch border */}
                  <text
                    x={blockHeightLineX}
                    y={PITCH_Y + PITCH_HEIGHT + 20}
                    textAnchor="middle"
                    className="text-xs font-semibold fill-[#4A3525] select-none"
                  >
                    {blockHeightPct.toFixed(1)}% up the pitch
                  </text>
                </g>
              )}

              {/* Floating Ivory Boxed Legend (Bottom-Right corner inside pitch, no sideline collision) */}
              <g className="select-none pointer-events-none">
                <rect
                  x={690}
                  y={384}
                  width={208}
                  height={82}
                  rx={5}
                  fill="#FAF8F5"
                  fillOpacity={0.96}
                  stroke="#4A3525"
                  strokeWidth={1}
                />
                <text
                  x={700}
                  y={398}
                  className="text-[8.5px] font-bold fill-[#4A3525] uppercase tracking-wider"
                >
                  Acciones Defensivas
                </text>

                {/* Col 1 */}
                <g transform="translate(706, 413)">
                  <polygon points="0,-3.8 3.8,0 0,3.8 -3.8,0" fill="#93C5FD" stroke="#2563EB" strokeWidth={1.4} />
                  <text x={8} y={3} className="text-[9.5px] font-medium fill-[#4A3525]">Won Tackle</text>
                </g>
                <g transform="translate(706, 429)">
                  <rect x={-3} y={-3} width={6} height={6} fill="#22C55E" stroke="#15803D" strokeWidth={1.4} />
                  <text x={8} y={3} className="text-[9.5px] font-medium fill-[#4A3525]">Interception</text>
                </g>
                <g transform="translate(706, 445)">
                  <polygon points="-3,-2.2 3,-2.2 0,3.2" fill="#F3F4F6" stroke="#6B7280" strokeWidth={1.2} />
                  <text x={8} y={3} className="text-[9.5px] font-medium fill-[#4A3525]">Blocked Pass</text>
                </g>

                {/* Col 2 */}
                <g transform="translate(798, 413)">
                  <circle r={3} fill="#FB923C" stroke="#EA580C" strokeWidth={1.4} />
                  <text x={8} y={3} className="text-[9.5px] font-medium fill-[#4A3525]">Lost Tackle</text>
                </g>
                <g transform="translate(798, 429)">
                  <rect x={-3} y={-3} width={6} height={6} fill="#D1D5DB" fillOpacity={0.6} stroke="#4B5563" strokeWidth={1.4} />
                  <text x={8} y={3} className="text-[9.5px] font-medium fill-[#4A3525]">Clearance</text>
                </g>
                <g transform="translate(798, 445)">
                  <g stroke="#9CA3AF" strokeWidth={1.2} strokeLinecap="round">
                    <line x1={-2.8} y1={-2.8} x2={2.8} y2={2.8} />
                    <line x1={-2.8} y1={2.8} x2={2.8} y2={-2.8} />
                  </g>
                  <text x={8} y={3} className="text-[9.5px] font-medium fill-[#4A3525]">Recovery</text>
                </g>

                {/* Line of Engagement Row */}
                <g transform="translate(700, 458)">
                  <line x1={0} y1={0} x2={16} y2={0} stroke="#D4A344" strokeWidth={2.2} />
                  <text x={22} y={3} className="text-[9px] font-semibold fill-[#4A3525]">
                    Avg Height (excl. clears)
                  </text>
                </g>
              </g>

              {/* 3. Clean Non-Overlapping Editorial Footer Strip */}
              <g className="select-none">
                {/* Left: PPDA and Data Source */}
                <text x={PITCH_X} y={536} className="text-xs font-semibold fill-[#4A3525]">
                  PPDA: {ppdaVal}
                </text>
                <text x={PITCH_X + 85} y={536} className="text-[11px] font-medium fill-[#8C7A6B]">
                  • Liga 1 Scout
                </text>

                {/* Center: Direction of Attack */}
                <text
                  x={PITCH_X + PITCH_WIDTH / 2}
                  y={536}
                  textAnchor="middle"
                  className="text-xs font-semibold fill-[#4A3525] tracking-wider"
                >
                  Direction of Attack ────►
                </text>

                {/* Right: Team Name */}
                <text
                  x={PITCH_X + PITCH_WIDTH}
                  y={536}
                  textAnchor="end"
                  className="text-xs font-semibold fill-[#4A3525]"
                >
                  {activeTeam.name}
                </text>
              </g>
            </svg>

            {/* Interactive Floating Hover Tooltip */}
            {hoveredEvent && tooltipPos && (
              <div
                className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 bg-slate-900/95 text-white rounded-lg shadow-xl px-3 py-2 text-xs backdrop-blur-xs border border-slate-700/80 animate-in fade-in-0 zoom-in-95 duration-100"
                style={{
                  left: tooltipPos.x,
                  top: tooltipPos.y - 8,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  {hoveredEvent.jersey && (
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-300 border border-slate-700">
                      #{hoveredEvent.jersey}
                    </span>
                  )}
                  <span className="font-semibold text-white">
                    {formatPlayerName(hoveredEvent.player_name)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="-6 -6 12 12" className="shrink-0 overflow-visible">
                      {renderDefensiveShape(hoveredEvent.type, 0, 0, 1.1)}
                    </svg>
                    <span className="capitalize">
                      {ACTION_CONFIG[hoveredEvent.type as keyof typeof ACTION_CONFIG]?.singular ||
                        hoveredEvent.type}
                    </span>
                  </div>
                  <span
                    className={
                      hoveredEvent.is_success
                        ? 'text-emerald-400 font-medium'
                        : 'text-rose-400 font-medium'
                    }
                  >
                    {hoveredEvent.type === 'foul'
                      ? 'Cometida'
                      : hoveredEvent.is_success
                      ? 'Exitosa'
                      : 'No exitosa'}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  Ubicación: x={hoveredEvent.x}% • y={hoveredEvent.y}%
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamDefensiveTerritory;
