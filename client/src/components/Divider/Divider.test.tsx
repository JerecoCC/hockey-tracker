import { render } from '@testing-library/react';
import Divider from './Divider';

describe('Divider', () => {
  it('renders a horizontal divider by default', () => {
    const { container } = render(<Divider />);
    const divider = container.firstElementChild;

    expect(divider).toHaveClass('divider');
    expect(divider).toHaveClass('horizontal');
    expect(divider).not.toHaveClass('vertical');
  });

  it('renders the vertical variant', () => {
    const { container } = render(<Divider variant="vertical" />);
    const divider = container.firstElementChild;

    expect(divider).toHaveClass('divider');
    expect(divider).toHaveClass('vertical');
    expect(divider).not.toHaveClass('horizontal');
  });

  it('marks decorative dividers as hidden by default', () => {
    const { container } = render(<Divider />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('forwards className and span attributes', () => {
    const { container } = render(
      <Divider
        className="custom-divider"
        data-testid="divider"
      />,
    );
    const divider = container.firstElementChild;

    expect(divider).toHaveClass('custom-divider');
    expect(divider).toHaveAttribute('data-testid', 'divider');
  });
});
