import React, { useState, useMemo } from 'react';
import {
  ScatterPoint,
  SCATTER_CANVAS_WIDTH,
  SCATTER_CANVAS_HEIGHT,
  SCATTER_X_MIN,
  SCATTER_X_WIDTH,
  SCATTER_Y_BOTTOM,
  SCATTER_Y_HEIGHT,
  PEER_RING_COLORS,
  generateNiceTicks,
  formatScatterTickLabel,
} from './scoutingFloor03Utils';

export interface ScatterPlotCardProps {
  rawPoints?: ScatterPoint[];
  backgroundPeerPoints?: ScatterPoint[];
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  medianX?: number;
  medianY?: number;
  xTicks?: number[];
  yTicks?: number[];
  metricXLabel: string;
  metricYLabel: string;
  xStep?: number;
  yStep?: number;
  highlightedPeers?: ScatterPoint[];
  targetPoint?: ScatterPoint | null;
  clubTextColor?: string;
  peerRingColors?: string[];
  hoveredPoint?: ScatterPoint | null;
  onHoverPoint?: (pt: ScatterPoint | null) => void;
  onSelectPlayer?: (id: number) => void;
  playerAge?: number | null;
  resolvePlayerAge?: (item: any) => number | string | null;
  similarPlayersMap?: Map<number, any>;
  t: any;
}

interface ScatterAvatarNodeProps {
  pt: ScatterPoint;
  svgX: number;
  svgY: number;
  ringColor: string;
  isTarget?: boolean;
  isHovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
}

