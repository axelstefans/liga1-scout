import type { TeamMetricEntry } from '../../api';
import { formatGoalDiffSign, formatMarkdownTable } from '../reportFormatters';
import type {
  ClubReportData,
  RadarDimDef,
  TacticalRadarAxisReport,
} from '../reportTypes';

/** Four core Liga 1 tactical radar dimensions. */
export const TACTICAL_RADAR_DIMS: RadarDimDef[] = [
  {
    key: 'field_tilt',
    name: 'Posesión Campo Rival (Field Tilt)',
    shortName: 'Field Tilt',
    extractor: (t) => t.field_tilt ?? t.field_tilt_pct ?? 50.0,
    format: (v) => `${v.toFixed(1)}%`,
    higherIsBetter: true,
  },
  {
    key: 'verticality',
    name: 'Verticalidad',
    shortName: 'Verticalidad',
    extractor: (t) => t.verticality_ratio_pct ?? 0,
    format: (v) => `${v.toFixed(1)}%`,
    higherIsBetter: true,
  },
  {
    key: 'shot_quality',
    name: 'Calidad de Remate (xG/tiro)',
    shortName: 'xG / Tiro',
    extractor: (t) => t.xg_per_shot ?? (t.total_shots > 0 ? t.xg / t.total_shots : 0),
    format: (v) => `${v.toFixed(2)} xG`,
    higherIsBetter: true,
  },
  {
    key: 'set_piece_xg',
    name: 'xG a Balón Parado',
    shortName: 'xG Balón Parado',
    extractor: (t) =>
      t.set_piece_xg_p90 ??
      t.set_piece_xg_per_match ??
      (t.matches_played > 0 && t.set_piece_xg ? t.set_piece_xg / t.matches_played : 0),
    format: (v) => `${v.toFixed(2)} xG / pj`,
    higherIsBetter: true,
  },
];

/**
 * Computes Liga 1 cohort rankings and percentiles across `TACTICAL_RADAR_DIMS`
 * for the selected club.
 */
export function calculateTacticalRadarCohort(
  activeTeam: TeamMetricEntry,
  teams?: TeamMetricEntry[]
): TacticalRadarAxisReport[] {
  if (!teams || teams.length === 0) {
    return [];
  }

  return TACTICAL_RADAR_DIMS.map((dim) => {
    const cohort = teams.map((t) => ({ team_id: t.team_id, val: dim.extractor(t) }));
    cohort.sort((a, b) => (dim.higherIsBetter ? b.val - a.val : a.val - b.val));
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
    const percentile = n > 1 ? Math.round(((n - rank) / (n - 1)) * 100) : 50;

    return {
      name: dim.name,
      valueFormatted: dim.format(activeVal),
      percentile,
      rank,
      cohortSize: n,
    };
  });
}

/** Builds institutional report header lines including sample record and active filters. */
export function buildInstitutionalHeaderLines(data: ClubReportData): string[] {
  const teamNameUpper = (data.teamName || 'CLUB').toUpperCase();
  const gdStr = formatGoalDiffSign(data.record.goalDifference);

  const activeFilters: string[] = [];
  if (data.isNonDefaultVenue) {
    activeFilters.push(`Sede: ${data.venueLabel}`);
  }
  if (data.isNonDefaultContext) {
    activeFilters.push(`Contexto: ${data.contextLabel}`);
  }
  if (data.isNonDefaultPerspective) {
    activeFilters.push(`Perspectiva: ${data.perspectiveLabel}`);
  }

  return [
    `# REPORTE DE RENDIMIENTO TÁCTICO: ${teamNameUpper}`,
    `Competición: Liga 1 2026 (${data.tournamentLabel}) | Fecha: ${data.dateStr}`,
    `Muestra: ${data.record.matchesPlayed} PJ (${data.record.wins}V - ${data.record.draws}E - ${data.record.losses}D) | Puntos: ${data.record.points} | Goles: ${data.record.goalsScored} GF : ${data.record.goalsConceded} GC (${gdStr})`,
    ...(activeFilters.length > 0 ? [`Filtros activos: ${activeFilters.join(' | ')}`] : []),
    ...(data.matchContextLines && data.matchContextLines.length > 0
      ? data.matchContextLines
      : []),
  ];
}

/** Builds Section 1 Markdown lines: Liga 1 style profile percentile table. */
export function buildTacticalStyleSectionLines(data: ClubReportData): string[] {
  const rows =
    data.tacticalRadarAxes && data.tacticalRadarAxes.length > 0
      ? data.tacticalRadarAxes.map((axis) => [
          axis.name,
          axis.valueFormatted,
          `Pctl ${axis.percentile}`,
          `#${axis.rank} de ${axis.cohortSize}`,
        ])
      : [['Sin datos de radar para la cohorte activa', '-', '-', '-']];

  return [
    '### 1. PERFIL DE ESTILO (PERCENTILES LIGA 1)',
    ...formatMarkdownTable(
      ['Dimensión Táctica', 'Valor Equipo', 'Percentil Liga', 'Rango Liga'],
      [':---', ':---:', ':---:', ':---:'],
      rows
    ),
  ];
}
