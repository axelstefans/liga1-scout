import { apiClient } from './apiClient';
import type {
  RefereeSummary,
  RefereeDetailResponse,
  RefereeMatchItem,
} from '../../types/referee';

export type {
  RefereeSummary,
  RefereeDetailResponse,
  RefereeMatchItem,
};

export const getReferees = async (tournament?: string): Promise<RefereeSummary[]> => {
  const params: Record<string, string> = {};
  if (tournament && tournament !== 'all') {
    params.tournament = tournament;
  }
  const response = await apiClient.get<RefereeSummary[]>('/referees', { params });
  return response.data;
};

export const getRefereeDetail = async (
  refereeId: number,
  limit: number = 5
): Promise<RefereeDetailResponse> => {
  const params: Record<string, number> = {};
  if (limit !== undefined && limit !== null) {
    params.limit = limit;
  }
  const response = await apiClient.get<RefereeDetailResponse>(`/referees/${refereeId}`, {
    params,
  });
  return response.data;
};

export const getRefereeMatches = async (
  refereeId: number,
  limit?: number
): Promise<RefereeMatchItem[]> => {
  const params: Record<string, number> = {};
  if (limit !== undefined && limit !== null) {
    params.limit = limit;
  }
  const response = await apiClient.get<RefereeMatchItem[]>(`/referees/${refereeId}/matches`, {
    params,
  });
  return response.data;
};
