const ISO_DATE_PREFIX_RE = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/;
const ISO_MIDNIGHT_RE = /[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-][0-9]{2}(?::?[0-9]{2})?)?$/;

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

export const firstWeekStartForMonth = (month: Date) =>
  new Date(month.getFullYear(), month.getMonth(), 1);

export const isSameCalendarMonth = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();

export const majorityMonthForWeek = (weekStart: Date) => {
  type MonthCount = { count: number; month: Date };
  const counts = new Map<string, MonthCount>();

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate() + offset,
    );
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const current = counts.get(key);
    if (current) {
      current.count += 1;
    } else {
      counts.set(key, {
        count: 1,
        month: new Date(date.getFullYear(), date.getMonth(), 1),
      });
    }
  }

  let majority: MonthCount | undefined;
  for (const candidate of counts.values()) {
    if (!majority || candidate.count > majority.count) majority = candidate;
  }

  return majority?.month ?? firstWeekStartForMonth(weekStart);
};

export const weekBelongsToCalendarMonth = (weekStart: Date, month: Date) =>
  isSameCalendarMonth(majorityMonthForWeek(weekStart), month);
