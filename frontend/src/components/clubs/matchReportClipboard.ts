import {
  MatchSheet03DataHubResponse,
  PlayerMatchPerformance,
  CardIncident,
  DataHubMetricRow,
} from '../../services/api';

/**
 * Truncates or formats long player names for fixed-width text export.
 */
function formatPlayerName(name: string, maxLen: number = 20): string {
  if (!name) return 'N/A';
  if (name.length <= maxLen) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    const abbr = `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
    if (abbr.length <= maxLen) return abbr;
    return abbr.slice(0, maxLen - 1) + '…';
  }
  return name.slice(0, maxLen - 1) + '…';
}

/**
 * Standardizes card labels for plain text export.
 */
function getCardLabel(cardType: string, isEs: boolean): string {
  const ct = (cardType || '').toLowerCase();
  if (ct.includes('red') || ct === 'red' || ct === 'yellowred' || ct === 'secondyellow') {
    return isEs ? 'ROJA' : 'RED';
  }
  return isEs ? 'AMARILLA' : 'YELLOW';
}

/**
 * Helper to extract metric values from DataHubMetricRow lists.
 */
function getMetricRow(metrics: DataHubMetricRow[] = [], key: string): DataHubMetricRow | undefined {
  return metrics.find((m) => m.key === key);
}

/**
 * Sanitizes numeric or string values into clean display strings, replacing
 * empty, null, undefined or phantom unmeasured zeros with "N/D".
 */
function sanitizeDisplay(
  val: number | string | null | undefined,
  fallback: string = 'N/D'
): string {
  if (val === null || val === undefined || val === '' || val === '-' || val === 'N/A') {
    return fallback;
  }
  if (typeof val === 'number') {
    if (Number.isNaN(val)) return fallback;
    return String(val);
  }
  return String(val).trim();
}

/**
 * Formats an individual player row with all performance columns,
 * including FAL/REC (fouls / was_fouled) and TAR (🟨 37' / 🟥 82').
 */
function formatPlayerRow(
  p: PlayerMatchPerformance,
  cardIncidents: CardIncident[] = [],
  isEs: boolean = true
): string {
  const dor = p.jersey_number != null ? String(p.jersey_number) : '-';
  const name = formatPlayerName(p.name || 'N/A', 20);
  const pos = (p.position || 'N/A').trim().slice(0, 3);
  const mins = `${p.minutes_played}'`;
  const rat = p.sofascore_rating != null ? p.sofascore_rating.toFixed(1) : '-';
  const g = String(p.goals ?? 0);
  const a = String(p.assists ?? 0);
  const xg = p.calculated_xg != null ? p.calculated_xg.toFixed(2) : '0.00';

  // Tiros: tot(sot)
  const tot = p.total_shots;
  const sot = p.shots_on_target;
  let sh = '-';
  if (tot === 0) {
    sh = '0';
  } else if (tot != null && tot > 0) {
    sh = sot != null ? `${tot}(${sot})` : `${tot}(-)`;
  }

  // Pases: comp (pct%)
  const pComp = p.passes_completed ?? 0;
  const pTot = p.passes_total ?? 0;
  const pct = p.accurate_passes_pct;
  let pas = '-';
  if (pTot > 0 && pComp > 0) {
    const pctVal = pct != null ? Math.round(pct) : Math.round((pComp * 100) / pTot);
    pas = `${pComp} (${pctVal}%)`;
  } else if (pTot > 0 && pComp === 0) {
    pas = '0 (0%)';
  } else if (pComp > 0) {
    pas = String(pComp);
  }

  // Recuperaciones / Entradas
  const recEnt = `${p.recoveries ?? 0}/${p.tackles ?? 0}`;

  // Faltas cometidas / Faltas recibidas (FAL/REC)
  const falRec = `${p.fouls ?? 0}/${p.was_fouled ?? 0}`;

  // Distintivo de tarjetas recibidas en el partido (TAR)
  const playerCards = cardIncidents.filter((c) => c.player_id === p.player_id);
  let tar = '-';
  if (playerCards.length > 0) {
    tar = playerCards
      .map((c) => {
        const isRed = (c.card_type || '').toLowerCase().includes('red');
        const icon = isRed ? '🟥' : '🟨';
        const m = c.minute_display || (c.extra_minute ? `${c.minute}+${c.extra_minute}'` : `${c.minute}'`);
        return `${icon} ${m}`;
      })
      .join(' ');
  }

  // Sufijo si es portero
  const isGk = pos.toUpperCase().includes('GK') || pos.toUpperCase() === 'G';
  let gkSuffix = '';
  if (isGk) {
    const s = p.saves;
    if (s == null) {
      gkSuffix = isEs ? '  [- Paradas]' : '  [- Saves]';
    } else if (s === 1) {
      gkSuffix = isEs ? '  [1 Parada]' : '  [1 Save]';
    } else {
      gkSuffix = isEs ? `  [${s} Paradas]` : `  [${s} Saves]`;
    }
  }

  return (
    `${dor.padStart(3, ' ')}  ` +
    `${name.padEnd(20, ' ')}  ` +
    `${pos.padEnd(3, ' ')}  ` +
    `${mins.padStart(4, ' ')}  ` +
    `${rat.padStart(4, ' ')}  ` +
    `${g.padStart(2, ' ')}  ` +
    `${a.padStart(2, ' ')}  ` +
    `${xg.padStart(5, ' ')}  ` +
    `${sh.padStart(5, ' ')}  ` +
    `${pas.padStart(9, ' ')}  ` +
    `${recEnt.padStart(7, ' ')}  ` +
    `${falRec.padStart(7, ' ')}  ` +
    `${tar}` +
    `${gkSuffix}`
  );
}

/**
 * Formats a player table section (starters + substitutes) for a team.
 */
