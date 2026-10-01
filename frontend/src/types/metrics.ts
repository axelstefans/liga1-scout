import { TeamMetricEntry } from '../services/api';

export type Team34MetricKey =
  // A. Ofensivas / Tiro (10)
  | 'total_shots'
  | 'shots_on_target'
  | 'shots_inside_box'
  | 'shots_outside_box'
  | 'goals_scored'
  | 'xg'
  | 'npxg'
  | 'xg_per_shot'
  | 'goals_minus_xg'
  | 'conversion_rate_pct'
  // B. Circulación y Progresión (9)
  | 'possession_pct'
  | 'passes_completed'
  | 'pass_accuracy_pct'
  | 'progressive_passes'
  | 'passes_into_final_third'
  | 'passes_into_box'
  | 'crosses_completed'
  | 'progressive_carries'
  | 'successful_dribbles'
  // C. Dominio y Estilo (3)
  | 'field_tilt'
  | 'verticality_ratio_pct'
  | 'avg_shot_distance'
  // D. Presión y Defensa (6)
  | 'ppda'
  | 'high_recoveries'
  | 'defensive_actions'
  | 'tackles'
  | 'interceptions'
  | 'clearances'
  // E. Concesión / Rival (6)
  | 'shots_conceded'
  | 'shots_on_target_conceded'
  | 'shots_conceded_inside_box'
  | 'xga'
  | 'xgd'
  | 'defensive_resistance_ratio';

export type MetricCategoryName =
  | 'Ofensivas / Tiro'
  | 'Circulación y Progresión'
  | 'Dominio y Estilo'
  | 'Presión y Defensa'
  | 'Concesión / Rival';

export interface MetricDefinition {
  key: Team34MetricKey;
  label: string;
  shortLabel: string;
  category: MetricCategoryName;
  unit?: string;
  description: string;
  format: (value: number | null | undefined) => string;
  isPositiveBetter?: boolean; // Useful for styling / color shading in scatter quadrants
}

