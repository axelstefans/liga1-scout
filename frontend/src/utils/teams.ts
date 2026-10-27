/**
 * Utility to resolve local team crest URL from teamId or sofa logo_url.
 * Guarantees zero external network requests to sofascore.app.
 */
export const getTeamCrestUrl = (teamId?: number | string | null, logoUrl?: string | null): string => {
  if (teamId) {
    return `/teams/${teamId}.png`;
  }
  if (logoUrl) {
    const match = String(logoUrl).match(/team\/(\d+)\/image/);
    if (match && match[1]) {
      return `/teams/${match[1]}.png`;
    }
    if (String(logoUrl).startsWith('/teams/')) {
      return String(logoUrl);
    }
  }
  return '/liga1-logo.png';
};

export interface TeamColorDefinition {
  name: string;
  color: string;
  accent: string;
  fill: string;
}

/**
 * Fuente única de verdad de colores de equipo de Liga 1.
 * Indexado por team_id:
 * - color: camiseta local
 * - accent: color de interfaz con contraste verificado (texto / líneas finas)
 * - fill: color de relleno para gráficos (gajos, barras, polígonos, burbujas)
 */
export const TEAM_COLORS: Record<number, TeamColorDefinition> = {
  511206: { name: 'ACD Juan Pablo II', color: '#fdb813', accent: '#111622', fill: '#c87a00' },
  2307: { name: 'Alianza Atlético de Sullana', color: '#1556e3', accent: '#1556e3', fill: '#1556e3' },
  2311: { name: 'Alianza Lima', color: '#011b57', accent: '#011b57', fill: '#011b57' },
  335557: { name: 'Asociación Deportiva Tarma', color: '#0090e3', accent: '#06254b', fill: '#007cc2' },
  492848: { name: 'CD Moquegua', color: '#040404', accent: '#040404', fill: '#040404' },
  2301: { name: 'Cienciano', color: '#be292f', accent: '#be292f', fill: '#be292f' },
  282538: { name: 'Club Atlético Grau', color: '#eef0fa', accent: '#b50007', fill: '#e1010a' },
  2302: { name: 'Club Sporting Cristal', color: '#07b4ee', accent: '#004b87', fill: '#38a9e6' },
  213609: { name: 'Comerciantes Unidos', color: '#59229e', accent: '#59229e', fill: '#59229e' },
  63760: { name: 'Cusco FC', color: '#cbb28d', accent: '#111315', fill: '#c59b4c' },
  458584: { name: 'Deportivo Garcilaso', color: '#38b6ff', accent: '#d32f2f', fill: '#2298e6' },
  1082002: { name: 'FC Cajamarca', color: '#ffdd00', accent: '#ffdd00', fill: '#0c3fa8' },
  252254: { name: 'Los Chankas CYC', color: '#5c1124', accent: '#f07822', fill: '#5c1124' },
  2308: { name: 'Melgar', color: '#8e1420', accent: '#8e1420', fill: '#8e1420' },
  2312: { name: 'Sport Boys', color: '#f49bc4', accent: '#0f172a', fill: '#df4b88' },
  33895: { name: 'Sport Huancayo', color: '#d32429', accent: '#d32429', fill: '#d32429' },
  2305: { name: 'Universitario de Deportes', color: '#e9e0c5', accent: '#8f132b', fill: '#8f132b' },
  87854: { name: 'Univ. Técnica de Cajamarca', color: '#e1d0c1', accent: '#933c3f', fill: '#933c3f' },
};

/**
 * Normaliza nombres de equipo (minúsculas, sin tildes/diacríticos, sin puntuación, sin espacios dobles)
 */
export const normalizeTeamName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const TEAM_NAME_ALIASES: Record<string, number> = {
  'utc': 87854,
  'universidad tecnica de cajamarca': 87854,
  'utc cajamarca': 87854,
  'adt': 335557,
  'ad tarma': 335557,
  'tarma': 335557,
  'sporting cristal': 2302,
  'cristal': 2302,
  'universitario': 2305,
  'los chankas': 252254,
  'chankas': 252254,
  'cusco': 63760,
  'grau': 282538,
  'atletico grau': 282538,
  'alianza atletico': 2307,
  'sullana': 2307,
  'juan pablo ii': 511206,
  'juan pablo ii college': 511206,
  'adc juan pablo ii college': 511206,
  'moquegua': 492848,
  'deportivo moquegua': 492848,
  'fbc melgar': 2308,
  'sport boys association': 2312,
  'csd sport huancayo': 33895,
  'garcilaso': 458584,
  'cajamarca': 1082002,
};

