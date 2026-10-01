import React, { useState, useMemo, useRef } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { TeamMetricEntry } from '../../services/api';
import {
  Team34MetricKey,
  METRIC_CATALOG,
  computeMetricCohortStats,
  formatAxisLabel,
} from '../../types/metrics';
import { getTeamCrestUrl, getTeamThemeColor, getTeamTricode } from '../../utils/teams';

export interface TeamBarRankingProps {
  teams: TeamMetricEntry[];
  metricKey: Team34MetricKey;
  sortOrder?: 'desc' | 'asc';
  referenceMode?: 'median' | 'mean';
  tournamentLabel?: string;
}

export const TeamBarRanking: React.FC<TeamBarRankingProps> = ({
  teams,
  metricKey,
  sortOrder = 'desc',
  referenceMode = 'median',
  tournamentLabel = 'Temporada Completa',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredTeam, setHoveredTeam] = useState<TeamMetricEntry | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Metric Definition & Cohort Stats
  const metricDef = METRIC_CATALOG[metricKey] || METRIC_CATALOG.xg;
  const stats = useMemo(
    () => computeMetricCohortStats(teams, metricKey, referenceMode),
    [teams, metricKey, referenceMode]
  );

  // Automatically sort the 18 clubs according to selected metric and sort direction
  const sortedTeams = useMemo(() => {
    const list = [...teams];
    list.sort((a, b) => {
      const valA = (a[metricKey] as number | null) ?? 0;
      const valB = (b[metricKey] as number | null) ?? 0;
      if (valA !== valB) {
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      }
      // Secondary tie-breakers: points -> goal_difference -> club name
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [teams, metricKey, sortOrder]);

  // Layout Dimensions
  const SVG_WIDTH = 960;
  const ROW_HEIGHT = 28;
  const MARGIN_TOP = 46;
  const MARGIN_BOTTOM = 36;
  const rowCount = sortedTeams.length;
  const SVG_HEIGHT = MARGIN_TOP + rowCount * ROW_HEIGHT + MARGIN_BOTTOM;

  const plotLeft = 145; // Space for Rank badge, circular crest and tricode
  const plotRight = 875; // Space for formatted metric value on the right
  const plotWidth = plotRight - plotLeft;

  // Domain & Scale Math
  const { effMin, effMax, zeroSvgX, mapValToSvgX } = useMemo(() => {
    const rawMin = stats?.min ?? 0;
    const rawMax = stats?.max ?? 100;

    let computedMin = 0;
    let computedMax = 100;

    if (rawMin < 0) {
      // Handles metrics with negative values (e.g. goals_minus_xg, goal_diff, xgd)
      const absMax = Math.max(Math.abs(rawMin), Math.abs(rawMax), 1);
      const pad = absMax * 0.08;
      computedMin = rawMin - pad;
      computedMax = rawMax + pad;
    } else {
      // Baseline 0 for all strictly positive metrics for accurate proportionality
      computedMin = 0;
      const pad = (rawMax - computedMin) * 0.08 || 1;
      computedMax = rawMax + pad;
    }

    const mapX = (val: number) => {
      const clamped = Math.max(computedMin, Math.min(computedMax, val));
      return plotLeft + ((clamped - computedMin) / (computedMax - computedMin || 1)) * plotWidth;
    };

    const zeroX = mapX(0);

    return {
      effMin: computedMin,
      effMax: computedMax,
      zeroSvgX: zeroX,
      mapValToSvgX: mapX,
    };
  }, [stats, plotLeft, plotWidth]);

  // League Benchmark Reference
  const refValue = stats ? (referenceMode === 'median' ? stats.median : stats.mean) : 0;
  const refSvgX = mapValToSvgX(refValue);
  const refLabel = referenceMode === 'median' ? 'Mediana' : 'Media';

  // 5 Vertical Grid Ticks
  const gridTicks = useMemo(() => {
    if (!stats) return [];
    const ticksCount = 5;
    const step = (effMax - effMin) / (ticksCount - 1);
    const ticks: number[] = [];
    for (let i = 0; i < ticksCount; i++) {
      ticks.push(effMin + i * step);
    }
    return ticks;
  }, [stats, effMin, effMax]);

  // High-Resolution PNG Export (2x)
  const handleExportPNG = async () => {
    if (isExporting || !cardRef.current) return;
    try {
      setIsExporting(true);
      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 60));
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
      const cleanMetric = metricDef.shortLabel.replace(/\s+/g, '_');
      const cleanTourn = tournamentLabel.replace(/\s+/g, '_');
      link.download = `Liga1_Ranking_${cleanMetric}_${cleanTourn}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export bar ranking PNG:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div ref={cardRef} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs relative">
      {/* 1. Header & Actions Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              Ranking de Liga: {metricDef.label}
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {metricDef.category}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {metricDef.description} · {tournamentLabel}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {stats && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900">Benchmark:</span>
              <span className="text-navy font-bold">
                Mediana {metricDef.format(stats.median)}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-700 font-medium">
                Media {metricDef.format(stats.mean)}
              </span>
            </div>
          )}

          {/* Quick Export PNG Button */}
          <button
            type="button"
            onClick={handleExportPNG}
            disabled={isExporting}
            className="export-ignore inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors shadow-2xs cursor-pointer"
            title="Exportar ranking de liga en PNG de alta resolución (2x)"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
            ) : (
              <Download className="w-3.5 h-3.5 text-slate-600" />
            )}
            <span>Descargar PNG</span>
          </button>
        </div>
      </div>

      {/* 2. SVG Canvas Container */}
      <div ref={containerRef} className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-auto"
          style={{ maxHeight: '660px' }}
        >
          <defs>
            {/* Circular Clip Paths for team crests */}
            {sortedTeams.map((t) => (
              <clipPath key={`clip-crest-${t.team_id}`} id={`clip-crest-${t.team_id}`}>
                <circle cx="0" cy="0" r="11" />
              </clipPath>
            ))}

            {/* Subtle Gradient for League Benchmark Pill */}
            <linearGradient id="benchmark-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines & Ticks */}
          <g className="grid-lines">
            {gridTicks.map((tickVal, idx) => {
              const xPos = mapValToSvgX(tickVal);
              return (
                <g key={`grid-tick-${idx}`}>
                  <line
                    x1={xPos}
                    y1={MARGIN_TOP}
                    x2={xPos}
                    y2={MARGIN_TOP + rowCount * ROW_HEIGHT}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />
                  {/* Top tick label */}
                  <text
                    x={xPos}
                    y={MARGIN_TOP - 8}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fill="#94a3b8"
                  >
                    {metricDef.format(tickVal)}
                  </text>
                  {/* Bottom tick label */}
                  <text
                    x={xPos}
                    y={MARGIN_TOP + rowCount * ROW_HEIGHT + 16}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fill="#94a3b8"
                  >
                    {metricDef.format(tickVal)}
                  </text>
                </g>
              );
            })}

            {/* Zero Baseline Line (if negative scale exists) */}
            {effMin < 0 && (
              <line
                x1={zeroSvgX}
                y1={MARGIN_TOP}
                x2={zeroSvgX}
                y2={MARGIN_TOP + rowCount * ROW_HEIGHT}
                stroke="#cbd5e1"
                strokeWidth="1.5"
              />
            )}
          </g>

          {/* 3. League Benchmark Reference Line (Dashed) */}
          {stats && (
            <g className="benchmark-reference">
              <line
                x1={refSvgX}
                y1={MARGIN_TOP - 4}
                x2={refSvgX}
                y2={MARGIN_TOP + rowCount * ROW_HEIGHT + 4}
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {/* League Benchmark Reference Pill Badge */}
              <g transform={`translate(${refSvgX}, ${MARGIN_TOP - 22})`}>
                <rect
                  x="-55"
                  y="-11"
                  width="110"
                  height="20"
                  rx="10"
                  fill="url(#benchmark-gradient)"
                  filter="drop-shadow(0 1px 2px rgba(0,0,0,0.12))"
                />
                <text
                  x="0"
                  y="2.5"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9.5"
                  fontWeight="bold"
                >
                  {refLabel}: {metricDef.format(refValue)}
                </text>
              </g>
            </g>
          )}

          {/* 4. 18 Club Horizontal Rows */}
          {sortedTeams.map((team, index) => {
            const rowY = MARGIN_TOP + index * ROW_HEIGHT;
            const centerY = rowY + ROW_HEIGHT / 2;
            const isHovered = hoveredTeam?.team_id === team.team_id;
            const rawVal = (team[metricKey] as number | null) ?? 0;
            const valSvgX = mapValToSvgX(rawVal);

            // Compute bar starting point and bar width
            let barX = plotLeft;
            let barWidth = 0;

            if (effMin < 0) {
              if (rawVal >= 0) {
                barX = zeroSvgX;
                barWidth = Math.max(valSvgX - zeroSvgX, 2);
              } else {
                barX = valSvgX;
                barWidth = Math.max(zeroSvgX - valSvgX, 2);
              }
            } else {
              barX = plotLeft;
              barWidth = Math.max(valSvgX - plotLeft, 2);
            }

            const themeColor = getTeamThemeColor(team.name, team.primary_color);
            const crestUrl = getTeamCrestUrl(team.team_id, team.logo_url);
            const tricode = getTeamTricode(team.team_id, team.name);
            const rankNumber = index + 1;

            return (
              <g
                key={`bar-row-${team.team_id}`}
                className="cursor-pointer transition-colors duration-150"
                onMouseEnter={(e) => {
                  setHoveredTeam(team);
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltipPos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                  }
                }}
                onMouseMove={(e) => {
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltipPos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredTeam(null);
                  setTooltipPos(null);
                }}
              >
                {/* Full-width Hover Background Strip */}
                <rect
                  x="12"
                  y={rowY + 1}
                  width={SVG_WIDTH - 24}
                  height={ROW_HEIGHT - 2}
                  rx="6"
                  fill={isHovered ? '#f1f5f9' : index % 2 === 0 ? '#fafafa' : '#ffffff'}
                  fillOpacity={isHovered ? 0.9 : 0.4}
                />

                {/* Rank Badge (#1 to #18) */}
                <text
                  x="36"
                  y={centerY + 3.5}
                  textAnchor="end"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill={
                    rankNumber === 1
                      ? '#b45309'
                      : rankNumber === 2
                      ? '#475569'
                      : rankNumber === 3
                      ? '#92400e'
                      : '#94a3b8'
                  }
                >
                  #{rankNumber}
                </text>

                {/* Club Crest Disc */}
                <g transform={`translate(60, ${centerY})`}>
                  <circle
                    cx="0"
                    cy="0"
                    r="11.5"
                    fill="#ffffff"
                    stroke={themeColor}
                    strokeWidth={isHovered ? 2 : 1.2}
                  />
                  <g clipPath={`url(#clip-crest-${team.team_id})`}>
                    <image
                      href={crestUrl}
                      x="-10"
                      y="-10"
                      width="20"
                      height="20"
                      preserveAspectRatio="xMidYMid meet"
                    />
                  </g>
                </g>

                {/* 3-Letter Tricode */}
                <text
                  x="82"
                  y={centerY + 3.5}
                  fontSize="11.5"
                  fontWeight="bold"
                  fill="#1e293b"
                  letterSpacing="0.03em"
                >
                  {tricode}
                </text>

                {/* Bar Element with Club Color */}
                <rect
                  x={barX}
                  y={centerY - 8}
                  width={barWidth}
                  height="16"
                  rx="3.5"
                  fill={themeColor}
                  fillOpacity={isHovered ? 1 : 0.88}
                  stroke={isHovered ? '#0f172a' : 'none'}
                  strokeWidth="1"
                  style={{
                    transition: 'width 0.4s ease-out, x 0.4s ease-out, fill-opacity 0.2s',
                  }}
                />

                {/* Metric Value Label (Right beside bar or at zero right) */}
                <text
                  x={effMin < 0 && rawVal < 0 ? barX - 8 : barX + barWidth + 8}
                  y={centerY + 3.5}
                  textAnchor={effMin < 0 && rawVal < 0 ? 'end' : 'start'}
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill={isHovered ? '#0f172a' : '#334155'}
                >
                  {metricDef.format(rawVal)}
                </text>
              </g>
            );
          })}

          {/* Bottom X-Axis Label */}
          <text
            x={plotLeft + plotWidth / 2}
            y={SVG_HEIGHT - 10}
            textAnchor="middle"
            fontSize="11"
            fontWeight="bold"
            fill="#475569"
            letterSpacing="0.04em"
          >
            {formatAxisLabel(metricDef).toUpperCase()} →
          </text>
        </svg>

        {/* 5. Interactive Floating Tooltip */}
        {hoveredTeam && tooltipPos && (
          <div
            className="absolute pointer-events-none z-30 transition-all duration-75"
            style={{
              left: `${Math.min(tooltipPos.x + 16, (containerRef.current?.clientWidth ?? 960) - 240)}px`,
              top: `${Math.max(tooltipPos.y - 45, 10)}px`,
            }}
          >
            <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-xl p-3 shadow-xl w-60">
              {/* Header with Crest and Full Name */}
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-700/60 mb-2">
                <img
                  src={getTeamCrestUrl(hoveredTeam.team_id, hoveredTeam.logo_url)}
                  alt={hoveredTeam.name}
                  className="w-7 h-7 object-contain shrink-0 bg-white rounded-full p-0.5"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/crests/default.png';
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate leading-tight">
                    {hoveredTeam.name}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {hoveredTeam.points} pts · {hoveredTeam.matches_played} PJ ({hoveredTeam.wins}V - {hoveredTeam.draws}E - {hoveredTeam.losses}D)
                  </span>
                </div>
              </div>

              {/* Metric Value & Rank Context */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 truncate pr-2">{metricDef.shortLabel}:</span>
                  <span className="font-mono font-bold text-white">
                    {metricDef.format((hoveredTeam[metricKey] as number) ?? 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Posición en Liga:</span>
                  <span className="font-semibold text-amber-400">
                    #{sortedTeams.findIndex((t) => t.team_id === hoveredTeam.team_id) + 1} de {sortedTeams.length}
                  </span>
                </div>

                {stats && (
                  <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800">
                    <span className="text-slate-400">Dif. vs {refLabel}:</span>
                    <span
                      className={`font-semibold font-mono ${
                        ((hoveredTeam[metricKey] as number) ?? 0) >= refValue
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {((hoveredTeam[metricKey] as number) ?? 0) >= refValue ? '+' : ''}
                      {metricDef.format(((hoveredTeam[metricKey] as number) ?? 0) - refValue)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamBarRanking;
