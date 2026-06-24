import { fireEvent, render, screen } from '@testing-library/react';
import Checkbox from './Checkbox';

describe('Checkbox', () => {
  it('renders a checked checkbox state', () => {
    render(
      <Checkbox
        checked
        ariaLabel="Selected"
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Selected' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('calls onChange when clicked', () => {
    const handleChange = jest.fn();
    render(
      <Checkbox
        checked={false}
        onChange={handleChange}
        ariaLabel="Selected"
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selected' }));
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('calls onChange from keyboard activation', () => {
    const handleChange = jest.fn();
    render(
      <Checkbox
        checked={false}
        onChange={handleChange}
        ariaLabel="Selected"
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Selected' });
    fireEvent.keyDown(checkbox, { key: ' ' });
    fireEvent.keyDown(checkbox, { key: 'Enter' });

    expect(handleChange).toHaveBeenCalledTimes(2);
  });

  it('does not toggle when disabled', () => {
    const handleChange = jest.fn();
    render(
      <Checkbox
        checked={false}
        onChange={handleChange}
        disabled
        ariaLabel="Selected"
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selected' }));
    expect(handleChange).not.toHaveBeenCalled();
  });
});
