import type {
  PlayerProfile,
  PlayerSeasonStats,
  PlayerRankingEntry,
  SimilarPlayer,
  PlayerDefendingStats,
} from '../../../services/api';
import type { ScoutingTranslations } from '../../../i18n/scoutingReport';
import type {
  BeeswarmPoint,
  BeeswarmTick,
  BeeswarmStripData,
  ScatterPoint,
} from './scoutingFloor03Utils';
import {
  AVAILABLE_METRICS,
  VOLUME_STAT_KEYS,
  TOP_6_CLUBS,
  LIMA_CLUBS,
  ALTITUDE_CLUBS,
  PHOTO_PEERS_COUNT,
} from '../scoutingConstants';
import {
  calculateAge,
  resolvePlayerAge,
  hexToRgb,
  generateNiceTicks,
  formatScatterTickLabel,
} from '../../../utils/scoutingUtils';

const SCATTER_PLOT_LEFT = 36;
const SCATTER_PLOT_TOP = 14;
const SCATTER_PLOT_WIDTH = 308;
const SCATTER_PLOT_HEIGHT = 222;
const SCATTER_PLOT_BOTTOM = SCATTER_PLOT_TOP + SCATTER_PLOT_HEIGHT; // 236

export interface DefendingGridResult {
  defendingGrid: number[][];
  totalDefendingActions: number;
  tacklesCount: number;
  recoveriesCount: number;
  aerialCount: number;
}

export function computeDefendingGrid(
  defendingData?: PlayerDefendingStats | null,
  seasonStats?: PlayerSeasonStats | null
): DefendingGridResult {
  const defensiveActionsList =
    defendingData?.defensive_actions?.filter((a) => a.x != null && a.y != null) || [];

  const numDefCols = 5;
  const numDefRows = 6;
  const grid = Array.from({ length: numDefRows }, () => Array(numDefCols).fill(0));
  let validCount = 0;

  defensiveActionsList.forEach((action) => {
    if (action.x != null && action.y != null) {
      validCount++;
      // Invert lateral coordinate: raw_y = 100 is left flank -> column 0
      const col = Math.min(
        numDefCols - 1,
        Math.max(0, Math.floor(((100 - action.y) / 100) * numDefCols))
      );
      // Longitudinal: raw_x = 0 is defensive goal at bottom (row 5), 100 is attacking goal at top (row 0)
      const row = Math.min(
        numDefRows - 1,
        Math.max(0, Math.floor(((100 - action.x) / 100) * numDefRows))
      );
      grid[row][col]++;
    }
  });

  const defendingGrid =
    validCount === 0
      ? [
          [0, 1, 0, 0, 0],
          [5, 2, 1, 1, 1],
          [10, 11, 1, 1, 1],
          [22, 16, 0, 3, 8],
          [39, 37, 9, 5, 5],
          [15, 11, 9, 8, 2],
        ]
      : grid;

  const totalDefendingActions = defensiveActionsList.length || 224;
  const tacklesCount =
    defensiveActionsList.filter((a) => a.action_type === 'tackle').length ||
    (seasonStats?.tackles ?? 42);
  const recoveriesCount =
    defensiveActionsList.filter((a) => a.action_type === 'ball-recovery').length || 151;
  const aerialCount = seasonStats?.aerial_duels_won ?? 23;

  return {
    defendingGrid,
    totalDefendingActions,
    tacklesCount,
    recoveriesCount,
    aerialCount,
  };
}

