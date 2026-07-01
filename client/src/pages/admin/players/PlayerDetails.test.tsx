import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import usePlayerDetails, {
  usePlayerAwards,
  usePlayerCurrentSeasonStats,
  usePlayerGameLogs,
  usePlayerLastFiveGames,
  usePlayerRouteLookup,
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
import PlayerDetails, { collapseSameTeamStints } from './PlayerDetails';

const mockNavigate = jest.fn();
const mockUsePageBreadcrumbs = jest.fn();
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('axios');
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({
    leagueCode: 'nhl',
    teamCode: 'tor',
    playerSlug: 'john-smith',
  }),
}));
jest.mock('@/hooks/usePlayerDetails', () => ({
  __esModule: true,
  default: jest.fn(),
  usePlayerAwards: jest.fn(),
  usePlayerCurrentSeasonStats: jest.fn(),
  usePlayerGameLogs: jest.fn(),
  usePlayerLastFiveGames: jest.fn(),
  usePlayerRouteLookup: jest.fn(),
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
jest.mock('@/context/BreadcrumbContext', () => ({
  usePageBreadcrumbs: (...args: any[]) => mockUsePageBreadcrumbs(...args),
}));
jest.mock('@/components/Breadcrumbs/Breadcrumbs', () => () => <div />);
jest.mock(
  '@/components/Button/Button',
  () =>
    ({
      children,
      onClick,
      type = 'button',
      disabled,
      icon,
      tooltip,
      variant: _variant,
      intent: _intent,
      size: _size,
      iconSize: _iconSize,
      iconHeight: _iconHeight,
      tooltipClassName: _tooltipClassName,
      tooltipIntent: _tooltipIntent,
      ...rest
    }: any) => (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip ?? (icon === 'edit' ? 'Edit' : icon)}
        {...rest}
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
jest.mock(
  '@/components/ConfirmModal/ConfirmModal',
  () =>
    ({ open, title, body, confirmLabel, onConfirm, onCancel }: any) =>
      open ? (
        <div
          role="dialog"
          aria-label={title}
        >
          <div>{body}</div>
          <button onClick={onConfirm}>{confirmLabel}</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      ) : null,
);
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
jest.mock('../teams/MovePlayerModal', () => ({ open }: any) =>
  open ? <div>Move Player Modal</div> : null,
);
jest.mock('./StintEditModal', () => ({
  __esModule: true,
  default: () => null,
  ACQUISITION_TYPE_LABELS: { trade: 'Trade' },
}));
jest.mock('./ChangeJerseyModal', () => () => null);
jest.mock('@/components/ImagePreviewModal/ImagePreviewModal', () => () => null);

const mockUsePlayerDetails = usePlayerDetails as jest.Mock;
const mockUsePlayerAwards = usePlayerAwards as jest.Mock;
const mockUsePlayerCurrentSeasonStats = usePlayerCurrentSeasonStats as jest.Mock;
const mockUsePlayerGameLogs = usePlayerGameLogs as jest.Mock;
const mockUsePlayerLastFiveGames = usePlayerLastFiveGames as jest.Mock;
const mockUsePlayerRouteLookup = usePlayerRouteLookup as jest.Mock;
const mockUseTeamDetails = useTeamDetails as jest.Mock;
const mockUseSeasons = useSeasons as jest.Mock;
const mockUseTeams = useTeams as jest.Mock;
const mockUseTabState = useTabState as jest.Mock;
const mockUsePlayerTradeHistory = usePlayerTradeHistory as jest.Mock;
const mockUseJerseyHistory = useJerseyHistory as jest.Mock;
const mockUsePlayerPhotoHistory = usePlayerPhotoHistory as jest.Mock;
const mockUseStintActions = useStintActions as jest.Mock;

beforeAll(() => {
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: jest.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    writable: true,
    value: jest.fn(),
  });
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
  mockedAxios.patch.mockReset();
  (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
  document.title = 'Hockey Tracker';
  mockUseTabState.mockReturnValue([0, jest.fn()]);
  mockUsePlayerRouteLookup.mockReturnValue({
    routeLookup: {
      player_id: 'player-1',
      team_id: 'team-1',
      league_id: 'league-1',
      league_code: 'NHL',
      team_code: 'TOR',
      player_slug: 'john-smith',
    },
    loading: false,
  });
  mockUsePlayerDetails.mockReturnValue({
    player: {
      id: 'player-1',
      first_name: 'John',
      last_name: 'Smith',
      photo: null,
      date_of_birth: '1997-01-13',
      birth_city: 'Edmonton',
      birth_country: 'CAN',
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
  mockUsePlayerAwards.mockReturnValue({ awards: [], loading: false });
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
        has_stats: false,
        can_delete: true,
      },
    ],
  });
  mockUseJerseyHistory.mockReturnValue({ byStint: {} });
  mockUsePlayerPhotoHistory.mockReturnValue({ byTeam: {} });
  mockUseStintActions.mockReturnValue({
    createStint: jest.fn(),
    updateStint: jest.fn(),
    deleteStint: jest.fn(),
    changeJerseyNumber: jest.fn(),
    changePlayerPhoto: jest.fn(),
    uploadStintPhoto: jest.fn(),
    saving: false,
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

  it('uses public breadcrumbs in user mode', () => {
    render(<PlayerDetails mode="user" />);

    const config = mockUsePageBreadcrumbs.mock.calls[0][0];
    expect(config).toEqual(
      expect.objectContaining({
        backPath: '/leagues/nhl/teams/tor',
        backLabel: 'Back to Toronto Maple Leafs',
      }),
    );
    expect(config.items).toEqual([
      { label: 'Games', path: '/games' },
      { label: 'NHL' },
      { label: 'Toronto Maple Leafs', path: '/leagues/nhl/teams/tor' },
      { label: 'John Smith' },
    ]);
  });

  it('shows the active or retired tag beside the player heading', () => {
    const { rerender } = render(<PlayerDetails />);

    expect(screen.getByRole('heading', { name: 'John Smith' })).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        first_name: 'John',
        last_name: 'Smith',
        photo: null,
        date_of_birth: '1997-01-13',
        birth_city: 'Edmonton',
        birth_country: 'CAN',
        height_cm: 185,
        weight_lbs: 195,
        position: 'C',
        shoots: 'L',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });

    rerender(<PlayerDetails />);

    expect(screen.getByText('Retired')).toBeInTheDocument();
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
  });

  it('moves the move player action into the more actions menu', async () => {
    const user = userEvent.setup();
    const { container } = render(<PlayerDetails />);

    const heroActions = container.querySelector('.heroActions') as HTMLElement;
    const actionButtons = within(heroActions).getAllByRole('button');
    expect(actionButtons[0]).toHaveAccessibleName('Edit player');
    expect(actionButtons[1]).toHaveAccessibleName('More actions');

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Move Player' }));

    expect(screen.getByText('Move Player Modal')).toBeInTheDocument();
  });

  it('retires a player from the more actions menu', async () => {
    const user = userEvent.setup();
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Retire Player' }));

    const retirementDate = screen.getByRole('textbox', { name: /Retirement Date/ });
    for (const key of ['0', '6', '3', '0', '2', '0', '2', '5']) {
      fireEvent.keyDown(retirementDate, { key });
    }

    const submit = screen.getByRole('button', { name: 'Retire Player' });
    await waitFor(() => expect(submit).not.toBeDisabled());
    await user.click(submit);

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        '/api/admin/players/player-1/retire',
        { retirement_date: '2025-06-30' },
        expect.objectContaining({ headers: expect.any(Object) }),
      );
    });
  });

  it('opens the player info edit modal from the info card action', async () => {
    const user = userEvent.setup();
    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByText('Edit Player Info')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Edmonton')).toBeInTheDocument();
    expect(screen.getByDisplayValue('CAN')).toBeInTheDocument();
    expect(screen.getByDisplayValue('195')).toBeInTheDocument();
  });

  it('normalizes birth city country after birth city blur', async () => {
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
  });

  it('does not normalize birth city when birth country already has a value', async () => {
    const user = userEvent.setup();
    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const birthCity = screen.getByLabelText('Birth City');
    await user.clear(birthCity);
    await user.type(birthCity, 'Boston, Massachusetts, USA');
    await user.tab();

    expect(screen.getByLabelText('Birth City')).toHaveValue('Boston, Massachusetts, USA');
    expect(screen.getByLabelText('Birth Country')).toHaveValue('CAN');
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

  it('lets admins delete a team history stint after confirmation', async () => {
    const user = userEvent.setup();
    const deleteStint = jest.fn().mockResolvedValue(true);
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUseStintActions.mockReturnValue({
      createStint: jest.fn(),
      updateStint: jest.fn(),
      deleteStint,
      changeJerseyNumber: jest.fn(),
      changePlayerPhoto: jest.fn(),
      uploadStintPhoto: jest.fn(),
      saving: false,
    });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'Delete stint' }));
    expect(screen.getByRole('dialog', { name: 'Delete Stint' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Stint' }));

    await waitFor(() => expect(deleteStint).toHaveBeenCalledWith('stint-1'));
  });

  it('hides the team history delete action when the stint has stats', () => {
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'stint-1',
          team_id: 'team-1',
          season_id: 'season-1',
          team: {
            id: 'team-1',
            name: 'Toronto Sceptres',
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
          has_stats: true,
          can_delete: false,
        },
      ],
    });

    render(<PlayerDetails />);

    expect(screen.queryByRole('button', { name: 'Delete stint' })).not.toBeInTheDocument();
  });
});

