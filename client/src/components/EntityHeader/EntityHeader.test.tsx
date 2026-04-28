import { render, screen, fireEvent } from '@testing-library/react';
import EntityHeader from '@/components/EntityHeader/EntityHeader';

// Code longer than 3 chars so placeholder ('TOR') differs from full code ('TORONTO')
const defaultProps = {
  logo: null,
  name: 'Toronto Maple Leafs',
  code: 'TORONTO',
  primaryColor: '#003087',
  textColor: '#ffffff',
};

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
    expect(img).toHaveAttribute('alt', 'Toronto Maple Leafs');
  });

  it('renders a placeholder showing the first 3 chars of code when no logo', () => {
    render(<EntityHeader {...defaultProps} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('TOR')).toBeInTheDocument();
  });

  it('applies primaryColor and textColor to the placeholder', () => {
    render(<EntityHeader {...defaultProps} />);
    const placeholder = screen.getByText('TOR');
    // toHaveStyle normalizes both sides so hex === computed rgb
    expect(placeholder).toHaveStyle({ background: '#003087', color: '#ffffff' });
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

  it('renders no button when onEdit is omitted', () => {
    render(<EntityHeader {...defaultProps} />);
    expect(screen.queryByRole('button')).toBeNull();
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
