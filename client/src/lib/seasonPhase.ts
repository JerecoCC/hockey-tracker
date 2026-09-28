export type SeasonPhase = 'upcoming' | 'in_progress' | 'playoffs' | 'ended';

/** Display-only phase: 'preseason' never drives lifecycle actions. */
export type SeasonTagPhase = SeasonPhase | 'preseason';

export interface SeasonPhaseFields {
  started_at?: string | null;
  playoffs_started?: boolean;
  is_ended?: boolean;
}

export interface SeasonTagFields extends SeasonPhaseFields {
  start_date?: string | null;
  preseason_start_date?: string | null;
}

const toLocalISODate = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const getSeasonPhase = (season: SeasonPhaseFields): SeasonPhase => {
  if (season.is_ended) return 'ended';
  if (season.playoffs_started) return 'playoffs';
  if (season.started_at) return 'in_progress';
  return 'upcoming';
};

// The tag reads "Preseason" from the preseason start date until the regular-season start date.
export const getSeasonTagPhase = (
  season: SeasonTagFields,
  today: Date = new Date(),
): SeasonTagPhase => {
  const phase = getSeasonPhase(season);
  if (phase !== 'upcoming' && phase !== 'in_progress') return phase;
  const preseasonStart = season.preseason_start_date?.slice(0, 10);
  if (!preseasonStart) return phase;
  const todayKey = toLocalISODate(today);
  const seasonStart = season.start_date?.slice(0, 10);
  if (todayKey >= preseasonStart && (!seasonStart || todayKey < seasonStart)) return 'preseason';
  return phase;
};

export const seasonPhasePresentation = (phase: SeasonTagPhase) => {
  switch (phase) {
    case 'preseason':
      return { label: 'Preseason', intent: 'warning' as const };
    case 'in_progress':
      return { label: 'In Progress', intent: 'success' as const };
    case 'playoffs':
      return { label: 'Playoffs', intent: 'accent' as const };
    case 'ended':
      return { label: 'Ended', intent: 'neutral' as const };
    default:
      return { label: 'Upcoming', intent: 'info' as const };
  }
};
