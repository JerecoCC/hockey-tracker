import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import BreadcrumbTitleRow from '@/components/Breadcrumbs/BreadcrumbTitleRow';
import BreadcrumbContext, { type BreadcrumbConfig } from '@/context/BreadcrumbContext';
import useLeagueDetails from '@/hooks/useLeagueDetails';
import useLeagueGroups from '@/hooks/useLeagueGroups';
import useLeaguePlayers from '@/hooks/useLeaguePlayers';
import useBracketRuleSets from '@/hooks/useBracketRuleSets';
import useLeagueAwards from '@/hooks/useLeagueAwards';
import useGroupAlignmentSets from '@/hooks/useGroupAlignmentSets';
import usePlayoffQualificationFormats from '@/hooks/usePlayoffQualificationFormats';
import LeagueDetailsPage from './LeagueDetails';

// ── Router ─────────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children?: ReactNode }) => (
    <a
      href={to}
      {...props}
    >
      {children}
    </a>
  ),
  useNavigate: jest.fn(),
  useParams: jest.fn(),
  useLocation: jest.fn(),
  useBlocker: jest.fn(() => ({ state: 'unblocked', reset: jest.fn(), proceed: jest.fn() })),
}));

// ── Hooks ─────────────────────────────────────────────────────────────
jest.mock('../../../hooks/useLeagueDetails', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../hooks/useLeagueGroups', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../hooks/useLeagues', () => ({
  __esModule: true,
  default: jest.fn(() => ({ leagues: [], loading: false })),
}));
jest.mock('../../../hooks/useLeaguePlayers', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    players: [],
    loading: false,
    busy: null,
    addPlayer: jest.fn(),
    bulkAddPlayers: jest.fn(),
    updatePlayer: jest.fn(),
    deletePlayer: jest.fn(),
  })),
}));
jest.mock('../../../hooks/useBracketRuleSets', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    ruleSets: [],
    loading: false,
    fetchRuleSet: jest.fn(async () => null),
    createRuleSet: jest.fn(async () => null),
    updateSlots: jest.fn(async () => true),
    deleteRuleSet: jest.fn(async () => true),
  })),
}));
jest.mock('../../../hooks/useLeagueAwards', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    awards: [],
    loading: false,
    createAward: jest.fn(async () => true),
    updateAward: jest.fn(async () => true),
    deleteAward: jest.fn(async () => true),
  })),
}));
jest.mock('../../../hooks/useGroupAlignmentSets', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    alignmentSets: [],
    loading: false,
    busy: null,
    fetchAlignmentSet: jest.fn(async () => null),
    createAlignmentSet: jest.fn(async () => null),
    updateAlignmentSet: jest.fn(async () => true),
    saveAlignmentConfig: jest.fn(async () => null),
    deleteAlignmentSet: jest.fn(async () => true),
    addGroup: jest.fn(async () => true),
    updateGroup: jest.fn(async () => true),
    deleteGroup: jest.fn(async () => true),
    setGroupTeams: jest.fn(async () => true),
    setAlignmentTeams: jest.fn(async () => true),
  })),
}));
jest.mock('../../../hooks/usePlayoffQualificationFormats', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    formats: [],
    loading: false,
    createFormat: jest.fn(async () => true),
    updateFormat: jest.fn(async () => true),
    deleteFormat: jest.fn(async () => true),
  })),
}));

jest.mock('./BulkAddPlayersModal', () => () => null);

// ── Heavy / portal-incompatible child components ───────────────────────
jest.mock(
  '../../../components/RichTextEditor/RichTextEditor',
  () =>
    function MockRichTextEditor() {
      return <div data-testid="rte" />;
    },
);
jest.mock('./LeagueFormModal', () => () => null);
jest.mock('./PlayerFormModal', () => () => null);
jest.mock('../teams/TeamFormModal', () => () => null);
jest.mock('../seasons/BracketRulesModal', () => () => null);
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

const basePlayersHook = {
  players: [],
  total: 0,
  loading: false,
  fetching: false,
  busy: null,
  addPlayer: jest.fn(),
  bulkAddPlayers: jest.fn(),
  updatePlayer: jest.fn(),
  deletePlayer: jest.fn(),
};

const baseBracketRuleSetsHook = {
  ruleSets: [],
  loading: false,
  fetchRuleSet: jest.fn(async () => null),
  createRuleSet: jest.fn(async () => null),
  updateSlots: jest.fn(async () => true),
  deleteRuleSet: jest.fn(async () => true),
};

const baseAwardsHook = {
  awards: [],
  loading: false,
  createAward: jest.fn(async () => true),
  updateAward: jest.fn(async () => true),
  deleteAward: jest.fn(async () => true),
};

