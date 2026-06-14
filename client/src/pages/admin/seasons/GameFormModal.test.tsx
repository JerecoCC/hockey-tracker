import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GameFormModal, { type GameFormTeam } from './GameFormModal';

const seasonTeams: GameFormTeam[] = [
  {
    id: 'team-1',
    name: 'Home Team',
    code: 'HOM',
    logo: null,
    home_arena: 'Home Arena',
  },
  {
    id: 'team-2',
    name: 'Away Team',
    code: 'AWY',
    logo: null,
    home_arena: 'Away Arena',
  },
];

describe('GameFormModal', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollTo', { value: jest.fn(), writable: true });
  });

  it('uses a home/away control and opponent picker for team-scoped game creation', async () => {
    const user = userEvent.setup();
    const createGame = jest.fn().mockResolvedValue({ id: 'game-1' });
    const onClose = jest.fn();

    render(
      <GameFormModal
        open
        seasonId="season-1"
        editTarget={null}
        seasonTeams={seasonTeams}
        createGame={createGame}
        updateGame={jest.fn()}
        onClose={onClose}
        defaultDate="2026-06-15"
        teamContext={{ teamId: 'team-1' }}
      />,
    );

    expect(screen.getByText('Current Team')).toBeInTheDocument();
    expect(screen.getByLabelText(/Opponent Team/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Away Team')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Home Team')).not.toBeInTheDocument();

    await user.click(screen.getByText('Away'));
    await user.click(screen.getByLabelText(/Opponent Team/));
    await user.click(await screen.findByRole('button', { name: /Away Team/ }));
    await user.click(screen.getByRole('button', { name: 'Create Game' }));

    await waitFor(() =>
      expect(createGame).toHaveBeenCalledWith(
        expect.objectContaining({
          season_id: 'season-1',
          home_team_id: 'team-2',
          away_team_id: 'team-1',
          scheduled_at: '2026-06-15',
          venue: 'Away Arena',
        }),
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
