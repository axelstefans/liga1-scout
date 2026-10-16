import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Loader2, AlertCircle, RefreshCw, Trophy, Shield,
  ChevronDown, Check, SlidersHorizontal, RotateCcw, User,
  ClipboardCheck
} from 'lucide-react';
import { 
  useTeamMetrics, 
  useTeamMatches, 
  useTeamShotMap,
  useTeamPassNetwork,
  useTeamPeriodMetrics,
  useTeamMostUsedXI,
  useTeamsList,
  useTeamFlashscoreSummary
} from '../hooks/useTeam';
import { getTeamCrestUrl, getTeamTricode } from '../utils/teams';
import TeamTacticalRadar from '../components/analytics/TeamTacticalRadar';
import TeamPassNetwork from '../components/analytics/TeamPassNetwork';
import TeamShotMap from '../components/analytics/TeamShotMap';
import TeamAttackZones from '../components/analytics/TeamAttackZones';
import TeamDefensiveTerritory from '../components/analytics/TeamDefensiveTerritory';
import TeamSetPiecesCard from '../components/analytics/TeamSetPiecesCard';
import TeamPeriodMetricsCard from '../components/analytics/TeamPeriodMetricsCard';
import TeamDisciplineCard from '../components/analytics/TeamDisciplineCard';
import TeamMostUsedXICard from '../components/team/TeamMostUsedXICard';
import { 
  TeamBoxControlCard, 
  TeamGoalkeeperCard, 
  TeamPeriodDominanceCard 
} from '../components/clubs';
import { VenueFilter, ContextFilter, TeamMetricEntry } from '../services/api';

interface RadarDimDef {
  key: string;
  name: string;
  shortName: string;
  extractor: (t: TeamMetricEntry) => number;
  format: (v: number) => string;
  higherIsBetter: boolean;
}

const TACTICAL_RADAR_DIMS: RadarDimDef[] = [
  {
    key: 'field_tilt',
    name: 'Posesión Campo Rival (Field Tilt)',
    shortName: 'Field Tilt',
    extractor: (t) => t.field_tilt ?? t.field_tilt_pct ?? 50.0,
    format: (v) => `${v.toFixed(1)}%`,
    higherIsBetter: true,
  },
  {
    key: 'verticality',
    name: 'Verticalidad',
    shortName: 'Verticalidad',
    extractor: (t) => t.verticality_ratio_pct ?? 0,
    format: (v) => `${v.toFixed(1)}%`,
    higherIsBetter: true,
  },
  {
    key: 'progressive_passes',
    name: 'Pases al Último Tercio / Progresivos',
    shortName: 'Pases Últ. 3ro / PJ',
    extractor: (t) => t.final_third_passes_p90 ?? (t.matches_played > 0 ? (t.passes_into_final_third ?? t.progressive_passes) / t.matches_played : 0),
    format: (v) => `${v.toFixed(1)} / pj`,
    higherIsBetter: true,
  },
  {
    key: 'shot_quality',
    name: 'Calidad de Remate (xG/tiro)',
    shortName: 'xG / Tiro',
    extractor: (t) => t.xg_per_shot ?? (t.total_shots > 0 ? t.xg / t.total_shots : 0),
    format: (v) => `${v.toFixed(2)} xG`,
    higherIsBetter: true,
  },
  {
    key: 'set_piece_xg',
    name: 'xG a Balón Parado',
    shortName: 'xG Balón Parado',
    extractor: (t) => t.set_piece_xg_p90 ?? t.set_piece_xg_per_match ?? (t.matches_played > 0 && t.set_piece_xg ? t.set_piece_xg / t.matches_played : 0),
    format: (v) => `${v.toFixed(2)} xG / pj`,
    higherIsBetter: true,
  },
  {
    key: 'high_recoveries',
    name: 'Recuperaciones Altas',
    shortName: 'Recup. Altas / PJ',
    extractor: (t) => (t.matches_played > 0 ? t.high_recoveries / t.matches_played : 0),
    format: (v) => `${v.toFixed(1)} / pj`,
    higherIsBetter: true,
  },
];

type TournamentFilter = 'all' | 'Apertura' | 'Clausura';

type ChartId = 'radar' | 'pass_network' | 'shot_map' | 'attack_zones' | 'defensive_actions';

interface ChartConfig {
  id: ChartId;
  label: string;
  floor: 1 | 2;
  defaultActive: boolean;
}

const AVAILABLE_CHARTS: ChartConfig[] = [
  { id: 'radar', label: 'Perfil de Estilo Táctico', floor: 1, defaultActive: true },
  { id: 'pass_network', label: 'Red de Pases', floor: 1, defaultActive: true },
  { id: 'shot_map', label: 'Mapa de Tiros xG', floor: 1, defaultActive: true },
  { id: 'attack_zones', label: 'Zonas de Infiltración', floor: 2, defaultActive: false },
  { id: 'defensive_actions', label: 'Acciones Defensivas', floor: 2, defaultActive: false },
];

const createEmptyTeam = (base: { team_id: number; name: string; short_name: string | null; primary_color?: string | null; logo_url: string | null }): TeamMetricEntry => ({
  team_id: base.team_id,
  name: base.name,
  short_name: base.short_name,
  primary_color: base.primary_color ?? null,
  logo_url: base.logo_url,
  matches_played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
  points_per_match: 0,
  goals_scored: 0,
  goals_conceded: 0,
  goal_difference: 0,
  total_shots: 0,
  shots_on_target: 0,
  shots_inside_box: 0,
  shots_outside_box: 0,
  xg: 0,
  npxg: 0,
  xg_per_shot: 0,
  goals_minus_xg: 0,
  conversion_rate_pct: 0,
  possession_pct: 0,
  passes_completed: 0,
  passes_total: 0,
  pass_accuracy_pct: 0,
  progressive_passes: 0,
  passes_into_final_third: 0,
  passes_into_box: 0,
  crosses_completed: 0,
  progressive_carries: 0,
  successful_dribbles: 0,
  field_tilt: 0,
  field_tilt_pct: 0,
  verticality_ratio_pct: 0,
  avg_shot_distance: 0,
  ppda: 0,
  high_recoveries: 0,
  defensive_actions: 0,
  tackles: 0,
  interceptions: 0,
  clearances: 0,
  shots_conceded: 0,
  shots_on_target_conceded: 0,
  shots_conceded_inside_box: 0,
  xga: 0,
  xgd: 0,
  defensive_resistance_ratio: 0,
  xg_per_match: 0,
  xga_per_match: 0,
  conversion_ratio: 0,
});

