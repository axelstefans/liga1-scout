import React from 'react';
import {
  BoxEntriesModule as BoxEntriesModuleData,
  BoxEntryVector,
  DumbbellStageRow,
  EntryOriginLaneModule as EntryOriginLaneModuleData,
  NestedPossessionStagesModule as NestedPossessionStagesModuleData,
  PassingShapeModule as PassingShapeModuleData,
  PassingShapeSector,
} from '../../services/api';
import { ScoutingLang } from '../../i18n/scoutingReport';
import { SVG_FONT_SANS, scalePathToField } from './matchReportSheet01Utils';

export interface PassingShapeModuleProps {
  moduleNumber: '01' | '02';
  teamName: string;
  teamColor: string;
  moduleData: PassingShapeModuleData | null;
  lang?: ScoutingLang;
}

export const PassingShapeModule: React.FC<PassingShapeModuleProps> = ({
  moduleNumber,
  teamName,
  teamColor,
  moduleData,
  lang = 'es',
}) => {
  const isEs = lang === 'es';

  // SVG Geometry constants
  const VB_W = 460;
  const VB_H = 260;
  const cx = 230;
  const cy = 130;

  // Concentric reference rings
  const R_18M = 45;
  const R_36M = 90;
  const AXIS_EXTENT = 105;

  const sectors: PassingShapeSector[] = moduleData?.sectors ?? [];
  const summary = moduleData?.summary;

  return (
    <div className="flex flex-col justify-between">
      {/* Module Header */}
      <div className="border-b border-slate-200 pb-2 mb-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs font-bold text-slate-400">
            {moduleNumber}
          </span>
          <h2 className="text-xs font-bold tracking-[0.04em] text-slate-900">
            {teamName} · {isEs ? 'passing shape' : 'passing shape'}
          </h2>
        </div>
        <p className="font-sans text-[11px] text-slate-500 mt-0.5 mb-2">
          {isEs
            ? 'Longitud de cuña = distancia mediana | opacidad = efectividad | ataque hacia la derecha'
            : 'Wedge length = median distance | opacity = completion | attacking direction is right'}
        </p>
      </div>

      {/* SVG Polar Rose Chart */}
      {!moduleData || sectors.length === 0 ? (
        <div className="h-[260px] flex items-center justify-center font-mono text-xs text-slate-400">
          — {isEs ? 'Sin datos de distribución de pases' : 'No passing shape data'} —
        </div>
      ) : (
        <div className="w-full">
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="w-full h-auto block select-none"
            aria-label={`${teamName} passing shape polar rose`}
          >
            {/* 1. Subtle Background Reference Concentric Rings */}
            <circle
              cx={cx}
              cy={cy}
              r={R_18M}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={cx}
              cy={cy}
              r={R_36M}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* 2. Cardinal Axis Cross */}
            <line
              x1={cx - AXIS_EXTENT}
              y1={cy}
              x2={cx + AXIS_EXTENT}
              y2={cy}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <line
              x1={cx}
              y1={cy - AXIS_EXTENT}
              x2={cx}
              y2={cy + AXIS_EXTENT}
              stroke="#e2e8f0"
              strokeWidth="1"
            />

            {/* 3. Render 16 Angular Sector Wedges (<path />) */}
            <g id={`sectors-${moduleNumber}`}>
              {sectors.map((sector) => {
                const { angle_deg, pass_count, completion_pct, median_distance_m } = sector;

                // Skip wedge if no passes or zero distance
                if (pass_count <= 0 || median_distance_m <= 0) {
                  return null;
                }

                // Radius scaling: clamped to exact 36m reference ring (90px)
                const R_MAX = 90; // Radio exacto del círculo de 36m
                const r = Math.min(R_MAX, Math.max(8, (sector.median_distance_m / 36) * R_MAX));

                // Opacity scaling: opacity = 0.20 + min(0.70, (completion_pct / 100) * 0.70)
                const opacity = 0.20 + Math.min(0.70, (completion_pct / 100) * 0.70);

                // Angular sector bounds (+- 11.25 deg around central angle)
                const a1 = ((angle_deg - 11.25) * Math.PI) / 180;
                const a2 = ((angle_deg + 11.25) * Math.PI) / 180;

                // Arc coordinates: in SVG, y is inverted (+y points down)
                const x1 = cx + r * Math.cos(a1);
                const y1 = cy - r * Math.sin(a1);
                const x2 = cx + r * Math.cos(a2);
                const y2 = cy - r * Math.sin(a2);

                const pathData = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 0 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;

                return (
                  <path
                    key={`sec-${angle_deg}`}
                    d={pathData}
                    fill={teamColor}
                    fillOpacity={Number(opacity.toFixed(3))}
                    stroke="none"
                  >
                    <title>
                      {`${angle_deg.toFixed(1)}°: ${pass_count} ${isEs ? 'pases' : 'passes'}, ${completion_pct.toFixed(1)}% ${isEs ? 'precisión' : 'acc'}, ${median_distance_m.toFixed(1)}m`}
                    </title>
                  </path>
                );
              })}
            </g>

            {/* 4. Concentric Metric Distance Reference Labels (North Axis) */}
            <text
              x={cx + 3}
              y={cy - R_18M - 3}
              fontSize="8.5"
              fontFamily={SVG_FONT_SANS}
              fill="#94a3b8"
              textAnchor="start"
              dominantBaseline="auto"
            >
              18m
            </text>
            <text
              x={cx + 3}
              y={cy - R_36M - 3}
              fontSize="8.5"
              fontFamily={SVG_FONT_SANS}
              fill="#94a3b8"
              textAnchor="start"
              dominantBaseline="auto"
            >
              36m
            </text>

            {/* 5. Cardinal Direction Labels */}
            {/* FWD: 3:00 (East, +x) */}
            <text
              x={cx + 114}
              y={cy}
              fontSize="9"
              fontFamily={SVG_FONT_SANS}
              fontWeight="700"
              fill="#64748b"
              textAnchor="start"
              dominantBaseline="middle"
            >
              FWD
            </text>

            {/* LEFT: 12:00 (North, -y) */}
            <text
              x={cx}
              y={cy - 114}
              fontSize="9"
              fontFamily={SVG_FONT_SANS}
              fontWeight="700"
              fill="#64748b"
              textAnchor="middle"
              dominantBaseline="auto"
            >
              LEFT
            </text>

            {/* BACK: 9:00 (West, -x) */}
            <text
              x={cx - 114}
              y={cy}
              fontSize="9"
              fontFamily={SVG_FONT_SANS}
              fontWeight="700"
              fill="#64748b"
              textAnchor="end"
              dominantBaseline="middle"
            >
              BACK
            </text>

            {/* RIGHT: 6:00 (South, +y) */}
            <text
              x={cx}
              y={cy + 118}
              fontSize="9"
              fontFamily={SVG_FONT_SANS}
              fontWeight="700"
              fill="#64748b"
              textAnchor="middle"
              dominantBaseline="hanging"
            >
              RIGHT
            </text>
          </svg>
        </div>
      )}

      {/* Quantitative Summary Below Polar Rose */}
      {summary && (
        <p className="text-center font-mono text-[11px] text-slate-500 mt-1 tabular-nums">
          {summary.total_passes} {isEs ? 'pases' : 'passes'} · {summary.forward_pct.toFixed(1)}% {isEs ? 'adelante' : 'forward'} · {summary.completed_pct.toFixed(1)}% {isEs ? 'completados' : 'completed'}
        </p>
      )}
    </div>
  );
};

