import type { RadarMetricDef, RoleMetricPreset } from './scoutingTypes';

export const RADAR_CENTER_X = 350;
export const RADAR_CENTER_Y = 350;
export const RADAR_MAX_RADIUS = 252;
export const RADAR_LABEL_RADIUS = 307;

export const DEFAULT_PLAYER_ID = 1090720; // Marco Huamán

export const RADAR_METRICS: RadarMetricDef[] = [
  // Attacking / Finishing (Shades of Crimson Red)
  { key: 'goals', pctKey: 'goals_pct', label: 'Goals', shortLabel: 'Goals', category: 'Attacking', color: '#DC2626', hoverColor: '#EF4444' },
  { key: 'expected_goals', pctKey: 'expected_goals_pct', label: 'Expected Goals', shortLabel: 'xG', category: 'Attacking', color: '#EF4444', hoverColor: '#F87171' },
  { key: 'shots_on_target', pctKey: 'shots_on_target_pct', label: 'Shots on Target', shortLabel: 'Shots on Target', category: 'Attacking', color: '#F43F5E', hoverColor: '#FB7185' },

  // Creation / Passing (Shades of Deep Sky Blue)
  { key: 'assists', pctKey: 'assists_pct', label: 'Assists', shortLabel: 'Assists', category: 'Passing', color: '#1D4ED8', hoverColor: '#2563EB' },
  { key: 'key_passes', pctKey: 'key_passes_pct', label: 'Key Passes', shortLabel: 'Key Passes', category: 'Passing', color: '#2563EB', hoverColor: '#3B82F6' },
  { key: 'accurate_passes_percentage', pctKey: 'accurate_passes_percentage_pct', label: 'Pass Accuracy', shortLabel: 'Pass Acc %', category: 'Passing', color: '#3B82F6', hoverColor: '#60A5FA', isPercentage: true },
  { key: 'accurate_final_third_passes', pctKey: 'accurate_final_third_passes_pct', label: 'Final 3rd Passes', shortLabel: 'Final 3rd', category: 'Passing', color: '#0284C7', hoverColor: '#38BDF8' },
  { key: 'successful_dribbles', pctKey: 'successful_dribbles_pct', label: 'Dribbles', shortLabel: 'Dribbles', category: 'Passing', color: '#0EA5E9', hoverColor: '#7DD3FC' },

  // Defending / Physical (Shades of Emerald / Olive)
  { key: 'ground_duels_won_percentage', pctKey: 'ground_duels_won_percentage_pct', label: 'Ground Duels %', shortLabel: 'Ground Duels %', category: 'Defending', color: '#059669', hoverColor: '#10B981', isPercentage: true },
  { key: 'aerial_duels_won', pctKey: 'aerial_duels_won_pct', label: 'Aerial Duels', shortLabel: 'Aerial Duels %', category: 'Defending', color: '#10B981', hoverColor: '#34D399' },
  { key: 'tackles', pctKey: 'tackles_pct', label: 'Tackles', shortLabel: 'Tackles', category: 'Defending', color: '#047857', hoverColor: '#059669' },
  { key: 'interceptions', pctKey: 'interceptions_pct', label: 'Interceptions', shortLabel: 'Interceptions', category: 'Defending', color: '#065F46', hoverColor: '#047857' },
  { key: 'clearances', pctKey: 'clearances_pct', label: 'Clearances', shortLabel: 'Clearances', category: 'Defending', color: '#0F766E', hoverColor: '#0D9488' },
];

export const ROLE_RADAR_KEYS: Record<string, string[]> = {
  'Full Back': [
    'key_passes',
    'assists',
    'accurate_final_third_passes',
    'successful_dribbles',
    'accurate_passes_percentage',
    'tackles',
    'interceptions',
    'ground_duels_won_percentage',
    'aerial_duels_won',
    'clearances',
  ],
  'Centre Back': [
    'accurate_passes_percentage',
    'accurate_final_third_passes',
    'key_passes',
    'tackles',
    'interceptions',
    'clearances',
    'aerial_duels_won',
    'ground_duels_won_percentage',
  ],
  'Defensive Mid': [
    'accurate_passes_percentage',
    'accurate_final_third_passes',
    'key_passes',
    'successful_dribbles',
    'tackles',
    'interceptions',
    'ground_duels_won_percentage',
    'aerial_duels_won',
    'clearances',
  ],
  'Central Mid': [
    'accurate_passes_percentage',
    'accurate_final_third_passes',
    'key_passes',
    'assists',
    'successful_dribbles',
    'tackles',
    'interceptions',
    'ground_duels_won_percentage',
    'goals',
    'expected_goals',
  ],
  'Attacking Mid': [
    'goals',
    'expected_goals',
    'shots_on_target',
    'assists',
    'key_passes',
    'successful_dribbles',
    'accurate_final_third_passes',
    'accurate_passes_percentage',
  ],
};

export const RADAR_SLICE_OPTIONS = RADAR_METRICS.map(m => m.key);

