import { useQuery } from '@tanstack/react-query';
import { teamsApi, TeamMetricEntry, TeamShotZonesResponse, TeamBase } from '../services/api';

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

export const useTeamsList = () => {
  return useQuery<TeamBase[]>({
    queryKey: ['teams', 'list'],
    queryFn: () => teamsApi.getAll(),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
};
