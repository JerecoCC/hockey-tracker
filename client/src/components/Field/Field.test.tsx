import { render, screen, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import Field from './Field';

// Minimal wrapper that gives Field a react-hook-form control
const PasswordField = ({ defaultValue = '' }: { defaultValue?: string }) => {
  const { control } = useForm({ defaultValues: { password: defaultValue } });
  return (
    <Field
      label="Password"
      name="password"
      type="password"
      control={control}
    />
  );
};

const TextField = () => {
  const { control } = useForm({ defaultValues: { username: '' } });
  return (
    <Field
      label="Username"
      name="username"
      type="text"
      control={control}
    />
  );
};

describe('Field – password type', () => {
  it('renders the input with type="password" initially', () => {
    render(<PasswordField />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('renders a toggle button with aria-label "Show password"', () => {
    render(<PasswordField />);
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
  });

  it('switches input to type="text" after clicking the toggle', () => {
    render(<PasswordField />);
    const toggle = screen.getByRole('button', { name: /show password/i });
    fireEvent.click(toggle);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  it('updates the toggle aria-label to "Hide password" after revealing', () => {
    render(<PasswordField />);
    const toggle = screen.getByRole('button', { name: /show password/i });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });

  it('switches back to type="password" on a second toggle click', () => {
    render(<PasswordField />);
    const toggle = screen.getByRole('button', { name: /show password/i });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });
});

describe('Field – non-password types', () => {
  it('does not render a toggle button for type="text"', () => {
    render(<TextField />);
    expect(screen.queryByRole('button', { name: /password/i })).toBeNull();
  });

  it('renders the input with type="text"', () => {
    render(<TextField />);
    expect(screen.getByLabelText('Username')).toHaveAttribute('type', 'text');
  });
});
