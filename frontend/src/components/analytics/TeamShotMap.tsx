import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Download, Loader2, AlertCircle, RefreshCw, 
  Target 
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { TeamMetricEntry, ShotItem, VenueFilter, ContextFilter } from '../../services/api';
import { useTeamShotMap, useTeamMatches } from '../../hooks/useTeam';

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

type ShotMode = 'for' | 'against';
type ResultFilterType = 'all' | 'goal' | 'saved' | 'blocked' | 'miss';

const RESULT_CONFIG: Record<
  string,
  {
    label: string;
    singular: string;
    fill: string;
    stroke: string;
    strokeWidth: number;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  goal: {
    label: 'Goles',
    singular: 'Gol',
    fill: '#10B981',
    stroke: '#065F46',
    strokeWidth: 2.5,
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
  },
  saved: {
    label: 'Atajados',
    singular: 'Atajado',
    fill: '#3B82F6',
    stroke: '#1D4ED8',
    strokeWidth: 1.5,
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
  },
  miss: {
    label: 'Desviados',
    singular: 'Desviado (Fuera)',
    fill: 'none',
    stroke: '#EF4444',
    strokeWidth: 1.8,
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
  },
  blocked: {
    label: 'Bloqueados',
    singular: 'Bloqueado',
    fill: '#94A3B8',
    stroke: '#475569',
    strokeWidth: 1.2,
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300',
  },
};

const SITUATION_LABELS: Record<string, string> = {
  open_play: 'Jugada abierta',
  set_piece: 'Balón parado',
  corner: 'Tiro de esquina',
  penalty: 'Penal',
  fast_break: 'Contraataque',
};

const BODY_PART_LABELS: Record<string, string> = {
  right_foot: 'Pie derecho',
  left_foot: 'Pie izquierdo',
  head: 'Cabeza',
  other: 'Otro',
};

const SHOT_LAYER_PRIORITY: Record<string, number> = {
  blocked: 1,
  miss: 2,
  saved: 3,
  goal: 4,
};

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

