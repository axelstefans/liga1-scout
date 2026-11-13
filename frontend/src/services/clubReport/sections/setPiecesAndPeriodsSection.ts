import {
  formatMarkdownTable,
  formatNullableFixed,
  formatSignedFixed,
} from '../reportFormatters';
import type { ClubReportData } from '../reportTypes';

/** Builds Section 3 Markdown lines: Set Pieces, Corners, Penalties, and Crosses. */
export function buildSetPiecesSectionLines(data: ClubReportData): string[] {
  const sp = data.setPieces;
  const cornersForStr = formatNullableFixed(sp.cornersForAvg, 1);
  const cornersAgStr = formatNullableFixed(sp.cornersAgainstAvg, 1);
  const cornersTotStr = formatNullableFixed(sp.cornersTotalAvg, 1);

  const ownCornerLinesStr =
    sp.over45CornersForPct != null && sp.over55CornersForPct != null
      ? `- **Líneas Propias:** +4.5 Córners a Favor (${sp.over45CornersForPct}%) | +5.5 Córners a Favor (${sp.over55CornersForPct}%)`
      : null;

  return [
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
}

/** Builds Section 4 Markdown lines: Match Dynamics & 1T vs 2T Splits. */
export function buildPeriodDynamicsSectionLines(data: ClubReportData): string[] {
  const pd = data.periodDynamics;
  return [
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
}

/** Builds Section 5 Markdown lines: Cards, Card Lines, and Fouls Balance. */
export function buildDisciplineSectionLines(data: ClubReportData): string[] {
  const disc = data.discipline;
  const cardsForcedStr = formatNullableFixed(disc.cardsForcedAvg, 1);
  const cardsMatchTotStr = formatNullableFixed(disc.cardsMatchTotalAvg, 1);
  const foulsCommittedStr = formatNullableFixed(disc.foulsCommittedAvg, 1);
  const foulsDrawnStr = formatNullableFixed(disc.foulsDrawnAvg, 1);

  return [
    '### 5. DISCIPLINA & FALTAS',
    `- **Tarjetas / PJ:** ${disc.yellowsAvg.toFixed(1)} amarillas/pj + ${disc.redsAvg.toFixed(1)} rojas/pj (${disc.cardsTotalAvg.toFixed(1)} total/pj)`,
    `- **Tarjetas Provocadas:** ${cardsForcedStr} / pj | Total partido: ${cardsMatchTotStr} / pj`,
    `- **Tarjetas Rojas:** ${disc.redCardsTotal} totales (${disc.redCardsAvg.toFixed(2)} / pj)`,
    `- **Concentración 2T:** ${disc.cards2hPct}% de las tarjetas recibidas en el segundo tiempo`,
    `- **Líneas de Tarjetas:** Línea +3.5 (${disc.over35CardsPct}%) | Línea +4.5 (${disc.over45CardsPct}%)`,
    `- **Faltas / PJ:** ${foulsCommittedStr} cometidas vs ${foulsDrawnStr} recibidas (${disc.foulsNetStr})`,
  ];
}

/** Builds Section 6 Markdown lines: Most Used Starting XI Table. */
export function buildMostUsedXISectionLines(data: ClubReportData): string[] {
  const rows =
    data.mostUsedXI.players.length > 0
      ? data.mostUsedXI.players.map((p) => [
          p.slot,
          p.name,
          `${p.minutesSharePct}%`,
          `${p.starts}`,
          `${p.ga}`,
          p.xg,
          p.shotsP90,
          p.foulsP90,
          p.disciplineStr,
          p.setPieceRolesStr,
        ])
      : [['-', 'Sin datos de alineación base disponibles', '-', '-', '-', '-', '-', '-', '-', '-']];

  return [
    `### 6. ONCE BASE MÁS UTILIZADO (${data.mostUsedXI.formation})`,
    `- **Esquema Base:** ${data.mostUsedXI.formation}`,
    ...formatMarkdownTable(
      ['Pos', 'Jugador', '% Min', 'Tit', 'G+A', 'xG', 'Tiros/90', 'Faltas/90', 'Disciplina', 'Rol BP'],
      [':---:', ':---', ':---:', ':---:', ':---:', ':---:', ':---:', ':---:', ':---:', ':---:'],
      rows
    ),
  ];
}

/** Builds Section 7 Markdown lines: Goalkeeper (xGOT) & Territorial Control. */
export function buildFlashscoreGoalkeeperSectionLines(data: ClubReportData): string[] {
  const fsLines: string[] = ['### 7. ARQUERO (xGOT) & CONTROL TERRITORIAL'];

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
    const gpStr = formatSignedFixed(fs.goalsPrevented, 2);
    const gpmStr = formatSignedFixed(fs.preventedPerMatch, 2);
    const net1TStr = formatSignedFixed(fs.netXg1T, 2);
    const net2TStr = formatSignedFixed(fs.netXg2T, 2);

    fsLines.push(
      `- **Rendimiento Bajo Palos:** ${gpStr} goles prevenidos (${gpmStr} / pj) | xGOT recibido: ${fs.xgotFaced.toFixed(2)} vs ${fs.goalsConceded} GC`,
      `- **Diferencial xG Neto:** 1T: ${net1TStr} vs 2T: ${net2TStr}`,
      `- **Toques en Área Rival:** ${fs.avgTouchesBox.toFixed(1)} / pj (1T: ${fs.touches1T.toFixed(1)} vs 2T: ${fs.touches2T.toFixed(1)})`,
      `- **Pases al Último Tercio:** ${fs.avgP3.toFixed(1)} / pj (1T: ${fs.p3_1T.toFixed(1)} vs 2T: ${fs.p3_2T.toFixed(1)})`
    );
  } else {
    fsLines.push(
      '- Sin datos avanzados de control de área y post-impacto disponibles en la muestra seleccionada.'
    );
  }

  return fsLines;
}
