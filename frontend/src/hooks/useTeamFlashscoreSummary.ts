import { useQuery } from '@tanstack/react-query';
import { teamsApi, TeamFlashscoreSummaryResponse } from '../services/api';

/**
 * Custom hook to fetch aggregated Flashscore team statistics (1T vs 2T splits,
 * territorial metrics, and goalkeeper shot-stopping efficiency).
 *
 * @param teamId Internal team ID (or null/undefined when unselected).
 * @returns TanStack React Query result containing TeamFlashscoreSummaryResponse.
 */
export const useTeamFlashscoreSummary = (teamId: number | null | undefined) => {
  return useQuery<TeamFlashscoreSummaryResponse>({
    queryKey: ['teamFlashscoreSummary', teamId],
    queryFn: () => teamsApi.getTeamFlashscoreSummary(teamId!),
    enabled: Boolean(teamId),
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
};

export default useTeamFlashscoreSummary;
