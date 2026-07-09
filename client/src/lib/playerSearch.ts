const DIACRITIC_MARKS_PATTERN = /[\u0300-\u036f]/g;
const KS_TRANSLITERATION_PATTERN = /ks/g;

export const normalizePlayerSearchText = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(DIACRITIC_MARKS_PATTERN, '')
    .toLowerCase()
    .replace(KS_TRANSLITERATION_PATTERN, 'x')
    .trim();

export const playerSearchTextIncludes = (
  value: string | null | undefined,
  normalizedQuery: string,
) => normalizePlayerSearchText(value).includes(normalizedQuery);
