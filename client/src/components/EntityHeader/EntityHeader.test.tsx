import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EntityHeader from './EntityHeader';

const defaultProps = {
  logo: null,
  name: 'Toronto Maple Leafs',
  // Code longer than 3 chars so placeholder ('TOR') differs from full code ('TORONTO')
  code: 'TORONTO',
  primaryColor: '#003087',
  textColor: '#ffffff',
  isBusy: false,
  onLogoChange: jest.fn(),
  onEdit: jest.fn(),
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
    render(
      <EntityHeader
        {...defaultProps}
        logo={null}
      />,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('TOR')).toBeInTheDocument();
  });

  it('applies primaryColor and textColor to the placeholder', () => {
    render(
      <EntityHeader
        {...defaultProps}
        logo={null}
      />,
    );
    const placeholder = screen.getByText('TOR');
    // toHaveStyle normalizes both sides so hex === computed rgb
    expect(placeholder).toHaveStyle({ background: '#003087', color: '#ffffff' });
  });

  it('calls onLogoChange with the selected file when the file input changes', async () => {
    const onLogoChange = jest.fn().mockResolvedValue(undefined);
    render(
      <EntityHeader
        {...defaultProps}
        onLogoChange={onLogoChange}
      />,
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'logo.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => expect(onLogoChange).toHaveBeenCalledWith(file));
  });
});

describe('EntityHeader – edit buttons', () => {
  it('renders the logo edit button with the logoEditTooltip text', () => {
    render(
      <EntityHeader
        {...defaultProps}
        logoEditTooltip="Change Logo"
      />,
    );
    expect(screen.getByText('Change Logo')).toBeInTheDocument();
  });

  it('renders the name edit button with the editTooltip text', () => {
    render(
      <EntityHeader
        {...defaultProps}
        editTooltip="Edit League"
      />,
    );
    expect(screen.getByText('Edit League')).toBeInTheDocument();
  });

  it('calls onEdit when the name edit button is clicked', () => {
    const onEdit = jest.fn();
    render(
      <EntityHeader
        {...defaultProps}
        onEdit={onEdit}
        editTooltip="Edit"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('disables the name edit button when isBusy=true', () => {
    render(
      <EntityHeader
        {...defaultProps}
        isBusy={true}
        editTooltip="Edit"
      />,
    );
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeDisabled();
  });

  it('hides the logo edit button and shows a spinner when isBusy=true', () => {
    render(
      <EntityHeader
        {...defaultProps}
        isBusy={true}
        logoEditTooltip="Edit logo"
      />,
    );
    expect(screen.queryByText('Edit logo')).toBeNull();
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
