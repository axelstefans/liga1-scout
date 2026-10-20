/**
 * clubReportBuilder.ts
 * Pure TypeScript service for aggregating and generating comprehensive scouting and
 * tactical intelligence Markdown reports for Liga 1 clubs.
 *
 * Fully decoupled from UI rendering, zero React dependencies, zero side-effects.
 */

import {
  TeamMetricEntry,
  TeamPassNetworkResponse,
  TeamShotMapResponse,
  TeamPeriodMetricsResponse,
  MostUsedXIResponse,
  TeamFlashscoreSummaryResponse,
  TeamMatchItem,
  VenueFilter,
  ContextFilter,
} from './api';

// ============================================================================
// Interfaces
// ============================================================================

export interface TacticalRadarAxisReport {
  name: string;
  valueFormatted: string;
  percentile: number;
  rank: number;
  cohortSize: number;
}

export interface ShotMapTopShooter {
  name: string;
  shots: number;
  goals: number;
  xg: number;
  roles?: string[];
}

export interface ShotMapReport {
  totalShots: number;
  shotsPerMatch: number;
  goals: number;
  xgDelta: number;
  totalXg: number;
  xgPerShot: number;
  shotsOnTarget: number;
  onTargetPct: number;
  pctInBox: number;
  inBoxCount: number;
  outBoxCount: number;
  topShooters: ShotMapTopShooter[];
  // Moved from Sec 7 to Sec 2
  postImpact?: {
    avgXgot: number;
    avgXg: number;
    deltaXgotXg: number;
  };
  bigChances?: {
    scored: number;
    missed: number;
    convPct: number;
  };
}

export interface SetPiecesReport {
  cornersForAvg?: number | null;
  cornersAgainstAvg?: number | null;
  cornersTotalAvg?: number | null;
  over45CornersForPct?: number;
  over45CornersForCount?: number;
  over45CornersForTotal?: number;
  over55CornersForPct?: number;
  over55CornersForCount?: number;
  over55CornersForTotal?: number;
  over85CornersPct: number;
  over85CornersCount: number;
  over85CornersTotal: number;
  over95CornersPct: number;
  over95CornersCount: number;
  over95CornersTotal: number;
  concededOver45Pct: number;
  concededOver45Count: number;
  concededOver45Total: number;
  penaltiesAwarded: number;
  penaltiesScored: number;
  penaltiesConceded: number;
  setPieceGoals: number;
  setPieceGoalsAvg: number;
  cornerGoals: number;
  setPieceGoalsConceded: number;
  setPieceGoalsConcededAvg: number;
  cornerGoalsConceded: number;
  // Floor 2.5 crosses integration
  crossesAvailable?: boolean;
  avgCrossesTotal?: number;
  avgCrossesCompleted?: number;
  crossAccuracyPct?: number;
  headedGoals?: number;
}

export interface PeriodDynamicsReport {
  goals1T: number | string;
  goals2T: number | string;
  pctGoals2T: number;
  xg1T: string;
  xg2T: string;
  corners1T?: string;
  corners2T?: string;
  peakScoringInterval: string;
  bttsPct: number;
  bttsCount: number;
  bttsTotal: number;
  cleanSheetsCount: number;
  cleanSheetsTotal: number;
  cleanSheetsPct: number;
  failedToScoreCount: number;
  failedToScoreTotal: number;
  failedToScorePct: number;
  earlyConcededCount: number;
  earlyConcededTotal: number;
  earlyConcededPct: number;
  htWon: number;
  htDrawn: number;
  htLost: number;
  htTotal: number;
  scored1stCount: number;
  scored1stTotal: number;
  scored1stPct: number;
  scored1stRecord: string;
  conceded1stCount: number;
  conceded1stTotal: number;
  conceded1stPct: number;
  conceded1stRecord: string;
}

export interface DisciplineReport {
  yellowsAvg: number;
  redsAvg: number;
  cardsTotalAvg: number;
  cardsForcedAvg?: number | null;
  cardsMatchTotalAvg?: number | null;
  redCardsTotal: number;
  redCardsAvg: number;
  cards2hPct: number | string;
  over35CardsPct: number;
  over35CardsCount: number;
  over35CardsTotal: number;
  over45CardsPct: number;
  over45CardsCount: number;
  over45CardsTotal: number;
  foulsCommittedAvg?: number | null;
  foulsDrawnAvg?: number | null;
  foulsNetStr: string;
}

export interface MostUsedXIReportPlayer {
  slot: string;
  name: string;
  minutesSharePct: number;
  age: number | string;
  starts: number | string;
  ga: string | number;
  xg: string;
  shotsP90: string;
  foulsP90: string;
  yellowCards: number;
  redCards: number;
  isEnCapilla: boolean;
  disciplineStr: string;
  setPieceRoles: string[];
  setPieceRolesStr: string;
  isGK?: boolean;
  saves?: number;
  savesP90?: number;
}

export interface FlashscoreAdvancedReport {
  available: boolean;
  avgTouchesBox: number;
  touches1T: number;
  touches2T: number;
  avgXgot: number;
  avgXg: number;
  deltaXgotXg: number;
  avgP3: number;
  p3_1T: number;
  p3_2T: number;
  bigScored: number;
  bigMissed: number;
  bigTotal: number;
  bigConvPct: number;
  goalsPrevented: number;
  preventedPerMatch: number;
  xgotFaced: number;
  goalsConceded: number;
  netXg1T: number;
  xgFav1T: number;
  xgCon1T: number;
  netXg2T: number;
  xgFav2T: number;
  xgCon2T: number;
  possession1T: number;
  possession2T: number;
}

