import React from 'react';
import type { PassNetworkEdge, PassNetworkNode } from '../../../services/api';
import type {
  MappedPassEdge,
  MappedPassNode,
  PassNetworkDimensions,
} from './passNetworkGeometry';

export interface PassNetworkSvgDefsProps {
  teamColor: string;
  idPrefix: string;
}

/** SVG filter & arrowhead definitions injected into SoccerPitchCanvas `defs`. */
export const PassNetworkSvgDefs: React.FC<PassNetworkSvgDefsProps> = ({
  teamColor,
  idPrefix,
}) => (
  <>
    <filter id={`${idPrefix}-nodeShadow`} x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.22" />
    </filter>
    <marker
      id={`${idPrefix}-arrow`}
      viewBox="0 0 6 6"
      refX="5"
      refY="3"
      markerWidth="4"
      markerHeight="4"
      orient="auto-start-reverse"
    >
      <path d="M 0 1 L 5 3 L 0 5 z" fill={teamColor} fillOpacity="0.85" />
    </marker>
    <marker
      id={`${idPrefix}-arrowActive`}
      viewBox="0 0 6 6"
      refX="5"
      refY="3"
      markerWidth="4.5"
      markerHeight="4.5"
      orient="auto-start-reverse"
    >
      <path d="M 0 1 L 5 3 L 0 5 z" fill="#0f172a" />
    </marker>
  </>
);

export interface PassNetworkGraphOverlayProps {
  dimensions: PassNetworkDimensions;
  nodeMap: Map<number, MappedPassNode>;
  mappedEdges: MappedPassEdge[];
  edges: PassNetworkEdge[];
  minPassThreshold: number;
  hoveredNode: PassNetworkNode | null;
  teamColor: string;
  idPrefix: string;
  onNodeHover: (node: PassNetworkNode, targetEl: SVGGElement) => void;
  onNodeLeave: () => void;
}

/** Renders attacking direction cue, pass edges with arrows, and interactive Opta player nodes. */
export const PassNetworkGraphOverlay: React.FC<PassNetworkGraphOverlayProps> = ({
  dimensions,
  nodeMap,
  mappedEdges,
  edges,
  minPassThreshold,
  hoveredNode,
  teamColor,
  idPrefix,
  onNodeHover,
  onNodeLeave,
}) => {
  const { pitchX, pitchY, pitchWidth } = dimensions;

  return (
    <>
      {/* Direction of Attack Header */}
      <g opacity="0.8">
        <text
          x={pitchX + pitchWidth / 2}
          y={pitchY - 14}
          textAnchor="middle"
          className="text-[10px] font-semibold fill-slate-500 tracking-wider uppercase select-none"
        >
          DIRECCIÓN DE ATAQUE ↑
        </text>
      </g>

      {/* Pass Lines / Edges */}
      <g className="transition-all duration-200">
        {mappedEdges.map(({ edge, pathData, baseStrokeWidth, baseOpacity }, idx) => {
          const isConnected =
            hoveredNode !== null &&
            (edge.passer_id === hoveredNode.player_id || edge.receiver_id === hoveredNode.player_id);

          let opacity = baseOpacity;
          if (hoveredNode) {
            opacity = isConnected ? 0.95 : 0.05;
          }

          const markerUrl = isConnected
            ? `url(#${idPrefix}-arrowActive)`
            : `url(#${idPrefix}-arrow)`;

          return (
            <path
              key={`edge-${edge.passer_id}-${edge.receiver_id}-${idx}`}
              d={pathData}
              fill="none"
              stroke={isConnected ? '#0f172a' : teamColor}
              strokeWidth={isConnected ? baseStrokeWidth + 1.2 : baseStrokeWidth}
              strokeOpacity={opacity}
              strokeLinecap="round"
              markerEnd={opacity > 0.05 ? markerUrl : undefined}
              className="transition-all duration-150"
            />
          );
        })}
      </g>

      {/* Player Nodes (Opta Aesthetic) */}
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
              onMouseEnter={(e) => onNodeHover(node, e.currentTarget)}
              onMouseLeave={onNodeLeave}
            >
              <circle
                cx={info.px}
                cy={info.py}
                r={isHovered ? r + 2.5 : r}
                fill={teamColor}
                stroke="#ffffff"
                strokeWidth={isHovered ? 2.5 : 2}
                filter={`url(#${idPrefix}-nodeShadow)`}
                className="transition-all duration-150"
              />

              <text
                x={info.px}
                y={info.py + 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-xs font-bold fill-white select-none pointer-events-none"
              >
                {node.jersey && node.jersey > 0 ? node.jersey : info.optaName.slice(0, 2).toUpperCase()}
              </text>

              <text
                x={info.px}
                y={info.labelPos === 'top' ? info.py - r - 7 : info.py + r + 13}
                textAnchor="middle"
                style={{
                  paintOrder: 'stroke fill',
                  stroke: '#faf8f5',
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
    </>
  );
};
