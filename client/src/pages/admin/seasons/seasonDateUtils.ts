const ISO_DATE_PREFIX_RE = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/;
const ISO_MIDNIGHT_RE = /T00:00(?::00(?:\.0+)?)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;

const rawDateKey = (value: string | null | undefined) =>
  value?.match(ISO_DATE_PREFIX_RE)?.[1] ?? null;

export const toEasternDateKey = (iso: string) => {
  const rawDate = rawDateKey(iso);
  if (!iso.includes('T') || ISO_MIDNIGHT_RE.test(iso)) return rawDate ?? iso;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return rawDate ?? iso;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const easternDate = `${value('year')}-${value('month')}-${value('day')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(easternDate) ? easternDate : (rawDate ?? iso);
};
