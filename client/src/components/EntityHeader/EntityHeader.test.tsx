import { render, screen, fireEvent } from '@testing-library/react';
import EntityHeader from './EntityHeader';

// Code longer than 3 chars so placeholder ('TOR') differs from full code ('TORONTO')
const defaultProps = {
  logo: null,
  name: 'Toronto Maple Leafs',
  code: 'TORONTO',
  primaryColor: '#003087',
  textColor: '#ffffff',
};

beforeAll(() => {
  Object.defineProperty(window, 'scrollTo', { value: jest.fn(), writable: true });
});

beforeEach(() => jest.clearAllMocks());

describe('EntityHeader – name and code', () => {
  it('renders the entity name', () => {
    render(<EntityHeader {...defaultProps} />);
    expect(screen.getByText('Toronto Maple Leafs')).toBeInTheDocument();
  });

  it('renders the full code text', () => {
    render(<EntityHeader {...defaultProps} />);
    expect(screen.getByText('TORONTO')).toBeInTheDocument();
  });
});

describe('EntityHeader – logo', () => {
  it('renders an <img> with src and alt when logo is provided', () => {
    render(
      <EntityHeader
        {...defaultProps}
        logo="https://example.com/logo.png"
      />,
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/logo.png');
    expect(img).toHaveAttribute('alt', 'TORONTO');
  });

  it('renders a placeholder showing the first 3 chars of code when no logo', () => {
    render(<EntityHeader {...defaultProps} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('TOR')).toBeInTheDocument();
  });

  it('applies primaryColor and textColor to the placeholder', () => {
    render(<EntityHeader {...defaultProps} />);
    const placeholder = screen.getByText('TOR');
    expect(placeholder).toHaveStyle({ color: '#ffffff' });
    expect(placeholder.parentElement).toHaveStyle({ background: '#003087' });
  });
});

describe('EntityHeader – edit button', () => {
  it('renders the Edit button when onEdit is provided and isEditing is false', () => {
    render(
      <EntityHeader
        {...defaultProps}
        onEdit={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('calls onEdit when the Edit button is clicked', () => {
    const onEdit = jest.fn();
    render(
      <EntityHeader
        {...defaultProps}
        onEdit={onEdit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('renders an accessible icon-only edit button when requested', () => {
    render(
      <EntityHeader
        {...defaultProps}
        onEdit={jest.fn()}
        editIconOnly
      />,
    );
    expect(screen.getByRole('button', { name: /edit/i })).toHaveAttribute('aria-label', 'Edit');
  });

  it('renders no button when onEdit is omitted', () => {
    render(<EntityHeader {...defaultProps} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('EntityHeader – logo image preview', () => {
  it('wraps the logo in a button when a logo is provided', () => {
    render(
      <EntityHeader
        {...defaultProps}
        logo="https://example.com/logo.png"
      />,
    );
    expect(
      screen.getByRole('button', { name: /view toronto maple leafs logo/i }),
    ).toBeInTheDocument();
  });

  it('does NOT wrap the logo in a button when no logo is provided', () => {
    render(<EntityHeader {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /view toronto maple leafs logo/i })).toBeNull();
  });

  it('opens the image preview modal when the logo button is clicked', () => {
    render(
      <EntityHeader
        {...defaultProps}
        logo="https://example.com/logo.png"
      />,
    );
    // Modal image is not in the DOM until the button is clicked
    expect(screen.queryByAltText('Toronto Maple Leafs')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /view toronto maple leafs logo/i }));

    // After click, the preview modal renders an <img alt={name}>
    const previewImg = screen.getByAltText('Toronto Maple Leafs') as HTMLImageElement;
    expect(previewImg).toBeInTheDocument();
    expect(previewImg.src).toBe('https://example.com/logo.png');
  });

  it('closes the preview modal when its close button is clicked', () => {
    render(
      <EntityHeader
        {...defaultProps}
        logo="https://example.com/logo.png"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /view toronto maple leafs logo/i }));
    expect(screen.getByAltText('Toronto Maple Leafs')).toBeInTheDocument();

    // The preview modal close button is the only icon-only button (no text content)
    // currently in the DOM since no onEdit was provided.
    const allBtns = screen.getAllByRole('button');
    const closeBtn = allBtns.find((b) => !b.textContent?.trim() && !b.getAttribute('aria-label'))!;
    fireEvent.click(closeBtn);
    expect(screen.queryByAltText('Toronto Maple Leafs')).toBeNull();
  });
});

describe('EntityHeader – color swatches', () => {
  it('renders swatch labels when swatches are provided', () => {
    render(
      <EntityHeader
        {...defaultProps}
        swatches={[
          { label: 'Primary', color: '#003087' },
          { label: 'Text', color: '#ffffff' },
        ]}
      />,
    );
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('does not render the swatches container when swatches is empty', () => {
    const { container } = render(
      <EntityHeader
        {...defaultProps}
        swatches={[]}
      />,
    );
    expect(container.querySelector('.swatches')).toBeNull();
  });

  it('does not render the swatches container when swatches prop is omitted', () => {
    const { container } = render(<EntityHeader {...defaultProps} />);
    expect(container.querySelector('.swatches')).toBeNull();
  });
});
