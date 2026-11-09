import React, { useState, useMemo } from 'react';
import {
  BeeswarmStripData,
  BeeswarmPoint,
  BeeswarmHoverState,
  DOM_X_MIN,
  DOM_WIDTH,
  PEER_RING_COLORS,
  generateNiceTicks,
  formatScatterTickLabel,
} from './scoutingFloor03Utils';

export const DOM_CANVAS_WIDTH = 720;
export const DOM_CANVAS_HEIGHT = 285;
export const DOM_SWARM_Y = 145;
export const DOM_AXIS_Y = 245;

export interface BeeswarmCardProps {
  strip: BeeswarmStripData;
  metricKey?: string;
  label?: string;
  similarPeers?: BeeswarmPoint[];
  peerColors?: string[];
  targetRingColor?: string;
  hoveredPoint?: BeeswarmHoverState | null;
  onHoverPoint?: (hover: BeeswarmHoverState | null) => void;
  onSelectPlayer?: (playerId: number) => void;
  playerAge?: number | null;
  resolvePlayerAge?: (item: any) => number | null;
  similarPlayersMap?: Map<number, any>;
  t?: any;
}

interface BeeswarmAvatarNodeProps {
  playerId: number;
  name: string;
  cx: number;
  themeColor: string;
  clipId: string;
  isTarget?: boolean;
  isHovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
}

