import type { RefereeSummary, RefereeMatchItem } from '../types/referee';

export interface RefereeReportData {
  referee: RefereeSummary;
  recentMatches: RefereeMatchItem[];
}

/**
 * Builds a clean, quantitative markdown report for a referee matching the refined specification.
 */
export function buildRefereeReport(data: RefereeReportData): string {
  const { referee, recentMatches } = data;

  // Compute exact count of matches > 4.5 cards
  const over45Count = Math.round((referee.over_4_5_cards_pct / 100) * referee.matches_count);
  const homeCardsPct = referee.home_cards_pct.toFixed(0);
  const awayCardsPct = (100 - referee.home_cards_pct).toFixed(0);

  // Format up to 5 recent matches
  const matchesToFormat = recentMatches.slice(0, 5);
  const matchesList = matchesToFormat
    .map((m, idx) => {
      const lineTag = m.over_4_5_cards ? 'OVER 4.5' : 'UNDER 4.5';
      const matchDate = m.date ? m.date.slice(0, 10) : 'N/D';
      const roundStr = m.round ? ` F${m.round}` : '';
      const homeName = m.home_team.name;
      const awayName = m.away_team.name;
      const totalCards = m.yellow_cards + m.red_cards;
      const y1t = m.yellow_cards_split?.first_half ?? 0;
      const y2t = m.yellow_cards_split?.second_half ?? 0;

      return `${idx + 1}. [${lineTag}] [${matchDate} - ${m.tournament}${roundStr}] ${homeName} ${m.home_score}-${m.away_score} ${awayName}\n   Tarjetas: ${totalCards} (${m.yellow_cards} 🟨 [1T: ${y1t} | 2T: ${y2t}] + ${m.red_cards} 🟥) | Penales: ${m.penalties} | Faltas: ${m.fouls}`;
    })
    .join('\n');

  return `# REPORTE ARBITRAL: ${referee.name.toUpperCase()}
Competición: Liga 1 2026 | Partidos Dirigidos: ${referee.matches_count} | Rango: ${referee.category || 'FIFA / CONAR'}

---

### 1. MÉTRICAS CONSOLIDADAS
- Tarjetas / PJ: ${referee.cards_avg.toFixed(2)} (${referee.yellow_cards_avg.toFixed(2)} 🟨 + ${referee.red_cards_avg.toFixed(2)} 🟥) | Rojas Totales: ${referee.red_cards_total} (${referee.red_cards_avg.toFixed(2)} / pj)
- Faltas Cobradas: ${referee.fouls_avg.toFixed(1)} / pj | Penales Sancionados: ${referee.penalties_total} en ${referee.matches_count} PJ (${referee.penalties_avg.toFixed(2)} / pj)
- Cumplimiento Línea +4.5 Tarjetas: ${referee.over_4_5_cards_pct.toFixed(1)}% (${over45Count} de ${referee.matches_count} PJ)
- Tarjetas 1T vs 2T: ${referee.cards_1t_avg.toFixed(1)} en 1T vs ${referee.cards_2t_avg.toFixed(1)} en 2T | Línea +1.5 Tarjetas 1T: ${referee.over_1_5_cards_1t_pct.toFixed(1)}% (${referee.over_1_5_cards_1t_count} de ${referee.matches_count} PJ)
- Sesgo Disciplinario: ${homeCardsPct}% Local | ${awayCardsPct}% Visita

---

### 2. ÚLTIMOS 5 PARTIDOS DIRIGIDOS
${matchesList || 'No hay partidos registrados en la muestra actual.'}`;
}
