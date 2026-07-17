import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useLeagueDetails from '@/hooks/useLeagueDetails';
import useLeagues from '@/hooks/useLeagues';
import useSeasonDetails from '@/hooks/useSeasonDetails';
import useSeasonStandings from '@/hooks/useSeasonStandings';
import useSeasonStats from '@/hooks/useSeasonStats';
import useTabState from '@/hooks/useTabState';
import SeasonDetails from './SeasonDetails';

const mockNavigate = jest.fn();
const mockSeasonGamesTab = jest.fn((props: Record<string, unknown>) => {
  void props;
  return null;
});
const mockSeasonPlayersTab = jest.fn((_props: any) => <div>Season players tab</div>);
const mockSeasonPlayoffsTab = jest.fn((_props: any) => null);
const mockMoreActionsMenu = jest.fn((props: any) => (
  <button
    type="button"
    aria-label="More actions"
    className="trigger"
    data-variant={props.variant ?? 'ghost'}
    data-icon-height={props.iconHeight ?? 'default'}
  />
));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ leagueId: 'league-1', id: 'season-1' }),
}));
jest.mock('@/hooks/useLeagueDetails', () => jest.fn());
jest.mock('@/hooks/useLeagues', () => jest.fn());
jest.mock('@/hooks/useSeasonDetails', () => jest.fn());
jest.mock('@/hooks/useSeasonStandings', () => jest.fn());
jest.mock('@/hooks/useSeasonStats', () => jest.fn());
jest.mock('@/hooks/useTabState', () => jest.fn());
jest.mock('@/lib/computeClinched', () => ({
  computeClinched: () => new Set<string>(),
  computeEliminated: () => new Set<string>(),
}));
jest.mock('@jerecocc/tracker-ui/components/Breadcrumbs/Breadcrumbs', () => () => <div />);
jest.mock('@jerecocc/tracker-ui/components/Button/Button', () => (props: any) => {
  const {
    children,
    className,
    icon,
    tooltip,
    tooltipClassName,
    tooltipIntent,
    variant,
    intent,
    size,
    iconSize,
    iconHeight,
    ...buttonProps
  } = props;
  const iconOnlyClass =
    icon && !children
      ? iconHeight === 'button'
        ? 'iconOnlyButton'
        : iconHeight === 'field'
          ? 'iconOnlyField'
          : 'iconOnly'
      : null;
  const computedClassName = [className, size ?? 'medium', iconOnlyClass].filter(Boolean).join(' ');
  return (
    <button
      {...buttonProps}
      className={computedClassName}
      data-variant={variant}
    >
      {children ?? icon}
    </button>
  );
});
jest.mock('@jerecocc/tracker-ui/components/Card/Card', () => (props: any) => (
  <div data-testid="card">
    {props.title}
    {props.action}
    {props.children}
  </div>
));
jest.mock('@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal', () => () => null);
jest.mock('@jerecocc/tracker-ui/components/Tag/Tag', () => (props: any) => <span>{props.label}</span>);
jest.mock('@jerecocc/tracker-ui/components/MoreActionsMenu/MoreActionsMenu', () => (props: any) =>
  mockMoreActionsMenu(props),
);
jest.mock('@jerecocc/tracker-ui/components/SegmentedControl/SegmentedControl', () => (props: any) => (
  <div>
    {props.options.map((option: any) => (
      <button
        key={option.value}
        type="button"
        onClick={() => props.onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
));
jest.mock('@jerecocc/tracker-ui/components/Tabs/Tabs', () => (props: any) => (
  <div>
    <div role="tablist">
      {props.tabs.map((tab: any, index: number) => (
        <button
          key={tab.label}
          type="button"
          role="tab"
          aria-selected={(props.activeIndex ?? 0) === index}
        >
          {tab.label}
        </button>
      ))}
    </div>
    {props.tabs[props.activeIndex ?? 0].content}
  </div>
));
jest.mock('@jerecocc/tracker-ui/components/TitleRow/TitleRow', () => (props: any) => (
  <div>
    {props.left}
    {props.right}
  </div>
));
jest.mock('@jerecocc/tracker-ui/components/InfoItem/InfoItem', () => () => null);
jest.mock('@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar', () => () => <span>player</span>);
jest.mock('@jerecocc/tracker-ui/components/TeamLogo/TeamLogo', () => () => <span>logo</span>);
jest.mock('./SeasonEndModal', () => () => null);
jest.mock('./SeasonFormModal', () => () => null);
jest.mock('./SeasonGamesTab', () => (props: Record<string, unknown>) => mockSeasonGamesTab(props));
jest.mock('./SeasonPlayersTab', () => (props: any) => mockSeasonPlayersTab(props));
jest.mock('./SeasonPlayoffsTab', () => (props: any) => mockSeasonPlayoffsTab(props));
jest.mock('./SeasonTeamsCard', () => () => null);

const mockUseLeagueDetails = useLeagueDetails as jest.Mock;
const mockUseLeagues = useLeagues as jest.Mock;
const mockUseSeasonDetails = useSeasonDetails as jest.Mock;
const mockUseSeasonStandings = useSeasonStandings as jest.Mock;
const mockUseSeasonStats = useSeasonStats as jest.Mock;
const mockUseTabState = useTabState as jest.Mock;

const makeStanding = (teamId: string, teamName: string, points: number) => ({
  team_id: teamId,
  team_name: teamName,
  team_code: teamId.toUpperCase(),
  team_logo: null,
  team_primary_color: '#003e7e',
  team_text_color: '#ffffff',
  gp: 82,
  wins: Math.floor(points / 2),
  reg_wins: Math.floor(points / 3),
  ot_wins: 0,
  losses: 0,
  otl: points % 2,
  points,
  games_remaining: 0,
});

const makeGroupTeam = (id: string, name: string) => ({
  id,
  name,
  code: id.toUpperCase(),
  logo: null,
  primary_color: '#003e7e',
  text_color: '#ffffff',
  home_arena: null,
});

const makeGroup = (
  id: string,
  name: string,
  role: 'conference' | 'division',
  parentId: string | null,
  teamIds: string[],
  allTeams: Record<string, string>,
) => ({
  id,
  league_id: 'league-1',
  parent_id: parentId,
  name,
  sort_order: 0,
  created_at: '2024-01-01T00:00:00.000Z',
  role,
  teams: teamIds.map((teamId) => makeGroupTeam(teamId, allTeams[teamId])),
  has_season_override: false,
  is_inherited: false,
  is_auto: false,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTabState.mockReturnValue([5, jest.fn()]);
  mockUseLeagues.mockReturnValue({ leagues: [], loading: false });
  mockUseLeagueDetails.mockReturnValue({
    seasons: [{ id: 'season-1', name: 'season-1' }],
    loading: false,
  });
  mockUseSeasonStats.mockReturnValue({
    skaters: [
      {
        player_id: 'player-1',
        first_name: 'John',
        last_name: 'Smith',
        photo: null,
        position: 'C',
        jersey_number: 19,
        team_id: 'team-1',
        team_code: 'TOR',
        team_name: 'Toronto Maple Leafs',
        team_logo: null,
        team_primary_color: '#003e7e',
        team_text_color: '#ffffff',
        gp: 82,
        goals: 30,
        assists: 50,
        points: 80,
      },
    ],
    goalies: [],
    loading: false,
  });
  mockUseSeasonStandings.mockReturnValue({
    standings: [
      {
        team_id: 'team-1',
        team_name: 'Toronto Maple Leafs',
        team_code: 'TOR',
        team_logo: null,
        team_primary_color: '#003e7e',
        team_text_color: '#ffffff',
        gp: 82,
        wins: 50,
        reg_wins: 45,
        ot_wins: 5,
        losses: 20,
        otl: 12,
        points: 112,
        games_remaining: 0,
      },
    ],
    loading: false,
  });
  mockUseSeasonDetails.mockReturnValue({
    season: {
      id: 'season-1',
      league_id: 'league-1',
      league_name: 'NHL',
      league_code: 'NHL',
      name: '2024-25',
      start_date: '2024-10-01',
      end_date: '2025-06-30',
      games_per_season: 82,
      is_current: true,
      playoffs_started: false,
      is_ended: false,
      has_scheduled_games: false,
      has_unfinished_regular_games: false,
      has_incomplete_regular_team_games: false,
      playoff_format: null,
      scoring_system: '2-1-0',
      league_scoring_system: '2-1-0',
      goalie_min_regular_minutes: null,
      league_goalie_min_regular_minutes: 1500,
    },
    groups: [],
    seasonTeams: [],
    leagueTeams: [],
    loading: false,
    busy: null,
    groupBusy: null,
    setSeasonTeams: jest.fn(),
    setSeasonGroupTeams: jest.fn(),
    resetSeasonGroupTeams: jest.fn(),
    addGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
    setCurrentSeason: jest.fn(),
    startPlayoffs: jest.fn(),
    endSeason: jest.fn(),
    updateSeason: jest.fn(),
  });
});

describe('SeasonDetails players tab', () => {
  it('passes current season context to the players tab', () => {
    mockUseTabState.mockReturnValue([2, jest.fn()]);

    render(<SeasonDetails />);

    expect(screen.getByText('Season players tab')).toBeInTheDocument();
    expect(mockSeasonPlayersTab).toHaveBeenCalledWith(
      expect.objectContaining({
        leagueId: 'league-1',
        leagueCode: 'NHL',
        seasonId: 'season-1',
        seasonName: '2024-25',
      }),
    );
  });
});

describe('SeasonDetails tabs', () => {
  it('places Playoffs before Awards', () => {
    render(<SeasonDetails />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Info',
      'Teams',
      'Players',
      'Games',
      'Stats',
      'Standings',
      'Playoffs',
      'Awards',
    ]);
  });

  it('passes the season date limits to the games view', () => {
    mockUseTabState.mockReturnValue([3, jest.fn()]);

    render(<SeasonDetails />);

    expect(mockSeasonGamesTab).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonStartDate: '2024-10-01',
        seasonEndDate: '2025-06-30',
      }),
    );
  });
});

