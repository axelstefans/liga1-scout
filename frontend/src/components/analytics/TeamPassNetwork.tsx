import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Download, Loader2, AlertCircle, RefreshCw, Network } from 'lucide-react';
import { toPng } from 'html-to-image';
import { TeamMetricEntry, PassNetworkNode, VenueFilter, ContextFilter } from '../../services/api';
import { useTeamPassNetwork, useTeamMatches } from '../../hooks/useTeam';
import { getTeamThemeColor } from '../../utils/teams';

export interface TeamPassNetworkProps {
  teams?: TeamMetricEntry[];
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
  contextFilter?: ContextFilter;
  viewMode?: 'cumulative' | 'match';
  selectedMatchId?: number | null;
}

/**
 * Formats a player's full name into Opta standard style: "Initial. Surname"
 * E.g., "Alvaro Ampuero" -> "A. Ampuero", "Paolo Guerrero" -> "P. Guerrero",
 * "Matías Di Benedetto" -> "M. Di Benedetto", "José Miguel Manzaneda" -> "J. Manzaneda"
 */
function formatOptaName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const initial = parts[0].charAt(0).toUpperCase();

  // Handle compound surnames like "Di Benedetto", "De La Cruz", "Del Solar", "Dos Santos"
  if (
    parts.length >= 3 &&
    ['di', 'de', 'del', 'da', 'la', 'dos', 'van', 'von'].includes(parts[parts.length - 2].toLowerCase())
  ) {
    return `${initial}. ${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
  }

  // Standard: Initial + last surname token
  const surname = parts[parts.length - 1];
  return `${initial}. ${surname}`;
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
  const [isExporting, setIsExporting] = useState(false);
  const [internalViewMode] = useState<'cumulative' | 'match'>('cumulative');
  const [internalSelectedMatchId, setInternalSelectedMatchId] = useState<number | null>(null);
  const [minPassThreshold, setMinPassThreshold] = useState<number>(10);
  const [hoveredNode, setHoveredNode] = useState<PassNetworkNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const viewMode = propViewMode ?? internalViewMode;
  const selectedMatchId = propSelectedMatchId !== undefined ? propSelectedMatchId : internalSelectedMatchId;

  const handleSetSelectedMatchId = (val: number | null) => {
    if (propSelectedMatchId === undefined) {
      setInternalSelectedMatchId(val);
    }
  };

  // Active club styling
  const teamColor = useMemo(
    () => activeTeam ? getTeamThemeColor(activeTeam.name, activeTeam.primary_color) : '#0284c7',
    [activeTeam]
  );

  // Fetch matches list for the team & tournament
  const { data: matches, isLoading: isLoadingMatches } = useTeamMatches(
    activeTeam?.team_id,
    tournament
  );

  // Reset selected match when switching clubs or tournament to prevent race condition
  useEffect(() => {
    handleSetSelectedMatchId(null);
  }, [activeTeam?.team_id, tournament]);

  // Check if selectedMatchId is valid for the currently loaded matches
  const isMatchValidForTeam = useMemo(() => {
    if (viewMode !== 'match') return true;
    if (!selectedMatchId || !matches) return false;
    return matches.some((m) => m.match_id === selectedMatchId);
  }, [viewMode, matches, selectedMatchId]);

  // Auto-select most recent match when in match mode and matches finish loading
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

  // Only enable query if in cumulative mode, or in match mode with a validated matchId
  const isPassNetworkEnabled = viewMode === 'cumulative' || (viewMode === 'match' && isMatchValidForTeam);

  // Fetch Pass Network data from API (cumulative or single match)
  const { data, isLoading, isError, error, refetch } = useTeamPassNetwork(
    activeTeam?.team_id,
    tournament,
    viewMode === 'match' ? (isMatchValidForTeam ? selectedMatchId : null) : null,
    venue,
    isPassNetworkEnabled,
    contextFilter
  );

  const isWaitingForMatch = viewMode === 'match' && (!isMatchValidForTeam || isLoadingMatches);
  const showLoading = isLoading || isWaitingForMatch;

  const nodes = data?.nodes || [];
  const edges = data?.edges || [];

  // Vertical Pitch SVG Canvas Proportions (viewBox="0 0 460 560")
  const SVG_WIDTH = 460;
  const SVG_HEIGHT = 560;
  const PITCH_X = 35;
  const PITCH_Y = 36;
  const PITCH_WIDTH = 390;
  const PITCH_HEIGHT = 486;

  // Node scale ranges: radius based on total_passes (15px to 22px)
  const { minPasses, maxPasses } = useMemo(() => {
    if (nodes.length === 0) return { minPasses: 1, maxPasses: 1 };
    const values = nodes.map((n) => n.total_passes);
    return {
      minPasses: Math.min(...values),
      maxPasses: Math.max(...values),
    };
  }, [nodes]);

  const getNodeRadius = (totalPasses: number) => {
    if (maxPasses === minPasses) return 17;
    const ratio = Math.max(0, Math.min(1, (totalPasses - minPasses) / (maxPasses - minPasses)));
    return 15 + ratio * 7; // Radius between 15px and 22px
  };

  // Calibrated coordinate mapping & collision relaxation for the starting XI
  const nodeMap = useMemo(() => {
    const map = new Map<
      number,
      {
        node: PassNetworkNode;
        px: number;
        py: number;
        radius: number;
        optaName: string;
        labelPos: 'top' | 'bottom';
      }
    >();
    if (nodes.length === 0) return map;

    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const depthSpan = Math.max(35, maxX - minX);
    const latSpan = Math.max(30, maxY - minY);

    // Initial position mapping
    const positions = nodes.map((n) => {
      // Longitudinal depth: team attacks upwards
      // minX (Goalkeeper) -> sits near own 6-yard / 18-yard box (~87% of pitch height)
      // maxX (Attacker/Striker) -> sits deep in opponent third (~17% of pitch height)
      const depthT = Math.max(0, Math.min(1, (n.x - minX) / depthSpan));
      const targetYPct = 0.87 - depthT * (0.87 - 0.17);
      const initialY = PITCH_Y + targetYPct * PITCH_HEIGHT;

      // Lateral width:
      // In dataset, higher y (~75-82) corresponds to left flank (Inga, Antoni, Ampuero)
      // Lower y (~15-25) corresponds to right flank (Polo, Advíncula, Ruidías)
      // We map left flank to viewer's left (small SVG X) and right flank to viewer's right (large SVG X)
      const latU = Math.max(0, Math.min(1, (n.y - minY) / latSpan));
      const targetXPct = 0.86 - latU * (0.86 - 0.14);
      const initialX = PITCH_X + targetXPct * PITCH_WIDTH;

      return {
        node: n,
        px: initialX,
        py: initialY,
        radius: getNodeRadius(n.total_passes),
        optaName: formatOptaName(n.name),
      };
    });

    // Detect cluster congestion: count close neighbors (within 65px)
    const clusterCounts = positions.map((p1, idx) => {
      let neighbors = 0;
      for (let j = 0; j < positions.length; j++) {
        if (idx !== j) {
          const d = Math.hypot(positions[j].px - p1.px, positions[j].py - p1.py);
          if (d < 65) neighbors++;
        }
      }
      return neighbors;
    });

    // Enhanced force-directed relaxation:
    // When 3 or more players are tightly clustered (>= 2 close neighbors, like ADT's right-wing
    // congestion or UTC's central stack), enforce minimum distance constraint of 44px (otherwise 38px)
    for (let iter = 0; iter < 40; iter++) {
      let moved = false;
      for (let i = 0; i < positions.length; i++) {
        const p1 = positions[i];
        for (let j = i + 1; j < positions.length; j++) {
          const p2 = positions[j];
          let dx = p2.px - p1.px;
          let dy = p2.py - p1.py;
          let dist = Math.hypot(dx, dy);

          const isClustered = clusterCounts[i] >= 2 || clusterCounts[j] >= 2;
          const minReqDist = isClustered ? 44.0 : 38.0;

          if (dist < minReqDist) {
            const overlap = minReqDist - dist;
            if (dist < 0.01) {
              dx = 1.0;
              dy = 0.0;
              dist = 1.0;
            }
            const nx = (dx / dist) * (overlap * 0.5);
            const ny = (dy / dist) * (overlap * 0.5);
            p1.px -= nx;
            p1.py -= ny;
            p2.px += nx;
            p2.py += ny;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }

    // Boundary constraint: keep nodes safely within playable pitch margins
    positions.forEach((p) => {
      const marginX = p.radius + 8;
      const marginY = p.radius + 16;
      p.px = Math.max(PITCH_X + marginX, Math.min(PITCH_X + PITCH_WIDTH - marginX, p.px));
      p.py = Math.max(PITCH_Y + marginY, Math.min(PITCH_Y + PITCH_HEIGHT - marginY, p.py));
    });

    // Alternating label positioning:
    // If the bottom space is occupied by another player's node/halo (< 60px vertical, < 34px horizontal),
    // and there is headroom above, render the surname above the node to avoid overlapping text
    positions.forEach((p1) => {
      const hasRoomAbove = p1.py - p1.radius - 14 >= PITCH_Y;
      const isBottomOccupied = positions.some((p2) => {
        if (p2.node.player_id === p1.node.player_id) return false;
        const dy = p2.py - p1.py; // positive if p2 is vertically below p1
        const dx = Math.abs(p2.px - p1.px);
        return dy > 0 && dy < p1.radius + p2.radius + 26 && dx < 34;
      });

      const labelPos: 'top' | 'bottom' = isBottomOccupied && hasRoomAbove ? 'top' : 'bottom';
      map.set(p1.node.player_id, {
        ...p1,
        labelPos,
      });
    });

    return map;
  }, [nodes, minPasses, maxPasses]);

  // Edge scale ranges: stroke width & opacity based on pass_count
  const { minEdgeCount, maxEdgeCount } = useMemo(() => {
    const valid = edges.filter((e) => e.pass_count >= minPassThreshold);
    if (valid.length === 0) return { minEdgeCount: 1, maxEdgeCount: 1 };
    const counts = valid.map((e) => e.pass_count);
    return {
      minEdgeCount: Math.min(...counts),
      maxEdgeCount: Math.max(...counts),
    };
  }, [edges, minPassThreshold]);

  // Filtered edges by threshold
  const filteredEdges = useMemo(() => {
    return edges.filter((e) => e.pass_count >= minPassThreshold);
  }, [edges, minPassThreshold]);

  // Fast edge lookup to detect reciprocal connections
  const edgePairMap = useMemo(() => {
    const set = new Set<string>();
    filteredEdges.forEach((e) => {
      set.add(`${e.passer_id}->${e.receiver_id}`);
    });
    return set;
  }, [filteredEdges]);

  // Top connection partners for hovered player
  const hoveredPartners = useMemo(() => {
    if (!hoveredNode) return [];
    const map = new Map<number, number>();

    edges.forEach((e) => {
      if (e.passer_id === hoveredNode.player_id) {
        map.set(e.receiver_id, (map.get(e.receiver_id) || 0) + e.pass_count);
      } else if (e.receiver_id === hoveredNode.player_id) {
        map.set(e.passer_id, (map.get(e.passer_id) || 0) + e.pass_count);
      }
    });

    const partners = Array.from(map.entries())
      .map(([partnerId, count]) => {
        const partnerInfo = nodeMap.get(partnerId);
        return {
          partnerId,
          name: partnerInfo?.node.name || `Jugador #${partnerId}`,
          shortName: partnerInfo?.optaName || `#${partnerId}`,
          jersey: partnerInfo?.node.jersey,
          count,
        };
      })
      .sort((a, b) => b.count - a.count);

    return partners.slice(0, 2);
  }, [hoveredNode, edges, nodeMap]);

  // High-Resolution PNG Export (2x)
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
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList.contains('export-ignore')) {
            return false;
          }
          return true;
        },
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
      {/* 1. Header Strip with Title, Subtitle, Filter Pills, and Export */}
      <div>
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
            {/* Filter Pills for Low-Volume Connections */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 text-xs">
              <button
                type="button"
                onClick={() => setMinPassThreshold(5)}
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  minPassThreshold === 5
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Mostrar conexiones con al menos 5 pases"
              >
                ≥ 5
              </button>
              <button
                type="button"
                onClick={() => setMinPassThreshold(10)}
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  minPassThreshold === 10
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Mostrar conexiones con al menos 10 pases"
              >
                ≥ 10
              </button>
              <button
                type="button"
                onClick={() => setMinPassThreshold(15)}
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  minPassThreshold === 15
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Mostrar conexiones con al menos 15 pases"
              >
                ≥ 15
              </button>
            </div>

            {/* Export PNG */}
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
      </div>

      {/* 2. Main Pitch Canvas (Vertical Orientation) */}
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
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="max-h-[480px] w-auto mx-auto overflow-visible select-none"
          >
            <defs>
              {/* Drop shadow for player nodes */}
              <filter id="optaNodeShadow" x="-25%" y="-25%" width="150%" height="150%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.20" />
              </filter>

              {/* Arrowhead marker for default pass edges */}
              <marker
                id="passArrow"
                viewBox="0 0 6 6"
                refX="5"
                refY="3"
                markerWidth="4"
                markerHeight="4"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 5 3 L 0 5 z" fill={teamColor} fillOpacity="0.85" />
              </marker>

              {/* Arrowhead marker for active hovered pass edges */}
              <marker
                id="passArrowActive"
                viewBox="0 0 6 6"
                refX="5"
                refY="3"
                markerWidth="4.5"
                markerHeight="4.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 5 3 L 0 5 z" fill="#0f172a" />
              </marker>
            </defs>

            {/* Vertical Pitch Markings (Attacking Upwards) */}
            {/* Outer Pitch Boundary */}
            <rect
              x={PITCH_X}
              y={PITCH_Y}
              width={PITCH_WIDTH}
              height={PITCH_HEIGHT}
              rx={8}
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* Halfway Horizontal Line */}
            <line
              x1={PITCH_X}
              y1={PITCH_Y + PITCH_HEIGHT / 2}
              x2={PITCH_X + PITCH_WIDTH}
              y2={PITCH_Y + PITCH_HEIGHT / 2}
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* Center Circle & Spot */}
            <circle
              cx={PITCH_X + PITCH_WIDTH / 2}
              cy={PITCH_Y + PITCH_HEIGHT / 2}
              r={46}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />
            <circle
              cx={PITCH_X + PITCH_WIDTH / 2}
              cy={PITCH_Y + PITCH_HEIGHT / 2}
              r={2.5}
              fill="#cbd5e1"
            />

            {/* Top Penalty Box (Opponent / Attacking Third) */}
            <rect
              x={PITCH_X + (PITCH_WIDTH - 180) / 2}
              y={PITCH_Y}
              width={180}
              height={74}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />
            {/* Top 6-Yard Box */}
            <rect
              x={PITCH_X + (PITCH_WIDTH - 84) / 2}
              y={PITCH_Y}
              width={84}
              height={26}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />
            {/* Top Penalty Spot */}
            <circle
              cx={PITCH_X + PITCH_WIDTH / 2}
              cy={PITCH_Y + 50}
              r={2.5}
              fill="#cbd5e1"
            />
            {/* Top Penalty Arc */}
            <path
              d={`M ${PITCH_X + PITCH_WIDTH / 2 - 36} ${PITCH_Y + 74} A 42 42 0 0 0 ${PITCH_X + PITCH_WIDTH / 2 + 36} ${PITCH_Y + 74}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />
            {/* Top Goal Net */}
            <rect
              x={PITCH_X + (PITCH_WIDTH - 52) / 2}
              y={PITCH_Y - 5}
              width={52}
              height={5}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* Bottom Penalty Box (Own / Defensive Third) */}
            <rect
              x={PITCH_X + (PITCH_WIDTH - 180) / 2}
              y={PITCH_Y + PITCH_HEIGHT - 74}
              width={180}
              height={74}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />
            {/* Bottom 6-Yard Box */}
            <rect
              x={PITCH_X + (PITCH_WIDTH - 84) / 2}
              y={PITCH_Y + PITCH_HEIGHT - 26}
              width={84}
              height={26}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />
            {/* Bottom Penalty Spot */}
            <circle
              cx={PITCH_X + PITCH_WIDTH / 2}
              cy={PITCH_Y + PITCH_HEIGHT - 50}
              r={2.5}
              fill="#cbd5e1"
            />
            {/* Bottom Penalty Arc */}
            <path
              d={`M ${PITCH_X + PITCH_WIDTH / 2 - 36} ${PITCH_Y + PITCH_HEIGHT - 74} A 42 42 0 0 1 ${PITCH_X + PITCH_WIDTH / 2 + 36} ${PITCH_Y + PITCH_HEIGHT - 74}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />
            {/* Bottom Goal Net */}
            <rect
              x={PITCH_X + (PITCH_WIDTH - 52) / 2}
              y={PITCH_Y + PITCH_HEIGHT}
              width={52}
              height={5}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* Corner Arcs */}
            <path d={`M ${PITCH_X} ${PITCH_Y + 10} A 10 10 0 0 0 ${PITCH_X + 10} ${PITCH_Y}`} fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
            <path d={`M ${PITCH_X + PITCH_WIDTH - 10} ${PITCH_Y} A 10 10 0 0 0 ${PITCH_X + PITCH_WIDTH} ${PITCH_Y + 10}`} fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
            <path d={`M ${PITCH_X} ${PITCH_Y + PITCH_HEIGHT - 10} A 10 10 0 0 1 ${PITCH_X + 10} ${PITCH_Y + PITCH_HEIGHT}`} fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
            <path d={`M ${PITCH_X + PITCH_WIDTH - 10} ${PITCH_Y + PITCH_HEIGHT} A 10 10 0 0 1 ${PITCH_X + PITCH_WIDTH} ${PITCH_Y + PITCH_HEIGHT - 10}`} fill="none" stroke="#cbd5e1" strokeWidth="1.5" />

            {/* Direction of Attack Indicator Header */}
            <g opacity="0.75">
              <text
                x={PITCH_X + PITCH_WIDTH / 2}
                y={PITCH_Y - 14}
                textAnchor="middle"
                className="text-[10px] font-semibold fill-slate-400 tracking-wider uppercase select-none"
              >
                DIRECCIÓN DE ATAQUE ↑
              </text>
            </g>

            {/* 3. Pass Lines / Edges with Directional Cues */}
            <g className="transition-all duration-200">
              {filteredEdges.map((edge, idx) => {
                const p1 = nodeMap.get(edge.passer_id);
                const p2 = nodeMap.get(edge.receiver_id);
                if (!p1 || !p2) return null;

                const isConnected =
                  hoveredNode !== null &&
                  (edge.passer_id === hoveredNode.player_id || edge.receiver_id === hoveredNode.player_id);

                // Compute edge scale
                const ratio =
                  maxEdgeCount === minEdgeCount
                    ? 0.5
                    : Math.max(0, Math.min(1, (edge.pass_count - minEdgeCount) / (maxEdgeCount - minEdgeCount)));

                const strokeWidth = 1.5 + ratio * 4.2; // 1.5px to 5.7px
                let opacity = 0.30 + ratio * 0.45; // 0.30 to 0.75

                if (hoveredNode) {
                  if (isConnected) {
                    opacity = 0.95;
                  } else {
                    opacity = 0.04;
                  }
                }

                // Geometry calculation: offset endpoints so arrowhead terminates at node perimeter
                const dx = p2.px - p1.px;
                const dy = p2.py - p1.py;
                const dist = Math.hypot(dx, dy);
                if (dist < 10) return null;

                const ux = dx / dist;
                const uy = dy / dist;

                // Normal vector for gentle reciprocal curve offset
                const nx = -uy;
                const ny = ux;

                const hasReciprocal = edgePairMap.has(`${edge.receiver_id}->${edge.passer_id}`);
                const curveOffset = hasReciprocal ? 6 : 0;

                const startX = p1.px + ux * (p1.radius + 1);
                const startY = p1.py + uy * (p1.radius + 1);
                const endX = p2.px - ux * (p2.radius + 4);
                const endY = p2.py - uy * (p2.radius + 4);

                const midX = (startX + endX) / 2 + nx * curveOffset;
                const midY = (startY + endY) / 2 + ny * curveOffset;

                const pathData =
                  curveOffset !== 0
                    ? `M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`
                    : `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`;

                const markerUrl = isConnected ? 'url(#passArrowActive)' : 'url(#passArrow)';

                return (
                  <path
                    key={`edge-${edge.passer_id}-${edge.receiver_id}-${idx}`}
                    d={pathData}
                    fill="none"
                    stroke={isConnected ? '#0f172a' : teamColor}
                    strokeWidth={isConnected ? strokeWidth + 1.2 : strokeWidth}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                    markerEnd={opacity > 0.05 ? markerUrl : undefined}
                    className="transition-all duration-150"
                  />
                );
              })}
            </g>

            {/* 4. Player Nodes (Opta Aesthetic) */}
            <g>
              {Array.from(nodeMap.values()).map((info) => {
                const node = info.node;
                const r = info.radius;
                const isHovered = hoveredNode?.player_id === node.player_id;
                const isConnectedToHovered =
                  hoveredNode !== null &&
                  edges.some(
                    (e) =>
                      e.pass_count >= minPassThreshold &&
                      ((e.passer_id === hoveredNode.player_id && e.receiver_id === node.player_id) ||
                        (e.receiver_id === hoveredNode.player_id && e.passer_id === node.player_id))
                  );

                const isDimmed = hoveredNode !== null && !isHovered && !isConnectedToHovered;

                return (
                  <g
                    key={`node-${node.player_id}`}
                    className="cursor-pointer transition-opacity duration-150"
                    opacity={isDimmed ? 0.38 : 1.0}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const cardRect = cardRef.current?.getBoundingClientRect();
                      if (cardRect) {
                        setTooltipPos({
                          x: rect.left - cardRect.left + rect.width / 2,
                          y: rect.top - cardRect.top,
                        });
                      }
                      setHoveredNode(node);
                    }}
                    onMouseLeave={() => {
                      setHoveredNode(null);
                      setTooltipPos(null);
                    }}
                  >
                    {/* Outer Node Circle */}
                    <circle
                      cx={info.px}
                      cy={info.py}
                      r={isHovered ? r + 2.5 : r}
                      fill={teamColor}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? 2.5 : 2}
                      filter="url(#optaNodeShadow)"
                      className="transition-all duration-150"
                    />

                    {/* Centered Jersey Number in Bold White */}
                    <text
                      x={info.px}
                      y={info.py + 0.5}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-xs font-bold fill-white select-none pointer-events-none"
                    >
                      {node.jersey && node.jersey > 0 ? node.jersey : info.optaName.slice(0, 2).toUpperCase()}
                    </text>

                    {/* Opta-Style Player Label (Initial. Surname) with Protective White Halo */}
                    <text
                      x={info.px}
                      y={info.labelPos === 'top' ? info.py - r - 7 : info.py + r + 13}
                      textAnchor="middle"
                      style={{
                        paintOrder: 'stroke fill',
                        stroke: '#ffffff',
                        strokeWidth: '3.5px',
                        strokeLinejoin: 'round',
                      }}
                      className="text-[11px] font-medium fill-slate-800 select-none pointer-events-none"
                    >
                      {info.optaName}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {/* 5. Floating Interactive Tooltip */}
        {hoveredNode && tooltipPos && (
          <div
            className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-slate-900 text-white rounded-xl px-3.5 py-2.5 text-xs shadow-xl border border-slate-700/60 min-w-[210px] max-w-[260px] transition-all duration-100"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y - 10}px`,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
              <span className="font-bold text-white text-xs tracking-tight">
                {hoveredNode.name}
              </span>
              {hoveredNode.jersey && hoveredNode.jersey > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  #{hoveredNode.jersey}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] mb-2">
              <span className="text-slate-400">Pases completados:</span>
              <span className="font-mono font-bold text-emerald-400">
                {hoveredNode.total_passes}
              </span>
            </div>

            {/* Pivot tactical role and defensive actions */}
            {hoveredNode.is_pivot && (
              <div className="flex items-center justify-between text-[11px] mb-1.5 pt-1.5 border-t border-slate-800">
                <span className="text-slate-400">Rol táctico:</span>
                <span className="font-semibold flex items-center gap-1 text-emerald-400">
                  🛡️ Pivote Defensivo
                </span>
              </div>
            )}
            {hoveredNode.defensive_actions_p90 !== undefined && hoveredNode.defensive_actions_p90 !== null && (
              <div className="flex items-center justify-between text-[11px] mb-2">
                <span className="text-slate-400">Acciones def / 90:</span>
                <span className="font-mono font-bold text-slate-200">
                  {hoveredNode.defensive_actions_p90.toFixed(2)}
                </span>
              </div>
            )}

            {/* Top Socios / Circuitos */}
            {hoveredPartners.length > 0 && (
              <div className="pt-1.5 border-t border-slate-800/80">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                  Principales Sociedades:
                </span>
                <div className="space-y-1">
                  {hoveredPartners.map((partner, idx) => (
                    <div
                      key={`partner-${partner.partnerId}`}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <span className="text-slate-300 flex items-center gap-1">
                        <span className="text-slate-500 font-mono">{idx + 1}.</span>
                        <span>{partner.shortName}</span>
                        {partner.jersey && (
                          <span className="text-slate-500 text-[9.5px]">
                            (#{partner.jersey})
                          </span>
                        )}
                      </span>
                      <span className="font-mono font-semibold text-white">
                        {partner.count} pases
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Diagnostic Footer Strip */}
      <div className="mt-auto pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-normal">
        <div className="flex flex-wrap items-center gap-3">
          <span>Grosor y flechas proporcionales al volumen de pases entre futbolistas.</span>
        </div>
        <div className="flex items-center gap-3">
          <span>
            {filteredEdges.length} conexiones (
            {viewMode === 'match' ? '11 titulares en cancha' : `${nodes.length} titulares acumulados`}
            )
          </span>
        </div>
      </div>
    </div>
  );
};

export default TeamPassNetwork;
