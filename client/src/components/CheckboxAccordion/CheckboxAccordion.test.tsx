import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckboxAccordion from './CheckboxAccordion';

const Harness = () => {
  const [checked, setChecked] = useState(false);

  return (
    <CheckboxAccordion
      checked={checked}
      label="Playoff Game"
      onChange={setChecked}
    >
      <input aria-label="Round" />
    </CheckboxAccordion>
  );
};

describe('CheckboxAccordion', () => {
  it('opens and closes content from the checkbox field', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const checkbox = screen.getByRole('checkbox', { name: 'Playoff Game' });
    expect(checkbox).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Playoff Game' })).not.toBeInTheDocument();

    await user.click(checkbox);

    expect(checkbox).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Playoff Game' })).toBeInTheDocument();
    expect(screen.getByLabelText('Round')).toBeInTheDocument();

    await user.click(checkbox);

    expect(checkbox).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Playoff Game' })).not.toBeInTheDocument();
  });

  it('does not open while disabled', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(
      <CheckboxAccordion
        checked={false}
        label="Disabled"
        onChange={handleChange}
        disabled
      >
        <input aria-label="Hidden field" />
      </CheckboxAccordion>,
    );

    await user.click(screen.getByRole('checkbox', { name: 'Disabled' }));

    expect(handleChange).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Hidden field')).not.toBeInTheDocument();
  });
});