export interface ClubReportData {
  teamName: string;
  dateStr: string;
  tournamentLabel: string;
  venueLabel: string;
  contextLabel: string;
  perspectiveLabel: string;
  isNonDefaultVenue?: boolean;
  isNonDefaultContext?: boolean;
  isNonDefaultPerspective?: boolean;
  matchContextLines?: string[];
  leagueRank: number | string;
  record: {
    matchesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    points: number;
    goalsScored: number;
    goalsConceded: number;
    goalDifference: number;
  };
  tacticalRadarAxes: TacticalRadarAxisReport[];
  passNetwork: {
    formation: string;
    edgeCount: number;
    passVolume?: number;
  };
  shotMap: ShotMapReport;
  setPieces: SetPiecesReport;
  periodDynamics: PeriodDynamicsReport;
  discipline: DisciplineReport;
  mostUsedXI: {
    formation: string;
    players: MostUsedXIReportPlayer[];
  };
  flashscore?: FlashscoreAdvancedReport;
}

export interface RadarDimDef {
  key: string;
  name: string;
  shortName: string;
  extractor: (t: TeamMetricEntry) => number;
  format: (v: number) => string;
  higherIsBetter: boolean;
}

// ============================================================================
// Constants & Radar Dimension Definitions (Sec 1: exactly 4 core dimensions)
// ============================================================================

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

// ============================================================================
// Cohort Radar Calculation Helper
// ============================================================================

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

// ============================================================================
// Data Transformation Adapter
// ============================================================================

