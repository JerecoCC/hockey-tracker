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
const regularUser = { display_name: 'John User', role: 'user' as const, photo: '' };
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
    ['/dashboard/games-watched', 'Games Watched'],
    ['/dashboard/games-watched/tor', 'Games Watched'],
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

describe('PageHeader – switch button', () => {
  // The Tooltip always renders a role="tooltip" span in the DOM; its presence
  // indicates the switch button is mounted.
  it('does not render the legacy dashboard switch button for admin users', () => {
    setup();
    expect(screen.queryByRole('tooltip', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('hides the switch button for non-admin users', () => {
    setup('/admin/leagues', regularUser);
    expect(screen.queryByRole('tooltip', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('shows an admin panel shortcut for admin users on user routes', () => {
    setup('/dashboard', adminUser);
    expect(screen.getByRole('button', { name: 'Admin Panel' })).toBeInTheDocument();
  });

  it('hides the admin panel shortcut on admin routes', () => {
    setup('/admin/leagues', adminUser);
    expect(screen.queryByRole('button', { name: 'Admin Panel' })).not.toBeInTheDocument();
  });

  it('shows a user view shortcut for admin users on admin routes', () => {
    setup('/admin/leagues', adminUser);
    expect(screen.getByRole('button', { name: 'User View' })).toBeInTheDocument();
  });

  it('hides the user view shortcut on user routes', () => {
    setup('/dashboard', adminUser);
    expect(screen.queryByRole('button', { name: 'User View' })).not.toBeInTheDocument();
  });

  it('hides the admin panel shortcut for non-admin users', () => {
    setup('/dashboard', regularUser);
    expect(screen.queryByRole('button', { name: 'Admin Panel' })).not.toBeInTheDocument();
  });

  it('navigates to the admin panel from the header shortcut', () => {
    setup('/dashboard', adminUser);
    fireEvent.click(screen.getByRole('button', { name: 'Admin Panel' }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/leagues');
  });

  it('navigates to the user view from the header shortcut', () => {
    setup('/admin/leagues', adminUser);
    fireEvent.click(screen.getByRole('button', { name: 'User View' }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('does not navigate when clicking the account menu on an admin panel route', () => {
    setup('/admin/leagues');
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate when clicking the account menu on the dashboard', () => {
    setup('/dashboard', adminUser);
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(mockNavigate).not.toHaveBeenCalled();
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
