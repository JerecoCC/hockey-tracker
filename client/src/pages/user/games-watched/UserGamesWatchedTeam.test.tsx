import { useMemo, useState, type ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BreadcrumbTitleRow from '@/components/Breadcrumbs/BreadcrumbTitleRow';
import BreadcrumbContext, { type BreadcrumbConfig } from '@/context/BreadcrumbContext';
import useTeams from '@/hooks/useTeams';
import UserGamesWatchedTeam from './UserGamesWatchedTeam';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('axios');
jest.mock('@/hooks/useTeams');
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
jest.mock('@/components/TeamLogo/TeamLogo', () => ({ code, alt }: any) => (
  <span aria-label={alt}>{code}</span>
));

const mockUseQuery = useQuery as jest.Mock;
const mockAxios = axios as jest.Mocked<typeof axios>;
const mockUseTeams = useTeams as jest.Mock;

const teamHome = {
  id: 'team-home',
  name: 'Toronto Maple Leafs',
  place_name: 'Toronto',
  code: 'TOR',
  logo: null,
  logo_dark: null,
  logo_light: null,
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
  logo_dark: null,
  logo_light: null,
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
  logo_dark: null,
  logo_light: null,
  primary_color: '#0038a8',
  secondary_color: '#ffffff',
  text_color: '#ffffff',
};

const teamNoWatched = {
  id: 'team-no-watched',
  name: 'Columbus Blue Jackets',
  place_name: 'Columbus',
  team_name: 'Blue Jackets',
  code: 'CBJ',
  logo: null,
  logo_dark: null,
  logo_light: null,
  primary_color: '#002654',
  secondary_color: '#ce1126',
  text_color: '#ffffff',
};

const makeWatchedGame = (
  id: string,
  scheduledAt: string,
  homeTeam: any,
  awayTeam: any,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  season_id: 'season-1',
  game_type: 'regular',
  status: 'final',
  scheduled_at: scheduledAt,
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
  watched_on: scheduledAt.slice(0, 10),
  skipped_by_user: false,
  scheduled_for: null,
  ...overrides,
});

const BreadcrumbHarness = ({ children }: { children: ReactNode }) => {
  const [config, setBreadcrumbs] = useState<BreadcrumbConfig | null>(null);
  const value = useMemo(() => ({ config, setBreadcrumbs }), [config]);

  return (
    <BreadcrumbContext.Provider value={value}>
      <BreadcrumbTitleRow />
      {children}
    </BreadcrumbContext.Provider>
  );
};

const renderTeamPage = (initialEntry = '/dashboard/games-watched/tor-maple-leafs') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <BreadcrumbHarness>
        <Routes>
          <Route
            path="/dashboard/games-watched/:teamSlug"
            element={<UserGamesWatchedTeam />}
          />
        </Routes>
      </BreadcrumbHarness>
    </MemoryRouter>,
  );

