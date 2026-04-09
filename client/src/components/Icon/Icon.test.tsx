import { render } from '@testing-library/react';
import Icon from './Icon';

describe('Icon', () => {
  it('renders an SVG for a known icon name', () => {
    const { container } = render(<Icon name="sports_hockey" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('returns null for an unknown icon name', () => {
    const { container } = render(<Icon name="__unknown__" />);
    expect(container.firstChild).toBeNull();
  });

  it('has aria-hidden on the SVG', () => {
    const { container } = render(<Icon name="add" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('appends a custom className to the SVG', () => {
    const { container } = render(
      <Icon
        name="add"
        className="my-icon"
      />,
    );
    expect(container.querySelector('svg')).toHaveClass('my-icon');
  });

  it('sets fontSize via inline style when size prop is provided', () => {
    const { container } = render(
      <Icon
        name="add"
        size="2rem"
      />,
    );
    expect(container.querySelector('svg')).toHaveStyle({ fontSize: '2rem' });
  });

  it('does not set inline style when size prop is omitted', () => {
    const { container } = render(<Icon name="add" />);
    const svg = container.querySelector('svg') as unknown as HTMLElement;
    expect(svg.style.fontSize).toBe('');
  });

  it('merges extra inline styles', () => {
    const { container } = render(
      <Icon
        name="add"
        style={{ color: 'red' }}
      />,
    );
    const svg = container.querySelector('svg') as unknown as HTMLElement;
    expect(svg.style.color).toBeTruthy();
  });

  it('merges size and extra inline styles together', () => {
    const { container } = render(
      <Icon
        name="add"
        size="1.5rem"
        style={{ color: 'blue' }}
      />,
    );
    const svg = container.querySelector('svg') as unknown as HTMLElement;
    expect(svg).toHaveStyle({ fontSize: '1.5rem' });
    expect(svg.style.color).toBeTruthy();
  });

  it('renders an SVG for visibility (eye open)', () => {
    const { container } = render(<Icon name="visibility" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders an SVG for visibility_off (eye slash)', () => {
    const { container } = render(<Icon name="visibility_off" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
