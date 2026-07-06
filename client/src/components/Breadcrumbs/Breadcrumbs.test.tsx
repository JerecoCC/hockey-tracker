import { render, screen, fireEvent } from '@testing-library/react';
import Breadcrumbs from './Breadcrumbs';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

beforeEach(() => jest.clearAllMocks());

describe('Breadcrumbs', () => {
  it('renders a single item as plain text (not a link)', () => {
    render(<Breadcrumbs items={[{ label: 'Home' }]} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders the last item as plain text even when a path is provided', () => {
    render(
      <Breadcrumbs items={[{ label: 'Leagues', path: '/admin/leagues' }, { label: 'NHL' }]} />,
    );
    const lastItem = screen.getByText('NHL');
    expect(lastItem.tagName).not.toBe('A');
  });

  it('renders non-last items with a path as links', () => {
    render(
      <Breadcrumbs items={[{ label: 'Leagues', path: '/admin/leagues' }, { label: 'NHL' }]} />,
    );
    expect(screen.getByRole('link', { name: 'Leagues' })).toHaveAttribute(
      'href',
      '/admin/leagues',
    );
  });

  it('navigates to the correct path when a breadcrumb link is clicked', () => {
    render(
      <Breadcrumbs items={[{ label: 'Leagues', path: '/admin/leagues' }, { label: 'NHL' }]} />,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Leagues' }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/leagues');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('leaves modified clicks to the browser', () => {
    render(
      <Breadcrumbs items={[{ label: 'Leagues', path: '/admin/leagues' }, { label: 'NHL' }]} />,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Leagues' }), { ctrlKey: true });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not render a link for a non-last item without a path', () => {
    render(<Breadcrumbs items={[{ label: 'Settings' }, { label: 'Profile' }]} />);
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders a separator icon between items', () => {
    const { container } = render(
      <Breadcrumbs items={[{ label: 'Leagues', path: '/admin/leagues' }, { label: 'NHL' }]} />,
    );
    // Each non-first item gets a chevron separator (rendered as an SVG icon)
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render a separator before the first item', () => {
    const { container } = render(<Breadcrumbs items={[{ label: 'Home' }]} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders multiple items and separators correctly', () => {
    render(
      <Breadcrumbs
        items={[
          { label: 'Admin', path: '/admin' },
          { label: 'Leagues', path: '/admin/leagues' },
          { label: 'NHL' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leagues' })).toBeInTheDocument();
    expect(screen.getByText('NHL')).toBeInTheDocument();
  });

  it('renders within a <nav> with the correct aria-label', () => {
    render(<Breadcrumbs items={[{ label: 'Home' }]} />);
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
  });
});
