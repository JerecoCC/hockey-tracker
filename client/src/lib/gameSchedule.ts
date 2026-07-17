export type GameTimezone = 'ET' | 'local';

export interface ScheduledGame {
  scheduled_at: string | null;
  scheduled_time: string | null;
}

export const DATE_ONLY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
export const ISO_DATE_PREFIX_RE = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/;
export const ISO_MIDNIGHT_RE =
  /[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-][0-9]{2}(?::?[0-9]{2})?)?$/;

const EASTERN_TIME_ZONE = 'America/New_York';

export const toDateKeyInZone = (date: Date, timeZone?: string): string | null => {
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
};

export const toLocalDateKey = (value: string | Date): string | null =>
  toDateKeyInZone(value instanceof Date ? value : new Date(value));

export const getRawDateKey = (value: string | null | undefined): string | null =>
  value?.match(ISO_DATE_PREFIX_RE)?.[1] ?? null;

export const dateKeyToDate = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getEasternOffset = (dateKey: string): string => {
  const timeZoneName = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(new Date(`${dateKey}T17:00:00Z`))
    .find((part) => part.type === 'timeZoneName')?.value;

  const match = timeZoneName?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return '-05:00';
  return `${match[1]}${match[2].padStart(2, '0')}:${match[3] ?? '00'}`;
};

export const getEasternDateKey = (
  scheduledAt: string | null,
  scheduledTime: string | null,
): string | null => {
  if (!scheduledAt) return null;
  if (DATE_ONLY_RE.test(scheduledAt)) return scheduledAt;

  const rawDateKey = getRawDateKey(scheduledAt);
  const isMidnightPlaceholder =
    !!scheduledTime &&
    scheduledTime !== '00:00' &&
    !!rawDateKey &&
    ISO_MIDNIGHT_RE.test(scheduledAt);
  if (isMidnightPlaceholder) return rawDateKey;

  const instant = new Date(scheduledAt);
  return toDateKeyInZone(instant, EASTERN_TIME_ZONE) ?? rawDateKey;
};

export const getScheduledInstant = (
  scheduledAt: string | null,
  scheduledTime: string | null,
): Date | null => {
  if (!scheduledAt) return null;

  const direct = new Date(scheduledAt);
  const hasDirectInstant = !Number.isNaN(direct.getTime());

  if (!scheduledTime) {
    if (DATE_ONLY_RE.test(scheduledAt)) return new Date(`${scheduledAt}T17:00:00Z`);
    return hasDirectInstant ? direct : null;
  }

  const easternDateKey =
    getEasternDateKey(scheduledAt, scheduledTime) ??
    toDateKeyInZone(new Date(), EASTERN_TIME_ZONE);
  if (!easternDateKey) return null;

  return new Date(`${easternDateKey}T${scheduledTime}:00${getEasternOffset(easternDateKey)}`);
};

export const getScheduledWatchDateKey = (
  value: string | null | undefined,
): string | null => {
  if (!value) return null;
  return getRawDateKey(value) ?? toLocalDateKey(value);
};

export const getOriginalGameDateKey = (
  game: ScheduledGame,
  timezone: GameTimezone,
): string | null => {
  if (game.scheduled_at && !game.scheduled_time) {
    if (DATE_ONLY_RE.test(game.scheduled_at)) return game.scheduled_at;
    const rawDateKey = getRawDateKey(game.scheduled_at);
    if (rawDateKey && ISO_MIDNIGHT_RE.test(game.scheduled_at)) return rawDateKey;
  }

  const instant = getScheduledInstant(game.scheduled_at, game.scheduled_time);
  if (!instant) return null;
  return timezone === 'ET'
    ? (getEasternDateKey(game.scheduled_at, game.scheduled_time) ??
        toDateKeyInZone(instant, EASTERN_TIME_ZONE))
    : toDateKeyInZone(instant);
};

export const getScheduledGameDateKey = (game: ScheduledGame): string | null => {
  if (game.scheduled_at && DATE_ONLY_RE.test(game.scheduled_at) && !game.scheduled_time) {
    return game.scheduled_at;
  }

  const instant = getScheduledInstant(game.scheduled_at, game.scheduled_time);
  return instant ? toDateKeyInZone(instant) : getRawDateKey(game.scheduled_at);
};

export const isInvalidWatchScheduleDate = (
  game: ScheduledGame,
  scheduledFor: string | null | undefined,
  timezone: GameTimezone,
): boolean => {
  const watchDateKey = getScheduledWatchDateKey(scheduledFor);
  if (!watchDateKey) return false;
  const gameDateKey = getOriginalGameDateKey(game, timezone);
  return !!gameDateKey && watchDateKey <= gameDateKey;
};

export const formatGameTime = (
  scheduledAt: string | null,
  scheduledTime: string | null,
  timezone: GameTimezone,
): string => {
  const instant = getScheduledInstant(scheduledAt, scheduledTime);
  if (!instant) return '';

  if (timezone === 'ET') {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: EASTERN_TIME_ZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(instant);
  }

  return instant.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};
