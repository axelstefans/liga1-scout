import type {
  MostUsedXIResponse,
  TeamFlashscoreSummaryResponse,
  TeamPeriodMetricsResponse,
} from '../api';
import {
  calcRoundedPct,
  formatFoulsNetBalance,
  formatNullableFixed,
  formatPlayerDiscipline,
} from './reportFormatters';
import type {
  DisciplineReport,
  FlashscoreAdvancedReport,
  MostUsedXIReportPlayer,
  PeriodDynamicsReport,
  SetPiecesReport,
} from './reportTypes';

/** Prepares Section 3 (Set Pieces, Corners, Penalties, Crosses) report state. */
export function prepareSetPiecesReport(
  matchesPlayed: number,
  periodMetricsData?: TeamPeriodMetricsResponse,
  flashscoreSummary?: TeamFlashscoreSummaryResponse
): SetPiecesReport {
  const cornerStats = periodMetricsData?.corner_stats;
  const o85 = cornerStats?.over_8_5_corners;
  const o95 = cornerStats?.over_9_5_corners;
  const o45Conceded = cornerStats?.corners_conceded_over_4_5;
  const hasFsMatches = Boolean(flashscoreSummary && flashscoreSummary.matches_analyzed > 0);
  const pAll = flashscoreSummary?.periods?.ALL;

  const pct45Conceded =
    cornerStats?.corners_conceded_over_4_5_pct ??
    calcRoundedPct(o45Conceded?.count, o45Conceded?.total);

  const o45ForPct =
    periodMetricsData?.over_4_5_corners_for_pct ??
    cornerStats?.over_4_5_corners_for_pct ??
    calcRoundedPct(
      cornerStats?.over_4_5_corners_for?.count,
      cornerStats?.over_4_5_corners_for?.total
    );

  const o55ForPct =
    periodMetricsData?.over_5_5_corners_for_pct ??
    cornerStats?.over_5_5_corners_for_pct ??
    calcRoundedPct(
      cornerStats?.over_5_5_corners_for?.count,
      cornerStats?.over_5_5_corners_for?.total
    );

  const spGoals = periodMetricsData?.set_pieces?.set_piece_goals ?? 0;
  const spGoalsConceded = periodMetricsData?.set_pieces?.set_piece_goals_conceded ?? 0;
  const spGoalsScoredAvg =
    periodMetricsData?.set_pieces?.set_piece_goals_per_match ??
    (matchesPlayed > 0 ? spGoals / matchesPlayed : 0);
  const spGoalsConcededAvg =
    periodMetricsData?.set_pieces?.set_piece_goals_conceded_per_match ??
    (matchesPlayed > 0 ? spGoalsConceded / matchesPlayed : 0);

  return {
    cornersForAvg: cornerStats?.corners_for_avg ?? null,
    cornersAgainstAvg: cornerStats?.corners_against_avg ?? null,
    cornersTotalAvg: cornerStats?.corners_total_avg ?? null,
    over45CornersForPct: o45ForPct,
    over45CornersForCount:
      periodMetricsData?.over_4_5_corners_for_count ??
      cornerStats?.over_4_5_corners_for_count ??
      cornerStats?.over_4_5_corners_for?.count ??
      0,
    over45CornersForTotal: cornerStats?.over_4_5_corners_for?.total ?? matchesPlayed,
    over55CornersForPct: o55ForPct,
    over55CornersForCount:
      periodMetricsData?.over_5_5_corners_for_count ??
      cornerStats?.over_5_5_corners_for_count ??
      cornerStats?.over_5_5_corners_for?.count ??
      0,
    over55CornersForTotal: cornerStats?.over_5_5_corners_for?.total ?? matchesPlayed,
    over85CornersPct: calcRoundedPct(o85?.count, o85?.total),
    over85CornersCount: o85?.count ?? 0,
    over85CornersTotal: o85?.total ?? 0,
    over95CornersPct: calcRoundedPct(o95?.count, o95?.total),
    over95CornersCount: o95?.count ?? 0,
    over95CornersTotal: o95?.total ?? 0,
    concededOver45Pct: pct45Conceded,
    concededOver45Count:
      o45Conceded?.count ?? cornerStats?.corners_conceded_over_4_5_count ?? 0,
    concededOver45Total: o45Conceded?.total ?? matchesPlayed,
    penaltiesAwarded:
      periodMetricsData?.penalties_awarded ?? periodMetricsData?.set_pieces?.penalties_awarded ?? 0,
    penaltiesScored:
      periodMetricsData?.penalties_scored ?? periodMetricsData?.set_pieces?.penalties_scored ?? 0,
    penaltiesConceded:
      periodMetricsData?.penalties_conceded ?? periodMetricsData?.set_pieces?.penalties_conceded ?? 0,
    setPieceGoals: spGoals,
    setPieceGoalsAvg: spGoalsScoredAvg,
    cornerGoals: periodMetricsData?.set_pieces?.corner_goals ?? 0,
    setPieceGoalsConceded: spGoalsConceded,
    setPieceGoalsConcededAvg: spGoalsConcededAvg,
    cornerGoalsConceded: periodMetricsData?.set_pieces?.corner_goals_conceded ?? 0,
    crossesAvailable: hasFsMatches,
    avgCrossesTotal: pAll?.avg_crosses_total ?? 0,
    avgCrossesCompleted: pAll?.avg_crosses_completed ?? 0,
    crossAccuracyPct: pAll?.cross_accuracy_pct ?? 0,
    headedGoals: pAll?.total_headed_goals ?? 0,
  };
}