export interface PrepareClubReportParams {
  activeTeam: TeamMetricEntry;
  teams?: TeamMetricEntry[];
  leagueRank: number | string;
  selectedTournament: 'all' | 'Apertura' | 'Clausura';
  venue: VenueFilter;
  contextFilter: ContextFilter;
  perspective: 'for' | 'against';
  aggregationMode: 'cumulative' | 'match';
  activeMatch?: TeamMatchItem | null;
  passNetworkData?: TeamPassNetworkResponse;
  shotData?: TeamShotMapResponse;
  periodMetricsData?: TeamPeriodMetricsResponse;
  mostUsedXIData?: MostUsedXIResponse;
  flashscoreSummary?: TeamFlashscoreSummaryResponse;
  dateStr?: string;
}

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

  // 1. Header & Labels
  const tournamentLabel =
    selectedTournament === 'all' ? 'Temporada Completa' : `${selectedTournament}`;
  const venueLabel =
    venue === 'home' ? 'Solo Local' : venue === 'away' ? 'Solo Visita' : 'Todos';
  const contextLabel =
    contextFilter === 'vs_elite'
      ? 'vs. Élite (Alianza Lima, Universitario, Cristal, Melgar)'
      : contextFilter === 'vs_rest'
      ? 'vs. Resto (14 rivales restantes)'
      : contextFilter === 'altitude'
      ? 'En Altura (>2,000m)'
      : contextFilter === 'sea_level'
      ? 'En Llano / Nivel del Mar'
      : 'Todos';
  const perspectiveLabel =
    perspective === 'for'
      ? 'A Favor'
      : 'En Contra (Fase defensiva)';

  const isNonDefaultVenue = venue !== 'all';
  const isNonDefaultContext = contextFilter !== 'all';
  const isNonDefaultPerspective = perspective !== 'for';

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

  // 2. Tactical Radar Cohort (Filtered to 4 core dimensions)
  const tacticalRadarAxes = calculateTacticalRadarCohort(activeTeam, teams);

  // 3. Passing Network
  const formationStr = mostUsedXIData?.formation || '4-2-3-1';
  const edgeCount = passNetworkData?.edges?.length || 0;
  const passVolume =
    passNetworkData?.edges?.reduce((acc, e) => acc + (e.pass_count || 0), 0) ||
    passNetworkData?.nodes?.reduce((acc, n) => acc + (n.total_passes || 0), 0) ||
    0;

  // 4. Shotmap & Finishing (Sec 2)
  const rawShots = shotData?.shots || [];
  const total_shots = rawShots.length;
  const goals = rawShots.filter((s) => s.result === 'goal').length;
  const saved = rawShots.filter((s) => s.result === 'saved').length;
  const total_xg_val = Math.round(rawShots.reduce((acc, s) => acc + s.xg, 0) * 100) / 100;
  const xg_per_shot = total_shots > 0 ? total_xg_val / total_shots : 0;
  const shots_on_target = goals + saved;
  const on_target_pct = total_shots > 0 ? (shots_on_target / total_shots) * 100 : 0;
  const delta_val = Math.round((goals - total_xg_val) * 100) / 100;
  const inBoxCount = rawShots.filter((s) => s.x >= 84.0 && s.y >= 20.0 && s.y <= 80.0).length;
  const pctInBox = total_shots > 0 ? Math.round((inBoxCount / total_shots) * 100) : 0;
  const shotsPerMatch = total_shots / (activeTeam.matches_played || 1);

  // Player set-piece role lookup from XI
  const playerRolesByName = new Map<string, string[]>();
  if (mostUsedXIData?.players) {
    for (const p of mostUsedXIData.players) {
      if (p.name && p.set_piece_roles && p.set_piece_roles.length > 0) {
        playerRolesByName.set(p.name.trim().toLowerCase(), p.set_piece_roles);
      }
    }
  }

  const shooterMap = new Map<string, { shots: number; xg: number; goals: number; roles: Set<string> }>();
  for (const s of rawShots) {
    const name = s.player_name || 'Desconocido';
    const curr = shooterMap.get(name) || { shots: 0, xg: 0, goals: 0, roles: new Set<string>() };
    curr.shots += 1;
    curr.xg += s.xg;
    if (s.result === 'goal') curr.goals += 1;
    if (s.situation === 'penalty') curr.roles.add('PEN');
    if (s.situation === 'free-kick') curr.roles.add('FK');
    shooterMap.set(name, curr);
  }

  const topShooters: ShotMapTopShooter[] = Array.from(shooterMap.entries())
    .map(([name, d]) => {
      const normName = name.trim().toLowerCase();
      const rolesFromXI = playerRolesByName.get(normName) || [];
      rolesFromXI.forEach((r) => d.roles.add(r));

      if (rolesFromXI.length === 0) {
        for (const [xiName, xiRoles] of playerRolesByName.entries()) {
          if (xiName.includes(normName) || normName.includes(xiName)) {
            xiRoles.forEach((r) => d.roles.add(r));
          }
        }
      }

      const roleList = Array.from(d.roles);
      const roleOrder: Record<string, number> = { PEN: 1, FK: 2, COR: 3 };
      roleList.sort((a, b) => (roleOrder[a] || 9) - (roleOrder[b] || 9));

      const tag = roleList.length > 0 ? ` (${roleList.join(', ')})` : '';
      return {
        name: `${name}${tag}`,
        shots: d.shots,
        goals: d.goals,
        xg: Math.round(d.xg * 100) / 100,
        roles: roleList,
      };
    })
    .sort((a, b) => b.xg - a.xg || b.shots - a.shots)
    .slice(0, 4);

  const hasFsMatches = Boolean(flashscoreSummary && flashscoreSummary.matches_analyzed > 0);
  const pAll = flashscoreSummary?.periods?.ALL;

  const postImpact = hasFsMatches && pAll
    ? {
        avgXgot: pAll.avg_xgot ?? 0,
        avgXg: pAll.avg_xg ?? 0,
        deltaXgotXg: (pAll.avg_xgot ?? 0) - (pAll.avg_xg ?? 0),
      }
    : undefined;

  const bigScored = pAll?.total_big_chances_scored ?? 0;
  const bigMissed = pAll?.total_big_chances_missed ?? 0;
  const bigTotal = pAll?.total_big_chances ?? (bigScored + bigMissed);
  const bigConvPct =
    pAll?.big_chances_conversion_pct != null
      ? pAll.big_chances_conversion_pct
      : bigTotal > 0
      ? (bigScored * 100.0) / bigTotal
      : 0;

  const bigChances = hasFsMatches && pAll
    ? {
        scored: bigScored,
        missed: bigMissed,
        convPct: bigConvPct,
      }
    : undefined;

  // 5. Set Pieces & Corners (Sec 3)
  const cornerStats = periodMetricsData?.corner_stats;
  const o85 = cornerStats?.over_8_5_corners;
  const o95 = cornerStats?.over_9_5_corners;
  const pct85 = o85 && o85.total > 0 ? Math.round((o85.count / o85.total) * 100) : 0;
  const pct95 = o95 && o95.total > 0 ? Math.round((o95.count / o95.total) * 100) : 0;
  const o45Conceded = cornerStats?.corners_conceded_over_4_5;
  const pct45Conceded =
    cornerStats?.corners_conceded_over_4_5_pct ??
    (o45Conceded && o45Conceded.total > 0
      ? Math.round((o45Conceded.count / o45Conceded.total) * 100)
      : 0);

  // Own Corner Lines (+4.5 and +5.5 corners for)
  const o45ForPct =
    periodMetricsData?.over_4_5_corners_for_pct ??
    cornerStats?.over_4_5_corners_for_pct ??
    (cornerStats?.over_4_5_corners_for && cornerStats.over_4_5_corners_for.total > 0
      ? Math.round(
          (cornerStats.over_4_5_corners_for.count /
            cornerStats.over_4_5_corners_for.total) *
            100
        )
      : 0);

  const o55ForPct =
    periodMetricsData?.over_5_5_corners_for_pct ??
    cornerStats?.over_5_5_corners_for_pct ??
    (cornerStats?.over_5_5_corners_for && cornerStats.over_5_5_corners_for.total > 0
      ? Math.round(
          (cornerStats.over_5_5_corners_for.count /
            cornerStats.over_5_5_corners_for.total) *
            100
        )
      : 0);

  const spGoals = periodMetricsData?.set_pieces?.set_piece_goals ?? 0;
  const spGoalsConceded = periodMetricsData?.set_pieces?.set_piece_goals_conceded ?? 0;
  const spGoalsScoredAvg =
    periodMetricsData?.set_pieces?.set_piece_goals_per_match ??
    (activeTeam.matches_played > 0 ? spGoals / activeTeam.matches_played : 0);
  const spGoalsConcededAvg =
    periodMetricsData?.set_pieces?.set_piece_goals_conceded_per_match ??
    (activeTeam.matches_played > 0 ? spGoalsConceded / activeTeam.matches_played : 0);
  const cornerGoals = periodMetricsData?.set_pieces?.corner_goals ?? 0;
  const cornerGoalsConceded = periodMetricsData?.set_pieces?.corner_goals_conceded ?? 0;
  const penAwarded =
    periodMetricsData?.penalties_awarded ??
    periodMetricsData?.set_pieces?.penalties_awarded ??
    0;
  const penScored =
    periodMetricsData?.penalties_scored ??
    periodMetricsData?.set_pieces?.penalties_scored ??
    0;
  const penConceded =
    periodMetricsData?.penalties_conceded ??
    periodMetricsData?.set_pieces?.penalties_conceded ??
    0;

  const crossesAvailable = hasFsMatches;
  const avgCrossesTotal = pAll?.avg_crosses_total ?? 0;
  const avgCrossesCompleted = pAll?.avg_crosses_completed ?? 0;
  const crossAccuracyPct = pAll?.cross_accuracy_pct ?? 0;
  const headedGoals = pAll?.total_headed_goals ?? 0;

  // 6. Balance & Dynamics (Sec 4)
  const splits = periodMetricsData?.time_splits;
  const periods = periodMetricsData?.periods;
  const dynamics = periodMetricsData?.match_dynamics;
  const htWon = dynamics?.ht_won?.count ?? 0;
  const htTotal = dynamics?.ht_won?.total ?? 0;
  const htDrawn = dynamics?.ht_drawn?.count ?? 0;
  const htLost = dynamics?.ht_lost?.count ?? 0;
  const btts = dynamics?.btts;
  const pctBtts = btts && btts.total > 0 ? Math.round((btts.count / btts.total) * 100) : 0;
  const scored1st = dynamics?.scored_first;
  const pctScored1st =
    scored1st && scored1st.total > 0 ? Math.round((scored1st.count / scored1st.total) * 100) : 0;
  const conceded1st = dynamics?.conceded_first;
  const pctConceded1st =
    conceded1st && conceded1st.total > 0
      ? Math.round((conceded1st.count / conceded1st.total) * 100)
      : 0;
  const cleanSheets = dynamics?.clean_sheets;
  const cleanSheetsPct =
    dynamics?.clean_sheets_pct ??
    (cleanSheets && cleanSheets.total > 0
      ? Math.round((cleanSheets.count / cleanSheets.total) * 100)
      : 0);
  const failedToScore = dynamics?.failed_to_score;
  const failedToScorePct =
    dynamics?.failed_to_score_pct ??
    (failedToScore && failedToScore.total > 0
      ? Math.round((failedToScore.count / failedToScore.total) * 100)
      : 0);
  const earlyConceded = dynamics?.conceded_early_0_20;
  const earlyConcededPct =
    dynamics?.conceded_early_0_20_pct ??
    (earlyConceded && earlyConceded.total > 0
      ? Math.round((earlyConceded.count / earlyConceded.total) * 100)
      : 0);

  const xg1T =
    periods?.['1ST']?.avg_xg !== undefined ? periods['1ST'].avg_xg.toFixed(2) : 'N/D';
  const xg2T =
    periods?.['2ND']?.avg_xg !== undefined ? periods['2ND'].avg_xg.toFixed(2) : 'N/D';

  const ck1tVal =
    periodMetricsData?.corners_1t_avg ??
    cornerStats?.corners_1t_avg ??
    splits?.corners_1t_avg;
  const ck2tVal =
    periodMetricsData?.corners_2t_avg ??
    cornerStats?.corners_2t_avg ??
    splits?.corners_2t_avg;
  const corners1T = ck1tVal != null ? ck1tVal.toFixed(1) : 'N/D';
  const corners2T = ck2tVal != null ? ck2tVal.toFixed(1) : 'N/D';

  // 7. Discipline & Fouls (Sec 5)
  const disc = periodMetricsData?.discipline_stats;
  const cardsTotalAvg = disc ? disc.cards_for_avg : 0;
  const redsAvg = disc ? disc.red_cards_avg ?? 0 : 0;
  const yellowsAvg = Math.max(0, cardsTotalAvg - redsAvg);
  const foulsNet = (disc?.fouls_committed_avg ?? 0) - (disc?.fouls_drawn_avg ?? 0);
  const foulsNetStr =
    foulsNet > 0
      ? `+${foulsNet.toFixed(1)} cometidas vs recibidas`
      : foulsNet < 0
      ? `+${Math.abs(foulsNet).toFixed(1)} recibidas vs cometidas`
      : '0.0 balance neutral';

  const o35Cards = disc?.over_3_5_cards;
  const pctCards =
    o35Cards && o35Cards.total > 0 ? Math.round((o35Cards.count / o35Cards.total) * 100) : 0;

  const o45Cards = disc?.over_4_5_cards;
  const pctCards45 =
    periodMetricsData?.over_4_5_cards_pct ??
    disc?.over_4_5_cards_pct ??
    (o45Cards && o45Cards.total > 0
      ? Math.round((o45Cards.count / o45Cards.total) * 100)
      : 0);
  const countCards45 =
    periodMetricsData?.over_4_5_cards_count ??
    disc?.over_4_5_cards_count ??
    (o45Cards?.count ?? 0);
  const totalCards45 = o45Cards?.total ?? activeTeam.matches_played;

  // 8. Base Starting XI (Sec 6)
  const xiPlayers = mostUsedXIData?.players || [];
  const transformedPlayers: MostUsedXIReportPlayer[] = xiPlayers.map((p) => {
    const slot = p.slot || '-';
    const isGK = slot === 'GK' || slot === 'G' || p.position_group === 'Goalkeeper';
    const name = p.name || 'Desconocido';

    const mins = Math.round(p.minutes_share || p.minutes_pct || 0);
    const age = p.age ?? '-';
    const starts = p.starts ?? p.appearances ?? '-';
    const ga = isGK ? '—' : (p.g_plus_a ?? p.goals + p.assists);
    const xg = isGK ? '—' : (p.xg ?? 0).toFixed(2);
    const shotsP90 = isGK ? '—' : (p.shots_p90 ?? 0).toFixed(1);
    const foulsP90 = isGK ? '—' : (p.fouls_p90 ?? 0).toFixed(1);

    const rawYc = p.yellow_cards ?? 0;
    const rawRc = p.red_cards ?? 0;
    const isEnCapilla = rawYc === 4 || (rawYc > 0 && rawYc % 5 === 4);

    const discParts: string[] = [];
    if (rawYc > 0) {
      discParts.push(`${rawYc} 🟨${isEnCapilla ? ' (En Capilla)' : ''}`);
    }
    if (rawRc > 0) {
      discParts.push(`${rawRc} 🟥`);
    }
    const disciplineStr = discParts.length > 0 ? discParts.join(' ') : '—';

    const setPieceRoles = p.set_piece_roles || [];
    const setPieceRolesStr = setPieceRoles.length > 0 ? setPieceRoles.join(', ') : '—';

    return {
      slot,
      name,
      minutesSharePct: mins,
      age,
      starts,
      ga,
      xg,
      shotsP90,
      foulsP90,
      yellowCards: rawYc,
      redCards: rawRc,
      isEnCapilla,
      disciplineStr,
      setPieceRoles,
      setPieceRolesStr,
      isGK,
      saves: p.saves,
      savesP90: p.saves_p90,
    };
  });

  // 9. Flashscore Advanced Metrics (Sec 7)
  let flashscore: FlashscoreAdvancedReport | undefined;
  if (hasFsMatches && flashscoreSummary) {
    const p1T = flashscoreSummary.periods?.['1T'];
    const p2T = flashscoreSummary.periods?.['2T'];
    const gk = flashscoreSummary.goalkeeper_efficiency;

    const avgTouchesBox = pAll?.avg_touches_in_box ?? 0;
    const touches1T = p1T?.avg_touches_in_box ?? 0;
    const touches2T = p2T?.avg_touches_in_box ?? 0;

    const avgXgot = pAll?.avg_xgot ?? 0;
    const avgXg = pAll?.avg_xg ?? 0;
    const deltaXgotXg = avgXgot - avgXg;

    const avgP3 = pAll?.avg_passes_final_third_completed ?? 0;
    const p3_1T = p1T?.avg_passes_final_third_completed ?? 0;
    const p3_2T = p2T?.avg_passes_final_third_completed ?? 0;

    const goalsPrevented = gk?.goals_prevented ?? 0;
    const preventedPerMatch = gk?.prevented_per_match ?? 0;
    const xgotFaced = gk?.xgot_faced ?? 0;
    const goalsConceded = gk?.goals_conceded ?? 0;

    const netXg1T = (p1T?.avg_xg ?? 0) - (p1T?.avg_xg_conceded ?? 0);
    const xgFav1T = p1T?.avg_xg ?? 0;
    const xgCon1T = p1T?.avg_xg_conceded ?? 0;

    const netXg2T = (p2T?.avg_xg ?? 0) - (p2T?.avg_xg_conceded ?? 0);
    const xgFav2T = p2T?.avg_xg ?? 0;
    const xgCon2T = p2T?.avg_xg_conceded ?? 0;

    const possession1T = p1T?.avg_possession ?? 0;
    const possession2T = p2T?.avg_possession ?? 0;

    flashscore = {
      available: true,
      avgTouchesBox,
      touches1T,
      touches2T,
      avgXgot,
      avgXg,
      deltaXgotXg,
      avgP3,
      p3_1T,
      p3_2T,
      bigScored,
      bigMissed,
      bigTotal,
      bigConvPct,
      goalsPrevented,
      preventedPerMatch,
      xgotFaced,
      goalsConceded,
      netXg1T,
      xgFav1T,
      xgCon1T,
      netXg2T,
      xgFav2T,
      xgCon2T,
      possession1T,
      possession2T,
    };
  }

  return {
    teamName: activeTeam.name,
    dateStr: resolvedDateStr,
    tournamentLabel,
    venueLabel,
    contextLabel,
    perspectiveLabel,
    isNonDefaultVenue,
    isNonDefaultContext,
    isNonDefaultPerspective,
    matchContextLines: matchContextLines.length > 0 ? matchContextLines : undefined,
    leagueRank,
    record: {
      matchesPlayed: activeTeam.matches_played,
      wins: activeTeam.wins,
      draws: activeTeam.draws,
      losses: activeTeam.losses,
      points: activeTeam.points,
      goalsScored: activeTeam.goals_scored,
      goalsConceded: activeTeam.goals_conceded,
      goalDifference: activeTeam.goal_difference,
    },
    tacticalRadarAxes,
    passNetwork: {
      formation: formationStr,
      edgeCount,
      passVolume,
    },
    shotMap: {
      totalShots: total_shots,
      shotsPerMatch,
      goals,
      xgDelta: delta_val,
      totalXg: total_xg_val,
      xgPerShot: xg_per_shot,
      shotsOnTarget: shots_on_target,
      onTargetPct: on_target_pct,
      pctInBox,
      inBoxCount,
      outBoxCount: total_shots - inBoxCount,
      topShooters,
      postImpact,
      bigChances,
    },
    setPieces: {
      cornersForAvg: cornerStats?.corners_for_avg ?? null,
      cornersAgainstAvg: cornerStats?.corners_against_avg ?? null,
      cornersTotalAvg: cornerStats?.corners_total_avg ?? null,
      over45CornersForPct: o45ForPct,
      over45CornersForCount:
        periodMetricsData?.over_4_5_corners_for_count ??
        cornerStats?.over_4_5_corners_for_count ??
        cornerStats?.over_4_5_corners_for?.count ??
        0,
      over45CornersForTotal:
        cornerStats?.over_4_5_corners_for?.total ?? activeTeam.matches_played,
      over55CornersForPct: o55ForPct,
      over55CornersForCount:
        periodMetricsData?.over_5_5_corners_for_count ??
        cornerStats?.over_5_5_corners_for_count ??
        cornerStats?.over_5_5_corners_for?.count ??
        0,
      over55CornersForTotal:
        cornerStats?.over_5_5_corners_for?.total ?? activeTeam.matches_played,
      over85CornersPct: pct85,
      over85CornersCount: o85?.count ?? 0,
      over85CornersTotal: o85?.total ?? 0,
      over95CornersPct: pct95,
      over95CornersCount: o95?.count ?? 0,
      over95CornersTotal: o95?.total ?? 0,
      concededOver45Pct: pct45Conceded,
      concededOver45Count:
        o45Conceded?.count ?? cornerStats?.corners_conceded_over_4_5_count ?? 0,
      concededOver45Total: o45Conceded?.total ?? activeTeam.matches_played,
      penaltiesAwarded: penAwarded,
      penaltiesScored: penScored,
      penaltiesConceded: penConceded,
      setPieceGoals: spGoals,
      setPieceGoalsAvg: spGoalsScoredAvg,
      cornerGoals,
      setPieceGoalsConceded: spGoalsConceded,
      setPieceGoalsConcededAvg: spGoalsConcededAvg,
      cornerGoalsConceded,
      crossesAvailable,
      avgCrossesTotal,
      avgCrossesCompleted,
      crossAccuracyPct,
      headedGoals,
    },
    periodDynamics: {
      goals1T: splits?.goals_1t ?? 'N/D',
      goals2T: splits?.goals_2t ?? 'N/D',
      pctGoals2T: splits?.pct_goals_2t ?? 0,
      xg1T,
      xg2T,
      corners1T,
      corners2T,
      peakScoringInterval: splits?.peak_scoring_interval || 'N/D',
      bttsPct: pctBtts,
      bttsCount: btts?.count ?? 0,
      bttsTotal: btts?.total ?? 0,
      cleanSheetsCount: cleanSheets?.count ?? 0,
      cleanSheetsTotal: cleanSheets?.total ?? htTotal,
      cleanSheetsPct,
      failedToScoreCount: failedToScore?.count ?? 0,
      failedToScoreTotal: failedToScore?.total ?? htTotal,
      failedToScorePct,
      earlyConcededCount: earlyConceded?.count ?? 0,
      earlyConcededTotal: earlyConceded?.total ?? htTotal,
      earlyConcededPct,
      htWon,
      htDrawn,
      htLost,
      htTotal: htTotal || activeTeam.matches_played,
      scored1stCount: scored1st?.count ?? 0,
      scored1stTotal: scored1st?.total ?? 0,
      scored1stPct: pctScored1st,
      scored1stRecord: scored1st?.record || 'N/D',
      conceded1stCount: conceded1st?.count ?? 0,
      conceded1stTotal: conceded1st?.total ?? 0,
      conceded1stPct: pctConceded1st,
      conceded1stRecord: conceded1st?.record || 'N/D',
    },
    discipline: {
      yellowsAvg,
      redsAvg,
      cardsTotalAvg,
      cardsForcedAvg: disc?.cards_forced_avg ?? null,
      cardsMatchTotalAvg: disc?.cards_match_total_avg ?? null,
      redCardsTotal: disc?.red_cards_total ?? 0,
      redCardsAvg: disc?.red_cards_avg ?? 0,
      cards2hPct: disc?.cards_2h_pct ?? 'N/D',
      over35CardsPct: pctCards,
      over35CardsCount: o35Cards?.count ?? 0,
      over35CardsTotal: o35Cards?.total ?? 0,
      over45CardsPct: pctCards45,
      over45CardsCount: countCards45,
      over45CardsTotal: totalCards45,
      foulsCommittedAvg: disc?.fouls_committed_avg ?? null,
      foulsDrawnAvg: disc?.fouls_drawn_avg ?? null,
      foulsNetStr,
    },
    mostUsedXI: {
      formation: mostUsedXIData?.formation || formationStr,
      players: transformedPlayers,
    },
    flashscore,
  };
}

