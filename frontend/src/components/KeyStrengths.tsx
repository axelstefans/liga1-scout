import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Sector, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PlayerProfile } from '../services/api';

interface KeyStrengthsProps {
  profile: PlayerProfile;
  seasonStats: any;
}

// Consolidate the Shape Function
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

const KeyStrengths: React.FC<KeyStrengthsProps> = ({ profile, seasonStats }) => {
  const [hoverIndex1, setHoverIndex1] = useState<number | null>(null);
  const [hoverIndex2, setHoverIndex2] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (!seasonStats || !seasonStats.minutes_played) return null;
    
    const p90 = (val: number) => (val / seasonStats.minutes_played) * 90;
    const normalize = (val: number, max: number) => Math.min(100, Math.max(0, (val / max) * 100));

    const s = seasonStats;
    // 2. BUSCADOR AGRESIVO: Busca en camelCase y snake_case para que nunca devuelva 0 por error de sintaxis
    const getStat = (...keys: string[]) => {
      for (const k of keys) {
        if (s[k] !== undefined && s[k] !== null) return Number(s[k]);
      }
      return 0;
    };

    // Mapeo exhaustivo de variables
    const tackles = getStat('totalTackles', 'total_tackles', 'tackles');
    const interceptions = getStat('interceptions', 'total_interceptions', 'totalInterceptions');
    const clearances = getStat('totalClearances', 'total_clearances', 'clearances');
    const aerials = getStat('aerialDuelsWon', 'aerial_duels_won', 'duels_won_aerial');
    const passAcc = getStat('accuratePassesPercentage', 'accurate_passes_percentage', 'pass_accuracy');
    const keyPasses = getStat('keyPasses', 'key_passes', 'total_key_passes');
    const groundDuels = getStat('groundDuelsWon', 'ground_duels_won', 'duels_won_ground');
    const assists = getStat('assists', 'total_assists', 'totalAssists');
    const dribbles = getStat('successfulDribbles', 'successful_dribbles', 'dribbles_succeeded', 'dribbles');
    const goals = getStat('goals', 'total_goals', 'totalGoals');
    const shotsOnTarget = getStat('shotsOnTarget', 'shots_on_target', 'shots_on_goal');
    const totalShots = getStat('totalShots', 'shots_total', 'total_shots', 'shots');

    const pos = (profile.position_group || '').toUpperCase();
    
    let dataset1: any[] = [];
    let dataset2: any[] = [];
    let title1 = '';
    let title2 = '';

    // Lógica dinámica por posiciones totalmente en español
    if (pos.includes('DEFENDER') || pos === 'D') {
      title1 = "DEFENSA";
      dataset1 = [
        { name: 'Entradas', rawVal: p90(tackles), score: normalize(p90(tackles), 4), fill: '#3b82f6' },
        { name: 'Intercepciones', rawVal: p90(interceptions), score: normalize(p90(interceptions), 3), fill: '#2563eb' },
        { name: 'Despejes', rawVal: p90(clearances), score: normalize(p90(clearances), 6), fill: '#1d4ed8' },
        { name: 'Duelos Aéreos', rawVal: p90(aerials), score: normalize(p90(aerials), 4), fill: '#1e40af' },
      ];
      title2 = "CON EL BALÓN";
      dataset2 = [
        { name: 'Precisión Pases %', rawVal: passAcc, score: normalize(passAcc, 100), fill: '#10b981' },
        { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 1.5), fill: '#059669' },
        { name: 'Duelos Suelo', rawVal: p90(groundDuels), score: normalize(p90(groundDuels), 5), fill: '#047857' },
      ];
    } else if (pos.includes('MIDFIELDER') || pos === 'M') {
      title1 = "CREACIÓN";
      dataset1 = [
        { name: 'Precisión Pases %', rawVal: passAcc, score: normalize(passAcc, 100), fill: '#10b981' },
        { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 3), fill: '#059669' },
        { name: 'Asistencias', rawVal: p90(assists), score: normalize(p90(assists), 0.5), fill: '#047857' },
      ];
      title2 = "DESPLIEGUE FÍSICO";
      dataset2 = [
        { name: 'Entradas', rawVal: p90(tackles), score: normalize(p90(tackles), 4), fill: '#8b5cf6' },
        { name: 'Intercepciones', rawVal: p90(interceptions), score: normalize(p90(interceptions), 3), fill: '#7c3aed' },
        { name: 'Regates', rawVal: p90(dribbles), score: normalize(p90(dribbles), 3), fill: '#6d28d9' },
      ];
    } else {
      title1 = "AMENAZA DE GOL";
      dataset1 = [
        { name: 'Goles', rawVal: p90(goals), score: normalize(p90(goals), 0.8), fill: '#ef4444' },
        { name: 'Tiros a puerta', rawVal: p90(shotsOnTarget), score: normalize(p90(shotsOnTarget), 2.5), fill: '#dc2626' },
        { name: 'Tiros Totales', rawVal: p90(totalShots), score: normalize(p90(totalShots), 4), fill: '#b91c1c' },
      ];
      title2 = "IMPACTO";
      dataset2 = [
        { name: 'Pases Clave', rawVal: p90(keyPasses), score: normalize(p90(keyPasses), 2), fill: '#f59e0b' },
        { name: 'Regates', rawVal: p90(dribbles), score: normalize(p90(dribbles), 3), fill: '#d97706' },
        { name: 'Duelos Suelo', rawVal: p90(groundDuels), score: normalize(p90(groundDuels), 5), fill: '#b45309' },
      ];
    }

    dataset1 = dataset1.map(d => ({ ...d, angleVal: 1 }));
    dataset2 = dataset2.map(d => ({ ...d, angleVal: 1 }));

    return { title1, dataset1, title2, dataset2 };
  }, [profile, seasonStats]);

  return (
    <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm h-full">
      <h3 className="text-xl font-bold text-slate-800 mb-1 uppercase">FORTALEZAS CLAVE</h3>
      <p className="text-xs text-gray-500 mb-6">Métricas tácticas normalizadas (por 90)</p>
      
      {!chartData ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-500">No hay datos disponibles</div>
      ) : (
        <div className="flex flex-col xl:flex-row h-auto xl:h-[280px] gap-6">
          {/* Chart 1 */}
          <div className="flex-1 flex flex-col items-center">
            <h4 className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">{chartData.title1}</h4>
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  {/* 3. AQUI ESTÁ LA MAGIA: outerRadius={80} obliga a React a no adivinar el tamaño */}
                  <Pie
                    data={chartData.dataset1}
                    dataKey="angleVal"
                    cx="50%"
                    cy="50%"
                    outerRadius={80} 
                    activeIndex={chartData.dataset1.map((_, i) => i)}
                    activeShape={(props: any) => renderPolarSlice(props, hoverIndex1)}
                    isAnimationActive={false}
                    onMouseEnter={(_, index) => setHoverIndex1(index)}
                    onMouseLeave={() => setHoverIndex1(null)}
                  >
                    {chartData.dataset1.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
              {chartData.dataset1.map(d => (
                <div key={d.name} className="flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }}></span>
                  {d.name}
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden xl:block w-px bg-gray-100 my-4"></div>

          {/* Chart 2 */}
          <div className="flex-1 flex flex-col items-center">
            <h4 className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">{chartData.title2}</h4>
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  {/* Forzamos outerRadius aquí también */}
                  <Pie
                    data={chartData.dataset2}
                    dataKey="angleVal"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    activeIndex={chartData.dataset2.map((_, i) => i)}
                    activeShape={(props: any) => renderPolarSlice(props, hoverIndex2)}
                    isAnimationActive={false}
                    onMouseEnter={(_, index) => setHoverIndex2(index)}
                    onMouseLeave={() => setHoverIndex2(null)}
                  >
                    {chartData.dataset2.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
              {chartData.dataset2.map(d => (
                <div key={d.name} className="flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }}></span>
                  {d.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyStrengths;