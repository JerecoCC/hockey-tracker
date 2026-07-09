import { render, screen } from '@testing-library/react';
import StatusTag from './StatusTag';

describe('StatusTag', () => {
  it('renders an accessible active status tag', () => {
    render(<StatusTag status="active" />);

    const tag = screen.getByRole('status', { name: 'Active' });
    expect(tag).toHaveClass('tag', 'active');
    expect(screen.getByText('ACTIVE')).toHaveClass('label');
  });

  it('forwards custom span attributes and classes', () => {
    render(
      <StatusTag
        status="retired"
        className="customStatus"
        data-testid="player-status"
      />,
    );

    expect(screen.getByTestId('player-status')).toHaveClass('tag', 'retired', 'customStatus');
    expect(screen.getByRole('status', { name: 'Retired' })).toBeInTheDocument();
  });
});
