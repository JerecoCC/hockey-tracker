import { render, screen } from '@testing-library/react';
import Badge from './Badge';

describe('Badge', () => {
  it('renders a required numeric value', () => {
    render(<Badge value={12} />);

    expect(screen.getByText('12')).toHaveClass('value');
  });

  it('renders the label after the value', () => {
    render(
      <Badge
        label="SA"
        value={31}
      />,
    );

    const badge = screen.getByText('SA').parentElement;
    expect(Array.from(badge?.children ?? []).map((child) => child.textContent)).toEqual([
      '31',
      'SA',
    ]);
  });

  it('forwards span attributes and custom classes', () => {
    render(
      <Badge
        value={4}
        className="customBadge"
        aria-label="4 watched games shown"
      />,
    );

    expect(screen.getByLabelText('4 watched games shown')).toHaveClass('badge', 'customBadge');
  });
});