// ============================================================================
// Pure Markdown Document Builder
// ============================================================================

export function buildClubMarkdownReport(data: ClubReportData): string {
  const teamNameUpper = (data.teamName || 'CLUB').toUpperCase();
  const gdSign = data.record.goalDifference > 0 ? '+' : '';

  // Non-default filter tracking
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

  // 1. Executive Header
  const headerLines = [
    `# REPORTE DE RENDIMIENTO TÁCTICO: ${teamNameUpper}`,
    `Competición: Liga 1 2026 (${data.tournamentLabel}) | Fecha: ${data.dateStr}`,
    `Muestra: ${data.record.matchesPlayed} PJ (${data.record.wins}V - ${data.record.draws}E - ${data.record.losses}D) | Puntos: ${data.record.points} | Goles: ${data.record.goalsScored} GF : ${data.record.goalsConceded} GC (${gdSign}${data.record.goalDifference})`,
    ...(activeFilters.length > 0 ? [`Filtros activos: ${activeFilters.join(' | ')}`] : []),
    ...(data.matchContextLines && data.matchContextLines.length > 0
      ? data.matchContextLines
      : []),
  ];

  // Section 1: PERFIL DE ESTILO (PERCENTILES LIGA 1) - exactly 4 core dimensions
  const radarLines: string[] = [
    '### 1. PERFIL DE ESTILO (PERCENTILES LIGA 1)',
    '| Dimensión Táctica | Valor Equipo | Percentil Liga | Rango Liga |',
    '| :--- | :---: | :---: | :---: |',
  ];

  if (data.tacticalRadarAxes && data.tacticalRadarAxes.length > 0) {
    data.tacticalRadarAxes.forEach((axis) => {
      radarLines.push(
        `| ${axis.name} | ${axis.valueFormatted} | Pctl ${axis.percentile} | #${axis.rank} de ${axis.cohortSize} |`
      );
    });
  } else {
    radarLines.push('| Sin datos de radar para la cohorte activa | - | - | - |');
  }

  // Section 2: REMATES & EFICIENCIA OFENSIVA (xG)
  const sm = data.shotMap;
  const deltaSign = sm.xgDelta >= 0 ? '+' : '';
  const topShooterLines =
    sm.topShooters.length > 0
      ? sm.topShooters.map(
          (s, i) =>
            `  ${i + 1}. **${s.name}**: ${s.goals} goles | ${s.shots} remates | ${s.xg.toFixed(2)} xG`
        )
      : ['  - Sin rematadores registrados en la muestra activa.'];

  const postImpactLine = sm.postImpact
    ? `- **Calidad Post-Impacto:** ${sm.postImpact.avgXgot.toFixed(2)} xGOT vs ${sm.postImpact.avgXg.toFixed(2)} xG (${sm.postImpact.deltaXgotXg >= 0 ? '+' : ''}${sm.postImpact.deltaXgotXg.toFixed(2)} delta)`
    : null;

  const bigChancesLine = sm.bigChances
    ? `- **Grandes Ocasiones:** ${sm.bigChances.scored} convertidas / ${sm.bigChances.missed} falladas (${sm.bigChances.convPct.toFixed(1)}% efectividad)`
    : null;

  const shotLines = [
    '### 2. REMATES & EFICIENCIA OFENSIVA (xG)',
    `- **Volumen Total:** ${sm.totalShots} remates analizados (${sm.shotsPerMatch.toFixed(1)} / pj)`,
    `- **Goles / Conversión:** ${sm.goals} goles anotados (${deltaSign}${sm.xgDelta.toFixed(2)} vs xG)`,
    `- **Peligro Esperado (xG):** ${sm.totalXg.toFixed(2)} xG acumulados`,
    `- **Calidad Media por Disparo:** ${sm.xgPerShot.toFixed(2)} xG / tiro`,
    ...(postImpactLine ? [postImpactLine] : []),
    ...(bigChancesLine ? [bigChancesLine] : []),
    `- **Efectividad a Puerta:** ${sm.onTargetPct.toFixed(1)}% (${sm.shotsOnTarget} disparos entre los tres palos)`,
    `- **Distribución Espacial:** ${sm.pctInBox}% dentro del área (${sm.inBoxCount}) | ${100 - sm.pctInBox}% fuera del área (${sm.outBoxCount})`,
    `- **Top Finalizadores:**`,
    ...topShooterLines,
  ];

  // Section 3: BALÓN PARADO & CÓRNERS
  const sp = data.setPieces;
  const cornersForStr = sp.cornersForAvg != null ? sp.cornersForAvg.toFixed(1) : 'N/D';
  const cornersAgStr = sp.cornersAgainstAvg != null ? sp.cornersAgainstAvg.toFixed(1) : 'N/D';
  const cornersTotStr = sp.cornersTotalAvg != null ? sp.cornersTotalAvg.toFixed(1) : 'N/D';

  const ownCornerLinesStr =
    sp.over45CornersForPct != null && sp.over55CornersForPct != null
      ? `- **Líneas Propias:** +4.5 Córners a Favor (${sp.over45CornersForPct}%) | +5.5 Córners a Favor (${sp.over55CornersForPct}%)`
      : null;

  const setPieceLines = [
    '### 3. BALÓN PARADO & CÓRNERS',
    `- **Córners / PJ:** ${cornersForStr} a favor | ${cornersAgStr} en contra | ${cornersTotStr} total partido`,
    ...(ownCornerLinesStr ? [ownCornerLinesStr] : []),
    `- **Cumplimiento Línea +8.5 Córners:** ${sp.over85CornersPct}% (${sp.over85CornersCount} de ${sp.over85CornersTotal} PJ)`,
    `- **Cumplimiento Línea +9.5 Córners:** ${sp.over95CornersPct}% (${sp.over95CornersCount} de ${sp.over95CornersTotal} PJ)`,
    `- **Concesión +4.5 Córners Rivales:** ${sp.concededOver45Pct}% (${sp.concededOver45Count} de ${sp.concededOver45Total} PJ)`,
    `- **Balance de Penales:** ${sp.penaltiesAwarded} a favor (${sp.penaltiesScored} convertidos) | ${sp.penaltiesConceded} en contra`,
    `- **Goles a Balón Parado:** ${sp.setPieceGoals} a favor (${sp.setPieceGoalsAvg.toFixed(2)}/pj, ${sp.cornerGoals} de córner) | ${sp.setPieceGoalsConceded} concedidos (${sp.setPieceGoalsConcededAvg.toFixed(2)}/pj, ${sp.cornerGoalsConceded} de córner)`,
    ...(sp.crossesAvailable
      ? [
          `- **Centros por Partido:** ${(sp.avgCrossesTotal ?? 0).toFixed(1)} / pj (${(sp.avgCrossesCompleted ?? 0).toFixed(1)} compl. — ${(sp.crossAccuracyPct ?? 0).toFixed(1)}% acierto) | Goles de Cabeza: ${sp.headedGoals ?? 0}`,
        ]
      : []),
  ];

  // Section 4: DINÁMICA DE PARTIDO & ESTADOS DE JUEGO (1T vs 2T)
  const pd = data.periodDynamics;
  const dynamicsLines = [
    '### 4. DINÁMICA DE PARTIDO & ESTADOS DE JUEGO (1T vs 2T)',
    `- **Distribución Temporal:** ${pd.goals1T} goles en 1T vs ${pd.goals2T} goles en 2T (${pd.pctGoals2T}% en el complemento)`,
    `- **xG Medio por Período:** ${pd.xg1T} xG en 1T vs ${pd.xg2T} xG en 2T`,
    `- **Córners por Mitad:** 1T: ${pd.corners1T ?? 'N/D'} vs 2T: ${pd.corners2T ?? 'N/D'}`,
    `- **Intervalo Pico de Gol:** ${pd.peakScoringInterval}`,
    `- **Ambos Anotan (BTTS):** ${pd.bttsPct}% (${pd.bttsCount} de ${pd.bttsTotal} PJ)`,
    `- **Valla Invicta:** ${pd.cleanSheetsCount} de ${pd.cleanSheetsTotal} PJ (${pd.cleanSheetsPct}%)`,
    `- **Sin Anotar (0 Goles):** ${pd.failedToScoreCount} de ${pd.failedToScoreTotal} PJ (${pd.failedToScorePct}%)`,
    `- **Gol Concedido Temprano (0-20'):** ${pd.earlyConcededCount} de ${pd.earlyConcededTotal} PJ (${pd.earlyConcededPct}%)`,
    `- **Marcador al Descanso (HT):** ${pd.htWon}V - ${pd.htDrawn}E - ${pd.htLost}D (Lideraba en ${pd.htWon} de ${pd.htTotal} PJ)`,
    `- **Al Anotar Primero:** ${pd.scored1stCount} de ${pd.scored1stTotal} PJ (${pd.scored1stPct}%) — Récord: ${pd.scored1stRecord}`,
    `- **Al Conceder Primero:** ${pd.conceded1stCount} de ${pd.conceded1stTotal} PJ (${pd.conceded1stPct}%) — Récord: ${pd.conceded1stRecord}`,
  ];

  // Section 5: DISCIPLINA & FALTAS
  const disc = data.discipline;
  const cardsForcedStr =
    disc.cardsForcedAvg != null ? disc.cardsForcedAvg.toFixed(1) : 'N/D';
  const cardsMatchTotStr =
    disc.cardsMatchTotalAvg != null ? disc.cardsMatchTotalAvg.toFixed(1) : 'N/D';
  const foulsCommittedStr =
    disc.foulsCommittedAvg != null ? disc.foulsCommittedAvg.toFixed(1) : 'N/D';
  const foulsDrawnStr =
    disc.foulsDrawnAvg != null ? disc.foulsDrawnAvg.toFixed(1) : 'N/D';

  const disciplineLines = [
    '### 5. DISCIPLINA & FALTAS',
    `- **Tarjetas / PJ:** ${disc.yellowsAvg.toFixed(1)} amarillas/pj + ${disc.redsAvg.toFixed(1)} rojas/pj (${disc.cardsTotalAvg.toFixed(1)} total/pj)`,
    `- **Tarjetas Provocadas:** ${cardsForcedStr} / pj | Total partido: ${cardsMatchTotStr} / pj`,
    `- **Tarjetas Rojas:** ${disc.redCardsTotal} totales (${disc.redCardsAvg.toFixed(2)} / pj)`,
    `- **Concentración 2T:** ${disc.cards2hPct}% de las tarjetas recibidas en el segundo tiempo`,
    `- **Líneas de Tarjetas:** Línea +3.5 (${disc.over35CardsPct}%) | Línea +4.5 (${disc.over45CardsPct}%)`,
    `- **Faltas / PJ:** ${foulsCommittedStr} cometidas vs ${foulsDrawnStr} recibidas (${disc.foulsNetStr})`,
  ];

  // Section 6: ONCE BASE MÁS UTILIZADO ({formation})
  const xiLines: string[] = [
    `### 6. ONCE BASE MÁS UTILIZADO (${data.mostUsedXI.formation})`,
    `- **Esquema Base:** ${data.mostUsedXI.formation}`,
    '| Pos | Jugador | % Min | Tit | G+A | xG | Tiros/90 | Faltas/90 | Disciplina | Rol BP |',
    '| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |',
  ];

  if (data.mostUsedXI.players.length > 0) {
    data.mostUsedXI.players.forEach((p) => {
      xiLines.push(
        `| ${p.slot} | ${p.name} | ${p.minutesSharePct}% | ${p.starts} | ${p.ga} | ${p.xg} | ${p.shotsP90} | ${p.foulsP90} | ${p.disciplineStr} | ${p.setPieceRolesStr} |`
      );
    });
  } else {
    xiLines.push(
      '| - | Sin datos de alineación base disponibles | - | - | - | - | - | - | - | - |'
    );
  }

  // Section 7: SOLIDEZ DEFENSIVA & ARQUERO (xGOT)
  const fsLines: string[] = [
    '### 7. SOLIDEZ DEFENSIVA & ARQUERO (xGOT)',
  ];

  const gk = data.mostUsedXI.players.find((p) => p.isGK);
  let gkInfoStr = 'Sin guardameta titular asignado';
  if (gk) {
    if (gk.saves != null && gk.saves > 0) {
      const p90Str = gk.savesP90 != null ? ` — ${gk.savesP90.toFixed(1)}/pj` : '';
      gkInfoStr = `${gk.name} (${gk.saves} atajadas${p90Str})`;
    } else {
      gkInfoStr = gk.name;
    }
  }

  fsLines.push(`- **Portero Titular:** ${gkInfoStr}`);

  if (data.flashscore && data.flashscore.available) {
    const fs = data.flashscore;
    const avgTouchesBox = fs.avgTouchesBox.toFixed(1);
    const touches1T = fs.touches1T.toFixed(1);
    const touches2T = fs.touches2T.toFixed(1);

    const avgP3 = fs.avgP3.toFixed(1);
    const p3_1T = fs.p3_1T.toFixed(1);
    const p3_2T = fs.p3_2T.toFixed(1);

    const gpStr = `${fs.goalsPrevented >= 0 ? '+' : ''}${fs.goalsPrevented.toFixed(2)}`;
    const gpmStr = `${fs.preventedPerMatch >= 0 ? '+' : ''}${fs.preventedPerMatch.toFixed(2)}`;
    const xgotFacedStr = fs.xgotFaced.toFixed(2);
    const gcStr = `${fs.goalsConceded}`;

    fsLines.push(
      `- **Rendimiento Bajo Palos:** ${gpStr} goles prevenidos (${gpmStr} / pj) | xGOT recibido: ${xgotFacedStr} vs ${gcStr} GC`,
      `- **Toques en Área Rival:** ${avgTouchesBox} / pj (1T: ${touches1T} vs 2T: ${touches2T})`,
      `- **Pases al Último Tercio:** ${avgP3} / pj (1T: ${p3_1T} vs 2T: ${p3_2T})`
    );
  } else {
    fsLines.push(
      '- Sin datos avanzados de control de área y post-impacto disponibles en la muestra seleccionada.'
    );
  }

  // Assemble full document with clean dividers and zero promotional watermark
  const docLines = [
    ...headerLines,
    '',
    '---',
    '',
    ...radarLines,
    '',
    '---',
    '',
    ...shotLines,
    '',
    '---',
    '',
    ...setPieceLines,
    '',
    '---',
    '',
    ...dynamicsLines,
    '',
    '---',
    '',
    ...disciplineLines,
    '',
    '---',
    '',
    ...xiLines,
    '',
    '---',
    '',
    ...fsLines,
  ];

  return docLines.join('\n');
}