export interface BoxEntriesPitchModuleProps {
  moduleNumber: '03' | '04';
  teamName: string;
  teamColor: string;
  moduleData: BoxEntriesModuleData | null;
  lang?: ScoutingLang;
}

export const BoxEntriesPitchModule: React.FC<BoxEntriesPitchModuleProps> = ({
  moduleNumber,
  teamName,
  teamColor,
  moduleData,
  lang = 'es',
}) => {
  const isEs = lang === 'es';

  // SVG Geometry constants for regulation full pitch
  const VB_W = 460;
  const VB_H = 264;
  const FP_LEFT = 18;
  const FP_TOP = 16;
  const FP_W = 424;
  const FP_H = 240;
  const FP_RIGHT = FP_LEFT + FP_W;
  const FP_BOTTOM = FP_TOP + FP_H;
  const FP_CENTER_X = FP_LEFT + FP_W / 2;
  const FP_CENTER_Y = FP_TOP + FP_H / 2;

  const FP_PEN_DIST = (11.0 / 105.0) * FP_W;
  const FP_BOX_LEN = (16.5 / 105.0) * FP_W;
  const FP_BOX_WID = (40.32 / 68.0) * FP_H;
  const FP_BOX_Y = FP_CENTER_Y - FP_BOX_WID / 2;
  const FP_SIX_LEN = (5.5 / 105.0) * FP_W;
  const FP_SIX_WID = (18.32 / 68.0) * FP_H;
  const FP_SIX_Y = FP_CENTER_Y - FP_SIX_WID / 2;
  const FP_CIRCLE_R = (9.15 / 105.0) * FP_W;
  const FP_GOAL_WID = (7.32 / 68.0) * FP_H;
  const FP_GOAL_Y = FP_CENTER_Y - FP_GOAL_WID / 2;
  const FP_ARC_DX = FP_BOX_LEN - FP_PEN_DIST;
  const FP_ARC_DY = Math.sqrt(Math.max(0, FP_CIRCLE_R * FP_CIRCLE_R - FP_ARC_DX * FP_ARC_DX));

  const safeColorId = teamColor.replace('#', '');
  const arrowMarkerId = `box-arrow-${moduleNumber}-${safeColorId}`;
  const clipId = `box-pitch-clip-${moduleNumber}-${safeColorId}`;

  const entries: BoxEntryVector[] = moduleData?.entries ?? [];
  const density = moduleData?.density ?? null;
  const totalEntries = moduleData?.total_entries ?? entries.length;
  const passesCount = entries.filter((e) => e.entry_type === 'pass').length;
  const crossesCount = entries.filter((e) => e.entry_type === 'cross').length;
  const carriesCount = entries.filter((e) => e.entry_type === 'carry').length;

  return (
    <div className="flex flex-col justify-between">
      {/* Module Header */}
      <div className="border-b border-slate-200 pb-2 mb-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs font-bold text-slate-400">
            {moduleNumber}
          </span>
          <h2 className="text-xs font-bold tracking-[0.04em] text-slate-900">
            {teamName} · box entries
          </h2>
        </div>
        <p className="font-sans text-[11px] text-slate-500 mt-0.5 mb-2">
          {isEs
            ? 'Flechas = ingresos exitosos al área; sombreado = densidad de toques | ataca →'
            : 'Arrows = successful box entries; shading = touch density | attacks →'}
        </p>
      </div>

      {/* SVG Full Pitch Chart */}
      {!moduleData || entries.length === 0 ? (
        <div className="h-[264px] flex items-center justify-center font-mono text-xs text-slate-400">
          — {isEs ? 'Sin registros de ingresos al área' : 'No box entry records'} —
        </div>
      ) : (
        <div className="w-full">
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="w-full h-auto block select-none"
            aria-label={`${teamName} box entries pitch map`}
          >
            <defs>
              <marker
                id={arrowMarkerId}
                viewBox="0 0 6 6"
                refX="5"
                refY="3"
                markerWidth="4"
                markerHeight="4"
                orient="auto-start-reverse"
              >
                <path d="M 0 0.5 L 5.5 3 L 0 5.5 z" fill={teamColor} />
              </marker>
              <clipPath id={clipId}>
                <rect x={FP_LEFT} y={FP_TOP} width={FP_W} height={FP_H} rx="2" />
              </clipPath>
            </defs>

            {/* Pitch Base */}
            <rect x={FP_LEFT} y={FP_TOP} width={FP_W} height={FP_H} fill="#f8fafc" />

            {/* Capa 1 (Fondo): Contornos Vectoriales de Densidad */}
            {density?.contours && (
              <g clipPath={`url(#${clipId})`}>
                {[...density.contours]
                  .sort((a, b) => a.level - b.level)
                  .map((contour, idx) => {
                    if (!contour.svg_path) return null;
                    const scaledD = scalePathToField(contour.svg_path, FP_LEFT, FP_TOP, FP_W, FP_H);
                    if (!scaledD) return null;
                    const opacity = contour.level <= 0.26 ? 0.08 : contour.level <= 0.51 ? 0.12 : 0.18;
                    return (
                      <path
                        key={`box-density-${contour.level}-${idx}`}
                        d={scaledD}
                        fill={teamColor}
                        fillOpacity={opacity}
                        fillRule="evenodd"
                        stroke="none"
                      />
                    );
                  })}
              </g>
            )}

            {/* Capa 2 (Intermedia): Trazado del Campo en #94a3b8 1.2px */}
            <g stroke="#94a3b8" strokeWidth="1.2" fill="none">
              <rect x={FP_LEFT} y={FP_TOP} width={FP_W} height={FP_H} />
              <line x1={FP_CENTER_X} y1={FP_TOP} x2={FP_CENTER_X} y2={FP_BOTTOM} />
              <circle cx={FP_CENTER_X} cy={FP_CENTER_Y} r={FP_CIRCLE_R} />
              <circle cx={FP_CENTER_X} cy={FP_CENTER_Y} r="1.8" fill="#94a3b8" stroke="none" />

              {/* Left Penalty Area & Goal Area (own half) */}
              <rect x={FP_LEFT} y={FP_BOX_Y} width={FP_BOX_LEN} height={FP_BOX_WID} />
              <rect x={FP_LEFT} y={FP_SIX_Y} width={FP_SIX_LEN} height={FP_SIX_WID} />
              <circle cx={FP_LEFT + FP_PEN_DIST} cy={FP_CENTER_Y} r="1.6" fill="#94a3b8" stroke="none" />
              <path
                d={`M ${FP_LEFT + FP_BOX_LEN} ${FP_CENTER_Y - FP_ARC_DY} A ${FP_CIRCLE_R} ${FP_CIRCLE_R} 0 0 1 ${FP_LEFT + FP_BOX_LEN} ${FP_CENTER_Y + FP_ARC_DY}`}
              />

              {/* Right Penalty Area & Goal Area (opponent attacking box) */}
              <rect x={FP_RIGHT - FP_BOX_LEN} y={FP_BOX_Y} width={FP_BOX_LEN} height={FP_BOX_WID} />
              <rect x={FP_RIGHT - FP_SIX_LEN} y={FP_SIX_Y} width={FP_SIX_LEN} height={FP_SIX_WID} />
              <circle cx={FP_RIGHT - FP_PEN_DIST} cy={FP_CENTER_Y} r="1.6" fill="#94a3b8" stroke="none" />
              <path
                d={`M ${FP_RIGHT - FP_BOX_LEN} ${FP_CENTER_Y - FP_ARC_DY} A ${FP_CIRCLE_R} ${FP_CIRCLE_R} 0 0 0 ${FP_RIGHT - FP_BOX_LEN} ${FP_CENTER_Y + FP_ARC_DY}`}
              />

              {/* Goals */}
              <rect x={FP_LEFT - 6} y={FP_GOAL_Y} width="6" height={FP_GOAL_WID} fill="#f1f5f9" />
              <rect x={FP_RIGHT} y={FP_GOAL_Y} width="6" height={FP_GOAL_WID} fill="#f1f5f9" />
            </g>

            {/* Capa 3 (Frente): Vectores de Entrada al Área (entries) */}
            <g id={`box-entries-${moduleNumber}`}>
              {entries.map((entry) => {
                const x1 = FP_LEFT + (entry.x_start / 100) * FP_W;
                const y1 = FP_TOP + (entry.y_start / 100) * FP_H;
                const x2 = FP_LEFT + (entry.x_end / 100) * FP_W;
                const y2 = FP_TOP + (entry.y_end / 100) * FP_H;

                return (
                  <line
                    key={`box-entry-${entry.id}`}
                    x1={x1.toFixed(1)}
                    y1={y1.toFixed(1)}
                    x2={x2.toFixed(1)}
                    y2={y2.toFixed(1)}
                    stroke={teamColor}
                    strokeWidth="1.5"
                    strokeOpacity="0.85"
                    markerEnd={`url(#${arrowMarkerId})`}
                  >
                    <title>{`${entry.entry_type.toUpperCase()} (#${entry.id})`}</title>
                  </line>
                );
              })}
            </g>
          </svg>
        </div>
      )}

      {/* Quantitative Summary Below Box Entries Pitch */}
      {totalEntries > 0 && (
        <p className="text-center font-mono text-[11px] text-slate-500 mt-1 tabular-nums">
          {totalEntries} {isEs ? 'ingresos' : 'entries'} · {passesCount} {isEs ? 'pases' : 'passes'} · {crossesCount} {isEs ? 'centros' : 'crosses'} · {carriesCount} {isEs ? 'conducciones' : 'carries'}
        </p>
      )}
    </div>
  );
};

