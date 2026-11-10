import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  usePlayerProfile,
  usePlayerSearch,
  useSimilarPlayers,
  usePlayerSeasonStats,
  usePlayerMatchStats,
  usePlayerShots,
  usePlayerPasses,
  usePlayerDefensiveActions,
  usePlayerHeatmap,
} from '../../hooks/usePlayer';
import {
  teamsApi,
  rankingsApi,
  TeamBase,
  SimilarPlayer,
  PlayerRankingEntry,
} from '../../services/api';
import {
  computeDefendingGrid,
  getDefendingCellFillColor,
  buildScatterPlotData,
  buildBeeswarmStripsData,
  getTopStripPeers as selectTopStripPeers,
} from './floor03/scoutingFloor03Data';
import type {
  BeeswarmPoint,
  BeeswarmStripData,
  BeeswarmHoverState,
  ScatterPoint,
} from './scoutingTypes';
import {
  DEFAULT_PLAYER_ID,
  RADAR_METRICS,
  ROLE_RADAR_KEYS,
  RADAR_SLICE_OPTIONS,
  ROLE_METRIC_PRESETS,
  DEFAULT_METRIC_PRESET,
  TOP_6_CLUBS,
  LIMA_CLUBS,
  ALTITUDE_CLUBS,
} from './scoutingConstants';
import {
  calculateAge,
  resolvePlayerAge,
  hexToRgb,
  getCountryCode,
} from '../../utils/scoutingUtils';
import { exportScoutingReportPNG, exportScoutingReportPDF } from '../../utils/scoutingExport';
import {
  getSplitMetricLabel as computeSplitMetricLabel,
  computeRadarGeometry,
} from '../../utils/scoutingRadarGeometry';
import { getTeamThemeColor, getTeamTextColor, getBadgeTextColor } from '../../utils/teams';
import { useScoutingLanguage } from '../../i18n/scoutingReport';

