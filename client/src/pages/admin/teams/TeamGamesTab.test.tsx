import { useState, type ComponentProps } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toPng } from 'html-to-image';
import TeamGamesTab from './TeamGamesTab';
import useGames from '@/hooks/useGames';
import useSeasons from '@/hooks/useSeasons';

const mockNavigate = jest.fn();
const mockGameFormModal = jest.fn(
  (props: { open: boolean; defaultDate?: string; teamContext?: { teamId: string } }) =>
    props.open ? (
      <div
        role="dialog"
        aria-label="Create game modal"
      >
        {props.defaultDate}
      </div>
    ) : null,
);

jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('html-to-image', () => ({ toPng: jest.fn() }));
jest.mock('@/hooks/useGames', () => jest.fn());
jest.mock('@/hooks/useSeasons', () => jest.fn());
jest.mock('@/pages/admin/seasons/GameFormModal', () => ({
  __esModule: true,
  default: (props: { open: boolean; defaultDate?: string; teamContext?: { teamId: string } }) =>
    mockGameFormModal(props),
}));
jest.mock('@/components/GameListItem', () => {
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
const mockToPng = toPng as jest.Mock;

const currentDate = new Date();
const dateParam = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthParam = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
const monthOffsetIso = (monthOffset: number, day: number) =>
  new Date(
    Date.UTC(currentDate.getFullYear(), currentDate.getMonth() + monthOffset, day, 12, 0, 0),
  ).toISOString();
const currentMonthIso = (day: number) => monthOffsetIso(0, day);
const dateOffsetIso = (dayOffset: number) =>
  new Date(
    Date.UTC(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() + dayOffset,
      12,
      0,
      0,
    ),
  ).toISOString();
const dayHeading = (date: Date) =>
  date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

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

const seasonTeams = [
  {
    id: 'team-1',
    name: 'Home Team',
    code: 'HOM',
    logo: null,
    home_arena: 'Home Arena',
  },
  {
    id: 'team-2',
    name: 'Away Team',
    code: 'AWY',
    logo: null,
    home_arena: 'Away Arena',
  },
];

const renderTeamGamesTab = (props: Partial<ComponentProps<typeof TeamGamesTab>> = {}) =>
  render(
    <TeamGamesTab
      teamId="team-1"
      teamName="Home Team"
      leagueId="league-1"
      defaultSeasonId="season-1"
      {...props}
    />,
  );

const hasUseGamesCall = (predicate: (filters: Record<string, unknown>) => boolean) =>
  mockUseGames.mock.calls.some(([filters]) => predicate(filters));

const TeamGamesTabHarness = () => {
  const [showGamesTab, setShowGamesTab] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGamesTab((show) => !show)}
      >
        Switch tab
      </button>
      {showGamesTab ? (
        <TeamGamesTab
          teamId="team-1"
          teamName="Home Team"
          leagueId="league-1"
          defaultSeasonId="season-1"
          calendarMonth={calendarMonth}
          onCalendarMonthChange={setCalendarMonth}
        />
      ) : (
        <div>Info tab</div>
      )}
    </>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSeasons.mockReturnValue({
    seasons: [{ id: 'season-1', name: '2024-25', is_current: true }],
    loading: false,
  });
  mockUseGames.mockReturnValue({
    games,
    loading: false,
    createGame: jest.fn(),
    updateGame: jest.fn(),
  });
  mockToPng.mockResolvedValue('data:image/png;base64,test');
});

