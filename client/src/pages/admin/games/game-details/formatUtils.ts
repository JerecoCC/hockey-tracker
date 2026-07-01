// ── Date / time formatters ────────────────────────────────────────────────────

export const DATE_FMT_SHORT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/New_York',
});

export const DATE_FMT_LONG = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/New_York',
});

export const LOCAL_DATE_FMT_SHORT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export const LOCAL_DATE_FMT_LONG = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

/** Formats an ISO timestamp as "7:05 PM EST" or "7:05 PM EDT" (ET, DST-aware). */
export const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
  timeZoneName: 'short',
});

const ET_DATE_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
const ET_TZ_NAME_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  timeZoneName: 'short',
});

export const todayETDate = (): string => ET_DATE_FMT.format(new Date());

export const isoToETDate = (iso: string): string => ET_DATE_FMT.format(new Date(iso));

export const scheduledDateInputValue = (scheduledAt?: string | null): string => {
  if (!scheduledAt) return '';
  if (DATE_ONLY_RE.test(scheduledAt)) return scheduledAt;
  const rawDateKey = extractDatePart(scheduledAt);
  if (rawDateKey && ISO_MIDNIGHT_RE.test(scheduledAt)) return rawDateKey;
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return extractDatePart(scheduledAt) ?? '';
  return isoToETDate(scheduledAt);
};

/** Converts an ISO timestamp to "HH:mm" in Eastern Time. */
export const isoToETHHMM = (iso: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = parts.find((p) => p.type === 'hour')?.value ?? '';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '';
  return h && m ? `${h}:${m}` : '';
};

const extractDatePart = (value?: string | null): string | null => {
  if (!value) return null;
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
};

const DATE_ONLY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const ISO_MIDNIGHT_RE = /T00:00(?::00(?:\.0+)?)?(?:Z|[+-][0-9]{2}:[0-9]{2})?$/;

const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const localDateFromDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const etNoonFromDateKey = (dateKey: string): Date => new Date(`${dateKey}T12:00:00Z`);

/**
 * Returns 'EST' or 'EDT' for an ET calendar date.
 *
 * The app captures game clock times separately from the game date, so we use
 * noon on that date to pick the day's Eastern offset. That keeps scheduled,
 * start, and end timestamps stable regardless of the user's browser timezone.
 */
export const etAbbrForDate = (etDateStr?: string | null): string => {
  const etDate = extractDatePart(etDateStr) ?? todayETDate();
  const probe = new Date(`${etDate}T12:00:00-05:00`);
  return ET_TZ_NAME_FMT.formatToParts(probe).find((p) => p.type === 'timeZoneName')?.value ?? 'EST';
};

export const etOffsetForDate = (etDateStr?: string | null): '-04:00' | '-05:00' =>
  etAbbrForDate(etDateStr) === 'EDT' ? '-04:00' : '-05:00';

/**
 * Treats an "HH:mm" string as Eastern Time on the given ET calendar date and
 * returns a UTC ISO string.
 */
export const etHHMMtoISO = (hhmm: string, etDateStr?: string | null): string => {
  const etDate = extractDatePart(etDateStr) ?? todayETDate();
  return new Date(`${etDate}T${hhmm}:00${etOffsetForDate(etDate)}`).toISOString();
};

const getScheduledInstantForDisplay = (
  scheduledAt?: string | null,
  scheduledTime?: string | null,
): Date | null => {
  if (!scheduledAt) return null;

  if (!scheduledTime) {
    if (DATE_ONLY_RE.test(scheduledAt)) return localDateFromDateKey(scheduledAt);
    const direct = new Date(scheduledAt);
    return Number.isNaN(direct.getTime()) ? null : direct;
  }

  const direct = new Date(scheduledAt);
  const rawDateKey = extractDatePart(scheduledAt);
  const isMidnightPlaceholder =
    scheduledTime !== '00:00' && !!rawDateKey && ISO_MIDNIGHT_RE.test(scheduledAt);

  if (
    !DATE_ONLY_RE.test(scheduledAt) &&
    !isMidnightPlaceholder &&
    !Number.isNaN(direct.getTime())
  ) {
    return direct;
  }

  const etDate = rawDateKey ?? todayETDate();
  return new Date(`${etDate}T${scheduledTime}:00${etOffsetForDate(etDate)}`);
};

