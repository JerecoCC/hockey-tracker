import { render, screen } from '@testing-library/react';
import ActionOverlay from './ActionOverlay';

describe('ActionOverlay', () => {
  it('renders a <span> element', () => {
    const { container } = render(<ActionOverlay>buttons</ActionOverlay>);
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });

  it('renders children inside the span', () => {
    render(
      <ActionOverlay>
        <button>Edit</button>
        <button>Delete</button>
      </ActionOverlay>,
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('applies the root module class', () => {
    const { container } = render(<ActionOverlay>x</ActionOverlay>);
    // identity-obj-proxy returns the class key as the class name
    expect(container.firstChild).toHaveClass('root');
  });

  it('merges the consumer className alongside the root class', () => {
    const { container } = render(
      <ActionOverlay className="myActions">x</ActionOverlay>,
    );
    const span = container.firstChild as HTMLElement;
    expect(span).toHaveClass('root');
    expect(span).toHaveClass('myActions');
  });

  it('does not add a trailing space when className is omitted', () => {
    const { container } = render(<ActionOverlay>x</ActionOverlay>);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toBe('root');
  });

  it('does not add a trailing space when className is empty string', () => {
    const { container } = render(<ActionOverlay className="">x</ActionOverlay>);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toBe('root');
  });
});
