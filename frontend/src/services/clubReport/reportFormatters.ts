import type { ContextFilter, VenueFilter } from '../api';

/**
 * Formats a number with fixed decimals when present, or returns fallback (`'N/D'`).
 */
export function formatNullableFixed(
  value: number | null | undefined,
  decimals = 1,
  fallback = 'N/D'
): string {
  return value != null ? value.toFixed(decimals) : fallback;
}

/**
 * Computes rounded integer percentage (`0-100`) from count/total, returning `0` when total is missing or zero.
 */
export function calcRoundedPct(count?: number | null, total?: number | null): number {
  return count != null && total != null && total > 0 ? Math.round((count / total) * 100) : 0;
}

/**
 * Formats signed numeric delta with `+` prefix when `value >= 0` (used for xG/xGOT/goals prevented).
 */
export function formatSignedFixed(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}`;
}

/**
 * Formats signed integer goal difference with `+` prefix strictly when positive.
 */
export function formatGoalDiffSign(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}`;
}

/**
 * Builds the human-readable net fouls balance descriptor.
 */
export function formatFoulsNetBalance(foulsNet: number): string {
  if (foulsNet > 0) {
    return `+${foulsNet.toFixed(1)} cometidas vs recibidas`;
  }
  if (foulsNet < 0) {
    return `+${Math.abs(foulsNet).toFixed(1)} recibidas vs cometidas`;
  }
  return '0.0 balance neutral';
}

/**
 * Formats player yellow/red card discipline summary including Liga 1 suspension risk (`En Capilla`).
 */
export function formatPlayerDiscipline(
  rawYc: number,
  rawRc: number
): { isEnCapilla: boolean; disciplineStr: string } {
  const isEnCapilla = rawYc === 4 || (rawYc > 0 && rawYc % 5 === 4);
  const discParts: string[] = [];
  if (rawYc > 0) {
    discParts.push(`${rawYc} 🟨${isEnCapilla ? ' (En Capilla)' : ''}`);
  }
  if (rawRc > 0) {
    discParts.push(`${rawRc} 🟥`);
  }
  return {
    isEnCapilla,
    disciplineStr: discParts.length > 0 ? discParts.join(' ') : '—',
  };
}

/**
 * Resolves Spanish UI/report filter labels for tournament, venue, context, and perspective.
 */
export function resolveReportScopeLabels(
  selectedTournament: 'all' | 'Apertura' | 'Clausura',
  venue: VenueFilter,
  contextFilter: ContextFilter,
  perspective: 'for' | 'against'
): {
  tournamentLabel: string;
  venueLabel: string;
  contextLabel: string;
  perspectiveLabel: string;
  isNonDefaultVenue: boolean;
  isNonDefaultContext: boolean;
  isNonDefaultPerspective: boolean;
} {
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
    perspective === 'for' ? 'A Favor' : 'En Contra (Fase defensiva)';

  return {
    tournamentLabel,
    venueLabel,
    contextLabel,
    perspectiveLabel,
    isNonDefaultVenue: venue !== 'all',
    isNonDefaultContext: contextFilter !== 'all',
    isNonDefaultPerspective: perspective !== 'for',
  };
}

/**
 * Formats a Markdown pipe table from headers, column alignment strings, and row cells.
 */
export function formatMarkdownTable(
  headers: string[],
  alignments: string[],
  rows: string[][]
): string[] {
  const headerLine = `| ${headers.join(' | ')} |`;
  const alignLine = `| ${alignments.join(' | ')} |`;
  const rowLines = rows.map((cells) => `| ${cells.join(' | ')} |`);
  return [headerLine, alignLine, ...rowLines];
}
