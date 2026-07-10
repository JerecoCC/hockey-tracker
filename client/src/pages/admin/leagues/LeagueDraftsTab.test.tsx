import { render, screen, within } from '@testing-library/react';
import useLeagueDraftDates, { type LeagueDraftDateRecord } from '@/hooks/useLeagueDraftDates';
import LeagueDraftsTab from './LeagueDraftsTab';

jest.mock('@/hooks/useLeagueDraftDates', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseLeagueDraftDates = useLeagueDraftDates as jest.Mock;

const draftDate = (
  id: string,
  draftYear: number,
  startRound: number,
  endRound: number,
  date: string,
): LeagueDraftDateRecord => ({
  id,
  league_id: 'league-1',
  draft_year: draftYear,
  start_round: startRound,
  end_round: endRound,
  draft_date: date,
  notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
});

const hookResult = (draftDates: LeagueDraftDateRecord[]) => ({
  draftDates,
  loading: false,
  createDraftDate: jest.fn(),
  updateDraftDate: jest.fn(),
  createDraftEvent: jest.fn(),
  updateDraftEvent: jest.fn(),
  deleteDraftEvent: jest.fn(),
  deleteDraftDate: jest.fn(),
});

describe('LeagueDraftsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders round columns with each draft day spanning its configured rounds', () => {
    mockUseLeagueDraftDates.mockReturnValue(
      hookResult([
        draftDate('2026-day-1', 2026, 1, 2, '2026-06-26'),
        draftDate('2026-day-2', 2026, 3, 7, '2026-06-27'),
        draftDate('2025-day-1', 2025, 1, 5, '2025-06-25'),
      ]),
    );

    render(<LeagueDraftsTab leagueId="league-1" />);

    const table = screen.getByRole('table', { name: 'Draft schedule by round' });
    expect(within(table).getByRole('columnheader', { name: 'Draft year' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Round 7' })).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Round 8' })).not.toBeInTheDocument();

    const rowHeaders = within(table).getAllByRole('rowheader');
    expect(rowHeaders[0]).toHaveTextContent('2026');
    expect(rowHeaders[1]).toHaveTextContent('2025');
    expect(rowHeaders[0]).toHaveTextContent('June 26, 2026 - June 27, 2026');
    expect(rowHeaders[1]).toHaveTextContent('June 25, 2025');
    expect(rowHeaders[0].querySelector('[data-hover-actions]')).toContainElement(
      within(rowHeaders[0]).getByRole('button', { name: 'Edit 2026 draft' }),
    );

    expect(within(table).getByLabelText('Day 1, June 26, 2026, Rounds 1-2')).toHaveAttribute(
      'data-round-span',
      '2',
    );
    expect(within(table).getByLabelText('Day 2, June 27, 2026, Rounds 3-7')).toHaveAttribute(
      'data-round-span',
      '5',
    );

    const shorterDraftRow = rowHeaders[1].closest('tr');
    expect(shorterDraftRow).not.toBeNull();
    expect(
      within(shorterDraftRow as HTMLTableRowElement).getByLabelText(
        'Day 1, June 25, 2025, Rounds 1-5',
      ),
    ).toHaveAttribute('data-round-span', '5');
    expect(within(shorterDraftRow as HTMLTableRowElement).getAllByRole('cell')).toHaveLength(7);
  });

  it('keeps uncovered legacy rounds empty instead of shifting later draft days', () => {
    mockUseLeagueDraftDates.mockReturnValue(
      hookResult([
        draftDate('2024-day-1', 2024, 1, 2, '2024-06-24'),
        draftDate('2024-day-2', 2024, 4, 5, '2024-06-25'),
      ]),
    );

    render(<LeagueDraftsTab leagueId="league-1" />);

    const draftRow = screen.getByRole('rowheader', { name: /2024/ }).closest('tr');
    expect(draftRow).not.toBeNull();
    expect(
      within(draftRow as HTMLTableRowElement).getByLabelText('Day 2, June 25, 2024, Rounds 4-5'),
    ).toHaveAttribute('data-round-span', '2');
    expect(
      within(draftRow as HTMLTableRowElement).getByRole('cell', {
        name: 'Round 3 not scheduled',
      }),
    ).toBeInTheDocument();
  });
});
