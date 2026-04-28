import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import BulkAddPlayersModal from '@/pages/admin/leagues/BulkAddPlayersModal';

// Replace the custom Field/Select with native elements that still register
// properly with react-hook-form, so tests can use fireEvent.change without
// fighting the custom combobox internals.
jest.mock('../../../components/Field/Field', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useController } = require('react-hook-form');
  const MockField = ({
    control,
    name,
    placeholder,
    type,
    options,
    required,
    disabled,
    rules,
  }: any) => {
    const { field } = useController({ name, control, rules: rules ?? {} });
    if (type === 'select') {
      return (
        <select
          aria-label={placeholder}
          {...field}
          required={required}
          disabled={disabled}
        >
          <option value="" />
          {options?.map((o: any) => (
            <option
              key={o.value}
              value={o.value}
            >
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        placeholder={placeholder}
        {...field}
        required={required}
        disabled={disabled}
      />
    );
  };
  return { __esModule: true, default: MockField };
});

const mockBulkAddPlayers = jest.fn();

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  bulkAddPlayers: mockBulkAddPlayers,
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
describe('BulkAddPlayersModal – render', () => {
  it('renders the modal title', () => {
    render(<BulkAddPlayersModal {...defaultProps} />);
    expect(screen.getByText('Bulk Create Players')).toBeInTheDocument();
  });

  it('renders column header labels', () => {
    render(<BulkAddPlayersModal {...defaultProps} />);
    // Scope to headerRow to avoid matching select labels/options with the same text
    const headerRow = document.querySelector('.headerRow') as HTMLElement;
    ['First Name', 'Last Name', 'Position', 'Shoots'].forEach((label) => {
      expect(within(headerRow).getByText(label)).toBeInTheDocument();
    });
  });

  it('starts with exactly one player row', () => {
    render(<BulkAddPlayersModal {...defaultProps} />);
    expect(screen.getAllByRole('button', { name: /remove player/i })).toHaveLength(1);
  });

  it('renders Create Player and Cancel buttons', () => {
    render(<BulkAddPlayersModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /create player/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(
      <BulkAddPlayersModal
        {...defaultProps}
        open={false}
      />,
    );
    expect(screen.queryByText('Bulk Create Players')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Adding rows
// ---------------------------------------------------------------------------
describe('BulkAddPlayersModal – add row', () => {
  it('adds a new row when "Create Player" is clicked', () => {
    render(<BulkAddPlayersModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /create player/i }));
    expect(screen.getAllByRole('button', { name: /remove player/i })).toHaveLength(2);
  });

  it('updates the save button label with correct count', () => {
    render(<BulkAddPlayersModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /save 1 player\b/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /create player/i }));
    expect(screen.getByRole('button', { name: /save 2 players/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Delete row – blank row (no confirm needed)
// ---------------------------------------------------------------------------
describe('BulkAddPlayersModal – delete blank row', () => {
  it('removes a blank row immediately without a confirm dialog', () => {
    render(<BulkAddPlayersModal {...defaultProps} />);
    // Add a second row so we can delete the first
    fireEvent.click(screen.getByRole('button', { name: /create player/i }));
    expect(screen.getAllByRole('button', { name: /remove player/i })).toHaveLength(2);

    // Click delete on the first (blank) row
    fireEvent.click(screen.getAllByRole('button', { name: /remove player/i })[0]);

    // Confirm modal should NOT appear
    expect(screen.queryByText('Remove Player')).not.toBeInTheDocument();
    // Row count drops back to 1
    expect(screen.getAllByRole('button', { name: /remove player/i })).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Delete row – dirty row (confirm required)
// ---------------------------------------------------------------------------
describe('BulkAddPlayersModal – delete dirty row', () => {
  it('shows confirm modal when deleting a row that has been edited', () => {
    render(<BulkAddPlayersModal {...defaultProps} />);
    // Add a second row
    fireEvent.click(screen.getByRole('button', { name: /create player/i }));

    // Type into the first row's first name input
    const inputs = screen.getAllByPlaceholderText('First name');
    fireEvent.change(inputs[0], { target: { value: 'Wayne' } });

    // Click delete on that dirty row
    fireEvent.click(screen.getAllByRole('button', { name: /remove player/i })[0]);

    // Confirm modal should appear
    expect(screen.getByText('Remove Player')).toBeInTheDocument();
  });

  it('removes the row after confirming', () => {
    render(<BulkAddPlayersModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /create player/i }));

    const inputs = screen.getAllByPlaceholderText('First name');
    fireEvent.change(inputs[0], { target: { value: 'Wayne' } });
    fireEvent.click(screen.getAllByRole('button', { name: /remove player/i })[0]);

    // Click "Remove" in the confirm modal
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));

    expect(screen.queryByText('Remove Player')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /remove player/i })).toHaveLength(1);
  });

  it('keeps the row when cancelling the confirm dialog', () => {
    render(<BulkAddPlayersModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /create player/i }));

    const inputs = screen.getAllByPlaceholderText('First name');
    fireEvent.change(inputs[0], { target: { value: 'Wayne' } });
    fireEvent.click(screen.getAllByRole('button', { name: /remove player/i })[0]);

    // Two Cancel buttons exist: the form's own Cancel + the ConfirmModal's Cancel.
    // The ConfirmModal's is rendered last in the DOM.
    const cancelBtns = screen.getAllByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtns[cancelBtns.length - 1]);

    expect(screen.queryByText('Remove Player')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /remove player/i })).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Cancel / close
// ---------------------------------------------------------------------------
describe('BulkAddPlayersModal – cancel', () => {
  it('calls onClose when Cancel button is clicked', () => {
    const onClose = jest.fn();
    render(
      <BulkAddPlayersModal
        {...defaultProps}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Form submit
// ---------------------------------------------------------------------------
describe('BulkAddPlayersModal – submit', () => {
  it('calls bulkAddPlayers with all row data on submit', async () => {
    mockBulkAddPlayers.mockResolvedValueOnce(true);
    render(<BulkAddPlayersModal {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Wayne' } });
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Gretzky' } });

    // With Field mocked to native selects, change via aria-label
    fireEvent.change(screen.getByRole('combobox', { name: /position/i }), {
      target: { value: 'C' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /shoots/i }), { target: { value: 'L' } });

    fireEvent.click(screen.getByRole('button', { name: /save 1 player\b/i }));

    await waitFor(() => expect(mockBulkAddPlayers).toHaveBeenCalledTimes(1));
    expect(mockBulkAddPlayers).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ first_name: 'Wayne', last_name: 'Gretzky' }),
      ]),
    );
  });
});