export function useScoutingReportData() {
  const { id } = useParams<{ id?: string }>();
  const playerId = id ? parseInt(id, 10) : DEFAULT_PLAYER_ID;
  const navigate = useNavigate();
  const { lang, setLang, t } = useScoutingLanguage('es');

  const onSelectPlayer = useCallback(
    (targetId: number) => {
      navigate(`/scouting/${targetId}`);
    },
    [navigate]
  );

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

  const { data: similarPlayers, isLoading: isSimilarLoading } = useSimilarPlayers(
    playerId,
    15,
    true,
    'role'
  );
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
    },
  });

  const teamMap = useMemo(() => {
    const map = new Map<number, TeamBase>();
    if (teams) {
      for (const team of teams) {
        map.set(team.team_id, team);
      }
    }
    return map;
  }, [teams]);

  const excludedTeamNames = useMemo(() => {
    const set = new Set<string>();
    appliedExcludedTeams.forEach((teamId) => {
      const team = teamMap.get(teamId);
      if (team?.name) set.add(team.name.toLowerCase());
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
      .filter((p) => {
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
  }, [
    topPlayersRaw,
    playerId,
    excludedTeamNames,
    minAge,
    maxAge,
    benchmarkMode,
    targetGroup,
    profile?.team?.name,
    similarPlayersMap,
  ]);

  // 2D League Scatterplot Queries for Floor 3
  const scatterMetricX = xAxisMetric;
  const scatterMetricY = yAxisMetric;
  const targetRoleGroup = profile?.cohort_role_group || undefined;

  const { data: xRankings } = useQuery<PlayerRankingEntry[]>({
    queryKey: ['scatter-rankings-x', scatterMetricX, targetRoleGroup],
    queryFn: () =>
      rankingsApi.getTopPlayers(scatterMetricX, 500, undefined, undefined, targetRoleGroup),
    staleTime: 1000 * 60 * 10,
  });

  const { data: yRankings } = useQuery<PlayerRankingEntry[]>({
    queryKey: ['scatter-rankings-y', scatterMetricY, targetRoleGroup],
    queryFn: () =>
      rankingsApi.getTopPlayers(scatterMetricY, 500, undefined, undefined, targetRoleGroup),
    staleTime: 1000 * 60 * 10,
  });

  // Beeswarm Queries for Floor 3
  const beeswarmMetric1 = beeswarm1;
  const beeswarmMetric2 = beeswarm2;
  const beeswarmMetric3 = beeswarm3;

  const { data: b1Rankings } = useQuery<PlayerRankingEntry[]>({
    queryKey: ['beeswarm-rankings-1', beeswarmMetric1, targetRoleGroup],
    queryFn: () =>
      rankingsApi.getTopPlayers(beeswarmMetric1, 500, undefined, undefined, targetRoleGroup),
    staleTime: 1000 * 60 * 10,
  });

  const { data: b2Rankings } = useQuery<PlayerRankingEntry[]>({
    queryKey: ['beeswarm-rankings-2', beeswarmMetric2, targetRoleGroup],
    queryFn: () =>
      rankingsApi.getTopPlayers(beeswarmMetric2, 500, undefined, undefined, targetRoleGroup),
    staleTime: 1000 * 60 * 10,
  });

  const { data: b3Rankings } = useQuery<PlayerRankingEntry[]>({
    queryKey: ['beeswarm-rankings-3', beeswarmMetric3, targetRoleGroup],
    queryFn: () =>
      rankingsApi.getTopPlayers(beeswarmMetric3, 500, undefined, undefined, targetRoleGroup),
    staleTime: 1000 * 60 * 10,
  });

  const activeHoveredMetricDef = useMemo(() => {
    if (!hoveredMetric) return null;
    return RADAR_METRICS.find((m) => m.key === hoveredMetric) || null;
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
    return teams.filter((team: TeamBase) =>
      team.name.toLowerCase().includes(teamSearchQuery.toLowerCase())
    );
  }, [teams, teamSearchQuery]);

  const toggleLeague = useCallback((league: string) => {
    setSelectedLeagues((prev) =>
      prev.includes(league) ? prev.filter((l) => l !== league) : [...prev, league]
    );
  }, []);

  const toggleRadarSlice = useCallback((slice: string) => {
    setActiveRadarSlices((prev) =>
      prev.includes(slice) ? prev.filter((s) => s !== slice) : [...prev, slice]
    );
  }, []);

  // --------------------------------------------------------------------------
  // Role Metrics and Pure SVG Polar Pizza Radar Computation
  // --------------------------------------------------------------------------
  const roleMetrics = useMemo(() => {
    const role = seasonStats?.cohort_role_group;
    if (role && ROLE_RADAR_KEYS[role]) {
      const allowedKeys = new Set(ROLE_RADAR_KEYS[role]);
      return RADAR_METRICS.filter((m) => allowedKeys.has(m.key));
    }
    return RADAR_METRICS;
  }, [seasonStats?.cohort_role_group]);

  const radarSliceOptions = useMemo(() => {
    return roleMetrics.map((m) => m.key);
  }, [roleMetrics]);

  useEffect(() => {
    setActiveRadarSlices(roleMetrics.map((m) => m.key));
  }, [seasonStats?.cohort_role_group, playerId, roleMetrics]);

  const activeMetrics = useMemo(() => {
    const allowedKeys = new Set(radarSliceOptions);
    const validActive = activeRadarSlices.filter((key) => allowedKeys.has(key));
    const filtered = roleMetrics.filter((m) => validActive.includes(m.key));
    return filtered.length > 0 ? filtered : roleMetrics;
  }, [roleMetrics, radarSliceOptions, activeRadarSlices]);

  const getSplitMetricLabel = useCallback(
    (metricKey: string, fallbackLabel: string): [string, string | null] =>
      computeSplitMetricLabel(metricKey, fallbackLabel, t),
    [t]
  );

  const radarGeometry = useMemo(
    () => computeRadarGeometry(activeMetrics, seasonStats),
    [activeMetrics, seasonStats]
  );

  // --------------------------------------------------------------------------
  // Floor 3: Defensive 18-Zone Tactical Grid & Distributions
  // --------------------------------------------------------------------------
  const {
    defendingGrid,
    totalDefendingActions,
    tacklesCount,
    recoveriesCount,
    aerialCount,
  } = useMemo(
    () => computeDefendingGrid(defendingData, seasonStats),
    [defendingData, seasonStats]
  );

  const getDefendingCellFill = useCallback(
    (count: number) => getDefendingCellFillColor(count, clubThemeColor),
    [clubThemeColor]
  );

  const scatterResult = useMemo(
    () =>
      buildScatterPlotData({
        xRankings,
        yRankings,
        scatterMetricX,
        scatterMetricY,
        playerId,
        profile,
        seasonStats,
        similarPlayers,
        similarPlayersMap,
        selectedPositionGroup,
        excludedTeamNames,
        minAge,
        maxAge,
        benchmarkMode,
        targetGroup,
        t,
      }),
    [
      xRankings,
      yRankings,
      scatterMetricX,
      scatterMetricY,
      playerId,
      profile,
      seasonStats,
      similarPlayers,
      similarPlayersMap,
      selectedPositionGroup,
      excludedTeamNames,
      minAge,
      maxAge,
      benchmarkMode,
      targetGroup,
      t,
    ]
  );

  const beeswarmStrips = useMemo(
    () =>
      buildBeeswarmStripsData({
        beeswarmMetric1,
        beeswarmMetric2,
        beeswarmMetric3,
        b1Rankings,
        b2Rankings,
        b3Rankings,
        playerId,
        profile,
        seasonStats,
        similarPlayers,
        similarPlayersMap,
        selectedPositionGroup,
        excludedTeamNames,
        minAge,
        maxAge,
        benchmarkMode,
        targetGroup,
        t,
      }),
    [
      beeswarmMetric1,
      beeswarmMetric2,
      beeswarmMetric3,
      b1Rankings,
      b2Rankings,
      b3Rankings,
      playerId,
      profile,
      seasonStats,
      similarPlayers,
      similarPlayersMap,
      selectedPositionGroup,
      excludedTeamNames,
      minAge,
      maxAge,
      benchmarkMode,
      targetGroup,
      t,
    ]
  );

  const getTopStripPeers = useCallback(
    (strip: BeeswarmStripData): BeeswarmPoint[] => selectTopStripPeers(strip, similarPlayers),
    [similarPlayers]
  );

  const playerAge = calculateAge(profile?.date_of_birth);
  const countryCode = getCountryCode(profile?.nationality);
  const playerName = profile?.name || 'Marco Huamán';
  const positionLabel = (() => {
    const role = seasonStats?.cohort_role_group || profile?.cohort_role_group;
    if (role) {
      return t.floor1.roles[role] || role;
    }
    const rawPos =
      (profile?.position === 'D' ? 'Full Back' : profile?.position) ||
      selectedPositionGroup ||
      'Full Back';
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
    if (scatterResult.rawScatterPoints && scatterResult.rawScatterPoints.length > 0) {
      return scatterResult.rawScatterPoints.length;
    }
    if (xRankings && xRankings.length > 0) {
      return xRankings.length;
    }
    return 34;
  }, [scatterResult.rawScatterPoints, xRankings]);

  const cohortHeaderLabel = useMemo(() => {
    const size = seasonStats?.cohort_size ?? cohortCount;
    const role = seasonStats?.cohort_role_group;
    if (role) {
      const abbr = formatCohortAbbr(role);
      return `vs ${size} ${abbr}`;
    }
    const posPlural = getPositionGroupPlural(profile?.position_group || playerPositionGroup);
    return `vs ${size} ${posPlural}`;
  }, [
    seasonStats?.cohort_role_group,
    seasonStats?.cohort_size,
    cohortCount,
    profile?.position_group,
    playerPositionGroup,
    t,
  ]);

  // --------------------------------------------------------------------------
  // Export Handlers
  // --------------------------------------------------------------------------
  const handleDownloadPNG = useCallback(async () => {
    if (isExportingPng || isExportingPdf) return;
    const targetElement = dossierRef.current || document.getElementById('scouting-dossier-canvas');
    if (!targetElement) return;

    try {
      setIsExportingPng(true);
      setHoveredBeeswarmPoint(null);
      setHoveredScatterPoint(null);

      await exportScoutingReportPNG({
        targetElement,
        playerName,
        teamName: profile?.team?.name,
      });
    } catch (err) {
      console.error('Failed to export PNG:', err);
      alert(t.export.pngError);
    } finally {
      setIsExportingPng(false);
    }
  }, [isExportingPng, isExportingPdf, playerName, profile?.team?.name, t.export.pngError]);

  const handleDownloadPDF = useCallback(async () => {
    if (isExportingPng || isExportingPdf) return;
    const targetElement = dossierRef.current || document.getElementById('scouting-dossier-canvas');
    if (!targetElement) return;

    try {
      setIsExportingPdf(true);
      setHoveredBeeswarmPoint(null);
      setHoveredScatterPoint(null);

      await exportScoutingReportPDF({
        targetElement,
        playerName,
        teamName: profile?.team?.name,
      });
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert(t.export.pdfError);
    } finally {
      setIsExportingPdf(false);
    }
  }, [isExportingPng, isExportingPdf, playerName, profile?.team?.name, t.export.pdfError]);

  return {
    lang,
    setLang,
    t,
    playerId,
    playerName,
    playerAge,
    countryCode,
    positionLabel,
    cohortHeaderLabel,
    onSelectPlayer,

    // Config Panel states & setters
    minAge,
    setMinAge,
    maxAge,
    setMaxAge,
    selectedLeagues,
    toggleLeague,
    excludeDropdownRef,
    isExcludeDropdownOpen,
    setIsExcludeDropdownOpen,
    appliedExcludedTeams,
    setAppliedExcludedTeams,
    pendingExcludedTeams,
    setPendingExcludedTeams,
    teamSearchQuery,
    setTeamSearchQuery,
    teams,
    filteredTeams,
    benchmarkMode,
    setBenchmarkMode,
    targetGroup,
    setTargetGroup,
    currentRole,
    applyPreset,
    xAxisMetric,
    setXAxisMetric,
    yAxisMetric,
    setYAxisMetric,
    beeswarm1,
    setBeeswarm1,
    beeswarm2,
    setBeeswarm2,
    beeswarm3,
    setBeeswarm3,
    selectedPositionGroup,
    setSelectedPositionGroup,
    playerSearchRef,
    isPlayerSearchOpen,
    setIsPlayerSearchOpen,
    isProfileLoading,
    profile,
    playerSearchQuery,
    setPlayerSearchQuery,
    isSearchLoading,
    searchResults,
    radarDropdownRef,
    isRadarDropdownOpen,
    setIsRadarDropdownOpen,
    activeRadarSlices,
    setActiveRadarSlices,
    radarSliceOptions,
    toggleRadarSlice,

    // Dossier & Floors
    dossierRef,
    seasonStats,
    matchStats,
    activeMetrics,
    radarGeometry,
    hoveredMetric,
    setHoveredMetric,
    clubThemeColor,
    clubTextColor,
    clubTextRgb,
    radarBadgeTextColor,
    getSplitMetricLabel,
    currentLeaderboardStat,
    activeHoveredMetricDef,
    isTopPlayersLoading,
    topPlayers,
    teamMap,
    similarPlayers,
    similarPlayersMap,
    isSimilarLoading,
    shotsData,
    passesData,
    defendingData,
    heatmapData,
    beeswarmStrips,
    getTopStripPeers,
    hoveredBeeswarmPoint,
    setHoveredBeeswarmPoint,
    hoveredScatterPoint,
    setHoveredScatterPoint,
    scatterResult,
    defendingGrid,
    totalDefendingActions,
    tacklesCount,
    recoveriesCount,
    aerialCount,
    getDefendingCellFill,

    // Export
    isExportingPng,
    isExportingPdf,
    handleDownloadPNG,
    handleDownloadPDF,
  };
}
