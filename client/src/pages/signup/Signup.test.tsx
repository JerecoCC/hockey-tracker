import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import SignupPage from './Signup';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ signup: jest.fn() }),
}));
jest.mock('react-toastify', () => ({ toast: { error: jest.fn() } }));
jest.mock('@/shared/GoogleButton/GoogleButton', () => () => null);

const renderSignup = () => render(<SignupPage />);

const getPasswordInput = () => screen.getByPlaceholderText('Min. 6 characters');
const getConfirmInput = () => screen.getByPlaceholderText('Confirm password');

describe('SignupPage password toggle', () => {
  it('renders both password inputs as type="password" initially', () => {
    renderSignup();

    expect(getPasswordInput()).toHaveAttribute('type', 'password');
    expect(getConfirmInput()).toHaveAttribute('type', 'password');
  });

  it('renders two independent show-password toggle buttons', () => {
    renderSignup();
    expect(screen.getAllByRole('button', { name: /show password/i })).toHaveLength(2);
  });

  it('reveals the password field when its toggle is clicked', () => {
    renderSignup();
    const [passwordToggle] = screen.getAllByRole('button', { name: /show password/i });
    fireEvent.click(passwordToggle);
    expect(getPasswordInput()).toHaveAttribute('type', 'text');
  });

  it('does not affect the confirm field when the password toggle is clicked', () => {
    renderSignup();
    const [passwordToggle] = screen.getAllByRole('button', { name: /show password/i });
    fireEvent.click(passwordToggle);
    expect(getConfirmInput()).toHaveAttribute('type', 'password');
  });

  it('reveals the confirm field when its toggle is clicked', () => {
    renderSignup();
    const [, confirmToggle] = screen.getAllByRole('button', { name: /show password/i });
    fireEvent.click(confirmToggle);
    expect(getConfirmInput()).toHaveAttribute('type', 'text');
  });

  it('does not affect the password field when the confirm toggle is clicked', () => {
    renderSignup();
    const [, confirmToggle] = screen.getAllByRole('button', { name: /show password/i });
    fireEvent.click(confirmToggle);
    expect(getPasswordInput()).toHaveAttribute('type', 'password');
  });

  it('hides the password field again on a second click of its toggle', () => {
    renderSignup();
    const [passwordToggle] = screen.getAllByRole('button', { name: /show password/i });
    fireEvent.click(passwordToggle);
    fireEvent.click(screen.getAllByRole('button', { name: /hide password/i })[0]);
    expect(getPasswordInput()).toHaveAttribute('type', 'password');
  });
});
