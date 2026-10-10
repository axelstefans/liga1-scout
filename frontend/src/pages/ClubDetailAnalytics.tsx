import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Loader2, AlertCircle, RefreshCw, Trophy, Shield,
  ChevronDown, Check, SlidersHorizontal, RotateCcw, User
} from 'lucide-react';
import { useTeamMetrics, useTeamMatches, useTeamShotMap } from '../hooks/useTeam';
import { getTeamCrestUrl, getTeamTricode } from '../utils/teams';
import TeamTacticalRadar from '../components/analytics/TeamTacticalRadar';
import TeamPassNetwork from '../components/analytics/TeamPassNetwork';
import TeamShotMap from '../components/analytics/TeamShotMap';
import TeamAttackZones from '../components/analytics/TeamAttackZones';
import TeamDefensiveTerritory from '../components/analytics/TeamDefensiveTerritory';
import TeamSetPiecesCard from '../components/analytics/TeamSetPiecesCard';
import TeamPeriodMetricsCard from '../components/analytics/TeamPeriodMetricsCard';
import TeamDisciplineCard from '../components/analytics/TeamDisciplineCard';
import { VenueFilter } from '../services/api';

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
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all');

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

  // Fetch all 18 teams and their cohort stats for current tournament filter and venue
  const { 
    data: teams, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useTeamMetrics(selectedTournament === 'all' ? undefined : selectedTournament, venue);

  // Synchronize selectedTeamId when URL param changes or when teams load
  useEffect(() => {
    if (id) {
      const parsedId = parseInt(id, 10);
      if (!isNaN(parsedId) && parsedId !== selectedTeamId) {
        setSelectedTeamId(parsedId);
      }
    } else if (teams && teams.length > 0 && selectedTeamId === null) {
      // Default to the current league leader (index 0)
      setSelectedTeamId(teams[0].team_id);
    }
  }, [id, teams, selectedTeamId]);

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
    if (!teams || teams.length === 0) {
      return { activeTeam: null, leagueRank: null };
    }
    if (selectedTeamId !== null) {
      const index = teams.findIndex((t) => t.team_id === selectedTeamId);
      if (index !== -1) {
        return { activeTeam: teams[index], leagueRank: index + 1 };
      }
    }
    // Fallback to top team
    return { activeTeam: teams[0], leagueRank: 1 };
  }, [teams, selectedTeamId]);

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

  // Fetch shot map data for player dropdown options
  const { data: shotData } = useTeamShotMap(
    activeTeam?.team_id,
    selectedTournament,
    aggregationMode === 'match' ? selectedMatchId : null,
    perspective,
    venue
  );

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
              disabled={isLoading || !teams}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy cursor-pointer min-w-[240px] sm:min-w-[280px]"
            >
              {teams?.map((t) => (
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
                    #{leagueRank} en Liga 1
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

          {/* Right: Segmented Tournament Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start lg:self-auto shrink-0">
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
        ) : activeTeam && teams && teams.length > 0 ? (
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
                      teams={teams}
                      activeTeam={activeTeam}
                      tournament={selectedTournament}
                    />
                  </div>
                )}

                {/* 2. Passing Network */}
                {visibleCharts.pass_network && (
                  <div className="w-full flex flex-col h-full min-h-[650px]">
                    <TeamPassNetwork
                      teams={teams}
                      activeTeam={activeTeam}
                      tournament={selectedTournament}
                      viewMode={aggregationMode}
                      selectedMatchId={selectedMatchId}
                      venue={venue}
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
              />
              <TeamPeriodMetricsCard
                activeTeam={activeTeam}
                tournament={selectedTournament}
                venue={venue}
                mode={perspective}
              />
              <TeamDisciplineCard
                activeTeam={activeTeam}
                tournament={selectedTournament}
                venue={venue}
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