function roundDecimals(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Calculates bubble radius proportional to xG with adaptive density:
 * - Single fixture: standard scale (4.0 to 17px)
 * - Cumulative tournament (>80 shots): scaled down (3.5 to 11px) to prevent clutter
 * - Minimum radius is 3.5px so low-xG events don't disappear
 */
function getShotRadius(xg: number, isCumulative: boolean): number {
  return isCumulative
    ? Math.max(3.5, Math.min(11, Math.sqrt(Math.max(0, xg)) * 16))
    : Math.max(4.0, Math.min(17, Math.sqrt(Math.max(0, xg)) * 24));
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
  const [tooltipPos, setTooltipPos] = useState<{
    x: number;
    y: number;
    yBottom: number;
    svgX: number;
    svgY: number;
  } | null>(null);

  const mode = propMode ?? internalMode;
  const viewMode = propViewMode ?? internalViewMode;
  const selectedMatchId = propSelectedMatchId !== undefined ? propSelectedMatchId : internalSelectedMatchId;
  const selectedPlayer = propSelectedPlayer ?? internalSelectedPlayer;

  // Helper setters that safely update state when uncontrolled
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

  // Matches list for the active team & tournament
  const { data: matches, isLoading: isLoadingMatches } = useTeamMatches(
    activeTeam?.team_id,
    tournament
  );

  // Reset match & player selection when active club or tournament changes
  useEffect(() => {
    handleSetSelectedMatchId(null);
    handleSetSelectedPlayer('all');
  }, [activeTeam?.team_id, tournament]);

  // Reset player filter when mode or match changes
  useEffect(() => {
    handleSetSelectedPlayer('all');
  }, [mode, selectedMatchId]);

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

  // Fetch Shot Map data from API
  const { data, isLoading, isError, error, refetch } = useTeamShotMap(
    activeTeam?.team_id,
    tournament,
    viewMode === 'match' ? (isMatchValidForTeam ? selectedMatchId : null) : null,
    mode,
    venue,
    isQueryEnabled,
    contextFilter
  );

  const isWaitingForMatch = viewMode === 'match' && (!isMatchValidForTeam || isLoadingMatches);
  const showLoading = isLoading || isWaitingForMatch;

  const rawShots = data?.shots || [];

  // 1. Filter shots by selected player
  const playerShots = useMemo(() => {
    if (selectedPlayer === 'all') return rawShots;
    return rawShots.filter((s) => s.player_name === selectedPlayer);
  }, [rawShots, selectedPlayer]);

  // 2. Filter shots by result filter
  const filteredShots = useMemo(() => {
    if (resultFilter === 'all') return playerShots;
    if (resultFilter === 'goal') return playerShots.filter((s) => s.result === 'goal');
    if (resultFilter === 'saved') return playerShots.filter((s) => s.result === 'saved');
    if (resultFilter === 'blocked') return playerShots.filter((s) => s.result === 'blocked');
    if (resultFilter === 'miss') return playerShots.filter((s) => s.result === 'miss');
    return playerShots;
  }, [playerShots, resultFilter]);

  // Reactive KPI summary (recalculated when player filter is applied)
  const activeSummary = useMemo(() => {
    if (selectedPlayer === 'all') {
      const summary = data?.summary || {
        total_shots: 0,
        goals: 0,
        total_xg: 0,
        xg_per_shot: 0,
        shots_on_target: 0,
        on_target_pct: 0,
        xg_difference: 0,
        shots_per_match: 0,
        xg_per_match: 0,
      };
      return summary;
    }
    const total_shots = playerShots.length;
    const goals = playerShots.filter((s) => s.result === 'goal').length;
    const total_xg = roundDecimals(playerShots.reduce((acc, s) => acc + s.xg, 0), 2);
    const xg_per_shot = total_shots > 0 ? roundDecimals(total_xg / total_shots, 2) : 0;
    const shots_on_target = playerShots.filter((s) => s.result === 'goal' || s.result === 'saved').length;
    const on_target_pct = total_shots > 0 ? roundDecimals((shots_on_target / total_shots) * 100, 1) : 0;
    const xg_difference = roundDecimals(goals - total_xg, 2);

    // For player-filtered view in cumulative mode, derive per-match using matches length or activeTeam matches
    const matchesCount = matches?.length || activeTeam?.matches_played || 1;
    const shots_per_match = roundDecimals(total_shots / matchesCount, 1);
    const xg_per_match = roundDecimals(total_xg / matchesCount, 2);

    return {
      total_shots,
      goals,
      total_xg,
      xg_per_shot,
      shots_on_target,
      on_target_pct,
      xg_difference,
      shots_per_match,
      xg_per_match,
    };
  }, [selectedPlayer, playerShots, data?.summary, matches?.length, activeTeam?.matches_played]);

  // Counts for pills
  const counts = useMemo(() => {
    return {
      all: playerShots.length,
      goal: playerShots.filter((s) => s.result === 'goal').length,
      saved: playerShots.filter((s) => s.result === 'saved').length,
      blocked: playerShots.filter((s) => s.result === 'blocked').length,
      miss: playerShots.filter((s) => s.result === 'miss').length,
    };
  }, [playerShots]);

  // Adaptive density: enabled when displaying high volumes of cumulative shots (> 80)
  const isCumulative = rawShots.length > 80;

  // Vertical Attacking Half Pitch SVG Canvas Proportions (viewBox="0 0 540 480")
  // Direction of Play: Upwards ↑ (Midfield at Bottom, Goal at Top)
  const SVG_WIDTH = 540;
  const SVG_HEIGHT = 480;
  const PITCH_X = 45;
  const PITCH_Y = 35;
  const PITCH_WIDTH = 450;
  const PITCH_HEIGHT = 380;

  // Spatial coordinate mapping for Vertical Attacking Pitch:
  // x=100 is target goal line at Top (svgY = PITCH_Y)
  // x=50 is midfield line at Bottom (svgY = PITCH_Y + PITCH_HEIGHT)
  // y=0 is left flank (viewer left, svgX = PITCH_X)
  // y=100 is right flank (viewer right, svgX = PITCH_X + PITCH_WIDTH)
  const mappedShots = useMemo(() => {
    const list = filteredShots.map((shot) => {
      const clampedX = Math.max(48, Math.min(100, shot.x));
      const clampedY = Math.max(0, Math.min(100, shot.y));

      const svgX = PITCH_X + (clampedY / 100) * PITCH_WIDTH;
      const svgY = PITCH_Y + ((100 - clampedX) / 50) * PITCH_HEIGHT;
      const radius = getShotRadius(shot.xg, isCumulative);

      return {
        shot,
        px: Math.max(PITCH_X + radius, Math.min(PITCH_X + PITCH_WIDTH - radius, svgX)),
        py: Math.max(PITCH_Y + radius, Math.min(PITCH_Y + PITCH_HEIGHT - radius, svgY)),
        radius,
      };
    });

    // Goal marker jitter / anti-collision:
    // When two goals overlap (distance < 8px), apply a subtle perpendicular 3px visual offset so both emerald halos remain visible.
    const goalIndices: number[] = [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].shot.result === 'goal') {
        goalIndices.push(i);
      }
    }

    for (let i = 0; i < goalIndices.length; i++) {
      for (let j = i + 1; j < goalIndices.length; j++) {
        const idx1 = goalIndices[i];
        const idx2 = goalIndices[j];
        const g1 = list[idx1];
        const g2 = list[idx2];
        const dx = g2.px - g1.px;
        const dy = g2.py - g1.py;
        const dist = Math.hypot(dx, dy);

        if (dist < 8) {
          const angle = dist > 0.001 ? Math.atan2(dy, dx) : (Math.PI / 4) * (i + 1);
          const perpAngle = angle + Math.PI / 2;
          const offset = 3;

          list[idx1] = {
            ...g1,
            px: g1.px - Math.cos(perpAngle) * (offset / 2),
            py: g1.py - Math.sin(perpAngle) * (offset / 2),
          };
          list[idx2] = {
            ...g2,
            px: g2.px + Math.cos(perpAngle) * (offset / 2),
            py: g2.py + Math.sin(perpAngle) * (offset / 2),
          };
        }
      }
    }

    return list;
  }, [filteredShots, isCumulative]);

  // Layer ordering: goals on top, hovered shot on absolute top
  const sortedMappedShots = useMemo(() => {
    return [...mappedShots].sort((a, b) => {
      if (hoveredShot?.shot_id === a.shot.shot_id) return 1;
      if (hoveredShot?.shot_id === b.shot.shot_id) return -1;
      return (SHOT_LAYER_PRIORITY[a.shot.result] || 0) - (SHOT_LAYER_PRIORITY[b.shot.result] || 0);
    });
  }, [mappedShots, hoveredShot]);

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
              {/* Efficiency Balance Badge */}
              {(() => {
                const diff = activeSummary?.xg_difference ?? 0;
                const formattedDiff = `${diff > 0 ? '+' : ''}${diff.toFixed(2)}`;
                if (mode === 'for') {
                  if (diff >= 2.0) {
                    return (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs whitespace-nowrap"
                        title="Conversión por encima de la expectativa de gol"
                      >
                        <span className="font-mono font-bold">{formattedDiff} xG</span>
                        <span>Sobrerendimiento</span>
                      </span>
                    );
                  } else if (diff <= -2.0) {
                    return (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs whitespace-nowrap"
                        title="Genera más peligro esperado del que convierte"
                      >
                        <span className="font-mono font-bold">{formattedDiff} xG</span>
                        <span>Déficit</span>
                      </span>
                    );
                  } else {
                    return (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs whitespace-nowrap"
                        title="Conversión alineada con la probabilidad de gol esperada"
                      >
                        <span className="font-mono font-bold">{formattedDiff} xG</span>
                        <span className="text-slate-500">Conversión esperada</span>
                      </span>
                    );
                  }
                } else {
                  // Defensive 'against' mode
                  if (diff >= 2.0) {
                    return (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs whitespace-nowrap"
                        title="Concede más goles de lo esperado según la calidad del disparo rival"
                      >
                        <span className="font-mono font-bold">{formattedDiff} GC</span>
                        <span>Vulnerabilidad</span>
                      </span>
                    );
                  } else if (diff <= -2.0) {
                    return (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs whitespace-nowrap"
                        title="Eficacia defensiva: concede menos goles de lo esperado"
                      >
                        <span className="font-mono font-bold">{formattedDiff} GC</span>
                        <span>Resistencia</span>
                      </span>
                    );
                  } else {
                    return (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs whitespace-nowrap"
                        title="Goles concedidos alineados con la expectativa del rival"
                      >
                        <span className="font-mono font-bold">{formattedDiff} GC</span>
                        <span className="text-slate-500">Concesión esperada</span>
                      </span>
                    );
                  }
                }
              })()}
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

        {/* Tier 1: Outcome Filter Pills (Strict Single-Line No-Wrap) */}
        <div className="flex flex-nowrap items-center justify-between gap-1 p-1 bg-slate-100/70 rounded-lg border border-slate-200/60 overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden export-ignore">
          <button
            type="button"
            onClick={() => setResultFilter('all')}
            className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex-1 ${
              resultFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span>Todos</span>
            <span className="font-mono text-[10px] opacity-75">({counts.all})</span>
          </button>

          <button
            type="button"
            onClick={() => setResultFilter('goal')}
            className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex-1 ${
              resultFilter === 'goal'
                ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-200/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Goles</span>
            <span className="font-mono text-[10px] opacity-75">({counts.goal})</span>
          </button>

          <button
            type="button"
            onClick={() => setResultFilter('saved')}
            className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex-1 ${
              resultFilter === 'saved'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-blue-700 hover:bg-slate-200/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span>Atajados</span>
            <span className="font-mono text-[10px] opacity-75">({counts.saved})</span>
          </button>

          <button
            type="button"
            onClick={() => setResultFilter('blocked')}
            className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex-1 ${
              resultFilter === 'blocked'
                ? 'bg-white text-slate-800 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-xs bg-slate-500 shrink-0" />
            <span>Bloqueados</span>
            <span className="font-mono text-[10px] opacity-75">({counts.blocked})</span>
          </button>

          <button
            type="button"
            onClick={() => setResultFilter('miss')}
            className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex-1 ${
              resultFilter === 'miss'
                ? 'bg-white text-rose-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-rose-700 hover:bg-slate-200/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full border border-rose-500 bg-transparent shrink-0" />
            <span>Desviados</span>
            <span className="font-mono text-[10px] opacity-75">({counts.miss})</span>
          </button>
        </div>

        {/* Tier 2: Opta-Style Tabular KPI Strip */}
        <div className="grid grid-cols-5 divide-x divide-slate-200/60 py-1.5 px-1 bg-slate-50/70 rounded-lg border border-slate-200/60 text-center">
          {/* 1. Remates */}
          <div className="flex flex-col items-center justify-center px-1">
            <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
              Remates
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono text-xs sm:text-sm font-bold text-slate-900">
                {activeSummary?.total_shots ?? 0}
              </span>
              {viewMode === 'cumulative' && activeSummary?.shots_per_match !== undefined && (
                <span className="text-[10px] font-mono text-slate-400">
                  {activeSummary.shots_per_match.toFixed(1)}/pj
                </span>
              )}
            </div>
          </div>

          {/* 2. Goles / GC */}
          <div className="flex flex-col items-center justify-center px-1">
            <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
              {mode === 'against' ? 'GC' : 'Goles'}
            </span>
            <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 mt-0.5">
              {activeSummary?.goals ?? 0}
            </span>
          </div>

          {/* 3. xG Total / xGA Total */}
          <div className="flex flex-col items-center justify-center px-1">
            <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
              {mode === 'against' ? 'xGA Total' : 'xG Total'}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono text-xs sm:text-sm font-bold text-slate-900">
                {(activeSummary?.total_xg ?? 0).toFixed(2)}
              </span>
              {viewMode === 'cumulative' && activeSummary?.xg_per_match !== undefined && (
                <span className="text-[10px] font-mono text-slate-400">
                  {activeSummary.xg_per_match.toFixed(2)}/pj
                </span>
              )}
            </div>
          </div>

          {/* 4. xG / Tiro */}
          <div className="flex flex-col items-center justify-center px-1">
            <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
              xG / Tiro
            </span>
            <span className="font-mono text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">
              {(activeSummary?.xg_per_shot ?? 0).toFixed(2)}
            </span>
          </div>

          {/* 5. % a Puerta */}
          <div className="flex flex-col items-center justify-center px-1">
            <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
              % a Puerta
            </span>
            <span className="font-mono text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">
              {activeSummary?.on_target_pct ?? 0}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. Vertical Attacking Pitch Canvas & Shot Markers */}
      <div className="flex-1 flex items-center justify-center min-h-[460px] lg:min-h-[500px] w-full overflow-hidden relative my-auto py-1">
        {showLoading ? (
          <div className="flex flex-col items-center justify-center py-28 w-full">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-2" />
            <span className="text-xs text-slate-500 font-medium">
              {viewMode === 'match'
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
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="max-h-[480px] w-auto mx-auto overflow-visible select-none rounded-lg"
            >
              <defs>
                <filter id="shotGoalHalo" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#047857" floodOpacity="0.55" />
                </filter>
                <filter id="shotHoverGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#0f172a" floodOpacity="0.45" />
                </filter>
              </defs>

              {/* Pitch Canvas Background (Clean Technical Slate) */}
              <rect
                x={PITCH_X}
                y={PITCH_Y}
                width={PITCH_WIDTH}
                height={PITCH_HEIGHT}
                fill="#f8fafc"
                stroke="#cbd5e1"
                strokeWidth={1.5}
                rx={4}
              />

              {/* Midfield Line (Bottom Boundary: y=415) */}
              <line
                x1={PITCH_X}
                y1={PITCH_Y + PITCH_HEIGHT}
                x2={PITCH_X + PITCH_WIDTH}
                y2={PITCH_Y + PITCH_HEIGHT}
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />

              {/* Center Circle Arc (Curving Upwards from Bottom Midfield, radius=66.2px) */}
              <path
                d="M 203.8 415 A 66.2 66.2 0 0 1 336.2 415"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />
              {/* Center Spot */}
              <circle cx={270} cy={415} r={2.5} fill="#cbd5e1" />

              {/* Attacking 18-yard Box (At Top: x=136.6, y=35, width=266.8, height=119.4) */}
              <rect
                x={136.6}
                y={35}
                width={266.8}
                height={119.4}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />

              {/* Attacking 6-yard Box (At Top: x=209.4, y=35, width=121.2, height=39.8) */}
              <rect
                x={209.4}
                y={35}
                width={121.2}
                height={39.8}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />

              {/* Penalty Spot (11m = y=114.6) */}
              <circle cx={270} cy={114.6} r={2.5} fill="#cbd5e1" />

              {/* Penalty Arc (D) (Circle radius=66.2px extending downwards from y=154.4) */}
              <path
                d="M 217.1 154.4 A 66.2 66.2 0 0 0 322.9 154.4"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />

              {/* Goal Mouth (Top Edge: x=245.75, y=21, width=48.5, height=14) */}
              <rect
                x={245.75}
                y={21}
                width={48.5}
                height={14}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />

              {/* Corner Arcs (Top Left & Top Right) */}
              <path
                d="M 45 44 A 9 9 0 0 1 54 35"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />
              <path
                d="M 486 35 A 9 9 0 0 1 495 44"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />

              {/* 3. Render Shot Bubbles with Hierarchical Layering */}
              {sortedMappedShots.map(({ shot, px, py, radius }) => {
                const isHovered = hoveredShot?.shot_id === shot.shot_id;
                // Hovered shot expands to full scale (1.35 in cumulative, 1.25 in match)
                const r = isHovered ? (isCumulative ? radius * 1.35 : radius * 1.25) : radius;

                // Non-goal opacity: set fillOpacity={0.7} on non-goal markers to prevent visual clogging
                const nonGoalFillOpacity = isHovered ? 1.0 : 0.7;
                const nonGoalStrokeOpacity = isHovered ? 1.0 : 0.75;

                return (
                  <g
                    key={shot.shot_id}
                    className="cursor-pointer transition-transform"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredShot(shot);
                      setTooltipPos({
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                        yBottom: rect.bottom,
                        svgX: px,
                        svgY: py,
                      });
                    }}
                    onMouseLeave={() => {
                      setHoveredShot(null);
                      setTooltipPos(null);
                    }}
                  >
                    {/* Outcome Specific Rendering with Top Hierarchy for Goals */}
                    {shot.result === 'goal' ? (
                      <g filter={isHovered ? 'url(#shotHoverGlow)' : 'url(#shotGoalHalo)'}>
                        {/* Minimum radius of 6px for goals to ensure high visibility even for tap-ins */}
                        {(() => {
                          const goalR = Math.max(6.0, r);
                          return (
                            <>
                              <circle
                                cx={px}
                                cy={py}
                                r={goalR}
                                fill="#10B981"
                                fillOpacity={1.0}
                                stroke="#065F46"
                                strokeWidth={2.5}
                              />
                              {/* Inner crisp white core for double-ring effect */}
                              <circle cx={px} cy={py} r={goalR * 0.42} fill="#ffffff" />
                            </>
                          );
                        })()}
                      </g>
                    ) : shot.result === 'saved' ? (
                      <circle
                        cx={px}
                        cy={py}
                        r={r}
                        fill="#3B82F6"
                        fillOpacity={nonGoalFillOpacity}
                        stroke="#1D4ED8"
                        strokeOpacity={nonGoalStrokeOpacity}
                        strokeWidth={isHovered ? 2.2 : 1.5}
                        filter={isHovered ? 'url(#shotHoverGlow)' : undefined}
                      />
                    ) : shot.result === 'miss' ? (
                      <circle
                        cx={px}
                        cy={py}
                        r={r}
                        fill="none"
                        stroke="#EF4444"
                        strokeOpacity={nonGoalStrokeOpacity}
                        strokeWidth={isHovered ? 2.5 : 1.8}
                        filter={isHovered ? 'url(#shotHoverGlow)' : undefined}
                      />
                    ) : (
                      /* Blocked Shot: Slate Square on bottom layer with subtle visual weight */
                      <rect
                        x={px - (r * 1.5) / 2}
                        y={py - (r * 1.5) / 2}
                        width={r * 1.5}
                        height={r * 1.5}
                        fill="#94A3B8"
                        fillOpacity={nonGoalFillOpacity}
                        stroke="#475569"
                        strokeOpacity={nonGoalStrokeOpacity}
                        strokeWidth={1.2}
                        rx={1}
                        filter={isHovered ? 'url(#shotHoverGlow)' : undefined}
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Clean Bottom Strip with Direction Indicator & xG Bubble Scale */}
            <div className="flex items-center justify-between gap-4 py-1.5 px-3.5 my-1 bg-slate-50/90 border border-slate-200/70 rounded-lg text-xs w-full">
              {/* Direction Indicator placed cleanly at pitch base */}
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 select-none">
                Dirección de Ataque ↑
              </span>

              {/* xG Bubble Size Scale */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
                  Calidad xG:
                </span>
                <div className="flex items-center gap-3 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full border border-slate-300 bg-slate-200/90 ${
                        isCumulative ? 'w-1.5 h-1.5' : 'w-2 h-2'
                      }`}
                    />
                    <span className="font-mono text-slate-500 text-[10.5px]">0.05</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full border border-slate-300 bg-slate-200/90 ${
                        isCumulative ? 'w-2.5 h-2.5' : 'w-3 h-3'
                      }`}
                    />
                    <span className="font-mono text-slate-500 text-[10.5px]">0.15</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full border border-slate-300 bg-slate-200/90 ${
                        isCumulative ? 'w-3.5 h-3.5' : 'w-4 h-4'
                      }`}
                    />
                    <span className="font-mono text-slate-500 text-[10.5px]">0.35+</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Floating Hover Tooltip with Smart Placement */}
      {hoveredShot && tooltipPos && (() => {
        const isNearTop = tooltipPos.svgY < 120;
        const isNearRight = tooltipPos.svgX > 380;
        const translateXClass = isNearRight ? '-translate-x-[85%]' : '-translate-x-1/2';
        const translateYClass = isNearTop ? 'translate-y-2' : '-translate-y-full';
        const topPos = isNearTop ? tooltipPos.yBottom + 6 : tooltipPos.y - 8;

        return (
          <div
            className={`fixed z-50 pointer-events-none transition-all duration-75 ${translateXClass} ${translateYClass}`}
            style={{ left: tooltipPos.x, top: topPos }}
          >
            <div className="bg-slate-900/95 text-white backdrop-blur-md rounded-lg shadow-xl px-3 py-2 text-xs border border-slate-700/80 min-w-[190px]">
              {/* Header: Player Name & Jersey */}
              <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-800">
                <span className="font-bold text-white tracking-tight">
                  {hoveredShot.player_jersey ? `#${hoveredShot.player_jersey} ` : ''}
                  {formatPlayerName(hoveredShot.player_name)}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                    RESULT_CONFIG[hoveredShot.result]?.badgeBg || 'bg-slate-800'
                  } ${RESULT_CONFIG[hoveredShot.result]?.badgeText || 'text-slate-300'} ${
                    RESULT_CONFIG[hoveredShot.result]?.badgeBorder || 'border-slate-700'
                  }`}
                >
                  {RESULT_CONFIG[hoveredShot.result]?.singular || hoveredShot.result}
                </span>
              </div>

              {/* Metrics */}
              <div className="space-y-1 text-slate-300 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Probabilidad (xG):</span>
                  <span className="font-semibold text-slate-200">{hoveredShot.xg.toFixed(2)}</span>
                </div>
                {hoveredShot.situation && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Situación:</span>
                    <span className="text-slate-200">
                      {SITUATION_LABELS[hoveredShot.situation] || hoveredShot.situation}
                    </span>
                  </div>
                )}
                {hoveredShot.body_part && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Ejecución:</span>
                    <span className="text-slate-200">
                      {BODY_PART_LABELS[hoveredShot.body_part] || hoveredShot.body_part}
                    </span>
                  </div>
                )}
                {hoveredShot.minute && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Minuto:</span>
                    <span className="text-slate-200">{hoveredShot.minute}&apos;</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. Footer */}
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
