import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { 
  usePlayerProfile, 
  usePlayerSearch, 
  useSimilarPlayers, 
  usePlayerSeasonStats,
  usePlayerMatchStats,
  usePlayerShots,
  usePlayerPasses,
  usePlayerDefensiveActions,
  usePlayerHeatmap
} from '../hooks/usePlayer';
import { teamsApi, rankingsApi, TeamBase, SimilarPlayer, PlayerRankingEntry, PlayerSeasonStats } from '../services/api';
import ScoutingConfigPanel from '../components/scouting/ScoutingConfigPanel';
import ScoutingFloor01 from '../components/scouting/ScoutingFloor01';
import ScoutingFloor02 from '../components/scouting/ScoutingFloor02';
import { BeeswarmCard } from '../components/scouting/floor03/BeeswarmCard';
import { ScatterPlotCard } from '../components/scouting/floor03/ScatterPlotCard';
import { DefendingPitchCard } from '../components/scouting/floor03/DefendingPitchCard';
import {
  BeeswarmPoint,
  BeeswarmTick,
  BeeswarmStripData,
  BeeswarmHoverState,
  ScatterPoint,
} from '../components/scouting/floor03/scoutingFloor03Utils';
import { getTeamThemeColor, getTeamTextColor, getBadgeTextColor } from '../utils/teams';
import { useScoutingLanguage } from '../i18n/scoutingReport';

export const RADAR_CENTER_X = 350;
export const RADAR_CENTER_Y = 350;
export const RADAR_MAX_RADIUS = 252;
export const RADAR_LABEL_RADIUS = 307;

const DEFAULT_PLAYER_ID = 1090720; // Marco Huamán

export type {
  BeeswarmPoint,
  BeeswarmTick,
  BeeswarmStripData,
  BeeswarmHoverState,
  ScatterPoint,
};

export interface RadarMetricDef {
  key: string;
  pctKey: keyof PlayerSeasonStats;
  label: string;
  shortLabel: string;
  category: 'Attacking' | 'Passing' | 'Defending';
  color: string;
  hoverColor: string;
  isPercentage?: boolean;
}

