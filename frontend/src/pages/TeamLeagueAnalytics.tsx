import React, { useState, useMemo } from 'react';
import { 
  Loader2, AlertCircle, RefreshCw, ArrowLeftRight,
  Square, LayoutGrid, Compass, BarChart3, Target,
  ArrowDownWideNarrow, ArrowUpNarrowWide
} from 'lucide-react';
import { useTeamMetrics } from '../hooks/useTeam';
import TeamScatterPlot from '../components/TeamScatterPlot';
import TeamBarRanking from '../components/analytics/TeamBarRanking';
import TeamShotZones, { ShotPerspective, ShotDisplayMode } from '../components/analytics/TeamShotZones';
import { 
  Team34MetricKey, 
  METRIC_CATALOG, 
  METRIC_CATEGORIES_ORDER, 
  computeMetricCohortStats 
} from '../types/metrics';
import { getTeamTricode } from '../utils/teams';

type TournamentFilter = 'all' | 'Apertura' | 'Clausura';
type ViewMode = 'single' | 'multi';
type ActiveChart = 'scatter' | 'bar_ranking' | 'shot_zones';
type ReferenceLineMode = 'median' | 'mean';
type SortOrder = 'desc' | 'asc';

export const TeamLeagueAnalytics: React.FC = () => {
  const [tournament, setTournament] = useState<TournamentFilter>('all');
  
  // View mode and Active Chart Architecture
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [activeChart, setActiveChart] = useState<ActiveChart>('scatter');

  // 1. Scatter Plot Parametric State
  const [xAxisMetric, setXAxisMetric] = useState<Team34MetricKey>('field_tilt');
  const [yAxisMetric, setYAxisMetric] = useState<Team34MetricKey>('xg');
  const [referenceLineMode, setReferenceLineMode] = useState<ReferenceLineMode>('median');

  // 2. Bar Ranking State
  const [barMetric, setBarMetric] = useState<Team34MetricKey>('xg');
  const [barSortOrder, setBarSortOrder] = useState<SortOrder>('desc');

  // 3. Shot Zones State
  const [selectedTeamId, setSelectedTeamId] = useState<number>(2311); // Default: Alianza Lima
  const [shotPerspective, setShotPerspective] = useState<ShotPerspective>('taken');
  const [shotDisplayMode, setShotDisplayMode] = useState<ShotDisplayMode>('count');

  const queryTournament = tournament === 'all' ? undefined : tournament;
  const { data: teams, isLoading, isError, error, refetch, isFetching } = useTeamMetrics(queryTournament);

  // Selected team for shot zones
  const selectedTeam = useMemo(() => {
    if (!teams || teams.length === 0) return null;
    return teams.find((t) => t.team_id === selectedTeamId) || teams[0];
  }, [teams, selectedTeamId]);

  // Statistical cohort calculations for selected X and Y metrics (Scatter)
  const xStats = useMemo(
    () => computeMetricCohortStats(teams, xAxisMetric, referenceLineMode),
    [teams, xAxisMetric, referenceLineMode]
  );

  const yStats = useMemo(
    () => computeMetricCohortStats(teams, yAxisMetric, referenceLineMode),
    [teams, yAxisMetric, referenceLineMode]
  );

  // Statistical cohort calculations for Bar metric
  const barStats = useMemo(
    () => computeMetricCohortStats(teams, barMetric, 'median'),
    [teams, barMetric]
  );

  const handleSwapAxes = () => {
    setXAxisMetric(yAxisMetric);
    setYAxisMetric(xAxisMetric);
  };

  const currentXDef = METRIC_CATALOG[xAxisMetric];
  const currentYDef = METRIC_CATALOG[yAxisMetric];
  const currentBarDef = METRIC_CATALOG[barMetric];

  return (
    <div className="min-h-screen bg-[#f8f9fa] -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 text-slate-900">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* =================================================================== */}
        {/* 1. HEADER STRIP: Title + View Mode + Tournament Switchers           */}
        {/* =================================================================== */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-slate-200 gap-3">
          <h1 className="text-2xl sm:text-3xl font-display tracking-tight text-slate-900 font-bold">
            Liga 1 — Análisis de Equipos y Rendimiento
          </h1>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* View Mode Toggle: [ Gráfico Individual ] [ Vista Múltiple ] */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  viewMode === 'single'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Square className="w-3.5 h-3.5 text-slate-500" />
                <span>Gráfico Individual</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('multi')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  viewMode === 'multi'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
                <span>Vista Múltiple</span>
              </button>
            </div>

            {/* Tournament Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setTournament('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  tournament === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Temporada Completa
              </button>
              <button
                onClick={() => setTournament('Apertura')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  tournament === 'Apertura'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Apertura
              </button>
              <button
                onClick={() => setTournament('Clausura')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  tournament === 'Clausura'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Clausura
              </button>
              {isFetching && !isLoading && (
                <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin ml-1" />
              )}
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. ACTIVE CHART SELECTOR (When in Single View Mode)                 */}
        {/* =================================================================== */}
        {viewMode === 'single' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveChart('scatter')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeChart === 'scatter'
                  ? 'bg-navy text-white border-navy shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>1. Matriz Táctica 2D (Cuadrantes)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveChart('bar_ranking')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeChart === 'bar_ranking'
                  ? 'bg-navy text-white border-navy shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>2. Ranking de Barras de Liga</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveChart('shot_zones')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeChart === 'shot_zones'
                  ? 'bg-navy text-white border-navy shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>3. Zonas de Remate (5×6)</span>
            </button>
          </div>
        )}

        {/* =================================================================== */}
        {/* 3. DYNAMIC CONTROL BAR BASED ON ACTIVE CHART (Single View Only)     */}
        {/* =================================================================== */}
        {viewMode === 'single' && (
          <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-3 shadow-xs space-y-2.5">
            {/* Case A: SCATTER PLOT CONTROLS */}
            {activeChart === 'scatter' && (
          <>
            <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
              {/* Selectors Group */}
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Selector Eje X */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">X:</span>
                  <select
                    value={xAxisMetric}
                    onChange={(e) => setXAxisMetric(e.target.value as Team34MetricKey)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy cursor-pointer min-w-[260px] sm:min-w-[280px]"
                  >
                    {METRIC_CATEGORIES_ORDER.map((group) => (
                      <optgroup key={`x-${group.category}`} label={group.category}>
                        {group.keys.map((key) => {
                          const def = METRIC_CATALOG[key];
                          return (
                            <option key={`x-${key}`} value={key}>
                              {def.label}
                            </option>
                          );
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Swap button */}
                <button
                  type="button"
                  onClick={handleSwapAxes}
                  title="Intercambiar ejes X / Y"
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>

                {/* Selector Eje Y */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Y:</span>
                  <select
                    value={yAxisMetric}
                    onChange={(e) => setYAxisMetric(e.target.value as Team34MetricKey)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy cursor-pointer min-w-[260px] sm:min-w-[280px]"
                  >
                    {METRIC_CATEGORIES_ORDER.map((group) => (
                      <optgroup key={`y-${group.category}`} label={group.category}>
                        {group.keys.map((key) => {
                          const def = METRIC_CATALOG[key];
                          return (
                            <option key={`y-${key}`} value={key}>
                              {def.label}
                            </option>
                          );
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference line mode toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Línea:</span>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setReferenceLineMode('median')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      referenceLineMode === 'median'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Mediana
                  </button>
                  <button
                    type="button"
                    onClick={() => setReferenceLineMode('mean')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      referenceLineMode === 'mean'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Media
                  </button>
                </div>
              </div>
            </div>

            {/* Unified Dark Background Diagnostic Pill */}
            {xStats && yStats && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center">
                <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs shadow-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="text-slate-300 font-medium">X ({currentXDef.shortLabel}):</span>
                    <span className="font-mono font-bold text-white">{currentXDef.format(xStats.referenceValue)}</span>
                    <span className="text-slate-400 text-[10px]">[{currentXDef.format(xStats.min)} — {currentXDef.format(xStats.max)}]</span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-slate-300 font-medium">Y ({currentYDef.shortLabel}):</span>
                    <span className="font-mono font-bold text-emerald-400">{currentYDef.format(yStats.referenceValue)}</span>
                    <span className="text-slate-400 text-[10px]">[{currentYDef.format(yStats.min)} — {currentYDef.format(yStats.max)}]</span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400 text-[11px]">
                    Línea: {referenceLineMode === 'median' ? 'Mediana' : 'Media'} de Liga (18 clubes)
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Case B: BAR RANKING CONTROLS */}
        {activeChart === 'bar_ranking' && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              {/* Single Metric Selector */}
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Métrica:</span>
                <select
                  value={barMetric}
                  onChange={(e) => setBarMetric(e.target.value as Team34MetricKey)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy cursor-pointer min-w-[260px] sm:min-w-[280px]"
                >
                  {METRIC_CATEGORIES_ORDER.map((group) => (
                    <optgroup key={`bar-${group.category}`} label={group.category}>
                      {group.keys.map((key) => {
                        const def = METRIC_CATALOG[key];
                        return (
                          <option key={`bar-${key}`} value={key}>
                            {def.label}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Controls Group: Order Toggle & Reference Mode */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {/* Order Toggle: [ Mayor a Menor ] [ Menor a Mayor ] */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Orden:</span>
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setBarSortOrder('desc')}
                      className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        barSortOrder === 'desc'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                      <span>Mayor a Menor</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBarSortOrder('asc')}
                      className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        barSortOrder === 'asc'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <ArrowUpNarrowWide className="w-3.5 h-3.5" />
                      <span>Menor a Mayor</span>
                    </button>
                  </div>
                </div>

                {/* Reference line mode toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Línea:</span>
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setReferenceLineMode('median')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        referenceLineMode === 'median'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Mediana
                    </button>
                    <button
                      type="button"
                      onClick={() => setReferenceLineMode('mean')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        referenceLineMode === 'mean'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Media
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Unified Dark Background Diagnostic Pill */}
            {barStats && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center">
                <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs shadow-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="text-slate-300 font-medium">{currentBarDef.label}:</span>
                    <span className="text-slate-400">Mediana:</span>
                    <span className="font-mono font-bold text-white">{currentBarDef.format(barStats.median)}</span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-slate-400">Media:</span>
                    <span className="font-mono font-bold text-slate-200">{currentBarDef.format(barStats.mean)}</span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400 text-[10px]">
                    Rango: [{currentBarDef.format(barStats.min)} — {currentBarDef.format(barStats.max)}]
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Case C: SHOT ZONES CONTROLS */}
        {activeChart === 'shot_zones' && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              {/* Club Selector */}
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Club:</span>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(Number(e.target.value))}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy cursor-pointer min-w-[260px] sm:min-w-[280px]"
                >
                  {teams?.map((t) => (
                    <option key={`zone-team-${t.team_id}`} value={t.team_id}>
                      [{getTeamTricode(t.team_id, t.name)}] {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {/* Perspective Toggle: [ Tiros a Favor ] [ Tiros Concedidos ] */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Perspectiva:</span>
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShotPerspective('taken')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        shotPerspective === 'taken'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Tiros a Favor
                    </button>
                    <button
                      type="button"
                      onClick={() => setShotPerspective('conceded')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        shotPerspective === 'conceded'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Tiros Concedidos
                    </button>
                  </div>
                </div>

                {/* Display Mode Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Modo:</span>
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShotDisplayMode('count')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        shotDisplayMode === 'count'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Remates
                    </button>
                    <button
                      type="button"
                      onClick={() => setShotDisplayMode('xg')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        shotDisplayMode === 'xg'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      xG Acum.
                    </button>
                    <button
                      type="button"
                      onClick={() => setShotDisplayMode('pct')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        shotDisplayMode === 'pct'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      % Total
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Unified Dark Background Diagnostic Pill */}
            {selectedTeam && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center">
                <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs shadow-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="font-bold text-white">{selectedTeam.name}</span>
                    <span className="text-slate-400 text-[10.5px]">({selectedTeam.matches_played} PJ)</span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-300">
                    {shotPerspective === 'taken' 
                      ? `${selectedTeam.total_shots} Tiros · ${selectedTeam.xg.toFixed(2)} xG · ${selectedTeam.goals_scored} Goles marcados`
                      : `${selectedTeam.shots_conceded} Tiros recibidos · ${selectedTeam.xga.toFixed(2)} xGA · ${selectedTeam.goals_conceded} Goles encajados`
                    }
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400 text-[10.5px]">
                    Celdas: {shotDisplayMode === 'count' ? 'Remates totales' : shotDisplayMode === 'xg' ? 'xG acumulado' : 'Porcentaje del total'}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )}

      {/* =================================================================== */}
      {/* 4. MAIN CANVAS ROUTING                                              */}
      {/* =================================================================== */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <Loader2 className="w-10 h-10 text-slate-400 animate-spin mb-4" />
          <p className="text-sm font-medium text-slate-600">
            Cargando métricas de los 18 clubes de la Liga 1...
          </p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 bg-rose-50 rounded-2xl border border-rose-200 text-center px-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
          <h3 className="text-base font-bold text-rose-900">Error al cargar métricas de equipos</h3>
          <p className="text-xs text-rose-700 mt-1 max-w-md">
            {error instanceof Error ? error.message : 'No se pudo conectar con el endpoint /api/teams/metrics'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      ) : teams && teams.length > 0 ? (
        <>
          {/* View Mode: Single vs Multi */}
          {viewMode === 'single' ? (
            <>
              {/* Option 1: Scatter Plot */}
              {activeChart === 'scatter' && (
                <TeamScatterPlot
                  teams={teams}
                  xAxisMetric={xAxisMetric}
                  yAxisMetric={yAxisMetric}
                  referenceLineMode={referenceLineMode}
                  xStats={xStats}
                  yStats={yStats}
                  tournamentLabel={tournament === 'all' ? 'Temporada Completa' : tournament}
                />
              )}

              {/* Option 2: Bar Ranking */}
              {activeChart === 'bar_ranking' && (
                <TeamBarRanking
                  teams={teams}
                  metricKey={barMetric}
                  sortOrder={barSortOrder}
                  referenceMode={referenceLineMode}
                  tournamentLabel={tournament === 'all' ? 'Temporada Completa' : tournament}
                />
              )}

              {/* Option 3: Shot Zones (Step 3C) */}
              {activeChart === 'shot_zones' && (
                <TeamShotZones
                  teams={teams}
                  selectedTeamId={selectedTeamId}
                  onSelectTeamId={setSelectedTeamId}
                  tournament={tournament}
                  perspective={shotPerspective}
                  onPerspectiveChange={setShotPerspective}
                  displayMode={shotDisplayMode}
                  onDisplayModeChange={setShotDisplayMode}
                />
              )}
            </>
          ) : (
            /* Multi View Mode: Renders Scatter Plot, Bar Ranking, and Shot Zones */
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-navy" />
                  Modo Vista Múltiple Activo
                </span>
                <span className="text-slate-500">
                  Panel analítico integral de la Liga 1 (Cuadrantes, Ranking de Barras y Zonas de Tiro)
                </span>
              </div>

              {/* Matriz 2D in Multi View */}
              <TeamScatterPlot
                teams={teams}
                xAxisMetric={xAxisMetric}
                yAxisMetric={yAxisMetric}
                referenceLineMode={referenceLineMode}
                xStats={xStats}
                yStats={yStats}
                tournamentLabel={tournament === 'all' ? 'Temporada Completa' : tournament}
              />

              {/* Bar Ranking in Multi View */}
              <TeamBarRanking
                teams={teams}
                metricKey={barMetric}
                sortOrder={barSortOrder}
                referenceMode={referenceLineMode}
                tournamentLabel={tournament === 'all' ? 'Temporada Completa' : tournament}
              />

              {/* Shot Zones in Multi View */}
              <TeamShotZones
                teams={teams}
                selectedTeamId={selectedTeamId}
                onSelectTeamId={setSelectedTeamId}
                tournament={tournament}
                perspective={shotPerspective}
                onPerspectiveChange={setShotPerspective}
                displayMode={shotDisplayMode}
                onDisplayModeChange={setShotDisplayMode}
              />
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-slate-500 bg-slate-50 rounded-xl">
          No se encontraron datos para el torneo seleccionado.
        </div>
      )}
      </div>
    </div>
  );
};

export default TeamLeagueAnalytics;
