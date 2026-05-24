import { useQuery } from '@tanstack/react-query';
import { playersApi, rankingsApi } from '../services/api';

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

// Use this to fetch the top 100 players for a stat to calculate distributions
export const useLeagueRankings = (stat: string) => {
  return useQuery({
    queryKey: ['rankings', stat],
    queryFn: () => rankingsApi.getTopPlayers(stat, 100),
    enabled: !!stat,
    staleTime: 1000 * 60 * 30, // 30 minutes since rankings don't change often
  });
};
