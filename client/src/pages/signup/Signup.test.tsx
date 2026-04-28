import { render, screen, fireEvent } from '@testing-library/react';
import SignupPage from '@/pages/signup/Signup';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ signup: jest.fn() }),
}));
jest.mock('react-toastify', () => ({ toast: { error: jest.fn() } }));
jest.mock('../../components/GoogleButton/GoogleButton', () => () => null);

const renderSignup = () => render(<SignupPage />);

describe('SignupPage – password toggle', () => {
  it('renders both password inputs as type="password" initially', () => {
    renderSignup();
    const [passwordInput, confirmInput] = screen.getAllByPlaceholderText(
      /min\. 6 characters|••••••••/i,
    );
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmInput).toHaveAttribute('type', 'password');
  });

  it('renders two independent show-password toggle buttons', () => {
    renderSignup();
    expect(screen.getAllByRole('button', { name: /show password/i })).toHaveLength(2);
  });

  it('reveals the password field when its toggle is clicked', () => {
    renderSignup();
    const [passwordToggle] = screen.getAllByRole('button', { name: /show password/i });
    fireEvent.click(passwordToggle);
    expect(screen.getByPlaceholderText('Min. 6 characters')).toHaveAttribute('type', 'text');
  });

  it('does not affect the confirm field when the password toggle is clicked', () => {
    renderSignup();
    const [passwordToggle] = screen.getAllByRole('button', { name: /show password/i });
    fireEvent.click(passwordToggle);
    expect(screen.getByPlaceholderText('••••••••')).toHaveAttribute('type', 'password');
  });

  it('reveals the confirm field when its toggle is clicked', () => {
    renderSignup();
    const [, confirmToggle] = screen.getAllByRole('button', { name: /show password/i });
    fireEvent.click(confirmToggle);
    expect(screen.getByPlaceholderText('••••••••')).toHaveAttribute('type', 'text');
  });

  it('does not affect the password field when the confirm toggle is clicked', () => {
    renderSignup();
    const [, confirmToggle] = screen.getAllByRole('button', { name: /show password/i });
    fireEvent.click(confirmToggle);
    expect(screen.getByPlaceholderText('Min. 6 characters')).toHaveAttribute('type', 'password');
  });

  it('hides the password field again on a second click of its toggle', () => {
    renderSignup();
    const [passwordToggle] = screen.getAllByRole('button', { name: /show password/i });
    fireEvent.click(passwordToggle);
    fireEvent.click(screen.getAllByRole('button', { name: /hide password/i })[0]);
    expect(screen.getByPlaceholderText('Min. 6 characters')).toHaveAttribute('type', 'password');
  });
});
