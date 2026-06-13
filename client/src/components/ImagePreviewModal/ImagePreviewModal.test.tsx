import { render, screen, fireEvent } from '@testing-library/react';
import ImagePreviewModal from './ImagePreviewModal';

const defaultProps = {
  open: true,
  src: 'https://example.com/photo.jpg',
  alt: 'Test photo',
  onClose: jest.fn(),
};

beforeAll(() => {
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: jest.fn(),
  });
});

beforeEach(() => jest.clearAllMocks());

describe('ImagePreviewModal', () => {
  it('renders nothing when open is false', () => {
    render(
      <ImagePreviewModal
        {...defaultProps}
        open={false}
      />,
    );
    expect(screen.queryByAltText('Test photo')).not.toBeInTheDocument();
  });

  it('renders nothing when src is null', () => {
    render(
      <ImagePreviewModal
        {...defaultProps}
        src={null}
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders nothing when src is undefined', () => {
    render(
      <ImagePreviewModal
        {...defaultProps}
        src={undefined}
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders the image with the provided src and alt when open', () => {
    render(<ImagePreviewModal {...defaultProps} />);
    const img = screen.getByAltText('Test photo') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('https://example.com/photo.jpg');
  });

  it('locks page scroll while open', () => {
    const scrollTarget = document.createElement('div');
    scrollTarget.dataset.appScrollLockTarget = 'true';
    scrollTarget.style.overflow = 'auto';
    document.body.appendChild(scrollTarget);

    const { unmount } = render(<ImagePreviewModal {...defaultProps} />);

    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');
    expect(scrollTarget.style.overflow).toBe('hidden');

    unmount();

    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.position).toBe('');
    expect(scrollTarget.style.overflow).toBe('auto');
    scrollTarget.remove();
  });

  it('uses an empty alt by default', () => {
    render(
      <ImagePreviewModal
        open
        src="https://example.com/photo.jpg"
        onClose={jest.fn()}
      />,
    );
    const img = document.querySelector('img') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('alt')).toBe('');
  });

  it('calls onClose when the overlay backdrop is clicked', () => {
    const onClose = jest.fn();
    const { container } = render(
      <ImagePreviewModal
        {...defaultProps}
        onClose={onClose}
      />,
    );
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when the image itself is clicked', () => {
    const onClose = jest.fn();
    render(
      <ImagePreviewModal
        {...defaultProps}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByAltText('Test photo'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <ImagePreviewModal
        {...defaultProps}
        onClose={onClose}
      />,
    );
    // The close button is icon-only (no visible text content).
    const allBtns = screen.getAllByRole('button');
    const closeBtn = allBtns.find((b) => !b.textContent?.trim())!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the Escape key is pressed', () => {
    const onClose = jest.fn();
    render(
      <ImagePreviewModal
        {...defaultProps}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose for non-Escape keys', () => {
    const onClose = jest.fn();
    render(
      <ImagePreviewModal
        {...defaultProps}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does NOT listen for Escape when closed', () => {
    const onClose = jest.fn();
    render(
      <ImagePreviewModal
        {...defaultProps}
        open={false}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