describe('PlayerDetails awards tab', () => {
  it('renders player awards with the winning team and season tag', () => {
    mockUseTabState.mockReturnValue([3, jest.fn()]);
    mockUsePlayerAwards.mockReturnValue({
      awards: [
        {
          id: 'recipient-1',
          award_id: 'award-1',
          season_award_id: 'season-award-1',
          award_name: 'Forward of the Year',
          season_id: 'season-1',
          season_name: '2025-26',
          awarded_at: '2026-05-01',
          team_id: 'team-1',
          team_name: 'Toronto Maple Leafs',
          team_code: 'TOR',
          team_logo: null,
          team_primary_color: '#003e7e',
          team_text_color: '#ffffff',
        },
        {
          id: 'recipient-2',
          award_id: 'award-2',
          season_award_id: 'season-award-2',
          award_name: 'Walter Cup Winner',
          season_id: 'season-1',
          season_name: '2025-26',
          awarded_at: '2026-05-20',
          team_id: 'team-1',
          team_name: 'Toronto Maple Leafs',
          team_code: 'TOR',
          team_logo: null,
          team_primary_color: '#003e7e',
          team_text_color: '#ffffff',
        },
      ],
      loading: false,
    });

    render(<PlayerDetails />);

    const awardItem = screen.getByText('Forward of the Year').closest('li');

    expect(screen.getByText('Awards')).toBeInTheDocument();
    expect(awardItem).not.toBeNull();
    expect(awardItem).toHaveClass('item');
    expect(awardItem).not.toHaveClass('itemPlain');
    expect(within(awardItem as HTMLElement).getByText('Forward of the Year')).toBeInTheDocument();
    expect(within(awardItem as HTMLElement).getByText('Toronto Maple Leafs')).toBeInTheDocument();
    expect(within(awardItem as HTMLElement).getByText('2025-26')).toBeInTheDocument();
    expect(screen.getByText('Walter Cup Winner')).toBeInTheDocument();
  });

  it('syncs the awards season select with the game logs season select', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([3, jest.fn()]);
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-1',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          created_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 'season-2',
          league_id: 'league-1',
          name: '2024-25',
          start_date: '2024-10-01',
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    });
    mockUsePlayerAwards.mockReturnValue({
      awards: [
        {
          id: 'recipient-1',
          award_id: 'award-1',
          season_award_id: 'season-award-1',
          award_name: 'Forward of the Year',
          season_id: 'season-1',
          season_name: '2025-26',
          awarded_at: '2026-05-01',
          team_id: 'team-1',
          team_name: 'Toronto Maple Leafs',
          team_code: 'TOR',
          team_logo: null,
          team_primary_color: '#003e7e',
          team_text_color: '#ffffff',
        },
        {
          id: 'recipient-2',
          award_id: 'award-2',
          season_award_id: 'season-award-2',
          award_name: 'Older Season Award',
          season_id: 'season-2',
          season_name: '2024-25',
          awarded_at: '2025-05-01',
          team_id: 'team-1',
          team_name: 'Toronto Maple Leafs',
          team_code: 'TOR',
          team_logo: null,
          team_primary_color: '#003e7e',
          team_text_color: '#ffffff',
        },
      ],
      loading: false,
    });

    const { rerender } = render(<PlayerDetails />);

    await waitFor(() => {
      expect(screen.getByText('Forward of the Year')).toBeInTheDocument();
    });
    expect(screen.queryByText('Older Season Award')).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', { name: '2024-25' }));

    expect(screen.getByText('Older Season Award')).toBeInTheDocument();
    expect(screen.queryByText('Forward of the Year')).not.toBeInTheDocument();

    mockUseTabState.mockReturnValue([1, jest.fn()]);
    rerender(<PlayerDetails />);

    expect(screen.getByRole('combobox')).toHaveTextContent('2024-25');
  });
});

