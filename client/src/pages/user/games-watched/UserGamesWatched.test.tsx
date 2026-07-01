import { useMemo, useState, type ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { MemoryRouter, useLocation } from 'react-router-dom';
import BreadcrumbTitleRow from '@/components/Breadcrumbs/BreadcrumbTitleRow';
import BreadcrumbContext, { type BreadcrumbConfig } from '@/context/BreadcrumbContext';
import UserGamesWatched from './UserGamesWatched';
import styles from './UserGamesWatched.module.scss';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('axios');
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
const mockAxios = axios as jest.Mocked<typeof axios>;

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
};

const BreadcrumbHarness = ({ children }: { children: ReactNode }) => {
  const [config, setBreadcrumbs] = useState<BreadcrumbConfig | null>(null);
  const value = useMemo(() => ({ config, setBreadcrumbs }), [config]);

  return (
    <MemoryRouter initialEntries={['/dashboard/games-watched']}>
      <BreadcrumbContext.Provider value={value}>
        <BreadcrumbTitleRow />
        <LocationProbe />
        {children}
      </BreadcrumbContext.Provider>
    </MemoryRouter>
  );
};

const renderWatchedPage = () =>
  render(
    <BreadcrumbHarness>
      <UserGamesWatched />
    </BreadcrumbHarness>,
  );

const teamHome = {
  id: 'team-home',
  name: 'Toronto Maple Leafs',
  place_name: 'Toronto',
  code: 'TOR',
  logo: null,
  primary_color: '#003e7e',
  secondary_color: '#ffffff',
  text_color: '#ffffff',
};

const teamAway = {
  id: 'team-away',
  name: 'Boston Bruins',
  place_name: 'Boston',
  code: 'BOS',
  logo: null,
  primary_color: '#ffb81c',
  secondary_color: '#111111',
  text_color: '#111111',
};

const teamOther = {
  id: 'team-other',
  name: 'New York Rangers',
  place_name: 'New York',
  code: 'NYR',
  logo: null,
  primary_color: '#0038a8',
  secondary_color: '#ffffff',
  text_color: '#ffffff',
};

const makeWatchedGame = (
  id: string,
  watchedOn: string,
  homeTeam: any,
  awayTeam: any,
  overrides: Record<string, unknown> = {},
) => ({
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
  ...overrides,
});

describe('UserGamesWatched', () => {
  beforeEach(() => {
    mockAxios.get.mockReset();
    mockUseQuery.mockReturnValue({
      isLoading: false,
      data: [
        makeWatchedGame('game-1', '2026-02-10', teamHome, teamOther),
        makeWatchedGame('game-2', '2026-03-11', teamOther, teamHome, {
          home_score: 2,
          away_score: 3,
          overtime_periods: 1,
        }),
        makeWatchedGame('game-3', '2025-12-12', teamAway, teamOther),
        makeWatchedGame('game-4', '2026-04-20', teamHome, teamAway, {
          game_type: 'playoff',
          home_score: 4,
          away_score: 2,
        }),
      ],
    });
  });

  it('requests watched games across all teams', async () => {
    mockUseQuery.mockReturnValueOnce({
      isLoading: true,
      data: [],
    });
    mockAxios.get.mockResolvedValueOnce({ data: [] });

    renderWatchedPage();
    await mockUseQuery.mock.calls[0][0].queryFn();

    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/user/games'),
      expect.objectContaining({
        params: { watched: true, all_teams: true },
      }),
    );
  });

  it('shows every watched team with a positive count and filters by year', () => {
    renderWatchedPage();

    expect(screen.getByRole('heading', { name: 'Games Watched' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2026' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2025' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Team' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Seen' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Your Record/ })).toBeInTheDocument();
    expect(screen.getByLabelText('How your watched record is calculated')).toBeInTheDocument();

    let rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('New York Rangers')).toBeInTheDocument();
    expect(within(rows[0]).getByLabelText('3 watched games')).toBeInTheDocument();
    expect(within(rows[0]).getByLabelText('3 watched games').closest('td')).toHaveStyle({
      textAlign: 'center',
    });
    expect(within(rows[0]).getByText('0-2-1')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Toronto Maple Leafs')).toBeInTheDocument();
    expect(within(rows[1]).getByLabelText('3 watched games')).toBeInTheDocument();
    expect(within(rows[1]).getByText('3-0-0')).toBeInTheDocument();
    const torontoTeamText = rows[1].querySelector(`.${styles.teamText}`);
    expect(torontoTeamText?.children[0]).toHaveClass(styles.teamPlace);
    expect(torontoTeamText?.children[1]).toHaveClass(styles.teamName);
    expect(within(rows[2]).getByText('Boston Bruins')).toBeInTheDocument();
    expect(within(rows[2]).getByLabelText('2 watched games')).toBeInTheDocument();
    expect(within(rows[2]).getByText('1-1-0')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2025' } });

    rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Boston Bruins')).toBeInTheDocument();
    expect(within(rows[0]).getByLabelText('1 watched game')).toBeInTheDocument();
    expect(within(rows[0]).getByText('1-0-0')).toBeInTheDocument();
    expect(within(rows[1]).getByText('New York Rangers')).toBeInTheDocument();
    expect(within(rows[1]).getByLabelText('1 watched game')).toBeInTheDocument();
    expect(within(rows[1]).getByText('0-1-0')).toBeInTheDocument();
    expect(screen.queryByText('Toronto Maple Leafs')).not.toBeInTheDocument();
  });

  it('opens a team watched-games page from a team row', () => {
    renderWatchedPage();

    const rows = screen.getAllByRole('row').slice(1);
    fireEvent.click(rows[1]);

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/dashboard/games-watched/tor-maple-leafs',
    );
  });

  it('shows a dashboard breadcrumb trail and back button', () => {
    renderWatchedPage();

    expect(screen.getByRole('button', { name: 'Back to Dashboard' })).toBeInTheDocument();

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(breadcrumb).getByText('Games Watched')).toBeInTheDocument();
  });
});
