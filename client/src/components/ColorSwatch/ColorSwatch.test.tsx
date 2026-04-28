import { render, screen } from '@testing-library/react';
import ColorSwatch from '@/components/ColorSwatch/ColorSwatch';

describe('ColorSwatch', () => {
  it('renders the label text', () => {
    render(
      <ColorSwatch
        label="Primary"
        color="#003087"
      />,
    );
    expect(screen.getByText('Primary')).toBeInTheDocument();
  });

  it('renders the color dot with the correct background style', () => {
    const { container } = render(
      <ColorSwatch
        label="Primary"
        color="#003087"
      />,
    );
    // The dot span sits inside the Tooltip wrapper
    const dot = container.querySelector('.dot') as HTMLElement;
    expect(dot).toBeInTheDocument();
    // toHaveStyle normalizes both sides so hex === computed rgb
    expect(dot).toHaveStyle({ background: '#003087' });
  });

  it('renders a tooltip element containing the hex value', () => {
    render(
      <ColorSwatch
        label="Text"
        color="#ffffff"
      />,
    );
    // Tooltip renders a <span role="tooltip"> with the text
    expect(screen.getByRole('tooltip')).toHaveTextContent('#ffffff');
  });

  it('renders different labels and colors independently', () => {
    const { container } = render(
      <div>
        <ColorSwatch
          label="Primary"
          color="#003087"
        />
        <ColorSwatch
          label="Text"
          color="#ffffff"
        />
      </div>,
    );
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    const dots = container.querySelectorAll('.dot');
    expect(dots[0] as HTMLElement).toHaveStyle({ background: '#003087' });
    expect(dots[1] as HTMLElement).toHaveStyle({ background: '#ffffff' });
  });
});