const baseGroupAlignmentSetsHook = {
  alignmentSets: [],
  loading: false,
  busy: null,
  fetchAlignmentSet: jest.fn(async () => null),
  createAlignmentSet: jest.fn(async () => null),
  updateAlignmentSet: jest.fn(async () => true),
  saveAlignmentConfig: jest.fn(async () => null),
  deleteAlignmentSet: jest.fn(async () => true),
  addGroup: jest.fn(async () => true),
  updateGroup: jest.fn(async () => true),
  deleteGroup: jest.fn(async () => true),
  setGroupTeams: jest.fn(async () => true),
  setAlignmentTeams: jest.fn(async () => true),
};

const basePlayoffQualificationFormatsHook = {
  formats: [],
  loading: false,
  createFormat: jest.fn(async () => true),
  updateFormat: jest.fn(async () => true),
  deleteFormat: jest.fn(async () => true),
};

const mockLeague = {
  id: 'lg1',
  name: 'Test League',
  code: 'TL',
  logo: '',
  primary_color: '#0000ff',
  text_color: '#ffffff',
  season_phase: 'regular',
  location: 'Test City',
  description: null,
  created_at: '2024-01-01T00:00:00Z',
};

const BreadcrumbHarness = ({ children }: { children: ReactNode }) => {
  const [config, setBreadcrumbs] = useState<BreadcrumbConfig | null>(null);
  const value = useMemo(() => ({ config, setBreadcrumbs }), [config]);
  return (
    <BreadcrumbContext.Provider value={value}>
      <BreadcrumbTitleRow />
      {children}
    </BreadcrumbContext.Provider>
  );
};

