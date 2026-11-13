import type {
  MostUsedXIResponse,
  TeamFlashscoreSummaryResponse,
  TeamPassNetworkResponse,
  TeamShotMapResponse,
} from '../../api';
import { formatSignedFixed } from '../reportFormatters';
import type { ClubReportData, ShotMapReport, ShotMapTopShooter } from '../reportTypes';

/** Extracts pass network summary metrics from API response for report state. */
export function preparePassNetworkSummary(
  passNetworkData?: TeamPassNetworkResponse,
  formation = '4-2-3-1'
): ClubReportData['passNetwork'] {
  const edgeCount = passNetworkData?.edges?.length || 0;
  const passVolume =
    passNetworkData?.edges?.reduce((acc, e) => acc + (e.pass_count || 0), 0) ||
    passNetworkData?.nodes?.reduce((acc, n) => acc + (n.total_passes || 0), 0) ||
    0;

  return {
    formation,
    edgeCount,
    passVolume,
  };
}

/** Aggregates spatial shot map volume, xG efficiency, post-impact, and top shooters. */
export function prepareShotMapReport(
  matchesPlayed: number,
  shotData?: TeamShotMapResponse,
  mostUsedXIData?: MostUsedXIResponse,
  flashscoreSummary?: TeamFlashscoreSummaryResponse
): ShotMapReport {
  const rawShots = shotData?.shots || [];
  const totalShots = rawShots.length;
  const goals = rawShots.filter((s) => s.result === 'goal').length;
  const saved = rawShots.filter((s) => s.result === 'saved').length;
  const totalXg = Math.round(rawShots.reduce((acc, s) => acc + s.xg, 0) * 100) / 100;
  const xgPerShot = totalShots > 0 ? totalXg / totalShots : 0;
  const shotsOnTarget = goals + saved;
  const onTargetPct = totalShots > 0 ? (shotsOnTarget / totalShots) * 100 : 0;
  const xgDelta = Math.round((goals - totalXg) * 100) / 100;
  const inBoxCount = rawShots.filter((s) => s.x >= 84.0 && s.y >= 20.0 && s.y <= 80.0).length;
  const pctInBox = totalShots > 0 ? Math.round((inBoxCount / totalShots) * 100) : 0;
  const shotsPerMatch = totalShots / (matchesPlayed || 1);

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

  const roleOrder: Record<string, number> = { PEN: 1, FK: 2, COR: 3 };
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

      const roleList = Array.from(d.roles).sort((a, b) => (roleOrder[a] || 9) - (roleOrder[b] || 9));
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

  const postImpact =
    hasFsMatches && pAll
      ? {
          avgXgot: pAll.avg_xgot ?? 0,
          avgXg: pAll.avg_xg ?? 0,
          deltaXgotXg: (pAll.avg_xgot ?? 0) - (pAll.avg_xg ?? 0),
        }
      : undefined;

  const bigScored = pAll?.total_big_chances_scored ?? 0;
  const bigMissed = pAll?.total_big_chances_missed ?? 0;
  const bigTotal = pAll?.total_big_chances ?? bigScored + bigMissed;
  const bigConvPct =
    pAll?.big_chances_conversion_pct != null
      ? pAll.big_chances_conversion_pct
      : bigTotal > 0
      ? (bigScored * 100.0) / bigTotal
      : 0;

  const bigChances =
    hasFsMatches && pAll
      ? {
          scored: bigScored,
          missed: bigMissed,
          convPct: bigConvPct,
        }
      : undefined;

  return {
    totalShots,
    shotsPerMatch,
    goals,
    xgDelta,
    totalXg,
    xgPerShot,
    shotsOnTarget,
    onTargetPct,
    pctInBox,
    inBoxCount,
    outBoxCount: totalShots - inBoxCount,
    topShooters,
    postImpact,
    bigChances,
  };
}

/** Builds Section 2 Markdown lines: Shots & Offensive xG Efficiency. */
export function buildShotMapSectionLines(data: ClubReportData): string[] {
  const sm = data.shotMap;
  const topShooterLines =
    sm.topShooters.length > 0
      ? sm.topShooters.map(
          (s, i) =>
            `  ${i + 1}. **${s.name}**: ${s.goals} goles | ${s.shots} remates | ${s.xg.toFixed(2)} xG`
        )
      : ['  - Sin rematadores registrados en la muestra activa.'];

  const postImpactLine = sm.postImpact
    ? `- **Calidad Post-Impacto:** ${sm.postImpact.avgXgot.toFixed(2)} xGOT vs ${sm.postImpact.avgXg.toFixed(2)} xG (${formatSignedFixed(sm.postImpact.deltaXgotXg, 2)} delta)`
    : null;

  const bigChancesLine = sm.bigChances
    ? `- **Grandes Ocasiones:** ${sm.bigChances.scored} convertidas / ${sm.bigChances.missed} falladas (${sm.bigChances.convPct.toFixed(1)}% efectividad)`
    : null;

  return [
    '### 2. REMATES & EFICIENCIA OFENSIVA (xG)',
    `- **Volumen Total:** ${sm.totalShots} remates analizados (${sm.shotsPerMatch.toFixed(1)} / pj)`,
    `- **Goles / Conversión:** ${sm.goals} goles anotados (${formatSignedFixed(sm.xgDelta, 2)} vs xG)`,
    `- **Peligro Esperado (xG):** ${sm.totalXg.toFixed(2)} xG acumulados`,
    `- **Calidad Media por Disparo:** ${sm.xgPerShot.toFixed(2)} xG / tiro`,
    ...(postImpactLine ? [postImpactLine] : []),
    ...(bigChancesLine ? [bigChancesLine] : []),
    `- **Efectividad a Puerta:** ${sm.onTargetPct.toFixed(1)}% (${sm.shotsOnTarget} disparos entre los tres palos)`,
    `- **Distribución Espacial:** ${sm.pctInBox}% dentro del área (${sm.inBoxCount}) | ${100 - sm.pctInBox}% fuera del área (${sm.outBoxCount})`,
    `- **Top Finalizadores:**`,
    ...topShooterLines,
  ];
}