export const formatScheduledDateLocal = (
  scheduledAt?: string | null,
  scheduledTime?: string | null,
  formatter: Intl.DateTimeFormat = LOCAL_DATE_FMT_SHORT,
): string | null => {
  const instant = getScheduledInstantForDisplay(scheduledAt, scheduledTime);
  return instant ? formatter.format(instant) : null;
};

export const formatScheduledDate = (
  scheduledAt?: string | null,
  formatter: Intl.DateTimeFormat = DATE_FMT_SHORT,
): string | null => {
  if (!scheduledAt) return null;
  const rawDateKey = extractDatePart(scheduledAt);
  if (DATE_ONLY_RE.test(scheduledAt) || (rawDateKey && ISO_MIDNIGHT_RE.test(scheduledAt))) {
    return formatter.format(etNoonFromDateKey(rawDateKey));
  }

  const instant = new Date(scheduledAt);
  if (Number.isNaN(instant.getTime())) {
    return rawDateKey ? formatter.format(etNoonFromDateKey(rawDateKey)) : null;
  }
  return formatter.format(instant);
};

export const formatScheduledTimeLocal = (
  scheduledTime?: string | null,
  scheduledAt?: string | null,
): string | null => {
  if (!scheduledTime) return null;
  const instant = getScheduledInstantForDisplay(scheduledAt, scheduledTime);
  return instant
    ? instant.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;
};

export const formatTimestampTimeLocal = (value?: string | null): string | null => {
  if (!value) return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return instant.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

export const formatEndTimeLocal = (timeEnd: string, timeStart?: string | null): string => {
  const end = new Date(timeEnd);
  const formatted = formatTimestampTimeLocal(timeEnd) ?? '';
  if (!timeStart) return formatted;
  const start = new Date(timeStart);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return formatted;
  return localDateKey(start) !== localDateKey(end) ? `${formatted} (+1)` : formatted;
};

/** Advances a "YYYY-MM-DD" string by one calendar day. */
export const nextETDate = (etDateStr: string): string => {
  const [y, m, d] = etDateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
};

/**
 * Formats a game end timestamp the same as TIME_FMT, but appends " (+1)" when
 * the end time falls on a later calendar date than the start time in ET —
 * i.e. the game ran past midnight.
 */
export const formatEndTime = (timeEnd: string, timeStart?: string | null): string => {
  const formatted = TIME_FMT.format(new Date(timeEnd));
  if (!timeStart) return formatted;
  const startDay = ET_DATE_FMT.format(new Date(timeStart));
  const endDay = ET_DATE_FMT.format(new Date(timeEnd));
  return startDay !== endDay ? `${formatted} (+1)` : formatted;
};

/**
 * Returns 'EST' or 'EDT' for the America/New_York timezone on the given date.
 * Pass a game's scheduled_at ISO string; falls back to today if omitted.
 */
export const etAbbr = (scheduledAt?: string | null): string => {
  return etAbbrForDate(
    extractDatePart(scheduledAt) ?? (scheduledAt ? isoToETDate(scheduledAt) : null),
  );
};

/**
 * Converts a stored "HH:MM" 24-hour string to "h:mm AM/PM EST/EDT".
 * Pass scheduledAt so DST can be determined correctly for that game date.
 */
export const formatScheduledTime = (t: string, scheduledAt?: string | null): string => {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix} ${etAbbr(scheduledAt)}`;
};

// ── Name formatters ───────────────────────────────────────────────────────────

/**
 * Format a player name for goal/assist display.
 * Result: "Connor McDavid"  (or "McDavid" when no first name)
 */
export const formatPlayerName = (firstName: string | null, lastName: string | null): string => {
  if (!lastName) return '';
  return firstName ? `${firstName} ${lastName}` : lastName;
};
