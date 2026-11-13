import type { PassNetworkEdge, PassNetworkNode } from '../../../services/api';
import { formatOptaName } from '../../../utils/playerFormatters';

export interface PassNetworkDimensions {
  svgWidth: number;
  svgHeight: number;
  pitchX: number;
  pitchY: number;
  pitchWidth: number;
  pitchHeight: number;
}

export interface PassNetworkFilterState {
  minPassThreshold: number;
  viewMode: 'cumulative' | 'match';
}

export interface MappedPassNode {
  node: PassNetworkNode;
  px: number;
  py: number;
  radius: number;
  optaName: string;
  labelPos: 'top' | 'bottom';
}

export interface MappedPassEdge {
  edge: PassNetworkEdge;
  pathData: string;
  baseStrokeWidth: number;
  baseOpacity: number;
  isReciprocal: boolean;
}

export interface PassPartnerSummary {
  partnerId: number;
  name: string;
  shortName: string;
  jersey: number | null | undefined;
  count: number;
}

export interface PassNetworkTacticalMetrics {
  /** Mean team depth along pitch (0 = own goal line, 100 = opponent goal line). */
  avgPassHeightPct: number | null;
  /** Lateral spread across pitch width (max y - min y in Opta 0-100 units). */
  teamWidthPct: number | null;
  /** Standard spatial dispersion from the team centroid in Opta units. */
  nodeDispersion: number | null;
  nodeCount: number;
  visibleEdgeCount: number;
}

/** Matches SoccerPitchCanvas vertical full-pitch defaults (540 x 600). */
export const DEFAULT_PASS_NETWORK_DIMENSIONS: PassNetworkDimensions = {
  svgWidth: 540,
  svgHeight: 600,
  pitchX: 45,
  pitchY: 40,
  pitchWidth: 450,
  pitchHeight: 520,
};

export const PASS_THRESHOLD_OPTIONS = [5, 10, 15] as const;

/** Computes node radius scaled linearly by total_passes (16px to 23px). */
export function computeNodeRadius(
  totalPasses: number,
  minPasses: number,
  maxPasses: number
): number {
  if (maxPasses === minPasses) return 18;
  const ratio = Math.max(0, Math.min(1, (totalPasses - minPasses) / (maxPasses - minPasses)));
  return 16 + ratio * 7;
}

/**
 * Maps Opta 0-100 node coordinates onto the vertical SVG pitch, applies
 * cluster-aware force-directed relaxation to avoid overlapping badges, and
 * alternates label positions above/below when vertical neighbors are close.
 */
export function buildRelaxedNodeMap(
  nodes: PassNetworkNode[],
  dimensions: PassNetworkDimensions = DEFAULT_PASS_NETWORK_DIMENSIONS
): Map<number, MappedPassNode> {
  const map = new Map<number, MappedPassNode>();
  if (nodes.length === 0) return map;

  const { pitchX, pitchY, pitchWidth, pitchHeight } = dimensions;
  const passValues = nodes.map((n) => n.total_passes);
  const minPasses = Math.min(...passValues);
  const maxPasses = Math.max(...passValues);

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const depthSpan = Math.max(35, maxX - minX);
  const latSpan = Math.max(30, maxY - minY);

  const positions = nodes.map((node) => {
    const depthT = Math.max(0, Math.min(1, (node.x - minX) / depthSpan));
    const targetYPct = 0.87 - depthT * (0.87 - 0.17);
    const initialY = pitchY + targetYPct * pitchHeight;

    // Higher Opta y represents the left flank -> viewer's left (smaller SVG x)
    const latU = Math.max(0, Math.min(1, (node.y - minY) / latSpan));
    const targetXPct = 0.86 - latU * (0.86 - 0.14);
    const initialX = pitchX + targetXPct * pitchWidth;

    return {
      node,
      px: initialX,
      py: initialY,
      radius: computeNodeRadius(node.total_passes, minPasses, maxPasses),
      optaName: formatOptaName(node.name),
    };
  });

  // Detect cluster congestion within 70px to keep dense midfield stacks legible
  const clusterCounts = positions.map((p1, idx) => {
    let neighbors = 0;
    for (let j = 0; j < positions.length; j++) {
      if (idx !== j && Math.hypot(positions[j].px - p1.px, positions[j].py - p1.py) < 70) {
        neighbors++;
      }
    }
    return neighbors;
  });

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
        const minReqDist = isClustered ? 46.0 : 40.0;

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

  positions.forEach((p) => {
    const marginX = p.radius + 10;
    const marginY = p.radius + 16;
    p.px = Math.max(pitchX + marginX, Math.min(pitchX + pitchWidth - marginX, p.px));
    p.py = Math.max(pitchY + marginY, Math.min(pitchY + pitchHeight - marginY, p.py));
  });

  positions.forEach((p1) => {
    const hasRoomAbove = p1.py - p1.radius - 14 >= pitchY;
    const isBottomOccupied = positions.some((p2) => {
      if (p2.node.player_id === p1.node.player_id) return false;
      const dy = p2.py - p1.py;
      const dx = Math.abs(p2.px - p1.px);
      return dy > 0 && dy < p1.radius + p2.radius + 26 && dx < 36;
    });

    const labelPos: 'top' | 'bottom' = isBottomOccupied && hasRoomAbove ? 'top' : 'bottom';
    map.set(p1.node.player_id, {
      ...p1,
      labelPos,
    });
  });

  return map;
}

