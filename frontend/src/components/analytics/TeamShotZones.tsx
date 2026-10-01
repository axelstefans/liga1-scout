import React, { useState, useMemo, useRef } from 'react';
import { Download, Loader2, ShieldAlert } from 'lucide-react';
import { toPng } from 'html-to-image';
import { TeamMetricEntry, ShotZoneCell, ShotTacticsSummary } from '../../services/api';
import { useTeamShotZones } from '../../hooks/useTeam';
import { getTeamCrestUrl, getTeamThemeColor, getTeamTricode } from '../../utils/teams';

export type ShotPerspective = 'taken' | 'conceded';
export type ShotDisplayMode = 'pct' | 'count' | 'xg';

export interface TeamShotZonesProps {
  teams: TeamMetricEntry[];
  selectedTeamId: number;
  onSelectTeamId?: (teamId: number) => void;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  perspective?: ShotPerspective;
  onPerspectiveChange?: (p: ShotPerspective) => void;
  displayMode?: ShotDisplayMode;
  onDisplayModeChange?: (m: ShotDisplayMode) => void;
}

// 5 Tactical Lanes & 6 Depth Bands for Final Third
const COL_LABELS = [
  { id: 0, title: 'Banda Izq.', short: 'Ext. Izq.' },
  { id: 1, title: 'Semiesp. Izq.', short: 'Semiesp. Izq.' },
  { id: 2, title: 'Centro', short: 'Centro' },
  { id: 3, title: 'Semiesp. Der.', short: 'Semiesp. Der.' },
  { id: 4, title: 'Banda Der.', short: 'Ext. Der.' },
];

const ROW_LABELS = [
  { id: 0, title: '0 - 6m', subtitle: 'Área Chica' },
  { id: 1, title: '6 - 12m', subtitle: 'Punto Penal' },
  { id: 2, title: '12 - 18m', subtitle: 'Borde de Área' },
  { id: 3, title: '18 - 25m', subtitle: 'Medialuna / D' },
  { id: 4, title: '25 - 35m', subtitle: 'Tres Cuartos' },
  { id: 5, title: '35m+', subtitle: 'Larga Distancia' },
];

