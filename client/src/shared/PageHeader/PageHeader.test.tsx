import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import PageHeader from './PageHeader';

const mockNavigate = jest.fn();
const mockLogout = jest.fn();

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn(),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const adminUser = { display_name: 'Jane Admin', role: 'admin' as const, photo: '' };
const photoUser = {
  display_name: 'Pete Photo',
  role: 'admin' as const,
  photo: 'https://example.com/avatar.jpg',
};

const setup = (pathname = '/admin/leagues', user = adminUser) => {
  (useLocation as jest.Mock).mockReturnValue({ pathname });
  (useAuth as jest.Mock).mockReturnValue({ user, logout: mockLogout });
  return render(<PageHeader />);
};

beforeEach(() => jest.clearAllMocks());

describe('PageHeader – title resolution', () => {
  it.each([
    ['/admin/leagues', 'Leagues'],
    ['/admin/users', 'Users'],
    ['/admin/leagues/123', 'League Details'],
    ['/admin/leagues/123/teams/456', 'Team Details'],
    ['/admin/leagues/nhl/players/8482781', 'Player Details'],
    ['/leagues/nhl/teams/tor/players/auston-matthews', 'Player Details'],
    ['/leagues/nhl/players/auston-matthews', 'Player Details'],
    ['/leagues/nhl/teams/tor', 'Team Details'],
    ['/dashboard/games-watched', 'Games Watched'],
    ['/dashboard/games-watched/tor-maple-leafs', 'Games Watched'],
    ['/games/watched', 'Games Watched'],
    ['/settings', 'Settings'],
  ])('shows "%s" title for %s', (pathname, title) => {
    setup(pathname);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('renders no heading for an unmatched route', () => {
    setup('/unknown');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

describe('PageHeader – user profile', () => {
  it('renders the account menu button', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
  });

  it('renders initials when user has no photo', () => {
    setup('/admin/leagues', { ...adminUser, display_name: 'Jane Admin' });
    expect(screen.getByText('JA')).toBeInTheDocument();
  });

  it('renders an <img> when user has a photo', () => {
    setup('/admin/leagues', photoUser);
    expect(screen.getByRole('img', { name: 'Pete Photo' })).toBeInTheDocument();
  });

  it('falls back to displayName when display_name is undefined', () => {
    (useLocation as jest.Mock).mockReturnValue({ pathname: '/admin/leagues' });
    (useAuth as jest.Mock).mockReturnValue({
      user: { displayName: 'Fallback Name', role: 'user', photo: '' },
      logout: mockLogout,
    });
    render(<PageHeader />);
    expect(screen.getByText('FN')).toBeInTheDocument();
  });

  it('renders nothing when user is null', () => {
    (useLocation as jest.Mock).mockReturnValue({ pathname: '/admin/leagues' });
    (useAuth as jest.Mock).mockReturnValue({ user: null, logout: mockLogout });
    render(<PageHeader />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('PageHeader – navigation shortcuts', () => {
  it('leaves the admin and user view shortcuts to the side navigation', () => {
    setup('/dashboard', adminUser);
    expect(screen.queryByRole('button', { name: 'Admin Panel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'User View' })).not.toBeInTheDocument();
  });
});

describe('PageHeader – profile dropdown', () => {
  it('dropdown is hidden by default', () => {
    setup();
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
  });

  it('opens the dropdown when the profile button is clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('closes the dropdown when clicking outside', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByText('Sign out')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
  });

  it('calls logout and navigates to /login when Sign out is clicked', async () => {
    mockLogout.mockResolvedValue(undefined);
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByText('Sign out'));
    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
