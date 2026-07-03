import { render, screen, fireEvent } from '@testing-library/react';
import ListItem from './ListItem';

// Wrap in a <ul> so the DOM is valid (ListItem renders a <li>).
const renderItem = (props: Parameters<typeof ListItem>[0]) =>
  render(
    <ul>
      <ListItem {...props} />
    </ul>,
  );

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------
describe('ListItem – basics', () => {
  it('renders a <li> element', () => {
    renderItem({ name: 'Toronto Maple Leafs' });
    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });

  it('renders the name text', () => {
    renderItem({ name: 'Toronto Maple Leafs' });
    expect(screen.getByText('Toronto Maple Leafs')).toBeInTheDocument();
  });

  it('forwards className to the <li>', () => {
    renderItem({ name: 'Leafs', className: 'my-custom-class' });
    expect(screen.getByRole('listitem')).toHaveClass('my-custom-class');
  });

  it('renders custom child content inside the info column', () => {
    renderItem({ name: 'Leafs', children: <span>Extra details</span> });
    const extra = screen.getByText('Extra details');

    expect(extra).toBeInTheDocument();
    expect(extra.closest('.info')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------
describe('ListItem – image', () => {
  it('renders an <img> when image is provided', () => {
    renderItem({ name: 'Leafs', image: 'https://example.com/logo.png' });
    // alt="" marks the image as decorative (role="presentation"), so query by alt text
    expect(screen.getByAltText('')).toBeInTheDocument();
  });

  it('sets the correct src on the image', () => {
    renderItem({ name: 'Leafs', image: 'https://example.com/logo.png' });
    expect(screen.getByAltText('')).toHaveAttribute('src', 'https://example.com/logo.png');
  });

  it('uses a custom image size when provided', () => {
    renderItem({ name: 'Leafs', image: 'https://example.com/logo.png', imageSize: 34 });
    expect(screen.getByAltText('').parentElement).toHaveStyle({ width: '34px', height: '34px' });
  });

  it('does not render a placeholder when image is provided', () => {
    renderItem({ name: 'Leafs', image: 'https://example.com/logo.png' });
    expect(screen.queryByText('Lea')).not.toBeInTheDocument();
  });

  it('renders a placeholder span when no image is provided', () => {
    renderItem({ name: 'Leafs' });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Lea')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Leading image
// ---------------------------------------------------------------------------
describe('ListItem - leading image', () => {
  it('uses a custom leading image size when provided', () => {
    renderItem({
      name: 'Leafs',
      hideImage: true,
      leadingImage: 'https://example.com/team-logo.png',
      leadingImagePlaceholder: 'TOR',
      leadingImageSize: 30,
    });

    expect(screen.getByAltText('').parentElement).toHaveStyle({ width: '30px', height: '30px' });
  });

  it('uses the custom leading image size for placeholders', () => {
    renderItem({
      name: 'Leafs',
      hideImage: true,
      leadingImagePlaceholder: 'TOR',
      leadingImageSize: 30,
    });

    expect(screen.getByText('TOR')).toHaveStyle({ width: '30px', height: '30px' });
  });
});

// ---------------------------------------------------------------------------
// hideImage
// ---------------------------------------------------------------------------
describe('ListItem – hideImage', () => {
  it('suppresses the <img> when hideImage is true and an image is provided', () => {
    renderItem({ name: 'Leafs', image: 'https://example.com/logo.png', hideImage: true });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('suppresses the placeholder when hideImage is true and no image is provided', () => {
    renderItem({ name: 'Leafs', hideImage: true });
    expect(screen.queryByText('Lea')).not.toBeInTheDocument();
  });

  it('still renders the name when hideImage is true', () => {
    renderItem({ name: 'Leafs', hideImage: true });
    expect(screen.getByText('Leafs')).toBeInTheDocument();
  });

  it('renders image normally when hideImage is false', () => {
    renderItem({ name: 'Leafs', image: 'https://example.com/logo.png', hideImage: false });
    expect(screen.getByAltText('')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Image shape
// ---------------------------------------------------------------------------
describe('ListItem – image_shape', () => {
  it('applies only the base logo class by default (square)', () => {
    renderItem({ name: 'Leafs', image: 'logo.png' });
    const img = screen.getByAltText('');
    expect(img.parentElement).toHaveClass('logo');
    expect(img.parentElement).not.toHaveClass('logoCircle');
  });

  it('applies logoCircle class when image_shape is circle', () => {
    renderItem({ name: 'Leafs', image: 'logo.png', image_shape: 'circle' });
    expect(screen.getByAltText('').parentElement).toHaveClass('logoCircle');
  });

  it('placeholder has only base class by default (square)', () => {
    renderItem({ name: 'Leafs' });
    const placeholder = screen.getByText('Lea');
    expect(placeholder.parentElement).toHaveClass('logoPlaceholder');
    expect(placeholder.parentElement).not.toHaveClass('logoPlaceholderCircle');
  });

  it('placeholder has circle class when image_shape is circle', () => {
    renderItem({ name: 'Leafs', image_shape: 'circle' });
    expect(screen.getByText('Lea').parentElement).toHaveClass('logoPlaceholderCircle');
  });
});

// ---------------------------------------------------------------------------
// Placeholder text fallback
// ---------------------------------------------------------------------------
describe('ListItem – placeholder text', () => {
  it('defaults to first 3 chars of name', () => {
    renderItem({ name: 'Toronto' });
    expect(screen.getByText('Tor')).toBeInTheDocument();
  });

  it('uses rightContent.value as fallback when type is code', () => {
    renderItem({ name: 'Toronto', rightContent: { type: 'code', value: 'TOR' } });
    // 'TOR' appears in both the placeholder and the badge — scope to the placeholder span
    const placeholder = document.querySelector('.logoPlaceholder') as HTMLElement;
    expect(placeholder).toHaveTextContent('TOR');
  });

  it('explicit placeholder overrides both name and code fallbacks', () => {
    renderItem({
      name: 'Toronto',
      placeholder: 'TML',
      rightContent: { type: 'code', value: 'TOR' },
    });
    expect(screen.getByText('TML')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// primaryColor / textColor
// ---------------------------------------------------------------------------
describe('ListItem – primaryColor / textColor', () => {
  it('applies background inline style when primaryColor is set', () => {
    renderItem({ name: 'Leafs', primaryColor: '#003e7e' });
    expect(screen.getByText('Lea').parentElement).toHaveStyle({ background: '#003e7e' });
  });

  it('also applies color when textColor is provided', () => {
    renderItem({ name: 'Leafs', primaryColor: '#003e7e', textColor: '#ffffff' });
    expect(screen.getByText('Lea')).toHaveStyle({ color: '#ffffff' });
  });

  it('does not apply inline styles when primaryColor is omitted', () => {
    renderItem({ name: 'Leafs' });
    expect(screen.getByText('Lea').parentElement).not.toHaveStyle({ background: '#003e7e' });
  });
});

// ---------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------
describe('ListItem - chip', () => {
  it('renders an optional chip', () => {
    renderItem({ name: 'Leafs', chip: { label: 34 } });

    expect(screen.getByText('34')).toHaveClass('chip');
  });

  it('uses row colors for the chip by default', () => {
    renderItem({
      name: 'Leafs',
      primaryColor: '#003e7e',
      textColor: '#ffffff',
      chip: { label: 34 },
    });

    expect(screen.getByText('34')).toHaveStyle({
      background: '#336598',
      borderColor: '#003e7e',
      color: '#ffffff',
    });
  });

  it('passes the chip size through', () => {
    renderItem({ name: 'Leafs', chip: { label: 1, size: 'small' } });

    expect(screen.getByText('1')).toHaveClass('small');
  });
});

// ---------------------------------------------------------------------------
// Custom right content
// ---------------------------------------------------------------------------
describe('ListItem - custom rightContent', () => {
  it('renders custom right content', () => {
    renderItem({
      name: 'Leafs',
      rightContent: <span data-testid="right-stat">99</span>,
    });

    expect(screen.getByTestId('right-stat')).toHaveTextContent('99');
  });
});

// ---------------------------------------------------------------------------
// Compact layout
// ---------------------------------------------------------------------------
describe('ListItem - compact layout', () => {
  it('renders only pre-text content, main text, and right content', () => {
    renderItem({
      name: 'Leafs',
      size: 'compact',
      image: 'https://example.com/logo.png',
      leadingImagePlaceholder: 'TOR',
      eyebrow: 'Eyebrow',
      subtitle: 'Subtitle',
      note: 'Note',
      preTextContent: <span data-testid="pre-text">1.</span>,
      rightContent: <span data-testid="right-content">99</span>,
      children: <span>Extra details</span>,
      actions: [{ icon: 'edit', onClick: jest.fn() }],
    });

    expect(screen.getByTestId('pre-text')).toHaveTextContent('1.');
    expect(screen.getByText('Leafs')).toBeInTheDocument();
    expect(screen.getByTestId('right-content')).toHaveTextContent('99');
    expect(screen.queryByAltText('')).not.toBeInTheDocument();
    expect(screen.queryByText('TOR')).not.toBeInTheDocument();
    expect(screen.queryByText('Eyebrow')).not.toBeInTheDocument();
    expect(screen.queryByText('Subtitle')).not.toBeInTheDocument();
    expect(screen.queryByText('Note')).not.toBeInTheDocument();
    expect(screen.queryByText('Extra details')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Subtitle and note
// ---------------------------------------------------------------------------
describe('ListItem – subtitle and note', () => {
  it('renders subtitle when provided', () => {
    renderItem({ name: 'Leafs', subtitle: 'Eastern Conference' });
    expect(screen.getByText('Eastern Conference')).toBeInTheDocument();
  });

  it('renders note when provided', () => {
    renderItem({ name: 'Leafs', note: 'Formerly known as...' });
    expect(screen.getByText('Formerly known as...')).toBeInTheDocument();
  });

  it('renders both subtitle and note together', () => {
    renderItem({ name: 'Leafs', subtitle: 'East', note: 'Note text' });
    expect(screen.getByText('East')).toBeInTheDocument();
    expect(screen.getByText('Note text')).toBeInTheDocument();
  });

  it('renders neither when both are omitted', () => {
    renderItem({ name: 'Leafs' });
    expect(screen.queryByText('East')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// rightContent – code
// ---------------------------------------------------------------------------
describe('ListItem – rightContent code', () => {
  it('renders the code value as a badge', () => {
    // Provide an image so there is no placeholder competing for the same text
    renderItem({ name: 'Leafs', image: 'logo.png', rightContent: { type: 'code', value: 'TOR' } });
    expect(screen.getByText('TOR')).toBeInTheDocument();
  });

  it('applies the code class to the badge span', () => {
    renderItem({ name: 'Leafs', image: 'logo.png', rightContent: { type: 'code', value: 'TOR' } });
    expect(screen.getByText('TOR')).toHaveClass('code');
  });
});

// ---------------------------------------------------------------------------
// rightContent – tag
// ---------------------------------------------------------------------------
describe('ListItem – rightContent tag', () => {
  it('renders the tag label text', () => {
    renderItem({
      name: 'Leafs',
      rightContent: { type: 'tag', label: 'Active', intent: 'success' },
    });
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('does not render a code badge when rightContent is a tag', () => {
    renderItem({
      name: 'Leafs',
      rightContent: { type: 'tag', label: 'Active', intent: 'success' },
    });
    expect(screen.queryByText('TOR')).not.toBeInTheDocument();
  });

  it('renders nothing in the right slot when rightContent is omitted', () => {
    renderItem({ name: 'Leafs' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // Confirm only the name text is present, no pill or badge
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Interactive row
// ---------------------------------------------------------------------------
describe('ListItem - interactive row', () => {
  it('calls onClick for mouse and keyboard activation', () => {
    const onClick = jest.fn();
    renderItem({
      name: 'Leafs',
      onClick,
      ariaLabel: 'Open Leafs',
    });

    const row = screen.getByRole('button', { name: 'Open Leafs' });
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });

    expect(onClick).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
describe('ListItem – actions', () => {
  it('renders one button per action', () => {
    const actions = [
      { icon: 'edit', onClick: jest.fn() },
      { icon: 'delete', onClick: jest.fn() },
    ];
    renderItem({ name: 'Leafs', actions });
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('calls onClick when an action button is clicked', () => {
    const handleClick = jest.fn();
    renderItem({ name: 'Leafs', actions: [{ icon: 'edit', onClick: handleClick }] });
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger row onClick when an action button is clicked', () => {
    const handleAction = jest.fn();
    const handleRowClick = jest.fn();
    renderItem({
      name: 'Leafs',
      onClick: handleRowClick,
      actions: [{ icon: 'edit', onClick: handleAction }],
    });

    fireEvent.click(screen.getAllByRole('button')[1]);

    expect(handleAction).toHaveBeenCalledTimes(1);
    expect(handleRowClick).not.toHaveBeenCalled();
  });

  it('filters out falsy entries from the actions array', () => {
    const actions = [
      { icon: 'edit', onClick: jest.fn() },
      false as const,
      null,
      { icon: 'delete', onClick: jest.fn() },
    ];
    renderItem({ name: 'Leafs', actions });
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('does not render any buttons when actions is omitted', () => {
    renderItem({ name: 'Leafs' });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
