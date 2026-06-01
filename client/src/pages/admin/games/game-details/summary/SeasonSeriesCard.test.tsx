import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GameRecord } from '@/hooks/useGames';
import SeasonSeriesCard from './SeasonSeriesCard';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const game = {
  id: 'game-current',
  season_id: 'season-1',
  game_type: 'regular',
  status: 'in_progress',
  scheduled_at: '2024-10-10T19:00:00Z',
  scheduled_time: null,
  venue: null,
  time_start: null,
  time_end: null,
  home_team: {
    id: 'home-team',
    name: 'Home Team',
    code: 'HOM',
    logo: null,
    primary_color: '#111111',
    secondary_color: '#222222',
    text_color: '#ffffff',
  },
  away_team: {
    id: 'away-team',
    name: 'Away Team',
    code: 'AWY',
    logo: null,
    primary_color: '#333333',
    secondary_color: '#444444',
    text_color: '#ffffff',
  },
  overtime_periods: null,
  shootout: false,
  shootout_first_team_id: null,
  playoff_series_id: null,
  game_number_in_series: null,
  game_number: null,
  playoff_round: null,
  series_home_team_id: null,
  series_away_team_id: null,
  series_home_wins: null,
  series_away_wins: null,
  series_games_to_win: null,
  notes: null,
  created_at: '2024-09-01T12:00:00Z',
  current_period: '2',
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
  previous_meetings: [
    {
      game_id: 'game-past',
      scheduled_at: '2024-10-01T19:00:00Z',
      created_at: '2024-09-01T10:00:00Z',
      status: 'final',
      current_home_was_home: true,
      home_team: {
        id: 'home-team',
        name: 'Home Team',
        code: 'HOM',
        logo: null,
        primary_color: '#111111',
        secondary_color: '#222222',
        text_color: '#ffffff',
      },
      away_team: {
        id: 'away-team',
        name: 'Away Team',
        code: 'AWY',
        logo: null,
        primary_color: '#333333',
        secondary_color: '#444444',
        text_color: '#ffffff',
      },
      home_score: 4,
      away_score: 2,
      overtime_periods: null,
      shootout: false,
    },
    {
      game_id: 'game-future',
      scheduled_at: '2024-10-20T19:00:00Z',
      created_at: '2024-09-01T14:00:00Z',
      status: 'scheduled',
      current_home_was_home: false,
      home_team: {
        id: 'away-team',
        name: 'Away Team',
        code: 'AWY',
        logo: null,
        primary_color: '#333333',
        secondary_color: '#444444',
        text_color: '#ffffff',
      },
      away_team: {
        id: 'home-team',
        name: 'Home Team',
        code: 'HOM',
        logo: null,
        primary_color: '#111111',
        secondary_color: '#222222',
        text_color: '#ffffff',
      },
      home_score: 0,
      away_score: 0,
      overtime_periods: null,
      shootout: false,
    },
  ],
} as GameRecord;

beforeEach(() => jest.clearAllMocks());

describe('SeasonSeriesCard', () => {
  it('shows future season-series games in addition to past and current ones', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SeasonSeriesCard
        game={game}
        gameHrefBuilder={(gameId) => `/admin/leagues/league-1/seasons/season-1/games/${gameId}`}
        liveAwayScore={1}
        liveHomeScore={2}
      />,
    );

    expect(container.querySelectorAll('.prevMeetingRow')).toHaveLength(3);
    expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll('.prevMeetingRow')[2].querySelectorAll('.teamCode')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['HOM', 'AWY']);

    await user.click(screen.getAllByRole('button')[1]);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/admin/leagues/league-1/seasons/season-1/games/game-future',
    );
  });

  it('supports a custom user-view game route builder', async () => {
    const user = userEvent.setup();

    render(
      <SeasonSeriesCard
        game={game}
        gameHrefBuilder={(gameId) => `/games/${gameId}`}
        liveAwayScore={1}
        liveHomeScore={2}
      />,
    );

    await user.click(screen.getAllByRole('button')[1]);

    expect(mockNavigate).toHaveBeenCalledWith('/games/game-future');
  });
});