/** Prepares Section 4 (Period Dynamics & Game States) report state. */
export function preparePeriodDynamicsReport(
  matchesPlayed: number,
  periodMetricsData?: TeamPeriodMetricsResponse
): PeriodDynamicsReport {
  const cornerStats = periodMetricsData?.corner_stats;
  const splits = periodMetricsData?.time_splits;
  const periods = periodMetricsData?.periods;
  const dynamics = periodMetricsData?.match_dynamics;

  const htWon = dynamics?.ht_won?.count ?? 0;
  const htTotal = dynamics?.ht_won?.total ?? 0;
  const btts = dynamics?.btts;
  const scored1st = dynamics?.scored_first;
  const conceded1st = dynamics?.conceded_first;
  const cleanSheets = dynamics?.clean_sheets;
  const failedToScore = dynamics?.failed_to_score;
  const earlyConceded = dynamics?.conceded_early_0_20;

  const ck1tVal =
    periodMetricsData?.corners_1t_avg ?? cornerStats?.corners_1t_avg ?? splits?.corners_1t_avg;
  const ck2tVal =
    periodMetricsData?.corners_2t_avg ?? cornerStats?.corners_2t_avg ?? splits?.corners_2t_avg;

  return {
    goals1T: splits?.goals_1t ?? 'N/D',
    goals2T: splits?.goals_2t ?? 'N/D',
    pctGoals2T: splits?.pct_goals_2t ?? 0,
    xg1T: formatNullableFixed(periods?.['1ST']?.avg_xg, 2),
    xg2T: formatNullableFixed(periods?.['2ND']?.avg_xg, 2),
    corners1T: formatNullableFixed(ck1tVal, 1),
    corners2T: formatNullableFixed(ck2tVal, 1),
    peakScoringInterval: splits?.peak_scoring_interval || 'N/D',
    bttsPct: calcRoundedPct(btts?.count, btts?.total),
    bttsCount: btts?.count ?? 0,
    bttsTotal: btts?.total ?? 0,
    cleanSheetsCount: cleanSheets?.count ?? 0,
    cleanSheetsTotal: cleanSheets?.total ?? htTotal,
    cleanSheetsPct:
      dynamics?.clean_sheets_pct ?? calcRoundedPct(cleanSheets?.count, cleanSheets?.total),
    failedToScoreCount: failedToScore?.count ?? 0,
    failedToScoreTotal: failedToScore?.total ?? htTotal,
    failedToScorePct:
      dynamics?.failed_to_score_pct ?? calcRoundedPct(failedToScore?.count, failedToScore?.total),
    earlyConcededCount: earlyConceded?.count ?? 0,
    earlyConcededTotal: earlyConceded?.total ?? htTotal,
    earlyConcededPct:
      dynamics?.conceded_early_0_20_pct ??
      calcRoundedPct(earlyConceded?.count, earlyConceded?.total),
    htWon,
    htDrawn: dynamics?.ht_drawn?.count ?? 0,
    htLost: dynamics?.ht_lost?.count ?? 0,
    htTotal: htTotal || matchesPlayed,
    scored1stCount: scored1st?.count ?? 0,
    scored1stTotal: scored1st?.total ?? 0,
    scored1stPct: calcRoundedPct(scored1st?.count, scored1st?.total),
    scored1stRecord: scored1st?.record || 'N/D',
    conceded1stCount: conceded1st?.count ?? 0,
    conceded1stTotal: conceded1st?.total ?? 0,
    conceded1stPct: calcRoundedPct(conceded1st?.count, conceded1st?.total),
    conceded1stRecord: conceded1st?.record || 'N/D',
  };
}

