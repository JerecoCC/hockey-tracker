import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

const defaultProps = {
  open: true,
  title: 'Test Modal',
  onClose: jest.fn(),
  children: <p>Modal body content</p>,
};

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: jest.fn(),
  });
});

beforeEach(() => jest.clearAllMocks());

const mockBodyOverflow = (scrollHeight: number, clientHeight: number) => {
  const scrollHeightSpy = jest
    .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
    .mockReturnValue(scrollHeight);
  const clientHeightSpy = jest
    .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
    .mockReturnValue(clientHeight);

  return () => {
    scrollHeightSpy.mockRestore();
    clientHeightSpy.mockRestore();
  };
};

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

  it('locks page and app scroll targets while open', () => {
    const scrollTarget = document.createElement('div');
    scrollTarget.dataset.appScrollLockTarget = 'true';
    scrollTarget.style.overflow = 'auto';
    scrollTarget.style.touchAction = 'pan-y';
    scrollTarget.style.overscrollBehavior = 'contain';
    document.body.appendChild(scrollTarget);

    const { unmount } = render(<Modal {...defaultProps} />);

    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overscrollBehavior).toBe('none');
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.overflow).toBe('hidden');
    expect(scrollTarget.style.overflow).toBe('hidden');
    expect(scrollTarget.style.touchAction).toBe('none');
    expect(scrollTarget.style.overscrollBehavior).toBe('none');

    unmount();

    expect(document.documentElement.style.overflow).toBe('');
    expect(document.documentElement.style.overscrollBehavior).toBe('');
    expect(document.body.style.position).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(scrollTarget.style.overflow).toBe('auto');
    expect(scrollTarget.style.touchAction).toBe('pan-y');
    expect(scrollTarget.style.overscrollBehavior).toBe('contain');
    scrollTarget.remove();
  });

  it('keeps the background locked until every open modal unmounts', () => {
    const firstModal = render(
      <Modal
        {...defaultProps}
        title="First Modal"
      />,
    );
    const secondModal = render(
      <Modal
        {...defaultProps}
        title="Second Modal"
      />,
    );

    expect(document.body.style.position).toBe('fixed');

    firstModal.unmount();
    expect(document.body.style.position).toBe('fixed');

    secondModal.unmount();
    expect(document.body.style.position).toBe('');
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

  it('does NOT call onClose when backdrop close is disabled', () => {
    const onClose = jest.fn();
    const { container } = render(
      <Modal
        {...defaultProps}
        onClose={onClose}
        disableBackdropClose
      />,
    );
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
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

  it('hides the footer divider when the modal body does not overflow', () => {
    const restoreOverflow = mockBodyOverflow(100, 100);

    render(
      <Modal
        {...defaultProps}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('modal-footer-divider')).not.toBeInTheDocument();
    restoreOverflow();
  });

  it('shows the footer divider when the modal body can scroll', () => {
    const restoreOverflow = mockBodyOverflow(200, 100);

    render(
      <Modal
        {...defaultProps}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.getByTestId('modal-footer-divider')).toBeInTheDocument();
    restoreOverflow();
  });
});