// ============================================================================
// HELPER: ESCALAS Y TICKS ADAPTATIVOS PARA DOT PLOTS
// ============================================================================

function computeDumbbellScale(maxVal: number): { maxScale: number; ticks: number[] } {
  let step = 20;
  let maxScale = 20;

  if (maxVal <= 6) {
    step = 1;
    maxScale = Math.max(maxVal, 4);
  } else if (maxVal <= 12) {
    step = 2;
    maxScale = 12;
  } else if (maxVal <= 24) {
    step = 4;
    maxScale = Math.ceil(maxVal / 4) * 4;
  } else if (maxVal <= 50) {
    step = 10;
    maxScale = Math.ceil(maxVal / 10) * 10;
  } else if (maxVal <= 180) {
    step = 20;
    maxScale = Math.ceil(maxVal / 20) * 20;
  } else {
    step = 40;
    maxScale = Math.ceil(maxVal / 40) * 40;
  }

  const ticks: number[] = [];
  for (let t = 0; t <= maxScale; t += step) ticks.push(t);
  return { maxScale, ticks };
}

const STAGE_LABELS_ES: Record<string, string> = {
  possessions: 'Posesiones',
  reached_third: 'Último tercio',
  then_box: 'Área rival',
  then_shot: 'Tiro al arco',
  on_target: 'A puerta',
};