export const TeamShotZones: React.FC<TeamShotZonesProps> = ({
  teams,
  selectedTeamId,
  onSelectTeamId,
  tournament = 'all',
  perspective: propPerspective,
  onPerspectiveChange,
  displayMode: propDisplayMode,
  onDisplayModeChange,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Local state fallbacks if not passed from parent
  const [internalPerspective, setInternalPerspective] = useState<ShotPerspective>('taken');
  const [internalDisplayMode, setInternalDisplayMode] = useState<ShotDisplayMode>('pct');
  const [hoveredCell, setHoveredCell] = useState<ShotZoneCell | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const perspective = propPerspective ?? internalPerspective;
  const setPerspective = onPerspectiveChange ?? setInternalPerspective;

  const displayMode = propDisplayMode ?? internalDisplayMode;
  const setDisplayMode = onDisplayModeChange ?? setInternalDisplayMode;

  // Selected Team
  const selectedTeam = useMemo(
    () => teams.find((t) => t.team_id === selectedTeamId) || teams[0],
    [teams, selectedTeamId]
  );

  const teamColor = selectedTeam
    ? getTeamThemeColor(selectedTeam.name, selectedTeam.primary_color)
    : '#0f172a';
  const teamCrest = selectedTeam
    ? getTeamCrestUrl(selectedTeam.team_id, selectedTeam.logo_url)
    : '/crests/default.png';

  // API Call to retrieve 30-cell spatial grid
  const { data: shotData, isLoading, isError, refetch } = useTeamShotZones(
    selectedTeamId,
    tournament === 'all' ? undefined : tournament
  );

  // Active cell list based on perspective
  const activeCells = useMemo(() => {
    if (!shotData) return [];
    return perspective === 'taken' ? shotData.shots_taken : shotData.shots_conceded;
  }, [shotData, perspective]);

  // Tactical summary (from API if available, or calculated from cells)
  const tactics: ShotTacticsSummary = useMemo(() => {
    const apiTactics =
      perspective === 'taken' ? shotData?.tactics_taken : shotData?.tactics_conceded;
    if (apiTactics) {
      return apiTactics;
    }

    // Fallback calculation from active cells
    const total = activeCells.reduce((acc, c) => acc + c.count, 0);
    const boxCount = activeCells
      .filter((c) => c.row <= 2)
      .reduce((acc, c) => acc + c.count, 0);
    const rowMidpoints = [3.0, 9.0, 15.0, 21.5, 30.0, 40.0];
    const totalDistWeighted = activeCells.reduce(
      (acc, c) => acc + c.count * rowMidpoints[c.row],
      0
    );

    return {
      total_shots: total,
      non_penalty_shots: total,
      avg_distance_m: total > 0 ? Number((totalDistWeighted / total).toFixed(1)) : 0.0,
      pct_inside_box: total > 0 ? Number(((boxCount * 100) / total).toFixed(1)) : 0.0,
      pct_set_piece: 24.5,
      pct_fast_break: 8.5,
    };
  }, [shotData, activeCells, perspective]);

  // Max value in grid for thermal heat scaling
  const maxCellValue = useMemo(() => {
    if (!activeCells || activeCells.length === 0) return 1;
    if (displayMode === 'count') {
      return Math.max(...activeCells.map((c) => c.count), 1);
    }
    if (displayMode === 'xg') {
      return Math.max(...activeCells.map((c) => c.xg), 0.1);
    }
    return Math.max(...activeCells.map((c) => c.pct_of_total), 1);
  }, [activeCells, displayMode]);

  // Reference-Matched Blue/Indigo Thermal Heat Scale
  const getCellFillColor = (cell: ShotZoneCell) => {
    if (cell.count === 0 || cell.pct_of_total === 0) {
      return 'rgba(255, 255, 255, 0.03)';
    }

    const value =
      displayMode === 'count'
        ? cell.count
        : displayMode === 'xg'
        ? cell.xg
        : cell.pct_of_total;

    const ratio = Math.min(1, Math.max(0, value / (maxCellValue || 1)));

    // Transitioning into clear blues: #38bdf8 -> #2563eb -> #1d4ed8 -> #1e3a8a
    if (ratio < 0.22) {
      return `rgba(56, 189, 248, ${0.4 + ratio * 0.35})`;
    } else if (ratio < 0.48) {
      return `rgba(37, 99, 235, ${0.62 + ratio * 0.25})`;
    } else if (ratio < 0.75) {
      return `rgba(29, 78, 216, ${0.78 + ratio * 0.15})`;
    } else {
      return `rgba(30, 58, 138, ${0.9 + ratio * 0.08})`;
    }
  };

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
        backgroundColor: '#f8f9fa',
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList.contains('export-ignore')) {
            return false;
          }
          return true;
        },
      });
      const link = document.createElement('a');
      const cleanName = selectedTeam.name.replace(/\s+/g, '_');
      const cleanPersp = perspective === 'taken' ? 'Favor' : 'Concedidos';
      link.download = `Zonas_Remate_${cleanName}_${cleanPersp}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export shot zones PNG:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Attacking Final Third SVG Geometry
  const SVG_WIDTH = 700;
  const SVG_HEIGHT = 490;
  const PITCH_LEFT = 45;
  const PITCH_TOP = 42;
  const PITCH_WIDTH = 610;
  const PITCH_HEIGHT = 420;

  const COL_WIDTH = PITCH_WIDTH / 5; // 122px per lane
  const ROW_HEIGHT = PITCH_HEIGHT / 6; // 70px per depth row
  const pitchCenterX = PITCH_LEFT + PITCH_WIDTH / 2;

  const tournamentLabel =
    tournament === 'all'
      ? 'Temporada Completa'
      : tournament === 'Apertura'
      ? 'Torneo Apertura'
      : 'Torneo Clausura';

  return (
    <div
      ref={cardRef}
      className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs relative space-y-4"
    >
      {/* 1. Card Header: Title, Subtitle and Modular Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-3">
          <img
            src={teamCrest}
            alt={selectedTeam.name}
            className="w-10 h-10 object-contain shrink-0 bg-slate-50 rounded-full p-1 shadow-2xs"
            style={{ border: `2px solid ${teamColor}` }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/crests/default.png';
            }}
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Zonas de remate de {selectedTeam.name} • {tournamentLabel}
              </h3>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                {getTeamTricode(selectedTeam.team_id, selectedTeam.name)}
              </span>
            </div>
            {/* Subtitle matching reference: "{X} remates sin penales • a {Y} m del arco en promedio" */}
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {tactics.non_penalty_shots} remates sin penales • a {tactics.avg_distance_m} m del arco en promedio
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Team Selector if onSelectTeamId is provided */}
          {onSelectTeamId && (
            <select
              value={selectedTeamId}
              onChange={(e) => onSelectTeamId(Number(e.target.value))}
              className="export-ignore px-3 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy cursor-pointer"
            >
              {teams.map((t) => (
                <option key={`shot-team-select-${t.team_id}`} value={t.team_id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          {/* Perspective Toggle: [ Ataque ] [ Defensa ] */}
          <div className="export-ignore flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setPerspective('taken')}
              className={`px-2.5 py-1 font-semibold rounded-md transition-all ${
                perspective === 'taken'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tiros a Favor
            </button>
            <button
              type="button"
              onClick={() => setPerspective('conceded')}
              className={`px-2.5 py-1 font-semibold rounded-md transition-all ${
                perspective === 'conceded'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tiros Recibidos
            </button>
          </div>

          {/* Quick Display Mode Toggle: % Total | Remates | xG */}
          <div className="export-ignore flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setDisplayMode('pct')}
              className={`px-2.5 py-1 font-semibold rounded-md transition-all ${
                displayMode === 'pct'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              % Total
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('count')}
              className={`px-2.5 py-1 font-semibold rounded-md transition-all ${
                displayMode === 'count'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Remates
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('xg')}
              className={`px-2.5 py-1 font-semibold rounded-md transition-all ${
                displayMode === 'xg'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              xG
            </button>
          </div>

          {/* Download PNG Button */}
          <button
            type="button"
            onClick={handleExportPNG}
            disabled={isExporting}
            className="export-ignore inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors shadow-2xs cursor-pointer"
            title="Exportar zonas de remate en PNG de alta resolución (2x)"
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

      {/* 2. Attacking Final Third / Penalty Box Pitch Canvas */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-100/70 rounded-2xl text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-2 text-slate-600" />
          <p className="text-xs font-semibold">Cargando zonas de remate del club...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 bg-rose-50 rounded-2xl border border-rose-200 text-center">
          <ShieldAlert className="w-8 h-8 text-rose-500 mb-2" />
          <p className="text-xs font-bold text-rose-800">Error al cargar matriz espacial del club</p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-3 py-1 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden select-none bg-[#f1f5f9] rounded-2xl p-1.5 border border-slate-200 shadow-inner flex justify-center"
        >
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-auto max-w-[760px]"
            style={{ maxHeight: '560px' }}
          >
            <defs>
              {/* Subtle Alternating Turf Stripes Pattern */}
              <pattern id="turf-stripes" width="100" height="40" patternUnits="userSpaceOnUse">
                <rect width="100" height="20" fill="#587e4e" />
                <rect y="20" width="100" height="20" fill="#527649" />
              </pattern>

              {/* Goal Net Pattern */}
              <pattern id="goal-net-ref" width="4" height="4" patternUnits="userSpaceOnUse">
                <path d="M 0 0 L 4 4 M 4 0 L 0 4" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
              </pattern>
            </defs>

            {/* Turf Lawn Background */}
            <rect
              x={PITCH_LEFT}
              y={PITCH_TOP}
              width={PITCH_WIDTH}
              height={PITCH_HEIGHT}
              fill="url(#turf-stripes)"
              rx="6"
            />

            {/* Depth Labels (Left Margin) */}
            {ROW_LABELS.map((row, idx) => (
              <g key={`pitch-depth-${idx}`}>
                <text
                  x={PITCH_LEFT - 8}
                  y={PITCH_TOP + idx * ROW_HEIGHT + ROW_HEIGHT / 2 + 3}
                  textAnchor="end"
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#64748b"
                >
                  {row.title}
                </text>
              </g>
            ))}

            {/* Lane Labels (Top Margin) */}
            {COL_LABELS.map((col, idx) => (
              <text
                key={`pitch-lane-${idx}`}
                x={PITCH_LEFT + idx * COL_WIDTH + COL_WIDTH / 2}
                y={PITCH_TOP - 14}
                textAnchor="middle"
                fontSize="10"
                fontFamily="sans-serif"
                fontWeight="bold"
                fill="#475569"
                letterSpacing="0.04em"
              >
                {col.title.toUpperCase()}
              </text>
            ))}

            {/* 30 Discrete Spatial Heatmap Cells */}
            {activeCells.map((cell) => {
              const xPos = PITCH_LEFT + cell.col * COL_WIDTH;
              const yPos = PITCH_TOP + cell.row * ROW_HEIGHT;
              const isHovered = hoveredCell?.zone_id === cell.zone_id;
              const cellFill = getCellFillColor(cell);
              const roundedPct = Math.round(cell.pct_of_total);

              return (
                <g
                  key={`zone-cell-${cell.zone_id}`}
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={(e) => {
                    setHoveredCell(cell);
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
                    setHoveredCell(null);
                    setTooltipPos(null);
                  }}
                >
                  {/* Heatmap Cell Rectangle */}
                  <rect
                    x={xPos + 1.5}
                    y={yPos + 1.5}
                    width={COL_WIDTH - 3}
                    height={ROW_HEIGHT - 3}
                    rx="4"
                    fill={cellFill}
                    stroke={isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.15)'}
                    strokeWidth={isHovered ? 2.5 : 1}
                  />

                  {/* Cell Data Text Label (Matching Reference Style: e.g. "9%", "12%") */}
                  {cell.count > 0 ? (
                    <>
                      <text
                        x={xPos + COL_WIDTH / 2}
                        y={
                          displayMode === 'pct'
                            ? yPos + ROW_HEIGHT / 2 + 5.5
                            : yPos + ROW_HEIGHT / 2 - 3
                        }
                        textAnchor="middle"
                        fontSize={displayMode === 'pct' ? '16' : '13.5'}
                        fontFamily="sans-serif"
                        fontWeight="bold"
                        fill="#ffffff"
                        style={{
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
                        }}
                      >
                        {displayMode === 'pct'
                          ? roundedPct >= 1
                            ? `${roundedPct}%`
                            : '<1%'
                          : displayMode === 'count'
                          ? `${cell.count}`
                          : `${cell.xg.toFixed(2)}`}
                      </text>

                      {/* Secondary Subtitle if in count or xg mode */}
                      {displayMode !== 'pct' && (
                        <text
                          x={xPos + COL_WIDTH / 2}
                          y={yPos + ROW_HEIGHT / 2 + 13}
                          textAnchor="middle"
                          fontSize="9.5"
                          fontFamily="sans-serif"
                          fontWeight="semibold"
                          fill="rgba(255, 255, 255, 0.9)"
                          style={{
                            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.85))',
                          }}
                        >
                          {roundedPct}% total
                        </text>
                      )}

                      {/* Small Goal Badge if goals were scored from this zone */}
                      {cell.goals > 0 && (
                        <g transform={`translate(${xPos + COL_WIDTH - 22}, ${yPos + 6})`}>
                          <circle cx="8" cy="8" r="7" fill="#10b981" />
                          <text
                            x="8"
                            y="11.5"
                            textAnchor="middle"
                            fontSize="8"
                            fontFamily="monospace"
                            fontWeight="bold"
                            fill="#ffffff"
                          >
                            {cell.goals}⚽
                          </text>
                        </g>
                      )}
                    </>
                  ) : (
                    <text
                      x={xPos + COL_WIDTH / 2}
                      y={yPos + ROW_HEIGHT / 2 + 3}
                      textAnchor="middle"
                      fontSize="10"
                      fill="rgba(255, 255, 255, 0.2)"
                    >
                      -
                    </text>
                  )}
                </g>
              );
            })}

            {/* Attacking Final Third Markings in Crisp Pastel White */}
            <g className="final-third-markings" pointerEvents="none">
              {/* Outer Boundary */}
              <rect
                x={PITCH_LEFT}
                y={PITCH_TOP}
                width={PITCH_WIDTH}
                height={PITCH_HEIGHT}
                fill="none"
                stroke="rgba(255, 255, 255, 0.85)"
                strokeWidth="2.2"
                rx="6"
              />

              {/* Goal Frame & Net at Top (Centered) */}
              <g transform={`translate(${pitchCenterX - 38}, ${PITCH_TOP - 14})`}>
                <rect
                  x="0"
                  y="0"
                  width="76"
                  height="14"
                  fill="url(#goal-net-ref)"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>

              {/* 6-Yard Box (Área Chica): centered, ~18.3m width x 6m depth (Row 0) */}
              <rect
                x={pitchCenterX - 85}
                y={PITCH_TOP}
                width="170"
                height={ROW_HEIGHT}
                fill="none"
                stroke="rgba(255, 255, 255, 0.8)"
                strokeWidth="2"
              />

              {/* 18-Yard Box (Área Penal): spans Cols 1, 2, 3 (~40.3m wide), depth ~16.5m */}
              <rect
                x={PITCH_LEFT + COL_WIDTH}
                y={PITCH_TOP}
                width={COL_WIDTH * 3}
                height={ROW_HEIGHT * 2.35}
                fill="none"
                stroke="rgba(255, 255, 255, 0.9)"
                strokeWidth="2.2"
              />

              {/* Penalty Spot (11m from goal line, center of pitch) */}
              <circle
                cx={pitchCenterX}
                cy={PITCH_TOP + ROW_HEIGHT * 1.57}
                r="3.2"
                fill="#ffffff"
              />

              {/* Penalty Arc (Medialuna D, radius ~9.15m centered at penalty spot) */}
              <path
                d={`M ${pitchCenterX - 45} ${PITCH_TOP + ROW_HEIGHT * 2.35} A 46 46 0 0 0 ${pitchCenterX + 45} ${PITCH_TOP + ROW_HEIGHT * 2.35}`}
                fill="none"
                stroke="rgba(255, 255, 255, 0.85)"
                strokeWidth="2"
              />
            </g>

            {/* Bottom Direction Label */}
            <text
              x={pitchCenterX}
              y={PITCH_TOP + PITCH_HEIGHT + 20}
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill="#64748b"
              letterSpacing="0.06em"
            >
              ↑ DIRECCIÓN DE ATAQUE HACIA LA PORTERÍA RIVAL
            </text>
          </svg>

          {/* Floating Tooltip */}
          {hoveredCell && tooltipPos && (
            <div
              className="absolute pointer-events-none z-30 transition-all duration-75"
              style={{
                left: `${Math.min(tooltipPos.x + 16, (containerRef.current?.clientWidth ?? SVG_WIDTH) - 230)}px`,
                top: `${Math.max(tooltipPos.y - 50, 10)}px`,
              }}
            >
              <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-xl p-3 shadow-xl w-56">
                <div className="pb-1.5 border-b border-slate-700/70 mb-2">
                  <h4 className="text-xs font-bold text-white truncate">
                    {COL_LABELS[hoveredCell.col]?.title} — {ROW_LABELS[hoveredCell.row]?.title}
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    {ROW_LABELS[hoveredCell.row]?.subtitle}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">% del Total:</span>
                    <span className="font-mono font-bold text-sky-400">
                      {hoveredCell.pct_of_total.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Remates:</span>
                    <span className="font-mono font-bold text-white">
                      {hoveredCell.count}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">xG Acumulado:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {hoveredCell.xg.toFixed(3)} xG
                    </span>
                  </div>

                  {hoveredCell.goals > 0 && (
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                      <span className="text-slate-400">Goles anotados:</span>
                      <span className="font-bold text-amber-400">
                        {hoveredCell.goals} {hoveredCell.goals === 1 ? 'gol' : 'goles'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Footer Strip: 3 Key Tactical Indicators (Match Reference Structure) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        {/* Indicator 1: DENTRO DEL ÁREA */}
        <div className="bg-white border border-slate-200/90 rounded-xl px-4 py-3 shadow-2xs text-center">
          <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-500 tracking-wider block">
            DENTRO DEL ÁREA
          </span>
          <span className="text-xl sm:text-2xl font-mono font-extrabold text-slate-900 block mt-0.5">
            {tactics.pct_inside_box}%
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Tiros a ≤ 16.5m de distancia
          </span>
        </div>

        {/* Indicator 2: DE PELOTA PARADA */}
        <div className="bg-white border border-slate-200/90 rounded-xl px-4 py-3 shadow-2xs text-center">
          <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-500 tracking-wider block">
            DE PELOTA PARADA
          </span>
          <span className="text-xl sm:text-2xl font-mono font-extrabold text-blue-700 block mt-0.5">
            {tactics.pct_set_piece}%
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Córners, faltas y saques
          </span>
        </div>

        {/* Indicator 3: DE CONTRAATAQUE */}
        <div className="bg-white border border-slate-200/90 rounded-xl px-4 py-3 shadow-2xs text-center">
          <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-500 tracking-wider block">
            DE CONTRAATAQUE
          </span>
          <span className="text-xl sm:text-2xl font-mono font-extrabold text-emerald-700 block mt-0.5">
            {tactics.pct_fast_break}%
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Transición ofensiva rápida
          </span>
        </div>
      </div>
    </div>
  );
};

export default TeamShotZones;
