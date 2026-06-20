import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import UserDashboard from './UserDashboard';

const mockNavigate = jest.fn();
const mockSetQueryData = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('axios');
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(), useQueryClient: jest.fn() }));
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      display_name: 'Taylor',
      email: 'taylor@example.com',
      photo: null,
    },
  }),
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
jest.mock('@/components/Card/Card', () => ({ title, children }: any) => (
  <section>
    {title && <h3>{title}</h3>}
    {children}
  </section>
));
jest.mock(
  '@/components/Button/Button',
  () =>
    ({ children, tooltip, icon, onClick, disabled }: any) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip ?? icon}
      >
        {children ?? tooltip ?? icon}
      </button>
    ),
);
jest.mock('@/components/TeamLogo/TeamLogo', () => ({ code }: any) => <span>{code}</span>);
jest.mock(
  '@/components/Modal/Modal',
  () =>
    ({ open, title, children, onConfirm, confirmLabel, onClose, footerStart }: any) =>
      open ? (
        <div>
          <h3>{title}</h3>
          {children}
          {footerStart}
          <button onClick={onConfirm}>{confirmLabel}</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      ) : null,
);
jest.mock(
  '@/components/ConfirmModal/ConfirmModal',
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
jest.mock('@/components/DatePicker/DatePicker', () => ({ value, onChange, placeholder }: any) => (
  <input
    aria-label={placeholder}
    value={value}
    onChange={(e) => onChange(e.target.value)}
  />
));
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
    localStorage.clear();
    mockUseQueryClient.mockReturnValue({
      setQueryData: mockSetQueryData,
      invalidateQueries: mockInvalidateQueries,
    });
    // The dashboard now filters by date on the server, so the query returns
    // only the effective date's games.
    mockUseQuery.mockReturnValue({
      data: [makeGame()],
      isLoading: false,
    });
  });

  it('shows favorite teams and only current-day games', () => {
    render(<UserDashboard />);

    expect(screen.getByText('Welcome, Taylor!')).toBeInTheDocument();
    expect(screen.getByText('Favorite Teams')).toBeInTheDocument();
    expect(screen.getByText('Bruins')).toBeInTheDocument();
    expect(screen.getByText('Maple Leafs')).toBeInTheDocument();
    expect(screen.queryByText('Rangers')).not.toBeInTheDocument();
    expect(screen.getByText('Sunday, June 21')).toBeInTheDocument();
    expect(
      screen.getByText(
        new Date('2026-06-21T19:00:00-04:00').toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
      ),
    ).toBeInTheDocument();
  });

  it('marks a dashboard game as watched', async () => {
    mockAxios.post.mockResolvedValueOnce({ data: {} });

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
  });

  it('opens watched-game hover actions for details and score image', () => {
    mockUseQuery.mockReturnValue({
      data: [makeGame({ status: 'final', watched_by_user: true, home_score: 4, away_score: 2 })],
      isLoading: false,
    });

    render(<UserDashboard />);
    fireEvent.click(screen.getByLabelText('View game details'));
    expect(mockNavigate).toHaveBeenCalledWith('/games/game-1');

    fireEvent.click(screen.getByLabelText('Download score card'));
    expect(screen.getByText('Score Image')).toBeInTheDocument();
    expect(screen.getByText('BOS @ TOR')).toBeInTheDocument();
  });
});
