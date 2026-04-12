import { render, screen, fireEvent } from '@testing-library/react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import useLeagueDetails from '../../../hooks/useLeagueDetails';
import useLeagueGroups from '../../../hooks/useLeagueGroups';
import LeagueDetailsPage from './LeagueDetails';

// ── Router ─────────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useParams: jest.fn(),
  useLocation: jest.fn(),
}));

// ── Hooks ─────────────────────────────────────────────────────────────
jest.mock('../../../hooks/useLeagueDetails', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../hooks/useLeagueGroups', () => ({ __esModule: true, default: jest.fn() }));

// ── Heavy / portal-incompatible child components ───────────────────────
jest.mock('../../../components/RichTextEditor/RichTextEditor', () => () => (
  <div data-testid="rte" />
));
jest.mock('./LeagueFormModal', () => () => null);
jest.mock('../teams/TeamFormModal', () => () => null);
jest.mock('../seasons/SeasonFormModal', () => () => null);
jest.mock('../seasons/SeasonDeleteModal', () => () => null);

// ── Base hook returns ──────────────────────────────────────────────────
const baseHook = {
  league: null,
  teams: [],
  seasons: [],
  loading: false,
  busy: null,
  uploadLogo: jest.fn(),
  uploadTeamLogo: jest.fn(),
  updateLeague: jest.fn(),
  addTeam: jest.fn(),
  updateTeam: jest.fn(),
  deleteTeam: jest.fn(),
  addSeason: jest.fn(),
  updateSeason: jest.fn(),
  deleteSeason: jest.fn(),
};

const baseGroupsHook = {
  groups: [],
  loading: false,
  busy: null,
  addGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  setGroupTeams: jest.fn(),
};

const mockLeague = {
  id: 'lg1',
  name: 'Test League',
  code: 'TL',
  logo: '',
  primary_color: '#0000ff',
  text_color: '#ffffff',
  location: 'Test City',
  description: null,
  created_at: '2024-01-01T00:00:00Z',
};

const setup = (hookOverrides = {}, groupOverrides = {}, locationState: unknown = null) => {
  (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  (useParams as jest.Mock).mockReturnValue({ id: 'lg1' });
  (useLocation as jest.Mock).mockReturnValue({ state: locationState });
  (useLeagueDetails as jest.Mock).mockReturnValue({ ...baseHook, ...hookOverrides });
  (useLeagueGroups as jest.Mock).mockReturnValue({ ...baseGroupsHook, ...groupOverrides });
  return render(<LeagueDetailsPage />);
};

beforeEach(() => jest.clearAllMocks());

/** Switch to the Teams tab (second tab) */
const clickTeamsTab = () => fireEvent.click(screen.getByRole('tab', { name: 'Teams' }));

// ── Loading ────────────────────────────────────────────────────────────
describe('LeagueDetailsPage – loading', () => {
  it('shows the loading text while fetching', () => {
    setup({ loading: true });
    expect(screen.getByText('Loading league…')).toBeInTheDocument();
  });

  it('does not show the league name while loading', () => {
    setup({ loading: true });
    expect(screen.queryByRole('heading', { name: 'Test League' })).not.toBeInTheDocument();
  });
});

// ── Not found ──────────────────────────────────────────────────────────
describe('LeagueDetailsPage – not found', () => {
  it('shows "League not found." when league is null and not loading', () => {
    setup({ league: null, loading: false });
    expect(screen.getByText('League not found.')).toBeInTheDocument();
  });

  it('renders breadcrumbs with Not Found label', () => {
    setup({ league: null, loading: false });
    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });
});

// ── Main render ────────────────────────────────────────────────────────
describe('LeagueDetailsPage – main render', () => {
  it('renders the league name as a heading', () => {
    setup({ league: mockLeague });
    expect(screen.getByRole('heading', { name: 'Test League' })).toBeInTheDocument();
  });

  it('renders the league code', () => {
    setup({ league: mockLeague });
    // Code appears in both logoPlaceholder and leagueCode spans
    expect(screen.getAllByText('TL').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a logo placeholder when no logo', () => {
    setup({ league: { ...mockLeague, logo: '' } });
    // The placeholder renders the code text; at least one occurrence present
    expect(screen.getAllByText('TL').length).toBeGreaterThanOrEqual(1);
    // No <img> element present
    expect(screen.queryByRole('img', { name: 'Test League' })).not.toBeInTheDocument();
  });

  it('renders a logo <img> when the league has a logo', () => {
    setup({ league: { ...mockLeague, logo: 'https://example.com/logo.png' } });
    expect(screen.getByRole('img', { name: 'Test League' })).toBeInTheDocument();
  });

  it('renders the Leagues breadcrumb as a button', () => {
    setup({ league: mockLeague });
    // Breadcrumbs renders navigable items as <button>, not <a>
    expect(screen.getByRole('button', { name: 'Leagues' })).toBeInTheDocument();
  });

  it('renders the league name in the breadcrumbs', () => {
    setup({ league: mockLeague });
    // Appears at minimum as the last breadcrumb span
    expect(screen.getAllByText('Test League').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates back to /admin/leagues when back button is clicked', () => {
    setup({ league: mockLeague });
    // The back button is the only icon-only button (no text, just SVG) in TitleRow
    // Its Tooltip renders role="tooltip" with the text "Back to Leagues"
    const tooltip = screen.getByRole('tooltip', { name: /back to leagues/i });
    fireEvent.click(tooltip.previousElementSibling as HTMLElement);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/leagues');
  });

  it('shows the description placeholder when description is null', () => {
    setup({ league: { ...mockLeague, description: null } });
    expect(screen.getByText('Click to add a description…')).toBeInTheDocument();
  });

  it('shows the description placeholder when description is empty', () => {
    setup({ league: { ...mockLeague, description: '' } });
    expect(screen.getByText('Click to add a description…')).toBeInTheDocument();
  });
});

// ── Tabs ───────────────────────────────────────────────────────────────
describe('LeagueDetailsPage – tabs', () => {
  it('renders Info and Teams tabs', () => {
    setup({ league: mockLeague });
    expect(screen.getByRole('tab', { name: 'Info' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Teams' })).toBeInTheDocument();
  });

  it('Info tab is active by default', () => {
    setup({ league: mockLeague });
    expect(screen.getByRole('tab', { name: 'Info' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Teams' })).toHaveAttribute('aria-selected', 'false');
  });

  it('switches to Teams tab when clicked', () => {
    setup({ league: mockLeague });
    clickTeamsTab();
    expect(screen.getByRole('tab', { name: 'Teams' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens on the Teams tab when navigated back from team details', () => {
    setup({ league: mockLeague }, {}, { activeTab: 1 });
    expect(screen.getByRole('tab', { name: 'Teams' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Info' })).toHaveAttribute('aria-selected', 'false');
  });
});

// ── Seasons card (Info tab) ────────────────────────────────────────────
describe('LeagueDetailsPage – seasons card', () => {
  it('renders the "Create Season" button', () => {
    setup({ league: mockLeague });
    expect(screen.getByRole('button', { name: /create season/i })).toBeInTheDocument();
  });

  it('shows empty message when seasons list is empty', () => {
    setup({ league: mockLeague, seasons: [] });
    expect(screen.getByText(/no seasons for this league yet/i)).toBeInTheDocument();
  });

  it('renders a season row for each season', () => {
    const seasons = [
      {
        id: 's1',
        name: 'Winter 2024',
        league_id: 'lg1',
        start_date: '2024-01-01',
        end_date: '2024-03-31',
        created_at: '',
      },
    ];
    setup({ league: mockLeague, seasons });
    expect(screen.getByText('Winter 2024')).toBeInTheDocument();
  });
});

// ── Teams tab ──────────────────────────────────────────────────────────
describe('LeagueDetailsPage – teams tab', () => {
  it('renders the "Create Group" button on the Teams tab', () => {
    setup({ league: mockLeague });
    clickTeamsTab();
    expect(screen.getByRole('button', { name: /create group/i })).toBeInTheDocument();
  });

  it('shows empty state with "Create Team" button when no groups and no teams', () => {
    setup({ league: mockLeague, teams: [] });
    clickTeamsTab();
    expect(screen.getByRole('button', { name: /create team/i })).toBeInTheDocument();
    expect(screen.getByText(/no teams yet/i)).toBeInTheDocument();
  });

  it('renders ungrouped team rows on the Teams tab', () => {
    const teams = [
      { id: 't1', name: 'Team Alpha', code: 'TA', logo: '', league_id: 'lg1', created_at: '' },
      { id: 't2', name: 'Team Beta', code: 'TB', logo: '', league_id: 'lg1', created_at: '' },
    ];
    setup({ league: mockLeague, teams });
    clickTeamsTab();
    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Beta')).toBeInTheDocument();
  });

  it('renders a group name for each group', () => {
    const groups = [
      {
        id: 'g1',
        league_id: 'lg1',
        parent_id: null,
        name: 'Division A',
        sort_order: 0,
        teams: [],
        created_at: '',
      },
      {
        id: 'g2',
        league_id: 'lg1',
        parent_id: null,
        name: 'Division B',
        sort_order: 1,
        teams: [],
        created_at: '',
      },
    ];
    setup({ league: mockLeague }, { groups });
    clickTeamsTab();
    expect(screen.getByText('Division A')).toBeInTheDocument();
    expect(screen.getByText('Division B')).toBeInTheDocument();
  });
});