const setup = (
  hookOverrides = {},
  groupOverrides = {},
  locationState: unknown = null,
  playerOverrides = {},
  bracketRuleSetOverrides = {},
  awardOverrides = {},
  groupAlignmentSetOverrides = {},
  playoffQualificationFormatOverrides = {},
) => {
  (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  (useParams as jest.Mock).mockReturnValue({ id: 'lg1' });
  (useLocation as jest.Mock).mockReturnValue({ state: locationState });
  (useLeagueDetails as jest.Mock).mockReturnValue({ ...baseHook, ...hookOverrides });
  (useLeagueGroups as jest.Mock).mockReturnValue({ ...baseGroupsHook, ...groupOverrides });
  (useLeaguePlayers as jest.Mock).mockReturnValue({ ...basePlayersHook, ...playerOverrides });
  (useBracketRuleSets as jest.Mock).mockReturnValue({
    ...baseBracketRuleSetsHook,
    ...bracketRuleSetOverrides,
  });
  (useLeagueAwards as jest.Mock).mockReturnValue({ ...baseAwardsHook, ...awardOverrides });
  (useGroupAlignmentSets as jest.Mock).mockReturnValue({
    ...baseGroupAlignmentSetsHook,
    ...groupAlignmentSetOverrides,
  });
  (usePlayoffQualificationFormats as jest.Mock).mockReturnValue({
    ...basePlayoffQualificationFormatsHook,
    ...playoffQualificationFormatOverrides,
  });
  return render(
    <BreadcrumbHarness>
      <LeagueDetailsPage />
    </BreadcrumbHarness>,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  window.scrollTo = jest.fn();
  sessionStorage.clear();
});

const clickTeamsTab = () => fireEvent.click(screen.getByRole('tab', { name: 'Teams' }));
const clickPlayersTab = () => fireEvent.click(screen.getByRole('tab', { name: 'Players' }));

// ── Loading ────────────────────────────────────────────────────────────
describe('LeagueDetailsPage – loading', () => {
  it('shows the loading text while fetching', () => {
    setup({ loading: true });
    expect(screen.getByText('Loading league…')).toBeInTheDocument();
  });

  it('renders the Info tab skeleton while fetching', () => {
    const { container } = setup({ loading: true });
    expect(screen.getByRole('status', { name: /loading league information/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Info' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Seasons' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Teams' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Alignments' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Players' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Playoffs' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Awards' })).toBeInTheDocument();
    expect(container.querySelector('.breadcrumbSkeleton')).toBeInTheDocument();
    expect(container.querySelector('.infoSkeletonButton')).toBeInTheDocument();
  });

  it('renders a custom skeleton for the active loading tab', () => {
    sessionStorage.setItem('tab:league-details', '2');
    const { container } = setup({ loading: true });

    expect(screen.getByRole('tab', { name: 'Teams' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Teams' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading teams/i })).toBeInTheDocument();
    expect(container.querySelector('.tabSkeletonSearchFull')).toBeInTheDocument();
    expect(container.querySelectorAll('.tabSkeletonRowBordered')).toHaveLength(5);
    expect(
      screen.queryByRole('status', { name: /loading league information/i }),
    ).not.toBeInTheDocument();
  });

  it('renders bordered season list skeletons while loading the Seasons tab', () => {
    sessionStorage.setItem('tab:league-details', '1');
    const { container } = setup({ loading: true });

    expect(screen.getByRole('tab', { name: 'Seasons' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Seasons' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading seasons/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.tabSkeletonRowBordered')).toHaveLength(5);
  });

  it('renders fifteen player row skeletons while loading the Players tab', () => {
    sessionStorage.setItem('tab:league-details', '4');
    const { container } = setup({ loading: true });

    expect(screen.getByRole('tab', { name: 'Players' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Players' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading players/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.tabSkeletonRowBordered')).toHaveLength(15);
  });

  it('keeps the static Alignments header visible while loading', () => {
    sessionStorage.setItem('tab:league-details', '3');
    const { container } = setup({ loading: true });

    expect(screen.getByRole('tab', { name: 'Alignments' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('heading', { name: /Team Alignments/ })).toBeInTheDocument();
    expect(
      screen.getByRole('tooltip', {
        name: 'Define reusable team lists and group structures for seasons.',
      }),
    ).toBeInTheDocument();
    expect(container.querySelector('.alignmentViewHeader')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading alignments/i })).toBeInTheDocument();
  });

  it('uses the Playoffs tab skeleton when playoff rule sets are loading', () => {
    sessionStorage.setItem('tab:league-details', '5');
    const { container } = setup({ league: mockLeague }, {}, null, {}, { loading: true });

    expect(screen.getByRole('tab', { name: 'Playoffs' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Playoff Rule Sets' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading playoff rule sets/i })).toBeInTheDocument();
    expect(screen.queryByText(/No rule sets yet/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('.circle')).toHaveLength(0);
  });

  it('uses the Awards tab skeleton when award definitions are loading', () => {
    sessionStorage.setItem('tab:league-details', '6');
    setup({ league: mockLeague }, {}, null, {}, {}, { loading: true });

    expect(screen.getByRole('tab', { name: 'Awards' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Awards' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading awards/i })).toBeInTheDocument();
    expect(screen.queryByText(/No award definitions yet/i)).not.toBeInTheDocument();
  });

  it('closes the remove award confirmation from cancel and close controls', () => {
    sessionStorage.setItem('tab:league-details', '6');
    const deleteAward = jest.fn(async () => true);
    const award = {
      id: 'award-1',
      league_id: 'lg1',
      name: 'Most Valuable Player',
      description: 'Top player',
      recipient_type: 'player',
      selection_method: 'manual',
      stat_key: null,
      awarded_after_playoffs: true,
      uses_nominees: false,
      allow_multiple_winners: false,
      uses_team_selection: false,
      sort_order: 0,
      active: true,
      created_at: '2024-01-01T00:00:00Z',
    };
    setup({ league: mockLeague }, {}, null, {}, {}, { awards: [award], deleteAward });

    const clickRemoveAward = () => {
      fireEvent.click(
        screen.getByRole('tooltip', { name: /remove award/i }).previousElementSibling as Element,
      );
    };

    clickRemoveAward();
    expect(screen.getByRole('heading', { name: 'Remove Award Definition' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Remove Award Definition' })).not.toBeInTheDocument();

    clickRemoveAward();
    const dialog = screen.getByRole('heading', { name: 'Remove Award Definition' }).closest('.modal');
    fireEvent.click(dialog?.querySelector('.closeBtn') as Element);

    expect(screen.queryByRole('heading', { name: 'Remove Award Definition' })).not.toBeInTheDocument();
    expect(deleteAward).not.toHaveBeenCalled();
  });

  it('does not label award definitions as regular season just because they are not playoff-gated', () => {
    sessionStorage.setItem('tab:league-details', '6');
    const awards = [
      {
        id: 'award-1',
        league_id: 'lg1',
        name: 'Art Ross Trophy',
        description: null,
        recipient_type: 'player',
        selection_method: 'automatic',
        stat_key: 'points',
        awarded_after_playoffs: false,
        uses_nominees: false,
        allow_multiple_winners: false,
        uses_team_selection: false,
        sort_order: 0,
        active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'award-2',
        league_id: 'lg1',
        name: 'Conn Smythe Trophy',
        description: null,
        recipient_type: 'player',
        selection_method: 'playoff',
        stat_key: null,
        awarded_after_playoffs: true,
        uses_nominees: false,
        allow_multiple_winners: false,
        uses_team_selection: false,
        sort_order: 1,
        active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];
    const { container } = setup({ league: mockLeague }, {}, null, {}, {}, { awards });

    expect(screen.getByText('Automatic')).toBeInTheDocument();
    expect(screen.getByText('Player Points')).toBeInTheDocument();
    expect(screen.getByText('Playoff award')).toBeInTheDocument();
    expect(container.querySelector('.awardDefinitionDivider.divider.horizontal')).toBeInTheDocument();
    expect(screen.queryByText('Regular season')).not.toBeInTheDocument();
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
    expect(screen.getByRole('img', { name: 'TL' })).toBeInTheDocument();
  });

  it('does not render the Leagues breadcrumb on league routes', () => {
    setup({ league: mockLeague });
    expect(screen.queryByRole('button', { name: 'Leagues' })).not.toBeInTheDocument();
  });

  it('renders the league code in the breadcrumbs', () => {
    setup({ league: mockLeague });
    expect(screen.getAllByText('TL').length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('shows the description placeholder when description is empty', () => {
    setup({ league: { ...mockLeague, description: '' } });
    // empty string is falsy → renders the same "No description" muted placeholder
    expect(screen.getByText('No description')).toBeInTheDocument();
  });
});

// ── Tabs ───────────────────────────────────────────────────────────────
describe('LeagueDetailsPage – tabs', () => {
  it('renders Info, Seasons, Teams, and Players tabs', () => {
    setup({ league: mockLeague });
    expect(screen.getByRole('tab', { name: 'Info' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Seasons' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Teams' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Players' })).toBeInTheDocument();
  });

  it('Info tab is active by default', () => {
    setup({ league: mockLeague });
    expect(screen.getByRole('tab', { name: 'Info' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Teams' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Players' })).toHaveAttribute('aria-selected', 'false');
  });

  it('switches to Teams tab when clicked', () => {
    setup({ league: mockLeague });
    clickTeamsTab();
    expect(screen.getByRole('tab', { name: 'Teams' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to Players tab when clicked', () => {
    setup({ league: mockLeague });
    clickPlayersTab();
    expect(screen.getByRole('tab', { name: 'Players' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Info' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Teams' })).toHaveAttribute('aria-selected', 'false');
  });

  it('opens on the Teams tab when navigated back from team details', () => {
    sessionStorage.setItem('tab:league-details', '2');
    setup({ league: mockLeague });
    expect(screen.getByRole('tab', { name: 'Teams' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Info' })).toHaveAttribute('aria-selected', 'false');
  });

  it('opens on the Players tab when navigated with activeTab 4', () => {
    sessionStorage.setItem('tab:league-details', '4');
    setup({ league: mockLeague });
    expect(screen.getByRole('tab', { name: 'Players' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Info' })).toHaveAttribute('aria-selected', 'false');
  });

  it('renders the Alignments card title with an info tooltip', async () => {
    sessionStorage.setItem('tab:league-details', '3');
    const { container } = setup({ league: mockLeague });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Team Alignments/ })).toBeInTheDocument();
    });
    expect(
      screen.getByRole('tooltip', {
        name: 'Define reusable team lists and group structures for seasons.',
      }),
    ).toBeInTheDocument();
    expect(container.querySelector('.alignmentViewHeader')).not.toBeInTheDocument();
  });

  it('opens alignment editing in a modal instead of expanding the list row', async () => {
    sessionStorage.setItem('tab:league-details', '3');
    const alignmentSet = {
      id: 'align-1',
      league_id: 'lg1',
      name: 'Current Groups',
      structure_type: 'groups',
      team_count: 0,
      conference_count: 0,
      division_count: 0,
      created_at: '',
      groups: [],
      teams: [],
    };
    const fetchAlignmentSet = jest.fn(async () => alignmentSet);
    const { container } = setup(
      { league: mockLeague },
      {},
      null,
      {},
      {},
      {},
      {
        alignmentSets: [alignmentSet],
        fetchAlignmentSet,
      },
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create alignment/i })).toBeEnabled(),
    );
    const alignmentRow = container.querySelector('.alignmentSetStack > .item');
    expect(alignmentRow).toBeInTheDocument();
    expect(alignmentRow).not.toHaveClass('alignmentCard');
    const editTooltip = screen.getByRole('tooltip', { name: /edit alignment/i });
    fireEvent.click(editTooltip.previousElementSibling as HTMLElement);

    expect(
      await screen.findByRole('heading', { name: 'Edit Alignment - Current Groups' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Uses groups?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create group/i })).toBeInTheDocument();
    expect(container.querySelector('.alignmentEditNameRow')).toBeInTheDocument();
    expect(container.querySelector('.alignmentEditControlsRow')).toBeInTheDocument();
    expect(container.querySelector('.alignmentCardExpanded')).not.toBeInTheDocument();
    expect(container.querySelector('.modalXl')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchAlignmentSet).toHaveBeenCalledWith('align-1'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save alignment/i })).toBeDisabled(),
    );
  });

  it('uses the alignment editor field layout for the create alignment modal', async () => {
    sessionStorage.setItem('tab:league-details', '3');
    const { container } = setup({ league: mockLeague });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create alignment/i })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /create alignment/i }));

    expect(await screen.findByRole('heading', { name: 'Create Alignment' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('');
    const createAlignmentButtons = screen.getAllByRole('button', { name: /create alignment/i });
    expect(createAlignmentButtons[createAlignmentButtons.length - 1]).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('');
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /create alignment/i })[
          createAlignmentButtons.length - 1
        ],
      ).toBeDisabled(),
    );
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), {
      target: { value: 'Custom Alignment' },
    });
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /create alignment/i })[
          createAlignmentButtons.length - 1
        ],
      ).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: /create group/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /create group/i }));
    expect(await screen.findByRole('heading', { name: 'Create Group' })).toBeInTheDocument();
    expect(container.querySelector('.alignmentEditRow')).toBeInTheDocument();
    expect(container.querySelector('.alignmentEditNameRow')).toBeInTheDocument();
    expect(container.querySelector('.alignmentEditControlsRow')).toBeInTheDocument();
    expect(container.querySelector('.modalXl')).not.toBeInTheDocument();
  });

  it('lets create alignment update teams before saving the new alignment', async () => {
    sessionStorage.setItem('tab:league-details', '3');
    const teams = [
      {
        id: 'team-1',
        name: 'Seattle Wolves',
        place_name: 'Seattle',
        team_name: 'Wolves',
        code: 'SEA',
        logo: '',
        primary_color: '#123456',
        text_color: '#ffffff',
      },
      {
        id: 'team-2',
        name: 'Portland Bears',
        place_name: 'Portland',
        team_name: 'Bears',
        code: 'POR',
        logo: '',
        primary_color: '#654321',
        text_color: '#ffffff',
      },
    ];
    setup({ league: mockLeague, teams });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create alignment/i })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /create alignment/i }));
    expect(await screen.findByRole('heading', { name: 'Create Alignment' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'No' }));

    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('');
    expect(screen.getByRole('button', { name: /update teams/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /update teams/i }));
    expect(await screen.findByRole('heading', { name: 'Alignment Teams' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search teams...')).toBeInTheDocument();
    expect(screen.getByText('Wolves')).toBeInTheDocument();
    expect(screen.getByText('Bears')).toBeInTheDocument();
  });

  it('renders league alignment teams as a single-column list item stack', async () => {
    sessionStorage.setItem('tab:league-details', '3');
    const teams = [
      {
        id: 'team-1',
        name: 'Seattle Wolves',
        place_name: 'Seattle',
        team_name: 'Wolves',
        code: 'SEA',
        logo: '',
        primary_color: '#123456',
        text_color: '#ffffff',
      },
      {
        id: 'team-2',
        name: 'Portland Bears',
        place_name: 'Portland',
        team_name: 'Bears',
        code: 'POR',
        logo: '',
        primary_color: '#654321',
        text_color: '#ffffff',
      },
    ];
    const alignmentSet = {
      id: 'align-league',
      league_id: 'lg1',
      name: 'League Teams',
      structure_type: 'league',
      team_count: teams.length,
      conference_count: 0,
      division_count: 0,
      created_at: '',
      groups: [],
      teams,
    };
    const fetchAlignmentSet = jest.fn(async () => alignmentSet);
    const { container } = setup(
      { league: mockLeague },
      {},
      null,
      {},
      {},
      {},
      {
        alignmentSets: [alignmentSet],
        fetchAlignmentSet,
      },
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create alignment/i })).toBeEnabled(),
    );
    const editTooltip = screen.getByRole('tooltip', { name: /edit alignment/i });
    fireEvent.click(editTooltip.previousElementSibling as HTMLElement);

    expect(await screen.findByText('Wolves')).toBeInTheDocument();
    expect(screen.getByText('Bears')).toBeInTheDocument();
    expect(screen.getByText('2 teams')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update teams/i })).toBeInTheDocument();

    const teamList = container.querySelector('.alignmentTeamList');
    expect(teamList).toBeInTheDocument();
    expect(teamList?.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('.alignmentTeamGrid')).not.toBeInTheDocument();
  });

  it('renders group alignment parents as label rows with grouped child fields', async () => {
    sessionStorage.setItem('tab:league-details', '3');
    const teams = [
      {
        id: 'team-1',
        name: 'Seattle Wolves',
        place_name: 'Seattle',
        team_name: 'Wolves',
        code: 'SEA',
        logo: '',
        primary_color: '#123456',
        text_color: '#ffffff',
      },
    ];
    const alignmentSet = {
      id: 'align-groups',
      league_id: 'lg1',
      name: 'League Groups',
      structure_type: 'groups',
      team_count: teams.length,
      conference_count: 1,
      division_count: 1,
      created_at: '',
      teams: [],
      groups: [
        {
          id: 'conf-1',
          client_id: 'conf-1',
          parent_client_id: null,
          alignment_set_id: 'align-groups',
          league_id: 'lg1',
          parent_id: null,
          stable_key: 'conference:east',
          name: 'Eastern',
          role: 'conference',
          sort_order: 0,
          created_at: '',
          is_auto: false,
          teams: [],
        },
        {
          id: 'div-1',
          client_id: 'div-1',
          parent_client_id: 'conf-1',
          alignment_set_id: 'align-groups',
          league_id: 'lg1',
          parent_id: 'conf-1',
          stable_key: 'division:metro',
          name: 'Metro',
          role: 'division',
          sort_order: 0,
          created_at: '',
          is_auto: false,
          teams,
        },
      ],
    };
    const fetchAlignmentSet = jest.fn(async () => alignmentSet);
    const { container } = setup(
      { league: mockLeague, teams },
      {},
      null,
      {},
      {},
      {},
      {
        alignmentSets: [alignmentSet],
        fetchAlignmentSet,
      },
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create alignment/i })).toBeEnabled(),
    );
    const editTooltip = screen.getByRole('tooltip', { name: /edit alignment/i });
    fireEvent.click(editTooltip.previousElementSibling as HTMLElement);

    expect(await screen.findByText('Eastern Conference')).toBeInTheDocument();
    expect(screen.getByText('Metro Division')).toBeInTheDocument();
    expect(screen.getByText('Wolves')).toBeInTheDocument();

    const groupSection = container.querySelector('.alignmentGroupSection');
    expect(groupSection).toBeInTheDocument();
    expect(groupSection?.querySelector('.alignmentGroupSectionLabel')).not.toBeInTheDocument();
    expect(groupSection?.querySelector('.alignmentParentGroupHeader')).toHaveTextContent(
      'Eastern Conference (1 team)',
    );
    expect(groupSection?.querySelectorAll('.alignmentGroupFieldset')).toHaveLength(1);
    expect(groupSection?.querySelector('.alignmentGroupFieldsetNested')).toBeInTheDocument();
    expect(
      groupSection?.querySelector('.alignmentGroupLegend .alignmentGroupActions'),
    ).toBeInTheDocument();
    expect(
      groupSection?.querySelector('.alignmentGroupLegend > .alignmentGroupActions'),
    ).toBeInTheDocument();
    expect(
      groupSection?.querySelector('.alignmentGroupHeader .alignmentGroupActions'),
    ).not.toBeInTheDocument();
    expect(
      groupSection?.querySelector('.alignmentGroupLegend .alignmentGroupLegendTitle'),
    ).toHaveTextContent('Metro Division (1 team)');
    expect(groupSection?.querySelector('.alignmentGroupLegendRule')).toBeInTheDocument();
    expect(groupSection?.querySelector('.alignmentGroupBorderActions')).not.toBeInTheDocument();
    expect(groupSection?.querySelector('.alignmentGroupSummary')).not.toBeInTheDocument();
    expect(groupSection?.querySelectorAll('.alignmentGroupNameCount')).toHaveLength(2);
    expect(groupSection?.querySelector('.alignmentGroupChildrenLabel')).not.toBeInTheDocument();
    expect(groupSection?.querySelector('.accordion')).not.toBeInTheDocument();
  });
});

