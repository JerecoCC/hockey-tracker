/* eslint-disable react/prop-types */
import type { ComponentProps, ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MovePlayerModal from './MovePlayerModal';

jest.mock('@jerecocc/tracker-ui/components/Modal/Modal', () => {
  interface MockModalProps {
    open: boolean;
    title: string;
    children: ReactNode;
    confirmForm?: string;
  }

  const MockModal = ({ open, title, children, confirmForm }: MockModalProps) =>
    open ? (
      <div>
        <h1>{title}</h1>
        {children}
        <button
          type="submit"
          form={confirmForm}
        >
          Move
        </button>
      </div>
    ) : null;

  MockModal.displayName = 'MockModal';
  return MockModal;
});

jest.mock('@jerecocc/tracker-ui/components/Field/Field', () => {
  const { Controller } = jest.requireActual('react-hook-form');

  interface MockFieldProps {
    control: unknown;
    name: string;
    type?: string;
    label: string;
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
  }

  const MockField = (props: MockFieldProps) => (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field }: { field: { value: string; onChange: (value: string) => void } }) => (
        <label>
          {props.label}
          {props.type === 'select' ? (
            <select
              aria-label={props.label}
              value={field.value ?? ''}
              onChange={(event) => field.onChange(event.target.value)}
            >
              <option value="">{props.placeholder ?? ''}</option>
              {(props.options ?? []).map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label={props.label}
              value={field.value ?? ''}
              onChange={(event) => field.onChange(event.target.value)}
            />
          )}
        </label>
      )}
    />
  );

  MockField.displayName = 'MockField';
  return MockField;
});

jest.mock('@/hooks/useTeams', () => ({
  __esModule: true,
  default: () => ({
    teams: [
      {
        id: 'team-current',
        name: 'Current Team',
        code: 'CUR',
        league_id: 'league-1',
      },
      {
        id: 'team-next',
        name: 'Next Team',
        code: 'NXT',
        league_id: 'league-1',
      },
    ],
  }),
}));

const player = {
  id: 'player-1',
  first_name: 'Sarah',
  last_name: 'Nurse',
  jersey_number: 20,
} as NonNullable<ComponentProps<typeof MovePlayerModal>['player']>;

describe('MovePlayerModal', () => {
  it('does not render team history in the move player form', async () => {
    render(
      <MovePlayerModal
        open
        player={player}
        currentTeamId="team-current"
        seasonId="season-1"
        leagueId="league-1"
        onClose={jest.fn()}
        movePlayer={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Team Moves This Season')).not.toBeInTheDocument();
    });
  });

  it('renders movement type before movement date', async () => {
    render(
      <MovePlayerModal
        open
        player={player}
        currentTeamId="team-current"
        seasonId="season-1"
        leagueId="league-1"
        onClose={jest.fn()}
        movePlayer={jest.fn()}
      />,
    );

    const movementGroup = await screen.findByRole('group', { name: 'MOVEMENT' });
    await waitFor(() => {
      expect(
        within(movementGroup)
          .getAllByLabelText(/^(Type|Date)$/)
          .map((control) => control.getAttribute('aria-label')),
      ).toEqual(['Type', 'Date']);
    });
  });

  it('defaults off-season moves to the next roster season and submits the selection', async () => {
    const user = userEvent.setup();
    const movePlayer = jest.fn().mockResolvedValue(true);

    render(
      <MovePlayerModal
        open
        player={player}
        currentTeamId="team-current"
        seasonId="season-2025"
        leagueId="league-1"
        seasons={[
          {
            id: 'season-2025',
            league_id: 'league-1',
            name: '2025-26',
            start_date: '2025-10-01',
            end_date: '2026-06-30',
            created_at: '2025-01-01T00:00:00Z',
          },
          {
            id: 'season-2026',
            league_id: 'league-1',
            name: '2026-27',
            start_date: '2026-10-01',
            end_date: '2027-06-30',
            created_at: '2026-01-01T00:00:00Z',
          },
        ] as ComponentProps<typeof MovePlayerModal>['seasons']}
        onClose={jest.fn()}
        movePlayer={movePlayer}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Move To'), 'team-next');
    await user.type(screen.getByLabelText('Date'), '2026-07-15');

    await waitFor(() => {
      expect(screen.getByLabelText('Roster Season')).toHaveValue('season-2026');
    });

    await user.click(screen.getByRole('button', { name: 'Move' }));

    await waitFor(() => {
      expect(movePlayer).toHaveBeenCalledWith(
        'player-1',
        'season-2025',
        'team-next',
        '2026-07-15',
        20,
        null,
        'trade',
        'season-2026',
      );
    });
  });
});
