import { fireEvent, render, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import AdminNav from './AdminNav';

const mockNavigate = jest.fn();
const mockMobileClose = jest.fn();
const mockToggleTheme = jest.fn();

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn(),
  useNavigate: () => mockNavigate,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (useLocation as jest.Mock).mockReturnValue({ pathname: '/admin/leagues' });
  (useTheme as jest.Mock).mockReturnValue({
    isDarkMode: true,
    toggleTheme: mockToggleTheme,
  });
});

describe('AdminNav', () => {
  it('shows User View as a separate footer option', () => {
    render(
      <AdminNav
        collapsed={false}
        onToggle={jest.fn()}
        mobileOpen
        onMobileClose={mockMobileClose}
      />,
    );

    const themeSwitch = screen.getByRole('switch');
    const userView = screen.getByRole('button', { name: 'User View' });
    expect(themeSwitch.compareDocumentPosition(userView) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(userView);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    expect(mockMobileClose).toHaveBeenCalledTimes(1);
  });
});
