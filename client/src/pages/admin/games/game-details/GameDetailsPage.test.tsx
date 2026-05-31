/* eslint-disable react/display-name, @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGameDetails } from '@/hooks/useGames';
import useGameGoalieStats from '@/hooks/useGameGoalieStats';
import useShootoutAttempts from '@/hooks/useShootoutAttempts';
import useTabState from '@/hooks/useTabState';
import useGameRoster from '@/hooks/useGameRoster';
import useGameLineup from '@/hooks/useGameLineup';
import GameDetailsPage from './GameDetailsPage';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();
const mockSummaryTab = jest.fn(() => <div>summary</div>);
const mockLineupsTab = jest.fn(() => <div>lineups</div>);
const mockScoreboardCard = jest.fn(() => <div>scoreboard</div>);

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}));
jest.mock('@/hooks/useGames', () => ({ useGameDetails: jest.fn() }));
jest.mock('@/hooks/useGameGoalieStats', () => jest.fn());
jest.mock('@/hooks/useShootoutAttempts', () => jest.fn());
jest.mock('@/hooks/useTabState', () => jest.fn());
jest.mock('@/hooks/useGameRoster', () => jest.fn());
jest.mock('@/hooks/useGameLineup', () => jest.fn());
jest.mock('@/components/Breadcrumbs/Breadcrumbs', () => () => <div>breadcrumbs</div>);
jest.mock('@/components/Button/Button', () => ({ children, onClick, type = 'button' }: any) => <button type={type} onClick={onClick}>{children}</button>);
jest.mock('@/components/Tabs/Tabs', () => ({ tabs }: any) => <div>{tabs.map((tab: any) => <div key={tab.label}>{tab.content}</div>)}</div>);
jest.mock('@/components/TitleRow/TitleRow', () => ({ left, right }: any) => <div>{left}{right}</div>);
jest.mock('./ScoreboardCard', () => (props: any) => mockScoreboardCard(props));
jest.mock('./summary/GameSummaryTab', () => (props: any) => mockSummaryTab(props));
jest.mock('./lineups/GameLineupsTab', () => (props: any) => mockLineupsTab(props));

const mockUseGameDetails = useGameDetails as jest.Mock;
const mockUseGameGoalieStats = useGameGoalieStats as jest.Mock;
const mockUseShootoutAttempts = useShootoutAttempts as jest.Mock;
const mockUseTabState = useTabState as jest.Mock;
const mockUseGameRoster = useGameRoster as jest.Mock;
const mockUseGameLineup = useGameLineup as jest.Mock;

const game = {
  id: 'game-1', season_id: 'season-1', league_name: 'NHL', season_name: '2024-25', game_type: 'regular', status: 'final',
  scheduled_at: '2024-10-10T19:00:00Z', scheduled_time: '19:00', venue: null, time_start: null, time_end: null,
  home_team: { id: 'team-1', name: 'Home', code: 'HOM', logo: null, primary_color: '#111', secondary_color: '#222', text_color: '#fff' },
  away_team: { id: 'team-2', name: 'Away', code: 'AWY', logo: null, primary_color: '#333', secondary_color: '#444', text_color: '#fff' },
  overtime_periods: null, shootout: false, shootout_first_team_id: null, playoff_series_id: null, game_number_in_series: null,
  game_number: null, playoff_round: null, series_home_team_id: null, series_away_team_id: null, series_home_wins: null,
  series_away_wins: null, series_games_to_win: null, notes: null, created_at: '2024-09-01T00:00:00Z', current_period: '3',
  period_scores: [{ period: '1', away_goals: 1, home_goals: 2 }], period_shots: [], star_1_id: null, star_2_id: null, star_3_id: null,
  best_of_shootout: 3,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTabState.mockReturnValue([0, jest.fn()]);
  mockUseGameDetails.mockReturnValue({
    game,
    loading: false,
    busy: null,
    startGame: jest.fn(), updateStatus: jest.fn(), advancePeriod: jest.fn(), advanceOTPeriod: jest.fn(),
    revertOTPeriod: jest.fn(), endGame: jest.fn(), updateStars: jest.fn(), updateGameInfo: jest.fn(),
    updatePeriodShots: jest.fn(), revertToEditMode: jest.fn(), deleteGame: jest.fn(),
  });
  mockUseGameGoalieStats.mockReturnValue({ goalieStats: [], upsertGoalieStat: jest.fn(), switchGoalie: jest.fn(), removeGoalieStat: jest.fn(), updateGoalieStint: jest.fn(), removeGoalieStint: jest.fn() });
  mockUseShootoutAttempts.mockReturnValue({ attempts: [] });
  mockUseGameRoster.mockReturnValue({ roster: [], addToRoster: jest.fn(), removeFromRoster: jest.fn() });
  mockUseGameLineup.mockReturnValue({ lineup: [], saveTeamLineup: jest.fn() });
});

describe('GameDetailsPage', () => {
  it('uses read-only user mode settings for the user route', async () => {
    const user = userEvent.setup();
    mockUseParams.mockReturnValue({ id: 'game-1' });
    render(<GameDetailsPage mode="user" />);

    expect(mockScoreboardCard.mock.calls[0][0].leagueId).toBeUndefined();
    expect(mockSummaryTab.mock.calls[0][0].editable).toBe(false);
    expect(mockSummaryTab.mock.calls[0][0].gameHrefBuilder('game-2')).toBe('/games/game-2');
    expect(mockSummaryTab.mock.calls[0][0].playerHrefBuilder).toBeUndefined();
    expect(mockLineupsTab.mock.calls[0][0].readOnly).toBe(true);

    await user.click(screen.getByRole('button'));
    expect(mockNavigate).toHaveBeenCalledWith('/games');
  });

  it('keeps admin navigation and editable props in admin mode', () => {
    mockUseParams.mockReturnValue({ leagueId: 'league-1', seasonId: 'season-1', id: 'game-1' });
    render(<GameDetailsPage />);

    expect(mockScoreboardCard.mock.calls[0][0].leagueId).toBe('league-1');
    expect(mockSummaryTab.mock.calls[0][0].editable).toBe(true);
    expect(mockSummaryTab.mock.calls[0][0].gameHrefBuilder('game-2')).toBe(
      '/admin/leagues/league-1/seasons/season-1/games/game-2',
    );
    expect(mockSummaryTab.mock.calls[0][0].playerHrefBuilder('team-9', 'player-9')).toBe(
      '/admin/leagues/league-1/teams/team-9/players/player-9',
    );
    expect(mockLineupsTab.mock.calls[0][0].readOnly).toBe(false);
  });

  it('does not enable goalie stats or shootout fetches before a non-shootout game starts', () => {
    mockUseParams.mockReturnValue({ leagueId: 'league-1', seasonId: 'season-1', id: 'game-1' });
    mockUseGameDetails.mockReturnValue({
      game: { ...game, status: 'scheduled', shootout: false },
      loading: false,
      busy: null,
      startGame: jest.fn(), updateStatus: jest.fn(), advancePeriod: jest.fn(), advanceOTPeriod: jest.fn(),
      revertOTPeriod: jest.fn(), endGame: jest.fn(), updateStars: jest.fn(), updateGameInfo: jest.fn(),
      updatePeriodShots: jest.fn(), revertToEditMode: jest.fn(), deleteGame: jest.fn(),
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
      busy: null,
      startGame: jest.fn(), updateStatus: jest.fn(), advancePeriod: jest.fn(), advanceOTPeriod: jest.fn(),
      revertOTPeriod: jest.fn(), endGame: jest.fn(), updateStars: jest.fn(), updateGameInfo: jest.fn(),
      updatePeriodShots: jest.fn(), revertToEditMode: jest.fn(), deleteGame: jest.fn(),
    });

    render(<GameDetailsPage />);

    expect(mockUseGameGoalieStats).toHaveBeenCalledWith('game-1', { enabled: true });
    expect(mockUseShootoutAttempts).toHaveBeenCalledWith('game-1', { enabled: true });
  });
});