export const ClubDetailAnalytics: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

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
    setSelectedPlayer('all');
  }, [selectedTeamId, selectedTournament]);

  // Reset player when perspective or match changes
  useEffect(() => {
    setSelectedPlayer('all');
  }, [perspective, selectedMatchId]);

  // Fetch shot map data for player dropdown options and export
  const { data: shotData } = useTeamShotMap(
    activeTeam?.team_id,
    selectedTournament,
    aggregationMode === 'match' ? selectedMatchId : null,
    perspective,
    venue,
    true,
    contextFilter
  );

  // Fetch pass network data for comprehensive report
  const { data: passNetworkData } = useTeamPassNetwork(
    activeTeam?.team_id || 0,
    selectedTournament,
    aggregationMode === 'match' ? selectedMatchId : null,
    venue,
    Boolean(activeTeam?.team_id),
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


  const activeMatch = useMemo(() => {
    if (!matches || !selectedMatchId) return null;
    return matches.find((m) => m.match_id === selectedMatchId) || null;
  }, [matches, selectedMatchId]);

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

    // 1. Header & Context
    const teamNameUpper = activeTeam.name.toUpperCase();
    const tournamentLabel =
      selectedTournament === 'all' ? 'Temporada Completa 2026' : `${selectedTournament} 2026`;
    const venueLabel = venue === 'home' ? 'Solo Local' : venue === 'away' ? 'Solo Visita' : 'Todos (Local y Visita)';
    const contextLabel =
      contextFilter === 'vs_elite' ? 'vs. Élite (Alianza Lima, Universitario, Cristal, Melgar)' :
      contextFilter === 'vs_rest' ? 'vs. Resto (14 rivales restantes)' :
      contextFilter === 'altitude' ? 'En Altura (>2,000m)' :
      contextFilter === 'sea_level' ? 'En Llano / Nivel del Mar' : 'Todos los Rivales';
    const perspectiveLabel = perspective === 'for'
      ? `A Favor (Producción ofensiva de ${activeTeam.name})`
      : `En Contra (Fase defensiva y concesión)`;

    const gdSign = activeTeam.goal_difference > 0 ? '+' : '';
    const dateStr = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const matchContextLines: string[] = [];
    if (aggregationMode === 'match' && activeMatch) {
      const matchScore = activeMatch.team_score !== null && activeMatch.opponent_score !== null
        ? `${activeMatch.team_score} - ${activeMatch.opponent_score}`
        : 'Pendiente';
      matchContextLines.push(
        `- **Modo Partido Seleccionado:** ${activeMatch.label} (${activeMatch.is_home ? 'Local' : 'Visita'})`,
        `- **Rival:** ${activeMatch.opponent_name} | **Marcador:** ${matchScore}`
      );
    }

    // 2. Tactical Radar Percentiles
    const radarLines: string[] = [
      '### 2. PERFIL DE ESTILO TÁCTICO (RADAR COHORTE LIGA 1)',
      '| Dimensión Táctica | Valor Equipo | Percentil Liga | Rango Liga |',
      '| :--- | :---: | :---: | :---: |',
    ];

    if (teams && teams.length > 0) {
      TACTICAL_RADAR_DIMS.forEach((dim) => {
        const cohort = teams.map((t) => ({ team_id: t.team_id, val: dim.extractor(t) }));
        cohort.sort((a, b) => (dim.higherIsBetter ? b.val - a.val : a.val - b.val));
        const n = cohort.length;
        let currentRank = 1;
        let activeVal = 0;
        let rank = 1;

        for (let idx = 0; idx < n; idx++) {
          if (idx > 0 && cohort[idx].val !== cohort[idx - 1].val) {
            currentRank = idx + 1;
          }
          if (cohort[idx].team_id === activeTeam.team_id) {
            activeVal = cohort[idx].val;
            rank = currentRank;
            break;
          }
        }
        const percentile = n > 1 ? Math.round(((n - rank) / (n - 1)) * 100) : 50;
        radarLines.push(
          `| ${dim.name} | ${dim.format(activeVal)} | Pctl ${percentile} | #${rank} de ${n} |`
        );
      });
    } else {
      radarLines.push('| Sin datos de radar para la cohorte activa | - | - | - |');
    }

    // 3. Passing Network & Tactical Structure
    const formationStr = mostUsedXIData?.formation || '4-2-3-1';
    const edgeCount = passNetworkData?.edges?.length || 0;

    // 4. Shotmap & Finishing
    const rawShots = shotData?.shots || [];
    const total_shots = rawShots.length;
    const goals = rawShots.filter((s) => s.result === 'goal').length;
    const saved = rawShots.filter((s) => s.result === 'saved').length;
    const total_xg_val = Math.round(rawShots.reduce((acc, s) => acc + s.xg, 0) * 100) / 100;
    const xg_per_shot = total_shots > 0 ? (total_xg_val / total_shots).toFixed(2) : '0.00';
    const shots_on_target = goals + saved;
    const on_target_pct = total_shots > 0 ? ((shots_on_target / total_shots) * 100).toFixed(1) : '0.0';
    const delta_val = Math.round((goals - total_xg_val) * 100) / 100;
    const deltaSign = delta_val >= 0 ? '+' : '';
    const inBoxCount = rawShots.filter((s) => s.x >= 84.0 && s.y >= 20.0 && s.y <= 80.0).length;
    const pctInBox = total_shots > 0 ? Math.round((inBoxCount / total_shots) * 100) : 0;

    // Top shooters
    const shooterMap = new Map<string, { shots: number; xg: number; goals: number }>();
    for (const s of rawShots) {
      const name = s.player_name || 'Desconocido';
      const curr = shooterMap.get(name) || { shots: 0, xg: 0, goals: 0 };
      curr.shots += 1;
      curr.xg += s.xg;
      if (s.result === 'goal') curr.goals += 1;
      shooterMap.set(name, curr);
    }
    const topShooters = Array.from(shooterMap.entries())
      .map(([name, d]) => ({
        name,
        shots: d.shots,
        goals: d.goals,
        xg: Math.round(d.xg * 100) / 100,
      }))
      .sort((a, b) => b.xg - a.xg || b.shots - a.shots)
      .slice(0, 4);

    const topShooterLines = topShooters.length > 0
      ? topShooters.map((s, i) => `  ${i + 1}. **${s.name}**: ${s.goals} goles | ${s.shots} remates | ${s.xg.toFixed(2)} xG`)
      : ['  - Sin rematadores registrados en la muestra activa.'];

    // 5. Set Pieces & Corners
    const cornerStats = periodMetricsData?.corner_stats;
    const o85 = cornerStats?.over_8_5_corners;
    const o95 = cornerStats?.over_9_5_corners;
    const pct85 = o85 && o85.total > 0 ? Math.round((o85.count / o85.total) * 100) : 0;
    const pct95 = o95 && o95.total > 0 ? Math.round((o95.count / o95.total) * 100) : 0;
    const o45Conceded = cornerStats?.corners_conceded_over_4_5;
    const pct45Conceded = cornerStats?.corners_conceded_over_4_5_pct ?? (o45Conceded && o45Conceded.total > 0 ? Math.round((o45Conceded.count / o45Conceded.total) * 100) : 0);
    const spGoals = periodMetricsData?.set_pieces?.set_piece_goals ?? 0;
    const spGoalsConceded = periodMetricsData?.set_pieces?.set_piece_goals_conceded ?? 0;
    const spGoalsScoredAvg = periodMetricsData?.set_pieces?.set_piece_goals_per_match ?? (activeTeam.matches_played > 0 ? spGoals / activeTeam.matches_played : 0);
    const spGoalsConcededAvg = periodMetricsData?.set_pieces?.set_piece_goals_conceded_per_match ?? (activeTeam.matches_played > 0 ? spGoalsConceded / activeTeam.matches_played : 0);
    const cornerGoals = periodMetricsData?.set_pieces?.corner_goals ?? 0;
    const cornerGoalsConceded = periodMetricsData?.set_pieces?.corner_goals_conceded ?? 0;
    const penAwarded = periodMetricsData?.penalties_awarded ?? periodMetricsData?.set_pieces?.penalties_awarded ?? 0;
    const penScored = periodMetricsData?.penalties_scored ?? periodMetricsData?.set_pieces?.penalties_scored ?? 0;
    const penConceded = periodMetricsData?.penalties_conceded ?? periodMetricsData?.set_pieces?.penalties_conceded ?? 0;

    // 6. Balance & Dynamics
    const splits = periodMetricsData?.time_splits;
    const periods = periodMetricsData?.periods;
    const dynamics = periodMetricsData?.match_dynamics;
    const htWon = dynamics?.ht_won?.count ?? 0;
    const htTotal = dynamics?.ht_won?.total ?? 0;
    const htDrawn = dynamics?.ht_drawn?.count ?? 0;
    const htLost = dynamics?.ht_lost?.count ?? 0;
    const btts = dynamics?.btts;
    const pctBtts = btts && btts.total > 0 ? Math.round((btts.count / btts.total) * 100) : 0;
    const scored1st = dynamics?.scored_first;
    const pctScored1st = scored1st && scored1st.total > 0 ? Math.round((scored1st.count / scored1st.total) * 100) : 0;
    const conceded1st = dynamics?.conceded_first;
    const pctConceded1st = conceded1st && conceded1st.total > 0 ? Math.round((conceded1st.count / conceded1st.total) * 100) : 0;
    const cleanSheets = dynamics?.clean_sheets;
    const cleanSheetsPct = dynamics?.clean_sheets_pct ?? (cleanSheets && cleanSheets.total > 0 ? Math.round((cleanSheets.count / cleanSheets.total) * 100) : 0);
    const failedToScore = dynamics?.failed_to_score;
    const failedToScorePct = dynamics?.failed_to_score_pct ?? (failedToScore && failedToScore.total > 0 ? Math.round((failedToScore.count / failedToScore.total) * 100) : 0);
    const earlyConceded = dynamics?.conceded_early_0_20;
    const earlyConcededPct = dynamics?.conceded_early_0_20_pct ?? (earlyConceded && earlyConceded.total > 0 ? Math.round((earlyConceded.count / earlyConceded.total) * 100) : 0);

    const xg1T = periods?.['1ST']?.avg_xg !== undefined ? periods['1ST'].avg_xg.toFixed(2) : 'N/D';
    const xg2T = periods?.['2ND']?.avg_xg !== undefined ? periods['2ND'].avg_xg.toFixed(2) : 'N/D';

    // 7. Discipline & Fouls
    const disc = periodMetricsData?.discipline_stats;
    const cardsTotalAvg = disc ? disc.cards_for_avg : 0;
    const redsAvg = disc ? (disc.red_cards_avg ?? 0) : 0;
    const yellowsAvg = Math.max(0, cardsTotalAvg - redsAvg);
    const foulsNet = (disc?.fouls_committed_avg ?? 0) - (disc?.fouls_drawn_avg ?? 0);
    const foulsNetStr = foulsNet > 0
      ? `+${foulsNet.toFixed(1)} cometidas vs recibidas`
      : foulsNet < 0
        ? `+${Math.abs(foulsNet).toFixed(1)} recibidas vs cometidas`
        : '0.0 balance neutral';
    const o35Cards = disc?.over_3_5_cards;
    const pctCards = o35Cards && o35Cards.total > 0 ? Math.round((o35Cards.count / o35Cards.total) * 100) : 0;

    // 8. Base Starting XI
    const xiPlayers = mostUsedXIData?.players || [];
    const xiLines: string[] = [
      `### 8. ONCE BASE MÁS UTILIZADO (XI TITULAR — ${mostUsedXIData?.formation || formationStr})`,
      '| Pos | Jugador | % Minutos | Edad | Titular | G+A | xG | Tiros/90 | Amarillas |',
      '| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |',
    ];
    if (xiPlayers.length > 0) {
      xiPlayers.forEach((p) => {
        const slot = p.slot || '-';
        const name = p.name || 'Desconocido';
        const mins = `${Math.round(p.minutes_share || p.minutes_pct || 0)}%`;
        const age = p.age ?? '-';
        const starts = p.starts ?? p.appearances ?? '-';
        const isGK = slot === 'GK' || slot === 'G' || p.position_group === 'Goalkeeper';
        const ga = isGK
          ? (p.saves && p.saves > 0 ? `${p.saves} atajadas` : '—')
          : (p.g_plus_a ?? (p.goals + p.assists));
        const xg = isGK
          ? (p.saves_p90 ? `${p.saves_p90.toFixed(1)} ata/pj` : '—')
          : (p.xg ?? 0).toFixed(2);
        const shotsP90 = isGK ? '—' : (p.shots_p90 ?? 0).toFixed(1);
        const rawYc = p.yellow_cards ?? 0;
        const yc = rawYc === 4 ? '4 (⚠️ En Capilla)' : rawYc;
        xiLines.push(`| ${slot} | ${name} | ${mins} | ${age} | ${starts} | ${ga} | ${xg} | ${shotsP90} | ${yc} |`);
      });
    } else {
      xiLines.push('| - | Sin datos de alineación base disponibles | - | - | - | - | - | - | - |');
    }

    // 9. Presencia Ofensiva & 10. Rendimiento Defensivo y Balance Táctico (Floor 2.5 Flashscore Analytics)
    const fsLines: string[] = [];
    if (flashscoreSummary && flashscoreSummary.matches_analyzed > 0) {
      const pAll = flashscoreSummary.periods?.ALL;
      const p1T = flashscoreSummary.periods?.['1T'];
      const p2T = flashscoreSummary.periods?.['2T'];
      const gk = flashscoreSummary.goalkeeper_efficiency;

      const avgTouchesBox = (pAll?.avg_touches_in_box ?? 0).toFixed(1);
      const touches1T = (p1T?.avg_touches_in_box ?? 0).toFixed(1);
      const touches2T = (p2T?.avg_touches_in_box ?? 0).toFixed(1);

      const avgXgot = (pAll?.avg_xgot ?? 0).toFixed(2);
      const avgXgVal = (pAll?.avg_xg ?? 0).toFixed(2);
      const deltaVal = (pAll?.avg_xgot ?? 0) - (pAll?.avg_xg ?? 0);
      const deltaSignStr = deltaVal >= 0 ? '+' : '';
      const deltaStr = deltaVal.toFixed(2);

      const avgP3 = (pAll?.avg_passes_final_third_completed ?? 0).toFixed(1);
      const p3_1T = (p1T?.avg_passes_final_third_completed ?? 0).toFixed(1);
      const p3_2T = (p2T?.avg_passes_final_third_completed ?? 0).toFixed(1);

      const gp = gk?.goals_prevented ?? 0;
      const gpStr = `${gp >= 0 ? '+' : ''}${gp.toFixed(2)}`;
      const gpm = gk?.prevented_per_match ?? 0;
      const gpmStr = `${gpm >= 0 ? '+' : ''}${gpm.toFixed(2)}`;
      const xgotFacedStr = (gk?.xgot_faced ?? 0).toFixed(2);
      const gcStr = `${gk?.goals_conceded ?? 0}`;

      const net1T = (p1T?.avg_xg ?? 0) - (p1T?.avg_xg_conceded ?? 0);
      const net1TStr = `${net1T >= 0 ? '+' : ''}${net1T.toFixed(2)}`;
      const xgFav1T = (p1T?.avg_xg ?? 0).toFixed(2);
      const xgCon1T = (p1T?.avg_xg_conceded ?? 0).toFixed(2);

      const net2T = (p2T?.avg_xg ?? 0) - (p2T?.avg_xg_conceded ?? 0);
      const net2TStr = `${net2T >= 0 ? '+' : ''}${net2T.toFixed(2)}`;
      const xgFav2T = (p2T?.avg_xg ?? 0).toFixed(2);
      const xgCon2T = (p2T?.avg_xg_conceded ?? 0).toFixed(2);

      const poss1T = (p1T?.avg_possession ?? 0).toFixed(1);
      const poss2T = (p2T?.avg_possession ?? 0).toFixed(1);

      const bigScored = pAll?.total_big_chances_scored ?? 0;
      const bigMissed = pAll?.total_big_chances_missed ?? 0;
      const bigTotal = pAll?.total_big_chances ?? (bigScored + bigMissed);
      const convPct = pAll?.big_chances_conversion_pct != null
        ? pAll.big_chances_conversion_pct.toFixed(1)
        : (bigTotal > 0 ? ((bigScored * 100.0) / bigTotal).toFixed(1) : '0.0');

      fsLines.push(
        '### 9. PRESENCIA OFENSIVA & EFICIENCIA DE TIRO',
        `- Toques en Área Rival: ${avgTouchesBox} / pj (1T: ${touches1T} | 2T: ${touches2T})`,
        `- Calidad de Definición Post-Impacto: ${avgXgot} xGOT vs ${avgXgVal} xG (${deltaSignStr}${deltaStr} delta)`,
        `- Pases al Último Tercio: ${avgP3} / pj (1T: ${p3_1T} | 2T: ${p3_2T})`,
        `- Definición en Grandes Ocasiones: ${bigScored} convertidas / ${bigMissed} falladas (${convPct}% efectividad)`,
        '',
        '---',
        '',
        '### 10. RENDIMIENTO DEFENSIVO & BALANCE TÁCTICO',
        `- Goles Salvados por Portería: ${gpStr} totales (${gpmStr} / pj) | xGOT recibido: ${xgotFacedStr} vs ${gcStr} GC`,
        `- Diferencial xG Neto 1T: ${net1TStr} (${xgFav1T} fav - ${xgCon1T} con)`,
        `- Diferencial xG Neto 2T: ${net2TStr} (${xgFav2T} fav - ${xgCon2T} con)`,
        `- Dominio de Posesión: ${poss1T}% (1T) vs ${poss2T}% (2T)`
      );
    } else {
      fsLines.push(
        '### 9. PRESENCIA OFENSIVA & EFICIENCIA DE TIRO',
        '- Sin datos de presencia ofensiva disponibles.',
        '',
        '---',
        '',
        '### 10. RENDIMIENTO DEFENSIVO & BALANCE TÁCTICO',
        '- Sin datos de rendimiento defensivo disponibles.'
      );
    }

    // Assemble Comprehensive Document
    const docLines = [
      `# 📋 INFORME DE SCOUTING & INTELIGENCIA TÁCTICA`,
      `**Club:** ${teamNameUpper} | **Competición:** Liga 1 de Fútbol Profesional (Perú)`,
      `*Fecha de emisión:* ${dateStr}`,
      '',
      '---',
      '',
      '### 1. ALCANCE Y RENDIMIENTO COMPETITIVO',
      `- **Torneo:** ${tournamentLabel}`,
      `- **Sede:** ${venueLabel}`,
      `- **Contexto Táctico:** ${contextLabel}`,
      `- **Perspectiva:** ${perspectiveLabel}`,
      ...(matchContextLines.length > 0 ? matchContextLines : []),
      `- **Clasificación:** Puesto #${leagueRank} en Liga 1`,
      `- **Récord Global:** ${activeTeam.matches_played} PJ | ${activeTeam.wins}V - ${activeTeam.draws}E - ${activeTeam.losses}D (${activeTeam.points} Pts)`,
      `- **Goles:** ${activeTeam.goals_scored} GF : ${activeTeam.goals_conceded} GC (Diferencial: ${gdSign}${activeTeam.goal_difference})`,
      '',
      '---',
      '',
      ...radarLines,
      '',
      '---',
      '',
      '### 3. RED DE PASES & ESTRUCTURA TÁCTICA',
      `- **Esquema Táctico Base:** ${formationStr}`,
      `- **Circuitos Registrados:** ${edgeCount} conexiones espaciales analizadas`,
      '',
      '---',
      '',
      '### 4. MAPA DE TIROS & EFICIENCIA DE FINALIZACIÓN',
      `- **Volumen Total:** ${total_shots} remates analizados (${(total_shots / (activeTeam.matches_played || 1)).toFixed(1)} / pj)`,
      `- **Goles / Conversión:** ${goals} goles anotados (${deltaSign}${delta_val.toFixed(2)} vs xG)`,
      `- **Peligro Esperado (xG):** ${total_xg_val.toFixed(2)} xG acumulados`,
      `- **Calidad Media por Disparo:** ${xg_per_shot} xG / tiro`,
      `- **Efectividad a Puerta:** ${on_target_pct}% (${shots_on_target} disparos entre los tres palos)`,
      `- **Distribución Espacial:** ${pctInBox}% dentro del área (${inBoxCount}) | ${100 - pctInBox}% fuera del área (${total_shots - inBoxCount})`,
      `- **Top Rematadores:**`,
      ...topShooterLines,
      '',
      '---',
      '',
      '### 5. BALÓN PARADO & CÓRNERS',
      `- **Córners / PJ:** ${cornerStats ? cornerStats.corners_for_avg.toFixed(1) : 'N/D'} a favor | ${cornerStats ? cornerStats.corners_against_avg.toFixed(1) : 'N/D'} en contra | ${cornerStats ? cornerStats.corners_total_avg.toFixed(1) : 'N/D'} total partido`,
      `- **Cumplimiento Línea +8.5 Córners:** ${pct85}% (${o85?.count ?? 0} de ${o85?.total ?? 0} PJ)`,
      `- **Cumplimiento Línea +9.5 Córners:** ${pct95}% (${o95?.count ?? 0} de ${o95?.total ?? 0} PJ)`,
      `- **Concesión +4.5 Córners Rivales:** ${pct45Conceded}% (${o45Conceded?.count ?? cornerStats?.corners_conceded_over_4_5_count ?? 0} de ${o45Conceded?.total ?? activeTeam.matches_played} PJ)`,
      `- **Balance de Penales:** ${penAwarded} a favor (${penScored} convertidos) | ${penConceded} en contra`,
      `- **Goles a Balón Parado:** ${spGoals} a favor (${spGoalsScoredAvg.toFixed(2)}/pj, ${cornerGoals} de córner) | ${spGoalsConceded} concedidos (${spGoalsConcededAvg.toFixed(2)}/pj, ${cornerGoalsConceded} de córner)`,
      ...(flashscoreSummary && flashscoreSummary.matches_analyzed > 0 ? [
        `- Centros por Partido: ${(flashscoreSummary.periods?.ALL?.avg_crosses_total ?? 0).toFixed(1)} / pj (${(flashscoreSummary.periods?.ALL?.avg_crosses_completed ?? 0).toFixed(1)} compl. — ${(flashscoreSummary.periods?.ALL?.cross_accuracy_pct ?? 0).toFixed(1)}% acierto) | Goles de Cabeza: ${flashscoreSummary.periods?.ALL?.total_headed_goals ?? 0}`
      ] : []),
      '',
      '---',
      '',
      '### 6. BALANCE 1T vs 2T & DINÁMICA DE PARTIDO',
      `- **Distribución Temporal:** ${splits?.goals_1t ?? 'N/D'} goles en 1T vs ${splits?.goals_2t ?? 'N/D'} goles en 2T (${splits?.pct_goals_2t ?? 0}% en el complemento)`,
      `- **xG Medio por Período:** ${xg1T} xG en 1T vs ${xg2T} xG en 2T`,
      `- **Intervalo Pico de Gol:** ${splits?.peak_scoring_interval || 'N/D'}`,
      `- **Ambos Anotan (BTTS):** ${pctBtts}% (${btts?.count ?? 0} de ${btts?.total ?? 0} PJ)`,
      `- **Valla Invicta:** ${cleanSheets?.count ?? 0} de ${cleanSheets?.total ?? htTotal} PJ (${cleanSheetsPct}%)`,
      `- **Sin Anotar (0 Goles):** ${failedToScore?.count ?? 0} de ${failedToScore?.total ?? htTotal} PJ (${failedToScorePct}%)`,
      `- **Gol Concedido Temprano (0-20'):** ${earlyConceded?.count ?? 0} de ${earlyConceded?.total ?? htTotal} PJ (${earlyConcededPct}%)`,
      `- **Marcador al Descanso (HT):** ${htWon}V - ${htDrawn}E - ${htLost}D (Lideraba en ${htWon} de ${htTotal || activeTeam.matches_played} PJ)`,
      `- **Al Anotar Primero:** ${scored1st?.count ?? 0} de ${scored1st?.total ?? 0} PJ (${pctScored1st}%) — Récord: ${scored1st?.record || 'N/D'}`,
      `- **Al Conceder Primero:** ${conceded1st?.count ?? 0} de ${conceded1st?.total ?? 0} PJ (${pctConceded1st}%) — Récord: ${conceded1st?.record || 'N/D'}`,
      '',
      '---',
      '',
      '### 7. PERFIL DISCIPLINARIO & FALTAS',
      `- **Tarjetas / PJ:** ${yellowsAvg.toFixed(1)} amarillas/pj + ${redsAvg.toFixed(1)} rojas/pj (${cardsTotalAvg.toFixed(1)} total/pj)`,
      `- **Tarjetas Provocadas:** ${disc ? disc.cards_forced_avg.toFixed(1) : 'N/D'} / pj | Total partido: ${disc ? disc.cards_match_total_avg.toFixed(1) : 'N/D'} / pj`,
      `- **Tarjetas Rojas:** ${disc?.red_cards_total ?? 0} totales (${disc?.red_cards_avg !== undefined ? disc.red_cards_avg.toFixed(2) : '0.00'} / pj)`,
      `- **Concentración 2T:** ${disc?.cards_2h_pct ?? 'N/D'}% de las tarjetas recibidas ocurren en el segundo tiempo`,
      `- **Cumplimiento Línea +3.5 Tarjetas:** ${pctCards}% (${o35Cards?.count ?? 0} de ${o35Cards?.total ?? 0} PJ)`,
      `- **Faltas / PJ:** ${disc ? disc.fouls_committed_avg.toFixed(1) : 'N/D'} cometidas vs ${disc ? disc.fouls_drawn_avg.toFixed(1) : 'N/D'} recibidas (${foulsNetStr})`,
      '',
      '---',
      '',
      ...xiLines,
      '',
      '---',
      '',
      ...fsLines,
      '',
      '---',
      `> *Informe exportado desde Liga 1 Scout Intelligence Suite.*`,
    ];

    const markdownText = docLines.join('\n');

    try {
      await navigator.clipboard.writeText(markdownText);
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

  return (
    <div className="min-h-screen bg-[#f8f9fa] w-full px-2 sm:px-4 lg:px-6 py-4 text-slate-900">
      <div className="w-full space-y-4">
        {/* =================================================================== */}
        {/* 1. INSTITUTIONAL HEADER STRIP                                       */}
        {/* =================================================================== */}
        <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Dropdown Selector for 18 Clubs */}
          <div className="flex items-center shrink-0">
            <select
              value={activeTeam?.team_id || ''}
              onChange={(e) => handleClubChange(Number(e.target.value))}
              disabled={isLoading && !allTeamsList}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy cursor-pointer min-w-[240px] sm:min-w-[280px]"
            >
              {(allTeamsList || teams)?.map((t) => (
                <option key={`club-opt-${t.team_id}`} value={t.team_id}>
                  [{getTeamTricode(t.team_id, t.name)}] {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Center/Info: Official Crest, Club Name, Ranking Badge, Record Strip */}
          {activeTeam ? (
            <div className="flex flex-wrap items-center gap-3.5 lg:justify-center flex-1">
              <img
                src={getTeamCrestUrl(activeTeam.team_id, activeTeam.logo_url)}
                alt={activeTeam.name}
                className="h-12 w-12 object-contain shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/liga1-logo.png';
                }}
              />

              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold text-slate-900 tracking-tight leading-tight">
                    {activeTeam.name}
                  </h1>
                  
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                    <Trophy className="w-3 h-3 text-amber-600" />
                    {leagueRank ? `#${leagueRank} en Liga 1` : 'Sin ranking'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-normal text-slate-600">
                  <span>{activeTeam.matches_played} PJ</span>
                  <span className="text-slate-300">•</span>
                  <span>{activeTeam.wins}V - {activeTeam.draws}E - {activeTeam.losses}D</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-medium text-slate-800">{activeTeam.points} Pts</span>
                  <span className="text-slate-300">•</span>
                  <span>
                    {activeTeam.goals_scored} GF : {activeTeam.goals_conceded} GC (
                    <span className={activeTeam.goal_difference > 0 ? 'text-emerald-600 font-medium' : activeTeam.goal_difference < 0 ? 'text-rose-600 font-medium' : 'text-slate-600 font-medium'}>
                      {activeTeam.goal_difference > 0 ? `+${activeTeam.goal_difference}` : activeTeam.goal_difference}
                    </span>)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-xs flex-1 lg:justify-center">
              <Shield className="w-4 h-4 text-slate-300" />
              <span>Cargando club seleccionado...</span>
            </div>
          )}

          {/* Right: Actions (Copiar Informe & Segmented Tournament Toggle) */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto shrink-0">
            {/* Action Button: Copiar Informe Completo */}
            <button
              type="button"
              onClick={handleCopyComprehensiveReport}
              disabled={!activeTeam}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-2xs cursor-pointer ${
                isReportCopied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-400'
                  : 'bg-white text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
              }`}
              title="Copiar informe de scouting integral de todas las secciones en formato Markdown"
            >
              {isReportCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">¡Informe copiado!</span>
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-3.5 h-3.5 text-sky-600" />
                  <span>Copiar Informe Completo</span>
                </>
              )}
            </button>

            {/* Segmented Tournament Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedTournament('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  selectedTournament === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Temporada Completa
              </button>
              <button
                type="button"
                onClick={() => setSelectedTournament('Apertura')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  selectedTournament === 'Apertura'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Apertura
              </button>
              <button
                type="button"
                onClick={() => setSelectedTournament('Clausura')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  selectedTournament === 'Clausura'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Clausura
              </button>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. GLOBAL TACTICAL TOOLBAR                                          */}
        {/* =================================================================== */}
        <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Left Controls: Perspective, Aggregation Mode, Match Selector, Player Selector */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Perspective segmented control: [ A Favor | Concedidos ] */}
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => setPerspective('for')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  perspective === 'for'
                    ? 'bg-white text-navy shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                A Favor
              </button>
              <button
                type="button"
                onClick={() => setPerspective('against')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  perspective === 'against'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Concedidos
              </button>
            </div>

            {/* Aggregation mode segmented control: [ Acumulado | Por Partido ] */}
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => setAggregationMode('cumulative')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  aggregationMode === 'cumulative'
                    ? 'bg-white text-navy shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Acumulado
              </button>
              <button
                type="button"
                onClick={() => setAggregationMode('match')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  aggregationMode === 'match'
                    ? 'bg-white text-navy shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Por Partido
              </button>
            </div>

            {/* Venue segmented control: [ Todos | Local | Visitante ] (hidden in match mode) */}
            {aggregationMode === 'cumulative' && (
              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setVenue('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    venue === 'all'
                      ? 'bg-white text-navy shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setVenue('home')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    venue === 'home'
                      ? 'bg-white text-navy shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Local
                </button>
                <button
                  type="button"
                  onClick={() => setVenue('away')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    venue === 'away'
                      ? 'bg-white text-navy shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Visitante
                </button>
              </div>
            )}

            {/* Context filter dropdown (hidden in match mode) */}
            {aggregationMode === 'cumulative' && (
              <div className="flex items-center">
                <select
                  value={contextFilter}
                  onChange={(e) => setContextFilter(e.target.value as ContextFilter)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy cursor-pointer"
                  title="Filtro de Contexto Competitivo"
                >
                  <option value="all">Contexto: Todos los rivales</option>
                  <option value="vs_elite">vs. Élite (Alianza, U, Cristal, Melgar)</option>
                  <option value="vs_rest">vs. Resto de la Liga</option>
                  <option value="altitude">Solo partidos en Altura (&gt;2,000m)</option>
                  <option value="sea_level">Solo partidos en Llano</option>
                </select>
              </div>
            )}

            {/* Match Selector Dropdown (visible when Por Partido is active) */}
            {aggregationMode === 'match' && (
              <div className="flex items-center">
                <select
                  value={selectedMatchId || ''}
                  onChange={(e) => setSelectedMatchId(Number(e.target.value))}
                  disabled={isLoadingMatches || !matches || matches.length === 0}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy cursor-pointer max-w-[220px] sm:max-w-[280px]"
                >
                  {isLoadingMatches ? (
                    <option value="">Cargando partidos...</option>
                  ) : !matches || matches.length === 0 ? (
                    <option value="">Sin partidos disponibles</option>
                  ) : (
                    matches?.map((m) => (
                      <option key={`match-opt-${m.match_id}`} value={m.match_id}>
                        {m.date ? `${m.date} - ` : ''}vs {m.opponent_name || 'Rival'} ({m.team_score ?? '?'}-{m.opponent_score ?? '?'})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {/* Player Filter Dropdown */}
            <div className="relative flex items-center">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                className="pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy cursor-pointer appearance-none max-w-[190px] sm:max-w-[220px]"
              >
                <option value="all">
                  {perspective === 'against' ? 'Todos los Rivales' : 'Plantel Completo'}
                </option>
                {availablePlayers?.map((p) => (
                  <option key={`player-opt-${p.name}`} value={p.name}>
                    {p.name} ({p.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Right: Multi-Select Chart Visibility Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-700 shadow-xs transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>{activeCount} gráficos visibles</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-3.5 space-y-1">
                {/* Header Actions: Vistas Tácticas & Todos | Restablecer */}
                <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-800">Vistas Tácticas</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs text-sky-600 hover:text-sky-700 font-medium transition-colors cursor-pointer"
                    >
                      Todos
                    </button>
                    <span className="text-slate-300 text-xs">|</span>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      Restablecer
                    </button>
                  </div>
                </div>

                {/* Floor 1 Options */}
                <div className="px-2 pt-1 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  TRÍO BASE
                </div>
                {AVAILABLE_CHARTS.filter((c) => c.floor === 1).map((chart) => {
                  const isChecked = visibleCharts[chart.id];
                  return (
                    <button
                      key={chart.id}
                      type="button"
                      onClick={() => toggleChart(chart.id)}
                      className="w-full flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-slate-50 transition-colors cursor-pointer text-left"
                    >
                      <span className="text-xs font-medium text-slate-700">{chart.label}</span>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-sky-600 border-sky-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}

                {/* Floor 2 Options */}
                <div className="px-2 pt-2.5 mt-2.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-t border-slate-100">
                  VISTAS EXPANDIDAS
                </div>
                {AVAILABLE_CHARTS.filter((c) => c.floor === 2).map((chart) => {
                  const isChecked = visibleCharts[chart.id];
                  return (
                    <button
                      key={chart.id}
                      type="button"
                      onClick={() => toggleChart(chart.id)}
                      className="w-full flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-slate-50 transition-colors cursor-pointer text-left"
                    >
                      <span className="text-xs font-medium text-slate-700">{chart.label}</span>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-sky-600 border-sky-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* GRACEFUL EMPTY STATE WARNING BANNER                                 */}
        {/* =================================================================== */}
        {isEmptyState && (
          <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="text-base select-none leading-none">⚠️</span>
              <span className="text-xs sm:text-sm font-medium">
                Sin partidos registrados para esta combinación de filtros ({venueLabel} + {contextFilterLabel}). Mostrando 0 encuentros.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setContextFilter('all')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-100/60 text-amber-900 text-xs font-semibold rounded-lg border border-amber-300 shadow-2xs transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              Restablecer Filtro de Contexto
            </button>
          </div>
        )}

        {/* =================================================================== */}
        {/* 3. MAIN WORKSPACE / 2-TIER DYNAMIC RESPONSIVE GRID                  */}
        {/* =================================================================== */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <Loader2 className="w-9 h-9 text-slate-400 animate-spin mb-3" />
            <p className="text-xs font-medium text-slate-500">
              Cargando información del club...
            </p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 bg-rose-50 rounded-xl border border-rose-200 text-center px-4">
            <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
            <h3 className="text-sm font-bold text-rose-900">Error al conectar con la base de datos</h3>
            <p className="text-xs text-rose-700 mt-1 max-w-md">
              {error instanceof Error ? error.message : 'No se pudo cargar el perfil del club.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          </div>
        ) : activeTeam ? (
          <div className="space-y-4">
            {/* ------------------------------------------------------------- */}
            {/* FLOOR 1: BASE TRIO (3-COLUMN RESPONSIVE GRID)                */}
            {/* ------------------------------------------------------------- */}
            {hasFloor1Charts && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 items-stretch">
                {/* 1. Radar Chart */}
                {visibleCharts.radar && (
                  <div className="w-full flex flex-col h-full min-h-[650px]">
                    <TeamTacticalRadar
                      teams={teams || []}
                      activeTeam={activeTeam}
                      tournament={selectedTournament}
                    />
                  </div>
                )}

                {/* 2. Passing Network */}
                {visibleCharts.pass_network && (
                  <div className="w-full flex flex-col h-full min-h-[650px]">
                    <TeamPassNetwork
                      teams={teams || []}
                      activeTeam={activeTeam}
                      tournament={selectedTournament}
                      viewMode={aggregationMode}
                      selectedMatchId={selectedMatchId}
                      venue={venue}
                      contextFilter={contextFilter}
                    />
                  </div>
                )}

                {/* 3. Shot Map */}
                {visibleCharts.shot_map && (
                  <div className="w-full flex flex-col h-full min-h-[650px] [&>div]:!col-span-1">
                    <TeamShotMap
                      teams={teams}
                      activeTeam={activeTeam}
                      tournament={selectedTournament}
                      mode={perspective}
                      viewMode={aggregationMode}
                      selectedMatchId={selectedMatchId}
                      selectedPlayer={selectedPlayer}
                      venue={venue}
                      contextFilter={contextFilter}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* FLOOR 2: EXECUTIVE ANALYTICAL CARDS (/PJ) (3-COLUMN GRID)     */}
            {/* ------------------------------------------------------------- */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 items-stretch">
              <TeamSetPiecesCard
                activeTeam={activeTeam}
                tournament={selectedTournament}
                venue={venue}
                mode={perspective}
                contextFilter={contextFilter}
                flashscoreSummary={flashscoreSummary}
              />
              <TeamPeriodMetricsCard
                activeTeam={activeTeam}
                tournament={selectedTournament}
                venue={venue}
                mode={perspective}
                contextFilter={contextFilter}
              />
              <TeamDisciplineCard
                activeTeam={activeTeam}
                tournament={selectedTournament}
                venue={venue}
                contextFilter={contextFilter}
              />
            </div>

            {/* ------------------------------------------------------------- */}
            {/* FLOOR 2.5: FLASHSCORE ADVANCED ANALYTICS (3-COLUMN GRID)       */}
            {/* ------------------------------------------------------------- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TeamBoxControlCard data={flashscoreSummary} isLoading={isFlashscoreLoading} />
              <TeamGoalkeeperCard data={flashscoreSummary} isLoading={isFlashscoreLoading} />
              <TeamPeriodDominanceCard data={flashscoreSummary} isLoading={isFlashscoreLoading} />
            </div>

            {/* ------------------------------------------------------------- */}
            {/* MOST-USED XI SECTION (OPTA / THEANALYST FULL-WIDTH LAYOUT)   */}
            {/* ------------------------------------------------------------- */}
            <div className="w-full">
              <TeamMostUsedXICard
                activeTeam={activeTeam}
                tournament={selectedTournament}
                venue={venue}
                contextFilter={contextFilter}
              />
            </div>

            {/* ------------------------------------------------------------- */}
            {/* FLOOR 3: EXPANDED PITCH VIEWS (SIDE-BY-SIDE IF BOTH ACTIVE)   */}
            {/* ------------------------------------------------------------- */}
            {hasFloor2Charts && (
              <div
                className={
                  bothFloor2Active
                    ? 'grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-stretch'
                    : 'grid grid-cols-1 max-w-5xl mx-auto gap-3.5 items-stretch'
                }
              >
                {/* 4. Attack & Infiltration Zones */}
                {visibleCharts.attack_zones && (
                  <div className="w-full flex flex-col [&>div]:h-full [&>div]:!col-span-1">
                    <TeamAttackZones
                      teams={teams}
                      activeTeam={activeTeam}
                      tournament={selectedTournament}
                      mode={perspective}
                      viewMode={aggregationMode}
                      selectedMatchId={selectedMatchId}
                      venue={venue}
                      contextFilter={contextFilter}
                    />
                  </div>
                )}

                {/* 5. Defensive Actions */}
                {visibleCharts.defensive_actions && (
                  <div className="w-full flex flex-col [&>div]:h-full [&>div]:!col-span-1">
                    <TeamDefensiveTerritory
                      teams={teams}
                      activeTeam={activeTeam}
                      tournament={selectedTournament}
                      viewMode={aggregationMode}
                      selectedMatchId={selectedMatchId}
                      venue={venue}
                      contextFilter={contextFilter}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Empty state when user unchecks all charts */}
            {!hasFloor1Charts && !hasFloor2Charts && (
              <div className="py-16 text-center text-slate-500 bg-white border border-slate-200 rounded-xl space-y-2">
                <p className="text-sm font-semibold text-slate-700">No hay gráficos seleccionados para visualizar</p>
                <p className="text-xs text-slate-400">Usa el menú desplegable superior para activar las vistas tácticas deseadas.</p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restablecer Trío Base
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500 bg-white border border-slate-200 rounded-xl">
            No se encontraron datos para el torneo seleccionado.
          </div>
        )}
      </div>
    </div>
  );
};

export default ClubDetailAnalytics;

