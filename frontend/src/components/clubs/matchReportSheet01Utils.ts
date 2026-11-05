import {
  MatchSheetModule01GoalItem,
  MatchSheetModule02ChanceBalance,
  MatchSheetModule06TeamStats,
} from '../../services/api';
import { MatchSheet01Translations } from '../../i18n/scoutingReport';
import { TEAM_COLORS, getTeamThemeColor } from '../../utils/teams';

export const SVG_FONT_SANS = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const SVG_FONT_MONO = "'JetBrains Mono', monospace, Inter, sans-serif";

const MONTHS_ES_DEFAULT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export function formatEditorialDate(
  isoDate?: string | null,
  months: string[] = MONTHS_ES_DEFAULT
): string {
  if (!isoDate) return '';
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const monthName = months[monthIdx] || parts[1];
  return `${day} ${monthName} ${year}`;
}

export function formatShortPlayerName(fullName: string | null): string {
  if (!fullName) return '';
  const clean = fullName.replace(/\s*\((AG|OG)\)\s*$/, '').trim();
  if (clean.includes(',')) {
    const [surname, first] = clean.split(',').map((s) => s.trim());
    const init = first ? `${first.charAt(0).toUpperCase()}. ` : '';
    return `${init}${surname}`;
  }
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const init = parts[0].charAt(0).toUpperCase();
  const surname = parts[parts.length - 1];
  return `${init}. ${surname}`;
}

export function getShotBubbleRadius(xg: number): number {
  return Math.max(4.2, Math.min(14.5, Math.sqrt(Math.max(0.015, xg)) * 21));
}