describe('collapseSameTeamStints', () => {
  const stint = (id: string, teamId: string, startDate: string | null, endDate: string | null) => ({
    id,
    team_id: teamId,
    season_id: `season-${id}`,
    team: {
      id: teamId,
      name: teamId,
      code: teamId,
      logo: null,
      primary_color: '#000000',
      text_color: '#ffffff',
    },
    jersey_number: null,
    is_prospect: false,
    position: 'C',
    acquisition_type: null,
    start_date: startDate,
    end_date: endDate,
    photo: null,
    has_stats: false,
    can_delete: true,
    created_at: '2024-01-01T00:00:00Z',
  });

  it('collapses consecutive same-team season rows into one displayed stint', () => {
    const result = collapseSameTeamStints([
      stint('newer', 'team-1', '2025-10-01', null),
      stint('older', 'team-1', '2024-10-01', '2025-06-01'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'newer',
      team_id: 'team-1',
      start_date: '2024-10-01',
      end_date: null,
    });
  });

  it('keeps separate stints when the player returns to a team after another team', () => {
    const result = collapseSameTeamStints([
      stint('return', 'team-1', '2026-10-01', null),
      stint('middle', 'team-2', '2025-10-01', '2026-06-01'),
      stint('first', 'team-1', '2024-10-01', '2025-06-01'),
    ]);

    expect(result.map((item) => item.id)).toEqual(['return', 'middle', 'first']);
  });
});
