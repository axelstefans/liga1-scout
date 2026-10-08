import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Compass, Loader2, AlertCircle, RefreshCw, 
  ChevronDown, Copy, Check, Download
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { TeamMetricEntry } from '../../services/api';
import { useTeamAttackZones, useTeamMatches } from '../../hooks/useTeam';

export interface TeamAttackZonesProps {
  teams?: TeamMetricEntry[];
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  mode?: AttackZoneMode;
  viewMode?: ViewMode;
  selectedMatchId?: number | null;
}

type AttackZoneMode = 'for' | 'against';
type ViewMode = 'cumulative' | 'match';

const CHANNEL_CONFIG = [
  { id: 'left_flank', name: 'Banda Izquierda', abbr: 'Banda Izq.' },
  { id: 'left_half_space', name: 'Medio-Espacio Izquierdo', abbr: 'M.E. Izq.' },
  { id: 'center', name: 'Carril Central', abbr: 'Centro' },
  { id: 'right_half_space', name: 'Medio-Espacio Derecho', abbr: 'M.E. Der.' },
  { id: 'right_flank', name: 'Banda Derecha', abbr: 'Banda Der.' },
] as const;

const CHANNEL_NAME_MAP: Record<string, string> = {
  left_flank: 'Banda Izquierda',
  left_half_space: 'Medio-Espacio Izquierdo',
  center: 'Carril Central',
  right_half_space: 'Medio-Espacio Derecho',
  right_flank: 'Banda Derecha',
};

// Canvas geometry constants
const SVG_WIDTH = 540;
const SVG_HEIGHT = 500;
const PITCH_X = 45;
const PITCH_Y = 40;
const PITCH_WIDTH = 450;
const PITCH_HEIGHT = 410;
const MIDFIELD_Y = PITCH_Y + PITCH_HEIGHT; // 450
const FINAL_THIRD_Y = PITCH_Y + 287; // 327 (depth: 287px, corresponding to x >= 65%)
const LANE_WIDTH = PITCH_WIDTH / 5; // 90px

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