function formatTeamPlayerSection(
  players: PlayerMatchPerformance[],
  teamName: string,
  roleLabel: string,
  cardIncidents: CardIncident[] = [],
  isEs: boolean = true
): string[] {
  const sep92 = '='.repeat(92);
  const header = `DOR  JUGADOR               POS   MIN   RAT   G   A     xG  TIROS   PASES(%)  REC/ENT  FAL/REC  TAR`;

  const starters = players.filter((p) => !p.was_substitute);
  const subs = players.filter((p) => p.was_substitute);

  const lines: string[] = [
    sep92,
    `${isEs ? 'RENDIMIENTO INDIVIDUAL' : 'INDIVIDUAL PERFORMANCE'}: ${teamName.toUpperCase()} (${roleLabel})`,
    sep92,
    isEs ? 'TITULARES' : 'STARTERS',
    header,
  ];

  for (const p of starters) {
    lines.push(formatPlayerRow(p, cardIncidents, isEs));
  }

  lines.push(isEs ? 'SUPLENTES CON MINUTOS' : 'SUBSTITUTES WITH MINUTES');
  if (subs.length === 0) {
    lines.push(isEs ? '(Sin sustituciones registradas)' : '(No substitutions recorded)');
  } else {
    for (const p of subs) {
      lines.push(formatPlayerRow(p, cardIncidents, isEs));
      if (p.subbed_in_minute != null) {
        const rep = p.replaced_player_name
          ? (isEs ? ` por ${p.replaced_player_name}` : ` for ${p.replaced_player_name}`)
          : '';
        lines.push(`     (${isEs ? 'Entró al' : 'Subbed in at'} ${p.subbed_in_minute}'${rep})`);
      }
    }
  }

  return lines;
}

/**
 * Main generator for the plain text export ("Copy statistics") on Sheet 03.
 * Implements strict mathematical aggregation with mandatory fallbacks based
 * on in-memory player statistics and eliminates phantom zeros.
 */
