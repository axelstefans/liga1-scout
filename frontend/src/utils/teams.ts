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

export const TEAM_COLOR_OVERRIDES: Record<string, string> = {
  // Existing & fixed
  "Cusco FC": "#D4AF37",
  "Cusco": "#D4AF37",
  "Comerciantes Unidos": "#5B2C6F",
  "Melgar": "#E30613",
  "FBC Melgar": "#E30613",
  "Alianza Atlético": "#004797",
  "Alianza Atletico de Sullana": "#004797",
  "UTC": "#E8C32E",
  "UTC Cajamarca": "#E8C32E",
  "Universidad Técnica de Cajamarca": "#E8C32E",

  // Big teams
  "Alianza Lima": "#00306f",
  "Universitario": "#A67C52",
  "Universitario de Deportes": "#A67C52",
  "Sporting Cristal": "#00AEEF",
  "Club Sporting Cristal": "#00AEEF",

  // Rest of Liga 1 2026
  "Los Chankas": "#F5A623",
  "CD Los Chankas": "#F5A623",
  "Cienciano": "#CC0000",
  "Deportivo Garcilaso": "#00a5d5",
  "ADT": "#005bed",
  "AD Tarma": "#005bed",
  "Sport Boys": "#FF69B4",
  "Sport Boys Association": "#FF69B4",
  "Atlético Grau": "#FFCC00",
  "Sport Huancayo": "#CC0000",
  "CSD Sport Huancayo": "#CC0000",
  "Juan Pablo II College": "#ffd900d3",
  "ADC Juan Pablo II College": "#ffd900d3",
  "FC Cajamarca": "#0f3e5b",
  "CD Moquegua": "#ffd900d3",
  "Deportivo Moquegua": "#ffd900d3",
};

export const getTeamThemeColor = (teamName?: string | null, primaryColor?: string | null): string => {
  if (!teamName) return primaryColor || '#0ea5e9';
  const color = TEAM_COLOR_OVERRIDES[teamName] || primaryColor || '#0ea5e9';
  if (color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#fff') {
    return '#0ea5e9';
  }
  return color;
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