const findTeamColorEntry = (teamId?: number | null, teamName?: string | null): TeamColorDefinition | null => {
  if (teamId && TEAM_COLORS[teamId]) {
    return TEAM_COLORS[teamId];
  }
  if (!teamName) return null;

  const normalized = normalizeTeamName(teamName);
  if (!normalized) return null;

  // 1. Coincidencia directa contra name normalizado en TEAM_COLORS
  for (const entry of Object.values(TEAM_COLORS)) {
    if (normalizeTeamName(entry.name) === normalized) {
      return entry;
    }
  }

  // 2. Coincidencia por alias / nombre corto / variantes comunes
  const aliasId = TEAM_NAME_ALIASES[normalized];
  if (aliasId && TEAM_COLORS[aliasId]) {
    return TEAM_COLORS[aliasId];
  }

  // 3. Coincidencia parcial si contiene el nombre clave
  for (const entry of Object.values(TEAM_COLORS)) {
    const entryNorm = normalizeTeamName(entry.name);
    if (normalized.includes(entryNorm) || entryNorm.includes(normalized)) {
      return entry;
    }
  }

  return null;
};

/**
 * Color de relleno para gráficos (radar pizza, barras, polígonos, burbujas scatter)
 */
export const getTeamThemeColor = (
  teamName?: string | null,
  _primaryColor?: string | null,
  teamId?: number | null
): string => {
  const entry = findTeamColorEntry(teamId, teamName);
  return entry ? entry.fill : '#475569';
};

/**
 * Color de texto o líneas finas con contraste verificado para fondos claros de interfaz
 */
export const getTeamTextColor = (
  teamName?: string | null,
  _primaryColor?: string | null,
  teamId?: number | null
): string => {
  const entry = findTeamColorEntry(teamId, teamName);
  return entry ? entry.accent : '#475569';
};

/**
 * Color de camiseta local
 */
export const getTeamShirtColor = (
  teamName?: string | null,
  _primaryColor?: string | null,
  teamId?: number | null
): string => {
  const entry = findTeamColorEntry(teamId, teamName);
  return entry ? entry.color : '#475569';
};

/**
 * Calcula la luminancia relativa según WCAG 2.1
 */
export const getRelativeLuminance = (hexColor: string): number => {
  const hex = hexColor.replace(/^#/, '');
  if (hex.length !== 6) return 0.5;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

/**
 * Retorna '#FFFFFF' para texto de pastillas/badges de datos sobre fondo de club.
 */
export const getBadgeTextColor = (_bgColor?: string): '#FFFFFF' => {
  return '#FFFFFF';
};

export const TEAM_TRICODES: Record<number, string> = {
  2311: 'ALI',
  2305: 'UNI',
  2302: 'CRI',
  2308: 'MEL',
  63760: 'CUS',
  2301: 'CIE',
  335557: 'ADT',
  282538: 'GRA',
  2307: 'AAT',
  2312: 'SBO',
  33895: 'SHU',
  252254: 'CHA',
  458584: 'GAR',
  87854: 'UTC',
  213609: 'COM',
  511206: 'JPA',
  1082002: 'CAJ',
  492848: 'MOQ',
};

export const getTeamTricode = (teamId?: number | null, teamName?: string | null): string => {
  if (teamId && TEAM_TRICODES[teamId]) return TEAM_TRICODES[teamId];
  if (!teamName) return 'L1';
  const name = teamName.toLowerCase();
  if (name.includes('alianza lima')) return 'ALI';
  if (name.includes('universitario')) return 'UNI';
  if (name.includes('cristal')) return 'CRI';
  if (name.includes('melgar')) return 'MEL';
  if (name.includes('cusco')) return 'CUS';
  if (name.includes('cienciano')) return 'CIE';
  if (name.includes('adt') || name.includes('tarma')) return 'ADT';
  if (name.includes('grau')) return 'GRA';
  if (name.includes('sullana') || name.includes('atlético')) return 'AAT';
  if (name.includes('boys')) return 'SBO';
  if (name.includes('huancayo')) return 'SHU';
  if (name.includes('chankas')) return 'CHA';
  if (name.includes('garcilaso')) return 'GAR';
  if (name.includes('utc')) return 'UTC';
  if (name.includes('comerciantes')) return 'COM';
  if (name.includes('juan pablo')) return 'JPA';
  if (name.includes('cajamarca')) return 'CAJ';
  if (name.includes('moquegua')) return 'MOQ';
  return teamName.substring(0, 3).toUpperCase();
};
