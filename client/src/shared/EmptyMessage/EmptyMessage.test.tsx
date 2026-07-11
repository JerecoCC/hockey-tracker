import { render, screen } from '@testing-library/react';
import EmptyMessage from './EmptyMessage';

describe('EmptyMessage', () => {
  it('renders the default message and forwards paragraph attributes', () => {
    render(
      <EmptyMessage
        className="customMessage"
        data-testid="empty-message"
      >
        No records yet.
      </EmptyMessage>,
    );

    expect(screen.getByTestId('empty-message')).toHaveClass('message', 'customMessage');
    expect(screen.getByText('No records yet.').tagName).toBe('P');
  });
});
