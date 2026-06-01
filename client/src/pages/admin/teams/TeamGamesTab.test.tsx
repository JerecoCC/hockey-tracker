import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamGamesTab from './TeamGamesTab';
import useGames from '@/hooks/useGames';
import useSeasons from '@/hooks/useSeasons';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('@/hooks/useGames', () => jest.fn());
jest.mock('@/hooks/useSeasons', () => jest.fn());
jest.mock('@/pages/admin/seasons/GameListItem', () => {
  interface MockGameListItemProps {
    awayTeam: { code: string };
    homeTeam: { code: string };
    awayScore: number;
    homeScore: number;
    statusLabel: string;
  }

  function MockGameListItem({
    awayTeam,
    homeTeam,
    awayScore,
    homeScore,
    statusLabel,
  }: MockGameListItemProps) {
    return (
      <li>{`${awayTeam.code} ${awayScore} - ${homeTeam.code} ${homeScore} ${statusLabel}`}</li>
    );
  }

  return MockGameListItem;
});

const mockUseGames = useGames as jest.Mock;
const mockUseSeasons = useSeasons as jest.Mock;

const currentDate = new Date();
const monthLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
const currentMonthIso = (day: number) =>
  new Date(
    Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), day, 12, 0, 0),
  ).toISOString();

const games = [
  {
    id: 'game-home',
    season_id: 'season-1',
    game_type: 'regular',
    status: 'final',
    scheduled_at: currentMonthIso(5),
    scheduled_time: '19:00',
    venue: 'Home Arena',
    time_start: null,
    time_end: null,
    home_team: {
      id: 'team-1',
      name: 'Home Team',
      code: 'HOM',
      logo: null,
      primary_color: '#123456',
      secondary_color: '#000',
      text_color: '#ffffff',
    },
    away_team: {
      id: 'team-2',
      name: 'Away Team',
      code: 'AWY',
      logo: null,
      primary_color: '#abcdef',
      secondary_color: '#000',
      text_color: '#111111',
    },
    home_score: 5,
    away_score: 4,
    overtime_periods: 1,
    shootout: false,
    shootout_first_team_id: null,
    playoff_series_id: null,
    game_number_in_series: null,
    game_number: 1,
    playoff_round: null,
    series_home_team_id: null,
    series_away_team_id: null,
    series_home_wins: null,
    series_away_wins: null,
    series_games_to_win: null,
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    current_period: null,
    period_scores: [
      { period: 1, away_goals: 1, home_goals: 1 },
      { period: 2, away_goals: 1, home_goals: 1 },
      { period: 3, away_goals: 2, home_goals: 2 },
      { period: 'OT', away_goals: 0, home_goals: 1 },
    ],
    period_shots: [],
    star_1_id: null,
    star_2_id: null,
    star_3_id: null,
    best_of_shootout: 3,
    playoff_round_names: null,
  },
  {
    id: 'game-away',
    season_id: 'season-1',
    game_type: 'regular',
    status: 'scheduled',
    scheduled_at: currentMonthIso(12),
    scheduled_time: '19:30',
    venue: 'Road Arena',
    time_start: null,
    time_end: null,
    home_team: {
      id: 'team-3',
      name: 'Road Team',
      code: 'RDT',
      logo: null,
      primary_color: '#654321',
      secondary_color: '#000',
      text_color: '#ffffff',
    },
    away_team: {
      id: 'team-1',
      name: 'Home Team',
      code: 'HOM',
      logo: null,
      primary_color: '#123456',
      secondary_color: '#000',
      text_color: '#ffffff',
    },
    home_score: 0,
    away_score: 0,
    overtime_periods: null,
    shootout: false,
    shootout_first_team_id: null,
    playoff_series_id: null,
    game_number_in_series: null,
    game_number: 2,
    playoff_round: null,
    series_home_team_id: null,
    series_away_team_id: null,
    series_home_wins: null,
    series_away_wins: null,
    series_games_to_win: null,
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    current_period: null,
    period_scores: [],
    period_shots: [],
    star_1_id: null,
    star_2_id: null,
    star_3_id: null,
    best_of_shootout: 3,
    playoff_round_names: null,
  },
  {
    id: 'game-shootout',
    season_id: 'season-1',
    game_type: 'regular',
    status: 'final',
    scheduled_at: currentMonthIso(18),
    scheduled_time: '19:30',
    venue: 'Shootout Arena',
    time_start: null,
    time_end: null,
    home_team: {
      id: 'team-1',
      name: 'Home Team',
      code: 'HOM',
      logo: null,
      primary_color: '#123456',
      secondary_color: '#000',
      text_color: '#ffffff',
    },
    away_team: {
      id: 'team-5',
      name: 'Shootout Opponent',
      code: 'SHO',
      logo: null,
      primary_color: '#0f172a',
      secondary_color: '#000',
      text_color: '#ffffff',
    },
    home_score: 3,
    away_score: 2,
    overtime_periods: 1,
    shootout: true,
    winner_team_id: 'team-1',
    shootout_first_team_id: 'team-5',
    playoff_series_id: null,
    game_number_in_series: null,
    game_number: 4,
    playoff_round: null,
    series_home_team_id: null,
    series_away_team_id: null,
    series_home_wins: null,
    series_away_wins: null,
    series_games_to_win: null,
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    current_period: null,
    period_scores: [
      { period: 1, away_goals: 1, home_goals: 0 },
      { period: 2, away_goals: 0, home_goals: 1 },
      { period: 3, away_goals: 1, home_goals: 1 },
      { period: 'SO', away_goals: 0, home_goals: 1 },
    ],
    period_shots: [],
    star_1_id: null,
    star_2_id: null,
    star_3_id: null,
    best_of_shootout: 3,
    playoff_round_names: null,
  },
  {
    id: 'game-same-day-second',
    season_id: 'season-1',
    game_type: 'regular',
    status: 'scheduled',
    scheduled_at: currentMonthIso(5),
    scheduled_time: '21:00',
    venue: 'Late Arena',
    time_start: null,
    time_end: null,
    home_team: {
      id: 'team-1',
      name: 'Home Team',
      code: 'HOM',
      logo: null,
      primary_color: '#123456',
      secondary_color: '#000',
      text_color: '#ffffff',
    },
    away_team: {
      id: 'team-4',
      name: 'Second Opponent',
      code: 'SOP',
      logo: null,
      primary_color: '#fedcba',
      secondary_color: '#000',
      text_color: '#111111',
    },
    home_score: 0,
    away_score: 0,
    overtime_periods: null,
    shootout: false,
    shootout_first_team_id: null,
    playoff_series_id: null,
    game_number_in_series: null,
    game_number: 3,
    playoff_round: null,
    series_home_team_id: null,
    series_away_team_id: null,
    series_home_wins: null,
    series_away_wins: null,
    series_games_to_win: null,
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    current_period: null,
    period_scores: [],
    period_shots: [],
    star_1_id: null,
    star_2_id: null,
    star_3_id: null,
    best_of_shootout: 3,
    playoff_round_names: null,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSeasons.mockReturnValue({
    seasons: [{ id: 'season-1', name: '2024-25', is_current: true }],
    loading: false,
  });
  mockUseGames.mockReturnValue({ games, loading: false });
});

