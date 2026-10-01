import React, { useState, useMemo, useRef } from 'react';
import { Download, Loader2, Info } from 'lucide-react';
import { toPng } from 'html-to-image';
import { TeamMetricEntry } from '../../services/api';
import { getTeamThemeColor } from '../../utils/teams';

export interface TeamTacticalRadarProps {
  teams: TeamMetricEntry[];
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
}

interface TacticalDimensionDef {
  key: string;
  name: string;
  shortName: string;
  description: string;
  extractor: (t: TeamMetricEntry) => number;
  format: (v: number) => string;
  higherIsBetter: boolean;
}

const TACTICAL_DIMENSIONS: TacticalDimensionDef[] = [
  {
    key: 'field_tilt',
    name: 'Posesión Campo Rival',
    shortName: 'Field Tilt',
    description: 'Porcentaje de posesión territorial en el tercio final ofensivo frente al rival.',
    extractor: (t) => t.field_tilt ?? t.field_tilt_pct ?? 50.0,
    format: (v) => `${v.toFixed(1)}%`,
    higherIsBetter: true,
  },
  {
    key: 'verticality',
    name: 'Verticalidad',
    shortName: 'Verticalidad',
    description: 'Porcentaje de pases hacia adelante respecto a los pases totales del equipo.',
    extractor: (t) => t.verticality_ratio_pct ?? 0,
    format: (v) => `${v.toFixed(1)}%`,
    higherIsBetter: true,
  },
  {
    key: 'box_shots',
    name: 'Remates en el Área',
    shortName: 'Tiros en Área / PJ',
    description: 'Volumen de tiros ejecutados dentro del área penal por partido disputado.',
    extractor: (t) => (t.matches_played > 0 ? t.shots_inside_box / t.matches_played : 0),
    format: (v) => `${v.toFixed(1)} / pj`,
    higherIsBetter: true,
  },
  {
    key: 'shot_quality',
    name: 'Calidad de Remate',
    shortName: 'xG / Tiro',
    description: 'Peligro medio generado por cada remate sin contar penales (xG por tiro).',
    extractor: (t) => t.xg_per_shot ?? (t.total_shots > 0 ? t.xg / t.total_shots : 0),
    format: (v) => `${v.toFixed(2)} xG`,
    higherIsBetter: true,
  },
  {
    key: 'pass_accuracy',
    name: 'Precisión de Pase',
    shortName: 'Precisión Pases',
    description: 'Porcentaje de pases completados con éxito en todas las zonas del campo.',
    extractor: (t) => t.pass_accuracy_pct ?? 0,
    format: (v) => `${v.toFixed(1)}%`,
    higherIsBetter: true,
  },
  {
    key: 'high_recoveries',
    name: 'Recuperaciones Altas',
    shortName: 'Recup. Altas / PJ',
    description: 'Balones recuperados en el 40% ofensivo del campo por partido disputado.',
    extractor: (t) => (t.matches_played > 0 ? t.high_recoveries / t.matches_played : 0),
    format: (v) => `${v.toFixed(1)} / pj`,
    higherIsBetter: true,
  },
  {
    key: 'ppda_intensity',
    name: 'Intensidad de Presión',
    shortName: 'Presión (PPDA)',
    description: 'Pases rivales permitidos por acción defensiva. Menor valor indica presión más intensa.',
    extractor: (t) => t.ppda ?? 10.0,
    format: (v) => `${v.toFixed(1)} PPDA`,
    higherIsBetter: false, // Inverted: lower PPDA is more aggressive pressing
  },
  {
    key: 'defensive_solidity',
    name: 'Solidez Defensiva',
    shortName: 'Solidez (xGA / PJ)',
    description: 'Goles esperados en contra concedidos por partido. Menor valor indica mayor solidez defensiva.',
    extractor: (t) => t.xga_per_match ?? (t.matches_played > 0 ? t.xga / t.matches_played : 0),
    format: (v) => `${v.toFixed(2)} xGA / pj`,
    higherIsBetter: false, // Inverted: lower xGA is higher defensive solidity
  },
];