describe('SeasonDetails standings tab', () => {
  it('defers season stats and standings until their tabs need them', () => {
    mockUseTabState.mockReturnValue([3, jest.fn()]);

    render(<SeasonDetails />);

    expect(mockUseSeasonStats).toHaveBeenCalledWith('season-1', {
      competition: 'regular',
      enabled: false,
    });
    expect(mockUseSeasonStats).toHaveBeenCalledWith(
      'season-1',
      expect.objectContaining({ group: 'forwards', enabled: false }),
    );
    expect(mockUseSeasonStats).toHaveBeenCalledWith(
      'season-1',
      expect.objectContaining({ group: 'defense', enabled: false }),
    );
    expect(mockUseSeasonStats).toHaveBeenCalledWith(
      'season-1',
      expect.objectContaining({ group: 'goalies', enabled: false }),
    );
    expect(mockUseSeasonStandings).toHaveBeenCalledWith('season-1', { enabled: false });
  });

  it('enables standings without enabling stats when the standings tab is active', () => {
    render(<SeasonDetails />);

    expect(mockUseSeasonStats).toHaveBeenCalledWith('season-1', {
      competition: 'regular',
      enabled: false,
    });
    expect(mockUseSeasonStandings).toHaveBeenCalledWith('season-1', { enabled: true });
  });

  it('labels the league standings subpage', () => {
    render(<SeasonDetails />);

    expect(screen.getByRole('heading', { name: 'League' })).toBeInTheDocument();
  });

  it('enables cached standings and passes them to playoffs when the playoffs tab is active', () => {
    const standings = [makeStanding('team-1', 'Toronto Maple Leafs', 112)];
    mockUseTabState.mockReturnValue([6, jest.fn()]);
    mockUseSeasonStandings.mockReturnValue({
      standings,
      loading: false,
    });

    render(<SeasonDetails />);

    expect(mockUseSeasonStandings).toHaveBeenCalledWith('season-1', { enabled: true });
    expect(mockSeasonPlayoffsTab).toHaveBeenCalledWith(
      expect.objectContaining({
        standings,
        standingsLoading: false,
        canStartPlayoffs: true,
        startPlayoffsDisabled: false,
        startPlayoffsBusy: false,
        onStartPlayoffs: expect.any(Function),
      }),
    );
  });

  it('passes the route league id into season details so team context can load immediately', () => {
    mockUseLeagues.mockReturnValue({
      leagues: [{ id: 'league-db-id', name: 'League 1', code: 'league-1' }],
      loading: false,
    });

    render(<SeasonDetails />);

    expect(mockUseSeasonDetails).toHaveBeenCalledWith('season-1', { leagueId: 'league-db-id' });
  });

  it('shows the standings loading spinner inside the card', () => {
    mockUseSeasonStandings.mockReturnValue({
      standings: [],
      loading: true,
    });

    render(<SeasonDetails />);

    const loaderText = screen.getByText(/Loading/);
    expect(loaderText.closest('[data-testid="card"]')).toBeInTheDocument();
    expect(screen.queryByText('No standings data yet.')).not.toBeInTheDocument();
  });

  it('navigates to the team details page when a standings row is clicked', async () => {
    const user = userEvent.setup();
    render(<SeasonDetails />);

    await user.click(screen.getByText('Toronto Maple Leafs'));

    expect(mockNavigate).toHaveBeenCalledWith('/admin/leagues/nhl/teams/tor?season=2024-25');
  });

  it('uses the post-division pool for wildcard standings and highlights qualifying rows', async () => {
    const user = userEvent.setup();
    const teamNames = {
      a1: 'Atlantic One',
      a2: 'Atlantic Two',
      a3: 'Atlantic Three',
      a4: 'Atlantic Four',
      a5: 'Atlantic Five',
      b1: 'Metro One',
      b2: 'Metro Two',
      b3: 'Metro Three',
      b4: 'Metro Four',
      b5: 'Metro Five',
      c1: 'Central One',
      d1: 'Pacific One',
    };

    mockUseSeasonStandings.mockReturnValue({
      standings: [
        makeStanding('a1', teamNames.a1, 110),
        makeStanding('b1', teamNames.b1, 105),
        makeStanding('a2', teamNames.a2, 100),
        makeStanding('b2', teamNames.b2, 95),
        makeStanding('a3', teamNames.a3, 90),
        makeStanding('b3', teamNames.b3, 85),
        makeStanding('b4', teamNames.b4, 82),
        makeStanding('a4', teamNames.a4, 80),
        makeStanding('b5', teamNames.b5, 75),
        makeStanding('a5', teamNames.a5, 70),
        makeStanding('c1', teamNames.c1, 65),
        makeStanding('d1', teamNames.d1, 60),
      ],
      loading: false,
    });
    mockUseSeasonDetails.mockReturnValue({
      season: {
        id: 'season-1',
        league_id: 'league-1',
        league_name: 'NHL',
        league_code: 'NHL',
        name: '2024-25',
        start_date: '2024-10-01',
        end_date: '2025-06-30',
        games_per_season: 82,
        is_current: true,
        playoffs_started: false,
        is_ended: false,
        has_scheduled_games: false,
        has_unfinished_regular_games: false,
        has_incomplete_regular_team_games: false,
        playoff_format: [
          { scope: 'division', method: 'top', count: 3 },
          { scope: 'conference', method: 'wildcard', count: 2 },
        ],
        scoring_system: '2-1-0',
        league_scoring_system: '2-1-0',
        goalie_min_regular_minutes: null,
        league_goalie_min_regular_minutes: 1500,
      },
      groups: [
        makeGroup('east', 'Eastern', 'conference', null, [], teamNames),
        makeGroup('west', 'Western', 'conference', null, [], teamNames),
        makeGroup(
          'atlantic',
          'Atlantic',
          'division',
          'east',
          ['a1', 'a2', 'a3', 'a4', 'a5'],
          teamNames,
        ),
        makeGroup(
          'metro',
          'Metropolitan',
          'division',
          'east',
          ['b1', 'b2', 'b3', 'b4', 'b5'],
          teamNames,
        ),
        makeGroup('central', 'Central', 'division', 'west', ['c1'], teamNames),
        makeGroup('pacific', 'Pacific', 'division', 'west', ['d1'], teamNames),
      ],
      seasonTeams: [],
      leagueTeams: [],
      loading: false,
      busy: null,
      groupBusy: null,
      setSeasonTeams: jest.fn(),
      setSeasonGroupTeams: jest.fn(),
      resetSeasonGroupTeams: jest.fn(),
      addGroup: jest.fn(),
      updateGroup: jest.fn(),
      deleteGroup: jest.fn(),
      setCurrentSeason: jest.fn(),
      startPlayoffs: jest.fn(),
      endSeason: jest.fn(),
      updateSeason: jest.fn(),
    });

    render(<SeasonDetails />);
    const standingsHeader = screen
      .getByRole('heading', { name: 'Standings' })
      .closest('[data-testid="card"]');
    expect(standingsHeader).toBeInTheDocument();
    expect(within(standingsHeader as HTMLElement).getByRole('button', { name: 'Division' }))
      .toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'League' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Conference' }));
    expect(screen.getByRole('heading', { name: 'Eastern Conference' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Western Conference' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Division' }));
    expect(screen.getByRole('heading', { name: 'Atlantic Division' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Metropolitan Division' })).toBeInTheDocument();

    const atlanticThreeRow = screen.getByText('Atlantic Three').closest('tr');
    expect(atlanticThreeRow).toHaveClass('standingsQualifierRow');
    expect(atlanticThreeRow?.querySelectorAll('td')[0]).toHaveTextContent('3');
    expect(atlanticThreeRow?.querySelectorAll('td')[1]).toHaveTextContent('Atlantic Three');
    expect(screen.getByText('Atlantic Four').closest('tr')).not.toHaveClass(
      'standingsQualifierRow',
    );

    await user.click(screen.getAllByRole('button', { name: 'GP' })[0]);
    expect(screen.getByText('Atlantic Three').closest('tr')).toHaveClass('standingsQualifierRow');

    await user.click(screen.getByRole('button', { name: 'Wildcard' }));

    expect(screen.getByRole('heading', { name: 'Eastern Conference' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Western Conference' })).toBeInTheDocument();
    expect(screen.queryByText('Atlantic Three')).not.toBeInTheDocument();
    expect(screen.queryByText('Metro Three')).not.toBeInTheDocument();
    expect(screen.getByText('Metro Four')).toBeInTheDocument();
    const atlanticFourRow = screen.getByText('Atlantic Four').closest('tr');
    expect(atlanticFourRow).toHaveClass('standingsQualifierRow');
    expect(atlanticFourRow?.querySelectorAll('td')[0]).toHaveTextContent('2');

    await user.click(screen.getAllByRole('button', { name: 'GP' })[0]);
    expect(screen.getByText('Atlantic Four').closest('tr')).toHaveClass('standingsQualifierRow');
  });
});

describe('SeasonDetails info tab', () => {
  it('renders season actions at the top right with the expected icon styles', () => {
    mockUseTabState.mockReturnValue([0, jest.fn()]);

    const { container } = render(<SeasonDetails />);

    expect(container.querySelector('.seasonInfoHeader')).toBeInTheDocument();
    expect(container.querySelector('.seasonInfoActions')).toBeInTheDocument();

    const editButton = screen.getByRole('button', { name: 'Edit season' });
    expect(editButton).not.toHaveTextContent('Edit season');
    expect(editButton).toHaveClass('large', 'iconOnlyButton');
    expect(editButton).not.toHaveClass('iconOnly');

    expect(mockMoreActionsMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ label: 'Start Playoffs' }),
        ]),
        iconHeight: 'button',
      }),
    );
    expect(mockMoreActionsMenu.mock.calls[0][0]).not.toHaveProperty('useDefaultButtonStyle');
    const moreButton = screen.getByRole('button', { name: 'More actions' });
    expect(moreButton).toHaveClass('trigger');
    expect(moreButton).toHaveAttribute('data-variant', 'ghost');
    expect(moreButton).toHaveAttribute('data-icon-height', 'button');
  });

  it('keeps the start playoffs action visible but disabled while a team is short', () => {
    mockUseTabState.mockReturnValue([0, jest.fn()]);
    const details = mockUseSeasonDetails();
    mockUseSeasonDetails.mockClear();
    mockUseSeasonDetails.mockReturnValue({
      ...details,
      season: {
        ...details.season,
        has_incomplete_regular_team_games: true,
      },
    });

    render(<SeasonDetails />);

    expect(mockMoreActionsMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ label: 'Start Playoffs', disabled: true }),
        ]),
      }),
    );
  });

  it('keeps season actions scoped to the info tab', () => {
    mockUseTabState.mockReturnValue([4, jest.fn()]);

    const { container } = render(<SeasonDetails />);

    expect(container.querySelector('.seasonInfoHeader')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit season' })).not.toBeInTheDocument();
    expect(mockMoreActionsMenu).not.toHaveBeenCalled();
  });
});