describe('TeamGamesTab', () => {
  it('defaults to calendar view with one game per day and navigates on click', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TeamGamesTab
        teamId="team-1"
        leagueId="league-1"
      />,
    );

    expect(container.querySelectorAll('.calendarGameHome')).toHaveLength(2);
    expect(container.querySelectorAll('.calendarGameAway')).toHaveLength(1);
    expect(container.querySelector('.calendarGameHome')).toHaveStyle('--calendar-primary: #123456');
    expect(
      screen.getByText(monthLabel(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))),
    ).toBeInTheDocument();
    await user.hover(screen.getByLabelText('Open game vs Away Team'));

    expect(container.querySelector('.tipVisible')).toHaveTextContent('Away Team');
    expect(screen.getByText('W 4 - 5 (OT)')).toBeInTheDocument();
    expect(screen.getByText('W 2 - 3 (SO)')).toBeInTheDocument();
    expect(screen.queryByText('AWY')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Open game vs Second Opponent')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Next month'));

    expect(
      screen.getByText(
        monthLabel(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)),
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText('Previous month'));

    await user.click(screen.getByLabelText('Open game vs Away Team'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/admin/leagues/league-1/seasons/season-1/games/06-05-2026/awy-vs-hom',
    );
  });

  it('adds the winner point for shootout games in list view', async () => {
    const user = userEvent.setup();

    render(
      <TeamGamesTab
        teamId="team-1"
        leagueId="league-1"
      />,
    );

    await user.click(screen.getByLabelText('List view'));

    expect(screen.getByText('SHO 2 - HOM 3 Final/SO')).toBeInTheDocument();
  });
});
