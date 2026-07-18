import { useQuery } from '@tanstack/react-query';
import { playersApi, rankingsApi, teamsApi } from '../services/api';

export const usePlayerSearch = (query: string) => {
  return useQuery({
    queryKey: ['players', 'search', query],
    queryFn: () => playersApi.search(query),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 5,
  });
};

export const usePlayerProfile = (id: number) => {
  return useQuery({
    queryKey: ['players', id, 'profile'],
    queryFn: () => playersApi.getProfile(id),
    enabled: !!id,
  });
};

export const usePlayerSeasonStats = (id: number) => {
  return useQuery({
    queryKey: ['players', id, 'seasonStats'],
    queryFn: () => playersApi.getSeasonStats(id),
    enabled: !!id,
  });
};

export const usePlayerMatchStats = (id: number) => {
  return useQuery({
    queryKey: ['players', id, 'matchStats'],
    queryFn: () => playersApi.getMatchStats(id),
    enabled: !!id,
  });
};

export const usePlayerHeatmap = (playerId: number) => {
  return useQuery({
    queryKey: ['players', playerId, 'heatmap'],
    queryFn: () => playersApi.getHeatmap(playerId),
    enabled: !!playerId,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
};

export const usePlayerShotmap = (playerId: number) => {
  return useQuery({
    queryKey: ['players', playerId, 'shotmap'],
    queryFn: () => playersApi.getShotmap(playerId),
    enabled: !!playerId,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
};

// Use this to fetch the top players for a stat to calculate distributions
export const useLeagueRankings = (stat: string, limit: number = 100) => {
  return useQuery({
    queryKey: ['rankings', stat, limit],
    queryFn: () => rankingsApi.getTopPlayers(stat, limit),
    enabled: !!stat,
    staleTime: 1000 * 60 * 30, // 30 minutes since rankings don't change often
  });
};

export const useTeamNextMatch = (teamId: number | undefined) => {
  return useQuery({
    queryKey: ['teams', teamId, 'nextMatch'],
    queryFn: () => teamsApi.getNextMatch(teamId!),
    enabled: !!teamId,
    retry: false, // Do not retry on 404
  });
};
