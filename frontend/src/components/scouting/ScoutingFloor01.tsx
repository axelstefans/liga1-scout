import React from 'react';
import {
  PlayerProfile,
  PlayerSeasonStats,
  PlayerMatchStats,
  PlayerRankingEntry,
} from '../../services/api';
import { ScoutingLang, ScoutingTranslations } from '../../i18n/scoutingReport';
import { getTeamCrestUrl } from '../../utils/teams';
import TimeInPosition from '../TimeInPosition';

export interface RadarMetricDef {
  key: string;
  pctKey: keyof PlayerSeasonStats;
  label: string;
  shortLabel: string;
  category: 'Attacking' | 'Passing' | 'Defending';
  color: string;
  hoverColor: string;
  isPercentage?: boolean;
}

export interface RadarGeometryItem {
  metric: RadarMetricDef;
  pct: number;
  pathData: string;
  badgeX: number;
  badgeY: number;
  labelX: number;
  labelY: number;
  textAnchor: 'start' | 'end' | 'middle';
  rOuter: number;
  formattedValue: string;
  ray: { x1: number; y1: number; x2: number; y2: number };
}

export interface ScoutingFloor01Props {
  t: ScoutingTranslations;
  lang: ScoutingLang;
  playerId: number;
  playerName: string;
  profile: PlayerProfile | undefined;
  seasonStats: PlayerSeasonStats | undefined;
  matchStats: PlayerMatchStats[] | undefined;
  positionLabel: string;
  playerAge: number | null;
  countryCode: string;
  cohortHeaderLabel: string;
  activeMetrics: RadarMetricDef[];
  radarGeometry: RadarGeometryItem[];
  hoveredMetric: string | null;
  setHoveredMetric: React.Dispatch<React.SetStateAction<string | null>>;
  clubThemeColor: string;
  clubTextColor: string;
  clubTextRgb: { r: number; g: number; b: number };
  radarBadgeTextColor: string;
  getSplitMetricLabel: (metricKey: string, fallbackLabel: string) => [string, string | null];
  currentLeaderboardStat: string;
  activeHoveredMetricDef: RadarMetricDef | null;
  radarMetrics: RadarMetricDef[];
  isTopPlayersLoading: boolean;
  topPlayers: PlayerRankingEntry[];
}

export const RADAR_CENTER_X = 350;
export const RADAR_CENTER_Y = 350;
export const RADAR_MAX_RADIUS = 230;
export const RADAR_LABEL_RADIUS = 256;

