import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Sector, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PlayerProfile } from '../services/api';

interface KeyStrengthsProps {
  profile: PlayerProfile;
  seasonStats: any;
  mainPosition?: string | null;
}

const renderPolarSlice = (props: any, hoveredIndex: number | null) => {
  const { cx, cy, startAngle, endAngle, fill, outerRadius, payload, index } = props;
  const dataItem = payload?.payload || payload || props;
  const score = dataItem?.score || 0;
  const maxRadius = outerRadius || 80;
  const dynamicRadius = Math.max(maxRadius * 0.15, (score / 100) * maxRadius); 
  const isHovered = index === hoveredIndex;

  return (
    <g>
      {/* Base slice */}
      <Sector 
        cx={cx} cy={cy} innerRadius={10} 
        outerRadius={isHovered ? dynamicRadius + 5 : dynamicRadius} 
        startAngle={startAngle} endAngle={endAngle} 
        fill={fill} stroke="#fff" strokeWidth={2} 
      />
      {/* Ghost shadow only if hovered */}
      {isHovered && (
        <Sector 
          cx={cx} cy={cy} innerRadius={10} 
          outerRadius={dynamicRadius + 15} 
          startAngle={startAngle} endAngle={endAngle} 
          fill={fill} opacity={0.3} 
        />
      )}
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 p-2 rounded shadow text-xs z-50">
        <p className="font-bold text-slate-800">{data.name}</p>
        <p className="text-gray-600">Valor (por 90): <span className="font-bold text-slate-800">{data.rawVal.toFixed(2)}</span></p>
        <p className="text-gray-600">Puntaje: <span className="font-bold text-emerald-600">{Math.round(data.score)} / 100</span></p>
      </div>
    );
  }
  return null;
};

interface ChartConfig {
  title: string;
  dataset: { name: string, rawVal: number, score: number, fill: string, angleVal: number }[];
}

