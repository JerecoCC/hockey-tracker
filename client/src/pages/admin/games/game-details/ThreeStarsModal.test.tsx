import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeContext } from '@/context/ThemeContext';
import { type GameRosterEntry } from '@/hooks/useGameRoster';
import ThreeStarsModal from './ThreeStarsModal';

beforeAll(() => {
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: jest.fn(),
  });
});

const roster: GameRosterEntry[] = [
  {
    id: 'roster-away-1',
    game_id: 'game-1',
    team_id: 'away-team',
    player_id: 'player-away-1',
    first_name: 'Ava',
    last_name: 'Away',
    photo: null,
    position: 'C',
    jersey_number: 9,
    date_of_birth: null,
    start_date: null,
    acquisition_type: null,
  },
];

const renderModal = () =>
  render(
    <ThemeContext.Provider
      value={{
        theme: 'light',
        isDarkMode: false,
        setTheme: jest.fn(),
        toggleTheme: jest.fn(),
      }}
    >
      <ThreeStarsModal
        open
        editMode={false}
        roster={roster}
        busy={false}
        awayTeam={{
          id: 'away-team',
          code: 'AWY',
          logo: '/logos/away-default.png',
          logoDark: '/logos/away-dark.png',
          logoLight: '/logos/away-light.png',
          primaryColor: '#003087',
          textColor: '#ffffff',
        }}
        homeTeam={{
          id: 'home-team',
          code: 'HOM',
          logo: '/logos/home-default.png',
          logoDark: '/logos/home-dark.png',
          logoLight: '/logos/home-light.png',
          primaryColor: '#111111',
          textColor: '#ffffff',
        }}
        onClose={jest.fn()}
        onSave={jest.fn().mockResolvedValue(true)}
        onEndGame={jest.fn().mockResolvedValue(true)}
      />
    </ThemeContext.Provider>,
  );

describe('ThreeStarsModal', () => {
  it('uses the light team logo in player select options when light mode is active', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('textbox', { name: /1st star/i }));

    const option = screen.getByRole('option', { name: /#9 Ava Away/i });
    expect(within(option).getByRole('button').querySelector('img')).toHaveAttribute(
      'src',
      '/logos/away-light.png',
    );
  });
});