/** Builds a fast `passer->receiver` lookup set for reciprocal edge detection. */
export function buildEdgeLookupSet(edges: PassNetworkEdge[]): Set<string> {
  const set = new Set<string>();
  edges.forEach((e) => {
    set.add(`${e.passer_id}->${e.receiver_id}`);
  });
  return set;
}

/** Computes SVG path curves and normalized scales for threshold-filtered pass edges. */
export function computeMappedPassEdges(
  filteredEdges: PassNetworkEdge[],
  nodeMap: Map<number, MappedPassNode>,
  edgePairSet: Set<string>
): MappedPassEdge[] {
  if (filteredEdges.length === 0) return [];
  const counts = filteredEdges.map((e) => e.pass_count);
  const minEdgeCount = Math.min(...counts);
  const maxEdgeCount = Math.max(...counts);

  const mapped: MappedPassEdge[] = [];

  filteredEdges.forEach((edge) => {
    const p1 = nodeMap.get(edge.passer_id);
    const p2 = nodeMap.get(edge.receiver_id);
    if (!p1 || !p2) return;

    const dx = p2.px - p1.px;
    const dy = p2.py - p1.py;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) return;

    const ratio =
      maxEdgeCount === minEdgeCount
        ? 0.5
        : Math.max(0, Math.min(1, (edge.pass_count - minEdgeCount) / (maxEdgeCount - minEdgeCount)));

    const baseStrokeWidth = 1.6 + ratio * 4.2;
    const baseOpacity = 0.3 + ratio * 0.45;

    const ux = dx / dist;
    const uy = dy / dist;
    const nx = -uy;
    const ny = ux;

    const isReciprocal = edgePairSet.has(`${edge.receiver_id}->${edge.passer_id}`);
    const curveOffset = isReciprocal ? 7 : 0;

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

    mapped.push({
      edge,
      pathData,
      baseStrokeWidth,
      baseOpacity,
      isReciprocal,
    });
  });

  return mapped;
}

/** Returns top passing connection partners (incoming + outgoing combined) for a hovered node. */
export function computeTopPassPartners(
  hoveredNode: PassNetworkNode | null,
  edges: PassNetworkEdge[],
  nodeMap: Map<number, MappedPassNode>,
  limit = 2
): PassPartnerSummary[] {
  if (!hoveredNode) return [];
  const countsByPartner = new Map<number, number>();

  edges.forEach((e) => {
    if (e.passer_id === hoveredNode.player_id) {
      countsByPartner.set(e.receiver_id, (countsByPartner.get(e.receiver_id) || 0) + e.pass_count);
    } else if (e.receiver_id === hoveredNode.player_id) {
      countsByPartner.set(e.passer_id, (countsByPartner.get(e.passer_id) || 0) + e.pass_count);
    }
  });

  return Array.from(countsByPartner.entries())
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
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Computes factual tactical spatial summary directly from node coordinates (0-100 Opta scale). */
export function computePassNetworkMetrics(
  nodes: PassNetworkNode[],
  filteredEdges: PassNetworkEdge[]
): PassNetworkTacticalMetrics {
  if (nodes.length === 0) {
    return {
      avgPassHeightPct: null,
      teamWidthPct: null,
      nodeDispersion: null,
      nodeCount: 0,
      visibleEdgeCount: filteredEdges.length,
    };
  }

  const avgX = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length;
  const avgY = nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length;
  const ys = nodes.map((n) => n.y);
  const teamWidthPct = Math.max(...ys) - Math.min(...ys);
  const meanSqDist =
    nodes.reduce((sum, n) => sum + Math.hypot(n.x - avgX, n.y - avgY), 0) / nodes.length;

  return {
    avgPassHeightPct: Number(avgX.toFixed(1)),
    teamWidthPct: Number(teamWidthPct.toFixed(1)),
    nodeDispersion: Number(meanSqDist.toFixed(1)),
    nodeCount: nodes.length,
    visibleEdgeCount: filteredEdges.length,
  };
}