describe('TeamGamesTab', () => {
  it('defaults to calendar view with one game per day and navigates on click', async () => {
    const user = userEvent.setup();
    const { container } = renderTeamGamesTab();
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    expect(
      hasUseGamesCall(
        (filters) =>
          filters.teamId === 'team-1' &&
          filters.seasonId === 'season-1' &&
          filters.month === monthParam(currentMonth) &&
          filters.week === undefined,
      ),
    ).toBe(true);
    const gameButtons = screen.getAllByRole('button', { name: /^Open game / });
    expect(gameButtons.filter((button) => button.classList.contains('home'))).toHaveLength(2);
    expect(gameButtons.filter((button) => button.classList.contains('away'))).toHaveLength(1);
    expect(gameButtons.find((button) => button.classList.contains('home'))).toHaveStyle(
      '--calendar-primary: #123456',
    );
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
    await waitFor(() =>
      expect(
        hasUseGamesCall(
          (filters) =>
            filters.month ===
              monthParam(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)) &&
            filters.week === undefined,
        ),
      ).toBe(true),
    );

    await user.click(screen.getByLabelText('Previous month'));

    await user.click(screen.getByLabelText('Open game vs Away Team'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/admin/leagues/league-1/seasons/season-1/games/06-05-2026/awy-vs-hom',
    );
  });

  it('uses the reusable calendar loading grid in calendar view', () => {
    mockUseGames.mockReturnValue({
      games: [],
      loading: true,
      createGame: jest.fn(),
      updateGame: jest.fn(),
    });

    renderTeamGamesTab();

    expect(screen.getAllByLabelText(/^Loading (calendar slot|games for)/).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText('Select a season to view games.')).not.toBeInTheDocument();
  });

  it('adds the winner point for shootout games in list view', async () => {
    const user = userEvent.setup();
    mockUseGames.mockReturnValue({
      games: games.map((game) =>
        game.id === 'game-shootout' ? { ...game, scheduled_at: dateOffsetIso(0) } : game,
      ),
      loading: false,
      createGame: jest.fn(),
      updateGame: jest.fn(),
    });

    renderTeamGamesTab();

    await user.click(screen.getByRole('button', { name: /list/i }));

    expect(
      hasUseGamesCall(
        (filters) => filters.week === dateParam(currentDate) && filters.month === undefined,
      ),
    ).toBe(true);
    expect(screen.getByText('SHO 2 - HOM 3 Final/SO')).toBeInTheDocument();
  });

  it('uses the season games week-list layout in list view', async () => {
    const user = userEvent.setup();
    mockUseGames.mockReturnValue({
      games: [
        {
          ...games[0],
          scheduled_at: dateOffsetIso(1),
        },
      ],
      loading: false,
    });

    const { container } = renderTeamGamesTab();

    await user.click(screen.getByRole('button', { name: /list/i }));

    expect(container.querySelector('.card > .dayList')).toBeNull();
    expect(screen.getByLabelText('Previous week')).toBeInTheDocument();
    expect(screen.getByLabelText('Next week')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Select week:/)).toBeInTheDocument();
    expect(screen.getByText(dayHeading(currentDate))).toBeInTheDocument();
    expect(
      screen.getByText(dayHeading(new Date(currentDate.getTime() + 6 * 86_400_000))),
    ).toBeInTheDocument();
    expect(screen.getByText('AWY 4 - HOM 5 Final/OT')).toBeInTheDocument();
    expect(screen.getAllByText('No games scheduled.')).toHaveLength(6);
  });

  it('opens the team-scoped create modal from each day card action', async () => {
    const user = userEvent.setup();

    renderTeamGamesTab({ seasonTeams });

    await user.click(screen.getByRole('button', { name: /list/i }));
    const createButtons = screen.getAllByRole('button', { name: /^Create game on / });
    await user.click(createButtons[0]);

    expect(screen.getByRole('dialog', { name: 'Create game modal' })).toHaveTextContent(
      /^\d{4}-\d{2}-\d{2}$/,
    );
    expect(mockGameFormModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        seasonId: 'season-1',
        seasonTeams,
        teamContext: { teamId: 'team-1' },
      }),
    );
  });

  it('downloads the current calendar month as an image', async () => {
    const user = userEvent.setup();
    const originalCreateElement = document.createElement.bind(document);
    const clickMock = jest.fn();
    let createdAnchor: HTMLAnchorElement | null = null;
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (String(tagName).toLowerCase() === 'a') {
        createdAnchor = element as HTMLAnchorElement;
        Object.defineProperty(element, 'click', { value: clickMock });
      }
      return element;
    });

    renderTeamGamesTab();

    expect(screen.getByRole('button', { name: 'Download month image' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Download month image' }));

    await waitFor(() => expect(clickMock).toHaveBeenCalled());
    const capturedNode = mockToPng.mock.calls[0][0] as HTMLElement;
    expect(mockToPng).toHaveBeenCalledWith(
      expect.objectContaining({ dataset: expect.objectContaining({ calendarExport: 'true' }) }),
      expect.objectContaining({
        backgroundColor: expect.any(String),
        cacheBust: true,
        pixelRatio: 2,
      }),
    );
    expect(capturedNode.textContent).toContain(
      new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentDate),
    );
    expect(capturedNode).toHaveStyle({ width: '1656px' });
    expect(capturedNode.querySelector('.grid')).not.toBeNull();
    expect(createdAnchor?.download).toBe(
      `Home Team Game Schedule - ${new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: 'numeric',
      }).format(currentDate)}.png`,
    );
    expect(createdAnchor?.href).toBe('data:image/png;base64,test');

    createElementSpy.mockRestore();
  });

  it('starts on the current month even when the first game is in a later month', () => {
    mockUseGames.mockReturnValueOnce({
      games: [
        {
          ...games[0],
          id: 'future-game',
          scheduled_at: monthOffsetIso(2, 8),
        },
      ],
      loading: false,
    });

    renderTeamGamesTab();

    expect(
      screen.getByText(monthLabel(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        monthLabel(new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 1)),
      ),
    ).not.toBeInTheDocument();
  });

  it('retains the viewed month after the games tab remounts', async () => {
    const user = userEvent.setup();
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

    render(<TeamGamesTabHarness />);

    await user.click(screen.getByLabelText('Next month'));
    expect(screen.getByText(monthLabel(nextMonth))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch tab' }));
    expect(screen.getByText('Info tab')).toBeInTheDocument();
    expect(screen.queryByText(monthLabel(nextMonth))).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch tab' }));
    expect(screen.getByText(monthLabel(nextMonth))).toBeInTheDocument();
  });

  it('shows the calendar grid for seasons without games', () => {
    mockUseGames.mockReturnValueOnce({ games: [], loading: false });
    const { container } = renderTeamGamesTab();

    expect(
      screen.getByText(monthLabel(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))),
    ).toBeInTheDocument();
    expect(container.querySelector('.grid')).not.toBeNull();
    expect(screen.queryByText('No games scheduled for this season.')).not.toBeInTheDocument();
  });
});
