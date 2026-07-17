/** Derives a short label like "2024-25" from a season's start/end dates. */
export const seasonLabel = (
  startDate: string | null,
  endDate: string | null,
  name: string,
): string => {
  if (!startDate) return name;
  const startYear = startDate.slice(0, 4);
  const endYear = endDate?.slice(0, 4);
  if (!endYear || endYear === startYear) return startYear;
  return `${startYear}-${endYear.slice(2)}`;
};
