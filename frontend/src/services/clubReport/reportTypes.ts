import type {
  ContextFilter,
  MostUsedXIResponse,
  TeamFlashscoreSummaryResponse,
  TeamMatchItem,
  TeamMetricEntry,
  TeamPassNetworkResponse,
  TeamPeriodMetricsResponse,
  TeamShotMapResponse,
  VenueFilter,
} from '../api';

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