const extractMetric = (obj: any, baseKey: string) => {
  if (!obj) return 0;
  const fallbacks: Record<string, string[]> = {
    'tackles': ['tackles', 'total_tackles', 'totalTackles'],
    'interceptions': ['interceptions', 'total_interceptions', 'totalInterceptions'],
    'clearances': ['clearances', 'total_clearances', 'totalClearances'],
    'aerial_duels_won': ['aerial_duels_won', 'duels_won_aerial', 'aerialDuelsWon'],
    'crosses': ['crosses', 'total_crosses', 'totalCrosses', 'accurate_crosses'],
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

const KeyStrengths: React.FC<KeyStrengthsProps> = ({ profile, seasonStats, mainPosition }) => {
  const [hoverIndex0, setHoverIndex0] = useState<number | null>(null);
  const [hoverIndex1, setHoverIndex1] = useState<number | null>(null);
  const [hoverIndex2, setHoverIndex2] = useState<number | null>(null);
  const hoverStates = [hoverIndex0, hoverIndex1, hoverIndex2];
  const setHoverStates = [setHoverIndex0, setHoverIndex1, setHoverIndex2];

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
            { name: 'Entradas', rawVal: p90(tackles), score: normalize(p90(tackles), 3), fill: '#3b82f6', angleVal: 1 },
            { name: 'Intercepciones', rawVal: p90(interceptions), score: normalize(p90(interceptions), 3), fill: '#2563eb', angleVal: 1 },
            { name: 'Despejes', rawVal: p90(clearances), score: normalize(p90(clearances), 8), fill: '#1d4ed8', angleVal: 1 },
            { name: 'Duelos Aéreos', rawVal: p90(aerials), score: normalize(p90(aerials), 5), fill: '#1e40af', angleVal: 1 },
          ]
        },
        {
          title: "Salida de Balón",
          dataset: [
            { name: 'Precisión Pases %', rawVal: passAcc, score: normalize(passAcc, 100), fill: '#10b981', angleVal: 1 },
            { name: 'Regates', rawVal: p90(dribbles), score: normalize(p90(dribbles), 1.5), fill: '#059669', angleVal: 1 },
            { name: 'Duelos Suelo', rawVal: p90(groundDuels), score: normalize(p90(groundDuels), 4), fill: '#047857', angleVal: 1 },
            { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 1), fill: '#064e3b', angleVal: 1 },
          ]
        }
      ];
    } else if (['CAM', 'RM', 'LM', 'RW', 'LW'].includes(pos)) {
      charts = [
        {
          title: "Creación y Desequilibrio",
          dataset: [
            { name: 'Centros', rawVal: p90(crosses), score: normalize(p90(crosses), 4), fill: '#10b981', angleVal: 1 },
            { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 3), fill: '#059669', angleVal: 1 },
            { name: 'Asistencias', rawVal: p90(assists), score: normalize(p90(assists), 0.8), fill: '#047857', angleVal: 1 },
            { name: 'Precisión Pases %', rawVal: passAcc, score: normalize(passAcc, 100), fill: '#064e3b', angleVal: 1 },
            { name: 'Regates', rawVal: p90(dribbles), score: normalize(p90(dribbles), 4), fill: '#065f46', angleVal: 1 },
          ]
        },
        {
          title: "Amenaza Ofensiva",
          dataset: [
            { name: 'Goles', rawVal: p90(goals), score: normalize(p90(goals), 0.8), fill: '#ef4444', angleVal: 1 },
            { name: 'Tiros a puerta', rawVal: p90(shotsOnTarget), score: normalize(p90(shotsOnTarget), 2.5), fill: '#dc2626', angleVal: 1 },
            { name: 'Tiros Totales', rawVal: p90(totalShots), score: normalize(p90(totalShots), 4), fill: '#b91c1c', angleVal: 1 },
            { name: 'Duelos Suelo', rawVal: p90(groundDuels), score: normalize(p90(groundDuels), 5), fill: '#991b1b', angleVal: 1 },
            { name: 'Duelos Aéreos', rawVal: p90(aerials), score: normalize(p90(aerials), 3), fill: '#7f1d1d', angleVal: 1 },
          ]
        }
      ];
    } else if (pos === 'CM') {
      charts = [
        {
          title: "Motor y Recuperación",
          dataset: [
            { name: 'Entradas', rawVal: p90(tackles), score: normalize(p90(tackles), 4), fill: '#3b82f6', angleVal: 1 },
            { name: 'Intercepciones', rawVal: p90(interceptions), score: normalize(p90(interceptions), 3), fill: '#2563eb', angleVal: 1 },
            { name: 'Duelos Suelo', rawVal: p90(groundDuels), score: normalize(p90(groundDuels), 6), fill: '#1d4ed8', angleVal: 1 },
            { name: 'Duelos Aéreos', rawVal: p90(aerials), score: normalize(p90(aerials), 3), fill: '#1e40af', angleVal: 1 },
          ]
        },
        {
          title: "Distribución y Llegada",
          dataset: [
            { name: 'Precisión Pases %', rawVal: passAcc, score: normalize(passAcc, 100), fill: '#10b981', angleVal: 1 },
            { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 3), fill: '#059669', angleVal: 1 },
            { name: 'Asistencias', rawVal: p90(assists), score: normalize(p90(assists), 0.6), fill: '#047857', angleVal: 1 },
            { name: 'Regates', rawVal: p90(dribbles), score: normalize(p90(dribbles), 3), fill: '#064e3b', angleVal: 1 },
            { name: 'Tiros Totales', rawVal: p90(totalShots), score: normalize(p90(totalShots), 3), fill: '#065f46', angleVal: 1 },
          ]
        }
      ];
    } else if (['ST', 'CF'].includes(pos)) {
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
      // Fallback based on more generic checks if standard positions missed
      if (pos === 'M' || pos.includes('MID')) {
        charts = [
          {
            title: "Motor y Recuperación",
            dataset: [
              { name: 'Entradas', rawVal: p90(tackles), score: normalize(p90(tackles), 4), fill: '#3b82f6', angleVal: 1 },
              { name: 'Intercepciones', rawVal: p90(interceptions), score: normalize(p90(interceptions), 3), fill: '#2563eb', angleVal: 1 },
              { name: 'Duelos Suelo', rawVal: p90(groundDuels), score: normalize(p90(groundDuels), 6), fill: '#1d4ed8', angleVal: 1 },
              { name: 'Duelos Aéreos', rawVal: p90(aerials), score: normalize(p90(aerials), 3), fill: '#1e40af', angleVal: 1 },
            ]
          },
          {
            title: "Distribución y Llegada",
            dataset: [
              { name: 'Precisión Pases %', rawVal: passAcc, score: normalize(passAcc, 100), fill: '#10b981', angleVal: 1 },
              { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 3), fill: '#059669', angleVal: 1 },
              { name: 'Asistencias', rawVal: p90(assists), score: normalize(p90(assists), 0.6), fill: '#047857', angleVal: 1 },
              { name: 'Regates', rawVal: p90(dribbles), score: normalize(p90(dribbles), 3), fill: '#064e3b', angleVal: 1 },
              { name: 'Tiros Totales', rawVal: p90(totalShots), score: normalize(p90(totalShots), 3), fill: '#065f46', angleVal: 1 },
            ]
          }
        ];
      } else if (pos === 'F' || pos === 'A' || pos.includes('ATT') || pos.includes('FOR')) {
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
        // Ultimate Fallback (mostly for D or GK or entirely unknown)
        charts = [
          {
            title: "Labor Defensiva",
            dataset: [
              { name: 'Entradas', rawVal: p90(tackles), score: normalize(p90(tackles), 3), fill: '#3b82f6', angleVal: 1 },
              { name: 'Despejes', rawVal: p90(clearances), score: normalize(p90(clearances), 4), fill: '#1d4ed8', angleVal: 1 },
              { name: 'Duelos Aéreos', rawVal: p90(aerials), score: normalize(p90(aerials), 4), fill: '#1e40af', angleVal: 1 },
            ]
          },
          {
            title: "Creación",
            dataset: [
              { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 2), fill: '#10b981', angleVal: 1 },
              { name: 'Regates', rawVal: p90(dribbles), score: normalize(p90(dribbles), 3), fill: '#059669', angleVal: 1 },
              { name: 'Tiros Totales', rawVal: p90(totalShots), score: normalize(p90(totalShots), 3), fill: '#ef4444', angleVal: 1 },
            ]
          }
        ];
      }
    }

    return charts;
  }, [profile, seasonStats]);

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
              {/* Divider (except for first item) */}
              {chartIndex > 0 && (
                <div className="hidden xl:block w-px bg-gray-100 my-4"></div>
              )}
              
              {/* Chart */}
              <div className="flex-1 flex flex-col items-center">
                <h4 className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">{chart.title}</h4>
                <div className="w-full h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip content={<CustomTooltip />} />
                      <Pie
                        data={chart.dataset}
                        dataKey="angleVal"
                        cx="50%"
                        cy="50%"
                        outerRadius={80} 
                        activeIndex={chart.dataset.map((_, i) => i)}
                        activeShape={(props: any) => renderPolarSlice(props, hoverStates[chartIndex])}
                        isAnimationActive={false}
                        onMouseEnter={(_, index) => setHoverStates[chartIndex](index)}
                        onMouseLeave={() => setHoverStates[chartIndex](null)}
                      >
                        {chart.dataset.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                  {chart.dataset.map(d => (
                    <div key={d.name} className="flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }}></span>
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