import { render, screen, fireEvent } from '@testing-library/react';
import { useNavigate, useParams } from 'react-router-dom';
import useLeagueDetails from '../../../hooks/useLeagueDetails';
import LeagueDetailsPage from './LeagueDetails';

// ── Router ─────────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useParams: jest.fn(),
}));

// ── Hook ──────────────────────────────────────────────────────────────
jest.mock('../../../hooks/useLeagueDetails', () => ({ __esModule: true, default: jest.fn() }));

// ── Heavy / portal-incompatible child components ───────────────────────
jest.mock('../../../components/RichTextEditor/RichTextEditor', () => () => (
  <div data-testid="rte" />
));
jest.mock('./LeagueFormModal', () => () => null);
jest.mock('../teams/TeamFormModal', () => () => null);
jest.mock('../teams/TeamDeleteModal', () => () => null);
jest.mock('../seasons/SeasonFormModal', () => () => null);
jest.mock('../seasons/SeasonDeleteModal', () => () => null);

// ── Base hook return ───────────────────────────────────────────────────
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

const setup = (hookOverrides = {}) => {
  (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  (useParams as jest.Mock).mockReturnValue({ id: 'lg1' });
  (useLeagueDetails as jest.Mock).mockReturnValue({ ...baseHook, ...hookOverrides });
  return render(<LeagueDetailsPage />);
};

beforeEach(() => jest.clearAllMocks());

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