const clickSeasonsTab = () => fireEvent.click(screen.getByRole('tab', { name: 'Seasons' }));

describe('LeagueDetailsPage - playoffs tab', () => {
  it('renders playoff rule sets with the default list item row', () => {
    sessionStorage.setItem('tab:league-details', '5');
    setup(
      { league: mockLeague },
      {},
      null,
      {},
      {
        ruleSets: [
          {
            id: 'br1',
            league_id: 'lg1',
            name: 'Standard Bracket',
            round_names: null,
            created_at: '',
            slots: [
              {
                slot_key: 'r1m1-home',
                rule_type: 'seed',
                rank: 1,
                scope: 'league',
                group_id: null,
                pool: [],
                choice_ref: null,
                matchup_ref: null,
              },
            ],
          },
        ],
      },
    );

    const row = screen.getByText('Standard Bracket').closest('li');
    expect(screen.getByRole('button', { name: /create rule set/i })).toBeInTheDocument();
    expect(screen.getByText(/4-team bracket/)).toBeInTheDocument();
    expect(row).toHaveClass('item');
    expect(row).not.toHaveClass('ruleSetItem');
  });
});

// ── Seasons card (Seasons tab) ─────────────────────────────────────────
describe('LeagueDetailsPage – seasons card', () => {
  it('renders the "Create Season" button', () => {
    setup({ league: mockLeague });
    clickSeasonsTab();
    expect(screen.getByRole('button', { name: /create season/i })).toBeInTheDocument();
  });

  it('shows empty message when seasons list is empty', () => {
    setup({ league: mockLeague, seasons: [] });
    clickSeasonsTab();
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
        is_current: false,
        is_ended: true,
        created_at: '',
      },
    ];
    setup({ league: mockLeague, seasons });
    clickSeasonsTab();
    expect(screen.getByText('Winter 2024')).toBeInTheDocument();
  });

  it('renders readable season date subtitles', () => {
    const seasons = [
      {
        id: 's1',
        name: 'Winter 2024',
        league_id: 'lg1',
        start_date: '2024-01-01',
        end_date: '2024-03-31',
        is_current: false,
        is_ended: true,
        created_at: '',
      },
      {
        id: 's2',
        name: 'Spring 2024',
        league_id: 'lg1',
        start_date: '2024-04-01',
        end_date: null,
        is_current: true,
        is_ended: false,
        created_at: '',
      },
    ];
    setup({ league: mockLeague, seasons });
    clickSeasonsTab();

    expect(screen.getByText('January 1, 2024 - March 31, 2024')).toBeInTheDocument();
    expect(screen.getByText('April 1, 2024 - Present')).toBeInTheDocument();
  });

  it('renders season rows as links to season details', () => {
    const seasons = [
      {
        id: 's1',
        name: 'Winter 2024',
        league_id: 'lg1',
        start_date: '2024-01-01',
        end_date: '2024-03-31',
        is_current: false,
        is_ended: true,
        created_at: '',
      },
    ];
    setup({ league: mockLeague, seasons });
    clickSeasonsTab();
    const row = screen.getByText('Winter 2024').closest('li');
    expect(row?.querySelector('a')).toHaveAttribute(
      'href',
      '/admin/leagues/tl/seasons/winter-2024',
    );
  });
});

