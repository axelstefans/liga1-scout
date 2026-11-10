import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  useTeamMetrics, 
  useTeamMatches, 
  useTeamShotMap,
  useTeamPassNetwork,
  useTeamPeriodMetrics,
  useTeamMostUsedXI,
  useTeamsList,
  useTeamFlashscoreSummary
} from '../../hooks/useTeam';
import { VenueFilter, ContextFilter } from '../../services/api';
import {
  prepareClubReportData,
  buildClubMarkdownReport,
  type ClubReportData,
} from '../../services/clubReportBuilder';
import {
  TournamentFilter,
  ClubViewMode,
  MatchReportSheetId,
  ChartId,
} from './clubAnalyticsTypes';
import { createEmptyTeam } from './clubAnalyticsUtils';

export function useClubDetailAnalytics() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  // Top-level Club section view mode: RENDIMIENTO GENERAL vs REPORTE DE PARTIDO
  const [clubViewMode, setClubViewMode] = useState<ClubViewMode>('general');
  const [activeSheet, setActiveSheet] = useState<MatchReportSheetId>('01');
  const [reportMatchId, setReportMatchId] = useState<number | null>(null);

  const [selectedTournament, setSelectedTournament] = useState<TournamentFilter>('Clausura');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(
    id ? parseInt(id, 10) : null
  );

  // Multi-select chart visibility state
  const [visibleCharts, setVisibleCharts] = useState<Record<ChartId, boolean>>({
    radar: true,
    pass_network: true,
    shot_map: true,
    attack_zones: false,
    defensive_actions: false,
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Global Tactical Toolbar states
  const [perspective, setPerspective] = useState<'for' | 'against'>('for');
  const [aggregationMode, setAggregationMode] = useState<'cumulative' | 'match'>('cumulative');
  const [venue, setVenue] = useState<VenueFilter>('all');
  const [contextFilter, setContextFilter] = useState<ContextFilter>('all');
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all');
  const [isReportCopied, setIsReportCopied] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch all 18 teams in the league for the club dropdown selector
  const { data: allTeamsList } = useTeamsList();

  // Fetch all teams and their cohort stats for current tournament filter, venue, and contextFilter
  const { 
    data: teams, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useTeamMetrics(selectedTournament === 'all' ? undefined : selectedTournament, venue, contextFilter);

  // Synchronize selectedTeamId when URL param changes or when teams load
  useEffect(() => {
    if (id) {
      const parsedId = parseInt(id, 10);
      if (!isNaN(parsedId) && parsedId !== selectedTeamId) {
        setSelectedTeamId(parsedId);
      }
    } else if (selectedTeamId === null) {
      if (teams && teams.length > 0) {
        setSelectedTeamId(teams[0].team_id);
      } else if (allTeamsList && allTeamsList.length > 0) {
        setSelectedTeamId(allTeamsList[0].team_id);
      }
    }
  }, [id, teams, allTeamsList, selectedTeamId]);

  // Handler for changing club from dropdown
  const handleClubChange = (newTeamId: number) => {
    setSelectedTeamId(newTeamId);
    navigate(`/clubs/${newTeamId}`);
  };

  // Toggle single chart
  const toggleChart = (chartId: ChartId) => {
    setVisibleCharts((prev) => ({
      ...prev,
      [chartId]: !prev[chartId],
    }));
  };

  // Select all charts
  const handleSelectAll = () => {
    setVisibleCharts({
      radar: true,
      pass_network: true,
      shot_map: true,
      attack_zones: true,
      defensive_actions: true,
    });
  };

  // Reset to default
  const handleReset = () => {
    setVisibleCharts({
      radar: true,
      pass_network: true,
      shot_map: true,
      attack_zones: false,
      defensive_actions: false,
    });
  };

  // Count active charts
  const activeCount = useMemo(() => {
    return Object.values(visibleCharts).filter(Boolean).length;
  }, [visibleCharts]);

  // Find active team and their current league ranking
  const { activeTeam, leagueRank } = useMemo(() => {
    if (selectedTeamId !== null) {
      if (teams && teams.length > 0) {
        const index = teams.findIndex((t) => t.team_id === selectedTeamId);
        if (index !== -1) {
          return { activeTeam: teams[index], leagueRank: index + 1 };
        }
      }
      // If team is not present in filtered cohort (0 matches), resolve from master club list
      const baseClub = allTeamsList?.find((t) => t.team_id === selectedTeamId);
      if (baseClub) {
        return { activeTeam: createEmptyTeam(baseClub), leagueRank: null };
      }
    }
    // Fallback to top team in filtered list
    if (teams && teams.length > 0) {
      return { activeTeam: teams[0], leagueRank: 1 };
    }
    // Fallback to top team in master club list
    if (allTeamsList && allTeamsList.length > 0) {
      return { activeTeam: createEmptyTeam(allTeamsList[0]), leagueRank: null };
    }
    return { activeTeam: null, leagueRank: null };
  }, [teams, allTeamsList, selectedTeamId]);

  // Fetch matches list for active team and tournament
  const { data: matches, isLoading: isLoadingMatches } = useTeamMatches(
    activeTeam?.team_id,
    selectedTournament
  );

  // Auto-select latest match for Match Report mode when club or tournament changes
  useEffect(() => {
    if (matches && matches.length > 0) {
      if (!reportMatchId || !matches.some((m) => m.match_id === reportMatchId)) {
        setReportMatchId(matches[0].match_id);
      }
    } else {
      setReportMatchId(null);
    }
  }, [matches, reportMatchId]);

  // Strictly validate that reportMatchId belongs to the currently loaded matches array
  const validReportMatchId = useMemo(() => {
    if (!matches || matches.length === 0 || !reportMatchId) return null;
    return matches.some((m) => m.match_id === reportMatchId) ? reportMatchId : matches[0].match_id;
  }, [matches, reportMatchId]);

  // Validate that selectedMatchId strictly belongs to the currently active club's fixture cohort
  const activeMatch = useMemo(() => {
    if (!matches || !selectedMatchId) return null;
    return matches.find((m) => m.match_id === selectedMatchId) || null;
  }, [matches, selectedMatchId]);

  const validMatchId = aggregationMode === 'match' && activeMatch ? activeMatch.match_id : null;
  const isMatchQueryEnabled = Boolean(activeTeam?.team_id) && (aggregationMode === 'cumulative' || Boolean(validMatchId));

  // Auto-select latest match when entering match mode
  useEffect(() => {
    if (aggregationMode === 'match' && matches && matches.length > 0) {
      if (!selectedMatchId || !matches.some((m) => m.match_id === selectedMatchId)) {
        setSelectedMatchId(matches[0].match_id);
      }
    } else if (aggregationMode === 'cumulative') {
      setSelectedMatchId(null);
    }
  }, [aggregationMode, matches, selectedMatchId]);

  // Reset match and player selection when club or tournament changes
  useEffect(() => {
    setSelectedMatchId(null);
    setReportMatchId(null);
    setSelectedPlayer('all');
  }, [selectedTeamId, selectedTournament]);

  // Reset player when perspective or validated match changes
  useEffect(() => {
    setSelectedPlayer('all');
  }, [perspective, validMatchId]);

  // Fetch shot map data for player dropdown options and export
  const { data: shotData } = useTeamShotMap(
    activeTeam?.team_id,
    selectedTournament,
    validMatchId,
    perspective,
    venue,
    isMatchQueryEnabled,
    contextFilter
  );

  // Fetch pass network data for comprehensive report
  const { data: passNetworkData } = useTeamPassNetwork(
    activeTeam?.team_id || 0,
    selectedTournament,
    validMatchId,
    venue,
    isMatchQueryEnabled,
    contextFilter
  );

  // Fetch period metrics (set pieces, dynamics, discipline) for comprehensive report
  const { data: periodMetricsData, isLoading: isLoadingPeriodMetrics } = useTeamPeriodMetrics(
    activeTeam?.team_id,
    selectedTournament,
    venue,
    perspective,
    Boolean(activeTeam?.team_id),
    contextFilter
  );

  // Fetch most used XI data for comprehensive report
  const { data: mostUsedXIData } = useTeamMostUsedXI(
    activeTeam?.team_id,
    selectedTournament,
    venue,
    Boolean(activeTeam?.team_id),
    contextFilter
  );

  // Fetch Flashscore advanced team summary (Floor 2.5)
  const { data: flashscoreSummary, isLoading: isFlashscoreLoading } = useTeamFlashscoreSummary(selectedTeamId, selectedTournament);

  // Unique players for dropdown
  const availablePlayers = useMemo(() => {
    if (!shotData?.shots || !Array.isArray(shotData.shots)) return [];
    const map = new Map<string, number>();
    shotData.shots.forEach((s) => {
      if (!s) return;
      const name = s.player_name || 'Desconocido';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [shotData?.shots]);

  // Context and Venue labels for UI alerts and banner
  const venueLabel = useMemo(() => {
    switch (venue) {
      case 'home': return 'Local';
      case 'away': return 'Visita';
      default: return 'Todos';
    }
  }, [venue]);

  const contextFilterLabel = useMemo(() => {
    switch (contextFilter) {
      case 'vs_elite': return 'vs. Élite';
      case 'vs_rest': return 'vs. Resto';
      case 'altitude': return 'Altura (>2,000m)';
      case 'sea_level': return 'Llano';
      default: return 'Todos los rivales';
    }
  }, [contextFilter]);

  // Check if active filter combination yields 0 matches across core analytics hooks
  const totalMatches = useMemo(() => {
    if (activeTeam && activeTeam.matches_played > 0) {
      return activeTeam.matches_played;
    }
    if (periodMetricsData?.matches_count !== undefined && periodMetricsData.matches_count !== null) {
      return periodMetricsData.matches_count;
    }
    return activeTeam?.matches_played ?? 0;
  }, [activeTeam, periodMetricsData]);

  const isEmptyState = useMemo(() => {
    if (isLoading || isLoadingPeriodMetrics) return false;
    return totalMatches === 0;
  }, [isLoading, isLoadingPeriodMetrics, totalMatches]);

  // Comprehensive Markdown Report Generator
  const handleCopyComprehensiveReport = async () => {
    if (!activeTeam) return;

    try {
      const payload: ClubReportData = prepareClubReportData({
        activeTeam,
        teams,
        leagueRank: leagueRank ?? 'N/D',
        selectedTournament,
        venue,
        contextFilter,
        perspective,
        aggregationMode,
        activeMatch,
        passNetworkData,
        shotData,
        periodMetricsData,
        mostUsedXIData,
        flashscoreSummary,
      });

      const markdown = buildClubMarkdownReport(payload);
      await navigator.clipboard.writeText(markdown);
      setIsReportCopied(true);
      setTimeout(() => setIsReportCopied(false), 2200);
    } catch (err) {
      console.error('Error al copiar informe al portapapeles:', err);
    }
  };

  // Active state for floors
  const hasFloor1Charts = visibleCharts.radar || visibleCharts.pass_network || visibleCharts.shot_map;
  const hasFloor2Charts = visibleCharts.attack_zones || visibleCharts.defensive_actions;
  const bothFloor2Active = visibleCharts.attack_zones && visibleCharts.defensive_actions;

  const clubShortDisplay = activeTeam?.short_name || activeTeam?.name || 'Club';

  return {
    // Navigation and Routing
    selectedTeamId,
    setSelectedTeamId,
    handleClubChange,
    clubShortDisplay,

    // View Mode and Sheets
    clubViewMode,
    setClubViewMode,
    activeSheet,
    setActiveSheet,
    reportMatchId,
    setReportMatchId,
    validReportMatchId,

    // Tournament and Teams Cohort
    selectedTournament,
    setSelectedTournament,
    allTeamsList,
    teams,
    activeTeam,
    leagueRank,
    isLoading,
    isError,
    error,
    refetch,

    // Matches and Fixture
    matches,
    isLoadingMatches,
    selectedMatchId,
    setSelectedMatchId,
    validMatchId,
    activeMatch,

    // Tactical Filters
    perspective,
    setPerspective,
    aggregationMode,
    setAggregationMode,
    venue,
    setVenue,
    venueLabel,
    contextFilter,
    setContextFilter,
    contextFilterLabel,
    selectedPlayer,
    setSelectedPlayer,
    availablePlayers,
    totalMatches,
    isEmptyState,

    // Chart Visibility State and Controls
    visibleCharts,
    setVisibleCharts,
    activeCount,
    toggleChart,
    handleSelectAll,
    handleReset,
    isDropdownOpen,
    setIsDropdownOpen,
    dropdownRef,
    hasFloor1Charts,
    hasFloor2Charts,
    bothFloor2Active,

    // Detailed Tactical Data
    shotData,
    passNetworkData,
    periodMetricsData,
    isLoadingPeriodMetrics,
    mostUsedXIData,
    flashscoreSummary,
    isFlashscoreLoading,

    // Markdown Report Generation
    isReportCopied,
    handleCopyComprehensiveReport,
  };
}

export type UseClubDetailAnalyticsReturn = ReturnType<typeof useClubDetailAnalytics>;
