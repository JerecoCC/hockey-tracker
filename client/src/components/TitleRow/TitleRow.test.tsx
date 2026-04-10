import { render, screen } from '@testing-library/react';
import TitleRow from './TitleRow';

describe('TitleRow', () => {
  it('renders left content', () => {
    render(<TitleRow left={<button>Back</button>} />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('renders right content', () => {
    render(<TitleRow right={<span>Breadcrumbs</span>} />);
    expect(screen.getByText('Breadcrumbs')).toBeInTheDocument();
  });

  it('renders both left and right content', () => {
    render(
      <TitleRow
        left={<button>Back</button>}
        right={<span>Breadcrumbs</span>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByText('Breadcrumbs')).toBeInTheDocument();
  });

  it('renders left before right in the DOM', () => {
    const { container } = render(
      <TitleRow
        left={<span data-testid="left">L</span>}
        right={<span data-testid="right">R</span>}
      />,
    );
    const children = Array.from(container.firstElementChild!.children);
    expect(children[0]).toHaveAttribute('data-testid', 'left');
    expect(children[1]).toHaveAttribute('data-testid', 'right');
  });

  it('renders an empty container when neither left nor right is provided', () => {
    const { container } = render(<TitleRow />);
    expect(container.firstElementChild?.children.length).toBe(0);
  });

  it('applies a custom className to the wrapper div', () => {
    const { container } = render(<TitleRow className="my-row" />);
    expect(container.firstElementChild).toHaveClass('my-row');
  });

  it('applies the default titleRow class alongside a custom className', () => {
    const { container } = render(<TitleRow className="extra" />);
    const el = container.firstElementChild!;
    expect(el.className).toContain('extra');
  });
});
