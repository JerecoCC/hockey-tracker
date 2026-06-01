import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import usePlayerDetails, {
  usePlayerCurrentSeasonStats,
  usePlayerGameLogs,
  usePlayerLastFiveGames,
} from '@/hooks/usePlayerDetails';
import useTeamDetails from '@/hooks/useTeamDetails';
import useSeasons from '@/hooks/useSeasons';
import useTeams from '@/hooks/useTeams';
import useTabState from '@/hooks/useTabState';
import {
  useJerseyHistory,
  usePlayerPhotoHistory,
  usePlayerTradeHistory,
  useStintActions,
} from '@/hooks/useTeamPlayers';
import PlayerDetails from './PlayerDetails';

const mockNavigate = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ leagueId: 'league-1', teamId: 'team-1', id: 'player-1' }),
}));
jest.mock('@/hooks/usePlayerDetails', () => ({
  __esModule: true,
  default: jest.fn(),
  usePlayerCurrentSeasonStats: jest.fn(),
  usePlayerGameLogs: jest.fn(),
  usePlayerLastFiveGames: jest.fn(),
}));
jest.mock('@/hooks/useTeamDetails', () => jest.fn());
jest.mock('@/hooks/useSeasons', () => jest.fn());
jest.mock('@/hooks/useTeams', () => jest.fn());
jest.mock('@/hooks/useTabState', () => jest.fn());
jest.mock('@/hooks/useTeamPlayers', () => ({
  usePlayerTradeHistory: jest.fn(),
  useJerseyHistory: jest.fn(),
  usePlayerPhotoHistory: jest.fn(),
  useStintActions: jest.fn(),
}));
jest.mock('@/components/Breadcrumbs/Breadcrumbs', () => () => <div />);
jest.mock(
  '@/components/Button/Button',
  () =>
    ({ children, onClick, type = 'button', disabled, icon, tooltip }: any) => (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip ?? (icon === 'edit' ? 'Edit' : icon)}
      >
        {children}
      </button>
    ),
);
jest.mock('@/components/Card/Card', () => ({ title, action, className, children }: any) => (
  <div className={className}>
    {title}
    {action}
    {children}
  </div>
));
jest.mock('@/components/TitleRow/TitleRow', () => ({ left, right }: any) => (
  <div>
    {left}
    {right}
  </div>
));
jest.mock('@/components/PlayerAvatar/PlayerAvatar', () => () => <span>avatar</span>);
jest.mock('@/components/TeamLogo/TeamLogo', () => () => <span>logo</span>);
jest.mock('@/components/Table/Table', () => () => <div />);
jest.mock('@/components/Tabs/Tabs', () => ({ tabs, activeIndex = 0 }: any) => (
  <div>{tabs[activeIndex].content}</div>
));
jest.mock('@/components/Tooltip/Tooltip', () => ({ children }: any) => <>{children}</>);
jest.mock('../teams/TeamPlayerEditModal', () => () => null);
jest.mock('../teams/MovePlayerModal', () => () => null);
jest.mock('./StintEditModal', () => ({
  __esModule: true,
  default: () => null,
  ACQUISITION_TYPE_LABELS: { trade: 'Trade' },
}));
jest.mock('./ChangeJerseyModal', () => () => null);
jest.mock('@/components/ImagePreviewModal/ImagePreviewModal', () => () => null);

