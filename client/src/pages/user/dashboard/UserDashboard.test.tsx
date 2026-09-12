import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import UserDashboard from './UserDashboard';

const mockNavigate = jest.fn();
const mockSetQueryData = jest.fn();
const mockInvalidateQueries = jest.fn();
let mockAuthUser: any = {
  display_name: 'Taylor',
  email: 'taylor@example.com',
  photo: null,
};

jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('axios');
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(), useQueryClient: jest.fn() }));
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));
jest.mock('@/hooks/useTeams', () => ({
  __esModule: true,
  default: () => ({
    loading: false,
    teams: [
      {
        id: 'team-home',
        name: 'Toronto Maple Leafs',
        place_name: 'Toronto',
        team_name: 'Maple Leafs',
        code: 'TOR',
        logo: null,
        primary_color: '#003e7e',
        text_color: '#ffffff',
      },
      {
        id: 'team-away',
        name: 'Boston Bruins',
        place_name: 'Boston',
        team_name: 'Bruins',
        code: 'BOS',
        logo: null,
        primary_color: '#ffb81c',
        text_color: '#111111',
      },
      {
        id: 'team-other',
        name: 'New York Rangers',
        place_name: 'New York',
        team_name: 'Rangers',
        code: 'NYR',
        logo: null,
        primary_color: '#0038a8',
        text_color: '#ffffff',
      },
    ],
  }),
}));
jest.mock('@/hooks/useFavoriteTeams', () => ({
  __esModule: true,
  default: () => ({ favorites: ['team-home', 'team-away'] }),
}));
jest.mock('@jerecocc/tracker-ui/components/Card/Card', () => ({ title, children }: any) => (
  <section>
    {title && <h3>{title}</h3>}
    {children}
  </section>
));
jest.mock(
  '@jerecocc/tracker-ui/components/Button/Button',
  () =>
    ({ children, tooltip, icon, onClick, disabled }: any) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip ?? (children ? undefined : icon)}
        data-icon={icon}
      >
        {children ?? tooltip ?? icon}
      </button>
    ),
);
jest.mock('@jerecocc/tracker-ui/components/TeamLogo/TeamLogo', () => ({ code }: any) => (
  <span>{code}</span>
));
jest.mock(
  '@jerecocc/tracker-ui/components/Modal/Modal',
  () =>
    ({
      open,
      title,
      children,
      onConfirm,
      confirmLabel,
      confirmDisabled,
      onClose,
      footerStart,
    }: any) =>
      open ? (
        <div>
          <h3>{title}</h3>
          {children}
          {footerStart}
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      ) : null,
);
jest.mock(
  '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal',
  () =>
    ({ open, title, body, onConfirm, onCancel, confirmLabel }: any) =>
      open ? (
        <div>
          <h3>{title}</h3>
          <p>{body}</p>
          <button onClick={onConfirm}>{confirmLabel}</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      ) : null,
);
jest.mock(
  '@jerecocc/tracker-ui/components/DatePicker/DatePicker',
  () => (props: any) =>
    props.triggerLabel ? (
      <button
        type="button"
        aria-label={props.triggerAriaLabel ?? props.triggerLabel}
      >
        {props.triggerLabel}
      </button>
    ) : (
      <>
        <input
          aria-label={props.ariaLabelledBy ? undefined : props.placeholder}
          aria-labelledby={props.ariaLabelledBy}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
        {props.value && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => props.onChange('')}
          >
            Clear
          </button>
        )}
      </>
    ),
);
jest.mock('@/pages/admin/games/game-details/ScoreImageModal', () => ({
  __esModule: true,
  default: ({ open, game, onClose }: any) =>
    open ? (
      <div>
        <div>Score Image</div>
        <div>{`${game.away_team.code} @ ${game.home_team.code}`}</div>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

const mockUseQuery = useQuery as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockAxios = axios as jest.Mocked<typeof axios>;

const makeGame = (overrides: Partial<any> = {}) => ({
  id: 'game-1',
  season_id: 'season-1',
  game_type: 'regular',
  status: 'scheduled',
  scheduled_at: '2026-06-21',
  scheduled_time: '19:00',
  time_start: null,
  time_end: null,
  venue: null,
  home_team: {
    id: 'team-home',
    name: 'Toronto Maple Leafs',
    code: 'TOR',
    logo: null,
    primary_color: '#003e7e',
    secondary_color: '#ffffff',
    text_color: '#ffffff',
  },
  away_team: {
    id: 'team-away',
    name: 'Boston Bruins',
    code: 'BOS',
    logo: null,
    primary_color: '#ffb81c',
    secondary_color: '#111111',
    text_color: '#111111',
  },
  home_score: 0,
  away_score: 0,
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
  created_at: '2026-06-01T00:00:00Z',
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  season_name: '2025-26',
  league_code: 'NHL',
  league_primary_color: '#334155',
  league_text_color: '#ffffff',
  watched_by_user: false,
  watched_on: null,
  skipped_by_user: false,
  scheduled_for: null,
  best_of_shootout: 3,
  ...overrides,
});

const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const mockDashboardQueries = ({
  todayGames = [makeGame()],
  watchedGames = [
    makeGame({
      id: 'watched-game-1',
      status: 'final',
      watched_by_user: true,
      watched_on: '2026-06-20',
      away_team: {
        id: 'team-other',
        name: 'New York Rangers',
        code: 'NYR',
        logo: null,
        primary_color: '#0038a8',
        secondary_color: '#ffffff',
        text_color: '#ffffff',
      },
    }),
    makeGame({
      id: 'watched-game-2',
      status: 'final',
      watched_by_user: true,
      watched_on: '2026-06-20',
      away_team: {
        id: 'team-other',
        name: 'New York Rangers',
        code: 'NYR',
        logo: null,
        primary_color: '#0038a8',
        secondary_color: '#ffffff',
        text_color: '#ffffff',
      },
    }),
  ],
}: {
  todayGames?: any[];
  watchedGames?: any[];
} = {}) => {
  mockUseQuery.mockImplementation(({ queryKey }: any) => {
    if (Array.isArray(queryKey) && queryKey[0] === 'user-dashboard-watched-games') {
      return {
        data: watchedGames,
        isLoading: false,
      };
    }

    return {
      data: todayGames,
      isLoading: false,
    };
  });
};

describe('UserDashboard', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 5, 21, 12, 0, 0));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = {
      display_name: 'Taylor',
      email: 'taylor@example.com',
      photo: null,
    };
    localStorage.clear();
    mockUseQueryClient.mockReturnValue({
      setQueryData: mockSetQueryData,
      invalidateQueries: mockInvalidateQueries,
    });
    // The dashboard filters today's games separately from the watched-team summary.
    mockDashboardQueries();
  });

  it('shows dashboard stats, watched teams, and only current-day games', () => {
    render(<UserDashboard />);

    expect(screen.getByText('Welcome, Taylor!')).toBeInTheDocument();
    expect(screen.queryByText('taylor@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('Game day command center')).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard summary')).toHaveTextContent("Today's slate");
    expect(screen.getByLabelText('Dashboard summary')).toHaveTextContent('Games watched');
    expect(screen.getByLabelText('Dashboard summary')).toHaveTextContent('Teams tracked');
    expect(screen.getByText('Games Watched')).toBeInTheDocument();
    expect(screen.getByLabelText('About Games Watched')).toBeInTheDocument();
    expect(screen.getByText('Boston')).toBeInTheDocument();
    expect(screen.getByText('Bruins')).toBeInTheDocument();
    expect(screen.getByText('Toronto')).toBeInTheDocument();
    expect(screen.getByText('Maple Leafs')).toBeInTheDocument();
    expect(screen.getByLabelText('2 watched games')).toBeInTheDocument();
    expect(screen.getByLabelText('0 watched games')).toBeInTheDocument();
    expect(screen.queryByText('Rangers')).not.toBeInTheDocument();
    expect(screen.queryByText(/Last watched/)).not.toBeInTheDocument();
    expect(screen.getByText('Sunday, June 21, 2026')).toBeInTheDocument();
    expect(
      screen.getByText(
        new Date('2026-06-21T19:00:00-04:00').toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
      ),
    ).toBeInTheDocument();

    const viewAllButton = screen.getByRole('button', { name: 'View all games watched' });
    expect(viewAllButton).toHaveAttribute('data-icon', 'view_list');
    fireEvent.click(viewAllButton);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/games-watched');
  });

  it('orders current-day games like the user games calendar day', () => {
    const awayTeam = makeGame().away_team;
    const watchedPostponed = makeGame({
      id: 'watched-postponed',
      away_team: { ...awayTeam, id: 'team-watched-postponed', code: 'WPS' },
      scheduled_at: '2026-06-20',
      scheduled_time: '22:00',
      scheduled_for: '2026-06-21',
      watched_by_user: true,
      watched_on: '2026-06-21',
    });
    const watched = makeGame({
      id: 'watched',
      away_team: { ...awayTeam, id: 'team-watched', code: 'WAT' },
      scheduled_time: null,
      watched_by_user: true,
      watched_on: '2026-06-21',
    });
    const postponed = makeGame({
      id: 'postponed',
      away_team: { ...awayTeam, id: 'team-postponed', code: 'PST' },
      scheduled_at: '2026-06-20',
      scheduled_time: '18:00',
      scheduled_for: '2026-06-21',
    });
    const unwatched = makeGame({
      id: 'unwatched',
      away_team: { ...awayTeam, id: 'team-unwatched', code: 'UNW' },
      scheduled_time: '16:00',
    });
    mockDashboardQueries({
      todayGames: [unwatched, postponed, watched, watchedPostponed],
    });

    render(<UserDashboard />);

    const orderedGames = ['WPS', 'WAT', 'PST', 'UNW'].map(
      (code) =>
        screen.getAllByText(code).find((element) => element.classList.contains('teamCode'))!,
    );
    for (let index = 0; index < orderedGames.length - 1; index += 1) {
      expect(orderedGames[index].compareDocumentPosition(orderedGames[index + 1])).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });

  it('opens a favorite team watched-games page from the watched list', () => {
    render(<UserDashboard />);

    fireEvent.click(screen.getByRole('button', { name: 'View Boston Bruins games watched' }));

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/games-watched/bos-bruins');
  });

  it('opens the game picker from the current day card', () => {
    render(<UserDashboard />);
    const button = screen.getByRole('button', { name: 'Edit games to watch' });
    expect(button).toHaveAttribute('data-icon', 'edit');
    fireEvent.click(button);
    expect(screen.getByRole('heading', { name: 'Edit games to watch' })).toBeInTheDocument();
    expect(screen.getByText('Games to Watch')).toBeInTheDocument();
    expect(screen.getByText('Other games')).toBeInTheDocument();
  });

  it('fetches surrounding days and retains explicitly scheduled nonfavorite games after reload', async () => {
    render(<UserDashboard />);
    const options = mockUseQuery.mock.calls.find(
      ([options]) => options.queryKey[0] === 'user-dashboard-games',
    )![0];
    const today = options.queryKey[1];
    const otherTeam = { ...makeGame().home_team, id: 'not-a-favorite' };
    const added = makeGame({
      id: 'added',
      home_team: otherTeam,
      away_team: otherTeam,
      scheduled_for: today,
    });
    const unselected = { ...added, id: 'unselected', scheduled_for: null };
    const adjacent = makeGame({ id: 'adjacent', scheduled_at: '2026-06-24' });
    const skipped = { ...added, id: 'skipped', skipped_by_user: true };
    const localFavorite = makeGame({ scheduled_at: today, scheduled_time: null });
    mockAxios.get.mockResolvedValueOnce({
      data: [added, unselected, adjacent, skipped, localFavorite],
    });
    const data = await options.queryFn();
    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/user/games'),
      expect.objectContaining({
        params: { week: today, all_teams: true },
      }),
    );
    expect(options.select(data).map((game: any) => game.id)).toEqual(['added', 'game-1']);
  });

  it('shows and clears the admin date override through the date picker', () => {
    mockAuthUser = {
      display_name: 'Taylor',
      email: 'taylor@example.com',
      photo: null,
      role: 'admin',
    };
    localStorage.setItem('admin-dashboard-date-override', '2026-06-22');

    render(<UserDashboard />);

    expect(screen.getByLabelText('Override the dashboard date for testing')).toHaveValue(
      '2026-06-22',
    );
    expect(screen.getByText('Monday, June 22, 2026')).toBeInTheDocument();
    expect(screen.queryByText('Test date')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reset dashboard date to today' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(localStorage.getItem('admin-dashboard-date-override')).toBeNull();
    expect(screen.getByText('Sunday, June 21, 2026')).toBeInTheDocument();
  });

  it('marks a dashboard game as watched', async () => {
    mockAxios.post.mockResolvedValueOnce({ data: {} });
    mockDashboardQueries({ todayGames: [makeGame({ status: 'final' })] });

    render(<UserDashboard />);
    fireEvent.click(screen.getByLabelText('Mark as watched'));

    await waitFor(() => {
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/user/watched-games/game-1'),
        { watched_on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
        expect.any(Object),
      );
    });
    expect(mockSetQueryData).toHaveBeenCalledWith(
      ['user-dashboard-games', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)],
      expect.any(Function),
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['user-games'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['user-dashboard-watched-games'],
    });
  });

  it('hides the watch action for non-final dashboard games', () => {
    mockDashboardQueries({ todayGames: [makeGame({ status: 'scheduled' })] });

    render(<UserDashboard />);

    expect(screen.queryByLabelText('Mark as watched')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Postpone watch')).toBeInTheDocument();
    expect(screen.getByLabelText('Skip game')).toBeInTheDocument();
  });

  it('cancels a custom nonfavorite watch instead of skipping the game', async () => {
    const nonfavoriteTeam = {
      ...makeGame().home_team,
      id: 'team-nonfavorite',
      name: 'Carolina Hurricanes',
      code: 'CAR',
    };
    mockDashboardQueries({
      todayGames: [
        makeGame({
          home_team: nonfavoriteTeam,
          away_team: { ...nonfavoriteTeam, id: 'team-nonfavorite-away', code: 'FLA' },
          scheduled_for: '2026-06-21',
        }),
      ],
    });
    mockAxios.put.mockResolvedValueOnce({ data: {} });

    render(<UserDashboard />);

    expect(screen.queryByLabelText('Skip game')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Cancel watch'));
    await waitFor(() =>
      expect(mockAxios.put).toHaveBeenCalledWith(
        expect.stringContaining('/user/watched-games/game-1/schedule'),
        { scheduled_for: null },
        expect.any(Object),
      ),
    );
  });

  it('prevents postponing a watch to on or before the local game date', async () => {
    render(<UserDashboard />);

    fireEvent.click(screen.getByLabelText('Postpone watch'));
    const input = screen.getByLabelText('Watch date');
    fireEvent.change(input, {
      target: { value: toLocalDateKey(new Date('2026-06-21T19:00:00-04:00')) },
    });

    expect(screen.getByText(/after the game date/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save date' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save date' }));
    expect(mockAxios.put).not.toHaveBeenCalled();
  });

  it('shows the original scheduled date for games moved to another watch day', () => {
    const originalLocalDate = toLocalDateKey(new Date('2026-06-21T19:00:00-04:00'));
    const originalDateLabel = new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }).format(new Date(`${originalLocalDate}T00:00:00`));
    mockDashboardQueries({ todayGames: [makeGame({ scheduled_for: '2026-06-23' })] });

    render(<UserDashboard />);

    expect(screen.getByText(originalDateLabel)).toBeInTheDocument();
  });

  it('shows playoff metadata in the season label slot', () => {
    mockDashboardQueries({
      todayGames: [
        makeGame({
          game_type: 'playoff',
          playoff_round: 2,
          game_number_in_series: 3,
          playoff_round_names: { 2: 'Round 2' },
        }),
      ],
    });

    render(<UserDashboard />);

    expect(screen.getByText('R2 - G3')).toBeInTheDocument();
    expect(screen.queryByText('2025-26')).not.toBeInTheDocument();
  });

  it('opens watched-game hover actions for details and score image', async () => {
    mockDashboardQueries({
      todayGames: [
        makeGame({ status: 'final', watched_by_user: true, home_score: 4, away_score: 2 }),
      ],
    });

    render(<UserDashboard />);
    fireEvent.click(screen.getByLabelText('View game details'));
    expect(mockNavigate).toHaveBeenCalledWith('/games/game-1');

    fireEvent.click(screen.getByLabelText('Download score card'));
    expect(await screen.findByText('Score Image')).toBeInTheDocument();
    expect(screen.getByText('BOS @ TOR')).toBeInTheDocument();
  });
});
