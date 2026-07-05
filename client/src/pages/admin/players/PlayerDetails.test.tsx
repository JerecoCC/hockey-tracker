import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { toast } from 'react-toastify';
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
import useDocumentIcon from '@/hooks/useDocumentIcon';
import {
  useJerseyHistory,
  usePlayerPhotoHistory,
  usePlayerTradeHistory,
  useStintActions,
} from '@/hooks/useTeamPlayers';
import PlayerDetails, { collapseSameTeamStints } from './PlayerDetails';

const mockNavigate = jest.fn();
const mockUsePageBreadcrumbs = jest.fn();
const mockJerseyHistoryEditModal = jest.fn(() => null);
const mockChangePhotoModal = jest.fn(() => null);
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedToast = toast as jest.Mocked<typeof toast>;

jest.mock('axios');
jest.mock('react-toastify', () => ({
  toast: {
    loading: jest.fn(),
    update: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));
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
jest.mock('@/hooks/useDocumentIcon', () => jest.fn());
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
jest.mock('@/components/TeamLogo/TeamLogo', () => ({ size }: any) => (
  <span data-size={size}>logo</span>
));
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
jest.mock('./JerseyHistoryEditModal', () => {
  const MockJerseyHistoryEditModal = (props: any) => mockJerseyHistoryEditModal(props);

  MockJerseyHistoryEditModal.displayName = 'MockJerseyHistoryEditModal';
  return MockJerseyHistoryEditModal;
});
jest.mock('./ChangePhotoModal', () => {
  const MockChangePhotoModal = (props: any) => mockChangePhotoModal(props);

  MockChangePhotoModal.displayName = 'MockChangePhotoModal';
  return MockChangePhotoModal;
});
jest.mock('@/components/ImagePreviewModal/ImagePreviewModal', () => ({ open, src, alt }: any) =>
  open ? (
    <div
      role="dialog"
      aria-label="Image Preview"
    >
      <img
        src={src}
        alt={alt ?? ''}
      />
    </div>
  ) : null,
);

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
const mockUseDocumentIcon = useDocumentIcon as jest.Mock;
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
  mockedAxios.get.mockReset();
  mockedAxios.patch.mockReset();
  mockedAxios.post.mockReset();
  mockedToast.loading.mockReturnValue('player-autofill-toast');
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
      league_player_number: '8478402',
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
    updateJerseyHistoryEntry: jest.fn(),
    deleteJerseyHistoryEntry: jest.fn(),
    changePlayerPhoto: jest.fn(),
    deletePlayerPhoto: jest.fn(),
    uploadStintPhoto: jest.fn(),
    saving: false,
  });
  mockUseTeams.mockReturnValue({ teams: [] });
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
        name: '2023-24',
        start_date: '2023-10-01',
        created_at: '2023-01-01T00:00:00Z',
      },
    ],
  });
});

