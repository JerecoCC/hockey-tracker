import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmModal from './ConfirmModal';

const defaultProps = {
  open: true,
  title: 'Confirm Action',
  body: <span>Are you sure?</span>,
  confirmLabel: 'Delete',
  onCancel: jest.fn(),
  onConfirm: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('ConfirmModal', () => {
  it('renders nothing when open is false', () => {
    render(
      <ConfirmModal
        {...defaultProps}
        open={false}
      />,
    );
    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
  });

  it('renders the title when open is true', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
  });

  it('renders the body content', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders the confirmLabel on the confirm button', () => {
    render(
      <ConfirmModal
        {...defaultProps}
        confirmLabel="Remove"
      />,
    );
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('calls onCancel when the Cancel button is clicked', () => {
    const onCancel = jest.fn();
    render(
      <ConfirmModal
        {...defaultProps}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmModal
        {...defaultProps}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons when busy is true', () => {
    render(
      <ConfirmModal
        {...defaultProps}
        busy
      />,
    );
    // Cancel and Confirm should both be disabled (close button inside Modal is also a button)
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    const confirmBtn = screen.getByRole('button', { name: /delete/i });
    expect(cancelBtn).toBeDisabled();
    expect(confirmBtn).toBeDisabled();
  });

  it('does not disable buttons when busy is false', () => {
    render(
      <ConfirmModal
        {...defaultProps}
        busy={false}
      />,
    );
    expect(screen.getByRole('button', { name: /cancel/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /delete/i })).not.toBeDisabled();
  });

  it('renders a confirmIcon when provided', () => {
    const { container } = render(
      <ConfirmModal
        {...defaultProps}
        confirmIcon="delete"
      />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('calls onCancel when the modal close (X) button is clicked', () => {
    const onCancel = jest.fn();
    render(
      <ConfirmModal
        {...defaultProps}
        onCancel={onCancel}
      />,
    );
    // The X close button in Modal calls onClose which is onCancel here
    const allButtons = screen.getAllByRole('button');
    const closeBtn = allButtons.find((b) => !b.textContent?.trim());
    fireEvent.click(closeBtn!);
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders body as a plain string', () => {
    render(
      <ConfirmModal
        {...defaultProps}
        body="Plain text body"
      />,
    );
    expect(screen.getByText('Plain text body')).toBeInTheDocument();
  });
});
