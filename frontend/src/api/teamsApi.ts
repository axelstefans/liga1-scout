import { 
  teamsApi, 
  DefensiveEventItem, 
  DefensiveSummary, 
  TeamDefensiveActionsResponse,
  ShotItem,
  ShotMapSummary,
  TeamShotMapResponse,
  AttackZoneTopPlayer,
  AttackZoneChannel,
  AttackZonesSummary,
  TeamAttackZonesResponse
} from '../services/api';

export type { 
  DefensiveEventItem, 
  DefensiveSummary, 
  TeamDefensiveActionsResponse,
  ShotItem,
  ShotMapSummary,
  TeamShotMapResponse,
  AttackZoneTopPlayer,
  AttackZoneChannel,
  AttackZonesSummary,
  TeamAttackZonesResponse
};
export const getAttackZones = teamsApi.getAttackZones;
export { teamsApi };
export default teamsApi;