const ScoutingFloor01: React.FC<ScoutingFloor01Props> = ({
  t,
  lang,
  playerId,
  playerName,
  profile,
  seasonStats,
  matchStats,
  positionLabel,
  playerAge,
  countryCode,
  cohortHeaderLabel,
  activeMetrics,
  radarGeometry,
  hoveredMetric,
  setHoveredMetric,
  clubThemeColor,
  clubTextColor,
  clubTextRgb,
  radarBadgeTextColor,
  getSplitMetricLabel,
  currentLeaderboardStat,
  activeHoveredMetricDef,
  radarMetrics,
  isTopPlayersLoading,
  topPlayers,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.2fr_1.1fr_1.1fr_1.1fr] gap-[8px] w-full items-stretch">
      {/* COLUMN 1 (card, 0.9fr): Bio Card + Standalone Percentile Mini-Table */}
      <div className="w-full h-full flex flex-col gap-[8px] min-w-0">
        {/* Card 1: Player Bio Card (Top) */}
        <div className="bg-[#fafafa] border border-[#e0e0e0] rounded-[6px] p-[8px] flex flex-col justify-start box-border flex-[1.3_1_0px] overflow-hidden">
          {/* White Inner Container */}
          <div className="w-full bg-white border border-[#e0e0e0] rounded-[6px] p-3 flex flex-col items-center gap-[10px] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            {/* Top Identity Row (3 elements: Crest, Name/Club, Liga 1 Logo) */}
            <div className="flex items-center justify-between w-full px-1">
              <img
                src={getTeamCrestUrl(profile?.team?.team_id, profile?.team?.logo_url)}
                alt=""
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== '/liga1-logo.png') {
                    target.src = '/liga1-logo.png';
                  }
                }}
                className="w-[32px] h-[32px] object-contain shrink-0"
              />
              <div className="min-w-0 text-center">
                <div className="text-[14px] font-bold text-[#1a1d1c] leading-tight">
                  {playerName}
                </div>
                <div className="text-[12px] text-[#666666] mt-[1px] leading-tight">
                  {profile?.team?.name || 'Alianza Lima'}
                </div>
              </div>
              <img
                src="/liga1-logo.png"
                alt="Liga 1"
                className="w-[28px] h-[28px] object-contain shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            {/* Centered Circular Photo */}
            <img
              src={`/players/${playerId}.png`}
              alt={playerName}
              className="w-[95px] h-[95px] rounded-full object-cover shrink-0 my-1"
              onError={(e) => {
                const target = e.currentTarget;
                target.onerror = null;
                target.src = '/liga1-logo.png';
              }}
            />

            {/* Demographic Data Grid (6 rows) */}
            <div className="grid grid-cols-[auto_1fr] gap-x-[12px] gap-y-[3px] w-full text-[11px] mt-1">
              <span className="text-[#888888] font-normal text-left">{t.floor1.position}</span>
              <span className="text-[#1a1d1c] font-semibold text-left">
                {positionLabel}
              </span>

              <span className="text-[#888888] font-normal text-left">{t.floor1.age}</span>
              <span className="text-[#1a1d1c] font-semibold text-left">
                {playerAge || 24}
              </span>

              <span className="text-[#888888] font-normal text-left">{t.floor1.minutes}</span>
              <span className="text-[#1a1d1c] font-semibold text-left">
                {(seasonStats?.minutes_played || 1869).toLocaleString()}
              </span>

              <span className="text-[#888888] font-normal text-left">{t.floor1.country}</span>
              <span className="text-[#1a1d1c] font-semibold text-left flex items-center gap-1">
                <img
                  src={`https://flagcdn.com/w20/${countryCode}.png`}
                  crossOrigin="anonymous"
                  alt=""
                  className="w-3.5 h-2.5 object-cover rounded-xs shrink-0"
                />
                <span>
                  {t.floor1.countries[(profile?.nationality || 'peru').toLowerCase()] ||
                    profile?.nationality ||
                    t.floor1.countries.peru}
                </span>
              </span>

              <span className="text-[#888888] font-normal text-left">{t.floor1.shirtNumber}</span>
              <span className="text-[#1a1d1c] font-semibold text-left">
                {profile?.shirt_number || '23'}
              </span>

              <span className="text-[#888888] font-normal text-left">{t.floor1.league}</span>
              <span className="text-[#1a1d1c] font-semibold text-left">Liga 1</span>
            </div>
          </div>
        </div>

        {/* Card 2: Standalone Percentile Mini-Table (Bottom) */}
        <div className="bg-[#fafafa] border border-[#e0e0e0] rounded-[6px] p-[8px] flex flex-col justify-start box-border flex-[1_1_0px] overflow-hidden">
          {/* Cohort Header */}
          <div className="text-[10px] text-[#888888] px-[6px] pb-[4px] font-medium normal-case tracking-normal">
            {cohortHeaderLabel.toLowerCase()}
          </div>

          {/* Metric Rows: top-aligned without accordion stretching */}
          <div className="flex flex-col justify-start w-full overflow-hidden divide-y divide-[#f0f0f0]">
            {activeMetrics.map((metric) => {
              let rawPct = seasonStats ? (seasonStats[metric.pctKey] as number | undefined | null) : null;
              if ((rawPct === null || rawPct === undefined) && metric.key === 'expected_goals') {
                rawPct = seasonStats?.expected_goals_pct ?? 50;
              }
              const pct = typeof rawPct === 'number' && !isNaN(rawPct) ? Math.round(rawPct) : 50;
              let rawVal = seasonStats
                ? (seasonStats[metric.key as keyof PlayerSeasonStats] as number | undefined | null)
                : null;
              if ((rawVal === null || rawVal === undefined) && metric.key === 'expected_goals') {
                rawVal = seasonStats?.expected_goals ?? 0;
              }
              const minutes = seasonStats?.minutes_played || 1;
              const numVal = metric.isPercentage ? (rawVal ?? 0) : ((rawVal ?? 0) / minutes) * 90;
              const signPrefix = numVal > 0 ? '+' : '';
              const valStr = metric.isPercentage
                ? `${signPrefix}${numVal.toFixed(1)}%`
                : `${signPrefix}${numVal.toFixed(2)}`;

              const badgeBg =
                pct >= 90
                  ? 'bg-emerald-600'
                  : pct >= 70
                    ? 'bg-emerald-500'
                    : pct >= 40
                      ? 'bg-amber-400'
                      : 'bg-rose-500';

              const arrowInfo =
                pct >= 80
                  ? { symbol: '▲▲', color: 'text-emerald-600' }
                  : pct >= 55
                    ? { symbol: '▲', color: 'text-emerald-600' }
                    : pct >= 40
                      ? { symbol: '►', color: 'text-amber-500' }
                      : { symbol: '▼', color: 'text-rose-500' };

              const isHovered = hoveredMetric === metric.key;

              return (
                <div
                  key={metric.key}
                  className={`grid grid-cols-[1fr_auto] py-[3.5px] px-[6px] text-[11px] items-center min-h-[22px] transition-colors cursor-pointer ${
                    isHovered ? 'bg-blue-50/80 ring-1 ring-blue-200/60' : 'hover:bg-slate-100/70'
                  }`}
                  onMouseEnter={() => setHoveredMetric(metric.key)}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <span
                    className="text-[11px] font-medium text-[#1a1d1c] truncate pr-2"
                    title={(t.metrics[metric.key]?.short || metric.label).replace(/\*/g, '')}
                  >
                    {(t.metrics[metric.key]?.short || metric.label).replace(/\*/g, '')}
                  </span>
                  <div className="flex items-center gap-[4px] font-mono tabular-nums shrink-0">
                    <span className={`text-[9px] font-bold ${arrowInfo.color}`}>
                      {arrowInfo.symbol}
                    </span>
                    <span className="text-[10.5px] font-bold text-[#1a1d1c]">
                      {valStr}
                    </span>
                    <span
                      className={`text-[10px] font-bold text-white rounded-[3px] px-1.5 min-w-[22px] h-[18px] flex items-center justify-center shrink-0 ${badgeBg}`}
                    >
                      {pct}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* COLUMNS 2-4 (radar, lg:col-span-3): Symmetric 700x740 Polar Pizza Radar & Top 10 Panel */}
      <div className="lg:col-span-3 bg-[#fafafa] border border-[#e0e0e0] rounded-[6px] p-2 overflow-hidden w-full">
        <div className="flex flex-col xl:flex-row gap-[12px] items-start w-full min-w-0 max-w-full">
          {/* Center Pizza Chart Canvas Wrapper */}
          <div className="flex-[2_1_0px] min-w-0 w-full flex items-center justify-center select-none">
            <svg
              viewBox="0 0 700 740"
              preserveAspectRatio="xMidYMid meet"
              className="w-full max-w-[640px] h-auto block"
            >
              {/* Layer 0: Circular Background Disc */}
              <circle cx={RADAR_CENTER_X} cy={RADAR_CENTER_Y} r={RADAR_MAX_RADIUS} fill="#f1f5f9" stroke="none" />

              {/* Layer 1 (Background): Filled pizza wedges */}
              <g className="pizza-slices">
                {radarGeometry.map(({ metric, pathData }) => {
                  const isHovered = hoveredMetric === metric.key;
                  const fillOpacity = isHovered ? 0.75 : 0.95;

                  return (
                    <path
                      key={metric.key}
                      d={pathData}
                      fill={clubThemeColor}
                      fillOpacity={fillOpacity}
                      stroke="#cbd5e1"
                      strokeWidth="1"
                      onMouseEnter={() => setHoveredMetric(metric.key)}
                      onMouseLeave={() => setHoveredMetric(null)}
                      className="cursor-pointer transition-all duration-150"
                    />
                  );
                })}
              </g>

              {/* Layer 2 (Radial Lines / Spokes) */}
              <g pointerEvents="none">
                {radarGeometry.map(({ metric, ray }) => (
                  <line
                    key={`ray-${metric.key}`}
                    x1={ray.x1}
                    y1={ray.y1}
                    x2={ray.x2}
                    y2={ray.y2}
                    stroke="#94a3b8"
                    strokeWidth="1"
                  />
                ))}
              </g>

              {/* Layer 3 (Concentric Percentile Rings Over the Wedges) */}
              <g pointerEvents="none">
                <circle
                  cx={RADAR_CENTER_X}
                  cy={RADAR_CENTER_Y}
                  r={RADAR_MAX_RADIUS * 0.25}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={RADAR_CENTER_X}
                  cy={RADAR_CENTER_Y}
                  r={RADAR_MAX_RADIUS * 0.5}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.3"
                  strokeDasharray="4 4"
                />
                <circle
                  cx={RADAR_CENTER_X}
                  cy={RADAR_CENTER_Y}
                  r={RADAR_MAX_RADIUS * 0.75}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={RADAR_CENTER_X}
                  cy={RADAR_CENTER_Y}
                  r={RADAR_MAX_RADIUS}
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="1.2"
                />
              </g>

              {/* Floating Numeric Value Badges at edge of each slice */}
              <g pointerEvents="none">
                {radarGeometry.map(({ metric, badgeX, badgeY, formattedValue }) => {
                  const isHovered = hoveredMetric === metric.key;
                  const badgeW = 34;
                  const badgeH = 15;
                  return (
                    <g
                      key={`badge-${metric.key}`}
                      className="transition-transform duration-150"
                      filter="drop-shadow(0 1px 2px rgba(0,0,0,0.15))"
                    >
                      <rect
                        x={badgeX - badgeW / 2}
                        y={badgeY - badgeH / 2}
                        width={badgeW}
                        height={badgeH}
                        rx={3}
                        fill={isHovered ? '#0F172A' : clubThemeColor}
                        stroke="#FFFFFF"
                        strokeWidth="0.8"
                      />
                      <text
                        x={badgeX}
                        y={badgeY}
                        fontSize="9"
                        fontWeight="bold"
                        fill={isHovered ? '#FFFFFF' : radarBadgeTextColor}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontFamily="ui-monospace, monospace"
                      >
                        {formattedValue}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* Perimeter Metric Labels in 2 centered lines (text-anchor="middle" font-size="11px") */}
              <g pointerEvents="none">
                {radarGeometry.map(({ metric, labelX, labelY }) => {
                  const [line1, line2] = getSplitMetricLabel(metric.key, metric.label);

                  return (
                    <text
                      key={`lbl-${metric.key}`}
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="11px"
                      className="font-bold fill-slate-800 select-none tracking-tight"
                    >
                      {line2 ? (
                        <>
                          <tspan x={labelX} dy="-0.55em">
                            {line1}
                          </tspan>
                          <tspan x={labelX} dy="1.15em">
                            {line2}
                          </tspan>
                        </>
                      ) : (
                        <tspan x={labelX} dy="0.1em">
                          {line1}
                        </tspan>
                      )}
                    </text>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Top 10 Leaders Panel in natural flex flow */}
          <div className="flex-[1_1_0px] max-w-[240px] shrink-0 bg-[#fafafa] border border-[#e0e0e0] rounded-[6px] p-[14px_16px] text-[13px] self-start">
            <div className="text-[11.5px] font-bold text-slate-800 pb-1.5 mb-1.5 border-b border-[#e0e0e0] truncate">
              {(() => {
                const activeMetric = radarMetrics.find((m) => m.key === currentLeaderboardStat);
                const metricKey =
                  activeMetric?.key || activeHoveredMetricDef?.key || 'accurate_passes_percentage';
                const label =
                  t.metrics[metricKey]?.short ||
                  (activeMetric
                    ? activeMetric.label
                    : activeHoveredMetricDef
                      ? activeHoveredMetricDef.label
                      : 'Pass Accuracy');
                const isPercentage = Boolean(
                  activeMetric?.isPercentage || activeHoveredMetricDef?.isPercentage
                );
                const displayLabel = isPercentage && !label.includes('%') ? `${label} (%)` : label;
                return `${displayLabel} — ${t.floor1.top10Suffix}`;
              })()}
            </div>

            {/* Top 10 List Table with Row Dividers */}
            <div className="divide-y divide-[#e0e0e0]/60">
              {isTopPlayersLoading && (
                <p className="text-[10px] text-slate-400 py-6 text-center">{t.floor1.loadingRankings}</p>
              )}

              {!isTopPlayersLoading && topPlayers && topPlayers.length > 0 ? (
                topPlayers.map((player) => {
                  const isCurrentPlayer = player.player_id === playerId;
                  const formattedValue =
                    typeof player.value === 'number'
                      ? player.value % 1 !== 0
                        ? player.value.toFixed(1)
                        : player.value
                      : player.value;

                  return (
                    <div
                      key={player.player_id}
                      className={`flex items-start justify-between text-[11px] py-1 px-1 rounded transition-colors leading-tight ${
                        isCurrentPlayer ? 'font-semibold' : 'hover:bg-slate-100/70 text-slate-700'
                      }`}
                      style={
                        isCurrentPlayer
                          ? {
                              backgroundColor: `rgba(${clubTextRgb.r}, ${clubTextRgb.g}, ${clubTextRgb.b}, 0.12)`,
                              border: `1px solid rgba(${clubTextRgb.r}, ${clubTextRgb.g}, ${clubTextRgb.b}, 0.35)`,
                            }
                          : undefined
                      }
                    >
                      <span className="text-slate-400 font-normal w-4 shrink-0 pt-0.5">
                        {player.rank}.
                      </span>
                      <div className="flex-1 min-w-0 pr-1.5 break-words">
                        <span
                          className={`font-medium ${
                            isCurrentPlayer ? 'font-bold text-slate-900' : 'text-slate-700'
                          }`}
                          style={isCurrentPlayer ? { color: clubTextColor } : undefined}
                        >
                          {player.name}
                        </span>
                        <span className="text-slate-400 font-normal ml-1">
                          {'— '}
                          {player.team_name}
                        </span>
                      </div>

                      <span
                        className={`tabular-nums font-semibold shrink-0 text-right pt-0.5 ml-1 ${
                          isCurrentPlayer ? 'text-slate-900 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {formattedValue}
                      </span>
                    </div>
                  );
                })
              ) : (
                !isTopPlayersLoading && (
                  <p className="text-[10px] text-slate-400 py-6 text-center">
                    {t.floor1.noRankingsFound}
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* COLUMN 5 (bc, 1.1fr): Neutral container without background or border */}
      <div className="w-full h-full flex flex-col gap-[8px] min-w-0">
        <TimeInPosition
          matchStats={matchStats}
          themeColor={clubThemeColor}
          orientation="vertical"
          playerName={playerName}
          lang={lang}
          className="w-full h-full flex-1 flex flex-col gap-[8px] min-h-0"
        />
      </div>
    </div>
  );
};

export default ScoutingFloor01;
