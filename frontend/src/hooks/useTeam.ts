import { useQuery } from '@tanstack/react-query';
import { 
  teamsApi, TeamMetricEntry, TeamShotZonesResponse, 
  TeamPassNetworkResponse, TeamMatchItem, TeamBase,
  TeamDefensiveActionsResponse, TeamShotMapResponse,
  TeamAttackZonesResponse, TeamPeriodMetricsResponse,
  VenueFilter
} from '../services/api';

export const useTeamMetrics = (tournament?: 'Apertura' | 'Clausura', venue: VenueFilter = 'all') => {
  return useQuery<TeamMetricEntry[]>({
    queryKey: ['teams', 'metrics', tournament || 'all', venue],
    queryFn: () => teamsApi.getMetrics(tournament, venue),
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

export const useTeamMatches = (teamId?: number, tournament?: 'Apertura' | 'Clausura' | 'all') => {
  return useQuery<TeamMatchItem[]>({
    queryKey: ['teams', teamId, 'matches', tournament || 'all'],
    queryFn: () => teamsApi.getTeamMatches(teamId!, tournament),
    enabled: !!teamId,
    staleTime: 1000 * 60 * 10,
  });
};

export const useTeamPassNetwork = (
  teamId: number,
  tournament?: 'Apertura' | 'Clausura' | 'all',
  matchId?: number | null,
  venue: VenueFilter = 'all',
  enabled: boolean = true
) => {
  return useQuery<TeamPassNetworkResponse>({
    queryKey: ['teams', teamId, 'passNetwork', tournament || 'all', matchId ?? 'cumulative', venue],
    queryFn: () => teamsApi.getPassNetwork(teamId, tournament, matchId, venue),
    enabled: !!teamId && enabled,
    staleTime: 1000 * 60 * 10,
  });
};

export const useTeamDefensiveActions = (
  teamId?: number,
  tournament: string = 'all',
  matchId?: number | null,
  venue: VenueFilter = 'all',
  enabled: boolean = true
) => {
  return useQuery<TeamDefensiveActionsResponse>({
    queryKey: ['teamDefensiveActions', teamId, tournament || 'all', matchId ?? 'cumulative', venue],
    queryFn: () => teamsApi.getDefensiveActions(teamId!, tournament, matchId, venue),
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
  venue: VenueFilter = 'all',
  enabled: boolean = true
) => {
  return useQuery<TeamShotMapResponse>({
    queryKey: ['teamShotMap', teamId, tournament || 'all', matchId ?? 'cumulative', mode, venue],
    queryFn: () => teamsApi.getShotMap(teamId!, tournament, matchId, mode, venue),
    enabled: Boolean(teamId) && enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useTeamAttackZones = (
  teamId?: number,
  tournament?: string,
  matchId?: number | null,
  mode: 'for' | 'against' = 'for',
  venue: VenueFilter = 'all',
  enabled: boolean = true
) => {
  return useQuery<TeamAttackZonesResponse>({
    queryKey: ['teamAttackZones', teamId, tournament || 'all', matchId ?? 'cumulative', mode, venue],
    queryFn: () => teamsApi.getAttackZones(teamId!, tournament, matchId, mode, venue),
    enabled: Boolean(teamId) && enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useTeamMostUsedXI = (
  teamId?: number,
  tournament?: 'Apertura' | 'Clausura' | 'all',
  venue: VenueFilter = 'all',
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['teamMostUsedXI', teamId, tournament || 'all', venue],
    queryFn: () => teamsApi.getMostUsedXI(teamId!, tournament, venue),
    enabled: Boolean(teamId) && enabled,
    staleTime: 1000 * 60 * 10,
  });
};

export const useTeamGoalContributions = (
  teamId?: number,
  tournament?: 'Apertura' | 'Clausura' | 'all',
  limit: number = 8,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['teamGoalContributions', teamId, tournament || 'all', limit],
    queryFn: () => teamsApi.getGoalContributions(teamId!, tournament, limit),
    enabled: Boolean(teamId) && enabled,
    staleTime: 1000 * 60 * 10,
  });
};

export const useTeamPeriodMetrics = (
  teamId?: number,
  tournament?: 'Apertura' | 'Clausura' | 'all',
  venue: VenueFilter = 'all',
  mode: 'for' | 'against' = 'for',
  enabled: boolean = true
) => {
  return useQuery<TeamPeriodMetricsResponse>({
    queryKey: ['teamPeriodMetrics', teamId, tournament || 'all', venue, mode],
    queryFn: () => teamsApi.getPeriodMetrics(teamId!, tournament, venue, mode),
    enabled: Boolean(teamId) && enabled,
    staleTime: 1000 * 60 * 10,
  });
};

export const useTeamSetPieces = (
  teamId?: number,
  tournament?: 'Apertura' | 'Clausura' | 'all',
  venue: VenueFilter = 'all',
  mode: 'for' | 'against' = 'for',
  enabled: boolean = true
) => {
  return useQuery<any>({
    queryKey: ['teamSetPieces', teamId, tournament || 'all', venue, mode],
    queryFn: () => teamsApi.getSetPieces(teamId!, tournament, venue, mode),
    enabled: Boolean(teamId) && enabled,
    staleTime: 1000 * 60 * 10,
  });
};