export const TeamAttackZones: React.FC<TeamAttackZonesProps> = ({
  activeTeam,
  tournament = 'Clausura',
  mode: propMode,
  viewMode: propViewMode,
  selectedMatchId: propSelectedMatchId,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const [internalMode, setInternalMode] = useState<AttackZoneMode>('for');
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('cumulative');
  const [internalSelectedMatchId, setInternalSelectedMatchId] = useState<number | null>(null);

  const mode = propMode ?? internalMode;
  const viewMode = propViewMode ?? internalViewMode;
  const selectedMatchId = propSelectedMatchId !== undefined ? propSelectedMatchId : internalSelectedMatchId;
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);
  const [lockedChannel, setLockedChannel] = useState<string | null>(null);
  const [tooltipCoords, setTooltipCoords] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleSetSelectedMatchId = (val: number | null) => {
    if (propSelectedMatchId === undefined) {
      setInternalSelectedMatchId(val);
    }
  };

  // Fetch match list for the team
  const { data: matches, isLoading: isLoadingMatches } = useTeamMatches(
    activeTeam?.team_id,
    tournament
  );

  // Reset match selection when club or tournament changes
  useEffect(() => {
    handleSetSelectedMatchId(null);
    setHoveredChannel(null);
    setLockedChannel(null);
  }, [activeTeam?.team_id, tournament]);

  // Check if selected match is valid
  const isMatchValidForTeam = useMemo(() => {
    if (viewMode !== 'match') return true;
    if (!selectedMatchId || !matches) return false;
    return matches.some((m) => m.match_id === selectedMatchId);
  }, [viewMode, matches, selectedMatchId]);

  // Auto-select latest match when switching to match mode
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

  // Fetch Attack Zones data
  const { data, isLoading, isError, error, refetch } = useTeamAttackZones(
    activeTeam?.team_id,
    tournament,
    viewMode === 'match' ? (isMatchValidForTeam ? selectedMatchId : null) : null,
    mode,
    isQueryEnabled
  );

  const showLoading = isLoading || (viewMode === 'match' && (!isMatchValidForTeam || isLoadingMatches));

  const summary = data?.summary || {
    total_entries: 0,
    box_entries_total: 0,
    box_entry_conversion_pct: 0,
    dominant_channel: 'center',
    most_dangerous_channel: 'center',
  };

  const channels = data?.channels || [];

  // Channel lookup map
  const channelDataMap = useMemo(() => {
    const map = new Map<string, typeof channels[0]>();
    channels.forEach((c) => map.set(c.channel_id, c));
    return map;
  }, [channels]);

  const dominantChannelName = CHANNEL_NAME_MAP[summary.dominant_channel] || summary.dominant_channel;
  const mostDangerousChannelName = CHANNEL_NAME_MAP[summary.most_dangerous_channel] || summary.most_dangerous_channel;
  const maxThreatXg = (channelDataMap.get(summary.most_dangerous_channel)?.threat_xg ?? 0).toFixed(2);

  // Maximum share for dynamic coropleth heatmap scaling
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

  // Handle Mouse Movement for Tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGGElement>, channelId: string) => {
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

  const handleChannelClick = (channelId: string) => {
    setLockedChannel((prev) => (prev === channelId ? null : channelId));
  };

  // Structured summary export for ML / LLM ingestion
  const handleCopySummary = async () => {
    const isCumulative = viewMode === 'cumulative';
    const matchesCount = activeTeam.matches_played;
    const dominantName = CHANNEL_NAME_MAP[summary.dominant_channel] || summary.dominant_channel;
    const dangerousName = CHANNEL_NAME_MAP[summary.most_dangerous_channel] || summary.most_dangerous_channel;

    const channelRows = CHANNEL_CONFIG.map((cfg) => {
      const c = channelDataMap.get(cfg.id) || {
        share_pct: 0,
        entries_count: 0,
        box_infiltrations: 0,
        threat_xg: 0,
        threat_pct: 0,
        top_players: [],
      };
      const prefix = mode === 'for' ? 'xG' : 'xGA';
      return `- ${cfg.name}: ${c.share_pct}% vol (${c.entries_count} ent, ${c.box_infiltrations} al área) | ${prefix} ${c.threat_xg.toFixed(2)} (${c.threat_pct}%)`;
    }).join('\n');

    const topPlayersSummary = CHANNEL_CONFIG.map((cfg) => {
      const c = channelDataMap.get(cfg.id);
      const players = c?.top_players && c.top_players.length > 0
        ? c.top_players.map((p) => `${formatPlayerName(p.name)} (${p.actions_count} act.)`).join(', ')
        : 'Sin datos';
      return `${cfg.abbr}: ${players}`;
    }).join(' | ');

    const scopeHeader = isCumulative
      ? `Alcance: ${tournament === 'all' ? 'Temporada Completa 2026' : tournament + ' 2026'} | Muestra: ${matchesCount} PJ`
      : activeMatch
      ? `Partido: ${activeMatch.label} | ${activeMatch.is_home ? 'Local' : 'Visita'} | ${activeMatch.team_score ?? '-'}-${activeMatch.opponent_score ?? '-'} | Rival: ${activeMatch.opponent_name}`
      : 'Partido: Individual';

    const dangerousLabel = mode === 'for' ? 'Más Peligroso' : 'Más Vulnerable';

    const lines = [
      `CANALES DE ATAQUE E INFILTRACIÓN | ${mode === 'for' ? `A FAVOR (ataque de ${activeTeam.name})` : `CONCEDIDOS (incursiones rivales contra ${activeTeam.name})`}`,
      scopeHeader,
      `Volumen Total: ${summary.total_entries} entradas | ${summary.box_entries_total} al área (${summary.box_entry_conversion_pct}% efectividad)`,
      `Carril Dominante: ${dominantName} | Carril ${dangerousLabel}: ${dangerousName}`,
      `Desglose por Carriles:\n${channelRows}`,
      `Principales Actores por Carril: ${topPlayersSummary}`,
    ];

    if (!isCumulative) {
      lines.push('Nota: datos de un solo partido, evaluar tendencias en muestra acumulada.');
    }

    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error('Failed to copy attack zones summary', err);
    }
  };

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
          {/* Title Header */}
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-slate-700" />
              Zonas de Ataque e Infiltración
            </h3>
            <span className="text-xs text-slate-400 font-normal">
              • {mode === 'for' ? 'Ofensivo (A Favor)' : 'Defensivo (Concedidos)'}
            </span>
          </div>

          {/* Controls: Mode Toggle & Scope Toggle */}
          <div className="flex flex-wrap items-center gap-2 export-ignore">
            {/* Perspective Toggle: A Favor / Concedidos */}
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

            {/* Scope Toggle: Acumulado / Por Partido */}
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

            {/* Fixture Selector Dropdown */}
            {viewMode === 'match' && (
              <div className="relative inline-flex items-center">
                <select
                  value={selectedMatchId || ''}
                  onChange={(e) => setSelectedMatchId(Number(e.target.value))}
                  disabled={isLoadingMatches || !matches || matches.length === 0}
                  className="appearance-none pl-2.5 pr-7 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-800 shadow-xs hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer min-w-[180px] max-w-[280px] truncate"
                >
                  {!matches || matches.length === 0 ? (
                    <option value="">No hay partidos</option>
                  ) : (
                    matches.map((m) => {
                      const roundPrefix = m.round ? `F${m.round} ` : '';
                      const venue = m.is_home ? 'Local' : 'Visita';
                      const score =
                        m.team_score !== null &&
                        m.team_score !== undefined &&
                        m.opponent_score !== null &&
                        m.opponent_score !== undefined
                          ? ` · ${m.team_score}-${m.opponent_score}`
                          : '';
                      const label = `${roundPrefix}vs ${m.opponent_name} · ${venue}${score}`;
                      return (
                        <option key={m.match_id} value={m.match_id}>
                          {label}
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 pt-2">
          {/* KPI 1: Total Entradas */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 tracking-tight">
              {mode === 'for' ? 'Total Entradas' : 'Incursiones Recibidas'}
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-slate-900 tracking-tight">
                {summary.total_entries}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">acc.</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 truncate">
              Último tercio o área
            </span>
          </div>

          {/* KPI 2: Entradas al Área */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 tracking-tight">
              {mode === 'for' ? 'Entradas al Área' : 'Llegadas Concedidas'}
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-slate-900 tracking-tight">
                {summary.box_entries_total}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">al área</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 truncate">
              Infiltraciones en el área de 18m
            </span>
          </div>

          {/* KPI 3: % Infiltración al Área */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 tracking-tight">
              % Infiltración al Área
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-amber-700 tracking-tight">
                {summary.box_entry_conversion_pct}%
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 truncate">
              Conversión a penetración
            </span>
          </div>

          {/* KPI 4: Carril Dominante */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 tracking-tight">
              {mode === 'for' ? 'Carril Dominante' : 'Vía Más Frecuente'}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-sm font-black text-slate-900 tracking-tight truncate">
                {dominantChannelName}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 truncate">
              {mode === 'for' ? 'Mayor volumen ofensivo' : 'Mayor volumen rival'}
            </span>
          </div>

          {/* KPI 5: Mayor Peligro / Sector Más Vulnerable */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 flex flex-col justify-between col-span-2 md:col-span-1">
            <span className="text-[11px] font-semibold text-slate-500 tracking-tight">
              {mode === 'for' ? 'Mayor Peligro' : 'Sector Más Vulnerable'}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-sm font-black text-slate-900 tracking-tight truncate">
                {mostDangerousChannelName}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 truncate">
              {mode === 'for' ? `${maxThreatXg} xG generado` : `${maxThreatXg} xGA recibido`}
            </span>
          </div>
        </div>
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
              {viewMode === 'match'
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
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full h-auto overflow-visible select-none rounded-lg"
            >
              <defs>
                {/* Subtle drop shadow for dominant lane badge */}
                <filter id="dominantBadgeShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.12" />
                </filter>
              </defs>

              {/* Pitch Canvas Background (Warm Ivory: #FAF8F5, stroke: #4A3525) */}
              <rect
                x={PITCH_X}
                y={PITCH_Y}
                width={PITCH_WIDTH}
                height={PITCH_HEIGHT}
                fill="#FAF8F5"
                stroke="#4A3525"
                strokeWidth={1.5}
                rx={4}
              />

              {/* 5 Tactical Channels Heatmap Fill (Final Third: x >= 65% to 100%, svgY: 40 to 327) */}
              {CHANNEL_CONFIG.map((cfg, idx) => {
                const laneX = PITCH_X + idx * LANE_WIDTH;
                const chData = channelDataMap.get(cfg.id);
                const sharePct = chData?.share_pct ?? 0;
                const baseOpacity = 0.06 + (sharePct / maxShare) * 0.38;
                const isHovered = activeChannelId === cfg.id;
                const fillOpacity = isHovered ? Math.min(0.70, baseOpacity + 0.18) : baseOpacity;
                const isDominant = cfg.id === summary.dominant_channel;

                return (
                  <g 
                    key={`channel-fill-${cfg.id}`}
                    className="cursor-pointer transition-all"
                    onMouseMove={(e) => handleMouseMove(e, cfg.id)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleChannelClick(cfg.id)}
                  >
                    {/* Heated lane background */}
                    <rect
                      x={laneX}
                      y={PITCH_Y}
                      width={LANE_WIDTH}
                      height={FINAL_THIRD_Y - PITCH_Y}
                      fill="#C2410C"
                      fillOpacity={fillOpacity}
                    />

                    {/* Dominant Channel outline */}
                    {isDominant && !isHovered && (
                      <rect
                        x={laneX}
                        y={PITCH_Y}
                        width={LANE_WIDTH}
                        height={FINAL_THIRD_Y - PITCH_Y}
                        fill="none"
                        stroke="#C2410C"
                        strokeWidth={1.5}
                        strokeOpacity={0.65}
                      />
                    )}

                    {/* Hovered/Selected Accent Border */}
                    {isHovered && (
                      <rect
                        x={laneX}
                        y={PITCH_Y}
                        width={LANE_WIDTH}
                        height={FINAL_THIRD_Y - PITCH_Y}
                        fill="none"
                        stroke="#C2410C"
                        strokeWidth={2.5}
                      />
                    )}
                  </g>
                );
              })}

              {/* Final Third Boundary Line (Horizontal dashed line at y=327) */}
              <line
                x1={PITCH_X}
                y1={FINAL_THIRD_Y}
                x2={PITCH_X + PITCH_WIDTH}
                y2={FINAL_THIRD_Y}
                stroke="#4A3525"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                strokeOpacity={0.65}
                pointerEvents="none"
              />

              {/* Final Third Label */}
              <text
                x={PITCH_X + 8}
                y={FINAL_THIRD_Y + 14}
                className="text-[9px] font-bold fill-[#4A3525]/60 uppercase tracking-widest pointer-events-none"
              >
                Último Tercio (x ≥ 65%)
              </text>

              {/* 4 Vertical Dashed Lines dividing pitch into 5 tactical lanes */}
              {[1, 2, 3, 4].map((idx) => {
                const lineX = PITCH_X + idx * LANE_WIDTH;
                return (
                  <line
                    key={`lane-divider-${idx}`}
                    x1={lineX}
                    y1={PITCH_Y}
                    x2={lineX}
                    y2={MIDFIELD_Y}
                    stroke="#4A3525"
                    strokeWidth={1.2}
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                    pointerEvents="none"
                  />
                );
              })}

              {/* Standard Pitch Markings */}
              {/* Midfield Line (Bottom Boundary: y=450) */}
              <line
                x1={PITCH_X}
                y1={MIDFIELD_Y}
                x2={PITCH_X + PITCH_WIDTH}
                y2={MIDFIELD_Y}
                stroke="#4A3525"
                strokeWidth={1.5}
                pointerEvents="none"
              />

              {/* Center Circle Arc (radius=72px curving upwards from bottom midfield) */}
              <path
                d="M 198 450 A 72 72 0 0 1 342 450"
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
                pointerEvents="none"
              />
              {/* Center Spot */}
              <circle cx={270} cy={MIDFIELD_Y} r={3} fill="#4A3525" pointerEvents="none" />

              {/* Attacking 18-yard Box (At Top: x=136.6, y=40, width=266.8, height=135.3) */}
              <rect
                x={136.6}
                y={PITCH_Y}
                width={266.8}
                height={135.3}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
                pointerEvents="none"
              />

              {/* Attacking 6-yard Box (At Top: x=209.4, y=40, width=121.2, height=45.1) */}
              <rect
                x={209.4}
                y={PITCH_Y}
                width={121.2}
                height={45.1}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
                pointerEvents="none"
              />

              {/* Penalty Spot (11m, y=125.9) */}
              <circle cx={270} cy={125.9} r={2.8} fill="#4A3525" pointerEvents="none" />

              {/* Penalty Arc (D) (Circle radius=72px extending downwards from y=175.3) */}
              <path
                d="M 216 175.3 A 72 72 0 0 0 324 175.3"
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
                pointerEvents="none"
              />

              {/* Goal Mouth (Top Edge: x=245.75, y=26, width=48.5, height=14) */}
              <rect
                x={245.75}
                y={26}
                width={48.5}
                height={14}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
                pointerEvents="none"
              />

              {/* Corner Arcs (Top Left & Top Right) */}
              <path
                d="M 45 50 A 10 10 0 0 1 55 40"
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
                pointerEvents="none"
              />
              <path
                d="M 485 40 A 10 10 0 0 1 495 50"
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
                pointerEvents="none"
              />

              {/* In-Pitch Channel Labels, Percentages & Threat Badges */}
              {CHANNEL_CONFIG.map((cfg, idx) => {
                const centerX = PITCH_X + idx * LANE_WIDTH + LANE_WIDTH / 2;
                const chData = channelDataMap.get(cfg.id);
                const sharePct = chData?.share_pct ?? 0;
                const entriesCount = chData?.entries_count ?? 0;
                const boxCount = chData?.box_infiltrations ?? 0;
                const threatXg = chData?.threat_xg ?? 0;
                const threatPct = chData?.threat_pct ?? 0;
                const isDominant = cfg.id === summary.dominant_channel;

                return (
                  <g 
                    key={`channel-labels-${cfg.id}`}
                    pointerEvents="none"
                  >
                    {/* Dominant Channel Highlight Badge */}
                    {isDominant && (
                      <g filter="url(#dominantBadgeShadow)">
                        <rect
                          x={centerX - 35}
                          y={196}
                          width={70}
                          height={15}
                          rx={7.5}
                          fill="#C2410C"
                        />
                        <text
                          x={centerX}
                          y={207}
                          textAnchor="middle"
                          className="text-[9px] font-black fill-white tracking-wider"
                        >
                          DOMINANTE
                        </text>
                      </g>
                    )}

                    {/* Channel Title (Abbreviation) */}
                    <text
                      x={centerX}
                      y={isDominant ? 224 : 214}
                      textAnchor="middle"
                      className="text-[11px] font-bold fill-[#4A3525]/85 tracking-tight"
                    >
                      {cfg.abbr}
                    </text>

                    {/* Big Bold Percentage */}
                    <text
                      x={centerX}
                      y={244}
                      textAnchor="middle"
                      className="text-[19px] font-extrabold fill-[#4A3525] tracking-tight"
                    >
                      {sharePct}%
                    </text>

                    {/* Sub-label: 2-line layout preventing lane collisions */}
                    <text
                      x={centerX}
                      y={262}
                      textAnchor="middle"
                      className="font-semibold select-none"
                    >
                      <tspan x={centerX} dy="0" fontSize="10" fill="#78350F">
                        {entriesCount} entradas
                      </tspan>
                      <tspan x={centerX} dy="12" fontSize="9.5" fill="#92400E">
                        {boxCount} al área
                      </tspan>
                    </text>

                    {/* In-Pitch Threat Indicator Pill: {xG/xGA} {threat_xg} ({threat_pct}%) */}
                    <g>
                      <rect
                        x={centerX - 39}
                        y={292}
                        width={78}
                        height={17}
                        rx={4}
                        fill="#3D2817"
                      />
                      <text
                        x={centerX}
                        y={304}
                        textAnchor="middle"
                        className="text-[9.5px] font-bold fill-white tracking-tight"
                      >
                        {mode === 'for' ? 'xG' : 'xGA'} {threatXg.toFixed(2)} ({threatPct}%)
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>

            {/* Floating Interactive Hover Tooltip */}
            {activeChannelData && activeChannelConfig && tooltipCoords && (
              <div
                style={{
                  left: Math.max(12, Math.min(tooltipCoords.x - 110, 310)),
                  top: Math.max(12, tooltipCoords.y - 120),
                }}
                className="absolute pointer-events-none z-30 w-64 bg-slate-900/95 backdrop-blur-xs text-white rounded-xl shadow-xl p-3 border border-slate-700/80 text-xs transition-all animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-800">
                  <span className="font-bold text-slate-100 text-xs">
                    {activeChannelConfig.name}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {activeChannelData.share_pct}% vol
                  </span>
                </div>

                {/* Metrics */}
                <div className="mt-2 flex flex-col gap-1 text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Incursiones:</span>
                    <span className="font-semibold text-slate-100">
                      {activeChannelData.entries_count} ent. ({activeChannelData.box_infiltrations} al área)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Efectividad al área:</span>
                    <span className="font-semibold text-amber-400">
                      {activeChannelData.entries_count > 0
                        ? ((activeChannelData.box_infiltrations / activeChannelData.entries_count) * 100).toFixed(1)
                        : '0.0'}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      {mode === 'for' ? 'Peligro Generado:' : 'Peligro Concedido:'}
                    </span>
                    <span className="font-semibold text-slate-100">
                      {activeChannelData.threat_xg.toFixed(2)} xG ({activeChannelData.threat_pct}%)
                    </span>
                  </div>
                </div>

                {/* Top Protagonistas */}
                <div className="mt-2 pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Top Protagonistas
                  </span>
                  {activeChannelData.top_players && activeChannelData.top_players.length > 0 ? (
                    <div className="space-y-1">
                      {activeChannelData.top_players.map((p, idx) => (
                        <div key={`${p.name}-${idx}`} className="flex justify-between text-[11px]">
                          <span className="text-slate-200 truncate max-w-[140px] font-medium">
                            {formatPlayerName(p.name)}
                          </span>
                          <span className="text-amber-400 font-bold">{p.actions_count} act.</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 italic">
                      Sin registros individuales suficientes
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Bottom Editorial Strip & Action Buttons */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        {/* Left: Branding */}
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-semibold text-slate-700 tracking-tight">
            Liga 1 Scout | Datos Oficiales
          </span>
        </div>

        {/* Center: Direction of Play */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200/80">
          <span>Dirección de Ataque</span>
          <span className="text-amber-600 font-black">↑</span>
        </div>

        {/* Right: Export & Copy Buttons */}
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