export const METRIC_CATALOG: Record<Team34MetricKey, MetricDefinition> = {
  // A. Ofensivas / Tiro
  total_shots: {
    key: 'total_shots',
    label: 'Tiros Totales',
    shortLabel: 'Tiros',
    category: 'Ofensivas / Tiro',
    description: 'Volumen total de disparos efectuados.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  shots_on_target: {
    key: 'shots_on_target',
    label: 'Tiros a Puerta',
    shortLabel: 'Tiros a Puerta',
    category: 'Ofensivas / Tiro',
    description: 'Disparos dirigidos entre los tres palos.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  shots_inside_box: {
    key: 'shots_inside_box',
    label: 'Tiros Dentro del Área',
    shortLabel: 'Tiros en Área',
    category: 'Ofensivas / Tiro',
    description: 'Disparos ejecutados a una distancia <= 16.5 metros.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  shots_outside_box: {
    key: 'shots_outside_box',
    label: 'Tiros Fuera del Área',
    shortLabel: 'Tiros Fuera Área',
    category: 'Ofensivas / Tiro',
    description: 'Disparos ejecutados a una distancia > 16.5 metros.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  goals_scored: {
    key: 'goals_scored',
    label: 'Goles a Favor',
    shortLabel: 'Goles',
    category: 'Ofensivas / Tiro',
    description: 'Goles totales anotados.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  xg: {
    key: 'xg',
    label: 'Goles Esperados (xG)',
    shortLabel: 'xG',
    category: 'Ofensivas / Tiro',
    description: 'Peligro ofensivo acumulado según probabilidad de gol.',
    format: (v) => (v != null ? v.toFixed(2) : '--'),
    isPositiveBetter: true,
  },
  npxg: {
    key: 'npxg',
    label: 'xG sin Penales (npxG)',
    shortLabel: 'npxG',
    category: 'Ofensivas / Tiro',
    description: 'Goles esperados en jugadas dinámicas y balón parado (excluye penales).',
    format: (v) => (v != null ? v.toFixed(2) : '--'),
    isPositiveBetter: true,
  },
  xg_per_shot: {
    key: 'xg_per_shot',
    label: 'xG por Disparo',
    shortLabel: 'xG / Tiro',
    category: 'Ofensivas / Tiro',
    description: 'Calidad promedio de las situaciones de finalización.',
    format: (v) => (v != null ? v.toFixed(2) : '--'),
    isPositiveBetter: true,
  },
  goals_minus_xg: {
    key: 'goals_minus_xg',
    label: 'Diferencial Goles - xG',
    shortLabel: 'Goles - xG',
    category: 'Ofensivas / Tiro',
    description: 'Eficacia rematadora real frente a la expectativa de gol.',
    format: (v) => (v != null ? (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)) : '--'),
    isPositiveBetter: true,
  },
  conversion_rate_pct: {
    key: 'conversion_rate_pct',
    label: 'Tasa de Conversión (%)',
    shortLabel: 'Conversión %',
    category: 'Ofensivas / Tiro',
    unit: '%',
    description: 'Porcentaje de disparos totales convertidos en gol.',
    format: (v) => (v != null ? `${v.toFixed(1)}%` : '--'),
    isPositiveBetter: true,
  },

  // B. Circulación y Progresión
  possession_pct: {
    key: 'possession_pct',
    label: 'Posesión Estimada (%)',
    shortLabel: 'Posesión %',
    category: 'Circulación y Progresión',
    unit: '%',
    description: 'Cuota de pases completados respecto al total del partido.',
    format: (v) => (v != null ? `${v.toFixed(1)}%` : '--'),
    isPositiveBetter: true,
  },
  passes_completed: {
    key: 'passes_completed',
    label: 'Pases Exitosos',
    shortLabel: 'Pases Compl.',
    category: 'Circulación y Progresión',
    description: 'Total de pases completados entre compañeros.',
    format: (v) => (v != null ? v.toLocaleString('es-PE') : '--'),
    isPositiveBetter: true,
  },
  pass_accuracy_pct: {
    key: 'pass_accuracy_pct',
    label: 'Precisión de Pase (%)',
    shortLabel: 'Precisión Pase %',
    category: 'Circulación y Progresión',
    unit: '%',
    description: 'Porcentaje de pases completados sobre el total intentado.',
    format: (v) => (v != null ? `${v.toFixed(1)}%` : '--'),
    isPositiveBetter: true,
  },
  progressive_passes: {
    key: 'progressive_passes',
    label: 'Pases Progresivos (≥25%)',
    shortLabel: 'Pases Prog.',
    category: 'Circulación y Progresión',
    description: 'Pases completados que reducen la distancia a la portería rival en >= 25%.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  passes_into_final_third: {
    key: 'passes_into_final_third',
    label: 'Pases al Último Tercio',
    shortLabel: 'Pases a 3/3',
    category: 'Circulación y Progresión',
    description: 'Pases completados que terminan en el último tercio del campo (x >= 66.7).',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  passes_into_box: {
    key: 'passes_into_box',
    label: 'Pases al Área Penal',
    shortLabel: 'Pases al Área',
    category: 'Circulación y Progresión',
    description: 'Pases completados dentro de la caja de 18 yardas rival.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  crosses_completed: {
    key: 'crosses_completed',
    label: 'Centros Completados',
    shortLabel: 'Centros Compl.',
    category: 'Circulación y Progresión',
    description: 'Centros laterales completados con éxito hacia el área rival.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  progressive_carries: {
    key: 'progressive_carries',
    label: 'Conducciones Progresivas (≥10m)',
    shortLabel: 'Conduc. Prog.',
    category: 'Circulación y Progresión',
    description: 'Conducciones de balón que avanzan al menos 10m hacia la meta rival.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  successful_dribbles: {
    key: 'successful_dribbles',
    label: 'Regates Exitosos',
    shortLabel: 'Regates',
    category: 'Circulación y Progresión',
    description: 'Acciones de 1v1 superadas con éxito.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },

  // C. Dominio y Estilo
  field_tilt: {
    key: 'field_tilt',
    label: 'Field Tilt (% Posesión 3er Tercio)',
    shortLabel: 'Field Tilt',
    category: 'Dominio y Estilo',
    unit: '%',
    description: 'Proporción de pases completados en campo rival sobre el total del partido.',
    format: (v) => (v != null ? `${v.toFixed(1)}%` : '--'),
    isPositiveBetter: true,
  },
  verticality_ratio_pct: {
    key: 'verticality_ratio_pct',
    label: 'Ratio de Verticalidad (%)',
    shortLabel: 'Verticalidad %',
    category: 'Dominio y Estilo',
    unit: '%',
    description: 'Porcentaje de pases orientados hacia adelante respecto al total.',
    format: (v) => (v != null ? `${v.toFixed(1)}%` : '--'),
    isPositiveBetter: true,
  },
  avg_shot_distance: {
    key: 'avg_shot_distance',
    label: 'Distancia Media de Tiro (m)',
    shortLabel: 'Dist. Tiro (m)',
    category: 'Dominio y Estilo',
    unit: 'm',
    description: 'Distancia promedio en metros desde donde se ejecuta el remate.',
    format: (v) => (v != null ? `${v.toFixed(1)} m` : '--'),
    isPositiveBetter: false, // closer to goal is typically better
  },

  // D. Presión y Defensa
  ppda: {
    key: 'ppda',
    label: 'PPDA (Intensidad de Presión)',
    shortLabel: 'PPDA',
    category: 'Presión y Defensa',
    description: 'Pases rivales concedidos por cada acción defensiva. Menor valor indica mayor presión.',
    format: (v) => (v != null ? v.toFixed(2) : '--'),
    isPositiveBetter: false, // Lower PPDA = higher pressing intensity
  },
  high_recoveries: {
    key: 'high_recoveries',
    label: 'Recuperaciones Altas (x ≥ 60m)',
    shortLabel: 'Recup. Altas',
    category: 'Presión y Defensa',
    description: 'Recuperaciones de posesión en los últimos 40% del campo rival.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  defensive_actions: {
    key: 'defensive_actions',
    label: 'Acciones Defensivas Totales',
    shortLabel: 'Acciones Def.',
    category: 'Presión y Defensa',
    description: 'Suma de entradas, intercepciones y despejes.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  tackles: {
    key: 'tackles',
    label: 'Entradas (Tackles)',
    shortLabel: 'Entradas',
    category: 'Presión y Defensa',
    description: 'Entradas efectivas para arrebatar la posesión.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  interceptions: {
    key: 'interceptions',
    label: 'Intercepciones',
    shortLabel: 'Intercepc.',
    category: 'Presión y Defensa',
    description: 'Cortes intencionales de líneas de pase rivales.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },
  clearances: {
    key: 'clearances',
    label: 'Despejes',
    shortLabel: 'Despejes',
    category: 'Presión y Defensa',
    description: 'Balones alejados de la zona defensiva bajo presión.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: true,
  },

  // E. Concesión / Rival
  shots_conceded: {
    key: 'shots_conceded',
    label: 'Tiros Concedidos',
    shortLabel: 'Tiros Recibidos',
    category: 'Concesión / Rival',
    description: 'Disparos totales permitidos al oponente.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: false,
  },
  shots_on_target_conceded: {
    key: 'shots_on_target_conceded',
    label: 'Tiros a Puerta Concedidos',
    shortLabel: 'Tiros a Puerta Recib.',
    category: 'Concesión / Rival',
    description: 'Disparos a puerta recibidos por el guardameta.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: false,
  },
  shots_conceded_inside_box: {
    key: 'shots_conceded_inside_box',
    label: 'Tiros Concedidos en Área',
    shortLabel: 'Tiros Área Recib.',
    category: 'Concesión / Rival',
    description: 'Disparos permitidos dentro de las 18 yardas propias.',
    format: (v) => (v != null ? Math.round(v).toString() : '--'),
    isPositiveBetter: false,
  },
  xga: {
    key: 'xga',
    label: 'Goles Esperados en Contra (xGA)',
    shortLabel: 'xGA',
    category: 'Concesión / Rival',
    description: 'Peligro concedido al rival según la probabilidad de sus tiros.',
    format: (v) => (v != null ? v.toFixed(2) : '--'),
    isPositiveBetter: false,
  },
  xgd: {
    key: 'xgd',
    label: 'Diferencial de xG (xGD = xG - xGA)',
    shortLabel: 'xGD',
    category: 'Concesión / Rival',
    description: 'Balance neto de generación esperada frente a peligro concedido.',
    format: (v) => (v != null ? (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)) : '--'),
    isPositiveBetter: true,
  },
  defensive_resistance_ratio: {
    key: 'defensive_resistance_ratio',
    label: 'Resistencia Defensiva (Tiros / Gol)',
    shortLabel: 'Resist. Defensiva',
    category: 'Concesión / Rival',
    description: 'Disparos rivales que el equipo soporta antes de encajar un gol.',
    format: (v) => (v != null ? v.toFixed(1) : '--'),
    isPositiveBetter: true,
  },
};

export const METRIC_CATEGORIES_ORDER: {
  category: MetricCategoryName;
  keys: Team34MetricKey[];
}[] = [
  {
    category: 'Ofensivas / Tiro',
    keys: [
      'total_shots',
      'shots_on_target',
      'shots_inside_box',
      'shots_outside_box',
      'goals_scored',
      'xg',
      'npxg',
      'xg_per_shot',
      'goals_minus_xg',
      'conversion_rate_pct',
    ],
  },
  {
    category: 'Circulación y Progresión',
    keys: [
      'possession_pct',
      'passes_completed',
      'pass_accuracy_pct',
      'progressive_passes',
      'passes_into_final_third',
      'passes_into_box',
      'crosses_completed',
      'progressive_carries',
      'successful_dribbles',
    ],
  },
  {
    category: 'Dominio y Estilo',
    keys: [
      'field_tilt',
      'verticality_ratio_pct',
      'avg_shot_distance',
    ],
  },
  {
    category: 'Presión y Defensa',
    keys: [
      'ppda',
      'high_recoveries',
      'defensive_actions',
      'tackles',
      'interceptions',
      'clearances',
    ],
  },
  {
    category: 'Concesión / Rival',
    keys: [
      'shots_conceded',
      'shots_on_target_conceded',
      'shots_conceded_inside_box',
      'xga',
      'xgd',
      'defensive_resistance_ratio',
    ],
  },
];

export interface CohortStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  referenceValue: number;
  count: number;
}

