import { fireEvent, render, screen } from '@testing-library/react';
import CheckboxField from './CheckboxField';

describe('CheckboxField', () => {
  it('renders a labelled checkbox field', () => {
    render(
      <CheckboxField
        checked
        label="Playoff Game"
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Playoff Game' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('calls onChange with the next checked state', () => {
    const handleChange = jest.fn();
    render(
      <CheckboxField
        checked={false}
        label="Uses nominees"
        onChange={handleChange}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Uses nominees' }));
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when disabled', () => {
    const handleChange = jest.fn();
    render(
      <CheckboxField
        checked={false}
        label="Disabled"
        onChange={handleChange}
        disabled
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Disabled' }));
    expect(handleChange).not.toHaveBeenCalled();
  });
});
