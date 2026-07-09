/* eslint-disable react/display-name, @typescript-eslint/no-explicit-any */
import { act, render, screen } from '@testing-library/react';
import { useGameDetails, useGameRouteLookup } from '@/hooks/useGames';
import useLeagueDetails from '@/hooks/useLeagueDetails';
import useLeagues from '@/hooks/useLeagues';
import useGameGoalieStats from '@/hooks/useGameGoalieStats';
import useShootoutAttempts from '@/hooks/useShootoutAttempts';
import useTabState from '@/hooks/useTabState';
import useGameRoster from '@/hooks/useGameRoster';
import useGameLineup from '@/hooks/useGameLineup';
import GameDetailsPage from './GameDetailsPage';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();
const mockUsePageBreadcrumbs = jest.fn();
const mockSummaryTab = jest.fn(() => <div>summary</div>);
const mockLineupsTab = jest.fn(() => <div>lineups</div>);
const mockScoreboardCard = jest.fn(() => <div>scoreboard</div>);
const mockTabs = jest.fn(({ tabs }: any) => (
  <div>
    {tabs.map((tab: any) => (
      <div key={tab.label}>{tab.content}</div>
    ))}
  </div>
));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}));
jest.mock('@/hooks/useGames', () => ({
  __esModule: true,
  useGameDetails: jest.fn(),
  useGameRouteLookup: jest.fn(),
}));
jest.mock('@/hooks/useLeagueDetails', () => jest.fn());
jest.mock('@/hooks/useLeagues', () => jest.fn());
jest.mock('@/hooks/useGameGoalieStats', () => jest.fn());
jest.mock('@/hooks/useShootoutAttempts', () => jest.fn());
jest.mock('@/hooks/useTabState', () => jest.fn());
jest.mock('@/hooks/useGameRoster', () => jest.fn());
jest.mock('@/hooks/useGameLineup', () => jest.fn());
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'admin' } }),
}));
jest.mock('@/context/BreadcrumbContext', () => ({
  usePageBreadcrumbs: (...args: any[]) => mockUsePageBreadcrumbs(...args),
}));
jest.mock('@jerecocc/tracker-ui/components/Breadcrumbs/Breadcrumbs', () => () => <div>breadcrumbs</div>);
jest.mock('@jerecocc/tracker-ui/components/Button/Button', () => ({ children, onClick, type = 'button' }: any) => (
  <button
    type={type}
    onClick={onClick}
  >
    {children}
  </button>
));
jest.mock('@jerecocc/tracker-ui/components/Tabs/Tabs', () => (props: any) => mockTabs(props));
jest.mock('@jerecocc/tracker-ui/components/TitleRow/TitleRow', () => ({ left, right }: any) => (
  <div>
    {left}
    {right}
  </div>
));
jest.mock('./ScoreboardCard', () => (props: any) => mockScoreboardCard(props));
jest.mock('./summary/GameSummaryTab', () => (props: any) => mockSummaryTab(props));
jest.mock('./lineups/GameLineupsTab', () => (props: any) => mockLineupsTab(props));

const mockUseGameDetails = useGameDetails as jest.Mock;
const mockUseGameRouteLookup = useGameRouteLookup as jest.Mock;
const mockUseLeagueDetails = useLeagueDetails as jest.Mock;
const mockUseLeagues = useLeagues as jest.Mock;
const mockUseGameGoalieStats = useGameGoalieStats as jest.Mock;
const mockUseShootoutAttempts = useShootoutAttempts as jest.Mock;
const mockUseTabState = useTabState as jest.Mock;
const mockUseGameRoster = useGameRoster as jest.Mock;
const mockUseGameLineup = useGameLineup as jest.Mock;

