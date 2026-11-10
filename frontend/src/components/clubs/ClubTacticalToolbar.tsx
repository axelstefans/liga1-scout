import React from 'react';
import { SlidersHorizontal, ChevronDown, RotateCcw, Check, User } from 'lucide-react';
import { VenueFilter, ContextFilter, TeamMatchItem } from '../../services/api';
import { ChartId, AVAILABLE_CHARTS } from './clubAnalyticsTypes';

export interface ClubTacticalToolbarProps {
  perspective: 'for' | 'against';
  setPerspective: React.Dispatch<React.SetStateAction<'for' | 'against'>>;
  aggregationMode: 'cumulative' | 'match';
  setAggregationMode: React.Dispatch<React.SetStateAction<'cumulative' | 'match'>>;
  venue: VenueFilter;
  setVenue: React.Dispatch<React.SetStateAction<VenueFilter>>;
  contextFilter: ContextFilter;
  setContextFilter: React.Dispatch<React.SetStateAction<ContextFilter>>;
  validMatchId: number | null;
  setSelectedMatchId: React.Dispatch<React.SetStateAction<number | null>>;
  isLoadingMatches: boolean;
  matches: TeamMatchItem[] | undefined;
  selectedPlayer: string;
  setSelectedPlayer: React.Dispatch<React.SetStateAction<string>>;
  availablePlayers: { name: string; count: number }[];
  dropdownRef: React.RefObject<HTMLDivElement>;
  isDropdownOpen: boolean;
  setIsDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeCount: number;
  visibleCharts: Record<ChartId, boolean>;
  toggleChart: (chartId: ChartId) => void;
  handleSelectAll: () => void;
  handleReset: () => void;
  isEmptyState: boolean;
  venueLabel: string;
  contextFilterLabel: string;
}

export const ClubTacticalToolbar: React.FC<ClubTacticalToolbarProps> = ({
  perspective,
  setPerspective,
  aggregationMode,
  setAggregationMode,
  venue,
  setVenue,
  contextFilter,
  setContextFilter,
  validMatchId,
  setSelectedMatchId,
  isLoadingMatches,
  matches,
  selectedPlayer,
  setSelectedPlayer,
  availablePlayers,
  dropdownRef,
  isDropdownOpen,
  setIsDropdownOpen,
  activeCount,
  visibleCharts,
  toggleChart,
  handleSelectAll,
  handleReset,
  isEmptyState,
  venueLabel,
  contextFilterLabel,
}) => {
  return (
    <>
      {/* GLOBAL TACTICAL TOOLBAR */}
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
                value={validMatchId || ''}
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

      {/* GRACEFUL EMPTY STATE WARNING BANNER */}
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
    </>
  );
};

export default ClubTacticalToolbar;
