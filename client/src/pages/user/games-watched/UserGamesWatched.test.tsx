import { fireEvent, render, screen, within } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import UserGamesWatched from './UserGamesWatched';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@/hooks/useFavoriteTeams', () => ({
  __esModule: true,
  default: () => ({ favorites: ['team-home', 'team-away'] }),
}));
jest.mock('@/components/Select/Select', () => ({
  __esModule: true,
  default: ({ value, options, onChange }: any) => (
    <select
      aria-label="Year"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option: any) => (
        <option
          key={option.value}
          value={option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
jest.mock('@/components/TeamLogo/TeamLogo', () => ({ code }: any) => <span>{code}</span>);

const mockUseQuery = useQuery as jest.Mock;

const teamHome = {
  id: 'team-home',
  name: 'Toronto Maple Leafs',
  code: 'TOR',
  logo: null,
  primary_color: '#003e7e',
  secondary_color: '#ffffff',
  text_color: '#ffffff',
};

const teamAway = {
  id: 'team-away',
  name: 'Boston Bruins',
  code: 'BOS',
  logo: null,
  primary_color: '#ffb81c',
  secondary_color: '#111111',
  text_color: '#111111',
};

const teamOther = {
  id: 'team-other',
  name: 'New York Rangers',
  code: 'NYR',
  logo: null,
  primary_color: '#0038a8',
  secondary_color: '#ffffff',
  text_color: '#ffffff',
};

const makeWatchedGame = (id: string, watchedOn: string, homeTeam: any, awayTeam: any) => ({
  id,
  season_id: 'season-1',
  game_type: 'regular',
  status: 'final',
  scheduled_at: watchedOn,
  scheduled_time: '19:00',
  time_start: null,
  time_end: null,
  venue: null,
  home_team: homeTeam,
  away_team: awayTeam,
  home_score: 3,
  away_score: 2,
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
  series_home_wins_at_game: null,
  series_away_wins_at_game: null,
  series_games_to_win: null,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
  watched_by_user: true,
  watched_on: watchedOn,
  skipped_by_user: false,
  scheduled_for: null,
});

describe('UserGamesWatched', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      isLoading: false,
      data: [
        makeWatchedGame('game-1', '2026-02-10', teamHome, teamOther),
        makeWatchedGame('game-2', '2026-03-11', teamHome, teamOther),
        makeWatchedGame('game-3', '2025-12-12', teamAway, teamOther),
      ],
    });
  });

  it('shows favorite teams ordered by watched count and filters by year', () => {
    render(<UserGamesWatched />);

    expect(screen.getByText('Games Watched')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2026' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2025' })).toBeInTheDocument();

    let items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Toronto Maple Leafs')).toBeInTheDocument();
    expect(within(items[0]).getByLabelText('2 watched games')).toBeInTheDocument();
    expect(within(items[1]).getByText('Boston Bruins')).toBeInTheDocument();
    expect(screen.queryByText('New York Rangers')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2025' } });

    items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText('Boston Bruins')).toBeInTheDocument();
    expect(within(items[0]).getByLabelText('1 watched game')).toBeInTheDocument();
    expect(screen.queryByText('Toronto Maple Leafs')).not.toBeInTheDocument();
  });
});