const BeeswarmAvatarNode: React.FC<BeeswarmAvatarNodeProps> = ({
  playerId,
  name,
  cx,
  themeColor,
  clipId,
  isTarget = false,
  isHovered = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);
  const initials = useMemo(() => {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [name]);

  return (
    <g
      className="cursor-pointer select-none transition-transform duration-150"
      style={{ cursor: 'pointer' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {/* Outer Circle (White fill + Theme Color stroke) */}
      <circle
        cx={cx}
        cy={DOM_SWARM_Y}
        r={14}
        fill="#ffffff"
        stroke={themeColor}
        strokeWidth={isHovered ? 3 : isTarget ? 2.5 : 2}
      />

      {/* Clipped Headshot or Initials Fallback */}
      {!imgError ? (
        <image
          href={`/players/${playerId}.png`}
          x={cx - 13.5}
          y={DOM_SWARM_Y - 13.5}
          width={27}
          height={27}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMin slice"
          onError={() => setImgError(true)}
        />
      ) : (
        <g clipPath={`url(#${clipId})`}>
          <circle cx={cx} cy={DOM_SWARM_Y} r={13.5} fill={themeColor || '#64748B'} />
          <text
            x={cx}
            y={DOM_SWARM_Y}
            dy="0.35em"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="9"
            fontWeight="700"
            fontFamily="sans-serif"
            pointerEvents="none"
          >
            {initials}
          </text>
        </g>
      )}
    </g>
  );
};

export const BeeswarmCard: React.FC<BeeswarmCardProps> = ({
  strip,
  metricKey: propMetricKey,
  label: propLabel,
  similarPeers = [],
  peerColors = PEER_RING_COLORS,
  targetRingColor = '#1D4ED8',
  hoveredPoint,
  onHoverPoint,
  onSelectPlayer,
  playerAge,
  resolvePlayerAge,
  similarPlayersMap,
  t,
}) => {
  const metricKey = propMetricKey || strip.key;
  const label = propLabel || strip.label;

  // Domain & mapping to canonical [60, 690]
  const dMin = strip.domainMin !== undefined ? strip.domainMin : strip.minVal;
  const dMax = strip.domainMax !== undefined ? strip.domainMax : strip.maxVal;
  const dRange = dMax - dMin || 1;

  const mapValToX = (val: number): number => {
    const norm = (val - dMin) / dRange;
    return DOM_X_MIN + Math.max(0, Math.min(1, norm)) * DOM_WIDTH;
  };

  // Reference vertical line: league median benchmark
  const refNorm = (strip.medianVal - dMin) / dRange;
  const refX = DOM_X_MIN + Math.max(0, Math.min(1, refNorm)) * DOM_WIDTH;

  // Ticks calculation
  const ticks = useMemo(() => {
    if (strip.ticks && strip.ticks.length > 0) {
      return strip.ticks.map((t) => ({
        val: t.val,
        x: mapValToX(t.val),
        label: t.label,
      }));
    }
    const roundVals = generateNiceTicks(dMin, dMax, 6);
    const tickStep = roundVals.length >= 2 ? Math.abs(roundVals[1] - roundVals[0]) : 1;
    return roundVals.map((val) => ({
      val,
      x: mapValToX(val),
      label: formatScatterTickLabel(val, tickStep),
    }));
  }, [strip.ticks, dMin, dMax]);

  // Peer identification & filtering
  const similarPeerIds = useMemo(
    () => new Set(similarPeers.map((p) => p.player_id)),
    [similarPeers]
  );

  const neutralPoints = useMemo(
    () => strip.points.filter((p) => !p.isTarget && !similarPeerIds.has(p.player_id)),
    [strip.points, similarPeerIds]
  );

  const targetPoint = strip.targetPoint;

  // Prepare avatar nodes data for clipPaths and render
  const peerNodes = useMemo(() => {
    return similarPeers.map((pt, idx) => ({
      point: pt,
      cx: mapValToX(pt.val),
      themeColor: peerColors[idx % peerColors.length],
      clipId: `clip-swarm-peer-${metricKey}-${pt.player_id}-${idx}`,
    }));
  }, [similarPeers, peerColors, metricKey, dMin, dRange]);

  const targetNode = useMemo(() => {
    if (!targetPoint) return null;
    return {
      point: targetPoint,
      cx: mapValToX(targetPoint.val),
      themeColor: targetRingColor,
      clipId: `clip-swarm-target-${metricKey}-${targetPoint.player_id}`,
    };
  }, [targetPoint, targetRingColor, metricKey, dMin, dRange]);

  const allAvatarNodes = useMemo(() => {
    const nodes = [...peerNodes];
    if (targetNode) nodes.push(targetNode);
    return nodes;
  }, [peerNodes, targetNode]);

  return (
    <div className="relative w-full block select-none">
      <svg
        viewBox="0 0 720 285"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto block select-none"
        style={{
          background: '#fafafa',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
        }}
      >
        <rect width="720" height="285" rx="8" fill="#fafafa" />

        {/* ClipPath definitions for circular player avatars */}
        <defs>
          {allAvatarNodes.map((node) => (
            <clipPath key={node.clipId} id={node.clipId}>
              <circle cx={node.cx} cy={DOM_SWARM_Y} r={13.5} />
            </clipPath>
          ))}
        </defs>

        {/* Vertical Reference Guide: y1="38" y2={DOM_AXIS_Y}, stroke="#ccc", stroke-dasharray="3,3" */}
        <line
          x1={refX}
          y1={38}
          x2={refX}
          y2={DOM_AXIS_Y}
          stroke="#ccc"
          strokeDasharray="3,3"
        />

        {/* Metric Title: x="60" y="28" font-size="15" font-weight="600" fill="#222" */}
        <text
          x={60}
          y={28}
          fontSize="15"
          fontWeight="600"
          fill="#222"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {label}
        </text>

        {/* League Peer Points: cy="101", r="5", fill="#666", fill-opacity="0.5", stroke="#fff", stroke-width="1", cursor pointer */}
        <g className="league-points">
          {neutralPoints.map((pt) => {
            const isHovered =
              hoveredPoint?.player_id === pt.player_id &&
              hoveredPoint?.metricKey === metricKey;
            const cx = mapValToX(pt.val);

            return (
              <circle
                key={`neutral-${metricKey}-${pt.player_id}`}
                cx={cx}
                cy={DOM_SWARM_Y}
                r={5}
                fill="#666"
                fillOpacity={isHovered ? 1 : 0.5}
                stroke="#fff"
                strokeWidth={1}
                className="cursor-pointer transition-opacity duration-150"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() =>
                  onHoverPoint?.({
                    player_id: pt.player_id,
                    name: pt.name,
                    team_name: pt.team_name,
                    position: pt.position || pt.position_group,
                    position_group: pt.position_group,
                    minutes_played: pt.minutes_played,
                    age:
                      pt.age ??
                      (similarPlayersMap
                        ? resolvePlayerAge?.(similarPlayersMap.get(pt.player_id)) ?? null
                        : null),
                    val: pt.val,
                    metricLabel: label,
                    metricKey,
                    svgX: cx,
                    svgY: DOM_SWARM_Y,
                    isTarget: false,
                    percentile: pt.percentile,
                  })
                }
                onMouseLeave={() => onHoverPoint?.(null)}
              />
            );
          })}
        </g>

        {/* X-Axis in y=245: path domain stroke="#bbb" strokeWidth="1" d="M60,6V0H690V6", ticks con line y2="7" stroke="#bbb" strokeWidth="1" y texto y="11" dy="0.71em" fill="#444" font-size="11.5" */}
        <g
          transform={`translate(0, ${DOM_AXIS_Y})`}
          fill="none"
          fontSize="11.5"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          textAnchor="middle"
        >
          <path stroke="#bbb" strokeWidth="1" d="M60,6V0H690V6" />
          {ticks.map((tick, idx) => (
            <g key={`tick-${idx}`} transform={`translate(${tick.x}, 0)`}>
              <line y2={7} stroke="#bbb" strokeWidth={1} />
              <text y={11} dy="0.71em" fill="#444" fontSize="11.5">
                {tick.label}
              </text>
            </g>
          ))}
        </g>

        {/* Avatar Nodes: Similar Peers */}
        <g className="similar-peers">
          {peerNodes.map((node) => {
            const isHovered =
              hoveredPoint?.player_id === node.point.player_id &&
              hoveredPoint?.metricKey === metricKey;

            return (
              <BeeswarmAvatarNode
                key={`peer-node-${node.point.player_id}`}
                playerId={node.point.player_id}
                name={node.point.name}
                cx={node.cx}
                themeColor={node.themeColor}
                clipId={node.clipId}
                isTarget={false}
                isHovered={isHovered}
                onMouseEnter={() =>
                  onHoverPoint?.({
                    player_id: node.point.player_id,
                    name: node.point.name,
                    team_name: node.point.team_name,
                    position: node.point.position || node.point.position_group,
                    position_group: node.point.position_group,
                    minutes_played: node.point.minutes_played,
                    age:
                      node.point.age ??
                      (similarPlayersMap
                        ? resolvePlayerAge?.(similarPlayersMap.get(node.point.player_id)) ?? null
                        : null),
                    val: node.point.val,
                    metricLabel: label,
                    metricKey,
                    svgX: node.cx,
                    svgY: DOM_SWARM_Y,
                    isTarget: false,
                    percentile: node.point.percentile,
                  })
                }
                onMouseLeave={() => onHoverPoint?.(null)}
                onClick={() => onSelectPlayer?.(node.point.player_id)}
              />
            );
          })}
        </g>

        {/* Avatar Node: Target Player (Rendered on top for prominence) */}
        {targetNode && (
          <g className="target-player">
            <BeeswarmAvatarNode
              playerId={targetNode.point.player_id}
              name={targetNode.point.name}
              cx={targetNode.cx}
              themeColor={targetNode.themeColor}
              clipId={targetNode.clipId}
              isTarget={true}
              isHovered={
                hoveredPoint?.player_id === targetNode.point.player_id &&
                hoveredPoint?.metricKey === metricKey
              }
              onMouseEnter={() =>
                onHoverPoint?.({
                  player_id: targetNode.point.player_id,
                  name: targetNode.point.name,
                  team_name: targetNode.point.team_name,
                  position: targetNode.point.position || targetNode.point.position_group,
                  position_group: targetNode.point.position_group,
                  minutes_played: targetNode.point.minutes_played,
                  age: targetNode.point.age ?? playerAge ?? null,
                  val: targetNode.point.val,
                  metricLabel: label,
                  metricKey,
                  svgX: targetNode.cx,
                  svgY: DOM_SWARM_Y,
                  isTarget: true,
                  percentile: strip.percentile,
                })
              }
              onMouseLeave={() => onHoverPoint?.(null)}
            />
          </g>
        )}
      </svg>

      {/* Interactive Floating Tooltip (Dark Minimalist Overlay) */}
      {hoveredPoint && hoveredPoint.metricKey === metricKey && (
        <div
          className="export-ignore absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full -mt-2.5 bg-[#18181b] text-white p-2.5 rounded-lg shadow-xl border border-zinc-700/50 text-left min-w-[170px]"
          style={{
            left: `${Math.max(12, Math.min(88, (hoveredPoint.svgX / DOM_CANVAS_WIDTH) * 100))}%`,
            top: `${(DOM_SWARM_Y / DOM_CANVAS_HEIGHT) * 100}%`,
          }}
        >
          <div className="text-[12.5px] font-bold text-white tracking-tight leading-tight">
            {hoveredPoint.name}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
            {hoveredPoint.team_name || 'Liga 1'} ·{' '}
            {(() => {
              const rawPos =
                hoveredPoint.position === 'D'
                  ? 'Full Back'
                  : hoveredPoint.position ||
                    hoveredPoint.position_group ||
                    t?.floor3?.playerFallback ||
                    'Player';
              return t?.floor1?.roles?.[rawPos] || rawPos;
            })()}
          </div>
          <div className="text-[9.5px] text-zinc-400 mt-0.5">
            {t?.floor3?.ageLabel || 'Edad'}{' '}
            {hoveredPoint.age ??
              (hoveredPoint.isTarget ? playerAge : null) ??
              (similarPlayersMap
                ? resolvePlayerAge?.(similarPlayersMap.get(hoveredPoint.player_id))
                : null) ??
              '—'}{' '}
            · {t?.floor3?.minLabel || 'Min'}{' '}
            {hoveredPoint.minutes_played != null
              ? hoveredPoint.minutes_played.toLocaleString()
              : '—'}
          </div>
          <div className="border-t border-zinc-700/60 my-2" />
          <div className="text-[11px] font-medium text-zinc-300 flex justify-between gap-3">
            <span>{hoveredPoint.metricLabel}:</span>
            <span className="font-mono font-bold text-white">
              {hoveredPoint.val.toFixed(1)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