describe('SeasonDetails stats tab', () => {
  it('enables summary stats without enabling standings when the stats tab is active', () => {
    mockUseTabState.mockReturnValue([4, jest.fn()]);

    render(<SeasonDetails />);

    expect(mockUseSeasonStats).toHaveBeenCalledWith('season-1', {
      competition: 'regular',
      enabled: true,
    });
    expect(mockUseSeasonStats).toHaveBeenCalledWith(
      'season-1',
      expect.objectContaining({ group: 'forwards', enabled: false }),
    );
    expect(mockUseSeasonStats).toHaveBeenCalledWith(
      'season-1',
      expect.objectContaining({ group: 'defense', enabled: false }),
    );
    expect(mockUseSeasonStats).toHaveBeenCalledWith(
      'season-1',
      expect.objectContaining({ group: 'goalies', enabled: false }),
    );
    expect(mockUseSeasonStandings).toHaveBeenCalledWith('season-1', { enabled: false });
  });

  it('renders skeletons for the cards inside each summary section while stats load', () => {
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUseSeasonStats.mockReturnValue({
      skaters: [],
      goalies: [],
      items: [],
      total: 0,
      loading: true,
      fetching: false,
    });

    const { container } = render(<SeasonDetails />);

    expect(container.querySelectorAll('.featuredCardSkeleton')).toHaveLength(3);
    expect(container.querySelectorAll('.statCardSkeleton')).toHaveLength(3);
    expect(container.querySelectorAll('.leaderItemSkeletonSurface')).toHaveLength(30);
    expect(screen.getByRole('button', { name: 'View all forward leaders' })).toBeInTheDocument();
    expect(screen.queryByText('No forward stats yet.')).not.toBeInTheDocument();
  });

  it('renders a bare card skeleton while a full stats list loads', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    mockUseSeasonStats.mockReturnValue({
      skaters: [],
      goalies: [],
      items: [],
      total: 0,
      loading: true,
      fetching: false,
    });

    const { container } = render(<SeasonDetails />);

    await user.click(screen.getByRole('button', { name: 'Forwards' }));

    expect(container.querySelectorAll('.statsTableCardSkeleton')).toHaveLength(1);
    expect(screen.queryByText('Loading forwards...')).not.toBeInTheDocument();
    expect(screen.queryByText('No forward stats recorded yet.')).not.toBeInTheDocument();
  });

  it('navigates to the player details page when a summary leader is clicked', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    render(<SeasonDetails />);

    await user.click(screen.getByRole('button', { name: 'View John Smith' }));

    expect(mockNavigate).toHaveBeenCalledWith('/admin/leagues/nhl/teams/tor/players/19-john-smith');
  });

  it('opens full leader lists from the summary header icon buttons', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    render(<SeasonDetails />);

    expect(screen.getByRole('button', { name: 'View all forward leaders' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View all defense leaders' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View all goalie leaders' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View all forward leaders' }));

    expect(screen.getByText('Smith, John')).toBeInTheDocument();
  });

  it('navigates to the player details page when a stats table row is clicked', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([4, jest.fn()]);
    render(<SeasonDetails />);

    await user.click(screen.getByRole('button', { name: 'Forwards' }));
    await user.click(screen.getByText('Smith, John'));

    expect(mockNavigate).toHaveBeenCalledWith('/admin/leagues/nhl/teams/tor/players/19-john-smith');
  });
});