const ScatterAvatarNode: React.FC<ScatterAvatarNodeProps> = ({
  pt,
  svgX,
  svgY,
  ringColor,
  isTarget = false,
  isHovered = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);
  const initials = useMemo(() => {
    if (!pt.name) return '?';
    return pt.name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [pt.name]);

  return (
    <g
      className="cutout cursor-pointer select-none transition-transform duration-150"
      style={{ cursor: 'pointer' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {/* Base circle */}
      <circle
        cx={svgX}
        cy={svgY}
        r={isHovered ? 16 : 15}
        fill="#ffffff"
        stroke={ringColor}
        strokeWidth={isHovered ? 3.5 : isTarget ? 3 : 2}
      />

      {/* Clipped headshot or SVG fallback */}
      {!imgError ? (
        <image
          href={`/players/${pt.player_id}.png`}
          x={svgX - 14}
          y={svgY - 14}
          width={28}
          height={28}
          clipPath={`url(#scatter-clip-${pt.player_id})`}
          preserveAspectRatio="xMidYMin slice"
          onError={() => setImgError(true)}
        />
      ) : (
        <g clipPath={`url(#scatter-clip-${pt.player_id})`}>
          <circle cx={svgX} cy={svgY} r={14} fill={ringColor || '#64748B'} />
          <text
            x={svgX}
            y={svgY}
            dy="0.35em"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="10"
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

export const ScatterPlotCard: React.FC<ScatterPlotCardProps> = ({
  rawPoints = [],
  backgroundPeerPoints,
  minX,
  maxX,
  minY,
  maxY,
  medianX,
  medianY,
  xTicks,
  yTicks,
  metricXLabel,
  metricYLabel,
  xStep,
  yStep,
  highlightedPeers = [],
  targetPoint,
  clubTextColor = '#1D4ED8',
  peerRingColors = PEER_RING_COLORS,
  hoveredPoint,
  onHoverPoint,
  onSelectPlayer,
  playerAge,
  resolvePlayerAge,
  similarPlayersMap,
  t,
}) => {
  // Domain resolution
  const effMinX = minX !== undefined ? minX : 0;
  const effMaxX = maxX !== undefined ? maxX : 100;
  const effMinY = minY !== undefined ? minY : 0;
  const effMaxY = maxY !== undefined ? maxY : 100;
  const effMedianX = medianX !== undefined ? medianX : (effMinX + effMaxX) / 2;
  const effMedianY = medianY !== undefined ? medianY : (effMinY + effMaxY) / 2;

  // Canonical mapping functions: X in [60, 610] (width 550), Y in [490, 30] (height 460)
  const mapSvgX = (xVal: number) =>
    SCATTER_X_MIN + ((xVal - effMinX) / (effMaxX - effMinX || 1)) * SCATTER_X_WIDTH;

  const mapSvgY = (yVal: number) =>
    SCATTER_Y_BOTTOM - ((yVal - effMinY) / (effMaxY - effMinY || 1)) * SCATTER_Y_HEIGHT;

  const medianSvgX = mapSvgX(effMedianX);
  const medianSvgY = mapSvgY(effMedianY);

  // Ticks generation
  const ticksX = useMemo(() => {
    const vals =
      xTicks && xTicks.length > 0 ? xTicks : generateNiceTicks(effMinX, effMaxX, 6);
    const step = xStep ?? (vals.length >= 2 ? Math.abs(vals[1] - vals[0]) : 1);
    return vals.map((v) => ({
      val: v,
      x: mapSvgX(v),
      label: formatScatterTickLabel(v, step),
    }));
  }, [xTicks, xStep, effMinX, effMaxX]);

  const ticksY = useMemo(() => {
    const vals =
      yTicks && yTicks.length > 0 ? yTicks : generateNiceTicks(effMinY, effMaxY, 6);
    const step = yStep ?? (vals.length >= 2 ? Math.abs(vals[1] - vals[0]) : 1);
    return vals.map((v) => ({
      val: v,
      y: mapSvgY(v),
      label: formatScatterTickLabel(v, step),
    }));
  }, [yTicks, yStep, effMinY, effMaxY]);

  // Peer identification & segmentation
  const highlightedIds = useMemo(
    () => new Set(highlightedPeers.map((p) => p.player_id)),
    [highlightedPeers]
  );

  const neutralPoints = useMemo(
    () =>
      backgroundPeerPoints ||
      rawPoints.filter((p) => !p.isTarget && !highlightedIds.has(p.player_id)),
    [backgroundPeerPoints, rawPoints, highlightedIds]
  );

  const allAvatarPoints = useMemo(() => {
    const list = [...highlightedPeers];
    if (targetPoint && !highlightedIds.has(targetPoint.player_id)) {
      list.push(targetPoint);
    }
    return list;
  }, [highlightedPeers, targetPoint, highlightedIds]);

  return (
    <div
      className="relative w-full h-full flex flex-col justify-center items-center select-none"
      style={{
        background: '#fafafa',
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        padding: '8px',
        boxSizing: 'border-box',
      }}
    >
      <div className="relative w-full h-full flex flex-col justify-center items-center">
        <svg
          viewBox={`0 0 ${SCATTER_CANVAS_WIDTH} ${SCATTER_CANVAS_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-auto block select-none"
          style={{
            background: '#fafafa',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
          }}
        >
          {/* Background Canvas: fondo #fafafa, border-radius 8px */}
          <rect
            width={SCATTER_CANVAS_WIDTH}
            height={SCATTER_CANVAS_HEIGHT}
            rx={8}
            fill="#fafafa"
          />

          {/* ClipPaths for Avatar Nodes */}
          <defs>
            {allAvatarPoints.map((pt) => {
              const svgX = mapSvgX(pt.x);
              const svgY = mapSvgY(pt.y);
              return (
                <clipPath
                  key={`scatter-clip-${pt.player_id}`}
                  id={`scatter-clip-${pt.player_id}`}
                >
                  <circle cx={svgX} cy={svgY} r={14} />
                </clipPath>
              );
            })}
          </defs>

          {/* Median Reference Lines / Quadrant Crosshairs */}
          {/* Horizontal Median */}
          <line
            x1={60}
            y1={medianSvgY}
            x2={610}
            y2={medianSvgY}
            stroke="#ccc"
            strokeDasharray="3,3"
          />
          {/* Vertical Median */}
          <line
            x1={medianSvgX}
            y1={30}
            x2={medianSvgX}
            y2={490}
            stroke="#ccc"
            strokeDasharray="3,3"
          />

          {/* Eje X: transform="translate(0, 490)", path domain stroke="#bbb" d="M60,6V0H610V6" */}
          <g
            transform="translate(0, 490)"
            fill="none"
            fontSize="11"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            textAnchor="middle"
          >
            <path stroke="#bbb" d="M60,6V0H610V6" />
            {ticksX.map((tick, idx) => (
              <g key={`xtick-${idx}`} transform={`translate(${tick.x}, 0)`}>
                <line y2={6} stroke="#bbb" />
                <text y={9} dy="0.71em" fill="#444" fontSize="11">
                  {tick.label}
                </text>
              </g>
            ))}
          </g>

          {/* Título Eje X centrado abajo */}
          <text
            x={335}
            y={525}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="#222"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            className="select-none pointer-events-none"
          >
            {metricXLabel}
          </text>

          {/* Eje Y: transform="translate(60, 0)", path domain stroke="#bbb" d="M-6,490H0V30H-6" */}
          <g
            transform="translate(60, 0)"
            fill="none"
            fontSize="11"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            <path stroke="#bbb" d="M-6,490H0V30H-6" />
            {ticksY.map((tick, idx) => (
              <g key={`ytick-${idx}`} transform={`translate(0, ${tick.y})`}>
                <line x2={-6} stroke="#bbb" />
                <text x={-9} dy="0.32em" fill="#444" fontSize="11" textAnchor="end">
                  {tick.label}
                </text>
              </g>
            ))}
          </g>

          {/* Título Eje Y rotado -90° */}
          <text
            x={16}
            y={260}
            textAnchor="middle"
            transform="rotate(-90 16 260)"
            fontSize="12"
            fontWeight="600"
            fill="#222"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            className="select-none pointer-events-none"
          >
            {metricYLabel}
          </text>

          {/* Puntos Neutros de Liga: r="5", fill="#666", fillOpacity=0.5 */}
          <g className="neutral-points">
            {neutralPoints.map((pt) => {
              const isHovered = hoveredPoint?.player_id === pt.player_id;
              const svgX = mapSvgX(pt.x);
              const svgY = mapSvgY(pt.y);

              return (
                <circle
                  key={`peer-${pt.player_id}`}
                  cx={svgX}
                  cy={svgY}
                  r={isHovered ? 6 : 5}
                  fill={isHovered ? '#0F172A' : '#666'}
                  fillOpacity={isHovered ? 1 : 0.5}
                  stroke="#fff"
                  strokeWidth={1}
                  className="cursor-pointer transition-all duration-150"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => onHoverPoint?.(pt)}
                  onMouseLeave={() => onHoverPoint?.(null)}
                />
              );
            })}
          </g>

          {/* Nodos de Avatares Nativos en SVG: Highlighted Peers */}
          <g className="highlighted-peers">
            {highlightedPeers.map((pt, pIdx) => {
              const ringColor = peerRingColors[pIdx % peerRingColors.length];
              const isHovered = hoveredPoint?.player_id === pt.player_id;
              const svgX = mapSvgX(pt.x);
              const svgY = mapSvgY(pt.y);

              return (
                <ScatterAvatarNode
                  key={`avatar-peer-${pt.player_id}`}
                  pt={pt}
                  svgX={svgX}
                  svgY={svgY}
                  ringColor={ringColor}
                  isTarget={false}
                  isHovered={isHovered}
                  onMouseEnter={() => onHoverPoint?.(pt)}
                  onMouseLeave={() => onHoverPoint?.(null)}
                  onClick={() => onSelectPlayer?.(pt.player_id)}
                />
              );
            })}
          </g>

          {/* Nodo de Avatar Nativo en SVG: Target Player (on top) */}
          {targetPoint && (
            <g className="target-player">
              <ScatterAvatarNode
                pt={targetPoint}
                svgX={mapSvgX(targetPoint.x)}
                svgY={mapSvgY(targetPoint.y)}
                ringColor={clubTextColor}
                isTarget={true}
                isHovered={hoveredPoint?.player_id === targetPoint.player_id}
                onMouseEnter={() => onHoverPoint?.(targetPoint)}
                onMouseLeave={() => onHoverPoint?.(null)}
              />
            </g>
          )}
        </svg>

        {/* Capa de Tooltip Interactivo HTML Absoluto */}
        {hoveredPoint && (() => {
          const hSvgX = mapSvgX(hoveredPoint.x);
          const hSvgY = mapSvgY(hoveredPoint.y);
          const leftPct = Math.max(12, Math.min(88, (hSvgX / SCATTER_CANVAS_WIDTH) * 100));
          const topPct = (hSvgY / SCATTER_CANVAS_HEIGHT) * 100;
          const isTopCramped = hSvgY < 120;

          return (
            <div
              className={`export-ignore absolute z-50 pointer-events-none transform -translate-x-1/2 bg-[#18181b] text-white p-2.5 rounded-lg shadow-xl border border-zinc-700/50 text-left min-w-[170px] ${
                isTopCramped ? 'translate-y-3' : '-translate-y-full -mt-2.5'
              }`}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
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
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-zinc-300 flex justify-between gap-3">
                  <span>{metricXLabel}:</span>
                  <span className="font-mono font-bold text-white">
                    {hoveredPoint.x.toFixed(1)}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-zinc-300 flex justify-between gap-3">
                  <span>{metricYLabel}:</span>
                  <span className="font-mono font-bold text-white">
                    {hoveredPoint.y.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
