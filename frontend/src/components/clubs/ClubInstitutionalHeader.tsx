import React from 'react';
import { Trophy, Shield, Check, ClipboardCheck } from 'lucide-react';
import { TeamBase, TeamMetricEntry } from '../../services/api';
import { getTeamCrestUrl, getTeamTricode } from '../../utils/teams';
import { TournamentFilter, ClubViewMode } from './clubAnalyticsTypes';

export interface ClubInstitutionalHeaderProps {
  activeTeam: TeamMetricEntry | null;
  allTeamsList: TeamBase[] | undefined;
  teams: TeamMetricEntry[] | undefined;
  isLoading: boolean;
  leagueRank: number | null;
  handleClubChange: (newTeamId: number) => void;
  handleCopyComprehensiveReport: () => Promise<void>;
  isReportCopied: boolean;
  selectedTournament: TournamentFilter;
  setSelectedTournament: React.Dispatch<React.SetStateAction<TournamentFilter>>;
  clubViewMode: ClubViewMode;
  setClubViewMode: React.Dispatch<React.SetStateAction<ClubViewMode>>;
}

export const ClubInstitutionalHeader: React.FC<ClubInstitutionalHeaderProps> = ({
  activeTeam,
  allTeamsList,
  teams,
  isLoading,
  leagueRank,
  handleClubChange,
  handleCopyComprehensiveReport,
  isReportCopied,
  selectedTournament,
  setSelectedTournament,
  clubViewMode,
  setClubViewMode,
}) => {
  return (
    <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl overflow-hidden">
      <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
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
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
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
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
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

      {/* ================================================================= */}
      {/* PRIMARY VIEW MODE NAVIGATION BAR (SWISS EDITORIAL, NO ICONS)      */}
      {/* ================================================================= */}
      <div className="px-4 bg-slate-50/70 border-t border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setClubViewMode('general')}
            className={`py-2.5 text-xs tracking-[0.14em] uppercase transition-all cursor-pointer ${
              clubViewMode === 'general'
                ? 'border-b-2 border-slate-900 text-slate-900 font-bold'
                : 'border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            RENDIMIENTO GENERAL
          </button>
          <button
            type="button"
            onClick={() => setClubViewMode('match_report')}
            className={`py-2.5 text-xs tracking-[0.14em] uppercase transition-all cursor-pointer ${
              clubViewMode === 'match_report'
                ? 'border-b-2 border-slate-900 text-slate-900 font-bold'
                : 'border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            REPORTE DE PARTIDO
          </button>
        </div>

        <span className="hidden sm:inline-block font-mono text-[10.5px] text-slate-400 uppercase tracking-widest">
          {clubViewMode === 'general'
            ? 'VISTA ACUMULADA DE TEMPORADA'
            : 'ANÁLISIS TÁCTICO PARTIDO A PARTIDO (3 LÁMINAS)'}
        </span>
      </div>
    </div>
  );
};

export default ClubInstitutionalHeader;