interface DimensionComputed {
  def: TacticalDimensionDef;
  rawVal: number;
  rank: number;
  percentile: number;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  angleDeg: number;
}

export const TeamTacticalRadar: React.FC<TeamTacticalRadarProps> = ({
  teams,
  activeTeam,
  tournament = 'all',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [hoveredDim, setHoveredDim] = useState<DimensionComputed | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Active club styling
  const teamColor = useMemo(
    () => getTeamThemeColor(activeTeam.name, activeTeam.primary_color),
    [activeTeam]
  );

  // Geometry parameters (8-sided polygon in a 640 x 530 canvas)
  const CX = 320;
  const CY = 265;
  const MAX_RADIUS = 165;
  const MIN_RADIUS = 16; // Avoid absolute zero pinch
  const LABEL_RADIUS = 198;
  const NUM_VERTICES = TACTICAL_DIMENSIONS.length; // 8

  // Calculate cohort percentiles and SVG coordinate layout
  const computedDimensions = useMemo<DimensionComputed[]>(() => {
    if (!teams || teams.length === 0) return [];

    return TACTICAL_DIMENSIONS.map((dim, i) => {
      // 1. Extract values for all teams
      const cohort = teams.map((t) => ({
        team_id: t.team_id,
        val: dim.extractor(t),
      }));

      // 2. Sort cohort: descending if higherIsBetter, ascending if inverted
      cohort.sort((a, b) => (dim.higherIsBetter ? b.val - a.val : a.val - b.val));

      // 3. Compute rank and percentile for active club with tie support
      const n = cohort.length;
      let currentRank = 1;
      let activeVal = 0;
      let rank = 1;

      for (let idx = 0; idx < n; idx++) {
        if (idx > 0 && cohort[idx].val !== cohort[idx - 1].val) {
          currentRank = idx + 1;
        }
        if (cohort[idx].team_id === activeTeam.team_id) {
          activeVal = cohort[idx].val;
          rank = currentRank;
          break;
        }
      }

      // Percentile scale 0 to 100
      const percentile = n > 1 ? Math.round(((n - rank) / (n - 1)) * 100) : 50;

      // 4. Coordinates layout
      // Angles start at -90deg (12 o'clock / Top) and rotate clockwise
      const angleRad = -Math.PI / 2 + (i * 2 * Math.PI) / NUM_VERTICES;
      const angleDeg = (angleRad * 180) / Math.PI;

      // Map percentile (0-100) to radial distance [MIN_RADIUS, MAX_RADIUS]
      const r = MIN_RADIUS + (percentile / 100) * (MAX_RADIUS - MIN_RADIUS);

      const x = CX + r * Math.cos(angleRad);
      const y = CY + r * Math.sin(angleRad);

      const labelX = CX + LABEL_RADIUS * Math.cos(angleRad);
      const labelY = CY + LABEL_RADIUS * Math.sin(angleRad);

      return {
        def: dim,
        rawVal: activeVal,
        rank,
        percentile,
        x,
        y,
        labelX,
        labelY,
        angleDeg,
      };
    });
  }, [teams, activeTeam]);

  // Construct SVG polygon points string
  const polygonPoints = useMemo(() => {
    return computedDimensions.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ');
  }, [computedDimensions]);

  // Guidelines helper: generates coordinates for concentric octagons at given ratios
  const getRingPoints = (ratio: number) => {
    const r = MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS);
    return Array.from({ length: NUM_VERTICES })
      .map((_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / NUM_VERTICES;
        const x = CX + r * Math.cos(a);
        const y = CY + r * Math.sin(a);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  // Spokes helper: radial lines from center to outer ring (100%)
  const spokes = useMemo(() => {
    return Array.from({ length: NUM_VERTICES }).map((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / NUM_VERTICES;
      return {
        x2: CX + MAX_RADIUS * Math.cos(a),
        y2: CY + MAX_RADIUS * Math.sin(a),
      };
    });
  }, []);

  // Text anchor helper based on horizontal position
  const getTextAnchor = (x: number): 'start' | 'middle' | 'end' => {
    if (Math.abs(x - CX) < 18) return 'middle';
    return x > CX ? 'start' : 'end';
  };

  // High-Resolution PNG Export (2x)
  const handleExportPNG = async () => {
    if (isExporting || !cardRef.current) return;
    try {
      setIsExporting(true);
      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 80));
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
      const cleanName = activeTeam.name.replace(/\s+/g, '_');
      const cleanTourn = tournament === 'all' ? 'Temporada' : tournament;
      link.download = `Radar_Tactico_${cleanName}_${cleanTourn}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error al exportar PNG del radar táctico:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className="bg-white border border-slate-200/80 shadow-xs rounded-xl p-5 sm:p-6 relative select-none flex flex-col justify-between"
    >
      {/* Card Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-2 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            Perfil de Estilo Táctico
          </h2>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Percentiles frente al promedio de los 18 clubes de Liga 1 ({tournament === 'all' ? 'Temporada Completa' : tournament})
          </p>
        </div>

        {/* Export Button */}
        <button
          type="button"
          onClick={handleExportPNG}
          disabled={isExporting}
          className="export-ignore inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/80 rounded-lg text-xs font-medium transition-all shadow-2xs self-start sm:self-auto cursor-pointer"
          title="Descargar imagen en alta resolución (2x)"
        >
          {isExporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
          ) : (
            <Download className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span>{isExporting ? 'Exportando...' : 'Descargar PNG'}</span>
        </button>
      </div>

      {/* Radar SVG Canvas */}
      <div className="relative w-full flex items-center justify-center overflow-visible">
        <svg
          viewBox="0 0 640 530"
          className="w-full max-w-[620px] h-auto overflow-visible select-none"
        >
          {/* Concentric Guideline Octagons */}
          {/* 25% Ring */}
          <polygon
            points={getRingPoints(0.25)}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="1"
          />
          {/* 50% Median League Ring (Highlighted with dashed stroke) */}
          <polygon
            points={getRingPoints(0.5)}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
          {/* 75% Ring */}
          <polygon
            points={getRingPoints(0.75)}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="1"
          />
          {/* 100% Perimeter Ring */}
          <polygon
            points={getRingPoints(1.0)}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />

          {/* Radial Spokes from Center to Perimeter */}
          {spokes.map((spoke, idx) => (
            <line
              key={`spoke-${idx}`}
              x1={CX}
              y1={CY}
              x2={spoke.x2}
              y2={spoke.y2}
              stroke="#e2e8f0"
              strokeWidth="0.8"
            />
          ))}

          {/* Guideline Axis Ring Labels (25%, 50% Mediana, 75%, 100%) */}
          <text
            x={CX}
            y={CY - (MIN_RADIUS + 0.25 * (MAX_RADIUS - MIN_RADIUS)) - 3}
            textAnchor="middle"
            className="text-[9px] fill-slate-300 font-mono font-medium select-none"
          >
            P25
          </text>
          <text
            x={CX}
            y={CY - (MIN_RADIUS + 0.5 * (MAX_RADIUS - MIN_RADIUS)) - 3}
            textAnchor="middle"
            className="text-[9.5px] fill-slate-500 font-mono font-semibold select-none"
          >
            P50 (Mediana)
          </text>
          <text
            x={CX}
            y={CY - (MIN_RADIUS + 0.75 * (MAX_RADIUS - MIN_RADIUS)) - 3}
            textAnchor="middle"
            className="text-[9px] fill-slate-300 font-mono font-medium select-none"
          >
            P75
          </text>
          <text
            x={CX}
            y={CY - MAX_RADIUS - 4}
            textAnchor="middle"
            className="text-[9.5px] fill-slate-400 font-mono font-medium select-none"
          >
            P100
          </text>

          {/* Team Radar Polygon */}
          <polygon
            points={polygonPoints}
            fill={teamColor}
            fillOpacity={0.25}
            stroke={teamColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
            className="transition-all duration-300 ease-out"
          />

          {/* Vertex Nodes & Hit Targets */}
          {computedDimensions.map((dim) => {
            const isHovered = hoveredDim?.def.key === dim.def.key;
            return (
              <g key={`node-${dim.def.key}`}>
                {/* Visual Vertex Node */}
                <circle
                  cx={dim.x}
                  cy={dim.y}
                  r={isHovered ? 6 : 4}
                  fill={isHovered ? teamColor : '#ffffff'}
                  stroke={teamColor}
                  strokeWidth={isHovered ? 2.5 : 2}
                  className="transition-all duration-150"
                />

                {/* Generous Invisible Hover Hit Area */}
                <circle
                  cx={dim.x}
                  cy={dim.y}
                  r={18}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const cardRect = cardRef.current?.getBoundingClientRect();
                    if (cardRect) {
                      setTooltipPos({
                        x: rect.left - cardRect.left + rect.width / 2,
                        y: rect.top - cardRect.top,
                      });
                    }
                    setHoveredDim(dim);
                  }}
                  onMouseLeave={() => {
                    setHoveredDim(null);
                    setTooltipPos(null);
                  }}
                />
              </g>
            );
          })}

          {/* Perimeter Vertex Labels */}
          {computedDimensions.map((dim) => {
            const anchor = getTextAnchor(dim.labelX);
            const isHovered = hoveredDim?.def.key === dim.def.key;

            // Offset label vertically if near top or bottom
            let dy = 4;
            if (dim.labelY < CY - 110) dy = -16;
            if (dim.labelY > CY + 110) dy = 14;

            return (
              <g
                key={`label-${dim.def.key}`}
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const cardRect = cardRef.current?.getBoundingClientRect();
                  if (cardRect) {
                    setTooltipPos({
                      x: rect.left - cardRect.left + rect.width / 2,
                      y: rect.top - cardRect.top,
                    });
                  }
                  setHoveredDim(dim);
                }}
                onMouseLeave={() => {
                  setHoveredDim(null);
                  setTooltipPos(null);
                }}
              >
                <text
                  x={dim.labelX}
                  y={dim.labelY + dy}
                  textAnchor={anchor}
                  className="select-none"
                >
                  <tspan
                    className={`text-xs ${
                      isHovered ? 'fill-slate-950 font-semibold' : 'fill-slate-600 font-normal'
                    }`}
                  >
                    {dim.def.shortName}
                  </tspan>
                  <tspan className="fill-slate-300 font-light"> • </tspan>
                  <tspan
                    className={`text-xs ${
                      isHovered ? 'fill-navy font-bold' : 'fill-slate-800 font-medium'
                    }`}
                  >
                    P{dim.percentile}
                  </tspan>
                </text>
              </g>
            );
          })}
        </svg>

        {/* Interactive Editorial Floating Tooltip */}
        {hoveredDim && tooltipPos && (
          <div
            className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-slate-900 text-white rounded-xl px-3.5 py-2.5 text-xs shadow-xl border border-slate-700/60 max-w-[260px] transition-all duration-100"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y - 8}px`,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
              <span className="font-bold text-white text-xs tracking-tight">
                {hoveredDim.def.name}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950">
                P{hoveredDim.percentile}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug mb-2 font-normal">
              {hoveredDim.def.description}
            </p>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
              <span className="text-slate-400">Valor real:</span>
              <span className="font-mono font-semibold text-emerald-400">
                {hoveredDim.def.format(hoveredDim.rawVal)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] mt-0.5">
              <span className="text-slate-400">Posición en Liga 1:</span>
              <span className="font-semibold text-slate-200">
                #{hoveredDim.rank} de {teams.length}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tactical Diagnostic Strip below Radar */}
      <div className="mt-2 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-normal">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Línea segmentada central = P50 (Mediana de la liga). Los percentiles van de P0 (mínimo) a P100 (líder).</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: teamColor }}
            />
            <strong className="text-slate-800 font-medium">{activeTeam.name}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

export default TeamTacticalRadar;
