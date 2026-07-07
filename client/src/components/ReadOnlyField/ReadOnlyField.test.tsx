import { render, screen } from '@testing-library/react';
import ReadOnlyField from './ReadOnlyField';

describe('ReadOnlyField', () => {
  it('renders a labeled disabled-looking value', () => {
    render(
      <ReadOnlyField
        label="Season"
        value="2024-25"
        title="Already assigned"
      />,
    );

    const value = screen.getByText('2024-25');
    const box = value.closest('[aria-disabled="true"]');

    expect(screen.getByText('Season')).toBeInTheDocument();
    expect(box).toBeInTheDocument();
    expect(box).toHaveAccessibleName('Season');
    expect(box).not.toHaveAttribute('title');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Already assigned');
  });
});