export function buildStarPoints(cx: number, cy: number, outerR: number, innerR: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`);
  }
  return pts.join(' ');
}

export function formatNullableDecimal(val: number | null | undefined, decimals: number = 2): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return val.toFixed(decimals);
}

export function formatNullableInt(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return String(Math.round(val));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return [15, 23, 42];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorDistance(hexA: string, hexB: string): number {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

export interface EditorialTeamPalette {
  homeColor: string;
  awayColor: string;
  areColorsSimilar: boolean;
}

/**
 * Colores secundarios contrastantes oficiales de clubes Liga 1.
 * Asignados cuando existe similitud cromática (ej. UTC granate vs Melgar rojo/negro -> Melgar #1a1a1a).
 */
const TEAM_SECONDARY_COLORS: Record<number, string> = {
  2308: '#1a1a1a', // Melgar: Rojinegro -> Negro sólido
  2301: '#111827', // Cienciano -> Azul marino carbón
  33895: '#15803d', // Sport Huancayo: Rojo / Verde
  2305: '#1a1a1a', // Universitario -> Granate / Carbón
  87854: '#1e293b', // UTC -> Granate / Azul carbón
  2302: '#004b87', // Sporting Cristal -> Celeste / Azul marino profundo
  458584: '#d32f2f', // Deportivo Garcilaso -> Celeste / Rojo
  335557: '#06254b', // ADT -> Celeste / Azul marino profundo
  2307: '#0f172a', // Alianza Atlético -> Azul / Marino
  2311: '#c59b4c', // Alianza Lima -> Azul / Dorado
  252254: '#f07822', // Los Chankas -> Granate / Naranja
  2312: '#1a1a1a', // Sport Boys -> Rosado / Negro
  282538: '#0b1f44', // Grau -> Rojo / Azul marino
  511206: '#111622', // Juan Pablo II -> Amarillo / Negro
  63760: '#111315', // Cusco FC -> Dorado / Negro
  213609: '#0f172a', // Comerciantes Unidos -> Morado / Carbón
  492848: '#1a1a1a', // CD Moquegua -> Negro
  1082002: '#0c3fa8', // FC Cajamarca -> Azul
};

/**
 * Resolves high-contrast club colors on #ffffff without mutating TEAM_COLORS.
 * - Uses TEAM_COLORS[id].fill via getTeamThemeColor.
 * - When chromatic similarity occurs (dist < 95, e.g. UTC granate vs Melgar rojinegro):
 *   preserves Home primary and assigns Away its official contrasting secondary (solid black #1a1a1a for Melgar).
 * - Always keeps areColorsSimilar: false so no module renders wireframe / dashed / hollow / hatched markers.
 */
export function resolveEditorialTeamPalette(
  homeId: number,
  homeName: string,
  awayId: number,
  awayName: string
): EditorialTeamPalette {
  let homeColor = getTeamThemeColor(homeName, null, homeId) || '#0f172a';
  let awayColor = getTeamThemeColor(awayName, null, awayId) || '#0369a1';

  if (relativeLuminance(homeColor) > 0.62) {
    const homeAccent = TEAM_COLORS[homeId]?.accent;
    homeColor = homeAccent && relativeLuminance(homeAccent) <= 0.55 ? homeAccent : '#0f172a';
  }
  if (relativeLuminance(awayColor) > 0.62) {
    const awayAccent = TEAM_COLORS[awayId]?.accent;
    awayColor = awayAccent && relativeLuminance(awayAccent) <= 0.55 ? awayAccent : '#1e293b';
  }

  const dist = colorDistance(homeColor, awayColor);
  if (dist < 95) {
    const officialSecondary = TEAM_SECONDARY_COLORS[awayId];
    if (officialSecondary && colorDistance(homeColor, officialSecondary) >= 90) {
      awayColor = officialSecondary;
    } else {
      const awayAccent = TEAM_COLORS[awayId]?.accent;
      if (
        awayAccent &&
        relativeLuminance(awayAccent) <= 0.55 &&
        colorDistance(homeColor, awayAccent) >= 90
      ) {
        awayColor = awayAccent;
      } else {
        awayColor = colorDistance(homeColor, '#1a1a1a') >= 95 ? '#1a1a1a' : '#0369a1';
      }
    }
  }

  // NUNCA utilizar modo alambre / dashed / hollow / hatched:
  // Siempre líneas sólidas, textos sólidos y marcadores rellenos.
  return { homeColor, awayColor, areColorsSimilar: false };
}

export interface PlacedGoalLabel {
  goal: MatchSheetModule01GoalItem;
  effectiveMin: number;
  minuteText: string;
  labelText: string;
  gx: number;
  gy: number;
  lx: number;
  ly: number;
  stepLevel: number;
  direction: 'up' | 'down';
  hasLeaderLine: boolean;
}

/**
 * Deterministic goal label anti-collision algorithm for Module 01 (xG Flow).
 * 1. Sorts goals by (minute ASC, added_time ?? 0 ASC, originalIndex ASC).
 * 2. Converts (minute, added_time) to effective X position in px:
 *    - 1T added time (45+k): placed at 45 + min(k, 5) * 0.35 so it stays in 1T stoppage band.
 *    - 2T added time (90+k): placed at 90 + k.
 *    - Multiple goals sharing the exact same minute with added_time == null get +0.9m stagger.
 * 3. If horizontal distance to any previously placed label on the same step level is
 *    < LABEL_W + MIN_GAP_X, advances deterministically through step levels 0 -> 1 -> 2
 *    with fixed vertical offsets [16, 33, 50] px and thin leader lines to (gx, gy).
 */
export function computeNiceXgAxis(rawMax: number): { axisMax: number; ticks: number[] } {
  const safeMax = Math.max(0.25, rawMax * 1.12);
  let step = 0.5;
  if (safeMax <= 0.6) {
    step = 0.2;
  } else if (safeMax > 3.5) {
    step = 1.0;
  }
  const axisMax = Math.max(
    step === 0.2 ? 0.4 : 1.0,
    Math.ceil(( safeMax - 1e-6 ) / step) * step
  );
  const count = Math.round(axisMax / step);
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(Number((i * step).toFixed(2)));
  }
  return { axisMax, ticks };
}

export function computeNiceCountAxis(rawMaxCount: number): { axisMax: number; ticks: number[] } {
  if (rawMaxCount <= 0) {
    return { axisMax: 4, ticks: [0, 1, 2, 3, 4] };
  }
  let step = 1;
  if (rawMaxCount > 24) {
    step = 5;
  } else if (rawMaxCount > 12) {
    step = 3;
  } else if (rawMaxCount > 5) {
    step = 2;
  }
  const axisMax = Math.max(step * 2, Math.ceil((rawMaxCount + step * 0.35) / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= axisMax; v += step) {
    ticks.push(v);
  }
  return { axisMax, ticks };
}

export function computeGoalLabelLayout(
  goals: MatchSheetModule01GoalItem[],
  minToX: (m: number) => number,
  xgToY: (xg: number) => number,
  plotBounds: { left: number; right: number; top: number; bottom: number },
  _tags?: { ownGoalTag: string; penTag: string }
): PlacedGoalLabel[] {
  const minLx = plotBounds.left + 14;
  const maxLx = plotBounds.right - 14;
  const minLy = plotBounds.top + 8;
  const maxLy = plotBounds.bottom - 4;

  const indexed = goals.map((goal, idx) => ({ goal, idx }));
  indexed.sort((a, b) => {
    if (a.goal.minute !== b.goal.minute) return a.goal.minute - b.goal.minute;
    const addA = a.goal.added_time ?? 0;
    const addB = b.goal.added_time ?? 0;
    if (addA !== addB) return addA - addB;
    return a.idx - b.idx;
  });

  const sameMinCounts = new Map<string, number>();
  let prevLx = -1e9;
  let prevLy = -1e9;

  return indexed.map(({ goal }) => {
    const key = `${goal.period || '2T'}-${goal.minute}-${goal.added_time ?? 'null'}`;
    const occ = sameMinCounts.get(key) ?? 0;
    sameMinCounts.set(key, occ + 1);

    let effectiveMin = goal.minute;
    if (goal.added_time !== null && goal.added_time > 0) {
      if (goal.minute === 45 && goal.period === '1T') {
        effectiveMin = 45 + Math.min(goal.added_time, 5) * 0.35;
      } else {
        effectiveMin = goal.minute + goal.added_time;
      }
    } else if (occ > 0) {
      effectiveMin = goal.minute + occ * 0.9;
    }

    const minuteText =
      goal.added_time !== null && goal.added_time > 0
        ? `${goal.minute}+${goal.added_time}'`
        : `${goal.minute}'`;

    const labelText = minuteText;

    const gx = minToX(effectiveMin);
    const gy = xgToY(goal.cum_team_xg);
    let lx = Math.max(minLx, Math.min(maxLx, gx));

    // Anchor directly above the step, or below if too close to top
    let ly = gy - 7;
    if (ly < minLy) {
      ly = gy + 14;
    }

    // If horizontally overlapping with previous goal label (< 22px), alternate position
    if (Math.abs(lx - prevLx) < 22 && Math.abs(ly - prevLy) < 14) {
      if (ly <= gy) {
        ly = gy + 14;
      } else {
        lx = Math.max(minLx, Math.min(maxLx, gx + 12));
      }
    }

    ly = Math.max(minLy, Math.min(maxLy, ly));
    prevLx = lx;
    prevLy = ly;

    return {
      goal,
      effectiveMin,
      minuteText,
      labelText,
      gx,
      gy,
      lx,
      ly,
      stepLevel: 0,
      direction: ly < gy ? 'up' : 'down',
      hasLeaderLine: false,
    };
  });
}

