import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useLeagueDetails from '@/hooks/useLeagueDetails';
import useLeagues from '@/hooks/useLeagues';
import useSeasonDetails from '@/hooks/useSeasonDetails';
import useSeasonStandings from '@/hooks/useSeasonStandings';
import useSeasonStats from '@/hooks/useSeasonStats';
import useTabState from '@/hooks/useTabState';
import SeasonDetails from './SeasonDetails';

const mockNavigate = jest.fn();
const mockSeasonPlayoffsTab = jest.fn(() => null);

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
jest.mock('@/components/Breadcrumbs/Breadcrumbs', () => () => <div />);
jest.mock('@/components/Button/Button', () => (props: any) => (
  <button {...props}>{props.children}</button>
));
jest.mock('@/components/Card/Card', () => (props: any) => (
  <div data-testid="card">
    {props.title}
    {props.action}
    {props.children}
  </div>
));
jest.mock('@/components/ConfirmModal/ConfirmModal', () => () => null);
jest.mock('@/components/Tag/Tag', () => (props: any) => <span>{props.label}</span>);
jest.mock('@/components/MoreActionsMenu/MoreActionsMenu', () => () => null);
jest.mock('@/components/SegmentedControl/SegmentedControl', () => (props: any) => (
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
jest.mock('@/components/Tabs/Tabs', () => (props: any) => (
  <div>{props.tabs[props.activeIndex ?? 0].content}</div>
));
jest.mock('@/components/TitleRow/TitleRow', () => (props: any) => (
  <div>
    {props.left}
    {props.right}
  </div>
));
jest.mock('@/components/InfoItem/InfoItem', () => () => null);
jest.mock('@/components/PlayerAvatar/PlayerAvatar', () => () => <span>player</span>);
jest.mock('@/components/TeamLogo/TeamLogo', () => () => <span>logo</span>);
jest.mock('./SeasonEndModal', () => () => null);
jest.mock('./SeasonFormModal', () => () => null);
jest.mock('./SeasonGamesTab', () => () => null);
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
  mockUseTabState.mockReturnValue([4, jest.fn()]);
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
      playoff_format: null,
      scoring_system: '2-1-0',
      league_scoring_system: '2-1-0',
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

describe('SeasonDetails standings tab', () => {
  it('defers season stats and standings until their tabs need them', () => {
    mockUseTabState.mockReturnValue([2, jest.fn()]);

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
        playoff_format: [
          { scope: 'division', method: 'top', count: 3 },
          { scope: 'conference', method: 'wildcard', count: 2 },
        ],
        scoring_system: '2-1-0',
        league_scoring_system: '2-1-0',
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
    await user.click(screen.getByRole('button', { name: 'Division' }));

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

describe('SeasonDetails stats tab', () => {
  it('enables summary stats without enabling standings when the stats tab is active', () => {
    mockUseTabState.mockReturnValue([3, jest.fn()]);

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

  it('navigates to the player details page when a summary leader is clicked', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([3, jest.fn()]);
    render(<SeasonDetails />);

    await user.click(screen.getByText('John Smith'));

    expect(mockNavigate).toHaveBeenCalledWith('/admin/leagues/nhl/teams/tor/players/john-smith');
  });

  it('navigates to the player details page when a stats table row is clicked', async () => {
    const user = userEvent.setup();
    mockUseTabState.mockReturnValue([3, jest.fn()]);
    render(<SeasonDetails />);

    await user.click(screen.getByRole('button', { name: 'Forwards' }));
    await user.click(screen.getByText('Smith, John'));

    expect(mockNavigate).toHaveBeenCalledWith('/admin/leagues/nhl/teams/tor/players/john-smith');
  });
});
