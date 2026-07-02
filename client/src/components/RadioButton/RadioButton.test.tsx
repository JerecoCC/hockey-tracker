import { fireEvent, render, screen } from '@testing-library/react';
import { type ComponentProps } from 'react';
import RadioButton from './RadioButton';

describe('RadioButton', () => {
  const renderRadioButton = (props: Omit<ComponentProps<typeof RadioButton>, 'ariaLabelledBy'>) =>
    render(
      <>
        <span id="selected-radio-label">Selected</span>
        <RadioButton
          {...props}
          ariaLabelledBy="selected-radio-label"
        />
      </>,
    );

  it('renders a checked radio state', () => {
    renderRadioButton({ checked: true });

    expect(screen.getByRole('radio', { name: 'Selected' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('calls onChange when an unchecked radio is clicked', () => {
    const handleChange = jest.fn();
    renderRadioButton({
      checked: false,
      onChange: handleChange,
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Selected' }));
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onChange when a checked radio is clicked', () => {
    const handleChange = jest.fn();
    renderRadioButton({
      checked: true,
      onChange: handleChange,
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Selected' }));
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('selects from keyboard activation only when unchecked', () => {
    const handleChange = jest.fn();
    const { rerender } = render(
      <>
        <span id="selected-radio-label">Selected</span>
        <RadioButton
          checked={false}
          onChange={handleChange}
          ariaLabelledBy="selected-radio-label"
        />
      </>,
    );

    const radio = screen.getByRole('radio', { name: 'Selected' });
    fireEvent.keyDown(radio, { key: ' ' });
    expect(handleChange).toHaveBeenCalledTimes(1);

    rerender(
      <>
        <span id="selected-radio-label">Selected</span>
        <RadioButton
          checked
          onChange={handleChange}
          ariaLabelledBy="selected-radio-label"
        />
      </>,
    );

    fireEvent.keyDown(screen.getByRole('radio', { name: 'Selected' }), { key: 'Enter' });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('does not select when disabled', () => {
    const handleChange = jest.fn();
    renderRadioButton({
      checked: false,
      onChange: handleChange,
      disabled: true,
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Selected' }));
    expect(handleChange).not.toHaveBeenCalled();
  });
});