export function buildM02Rows(
  module02: MatchSheetModule02ChanceBalance | null,
  ms: MatchSheet01Translations
) {
  return [
    {
      key: 'goals',
      label: ms.module02.metrics.goals,
      homeVal: module02?.home?.goals ?? null,
      awayVal: module02?.away?.goals ?? null,
      format: (v: number | null) => formatNullableInt(v),
      fixedMax: null as number | null,
    },
    {
      key: 'xg_per_shot',
      label: ms.module02.metrics.xgPerShot,
      homeVal: module02?.home?.xg_per_shot ?? null,
      awayVal: module02?.away?.xg_per_shot ?? null,
      format: (v: number | null) => formatNullableDecimal(v, 2),
      fixedMax: null as number | null,
    },
    {
      key: 'big_chances',
      label: ms.module02.metrics.bigChances,
      homeVal: module02?.home?.big_chances ?? null,
      awayVal: module02?.away?.big_chances ?? null,
      format: (v: number | null) => formatNullableInt(v),
      fixedMax: null as number | null,
    },
    {
      key: 'box_entries',
      label: ms.module02.metrics.boxEntries,
      homeVal: module02?.home?.box_entries ?? null,
      awayVal: module02?.away?.box_entries ?? null,
      format: (v: number | null) => formatNullableInt(v),
      fixedMax: null as number | null,
    },
    {
      key: 'field_tilt_pct',
      label: ms.module02.fieldTiltLabel,
      homeVal: module02?.home?.field_tilt_pct ?? null,
      awayVal: module02?.away?.field_tilt_pct ?? null,
      format: (v: number | null) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`),
      fixedMax: null as number | null,
    },
    {
      key: 'deep_completions',
      label: ms.module02.deepCompletionsLabel,
      homeVal: module02?.home?.deep_completions ?? null,
      awayVal: module02?.away?.deep_completions ?? null,
      format: (v: number | null) => formatNullableInt(v),
      fixedMax: null as number | null,
    },
  ];
}

export function buildM06Rows(
  m06Home: MatchSheetModule06TeamStats | null,
  m06Away: MatchSheetModule06TeamStats | null,
  ms: MatchSheet01Translations
) {
  if (!m06Home || !m06Away) return [];
  return [
    {
      key: 'goals',
      label: ms.module06.categories.goals,
      homeVal: m06Home.goals,
      awayVal: m06Away.goals,
      woodworkHome: 0,
      woodworkAway: 0,
    },
    {
      key: 'saved',
      label: ms.module06.categories.saved,
      homeVal: m06Home.saved,
      awayVal: m06Away.saved,
      woodworkHome: 0,
      woodworkAway: 0,
    },
    {
      key: 'blocked',
      label: ms.module06.categories.blocked,
      homeVal: m06Home.blocked,
      awayVal: m06Away.blocked,
      woodworkHome: 0,
      woodworkAway: 0,
    },
    {
      key: 'off_target',
      label: ms.module06.categories.offTarget,
      homeVal: m06Home.off_target,
      awayVal: m06Away.off_target,
      woodworkHome: m06Home.woodwork,
      woodworkAway: m06Away.woodwork,
    },
  ];
}

/**
 * Transforms an SVG path string defined on the [0, 100] x [0, 100] normalized pitch
 * coordinates into the target viewBox coordinates of the regulation pitch.
 * Supports M, L, and Z path commands with multiple subpaths / loops.
 */
export function scalePathToField(
  svgPath?: string | null,
  fieldLeft: number = 18,
  fieldTop: number = 16,
  fieldWidth: number = 424,
  fieldHeight: number = 258
): string {
  if (!svgPath || !svgPath.trim()) return '';

  const tokens = svgPath.match(/[a-df-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/gi);
  if (!tokens || tokens.length === 0) return '';

  const output: string[] = [];
  let currentCmd = '';
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[a-df-z]$/i.test(token)) {
      currentCmd = token.toUpperCase();
      if (currentCmd === 'Z') {
        output.push('Z');
        i++;
      } else {
        output.push(currentCmd);
        i++;
      }
    } else {
      if (currentCmd === 'M' || currentCmd === 'L') {
        const rawX = parseFloat(token);
        const nextTok = tokens[i + 1];
        if (nextTok !== undefined && !/^[a-df-z]$/i.test(nextTok)) {
          const rawY = parseFloat(nextTok);
          const clampedX = Math.max(0, Math.min(100, rawX));
          const clampedY = Math.max(0, Math.min(100, rawY));
          const px = fieldLeft + (clampedX / 100) * fieldWidth;
          const py = fieldTop + (clampedY / 100) * fieldHeight;
          output.push(`${px.toFixed(1)} ${py.toFixed(1)}`);
          i += 2;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }
  }

  return output.join(' ');
}
