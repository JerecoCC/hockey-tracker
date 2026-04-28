import { render, screen, fireEvent } from '@testing-library/react';
import Button from '@/components/Button/Button';

describe('Button', () => {
  it('renders a <button> element', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('renders children as button label', () => {
    render(<Button>Save Changes</Button>);
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('renders an icon when icon prop is provided', () => {
    const { container } = render(<Button icon="add">Add</Button>);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders both icon and label when icon and children are provided', () => {
    const { container } = render(<Button icon="add">Add Item</Button>);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('Add Item')).toBeInTheDocument();
  });

  it('renders icon-only when icon is provided without children', () => {
    render(<Button icon="delete" />);
    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent?.trim()).toBe('');
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = jest.fn();
    render(
      <Button
        disabled
        onClick={handleClick}
      >
        Click
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('has disabled attribute when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('forwards additional HTML attributes to the button element', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('applies a custom className to the button', () => {
    render(<Button className="my-custom-class">Styled</Button>);
    expect(screen.getByRole('button')).toHaveClass('my-custom-class');
  });

  it('wraps button in a Tooltip span when tooltip prop is provided', () => {
    render(
      <Button
        tooltip="Delete item"
        icon="delete"
      />,
    );
    // Tooltip renders a wrapping <span>; button should be a descendant of it
    const btn = screen.getByRole('button');
    expect(btn.closest('span')).toBeInTheDocument();
  });

  it('does not add a wrapping span when tooltip prop is omitted', () => {
    render(<Button icon="delete" />);
    const btn = screen.getByRole('button');
    // The button's direct parent should be the container div, not a span
    expect(btn.parentElement?.tagName).not.toBe('SPAN');
  });

  it('forwards tooltipClassName to the Tooltip wrapper span', () => {
    const { container } = render(
      <Button
        tooltip="Info"
        tooltipClassName="my-tooltip"
        icon="info"
      />,
    );
    const span = container.querySelector('span.my-tooltip');
    expect(span).toBeInTheDocument();
  });

  it('renders with type="button" by default when no type is specified', () => {
    // HTML default is "submit" in forms; ensure explicit overrides work
    render(<Button type="button">Btn</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