/** Prepares Section 5 (Discipline & Fouls) report state. */
export function prepareDisciplineReport(
  matchesPlayed: number,
  periodMetricsData?: TeamPeriodMetricsResponse
): DisciplineReport {
  const disc = periodMetricsData?.discipline_stats;
  const cardsTotalAvg = disc ? disc.cards_for_avg : 0;
  const redsAvg = disc ? disc.red_cards_avg ?? 0 : 0;
  const o35Cards = disc?.over_3_5_cards;
  const o45Cards = disc?.over_4_5_cards;

  return {
    yellowsAvg: Math.max(0, cardsTotalAvg - redsAvg),
    redsAvg,
    cardsTotalAvg,
    cardsForcedAvg: disc?.cards_forced_avg ?? null,
    cardsMatchTotalAvg: disc?.cards_match_total_avg ?? null,
    redCardsTotal: disc?.red_cards_total ?? 0,
    redCardsAvg: disc?.red_cards_avg ?? 0,
    cards2hPct: disc?.cards_2h_pct ?? 'N/D',
    over35CardsPct: calcRoundedPct(o35Cards?.count, o35Cards?.total),
    over35CardsCount: o35Cards?.count ?? 0,
    over35CardsTotal: o35Cards?.total ?? 0,
    over45CardsPct:
      periodMetricsData?.over_4_5_cards_pct ??
      disc?.over_4_5_cards_pct ??
      calcRoundedPct(o45Cards?.count, o45Cards?.total),
    over45CardsCount:
      periodMetricsData?.over_4_5_cards_count ??
      disc?.over_4_5_cards_count ??
      o45Cards?.count ??
      0,
    over45CardsTotal: o45Cards?.total ?? matchesPlayed,
    foulsCommittedAvg: disc?.fouls_committed_avg ?? null,
    foulsDrawnAvg: disc?.fouls_drawn_avg ?? null,
    foulsNetStr: formatFoulsNetBalance(
      (disc?.fouls_committed_avg ?? 0) - (disc?.fouls_drawn_avg ?? 0)
    ),
  };
}

