import { render } from '@testing-library/react';
import BorderedFieldset from './BorderedFieldset';

describe('BorderedFieldset', () => {
  it('renders fieldset content with the shared bordered class', () => {
    const { getByText } = render(
      <BorderedFieldset>
        <legend>Round setup</legend>
        <span>Teams</span>
      </BorderedFieldset>,
    );

    expect(getByText('Round setup').closest('fieldset')).toHaveClass('borderedFieldset');
    expect(getByText('Teams')).toBeInTheDocument();
  });

  it('forwards className and fieldset attributes', () => {
    const { getByRole } = render(
      <BorderedFieldset
        className="customFieldset"
        disabled
      >
        <legend>Alignment group</legend>
        <button type="button">Add</button>
      </BorderedFieldset>,
    );

    const fieldset = getByRole('group', { name: 'Alignment group' });
    expect(fieldset).toHaveClass('borderedFieldset');
    expect(fieldset).toHaveClass('customFieldset');
    expect(fieldset).toBeDisabled();
  });
});
