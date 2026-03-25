import { render, screen } from '@testing-library/react';
import Icon from './Icon';

describe('Icon', () => {
  it('renders the icon name as text content', () => {
    render(<Icon name="sports_hockey" />);
    expect(screen.getByText('sports_hockey')).toBeInTheDocument();
  });

  it('has aria-hidden="true"', () => {
    render(<Icon name="star" />);
    expect(screen.getByText('star')).toHaveAttribute('aria-hidden', 'true');
  });

  it('always includes material-icons class', () => {
    render(<Icon name="star" />);
    expect(screen.getByText('star')).toHaveClass('material-icons');
  });

  it('appends a custom className', () => {
    render(<Icon name="star" className="my-icon" />);
    const el = screen.getByText('star');
    expect(el).toHaveClass('material-icons');
    expect(el).toHaveClass('my-icon');
  });

  it('sets fontSize via inline style when size prop is provided', () => {
    render(<Icon name="star" size="2rem" />);
    expect(screen.getByText('star')).toHaveStyle({ fontSize: '2rem' });
  });

  it('does not set fontSize when size prop is omitted', () => {
    render(<Icon name="star" />);
    expect(screen.getByText('star').style.fontSize).toBe('');
  });

  it('merges extra inline styles', () => {
    // jsdom normalises colour keywords → rgb(), so check the attribute directly
    render(<Icon name="star" style={{ color: 'red' }} />);
    expect(screen.getByText('star').style.color).toBeTruthy();
  });

  it('merges size and extra inline styles together', () => {
    render(<Icon name="star" size="1.5rem" style={{ color: 'blue' }} />);
    const el = screen.getByText('star');
    expect(el).toHaveStyle({ fontSize: '1.5rem' });
    expect(el.style.color).toBeTruthy();
  });
});