// ── Teams tab ──────────────────────────────────────────────────────────
describe('LeagueDetailsPage – teams tab', () => {
  it('always shows the "Create Team" button in the Teams tab header', () => {
    setup({ league: mockLeague });
    clickTeamsTab();
    expect(screen.getByRole('button', { name: /create team/i })).toBeInTheDocument();
  });

  it('shows empty state message when no teams are assigned', () => {
    setup({ league: mockLeague, teams: [] });
    clickTeamsTab();
    expect(screen.getByRole('button', { name: /create team/i })).toBeInTheDocument();
    expect(screen.getByText(/no teams assigned to this league yet/i)).toBeInTheDocument();
  });

  it('renders team rows on the Teams tab', () => {
    const teams = [
      {
        id: 't1',
        name: 'Team Alpha',
        place_name: 'Team',
        team_name: 'Alpha',
        code: 'TA',
        logo: '',
        league_id: 'lg1',
        created_at: '',
      },
      {
        id: 't2',
        name: 'Team Beta',
        place_name: 'Team',
        team_name: 'Beta',
        code: 'TB',
        logo: '',
        league_id: 'lg1',
        created_at: '',
      },
    ];
    setup({ league: mockLeague, teams });
    clickTeamsTab();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renders team rows as links to team details', () => {
    const teams = [
      {
        id: 't1',
        name: 'Team Alpha',
        place_name: 'Team',
        team_name: 'Alpha',
        code: 'TA',
        logo: '',
        league_id: 'lg1',
        created_at: '',
      },
    ];
    setup({ league: mockLeague, teams });
    clickTeamsTab();
    const row = screen.getByText('Alpha').closest('li');
    expect(row?.querySelector('a')).toHaveAttribute('href', '/admin/leagues/tl/teams/ta');
  });
});