describe('UserGamesWatchedTeam', () => {
  beforeEach(() => {
    mockAxios.get.mockReset();
    mockUseTeams.mockReturnValue({
      loading: false,
      teams: [teamHome, teamAway, teamOther, teamNoWatched],
    });
    mockUseQuery.mockReturnValue({
      isLoading: false,
      data: [
        makeWatchedGame('game-old', '2026-02-10T00:00:00Z', teamHome, teamOther),
        makeWatchedGame('game-other', '2026-03-01T00:00:00Z', teamAway, teamOther),
        makeWatchedGame('game-new', '2026-04-20T00:00:00Z', teamHome, teamAway, {
          game_type: 'playoff',
          playoff_round: 1,
          game_number_in_series: 2,
          home_score: 4,
          away_score: 2,
          scheduled_for: '2026-04-25',
          venue: 'Scotiabank Arena',
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

    renderTeamPage();
    expect(screen.getByLabelText('Loading watched games')).toBeInTheDocument();
    expect(screen.queryByText('Loading watched games...')).not.toBeInTheDocument();
    await mockUseQuery.mock.calls[0][0].queryFn();

    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/user/games'),
      expect.objectContaining({
        params: { watched: true, all_teams: true },
      }),
    );
  });

  it('shows the selected team hero and watched games newest first', () => {
    renderTeamPage();

    expect(screen.getByRole('heading', { name: 'Toronto Maple Leafs' })).toBeInTheDocument();
    expect(screen.getByLabelText('Toronto Maple Leafs watched games summary')).toBeInTheDocument();
    expect(screen.getByTestId('team-hero-left-strip')).toBeInTheDocument();
    expect(screen.getByTestId('team-hero-right-strip')).toBeInTheDocument();
    expect(screen.getByTestId('team-hero-primary-fill')).toBeInTheDocument();
    expect(screen.getByTestId('team-hero-right-primary-fill')).toBeInTheDocument();
    expect(screen.getByLabelText('Toronto Maple Leafs watched games summary')).toHaveTextContent(
      '2x',
    );
    expect(screen.getByLabelText('Toronto Maple Leafs watched games summary')).toHaveTextContent(
      '2-0-0',
    );
    expect(screen.queryByText('W-L-OTL')).not.toBeInTheDocument();
    expect(screen.queryByText('Seen')).not.toBeInTheDocument();
    expect(screen.getByLabelText('2 watched games shown')).toBeInTheDocument();
    expect(screen.getByLabelText('2 watched games shown')).toHaveTextContent('2');
    expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2026' })).toBeInTheDocument();

    const gameRows = screen.getAllByRole('listitem');
    expect(gameRows).toHaveLength(2);
    expect(within(gameRows[0]).getByText('Watched on Apr 25, 2026')).toBeInTheDocument();
    expect(within(gameRows[0]).getByText('Scotiabank Arena')).toBeInTheDocument();
    expect(gameRows[0].textContent?.indexOf('Watched on Apr 25, 2026')).toBeLessThan(
      gameRows[0].textContent?.indexOf('Scotiabank Arena') ?? 0,
    );
    expect(within(gameRows[0]).getByText('Apr 20, 2026 • 7:00 PM')).toBeInTheDocument();
    expect(within(gameRows[0]).getByText('Round 1 · Game 2')).toBeInTheDocument();
    expect(within(gameRows[1]).getByText('Feb 10, 2026 • 7:00 PM')).toBeInTheDocument();
  });

  it('keeps the team layout for valid teams with no watched games', () => {
    renderTeamPage('/dashboard/games-watched/cbj-blue-jackets');

    expect(screen.getByRole('heading', { name: 'Blue Jackets' })).toBeInTheDocument();
    expect(screen.getByLabelText('Blue Jackets watched games summary')).toBeInTheDocument();
    expect(screen.getByLabelText('Blue Jackets watched games summary')).toHaveTextContent('0x');
    expect(screen.getByLabelText('Blue Jackets watched games summary')).toHaveTextContent(
      '0-0-0',
    );
    expect(screen.getByLabelText('0 watched games shown')).toBeInTheDocument();
    expect(screen.getByLabelText('0 watched games shown')).toHaveTextContent('0');
    expect(screen.getByText('No watched games.')).toBeInTheDocument();
    expect(screen.queryByText('Watched team not found.')).not.toBeInTheDocument();
  });

  it('filters team games by scheduled game year while showing scheduled watch dates', () => {
    mockUseQuery.mockReturnValue({
      isLoading: false,
      data: [
        makeWatchedGame('played-in-2026', '2026-01-02T00:00:00Z', teamHome, teamOther, {
          scheduled_for: '2026-01-08',
        }),
        makeWatchedGame('played-in-2025', '2025-12-31', teamHome, teamAway, {
          scheduled_time: null,
          scheduled_for: '2026-01-05',
        }),
        makeWatchedGame('other-team-2025', '2025-12-20T00:00:00Z', teamAway, teamOther),
      ],
    });

    renderTeamPage();

    expect(screen.getByRole('option', { name: '2026' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2025' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2025' } });

    expect(screen.getByLabelText('1 watched game shown')).toBeInTheDocument();
    expect(screen.getByLabelText('1 watched game shown')).toHaveTextContent('1');
    expect(screen.getByLabelText('Toronto Maple Leafs watched games summary')).toHaveTextContent(
      '2x',
    );
    const gameRows = screen.getAllByRole('listitem');
    expect(gameRows).toHaveLength(1);
    expect(within(gameRows[0]).getByText('Dec 31, 2025')).toBeInTheDocument();
    expect(within(gameRows[0]).getByText('Watched on Jan 5, 2026')).toBeInTheDocument();
    expect(screen.queryByText('Jan 2, 2026 â€¢ 7:00 PM')).not.toBeInTheDocument();
  });

  it('shows dashboard breadcrumbs back through games watched', () => {
    renderTeamPage();

    expect(screen.getByRole('button', { name: 'Back to Games Watched' })).toBeInTheDocument();
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(breadcrumb).getByRole('button', { name: 'Games Watched' })).toBeInTheDocument();
    expect(within(breadcrumb).getByText('Toronto Maple Leafs')).toBeInTheDocument();
  });
});
