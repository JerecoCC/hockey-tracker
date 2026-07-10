import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import useLeagueDraftDates, { type LeagueDraftDateRecord } from '@/hooks/useLeagueDraftDates';
import LeagueDraftsTab from './LeagueDraftsTab';

jest.mock('@/hooks/useLeagueDraftDates', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@jerecocc/tracker-ui/components/Field/Field', () => {
  const { useController } = jest.requireActual<typeof import('react-hook-form')>('react-hook-form');

  type MockFieldProps = {
    control: import('react-hook-form').Control;
    name: string;
    type?: string;
    label: string;
    required?: boolean;
    rules?: import('react-hook-form').RegisterOptions;
    min?: number;
    max?: number;
    disabled?: boolean;
    wrapperClassName?: string;
  };

  const MockField = ({
    control,
    name,
    type,
    label,
    required,
    rules,
    min,
    max,
    disabled,
    wrapperClassName,
  }: MockFieldProps) => {
    const { field } = useController({ control, name, rules });

    return (
      <label className={wrapperClassName}>
        {label}
        <input
          {...field}
          aria-label={label}
          type={type === 'number' ? 'number' : 'text'}
          value={typeof field.value === 'string' ? field.value : ''}
          required={required}
          min={min}
          max={max}
          disabled={disabled}
        />
      </label>
    );
  };

  return {
    __esModule: true,
    default: MockField,
  };
});

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
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: jest.fn(),
    });
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

    const firstRange = within(table).getByLabelText('Day 1, June 26, 2026, Rounds 1-2');
    expect(firstRange).toHaveAttribute('data-round-span', '2');
    fireEvent.mouseEnter(firstRange.parentElement as HTMLElement);
    expect(screen.getByRole('tooltip')).toHaveTextContent('June 26, 2026: Rounds 1-2');
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

  it('derives the draft year from the start date and requires both dates to share a year', async () => {
    const createDraftEvent = jest.fn(async () => true);
    mockUseLeagueDraftDates.mockReturnValue({
      ...hookResult([]),
      createDraftEvent,
    });

    render(<LeagueDraftsTab leagueId="league-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Draft' }));
    expect(screen.getByRole('heading', { name: 'Create Draft' })).toBeInTheDocument();
    const form = document.getElementById('league-draft-form');
    expect(form).not.toBeNull();
    const draftForm = within(form as HTMLFormElement);
    expect(draftForm.queryByLabelText('Draft Year')).not.toBeInTheDocument();

    const startDate = draftForm.getByLabelText('Start Date');
    const endDate = draftForm.getByLabelText('End Date');
    const totalRounds = draftForm.getByLabelText('Total Rounds');
    expect(totalRounds.closest('label')).toHaveClass('draftFormFullWidth');
    expect(
      startDate.compareDocumentPosition(endDate) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      endDate.compareDocumentPosition(totalRounds) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.change(startDate, { target: { value: '2026-12-31' } });
    fireEvent.change(endDate, { target: { value: '2027-01-01' } });
    fireEvent.change(totalRounds, { target: { value: '2' } });
    expect(
      draftForm.getByText('Start and end dates must be within the same calendar year.'),
    ).toBeInTheDocument();
    const submitButton = document.querySelector<HTMLButtonElement>(
      'button[form="league-draft-form"]',
    );
    expect(submitButton).not.toBeNull();
    expect(submitButton).toBeDisabled();

    fireEvent.change(startDate, { target: { value: '2026-12-30' } });
    fireEvent.change(endDate, { target: { value: '2026-12-31' } });
    const firstDayGroup = await screen.findByRole('group', { name: 'Day 1' });
    const secondDayGroup = screen.getByRole('group', { name: 'Day 2' });
    const firstDayDate = within(firstDayGroup).getByText('December 30, 2026');
    const secondDayDate = within(secondDayGroup).getByText('December 31, 2026');
    expect(firstDayDate.parentElement).toContainElement(within(firstDayGroup).getByText('Round 1'));
    expect(secondDayDate.parentElement).toContainElement(
      within(secondDayGroup).getByText('Round 2'),
    );
    expect(within(firstDayGroup).getAllByRole('slider')).toHaveLength(1);
    const firstDaySlider = within(firstDayGroup).getByRole('slider', {
      name: 'Day 1 end round',
    });
    expect(firstDaySlider).toBeDisabled();
    expect(firstDaySlider.closest('.draftDaySlider')).not.toBeNull();
    expect(within(secondDayGroup).getAllByRole('slider')).toHaveLength(2);
    expect(
      within(secondDayGroup)
        .getByRole('slider', { name: 'Day 2 start round' })
        .closest('.draftDaySlider'),
    ).not.toBeNull();
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton as HTMLButtonElement);

    await waitFor(() =>
      expect(createDraftEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          draft_year: 2026,
          start_date: '2026-12-30',
          end_date: '2026-12-31',
          total_rounds: 2,
        }),
      ),
    );
  });
});