const LANE_LABELS_ES: Record<string, string> = { left: 'Izquierda', centre: 'Centro', right: 'Derecha' };

// ============================================================================
// BASE REUTILIZABLE: CLEVELAND DOT PLOT / DUMBBELL EN "L" ABIERTA
// ============================================================================

interface DumbbellDotPlotModuleProps {
  moduleNumber: '05' | '06';
  title: string;
  subtitle: string;
  emptyText: string;
  rows: DumbbellStageRow[];
  maxVal: number;
  rowStartY: number;
  rowStepY: number;
  axisY?: number;
  labelTranslations?: Record<string, string>;
  homeColor: string;
  awayColor: string;
  areColorsSimilar?: boolean;
  lang?: ScoutingLang;
}

const DumbbellDotPlotModule: React.FC<DumbbellDotPlotModuleProps> = ({
  moduleNumber,
  title,
  subtitle,
  emptyText,
  rows,
  maxVal,
  rowStartY,
  rowStepY,
  axisY = 170,
  labelTranslations,
  homeColor,
  awayColor,
  areColorsSimilar = false,
  lang = 'es',
}) => {
  const isEs = lang === 'es';
  const VB_W = 460;
  const VB_H = 210;
  const originX = 110;
  const AXIS_Y = axisY;

  const rawMax = maxVal > 0 ? maxVal : Math.max(1, ...rows.map((r) => Math.max(r.home_val, r.away_val)));
  const { maxScale, ticks } = computeDumbbellScale(rawMax);

  const safeMax = Math.max(1, maxScale);
  const numSteps = ticks.length > 1 ? ticks.length - 1 : 1;
  const availableWidth = 320; // Ancho útil asignado a la zona de datos
  const gridStep = availableWidth / (numSteps + 0.4);
  const leftPadding = gridStep * 0.35; // Sangría sutil: ~35% de una celda

  const getX = (val: number) => originX + leftPadding + (val / safeMax) * (numSteps * gridStep);
  const endX = originX + leftPadding + numSteps * gridStep;

  return (
    <div className="flex flex-col justify-between">
      {/* Header */}
      <div className="border-b border-slate-200 pb-2 mb-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs font-bold text-slate-400">{moduleNumber}</span>
          <h2 className="text-xs font-bold tracking-[0.04em] text-slate-900">{title}</h2>
        </div>
        <p className="font-sans text-[11px] text-slate-500 mt-0.5 mb-2">{subtitle}</p>
      </div>

      {/* SVG Cleveland Dot Plot */}
      {rows.length === 0 ? (
        <div className="h-[210px] flex items-center justify-center font-mono text-xs text-slate-400">
          — {emptyText} —
        </div>
      ) : (
        <div className="w-full">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-auto block select-none" aria-label={`${title} dumbbell chart`}>
            {/* 1. Retícula interna tenue */}
            {rows.map((_, idx) => (
              <line key={`${moduleNumber}-grid-h-${idx}`} x1={originX} y1={rowStartY + idx * rowStepY} x2={endX} y2={rowStartY + idx * rowStepY} stroke="#f1f5f9" strokeWidth="1" />
            ))}
            {ticks.map((tv) => (
              <line key={`${moduleNumber}-grid-v-${tv}`} x1={getX(tv)} y1={rowStartY - 12} x2={getX(tv)} y2={AXIS_Y} stroke="#f1f5f9" strokeWidth="1" />
            ))}

            {/* 2. Ejes abiertos en L (sin recuadro perimetral) */}
            <line x1={originX} y1={rowStartY - 12} x2={originX} y2={AXIS_Y} stroke="#cbd5e1" strokeWidth="1" />
            <line x1={originX} y1={AXIS_Y} x2={endX} y2={AXIS_Y} stroke="#cbd5e1" strokeWidth="1" />

            {/* 3. Conectores Dumbbell, Marcadores y Cifras con Lógica Anti-Colisión */}
            {rows.map((row, idx) => {
              const rowY = rowStartY + idx * rowStepY;
              const hx = getX(row.home_val);
              const ax = getX(row.away_val);
              const delta = ax - hx;

              // Anti-fusión de glifos: separación mínima de 9 px
              let renderHx = hx;
              let renderAx = ax;
              if (Math.abs(delta) < 9) {
                const shift = (9 - Math.abs(delta)) / 2;
                renderHx = hx - (delta >= 0 ? shift : -shift);
                renderAx = ax + (delta >= 0 ? shift : -shift);
              }

              // Desvío horizontal de cifras numéricas próximas (< 12 px)
              let labelHx = renderHx;
              let labelAx = renderAx;
              if (Math.abs(delta) < 12) {
                if (row.home_val < row.away_val) {
                  labelHx = renderHx - 3;
                  labelAx = renderAx + 3;
                } else if (row.home_val > row.away_val) {
                  labelHx = renderHx + 3;
                  labelAx = renderAx - 3;
                } else {
                  labelHx = renderHx - 4;
                  labelAx = renderAx + 4;
                }
              }

              const label = isEs && labelTranslations ? (labelTranslations[row.key] ?? row.label) : row.label;

              return (
                <g key={`${moduleNumber}-row-${row.key}`}>
                  {/* Barra conectora horizontal */}
                  <line
                    x1={Math.min(renderHx, renderAx)}
                    y1={rowY}
                    x2={Math.max(renderHx, renderAx)}
                    y2={rowY}
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  {/* Cuadrado visitante (fondo) */}
                  <rect
                    x={renderAx - 4}
                    y={rowY - 4}
                    width="8"
                    height="8"
                    fill={areColorsSimilar ? '#ffffff' : awayColor}
                    stroke={awayColor}
                    strokeWidth="1.5"
                  />
                  {/* Círculo local (frente) */}
                  <circle
                    cx={renderHx}
                    cy={rowY}
                    r="4.5"
                    fill={homeColor}
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                  {/* Categoría a la izquierda en originX - 14 */}
                  <text
                    x={originX - 14}
                    y={rowY}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize="11"
                    fontFamily={SVG_FONT_SANS}
                    fontWeight="600"
                    fill="#334155"
                  >
                    {label}
                  </text>
                  {/* Cifra local arriba */}
                  <text
                    x={labelHx}
                    y={rowY - 7}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily={SVG_FONT_SANS}
                    fontWeight="700"
                    fill={homeColor}
                  >
                    {row.home_val}
                  </text>
                  {/* Cifra visitante abajo */}
                  <text
                    x={labelAx}
                    y={rowY + 13}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily={SVG_FONT_SANS}
                    fontWeight="700"
                    fill={awayColor}
                  >
                    {row.away_val}
                  </text>
                </g>
              );
            })}

            {/* 4. Ticks del Eje X Inferior */}
            {ticks.map((tv) => (
              <text key={`${moduleNumber}-tick-${tv}`} x={getX(tv)} y={AXIS_Y + 14} textAnchor="middle" fontSize="9.5" fontFamily={SVG_FONT_SANS} fill="#94a3b8">
                {tv}
              </text>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MÓDULO 05: NESTED POSSESSION STAGES
// ============================================================================

export interface NestedPossessionStagesModuleProps {
  moduleData: NestedPossessionStagesModuleData | null;
  homeColor: string;
  awayColor: string;
  areColorsSimilar?: boolean;
  lang?: ScoutingLang;
}

export const NestedPossessionStagesModule05: React.FC<NestedPossessionStagesModuleProps> = ({
  moduleData,
  homeColor,
  awayColor,
  areColorsSimilar = false,
  lang = 'es',
}) => {
  const isEs = lang === 'es';
  return (
    <DumbbellDotPlotModule
      moduleNumber="05"
      title="Nested possession stages"
      subtitle={
        isEs
          ? 'Misma posesión en cada etapa; excluye tiros lejanos sin ingreso al área'
          : 'Same possession at every stage; long shots without box access excluded'
      }
      emptyText={isEs ? 'Sin datos de etapas de posesión' : 'No possession stages data'}
      rows={moduleData?.stages ?? []}
      maxVal={moduleData?.max_val ?? 1}
      rowStartY={22}
      rowStepY={34}
      axisY={190}
      labelTranslations={STAGE_LABELS_ES}
      homeColor={homeColor}
      awayColor={awayColor}
      areColorsSimilar={areColorsSimilar}
      lang={lang}
    />
  );
};

// ============================================================================
// MÓDULO 06: ENTRY ORIGIN LANE
// ============================================================================

export interface EntryOriginLaneModuleProps {
  moduleData: EntryOriginLaneModuleData | null;
  homeColor: string;
  awayColor: string;
  areColorsSimilar?: boolean;
  lang?: ScoutingLang;
}

export const EntryOriginLaneModule06: React.FC<EntryOriginLaneModuleProps> = ({
  moduleData,
  homeColor,
  awayColor,
  areColorsSimilar = false,
  lang = 'es',
}) => {
  const isEs = lang === 'es';
  return (
    <DumbbellDotPlotModule
      moduleNumber="06"
      title="Entry origin lane"
      subtitle={
        isEs
          ? 'Eventos de ingreso; varios pueden pertenecer a una misma posesión'
          : 'Entry events; several may belong to one possession'
      }
      emptyText={isEs ? 'Sin datos de carriles de ingreso' : 'No entry origin lane data'}
      rows={moduleData?.lanes ?? []}
      maxVal={moduleData?.max_val ?? 1}
      rowStartY={38}
      rowStepY={44}
      axisY={175}
      labelTranslations={LANE_LABELS_ES}
      homeColor={homeColor}
      awayColor={awayColor}
      areColorsSimilar={areColorsSimilar}
      lang={lang}
    />
  );
};

export default PassingShapeModule;