const mockUsePlayerDetails = usePlayerDetails as jest.Mock;
const mockUsePlayerCurrentSeasonStats = usePlayerCurrentSeasonStats as jest.Mock;
const mockUsePlayerGameLogs = usePlayerGameLogs as jest.Mock;
const mockUsePlayerLastFiveGames = usePlayerLastFiveGames as jest.Mock;
const mockUseTeamDetails = useTeamDetails as jest.Mock;
const mockUseSeasons = useSeasons as jest.Mock;
const mockUseTeams = useTeams as jest.Mock;
const mockUseTabState = useTabState as jest.Mock;
const mockUsePlayerTradeHistory = usePlayerTradeHistory as jest.Mock;
const mockUseJerseyHistory = useJerseyHistory as jest.Mock;
const mockUsePlayerPhotoHistory = usePlayerPhotoHistory as jest.Mock;
const mockUseStintActions = useStintActions as jest.Mock;

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest
      .fn()
      .mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  document.title = 'Hockey Tracker';
  mockUseTabState.mockReturnValue([0, jest.fn()]);
  mockUsePlayerDetails.mockReturnValue({
    player: {
      id: 'player-1',
      first_name: 'John',
      last_name: 'Smith',
      photo: null,
      date_of_birth: '1997-01-13',
      birth_city: 'Edmonton',
      birth_country: 'CAN',
      nationality: 'CAN',
      height_cm: 185,
      weight_lbs: 195,
      position: 'C',
      shoots: 'L',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
    },
    stats: [],
    loading: false,
  });
  mockUsePlayerCurrentSeasonStats.mockReturnValue({
    currentSeasonStats: {
      season_id: 'season-2',
      season_name: '2023-24',
      regular: {
        gp: 10,
        goals: 5,
        assists: 6,
        points: 11,
        wins: 0,
        shootout_wins: 0,
        goals_against: 0,
        shots_against: 0,
        save_pct: null,
      },
      playoffs: {
        gp: 2,
        goals: 1,
        assists: 0,
        points: 1,
        wins: 0,
        shootout_wins: 0,
        goals_against: 0,
        shots_against: 0,
        save_pct: null,
      },
    },
  });
  mockUsePlayerLastFiveGames.mockReturnValue({ lastFiveGames: [], loading: false });
  mockUsePlayerGameLogs.mockReturnValue({ logs: [], total: 0, loading: false });
  mockUseTeamDetails.mockReturnValue({ team: { name: 'Toronto Maple Leafs', league_name: 'NHL' } });
  mockUsePlayerTradeHistory.mockReturnValue({
    stints: [
      {
        id: 'stint-1',
        team_id: 'team-1',
        season_id: 'season-1',
        team: {
          id: 'team-1',
          name: 'Toronto Maple Leafs',
          code: 'TOR',
          logo: null,
          primary_color: '#003e7e',
          text_color: '#ffffff',
        },
        jersey_number: 19,
        is_prospect: false,
        position: 'C',
        acquisition_type: 'trade',
        start_date: '2024-10-01',
        end_date: null,
        photo: null,
      },
    ],
  });
  mockUseJerseyHistory.mockReturnValue({ byStint: {} });
  mockUsePlayerPhotoHistory.mockReturnValue({ byTeam: {} });
  mockUseStintActions.mockReturnValue({
    createStint: jest.fn(),
    updateStint: jest.fn(),
    changeJerseyNumber: jest.fn(),
    uploadStintPhoto: jest.fn(),
  });
  mockUseTeams.mockReturnValue({ teams: [] });
  mockUseSeasons.mockReturnValue({ seasons: [] });
});

describe('PlayerDetails info tab', () => {
  it("sets the browser title to the player's full name", () => {
    const { unmount } = render(<PlayerDetails />);

    expect(document.title).toBe('John Smith');

    unmount();

    expect(document.title).toBe('Hockey Tracker');
  });

  it('renders the titled player info card and the latest played season stat cards', () => {
    const { container } = render(<PlayerDetails />);

    expect(screen.getByText('Player Info')).toBeInTheDocument();
    expect(screen.getByText('2023-24 Regular Season')).toBeInTheDocument();
    expect(screen.getByText('2023-24 Playoffs')).toBeInTheDocument();
    expect(container.querySelector('.infoSummaryGrid')).toBeInTheDocument();
    expect(container.querySelector('.playerInfoCard')).toBeInTheDocument();
    expect(container.querySelector('.currentSeasonCards')).toBeInTheDocument();
  });

  it('opens the player info edit modal from the info card action', async () => {
    const user = userEvent.setup();
    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByText('Edit Player Info')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Edmonton')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('CAN').length).toBe(2);
    expect(screen.getByDisplayValue('195')).toBeInTheDocument();
  });

  it('normalizes birth city country and nationality after birth city blur', async () => {
    const user = userEvent.setup();
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        first_name: 'John',
        last_name: 'Smith',
        photo: null,
        date_of_birth: '1997-01-13',
        birth_city: '',
        birth_country: '',
        nationality: '',
        height_cm: 185,
        weight_lbs: 195,
        position: 'C',
        shoots: 'L',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });
    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const birthCity = screen.getByLabelText('Birth City');
    await user.clear(birthCity);
    await user.type(birthCity, 'Boston, Massachusetts, USA');
    await user.tab();

    expect(screen.getByLabelText('Birth City')).toHaveValue('Boston, Massachusetts');
    expect(screen.getByLabelText('Birth Country')).toHaveValue('USA');
    expect(screen.getByLabelText('Nationality')).toHaveValue('USA');
  });

  it('does not normalize birth city when birth country or nationality already has a value', async () => {
    const user = userEvent.setup();
    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const birthCity = screen.getByLabelText('Birth City');
    await user.clear(birthCity);
    await user.type(birthCity, 'Boston, Massachusetts, USA');
    await user.tab();

    expect(screen.getByLabelText('Birth City')).toHaveValue('Boston, Massachusetts, USA');
    expect(screen.getByLabelText('Birth Country')).toHaveValue('CAN');
    expect(screen.getByLabelText('Nationality')).toHaveValue('CAN');
  });

  it('rejects invalid height inches values', async () => {
    const user = userEvent.setup();
    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const inches = screen.getByPlaceholderText('0');
    expect(inches).toHaveValue(1);

    fireEvent.change(inches, { target: { value: '12' } });

    expect(inches).toHaveValue(1);
  });
});
