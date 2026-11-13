import { useEffect, useMemo, useRef } from 'react';
import { useTeamMatches } from './useTeam';
import { TeamMatchItem } from '../services/api';

export type TournamentType = 'all' | 'Apertura' | 'Clausura';
export type TeamAnalyticsViewMode = 'aggregated' | 'cumulative' | 'match' | string;

export interface UseTeamMatchSyncProps {
  teamId?: number;
  tournament?: TournamentType | string;
  selectedMatchId?: number | null;
  onSelectMatch?: (matchId: number | null) => void;
  viewMode?: TeamAnalyticsViewMode;
}

export interface UseTeamMatchSyncResult {
  matches: TeamMatchItem[] | undefined;
  isLoadingMatches: boolean;
  isErrorMatches: boolean;
  validMatchId: number | null;
  activeMatch: TeamMatchItem | null;
  isMatchValid: boolean;
}

/**
 * Custom hook for synchronizing team match fixture state across tactical spatial charts.
 * Manages match list queries, auto-resets on club/tournament change, and auto-selects
 * the most recent fixture when operating in single-match mode.
 */
export function useTeamMatchSync({
  teamId,
  tournament = 'all',
  selectedMatchId = null,
  onSelectMatch,
  viewMode = 'cumulative',
}: UseTeamMatchSyncProps): UseTeamMatchSyncResult {
  const isMatchMode = viewMode === 'match';
  const queryTournament = (tournament as TournamentType) || 'all';
  const onSelectMatchRef = useRef(onSelectMatch);
  onSelectMatchRef.current = onSelectMatch;

  const {
    data: matches,
    isLoading: isLoadingMatches,
    isError: isErrorMatches,
  } = useTeamMatches(teamId, queryTournament);

  // 1. Reset selected match strictly when switching clubs or tournament to avoid stale ID mismatch
  useEffect(() => {
    onSelectMatchRef.current?.(null);
  }, [teamId, tournament]);

  // 2. Validate whether selectedMatchId exists in the current team's fixture
  const isMatchValid = useMemo(() => {
    if (!isMatchMode) return true;
    if (!selectedMatchId || !matches || matches.length === 0) return false;
    return matches.some((m) => m.match_id === selectedMatchId);
  }, [isMatchMode, matches, selectedMatchId]);

  // 3. Auto-select most recent match when switching to match mode or when matches finish loading
  useEffect(() => {
    if (isMatchMode && matches && matches.length > 0) {
      if (!selectedMatchId || !matches.some((m) => m.match_id === selectedMatchId)) {
        onSelectMatchRef.current?.(matches[0].match_id);
      }
    }
  }, [isMatchMode, matches, selectedMatchId]);

  // 4. Resolve safe validMatchId
  const validMatchId = useMemo(() => {
    if (!isMatchMode) return null;
    if (!matches || matches.length === 0) return null;
    if (selectedMatchId && matches.some((m) => m.match_id === selectedMatchId)) {
      return selectedMatchId;
    }
    return matches[0]?.match_id ?? null;
  }, [isMatchMode, matches, selectedMatchId]);

  // 5. Resolve active match item
  const activeMatch = useMemo(() => {
    if (!isMatchMode || !matches || matches.length === 0 || !validMatchId) return null;
    return matches.find((m) => m.match_id === validMatchId) || matches[0];
  }, [isMatchMode, matches, validMatchId]);

  return {
    matches,
    isLoadingMatches,
    isErrorMatches,
    validMatchId,
    activeMatch,
    isMatchValid,
  };
}

export default useTeamMatchSync;
