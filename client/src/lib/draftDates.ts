export interface DraftDateLookupRow {
  draft_year: number | string | null;
  start_round: number | string | null;
  end_round: number | string | null;
  draft_date: string | null;
}

interface DraftPickLookupInput {
  year?: number | string | null;
  round?: number | string | null;
}

const numberFromValue = (value: number | string | null | undefined) => {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  const text = value == null ? '' : String(value).trim();
  const match = text.match(/\d+/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isInteger(number) ? number : null;
};

export const getDraftPickStartDate = (
  draft: DraftPickLookupInput | null | undefined,
  draftDates: DraftDateLookupRow[],
) => {
  const year = numberFromValue(draft?.year);
  const round = numberFromValue(draft?.round);
  if (!year || !round) return null;

  const match = draftDates
    .filter((row) => {
      const rowYear = numberFromValue(row.draft_year);
      const startRound = numberFromValue(row.start_round);
      const endRound = numberFromValue(row.end_round);
      return (
        rowYear === year &&
        !!startRound &&
        !!endRound &&
        startRound <= round &&
        endRound >= round &&
        !!row.draft_date
      );
    })
    .sort((left, right) => {
      const leftSpan =
        (numberFromValue(left.end_round) ?? 0) - (numberFromValue(left.start_round) ?? 0);
      const rightSpan =
        (numberFromValue(right.end_round) ?? 0) - (numberFromValue(right.start_round) ?? 0);
      return leftSpan - rightSpan || String(left.draft_date).localeCompare(String(right.draft_date));
    })[0];

  return match?.draft_date ?? null;
};
