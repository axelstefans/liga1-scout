import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Download, Loader2, AlertCircle, RefreshCw, 
  ChevronDown, Target, User, Copy, Check 
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { TeamMetricEntry, ShotItem } from '../../services/api';
import { useTeamShotMap, useTeamMatches } from '../../hooks/useTeam';

export interface TeamShotMapProps {
  teams?: TeamMetricEntry[];
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
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
  mode: propMode,
  viewMode: propViewMode,
  selectedMatchId: propSelectedMatchId,
  selectedPlayer: propSelectedPlayer,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [internalMode, setInternalMode] = useState<ShotMode>('for');
  const [internalViewMode, setInternalViewMode] = useState<'cumulative' | 'match'>('cumulative');
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
    isQueryEnabled
  );

  const isWaitingForMatch = viewMode === 'match' && (!isMatchValidForTeam || isLoadingMatches);
  const showLoading = isLoading || isWaitingForMatch;

  const rawShots = data?.shots || [];

  // Unique players list sorted alphabetically for player filter dropdown
  const uniquePlayers = useMemo(() => {
    const map = new Map<string, number>();
    rawShots.forEach((s) => {
      const name = s.player_name || 'Desconocido';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rawShots]);

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
      return (
        data?.summary || {
          total_shots: 0,
          goals: 0,
          total_xg: 0,
          xg_per_shot: 0,
          shots_on_target: 0,
          on_target_pct: 0,
          xg_difference: 0,
        }
      );
    }
    const total_shots = playerShots.length;
    const goals = playerShots.filter((s) => s.result === 'goal').length;
    const total_xg = roundDecimals(playerShots.reduce((acc, s) => acc + s.xg, 0), 2);
    const xg_per_shot = total_shots > 0 ? roundDecimals(total_xg / total_shots, 2) : 0;
    const shots_on_target = playerShots.filter((s) => s.result === 'goal' || s.result === 'saved').length;
    const on_target_pct = total_shots > 0 ? roundDecimals((shots_on_target / total_shots) * 100, 1) : 0;
    const xg_difference = roundDecimals(goals - total_xg, 2);

    return {
      total_shots,
      goals,
      total_xg,
      xg_per_shot,
      shots_on_target,
      on_target_pct,
      xg_difference,
    };
  }, [selectedPlayer, playerShots, data?.summary]);

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

  // Copy Summary Handler (strictly formatted for ML / LLM ingestion without ambiguity)
  const handleCopySummary = async () => {
    // 1. Header line
    const headerLine = `MAPA DE TIROS | ${
      mode === 'for'
        ? `A FAVOR (tiros de ${activeTeam.name})`
        : `CONCEDIDOS (tiros de rivales contra ${activeTeam.name})`
    }`;

    // 2. Context line
    let contextLine = '';
    const isSingleMatch = viewMode === 'match';
    if (isSingleMatch && activeMatch) {
      const matchLabel = activeMatch.label;
      const venue = activeMatch.is_home ? 'Local' : 'Visita';
      const rivalName = activeMatch.opponent_name;

      let matchPerspectiveScore = '';
      if (
        activeMatch.team_score !== null &&
        activeMatch.team_score !== undefined &&
        activeMatch.opponent_score !== null &&
        activeMatch.opponent_score !== undefined
      ) {
        const teamScore = activeMatch.team_score;
        const oppScore = activeMatch.opponent_score;
        const outcome_label =
          teamScore > oppScore
            ? 'victoria'
            : teamScore < oppScore
            ? 'derrota'
            : 'empate';

        if (activeMatch.is_home) {
          matchPerspectiveScore = `${activeTeam.name} ${teamScore} - ${oppScore} ${rivalName} (${outcome_label})`;
        } else {
          matchPerspectiveScore = `${rivalName} ${oppScore} - ${teamScore} ${activeTeam.name} (${outcome_label})`;
        }
      } else {
        matchPerspectiveScore = 'Resultado pendiente';
      }

      contextLine = `Partido: ${matchLabel} | ${venue} | ${matchPerspectiveScore} | Rival: ${rivalName}`;
    } else {
      const scopeLabel =
        tournament === 'all' ? 'Temporada Completa 2026' : `${tournament} 2026`;
      const matchesCount = matches?.length || 0;
      const lowReliability = matchesCount < 8 ? ' (fiabilidad baja)' : '';
      contextLine = `Alcance: ${scopeLabel} | Muestra: ${matchesCount} PJ${lowReliability}`;
    }

    // Decoupled stats: always calculated from playerShots (full match/scope, narrow only if player selected)
    const total_shots = playerShots.length;
    const goals = playerShots.filter((s) => s.result === 'goal').length;
    const saved = playerShots.filter((s) => s.result === 'saved').length;
    const blocked = playerShots.filter((s) => s.result === 'blocked').length;
    const miss = playerShots.filter((s) => s.result === 'miss').length;

    const total_xg_val = roundDecimals(
      playerShots.reduce((acc, s) => acc + s.xg, 0),
      2
    );
    const total_xg = total_xg_val.toFixed(2);
    const xg_per_shot =
      total_shots > 0
        ? roundDecimals(total_xg_val / total_shots, 2).toFixed(2)
        : '0.00';
    const shots_on_target = goals + saved;
    const on_target_pct =
      total_shots > 0
        ? roundDecimals((shots_on_target / total_shots) * 100, 1).toFixed(1)
        : '0.0';
    const delta_val = roundDecimals(goals - total_xg_val, 2);
    const delta = delta_val.toFixed(2);

    // 3. Top Shooters Aggregation (Top 2-3 with format Name (shots, xG))
    const shooterMap = new Map<string, { shots: number; xg: number }>();
    for (const s of playerShots) {
      const name = s.player_name || 'Desconocido';
      const curr = shooterMap.get(name) || { shots: 0, xg: 0 };
      curr.shots += 1;
      curr.xg += s.xg;
      shooterMap.set(name, curr);
    }
    const topShooters = Array.from(shooterMap.entries())
      .map(([name, d]) => ({
        name: formatPlayerName(name),
        shots: d.shots,
        xg: roundDecimals(d.xg, 2),
      }))
      .sort((a, b) => b.xg - a.xg || b.shots - a.shots)
      .slice(0, 3);
    const topShootersText = topShooters
      .map((s) => `${s.name} (${s.shots}, ${s.xg.toFixed(2)} xG)`)
      .join(', ');

    const shootersLabel =
      selectedPlayer === 'all'
        ? (mode === 'for' ? 'Plantel completo' : 'Rivales') +
          (topShootersText ? ` (Top: ${topShootersText})` : '')
        : selectedPlayer;
    const rematadoresLine = `Rematadores: ${shootersLabel}`;

    // 4. Shot distribution line
    const shotDistLine = `Tiros ${total_shots} | Goles ${goals} | Atajados ${saved} | Bloqueados ${blocked} | Desviados ${miss}`;

    // 5. Quality metrics line
    const xgPrefix = mode === 'for' ? 'xG' : 'xGA';
    const qualityLine = `${xgPrefix} ${total_xg} | ${xgPrefix}/tiro ${xg_per_shot} | % a puerta ${on_target_pct}% (incl. goles)`;

    // 6. Performance line
    const deltaSign = delta_val >= 0 ? '+' : '';
    const performanceLine =
      mode === 'for'
        ? `Goles - xG: ${deltaSign}${delta} (${
            delta_val >= 0
              ? 'marcó más de lo esperado'
              : 'marcó menos de lo esperado'
          })`
        : `Goles concedidos - xGA: ${deltaSign}${delta} (${
            delta_val > 0
              ? 'concedió más de lo esperado'
              : 'concedió menos de lo esperado'
          })`;

    // 7. Location line (Inside box: x >= 84, y in [20, 80])
    const inBoxCount = playerShots.filter(
      (s) => s.x >= 84.0 && s.y >= 20.0 && s.y <= 80.0
    ).length;
    const pctInBox =
      total_shots > 0 ? Math.round((inBoxCount / total_shots) * 100) : 0;
    const locationLine = `Dentro del área: ${pctInBox}% | Fuera: ${100 - pctInBox}%`;

    // 8. Situational breakdown
    const openShots = playerShots.filter((s) => s.situation === 'open_play').length;
    const openXg = roundDecimals(
      playerShots
        .filter((s) => s.situation === 'open_play')
        .reduce((acc, s) => acc + s.xg, 0),
      2
    ).toFixed(2);

    const spShots = playerShots.filter(
      (s) => s.situation === 'set_piece' || s.situation === 'corner'
    ).length;
    const spXg = roundDecimals(
      playerShots
        .filter((s) => s.situation === 'set_piece' || s.situation === 'corner')
        .reduce((acc, s) => acc + s.xg, 0),
      2
    ).toFixed(2);

    const cntShots = playerShots.filter((s) => s.situation === 'fast_break').length;
    const cntXg = roundDecimals(
      playerShots
        .filter((s) => s.situation === 'fast_break')
        .reduce((acc, s) => acc + s.xg, 0),
      2
    ).toFixed(2);

    const penShots = playerShots.filter((s) => s.situation === 'penalty').length;
    const penXg = roundDecimals(
      playerShots
        .filter((s) => s.situation === 'penalty')
        .reduce((acc, s) => acc + s.xg, 0),
      2
    ).toFixed(2);
    const penString = penShots > 0 ? ` | penal ${penShots}/${penXg}` : '';

    const situationLine = `Por situación (tiros / ${xgPrefix}): abierta ${openShots}/${openXg} | balón parado ${spShots}/${spXg} | contra ${cntShots}/${cntXg}${penString}`;

    // 9. Execution breakdown
    const footShots = playerShots.filter(
      (s) => s.body_part === 'right_foot' || s.body_part === 'left_foot'
    ).length;
    const headShots = playerShots.filter((s) => s.body_part === 'head').length;
    const executionLine = `Por ejecución: pie ${footShots} | cabeza ${headShots}`;

    const summaryLines = [
      headerLine,
      contextLine,
      rematadoresLine,
      shotDistLine,
      qualityLine,
      performanceLine,
      locationLine,
      situationLine,
      executionLine,
    ];

    // 10. Reliability note for single matches:
    if (!isCumulative) {
      summaryLines.push(
        'Nota: muestra de un solo partido, el ΔxG puntual no constituye tendencia.'
      );
    }

    const text = summaryLines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error('Failed to copy summary to clipboard', err);
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
          {/* Title Header */}
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <Target className="w-4 h-4 text-slate-700" />
              Mapa de Tiros y Calidad (xG)
            </h3>
          </div>

          {/* Filter Row: Result Chips */}
          <div className="flex flex-wrap items-center gap-1.5 export-ignore">
            <button
              type="button"
              onClick={() => setResultFilter('all')}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                resultFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Todos
              <span className="text-[10px] opacity-75">({counts.all})</span>
            </button>

            <button
              type="button"
              onClick={() => setResultFilter('goal')}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                resultFilter === 'goal'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Goles
              <span className="text-[10px] opacity-75">({counts.goal})</span>
            </button>

            <button
              type="button"
              onClick={() => setResultFilter('saved')}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                resultFilter === 'saved'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Atajados
              <span className="text-[10px] opacity-75">({counts.saved})</span>
            </button>

            <button
              type="button"
              onClick={() => setResultFilter('blocked')}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                resultFilter === 'blocked'
                  ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-xs bg-slate-500" />
              Bloqueados
              <span className="text-[10px] opacity-75">({counts.blocked})</span>
            </button>

            <button
              type="button"
              onClick={() => setResultFilter('miss')}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                resultFilter === 'miss'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full border border-rose-500 bg-transparent" />
              Desviados
              <span className="text-[10px] opacity-75">({counts.miss})</span>
            </button>
          </div>
        </div>

        {/* Clean Single-Row KPI Summary Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">Remates:</span>
            <span className="font-bold text-slate-900">{activeSummary?.total_shots ?? 0}</span>
          </div>
          <span className="text-slate-300">•</span>

          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">{mode === 'against' ? 'GC:' : 'Goles:'}</span>
            <span className="font-bold text-slate-900">{activeSummary?.goals ?? 0}</span>
          </div>
          <span className="text-slate-300">•</span>

          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">{mode === 'against' ? 'xGA:' : 'xG:'}</span>
            <span className="font-bold text-slate-900">{(activeSummary?.total_xg ?? 0).toFixed(2)}</span>
          </div>
          <span className="text-slate-300">•</span>

          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">Dif:</span>
            <span
              className={`font-bold ${
                mode === 'against'
                  ? (activeSummary?.xg_difference ?? 0) > 0
                    ? 'text-rose-700'
                    : 'text-emerald-700'
                  : (activeSummary?.xg_difference ?? 0) > 0
                  ? 'text-emerald-700'
                  : (activeSummary?.xg_difference ?? 0) < 0
                  ? 'text-rose-700'
                  : 'text-slate-700'
              }`}
            >
              {(activeSummary?.xg_difference ?? 0) > 0 ? '+' : ''}
              {(activeSummary?.xg_difference ?? 0).toFixed(2)}
            </span>
          </div>
          <span className="text-slate-300 hidden sm:inline">•</span>

          <div className="hidden sm:flex items-center gap-1">
            <span className="text-slate-500 font-medium">xG/Tiro:</span>
            <span className="font-semibold text-slate-800">{(activeSummary?.xg_per_shot ?? 0).toFixed(2)}</span>
          </div>
          <span className="text-slate-300 hidden sm:inline">•</span>

          <div className="hidden sm:flex items-center gap-1">
            <span className="text-slate-500 font-medium">% a puerta:</span>
            <span className="font-semibold text-slate-800">{activeSummary?.on_target_pct ?? 0}%</span>
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

              {/* Midfield Line (Bottom Boundary: y=415) */}
              <line
                x1={PITCH_X}
                y1={PITCH_Y + PITCH_HEIGHT}
                x2={PITCH_X + PITCH_WIDTH}
                y2={PITCH_Y + PITCH_HEIGHT}
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Center Circle Arc (Curving Upwards from Bottom Midfield, radius=66.2px) */}
              <path
                d="M 203.8 415 A 66.2 66.2 0 0 1 336.2 415"
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />
              {/* Center Spot */}
              <circle cx={270} cy={415} r={3} fill="#4A3525" />

              {/* Attacking 18-yard Box (At Top: x=136.6, y=35, width=266.8, height=119.4) */}
              <rect
                x={136.6}
                y={35}
                width={266.8}
                height={119.4}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Attacking 6-yard Box (At Top: x=209.4, y=35, width=121.2, height=39.8) */}
              <rect
                x={209.4}
                y={35}
                width={121.2}
                height={39.8}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Penalty Spot (11m = y=114.6) */}
              <circle cx={270} cy={114.6} r={2.8} fill="#4A3525" />

              {/* Penalty Arc (D) (Circle radius=66.2px extending downwards from y=154.4) */}
              <path
                d="M 217.1 154.4 A 66.2 66.2 0 0 0 322.9 154.4"
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Goal Mouth (Top Edge: x=245.75, y=21, width=48.5, height=14) */}
              <rect
                x={245.75}
                y={21}
                width={48.5}
                height={14}
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />

              {/* Corner Arcs (Top Left & Top Right) */}
              <path
                d="M 45 44 A 9 9 0 0 1 54 35"
                fill="none"
                stroke="#4A3525"
                strokeWidth={1.5}
              />
              <path
                d="M 486 35 A 9 9 0 0 1 495 44"
                fill="none"
                stroke="#4A3525"
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
            <div className="flex items-center justify-between gap-4 py-1.5 px-3.5 my-1 bg-slate-50/80 border border-slate-200/70 rounded-lg text-xs w-full">
              {/* Direction Indicator placed cleanly at pitch base */}
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                Dirección de Ataque ↑
              </span>

              {/* xG Bubble Size Scale */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Calidad xG:
                </span>
                <div className="flex items-center gap-3 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1">
                    <span
                      className={`rounded-full border border-slate-400 bg-slate-300 ${
                        isCumulative ? 'w-1.5 h-1.5' : 'w-2 h-2'
                      }`}
                    />
                    <span>0.05</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`rounded-full border border-slate-400 bg-slate-300 ${
                        isCumulative ? 'w-2.5 h-2.5' : 'w-3 h-3'
                      }`}
                    />
                    <span>0.15</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`rounded-full border border-slate-400 bg-slate-300 ${
                        isCumulative ? 'w-3.5 h-3.5' : 'w-4 h-4'
                      }`}
                    />
                    <span>0.35+</span>
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

        {/* Action Buttons: Copiar Resumen & Exportar PNG */}
        <div className="flex items-center gap-2 export-ignore">
          <button
            type="button"
            onClick={handleCopySummary}
            disabled={rawShots.length === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            title="Copiar resumen estructurado para análisis táctico o IA"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Resumen</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportPNG}
            disabled={isExporting || showLoading || rawShots.length === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Exportar PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamShotMap;