export function getDefendingCellFillColor(count: number, clubThemeColor: string): string {
  if (count <= 0) return 'transparent';
  const { r, g, b } = hexToRgb(clubThemeColor);
  let alpha = 0.16;
  if (count > 30) alpha = 0.95;
  else if (count > 20) alpha = 0.75;
  else if (count > 10) alpha = 0.5;
  else if (count > 4) alpha = 0.32;
  else alpha = 0.18;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface Floor03CohortFilterContext {
  playerId: number;
  profile: PlayerProfile | undefined;
  seasonStats: PlayerSeasonStats | undefined;
  similarPlayers: SimilarPlayer[] | undefined;
  similarPlayersMap: Map<number, SimilarPlayer>;
  selectedPositionGroup: string;
  excludedTeamNames: Set<string>;
  minAge: number;
  maxAge: number;
  benchmarkMode: 'all' | 'own' | 'target';
  targetGroup: string;
  t: ScoutingTranslations;
}

export interface BuildScatterPlotDataParams extends Floor03CohortFilterContext {
  xRankings: PlayerRankingEntry[] | undefined;
  yRankings: PlayerRankingEntry[] | undefined;
  scatterMetricX: string;
  scatterMetricY: string;
}

export interface ScatterPlotProcessedResult {
  rawScatterPoints: Omit<ScatterPoint, 'svgX' | 'svgY'>[];
  points: ScatterPoint[];
  peerPoints: ScatterPoint[];
  targetPoint: ScatterPoint | null;
  topOutliers: ScatterPoint[];
  highlightedPeerPoints: ScatterPoint[];
  backgroundPeerPoints: ScatterPoint[];
  minX: number;
  maxX: number;
  medianX: number;
  minY: number;
  maxY: number;
  medianY: number;
  medSvgX: number;
  medSvgY: number;
  xTicks: number[];
  yTicks: number[];
  xStep: number;
  yStep: number;
  metricXLabel: string;
  metricYLabel: string;
}

export function buildScatterPlotData(
  params: BuildScatterPlotDataParams
): ScatterPlotProcessedResult {
  const {
    xRankings,
    yRankings,
    scatterMetricX,
    scatterMetricY,
    playerId,
    profile,
    seasonStats,
    similarPlayers,
    similarPlayersMap,
    selectedPositionGroup,
    excludedTeamNames,
    minAge,
    maxAge,
    benchmarkMode,
    targetGroup,
    t,
  } = params;

  const metricXDef = AVAILABLE_METRICS.find((m) => m.key === scatterMetricX);
  const metricYDef = AVAILABLE_METRICS.find((m) => m.key === scatterMetricY);
  const metricXLabel = t.metrics[scatterMetricX]?.long || metricXDef?.label || scatterMetricX;
  const metricYLabel = t.metrics[scatterMetricY]?.long || metricYDef?.label || scatterMetricY;

  const yMap = new Map<number, { val: number; entry: PlayerRankingEntry }>();
  if (yRankings) {
    yRankings.forEach((item) => {
      const num = Number(item.value);
      if (!isNaN(num)) {
        yMap.set(item.player_id, { val: num, entry: item });
      }
    });
  }

  const rawScatterPoints: Omit<ScatterPoint, 'svgX' | 'svgY'>[] = [];

  if (xRankings && yRankings) {
    xRankings.forEach((itemX) => {
      const xVal = Number(itemX.value);
      const yObj = yMap.get(itemX.player_id);
      if (isNaN(xVal) || !yObj) return;

      const yVal = yObj.val;
      const minutes = itemX.minutes_played ?? yObj.entry.minutes_played ?? 0;
      if (minutes < 300) return;

      const posGroup = itemX.position_group || yObj.entry.position_group;
      if (
        selectedPositionGroup &&
        selectedPositionGroup !== 'All Positions' &&
        posGroup &&
        posGroup !== selectedPositionGroup
      ) {
        return;
      }

      const isTarget = itemX.player_id === playerId;
      const simMatch = similarPlayersMap.get(itemX.player_id);
      const computedAge =
        isTarget && profile
          ? calculateAge(profile.date_of_birth)
          : resolvePlayerAge(itemX) ?? resolvePlayerAge(yObj.entry) ?? resolvePlayerAge(simMatch);

      if (!isTarget) {
        const teamLower = (itemX.team_name || '').toLowerCase();

        if (excludedTeamNames.has(teamLower)) return;
        if (computedAge !== null && (computedAge < minAge || computedAge > maxAge)) return;

        if (benchmarkMode === 'own') {
          const myTeam = (profile?.team?.name || '').toLowerCase();
          if (myTeam && !teamLower.includes(myTeam) && !myTeam.includes(teamLower)) return;
        } else if (benchmarkMode === 'target') {
          if (targetGroup === 'top6' && !TOP_6_CLUBS.has(teamLower)) return;
          if (targetGroup === 'lima' && !LIMA_CLUBS.has(teamLower)) return;
          if (targetGroup === 'altitude' && !ALTITUDE_CLUBS.has(teamLower)) return;
          if (targetGroup === 'provincial' && LIMA_CLUBS.has(teamLower)) return;
        }
      }

      rawScatterPoints.push({
        player_id: itemX.player_id,
        name: itemX.name,
        team_name: itemX.team_name,
        position: itemX.position || yObj.entry.position,
        position_group: posGroup,
        minutes_played: minutes,
        x: xVal,
        y: yVal,
        isTarget,
        age: computedAge,
      });
    });

    const targetInList = rawScatterPoints.some((p) => p.player_id === playerId);
    if (!targetInList && profile && seasonStats) {
      let rawX = Number((seasonStats as any)[scatterMetricX]);
      let rawY = Number((seasonStats as any)[scatterMetricY]);
      const min = seasonStats.minutes_played || 0;
      if (!isNaN(rawX) && !isNaN(rawY)) {
        if (min > 0) {
          if (VOLUME_STAT_KEYS.has(scatterMetricX)) rawX = Number(((rawX / min) * 90).toFixed(2));
          if (VOLUME_STAT_KEYS.has(scatterMetricY)) rawY = Number(((rawY / min) * 90).toFixed(2));
        }
        rawScatterPoints.push({
          player_id: playerId,
          name: profile.name,
          team_name: profile.team?.name || 'Alianza Lima',
          position: profile.position,
          position_group: profile.position_group,
          minutes_played: min,
          x: rawX,
          y: rawY,
          isTarget: true,
          age: calculateAge(profile.date_of_birth),
        });
      }
    }
  }

  let points: ScatterPoint[] = [];
  let peerPoints: ScatterPoint[] = [];
  let targetPoint: ScatterPoint | null = null;
  let topOutliers: ScatterPoint[] = [];
  let minX = 0;
  let maxX = 100;
  let medianX = 50;
  let minY = 0;
  let maxY = 100;
  let medianY = 50;
  let medSvgX = 190;
  let medSvgY = 125;

  if (rawScatterPoints.length > 0) {
    const xVals = rawScatterPoints.map((p) => p.x).sort((a, b) => a - b);
    const yVals = rawScatterPoints.map((p) => p.y).sort((a, b) => a - b);

    const getMedian = (sorted: number[]) => {
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    minX = xVals[0];
    maxX = xVals[xVals.length - 1];
    minY = yVals[0];
    maxY = yVals[yVals.length - 1];

    if (minX === maxX) {
      minX -= 1;
      maxX += 1;
    }
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }

    const padX = (maxX - minX) * 0.08;
    const padY = (maxY - minY) * 0.08;
    minX = Math.max(0, minX - padX);
    maxX += padX;
    minY = Math.max(0, minY - padY);
    maxY += padY;

    medianX = getMedian(xVals);
    medianY = getMedian(yVals);

    const mapSvgX = (val: number) =>
      SCATTER_PLOT_LEFT + ((val - minX) / (maxX - minX || 1)) * SCATTER_PLOT_WIDTH;
    const mapSvgY = (val: number) =>
      SCATTER_PLOT_BOTTOM - ((val - minY) / (maxY - minY || 1)) * SCATTER_PLOT_HEIGHT;

    points = rawScatterPoints.map((p) => ({
      ...p,
      svgX: mapSvgX(p.x),
      svgY: mapSvgY(p.y),
    }));

    peerPoints = points.filter((p) => !p.isTarget);
    targetPoint = points.find((p) => p.isTarget) || null;
    medSvgX = mapSvgX(medianX);
    medSvgY = mapSvgY(medianY);

    topOutliers = peerPoints
      .filter((p) => p.x > medianX && p.y > medianY)
      .sort((a, b) => {
        const scoreA =
          (a.x - medianX) / (maxX - medianX || 1) + (a.y - medianY) / (maxY - medianY || 1);
        const scoreB =
          (b.x - medianX) / (maxX - medianX || 1) + (b.y - medianY) / (maxY - medianY || 1);
        return scoreB - scoreA;
      })
      .slice(0, 3);
  }

  const highlightedPeerPoints: ScatterPoint[] = [];
  const usedIds = new Set<number>();

  if (similarPlayers && similarPlayers.length > 0) {
    for (const sp of similarPlayers) {
      if (highlightedPeerPoints.length >= PHOTO_PEERS_COUNT) break;
      const found = peerPoints.find((p) => p.player_id === sp.player_id);
      if (found && !usedIds.has(found.player_id)) {
        usedIds.add(found.player_id);
        highlightedPeerPoints.push(found);
      }
    }
  }

  if (highlightedPeerPoints.length < PHOTO_PEERS_COUNT) {
    for (const out of topOutliers) {
      if (highlightedPeerPoints.length >= PHOTO_PEERS_COUNT) break;
      if (!usedIds.has(out.player_id)) {
        usedIds.add(out.player_id);
        highlightedPeerPoints.push(out);
      }
    }
  }

  const highlightedIds = new Set(highlightedPeerPoints.map((p) => p.player_id));
  const backgroundPeerPoints = peerPoints.filter((p) => !highlightedIds.has(p.player_id));

  const xTicks = generateNiceTicks(minX, maxX, 5).filter(
    (tick) => tick >= minX - 1e-6 && tick <= maxX + 1e-6
  );
  const yTicks = generateNiceTicks(minY, maxY, 5).filter(
    (tick) => tick >= minY - 1e-6 && tick <= maxY + 1e-6
  );

  const xStep = xTicks.length >= 2 ? Math.abs(xTicks[1] - xTicks[0]) : 1;
  const yStep = yTicks.length >= 2 ? Math.abs(yTicks[1] - yTicks[0]) : 1;

  return {
    rawScatterPoints,
    points,
    peerPoints,
    targetPoint,
    topOutliers,
    highlightedPeerPoints,
    backgroundPeerPoints,
    minX,
    maxX,
    medianX,
    minY,
    maxY,
    medianY,
    medSvgX,
    medSvgY,
    xTicks,
    yTicks,
    xStep,
    yStep,
    metricXLabel,
    metricYLabel,
  };
}

export function computeBeeswarmStrip(
  metricKey: string,
  rankings: PlayerRankingEntry[] | undefined,
  ctx: Floor03CohortFilterContext,
  opts?: { calibrated?: boolean }
): BeeswarmStripData {
  const {
    playerId,
    profile,
    seasonStats,
    similarPlayersMap,
    selectedPositionGroup,
    excludedTeamNames,
    minAge,
    maxAge,
    benchmarkMode,
    targetGroup,
    t,
  } = ctx;

  const isCalibrated = opts?.calibrated ?? false;
  const metricLabels: Record<string, string> = {
    key_passes: 'Key Passes',
    accurate_final_third_passes: 'Final 3rd Passes',
    successful_dribbles: 'Completed Dribbles',
  };
  const metricDef = AVAILABLE_METRICS.find((m) => m.key === metricKey);
  const label =
    t.metrics[metricKey]?.long ||
    metricLabels[metricKey] ||
    metricDef?.label ||
    metricKey.replace(/_/g, ' ');

  if (!rankings || rankings.length === 0) {
    return {
      key: metricKey,
      label,
      minVal: 0,
      maxVal: 100,
      medianVal: 50,
      p25Val: 25,
      p75Val: 75,
      targetVal: null,
      percentile: 50,
      points: [],
      targetPoint: null,
      calibrated: isCalibrated,
    };
  }

  const rawPoints: {
    player_id: number;
    name: string;
    team_name: string;
    position?: string | null;
    position_group?: string | null;
    minutes_played?: number | null;
    age?: number | null;
    val: number;
    isTarget: boolean;
  }[] = [];

  rankings.forEach((item) => {
    const val = Number(item.value);
    if (isNaN(val)) return;
    const minutes = item.minutes_played ?? 0;
    if (minutes < 300) return;

    if (
      benchmarkMode !== 'all' &&
      selectedPositionGroup &&
      selectedPositionGroup !== 'All Positions' &&
      item.position_group &&
      item.position_group !== selectedPositionGroup
    ) {
      return;
    }

    const isTarget = item.player_id === playerId;
    const simMatch = similarPlayersMap.get(item.player_id);
    const computedAge =
      isTarget && profile
        ? calculateAge(profile.date_of_birth)
        : resolvePlayerAge(item) ?? resolvePlayerAge(simMatch);

    if (!isTarget) {
      const teamLower = (item.team_name || '').toLowerCase();

      if (excludedTeamNames.has(teamLower)) return;

      if (
        selectedPositionGroup &&
        selectedPositionGroup !== 'All Positions' &&
        item.position_group &&
        item.position_group !== selectedPositionGroup
      ) {
        return;
      }

      if (computedAge !== null && (computedAge < minAge || computedAge > maxAge)) return;

      if (benchmarkMode === 'own') {
        const myTeam = (profile?.team?.name || '').toLowerCase();
        if (myTeam && !teamLower.includes(myTeam) && !myTeam.includes(teamLower)) return;
      } else if (benchmarkMode === 'target') {
        if (targetGroup === 'top6' && !TOP_6_CLUBS.has(teamLower)) return;
        if (targetGroup === 'lima' && !LIMA_CLUBS.has(teamLower)) return;
        if (targetGroup === 'altitude' && !ALTITUDE_CLUBS.has(teamLower)) return;
        if (targetGroup === 'provincial' && LIMA_CLUBS.has(teamLower)) return;
      }
    }

    rawPoints.push({
      player_id: item.player_id,
      name: item.name,
      team_name: item.team_name,
      position: item.position || item.position_group,
      position_group: item.position_group,
      minutes_played: item.minutes_played,
      age: computedAge,
      val,
      isTarget,
    });
  });

  const targetInList = rawPoints.some((p) => p.player_id === playerId);
  let targetVal: number | null = targetInList
    ? rawPoints.find((p) => p.player_id === playerId)!.val
    : null;

  if (!targetInList && profile && seasonStats) {
    let rawTarget = Number((seasonStats as any)[metricKey]);
    const min = seasonStats.minutes_played || 0;
    if (!isNaN(rawTarget)) {
      if (VOLUME_STAT_KEYS.has(metricKey) && min > 0) {
        rawTarget = Number(((rawTarget / min) * 90).toFixed(2));
      }
      targetVal = rawTarget;
      rawPoints.push({
        player_id: playerId,
        name: profile.name,
        team_name: profile.team?.name || 'Alianza Lima',
        position: profile.position || profile.position_group,
        position_group: profile.position_group,
        minutes_played: min,
        age: calculateAge(profile.date_of_birth),
        val: rawTarget,
        isTarget: true,
      });
    }
  }

  if (rawPoints.length === 0) {
    return {
      key: metricKey,
      label,
      minVal: 0,
      maxVal: 100,
      medianVal: 50,
      p25Val: 25,
      p75Val: 75,
      targetVal,
      percentile: 50,
      points: [],
      targetPoint: null,
      calibrated: isCalibrated,
    };
  }

  const sortedVals = rawPoints.map((p) => p.val).sort((a, b) => a - b);
  let minVal = sortedVals[0];
  let maxVal = sortedVals[sortedVals.length - 1];

  if (minVal === maxVal) {
    minVal = Math.max(0, minVal - 1);
    maxVal += 1;
  }

  const rawRange = maxVal - minVal || 1;
  const domainMin = isCalibrated ? minVal - 0.05 * rawRange : minVal;
  const domainMax = isCalibrated ? maxVal + 0.05 * rawRange : maxVal;
  const domainRange = domainMax - domainMin || 1;

  const getPctVal = (pct: number) => {
    const idx = Math.min(sortedVals.length - 1, Math.max(0, Math.floor(sortedVals.length * pct)));
    return sortedVals[idx];
  };

  const p25Val = getPctVal(0.25);
  const medianVal = getPctVal(0.5);
  const p75Val = getPctVal(0.75);

  const getPercentile = (val: number) => {
    if (sortedVals.length === 0) return 50;
    const below = sortedVals.filter((v) => v <= val).length;
    return Math.max(1, Math.min(99, Math.round((below / sortedVals.length) * 100)));
  };

  let percentile = 50;
  if (targetVal !== null && sortedVals.length > 0) {
    percentile = getPercentile(targetVal);
  }
  const pctFromSeason = seasonStats ? Number((seasonStats as any)[`${metricKey}_pct`]) : null;
  if (!isNaN(Number(pctFromSeason)) && pctFromSeason !== null && pctFromSeason > 0) {
    percentile = Math.round(Number(pctFromSeason));
  }

  const SWARM_LEFT = 18;
  const SWARM_WIDTH = 284;

  const points: BeeswarmPoint[] = rawPoints.map((p) => {
    const norm = isCalibrated
      ? (p.val - domainMin) / domainRange
      : (p.val - minVal) / (maxVal - minVal || 1);
    const svgX = SWARM_LEFT + Math.max(0, Math.min(1, norm)) * SWARM_WIDTH;
    const svgY = isCalibrated ? 39 : 18;

    const ptPercentile = p.isTarget ? percentile : getPercentile(p.val);

    return {
      ...p,
      svgX,
      svgY,
      percentile: ptPercentile,
    };
  });

  const targetPoint = points.find((p) => p.isTarget) || null;

  let calibratedTicks: BeeswarmTick[] | undefined = undefined;
  if (isCalibrated) {
    const roundVals = generateNiceTicks(domainMin, domainMax, 6);
    const tickStep = roundVals.length >= 2 ? Math.abs(roundVals[1] - roundVals[0]) : 1;
    calibratedTicks = roundVals.map((val) => {
      const norm = (val - domainMin) / domainRange;
      const x = SWARM_LEFT + Math.max(0, Math.min(1, norm)) * SWARM_WIDTH;
      const labelStr = formatScatterTickLabel(val, tickStep);
      return { val, x, label: labelStr };
    });
  }

  return {
    key: metricKey,
    label,
    minVal,
    maxVal,
    domainMin,
    domainMax,
    medianVal,
    p25Val,
    p75Val,
    targetVal,
    percentile,
    points,
    targetPoint,
    ticks: calibratedTicks,
    calibrated: isCalibrated,
  };
}

export interface BuildBeeswarmStripsParams extends Floor03CohortFilterContext {
  beeswarmMetric1: string;
  beeswarmMetric2: string;
  beeswarmMetric3: string;
  b1Rankings: PlayerRankingEntry[] | undefined;
  b2Rankings: PlayerRankingEntry[] | undefined;
  b3Rankings: PlayerRankingEntry[] | undefined;
}

export function buildBeeswarmStripsData(
  params: BuildBeeswarmStripsParams
): [BeeswarmStripData, BeeswarmStripData, BeeswarmStripData] {
  const {
    beeswarmMetric1,
    beeswarmMetric2,
    beeswarmMetric3,
    b1Rankings,
    b2Rankings,
    b3Rankings,
    ...ctx
  } = params;

  return [
    computeBeeswarmStrip(beeswarmMetric1, b1Rankings, ctx, { calibrated: true }),
    computeBeeswarmStrip(beeswarmMetric2, b2Rankings, ctx, { calibrated: true }),
    computeBeeswarmStrip(beeswarmMetric3, b3Rankings, ctx, { calibrated: true }),
  ];
}

export function getTopStripPeers(
  strip: BeeswarmStripData,
  similarPlayers?: SimilarPlayer[]
): BeeswarmPoint[] {
  const selected: BeeswarmPoint[] = [];
  const usedIds = new Set<number>();

  if (similarPlayers && similarPlayers.length > 0) {
    for (const sp of similarPlayers) {
      if (selected.length >= PHOTO_PEERS_COUNT) break;
      const found = strip.points.find((p) => p.player_id === sp.player_id && !p.isTarget);
      if (found && !usedIds.has(found.player_id)) {
        usedIds.add(found.player_id);
        selected.push(found);
      }
    }
  }

  if (selected.length < PHOTO_PEERS_COUNT) {
    const sortedPeers = [...strip.points.filter((p) => !p.isTarget)].sort((a, b) => b.val - a.val);
    for (const p of sortedPeers) {
      if (selected.length >= PHOTO_PEERS_COUNT) break;
      if (!usedIds.has(p.player_id)) {
        usedIds.add(p.player_id);
        selected.push(p);
      }
    }
  }

  return selected;
}
