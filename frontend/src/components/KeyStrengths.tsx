import React, { useState, useMemo } from 'react';
import { PlayerProfile } from '../services/api';

interface KeyStrengthsProps {
  profile: PlayerProfile;
  seasonStats: any;
  mainPosition?: string | null;
  themeColor?: string;
}

interface SliceData {
  name: string;
  rawVal: number;
  score: number;
  fill: string;
  angleVal: number;
}

interface ChartConfig {
  title: string;
  dataset: SliceData[];
}

const POLAR_MAX_RADIUS = 80;
const INNER_RADIUS = 10;
const GRID_RINGS = [16, 32, 48, 64, 80];
const SIZE = 200; // SVG viewBox size
const CX = SIZE / 2;
const CY = SIZE / 2;

const toRad = (deg: number) => (deg * Math.PI) / 180;

// Build an annular sector SVG path
const sectorPath = (cx: number, cy: number, r: number, innerR: number, startDeg: number, endDeg: number) => {
  const x1 = cx + innerR * Math.cos(toRad(startDeg));
  const y1 = cy + innerR * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(startDeg));
  const y2 = cy + r * Math.sin(toRad(startDeg));
  const x3 = cx + r * Math.cos(toRad(endDeg));
  const y3 = cy + r * Math.sin(toRad(endDeg));
  const x4 = cx + innerR * Math.cos(toRad(endDeg));
  const y4 = cy + innerR * Math.sin(toRad(endDeg));
  const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${x3} ${y3}`,
    `L ${x4} ${y4}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1} ${y1}`,
    'Z'
  ].join(' ');
};

// Individual polar chart — pure SVG, zero Recharts
const PolarChart: React.FC<{ dataset: SliceData[]; fill: string }> = ({ dataset }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; slice: SliceData } | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = dataset.reduce((s, d) => s + d.angleVal, 0);

  // Pre-compute slices
  const slices = useMemo(() => {
    let cursor = -90; // start at top (12 o'clock)
    return dataset.map((d) => {
      const angleDeg = (d.angleVal / total) * 360;
      const startDeg = cursor;
      const endDeg = cursor + angleDeg;
      cursor = endDeg;
      const r = Math.max(POLAR_MAX_RADIUS * 0.15, (d.score / 100) * POLAR_MAX_RADIUS);
      // Hit area uses full radius for easier mouse targeting
      const hitPath = sectorPath(CX, CY, POLAR_MAX_RADIUS, INNER_RADIUS, startDeg, endDeg);
      const visPath = sectorPath(CX, CY, r, INNER_RADIUS, startDeg, endDeg);
      return { ...d, visPath, hitPath, r };
    });
  }, [dataset, total]);

  // Spoke angles
  const spokeAngles = useMemo(() => {
    let cursor = -90;
    return dataset.map((d) => {
      const angle = cursor;
      cursor += (d.angleVal / total) * 360;
      return angle;
    });
  }, [dataset, total]);

  return (
    <div className="relative w-full h-[200px]">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%"
        height="100%"
        onMouseLeave={() => { setTooltip(null); setHoveredIndex(null); }}
      >
        {/* Grid rings */}
        {GRID_RINGS.map((r) => (
          <circle
            key={r}
            cx={CX} cy={CY} r={r}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={0.8}
          />
        ))}

        {/* Spokes */}
        {spokeAngles.map((angle, i) => (
          <line
            key={i}
            x1={CX + INNER_RADIUS * Math.cos(toRad(angle))}
            y1={CY + INNER_RADIUS * Math.sin(toRad(angle))}
            x2={CX + POLAR_MAX_RADIUS * Math.cos(toRad(angle))}
            y2={CY + POLAR_MAX_RADIUS * Math.sin(toRad(angle))}
            stroke="#e5e7eb"
            strokeWidth={0.8}
          />
        ))}

        {/* Visible slices */}
        {slices.map((s, i) => (
          <path
            key={i}
            d={s.visPath}
            fill={s.fill}
            stroke="#fff"
            strokeWidth={1.5}
            style={{
              pointerEvents: 'none',
              opacity: hoveredIndex === null ? 1 : hoveredIndex === i ? 1 : 0.35,
              transition: 'opacity 0.2s ease',
            }}
          />
        ))}

        {/* Invisible hit areas for hover/tooltip */}
        {slices.map((s, i) => (
          <path
            key={`hit-${i}`}
            d={s.hitPath}
            fill="transparent"
            stroke="none"
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => {
              const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
              const svgX = ((e.clientX - rect.left) / rect.width) * SIZE;
              const svgY = ((e.clientY - rect.top) / rect.height) * SIZE;
              setHoveredIndex(i);
              setTooltip({ x: svgX, y: svgY, slice: s });
            }}
            onMouseMove={(e) => {
              const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
              const svgX = ((e.clientX - rect.left) / rect.width) * SIZE;
              const svgY = ((e.clientY - rect.top) / rect.height) * SIZE;
              setTooltip(prev => prev ? { ...prev, x: svgX, y: svgY } : null);
            }}
            onMouseLeave={() => {
              setHoveredIndex(null);
              setTooltip(null);
            }}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 bg-white border border-gray-200 p-2 rounded shadow text-xs pointer-events-none"
          style={{
            left: `${(tooltip.x / SIZE) * 100}%`,
            top: `${(tooltip.y / SIZE) * 100}%`,
            transform: 'translate(8px, -50%)',
          }}
        >
          <p className="font-bold text-slate-800">{tooltip.slice.name}</p>
          <p className="text-gray-600">
            Valor (por 90): <span className="font-bold text-slate-800">{tooltip.slice.rawVal.toFixed(2)}</span>
          </p>
          <p className="text-gray-600">
            Puntaje: <span className="font-bold text-emerald-600">{Math.round(tooltip.slice.score)} / 100</span>
          </p>
        </div>
      )}
    </div>
  );
};

const extractMetric = (obj: any, baseKey: string) => {
  if (!obj) return 0;
  const fallbacks: Record<string, string[]> = {
    'tackles': ['tackles', 'total_tackles', 'totalTackles'],
    'interceptions': ['interceptions', 'total_interceptions', 'totalInterceptions'],
    'clearances': ['clearances', 'total_clearances', 'totalClearances'],
    'aerial_duels_won': ['aerial_duels_won', 'duels_won_aerial', 'aerialDuelsWon'],
    'crosses': ['accurate_crosses', 'accurateCrosses', 'total_crosses', 'totalCrosses', 'crosses'],
    'key_passes': ['key_passes', 'total_key_passes', 'keyPasses'],
    'assists': ['assists', 'total_assists', 'totalAssists'],
    'accurate_passes_percentage': ['accurate_passes_percentage', 'pass_accuracy', 'accuratePassesPercentage', 'passAccuracy'],
    'successful_dribbles': ['successful_dribbles', 'dribbles_succeeded', 'successfulDribbles', 'dribbles'],
    'ground_duels_won': ['ground_duels_won', 'duels_won_ground', 'groundDuelsWon'],
    'total_shots': ['total_shots', 'shots_total', 'totalShots', 'shots'],
    'goals': ['goals', 'total_goals', 'totalGoals'],
    'shots_on_target': ['shots_on_target', 'shots_on_goal', 'shotsOnTarget']
  };
  const keys = fallbacks[baseKey] || [baseKey];
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return Number(obj[k]);
  }
  return 0;
};

const KeyStrengths: React.FC<KeyStrengthsProps> = ({ profile, seasonStats, mainPosition, themeColor }) => {
  const chartsData = useMemo(() => {
    if (!seasonStats || !seasonStats.minutes_played) return null;

    const p90 = (val: number) => (val / seasonStats.minutes_played) * 90;
    const normalize = (val: number, max: number) => Math.min(100, Math.max(0, (val / max) * 100));

    const s = seasonStats;
    const tackles = extractMetric(s, 'tackles');
    const interceptions = extractMetric(s, 'interceptions');
    const clearances = extractMetric(s, 'clearances');
    const aerials = extractMetric(s, 'aerial_duels_won');
    const crosses = extractMetric(s, 'crosses');
    const keyPasses = extractMetric(s, 'key_passes');
    const assists = extractMetric(s, 'assists');
    const passAcc = extractMetric(s, 'accurate_passes_percentage');
    const dribbles = extractMetric(s, 'successful_dribbles');
    const groundDuels = extractMetric(s, 'ground_duels_won');
    const totalShots = extractMetric(s, 'total_shots');
    const goals = extractMetric(s, 'goals');
    const shotsOnTarget = extractMetric(s, 'shots_on_target');

    const pos = (mainPosition || profile.position || profile.position_group || '').toUpperCase();

    let charts: ChartConfig[] = [];

    if (['RB', 'LB', 'RWB', 'LWB'].includes(pos)) {
      charts = [
        {
          title: "Labor Defensiva",
          dataset: [
            { name: 'Entradas', rawVal: p90(tackles), score: normalize(p90(tackles), 4), fill: '#3b82f6', angleVal: 1 },
            { name: 'Intercepciones', rawVal: p90(interceptions), score: normalize(p90(interceptions), 3), fill: '#2563eb', angleVal: 1 },
            { name: 'Despejes', rawVal: p90(clearances), score: normalize(p90(clearances), 6), fill: '#1d4ed8', angleVal: 1 },
            { name: 'Duelos Aéreos', rawVal: p90(aerials), score: normalize(p90(aerials), 4), fill: '#1e40af', angleVal: 1 },
          ]
        },
        {
          title: "Creación",
          dataset: [
            { name: 'Centros', rawVal: p90(crosses), score: normalize(p90(crosses), 4), fill: '#10b981', angleVal: 1 },
            { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 2), fill: '#059669', angleVal: 1 },
            { name: 'Asistencias', rawVal: p90(assists), score: normalize(p90(assists), 0.5), fill: '#047857', angleVal: 1 },
            { name: 'Precisión Pases %', rawVal: passAcc, score: normalize(passAcc, 100), fill: '#064e3b', angleVal: 1 },
          ]
        },
        {
          title: "Despliegue Físico",
          dataset: [
            { name: 'Regates', rawVal: p90(dribbles), score: normalize(p90(dribbles), 3), fill: '#f59e0b', angleVal: 1 },
            { name: 'Duelos Suelo', rawVal: p90(groundDuels), score: normalize(p90(groundDuels), 5), fill: '#d97706', angleVal: 1 },
            { name: 'Tiros Totales', rawVal: p90(totalShots), score: normalize(p90(totalShots), 2), fill: '#b45309', angleVal: 1 },
            { name: 'Goles', rawVal: p90(goals), score: normalize(p90(goals), 0.3), fill: '#78350f', angleVal: 1 },
          ]
        }
      ];
    } else if (pos === 'CDM') {
      charts = [
        {
          title: "Recuperación",
          dataset: [
            { name: 'Entradas', rawVal: p90(tackles), score: normalize(p90(tackles), 4), fill: '#3b82f6', angleVal: 1 },
            { name: 'Intercepciones', rawVal: p90(interceptions), score: normalize(p90(interceptions), 3), fill: '#2563eb', angleVal: 1 },
            { name: 'Despejes', rawVal: p90(clearances), score: normalize(p90(clearances), 4), fill: '#1d4ed8', angleVal: 1 },
            { name: 'Duelos Aéreos', rawVal: p90(aerials), score: normalize(p90(aerials), 4), fill: '#1e40af', angleVal: 1 },
          ]
        },
        {
          title: "Distribución",
          dataset: [
            { name: 'Precisión Pases %', rawVal: passAcc, score: normalize(passAcc, 100), fill: '#10b981', angleVal: 1 },
            { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 2), fill: '#059669', angleVal: 1 },
            { name: 'Asistencias', rawVal: p90(assists), score: normalize(p90(assists), 0.5), fill: '#047857', angleVal: 1 },
            { name: 'Regates', rawVal: p90(dribbles), score: normalize(p90(dribbles), 2), fill: '#064e3b', angleVal: 1 },
          ]
        },
        {
          title: "Impacto",
          dataset: [
            { name: 'Duelos Suelo', rawVal: p90(groundDuels), score: normalize(p90(groundDuels), 5), fill: '#8b5cf6', angleVal: 1 },
            { name: 'Tiros Totales', rawVal: p90(totalShots), score: normalize(p90(totalShots), 2), fill: '#7c3aed', angleVal: 1 },
            { name: 'Tiros a puerta', rawVal: p90(shotsOnTarget), score: normalize(p90(shotsOnTarget), 1), fill: '#6d28d9', angleVal: 1 },
            { name: 'Goles', rawVal: p90(goals), score: normalize(p90(goals), 0.5), fill: '#4c1d95', angleVal: 1 },
          ]
        }
      ];
    } else if (pos === 'CB') {
      charts = [
        {
          title: "Defensa de Área",
          dataset: [
            { name: 'Despejes', rawVal: p90(clearances), score: normalize(p90(clearances), 8), fill: '#3b82f6', angleVal: 1 },
            { name: 'Duelos Aéreos', rawVal: p90(aerials), score: normalize(p90(aerials), 6), fill: '#2563eb', angleVal: 1 },
            { name: 'Entradas', rawVal: p90(tackles), score: normalize(p90(tackles), 3), fill: '#1d4ed8', angleVal: 1 },
            { name: 'Intercepciones', rawVal: p90(interceptions), score: normalize(p90(interceptions), 3), fill: '#1e40af', angleVal: 1 },
          ]
        },
        {
          title: "Duelos",
          dataset: [
            { name: 'Duelos Suelo', rawVal: p90(groundDuels), score: normalize(p90(groundDuels), 6), fill: '#8b5cf6', angleVal: 1 },
            { name: 'Duelos Aéreos', rawVal: p90(aerials), score: normalize(p90(aerials), 6), fill: '#7c3aed', angleVal: 1 },
            { name: 'Entradas', rawVal: p90(tackles), score: normalize(p90(tackles), 3), fill: '#6d28d9', angleVal: 1 },
          ]
        },
        {
          title: "Distribución",
          dataset: [
            { name: 'Precisión Pases %', rawVal: passAcc, score: normalize(passAcc, 100), fill: '#10b981', angleVal: 1 },
            { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 1.5), fill: '#059669', angleVal: 1 },
          ]
        }
      ];
    } else if (pos === 'GK') {
      charts = [
        {
          title: "Distribución",
          dataset: [
            { name: 'Precisión Pases %', rawVal: passAcc, score: normalize(passAcc, 100), fill: '#10b981', angleVal: 1 },
            { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 1), fill: '#059669', angleVal: 1 },
          ]
        }
      ];
    } else {
      // Midfielders, wingers, attackers — generic fallback
      const isFwd = pos === 'ST' || pos === 'CF' || pos === 'LW' || pos === 'RW';
      if (isFwd) {
        charts = [
          {
            title: "Finalización",
            dataset: [
              { name: 'Goles', rawVal: p90(goals), score: normalize(p90(goals), 1.0), fill: '#ef4444', angleVal: 1 },
              { name: 'Tiros a puerta', rawVal: p90(shotsOnTarget), score: normalize(p90(shotsOnTarget), 3), fill: '#dc2626', angleVal: 1 },
              { name: 'Tiros Totales', rawVal: p90(totalShots), score: normalize(p90(totalShots), 5), fill: '#b91c1c', angleVal: 1 },
              { name: 'Asistencias', rawVal: p90(assists), score: normalize(p90(assists), 0.5), fill: '#991b1b', angleVal: 1 },
            ]
          },
          {
            title: "Presencia en Área",
            dataset: [
              { name: 'Duelos Aéreos', rawVal: p90(aerials), score: normalize(p90(aerials), 5), fill: '#f59e0b', angleVal: 1 },
              { name: 'Duelos Suelo', rawVal: p90(groundDuels), score: normalize(p90(groundDuels), 5), fill: '#d97706', angleVal: 1 },
              { name: 'Regates', rawVal: p90(dribbles), score: normalize(p90(dribbles), 3), fill: '#b45309', angleVal: 1 },
              { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 2), fill: '#78350f', angleVal: 1 },
            ]
          }
        ];
      } else {
        charts = [
          {
            title: "Creación",
            dataset: [
              { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 3), fill: '#10b981', angleVal: 1 },
              { name: 'Asistencias', rawVal: p90(assists), score: normalize(p90(assists), 0.6), fill: '#047857', angleVal: 1 },
              { name: 'Regates', rawVal: p90(dribbles), score: normalize(p90(dribbles), 3), fill: '#064e3b', angleVal: 1 },
              { name: 'Tiros Totales', rawVal: p90(totalShots), score: normalize(p90(totalShots), 3), fill: '#065f46', angleVal: 1 },
            ]
          },
          {
            title: "Recuperación",
            dataset: [
              { name: 'Entradas', rawVal: p90(tackles), score: normalize(p90(tackles), 3), fill: '#3b82f6', angleVal: 1 },
              { name: 'Intercepciones', rawVal: p90(interceptions), score: normalize(p90(interceptions), 2), fill: '#1d4ed8', angleVal: 1 },
              { name: 'Duelos Suelo', rawVal: p90(groundDuels), score: normalize(p90(groundDuels), 5), fill: '#1e40af', angleVal: 1 },
            ]
          }
        ];
      }
    }

    // Apply themeColor to all slices
    charts.forEach(chart => {
      chart.dataset = chart.dataset.map(d => ({
        ...d,
        fill: themeColor || '#0ea5e9'
      }));
    });

    return charts;
  }, [profile, seasonStats, mainPosition, themeColor]);

  return (
    <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm h-full">
      <h3 className="text-xl font-bold text-slate-800 mb-1 uppercase">FORTALEZAS CLAVE</h3>
      <p className="text-xs text-gray-500 mb-6">Métricas tácticas normalizadas (por 90)</p>

      {!chartsData ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-500">No hay datos disponibles</div>
      ) : (
        <div className="flex flex-col xl:flex-row h-auto xl:h-[280px] gap-6">
          {chartsData.map((chart, chartIndex) => (
            <React.Fragment key={chart.title}>
              {chartIndex > 0 && (
                <div className="hidden xl:block w-px bg-gray-100 my-4" />
              )}
              <div className="flex-1 flex flex-col items-center">
                <h4 className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">{chart.title}</h4>
                <PolarChart dataset={chart.dataset} fill={themeColor || '#0ea5e9'} />
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                  {chart.dataset.map(d => (
                    <div key={d.name} className="flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                      {d.name}
                    </div>
                  ))}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default KeyStrengths;