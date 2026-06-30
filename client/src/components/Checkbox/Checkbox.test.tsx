import { fireEvent, render, screen } from '@testing-library/react';
import { type ComponentProps } from 'react';
import Checkbox from './Checkbox';

describe('Checkbox', () => {
  const renderCheckbox = (props: Omit<ComponentProps<typeof Checkbox>, 'ariaLabelledBy'>) =>
    render(
      <>
        <span id="selected-checkbox-label">Selected</span>
        <Checkbox
          {...props}
          ariaLabelledBy="selected-checkbox-label"
        />
      </>,
    );

  it('renders a checked checkbox state', () => {
    renderCheckbox({ checked: true });

    expect(screen.getByRole('checkbox', { name: 'Selected' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('calls onChange when clicked', () => {
    const handleChange = jest.fn();
    renderCheckbox({
      checked: false,
      onChange: handleChange,
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selected' }));
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('calls onChange from keyboard activation', () => {
    const handleChange = jest.fn();
    renderCheckbox({
      checked: false,
      onChange: handleChange,
    });

    const checkbox = screen.getByRole('checkbox', { name: 'Selected' });
    fireEvent.keyDown(checkbox, { key: ' ' });
    fireEvent.keyDown(checkbox, { key: 'Enter' });

    expect(handleChange).toHaveBeenCalledTimes(2);
  });

  it('does not toggle when disabled', () => {
    const handleChange = jest.fn();
    renderCheckbox({
      checked: false,
      onChange: handleChange,
      disabled: true,
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selected' }));
    expect(handleChange).not.toHaveBeenCalled();
  });
});
