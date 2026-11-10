import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { TeamBase, PlayerProfile, PlayerSearchResult } from '../../services/api';
import { ScoutingTranslations } from '../../i18n/scoutingReport';

export interface AvailableMetricOption {
  key: string;
  label: string;
  category: string;
}

export interface ScoutingConfigPanelProps {
  t: ScoutingTranslations;
  lang?: 'es' | 'en';
  setLang?: (l: 'es' | 'en') => void;
  minAge: number;
  setMinAge: React.Dispatch<React.SetStateAction<number>>;
  maxAge: number;
  setMaxAge: React.Dispatch<React.SetStateAction<number>>;
  selectedLeagues: string[];
  toggleLeague: (league: string) => void;
  excludeDropdownRef: React.RefObject<HTMLDivElement>;
  isExcludeDropdownOpen: boolean;
  setIsExcludeDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  appliedExcludedTeams: number[];
  setAppliedExcludedTeams: React.Dispatch<React.SetStateAction<number[]>>;
  pendingExcludedTeams: number[];
  setPendingExcludedTeams: React.Dispatch<React.SetStateAction<number[]>>;
  teamSearchQuery: string;
  setTeamSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  teams: TeamBase[] | undefined;
  filteredTeams: TeamBase[];
  benchmarkMode: 'all' | 'own' | 'target';
  setBenchmarkMode: React.Dispatch<React.SetStateAction<'all' | 'own' | 'target'>>;
  targetGroup: string;
  setTargetGroup: React.Dispatch<React.SetStateAction<string>>;
  currentRole: string | null | undefined;
  applyPreset: (role?: string | null) => void;
  xAxisMetric: string;
  setXAxisMetric: React.Dispatch<React.SetStateAction<string>>;
  yAxisMetric: string;
  setYAxisMetric: React.Dispatch<React.SetStateAction<string>>;
  beeswarm1: string;
  setBeeswarm1: React.Dispatch<React.SetStateAction<string>>;
  beeswarm2: string;
  setBeeswarm2: React.Dispatch<React.SetStateAction<string>>;
  beeswarm3: string;
  setBeeswarm3: React.Dispatch<React.SetStateAction<string>>;
  availableMetrics: AvailableMetricOption[];
  selectedPositionGroup: string;
  setSelectedPositionGroup: React.Dispatch<React.SetStateAction<string>>;
  positionGroups: string[];
  playerSearchRef: React.RefObject<HTMLDivElement>;
  isPlayerSearchOpen: boolean;
  setIsPlayerSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isProfileLoading: boolean;
  profile: PlayerProfile | undefined;
  playerId: number;
  playerSearchQuery: string;
  setPlayerSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  isSearchLoading: boolean;
  searchResults: PlayerSearchResult[] | undefined;
  onSelectPlayer: (targetPlayerId: number) => void;
  radarDropdownRef: React.RefObject<HTMLDivElement>;
  isRadarDropdownOpen: boolean;
  setIsRadarDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeRadarSlices: string[];
  setActiveRadarSlices: React.Dispatch<React.SetStateAction<string[]>>;
  radarSliceOptions: string[];
  toggleRadarSlice: (slice: string) => void;
}

