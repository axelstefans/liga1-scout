import { useQuery } from '@tanstack/react-query';
import { 
  teamsApi, TeamMetricEntry, TeamShotZonesResponse, 
  TeamPassNetworkResponse, TeamMatchItem, TeamBase,
  TeamDefensiveActionsResponse, TeamShotMapResponse
} from '../services/api';

export const useTeamMetrics = (tournament?: 'Apertura' | 'Clausura') => {
  return useQuery<TeamMetricEntry[]>({
    queryKey: ['teams', 'metrics', tournament || 'all'],
    queryFn: () => teamsApi.getMetrics(tournament),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useTeamShotZones = (teamId: number, tournament?: 'Apertura' | 'Clausura') => {
  return useQuery<TeamShotZonesResponse>({
    queryKey: ['teams', teamId, 'shotZones', tournament || 'all'],
    queryFn: () => teamsApi.getShotZones(teamId, tournament),
    enabled: !!teamId,
    staleTime: 1000 * 60 * 10,
  });
};

export const useTeamMatches = (teamId: number, tournament?: 'Apertura' | 'Clausura' | 'all') => {
  return useQuery<TeamMatchItem[]>({
    queryKey: ['teams', teamId, 'matches', tournament || 'all'],
    queryFn: () => teamsApi.getTeamMatches(teamId, tournament),
    enabled: !!teamId,
    staleTime: 1000 * 60 * 10,
  });
};

export const useTeamPassNetwork = (
  teamId: number,
  tournament?: 'Apertura' | 'Clausura' | 'all',
  matchId?: number | null,
  enabled: boolean = true
) => {
  return useQuery<TeamPassNetworkResponse>({
    queryKey: ['teams', teamId, 'passNetwork', tournament || 'all', matchId ?? 'cumulative'],
    queryFn: () => teamsApi.getPassNetwork(teamId, tournament, matchId),
    enabled: !!teamId && enabled,
    staleTime: 1000 * 60 * 10,
  });
};

export const useTeamDefensiveActions = (
  teamId?: number,
  tournament: string = 'all',
  matchId?: number | null,
  enabled: boolean = true
) => {
  return useQuery<TeamDefensiveActionsResponse>({
    queryKey: ['teamDefensiveActions', teamId, tournament || 'all', matchId ?? 'cumulative'],
    queryFn: () => teamsApi.getDefensiveActions(teamId!, tournament, matchId),
    enabled: Boolean(teamId) && enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useTeamsList = () => {
  return useQuery<TeamBase[]>({
    queryKey: ['teams', 'list'],
    queryFn: () => teamsApi.getAll(),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
};

export const useTeamShotMap = (
  teamId?: number,
  tournament?: string,
  matchId?: number | null,
  mode: 'for' | 'against' = 'for',
  enabled: boolean = true
) => {
  return useQuery<TeamShotMapResponse>({
    queryKey: ['teamShotMap', teamId, tournament || 'all', matchId ?? 'cumulative', mode],
    queryFn: () => teamsApi.getShotMap(teamId!, tournament, matchId, mode),
    enabled: Boolean(teamId) && enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};