/** Maps Most Used Starting XI rows for Section 6. */
export function prepareMostUsedXIPlayers(
  mostUsedXIData?: MostUsedXIResponse
): MostUsedXIReportPlayer[] {
  return (mostUsedXIData?.players || []).map((p) => {
    const slot = p.slot || '-';
    const isGK = slot === 'GK' || slot === 'G' || p.position_group === 'Goalkeeper';
    const rawYc = p.yellow_cards ?? 0;
    const rawRc = p.red_cards ?? 0;
    const { isEnCapilla, disciplineStr } = formatPlayerDiscipline(rawYc, rawRc);
    const setPieceRoles = p.set_piece_roles || [];

    return {
      slot,
      name: p.name || 'Desconocido',
      minutesSharePct: Math.round(p.minutes_share || p.minutes_pct || 0),
      age: p.age ?? '-',
      starts: p.starts ?? p.appearances ?? '-',
      ga: isGK ? '—' : p.g_plus_a ?? p.goals + p.assists,
      xg: isGK ? '—' : (p.xg ?? 0).toFixed(2),
      shotsP90: isGK ? '—' : (p.shots_p90 ?? 0).toFixed(1),
      foulsP90: isGK ? '—' : (p.fouls_p90 ?? 0).toFixed(1),
      yellowCards: rawYc,
      redCards: rawRc,
      isEnCapilla,
      disciplineStr,
      setPieceRoles,
      setPieceRolesStr: setPieceRoles.length > 0 ? setPieceRoles.join(', ') : '—',
      isGK,
      saves: p.saves,
      savesP90: p.saves_p90,
    };
  });
}

/** Maps Flashscore advanced goalkeeper & territorial metrics for Section 7. */
export function prepareFlashscoreReport(
  flashscoreSummary?: TeamFlashscoreSummaryResponse
): FlashscoreAdvancedReport | undefined {
  if (!flashscoreSummary || flashscoreSummary.matches_analyzed <= 0) {
    return undefined;
  }

  const pAll = flashscoreSummary.periods?.ALL;
  const p1T = flashscoreSummary.periods?.['1T'];
  const p2T = flashscoreSummary.periods?.['2T'];
  const gk = flashscoreSummary.goalkeeper_efficiency;

  const bigScored = pAll?.total_big_chances_scored ?? 0;
  const bigMissed = pAll?.total_big_chances_missed ?? 0;
  const bigTotal = pAll?.total_big_chances ?? bigScored + bigMissed;
  const bigConvPct =
    pAll?.big_chances_conversion_pct != null
      ? pAll.big_chances_conversion_pct
      : bigTotal > 0
      ? (bigScored * 100.0) / bigTotal
      : 0;

  const avgXgot = pAll?.avg_xgot ?? 0;
  const avgXg = pAll?.avg_xg ?? 0;

  return {
    available: true,
    avgTouchesBox: pAll?.avg_touches_in_box ?? 0,
    touches1T: p1T?.avg_touches_in_box ?? 0,
    touches2T: p2T?.avg_touches_in_box ?? 0,
    avgXgot,
    avgXg,
    deltaXgotXg: avgXgot - avgXg,
    avgP3: pAll?.avg_passes_final_third_completed ?? 0,
    p3_1T: p1T?.avg_passes_final_third_completed ?? 0,
    p3_2T: p2T?.avg_passes_final_third_completed ?? 0,
    bigScored,
    bigMissed,
    bigTotal,
    bigConvPct,
    goalsPrevented: gk?.goals_prevented ?? 0,
    preventedPerMatch: gk?.prevented_per_match ?? 0,
    xgotFaced: gk?.xgot_faced ?? 0,
    goalsConceded: gk?.goals_conceded ?? 0,
    netXg1T: (p1T?.avg_xg ?? 0) - (p1T?.avg_xg_conceded ?? 0),
    xgFav1T: p1T?.avg_xg ?? 0,
    xgCon1T: p1T?.avg_xg_conceded ?? 0,
    netXg2T: (p2T?.avg_xg ?? 0) - (p2T?.avg_xg_conceded ?? 0),
    xgFav2T: p2T?.avg_xg ?? 0,
    xgCon2T: p2T?.avg_xg_conceded ?? 0,
    possession1T: p1T?.avg_possession ?? 0,
    possession2T: p2T?.avg_possession ?? 0,
  };
}
