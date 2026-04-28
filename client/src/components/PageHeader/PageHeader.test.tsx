import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/PageHeader/PageHeader';

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
  ])('shows "%s" title for %s', (pathname, title) => {
    setup(pathname);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('renders no heading for an unmatched route', () => {
    setup('/dashboard');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

describe('PageHeader – user profile', () => {
  it('renders the display name', () => {
    setup();
    expect(screen.getByText('Jane Admin')).toBeInTheDocument();
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
    expect(screen.getByText('Fallback Name')).toBeInTheDocument();
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
  it('shows the switch button for admin users', () => {
    setup();
    expect(screen.getByRole('tooltip', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('hides the switch button for non-admin users', () => {
    setup('/admin/leagues', regularUser);
    expect(screen.queryByRole('tooltip', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('navigates to /dashboard when on an admin panel route', () => {
    setup('/admin/leagues');
    // Switch button is the first <button> in the header (before the profile button)
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates to /admin/leagues when on the dashboard', () => {
    setup('/dashboard', adminUser);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/leagues');
  });
});

describe('PageHeader – profile dropdown', () => {
  it('dropdown is hidden by default', () => {
    setup();
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
  });

  it('opens the dropdown when the profile button is clicked', () => {
    setup();
    fireEvent.click(screen.getByText('Jane Admin'));
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('closes the dropdown when clicking outside', () => {
    setup();
    fireEvent.click(screen.getByText('Jane Admin'));
    expect(screen.getByText('Sign out')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
  });

  it('calls logout and navigates to /login when Sign out is clicked', async () => {
    mockLogout.mockResolvedValue(undefined);
    setup();
    fireEvent.click(screen.getByText('Jane Admin'));
    fireEvent.click(screen.getByText('Sign out'));
    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
