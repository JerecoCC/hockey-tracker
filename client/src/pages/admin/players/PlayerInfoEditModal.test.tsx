import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type PlayerRecord } from '@/hooks/useLeaguePlayers';
import PlayerInfoEditModal from './PlayerInfoEditModal';

jest.mock('@/components/Modal/Modal', () => {
  const MockModal = ({ open, title, children }: any) =>
    open ? (
      <div
        role="dialog"
        aria-label={title}
      >
        {children}
      </div>
    ) : null;

  MockModal.displayName = 'MockModal';
  return MockModal;
});

const player = {
  id: 'player-1',
  league_player_number: '8478402',
  first_name: 'John',
  last_name: 'Smith',
  photo: null,
  date_of_birth: null,
  birth_city: null,
  birth_country: null,
  height_cm: null,
  weight_lbs: null,
  position: 'C',
  shoots: 'L',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
} as PlayerRecord;

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = jest.fn();
});

describe('PlayerInfoEditModal', () => {
  it('edits the league player number with the player info payload', async () => {
    const updatePlayer = jest.fn().mockResolvedValue(true);

    const { container } = render(
      <PlayerInfoEditModal
        open
        player={player}
        seasons={[{ id: 'season-1', name: '2025-26', is_current: true }]}
        onClose={jest.fn()}
        updatePlayer={updatePlayer}
      />,
    );

    const identityRow = container.querySelector('.playerInfoIdentityRow') as HTMLElement;
    expect(within(identityRow).getByText('League Player Number')).toBeInTheDocument();
    expect(within(identityRow).getByText('Rookie Season')).toBeInTheDocument();

    const leaguePlayerNumber = screen.getByLabelText('League Player Number');
    expect(leaguePlayerNumber).toHaveValue('8478402');
    expect(screen.getByLabelText('Birth City')).toHaveFocus();

    fireEvent.change(leaguePlayerNumber, { target: { value: '8480000' } });
    fireEvent.submit(document.getElementById('player-info-form') as HTMLFormElement);

    await waitFor(() =>
      expect(updatePlayer).toHaveBeenCalledWith(
        'player-1',
        expect.objectContaining({ league_player_number: '8480000' }),
      ),
    );
  });

  it('edits active player status with a segmented control', async () => {
    const updatePlayer = jest.fn().mockResolvedValue(true);

    render(
      <PlayerInfoEditModal
        open
        player={player}
        seasons={[{ id: 'season-1', name: '2025-26', is_current: true }]}
        onClose={jest.fn()}
        updatePlayer={updatePlayer}
      />,
    );

    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Inactive' }));
    fireEvent.submit(document.getElementById('player-info-form') as HTMLFormElement);

    await waitFor(() =>
      expect(updatePlayer).toHaveBeenCalledWith(
        'player-1',
        expect.objectContaining({ status: 'inactive' }),
      ),
    );
  });

  it('hides player status when the player is retired and omits it from the payload', async () => {
    const updatePlayer = jest.fn().mockResolvedValue(true);

    render(
      <PlayerInfoEditModal
        open
        player={{ ...player, status: 'retired', is_active: false }}
        seasons={[{ id: 'season-1', name: '2025-26', is_current: true }]}
        onClose={jest.fn()}
        updatePlayer={updatePlayer}
      />,
    );

    expect(screen.queryByText('Status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Active' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inactive' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('League Player Number'), {
      target: { value: '8480000' },
    });
    fireEvent.submit(document.getElementById('player-info-form') as HTMLFormElement);

    await waitFor(() => expect(updatePlayer).toHaveBeenCalled());
    expect(updatePlayer.mock.calls[0][1]).toEqual(
      expect.objectContaining({ league_player_number: '8480000' }),
    );
    expect(updatePlayer.mock.calls[0][1]).not.toHaveProperty('status');
  });
});
