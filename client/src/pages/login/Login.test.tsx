import { render, screen, fireEvent } from '@testing-library/react';
import LoginPage from '@/pages/login/Login';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: jest.fn() }),
}));
jest.mock('react-toastify', () => ({ toast: { error: jest.fn() } }));
jest.mock('../../components/GoogleButton/GoogleButton', () => () => null);

const renderLogin = () => render(<LoginPage />);

describe('LoginPage – password toggle', () => {
  it('renders the password input with type="password" initially', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('••••••••')).toHaveAttribute('type', 'password');
  });

  it('renders the show-password toggle button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
  });

  it('reveals the password when the toggle is clicked', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(screen.getByPlaceholderText('••••••••')).toHaveAttribute('type', 'text');
  });

  it('hides the password again on a second click', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    fireEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(screen.getByPlaceholderText('••••••••')).toHaveAttribute('type', 'password');
  });
});
