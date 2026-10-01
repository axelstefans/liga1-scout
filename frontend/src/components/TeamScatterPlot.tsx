import React, { useState, useMemo, useRef } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { TeamMetricEntry } from '../services/api';
import { 
  Team34MetricKey, 
  METRIC_CATALOG, 
  CohortStats,
  formatAxisLabel,
  formatCleanComparisonTitle
} from '../types/metrics';
import { getTeamCrestUrl, getTeamThemeColor, getTeamTricode } from '../utils/teams';

interface TeamScatterPlotProps {
  teams: TeamMetricEntry[];
  xAxisMetric: Team34MetricKey;
  yAxisMetric: Team34MetricKey;
  referenceLineMode: 'median' | 'mean';
  xStats: CohortStats | null;
  yStats: CohortStats | null;
  tournamentLabel?: string;
}

export const TeamScatterPlot: React.FC<TeamScatterPlotProps> = ({
  teams,
  xAxisMetric,
  yAxisMetric,
  referenceLineMode,
  xStats,
  yStats,
  tournamentLabel = 'Temporada Completa',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredTeam, setHoveredTeam] = useState<TeamMetricEntry | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; svgX: number; svgY: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // SVG Canvas Dimensions: expanded to 960px width with comfortable margins
  const SVG_WIDTH = 960;
  const SVG_HEIGHT = 580;
  const MARGIN = {
    top: 40,
    right: 50,
    bottom: 65,
    left: 80,
  };

  const plotLeft = MARGIN.left;
  const plotTop = MARGIN.top;
  const plotRight = SVG_WIDTH - MARGIN.right;
  const plotBottom = SVG_HEIGHT - MARGIN.bottom;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  // Metric definitions
  const xDef = METRIC_CATALOG[xAxisMetric];
  const yDef = METRIC_CATALOG[yAxisMetric];

  // Coordinate scales with generous 12% outer padding to avoid axis/tick collisions
  const { minX, maxX, minY, maxY, mapSvgX, mapSvgY } = useMemo(() => {
    const rawXMin = xStats?.min ?? 0;
    const rawXMax = xStats?.max ?? 100;
    const spanX = rawXMax - rawXMin || 1;
    const padX = spanX * 0.12;
    const effXMin = rawXMin - padX;
    const effXMax = rawXMax + padX;

    const rawYMin = yStats?.min ?? 0;
    const rawYMax = yStats?.max ?? 100;
    const spanY = rawYMax - rawYMin || 1;
    const padY = spanY * 0.12;
    const effYMin = rawYMin - padY;
    const effYMax = rawYMax + padY;

    const mapX = (val: number) =>
      plotLeft + ((val - effXMin) / (effXMax - effXMin || 1)) * plotWidth;
    const mapY = (val: number) =>
      plotBottom - ((val - effYMin) / (effYMax - effYMin || 1)) * plotHeight;

    return {
      minX: effXMin,
      maxX: effXMax,
      minY: effYMin,
      maxY: effYMax,
      mapSvgX: mapX,
      mapSvgY: mapY,
    };
  }, [xStats, yStats, plotLeft, plotBottom, plotWidth, plotHeight]);

  // Reference lines coordinates
  const refX = xStats?.referenceValue ?? (minX + maxX) / 2;
  const refY = yStats?.referenceValue ?? (minY + maxY) / 2;

  const refSvgX = Math.max(plotLeft, Math.min(plotRight, mapSvgX(refX)));
  const refSvgY = Math.max(plotTop, Math.min(plotBottom, mapSvgY(refY)));

  // Generate 5 grid ticks
  const xTicks = useMemo(() => {
    if (!xStats) return [];
    const ticks: number[] = [];
    const span = xStats.max - xStats.min;
    const step = span / 4;
    for (let i = 0; i <= 4; i++) {
      ticks.push(xStats.min + step * i);
    }
    return ticks;
  }, [xStats]);

  const yTicks = useMemo(() => {
    if (!yStats) return [];
    const ticks: number[] = [];
    const span = yStats.max - yStats.min;
    const step = span / 4;
    for (let i = 0; i <= 4; i++) {
      ticks.push(yStats.min + step * i);
    }
    return ticks;
  }, [yStats]);

  // Compute team points with SVG coordinates and collision-aware label placement
  const teamNodes = useMemo(() => {
    const rawNodes = teams.map((team) => {
      const rawX = (team[xAxisMetric] as number | null) ?? 0;
      const rawY = (team[yAxisMetric] as number | null) ?? 0;
      const svgX = mapSvgX(rawX);
      const svgY = mapSvgY(rawY);
      const themeColor = getTeamThemeColor(team.name, team.primary_color);
      const crestUrl = getTeamCrestUrl(team.team_id, team.logo_url);
      const tricode = getTeamTricode(team.team_id, team.name);

      return {
        team,
        svgX,
        svgY,
        themeColor,
        crestUrl,
        tricode,
      };
    });

    // Detect pairwise collisions within 30px distance and alternate label position (bottom, top, hidden)
    const positioned: Array<(typeof rawNodes)[0] & { labelPosition: 'bottom' | 'top' | 'hidden' }> = [];
    for (let i = 0; i < rawNodes.length; i++) {
      const current = rawNodes[i];
      let position: 'bottom' | 'top' | 'hidden' = 'bottom';

      for (let j = 0; j < positioned.length; j++) {
        const prev = positioned[j];
        const dist = Math.hypot(current.svgX - prev.svgX, current.svgY - prev.svgY);
        if (dist < 32) {
          if (prev.labelPosition === 'bottom') {
            position = 'top';
          } else {
            position = 'hidden';
          }
          break;
        }
      }

      positioned.push({
        ...current,
        labelPosition: position,
      });
    }

    return positioned;
  }, [teams, xAxisMetric, yAxisMetric, mapSvgX, mapSvgY]);

  // Sort nodes so hovered team renders on top of others
  const sortedNodes = useMemo(() => {
    if (!hoveredTeam) return teamNodes;
    return [...teamNodes].sort((a, b) => {
      if (a.team.team_id === hoveredTeam.team_id) return 1;
      if (b.team.team_id === hoveredTeam.team_id) return -1;
      return 0;
    });
  }, [teamNodes, hoveredTeam]);

  // Calculate ranks for tooltip context
  const getRank = (key: Team34MetricKey, value: number, isHigherBetter: boolean = true) => {
    const sorted = [...teams]
      .map((t) => (t[key] as number) ?? 0)
      .sort((a, b) => (isHigherBetter ? b - a : a - b));
    const rank = sorted.indexOf(value) + 1;
    return rank > 0 ? `#${rank}` : '--';
  };

  // High-Resolution Export Handler
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
      const cleanY = yDef.shortLabel.replace(/\s+/g, '_');
      const cleanX = xDef.shortLabel.replace(/\s+/g, '_');
      link.download = `Liga1_Matriz_${cleanY}_vs_${cleanX}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export scatter PNG:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const cleanTitle = formatCleanComparisonTitle(yDef, xDef);

  return (
    <div ref={cardRef} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs relative">
      {/* Top Header Strip with Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-100 gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
            {cleanTitle}
            {tournamentLabel && (
              <span className="text-xs font-normal text-slate-400 ml-2">({tournamentLabel})</span>
            )}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2.5 h-0.5 border-t-2 border-dashed border-slate-500 inline-block" />
            <span>Referencia: {referenceLineMode === 'median' ? 'Mediana' : 'Media'}</span>
          </div>

          {/* Quick Export PNG Button */}
          <button
            type="button"
            onClick={handleExportPNG}
            disabled={isExporting}
            className="export-ignore inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors shadow-2xs"
            title="Exportar gráfico táctico en PNG de alta resolución (2x)"
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

      {/* SVG Canvas Container */}
      <div ref={containerRef} className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-auto"
          style={{ maxHeight: '620px' }}
        >
          <defs>
            {/* Circular Clip Paths for all team crests */}
            {teams.map((t) => (
              <clipPath key={`clip-${t.team_id}`} id={`crest-clip-${t.team_id}`}>
                <circle cx="0" cy="0" r="16" />
              </clipPath>
            ))}
          </defs>

          {/* Background Plot Area */}
          <rect
            x={plotLeft}
            y={plotTop}
            width={plotWidth}
            height={plotHeight}
            fill="#fcfcfd"
            stroke="#e2e8f0"
            strokeWidth="1"
          />

          {/* Quadrant Shading Highlights */}
          {/* Top-Right Quadrant (High X, High Y) */}
          <rect
            x={refSvgX}
            y={plotTop}
            width={plotRight - refSvgX}
            height={refSvgY - plotTop}
            fill="#10b981"
            fillOpacity="0.03"
          />
          {/* Top-Left Quadrant (Low X, High Y) */}
          <rect
            x={plotLeft}
            y={plotTop}
            width={refSvgX - plotLeft}
            height={refSvgY - plotTop}
            fill="#0ea5e9"
            fillOpacity="0.02"
          />
          {/* Bottom-Right Quadrant (High X, Low Y) */}
          <rect
            x={refSvgX}
            y={refSvgY}
            width={plotRight - refSvgX}
            height={plotBottom - refSvgY}
            fill="#f59e0b"
            fillOpacity="0.02"
          />
          {/* Bottom-Left Quadrant (Low X, Low Y) */}
          <rect
            x={plotLeft}
            y={refSvgY}
            width={refSvgX - plotLeft}
            height={plotBottom - refSvgY}
            fill="#f43f5e"
            fillOpacity="0.02"
          />

          {/* Grid Lines: X Ticks */}
          {xTicks.map((tick, i) => {
            const svgX = mapSvgX(tick);
            if (svgX < plotLeft || svgX > plotRight) return null;
            return (
              <g key={`xtick-${i}`}>
                <line
                  x1={svgX}
                  y1={plotTop}
                  x2={svgX}
                  y2={plotBottom}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1={svgX}
                  y1={plotBottom}
                  x2={svgX}
                  y2={plotBottom + 4}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                />
                <text
                  x={svgX}
                  y={plotBottom + 16}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#94a3b8"
                  fontWeight="500"
                >
                  {xDef.format(tick)}
                </text>
              </g>
            );
          })}

          {/* Grid Lines: Y Ticks */}
          {yTicks.map((tick, i) => {
            const svgY = mapSvgY(tick);
            if (svgY < plotTop || svgY > plotBottom) return null;
            return (
              <g key={`ytick-${i}`}>
                <line
                  x1={plotLeft}
                  y1={svgY}
                  x2={plotRight}
                  y2={svgY}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1={plotLeft - 4}
                  y1={svgY}
                  x2={plotLeft}
                  y2={svgY}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                />
                <text
                  x={plotLeft - 8}
                  y={svgY + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94a3b8"
                  fontWeight="500"
                >
                  {yDef.format(tick)}
                </text>
              </g>
            );
          })}

          {/* Reference Lines (Median / Mean) */}
          {/* Vertical Reference Line X */}
          <line
            x1={refSvgX}
            y1={plotTop}
            x2={refSvgX}
            y2={plotBottom}
            stroke="#475569"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          {/* Horizontal Reference Line Y */}
          <line
            x1={plotLeft}
            y1={refSvgY}
            x2={plotRight}
            y2={refSvgY}
            stroke="#475569"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Reference Badge Pill: Top X */}
          <g transform={`translate(${refSvgX}, ${plotTop - 12})`}>
            <rect
              x="-42"
              y="-10"
              width="84"
              height="20"
              rx="10"
              fill="#0D1B2A"
              className="drop-shadow-xs"
            />
            <text
              textAnchor="middle"
              y="3.5"
              fill="#ffffff"
              fontSize="9.5"
              fontWeight="bold"
            >
              {referenceLineMode === 'median' ? 'Med' : 'Prom'}: {xDef.format(refX)}
            </text>
          </g>

          {/* Reference Badge Pill: Right Y */}
          <g transform={`translate(${plotRight + 2}, ${refSvgY})`}>
            <rect
              x="0"
              y="-10"
              width="54"
              height="20"
              rx="10"
              fill="#0D1B2A"
              className="drop-shadow-xs"
            />
            <text
              textAnchor="middle"
              x="27"
              y="3.5"
              fill="#ffffff"
              fontSize="9.5"
              fontWeight="bold"
            >
              {yDef.format(refY)}
            </text>
          </g>

          {/* Axis Labels */}
          {/* X Axis Bottom Label (Polish: avoid duplicate %) */}
          <text
            x={plotLeft + plotWidth / 2}
            y={plotBottom + 46}
            textAnchor="middle"
            fontSize="12"
            fontWeight="bold"
            fill="#0f172a"
            letterSpacing="0.04em"
          >
            {formatAxisLabel(xDef).toUpperCase()} →
          </text>

          {/* Y Axis Left Label (Rotated) */}
          <text
            transform={`rotate(-90)`}
            x={-(plotTop + plotHeight / 2)}
            y={plotLeft - 52}
            textAnchor="middle"
            fontSize="12"
            fontWeight="bold"
            fill="#0f172a"
            letterSpacing="0.04em"
          >
            ↑ {formatAxisLabel(yDef).toUpperCase()}
          </text>

          {/* Club Crest Nodes */}
          {sortedNodes.map(({ team, svgX, svgY, themeColor, crestUrl, tricode, labelPosition }) => {
            const isHovered = hoveredTeam?.team_id === team.team_id;
            const radius = isHovered ? 20 : 16;

            return (
              <g
                key={`team-node-${team.team_id}`}
                transform={`translate(${svgX}, ${svgY})`}
                className="cursor-pointer transition-transform duration-150"
                onMouseEnter={(e) => {
                  setHoveredTeam(team);
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltipPos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      svgX,
                      svgY,
                    });
                  }
                }}
                onMouseMove={(e) => {
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltipPos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      svgX,
                      svgY,
                    });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredTeam(null);
                  setTooltipPos(null);
                }}
              >
                {/* Outer Glow Halo on Hover */}
                {isHovered && (
                  <circle
                    cx="0"
                    cy="0"
                    r={radius + 6}
                    fill={themeColor}
                    fillOpacity="0.25"
                  />
                )}

                {/* White Background Disc */}
                <circle
                  cx="0"
                  cy="0"
                  r={radius}
                  fill="#ffffff"
                  stroke={themeColor}
                  strokeWidth={isHovered ? 3.5 : 2}
                  className="shadow-md"
                />

                {/* Club Crest Image */}
                <g clipPath={`url(#crest-clip-${team.team_id})`}>
                  <image
                    href={crestUrl}
                    x={-radius + 2}
                    y={-radius + 2}
                    width={(radius - 2) * 2}
                    height={(radius - 2) * 2}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </g>

                {/* Concentric Border Stroke */}
                <circle
                  cx="0"
                  cy="0"
                  r={radius}
                  fill="none"
                  stroke={themeColor}
                  strokeWidth={isHovered ? 3 : 1.75}
                />

                {/* Concise 3-letter Code with crisp white stroke halo (alternating top/bottom or hidden on collision) */}
                {(labelPosition !== 'hidden' || isHovered) && (
                  <text
                    x="0"
                    y={labelPosition === 'top' && !isHovered ? -(radius + 4) : radius + 10}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="bold"
                    letterSpacing="0.05em"
                    fill={isHovered ? '#0f172a' : '#334155'}
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    style={{ paintOrder: 'stroke fill' }}
                    className="select-none pointer-events-none"
                  >
                    {tricode}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating HTML Hover Tooltip */}
        {hoveredTeam && tooltipPos && (
          <div
            className="absolute z-30 pointer-events-none transition-all duration-75"
            style={{
              left: `${(tooltipPos.svgX / SVG_WIDTH) * 100}%`,
              top: `${(tooltipPos.svgY / SVG_HEIGHT) * 100}%`,
              transform: `translate(-50%, ${tooltipPos.svgY < 140 ? '18px' : '-115%'})`,
            }}
          >
            <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-3.5 shadow-xl border border-slate-700/60 min-w-[220px] max-w-[280px]">
              {/* Tooltip Header: Crest, Name & Points */}
              <div className="flex items-center gap-2.5 pb-2.5 mb-2.5 border-b border-slate-700/80">
                <div className="w-8 h-8 rounded-full bg-white p-1 flex items-center justify-center shrink-0">
                  <img
                    src={getTeamCrestUrl(hoveredTeam.team_id, hoveredTeam.logo_url)}
                    alt={hoveredTeam.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white truncate leading-tight">
                    {hoveredTeam.name}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {hoveredTeam.points} pts · {hoveredTeam.wins}V - {hoveredTeam.draws}E - {hoveredTeam.losses}D
                  </span>
                </div>
              </div>

              {/* Tooltip Metrics Rows */}
              <div className="space-y-2 text-xs">
                {/* Metric X */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    <span className="w-2 h-2 rounded-full bg-navy border border-white/40 shrink-0" />
                    <span className="text-slate-300 truncate">{xDef.label}:</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-white">
                      {xDef.format(hoveredTeam[xAxisMetric] as number)}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">
                      ({getRank(xAxisMetric, (hoveredTeam[xAxisMetric] as number) ?? 0, xDef.isPositiveBetter)})
                    </span>
                  </div>
                </div>

                {/* Metric Y */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 border border-white/40 shrink-0" />
                    <span className="text-slate-300 truncate">{yDef.label}:</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-emerald-400">
                      {yDef.format(hoveredTeam[yAxisMetric] as number)}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">
                      ({getRank(yAxisMetric, (hoveredTeam[yAxisMetric] as number) ?? 0, yDef.isPositiveBetter)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Difference vs Reference Lines Indicator */}
              <div className="mt-2.5 pt-2 border-t border-slate-700/60 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Dif. vs {referenceLineMode}:</span>
                <span className="font-medium text-slate-300">
                  X: {((hoveredTeam[xAxisMetric] as number) ?? 0) >= refX ? '▲ Supera' : '▼ Bajo'} · 
                  Y: {((hoveredTeam[yAxisMetric] as number) ?? 0) >= refY ? ' ▲ Supera' : ' ▼ Bajo'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamScatterPlot;
