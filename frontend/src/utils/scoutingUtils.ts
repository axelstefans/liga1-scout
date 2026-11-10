export const calculateAge = (dobString?: string | null): number | null => {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export const resolvePlayerAge = (
  player?: {
    age?: number | null;
    date_of_birth?: string | null;
    birth_date?: string | null;
    player_age?: number | null;
  } | null
): number | null => {
  if (!player) return null;
  if (typeof player.age === 'number' && !isNaN(player.age) && player.age > 0) return player.age;
  if (
    typeof (player as any).player_age === 'number' &&
    !isNaN((player as any).player_age) &&
    (player as any).player_age > 0
  ) {
    return (player as any).player_age;
  }
  const dob = player.date_of_birth || (player as any).birth_date;
  if (dob) return calculateAge(dob);
  return null;
};

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0,
  };
};

export const getCountryCode = (country?: string | null): string => {
  if (!country) return 'pe';
  const map: Record<string, string> = {
    'peru': 'pe',
    'argentina': 'ar',
    'uruguay': 'uy',
    'brazil': 'br',
    'colombia': 'co',
    'chile': 'cl',
    'ecuador': 'ec',
    'paraguay': 'py',
    'venezuela': 've',
    'bolivia': 'bo',
    'spain': 'es',
    'mexico': 'mx',
    'united states': 'us',
  };
  return map[country.toLowerCase()] || 'pe';
};

export function generateNiceTicks(start: number, stop: number, count = 9): number[] {
  const span = stop - start;
  if (span <= 0 || !isFinite(span)) return [start];
  const step = span / Math.max(1, count);
  const power = Math.floor(Math.log10(step));
  const error = step / Math.pow(10, power);
  let factor = 1;
  if (error >= Math.sqrt(50)) factor = 10;
  else if (error >= Math.sqrt(12.5)) factor = 5;
  else if (error >= Math.sqrt(5)) factor = 2.5;
  else if (error >= Math.sqrt(2)) factor = 2;
  else factor = 1;
  const niceStep = factor * Math.pow(10, power);
  const firstTick = Math.ceil(start / niceStep) * niceStep;
  const ticks: number[] = [];
  const eps = niceStep / 1000;
  for (let t = firstTick; t <= stop + eps; t += niceStep) {
    const rounded = Number(t.toFixed(6));
    if (rounded >= start - eps && rounded <= stop + eps) {
      ticks.push(rounded);
    }
  }
  return ticks;
}

export function formatScatterTickLabel(val: number, step = 1): string {
  const precision = Math.abs(step - Math.round(step)) < 1e-6
    ? 0
    : Math.abs(step * 10 - Math.round(step * 10)) < 1e-6
      ? 1
      : 2;
  const zeroStr = precision === 0 ? '0' : (0).toFixed(precision);
  if (Math.abs(val) < 1e-9) return zeroStr;
  const isNeg = val < -1e-9;
  const absVal = Math.abs(val);
  const formatted = precision === 0 ? Math.round(absVal).toString() : absVal.toFixed(precision);
  if (parseFloat(formatted) === 0) return zeroStr;
  return isNeg ? `\u2212${formatted}` : formatted;
}
