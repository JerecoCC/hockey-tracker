import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GameRecord } from '@/hooks/useGames';
import GameInfoCard from './GameInfoCard';

const baseGame: GameRecord = {
  id: 'game-1',
  season_id: 'season-1',
  game_type: 'playoff',
  status: 'scheduled',
  scheduled_at: '2024-05-01T19:00:00Z',
  scheduled_time: '19:00',
  venue: 'Arena',
  time_start: null,
  time_end: null,
  home_team: {
    id: 'team-1',
    name: 'Home',
    code: 'HOM',
    logo: null,
    primary_color: '#000',
    secondary_color: '#111',
    text_color: '#fff',
  },
  away_team: {
    id: 'team-2',
    name: 'Away',
    code: 'AWY',
    logo: null,
    primary_color: '#222',
    secondary_color: '#333',
    text_color: '#fff',
  },
  overtime_periods: null,
  shootout: false,
  shootout_first_team_id: null,
  playoff_series_id: 'series-1',
  game_number_in_series: 3,
  game_number: null,
  playoff_round: 2,
  series_home_team_id: null,
  series_away_team_id: null,
  series_home_wins: null,
  series_away_wins: null,
  series_games_to_win: null,
  notes: null,
  created_at: '2024-04-01T00:00:00Z',
  current_period: null,
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
  playoff_round_names: { 2: 'Semifinal' },
};

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: jest.fn(),
  });
});

describe('GameInfoCard', () => {
  it('shows the custom playoff round name in Game Info', () => {
    render(
      <GameInfoCard
        game={baseGame}
        busy={null}
      />,
    );

    expect(screen.getByText('Semifinal')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows scheduled watch date as a separate user-view field when available', () => {
    render(
      <GameInfoCard
        game={{ ...baseGame, scheduled_for: '2024-05-04' }}
        busy={null}
        showScheduledWatchDate
      />,
    );

    expect(screen.getByText('Scheduled Watch Date')).toBeInTheDocument();
    expect(screen.getByText('May 4, 2024')).toBeInTheDocument();
  });

  it('does not show scheduled watch date in the default admin card', () => {
    render(
      <GameInfoCard
        game={{ ...baseGame, scheduled_for: '2024-05-04' }}
        busy={null}
      />,
    );

    expect(screen.queryByText('Scheduled Watch Date')).not.toBeInTheDocument();
  });

  it('shows round and game-in-series fields in the edit modal for playoff games', async () => {
    const user = userEvent.setup();

    render(
      <GameInfoCard
        game={baseGame}
        busy={null}
        updateGameInfo={jest.fn().mockResolvedValue(true)}
      />,
    );

    await user.click(screen.getAllByRole('button')[0]);

    expect(screen.getByText('Edit Game Info')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
  });
});