const RADAR_METRICS: RadarMetricDef[] = [
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

const RADAR_SLICE_OPTIONS = RADAR_METRICS.map(m => m.key);

const AVAILABLE_METRICS = [
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

export interface RoleMetricPreset {
  xAxis: string;
  yAxis: string;
  beeswarm1: string;
  beeswarm2: string;
  beeswarm3: string;
}

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

const VOLUME_STAT_KEYS = new Set([
  'goals', 'assists', 'expected_goals', 'shots_on_target', 'total_shots',
  'successful_dribbles', 'accurate_passes', 'ground_duels_won', 'aerial_duels_won',
  'key_passes', 'interceptions', 'clearances', 'crosses', 'accurate_crosses',
  'tackles', 'saves', 'clean_sheets', 'big_chances_missed',
  'accurate_final_third_passes', 'accurate_long_balls', 'total_duels_won',
  'big_chances_created', 'was_fouled', 'fouls'
]);

const POSITION_GROUPS = ['All Positions', 'Defender', 'Midfielder', 'Forward', 'Goalkeeper'];

const TOP_6_CLUBS = new Set([
  'universitario', 'alianza lima', 'sporting cristal', 'fbc melgar', 'melgar', 'cusco fc', 'cienciano', 'adt'
]);

const LIMA_CLUBS = new Set([
  'universitario', 'alianza lima', 'sporting cristal', 'sport boys'
]);

const ALTITUDE_CLUBS = new Set([
  'fbc melgar', 'melgar', 'cienciano', 'cusco fc', 'adt', 'sport huancayo', 'deportivo garcilaso', 'los chankas', 'comerciantes unidos'
]);

const calculateAge = (dobString?: string | null) => {
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

const resolvePlayerAge = (player?: {
  age?: number | null;
  date_of_birth?: string | null;
  birth_date?: string | null;
  player_age?: number | null;
} | null): number | null => {
  if (!player) return null;
  if (typeof player.age === 'number' && !isNaN(player.age) && player.age > 0) return player.age;
  if (typeof (player as any).player_age === 'number' && !isNaN((player as any).player_age) && (player as any).player_age > 0) {
    return (player as any).player_age;
  }
  const dob = player.date_of_birth || (player as any).birth_date;
  if (dob) return calculateAge(dob);
  return null;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
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

const getCountryCode = (country?: string | null) => {
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
    'united states': 'us'
  };
  return map[country.toLowerCase()] || 'pe';
};

const PHOTO_PEERS_COUNT = 5;

export const PEER_RING_CLASSES = [
  'ring-2 ring-emerald-500',
  'ring-2 ring-amber-500',
  'ring-2 ring-sky-500',
  'ring-2 ring-rose-500',
  'ring-2 ring-purple-500',
];

const PEER_RING_COLORS = [
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#0EA5E9', // sky-500
  '#F43F5E', // rose-500
  '#8B5CF6', // purple-500
];

function generateNiceTicks(start: number, stop: number, count = 9): number[] {
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

function formatScatterTickLabel(val: number, step: number): string {
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

interface PlayerNodeAvatarProps {
  playerId: number;
  name: string;
  isTarget?: boolean;
  ringClass?: string;
  targetRingColor?: string;
  ringColor?: string;
  sizeClass?: string;
  style?: React.CSSProperties;
  isHovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
}

export const PlayerNodeAvatar: React.FC<PlayerNodeAvatarProps> = ({
  playerId,
  name,
  isTarget = false,
  ringClass = 'ring-2 ring-sky-500',
  targetRingColor,
  ringColor,
  sizeClass: customSizeClass,
  style: customStyle,
  isHovered = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClass = customSizeClass || (isTarget ? 'w-7 h-7' : 'w-5.5 h-5.5');
  const defaultTargetRing = 'ring-2 ring-blue-700 ring-offset-1 ring-offset-white shadow-md';
  const effectiveRing = isTarget ? defaultTargetRing : ringClass;

  const activeColor = isTarget ? targetRingColor : ringColor;
  const avatarStyle: React.CSSProperties = {
    ...(isTarget
      ? {
          boxShadow: `0 0 0 2px #FFFFFF, 0 0 0 4px ${activeColor || '#1D4ED8'}, 0 2px 8px rgba(0,0,0,0.3)`,
        }
      : activeColor
      ? {
          boxShadow: `0 0 0 1px #FFFFFF, 0 0 0 2px ${activeColor}`,
        }
      : {}),
    ...customStyle,
  };

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={avatarStyle}
      className={`relative ${sizeClass} rounded-full shrink-0 cursor-pointer select-none transition-transform duration-150 ${
        isHovered ? 'scale-125 z-25' : isTarget ? 'z-20' : 'z-10'
      } ${activeColor ? '' : effectiveRing}`}
    >
      {!imgError ? (
        <img
          src={`/players/${playerId}.png`}
          alt={name}
          onError={(e) => {
            e.currentTarget.onerror = null;
            setImgError(true);
          }}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <div 
          className="w-full h-full rounded-full flex items-center justify-center font-bold text-white text-[8px] select-none"
          style={{ backgroundColor: activeColor || '#64748B' }}
          title={name}
        >
          {name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Export Constants
// ----------------------------------------------------------------------------
const EXPORT_PIXEL_RATIO = 2;

const ScoutingReport: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const playerId = id ? parseInt(id, 10) : DEFAULT_PLAYER_ID;
  const navigate = useNavigate();
  const { lang, setLang, t } = useScoutingLanguage('es');

  // --------------------------------------------------------------------------
  // Configuration State
  // --------------------------------------------------------------------------
  const [minAge, setMinAge] = useState<number>(16);
  const [maxAge, setMaxAge] = useState<number>(36);
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>(['liga1_2026']);
  const [benchmarkMode, setBenchmarkMode] = useState<'all' | 'own' | 'target'>('all');
  const [targetGroup, setTargetGroup] = useState<string>('top6');
  const [xAxisMetric, setXAxisMetric] = useState<string>('accurate_passes_percentage');
  const [yAxisMetric, setYAxisMetric] = useState<string>('key_passes');
  const [beeswarm1, setBeeswarm1] = useState<string>('key_passes');
  const [beeswarm2, setBeeswarm2] = useState<string>('accurate_final_third_passes');
  const [beeswarm3, setBeeswarm3] = useState<string>('successful_dribbles');
  const [selectedPositionGroup, setSelectedPositionGroup] = useState<string>('Defender');
  const [activeRadarSlices, setActiveRadarSlices] = useState<string[]>(RADAR_SLICE_OPTIONS);
  
  // Interactive Hover for Radar, Leaderboard, Scatterplot and Beeswarms
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);
  const [hoveredScatterPoint, setHoveredScatterPoint] = useState<ScatterPoint | null>(null);
  const [hoveredBeeswarmPoint, setHoveredBeeswarmPoint] = useState<BeeswarmHoverState | null>(null);

  // Dropdown States
  const [isExcludeDropdownOpen, setIsExcludeDropdownOpen] = useState<boolean>(false);
  const [isPlayerSearchOpen, setIsPlayerSearchOpen] = useState<boolean>(false);
  const [isRadarDropdownOpen, setIsRadarDropdownOpen] = useState<boolean>(false);

  // Export States & Ref
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const dossierRef = useRef<HTMLDivElement>(null);

  // Exclude teams filter (applied vs pending)
  const [appliedExcludedTeams, setAppliedExcludedTeams] = useState<number[]>([]);
  const [pendingExcludedTeams, setPendingExcludedTeams] = useState<number[]>([]);
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');

  // Player search inside selector
  const [playerSearchQuery, setPlayerSearchQuery] = useState<string>('');

  // Dropdown click-outside refs
  const excludeDropdownRef = useRef<HTMLDivElement>(null);
  const playerSearchRef = useRef<HTMLDivElement>(null);
  const radarDropdownRef = useRef<HTMLDivElement>(null);

  // --------------------------------------------------------------------------
  // Data Queries
  // --------------------------------------------------------------------------
  const { data: profile, isLoading: isProfileLoading } = usePlayerProfile(playerId);
  const clubThemeColor = useMemo(() => {
    return getTeamThemeColor(profile?.team?.name, profile?.team?.primary_color, profile?.team?.team_id);
  }, [profile?.team?.name, profile?.team?.primary_color, profile?.team?.team_id]);
  const clubTextColor = useMemo(() => {
    return getTeamTextColor(profile?.team?.name, profile?.team?.primary_color, profile?.team?.team_id);
  }, [profile?.team?.name, profile?.team?.primary_color, profile?.team?.team_id]);
  const clubTextRgb = useMemo(() => hexToRgb(clubTextColor), [clubTextColor]);

  const radarBadgeTextColor = useMemo(() => getBadgeTextColor(clubThemeColor), [clubThemeColor]);
  const { data: seasonStats } = usePlayerSeasonStats(playerId, 'role');
  const { data: matchStats } = usePlayerMatchStats(playerId);

  const currentRole = seasonStats?.cohort_role_group || profile?.cohort_role_group;
  const prevRoleRef = useRef<string | null | undefined>(undefined);

  const applyPreset = useCallback((role?: string | null) => {
    const preset = (role && ROLE_METRIC_PRESETS[role]) || DEFAULT_METRIC_PRESET;
    setXAxisMetric(preset.xAxis);
    setYAxisMetric(preset.yAxis);
    setBeeswarm1(preset.beeswarm1);
    setBeeswarm2(preset.beeswarm2);
    setBeeswarm3(preset.beeswarm3);
  }, []);

  useEffect(() => {
    if (isProfileLoading || !profile) return;

    const resolvedRole = currentRole ?? null;

    if (prevRoleRef.current === undefined) {
      prevRoleRef.current = resolvedRole;
      applyPreset(resolvedRole);
      return;
    }

    if (resolvedRole !== prevRoleRef.current) {
      prevRoleRef.current = resolvedRole;
      applyPreset(resolvedRole);
    }
  }, [currentRole, isProfileLoading, profile, applyPreset]);
  const { data: similarPlayers, isLoading: isSimilarLoading } = useSimilarPlayers(playerId, 15, true, 'role');
  const { data: searchResults, isLoading: isSearchLoading } = usePlayerSearch(playerSearchQuery);

  // Live Event Queries for Floor 2 Mini Pitches
  const { data: shotsData } = usePlayerShots(playerId);
  const { data: passesData } = usePlayerPasses(playerId);
  const { data: defendingData } = usePlayerDefensiveActions(playerId);
  const { data: heatmapData } = usePlayerHeatmap(playerId);

  const { data: teams } = useQuery<TeamBase[]>({
    queryKey: ['teams-list'],
    queryFn: async () => {
      return await teamsApi.getAll();
    }
  });

  const teamMap = useMemo(() => {
    const map = new Map<number, TeamBase>();
    if (teams) {
      for (const t of teams) {
        map.set(t.team_id, t);
      }
    }
    return map;
  }, [teams]);

  const excludedTeamNames = useMemo(() => {
    const set = new Set<string>();
    appliedExcludedTeams.forEach(id => {
      const t = teamMap.get(id);
      if (t?.name) set.add(t.name.toLowerCase());
    });
    return set;
  }, [appliedExcludedTeams, teamMap]);

  const similarPlayersMap = useMemo(() => {
    const map = new Map<number, SimilarPlayer>();
    if (similarPlayers) {
      for (const sp of similarPlayers) {
        map.set(sp.player_id, sp);
      }
    }
    return map;
  }, [similarPlayers]);

  // Active Metric for Leaderboard: if hovered, use hovered; fallback to 'accurate_passes_percentage'
  const currentLeaderboardStat = hoveredMetric || 'accurate_passes_percentage';
  const playerPositionGroup = profile?.position_group || 'Defender';

  const { data: topPlayersRaw, isLoading: isTopPlayersLoading } = useQuery<PlayerRankingEntry[]>({
    queryKey: ['top-ranking-players', currentLeaderboardStat, playerPositionGroup],
    queryFn: async () => {
      return await rankingsApi.getTopPlayers(currentLeaderboardStat, 40, playerPositionGroup, 450);
    },
    staleTime: 1000 * 60 * 10,
  });

  const topPlayers = useMemo(() => {
    if (!topPlayersRaw) return [];
    return topPlayersRaw
      .filter(p => {
        if (p.player_id === playerId) return true;
        const teamLower = (p.team_name || '').toLowerCase();
        if (excludedTeamNames.has(teamLower)) return false;
        const age = resolvePlayerAge(p) ?? resolvePlayerAge(similarPlayersMap.get(p.player_id));
        if (age !== null && (age < minAge || age > maxAge)) return false;
        if (benchmarkMode === 'own') {
          const myTeam = (profile?.team?.name || '').toLowerCase();
          if (myTeam && !teamLower.includes(myTeam) && !myTeam.includes(teamLower)) return false;
        } else if (benchmarkMode === 'target') {
          if (targetGroup === 'top6' && !TOP_6_CLUBS.has(teamLower)) return false;
          if (targetGroup === 'lima' && !LIMA_CLUBS.has(teamLower)) return false;
          if (targetGroup === 'altitude' && !ALTITUDE_CLUBS.has(teamLower)) return false;
          if (targetGroup === 'provincial' && LIMA_CLUBS.has(teamLower)) return false;
        }
        return true;
      })
      .slice(0, 10);
  }, [topPlayersRaw, playerId, excludedTeamNames, minAge, maxAge, benchmarkMode, targetGroup, profile?.team?.name, similarPlayersMap]);

  // 2D League Scatterplot Queries for Floor 3
  const scatterMetricX = xAxisMetric;
  const scatterMetricY = yAxisMetric;
  const targetRoleGroup = profile?.cohort_role_group || undefined;

  const { data: xRankings } = useQuery<PlayerRankingEntry[]>({
    queryKey: ['scatter-rankings-x', scatterMetricX, targetRoleGroup],
    queryFn: () => rankingsApi.getTopPlayers(scatterMetricX, 500, undefined, undefined, targetRoleGroup),
    staleTime: 1000 * 60 * 10,
  });

  const { data: yRankings } = useQuery<PlayerRankingEntry[]>({
    queryKey: ['scatter-rankings-y', scatterMetricY, targetRoleGroup],
    queryFn: () => rankingsApi.getTopPlayers(scatterMetricY, 500, undefined, undefined, targetRoleGroup),
    staleTime: 1000 * 60 * 10,
  });

  // Beeswarm Queries for Floor 3
  const beeswarmMetric1 = beeswarm1;
  const beeswarmMetric2 = beeswarm2;
  const beeswarmMetric3 = beeswarm3;

  const { data: b1Rankings } = useQuery<PlayerRankingEntry[]>({
    queryKey: ['beeswarm-rankings-1', beeswarmMetric1, targetRoleGroup],
    queryFn: () => rankingsApi.getTopPlayers(beeswarmMetric1, 500, undefined, undefined, targetRoleGroup),
    staleTime: 1000 * 60 * 10,
  });

  const { data: b2Rankings } = useQuery<PlayerRankingEntry[]>({
    queryKey: ['beeswarm-rankings-2', beeswarmMetric2, targetRoleGroup],
    queryFn: () => rankingsApi.getTopPlayers(beeswarmMetric2, 500, undefined, undefined, targetRoleGroup),
    staleTime: 1000 * 60 * 10,
  });

  const { data: b3Rankings } = useQuery<PlayerRankingEntry[]>({
    queryKey: ['beeswarm-rankings-3', beeswarmMetric3, targetRoleGroup],
    queryFn: () => rankingsApi.getTopPlayers(beeswarmMetric3, 500, undefined, undefined, targetRoleGroup),
    staleTime: 1000 * 60 * 10,
  });

  const activeHoveredMetricDef = useMemo(() => {
    if (!hoveredMetric) return null;
    return RADAR_METRICS.find(m => m.key === hoveredMetric) || null;
  }, [hoveredMetric]);

  // Sync position group when profile loads
  useEffect(() => {
    if (profile?.position_group) {
      setSelectedPositionGroup(profile.position_group);
    }
  }, [profile?.position_group]);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (excludeDropdownRef.current && !excludeDropdownRef.current.contains(event.target as Node)) {
        setIsExcludeDropdownOpen(false);
      }
      if (playerSearchRef.current && !playerSearchRef.current.contains(event.target as Node)) {
        setIsPlayerSearchOpen(false);
      }
      if (radarDropdownRef.current && !radarDropdownRef.current.contains(event.target as Node)) {
        setIsRadarDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    if (!teamSearchQuery.trim()) return teams;
    return teams.filter((t: TeamBase) => t.name.toLowerCase().includes(teamSearchQuery.toLowerCase()));
  }, [teams, teamSearchQuery]);

  const toggleLeague = (league: string) => {
    setSelectedLeagues(prev =>
      prev.includes(league) ? prev.filter(l => l !== league) : [...prev, league]
    );
  };

  const toggleRadarSlice = (slice: string) => {
    setActiveRadarSlices(prev => 
      prev.includes(slice) ? prev.filter(s => s !== slice) : [...prev, slice]
    );
  };

  // --------------------------------------------------------------------------
  // Role Metrics and Pure SVG Polar Pizza Radar Computation
  // --------------------------------------------------------------------------
  const roleMetrics = useMemo(() => {
    const role = seasonStats?.cohort_role_group;
    if (role && ROLE_RADAR_KEYS[role]) {
      const allowedKeys = new Set(ROLE_RADAR_KEYS[role]);
      return RADAR_METRICS.filter(m => allowedKeys.has(m.key));
    }
    return RADAR_METRICS;
  }, [seasonStats?.cohort_role_group]);

  const radarSliceOptions = useMemo(() => {
    return roleMetrics.map(m => m.key);
  }, [roleMetrics]);

  useEffect(() => {
    setActiveRadarSlices(roleMetrics.map(m => m.key));
  }, [seasonStats?.cohort_role_group, playerId, roleMetrics]);

  const activeMetrics = useMemo(() => {
    const allowedKeys = new Set(radarSliceOptions);
    const validActive = activeRadarSlices.filter(key => allowedKeys.has(key));
    const filtered = roleMetrics.filter(m => validActive.includes(m.key));
    return filtered.length > 0 ? filtered : roleMetrics;
  }, [roleMetrics, radarSliceOptions, activeRadarSlices]);

  const getSplitMetricLabel = (metricKey: string, fallbackLabel: string): [string, string | null] => {
    const translatedSplit = t.metrics[metricKey]?.radarSplit;
    if (translatedSplit) {
      return translatedSplit;
    }
    const parts = fallbackLabel.split(' ');
    if (parts.length > 1) {
      return [parts[0], parts.slice(1).join(' ')];
    }
    return [fallbackLabel, null];
  };

  const radarGeometry = useMemo(() => {
    const numSlices = activeMetrics.length;
    const angleStep = (2 * Math.PI) / numSlices;
    const cx = RADAR_CENTER_X;
    const cy = RADAR_CENTER_Y;
    const rMin = 0;
    const rMax = RADAR_MAX_RADIUS;
    const rLabel = RADAR_LABEL_RADIUS;

    const minutes = seasonStats?.minutes_played || 1;

    return activeMetrics.map((metric, i) => {
      // Rotate so 0th wedge starts at -PI/2 (12 o'clock)
      const thetaStart = -Math.PI / 2 + i * angleStep;
      const thetaEnd = thetaStart + angleStep;
      const thetaMid = (thetaStart + thetaEnd) / 2;

      // Extract percentile from seasonStats
      let rawPct = seasonStats ? (seasonStats[metric.pctKey] as number | undefined | null) : null;
      if ((rawPct === null || rawPct === undefined) && metric.key === 'expected_goals') {
        rawPct = seasonStats?.expected_goals_pct ?? 50;
      }
      const pct = typeof rawPct === 'number' && !isNaN(rawPct) ? Math.max(8, Math.min(100, rawPct)) : 50;

      // Full background wedge to rMax (252px)
      const bgX1 = cx + rMax * Math.cos(thetaStart);
      const bgY1 = cy + rMax * Math.sin(thetaStart);
      const bgX2 = cx + rMax * Math.cos(thetaEnd);
      const bgY2 = cy + rMax * Math.sin(thetaEnd);
      const bgPathData = `M ${cx} ${cy} L ${bgX1} ${bgY1} A ${rMax} ${rMax} 0 0 1 ${bgX2} ${bgY2} Z`;

      // Player wedge proportional to percentile
      const rOuter = (pct / 100) * rMax;
      const x1 = cx + rOuter * Math.cos(thetaStart);
      const y1 = cy + rOuter * Math.sin(thetaStart);
      const x2 = cx + rOuter * Math.cos(thetaEnd);
      const y2 = cy + rOuter * Math.sin(thetaEnd);
      const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} Z`;

      // Value calculation
      let rawVal = seasonStats ? (seasonStats[metric.key as keyof PlayerSeasonStats] as number | undefined | null) : null;
      if ((rawVal === null || rawVal === undefined) && metric.key === 'expected_goals') {
        rawVal = seasonStats?.expected_goals ?? 0;
      }
      const formattedValue = metric.isPercentage
        ? `${(rawVal ?? 0).toFixed(1)}%`
        : (((rawVal ?? 0) / minutes) * 90).toFixed(2);

      // Value badge anchor position directly at the edge of the player's wedge
      const badgeX = cx + rOuter * Math.cos(thetaMid);
      const badgeY = cy + rOuter * Math.sin(thetaMid);

      // Peripheral label position strictly outside at rLabel = 307
      const labelX = cx + rLabel * Math.cos(thetaMid);
      const labelY = cy + rLabel * Math.sin(thetaMid);

      // Determine textAnchor based on horizontal position relative to cx:
      const dx = labelX - cx;
      const textAnchor: 'start' | 'end' | 'middle' = 
        Math.abs(dx) < 25 ? 'middle' : dx > 0 ? 'start' : 'end';

      // Radial divider ray projecting from rMin to rMax
      const rayX1 = cx + rMin * Math.cos(thetaStart);
      const rayY1 = cy + rMin * Math.sin(thetaStart);
      const rayX2 = cx + rMax * Math.cos(thetaStart);
      const rayY2 = cy + rMax * Math.sin(thetaStart);

      return {
        metric,
        pct: Math.round(pct),
        pathData,
        bgPathData,
        badgeX,
        badgeY,
        labelX,
        labelY,
        textAnchor,
        rOuter,
        formattedValue,
        ray: { x1: rayX1, y1: rayY1, x2: rayX2, y2: rayY2 },
      };
    });
  }, [activeMetrics, seasonStats]);

  // --------------------------------------------------------------------------
  // Floor 3: Defensive 18-Zone Tactical Grid & Distributions
  // --------------------------------------------------------------------------
  const defensiveActionsList = useMemo(() => {
    return defendingData?.defensive_actions?.filter(
      a => a.x != null && a.y != null
    ) || [];
  }, [defendingData]);

  const numDefCols = 5;
  const numDefRows = 6;

  const defendingGrid = useMemo(() => {
    const grid = Array.from({ length: numDefRows }, () => Array(numDefCols).fill(0));
    let validCount = 0;

    defensiveActionsList.forEach(action => {
      if (action.x != null && action.y != null) {
        validCount++;
        // Invert lateral coordinate: raw_y = 100 is left flank -> column 0
        const col = Math.min(numDefCols - 1, Math.max(0, Math.floor(((100 - action.y) / 100) * numDefCols)));
        // Longitudinal: raw_x = 0 is defensive goal at bottom (row 5), 100 is attacking goal at top (row 0)
        const row = Math.min(numDefRows - 1, Math.max(0, Math.floor(((100 - action.x) / 100) * numDefRows)));
        grid[row][col]++;
      }
    });

    if (validCount === 0) {
      // Realistic tactical fallback for left-back
      return [
        [0, 1, 0, 0, 0],
        [5, 2, 1, 1, 1],
        [10, 11, 1, 1, 1],
        [22, 16, 0, 3, 8],
        [39, 37, 9, 5, 5],
        [15, 11, 9, 8, 2]
      ];
    }

    return grid;
  }, [defensiveActionsList]);

  const totalDefendingActions = defensiveActionsList.length || 224;
  const tacklesCount = defensiveActionsList.filter(a => a.action_type === 'tackle').length || (seasonStats?.tackles ?? 42);
  const recoveriesCount = defensiveActionsList.filter(a => a.action_type === 'ball-recovery').length || 151;
  const aerialCount = seasonStats?.aerial_duels_won ?? 23;

  const getDefendingCellFill = useCallback((count: number) => {
    if (count <= 0) return 'transparent';
    const { r, g, b } = hexToRgb(clubThemeColor);
    let alpha = 0.16;
    if (count > 30) alpha = 0.95;
    else if (count > 20) alpha = 0.75;
    else if (count > 10) alpha = 0.50;
    else if (count > 4) alpha = 0.32;
    else alpha = 0.18;

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, [clubThemeColor]);

  // --------------------------------------------------------------------------
  // 8. 2D League Scatterplot Calculations (Floor 3 Center)
  // --------------------------------------------------------------------------
  const SCATTER_PLOT_LEFT = 36;
  const SCATTER_PLOT_TOP = 14;
  const SCATTER_PLOT_WIDTH = 308;
  const SCATTER_PLOT_HEIGHT = 222;
  const SCATTER_PLOT_BOTTOM = SCATTER_PLOT_TOP + SCATTER_PLOT_HEIGHT; // 236

  const metricXDef = AVAILABLE_METRICS.find(m => m.key === scatterMetricX);
  const metricYDef = AVAILABLE_METRICS.find(m => m.key === scatterMetricY);
  const metricXLabel = t.metrics[scatterMetricX]?.long || metricXDef?.label || scatterMetricX;
  const metricYLabel = t.metrics[scatterMetricY]?.long || metricYDef?.label || scatterMetricY;

  const yMap = useMemo(() => {
    const map = new Map<number, { val: number; entry: PlayerRankingEntry }>();
    if (yRankings) {
      yRankings.forEach(item => {
        const num = Number(item.value);
        if (!isNaN(num)) {
          map.set(item.player_id, { val: num, entry: item });
        }
      });
    }
    return map;
  }, [yRankings]);

  const rawScatterPoints = useMemo(() => {
    if (!xRankings || !yRankings) return [];
    const points: Omit<ScatterPoint, 'svgX' | 'svgY'>[] = [];

    xRankings.forEach(itemX => {
      const xVal = Number(itemX.value);
      const yObj = yMap.get(itemX.player_id);
      if (isNaN(xVal) || !yObj) return;

      const yVal = yObj.val;
      const minutes = itemX.minutes_played ?? yObj.entry.minutes_played ?? 0;
      if (minutes < 300) return;

      const posGroup = itemX.position_group || yObj.entry.position_group;
      if (
        selectedPositionGroup && 
        selectedPositionGroup !== 'All Positions' && 
        posGroup && 
        posGroup !== selectedPositionGroup
      ) {
        return;
      }

      const isTarget = itemX.player_id === playerId;
      const simMatch = similarPlayersMap.get(itemX.player_id);
      const computedAge = isTarget && profile
        ? calculateAge(profile.date_of_birth)
        : resolvePlayerAge(itemX) ?? resolvePlayerAge(yObj.entry) ?? resolvePlayerAge(simMatch);

      if (!isTarget) {
        const teamLower = (itemX.team_name || '').toLowerCase();

        // 1. Excluded teams filter
        if (excludedTeamNames.has(teamLower)) return;

        // 2. Age filter
        if (computedAge !== null && (computedAge < minAge || computedAge > maxAge)) return;

        // 3. Benchmark mode filter
        if (benchmarkMode === 'own') {
          const myTeam = (profile?.team?.name || '').toLowerCase();
          if (myTeam && !teamLower.includes(myTeam) && !myTeam.includes(teamLower)) return;
        } else if (benchmarkMode === 'target') {
          if (targetGroup === 'top6' && !TOP_6_CLUBS.has(teamLower)) return;
          if (targetGroup === 'lima' && !LIMA_CLUBS.has(teamLower)) return;
          if (targetGroup === 'altitude' && !ALTITUDE_CLUBS.has(teamLower)) return;
          if (targetGroup === 'provincial' && LIMA_CLUBS.has(teamLower)) return;
        }
      }

      points.push({
        player_id: itemX.player_id,
        name: itemX.name,
        team_name: itemX.team_name,
        position: itemX.position || yObj.entry.position,
        position_group: posGroup,
        minutes_played: minutes,
        x: xVal,
        y: yVal,
        isTarget,
        age: computedAge,
      });
    });

    // Ensure target analyzed player is included
    const targetInList = points.some(p => p.player_id === playerId);
    if (!targetInList && profile && seasonStats) {
      let rawX = Number((seasonStats as any)[scatterMetricX]);
      let rawY = Number((seasonStats as any)[scatterMetricY]);
      const min = seasonStats.minutes_played || 0;
      if (!isNaN(rawX) && !isNaN(rawY)) {
        if (min > 0) {
          if (VOLUME_STAT_KEYS.has(scatterMetricX)) rawX = Number(((rawX / min) * 90).toFixed(2));
          if (VOLUME_STAT_KEYS.has(scatterMetricY)) rawY = Number(((rawY / min) * 90).toFixed(2));
        }
        points.push({
          player_id: playerId,
          name: profile.name,
          team_name: profile.team?.name || 'Alianza Lima',
          position: profile.position,
          position_group: profile.position_group,
          minutes_played: min,
          x: rawX,
          y: rawY,
          isTarget: true,
          age: calculateAge(profile.date_of_birth),
        });
      }
    }

    return points;
  }, [xRankings, yRankings, yMap, benchmarkMode, targetGroup, selectedPositionGroup, playerId, profile, seasonStats, scatterMetricX, scatterMetricY, similarPlayersMap, excludedTeamNames, minAge, maxAge]);

  const scatterPlotData = useMemo(() => {
    if (rawScatterPoints.length === 0) {
      return {
        points: [],
        peerPoints: [],
        targetPoint: null,
        topOutliers: [],
        minX: 0, maxX: 100, medianX: 50,
        minY: 0, maxY: 100, medianY: 50,
        medSvgX: 190, medSvgY: 125,
        mapSvgX: (val: number) => SCATTER_PLOT_LEFT + (val / 100) * SCATTER_PLOT_WIDTH,
        mapSvgY: (val: number) => SCATTER_PLOT_BOTTOM - (val / 100) * SCATTER_PLOT_HEIGHT,
      };
    }

    const xVals = rawScatterPoints.map(p => p.x).sort((a, b) => a - b);
    const yVals = rawScatterPoints.map(p => p.y).sort((a, b) => a - b);

    const getMedian = (sorted: number[]) => {
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    let minX = xVals[0];
    let maxX = xVals[xVals.length - 1];
    let minY = yVals[0];
    let maxY = yVals[yVals.length - 1];

    if (minX === maxX) { minX -= 1; maxX += 1; }
    if (minY === maxY) { minY -= 1; maxY += 1; }

    const padX = (maxX - minX) * 0.08;
    const padY = (maxY - minY) * 0.08;
    minX = Math.max(0, minX - padX);
    maxX += padX;
    minY = Math.max(0, minY - padY);
    maxY += padY;

    const medianX = getMedian(xVals);
    const medianY = getMedian(yVals);

    // Canvas viewBox="0 0 340 280", plot area: x in [40, 325], y in [18, 232]
    const mapSvgX = (val: number) => SCATTER_PLOT_LEFT + ((val - minX) / (maxX - minX || 1)) * SCATTER_PLOT_WIDTH;
    const mapSvgY = (val: number) => SCATTER_PLOT_BOTTOM - ((val - minY) / (maxY - minY || 1)) * SCATTER_PLOT_HEIGHT;

    const points: ScatterPoint[] = rawScatterPoints.map(p => ({
      ...p,
      svgX: mapSvgX(p.x),
      svgY: mapSvgY(p.y),
    }));

    const peerPoints = points.filter(p => !p.isTarget);
    const targetPoint = points.find(p => p.isTarget) || null;

    const medSvgX = mapSvgX(medianX);
    const medSvgY = mapSvgY(medianY);

    // Outliers in High X / High Y quadrant
    const topOutliers = peerPoints
      .filter(p => p.x > medianX && p.y > medianY)
      .sort((a, b) => {
        const scoreA = (a.x - medianX) / (maxX - medianX || 1) + (a.y - medianY) / (maxY - medianY || 1);
        const scoreB = (b.x - medianX) / (maxX - medianX || 1) + (b.y - medianY) / (maxY - medianY || 1);
        return scoreB - scoreA;
      })
      .slice(0, 3);

    return {
      points,
      peerPoints,
      targetPoint,
      topOutliers,
      minX, maxX, medianX,
      minY, maxY, medianY,
      medSvgX, medSvgY,
      mapSvgX, mapSvgY,
    };
  }, [rawScatterPoints]);

  const highlightedPeerPoints = useMemo(() => {
    const selected: ScatterPoint[] = [];
    const usedIds = new Set<number>();

    if (similarPlayers && similarPlayers.length > 0) {
      for (const sp of similarPlayers) {
        if (selected.length >= PHOTO_PEERS_COUNT) break;
        const found = scatterPlotData.peerPoints.find(p => p.player_id === sp.player_id);
        if (found && !usedIds.has(found.player_id)) {
          usedIds.add(found.player_id);
          selected.push(found);
        }
      }
    }

    if (selected.length < PHOTO_PEERS_COUNT) {
      for (const out of scatterPlotData.topOutliers) {
        if (selected.length >= PHOTO_PEERS_COUNT) break;
        if (!usedIds.has(out.player_id)) {
          usedIds.add(out.player_id);
          selected.push(out);
        }
      }
    }

    return selected;
  }, [similarPlayers, scatterPlotData.peerPoints, scatterPlotData.topOutliers]);

  const backgroundPeerPoints = useMemo(() => {
    const highlightedIds = new Set(highlightedPeerPoints.map(p => p.player_id));
    return scatterPlotData.peerPoints.filter(p => !highlightedIds.has(p.player_id));
  }, [scatterPlotData.peerPoints, highlightedPeerPoints]);

  const xTicks = useMemo(() => {
    const { minX, maxX } = scatterPlotData;
    return generateNiceTicks(minX, maxX, 5).filter(t => t >= minX - 1e-6 && t <= maxX + 1e-6);
  }, [scatterPlotData.minX, scatterPlotData.maxX]);

  const yTicks = useMemo(() => {
    const { minY, maxY } = scatterPlotData;
    return generateNiceTicks(minY, maxY, 5).filter(t => t >= minY - 1e-6 && t <= maxY + 1e-6);
  }, [scatterPlotData.minY, scatterPlotData.maxY]);

  const xStep = useMemo(() => (xTicks.length >= 2 ? Math.abs(xTicks[1] - xTicks[0]) : 1), [xTicks]);
  const yStep = useMemo(() => (yTicks.length >= 2 ? Math.abs(yTicks[1] - yTicks[0]) : 1), [yTicks]);

  // --------------------------------------------------------------------------
  // 9. 1D Stacked Beeswarm Distributions Calculations (Floor 3 Left)
  // --------------------------------------------------------------------------
  const computeBeeswarmStrip = useCallback((
    metricKey: string,
    rankings: PlayerRankingEntry[] | undefined,
    opts?: { calibrated?: boolean }
  ): BeeswarmStripData => {
    const isCalibrated = opts?.calibrated ?? false;
    const metricLabels: Record<string, string> = {
      key_passes: 'Key Passes',
      accurate_final_third_passes: 'Final 3rd Passes',
      successful_dribbles: 'Completed Dribbles',
    };
    const metricDef = AVAILABLE_METRICS.find(m => m.key === metricKey);
    const label = t.metrics[metricKey]?.long || metricLabels[metricKey] || metricDef?.label || metricKey.replace(/_/g, ' ');

    if (!rankings || rankings.length === 0) {
      return {
        key: metricKey,
        label,
        minVal: 0,
        maxVal: 100,
        medianVal: 50,
        p25Val: 25,
        p75Val: 75,
        targetVal: null,
        percentile: 50,
        points: [],
        targetPoint: null,
        calibrated: isCalibrated,
      };
    }

    // Filter qualified peers
    const rawPoints: {
      player_id: number;
      name: string;
      team_name: string;
      position?: string | null;
      position_group?: string | null;
      minutes_played?: number | null;
      age?: number | null;
      val: number;
      isTarget: boolean;
    }[] = [];

    rankings.forEach(item => {
      const val = Number(item.value);
      if (isNaN(val)) return;
      const minutes = item.minutes_played ?? 0;
      if (minutes < 300) return;

      if (
        benchmarkMode !== 'all' &&
        selectedPositionGroup &&
        selectedPositionGroup !== 'All Positions' &&
        item.position_group &&
        item.position_group !== selectedPositionGroup
      ) {
        return;
      }

      const isTarget = item.player_id === playerId;
      const simMatch = similarPlayersMap.get(item.player_id);
      const computedAge = isTarget && profile
        ? calculateAge(profile.date_of_birth)
        : resolvePlayerAge(item) ?? resolvePlayerAge(simMatch);

      if (!isTarget) {
        const teamLower = (item.team_name || '').toLowerCase();

        // 1. Excluded teams filter
        if (excludedTeamNames.has(teamLower)) return;

        // 2. Position group filter
        if (
          selectedPositionGroup &&
          selectedPositionGroup !== 'All Positions' &&
          item.position_group &&
          item.position_group !== selectedPositionGroup
        ) {
          return;
        }

        // 3. Age filter
        if (computedAge !== null && (computedAge < minAge || computedAge > maxAge)) return;

        // 4. Benchmark mode filter
        if (benchmarkMode === 'own') {
          const myTeam = (profile?.team?.name || '').toLowerCase();
          if (myTeam && !teamLower.includes(myTeam) && !myTeam.includes(teamLower)) return;
        } else if (benchmarkMode === 'target') {
          if (targetGroup === 'top6' && !TOP_6_CLUBS.has(teamLower)) return;
          if (targetGroup === 'lima' && !LIMA_CLUBS.has(teamLower)) return;
          if (targetGroup === 'altitude' && !ALTITUDE_CLUBS.has(teamLower)) return;
          if (targetGroup === 'provincial' && LIMA_CLUBS.has(teamLower)) return;
        }
      }

      rawPoints.push({
        player_id: item.player_id,
        name: item.name,
        team_name: item.team_name,
        position: item.position || item.position_group,
        position_group: item.position_group,
        minutes_played: item.minutes_played,
        age: computedAge,
        val,
        isTarget,
      });
    });

    // Ensure target player is included if missing from top rankings
    const targetInList = rawPoints.some(p => p.player_id === playerId);
    let targetVal: number | null = targetInList
      ? rawPoints.find(p => p.player_id === playerId)!.val
      : null;

    if (!targetInList && profile && seasonStats) {
      let rawTarget = Number((seasonStats as any)[metricKey]);
      const min = seasonStats.minutes_played || 0;
      if (!isNaN(rawTarget)) {
        if (VOLUME_STAT_KEYS.has(metricKey) && min > 0) {
          rawTarget = Number(((rawTarget / min) * 90).toFixed(2));
        }
        targetVal = rawTarget;
        rawPoints.push({
          player_id: playerId,
          name: profile.name,
          team_name: profile.team?.name || 'Alianza Lima',
          position: profile.position || profile.position_group,
          position_group: profile.position_group,
          minutes_played: min,
          age: calculateAge(profile.date_of_birth),
          val: rawTarget,
          isTarget: true,
        });
      }
    }

    if (rawPoints.length === 0) {
      return {
        key: metricKey,
        label,
        minVal: 0,
        maxVal: 100,
        medianVal: 50,
        p25Val: 25,
        p75Val: 75,
        targetVal,
        percentile: 50,
        points: [],
        targetPoint: null,
        calibrated: isCalibrated,
      };
    }

    const sortedVals = rawPoints.map(p => p.val).sort((a, b) => a - b);
    let minVal = sortedVals[0];
    let maxVal = sortedVals[sortedVals.length - 1];

    if (minVal === maxVal) {
      minVal = Math.max(0, minVal - 1);
      maxVal += 1;
    }

    const rawRange = maxVal - minVal || 1;
    const domainMin = isCalibrated ? minVal - 0.05 * rawRange : minVal;
    const domainMax = isCalibrated ? maxVal + 0.05 * rawRange : maxVal;
    const domainRange = domainMax - domainMin || 1;

    const getPctVal = (pct: number) => {
      const idx = Math.min(sortedVals.length - 1, Math.max(0, Math.floor(sortedVals.length * pct)));
      return sortedVals[idx];
    };

    const p25Val = getPctVal(0.25);
    const medianVal = getPctVal(0.50);
    const p75Val = getPctVal(0.75);

    const getPercentile = (val: number) => {
      if (sortedVals.length === 0) return 50;
      const below = sortedVals.filter(v => v <= val).length;
      return Math.max(1, Math.min(99, Math.round((below / sortedVals.length) * 100)));
    };

    // Calculate percentile for target player
    let percentile = 50;
    if (targetVal !== null && sortedVals.length > 0) {
      percentile = getPercentile(targetVal);
    }
    const pctFromSeason = seasonStats ? Number((seasonStats as any)[`${metricKey}_pct`]) : null;
    if (!isNaN(Number(pctFromSeason)) && pctFromSeason !== null && pctFromSeason > 0) {
      percentile = Math.round(Number(pctFromSeason));
    }

    // Geometry: Range X is in [18, 302] (width = 284)
    const SWARM_LEFT = 18;
    const SWARM_WIDTH = 284;

    const points: BeeswarmPoint[] = rawPoints.map(p => {
      const norm = isCalibrated
        ? (p.val - domainMin) / domainRange
        : (p.val - minVal) / (maxVal - minVal || 1);
      const svgX = SWARM_LEFT + Math.max(0, Math.min(1, norm)) * SWARM_WIDTH;
      const svgY = isCalibrated ? 39 : 18;

      const ptPercentile = p.isTarget ? percentile : getPercentile(p.val);

      return {
        ...p,
        svgX,
        svgY,
        percentile: ptPercentile,
      };
    });

    const targetPoint = points.find(p => p.isTarget) || null;

    // Generate nice ticks if calibrated
    let calibratedTicks: BeeswarmTick[] | undefined = undefined;
    if (isCalibrated) {
      const roundVals = generateNiceTicks(domainMin, domainMax, 6);
      const tickStep = roundVals.length >= 2 ? Math.abs(roundVals[1] - roundVals[0]) : 1;
      calibratedTicks = roundVals.map(val => {
        const norm = (val - domainMin) / domainRange;
        const x = SWARM_LEFT + Math.max(0, Math.min(1, norm)) * SWARM_WIDTH;
        const label = formatScatterTickLabel(val, tickStep);
        return { val, x, label };
      });
    }

    return {
      key: metricKey,
      label,
      minVal,
      maxVal,
      domainMin,
      domainMax,
      medianVal,
      p25Val,
      p75Val,
      targetVal,
      percentile,
      points,
      targetPoint,
      ticks: calibratedTicks,
      calibrated: isCalibrated,
    };
  }, [benchmarkMode, targetGroup, selectedPositionGroup, playerId, profile, seasonStats, similarPlayersMap, excludedTeamNames, minAge, maxAge, t]);

  const beeswarm1Data = useMemo(() => computeBeeswarmStrip(beeswarmMetric1, b1Rankings, { calibrated: true }), [computeBeeswarmStrip, beeswarmMetric1, b1Rankings]);
  const beeswarm2Data = useMemo(() => computeBeeswarmStrip(beeswarmMetric2, b2Rankings, { calibrated: true }), [computeBeeswarmStrip, beeswarmMetric2, b2Rankings]);
  const beeswarm3Data = useMemo(() => computeBeeswarmStrip(beeswarmMetric3, b3Rankings, { calibrated: true }), [computeBeeswarmStrip, beeswarmMetric3, b3Rankings]);

  const getTopStripPeers = useCallback((strip: BeeswarmStripData): BeeswarmPoint[] => {
    const selected: BeeswarmPoint[] = [];
    const usedIds = new Set<number>();

    if (similarPlayers && similarPlayers.length > 0) {
      for (const sp of similarPlayers) {
        if (selected.length >= PHOTO_PEERS_COUNT) break;
        const found = strip.points.find(p => p.player_id === sp.player_id && !p.isTarget);
        if (found && !usedIds.has(found.player_id)) {
          usedIds.add(found.player_id);
          selected.push(found);
        }
      }
    }

    // Fallback if fewer than PHOTO_PEERS_COUNT similar peers: pick top performers in this metric
    if (selected.length < PHOTO_PEERS_COUNT) {
      const sortedPeers = [...strip.points.filter(p => !p.isTarget)].sort((a, b) => b.val - a.val);
      for (const p of sortedPeers) {
        if (selected.length >= PHOTO_PEERS_COUNT) break;
        if (!usedIds.has(p.player_id)) {
          usedIds.add(p.player_id);
          selected.push(p);
        }
      }
    }

    return selected;
  }, [similarPlayers]);

  const playerAge = calculateAge(profile?.date_of_birth);
  const countryCode = getCountryCode(profile?.nationality);
  const playerName = profile?.name || 'Marco Huamán';
  const positionLabel = (() => {
    const role = seasonStats?.cohort_role_group || profile?.cohort_role_group;
    if (role) {
      return t.floor1.roles[role] || role;
    }
    const rawPos = (profile?.position === 'D' ? 'Full Back' : profile?.position) || selectedPositionGroup || 'Full Back';
    return t.floor1.roles[rawPos] || rawPos;
  })();

  const formatCohortAbbr = (role: string | null | undefined): string | null => {
    if (!role) return null;
    return t.floor1.cohortAbbr[role] || `${role}s`;
  };

  const getPositionGroupPlural = (posGroup: string | null | undefined): string => {
    if (!posGroup) return t.floor1.playersPlural;
    return t.floor1.cohortPlural[posGroup] || `${posGroup}s`;
  };

  const cohortCount = useMemo(() => {
    if (rawScatterPoints && rawScatterPoints.length > 0) {
      return rawScatterPoints.length;
    }
    if (xRankings && xRankings.length > 0) {
      return xRankings.length;
    }
    return 34;
  }, [rawScatterPoints, xRankings]);

  // --------------------------------------------------------------------------
  const cohortHeaderLabel = useMemo(() => {
    const size = seasonStats?.cohort_size ?? cohortCount;
    const role = seasonStats?.cohort_role_group;
    if (role) {
      const abbr = formatCohortAbbr(role);
      return `vs ${size} ${abbr}`;
    }
    const posPlural = getPositionGroupPlural(profile?.position_group || playerPositionGroup);
    return `vs ${size} ${posPlural}`;
  }, [seasonStats?.cohort_role_group, seasonStats?.cohort_size, cohortCount, profile?.position_group, playerPositionGroup, t]);

  // Export Handlers
  // --------------------------------------------------------------------------
  const handleDownloadPNG = async () => {
    if (isExportingPng || isExportingPdf) return;
    const targetElement = dossierRef.current || document.getElementById('scouting-dossier-canvas');
    if (!targetElement) return;

    const originalTargetCursor = targetElement.style.cursor;
    const originalBodyCursor = document.body.style.cursor;

    try {
      setIsExportingPng(true);
      targetElement.style.cursor = 'none';
      document.body.style.cursor = 'none';
      setHoveredBeeswarmPoint(null);
      setHoveredScatterPoint(null);

      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 60));

      const captureWidth = Math.ceil(Math.max(targetElement.scrollWidth, targetElement.offsetWidth));
      const captureHeight = Math.ceil(Math.max(targetElement.scrollHeight, targetElement.offsetHeight));

      // Guard: Ensure dimensions stay within browser canvas limits (16k max side, 100MP max area)
      let pixelRatio = EXPORT_PIXEL_RATIO;
      const MAX_SIDE = 16384;
      const MAX_AREA = 100_000_000;

      if (
        captureWidth * pixelRatio > MAX_SIDE ||
        captureHeight * pixelRatio > MAX_SIDE ||
        captureWidth * pixelRatio * captureHeight * pixelRatio > MAX_AREA
      ) {
        const maxRatioSide = Math.min(MAX_SIDE / captureWidth, MAX_SIDE / captureHeight);
        const maxRatioArea = Math.sqrt(MAX_AREA / (captureWidth * captureHeight));
        pixelRatio = Math.max(1, Math.min(pixelRatio, maxRatioSide, maxRatioArea));
      }

      const blob = await toBlob(targetElement, {
        pixelRatio,
        cacheBust: true,
        backgroundColor: '#f8fafc',
        width: captureWidth,
        height: captureHeight,
        style: {
          cursor: 'none',
          width: `${captureWidth}px`,
          minWidth: `${captureWidth}px`,
          maxWidth: `${captureWidth}px`,
          height: `${captureHeight}px`,
          minHeight: `${captureHeight}px`,
          maxHeight: `${captureHeight}px`,
          margin: '0',
          transform: 'none',
        },
        filter: (node: Node) => {
          if (node instanceof HTMLElement && node.classList.contains('export-ignore')) {
            return false;
          }
          return true;
        },
      });

      if (!blob) {
        throw new Error('Failed to generate image blob');
      }

      // Verification: decode image bitmap and confirm dimensions match expectations
      try {
        if (typeof createImageBitmap === 'function') {
          const bitmap = await createImageBitmap(blob);
          const expectedWidth = Math.round(captureWidth * pixelRatio);
          const expectedHeight = Math.round(captureHeight * pixelRatio);
          if (bitmap.width !== expectedWidth || bitmap.height !== expectedHeight) {
            console.warn(
              `[Export PNG] Bitmap dimension mismatch: captured ${bitmap.width}x${bitmap.height}, expected ${expectedWidth}x${expectedHeight}`
            );
          }
          bitmap.close();
        }
      } catch {
        // createImageBitmap verification is non-blocking
      }

      const cleanPlayer = playerName.trim().replace(/\s+/g, '_');
      const cleanTeam = (profile?.team?.name || 'Liga1').trim().replace(/\s+/g, '_');
      const filename = `Scouting_Report_${cleanPlayer}_${cleanTeam}.png`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Failed to export PNG:', err);
      alert(t.export.pngError);
    } finally {
      targetElement.style.cursor = originalTargetCursor;
      document.body.style.cursor = originalBodyCursor;
      setIsExportingPng(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (isExportingPng || isExportingPdf) return;
    const targetElement = dossierRef.current || document.getElementById('scouting-dossier-canvas');
    if (!targetElement) return;

    const originalTargetCursor = targetElement.style.cursor;
    const originalBodyCursor = document.body.style.cursor;

    try {
      setIsExportingPdf(true);
      targetElement.style.cursor = 'none';
      document.body.style.cursor = 'none';
      setHoveredBeeswarmPoint(null);
      setHoveredScatterPoint(null);

      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 60));

      const fullHeight = Math.max(targetElement.scrollHeight, targetElement.offsetHeight, targetElement.clientHeight);
      const fullWidth = Math.max(targetElement.scrollWidth, targetElement.offsetWidth, targetElement.clientWidth);

      const dataUrl = await toPng(targetElement, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#f8fafc',
        width: fullWidth,
        height: fullHeight,
        style: {
          cursor: 'none',
          width: `${fullWidth}px`,
          height: `${fullHeight}px`,
          maxHeight: 'none',
          overflow: 'visible',
        },
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList.contains('export-ignore')) {
            return false;
          }
          return true;
        },
      });

      // Calculate exact image properties from captured bitmap
      const dummyPdf = new jsPDF({ unit: 'mm' });
      const imgProps = dummyPdf.getImageProperties(dataUrl);

      // Fit 297mm width and scale height dynamically to match entire bitmap aspect ratio
      const pdfWidth = 297;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      const pdf = new jsPDF({
        orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'SLOW');

      const cleanPlayer = playerName.trim().replace(/\s+/g, '_');
      const cleanTeam = (profile?.team?.name || 'Liga1').trim().replace(/\s+/g, '_');
      const filename = `Scouting_Report_${cleanPlayer}_${cleanTeam}.pdf`;

      pdf.save(filename);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert(t.export.pdfError);
    } finally {
      targetElement.style.cursor = originalTargetCursor;
      document.body.style.cursor = originalBodyCursor;
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 antialiased font-sans p-[12px] w-full flex flex-col gap-3">
      {/* =================================================================== */}
      {/* TOP TITLE & LANGUAGE SWITCH                                         */}
      {/* =================================================================== */}
      <div className="w-full max-w-full flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {t.headerTitle}
        </h1>
        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setLang('es')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              lang === 'es' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ES
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              lang === 'en' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TIER 1: FULL-WIDTH CONFIGURATION PANEL                              */}
      {/* =================================================================== */}
      <ScoutingConfigPanel
        t={t}
        minAge={minAge}
        setMinAge={setMinAge}
        maxAge={maxAge}
        setMaxAge={setMaxAge}
        selectedLeagues={selectedLeagues}
        toggleLeague={toggleLeague}
        excludeDropdownRef={excludeDropdownRef}
        isExcludeDropdownOpen={isExcludeDropdownOpen}
        setIsExcludeDropdownOpen={setIsExcludeDropdownOpen}
        appliedExcludedTeams={appliedExcludedTeams}
        setAppliedExcludedTeams={setAppliedExcludedTeams}
        pendingExcludedTeams={pendingExcludedTeams}
        setPendingExcludedTeams={setPendingExcludedTeams}
        teamSearchQuery={teamSearchQuery}
        setTeamSearchQuery={setTeamSearchQuery}
        teams={teams}
        filteredTeams={filteredTeams}
        benchmarkMode={benchmarkMode}
        setBenchmarkMode={setBenchmarkMode}
        targetGroup={targetGroup}
        setTargetGroup={setTargetGroup}
        currentRole={currentRole}
        applyPreset={applyPreset}
        xAxisMetric={xAxisMetric}
        setXAxisMetric={setXAxisMetric}
        yAxisMetric={yAxisMetric}
        setYAxisMetric={setYAxisMetric}
        beeswarm1={beeswarm1}
        setBeeswarm1={setBeeswarm1}
        beeswarm2={beeswarm2}
        setBeeswarm2={setBeeswarm2}
        beeswarm3={beeswarm3}
        setBeeswarm3={setBeeswarm3}
        availableMetrics={AVAILABLE_METRICS}
        selectedPositionGroup={selectedPositionGroup}
        setSelectedPositionGroup={setSelectedPositionGroup}
        positionGroups={POSITION_GROUPS}
        playerSearchRef={playerSearchRef}
        isPlayerSearchOpen={isPlayerSearchOpen}
        setIsPlayerSearchOpen={setIsPlayerSearchOpen}
        isProfileLoading={isProfileLoading}
        profile={profile}
        playerId={playerId}
        playerSearchQuery={playerSearchQuery}
        setPlayerSearchQuery={setPlayerSearchQuery}
        isSearchLoading={isSearchLoading}
        searchResults={searchResults}
        onSelectPlayer={(targetId) => navigate(`/scouting/${targetId}`)}
        radarDropdownRef={radarDropdownRef}
        isRadarDropdownOpen={isRadarDropdownOpen}
        setIsRadarDropdownOpen={setIsRadarDropdownOpen}
        activeRadarSlices={activeRadarSlices}
        setActiveRadarSlices={setActiveRadarSlices}
        radarSliceOptions={radarSliceOptions}
        toggleRadarSlice={toggleRadarSlice}
      />

      {/* =================================================================== */}
      {/* TIER 2: FULL-BLEED PANORAMIC DOSSIER CANVAS                         */}
      {/* =================================================================== */}
      <div id="scouting-dossier-canvas" ref={dossierRef} className="w-full max-w-full bg-[#EEF0EE] p-[10px] flex flex-col gap-[10px] rounded-[8px]">
        
        {/* ----------------------------------------------------------------- */}
        {/* FLOOR 1: Bio & Polar Pizza Rose Radar Section                     */}
        {/* ----------------------------------------------------------------- */}
        <ScoutingFloor01
          t={t}
          lang={lang}
          playerId={playerId}
          playerName={playerName}
          profile={profile}
          seasonStats={seasonStats}
          matchStats={matchStats}
          positionLabel={positionLabel}
          playerAge={playerAge}
          countryCode={countryCode}
          cohortHeaderLabel={cohortHeaderLabel}
          activeMetrics={activeMetrics}
          radarGeometry={radarGeometry}
          hoveredMetric={hoveredMetric}
          setHoveredMetric={setHoveredMetric}
          clubThemeColor={clubThemeColor}
          clubTextColor={clubTextColor}
          clubTextRgb={clubTextRgb}
          radarBadgeTextColor={radarBadgeTextColor}
          getSplitMetricLabel={getSplitMetricLabel}
          currentLeaderboardStat={currentLeaderboardStat}
          activeHoveredMetricDef={activeHoveredMetricDef}
          radarMetrics={RADAR_METRICS}
          isTopPlayersLoading={isTopPlayersLoading}
          topPlayers={topPlayers}
        />
        {/* ----------------------------------------------------------------- */}
        {/* FLOOR 2: Similarity & Real Event Pitches Section                  */}
        {/* ----------------------------------------------------------------- */}
        <ScoutingFloor02
          playerId={playerId}
          playerName={playerName}
          positionLabel={positionLabel}
          clubThemeColor={clubThemeColor}
          seasonStats={seasonStats}
          teamMap={teamMap}
          similarPlayers={similarPlayers}
          isSimilarLoading={isSimilarLoading}
          shotsData={shotsData}
          passesData={passesData}
          defendingData={defendingData}
          heatmapData={heatmapData}
          t={t}
          onSelectPlayer={(targetId) => navigate(`/scouting/${targetId}`)}
        />


        {/* ----------------------------------------------------------------- */}
        {/* FLOOR 3: Distributions & Defending Section                         */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch w-full">
          
          {/* FLOOR 3 LEFT: 3 Standalone Distribution Cards (Cols 1-4) */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-3 flex flex-col justify-between h-full shadow-2xs">
            {[beeswarm1Data, beeswarm2Data, beeswarm3Data].map((strip) => (
              <BeeswarmCard
                key={`strip-${strip.key}`}
                strip={strip}
                similarPeers={getTopStripPeers(strip)}
                peerColors={PEER_RING_COLORS}
                targetRingColor={clubTextColor}
                hoveredPoint={hoveredBeeswarmPoint}
                onHoverPoint={setHoveredBeeswarmPoint}
                onSelectPlayer={(targetId) => navigate(`/scouting/${targetId}`)}
                playerAge={playerAge}
                resolvePlayerAge={resolvePlayerAge}
                similarPlayersMap={similarPlayersMap}
                t={t}
              />
            ))}
          </div>

          {/* FLOOR 3 RIGHT CONTAINER: 3B Scatter + 3C Defending (Cols 5-12) */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-[1fr_285px] gap-3 h-full">

            {/* FLOOR 3 CENTER: Large 2D Scatterplot */}
            <ScatterPlotCard
              rawPoints={scatterPlotData.points}
              backgroundPeerPoints={backgroundPeerPoints}
              minX={scatterPlotData.minX}
              maxX={scatterPlotData.maxX}
              minY={scatterPlotData.minY}
              maxY={scatterPlotData.maxY}
              medianX={scatterPlotData.medianX}
              medianY={scatterPlotData.medianY}
              xTicks={xTicks}
              yTicks={yTicks}
              metricXLabel={metricXLabel}
              metricYLabel={metricYLabel}
              xStep={xStep}
              yStep={yStep}
              highlightedPeers={highlightedPeerPoints}
              targetPoint={scatterPlotData.targetPoint}
              clubTextColor={clubTextColor}
              peerRingColors={PEER_RING_COLORS}
              hoveredPoint={hoveredScatterPoint}
              onHoverPoint={setHoveredScatterPoint}
              onSelectPlayer={(targetId) => navigate(`/scouting/${targetId}`)}
              playerAge={playerAge}
              resolvePlayerAge={resolvePlayerAge}
              similarPlayersMap={similarPlayersMap}
              t={t}
            />

          {/* FLOOR 3 RIGHT: Dedicated Vertical Defending Zonal Grid Pitch */}
            <DefendingPitchCard
              playerName={playerName}
              clubThemeColor={clubThemeColor}
              defendingGrid={defendingGrid}
              totalDefendingActions={totalDefendingActions}
              tacklesCount={tacklesCount}
              recoveriesCount={recoveriesCount}
              aerialCount={aerialCount}
              getDefendingCellFill={getDefendingCellFill}
              t={t}
            />

          </div>

        </div>

      </div>

      {/* =================================================================== */}
      {/* TIER 3: BOTTOM EXPORT BUTTONS                                       */}
      {/* =================================================================== */}
      <div className="export-ignore w-full max-w-[1520px] mx-auto px-6 pt-4 pb-12 border-t border-slate-200 flex items-center justify-end gap-4">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={handleDownloadPNG}
            disabled={isExportingPng || isExportingPdf}
            className="bg-[#1D70B8] hover:bg-[#155b96] disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded font-semibold text-sm inline-flex items-center justify-center transition-colors cursor-pointer"
          >
            {isExportingPng ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t.export.generatingPng}
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                {t.export.downloadPng}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isExportingPng || isExportingPdf}
            className="bg-[#00823B] hover:bg-[#00682f] disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded font-semibold text-sm inline-flex items-center justify-center transition-colors cursor-pointer"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t.export.generatingPdf}
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                {t.export.downloadPdf}
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
};

export default ScoutingReport;
