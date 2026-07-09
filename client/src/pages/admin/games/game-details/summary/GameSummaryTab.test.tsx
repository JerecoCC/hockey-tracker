/* eslint-disable react/display-name, @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GameSummaryTab from './GameSummaryTab';

const mockUseNavigate = jest.fn();
const mockAddGoal = jest.fn();
const mockUpdateGoal = jest.fn();
const mockDeleteGoal = jest.fn();
const mockAddAttempt = jest.fn();
const mockUpdateAttempt = jest.fn();
const mockDeleteAttempt = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockUseNavigate,
}));
jest.mock('@/hooks/useGameGoals', () => ({
  __esModule: true,
  default: () => ({
    goals: [],
    addGoal: mockAddGoal,
    updateGoal: mockUpdateGoal,
    deleteGoal: mockDeleteGoal,
  }),
}));
jest.mock('@/hooks/useShootoutAttempts', () => ({
  __esModule: true,
  default: () => ({
    attempts: [],
    addAttempt: mockAddAttempt,
    updateAttempt: mockUpdateAttempt,
    deleteAttempt: mockDeleteAttempt,
  }),
}));
jest.mock('@jerecocc/tracker-ui/components/Button/Button', () => ({ children, onClick, type = 'button' }: any) => (
  <button
    type={type}
    onClick={onClick}
  >
    {children}
  </button>
));
jest.mock('@jerecocc/tracker-ui/components/Section/Section', () => ({ title, action, children }: any) => (
  <section>
    <h2>{title}</h2>
    {action}
    {children}
  </section>
));
jest.mock('@jerecocc/tracker-ui/components/TeamLogo/TeamLogo', () => () => <span data-testid="team-logo" />);
jest.mock('../ScoringCard', () => ({ onScoreGoal }: any) => (
  <button
    type="button"
    onClick={() => onScoreGoal?.(1)}
  >
    Score goal
  </button>
));
jest.mock('./GoalieStatsCard', () => () => <div>goalie stats</div>);
jest.mock('./ThreeStarsCard', () => () => <div>three stars</div>);
jest.mock('./SeasonSeriesCard', () => () => <div>season series</div>);
jest.mock('./GameInfoCard', () => () => <div>game info</div>);
jest.mock('./LastFiveCard', () => () => <div>last five</div>);
jest.mock('./LinescoreCard', () => () => <div>linescore</div>);
jest.mock('./GoalieSwitchReportCard', () => () => <div>goalie switch report</div>);
jest.mock('../ScoreGoalModal', () => ({ onClose }: any) => (
  <div
    role="dialog"
    aria-label="Score goal"
  >
    <button
      type="button"
      onClick={onClose}
    >
      Cancel
    </button>
  </div>
));
jest.mock('../ShootoutAttemptModal', () => () => <div />);
jest.mock('../StartGameModal', () => () => <div />);
jest.mock('../NhlGameAutofillModal', () => () => <div />);
jest.mock('../PwhlGameAutofillModal', () => () => <div />);
jest.mock('../ThreeStarsModal', () => () => <div />);
jest.mock('../RecordShotsModal', () => () => <div />);
jest.mock('../ShotsEditModal', () => () => <div />);
jest.mock('../ScoreImageModal', () => () => <div />);
jest.mock('../GameAutofillManualMoveReportModal', () => () => <div />);
jest.mock('@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal', () => () => <div />);

const game = {
  id: 'game-1',
  league_id: 'league-1',
  league_code: 'NHL',
  season_id: 'season-1',
  season_name: '2024-25',
  game_type: 'regular',
  status: 'in_progress',
  current_period: '1',
  overtime_periods: null,
  shootout: false,
  shootout_first_team_id: null,
  best_of_shootout: 3,
  away_score: 0,
  home_score: 0,
  scheduled_at: '2024-10-10T19:00:00Z',
  scheduled_time: '19:00',
  away_team: {
    id: 'away',
    name: 'Away',
    code: 'AWY',
    logo: null,
    logo_dark: null,
    logo_light: null,
    primary_color: '#111',
    text_color: '#fff',
  },
  home_team: {
    id: 'home',
    name: 'Home',
    code: 'HOM',
    logo: null,
    logo_dark: null,
    logo_light: null,
    primary_color: '#222',
    text_color: '#fff',
  },
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
};

const baseProps = {
  game: game as any,
  isFinal: false,
  isInProgress: true,
  isEditMode: true,
  editable: true,
  busy: null,
  leagueId: 'league-1',
  seasonId: 'season-1',
  liveAwayScore: 0,
  liveHomeScore: 0,
  overtimeSuffix: '',
  gameHrefBuilder: (gameId: string) => `/games/${gameId}`,
  linescorePeriods: [{ id: '1', label: '1st', shortLabel: '1st' }],
  goalieStats: [],
  awayRoster: [],
  homeRoster: [],
  roster: [],
  lineup: [],
  rosterReady: true,
  startingGoaliesReady: true,
  upsertGoalieStat: jest.fn(),
  switchGoalie: jest.fn(),
  removeGoalieStat: jest.fn(),
  updateGoalieStint: jest.fn(),
  removeGoalieStint: jest.fn(),
  startGame: jest.fn(),
  updateStatus: jest.fn(),
  advancePeriod: jest.fn(),
  advanceOTPeriod: jest.fn(),
  revertOTPeriod: jest.fn(),
  endGame: jest.fn(),
  updateStars: jest.fn(),
  updateGameInfo: jest.fn(),
  updatePeriodShots: jest.fn(),
  deleteGame: jest.fn(),
};

describe('GameSummaryTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('locks summary page content while the goal scoring modal is open', async () => {
    const user = userEvent.setup();
    const onGoalScoringChange = jest.fn();

    render(
      <GameSummaryTab
        {...baseProps}
        onGoalScoringChange={onGoalScoringChange}
      />,
    );

    expect(onGoalScoringChange).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByRole('button', { name: /score goal/i }));

    const scoreGoalButton = screen.getByRole('button', { name: /score goal/i });
    expect(scoreGoalButton.closest('[data-goal-scoring-locked="true"]')).toBeTruthy();
    expect(await screen.findByRole('dialog', { name: /score goal/i })).toBeInTheDocument();
    expect(onGoalScoringChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog', { name: /score goal/i })).not.toBeInTheDocument();
    expect(onGoalScoringChange).toHaveBeenLastCalledWith(false);
  });
});
