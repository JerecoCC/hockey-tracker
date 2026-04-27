import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

const defaultProps = {
  open: true,
  title: 'Test Modal',
  onClose: jest.fn(),
  children: <p>Modal body content</p>,
};

beforeEach(() => jest.clearAllMocks());

describe('Modal', () => {
  it('renders nothing when open is false', () => {
    render(
      <Modal
        {...defaultProps}
        open={false}
      />,
    );
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Modal body content')).not.toBeInTheDocument();
  });

  it('renders the title when open is true', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
  });

  it('renders children when open is true', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('Modal body content')).toBeInTheDocument();
  });

  it('calls onClose when the overlay backdrop is clicked', () => {
    const onClose = jest.fn();
    const { container } = render(
      <Modal
        {...defaultProps}
        onClose={onClose}
      />,
    );
    // The overlay is the outermost div; clicking it directly triggers onClose
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when the modal panel itself is clicked', () => {
    const onClose = jest.fn();
    render(
      <Modal
        {...defaultProps}
        onClose={onClose}
      />,
    );
    // Clicking the title (inside the modal panel) should not bubble to the overlay
    fireEvent.click(screen.getByText('Test Modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <Modal
        {...defaultProps}
        onClose={onClose}
      />,
    );
    // The X close button is icon-only (no text); Cancel button also exists,
    // so use getAllByRole and find the icon-only one by its absence of text content.
    const allBtns = screen.getAllByRole('button');
    const closeBtn = allBtns.find((b) => !b.textContent?.trim())!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders different children correctly', () => {
    render(
      <Modal {...defaultProps}>
        <input placeholder="Type here" />
      </Modal>,
    );
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument();
  });
});
