export type SeasonPhase = 'upcoming' | 'in_progress' | 'playoffs' | 'ended';

export interface SeasonPhaseFields {
  started_at?: string | null;
  playoffs_started?: boolean;
  is_ended?: boolean;
}

export const getSeasonPhase = (season: SeasonPhaseFields): SeasonPhase => {
  if (season.is_ended) return 'ended';
  if (season.playoffs_started) return 'playoffs';
  if (season.started_at) return 'in_progress';
  return 'upcoming';
};

export const seasonPhasePresentation = (phase: SeasonPhase) => {
  switch (phase) {
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