const ScoutingConfigPanel: React.FC<ScoutingConfigPanelProps> = ({
  t,
  lang,
  setLang,
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
  availableMetrics,
  selectedPositionGroup,
  setSelectedPositionGroup,
  positionGroups,
  playerSearchRef,
  isPlayerSearchOpen,
  setIsPlayerSearchOpen,
  isProfileLoading,
  profile,
  playerId,
  playerSearchQuery,
  setPlayerSearchQuery,
  isSearchLoading,
  searchResults,
  onSelectPlayer,
  radarDropdownRef,
  isRadarDropdownOpen,
  setIsRadarDropdownOpen,
  activeRadarSlices,
  setActiveRadarSlices,
  radarSliceOptions,
  toggleRadarSlice,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <section className={`w-full bg-[#fafafa] border border-[#e0e0e0] rounded-xl p-4 flex flex-col ${isCollapsed ? 'gap-0 !py-2.5' : 'gap-3.5'} mb-3 text-slate-700 text-sm shadow-2xs transition-all`}>
      {/* Cabecera del Panel: Título, Idioma y Botón Colapsable */}
      <div className={`flex items-center justify-between ${!isCollapsed ? 'pb-2.5 border-b border-[#e0e0e0]/70' : ''}`}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {(t as any).config?.title || t.config?.dataConfigTitle || 'Configuración de Datos'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {lang && setLang && (
            <div className="inline-flex items-center bg-slate-200/60 p-0.5 rounded-lg border border-[#e0e0e0] gap-0.5">
              <button
                type="button"
                onClick={() => setLang('es')}
                className={`px-2 py-0.5 text-xs rounded-md font-medium transition-all cursor-pointer ${
                  lang === 'es'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-0.5 text-xs rounded-md font-medium transition-all cursor-pointer ${
                  lang === 'en'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                EN
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Mostrar filtros' : 'Ocultar filtros'}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#e0e0e0] bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer select-none"
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* FILA 1: DATA CONFIGURATION */}
          <div className="flex flex-wrap gap-4 items-end">
          {/* Sliders de edad a la izquierda */}
          <div className="flex flex-wrap items-center gap-4 flex-1 min-w-[280px]">
            <div className="flex items-center space-x-2 flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-slate-700 whitespace-nowrap min-w-[48px]">
                {t.config.minAge}
              </label>
              <input
                type="number"
                min={16}
                max={42}
                value={minAge}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 16;
                  const clamped = Math.max(16, Math.min(val, maxAge));
                  setMinAge(clamped);
                }}
                className="w-12 px-1.5 py-1 border border-[#e0e0e0] rounded-lg text-center text-xs font-semibold text-slate-800 bg-white shadow-2xs focus:outline-none focus:border-slate-400"
              />
              <input
                type="range"
                min={16}
                max={42}
                value={minAge}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const clamped = Math.min(val, maxAge);
                  setMinAge(clamped);
                }}
                style={{
                  background: `linear-gradient(to right, #e2e8f0 0%, #e2e8f0 ${((minAge - 16) / 26) * 100}%, #1e293b ${((minAge - 16) / 26) * 100}%, #1e293b ${((maxAge - 16) / 26) * 100}%, #e2e8f0 ${((maxAge - 16) / 26) * 100}%, #e2e8f0 100%)`,
                }}
                className="w-full h-1.5 rounded appearance-none cursor-pointer accent-slate-800"
              />
            </div>

            <div className="flex items-center space-x-2 flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-slate-700 whitespace-nowrap min-w-[48px]">
                {t.config.maxAge}
              </label>
              <input
                type="number"
                min={16}
                max={42}
                value={maxAge}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 42;
                  const clamped = Math.min(42, Math.max(val, minAge));
                  setMaxAge(clamped);
                }}
                className="w-12 px-1.5 py-1 border border-[#e0e0e0] rounded-lg text-center text-xs font-semibold text-slate-800 bg-white shadow-2xs focus:outline-none focus:border-slate-400"
              />
              <input
                type="range"
                min={16}
                max={42}
                value={maxAge}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const clamped = Math.max(val, minAge);
                  setMaxAge(clamped);
                }}
                style={{
                  background: `linear-gradient(to right, #e2e8f0 0%, #e2e8f0 ${((minAge - 16) / 26) * 100}%, #1e293b ${((minAge - 16) / 26) * 100}%, #1e293b ${((maxAge - 16) / 26) * 100}%, #e2e8f0 ${((maxAge - 16) / 26) * 100}%, #e2e8f0 100%)`,
                }}
                className="w-full h-1.5 rounded appearance-none cursor-pointer accent-slate-800"
              />
            </div>
          </div>

          {/* Checkboxes de ligas al centro */}
          <div className="shrink-0">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {t.config.leaguesLabel}
            </label>
            <div className="flex items-center gap-4 text-xs py-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLeagues.includes('liga1_2026')}
                  onChange={() => toggleLeague('liga1_2026')}
                  className="rounded border-slate-300 text-slate-800 focus:ring-0 cursor-pointer"
                />
                <span className="text-slate-800 font-medium">Liga 1 (2026)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLeagues.includes('liga1_apertura')}
                  onChange={() => toggleLeague('liga1_apertura')}
                  className="rounded border-slate-300 text-slate-800 focus:ring-0 cursor-pointer"
                />
                <span className="text-slate-600">Torneo Apertura</span>
              </label>
            </div>
          </div>

          {/* Dropdown de excluir equipos a la derecha */}
          <div className="relative flex-1 min-w-[220px] max-w-[320px]" ref={excludeDropdownRef}>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {t.config.excludeTeamsLabel(appliedExcludedTeams.length, teams?.length || 18)}
            </label>
            <button
              type="button"
              onClick={() => {
                if (!isExcludeDropdownOpen) {
                  setPendingExcludedTeams([...appliedExcludedTeams]);
                }
                setIsExcludeDropdownOpen(!isExcludeDropdownOpen);
              }}
              className="w-full flex items-center justify-between border border-[#e0e0e0] rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 bg-white shadow-2xs hover:border-slate-300 focus:outline-none cursor-pointer"
            >
              <span>{t.config.excludedStatus(appliedExcludedTeams.length)}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {isExcludeDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-3 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                    {t.config.filterClubsTitle(pendingExcludedTeams.length, teams?.length || 18)}
                  </span>
                  <div className="flex items-center space-x-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPendingExcludedTeams(teams ? teams.map((tm: TeamBase) => tm.team_id) : [])}
                      className="font-semibold text-slate-700 hover:text-slate-900 underline cursor-pointer"
                    >
                      {t.config.all}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingExcludedTeams([])}
                      className="font-semibold text-slate-500 hover:text-slate-700 underline cursor-pointer"
                    >
                      {t.config.none}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedExcludedTeams([...pendingExcludedTeams]);
                        setIsExcludeDropdownOpen(false);
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {t.config.apply}
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder={t.config.filterTeamPlaceholder}
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  className="w-full border border-[#e0e0e0] rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-slate-400 bg-white"
                />

                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {filteredTeams.map((team: TeamBase) => {
                    const isChecked = pendingExcludedTeams.includes(team.team_id);
                    return (
                      <label
                        key={team.team_id}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 cursor-pointer text-xs text-slate-700"
                      >
                        <span className="truncate pr-2 font-medium">{team.name}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setPendingExcludedTeams((prev) =>
                              prev.includes(team.team_id)
                                ? prev.filter((id) => id !== team.team_id)
                                : [...prev, team.team_id]
                            );
                          }}
                          className="rounded border-slate-300 text-slate-800 focus:ring-0 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {t.config.selectedCount(pendingExcludedTeams.length, teams?.length || 18)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedExcludedTeams([...pendingExcludedTeams]);
                      setIsExcludeDropdownOpen(false);
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {t.config.apply}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-b border-[#e0e0e0]/70" />

      {/* FILA 2: BENCHMARK MODE & TARGET LEAGUE */}
      <div className="space-y-2">
        <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          {t.config.benchmarkTitle}
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center bg-slate-200/60 p-0.5 rounded-lg border border-[#e0e0e0] gap-0.5">
            <button
              type="button"
              onClick={() => setBenchmarkMode('all')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all duration-150 select-none cursor-pointer ${
                benchmarkMode === 'all'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {(t as any).benchmark?.all || t.config.vsAllTeams}
            </button>
            <button
              type="button"
              onClick={() => setBenchmarkMode('own')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all duration-150 select-none cursor-pointer ${
                benchmarkMode === 'own'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {(t as any).benchmark?.own || t.config.vsOwnTeam}
            </button>
            <button
              type="button"
              onClick={() => setBenchmarkMode('target')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all duration-150 select-none cursor-pointer ${
                benchmarkMode === 'target'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {((t as any).benchmark?.target || t.config.vsTargetTier)} →
            </button>
          </div>

          {benchmarkMode === 'target' && (
            <div className="flex items-center gap-2">
              <select
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                className="border border-[#e0e0e0] rounded-lg px-2.5 py-1 text-xs text-slate-800 bg-white shadow-2xs cursor-pointer focus:outline-none focus:border-slate-400"
              >
                <option value="top6">{(t as any).benchmark?.top6 || t.config.targetGroups.top6}</option>
                <option value="lima">{(t as any).benchmark?.lima || t.config.targetGroups.lima}</option>
                <option value="altitude">{(t as any).benchmark?.altitude || t.config.targetGroups.altitude}</option>
                <option value="provincial">{(t as any).benchmark?.provincial || t.config.targetGroups.provincial}</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="border-b border-[#e0e0e0]/70" />

      {/* FILA 3: METRICS FOR SCATTERPLOT & BEESWARM DISTRIBUTIONS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {t.config.metricsSectionTitle}
          </h2>
          <button
            type="button"
            onClick={() => applyPreset(currentRole)}
            className="text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors cursor-pointer shrink-0"
            title={t.config.resetPresetTitle(currentRole ? t.floor1.roles[currentRole] || currentRole : null)}
          >
            {t.config.resetPreset(currentRole ? t.floor1.roles[currentRole] || currentRole : null)}
          </button>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t.config.xAxis}</label>
            <select
              value={xAxisMetric}
              onChange={(e) => setXAxisMetric(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white shadow-2xs cursor-pointer hover:border-slate-300 focus:outline-none focus:border-slate-400"
            >
              {availableMetrics.map((m) => (
                <option key={m.key} value={m.key}>
                  {t.metrics[m.key]?.long || m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t.config.yAxis}</label>
            <select
              value={yAxisMetric}
              onChange={(e) => setYAxisMetric(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white shadow-2xs cursor-pointer hover:border-slate-300 focus:outline-none focus:border-slate-400"
            >
              {availableMetrics.map((m) => (
                <option key={m.key} value={m.key}>
                  {t.metrics[m.key]?.long || m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-slate-600 mb-1 truncate">
              {t.config.beeswarm(1)}
            </label>
            <select
              value={beeswarm1}
              onChange={(e) => setBeeswarm1(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white shadow-2xs cursor-pointer hover:border-slate-300 focus:outline-none focus:border-slate-400"
            >
              {availableMetrics.map((m) => (
                <option key={m.key} value={m.key}>
                  {t.metrics[m.key]?.long || m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-slate-600 mb-1 truncate">
              {t.config.beeswarm(2)}
            </label>
            <select
              value={beeswarm2}
              onChange={(e) => setBeeswarm2(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white shadow-2xs cursor-pointer hover:border-slate-300 focus:outline-none focus:border-slate-400"
            >
              {availableMetrics.map((m) => (
                <option key={m.key} value={m.key}>
                  {t.metrics[m.key]?.long || m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-slate-600 mb-1 truncate">
              {t.config.beeswarm(3)}
            </label>
            <select
              value={beeswarm3}
              onChange={(e) => setBeeswarm3(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white shadow-2xs cursor-pointer hover:border-slate-300 focus:outline-none focus:border-slate-400"
            >
              {availableMetrics.map((m) => (
                <option key={m.key} value={m.key}>
                  {t.metrics[m.key]?.long || m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="border-b border-[#e0e0e0]/70" />

      {/* FILA 4: SELECT POSITION, PLAYER & SLICES */}
      <div className="space-y-2">
        <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          {t.config.positionPlayerSlicesTitle}
        </h2>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {t.config.positionGroupLabel}
            </label>
            <select
              value={selectedPositionGroup}
              onChange={(e) => setSelectedPositionGroup(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white shadow-2xs cursor-pointer hover:border-slate-300 focus:outline-none focus:border-slate-400"
            >
              {positionGroups.map((pos) => (
                <option key={pos} value={pos}>
                  {t.config.positionGroups[pos] || pos}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 min-w-[240px]" ref={playerSearchRef}>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {t.config.playerLabel}
            </label>
            <button
              type="button"
              onClick={() => setIsPlayerSearchOpen(!isPlayerSearchOpen)}
              className="w-full flex items-center justify-between border border-[#e0e0e0] rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 bg-white shadow-2xs hover:border-slate-300 focus:outline-none text-left truncate cursor-pointer"
            >
              <span className="truncate font-medium">
                {isProfileLoading
                  ? t.config.loading
                  : `${profile?.name || `Player #${playerId}`} — ${profile?.team?.name || 'Alianza Lima'}`}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
            </button>

            {isPlayerSearchOpen && (
              <div className="absolute right-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="p-2 border-b border-slate-100 bg-slate-50">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={playerSearchQuery}
                      onChange={(e) => setPlayerSearchQuery(e.target.value)}
                      placeholder={t.config.searchPlayerPlaceholder}
                      className="w-full pl-8 pr-2 py-1.5 text-xs border border-[#e0e0e0] rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 bg-white"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {isSearchLoading && (
                    <p className="p-3 text-xs text-slate-400 text-center">{t.config.searching}</p>
                  )}
                  {!isSearchLoading && playerSearchQuery.length >= 2 && searchResults?.length === 0 && (
                    <p className="p-3 text-xs text-slate-500 text-center">{t.config.noPlayersFound}</p>
                  )}
                  {searchResults &&
                    searchResults.map((p) => (
                      <button
                        key={p.player_id}
                        type="button"
                        onClick={() => {
                          setIsPlayerSearchOpen(false);
                          onSelectPlayer(p.player_id);
                        }}
                        className="w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="truncate">
                          <p className="font-semibold text-slate-800 truncate">
                            {p.name} — {p.team_name || 'Liga 1'}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {p.position_group
                              ? t.config.positionGroups[p.position_group] || p.position_group
                              : t.config.unknownPosition}
                          </p>
                        </div>
                        {p.player_id === playerId && (
                          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex-1 min-w-[200px]" ref={radarDropdownRef}>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {t.config.radarSlicesLabel(
                activeRadarSlices.filter((s) => radarSliceOptions.includes(s)).length,
                radarSliceOptions.length
              )}
            </label>
            <button
              type="button"
              onClick={() => setIsRadarDropdownOpen(!isRadarDropdownOpen)}
              className="w-full flex items-center justify-between border border-[#e0e0e0] rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 bg-white shadow-2xs hover:border-slate-300 focus:outline-none text-left cursor-pointer"
            >
              <span>
                {t.config.slicesSelected(
                  activeRadarSlices.filter((s) => radarSliceOptions.includes(s)).length
                )}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
            </button>

            {isRadarDropdownOpen && (
              <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase text-slate-800">{t.config.toggleSlices}</span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setActiveRadarSlices(radarSliceOptions)}
                      className="text-xs font-semibold text-slate-700 hover:underline cursor-pointer"
                    >
                      {t.config.allSlices}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveRadarSlices([])}
                      className="text-xs font-semibold text-slate-500 hover:underline cursor-pointer"
                    >
                      {t.config.noneSlices}
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {radarSliceOptions.map((slice) => (
                    <label
                      key={slice}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 cursor-pointer text-xs"
                    >
                      <span className="text-slate-700">{t.metrics[slice]?.short || slice}</span>
                      <input
                        type="checkbox"
                        checked={activeRadarSlices.includes(slice)}
                        onChange={() => toggleRadarSlice(slice)}
                        className="rounded border-slate-300 text-slate-800 focus:ring-0 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}
    </section>
  );
};

export default ScoutingConfigPanel;