export const AVAILABLE_METRICS = [
  { key: 'goals', label: 'Goals', category: 'Attacking' },
  { key: 'expected_goals', label: 'Expected Goals (xG)', category: 'Attacking' },
  { key: 'shots_on_target', label: 'Shots On Target', category: 'Attacking' },
  { key: 'big_chances_missed', label: 'Big Chances Missed', category: 'Attacking' },
  { key: 'key_passes', label: 'Key Passes', category: 'Passing' },
  { key: 'big_chances_created', label: 'Big Chances Created', category: 'Passing' },
  { key: 'assists', label: 'Assists', category: 'Passing' },
  { key: 'accurate_passes_percentage', label: 'Pass Accuracy %', category: 'Passing' },
  { key: 'accurate_final_third_passes', label: 'Final 3rd Passes', category: 'Passing' },
  { key: 'accurate_crosses', label: 'Accurate Crosses', category: 'Passing' },
  { key: 'successful_dribbles', label: 'Completed Dribbles', category: 'Possession' },
  { key: 'successful_dribbles_percentage', label: 'Dribble Success %', category: 'Possession' },
  { key: 'ground_duels_won_percentage', label: 'Ground Duels %', category: 'Duels' },
  { key: 'aerial_duels_won', label: 'Aerial Duels Won', category: 'Duels' },
  { key: 'tackles', label: 'Tackles', category: 'Defending' },
  { key: 'interceptions', label: 'Interceptions', category: 'Defending' },
  { key: 'clearances', label: 'Clearances', category: 'Defending' },
];

export const ROLE_METRIC_PRESETS: Record<string, RoleMetricPreset> = {
  'Striker': {
    xAxis: 'expected_goals',
    yAxis: 'goals',
    beeswarm1: 'shots_on_target',
    beeswarm2: 'big_chances_missed',
    beeswarm3: 'aerial_duels_won',
  },
  'Wide/AM': {
    xAxis: 'key_passes',
    yAxis: 'assists',
    beeswarm1: 'successful_dribbles',
    beeswarm2: 'accurate_final_third_passes',
    beeswarm3: 'expected_goals',
  },
  'Central Mid': {
    xAxis: 'accurate_passes_percentage',
    yAxis: 'accurate_final_third_passes',
    beeswarm1: 'key_passes',
    beeswarm2: 'ground_duels_won_percentage',
    beeswarm3: 'tackles',
  },
  'Defensive Mid': {
    xAxis: 'tackles',
    yAxis: 'interceptions',
    beeswarm1: 'ground_duels_won_percentage',
    beeswarm2: 'accurate_passes_percentage',
    beeswarm3: 'aerial_duels_won',
  },
  'Full Back': {
    xAxis: 'tackles',
    yAxis: 'accurate_final_third_passes',
    beeswarm1: 'interceptions',
    beeswarm2: 'accurate_crosses',
    beeswarm3: 'ground_duels_won_percentage',
  },
  'Centre Back': {
    xAxis: 'clearances',
    yAxis: 'interceptions',
    beeswarm1: 'aerial_duels_won',
    beeswarm2: 'tackles',
    beeswarm3: 'accurate_passes_percentage',
  },
};

export const DEFAULT_METRIC_PRESET: RoleMetricPreset = {
  xAxis: 'accurate_passes_percentage',
  yAxis: 'key_passes',
  beeswarm1: 'key_passes',
  beeswarm2: 'accurate_final_third_passes',
  beeswarm3: 'successful_dribbles',
};

export const VOLUME_STAT_KEYS = new Set([
  'goals', 'assists', 'expected_goals', 'shots_on_target', 'total_shots',
  'successful_dribbles', 'accurate_passes', 'ground_duels_won', 'aerial_duels_won',
  'key_passes', 'interceptions', 'clearances', 'crosses', 'accurate_crosses',
  'tackles', 'saves', 'clean_sheets', 'big_chances_missed',
  'accurate_final_third_passes', 'accurate_long_balls', 'total_duels_won',
  'big_chances_created', 'was_fouled', 'fouls'
]);

export const POSITION_GROUPS = ['All Positions', 'Defender', 'Midfielder', 'Forward', 'Goalkeeper'];

export const TOP_6_CLUBS = new Set([
  'universitario', 'alianza lima', 'sporting cristal', 'fbc melgar', 'melgar', 'cusco fc', 'cienciano', 'adt'
]);

export const LIMA_CLUBS = new Set([
  'universitario', 'alianza lima', 'sporting cristal', 'sport boys'
]);

export const ALTITUDE_CLUBS = new Set([
  'fbc melgar', 'melgar', 'cienciano', 'cusco fc', 'adt', 'sport huancayo', 'deportivo garcilaso', 'los chankas', 'comerciantes unidos'
]);

export const PHOTO_PEERS_COUNT = 5;

export const PEER_RING_CLASSES = [
  'ring-2 ring-emerald-500',
  'ring-2 ring-amber-500',
  'ring-2 ring-sky-500',
  'ring-2 ring-rose-500',
  'ring-2 ring-purple-500',
];

export const PEER_RING_COLORS = [
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#0EA5E9', // sky-500
  '#F43F5E', // rose-500
  '#8B5CF6', // purple-500
];

export const EXPORT_PIXEL_RATIO = 2;
