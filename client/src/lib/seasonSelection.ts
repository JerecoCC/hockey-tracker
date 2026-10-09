import { getSeasonTagPhase } from './seasonPhase';

export interface SeasonSelectRecord {
  id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  is_current?: boolean;
  is_ended?: boolean;
  started_at?: string | null;
  playoffs_started?: boolean;
  preseason_start_date?: string | null;
}

export type DefaultSeasonMode = 'latest' | 'latest-ended' | 'active-or-latest-ended' | 'none';

export const sortSeasonsLatestFirst = <TSeason extends SeasonSelectRecord>(
  seasons: TSeason[],
): TSeason[] =>
  [...seasons].sort((a, b) => {
    const startCmp = (b.start_date ?? '').localeCompare(a.start_date ?? '');
    if (startCmp !== 0) return startCmp;
    const createdCmp = (b.created_at ?? '').localeCompare(a.created_at ?? '');
    if (createdCmp !== 0) return createdCmp;
    return b.name.localeCompare(a.name);
  });

export const getLatestSeasonId = <TSeason extends SeasonSelectRecord>(
  seasons: TSeason[],
): string | null => sortSeasonsLatestFirst(seasons)[0]?.id ?? null;

const todayDateString = () => new Date().toISOString().slice(0, 10);

export const isSeasonEnded = <TSeason extends SeasonSelectRecord>(
  season: TSeason,
  asOfDate = todayDateString(),
): boolean => season.is_ended === true || (!!season.end_date && season.end_date <= asOfDate);

export const getLatestEndedSeasonId = <TSeason extends SeasonSelectRecord>(
  seasons: TSeason[],
  asOfDate?: string,
): string | null =>
  sortSeasonsLatestFirst(seasons.filter((season) => isSeasonEnded(season, asOfDate)))[0]?.id ??
  null;

/** In preseason (from its preseason start date), started, or in the playoffs — not yet ended. */
export const isSeasonActive = <TSeason extends SeasonSelectRecord>(
  season: TSeason,
  today: Date = new Date(),
): boolean => {
  const phase = getSeasonTagPhase(season, today);
  return phase === 'preseason' || phase === 'in_progress' || phase === 'playoffs';
};

/** The latest active season (preseason included), or else the latest ended season. */
export const getActiveOrLatestEndedSeasonId = <TSeason extends SeasonSelectRecord>(
  seasons: TSeason[],
  today: Date = new Date(),
): string | null =>
  sortSeasonsLatestFirst(seasons.filter((season) => isSeasonActive(season, today)))[0]?.id ??
  getLatestEndedSeasonId(seasons);