export function formatMatchReportText(
  data: MatchSheet03DataHubResponse,
  isEs: boolean = true
): string {
  const { metadata, home_players = [], away_players = [] } = data;
  const homeTeam = metadata.home_team;
  const awayTeam = metadata.away_team;
  const homeName = homeTeam.name;
  const awayName = awayTeam.name;
  const homeScore = homeTeam.score != null ? String(homeTeam.score) : '-';
  const awayScore = awayTeam.score != null ? String(awayTeam.score) : '-';

  const sep52 = '='.repeat(52);
  const sep52Dash = '-'.repeat(52);
  const rFmt = (
    h: string | number | null | undefined,
    lbl: string,
    a: string | number | null | undefined
  ) =>
    `${(h == null ? 'N/D' : String(h)).padStart(8, ' ')}    ${lbl.padEnd(28, ' ')}    ${(a == null ? 'N/D' : String(a)).padStart(8, ' ')}`;

  // =========================================================================
  // 0. AGREGACIONES INDIVIDUALES EN MEMORIA (FALLBACKS MANDATORIOS)
  // =========================================================================
  // Faltas cometidas sumadas directamente de player_match_stats
  const homePlayerFoulsSum = home_players.reduce((sum, p) => sum + (p.fouls ?? 0), 0);
  const awayPlayerFoulsSum = away_players.reduce((sum, p) => sum + (p.fouls ?? 0), 0);

  // Tiros sumados de jugadores
  const homePlayerShotsSum = home_players.reduce((sum, p) => sum + (p.total_shots ?? 0), 0);
  const homePlayerSotSum = home_players.reduce((sum, p) => sum + (p.shots_on_target ?? 0), 0);
  const awayPlayerShotsSum = away_players.reduce((sum, p) => sum + (p.total_shots ?? 0), 0);
  const awayPlayerSotSum = away_players.reduce((sum, p) => sum + (p.shots_on_target ?? 0), 0);

  // Pases sumados de jugadores
  const homePassesTotalSum = home_players.reduce((sum, p) => sum + (p.passes_total ?? 0), 0);
  const homePassesCompSum = home_players.reduce((sum, p) => sum + (p.passes_completed ?? 0), 0);
  const awayPassesTotalSum = away_players.reduce((sum, p) => sum + (p.passes_total ?? 0), 0);
  const awayPassesCompSum = away_players.reduce((sum, p) => sum + (p.passes_completed ?? 0), 0);

  // Paradas del portero sumadas de jugadores
  const homeGkSaves = home_players.reduce((sum, p) => sum + (p.saves ?? 0), 0);
  const awayGkSaves = away_players.reduce((sum, p) => sum + (p.saves ?? 0), 0);

  // Pases clave sumados de jugadores
  const homeKeyPassesSum = home_players.reduce((sum, p) => sum + (p.key_passes ?? 0), 0);
  const awayKeyPassesSum = away_players.reduce((sum, p) => sum + (p.key_passes ?? 0), 0);

  // Intercepciones sumadas de jugadores
  const homeInterceptionsSum = home_players.reduce((sum, p) => sum + (p.interceptions ?? 0), 0);
  const awayInterceptionsSum = away_players.reduce((sum, p) => sum + (p.interceptions ?? 0), 0);

  // Entradas sumadas de jugadores
  const homeTacklesSum = home_players.reduce((sum, p) => sum + (p.tackles ?? 0), 0);
  const awayTacklesSum = away_players.reduce((sum, p) => sum + (p.tackles ?? 0), 0);

  // =========================================================================
  // 1. ENCABEZADO PRINCIPAL DEL PARTIDO
  // =========================================================================
  const matchDate = (metadata.match_date || '').slice(0, 10);
  const headerLines = [
    `${isEs ? 'REPORTE ESTADÍSTICO' : 'MATCH REPORT'}: ${homeName} ${homeScore} - ${awayScore} ${awayName}`,
    `${isEs ? 'Competición' : 'Competition'}: ${metadata.tournament || '-'} | ${isEs ? 'Jornada' : 'Round'}: ${metadata.round || '-'} | ${isEs ? 'Fecha' : 'Date'}: ${matchDate}`,
    data.venue?.stadium
      ? `${isEs ? 'Sede' : 'Venue'}: ${data.venue.stadium} (${data.venue.city || '-'}, ${data.venue.altitude != null ? `${data.venue.altitude} m` : '-'}, ${data.venue.surface || '-'})`
      : `${isEs ? 'Sede' : 'Venue'}: -`,
    data.referee?.name
      ? `${isEs ? 'Árbitro' : 'Referee'}: ${data.referee.name} (${data.referee.sample_matches ?? 0} ${isEs ? 'partidos' : 'matches'}, ${data.referee.yellow_cards_per_match ?? '-'} AM/p, ${data.referee.red_cards_per_match ?? '-'} RO/p)`
      : `${isEs ? 'Árbitro' : 'Referee'}: -`,
  ];

  // =========================================================================
  // 2. MÉTRICAS COMPARATIVAS DE EQUIPO CON CUADRE ARITMÉTICO Y SIN CEROS FANTASMA
  // =========================================================================

  // --- Bloque A: Calidad de Ocasiones y Remate ---
  const xgSofaRow = getMetricRow(data.attack_metrics, 'xg_sofascore') || getMetricRow(data.attack_metrics, 'xg_for');
  const xgFlashRow = getMetricRow(data.attack_metrics, 'xg_flashscore') || getMetricRow(data.attack_metrics, 'xg');
  const npxgRow = getMetricRow(data.attack_metrics, 'npxg_for');
  const xgotRow = getMetricRow(data.attack_metrics, 'xgot');

  // Tiros Totales (cuadre aritmético)
  const shotsTotalRow = getMetricRow(data.attack_metrics, 'shots_total');
  const hShotsTot = homePlayerShotsSum > 0 ? homePlayerShotsSum : Number(shotsTotalRow?.home_val || 0);
  const aShotsTot = awayPlayerShotsSum > 0 ? awayPlayerShotsSum : Number(shotsTotalRow?.away_val || 0);

  // Tiros a Puerta
  const sotRow = getMetricRow(data.attack_metrics, 'shots_on_target');
  const hSot = homePlayerSotSum > 0 ? homePlayerSotSum : Number(sotRow?.home_val || 0);
  const aSot = awayPlayerSotSum > 0 ? awayPlayerSotSum : Number(sotRow?.away_val || 0);

  // Tiros Desviados y Bloqueados (verificar si la fuente desglosó o puso ceros fantasma)
  const offTargetRow = getMetricRow(data.attack_metrics, 'shots_off_target');
  const blockedRow = getMetricRow(data.attack_metrics, 'shots_blocked');
  const hOff = Number(offTargetRow?.home_val ?? -1);
  const aOff = Number(offTargetRow?.away_val ?? -1);
  const hBlk = Number(blockedRow?.home_val ?? -1);
  const aBlk = Number(blockedRow?.away_val ?? -1);

  // Si sot + off + blk == total, el desglose es aritméticamente consistente. De lo contrario, reflejar N/D.
  const hBreakdownValid = hOff >= 0 && hBlk >= 0 && hSot + hOff + hBlk === hShotsTot;
  const aBreakdownValid = aOff >= 0 && aBlk >= 0 && aSot + aOff + aBlk === aShotsTot;

  const hOffDisplay = hBreakdownValid ? hOff : 'N/D';
  const aOffDisplay = aBreakdownValid ? aOff : 'N/D';
  const hBlkDisplay = hBreakdownValid ? hBlk : 'N/D';
  const aBlkDisplay = aBreakdownValid ? aBlk : 'N/D';

  // Tiros Dentro / Fuera del Área
  const inBoxRow = getMetricRow(data.attack_metrics, 'shots_inside_box');
  const outBoxRow = getMetricRow(data.attack_metrics, 'shots_outside_box');
  const hIn = Number(inBoxRow?.home_val ?? 0);
  const aIn = Number(inBoxRow?.away_val ?? 0);
  const hOut = Number(outBoxRow?.home_val ?? 0);
  const aOut = Number(outBoxRow?.away_val ?? 0);
  const hBoxValid = hIn + hOut === hShotsTot && hShotsTot > 0;
  const aBoxValid = aIn + aOut === aShotsTot && aShotsTot > 0;

  // xGOT: si no hay tiros a puerta es 0.00; si hay tiros a puerta pero el valor es 0.0 o nulo y no hay feed, reflejar N/D
  const hasFlashShots = Boolean(data.shots_source === 'flashscore' || (xgotRow && Number(xgotRow.home_val) > 0));
  const hXgot = hSot === 0 ? '0.00' : hasFlashShots && xgotRow?.home_val != null && Number(xgotRow.home_val) > 0 ? Number(xgotRow.home_val).toFixed(2) : 'N/D';
  const aXgot = aSot === 0 ? '0.00' : hasFlashShots && xgotRow?.away_val != null && Number(xgotRow.away_val) > 0 ? Number(xgotRow.away_val).toFixed(2) : 'N/D';

  // xG Flashscore: si no está disponible, mostrar N/D en lugar de 0.00 o -
  const hXgFlash = xgFlashRow?.home_val != null && Number(xgFlashRow.home_val) > 0 ? Number(xgFlashRow.home_val).toFixed(2) : 'N/D';
  const aXgFlash = xgFlashRow?.away_val != null && Number(xgFlashRow.away_val) > 0 ? Number(xgFlashRow.away_val).toFixed(2) : 'N/D';

  // Distancia promedio de tiro
  const distRow = getMetricRow(data.attack_metrics, 'avg_shot_distance');
  const hDist = distRow?.home_val != null && Number(distRow.home_val) > 0 ? `${distRow.home_val} m` : 'N/D';
  const aDist = distRow?.away_val != null && Number(distRow.away_val) > 0 ? `${distRow.away_val} m` : 'N/D';

  const chanceLines = [
    isEs ? '-- CALIDAD DE OCASIONES Y REMATE -----------------' : '-- CHANCE QUALITY & SHOOTING --------------------',
    rFmt(xgSofaRow?.home_val != null ? Number(xgSofaRow.home_val).toFixed(2) : 'N/D', 'xG (Sofascore)', xgSofaRow?.away_val != null ? Number(xgSofaRow.away_val).toFixed(2) : 'N/D'),
    rFmt(hXgFlash, 'xG (Flashscore)', aXgFlash),
    rFmt(npxgRow?.home_val != null ? Number(npxgRow.home_val).toFixed(2) : 'N/D', 'npxG (Sin Penales)', npxgRow?.away_val != null ? Number(npxgRow.away_val).toFixed(2) : 'N/D'),
    rFmt(hXgot, 'xGOT', aXgot),
    rFmt(homeScore, isEs ? 'Goles Reales' : 'Actual Goals', awayScore),
    rFmt(hShotsTot, isEs ? 'Tiros Totales' : 'Total Shots', aShotsTot),
    rFmt(hSot, isEs ? 'Tiros a Puerta' : 'Shots on Target', aSot),
    rFmt(hOffDisplay, isEs ? 'Tiros Desviados' : 'Shots Off Target', aOffDisplay),
    rFmt(hBlkDisplay, isEs ? 'Tiros Bloqueados' : 'Shots Blocked', aBlkDisplay),
    rFmt(hBoxValid ? hIn : 'N/D', isEs ? 'Tiros Dentro del Área' : 'Shots Inside Box', aBoxValid ? aIn : 'N/D'),
    rFmt(hBoxValid ? hOut : 'N/D', isEs ? 'Tiros Fuera del Área' : 'Shots Outside Box', aBoxValid ? aOut : 'N/D'),
    rFmt(sanitizeDisplay(getMetricRow(data.attack_metrics, 'hit_woodwork')?.home_val), isEs ? 'Tiros al Poste' : 'Hit Woodwork', sanitizeDisplay(getMetricRow(data.attack_metrics, 'hit_woodwork')?.away_val)),
    rFmt(hDist, isEs ? 'Distancia Media Tiro' : 'Avg Shot Distance', aDist),
    rFmt(sanitizeDisplay(getMetricRow(data.attack_metrics, 'big_chances')?.home_val), isEs ? 'Grandes Ocasiones' : 'Big Chances', sanitizeDisplay(getMetricRow(data.attack_metrics, 'big_chances')?.away_val)),
    rFmt(sanitizeDisplay(getMetricRow(data.attack_metrics, 'big_chances_breakdown')?.home_val), isEs ? 'G. Ocasiones Anot/Fall' : 'Big Chances Scored/Missed', sanitizeDisplay(getMetricRow(data.attack_metrics, 'big_chances_breakdown')?.away_val)),
  ];

  // --- Bloque B: Construcción y Distribución ---
  const possRow = getMetricRow(data.passing_metrics, 'possession');
  const hPoss = possRow?.home_val != null ? `${Math.round(Number(possRow.home_val))}%` : '50%';
  const aPoss = possRow?.away_val != null ? `${Math.round(Number(possRow.away_val))}%` : '50%';

  // Pases Totales y Completados con fallback individual obligatorio
  const passesTotRow = getMetricRow(data.passing_metrics, 'passes_total');
  const passesCompRow = getMetricRow(data.passing_metrics, 'passes_completed');

  const rawHPassTot = Number(passesTotRow?.home_val || 0);
  const rawAPassTot = Number(passesTotRow?.away_val || 0);
  const rawHPassComp = Number(passesCompRow?.home_val || 0);
  const rawAPassComp = Number(passesCompRow?.away_val || 0);

  const hPassTot = homePassesTotalSum > 0 ? homePassesTotalSum : rawHPassTot;
  const aPassTot = awayPassesTotalSum > 0 ? awayPassesTotalSum : rawAPassTot;
  const hPassComp = homePassesCompSum > 0 ? homePassesCompSum : rawHPassComp;
  const aPassComp = awayPassesCompSum > 0 ? awayPassesCompSum : rawAPassComp;

  const hPassAcc = hPassTot > 0 ? `${Math.round((hPassComp * 100) / hPassTot)}%` : 'N/D';
  const aPassAcc = aPassTot > 0 ? `${Math.round((aPassComp * 100) / aPassTot)}%` : 'N/D';

  // Pases clave con fallback a la suma individual si cabecera marca 0
  const keyPassRow = getMetricRow(data.passing_metrics, 'key_passes');
  const rawHKey = Number(keyPassRow?.home_val || 0);
  const rawAKey = Number(keyPassRow?.away_val || 0);
  const hKey = homeKeyPassesSum > 0 ? homeKeyPassesSum : (rawHKey > 0 ? rawHKey : 'N/D');
  const aKey = awayKeyPassesSum > 0 ? awayKeyPassesSum : (rawAKey > 0 ? rawAKey : 'N/D');

  const f3Row = getMetricRow(data.passing_metrics, 'passes_final_third');
  const hF3Display = f3Row?.home_val && f3Row.home_val !== '0/0' ? f3Row.home_val : 'N/D';
  const aF3Display = f3Row?.away_val && f3Row.away_val !== '0/0' ? f3Row.away_val : 'N/D';

  const crossesRow = getMetricRow(data.passing_metrics, 'crosses_breakdown');
  const hCrossDisplay = crossesRow?.home_val && crossesRow.home_val !== '0/0' ? crossesRow.home_val : 'N/D';
  const aCrossDisplay = crossesRow?.away_val && crossesRow.away_val !== '0/0' ? crossesRow.away_val : 'N/D';

  const longRow = getMetricRow(data.passing_metrics, 'long_balls_breakdown');
  const hLongDisplay = longRow?.home_val && longRow.home_val !== '0/0' ? longRow.home_val : 'N/D';
  const aLongDisplay = longRow?.away_val && longRow.away_val !== '0/0' ? longRow.away_val : 'N/D';

  const passingLines = [
    isEs ? '-- CONSTRUCCIÓN Y DISTRIBUCIÓN -------------------' : '-- BUILDUP & DISTRIBUTION ------------------------',
    rFmt(hPoss, isEs ? 'Posesión' : 'Possession', aPoss),
    rFmt(hPassTot > 0 ? hPassTot : 'N/D', isEs ? 'Pases Totales' : 'Total Passes', aPassTot > 0 ? aPassTot : 'N/D'),
    rFmt(hPassComp > 0 ? hPassComp : 'N/D', isEs ? 'Pases Completados' : 'Completed Passes', aPassComp > 0 ? aPassComp : 'N/D'),
    rFmt(hPassAcc, isEs ? 'Precisión de Pases' : 'Pass Accuracy', aPassAcc),
    rFmt(sanitizeDisplay(getMetricRow(data.passing_metrics, 'forward_passes')?.home_val), isEs ? 'Pases Hacia Adelante' : 'Forward Passes', sanitizeDisplay(getMetricRow(data.passing_metrics, 'forward_passes')?.away_val)),
    rFmt(hF3Display, isEs ? 'Pases Último Tercio (Acc)' : 'Final Third Passes (Acc)', aF3Display),
    rFmt(sanitizeDisplay(getMetricRow(data.passing_metrics, 'passes_into_box')?.home_val), isEs ? 'Pases al Área' : 'Passes into Box', sanitizeDisplay(getMetricRow(data.passing_metrics, 'passes_into_box')?.away_val)),
    rFmt(sanitizeDisplay(getMetricRow(data.passing_metrics, 'progressive_passes')?.home_val), isEs ? 'Pases Progresivos' : 'Progressive Passes', sanitizeDisplay(getMetricRow(data.passing_metrics, 'progressive_passes')?.away_val)),
    rFmt(sanitizeDisplay(getMetricRow(data.passing_metrics, 'progressive_carries')?.home_val), isEs ? 'Conducciones Progresivas' : 'Progressive Carries', sanitizeDisplay(getMetricRow(data.passing_metrics, 'progressive_carries')?.away_val)),
    rFmt(hKey, isEs ? 'Pases Clave' : 'Key Passes', aKey),
    rFmt(sanitizeDisplay(getMetricRow(data.passing_metrics, 'touches_in_box')?.home_val), isEs ? 'Toques en el Área' : 'Touches in Box', sanitizeDisplay(getMetricRow(data.passing_metrics, 'touches_in_box')?.away_val)),
    rFmt(hCrossDisplay, isEs ? 'Centros (Comp/Tot)' : 'Crosses (Comp/Tot)', aCrossDisplay),
    rFmt(hLongDisplay, isEs ? 'Balones Largos (Comp/Tot)' : 'Long Balls (Comp/Tot)', aLongDisplay),
    rFmt(sanitizeDisplay(getMetricRow(data.passing_metrics, 'successful_dribbles')?.home_val), isEs ? 'Regates Exitosos' : 'Successful Dribbles', sanitizeDisplay(getMetricRow(data.passing_metrics, 'successful_dribbles')?.away_val)),
  ];

  // --- Bloque C: Presión, Duelos y Portería ---
  // Field Tilt: si existen pases en último tercio en canales de ataque, calcular el porcentaje real.
  // Si no hay coordenadas espaciales o los pases en último tercio son 0/0, mostrar N/D en lugar del 50%-50% artificial.
  const hacTot = data.home_attack_channels?.total_passes ?? 0;
  const aacTot = data.away_attack_channels?.total_passes ?? 0;
  const hasSpatialChannels = hacTot + aacTot > 0;
  const tiltRow = getMetricRow(data.defense_metrics, 'field_tilt');
  let hTiltDisplay = 'N/D';
  let aTiltDisplay = 'N/D';
  if (hacTot + aacTot > 0) {
    const hPct = Math.round((hacTot * 100) / (hacTot + aacTot));
    hTiltDisplay = `${hPct}%`;
    aTiltDisplay = `${100 - hPct}%`;
  } else if (
    tiltRow?.home_val != null &&
    tiltRow?.away_val != null &&
    (Number(tiltRow.home_val) !== 50 || Number(tiltRow.away_val) !== 50)
  ) {
    hTiltDisplay = `${tiltRow.home_val}%`;
    aTiltDisplay = `${tiltRow.away_val}%`;
  }

  // Paradas del Portero: fallback a la ficha individual si cabecera marca 0
  const savesRow = getMetricRow(data.defense_metrics, 'saves');
  const rawHSaves = Number(savesRow?.home_val || 0);
  const rawASaves = Number(savesRow?.away_val || 0);
  const hSaves = homeGkSaves > 0 ? homeGkSaves : rawHSaves;
  const aSaves = awayGkSaves > 0 ? awayGkSaves : rawASaves;

  // Intercepciones con fallback individual
  const intRow = getMetricRow(data.defense_metrics, 'interceptions');
  const rawHInt = Number(intRow?.home_val || 0);
  const rawAInt = Number(intRow?.away_val || 0);
  const hInt = homeInterceptionsSum > 0 ? homeInterceptionsSum : (rawHInt > 0 ? rawHInt : 'N/D');
  const aInt = awayInterceptionsSum > 0 ? awayInterceptionsSum : (rawAInt > 0 ? rawAInt : 'N/D');

  // Entradas con fallback individual
  const tacklesRow = getMetricRow(data.defense_metrics, 'tackles_breakdown');
  const hTackles = homeTacklesSum > 0 ? homeTacklesSum : (tacklesRow?.home_val && tacklesRow.home_val !== '0/0' ? tacklesRow.home_val : 'N/D');
  const aTackles = awayTacklesSum > 0 ? awayTacklesSum : (tacklesRow?.away_val && tacklesRow.away_val !== '0/0' ? tacklesRow.away_val : 'N/D');

  const defenseLines = [
    isEs ? '-- PRESIÓN, DUELOS Y PORTERÍA --------------------' : '-- PRESSING, DUELS & GOALKEEPING -----------------',
    rFmt(hTiltDisplay, isEs ? 'Inclinación de Campo' : 'Field Tilt', aTiltDisplay),
    rFmt(sanitizeDisplay(getMetricRow(data.defense_metrics, 'duels_won')?.home_val), isEs ? 'Duelos Ganados' : 'Duels Won', sanitizeDisplay(getMetricRow(data.defense_metrics, 'duels_won')?.away_val)),
    rFmt(hTackles, isEs ? 'Entradas Ganadas (Tot)' : 'Tackles Won (Tot)', aTackles),
    rFmt(hInt, isEs ? 'Intercepciones' : 'Interceptions', aInt),
    rFmt(sanitizeDisplay(getMetricRow(data.defense_metrics, 'clearances')?.home_val), isEs ? 'Despejes' : 'Clearances', sanitizeDisplay(getMetricRow(data.defense_metrics, 'clearances')?.away_val)),
    rFmt(sanitizeDisplay(getMetricRow(data.defense_metrics, 'defensive_actions')?.home_val), isEs ? 'Total Acciones Defensivas' : 'Total Defensive Actions', sanitizeDisplay(getMetricRow(data.defense_metrics, 'defensive_actions')?.away_val)),
    rFmt(sanitizeDisplay(getMetricRow(data.defense_metrics, 'defensive_actions_high')?.home_val), isEs ? 'Acciones Defensivas Altas' : 'High Defensive Actions', sanitizeDisplay(getMetricRow(data.defense_metrics, 'defensive_actions_high')?.away_val)),
    rFmt(sanitizeDisplay(getMetricRow(data.defense_metrics, 'high_recoveries')?.home_val), isEs ? 'Recuperaciones Altas' : 'High Recoveries', sanitizeDisplay(getMetricRow(data.defense_metrics, 'high_recoveries')?.away_val)),
    rFmt(hSaves, isEs ? 'Paradas del Portero' : 'Goalkeeper Saves', aSaves),
    rFmt(sanitizeDisplay(getMetricRow(data.defense_metrics, 'goals_prevented')?.home_val), isEs ? 'Goles Prevenidos' : 'Goals Prevented', sanitizeDisplay(getMetricRow(data.defense_metrics, 'goals_prevented')?.away_val)),
  ];

  // --- Bloque D: Disciplina y Pelota Parada ---
  // Faltas Cometidas con fallback obligatorio a suma de player_match_stats
  const foulsRow = getMetricRow(data.discipline_metrics, 'fouls');
  const hFouls = homePlayerFoulsSum > 0 ? homePlayerFoulsSum : Number(foulsRow?.home_val || 0);
  const aFouls = awayPlayerFoulsSum > 0 ? awayPlayerFoulsSum : Number(foulsRow?.away_val || 0);

  // Faltas Recibidas = Faltas Cometidas por el rival
  const hWasFouled = aFouls;
  const aWasFouled = hFouls;

  const yCardsRow = getMetricRow(data.discipline_metrics, 'yellow_cards');
  const rCardsRow = getMetricRow(data.discipline_metrics, 'red_cards');
  const cornersRow = getMetricRow(data.discipline_metrics, 'corner_kicks');

  const disciplineLines = [
    isEs ? '-- DISCIPLINA Y PELOTA PARADA --------------------' : '-- DISCIPLINE & SET PIECES -----------------------',
    rFmt(hFouls, isEs ? 'Faltas Cometidas' : 'Fouls Committed', aFouls),
    rFmt(hWasFouled, isEs ? 'Faltas Recibidas' : 'Fouls Suffered', aWasFouled),
    rFmt(sanitizeDisplay(yCardsRow?.home_val, '0'), isEs ? 'Tarjetas Amarillas' : 'Yellow Cards', sanitizeDisplay(yCardsRow?.away_val, '0')),
    rFmt(sanitizeDisplay(rCardsRow?.home_val, '0'), isEs ? 'Tarjetas Rojas' : 'Red Cards', sanitizeDisplay(rCardsRow?.away_val, '0')),
    rFmt(sanitizeDisplay(cornersRow?.home_val, '0'), isEs ? 'Tiros de Esquina' : 'Corner Kicks', sanitizeDisplay(cornersRow?.away_val, '0')),
    rFmt(sanitizeDisplay(getMetricRow(data.discipline_metrics, 'offsides')?.home_val), isEs ? 'Fueras de Juego' : 'Offsides', sanitizeDisplay(getMetricRow(data.discipline_metrics, 'offsides')?.away_val)),
    rFmt(sanitizeDisplay(getMetricRow(data.discipline_metrics, 'free_kicks')?.home_val), isEs ? 'Tiros Libres Concedidos' : 'Free Kicks Conceded', sanitizeDisplay(getMetricRow(data.discipline_metrics, 'free_kicks')?.away_val)),
    rFmt(sanitizeDisplay(getMetricRow(data.discipline_metrics, 'throw_ins')?.home_val), isEs ? 'Saques de Banda' : 'Throw-ins', sanitizeDisplay(getMetricRow(data.discipline_metrics, 'throw_ins')?.away_val)),
    rFmt(sanitizeDisplay(getMetricRow(data.discipline_metrics, 'goal_kicks')?.home_val), isEs ? 'Saques de Meta' : 'Goal Kicks', sanitizeDisplay(getMetricRow(data.discipline_metrics, 'goal_kicks')?.away_val)),
    sep52,
  ];

  const teamComparisonLines = [
    ...headerLines,
    sep52,
    `   ${(isEs ? 'LOCAL' : 'HOME').padEnd(8, ' ')}    ${(isEs ? 'MÉTRICA' : 'METRIC').padEnd(28, ' ')}    ${(isEs ? 'VISITANTE' : 'AWAY').padStart(8, ' ')}`,
    sep52,
    ...chanceLines,
    ...passingLines,
    ...defenseLines,
    ...disciplineLines,
  ];

  // =========================================================================
  // 3. CRONOLOGÍA PROGRESIVA DE GOLES E INCIDENCIAS (MARCADOR EN TIEMPO REAL)
  // =========================================================================
  interface RawGoalEvent {
    type: 'goal';
    minute: number;
    extraMinute: number;
    minuteDisplay: string;
    team_id: number;
    player_name: string;
    incident_type: string;
  }

  interface RawCardEvent {
    type: 'card';
    minute: number;
    extraMinute: number;
    minuteDisplay: string;
    team_id: number;
    player_name?: string | null;
    card_type: string;
    reason?: string | null;
    rescinded?: boolean;
  }

  type RawMatchEvent = RawGoalEvent | RawCardEvent;

  const rawEvents: RawMatchEvent[] = [];

  // Recolectar goles
  if (data.goals_chronology && data.goals_chronology.length > 0) {
    for (const g of data.goals_chronology) {
      const minDisplay = g.minute_display || `${g.minute}'`;
      rawEvents.push({
        type: 'goal',
        minute: g.minute,
        extraMinute: 0,
        minuteDisplay: minDisplay,
        team_id: g.team_id,
        player_name: g.player_name,
        incident_type: g.incident_type || (isEs ? 'Gol' : 'Goal'),
      });
    }
  }

  // Recolectar tarjetas
  if (data.card_incidents && data.card_incidents.length > 0) {
    for (const c of data.card_incidents) {
      const minDisplay =
        c.minute_display || (c.extra_minute ? `${c.minute}+${c.extra_minute}'` : `${c.minute}'`);
      rawEvents.push({
        type: 'card',
        minute: c.minute,
        extraMinute: c.extra_minute || 0,
        minuteDisplay: minDisplay,
        team_id: c.team_id,
        player_name: c.player_name,
        card_type: c.card_type,
        reason: c.reason,
        rescinded: c.rescinded,
      });
    }
  }

  // Ordenar estrictamente por minuto y tiempo extra (goles antes que tarjetas si coinciden)
  rawEvents.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    if (a.extraMinute !== b.extraMinute) return a.extraMinute - b.extraMinute;
    return a.type === 'goal' ? -1 : 1;
  });

  // Generar marcador progresivo dinámico en tiempo de ejecución
  let runningHomeScore = 0;
  let runningAwayScore = 0;

  const incidentsLines: string[] = [
    isEs ? 'CRONOLOGÍA DE INCIDENCIAS (GOLES Y TARJETAS)' : 'INCIDENTS CHRONOLOGY (GOALS & CARDS)',
    sep52,
  ];

  if (rawEvents.length === 0) {
    incidentsLines.push(isEs ? 'Sin goles ni tarjetas registradas.' : 'No goals or cards recorded.');
  } else {
    for (const ev of rawEvents) {
      const isHome = ev.team_id === homeTeam.team_id;
      const teamLabel = isHome
        ? (homeTeam.short_name || homeTeam.name)
        : (awayTeam.short_name || awayTeam.name);

      if (ev.type === 'goal') {
        if (isHome) {
          runningHomeScore++;
        } else {
          runningAwayScore++;
        }
        const scoreStr = `${runningHomeScore}-${runningAwayScore}`;
        incidentsLines.push(
          `${ev.minuteDisplay.padStart(5, ' ')}  [GOL ${scoreStr}] ${ev.player_name} (${teamLabel}) - ${ev.incident_type}`
        );
      } else {
        const cardLbl = getCardLabel(ev.card_type, isEs);
        const reasonStr = ev.reason ? ` - ${ev.reason}` : '';
        const rescindedStr = ev.rescinded ? (isEs ? ' (Anulada)' : ' (Rescinded)') : '';
        const pName = ev.player_name || (isEs ? 'Jugador' : 'Player');
        incidentsLines.push(
          `${ev.minuteDisplay.padStart(5, ' ')}  [${cardLbl}] ${pName} (${teamLabel})${reasonStr}${rescindedStr}`
        );
      }
    }
  }

  // Estado de juego
  if (data.game_state) {
    const gs = data.game_state;
    incidentsLines.push(
      sep52Dash,
      `${isEs ? 'ESTADO DE JUEGO' : 'GAME STATE'} (${gs.total_duration_minutes} ${isEs ? 'min reglamentarios' : 'regulation mins'}):`,
      `  ${(isEs ? 'Ventaja Local:' : 'Home Lead:').padEnd(20, ' ')} ${String(gs.lead_minutes).padStart(2, ' ')} min  (${gs.lead_pct.toFixed(1)}%)`,
      `  ${(isEs ? 'Empate:' : 'Draw:').padEnd(20, ' ')} ${String(gs.draw_minutes).padStart(2, ' ')} min  (${gs.draw_pct.toFixed(1)}%)`,
      `  ${(isEs ? 'Ventaja Visitante:' : 'Away Lead:').padEnd(20, ' ')} ${String(gs.trail_minutes).padStart(2, ' ')} min  (${gs.trail_pct.toFixed(1)}%)`
    );
  }
  incidentsLines.push(sep52);

  // =========================================================================
  // 4. DESGLOSE TEMPORAL (1T / 2T) SIN GUIONES Y CON GOLES POR TIEMPO
  // =========================================================================
  const halvesLines: string[] = [];
  if (data.half_period_stats && data.half_period_stats.length > 0) {
    halvesLines.push(isEs ? 'DESGLOSE POR PERIODOS (1T / 2T)' : 'HALF-BY-HALF BREAKDOWN (1H / 2H)', sep52);

    // Calcular goles por tiempo a partir de la lista de goles
    const goals1THome = (data.goals_chronology || []).filter((g) => g.team_id === homeTeam.team_id && g.minute <= 45).length;
    const goals1TAway = (data.goals_chronology || []).filter((g) => g.team_id === awayTeam.team_id && g.minute <= 45).length;
    const goals2THome = (data.goals_chronology || []).filter((g) => g.team_id === homeTeam.team_id && g.minute > 45).length;
    const goals2TAway = (data.goals_chronology || []).filter((g) => g.team_id === awayTeam.team_id && g.minute > 45).length;

    for (const h of data.half_period_stats) {
      const is1T = h.period === '1ST' || h.period === '1T';
      const pLabel = is1T
        ? (isEs ? 'PRIMER TIEMPO' : 'FIRST HALF')
        : (isEs ? 'SEGUNDO TIEMPO' : 'SECOND HALF');

      const hGoals = is1T ? goals1THome : goals2THome;
      const aGoals = is1T ? goals1TAway : goals2TAway;

      // xG Flashscore en 1T/2T: si no está disponible, reflejar N/D en lugar de -
      const hHalfXg = h.home_xg != null && h.home_xg > 0 ? h.home_xg.toFixed(2) : 'N/D';
      const aHalfXg = h.away_xg != null && h.away_xg > 0 ? h.away_xg.toFixed(2) : 'N/D';

      // Tiros totales y a puerta: si no están medidos en el feed de tiempo, reflejar N/D
      const hHalfShots = h.home_shots != null ? h.home_shots : 'N/D';
      const aHalfShots = h.away_shots != null ? h.away_shots : 'N/D';
      const hHalfSot = h.home_shots_on_target != null ? h.home_shots_on_target : 'N/D';
      const aHalfSot = h.away_shots_on_target != null ? h.away_shots_on_target : 'N/D';

      // Faltas de cada tiempo: si no están disponibles, reflejar N/D
      const hHalfFouls = h.home_fouls != null ? h.home_fouls : 'N/D';
      const aHalfFouls = h.away_fouls != null ? h.away_fouls : 'N/D';

      halvesLines.push(
        `   ${(isEs ? 'LOCAL' : 'HOME').padEnd(8, ' ')}    ${pLabel.padEnd(28, ' ')}    ${(isEs ? 'VISITANTE' : 'AWAY').padStart(8, ' ')}`,
        sep52Dash,
        rFmt(hHalfXg, 'xG (Flashscore)', aHalfXg),
        rFmt(hGoals, isEs ? 'Goles' : 'Goals', aGoals),
        rFmt(hHalfShots, isEs ? 'Tiros Totales' : 'Total Shots', aHalfShots),
        rFmt(hHalfSot, isEs ? 'Tiros a Puerta' : 'Shots on Target', aHalfSot),
        rFmt(h.home_corners, isEs ? 'Tiros de Esquina' : 'Corner Kicks', h.away_corners),
        rFmt(hHalfFouls, isEs ? 'Faltas' : 'Fouls', aHalfFouls),
        rFmt(h.home_yellow_cards, isEs ? 'Tarjetas Amarillas' : 'Yellow Cards', h.away_yellow_cards),
        rFmt(h.home_possession != null ? `${Math.round(h.home_possession)}%` : 'N/D', isEs ? 'Posesión' : 'Possession', h.away_possession != null ? `${Math.round(h.away_possession)}%` : 'N/D'),
        sep52Dash
      );
    }
  }

  // =========================================================================
  // 5. CANALES DE ATAQUE Y TIPOLOGÍA DE REMATES
  // =========================================================================
  const tacticsLines: string[] = [];
  if (data.home_attack_channels && data.away_attack_channels && hasSpatialChannels) {
    const hac = data.home_attack_channels;
    const aac = data.away_attack_channels;
    tacticsLines.push(
      isEs ? 'CANALES DE ATAQUE (PASES ÚLTIMO TERCIO)' : 'ATTACK CHANNELS (FINAL THIRD PASSES)',
      sep52,
      `   ${(isEs ? 'LOCAL' : 'HOME').padEnd(8, ' ')}    ${(isEs ? 'ZONA / PASILLO' : 'LANE / ZONE').padEnd(28, ' ')}    ${(isEs ? 'VISITANTE' : 'AWAY').padStart(8, ' ')}`,
      sep52Dash,
      rFmt(
        hac.left_pct != null ? `${hac.left_passes_completed} (${Math.round(hac.left_pct)}%)` : 'N/D',
        isEs ? 'Banda Izquierda' : 'Left Wing',
        aac.left_pct != null ? `${aac.left_passes_completed} (${Math.round(aac.left_pct)}%)` : 'N/D'
      ),
      rFmt(
        hac.center_pct != null ? `${hac.center_passes_completed} (${Math.round(hac.center_pct)}%)` : 'N/D',
        isEs ? 'Pasillo Central' : 'Central Lane',
        aac.center_pct != null ? `${aac.center_passes_completed} (${Math.round(aac.center_pct)}%)` : 'N/D'
      ),
      rFmt(
        hac.right_pct != null ? `${hac.right_passes_completed} (${Math.round(hac.right_pct)}%)` : 'N/D',
        isEs ? 'Banda Derecha' : 'Right Wing',
        aac.right_pct != null ? `${aac.right_passes_completed} (${Math.round(aac.right_pct)}%)` : 'N/D'
      ),
      sep52Dash
    );
  }

  if (data.home_shot_typology && data.away_shot_typology) {
    const hst = data.home_shot_typology;
    const ast = data.away_shot_typology;
    const hasShotTypologyData = hst.total > 0 || ast.total > 0;
    if (hasShotTypologyData) {
      tacticsLines.push(
        `   ${(isEs ? 'LOCAL' : 'HOME').padEnd(8, ' ')}    ${(isEs ? 'TIPOLOGÍA DE REMATES' : 'SHOT TYPOLOGY').padEnd(28, ' ')}    ${(isEs ? 'VISITANTE' : 'AWAY').padStart(8, ' ')}`,
        sep52Dash,
        rFmt(hst.open_play, isEs ? 'Jugada Abierta' : 'Open Play', ast.open_play),
        rFmt(hst.set_piece, isEs ? 'Balón Parado' : 'Set Piece', ast.set_piece),
        rFmt(hst.counter_attack, isEs ? 'Contraataque' : 'Counter Attack', ast.counter_attack),
        rFmt(hst.penalty, isEs ? 'Penalti' : 'Penalty', ast.penalty),
        rFmt(hst.total, isEs ? 'Total Remates' : 'Total Shots', ast.total),
        sep52
      );
    }
  }

  // =========================================================================
  // 6 y 7. TABLAS DE RENDIMIENTO INDIVIDUAL (CON FAL/REC Y TAR)
  // =========================================================================
  const homePlayerLines = formatTeamPlayerSection(
    home_players,
    homeName,
    isEs ? 'LOCAL' : 'HOME',
    data.card_incidents,
    isEs
  );

  const awayPlayerLines = formatTeamPlayerSection(
    away_players,
    awayName,
    isEs ? 'VISITANTE' : 'AWAY',
    data.card_incidents,
    isEs
  );
  awayPlayerLines.push('='.repeat(92));

  // Consolidación final del texto plano
  return [
    ...teamComparisonLines,
    ...incidentsLines,
    ...halvesLines,
    ...tacticsLines,
    ...homePlayerLines,
    ...awayPlayerLines,
  ].join('\n');
}