export function computeMetricCohortStats(
  teams: TeamMetricEntry[] | undefined,
  metricKey: Team34MetricKey,
  referenceMode: 'median' | 'mean'
): CohortStats | null {
  if (!teams || teams.length === 0) return null;

  const values: number[] = [];
  for (const t of teams) {
    const rawVal = t[metricKey];
    if (typeof rawVal === 'number' && !isNaN(rawVal)) {
      values.push(rawVal);
    }
  }

  if (values.length === 0) return null;

  const count = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / count;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median = count % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const referenceValue = referenceMode === 'median' ? median : mean;

  return {
    min,
    max,
    mean,
    median,
    referenceValue,
    count,
  };
}

export function formatAxisLabel(def: MetricDefinition): string {
  if (def.label.includes('(%)') || def.label.includes('(%') || def.label.includes('(m)')) {
    return def.label;
  }
  if (def.unit) {
    return `${def.label} (${def.unit})`;
  }
  return def.label;
}

export function formatCleanComparisonTitle(yDef: MetricDefinition, xDef: MetricDefinition): string {
  const cleanY = yDef.label.replace(/\s*\([^)]*posesión[^)]*\)/gi, '').replace(/\s*\([^)]*%\)/g, '').trim();
  const cleanX = xDef.label.replace(/\s*\([^)]*posesión[^)]*\)/gi, '').replace(/\s*\([^)]*%\)/g, '').trim();
  return `${cleanY} vs ${cleanX}`;
}

