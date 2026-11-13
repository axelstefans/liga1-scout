import { resolveReportScopeLabels } from './reportFormatters';
import {
  prepareDisciplineReport,
  prepareFlashscoreReport,
  prepareMostUsedXIPlayers,
  preparePeriodDynamicsReport,
  prepareSetPiecesReport,
} from './reportDataMappers';
import type { ClubReportData, PrepareClubReportParams } from './reportTypes';
import {
  buildInstitutionalHeaderLines,
  buildTacticalStyleSectionLines,
  calculateTacticalRadarCohort,
  TACTICAL_RADAR_DIMS,
} from './sections/overviewAndStyleSection';
import {
  buildShotMapSectionLines,
  preparePassNetworkSummary,
  prepareShotMapReport,
} from './sections/spatialAndBuildupSection';
import {
  buildDisciplineSectionLines,
  buildFlashscoreGoalkeeperSectionLines,
  buildMostUsedXISectionLines,
  buildPeriodDynamicsSectionLines,
  buildSetPiecesSectionLines,
} from './sections/setPiecesAndPeriodsSection';

export * from './reportTypes';
export { TACTICAL_RADAR_DIMS, calculateTacticalRadarCohort };

/**
 * Transforms club API metrics, tactical cohorts, spatial shot data, period splits,
 * Flashscore aggregates, and starting XI into a normalized `ClubReportData` payload.
 */
export function prepareClubReportData(params: PrepareClubReportParams): ClubReportData {
  const {
    activeTeam,
    teams,
    leagueRank,
    selectedTournament,
    venue,
    contextFilter,
    perspective,
    aggregationMode,
    activeMatch,
    passNetworkData,
    shotData,
    periodMetricsData,
    mostUsedXIData,
    flashscoreSummary,
    dateStr,
  } = params;

  const scopeLabels = resolveReportScopeLabels(
    selectedTournament,
    venue,
    contextFilter,
    perspective
  );

  const resolvedDateStr =
    dateStr ||
    new Date().toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const matchContextLines: string[] = [];
  if (aggregationMode === 'match' && activeMatch) {
    const matchScore =
      activeMatch.team_score !== null && activeMatch.opponent_score !== null
        ? `${activeMatch.team_score} - ${activeMatch.opponent_score}`
        : 'Pendiente';
    matchContextLines.push(
      `- Partido Seleccionado: ${activeMatch.label} (${activeMatch.is_home ? 'Local' : 'Visita'}) | Rival: ${activeMatch.opponent_name} (${matchScore})`
    );
  }

  const formationStr = mostUsedXIData?.formation || '4-2-3-1';
  const matchesPlayed = activeTeam.matches_played;

  return {
    teamName: activeTeam.name,
    dateStr: resolvedDateStr,
    ...scopeLabels,
    matchContextLines: matchContextLines.length > 0 ? matchContextLines : undefined,
    leagueRank,
    record: {
      matchesPlayed,
      wins: activeTeam.wins,
      draws: activeTeam.draws,
      losses: activeTeam.losses,
      points: activeTeam.points,
      goalsScored: activeTeam.goals_scored,
      goalsConceded: activeTeam.goals_conceded,
      goalDifference: activeTeam.goal_difference,
    },
    tacticalRadarAxes: calculateTacticalRadarCohort(activeTeam, teams),
    passNetwork: preparePassNetworkSummary(passNetworkData, formationStr),
    shotMap: prepareShotMapReport(matchesPlayed, shotData, mostUsedXIData, flashscoreSummary),
    setPieces: prepareSetPiecesReport(matchesPlayed, periodMetricsData, flashscoreSummary),
    periodDynamics: preparePeriodDynamicsReport(matchesPlayed, periodMetricsData),
    discipline: prepareDisciplineReport(matchesPlayed, periodMetricsData),
    mostUsedXI: {
      formation: formationStr,
      players: prepareMostUsedXIPlayers(mostUsedXIData),
    },
    flashscore: prepareFlashscoreReport(flashscoreSummary),
  };
}

/**
 * Generates a pure Markdown Liga 1 club tactical scouting report from `ClubReportData`.
 */
export function buildClubMarkdownReport(data: ClubReportData): string {
  const sections: string[][] = [
    buildInstitutionalHeaderLines(data),
    buildTacticalStyleSectionLines(data),
    buildShotMapSectionLines(data),
    buildSetPiecesSectionLines(data),
    buildPeriodDynamicsSectionLines(data),
    buildDisciplineSectionLines(data),
    buildMostUsedXISectionLines(data),
    buildFlashscoreGoalkeeperSectionLines(data),
  ];

  const docLines: string[] = [];
  sections.forEach((lines, index) => {
    if (index > 0) {
      docLines.push('', '---', '');
    }
    docLines.push(...lines);
  });

  return docLines.join('\n');
}
