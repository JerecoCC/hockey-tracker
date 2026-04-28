import { render, screen, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import Field from './Field';

const ColorField = ({ defaultValue = '#ff0000' }: { defaultValue?: string }) => {
  const { control } = useForm({ defaultValues: { color: defaultValue } });
  return (
    <Field
      label="Color"
      name="color"
      type="color"
      control={control}
    />
  );
};

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

describe('Field – color type', () => {
  it('renders a visible hex text input with the initial value', () => {
    const { container } = render(<ColorField defaultValue="#003087" />);
    // Query by type to avoid matching the hidden color input which shares the same value
    const hexInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(hexInput).toBeInTheDocument();
    expect(hexInput.value).toBe('#003087');
  });

  it('renders a hidden native color input with the initial value', () => {
    const { container } = render(<ColorField defaultValue="#003087" />);
    const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
    expect(colorInput).toBeInTheDocument();
    expect(colorInput.value).toBe('#003087');
  });

  it('renders a swatch button with the initial color as background', () => {
    const { container } = render(<ColorField defaultValue="#003087" />);
    const swatch = container.querySelector('button[type="button"]') as HTMLElement;
    expect(swatch).toBeInTheDocument();
    // toHaveStyle normalizes both sides so hex === computed rgb
    expect(swatch).toHaveStyle({ background: '#003087' });
  });

  it('updates the displayed value when the hex input changes', () => {
    const { container } = render(<ColorField defaultValue="#ff0000" />);
    const hexInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(hexInput, { target: { value: '#00ff00' } });
    expect(hexInput.value).toBe('#00ff00');
  });

  it('renders the field label', () => {
    render(<ColorField />);
    expect(screen.getByText('Color')).toBeInTheDocument();
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
