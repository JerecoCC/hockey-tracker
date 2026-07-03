import { type TeamStandingRecord } from '@/hooks/useSeasonStandings';

export const hasRecordedRegularSeasonGame = (standings: Pick<TeamStandingRecord, 'gp'>[]) =>
  standings.some((team) => team.gp > 0);
