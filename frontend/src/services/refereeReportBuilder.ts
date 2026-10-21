import type { RefereeSummary, RefereeMatchItem } from '../types/referee';

export interface RefereeReportData {
  referee: RefereeSummary;
  recentMatches: RefereeMatchItem[];
}

/**
 * Builds a clean, quantitative markdown report for a referee without promotional fluff.
 */
export function buildRefereeReport(data: RefereeReportData): string {
  const { referee, recentMatches } = data;

  const cardsAvg = referee.cards_avg.toFixed(2);
  const yellowsAvg = referee.yellow_cards_avg.toFixed(2);
  const redsAvg = referee.red_cards_avg.toFixed(2);
  const redsTotal = referee.red_cards_total;
  const pensTotal = referee.penalties_total;
  const pensAvg = referee.penalties_avg.toFixed(2);
  const foulsAvg = referee.fouls_avg.toFixed(1);
  const over45Pct = referee.over_4_5_cards_pct.toFixed(1);

  // Compute exact count of matches > 4.5 cards
  const over45Count = Math.round((referee.over_4_5_cards_pct / 100) * referee.matches_count);
  const homeCardsPct = referee.home_cards_pct.toFixed(0);
  const awayCardsPct = (100 - referee.home_cards_pct).toFixed(0);

  // Format the last 5 matches
  const matchesToFormat = recentMatches.slice(0, 5);
  const matchesList = matchesToFormat
    .map((m, idx) => {
      const matchDate = m.date ? m.date.slice(0, 10) : 'N/D';
      const roundStr = m.round ? ` F${m.round}` : '';
      const homeName = m.home_team.short_name || m.home_team.name;
      const awayName = m.away_team.short_name || m.away_team.name;
      const totalCards = m.yellow_cards + m.red_cards;
      const y1t = m.yellow_cards_split?.first_half ?? 0;
      const y2t = m.yellow_cards_split?.second_half ?? 0;

      return `${idx + 1}. [${matchDate} - ${m.tournament}${roundStr}] ${homeName} ${m.home_score}-${m.away_score} ${awayName}\n   Tarjetas: ${totalCards} (${m.yellow_cards} 🟨 [1T: ${y1t} | 2T: ${y2t}] + ${m.red_cards} 🟥) | Penales: ${m.penalties} | Faltas: ${m.fouls}`;
    })
    .join('\n');

  return `# REPORTE ARBITRAL: ${referee.name.toUpperCase()}
Competición: Liga 1 2026 | Partidos Dirigidos: ${referee.matches_count} | País: ${referee.country}

---

### 1. MÉTRICAS CONSOLIDADAS
- Tarjetas Totales / PJ: ${cardsAvg} (${yellowsAvg} Amarillas + ${redsAvg} Rojas)
- Tarjetas Rojas: ${redsTotal} totales (${redsAvg} / pj)
- Penales Sancionados: ${pensTotal} totales (${pensAvg} / pj)
- Faltas Cobradas: ${foulsAvg} / pj
- Cumplimiento Línea +4.5 Tarjetas: ${over45Pct}% (${over45Count} de ${referee.matches_count} PJ)
- Distribución Disciplinaria: ${homeCardsPct}% Local | ${awayCardsPct}% Visita

---

### 2. ÚLTIMOS 5 PARTIDOS DIRIGIDOS
${matchesList || 'No hay partidos registrados en la muestra actual.'}`;
}
