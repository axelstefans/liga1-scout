import type { PlayerSeasonStats } from '../services/api';
import type { ScoutingTranslations } from '../i18n/scoutingReport';
import type { RadarMetricDef } from '../components/scouting/scoutingTypes';
import {
  RADAR_CENTER_X,
  RADAR_CENTER_Y,
  RADAR_MAX_RADIUS,
  RADAR_LABEL_RADIUS,
} from '../components/scouting/scoutingConstants';

export interface RadarGeometryItem {
  metric: RadarMetricDef;
  pct: number;
  pathData: string;
  bgPathData: string;
  badgeX: number;
  badgeY: number;
  labelX: number;
  labelY: number;
  textAnchor: 'start' | 'end' | 'middle';
  rOuter: number;
  formattedValue: string;
  ray: { x1: number; y1: number; x2: number; y2: number };
}

export function getSplitMetricLabel(
  metricKey: string,
  fallbackLabel: string,
  t?: ScoutingTranslations
): [string, string | null] {
  const translatedSplit = t?.metrics?.[metricKey]?.radarSplit;
  if (translatedSplit) {
    return translatedSplit;
  }
  const parts = fallbackLabel.split(' ');
  if (parts.length > 1) {
    return [parts[0], parts.slice(1).join(' ')];
  }
  return [fallbackLabel, null];
}

export function computeRadarGeometry(
  activeMetrics: RadarMetricDef[],
  seasonStats?: PlayerSeasonStats | null
): RadarGeometryItem[] {
  const numSlices = activeMetrics.length;
  if (numSlices === 0) return [];

  const angleStep = (2 * Math.PI) / numSlices;
  const cx = RADAR_CENTER_X;
  const cy = RADAR_CENTER_Y;
  const rMin = 0;
  const rMax = RADAR_MAX_RADIUS;
  const rLabel = RADAR_LABEL_RADIUS;

  const minutes = seasonStats?.minutes_played || 1;

  return activeMetrics.map((metric, i) => {
    // Rotate so 0th wedge starts at -PI/2 (12 o'clock)
    const thetaStart = -Math.PI / 2 + i * angleStep;
    const thetaEnd = thetaStart + angleStep;
    const thetaMid = (thetaStart + thetaEnd) / 2;

    // Extract percentile from seasonStats
    let rawPct = seasonStats ? (seasonStats[metric.pctKey] as number | undefined | null) : null;
    if ((rawPct === null || rawPct === undefined) && metric.key === 'expected_goals') {
      rawPct = seasonStats?.expected_goals_pct ?? 50;
    }
    const pct = typeof rawPct === 'number' && !isNaN(rawPct) ? Math.max(8, Math.min(100, rawPct)) : 50;

    // Full background wedge to rMax (252px)
    const bgX1 = cx + rMax * Math.cos(thetaStart);
    const bgY1 = cy + rMax * Math.sin(thetaStart);
    const bgX2 = cx + rMax * Math.cos(thetaEnd);
    const bgY2 = cy + rMax * Math.sin(thetaEnd);
    const bgPathData = `M ${cx} ${cy} L ${bgX1} ${bgY1} A ${rMax} ${rMax} 0 0 1 ${bgX2} ${bgY2} Z`;

    // Player wedge proportional to percentile
    const rOuter = (pct / 100) * rMax;
    const x1 = cx + rOuter * Math.cos(thetaStart);
    const y1 = cy + rOuter * Math.sin(thetaStart);
    const x2 = cx + rOuter * Math.cos(thetaEnd);
    const y2 = cy + rOuter * Math.sin(thetaEnd);
    const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} Z`;

    // Value calculation
    let rawVal = seasonStats ? (seasonStats[metric.key as keyof PlayerSeasonStats] as number | undefined | null) : null;
    if ((rawVal === null || rawVal === undefined) && metric.key === 'expected_goals') {
      rawVal = seasonStats?.expected_goals ?? 0;
    }
    const formattedValue = metric.isPercentage
      ? `${(rawVal ?? 0).toFixed(1)}%`
      : (((rawVal ?? 0) / minutes) * 90).toFixed(2);

    // Value badge anchor position directly at the edge of the player's wedge
    const badgeX = cx + rOuter * Math.cos(thetaMid);
    const badgeY = cy + rOuter * Math.sin(thetaMid);

    // Peripheral label position strictly outside at rLabel = 307
    const labelX = cx + rLabel * Math.cos(thetaMid);
    const labelY = cy + rLabel * Math.sin(thetaMid);

    // Determine textAnchor based on horizontal position relative to cx:
    const dx = labelX - cx;
    const textAnchor: 'start' | 'end' | 'middle' =
      Math.abs(dx) < 25 ? 'middle' : dx > 0 ? 'start' : 'end';

    // Radial divider ray projecting from rMin to rMax
    const rayX1 = cx + rMin * Math.cos(thetaStart);
    const rayY1 = cy + rMin * Math.sin(thetaStart);
    const rayX2 = cx + rMax * Math.cos(thetaStart);
    const rayY2 = cy + rMax * Math.sin(thetaStart);

    return {
      metric,
      pct: Math.round(pct),
      pathData,
      bgPathData,
      badgeX,
      badgeY,
      labelX,
      labelY,
      textAnchor,
      rOuter,
      formattedValue,
      ray: { x1: rayX1, y1: rayY1, x2: rayX2, y2: rayY2 },
    };
  });
}
