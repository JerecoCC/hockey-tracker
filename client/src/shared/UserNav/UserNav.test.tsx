import { fireEvent, render, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import UserNav from './UserNav';

const mockNavigate = jest.fn();
const mockMobileClose = jest.fn();

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn(),
  useNavigate: () => mockNavigate,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const setup = (role: 'admin' | 'user') => {
  (useLocation as jest.Mock).mockReturnValue({ pathname: '/dashboard' });
  (useAuth as jest.Mock).mockReturnValue({ user: { role } });

  return render(
    <UserNav
      collapsed={false}
      onToggle={jest.fn()}
      mobileOpen
      onMobileClose={mockMobileClose}
    />,
  );
};

beforeEach(() => jest.clearAllMocks());

describe('UserNav', () => {
  it('renders a supported icon for Games', () => {
    setup('user');

    const gamesButton = screen.getByRole('button', { name: 'Games' });
    expect(gamesButton.querySelector('svg')).toHaveAttribute('data-icon', 'calendar-days');
  });

  it('shows Admin Panel below Settings for admin users', () => {
    setup('admin');

    const settings = screen.getByRole('button', { name: 'Settings' });
    const adminPanel = screen.getByRole('button', { name: 'Admin Panel' });
    const buttons = screen.getAllByRole('button');

    expect(buttons.indexOf(adminPanel)).toBeGreaterThan(buttons.indexOf(settings));

    fireEvent.click(adminPanel);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/leagues');
    expect(mockMobileClose).toHaveBeenCalledTimes(1);
  });

  it('does not show Admin Panel for regular users', () => {
    setup('user');

    expect(screen.queryByRole('button', { name: 'Admin Panel' })).not.toBeInTheDocument();
  });
});