// ── Players tab ────────────────────────────────────────────────────────
describe('LeagueDetailsPage – players tab', () => {
  it('renders "Create Player" button on the Players tab', () => {
    setup({ league: mockLeague });
    clickPlayersTab();
    expect(screen.getByRole('button', { name: /create player/i })).toBeInTheDocument();
  });

  it('renders "Bulk Create" button on the Players tab', () => {
    setup({ league: mockLeague });
    clickPlayersTab();
    expect(screen.getByRole('button', { name: /bulk create/i })).toBeInTheDocument();
  });

  it('shows empty state when no players are assigned', () => {
    setup({ league: mockLeague });
    clickPlayersTab();
    expect(screen.getByText(/no active players in this league yet/i)).toBeInTheDocument();
  });

  it('passes rookie and retired player filters to the players query', async () => {
    const seasons = [
      {
        id: 'season-1',
        name: 'Spring 2024',
        league_id: 'lg1',
        start_date: '2024-01-01',
        end_date: '2024-03-31',
        is_current: true,
        is_ended: false,
        created_at: '',
      },
    ];

    const { container } = setup({ league: mockLeague, seasons });
    clickPlayersTab();

    expect(container.querySelector('.playerHeaderSeasonGroup .divider.vertical')).toBeInTheDocument();

    await waitFor(() =>
      expect(useLeaguePlayers).toHaveBeenLastCalledWith(
        undefined,
        'season-1',
        expect.objectContaining({
          page: 1,
          pageSize: 15,
          search: '',
          rookiesOnly: false,
          includeRetired: false,
          includeProspects: true,
        }),
      ),
    );

    const rookiesSwitch = screen.getByRole('switch', { name: 'Rookies only' });
    const retiredSwitch = screen.getByRole('switch', { name: 'Show retired players' });

    expect(rookiesSwitch).toHaveAttribute('aria-checked', 'false');
    expect(retiredSwitch).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(rookiesSwitch);
    await waitFor(() =>
      expect(useLeaguePlayers).toHaveBeenLastCalledWith(
        undefined,
        'season-1',
        expect.objectContaining({
          rookiesOnly: true,
          includeRetired: false,
          includeProspects: true,
        }),
      ),
    );

    fireEvent.click(retiredSwitch);
    await waitFor(() =>
      expect(useLeaguePlayers).toHaveBeenLastCalledWith(
        undefined,
        'season-1',
        expect.objectContaining({
          rookiesOnly: true,
          includeRetired: true,
          includeProspects: true,
        }),
      ),
    );
  });

  it('renders player rows as links to player details', () => {
    setup({ league: mockLeague }, {}, null, {
      players: [
        {
          id: 'player-1',
          first_name: 'John',
          last_name: 'Smith',
          photo: null,
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'C',
          shoots: 'L',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          team_id: null,
          team_code: null,
        },
      ],
      total: 1,
    });
    clickPlayersTab();

    const row = screen.getByText('John Smith').closest('li');
    expect(row?.querySelector('a')).toHaveAttribute('href', '/admin/leagues/tl/players/john-smith');
  });

  it('shows only rookie and retired player row tags', async () => {
    const seasons = [
      {
        id: 'season-1',
        name: 'Spring 2024',
        league_id: 'lg1',
        start_date: '2024-01-01',
        end_date: '2024-03-31',
        is_current: true,
        is_ended: false,
        created_at: '',
      },
    ];

    setup({ league: mockLeague, seasons }, {}, null, {
      players: [
        {
          id: 'player-1',
          first_name: 'John',
          last_name: 'Smith',
          photo: null,
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'C',
          shoots: 'L',
          rookie_season_id: 'season-1',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          team_id: null,
          team_code: null,
        },
        {
          id: 'player-2',
          first_name: 'Jane',
          last_name: 'Doe',
          photo: null,
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'D',
          shoots: 'R',
          rookie_season_id: null,
          is_active: false,
          created_at: '2024-01-01T00:00:00Z',
          team_id: null,
          team_code: null,
        },
      ],
      total: 2,
    });
    clickPlayersTab();

    await waitFor(() => expect(screen.getByText('Rookie')).toBeInTheDocument());
    expect(screen.getByText('Retired')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('shows player list skeleton rows only after pagination controls start fetching', () => {
    const { container } = setup({ league: mockLeague }, {}, null, {
      players: [
        {
          id: 'player-1',
          first_name: 'John',
          last_name: 'Smith',
          photo: null,
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'C',
          shoots: 'L',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          team_id: null,
          team_code: null,
        },
      ],
      total: 21,
      fetching: true,
    });
    clickPlayersTab();

    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(container.querySelectorAll('.tabSkeletonRowBordered')).toHaveLength(0);

    const nextTooltip = screen.getByRole('tooltip', { name: /next page/i });
    fireEvent.click(nextTooltip.previousElementSibling as HTMLElement);

    expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.tabSkeletonRowBordered')).toHaveLength(15);
    expect(screen.getByText('16-21 of 21')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading players')).not.toBeInTheDocument();
  });

  it('shows player list skeleton rows after changing the season while fetching', async () => {
    const seasons = [
      {
        id: 'season-1',
        name: 'Spring 2024',
        league_id: 'lg1',
        start_date: '2024-01-01',
        end_date: '2024-03-31',
        is_current: true,
        is_ended: false,
        created_at: '',
      },
      {
        id: 'season-2',
        name: 'Winter 2025',
        league_id: 'lg1',
        start_date: '2025-01-01',
        end_date: '2025-03-31',
        is_current: false,
        is_ended: false,
        created_at: '',
      },
    ];
    const { container } = setup({ league: mockLeague, seasons }, {}, null, {
      players: [
        {
          id: 'player-1',
          first_name: 'John',
          last_name: 'Smith',
          photo: null,
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'C',
          shoots: 'L',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          team_id: null,
          team_code: null,
        },
      ],
      total: 1,
      fetching: true,
    });
    clickPlayersTab();

    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(container.querySelectorAll('.tabSkeletonRowBordered')).toHaveLength(0);

    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('Spring 2024'));
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('button', { name: 'Winter 2025' }));

    expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.tabSkeletonRowBordered')).toHaveLength(15);
    expect(screen.queryByLabelText('Loading players')).not.toBeInTheDocument();
  });

  it('shows missing data indicators only for players with one season point', () => {
    setup({ league: mockLeague }, {}, null, {
      players: [
        {
          id: 'player-1',
          first_name: 'John',
          last_name: 'Smith',
          photo: null,
          date_of_birth: '1995-01-01',
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'C',
          shoots: 'L',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          team_id: null,
          team_code: null,
          acquisition_type: null,
          start_date: null,
          has_games: true,
          season_points: 1,
        },
        {
          id: 'player-2',
          first_name: 'Jane',
          last_name: 'Doe',
          photo: null,
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'D',
          shoots: 'R',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          team_id: null,
          team_code: null,
          acquisition_type: null,
          start_date: null,
          has_games: true,
          season_points: 2,
        },
        {
          id: 'player-3',
          first_name: 'Pat',
          last_name: 'Ready',
          photo: null,
          date_of_birth: '1996-02-02',
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'LW',
          shoots: 'L',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          team_id: null,
          team_code: null,
          acquisition_type: 'draft',
          start_date: '2024-10-01',
          has_games: true,
          season_points: 1,
        },
      ],
      total: 3,
    });
    clickPlayersTab();

    expect(screen.getByText('John Smith \u26A0\uFE0F')).toBeInTheDocument();
    expect(screen.queryByText('John Smith \uD83D\uDCDD')).not.toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Doe \u26A0\uFE0F')).not.toBeInTheDocument();
    expect(screen.getByText('Pat Ready')).toBeInTheDocument();
    expect(screen.queryByText('Pat Ready \u26A0\uFE0F')).not.toBeInTheDocument();
  });
});
