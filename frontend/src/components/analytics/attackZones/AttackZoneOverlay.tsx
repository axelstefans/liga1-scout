import React from 'react';
import {
  ATTACK_ZONES_PITCH_DIMENSIONS,
  AttackZoneChannelId,
  AttackZoneData,
  AttackZoneDimensions,
  AttackZoneMode,
  CHANNEL_CONFIG,
  ZoneMetricSummary,
  computeChannelHeatmapOpacity,
  getHeatmapIntensityColor,
  getLaneGeometry,
} from './attackZonesGeometry';

export interface AttackZoneOverlayProps {
  channelDataMap: Map<string, AttackZoneData>;
  summary: ZoneMetricSummary;
  maxShare: number;
  activeChannelId: string | null;
  mode: AttackZoneMode;
  dimensions?: AttackZoneDimensions;
  onChannelMouseMove: (e: React.MouseEvent<SVGGElement>, channelId: AttackZoneChannelId) => void;
  onChannelMouseLeave: () => void;
  onChannelClick: (channelId: AttackZoneChannelId) => void;
}

/**
 * SVG overlay projecting the 5 tactical attacking lanes, final-third dividers,
 * progression directional arrows, volume percentages, and xG threat badges inside SoccerPitchCanvas.
 */
export const AttackZoneOverlay: React.FC<AttackZoneOverlayProps> = ({
  channelDataMap,
  summary,
  maxShare,
  activeChannelId,
  mode,
  dimensions = ATTACK_ZONES_PITCH_DIMENSIONS,
  onChannelMouseMove,
  onChannelMouseLeave,
  onChannelClick,
}) => {
  const { PITCH_X, PITCH_Y, PITCH_WIDTH, MIDFIELD_Y, FINAL_THIRD_Y, LANE_WIDTH } = dimensions;

  return (
    <>
      {/* 1. 5 Tactical Channels Heatmap Fill (Final Third: x >= 65% to 100%) */}
      {CHANNEL_CONFIG.map((cfg, idx) => {
        const lane = getLaneGeometry(idx, cfg.id, dimensions);
        const chData = channelDataMap.get(cfg.id);
        const sharePct = chData?.share_pct ?? 0;
        const isHovered = activeChannelId === cfg.id;
        const fillOpacity = computeChannelHeatmapOpacity(sharePct, maxShare, isHovered);
        const fillColor = getHeatmapIntensityColor(sharePct, maxShare);
        const isDominant = cfg.id === summary.dominant_channel;

        return (
          <g
            key={`channel-fill-${cfg.id}`}
            className="cursor-pointer transition-all"
            onMouseMove={(e) => onChannelMouseMove(e, cfg.id)}
            onMouseLeave={onChannelMouseLeave}
            onClick={() => onChannelClick(cfg.id)}
          >
            {/* Heated lane background */}
            <rect
              x={lane.x}
              y={lane.y}
              width={lane.width}
              height={lane.height}
              fill={fillColor}
              fillOpacity={fillOpacity}
            />

            {/* Dominant Channel outline */}
            {isDominant && !isHovered && (
              <rect
                x={lane.x}
                y={lane.y}
                width={lane.width}
                height={lane.height}
                fill="none"
                stroke="#C2410C"
                strokeWidth={1.5}
                strokeOpacity={0.65}
              />
            )}

            {/* Hovered/Selected Accent Border */}
            {isHovered && (
              <rect
                x={lane.x}
                y={lane.y}
                width={lane.width}
                height={lane.height}
                fill="none"
                stroke="#C2410C"
                strokeWidth={2.5}
              />
            )}

            {/* Subtle upward progression vector arrow at entry threshold */}
            {sharePct > 0 && (
              <g
                opacity={isHovered ? 0.9 : isDominant ? 0.65 : 0.35}
                stroke="#9A3412"
                fill="none"
                pointerEvents="none"
              >
                <line
                  x1={lane.centerX}
                  y1={FINAL_THIRD_Y + 26}
                  x2={lane.centerX}
                  y2={FINAL_THIRD_Y - 8}
                  strokeWidth={isDominant ? 2 : 1.5}
                  strokeLinecap="round"
                />
                <path
                  d={`M ${lane.centerX - 4} ${FINAL_THIRD_Y - 2} L ${lane.centerX} ${FINAL_THIRD_Y - 9} L ${lane.centerX + 4} ${FINAL_THIRD_Y - 2}`}
                  strokeWidth={isDominant ? 2 : 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            )}
          </g>
        );
      })}

      {/* 2. Final Third Boundary Line (Horizontal dashed line at y=327) */}
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

      {/* 3. 4 Vertical Dashed Lines dividing pitch into 5 tactical lanes */}
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

      {/* 4. In-Pitch Channel Labels, Percentages & Threat Badges */}
      {CHANNEL_CONFIG.map((cfg, idx) => {
        const lane = getLaneGeometry(idx, cfg.id, dimensions);
        const chData = channelDataMap.get(cfg.id);
        const sharePct = chData?.share_pct ?? 0;
        const entriesCount = chData?.entries_count ?? 0;
        const boxCount = chData?.box_infiltrations ?? 0;
        const threatXg = chData?.threat_xg ?? 0;
        const threatPct = chData?.threat_pct ?? 0;
        const isDominant = cfg.id === summary.dominant_channel;

        return (
          <g key={`channel-labels-${cfg.id}`} pointerEvents="none">
            {/* Dominant Channel Highlight Badge */}
            {isDominant && (
              <g filter="url(#dominantBadgeShadow)">
                <rect
                  x={lane.centerX - 35}
                  y={196}
                  width={70}
                  height={15}
                  rx={7.5}
                  fill="#C2410C"
                />
                <text
                  x={lane.centerX}
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
              x={lane.centerX}
              y={isDominant ? 224 : 214}
              textAnchor="middle"
              className="text-[11px] font-bold fill-[#4A3525]/85 tracking-tight"
            >
              {cfg.abbr}
            </text>

            {/* Big Bold Percentage */}
            <text
              x={lane.centerX}
              y={244}
              textAnchor="middle"
              className="text-[19px] font-extrabold fill-[#4A3525] tracking-tight"
            >
              {sharePct}%
            </text>

            {/* Sub-label: 2-line layout preventing lane collisions */}
            <text
              x={lane.centerX}
              y={262}
              textAnchor="middle"
              className="font-semibold select-none"
            >
              <tspan x={lane.centerX} dy="0" fontSize="10" fill="#78350F">
                {entriesCount} entradas
              </tspan>
              <tspan x={lane.centerX} dy="12" fontSize="9.5" fill="#92400E">
                {boxCount} al área
              </tspan>
            </text>

            {/* In-Pitch Threat Indicator Pill: {xG/xGA} {threat_xg} ({threat_pct}%) */}
            <g>
              <rect
                x={lane.centerX - 39}
                y={292}
                width={78}
                height={17}
                rx={4}
                fill="#3D2817"
              />
              <text
                x={lane.centerX}
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
    </>
  );
};

export default AttackZoneOverlay;
