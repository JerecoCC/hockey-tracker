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
import useLeagueDraftDates from '@/hooks/useLeagueDraftDates';
import {
  useJerseyHistory,
  usePlayerPhotoHistory,
  usePlayerTradeHistory,
  useStintActions,
} from '@/hooks/useTeamPlayers';
import PlayerDetails, {
  buildManualMovementStintImport,
  buildCareerStatColumns,
  buildGameLogColumns,
} from './PlayerDetails';
import { collapseSameTeamStints } from './playerStintHistory';

const mockNavigate = jest.fn();
const mockRouteParams = {
  leagueCode: 'nhl',
  teamCode: 'tor',
  playerSlug: 'john-smith',
};
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
  useParams: () => mockRouteParams,
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
jest.mock('@/hooks/useLeagueDraftDates', () => jest.fn());
jest.mock('@/hooks/useTeamPlayers', () => ({
  usePlayerTradeHistory: jest.fn(),
  useJerseyHistory: jest.fn(),
  usePlayerPhotoHistory: jest.fn(),
  useStintActions: jest.fn(),
}));
jest.mock('@/context/BreadcrumbContext', () => ({
  usePageBreadcrumbs: (...args: any[]) => mockUsePageBreadcrumbs(...args),
}));
jest.mock('@jerecocc/tracker-ui/components/Breadcrumbs/Breadcrumbs', () => () => <div />);
jest.mock(
  '@jerecocc/tracker-ui/components/Button/Button',
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
      size = 'medium',
      iconSize: _iconSize,
      iconHeight,
      tooltipClassName: _tooltipClassName,
      tooltipIntent: _tooltipIntent,
      ...rest
    }: any) => (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip ?? (icon === 'edit' ? 'Edit' : icon)}
        data-size={size}
        data-icon-height={iconHeight ?? 'default'}
        data-icon={icon}
        {...rest}
      >
        {children}
      </button>
    ),
);
jest.mock(
  '@jerecocc/tracker-ui/components/Card/Card',
  () =>
    ({ title, action, className, children }: any) => (
      <div className={className}>
        {title}
        {action}
        {children}
      </div>
    ),
);
jest.mock(
  '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal',
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
jest.mock(
  '@jerecocc/tracker-ui/components/Modal/Modal',
  () =>
    ({
      open,
      title,
      children,
      onClose,
      cancelLabel = 'Close',
      confirmLabel = 'Save',
      confirmForm,
      onConfirm,
      confirmDisabled,
    }: any) =>
      open ? (
        <div
          role="dialog"
          aria-label={title}
        >
          <h2>{title}</h2>
          {children}
          <button onClick={onClose}>{cancelLabel}</button>
          {(confirmForm || onConfirm) && (
            <button
              type={confirmForm ? 'submit' : 'button'}
              form={confirmForm}
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      ) : null,
);
jest.mock('@jerecocc/tracker-ui/components/TitleRow/TitleRow', () => ({ left, right }: any) => (
  <div>
    {left}
    {right}
  </div>
));
jest.mock('@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar', () => ({ photo }: any) => (
  <span data-photo={photo ?? ''}>avatar</span>
));
jest.mock('@jerecocc/tracker-ui/components/TeamLogo/TeamLogo', () => ({ size }: any) => (
  <span data-size={size}>logo</span>
));
jest.mock(
  '@jerecocc/tracker-ui/components/InfoTooltip/InfoTooltip',
  () =>
    ({ ariaLabel, text, content }: any) => (
      <span aria-label={ariaLabel ?? text ?? 'Information'}>{content ?? text}</span>
    ),
);
jest.mock(
  '@jerecocc/tracker-ui/components/Table/Table',
  () =>
    ({ columns, rows, getRowKey, emptyMessage, getRowClassName }: any) => (
      <table>
        <thead>
          <tr>
            {columns.map((column: any, index: number) => (
              <th key={index}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row: any, rowIndex: number) => (
              <tr
                key={getRowKey?.(row) ?? rowIndex}
                className={getRowClassName?.(row, rowIndex)}
              >
                {columns.map((column: any, columnIndex: number) => {
                  const content =
                    column.type === 'custom'
                      ? column.render(row)
                      : column.type === 'logo'
                        ? column.getName(row)
                        : row[column.key];
                  return <td key={columnIndex}>{content}</td>;
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    ),
);
jest.mock('@jerecocc/tracker-ui/components/Tabs/Tabs', () => ({ tabs, selectedIndex = 0 }: any) => (
  <div>{tabs[selectedIndex].content}</div>
));
jest.mock(
  '@jerecocc/tracker-ui/components/Tooltip/Tooltip',
  () =>
    ({ children, className }: any) => <span className={className}>{children}</span>,
);
jest.mock('../teams/TeamPlayerEditModal', () => () => null);
jest.mock(
  '../teams/MovePlayerModal',
  () =>
    ({ open }: any) =>
      open ? <div>Move Player Modal</div> : null,
);
jest.mock('./StintEditModal', () => ({
  __esModule: true,
  default: () => null,
  ACQUISITION_TYPE_LABELS: {
    draft: 'Draft',
    free_agency: 'Free Agency',
    trade: 'Trade',
    waivers: 'Waivers',
    team_transfer: 'Team Transfer',
  },
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
jest.mock(
  '@jerecocc/tracker-ui/components/ImagePreviewModal/ImagePreviewModal',
  () =>
    ({ open, src, alt }: any) =>
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
const mockUseLeagueDraftDates = useLeagueDraftDates as jest.Mock;
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
    value: jest.fn().mockImplementation((query: string) => ({
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
  mockRouteParams.leagueCode = 'nhl';
  mockRouteParams.teamCode = 'tor';
  mockRouteParams.playerSlug = 'john-smith';
  mockedAxios.get.mockReset();
  mockedAxios.patch.mockReset();
  mockedAxios.post.mockReset();
  mockedAxios.get.mockResolvedValue({ data: {} });
  mockedToast.loading.mockReturnValue('player-autofill-toast');
  (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
  document.title = 'Hockey Tracker';
  mockUseTabState.mockReturnValue([0, jest.fn()]);
  mockUseLeagueDraftDates.mockReturnValue({ draftDates: [], loading: false });
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
  mockUseJerseyHistory.mockReturnValue({ entries: [], byStint: {} });
  mockUsePlayerPhotoHistory.mockReturnValue({ byTeam: {} });
  mockUseStintActions.mockReturnValue({
    createStint: jest.fn(),
    reconcilePlayerStints: jest.fn(),
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

describe('player career stat columns', () => {
  it('matches goalie career columns to the goalie season stats shown on the info tab', () => {
    const headers = buildCareerStatColumns(true).map((column) => column.header);

    expect(headers).toEqual(['Team', 'Season', '#', 'GP', 'W', 'SO', 'GAA', 'SV%']);
  });

  it('keeps skater career columns unchanged', () => {
    const headers = buildCareerStatColumns(false).map((column) => column.header);

    expect(headers).toEqual(['Team', 'Season', '#', 'GP', 'G', 'A', 'PTS']);
  });
});

describe('player game stat columns', () => {
  const headerText = (header: any) =>
    typeof header === 'string' ? header : (header?.props?.label ?? '');

  it('shows goalie game goals against instead of goals-against average', () => {
    const headers = buildGameLogColumns(true).map((column) => headerText(column.header));

    expect(headers).toEqual(['Date', 'Team', 'Opponent', 'GS', 'SA', 'GA', 'SV%']);
    expect(headers).not.toContain('GAA');
  });
});

describe('PlayerDetails info tab', () => {
  it("sets the browser title to the player's full name", () => {
    const { unmount } = render(<PlayerDetails />);

    expect(document.title).toBe('John Smith');

    unmount();

    expect(document.title).toBe('Hockey Tracker');
  });

  it('replaces a historical jersey-number route with the current canonical slug', async () => {
    mockRouteParams.playerSlug = '16-john-smith';
    mockUsePlayerRouteLookup.mockReturnValue({
      routeLookup: {
        player_id: 'player-1',
        team_id: 'team-1',
        league_id: 'league-1',
        league_code: 'NHL',
        team_code: 'TOR',
        player_slug: '34-john-smith',
      },
      loading: false,
    });

    render(<PlayerDetails />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/admin/leagues/nhl/teams/tor/players/34-john-smith',
        { replace: true },
      );
    });
  });

  it('defaults season stats to the latest ended season the player was part of', () => {
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-2',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          end_date: '2026-06-15',
          created_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 'season-1',
          league_id: 'league-1',
          name: '2024-25',
          start_date: '2024-10-01',
          end_date: '2025-06-15',
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    });

    render(<PlayerDetails />);

    expect(mockUsePlayerCurrentSeasonStats).toHaveBeenCalledWith(
      'player-1',
      expect.objectContaining({
        mode: 'admin',
        seasonId: 'season-1',
        requireSeasonId: true,
      }),
    );
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

  it('links NHL league player numbers to the NHL player page', () => {
    render(<PlayerDetails />);

    const playerLink = screen.getByRole('link', { name: 'Open league player number 8478402' });
    expect(playerLink).toHaveAttribute('href', 'https://www.nhl.com/utah/player/8478402');
    expect(playerLink).toHaveAttribute('target', '_blank');
    expect(playerLink).toHaveAttribute('rel', 'noreferrer');
    expect(playerLink.parentElement).toHaveClass('infoCellCopyTooltip');
    expect(
      screen.queryByRole('button', { name: 'Copy league player number 8478402' }),
    ).not.toBeInTheDocument();
  });

  it('keeps copying the league player number for PWHL players', async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    mockUsePlayerRouteLookup.mockReturnValue({
      routeLookup: {
        player_id: 'player-1',
        team_id: 'team-1',
        league_id: 'league-1',
        league_code: 'PWHL',
        team_code: 'MIN',
        player_slug: 'lee-stecklein',
      },
      loading: false,
    });

    render(<PlayerDetails />);

    const copyButton = screen.getByRole('button', { name: 'Copy league player number 8478402' });
    expect(copyButton.parentElement).toHaveClass('infoCellCopyTooltip');
    expect(
      screen.queryByRole('link', { name: 'Open league player number 8478402' }),
    ).not.toBeInTheDocument();

    await user.click(copyButton);

    expect(writeText).toHaveBeenCalledWith('8478402');
    expect(mockedToast.success).toHaveBeenCalledWith('League player number copied.');
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
    const activeTag = screen.getByRole('status', { name: 'Active' });
    expect(activeTag).toHaveAttribute('aria-label', 'Active');
    expect(within(activeTag).getByText('ACTIVE')).toBeInTheDocument();
    expect(container.querySelector('.heroStatusTooltip')).not.toBeInTheDocument();
    expect(
      within(container.querySelector('.heroTitleRow') as HTMLElement).queryByText('ACTIVE'),
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

    const retiredTag = screen.getByRole('status', { name: 'Retired' });
    expect(retiredTag).toHaveAttribute('aria-label', 'Retired');
    expect(within(retiredTag).getByText('RETIRED')).toBeInTheDocument();
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
  });

  it('colors the hero position tag by position group', () => {
    const mockLatestPosition = (position: 'C' | 'D' | 'G') => {
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
            position,
            acquisition_type: 'trade',
            start_date: '2024-10-01',
            end_date: null,
            photo: null,
            has_stats: false,
            can_delete: true,
          },
        ],
      });
    };

    const { rerender } = render(<PlayerDetails />);

    expect(screen.getByText('Center')).toHaveClass('tag', 'accent');

    mockLatestPosition('D');
    rerender(<PlayerDetails />);

    expect(screen.getByText('Defense')).toHaveClass('tag', 'info');

    mockLatestPosition('G');
    rerender(<PlayerDetails />);

    expect(screen.getByText('Goalie')).toHaveClass('tag', 'warning');
  });

  it('links the hero team logo and name to the team details page', () => {
    render(<PlayerDetails />);

    expect(screen.getByRole('link', { name: 'View Toronto Maple Leafs details' })).toHaveAttribute(
      'href',
      '/admin/leagues/nhl/teams/tor',
    );
  });

  it('renders team stints and jersey assignments as separate histories', async () => {
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
      entries: [
        {
          id: 'jersey-1',
          player_teams_id: 'stint-1',
          player_id: 'player-1',
          team_id: 'team-1',
          jersey_number: 19,
          effective_from: '2024-10-01',
          effective_to: '2025-01-04',
        },
        {
          id: 'jersey-2',
          player_teams_id: 'stint-1',
          player_id: 'player-1',
          team_id: 'team-1',
          jersey_number: 91,
          effective_from: '2025-01-05',
          effective_to: null,
        },
      ],
      byStint: {
        'stint-1': [
          {
            id: 'jersey-1',
            player_teams_id: 'stint-1',
            player_id: 'player-1',
            team_id: 'team-1',
            jersey_number: 19,
            effective_from: '2024-10-01',
            effective_to: '2025-01-04',
          },
          {
            id: 'jersey-2',
            player_teams_id: 'stint-1',
            player_id: 'player-1',
            team_id: 'team-1',
            jersey_number: 91,
            effective_from: '2025-01-05',
            effective_to: null,
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

    expect(screen.getByText('Team History')).toBeInTheDocument();
    expect(screen.getByText('Jersey Number History')).toBeInTheDocument();
    const historyLists = container.querySelectorAll('.stintList');
    const teamHistoryList = historyLists[0] as HTMLElement;
    const jerseyHistoryList = historyLists[1] as HTMLElement;
    const stintAccordion = within(teamHistoryList)
      .getByText('Toronto Maple Leafs')
      .closest('.stintAccordion') as HTMLElement;
    expect(stintAccordion).toBeInTheDocument();
    expect(stintAccordion).toHaveClass('headerLight');
    expect(stintAccordion).not.toHaveClass('item');
    expect(stintAccordion.querySelector('.stintHeaderLabelWrap')).toBeInTheDocument();
    expect(stintAccordion.querySelector('.stintHeaderAccordionLabel')).toBeInTheDocument();
    expect(within(stintAccordion).getByText('logo')).toHaveAttribute('data-size', '32');
    expect(within(stintAccordion).queryByText('91')).not.toBeInTheDocument();

    const currentJerseyItem = within(jerseyHistoryList)
      .getByText('Jan 5, 2025 - Present')
      .closest('li') as HTMLElement;
    expect(within(currentJerseyItem).getByText('91')).toHaveClass('chip');
    expect(within(currentJerseyItem).queryByText('logo')).not.toBeInTheDocument();
    expect(within(currentJerseyItem).getByText('Jan 5, 2025 - Present')).toHaveClass('name');
    expect(within(currentJerseyItem).queryByText('Toronto Maple Leafs')).not.toBeInTheDocument();
    expect(within(currentJerseyItem).getByText('Current')).toHaveClass('tag', 'success');

    await user.click(within(stintAccordion).getByRole('button', { name: 'Expand' }));

    expect(within(stintAccordion).getByText('Season Photos')).toBeInTheDocument();
    expect(within(stintAccordion).queryByText('Jersey Numbers')).not.toBeInTheDocument();

    await user.click(
      within(currentJerseyItem).getByRole('button', { name: 'Edit jersey number change' }),
    );
    expect(mockJerseyHistoryEditModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        entry: expect.objectContaining({
          id: 'jersey-2',
          jersey_number: 91,
          effective_from: '2025-01-05',
        }),
        updateJerseyHistoryEntry: expect.any(Function),
      }),
    );

    const startingJerseyItem = within(jerseyHistoryList)
      .getByText('Oct 1, 2024 - Jan 4, 2025')
      .closest('li') as HTMLElement;
    expect(within(startingJerseyItem).getByText('19')).toHaveClass('chip');
    expect(within(startingJerseyItem).getByText('Oct 1, 2024 - Jan 4, 2025')).toHaveClass('name');
    expect(within(startingJerseyItem).queryByText('Past')).not.toBeInTheDocument();

    await user.click(
      within(startingJerseyItem).getByRole('button', { name: 'Edit jersey number change' }),
    );
    expect(mockJerseyHistoryEditModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        entry: expect.objectContaining({
          id: 'jersey-1',
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

  it('opens the manual movement report from history and starts with the latest ended season team', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8479369',
        first_name: 'Andrew',
        last_name: 'Peeke',
        photo: null,
        date_of_birth: '1998-03-17',
        birth_city: 'Parkland',
        birth_country: 'USA',
        height_cm: 191,
        weight_lbs: 214,
        position: 'D',
        shoots: 'R',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });
    mockUseTeams.mockReturnValue({
      teams: [
        { id: 'team-bos', name: 'Boston Bruins', code: 'BOS', league_id: 'league-1' },
        { id: 'team-uta', name: 'Utah Mammoth', code: 'UTA', league_id: 'league-1' },
        { id: 'team-cbj', name: 'Columbus Blue Jackets', code: 'CBJ', league_id: 'league-1' },
      ],
    });
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-2026',
          league_id: 'league-1',
          name: '2026-27',
          start_date: '2026-10-01',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'season-2025',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          end_date: '2026-06-30',
          created_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 'season-2024',
          league_id: 'league-1',
          name: '2024-25',
          start_date: '2024-10-01',
          end_date: '2025-06-30',
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    });
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'stint-uta',
          team_id: 'team-uta',
          season_id: 'season-2026',
          team: {
            id: 'team-uta',
            name: 'Utah Mammoth',
            code: 'UTA',
            logo: null,
            primary_color: '#71afe5',
            text_color: '#111111',
          },
          jersey_number: null,
          is_prospect: false,
          position: 'D',
          acquisition_type: 'free_agency',
          start_date: '2026-07-03',
          end_date: null,
          photo: null,
          has_stats: false,
          can_delete: true,
        },
        {
          id: 'stint-bos',
          team_id: 'team-bos',
          season_id: 'season-2025',
          team: {
            id: 'team-bos',
            name: 'Boston Bruins',
            code: 'BOS',
            logo: null,
            primary_color: '#fcb514',
            text_color: '#111111',
          },
          jersey_number: 52,
          is_prospect: false,
          position: 'D',
          acquisition_type: 'trade',
          start_date: '2024-03-08',
          end_date: '2026-07-03',
          photo: null,
          has_stats: false,
          can_delete: true,
        },
        {
          id: 'stint-cbj',
          team_id: 'team-cbj',
          season_id: 'season-2024',
          team: {
            id: 'team-cbj',
            name: 'Columbus Blue Jackets',
            code: 'CBJ',
            logo: null,
            primary_color: '#002654',
            text_color: '#ffffff',
          },
          jersey_number: 2,
          is_prospect: false,
          position: 'D',
          acquisition_type: 'draft',
          start_date: '2019-04-01',
          end_date: '2024-03-08',
          photo: null,
          has_stats: false,
          can_delete: true,
        },
      ],
    });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'PuckPedia source' }));

    expect(screen.getByRole('dialog', { name: 'PuckPedia Source' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Open PuckPedia' })).toHaveAttribute(
      'href',
      'https://puckpedia.com/player/andrew-peeke/transactions?transaction_type=trade,waiver,signing,roster',
    );
    expect(mockedAxios.get).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('PuckPedia transactions text or HTML'), {
      target: {
        value: `
          Date	Type	Teams	Details
          Jul 3, 2026	Signing

          Andrew Peeke signs a 1-Year, $1,000,000 deal with the Mammoth
          Jan 15, 2026	Signing

          Andrew Peeke signs a 2-Year, $4,000,000 deal with the Bruins
          Mar 8, 2024	Trade

          The Boston Bruins acquired Andrew Peeke from the Columbus Blue Jackets for a 2027 3rd round pick and Jakub Zboril
          Mar 8, 2024	Moves

          Peeke was traded to Boston from Columbus in exchange for Jakub Zboril on Friday.
          Sep 28, 2022	Signing

          Andrew Peeke signs a 3-Year, $8,250,000 deal with the Blue Jackets
          Aug 9, 2021	Signing

          Andrew Peeke signs a 2-Year, $1,575,000 deal with the Blue Jackets
          Apr 1, 2019	Signing

          Andrew Peeke signs a 3-Year, $2,749,998 deal with the Blue Jackets
        `,
      },
    });
    await user.click(screen.getByText('Build report'));

    expect(screen.queryByRole('dialog', { name: 'PuckPedia Source' })).not.toBeInTheDocument();
    expect(screen.getByText('Manual Movement Report')).toBeInTheDocument();
    expect(screen.getByText('Acquisition')).toBeInTheDocument();
    expect(screen.getAllByText('Trade').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Free Agency').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Boston Bruins').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Utah Mammoth').length).toBeGreaterThan(0);
    expect(screen.getAllByText('March 8, 2024').length).toBeGreaterThan(0);
    expect(screen.getAllByText('July 3, 2026').length).toBeGreaterThan(0);
    expect(screen.getByText('Present')).toBeInTheDocument();
    expect(screen.queryByText('Signing')).not.toBeInTheDocument();
    expect(screen.queryByText('January 15, 2026')).not.toBeInTheDocument();
    expect(screen.queryByText('September 28, 2022')).not.toBeInTheDocument();
    expect(screen.queryByText('August 9, 2021')).not.toBeInTheDocument();
    expect(screen.queryByText('April 1, 2019')).not.toBeInTheDocument();
    expect(screen.queryByText(/acquired Andrew Peeke/)).not.toBeInTheDocument();
    expect(screen.queryByText(/signs a 3-Year/)).not.toBeInTheDocument();
    const warningMessage = screen.getByText(
      /Utah Mammoth movement occurred after 2025-26, the player's latest played season/i,
    );
    expect(warningMessage.closest('tr')).toBeNull();
    const warningRow = screen
      .getAllByText('Utah Mammoth')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(warningRow).toHaveClass('manualMovementWarningRow');
    expect(screen.queryByRole('columnheader', { name: 'Review' })).not.toBeInTheDocument();
  });

  it('applies reviewed NHL movements to career history in one reconciliation request', async () => {
    const user = userEvent.setup();
    const reconcilePlayerStints = jest.fn().mockResolvedValue({
      actions: [
        {
          import_key: 'nhl_puckpedia:v1:anchor:stint-1',
          action: 'adopt',
        },
        {
          import_key: 'nhl_puckpedia:v1:event:stint-1:1',
          action: 'create',
        },
      ],
      summary: { total: 2, create: 1, update: 0, adopt: 1, unchanged: 0, conflict: 0 },
    });
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUseTeams.mockReturnValue({
      teams: [
        { id: 'team-1', name: 'Toronto Maple Leafs', code: 'TOR', league_id: 'league-1' },
        { id: 'team-nyr', name: 'New York Rangers', code: 'NYR', league_id: 'league-1' },
      ],
    });
    mockUseStintActions.mockReturnValue({
      createStint: jest.fn(),
      reconcilePlayerStints,
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

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'PuckPedia source' }));
    fireEvent.change(screen.getByLabelText('PuckPedia transactions text or HTML'), {
      target: {
        value: `
          Date Type Teams Details
          Mar 6, 2026 Trade

          The New York Rangers acquired John Smith from the Toronto Maple Leafs for Future Considerations
        `,
      },
    });
    await user.click(screen.getByText('Build report'));
    await user.click(screen.getByRole('button', { name: 'Apply reviewed team stints' }));

    const confirmation = screen.getByRole('dialog', { name: 'Apply Team Stints' });
    expect(within(confirmation).getByText(/season rosters are not changed/i)).toBeInTheDocument();
    await user.click(within(confirmation).getByRole('button', { name: 'Apply Team Stints' }));

    await waitFor(() =>
      expect(reconcilePlayerStints).toHaveBeenCalledWith(
        [
          {
            import_key: 'nhl_puckpedia:v1:anchor:stint-1',
            team_id: 'team-1',
            position: 'C',
            acquisition_type: 'trade',
            start_date: '2024-10-01',
            end_date: '2026-03-06',
          },
          {
            import_key: 'nhl_puckpedia:v1:event:stint-1:1',
            team_id: 'team-nyr',
            position: 'C',
            acquisition_type: 'trade',
            start_date: '2026-03-06',
            end_date: null,
          },
        ],
        { source: 'nhl_puckpedia' },
      ),
    );
    expect(mockedToast.success).toHaveBeenCalledWith('2 team stints applied.');
  });

  it('reports waiver claims as the latest team-changing movement', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8476624',
        first_name: 'Barclay',
        last_name: 'Goodrow',
        photo: null,
        date_of_birth: '1993-02-26',
        birth_city: 'Toronto',
        birth_country: 'CAN',
        height_cm: 188,
        weight_lbs: 215,
        position: 'C',
        shoots: 'L',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });
    mockUseTeams.mockReturnValue({
      teams: [
        { id: 'team-sjs', name: 'San Jose Sharks', code: 'SJS', league_id: 'league-1' },
        { id: 'team-nyr', name: 'New York Rangers', code: 'NYR', league_id: 'league-1' },
        { id: 'team-tbl', name: 'Tampa Bay Lightning', code: 'TBL', league_id: 'league-1' },
      ],
    });
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-2025',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          end_date: '2026-06-30',
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
    });
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'stint-sjs',
          team_id: 'team-sjs',
          season_id: 'season-2025',
          team: {
            id: 'team-sjs',
            name: 'San Jose Sharks',
            code: 'SJS',
            logo: null,
            primary_color: '#006d75',
            text_color: '#ffffff',
          },
          jersey_number: 23,
          is_prospect: false,
          position: 'C',
          acquisition_type: 'waivers',
          start_date: '2024-06-19',
          end_date: null,
          photo: null,
          has_stats: false,
          can_delete: true,
        },
      ],
    });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'PuckPedia source' }));

    fireEvent.change(screen.getByLabelText('PuckPedia transactions text or HTML'), {
      target: {
        value: `
          Date	Type	Teams	Details
          Dec 10, 2024	Moves

          Goodrow (upper body) was activated off of injured reserve Tuesday, according to Curtis Pashelka of The San Jose Mercury News.
          Nov 28, 2024	Moves

          Goodrow (upper body) was placed on injured reserve Thursday.
          Jun 19, 2024	Moves

          Goodrow was claimed off waivers by the San Jose Sharks from the New York Rangers on Wednesday, per Chris Johnston of The Athletic.
          Jun 18, 2024	Moves

          Goodrow was placed on waivers Tuesday, Elliotte Friedman of Sportsnet reports.
          Jul 22, 2021	Signing

          Barclay Goodrow signs a 6-Year, $21,850,002 deal with the Rangers
          Jul 17, 2021	Trade

          The New York Rangers acquired Barclay Goodrow from the Tampa Bay Lightning for a 2022 7th Round Pick
          Feb 24, 2020	Trade

          The Tampa Bay Lightning acquired Barclay Goodrow and a 2020 third round pick from the San Jose Sharks for 2020 first round pick and Anthony Greco
          Oct 4, 2018	Signing

          Barclay Goodrow signs a 2-Year, $1,850,000 deal with the Sharks
          Aug 7, 2017	Signing

          Barclay Goodrow signs a 2-Year, $1,300,000 deal with the Sharks
          Mar 6, 2014	Signing

          Barclay Goodrow signs a 3-Year, $1,880,000 deal with the Sharks
        `,
      },
    });
    await user.click(screen.getByText('Build report'));

    const reportSection = screen
      .getByText('Manual Movement Report')
      .closest('.stintHistorySection') as HTMLElement;
    const report = within(reportSection);

    expect(report.getByText('San Jose Sharks')).toBeInTheDocument();
    expect(report.getByText('Waivers')).toBeInTheDocument();
    expect(report.getByText('June 19, 2024')).toBeInTheDocument();
    expect(report.getByText('Present')).toBeInTheDocument();
    expect(report.queryByText('Trade')).not.toBeInTheDocument();
    expect(report.queryByText('Free Agency')).not.toBeInTheDocument();
    expect(report.queryByText('Tampa Bay Lightning')).not.toBeInTheDocument();
    expect(report.queryByText('July 17, 2021')).not.toBeInTheDocument();
    expect(report.queryByText('February 24, 2020')).not.toBeInTheDocument();
    expect(report.queryByText('March 6, 2014')).not.toBeInTheDocument();
  });

  it('uses placed-and-claimed waiver rows for current stint acquisitions', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8481678',
        first_name: 'Brandon',
        last_name: 'Bussi',
        photo: null,
        date_of_birth: '1998-06-25',
        birth_city: 'Sound Beach',
        birth_country: 'USA',
        height_cm: 196,
        weight_lbs: 218,
        position: 'G',
        shoots: 'L',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });
    mockUseTeams.mockReturnValue({
      teams: [
        { id: 'team-car', name: 'Carolina Hurricanes', code: 'CAR', league_id: 'league-1' },
        { id: 'team-fla', name: 'Florida Panthers', code: 'FLA', league_id: 'league-1' },
        { id: 'team-bos', name: 'Boston Bruins', code: 'BOS', league_id: 'league-1' },
      ],
    });
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-2025',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          end_date: '2026-06-30',
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
    });
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'stint-car',
          team_id: 'team-car',
          season_id: 'season-2025',
          team: {
            id: 'team-car',
            name: 'Carolina Hurricanes',
            code: 'CAR',
            logo: null,
            primary_color: '#cc0000',
            text_color: '#ffffff',
          },
          jersey_number: 30,
          is_prospect: false,
          position: 'G',
          acquisition_type: null,
          start_date: '2025-10-07',
          end_date: null,
          photo: null,
          has_stats: false,
          can_delete: true,
        },
      ],
    });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'PuckPedia source' }));

    fireEvent.change(screen.getByLabelText('PuckPedia transactions text or HTML'), {
      target: {
        value: `
          Date	Type	Teams	Details
          Feb 16, 2026	Signing

          Brandon Bussi signs a 3-Year, $5,700,000 deal with the Hurricanes
          Oct 5, 2025	Waiver

          Panthers placed Brandon Bussi on waivers on Oct 4, 2025. Claimed by Hurricanes.
          Oct 5, 2025	Moves

          Carolina claimed Bussi off waivers from Florida on Sunday.
          Oct 4, 2025	Moves

          Bussi was placed on waivers Saturday, per PuckPedia.
          Jul 1, 2025	Signing

          Brandon Bussi signs a 1-Year, $775,000 deal with the Panthers
          Mar 30, 2022	Signing

          Brandon Bussi signs a 1-Year, $825,000 deal with the Bruins
        `,
      },
    });
    await user.click(screen.getByText('Build report'));

    const reportSection = screen
      .getByText('Manual Movement Report')
      .closest('.stintHistorySection') as HTMLElement;
    const report = within(reportSection);
    const carolinaMovementRows = report
      .getAllByText('Carolina Hurricanes')
      .map((node) => node.closest('tr') as HTMLElement | null)
      .filter((row): row is HTMLElement => row !== null);

    expect(carolinaMovementRows).toHaveLength(1);
    expect(
      within(carolinaMovementRows[0])
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Carolina Hurricanes', 'Waivers', 'October 4, 2025', 'Present']);
    expect(report.queryByText('Current stint')).not.toBeInTheDocument();
    expect(report.queryByText('October 7, 2025')).not.toBeInTheDocument();
    expect(report.queryByText('October 5, 2025')).not.toBeInTheDocument();
  });

  it('includes the season-opening team before a later signing to the current team', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8473503',
        first_name: 'James',
        last_name: 'Reimer',
        photo: null,
        date_of_birth: '1988-03-15',
        birth_city: 'Morweena',
        birth_country: 'CAN',
        height_cm: 188,
        weight_lbs: 200,
        position: 'G',
        shoots: 'L',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });
    mockUseTeams.mockReturnValue({
      teams: [
        { id: 'team-ott', name: 'Ottawa Senators', code: 'OTT', league_id: 'league-1' },
        { id: 'team-buf', name: 'Buffalo Sabres', code: 'BUF', league_id: 'league-1' },
        { id: 'team-ana', name: 'Anaheim Ducks', code: 'ANA', league_id: 'league-1' },
        { id: 'team-det', name: 'Detroit Red Wings', code: 'DET', league_id: 'league-1' },
        { id: 'team-sjs', name: 'San Jose Sharks', code: 'SJS', league_id: 'league-1' },
        { id: 'team-car', name: 'Carolina Hurricanes', code: 'CAR', league_id: 'league-1' },
        { id: 'team-fla', name: 'Florida Panthers', code: 'FLA', league_id: 'league-1' },
        { id: 'team-tor', name: 'Toronto Maple Leafs', code: 'TOR', league_id: 'league-1' },
      ],
    });
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-2025',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          end_date: '2026-06-30',
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
    });
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'stint-ott',
          team_id: 'team-ott',
          season_id: 'season-2025',
          team: {
            id: 'team-ott',
            name: 'Ottawa Senators',
            code: 'OTT',
            logo: null,
            primary_color: '#c52032',
            text_color: '#ffffff',
          },
          jersey_number: 47,
          is_prospect: false,
          position: 'G',
          acquisition_type: null,
          start_date: '2025-10-07',
          end_date: null,
          photo: null,
          has_stats: false,
          can_delete: true,
        },
      ],
    });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'PuckPedia source' }));

    fireEvent.change(screen.getByLabelText('PuckPedia transactions text or HTML'), {
      target: {
        value: `
          Date	Type	Teams	Details
          Jan 12, 2026	Signing

          James Reimer signs a 1-Year, $850,000 deal with the Senators
          Jan 9, 2026	Moves

          Reimer agreed to terms on a professional tryout agreement with AHL Belleville on Friday, Darren Dreger of TSN reports.
          Oct 6, 2025	Moves

          Toronto released Reimer from his professional tryout agreement Monday.
          Sep 26, 2025	Moves

          Reimer signed a professional tryout agreement with Toronto on Friday, according to Chris Johnston of The Athletic.
          Nov 13, 2024	Moves

          Reimer was claimed off waivers by Buffalo on Wednesday from Anaheim, Elliotte Friedman of Sportsnet reports.
          Nov 12, 2024	Moves

          Reimer was waived by the Anaheim Ducks on Tuesday, Elliotte Friedman of Sportsnet reports.
          Oct 7, 2024	Moves

          Reimer was claimed off waivers by the Anaheim Ducks on Monday, Elliotte Friedman of Sportsnet reports.
          Oct 6, 2024	Moves

          Reimer was placed on waivers Sunday, per Chris Johnston of The Athletic.
          Jul 2, 2024	Signing

          James Reimer signs a 1-Year, $1,000,000 deal with the Sabres
          Jul 1, 2023	Signing

          James Reimer signs a 1-Year, $1,500,000 deal with the Red Wings
          Dec 12, 2022	Moves

          Reimer (lower body) was removed from injured reserve Monday.
          Nov 28, 2022	Moves

          Reimer (lower body) has been placed on injured reserve Monday, Sheng Peng of San Jose Hockey Now reports.
          Jan 15, 2022	Moves

          Reimer (lower body) was activated from injured reserve and will dress as the backup Saturday against the Pittsburgh Penguins, Curtis Pashelka of The San Jose Mercury News reports.
          Jan 11, 2022	Moves

          Reimer (lower body) was placed on injured reserve Tuesday, per Curtis Pashelka of The San Jose Mercury News.
          Jul 28, 2021	Signing

          James Reimer signs a 2-Year, $4,500,000 deal with the Sharks
          Jun 30, 2019	Trade

          The Florida Panthers acquired Scott Darling from the Carolina Hurricanes for James Reimer and 2020 sixth round pick
          Jul 1, 2016	Signing

          James Reimer signs a 5-Year, $17,000,000 deal with the Panthers
          Jul 26, 2014	Signing

          James Reimer signs a 2-Year, $4,600,000 deal with the Maple Leafs
          Jun 9, 2011	Signing

          James Reimer signs a 3-Year, $5,400,000 deal with the Maple Leafs
          Mar 19, 2008	Signing

          James Reimer signs a 3-Year, $1,790,000 deal with the Maple Leafs
        `,
      },
    });
    await user.click(screen.getByText('Build report'));

    const reportSection = screen
      .getByText('Manual Movement Report')
      .closest('.stintHistorySection') as HTMLElement;
    const report = within(reportSection);
    const movementRows = report
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );

    expect(movementRows).toEqual([
      ['Ottawa Senators', 'Free Agency', 'January 12, 2026', 'Present'],
      ['Buffalo Sabres', 'Waivers', 'November 13, 2024', 'January 12, 2026'],
    ]);
    expect(report.queryByText('Current stint')).not.toBeInTheDocument();
    expect(report.queryByText('October 7, 2025')).not.toBeInTheDocument();
  });

  it('matches apostrophized player names when picking signing acquisition dates', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8482698',
        first_name: 'Charle-Edouard',
        last_name: "D'Astous",
        photo: null,
        date_of_birth: '1998-04-18',
        birth_city: 'Rimouski',
        birth_country: 'CAN',
        height_cm: 191,
        weight_lbs: 205,
        position: 'D',
        shoots: 'L',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });
    mockUseTeams.mockReturnValue({
      teams: [{ id: 'team-tbl', name: 'Tampa Bay Lightning', code: 'TBL', league_id: 'league-1' }],
    });
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-2025',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          end_date: '2026-06-30',
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
    });
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'stint-tbl',
          team_id: 'team-tbl',
          season_id: 'season-2025',
          team: {
            id: 'team-tbl',
            name: 'Tampa Bay Lightning',
            code: 'TBL',
            logo: null,
            primary_color: '#002868',
            text_color: '#ffffff',
          },
          jersey_number: 47,
          is_prospect: false,
          position: 'D',
          acquisition_type: null,
          start_date: '2025-10-07',
          end_date: null,
          photo: null,
          has_stats: false,
          can_delete: true,
        },
      ],
    });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'PuckPedia source' }));

    fireEvent.change(screen.getByLabelText('PuckPedia transactions text or HTML'), {
      target: {
        value: `
          Date	Type	Teams	Details
          Feb 24, 2026	Moves

          D'Astous (lower body) is expected to be an option for Wednesday's home contest against the Toronto Maple Leafs.
          Jan 2, 2026	Signing

          Charle-Edouard D'Astous signs a 1-Year, $875,000 deal with the Lightning
          Oct 20, 2025	Moves

          D'Astous was summoned from AHL Syracuse on Monday.
          May 5, 2025	Signing

          Charle-Edouard D'Astous signs a 1-Year, $775,000 deal with the Lightning
        `,
      },
    });
    await user.click(screen.getByText('Build report'));

    const reportSection = screen
      .getByText('Manual Movement Report')
      .closest('.stintHistorySection') as HTMLElement;
    const report = within(reportSection);
    const movementRows = report
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );

    expect(movementRows).toEqual([
      ['Tampa Bay Lightning', 'Free Agency', 'May 5, 2025', 'Present'],
    ]);
    expect(report.queryByText('Current stint')).not.toBeInTheDocument();
    expect(report.queryByText('October 7, 2025')).not.toBeInTheDocument();
    expect(report.queryByText('January 2, 2026')).not.toBeInTheDocument();
  });

  it('skips same-team signing extensions when only recent PuckPedia transactions are pasted', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUseTeams.mockReturnValue({
      teams: [
        { id: 'team-1', name: 'Toronto Maple Leafs', code: 'TOR', league_id: 'league-1' },
        { id: 'team-uta', name: 'Utah Mammoth', code: 'UTA', league_id: 'league-1' },
      ],
    });
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-1',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          end_date: '2026-06-30',
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
    });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'PuckPedia source' }));

    fireEvent.change(screen.getByLabelText('PuckPedia transactions text or HTML'), {
      target: {
        value: `
          Date	Type	Teams	Details
          Jul 3, 2026	Signing

          Smith signs a 1-Year, $1,000,000 deal with the Mammoth
          Jan 15, 2026	Signing

          Smith signs a 3-Year, $8,250,000 deal with the Maple Leafs
        `,
      },
    });
    await user.click(screen.getByText('Build report'));

    expect(screen.getByText('Manual Movement Report')).toBeInTheDocument();
    expect(screen.queryByText('Signing')).not.toBeInTheDocument();
    expect(screen.queryByText('January 15, 2026')).not.toBeInTheDocument();
    expect(screen.getByText('Current stint')).toBeInTheDocument();
    expect(screen.getByText('Free Agency')).toBeInTheDocument();
    expect(screen.getAllByText('Toronto Maple Leafs').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Utah Mammoth').length).toBeGreaterThan(0);
    expect(screen.getAllByText('July 3, 2026').length).toBeGreaterThan(0);
  });

  it('shows generated season photo rows without delete actions', async () => {
    const user = userEvent.setup();
    const generatedPhoto = 'https://assets.nhle.com/mugs/nhl/20252026/TOR/8478402.png';
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUsePlayerPhotoHistory.mockReturnValue({
      photos: [
        {
          id: null,
          player_id: 'player-1',
          team_id: 'team-1',
          season_id: 'season-1',
          photo: generatedPhoto,
          created_at: null,
          season_name: '2025-26',
          team_name: 'Toronto Maple Leafs',
          has_saved_photo: false,
        },
      ],
      byTeam: {
        'team-1': [
          {
            id: null,
            player_id: 'player-1',
            team_id: 'team-1',
            season_id: 'season-1',
            photo: generatedPhoto,
            created_at: null,
            season_name: '2025-26',
            team_name: 'Toronto Maple Leafs',
            has_saved_photo: false,
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

    const photoItem = within(stintAccordion).getByRole('button', {
      name: 'Preview 2025-26 photo',
    });
    expect(within(photoItem).getByText('avatar')).toHaveAttribute('data-photo', generatedPhoto);
    expect(within(photoItem).queryByRole('button', { name: 'Delete season photo' })).toBeNull();

    await user.click(within(photoItem).getByRole('button', { name: 'Set season photo' }));

    expect(mockChangePhotoModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        stint: expect.objectContaining({ id: 'stint-1' }),
        initialSeasonId: 'season-1',
        mode: 'set',
      }),
    );

    await user.click(photoItem);

    expect(screen.getByRole('dialog', { name: 'Image Preview' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'John Smith' })).toHaveAttribute('src', generatedPhoto);
  });

  it('renders only canonical jersey timeline records', () => {
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
      entries: [
        {
          id: 'jersey-original',
          player_teams_id: 'stint-1',
          player_id: 'player-1',
          team_id: 'team-1',
          jersey_number: 71,
          effective_from: '2026-02-20',
          effective_to: '2026-03-05',
        },
        {
          id: 'jersey-current',
          player_teams_id: 'stint-1',
          player_id: 'player-1',
          team_id: 'team-1',
          jersey_number: 28,
          effective_from: '2026-03-06',
          effective_to: null,
        },
      ],
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

    render(<PlayerDetails />);

    expect(screen.getByText('Mar 6, 2026 - Present')).toBeInTheDocument();
    expect(screen.getByText('Feb 20, 2026 - Mar 5, 2026')).toBeInTheDocument();
    expect(screen.queryByText('Oct 7, 2025 - Feb 19, 2026')).not.toBeInTheDocument();
  });

  it('deletes season photo and jersey number records from history rows', async () => {
    const user = userEvent.setup();
    const deleteJerseyHistoryEntry = jest.fn().mockResolvedValue(true);
    const deletePlayerPhoto = jest.fn().mockResolvedValue(true);
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUseJerseyHistory.mockReturnValue({
      entries: [
        {
          id: 'jersey-1',
          player_teams_id: 'stint-1',
          player_id: 'player-1',
          team_id: 'team-1',
          jersey_number: 19,
          effective_from: '2024-10-01',
          effective_to: null,
        },
      ],
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

    const jerseyItem = screen.getByText('Oct 1, 2024 - Present').closest('li') as HTMLElement;
    await user.click(
      within(jerseyItem).getByRole('button', { name: 'Delete jersey number change' }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete Jersey Number Change' }));

    await waitFor(() => expect(deleteJerseyHistoryEntry).toHaveBeenCalledWith('jersey-1'));
  });

  it('shows edit actions for jersey records independently of collapsed same-team stints', async () => {
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
      entries: [
        {
          id: 'jersey-current',
          player_teams_id: 'roster-current',
          player_id: 'player-1',
          team_id: 'team-1',
          jersey_number: 91,
          effective_from: '2025-10-01',
          effective_to: null,
        },
        {
          id: 'jersey-older',
          player_teams_id: 'roster-older',
          player_id: 'player-1',
          team_id: 'team-1',
          jersey_number: 19,
          effective_from: '2024-10-01',
          effective_to: '2025-09-30',
        },
      ],
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

    render(<PlayerDetails />);

    const currentJerseyItem = screen
      .getByText('Oct 1, 2025 - Present')
      .closest('li') as HTMLElement;
    const editCurrentJerseyButton = within(currentJerseyItem).getByRole('button', {
      name: 'Edit jersey number change',
    });
    expect(editCurrentJerseyButton).toHaveAttribute('data-icon', 'edit');
    await user.click(editCurrentJerseyButton);
    expect(mockJerseyHistoryEditModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        entry: expect.objectContaining({
          id: 'jersey-current',
        }),
      }),
    );

    const olderJerseyItem = screen
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

  it('renders a supported icon for the jersey timeline record action', () => {
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'stint-1',
          team_id: 'team-1',
          season_id: 'season-1',
          roster_player_team_id: 'roster-1',
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

    render(<PlayerDetails />);

    expect(screen.getByRole('button', { name: 'Record Change' })).toHaveAttribute(
      'data-icon',
      'more_time',
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
    mockUseJerseyHistory.mockReturnValue({
      entries: [
        {
          id: 'jersey-current',
          player_teams_id: 'stint-current',
          player_id: 'player-1',
          team_id: 'team-2',
          jersey_number: 91,
          effective_from: '2026-03-06',
          effective_to: null,
        },
        {
          id: 'jersey-past',
          player_teams_id: 'stint-past',
          player_id: 'player-1',
          team_id: 'team-1',
          jersey_number: 91,
          effective_from: '2022-08-18',
          effective_to: '2026-03-06',
        },
      ],
      byStint: {},
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

    const currentJerseyItem = screen
      .getByText('Mar 6, 2026 - Present')
      .closest('li') as HTMLElement;
    expect(within(currentJerseyItem).getByText('Current')).toHaveClass('tag', 'success');

    const pastPhotoItem = within(pastAccordion).getByRole('button', {
      name: 'Preview 2025-26 photo',
    });
    expect(within(pastPhotoItem).queryByText('Past')).not.toBeInTheDocument();

    const pastJerseyItem = screen
      .getByText('Aug 18, 2022 - Mar 6, 2026')
      .closest('li') as HTMLElement;
    expect(within(pastJerseyItem).queryByText('Past')).not.toBeInTheDocument();
  });

  it('moves the move player action into the more actions menu', async () => {
    const user = userEvent.setup();
    const { container } = render(<PlayerDetails />);

    const heroActions = container.querySelector('.heroActions') as HTMLElement;
    const actionButtons = within(heroActions).getAllByRole('button');
    expect(actionButtons[0]).toHaveAccessibleName('Edit player');
    expect(actionButtons[0]).toHaveAttribute('data-size', 'large');
    expect(actionButtons[0]).toHaveAttribute('data-icon-height', 'button');
    expect(actionButtons[1]).toHaveAccessibleName('More actions');
    expect(actionButtons[1]).toHaveClass('trigger');
    expect(actionButtons[1]).toHaveAttribute('data-size', 'large');
    expect(actionButtons[1]).toHaveAttribute('data-icon-height', 'button');

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Move Player' }));

    expect(screen.getByText('Move Player Modal')).toBeInTheDocument();
  });

  it('uses a progress toast and saves NHL birth state with the birth city during autofill', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        isActive: false,
        firstName: { default: 'John' },
        lastName: { default: 'Smith' },
        birthDate: '1997-01-13',
        birthCity: { default: 'Mississauga' },
        birthStateProvince: { default: 'Ontario' },
        birthCountry: 'CAN',
        currentTeamAbbrev: null,
        sweaterNumber: 19,
        position: 'C',
        draftDetails: {
          year: 2013,
          teamAbbrev: 'WPG',
          round: 4,
          overallPick: 104,
        },
      },
    });
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });
    mockUseTeams.mockReturnValue({
      teams: [
        { id: 'team-wpg', name: 'Winnipeg Jets', code: 'WPG', league_id: 'league-1' },
        { id: 'team-nyr', name: 'New York Rangers', code: 'NYR', league_id: 'league-1' },
        { id: 'team-det', name: 'Detroit Red Wings', code: 'DET', league_id: 'league-1' },
        { id: 'team-uta', name: 'Utah Mammoth', code: 'UTA', league_id: 'league-1' },
      ],
    });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Auto-fill Player Data' }));

    await waitFor(() =>
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        '/api/admin/players/player-1',
        expect.objectContaining({
          birth_city: 'Mississauga, Ontario',
          birth_country: 'CAN',
          status: 'inactive',
        }),
        expect.any(Object),
      ),
    );
    expect(mockedAxios.get).toHaveBeenCalledWith(
      '/api/admin/games/nhl-api',
      expect.objectContaining({
        params: { url: 'https://api-web.nhle.com/v1/player/8478402/landing' },
      }),
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
          render: 'Player data auto-filled. Manual movement report ready.',
          type: 'success',
          isLoading: false,
          hideProgressBar: true,
          progress: 1,
          progressClassName: 'autoFillProgressBar',
        }),
      ),
    );
    expect(mockedToast.success).not.toHaveBeenCalledWith('Player data auto-filled.');
    expect(screen.getByRole('dialog', { name: 'PuckPedia Source' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Open PuckPedia' })).toHaveAttribute(
      'href',
      'https://puckpedia.com/player/john-smith/transactions?transaction_type=trade,waiver,signing,roster',
    );
    expect(screen.getByLabelText('PuckPedia transactions text or HTML')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('PuckPedia transactions text or HTML'), {
      target: {
        value: `
          Date	Type	Teams	Details
          Jul 3, 2026	Signing

          Smith signs a 1-Year, $1,000,000 deal with the Mammoth
          Apr 26, 2026	News

          Smith logged a shorthanded assist against the Buffalo Sabres.
          Aug 5, 2024	News

          Smith changes jersey number from #8 to #2.
          Mar 21, 2022	Trade

          The New York Rangers acquired John Smith from the Winnipeg Jets for Future Considerations
        `,
      },
    });
    await user.click(screen.getByText('Build report'));

    expect(screen.queryByRole('dialog', { name: 'PuckPedia Source' })).not.toBeInTheDocument();
    expect(screen.getByText('Draft Year: 2013 | Round: 4')).toBeInTheDocument();
    expect(screen.getByText('Player Status')).toBeInTheDocument();
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
    expect(screen.getByText('Date: -')).toBeInTheDocument();
    expect(screen.getByText('Winnipeg Jets')).toBeInTheDocument();
    expect(screen.getAllByText('New York Rangers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Utah Mammoth').length).toBeGreaterThan(0);
    expect(screen.queryByText('Jersey Number Changes')).not.toBeInTheDocument();
    expect(screen.queryByText(/signs a 1-Year/)).not.toBeInTheDocument();
  });

  it('limits auto-filled manual movement report team lookup to the current NHL league', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        isActive: true,
        firstName: { default: 'Charlie' },
        lastName: { default: 'Coyle' },
        birthDate: '1992-03-02',
        birthCity: { default: 'East Weymouth' },
        birthStateProvince: { default: 'Massachusetts' },
        birthCountry: 'USA',
        currentTeamAbbrev: 'CBJ',
        sweaterNumber: 13,
        position: 'C',
        draftDetails: {
          year: 2010,
          teamAbbrev: 'SJS',
          round: 1,
          overallPick: 28,
        },
      },
    });
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8473419',
        first_name: 'Charlie',
        last_name: 'Coyle',
        photo: null,
        date_of_birth: '1992-03-02',
        birth_city: 'East Weymouth, Massachusetts',
        birth_country: 'USA',
        height_cm: 191,
        weight_lbs: 223,
        position: 'C',
        shoots: 'R',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });
    mockUseTeams.mockReturnValue({
      teams: [
        { id: 'team-pwhl-sjs', name: 'PWHL San Jose', code: 'SJS', league_id: 'league-pwhl' },
        { id: 'team-sjs', name: 'San Jose Sharks', code: 'SJS', league_id: 'league-1' },
        { id: 'team-cbj', name: 'Columbus Blue Jackets', code: 'CBJ', league_id: 'league-1' },
        { id: 'team-col', name: 'Colorado Avalanche', code: 'COL', league_id: 'league-1' },
        { id: 'team-bos', name: 'Boston Bruins', code: 'BOS', league_id: 'league-1' },
        { id: 'team-min', name: 'Minnesota Wild', code: 'MIN', league_id: 'league-1' },
      ],
    });
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-2025',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          end_date: '2026-06-30',
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
    });
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'stint-cbj',
          team_id: 'team-cbj',
          season_id: 'season-2025',
          team: {
            id: 'team-cbj',
            name: 'Columbus Blue Jackets',
            code: 'CBJ',
            logo: null,
            primary_color: '#002654',
            text_color: '#ffffff',
          },
          jersey_number: 13,
          is_prospect: false,
          position: 'C',
          acquisition_type: 'trade',
          start_date: '2025-06-27',
          end_date: null,
          photo: null,
          has_stats: false,
          can_delete: true,
        },
      ],
    });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Auto-fill Player Data' }));

    expect(await screen.findByRole('dialog', { name: 'PuckPedia Source' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('PuckPedia transactions text or HTML'), {
      target: {
        value: `
          Date	Type	Teams	Details
          May 12, 2026	Signing

          Charlie Coyle signs a 6-Year, $36,000,000 deal with the Blue Jackets
          Jun 27, 2025	Trade

          The Columbus Blue Jackets acquired Charlie Coyle and Miles Wood from the Colorado Avalanche for Gavin Brindley, a 2025 3rd round pick (#77) and a 2027 2nd round pick
          Mar 7, 2025	Trade

          The Colorado Avalanche acquired Charlie Coyle and a 2026 5th round pick from the Boston Bruins for Casey Mittelstadt, William Zellers and a 2025 2nd round pick
          Nov 27, 2019	Signing

          Charlie Coyle signs a 6-Year, $31,500,000 deal with the Bruins
          Oct 23, 2014	Signing

          Charlie Coyle signs a 5-Year, $16,000,000 deal with the Wild
          Mar 1, 2012	Signing

          Charlie Coyle signs a 3-Year, $2,700,000 deal with the Wild
        `,
      },
    });
    await user.click(screen.getByText('Build report'));

    const reportSection = screen
      .getByText('Manual Movement Report')
      .closest('.stintHistorySection') as HTMLElement;
    const report = within(reportSection);

    expect(report.getByText('Draft Year: 2010 | Round: 1')).toBeInTheDocument();
    expect(report.getByText('San Jose Sharks')).toBeInTheDocument();
    expect(report.queryByText('PWHL San Jose')).not.toBeInTheDocument();
  });

  it('treats historical NHL franchise aliases as team transfers to the current team', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        isActive: true,
        firstName: { default: 'Clayton' },
        lastName: { default: 'Keller' },
        birthDate: '1998-07-29',
        birthCity: { default: 'Chesterfield' },
        birthStateProvince: { default: 'Missouri' },
        birthCountry: 'USA',
        currentTeamAbbrev: 'UTA',
        sweaterNumber: 9,
        position: 'RW',
        draftDetails: {
          year: 2016,
          teamAbbrev: 'ARI',
          round: 1,
          overallPick: 7,
        },
      },
    });
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8479343',
        first_name: 'Clayton',
        last_name: 'Keller',
        photo: null,
        date_of_birth: '1998-07-29',
        birth_city: 'Chesterfield, Missouri',
        birth_country: 'USA',
        height_cm: 178,
        weight_lbs: 178,
        position: 'RW',
        shoots: 'R',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });
    mockUseTeams.mockReturnValue({
      teams: [{ id: 'team-uta', name: 'Utah Mammoth', code: 'UTA', league_id: 'league-1' }],
    });
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-2025',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          end_date: '2026-06-30',
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
    });
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'stint-uta',
          team_id: 'team-uta',
          season_id: 'season-2025',
          team: {
            id: 'team-uta',
            name: 'Utah Mammoth',
            code: 'UTA',
            logo: null,
            primary_color: '#71afe5',
            text_color: '#111111',
          },
          jersey_number: 9,
          is_prospect: false,
          position: 'RW',
          acquisition_type: null,
          start_date: '2024-04-18',
          end_date: null,
          photo: null,
          has_stats: false,
          can_delete: true,
        },
      ],
    });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Auto-fill Player Data' }));

    expect(await screen.findByRole('dialog', { name: 'PuckPedia Source' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('PuckPedia transactions text or HTML'), {
      target: {
        value: `
          Date	Type	Teams	Details
          Sep 4, 2019	Signing

          [Clayton Keller](https://puckpedia.com/player/clayton-keller) signs an 8-Year, $57,200,000 deal with the [Mammoth](https://puckpedia.com/team/utah-mammoth)
          Mar 26, 2017	Signing

          [Clayton Keller](https://puckpedia.com/player/clayton-keller) signs a 3-Year, $2,657,499 deal with the [Mammoth](https://puckpedia.com/team/utah-mammoth)
        `,
      },
    });
    await user.click(screen.getByText('Build report'));

    const reportSection = screen
      .getByText('Manual Movement Report')
      .closest('.stintHistorySection') as HTMLElement;
    const report = within(reportSection);
    const movementRows = report
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );

    expect(report.getByText('Arizona Coyotes')).toBeInTheDocument();
    expect(report.getByText('Draft Year: 2016 | Round: 1')).toBeInTheDocument();
    expect(report.queryByText('ARI')).not.toBeInTheDocument();
    expect(movementRows).toEqual([['Utah Mammoth', 'Team Transfer', 'April 18, 2024', 'Present']]);
    expect(report.queryByText('Free Agency')).not.toBeInTheDocument();
  });

  it('parses present-tense acquire trades and uses local draft anchor stints', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8480801',
        first_name: 'Brady',
        last_name: 'Tkachuk',
        photo: null,
        date_of_birth: '1999-09-16',
        birth_city: 'Scottsdale',
        birth_country: 'USA',
        height_cm: 193,
        weight_lbs: 221,
        position: 'LW',
        shoots: 'L',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });
    mockUseTeams.mockReturnValue({
      teams: [
        { id: 'team-ott', name: 'Ottawa Senators', code: 'OTT', league_id: 'league-1' },
        { id: 'team-fla', name: 'Florida Panthers', code: 'FLA', league_id: 'league-1' },
      ],
    });
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-2026',
          league_id: 'league-1',
          name: '2026-27',
          start_date: '2026-10-01',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'season-2025',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          end_date: '2026-06-30',
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
    });
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'stint-ott',
          team_id: 'team-ott',
          season_id: 'season-2025',
          team: {
            id: 'team-ott',
            name: 'Ottawa Senators',
            code: 'OTT',
            logo: null,
            primary_color: '#da1a32',
            text_color: '#ffffff',
          },
          jersey_number: 7,
          is_prospect: false,
          position: 'LW',
          acquisition_type: 'draft',
          start_date: '2018-08-13',
          end_date: null,
          photo: null,
          has_stats: false,
          can_delete: true,
        },
      ],
    });
    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'PuckPedia source' }));

    expect(screen.getByRole('dialog', { name: 'PuckPedia Source' })).toBeInTheDocument();
    expect(mockedAxios.get).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('PuckPedia transactions text or HTML'), {
      target: {
        value: `
          Date	Type	Teams	Details
          Jun 21, 2026	Trade

          The Florida Panthers acquire Brady Tkachuk from the Ottawa Senators for a 2026 1st round pick (#9), a 2026 1st round pick (TBL, #25), a conditional 2029 1st round pick and a 2027 2nd round pick
          Oct 14, 2021	Signing

          Brady Tkachuk signs a 7-Year, $57,564,958 deal with the Senators
          Aug 13, 2018	Signing

          Brady Tkachuk signs a 3-Year, $2,775,000 deal with the Senators
        `,
      },
    });
    await user.click(screen.getByText('Build report'));

    const reportSection = screen
      .getByText('Manual Movement Report')
      .closest('.stintHistorySection') as HTMLElement;
    const report = within(reportSection);
    const movementRows = report
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );

    expect(report.queryByText('Draft Year: 2018 | Round: 1')).not.toBeInTheDocument();
    expect(report.queryByText('Free Agency')).not.toBeInTheDocument();
    expect(movementRows).toEqual([
      ['Florida Panthers', 'Trade', 'June 21, 2026', 'Present'],
      ['Ottawa Senators', 'Draft', 'August 13, 2018', 'June 21, 2026'],
    ]);
  });

  it('uses the returning team when the player is traded for acquired assets', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8476967',
        first_name: 'Brett',
        last_name: 'Kulak',
        photo: null,
        date_of_birth: '1994-01-06',
        birth_city: 'Edmonton',
        birth_country: 'CAN',
        height_cm: 188,
        weight_lbs: 197,
        position: 'D',
        shoots: 'L',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });
    mockUseTeams.mockReturnValue({
      teams: [
        { id: 'team-col', name: 'Colorado Avalanche', code: 'COL', league_id: 'league-1' },
        { id: 'team-pit', name: 'Pittsburgh Penguins', code: 'PIT', league_id: 'league-1' },
        { id: 'team-edm', name: 'Edmonton Oilers', code: 'EDM', league_id: 'league-1' },
        { id: 'team-mtl', name: 'Montreal Canadiens', code: 'MTL', league_id: 'league-1' },
      ],
    });
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-2025',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          end_date: '2026-06-30',
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
    });
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'stint-col',
          team_id: 'team-col',
          season_id: 'season-2025',
          team: {
            id: 'team-col',
            name: 'Colorado Avalanche',
            code: 'COL',
            logo: null,
            primary_color: '#6f263d',
            text_color: '#ffffff',
          },
          jersey_number: 27,
          is_prospect: false,
          position: 'D',
          acquisition_type: 'trade',
          start_date: '2026-02-24',
          end_date: null,
          photo: null,
          has_stats: false,
          can_delete: true,
        },
        {
          id: 'stint-pit',
          team_id: 'team-pit',
          season_id: 'season-2025',
          team: {
            id: 'team-pit',
            name: 'Pittsburgh Penguins',
            code: 'PIT',
            logo: null,
            primary_color: '#000000',
            text_color: '#ffffff',
          },
          jersey_number: 27,
          is_prospect: false,
          position: 'D',
          acquisition_type: 'trade',
          start_date: '2025-12-12',
          end_date: '2026-02-24',
          photo: null,
          has_stats: false,
          can_delete: true,
        },
        {
          id: 'stint-edm',
          team_id: 'team-edm',
          season_id: 'season-2025',
          team: {
            id: 'team-edm',
            name: 'Edmonton Oilers',
            code: 'EDM',
            logo: null,
            primary_color: '#041e42',
            text_color: '#ffffff',
          },
          jersey_number: 27,
          is_prospect: false,
          position: 'D',
          acquisition_type: 'trade',
          start_date: '2022-03-21',
          end_date: '2025-12-12',
          photo: null,
          has_stats: false,
          can_delete: true,
        },
      ],
    });
    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'PuckPedia source' }));
    fireEvent.change(screen.getByLabelText('PuckPedia transactions text or HTML'), {
      target: {
        value: `
          Date	Type	Teams	Details
          Jun 26, 2026	Signing

          Brett Kulak signs a 5-Year, $22,500,000 deal with the Avalanche
          Feb 24, 2026	Trade

          The Pittsburgh Penguins acquired Samuel Girard and a 2028 2nd round pick from the Colorado Avalanche for Brett Kulak
          Dec 12, 2025	Trade

          The Edmonton Oilers acquired Tristan Jarry and Samuel Poulin from the Pittsburgh Penguins for Stuart Skinner, Brett Kulak, and a 2029 2nd round pick
          Jul 13, 2022	Signing

          Brett Kulak signs a 4-Year, $11,000,000 deal with the Oilers
          Mar 21, 2022	Trade

          The Edmonton Oilers acquired Brett Kulak from the Montreal Canadiens for William Lagesson, 2022 second round pick, and 2024 seventh round pick
        `,
      },
    });
    await user.click(screen.getByText('Build report'));

    const reportSection = screen
      .getByText('Manual Movement Report')
      .closest('.stintHistorySection') as HTMLElement;
    const movementRows = within(reportSection)
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );

    expect(movementRows).toEqual([
      ['Colorado Avalanche', 'Trade', 'February 24, 2026', 'Present'],
      ['Pittsburgh Penguins', 'Trade', 'December 12, 2025', 'February 24, 2026'],
      ['Edmonton Oilers', 'Trade', 'March 21, 2022', 'December 12, 2025'],
    ]);
    expect(screen.queryByText('June 26, 2026')).not.toBeInTheDocument();
  });

  it('keeps trades back to the draft team as trades in the manual movement report', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        isActive: true,
        firstName: { default: 'J.T.' },
        lastName: { default: 'Miller' },
        birthDate: '1993-03-14',
        birthCity: { default: 'East Palestine' },
        birthStateProvince: { default: 'Ohio' },
        birthCountry: 'USA',
        currentTeamAbbrev: 'NYR',
        sweaterNumber: 8,
        position: 'C',
        draftDetails: {
          year: 2011,
          teamAbbrev: 'NYR',
          round: 1,
          overallPick: 15,
        },
      },
    });
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '8476468',
        first_name: 'J.T.',
        last_name: 'Miller',
        photo: null,
        date_of_birth: '1993-03-14',
        birth_city: 'East Palestine, Ohio',
        birth_country: 'USA',
        height_cm: 185,
        weight_lbs: 218,
        position: 'C',
        shoots: 'L',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });
    mockUseTeams.mockReturnValue({
      teams: [
        { id: 'team-nyr', name: 'New York Rangers', code: 'NYR', league_id: 'league-1' },
        { id: 'team-van', name: 'Vancouver Canucks', code: 'VAN', league_id: 'league-1' },
        { id: 'team-tbl', name: 'Tampa Bay Lightning', code: 'TBL', league_id: 'league-1' },
      ],
    });
    mockUseSeasons.mockReturnValue({
      seasons: [
        {
          id: 'season-2025',
          league_id: 'league-1',
          name: '2025-26',
          start_date: '2025-10-01',
          end_date: '2026-06-30',
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
    });
    mockUsePlayerTradeHistory.mockReturnValue({
      stints: [
        {
          id: 'stint-nyr',
          team_id: 'team-nyr',
          season_id: 'season-2025',
          team: {
            id: 'team-nyr',
            name: 'New York Rangers',
            code: 'NYR',
            logo: null,
            primary_color: '#0038a8',
            text_color: '#ffffff',
          },
          jersey_number: 8,
          is_prospect: false,
          position: 'C',
          acquisition_type: 'trade',
          start_date: '2025-01-31',
          end_date: null,
          photo: null,
          has_stats: false,
          can_delete: true,
        },
      ],
    });

    render(<PlayerDetails />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Auto-fill Player Data' }));

    expect(await screen.findByRole('dialog', { name: 'PuckPedia Source' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('PuckPedia transactions text or HTML'), {
      target: {
        value: `
          Date	Type	Teams	Details
          Jan 31, 2025	Trade

          The New York Rangers acquired JT Miller, Erik Brannstrom, and Jackson Dorrington from the Vancouver Canucks for Filip Chytil, Victor Mancini, and a conditional 2025 1st round pick
          Sep 2, 2022	Signing

          J.T. Miller signs a 7-Year, $56,000,000 deal with the Canucks
          Jun 22, 2019	Trade

          The Vancouver Canucks acquired JT Miller from Tampa Bay Lightning for Conditional 2020 First Round Pick, 2019 third round pick and Marek Mazanec
          Jun 26, 2018	Signing

          J.T. Miller signs a 5-Year, $26,250,000 deal with the Lightning
          Jul 13, 2016	Signing

          J.T. Miller signs a 2-Year, $5,500,000 deal with the Rangers
          Jul 15, 2015	Signing

          J.T. Miller signs a 1-Year, $874,000 deal with the Rangers
          Jul 28, 2011	Signing

          J.T. Miller signs a 3-Year, $3,825,000 deal with the Rangers
        `,
      },
    });
    await user.click(screen.getByText('Build report'));

    const reportSection = screen
      .getByText('Manual Movement Report')
      .closest('.stintHistorySection') as HTMLElement;
    const report = within(reportSection);
    const movementRows = report
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );

    expect(report.getByText('Draft Year: 2011 | Round: 1')).toBeInTheDocument();
    expect(movementRows).toEqual([['New York Rangers', 'Trade', 'January 31, 2025', 'Present']]);
  });

  it('auto-fills PWHL player details from HockeyTech profile data', async () => {
    const user = userEvent.setup();
    const updateStint = jest.fn().mockResolvedValue(true);
    const createStint = jest.fn().mockResolvedValue(true);
    mockUsePlayerRouteLookup.mockReturnValue({
      routeLookup: {
        player_id: 'player-1',
        team_id: 'team-1',
        league_id: 'league-1',
        league_code: 'PWHL',
        team_code: 'MIN',
        player_slug: 'lee-stecklein',
      },
      loading: false,
    });
    mockUsePlayerDetails.mockReturnValue({
      player: {
        id: 'player-1',
        league_player_number: '24',
        first_name: 'Lee',
        last_name: 'Stecklein',
        photo: null,
        date_of_birth: null,
        birth_city: null,
        birth_country: null,
        height_cm: null,
        weight_lbs: null,
        position: null,
        shoots: null,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      stats: [],
      loading: false,
    });
    mockUseStintActions.mockReturnValue({
      createStint,
      updateStint,
      deleteStint: jest.fn(),
      changeJerseyNumber: jest.fn(),
      updateJerseyHistoryEntry: jest.fn(),
      deleteJerseyHistoryEntry: jest.fn(),
      changePlayerPhoto: jest.fn(),
      deletePlayerPhoto: jest.fn(),
      uploadStintPhoto: jest.fn(),
      saving: false,
    });
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        info: {
          firstName: 'Lee',
          lastName: 'Stecklein',
          playerId: '24',
          jerseyNumber: '2',
          position: 'D',
          shoots: 'L',
          catches: '',
          height: '6\'0"',
          weight: '165',
          birthDate: '1994-04-23',
          birthPlace: 'Roseville , Minnesota, United States',
          profileImage: 'https://assets.leaguestat.com/pwhl/240x240/24.jpg',
        },
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
          first_name: 'Lee',
          last_name: 'Stecklein',
          date_of_birth: '1994-04-23',
          birth_city: 'Roseville, Minnesota',
          birth_country: 'USA',
          height_cm: 183,
          weight_lbs: 165,
          position: 'D',
          shoots: 'L',
        }),
        expect.any(Object),
      ),
    );
    expect(mockedAxios.get).toHaveBeenCalledWith(
      '/api/admin/games/pwhl-api',
      expect.objectContaining({
        params: {
          url: expect.stringContaining('view=player'),
        },
      }),
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(createStint).not.toHaveBeenCalled();
    expect(updateStint).not.toHaveBeenCalled();
    expect(screen.queryByText('Manual Movement Report')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mockedToast.update).toHaveBeenCalledWith(
        'player-autofill-toast',
        expect.objectContaining({
          render: 'Player data auto-filled.',
          type: 'success',
        }),
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
  it('groups player awards by award won with winning team rows and season tags', () => {
    mockUseTabState.mockReturnValue([3, jest.fn()]);
    mockUsePlayerAwards.mockReturnValue({
      awards: [
        {
          id: 'recipient-1',
          award_id: 'award-1',
          season_award_id: 'season-award-1',
          award_name: 'Forward of the Year',
          award_description: 'Awarded to the top forward.',
          season_id: 'season-1',
          season_name: '2025-26',
          awarded_at: '2026-05-01',
          recipient_type: 'player',
          player_photo: 'forward-2026.png',
          team_id: 'team-1',
          team_name: 'Toronto Maple Leafs',
          team_place_name: 'Toronto',
          team_team_name: 'Maple Leafs',
          team_code: 'TOR',
          team_logo: null,
          team_primary_color: '#003e7e',
          team_secondary_color: '#b9975b',
          team_text_color: '#ffffff',
        },
        {
          id: 'recipient-2',
          award_id: 'award-1',
          season_award_id: 'season-award-2',
          award_name: 'Forward of the Year',
          award_description: 'Awarded to the top forward.',
          season_id: 'season-2',
          season_name: '2024-25',
          awarded_at: '2025-05-01',
          recipient_type: 'player',
          player_photo: 'forward-2025.png',
          team_id: 'team-2',
          team_name: 'Montreal Victoire',
          team_place_name: 'Montreal',
          team_team_name: 'Victoire',
          team_code: 'MTL',
          team_logo: null,
          team_primary_color: '#862633',
          team_secondary_color: '#c8102e',
          team_text_color: '#ffffff',
        },
        {
          id: 'recipient-3',
          award_id: 'award-2',
          season_award_id: 'season-award-3',
          award_name: 'Walter Cup Winner',
          award_description: 'Awarded to the playoff champion.',
          season_id: 'season-1',
          season_name: '2025-26',
          awarded_at: '2026-05-20',
          recipient_type: 'team',
          player_photo: null,
          team_id: 'team-1',
          team_name: 'Toronto Maple Leafs',
          team_place_name: 'Toronto',
          team_team_name: 'Maple Leafs',
          team_code: 'TOR',
          team_logo: null,
          team_primary_color: '#003e7e',
          team_secondary_color: '#b9975b',
          team_text_color: '#ffffff',
        },
      ],
      loading: false,
    });

    render(<PlayerDetails />);

    const forwardGroup = screen.getByText('Forward of the Year').closest('.awardGroup');
    const walterCupGroup = screen.getByText('Walter Cup Winner').closest('.awardGroup');

    expect(screen.getByText('Awards')).toBeInTheDocument();
    expect(forwardGroup).not.toBeNull();
    expect(walterCupGroup).not.toBeNull();
    expect(
      within(forwardGroup as HTMLElement).getByRole('button', { name: 'Collapse' }),
    ).toBeInTheDocument();
    expect(
      within(forwardGroup as HTMLElement).getByLabelText('Forward of the Year award details'),
    ).toBeInTheDocument();
    expect(
      within(walterCupGroup as HTMLElement).getByLabelText('Walter Cup Winner award details'),
    ).toBeInTheDocument();
    expect(
      within(forwardGroup as HTMLElement).getByText('Awarded to the top forward.'),
    ).toBeInTheDocument();
    expect(
      within(walterCupGroup as HTMLElement).getByText('Awarded to the playoff champion.'),
    ).toBeInTheDocument();
    expect(within(forwardGroup as HTMLElement).getByLabelText('2 wins')).toBeInTheDocument();
    expect(within(walterCupGroup as HTMLElement).getByLabelText('1 win')).toBeInTheDocument();
    expect(
      within(forwardGroup as HTMLElement).getByText('Toronto Maple Leafs'),
    ).toBeInTheDocument();
    expect(within(forwardGroup as HTMLElement).getByText('Montreal Victoire')).toBeInTheDocument();
    expect(within(forwardGroup as HTMLElement).getByText('2025-26')).toBeInTheDocument();
    expect(
      within(forwardGroup as HTMLElement)
        .getByText('2025-26')
        .closest('li'),
    ).toHaveClass('itemPlain');
    expect(within(forwardGroup as HTMLElement).getByText('2024-25')).toBeInTheDocument();
    expect(
      within(walterCupGroup as HTMLElement).getByText('Toronto Maple Leafs'),
    ).toBeInTheDocument();
  });

  it('always shows all player awards without a season filter', async () => {
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
          award_description: 'Awarded to the top forward.',
          season_id: 'season-1',
          season_name: '2025-26',
          awarded_at: '2026-05-01',
          recipient_type: 'player',
          player_photo: 'forward-2026.png',
          team_id: 'team-1',
          team_name: 'Toronto Maple Leafs',
          team_place_name: 'Toronto',
          team_team_name: 'Maple Leafs',
          team_code: 'TOR',
          team_logo: null,
          team_primary_color: '#003e7e',
          team_secondary_color: '#b9975b',
          team_text_color: '#ffffff',
        },
        {
          id: 'recipient-2',
          award_id: 'award-2',
          season_award_id: 'season-award-2',
          award_name: 'Older Season Award',
          award_description: 'Awarded for an older season.',
          season_id: 'season-2',
          season_name: '2024-25',
          awarded_at: '2025-05-01',
          recipient_type: 'player',
          player_photo: 'older-2025.png',
          team_id: 'team-1',
          team_name: 'Toronto Maple Leafs',
          team_place_name: 'Toronto',
          team_team_name: 'Maple Leafs',
          team_code: 'TOR',
          team_logo: null,
          team_primary_color: '#003e7e',
          team_secondary_color: '#b9975b',
          team_text_color: '#ffffff',
        },
      ],
      loading: false,
    });

    render(<PlayerDetails />);

    await waitFor(() => {
      expect(screen.getByText('Forward of the Year')).toBeInTheDocument();
    });
    expect(screen.getByText('Older Season Award')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('switches awards between grouped list and flat banner view', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([3, jest.fn()]);
    mockUsePlayerAwards.mockReturnValue({
      awards: [
        {
          id: 'recipient-1',
          award_id: 'award-1',
          season_award_id: 'season-award-1',
          award_name: 'Forward of the Year',
          award_description: 'Awarded to the top forward.',
          competition_scope: 'regular_season',
          stat_key: null,
          season_id: 'season-1',
          season_name: '2025-26',
          awarded_at: '2026-05-01',
          recipient_type: 'player',
          player_photo: 'keller-2025.png',
          team_id: 'team-1',
          team_name: 'Toronto Maple Leafs',
          team_place_name: 'Toronto',
          team_team_name: 'Maple Leafs',
          team_code: 'TOR',
          team_logo: null,
          team_primary_color: '#003e7e',
          team_secondary_color: '#b9975b',
          team_text_color: '#ffffff',
        },
        {
          id: 'recipient-2',
          award_id: 'award-2',
          season_award_id: 'season-award-2',
          award_name: 'Walter Cup Winner',
          award_description: 'Awarded to the playoff champion.',
          competition_scope: 'playoffs',
          stat_key: 'playoff_champion',
          season_id: 'season-2',
          season_name: '2024-25',
          awarded_at: null,
          recipient_type: 'team',
          player_photo: null,
          team_id: 'team-2',
          team_name: 'Montreal Victoire',
          team_place_name: 'Montreal',
          team_team_name: 'Victoire',
          team_code: 'MTL',
          team_logo: null,
          team_primary_color: '#862633',
          team_secondary_color: '#c8102e',
          team_text_color: '#ffffff',
        },
      ],
      loading: false,
    });

    const { container } = render(<PlayerDetails />);

    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('data-active', 'true');
    expect(screen.queryByText('Awarded May 1, 2026')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Banner' }));

    expect(screen.getByRole('button', { name: 'Banner' })).toHaveAttribute('data-active', 'true');
    expect(container.querySelector('.awardGroup')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.awardArenaBanner')).toHaveLength(2);
    expect(screen.queryByText('Awarded season result')).not.toBeInTheDocument();
    const arenaBanner = screen.getByText('Awarded May 1, 2026').closest('.awardArenaBanner');
    expect(arenaBanner).not.toBeNull();
    expect(arenaBanner as HTMLElement).toHaveClass('awardArenaBannerIndividual');
    expect(arenaBanner as HTMLElement).not.toHaveClass('awardArenaBannerChampionship');
    expect((arenaBanner as HTMLElement).style.getPropertyValue('--award-banner-color')).toBe(
      '#003e7e',
    );
    expect(
      (arenaBanner as HTMLElement).style.getPropertyValue('--award-banner-secondary-color'),
    ).toBe('#b9975b');
    expect((arenaBanner as HTMLElement).style.getPropertyValue('--award-banner-text-color')).toBe(
      '#ffffff',
    );
    const arenaBannerPanel = (arenaBanner as HTMLElement).querySelector('.awardBannerPanel');
    expect(arenaBannerPanel?.lastElementChild).toHaveTextContent('2025-26');
    expect(within(arenaBanner as HTMLElement).getByText('Forward of the Year')).toBeInTheDocument();
    expect(within(arenaBanner as HTMLElement).getByText('Toronto')).toHaveClass(
      'awardBannerTeamPlace',
    );
    expect(within(arenaBanner as HTMLElement).getByText('Maple Leafs')).toHaveClass(
      'awardBannerTeamName',
    );
    expect(within(arenaBanner as HTMLElement).getByText('avatar')).toHaveAttribute(
      'data-photo',
      'keller-2025.png',
    );
    expect(within(arenaBanner as HTMLElement).getByText('2025-26')).toBeInTheDocument();
    expect(within(arenaBanner as HTMLElement).queryByText('Champions')).not.toBeInTheDocument();
    const championshipBanner = screen.getByText('Walter Cup Winner').closest('.awardArenaBanner');
    expect(championshipBanner).not.toBeNull();
    expect(championshipBanner as HTMLElement).not.toHaveClass('awardArenaBannerIndividual');
    expect(championshipBanner as HTMLElement).toHaveClass('awardArenaBannerChampionship');
    expect(
      (championshipBanner as HTMLElement).style.getPropertyValue('--award-banner-secondary-color'),
    ).toBe('#c8102e');
    expect(within(championshipBanner as HTMLElement).getByText('Champions')).toBeInTheDocument();
    expect(within(championshipBanner as HTMLElement).getByText('Montreal')).toHaveClass(
      'awardBannerTeamPlace',
    );
    expect(within(championshipBanner as HTMLElement).getByText('Victoire')).toHaveClass(
      'awardBannerTeamName',
    );
  });
});

describe('buildManualMovementStintImport', () => {
  it('turns reviewed NHL movements into idempotent career-stint inputs', () => {
    const result = buildManualMovementStintImport(
      {
        playerName: 'John Smith',
        sourceUrl: 'https://puckpedia.com/player/john-smith/transactions',
        draft: null,
        playerStatus: null,
        movementAnchor: {
          stintId: 'stint-1',
          teamCode: 'TOR',
          teamName: 'Toronto Maple Leafs',
          seasonName: '2025-26',
          seasonStartDate: '2025-10-01',
          stintStartDate: '2025-10-01',
          acquisitionType: 'free_agency',
        },
        movements: [
          {
            id: 'anchor:stint-1',
            acquisitionType: 'current_stint',
            startDate: '2025-10-01',
            endDate: '2026-03-06',
            previousEndDate: null,
            fromTeamName: null,
            toTeamName: 'Toronto Maple Leafs',
            detail: '',
          },
          {
            id: 'trade',
            acquisitionType: 'trade',
            startDate: '2026-03-06',
            endDate: null,
            previousEndDate: '2026-03-06',
            fromTeamName: 'Toronto Maple Leafs',
            toTeamName: 'New York Rangers',
            detail: 'The Rangers acquired John Smith from Toronto.',
          },
        ],
      },
      [
        { id: 'team-tor', name: 'Toronto Maple Leafs', code: 'TOR' },
        { id: 'team-nyr', name: 'New York Rangers', code: 'NYR' },
      ],
      'C',
    );

    expect(result.issues).toEqual([]);
    expect(result.stints).toEqual([
      {
        import_key: 'nhl_puckpedia:v1:anchor:stint-1',
        team_id: 'team-tor',
        position: 'C',
        acquisition_type: 'free_agency',
        start_date: '2025-10-01',
        end_date: '2026-03-06',
      },
      {
        import_key: 'nhl_puckpedia:v1:trade',
        team_id: 'team-nyr',
        position: 'C',
        acquisition_type: 'trade',
        start_date: '2026-03-06',
        end_date: null,
      },
    ]);
  });

  it('keeps source identity stable when reviewed acquisition, team, or date values are corrected', () => {
    const report = (acquisitionType: string, toTeamName: string, startDate = '2026-03-06') =>
      buildManualMovementStintImport(
        {
          playerName: 'John Smith',
          sourceUrl: 'https://puckpedia.com/player/john-smith/transactions',
          draft: null,
          playerStatus: null,
          movements: [
            {
              id: 'event:stint-1:1',
              acquisitionType,
              startDate,
              endDate: null,
              previousEndDate: startDate,
              fromTeamName: 'Toronto Maple Leafs',
              toTeamName,
              detail: '',
            },
          ],
        },
        [
          { id: 'team-nyr', name: 'New York Rangers', code: 'NYR' },
          { id: 'team-nyi', name: 'New York Islanders', code: 'NYI' },
        ],
        'C',
      );

    const original = report('trade', 'New York Rangers');
    const corrected = report('waivers', 'New York Islanders', '2026-03-07');

    expect(original.stints[0].import_key).toBe('nhl_puckpedia:v1:event:stint-1:1');
    expect(corrected.stints[0].import_key).toBe(original.stints[0].import_key);
    expect(corrected.stints[0]).toMatchObject({
      team_id: 'team-nyi',
      acquisition_type: 'waivers',
    });
  });

  it('leaves movements after the latest played season for a manual roster move', () => {
    const result = buildManualMovementStintImport(
      {
        playerName: 'John Smith',
        sourceUrl: 'https://puckpedia.com/player/john-smith/transactions',
        draft: null,
        playerStatus: null,
        movements: [
          {
            id: 'anchor:stint-1',
            acquisitionType: 'current_stint',
            startDate: '2025-10-01',
            endDate: '2026-07-03',
            previousEndDate: null,
            fromTeamName: null,
            toTeamName: 'Boston Bruins',
            detail: '',
          },
          {
            id: 'post-season-signing',
            acquisitionType: 'free_agency',
            startDate: '2026-07-03',
            endDate: null,
            previousEndDate: '2026-07-03',
            fromTeamName: 'Boston Bruins',
            toTeamName: 'Utah Mammoth',
            detail: '',
          },
        ],
        movementAnchor: {
          stintId: 'stint-1',
          teamCode: 'BOS',
          teamName: 'Boston Bruins',
          seasonName: '2025-26',
          seasonStartDate: '2025-10-01',
          stintStartDate: '2025-10-01',
          acquisitionType: 'trade',
        },
      },
      [
        { id: 'team-bos', name: 'Boston Bruins', code: 'BOS' },
        { id: 'team-uta', name: 'Utah Mammoth', code: 'UTA' },
      ],
      'D',
      { name: '2025-26', endDate: '2026-06-30' },
    );

    expect(result.issues).toEqual([]);
    expect(result.stints).toEqual([
      {
        import_key: 'nhl_puckpedia:v1:anchor:stint-1',
        team_id: 'team-bos',
        position: 'D',
        acquisition_type: 'trade',
        start_date: '2025-10-01',
        end_date: null,
      },
    ]);
    expect(result.warnings).toEqual([
      {
        movementId: 'post-season-signing',
        message:
          "Utah Mammoth movement occurred after 2025-26, the player's latest played season. Select the appropriate season and move the player manually so they are added to that team's roster.",
      },
    ]);
  });

  it('keeps an anchor identity tied to the persisted stint when its reviewed date changes', () => {
    const buildAnchor = (startDate: string) =>
      buildManualMovementStintImport(
        {
          playerName: 'John Smith',
          sourceUrl: 'https://puckpedia.com/player/john-smith/transactions',
          draft: null,
          playerStatus: null,
          movements: [
            {
              id: 'anchor:stint-1',
              acquisitionType: 'draft',
              startDate,
              endDate: null,
              previousEndDate: null,
              fromTeamName: null,
              toTeamName: 'Toronto Maple Leafs',
              detail: '',
            },
          ],
        },
        [{ id: 'team-tor', name: 'Toronto Maple Leafs', code: 'TOR' }],
        'C',
      );

    expect(buildAnchor('2025-10-01').stints[0].import_key).toBe('nhl_puckpedia:v1:anchor:stint-1');
    expect(buildAnchor('2025-10-02').stints[0].import_key).toBe('nhl_puckpedia:v1:anchor:stint-1');
  });

  it('blocks ambiguous same-date source events instead of shifting their identities', () => {
    const result = buildManualMovementStintImport(
      {
        playerName: 'John Smith',
        sourceUrl: 'https://puckpedia.com/player/john-smith/transactions',
        draft: null,
        playerStatus: null,
        movements: [
          {
            id: 'event:2026-03-06',
            acquisitionType: 'trade',
            startDate: '2026-03-06',
            endDate: null,
            previousEndDate: null,
            fromTeamName: 'Toronto Maple Leafs',
            toTeamName: 'New York Rangers',
            detail: '',
          },
          {
            id: 'event:2026-03-06',
            acquisitionType: 'waivers',
            startDate: '2026-03-06',
            endDate: null,
            previousEndDate: null,
            fromTeamName: 'New York Rangers',
            toTeamName: 'New York Islanders',
            detail: '',
          },
        ],
      },
      [
        { id: 'team-nyr', name: 'New York Rangers', code: 'NYR' },
        { id: 'team-nyi', name: 'New York Islanders', code: 'NYI' },
      ],
      'C',
    );

    expect(result.issues).toEqual([
      '2026-03-06 has multiple team-changing events; review them manually.',
    ]);
  });

  it('blocks applying movements whose destination team is not in the NHL league', () => {
    const result = buildManualMovementStintImport(
      {
        playerName: 'John Smith',
        sourceUrl: 'https://puckpedia.com/player/john-smith/transactions',
        draft: null,
        playerStatus: null,
        movements: [
          {
            id: 'trade',
            acquisitionType: 'trade',
            startDate: '2026-03-06',
            endDate: null,
            previousEndDate: '2026-03-06',
            fromTeamName: 'Toronto Maple Leafs',
            toTeamName: 'Missing NHL Team',
            detail: '',
          },
        ],
      },
      [{ id: 'team-tor', name: 'Toronto Maple Leafs', code: 'TOR' }],
      'C',
    );

    expect(result.stints).toEqual([]);
    expect(result.issues).toEqual(['Missing NHL Team does not match an NHL team.']);
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
