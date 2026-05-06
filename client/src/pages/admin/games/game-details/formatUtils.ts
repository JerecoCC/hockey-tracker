// ── Date / time formatters ────────────────────────────────────────────────────

export const DATE_FMT_SHORT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
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

/**
 * Returns 'EST' or 'EDT' for the America/New_York timezone on the given date.
 * Pass a game's scheduled_at ISO string; falls back to today if omitted.
 */
export const etAbbr = (scheduledAt?: string | null): string => {
  const base = scheduledAt ? new Date(scheduledAt) : new Date();
  const etDatePart = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(base);
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })
      .formatToParts(new Date(`${etDatePart}T12:00:00`))
      .find((p) => p.type === 'timeZoneName')?.value ?? 'ET'
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