const game = {
  id: 'game-1',
  season_id: 'season-1',
  league_code: 'NHL',
  league_name: 'NHL',
  season_name: '2024-25',
  game_type: 'regular',
  status: 'final',
  scheduled_at: '2024-10-10T19:00:00Z',
  scheduled_time: '19:00',
  venue: null,
  time_start: null,
  time_end: null,
  home_team: {
    id: 'team-1',
    name: 'Home',
    code: 'HOM',
    logo: null,
    primary_color: '#111',
    secondary_color: '#222',
    text_color: '#fff',
  },
  away_team: {
    id: 'team-2',
    name: 'Away',
    code: 'AWY',
    logo: null,
    primary_color: '#333',
    secondary_color: '#444',
    text_color: '#fff',
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
  created_at: '2024-09-01T00:00:00Z',
  current_period: '3',
  period_scores: [{ period: '1', away_goals: 1, home_goals: 2 }],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
};

beforeEach(() => {
  jest.clearAllMocks();
  document.title = 'Hockey Tracker';
  mockUseTabState.mockReturnValue([0, jest.fn()]);
  mockUseGameDetails.mockReturnValue({
    game,
    loading: false,
    notFound: false,
    failed: false,
    busy: null,
    startGame: jest.fn(),
    updateStatus: jest.fn(),
    advancePeriod: jest.fn(),
    advanceOTPeriod: jest.fn(),
    revertOTPeriod: jest.fn(),
    endGame: jest.fn(),
    updateStars: jest.fn(),
    updateGameInfo: jest.fn(),
    updatePeriodShots: jest.fn(),
    revertToEditMode: jest.fn(),
    deleteGame: jest.fn(),
  });
  mockUseGameRouteLookup.mockReturnValue({
    gameId: null,
    loading: false,
    notFound: false,
    failed: false,
  });
  mockUseLeagueDetails.mockReturnValue({ seasons: [], loading: false });
  mockUseLeagues.mockReturnValue({ leagues: [], loading: false });
  mockUseGameGoalieStats.mockReturnValue({
    goalieStats: [],
    upsertGoalieStat: jest.fn(),
    switchGoalie: jest.fn(),
    removeGoalieStat: jest.fn(),
    updateGoalieStint: jest.fn(),
    removeGoalieStint: jest.fn(),
  });
  mockUseShootoutAttempts.mockReturnValue({ attempts: [] });
  mockUseGameRoster.mockReturnValue({
    roster: [],
    addToRoster: jest.fn(),
    removeFromRoster: jest.fn(),
  });
  mockUseGameLineup.mockReturnValue({ lineup: [], saveTeamLineup: jest.fn() });
});

const waitForGameTabs = async () => {
  await screen.findByText('summary');
  await screen.findByText('lineups');
};

describe('GameDetailsPage', () => {
  it('uses read-only user mode settings for the user route', async () => {
    mockUseParams.mockReturnValue({ id: 'game-1' });
    render(<GameDetailsPage mode="user" />);
    await waitForGameTabs();

    expect(mockScoreboardCard.mock.calls[0][0].leagueId).toBeFalsy();
    expect(mockScoreboardCard.mock.calls[0][0].isEditMode).toBe(false);
    expect(mockSummaryTab.mock.calls[0][0].editable).toBe(false);
    expect(mockSummaryTab.mock.calls[0][0].isEditMode).toBe(false);
    expect(mockSummaryTab.mock.calls[0][0].showPlayerDataStatus).toBe(false);
    expect(mockSummaryTab.mock.calls[0][0].gameHrefBuilder('game-2')).toBe('/games/game-2');
    expect(
      mockSummaryTab.mock.calls[0][0].playerHrefBuilder('team-1', 'player-9', 'John', 'Smith'),
    ).toBe('/leagues/nhl/teams/hom/players/john-smith');
    expect(
      mockLineupsTab.mock.calls[0][0].playerHrefBuilder('team-1', 'player-9', 'John', 'Smith'),
    ).toBe('/leagues/nhl/teams/hom/players/john-smith');
    expect(mockLineupsTab.mock.calls[0][0].readOnly).toBe(true);
    expect(mockLineupsTab.mock.calls[0][0].isEditMode).toBe(false);
    expect(mockLineupsTab.mock.calls[0][0].showPlayerDataStatus).toBe(false);
    expect(mockUsePageBreadcrumbs.mock.calls[0][0].backPath).toBe('/games');
    expect(mockUsePageBreadcrumbs.mock.calls[0][0].items).toEqual([
      { label: 'Games', path: '/games' },
      { label: 'NHL' },
      { label: '2024-25' },
      { label: 'Oct 10, 2024' },
      { label: 'AWY @ HOM' },
    ]);
    expect(mockUseGameDetails).toHaveBeenCalledWith('game-1', { mode: 'user' });
  });

  it('keeps admin navigation and editable props in admin mode', async () => {
    mockUseParams.mockReturnValue({ leagueId: 'league-1', seasonId: 'season-1', id: 'game-1' });
    render(<GameDetailsPage />);
    await waitForGameTabs();

    expect(mockScoreboardCard.mock.calls[0][0].leagueId).toBe('league-1');
    expect(mockScoreboardCard.mock.calls[0][0].isEditMode).toBe(true);
    expect(mockSummaryTab.mock.calls[0][0].editable).toBe(true);
    expect(mockSummaryTab.mock.calls[0][0].isEditMode).toBe(true);
    expect(mockSummaryTab.mock.calls[0][0].showPlayerDataStatus).toBe(true);
    expect(mockSummaryTab.mock.calls[0][0].gameHrefBuilder('game-2')).toBe(
      '/admin/leagues/nhl/seasons/2024-25/games/game-2',
    );
    expect(
      mockSummaryTab.mock.calls[0][0].playerHrefBuilder('team-1', 'player-9', 'John', 'Smith'),
    ).toBe('/admin/leagues/nhl/teams/hom/players/john-smith');
    expect(mockLineupsTab.mock.calls[0][0].readOnly).toBe(false);
    expect(mockLineupsTab.mock.calls[0][0].isEditMode).toBe(true);
    expect(mockLineupsTab.mock.calls[0][0].showPlayerDataStatus).toBe(true);
    expect(mockUsePageBreadcrumbs.mock.calls[0][0].items).toEqual([
      { label: 'NHL', path: '/admin/leagues/nhl' },
      { label: '2024-25', path: '/admin/leagues/nhl/seasons/2024-25' },
      { label: 'Oct 10, 2024', path: '/admin/leagues/nhl/seasons/2024-25/games/10-10-2024' },
      { label: 'AWY @ HOM' },
    ]);
  });

  it('keeps game details visible and locked while NHL auto-fill progress is toasted', async () => {
    mockUseParams.mockReturnValue({ leagueId: 'league-1', seasonId: 'season-1', id: 'game-1' });
    render(<GameDetailsPage />);
    await waitForGameTabs();

    act(() => {
      mockSummaryTab.mock.calls[0][0].onGameAutofillChange({
        step: 'goals',
        message: 'Added goal 1 of 3.',
        completed: 1,
        total: 3,
        refresh: true,
      });
    });

    expect(screen.queryByRole('status', { name: /added goal 1 of 3/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/auto-fill progress/i)).not.toBeInTheDocument();
    expect(screen.getByText('scoreboard')).toBeVisible();
    expect(screen.getByText('summary')).toBeVisible();
    expect(screen.getByText('lineups')).toBeVisible();
    expect(
      mockScoreboardCard.mock.calls[mockScoreboardCard.mock.calls.length - 1]?.[0].disabled,
    ).toBe(true);
    expect(mockSummaryTab.mock.calls[mockSummaryTab.mock.calls.length - 1]?.[0].editable).toBe(
      true,
    );
    expect(mockLineupsTab.mock.calls[mockLineupsTab.mock.calls.length - 1]?.[0].readOnly).toBe(
      false,
    );
    expect(screen.getByText('summary').closest('[data-autofill-locked="true"]')).toBeTruthy();
    expect(screen.getByText('lineups').closest('[data-autofill-locked="true"]')).toBeTruthy();
    expect(mockTabs.mock.calls[mockTabs.mock.calls.length - 1]?.[0].keepMounted).toBe(true);
    expect(mockUsePageBreadcrumbs.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        backLabel: 'Back to 2024-25',
      }),
    );
  });

  it('keeps the game details page locked during the goal scoring process', async () => {
    mockUseParams.mockReturnValue({ leagueId: 'league-1', seasonId: 'season-1', id: 'game-1' });
    render(<GameDetailsPage />);
    await waitForGameTabs();

    act(() => {
      mockSummaryTab.mock.calls[0][0].onGoalScoringChange(true);
    });

    expect(screen.getByText('scoreboard')).toBeVisible();
    expect(screen.getByText('summary')).toBeVisible();
    expect(screen.getByText('lineups')).toBeVisible();
    expect(
      mockScoreboardCard.mock.calls[mockScoreboardCard.mock.calls.length - 1]?.[0].disabled,
    ).toBe(true);
    expect(screen.getByText('lineups').closest('[data-game-details-locked="true"]')).toBeTruthy();
    expect(screen.getByText('summary').closest('[data-game-details-locked="true"]')).toBeFalsy();
    expect(mockTabs.mock.calls[mockTabs.mock.calls.length - 1]?.[0].keepMounted).toBe(true);

    act(() => {
      mockSummaryTab.mock.calls[mockSummaryTab.mock.calls.length - 1][0].onGoalScoringChange(false);
    });

    expect(
      mockScoreboardCard.mock.calls[mockScoreboardCard.mock.calls.length - 1]?.[0].disabled,
    ).toBe(false);
    expect(screen.getByText('lineups').closest('[data-game-details-locked="true"]')).toBeFalsy();
    expect(mockTabs.mock.calls[mockTabs.mock.calls.length - 1]?.[0].keepMounted).toBe(false);
  });

  it('uses nickname-only team names in the document title', () => {
    mockUseParams.mockReturnValue({ id: 'game-1' });
    mockUseGameDetails.mockReturnValue({
      game: {
        ...game,
        home_team: { ...game.home_team, name: 'Toronto Maple Leafs', team_name: 'Maple Leafs' },
        away_team: { ...game.away_team, name: 'Detroit Red Wings', team_name: 'Red Wings' },
      },
      loading: false,
      notFound: false,
      failed: false,
      busy: null,
      startGame: jest.fn(),
      updateStatus: jest.fn(),
      advancePeriod: jest.fn(),
      advanceOTPeriod: jest.fn(),
      revertOTPeriod: jest.fn(),
      endGame: jest.fn(),
      updateStars: jest.fn(),
      updateGameInfo: jest.fn(),
      updatePeriodShots: jest.fn(),
      revertToEditMode: jest.fn(),
      deleteGame: jest.fn(),
    });

    render(<GameDetailsPage />);

    expect(document.title).toBe('Red Wings - Maple Leafs · Oct 10, 2024');
  });

  it('resolves slug game routes without fetching the season games list', () => {
    mockUseParams.mockReturnValue({
      leagueSlug: 'nhl',
      seasonSlug: '2024-25',
      gameDateSlug: '10-10-2024',
      gameSlug: 'awy-vs-hom',
    });
    mockUseLeagues.mockReturnValue({
      leagues: [{ id: 'league-1', code: 'NHL', name: 'National Hockey League' }],
      loading: false,
    });
    mockUseLeagueDetails.mockReturnValue({
      seasons: [{ id: 'season-1', name: '2024-25' }],
      loading: false,
    });
    mockUseGameRouteLookup.mockReturnValue({ gameId: 'game-1', loading: false });

    render(<GameDetailsPage />);

    expect(mockUseGameRouteLookup).toHaveBeenCalledWith({
      seasonId: 'season-1',
      gameDateSlug: '10-10-2024',
      gameSlug: 'awy-vs-hom',
      enabled: true,
      mode: 'admin',
    });
    expect(mockUseGameDetails).toHaveBeenCalledWith('game-1', { mode: 'admin' });
  });

  it('resolves slug game routes through the user API in user mode', () => {
    mockUseParams.mockReturnValue({
      gameDateSlug: '10-10-2024',
      gameSlug: 'awy-vs-hom',
    });
    mockUseGameRouteLookup.mockReturnValue({ gameId: 'game-1', loading: false });

    render(<GameDetailsPage mode="user" />);

    expect(mockUseGameRouteLookup).toHaveBeenCalledWith({
      seasonId: undefined,
      gameDateSlug: '10-10-2024',
      gameSlug: 'awy-vs-hom',
      enabled: true,
      mode: 'user',
    });
    expect(mockUseGameDetails).toHaveBeenCalledWith('game-1', { mode: 'user' });
  });

  it('keeps dated slug routes in the loading state until route lookup resolves', () => {
    mockUseParams.mockReturnValue({
      leagueSlug: 'nhl',
      seasonSlug: '2024-25',
      gameDateSlug: '10-10-2024',
      gameSlug: 'awy-vs-hom',
    });
    mockUseLeagues.mockReturnValue({
      leagues: [{ id: 'league-1', code: 'NHL', name: 'National Hockey League' }],
      loading: false,
    });
    mockUseLeagueDetails.mockReturnValue({
      seasons: [{ id: 'season-1', name: '2024-25' }],
      loading: false,
    });
    mockUseGameRouteLookup.mockReturnValue({
      gameId: null,
      loading: false,
      notFound: false,
      failed: false,
    });

    render(<GameDetailsPage />);

    expect(screen.getByRole('status', { name: /loading game/i })).toBeInTheDocument();
    expect(screen.queryByText('scoreboard')).not.toBeInTheDocument();
    expect(mockUseGameDetails).toHaveBeenCalledWith(undefined, { mode: 'admin' });
  });

  it('does not flash game content before replacing a noncanonical dated route', () => {
    mockUseParams.mockReturnValue({
      leagueSlug: 'nhl',
      seasonSlug: '2024-25',
      gameDateSlug: '10-09-2024',
      gameSlug: 'awy-vs-hom',
    });
    mockUseLeagues.mockReturnValue({
      leagues: [{ id: 'league-1', code: 'NHL', name: 'National Hockey League' }],
      loading: false,
    });
    mockUseLeagueDetails.mockReturnValue({
      seasons: [{ id: 'season-1', name: '2024-25' }],
      loading: false,
    });
    mockUseGameRouteLookup.mockReturnValue({
      gameId: 'game-1',
      loading: false,
      notFound: false,
      failed: false,
    });

    render(<GameDetailsPage />);

    expect(screen.getByRole('status', { name: /loading game/i })).toBeInTheDocument();
    expect(screen.queryByText('scoreboard')).not.toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith(
      '/admin/leagues/nhl/seasons/2024-25/games/10-10-2024/awy-vs-hom',
      { replace: true },
    );
  });

  it('treats no-date admin game routes as direct game id routes', () => {
    mockUseParams.mockReturnValue({
      leagueSlug: 'nhl',
      seasonSlug: '2024-25',
      gameSlug: 'game-1',
    });

    render(<GameDetailsPage />);

    expect(mockUseGameRouteLookup).toHaveBeenCalledWith({
      seasonId: undefined,
      gameDateSlug: undefined,
      gameSlug: 'game-1',
      enabled: false,
      mode: 'admin',
    });
    expect(mockUseGameDetails).toHaveBeenCalledWith('game-1', { mode: 'admin' });
  });

  it('treats dated admin game routes without a matchup slug as direct game id routes', () => {
    mockUseParams.mockReturnValue({
      leagueSlug: 'nhl',
      seasonSlug: '2024-25',
      gameDateSlug: '10-10-2024',
      gameSlug: 'game-1',
    });

    render(<GameDetailsPage />);

    expect(mockUseGameRouteLookup).toHaveBeenCalledWith({
      seasonId: undefined,
      gameDateSlug: '10-10-2024',
      gameSlug: 'game-1',
      enabled: false,
      mode: 'admin',
    });
    expect(mockUseGameDetails).toHaveBeenCalledWith('game-1', { mode: 'admin' });
  });

  it('does not redirect when the game detail request fails without a 404', () => {
    mockUseParams.mockReturnValue({ id: 'game-1' });
    mockUseGameDetails.mockReturnValue({
      game: null,
      loading: false,
      notFound: false,
      failed: true,
      busy: null,
      startGame: jest.fn(),
      updateStatus: jest.fn(),
      advancePeriod: jest.fn(),
      advanceOTPeriod: jest.fn(),
      revertOTPeriod: jest.fn(),
      endGame: jest.fn(),
      updateStars: jest.fn(),
      updateGameInfo: jest.fn(),
      updatePeriodShots: jest.fn(),
      revertToEditMode: jest.fn(),
      deleteGame: jest.fn(),
    });

    const { getByText } = render(<GameDetailsPage mode="user" />);

    expect(getByText('Failed to load game.')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith('/games', { replace: true });
  });

  it('does not enable goalie stats or shootout fetches before a non-shootout game starts', () => {
    mockUseParams.mockReturnValue({ leagueId: 'league-1', seasonId: 'season-1', id: 'game-1' });
    mockUseGameDetails.mockReturnValue({
      game: { ...game, status: 'scheduled', shootout: false },
      loading: false,
      notFound: false,
      failed: false,
      busy: null,
      startGame: jest.fn(),
      updateStatus: jest.fn(),
      advancePeriod: jest.fn(),
      advanceOTPeriod: jest.fn(),
      revertOTPeriod: jest.fn(),
      endGame: jest.fn(),
      updateStars: jest.fn(),
      updateGameInfo: jest.fn(),
      updatePeriodShots: jest.fn(),
      revertToEditMode: jest.fn(),
      deleteGame: jest.fn(),
    });

    render(<GameDetailsPage />);

    expect(mockUseGameGoalieStats).toHaveBeenCalledWith('game-1', { enabled: false });
    expect(mockUseShootoutAttempts).toHaveBeenCalledWith('game-1', { enabled: false });
  });

  it('enables shootout attempts only when the game has shootout data', () => {
    mockUseParams.mockReturnValue({ leagueId: 'league-1', seasonId: 'season-1', id: 'game-1' });
    mockUseGameDetails.mockReturnValue({
      game: { ...game, status: 'final', shootout: true },
      loading: false,
      notFound: false,
      failed: false,
      busy: null,
      startGame: jest.fn(),
      updateStatus: jest.fn(),
      advancePeriod: jest.fn(),
      advanceOTPeriod: jest.fn(),
      revertOTPeriod: jest.fn(),
      endGame: jest.fn(),
      updateStars: jest.fn(),
      updateGameInfo: jest.fn(),
      updatePeriodShots: jest.fn(),
      revertToEditMode: jest.fn(),
      deleteGame: jest.fn(),
    });

    render(<GameDetailsPage />);

    expect(mockUseGameGoalieStats).toHaveBeenCalledWith('game-1', { enabled: true });
    expect(mockUseShootoutAttempts).toHaveBeenCalledWith('game-1', { enabled: true });
  });
});
