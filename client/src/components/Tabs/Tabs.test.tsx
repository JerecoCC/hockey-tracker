import { render, screen, fireEvent } from '@testing-library/react';
import Tabs, { type Tab } from './Tabs';

const tabs: Tab[] = [
  { label: 'Alpha', content: <div>Alpha content</div> },
  { label: 'Beta', content: <div>Beta content</div> },
  { label: 'Gamma', content: <div>Gamma content</div> },
];

describe('Tabs – rendering', () => {
  it('renders a tab button for each tab', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByRole('tab', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Beta' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Gamma' })).toBeInTheDocument();
  });

  it('shows the first tab content by default', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByText('Alpha content')).toBeInTheDocument();
    expect(screen.queryByText('Beta content')).not.toBeInTheDocument();
  });

  it('marks the first tab as selected by default', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveAttribute('aria-selected', 'false');
  });

  it('renders the tablist with role="tablist"', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('applies an extra className when provided', () => {
    const { container } = render(
      <Tabs
        tabs={tabs}
        className="custom-class"
      />,
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('Tabs – switching (uncontrolled)', () => {
  it('shows the clicked tab content', () => {
    render(<Tabs tabs={tabs} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(screen.getByText('Beta content')).toBeInTheDocument();
    expect(screen.queryByText('Alpha content')).not.toBeInTheDocument();
  });

  it('marks the clicked tab as selected', () => {
    render(<Tabs tabs={tabs} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false');
  });

  it('can switch between multiple tabs', () => {
    render(<Tabs tabs={tabs} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Gamma' }));
    expect(screen.getByText('Gamma content')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Alpha' }));
    expect(screen.getByText('Alpha content')).toBeInTheDocument();
    expect(screen.queryByText('Gamma content')).not.toBeInTheDocument();
  });
});

describe('Tabs – onTabChange callback', () => {
  it('calls onTabChange with the clicked index', () => {
    const onTabChange = jest.fn();
    render(
      <Tabs
        tabs={tabs}
        onTabChange={onTabChange}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(onTabChange).toHaveBeenCalledWith(1);
  });

  it('calls onTabChange with index 0 when the first tab is re-clicked', () => {
    const onTabChange = jest.fn();
    render(
      <Tabs
        tabs={tabs}
        onTabChange={onTabChange}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Alpha' }));
    expect(onTabChange).toHaveBeenCalledWith(0);
  });
});

describe('Tabs – defaultIndex', () => {
  it('starts on the tab at defaultIndex', () => {
    render(
      <Tabs
        tabs={tabs}
        defaultIndex={1}
      />,
    );
    expect(screen.getByText('Beta content')).toBeInTheDocument();
    expect(screen.queryByText('Alpha content')).not.toBeInTheDocument();
  });

  it('marks the defaultIndex tab as selected initially', () => {
    render(
      <Tabs
        tabs={tabs}
        defaultIndex={2}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false');
  });

  it('still allows switching tabs after mounting with defaultIndex', () => {
    render(
      <Tabs
        tabs={tabs}
        defaultIndex={1}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Alpha' }));
    expect(screen.getByText('Alpha content')).toBeInTheDocument();
  });
});

describe('Tabs – controlled mode', () => {
  it('shows the tab at the provided activeIndex', () => {
    render(
      <Tabs
        tabs={tabs}
        activeIndex={2}
      />,
    );
    expect(screen.getByText('Gamma content')).toBeInTheDocument();
    expect(screen.queryByText('Alpha content')).not.toBeInTheDocument();
  });

  it('marks the controlled tab as selected', () => {
    render(
      <Tabs
        tabs={tabs}
        activeIndex={1}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false');
  });
});
