import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Loader2, AlertCircle, RefreshCw, Trophy, Shield
} from 'lucide-react';
import { useTeamMetrics } from '../hooks/useTeam';
import { getTeamCrestUrl, getTeamTricode } from '../utils/teams';
import TeamTacticalRadar from '../components/analytics/TeamTacticalRadar';
import TeamPassNetwork from '../components/analytics/TeamPassNetwork';

type TournamentFilter = 'all' | 'Apertura' | 'Clausura';

export const ClubDetailAnalytics: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [selectedTournament, setSelectedTournament] = useState<TournamentFilter>('all');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(
    id ? parseInt(id, 10) : null
  );

  // Fetch all 18 teams and their cohort stats for current tournament filter
  const { 
    data: teams, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useTeamMetrics(selectedTournament === 'all' ? undefined : selectedTournament);

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

  // Find active team and their current league ranking
  const { activeTeam, leagueRank } = useMemo(() => {
    if (!teams || teams.length === 0 || selectedTeamId === null) {
      return { activeTeam: null, leagueRank: null };
    }
    const index = teams.findIndex((t) => t.team_id === selectedTeamId);
    if (index !== -1) {
      return { activeTeam: teams[index], leagueRank: index + 1 };
    }
    // Fallback to top team
    return { activeTeam: teams[0], leagueRank: 1 };
  }, [teams, selectedTeamId]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 text-slate-900">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* =================================================================== */}
        {/* 1. INSTITUTIONAL HEADER STRIP                                       */}
        {/* =================================================================== */}
        <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Dropdown Selector for 18 Clubs (clean, without static label) */}
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
              {/* Clean Transparent Crest */}
              <img
                src={getTeamCrestUrl(activeTeam.team_id, activeTeam.logo_url)}
                alt={activeTeam.name}
                className="h-12 w-12 object-contain shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/liga1-logo.png';
                }}
              />

              {/* Identity & Badges */}
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold text-slate-900 tracking-tight leading-tight">
                    {activeTeam.name}
                  </h1>
                  
                  {/* League Rank Badge */}
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                    <Trophy className="w-3 h-3 text-amber-600" />
                    #{leagueRank} en Liga 1
                  </span>
                </div>

                {/* Performance Record Strip */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-normal text-slate-600">
                  <span>
                    {activeTeam.matches_played} PJ
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    {activeTeam.wins}V - {activeTeam.draws}E - {activeTeam.losses}D
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-medium text-slate-800">
                    {activeTeam.points} Pts
                  </span>
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
        {/* 2. MAIN WORKSPACE / CONTENT AREA                                    */}
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
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          </div>
        ) : activeTeam && teams && teams.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <TeamTacticalRadar
              teams={teams}
              activeTeam={activeTeam}
              tournament={selectedTournament}
            />
            <TeamPassNetwork
              teams={teams}
              activeTeam={activeTeam}
              tournament={selectedTournament}
            />
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
