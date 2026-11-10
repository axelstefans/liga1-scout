/**
 * playerFormatters.ts
 * Pure TypeScript utilities for formatting player names according to professional
 * sports analytics standards (Opta / StatsBomb / Liga 1 Perú).
 */

const COMPOUND_PREFIXES = new Set([
  'di',
  'de',
  'del',
  'da',
  'la',
  'las',
  'los',
  'dos',
  'das',
  'van',
  'von',
  'san',
  'santa',
  'al',
  'el',
]);

/**
 * Capitalizes a token properly (e.g. "di" -> "Di", "del" -> "Del", "pretell" -> "Pretell").
 */
function capitalize(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Formats a player's full name into Opta standard style: "Initial. Surname"
 * 
 * Examples:
 * - "Jesús Emanuel Pretell Panta" -> "J. Pretell" (4 tokens: 2 given names + paternal + maternal)
 * - "Matías Di Benedetto" -> "M. Di Benedetto" (compound surname)
 * - "José Miguel De La Cruz" -> "J. De La Cruz" (multi-particle compound)
 * - "Carlos Alberto del Solar" -> "C. Del Solar" (compound surname)
 * - "Paolo Guerrero" -> "P. Guerrero" (standard given + surname)
 * - "Cueva" -> "Cueva" (single mononym)
 * 
 * @param fullName The full raw name of the player
 * @returns Formatted Opta-style name string
 */
export function formatOptaName(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return '';
  if (parts.length === 1) return parts[0];

  const initial = parts[0].charAt(0).toUpperCase();

  // Case A: Multi-particle compound surname, e.g. "José Miguel De La Cruz" -> "J. De La Cruz"
  if (
    parts.length >= 4 &&
    COMPOUND_PREFIXES.has(parts[parts.length - 3].toLowerCase()) &&
    COMPOUND_PREFIXES.has(parts[parts.length - 2].toLowerCase())
  ) {
    const p1 = capitalize(parts[parts.length - 3]);
    const p2 = capitalize(parts[parts.length - 2]);
    const p3 = capitalize(parts[parts.length - 1]);
    return `${initial}. ${p1} ${p2} ${p3}`;
  }

  // Case B: Single-particle compound surname, e.g. "Matías Di Benedetto", "Carlos del Solar"
  if (
    parts.length >= 3 &&
    COMPOUND_PREFIXES.has(parts[parts.length - 2].toLowerCase())
  ) {
    const prefix = capitalize(parts[parts.length - 2]);
    const surname = capitalize(parts[parts.length - 1]);
    return `${initial}. ${prefix} ${surname}`;
  }

  // Case C: Standard Hispanic 4-part legal name: [Given1, Given2, PaternalSurname, MaternalSurname]
  // In Peruvian football, the professional known name uses the paternal surname (parts[2]),
  // e.g. "Jesús Emanuel Pretell Panta" -> "J. Pretell" (NOT "J. Panta").
  if (parts.length === 4) {
    const paternalSurname = capitalize(parts[2]);
    return `${initial}. ${paternalSurname}`;
  }

  // Case D: 5+ parts without matched particles: resolve second-to-last as paternal surname
  if (parts.length >= 5) {
    const paternalSurname = capitalize(parts[parts.length - 2]);
    return `${initial}. ${paternalSurname}`;
  }

  // Case E: 2 or 3 parts without compound particles:
  // e.g. "Paolo Guerrero" -> "P. Guerrero", "Álvaro Ampuero" -> "Á. Ampuero"
  const surname = capitalize(parts[parts.length - 1]);
  return `${initial}. ${surname}`;
}

/**
 * Canonical alias for formatOptaName to maintain backward-compatibility across all visual charts.
 */
export const formatPlayerName = formatOptaName;

/**
 * Extracts only the player's primary short surname or mononym (without initial).
 * E.g. "Jesús Emanuel Pretell Panta" -> "Pretell", "Matías Di Benedetto" -> "Di Benedetto".
 */
export function getShortSurname(fullName: string): string {
  const formatted = formatOptaName(fullName);
  if (!formatted.includes('.')) return formatted;
  return formatted.split('.').slice(1).join('.').trim();
}

/**
 * Extracts initials for avatar / badge rendering.
 * E.g. "Paolo Guerrero" -> "PG", "Jesús Emanuel Pretell Panta" -> "JP".
 */
export function getPlayerInitials(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  const firstInitial = parts[0].charAt(0).toUpperCase();
  const shortSurname = getShortSurname(fullName);
  const surnameInitial = shortSurname.charAt(0).toUpperCase();

  return `${firstInitial}${surnameInitial}`;
}

export default formatOptaName;