describe('PlayerDetails info tab', () => {
  it("sets the browser title to the player's full name", () => {
    const { unmount } = render(<PlayerDetails />);

    expect(document.title).toBe('John Smith');

    unmount();

    expect(document.title).toBe('Hockey Tracker');
  });

  it("uses the player's team logo as the favicon on league-scoped player routes", () => {
    mockUsePlayerRouteLookup.mockReturnValue({
      routeLookup: {
        player_id: 'player-1',
        team_id: null,
        league_id: 'league-1',
        league_code: 'NHL',
        team_code: null,
        player_slug: '8478402',
      },
      loading: false,
    });
    mockUseTeamDetails.mockReturnValue({ team: null });
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8478402',
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
        team_id: 'team-1',
        team_name: 'Toronto Maple Leafs',
        team_code: 'TOR',
        team_logo: '/leafs-logo.png',
        team_logo_dark: '/leafs-dark.png',
        team_logo_light: '/leafs-light.png',
      },
      stats: [],
      loading: false,
    });

    render(<PlayerDetails />);

    expect(mockUseDocumentIcon).toHaveBeenCalledWith('/leafs-logo.png');
  });

  it('renders the titled player info card and combined selected-season stats section', () => {
    const { container } = render(<PlayerDetails />);

    expect(screen.getByText('Player Info')).toBeInTheDocument();
    const identityRow = container.querySelector('.infoPrimaryRow') as HTMLElement;
    expect(within(identityRow).getByText('League Player Number')).toBeInTheDocument();
    expect(within(identityRow).getByText('8478402')).toBeInTheDocument();
    expect(within(identityRow).getByText('Rookie Season')).toBeInTheDocument();
    expect(container.querySelector('.infoPrimaryDivider')).toBeInTheDocument();
    expect(screen.getByText('Season Stats')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('2023-24');
    expect(screen.getByText('Regular Season')).toBeInTheDocument();
    expect(screen.getByText('Playoffs')).toBeInTheDocument();
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

  it('shows the active or retired tag in the hero status area', () => {
    const { container, rerender } = render(<PlayerDetails />);

    expect(screen.getByRole('heading', { name: 'John Smith' })).toBeInTheDocument();
    expect(container.querySelector('.heroStatus')).toHaveTextContent('Active');
    expect(
      within(container.querySelector('.heroTitleRow') as HTMLElement).queryByText('Active'),
    ).not.toBeInTheDocument();

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

    expect(container.querySelector('.heroStatus')).toHaveTextContent('Retired');
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
  });

  it('labels the team history tab as history and renders stint history accordions', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
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
          jersey_number: 91,
          is_prospect: false,
          position: 'C',
          acquisition_type: 'trade',
          start_date: '2024-10-01',
          end_date: null,
          photo: '/photo.jpg',
          has_stats: false,
          can_delete: true,
        },
      ],
    });
    mockUseJerseyHistory.mockReturnValue({
      byStint: {
        'stint-1': [
          {
            id: 'jersey-1',
            player_teams_id: 'stint-1',
            jersey_number: 19,
            effective_from: '2024-10-01',
          },
          {
            id: 'jersey-2',
            player_teams_id: 'stint-1',
            jersey_number: 91,
            effective_from: '2025-01-05',
          },
        ],
      },
    });
    mockUsePlayerPhotoHistory.mockReturnValue({
      photos: [
        {
          id: 'photo-1',
          player_id: 'player-1',
          team_id: 'team-1',
          season_id: 'season-1',
          photo: '/photo.jpg',
          created_at: '2025-01-01T00:00:00Z',
          season_name: '2024-25',
          team_name: 'Toronto Maple Leafs',
        },
      ],
      byTeam: {
        'team-1': [
          {
            id: 'photo-1',
            player_id: 'player-1',
            team_id: 'team-1',
            season_id: 'season-1',
            photo: '/photo.jpg',
            created_at: '2025-01-01T00:00:00Z',
            season_name: '2024-25',
            team_name: 'Toronto Maple Leafs',
          },
        ],
      },
    });

    const { container } = render(<PlayerDetails />);

    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.queryByText('Team History')).not.toBeInTheDocument();
    const historyList = container.querySelector('.stintList') as HTMLElement;
    const stintAccordion = within(historyList)
      .getByText('Toronto Maple Leafs')
      .closest('.stintAccordion') as HTMLElement;
    expect(stintAccordion).toBeInTheDocument();
    expect(stintAccordion).toHaveClass('headerLight');
    expect(stintAccordion).not.toHaveClass('item');
    expect(stintAccordion.querySelector('.stintHeaderLabelWrap')).toBeInTheDocument();
    expect(stintAccordion.querySelector('.stintHeaderAccordionLabel')).toBeInTheDocument();
    expect(within(stintAccordion).getByText('logo')).toHaveAttribute('data-size', '32');
    expect(screen.queryByText('Jersey Numbers')).not.toBeInTheDocument();

    await user.click(within(stintAccordion).getByRole('button', { name: 'Expand' }));

    const sectionTitles = within(stintAccordion)
      .getAllByText(/Season Photos|Jersey Numbers/)
      .map((node) => node.textContent);
    expect(sectionTitles).toEqual(['Season Photos', 'Jersey Numbers']);
    expect(within(stintAccordion).getByText('Jersey Numbers')).toBeInTheDocument();
    expect(within(stintAccordion).queryByText('Assumed')).not.toBeInTheDocument();

    const currentJerseyItem = within(stintAccordion)
      .getByText('Jan 5, 2025 - Present')
      .closest('li') as HTMLElement;
    expect(within(currentJerseyItem).getByText('91')).toHaveClass('chip');
    expect(within(currentJerseyItem).getByText('Jan 5, 2025 - Present')).toHaveClass('name');
    expect(within(currentJerseyItem).getByText('Current')).toHaveClass('tag', 'success');
    expect(currentJerseyItem).toHaveClass('itemCompact');

    await user.click(
      within(currentJerseyItem).getByRole('button', { name: 'Edit jersey number change' }),
    );
    expect(mockJerseyHistoryEditModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        entry: expect.objectContaining({
          id: 'jersey-2',
          player_teams_id: 'stint-1',
          jersey_number: 91,
          effective_from: '2025-01-05',
        }),
        updateJerseyHistoryEntry: expect.any(Function),
      }),
    );

    const startingJerseyItem = within(stintAccordion)
      .getByText('Oct 1, 2024 - Jan 4, 2025')
      .closest('li') as HTMLElement;
    expect(within(startingJerseyItem).getByText('19')).toHaveClass('chip');
    expect(within(startingJerseyItem).getByText('Oct 1, 2024 - Jan 4, 2025')).toHaveClass('name');
    expect(within(startingJerseyItem).queryByText('Past')).not.toBeInTheDocument();
    expect(startingJerseyItem).toHaveClass('itemCompact');

    await user.click(
      within(startingJerseyItem).getByRole('button', { name: 'Edit jersey number change' }),
    );
    expect(mockJerseyHistoryEditModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        entry: expect.objectContaining({
          id: 'jersey-1',
          player_teams_id: 'stint-1',
          jersey_number: 19,
          effective_from: '2024-10-01',
        }),
        updateJerseyHistoryEntry: expect.any(Function),
      }),
    );

    expect(within(stintAccordion).getByText('Season Photos')).toBeInTheDocument();
    const photoItem = within(stintAccordion).getByRole('button', {
      name: 'Preview 2024-25 photo',
    });
    expect(within(photoItem).queryByText('Season Photo')).not.toBeInTheDocument();
    expect(within(photoItem).getByText('2024-25')).toHaveClass('name');
    expect(within(photoItem).getByText('Current')).toHaveClass('tag', 'success');
    expect(within(photoItem).queryByText('Toronto Maple Leafs')).not.toBeInTheDocument();
    expect(photoItem).toHaveClass('itemCompact');

    const editSeasonPhotoButton = within(photoItem).getByRole('button', {
      name: 'Edit season photo',
    });
    expect(editSeasonPhotoButton).toBeEnabled();

    await user.click(editSeasonPhotoButton);
    expect(screen.queryByRole('dialog', { name: 'Image Preview' })).not.toBeInTheDocument();
    expect(mockChangePhotoModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        stint: expect.objectContaining({ id: 'stint-1' }),
        initialSeasonId: 'season-1',
        mode: 'edit',
        history: expect.arrayContaining([
          expect.objectContaining({
            id: 'photo-1',
            season_id: 'season-1',
            photo: '/photo.jpg',
          }),
        ]),
      }),
    );

    await user.click(photoItem);

    expect(screen.getByRole('dialog', { name: 'Image Preview' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'John Smith' })).toHaveAttribute('src', '/photo.jpg');
  });

  it('does not add an assumed current jersey row when saved history exists', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
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
          jersey_number: 28,
          is_prospect: false,
          position: 'C',
          acquisition_type: 'trade',
          start_date: '2025-10-07',
          end_date: null,
          photo: null,
          has_stats: false,
          can_delete: true,
        },
      ],
    });
    mockUseJerseyHistory.mockReturnValue({
      byStint: {
        'stint-1': [
          {
            id: 'jersey-original',
            player_teams_id: 'stint-1',
            jersey_number: 71,
            effective_from: '2026-02-20',
          },
          {
            id: 'jersey-current',
            player_teams_id: 'stint-1',
            jersey_number: 28,
            effective_from: '2026-03-06',
          },
        ],
      },
    });

    const { container } = render(<PlayerDetails />);
    const historyList = container.querySelector('.stintList') as HTMLElement;
    const stintAccordion = within(historyList)
      .getByText('Toronto Maple Leafs')
      .closest('.stintAccordion') as HTMLElement;

    await user.click(within(stintAccordion).getByRole('button', { name: 'Expand' }));

    const jerseySection = within(stintAccordion)
      .getByText('Jersey Numbers')
      .closest('.stintHistorySection') as HTMLElement;
    expect(within(jerseySection).getAllByRole('listitem')).toHaveLength(2);
    expect(within(jerseySection).getByText('Mar 6, 2026 - Present')).toBeInTheDocument();
    expect(within(jerseySection).getByText('Feb 20, 2026 - Mar 5, 2026')).toBeInTheDocument();
    expect(within(jerseySection).queryByText('Oct 7, 2025 - Feb 19, 2026')).not.toBeInTheDocument();
  });

  it('deletes season photo and jersey number records from history rows', async () => {
    const user = userEvent.setup();
    const deleteJerseyHistoryEntry = jest.fn().mockResolvedValue(true);
    const deletePlayerPhoto = jest.fn().mockResolvedValue(true);
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUseJerseyHistory.mockReturnValue({
      byStint: {
        'stint-1': [
          {
            id: 'jersey-1',
            player_teams_id: 'stint-1',
            jersey_number: 19,
            effective_from: '2024-10-01',
          },
        ],
      },
    });
    mockUsePlayerPhotoHistory.mockReturnValue({
      photos: [
        {
          id: 'photo-1',
          player_id: 'player-1',
          team_id: 'team-1',
          season_id: 'season-1',
          photo: '/photo.jpg',
          created_at: '2025-01-01T00:00:00Z',
          season_name: '2024-25',
          team_name: 'Toronto Maple Leafs',
        },
      ],
      byTeam: {
        'team-1': [
          {
            id: 'photo-1',
            player_id: 'player-1',
            team_id: 'team-1',
            season_id: 'season-1',
            photo: '/photo.jpg',
            created_at: '2025-01-01T00:00:00Z',
            season_name: '2024-25',
            team_name: 'Toronto Maple Leafs',
          },
        ],
      },
    });
    mockUseStintActions.mockReturnValue({
      createStint: jest.fn(),
      updateStint: jest.fn(),
      deleteStint: jest.fn(),
      changeJerseyNumber: jest.fn(),
      updateJerseyHistoryEntry: jest.fn(),
      deleteJerseyHistoryEntry,
      changePlayerPhoto: jest.fn(),
      deletePlayerPhoto,
      uploadStintPhoto: jest.fn(),
      saving: false,
    });

    const { container } = render(<PlayerDetails />);
    const historyList = container.querySelector('.stintList') as HTMLElement;
    const stintAccordion = within(historyList)
      .getByText('Toronto Maple Leafs')
      .closest('.stintAccordion') as HTMLElement;

    await user.click(within(stintAccordion).getByRole('button', { name: 'Expand' }));

    const photoItem = within(stintAccordion).getByRole('button', {
      name: 'Preview 2024-25 photo',
    });
    await user.click(within(photoItem).getByRole('button', { name: 'Delete season photo' }));
    await user.click(screen.getByRole('button', { name: 'Delete Season Photo' }));

    await waitFor(() => expect(deletePlayerPhoto).toHaveBeenCalledWith('photo-1'));

    const jerseySection = within(stintAccordion)
      .getByText('Jersey Numbers')
      .closest('.stintHistorySection') as HTMLElement;
    const jerseyItem = within(jerseySection)
      .getByText('Oct 1, 2024 - Present')
      .closest('li') as HTMLElement;
    await user.click(
      within(jerseyItem).getByRole('button', { name: 'Delete jersey number change' }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete Jersey Number Change' }));

    await waitFor(() => expect(deleteJerseyHistoryEntry).toHaveBeenCalledWith('jersey-1'));
  });

  it('shows edit actions for jersey records from every collapsed same-team stint', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'current-stint',
          player_id: 'player-1',
          team_id: 'team-1',
          season_id: 'season-2',
          roster_player_team_id: 'roster-current',
          team: {
            id: 'team-1',
            name: 'Toronto Maple Leafs',
            code: 'TOR',
            logo: null,
            primary_color: '#003e7e',
            text_color: '#ffffff',
          },
          jersey_number: 91,
          is_prospect: false,
          position: 'C',
          acquisition_type: 'trade',
          start_date: '2025-10-01',
          end_date: null,
          photo: null,
          has_stats: false,
          can_delete: true,
          created_at: '2025-10-01T00:00:00Z',
        },
        {
          id: 'older-stint',
          player_id: 'player-1',
          team_id: 'team-1',
          season_id: 'season-1',
          roster_player_team_id: 'roster-older',
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
          end_date: '2025-06-01',
          photo: null,
          has_stats: false,
          can_delete: true,
          created_at: '2024-10-01T00:00:00Z',
        },
      ],
    });
    mockUseJerseyHistory.mockReturnValue({
      byStint: {
        'roster-current': [
          {
            id: 'jersey-current',
            player_teams_id: 'roster-current',
            jersey_number: 91,
            effective_from: '2025-10-01',
          },
        ],
        'roster-older': [
          {
            id: 'jersey-older',
            player_teams_id: 'roster-older',
            jersey_number: 19,
            effective_from: '2024-10-01',
          },
        ],
      },
    });

    const { container } = render(<PlayerDetails />);
    const historyList = container.querySelector('.stintList') as HTMLElement;
    const stintAccordion = within(historyList)
      .getByText('Toronto Maple Leafs')
      .closest('.stintAccordion') as HTMLElement;

    await user.click(within(stintAccordion).getByRole('button', { name: 'Expand' }));

    const currentJerseyItem = within(stintAccordion)
      .getByText('Oct 1, 2025 - Present')
      .closest('li') as HTMLElement;
    await user.click(
      within(currentJerseyItem).getByRole('button', { name: 'Edit jersey number change' }),
    );
    expect(mockJerseyHistoryEditModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        entry: expect.objectContaining({
          id: 'jersey-current',
          player_teams_id: 'roster-current',
        }),
      }),
    );

    const olderJerseyItem = within(stintAccordion)
      .getByText('Oct 1, 2024 - Sep 30, 2025')
      .closest('li') as HTMLElement;
    await user.click(
      within(olderJerseyItem).getByRole('button', { name: 'Edit jersey number change' }),
    );
    expect(mockJerseyHistoryEditModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        entry: expect.objectContaining({
          id: 'jersey-older',
          player_teams_id: 'roster-older',
        }),
      }),
    );
  });

  it('shows the set team photo header action when an eligible season is missing a photo', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUseTeams.mockReturnValue({
      teams: [{ id: 'team-1', code: 'TOR', league_id: 'league-1' }],
    });
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-1',
          league_id: 'league-1',
          name: '2024-25',
          start_date: '2024-10-01',
          end_date: '2025-06-30',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'season-2',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          end_date: null,
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
    });
    mockUsePlayerPhotoHistory.mockReturnValue({
      photos: [
        {
          id: 'photo-1',
          player_id: 'player-1',
          team_id: 'team-1',
          season_id: 'season-1',
          photo: '/photo.jpg',
          created_at: '2025-01-01T00:00:00Z',
          season_name: '2024-25',
          team_name: 'Toronto Maple Leafs',
        },
      ],
      byTeam: {
        'team-1': [
          {
            id: 'photo-1',
            player_id: 'player-1',
            team_id: 'team-1',
            season_id: 'season-1',
            photo: '/photo.jpg',
            created_at: '2025-01-01T00:00:00Z',
            season_name: '2024-25',
            team_name: 'Toronto Maple Leafs',
          },
        ],
      },
    });

    const { container } = render(<PlayerDetails />);
    const historyList = container.querySelector('.stintList') as HTMLElement;
    const stintAccordion = within(historyList)
      .getByText('Toronto Maple Leafs')
      .closest('.stintAccordion') as HTMLElement;

    await user.click(within(stintAccordion).getByRole('button', { name: 'Set team photo' }));

    expect(mockChangePhotoModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        stint: expect.objectContaining({ id: 'stint-1' }),
        initialSeasonId: 'season-2',
        mode: 'set',
      }),
    );
  });

  it('marks only the photo and jersey number used in the hero as current', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'stint-current',
          team_id: 'team-2',
          season_id: 'season-2',
          team: {
            id: 'team-2',
            name: 'Colorado Avalanche',
            code: 'COL',
            logo: null,
            primary_color: '#6f263d',
            text_color: '#ffffff',
          },
          jersey_number: 91,
          is_prospect: false,
          position: 'C',
          acquisition_type: 'trade',
          start_date: '2026-03-06',
          end_date: null,
          photo: '/avs-photo.jpg',
          has_stats: false,
          can_delete: true,
        },
        {
          id: 'stint-past',
          team_id: 'team-1',
          season_id: 'season-1',
          team: {
            id: 'team-1',
            name: 'Calgary Flames',
            code: 'CGY',
            logo: null,
            primary_color: '#c8102e',
            text_color: '#ffd200',
          },
          jersey_number: 91,
          is_prospect: false,
          position: 'C',
          acquisition_type: 'free_agent',
          start_date: '2022-08-18',
          end_date: '2026-03-06',
          photo: '/flames-photo.jpg',
          has_stats: false,
          can_delete: true,
        },
      ],
    });
    mockUsePlayerPhotoHistory.mockReturnValue({
      photos: [
        {
          id: 'photo-current',
          player_id: 'player-1',
          team_id: 'team-2',
          season_id: 'season-2',
          photo: '/avs-photo.jpg',
          created_at: '2026-03-06T00:00:00Z',
          season_name: '2025-26',
          team_name: 'Colorado Avalanche',
        },
        {
          id: 'photo-past',
          player_id: 'player-1',
          team_id: 'team-1',
          season_id: 'season-1',
          photo: '/flames-photo.jpg',
          created_at: '2025-10-01T00:00:00Z',
          season_name: '2025-26',
          team_name: 'Calgary Flames',
        },
      ],
      byTeam: {
        'team-2': [
          {
            id: 'photo-current',
            player_id: 'player-1',
            team_id: 'team-2',
            season_id: 'season-2',
            photo: '/avs-photo.jpg',
            created_at: '2026-03-06T00:00:00Z',
            season_name: '2025-26',
            team_name: 'Colorado Avalanche',
          },
        ],
        'team-1': [
          {
            id: 'photo-past',
            player_id: 'player-1',
            team_id: 'team-1',
            season_id: 'season-1',
            photo: '/flames-photo.jpg',
            created_at: '2025-10-01T00:00:00Z',
            season_name: '2025-26',
            team_name: 'Calgary Flames',
          },
        ],
      },
    });

    const { container } = render(<PlayerDetails />);
    const historyList = container.querySelector('.stintList') as HTMLElement;
    const currentAccordion = within(historyList)
      .getByText('Colorado Avalanche')
      .closest('.stintAccordion') as HTMLElement;
    const pastAccordion = within(historyList)
      .getByText('Calgary Flames')
      .closest('.stintAccordion') as HTMLElement;

    await user.click(within(currentAccordion).getByRole('button', { name: 'Expand' }));
    await user.click(within(pastAccordion).getByRole('button', { name: 'Expand' }));

    const currentPhotoItem = within(currentAccordion).getByRole('button', {
      name: 'Preview 2025-26 photo',
    });
    expect(within(currentPhotoItem).getByText('Current')).toHaveClass('tag', 'success');

    const currentJerseyItem = within(currentAccordion)
      .getAllByText('Mar 6, 2026 - Present')
      .map((node) => node.closest('li') as HTMLElement | null)
      .find((node): node is HTMLElement => node?.classList.contains('itemCompact') ?? false);
    expect(currentJerseyItem).toBeDefined();
    expect(within(currentJerseyItem).getByText('Current')).toHaveClass('tag', 'success');

    const pastPhotoItem = within(pastAccordion).getByRole('button', {
      name: 'Preview 2025-26 photo',
    });
    expect(within(pastPhotoItem).queryByText('Past')).not.toBeInTheDocument();

    const pastJerseyItem = within(pastAccordion)
      .getAllByText('Aug 18, 2022 - Mar 6, 2026')
      .map((node) => node.closest('li') as HTMLElement | null)
      .find((node): node is HTMLElement => node?.classList.contains('itemCompact') ?? false);
    expect(pastJerseyItem).toBeDefined();
    expect(within(pastJerseyItem).queryByText('Past')).not.toBeInTheDocument();
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

  it('uses a progress toast and saves NHL birth state with the birth city during autofill', async () => {
    const user = userEvent.setup();
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        firstName: { default: 'John' },
        lastName: { default: 'Smith' },
        birthDate: '1997-01-13',
        birthCity: { default: 'Mississauga' },
        birthStateProvince: { default: 'Ontario' },
        birthCountry: 'CAN',
        currentTeamAbbrev: 'TOR',
        sweaterNumber: 19,
        position: 'C',
      },
    });
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Auto-fill Player Data' }));

    await waitFor(() =>
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        '/api/admin/players/player-1',
        expect.objectContaining({
          birth_city: 'Mississauga, Ontario',
          birth_country: 'CAN',
        }),
        expect.any(Object),
      ),
    );

    expect(mockedToast.loading).toHaveBeenCalledWith(
      'Auto-filling player data: fetching NHL player...',
      expect.objectContaining({
        autoClose: false,
        hideProgressBar: false,
        progress: 0,
        progressClassName: 'autoFillProgressBar',
      }),
    );
    await waitFor(() =>
      expect(mockedToast.update).toHaveBeenCalledWith(
        'player-autofill-toast',
        expect.objectContaining({
          render: 'Player data auto-filled.',
          type: 'success',
          isLoading: false,
          hideProgressBar: true,
          progress: 1,
          progressClassName: 'autoFillProgressBar',
        }),
      ),
    );
    expect(mockedToast.success).not.toHaveBeenCalledWith('Player data auto-filled.');
  });

  it('records NHL autofill jersey changes through dated jersey history', async () => {
    const user = userEvent.setup();
    const updateStint = jest.fn().mockResolvedValue(true);
    const changeJerseyNumber = jest.fn().mockResolvedValue(true);
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8470000',
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
    mockUseTeams.mockReturnValue({
      teams: [{ id: 'team-1', code: 'TOR', league_id: 'league-1' }],
    });
    mockUseStintActions.mockReturnValue({
      createStint: jest.fn(),
      updateStint,
      deleteStint: jest.fn(),
      changeJerseyNumber,
      updateJerseyHistoryEntry: jest.fn(),
      changePlayerPhoto: jest.fn(),
      uploadStintPhoto: jest.fn(),
      saving: false,
    });
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        firstName: { default: 'John' },
        lastName: { default: 'Smith' },
        currentTeamAbbrev: 'TOR',
        sweaterNumber: 91,
        jerseyNumberEffectiveDate: '2025-01-05',
        position: 'C',
        isActive: false,
      },
    });
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Auto-fill Player Data' }));

    await waitFor(() =>
      expect(changeJerseyNumber).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'stint-1' }),
        91,
        '2025-01-05',
      ),
    );
    const playerPatch = mockedAxios.patch.mock.calls.find(
      ([url]) => url === '/api/admin/players/player-1',
    );
    expect(playerPatch?.[1]).not.toHaveProperty('status');
    expect(updateStint).not.toHaveBeenCalledWith(
      'stint-1',
      expect.objectContaining({ jersey_number: 91 }),
    );
  });

  it('infers NHL autofill jersey change date from the first game with the new number', async () => {
    const user = userEvent.setup();
    const changeJerseyNumber = jest.fn().mockResolvedValue(true);
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8470000',
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
    mockUseTeams.mockReturnValue({
      teams: [{ id: 'team-1', code: 'TOR', league_id: 'league-1' }],
    });
    mockUseStintActions.mockReturnValue({
      createStint: jest.fn(),
      updateStint: jest.fn(),
      deleteStint: jest.fn(),
      changeJerseyNumber,
      updateJerseyHistoryEntry: jest.fn(),
      changePlayerPhoto: jest.fn(),
      uploadStintPhoto: jest.fn(),
      saving: false,
    });
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          firstName: { default: 'John' },
          lastName: { default: 'Smith' },
          currentTeamAbbrev: 'TOR',
          sweaterNumber: 91,
          position: 'C',
        },
      })
      .mockResolvedValueOnce({
        data: {
          gameLog: [
            { gameId: 2025020001, gameDate: '2025-01-03', teamAbbrev: 'TOR' },
            { gameId: 2025020002, gameDate: '2025-01-05', teamAbbrev: 'TOR' },
          ],
        },
      })
      .mockResolvedValueOnce({ data: { gameLog: [] } })
      .mockResolvedValueOnce({
        data: {
          gameDate: '2025-01-03',
          awayTeam: { abbrev: 'TOR' },
          playerByGameStats: {
            awayTeam: {
              forwards: [{ playerId: 8470000, sweaterNumber: 19 }],
              defense: [],
              goalies: [],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          gameDate: '2025-01-05',
          awayTeam: { abbrev: 'TOR' },
          playerByGameStats: {
            awayTeam: {
              forwards: [{ playerId: 8470000, sweaterNumber: 91 }],
              defense: [],
              goalies: [],
            },
          },
        },
      });
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Auto-fill Player Data' }));

    await waitFor(() =>
      expect(changeJerseyNumber).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'stint-1' }),
        91,
        '2025-01-05',
      ),
    );
  });

  it('retires a player from the more actions menu with a retirement date', async () => {
    const user = userEvent.setup();
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Retire Player' }));

    expect(screen.getByRole('heading', { name: 'Retire Player' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Retirement Date/)).toBeInTheDocument();
    fireEvent.submit(document.getElementById('retire-player-form') as HTMLFormElement);

    await waitFor(() =>
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        '/api/admin/players/player-1/retire',
        { retirement_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
        expect.any(Object),
      ),
    );
  });

  it('unretires retired players from the more actions menu', async () => {
    const user = userEvent.setup();
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8478402',
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
        status: 'retired',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.queryByRole('button', { name: 'Retire Player' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unretire Player' }));

    await waitFor(() =>
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        '/api/admin/players/player-1/unretire',
        {},
        expect.any(Object),
      ),
    );
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
      updateJerseyHistoryEntry: jest.fn(),
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
    expect(result[0].collapsed_stints.map((item) => item.id)).toEqual(['newer', 'older']);
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
