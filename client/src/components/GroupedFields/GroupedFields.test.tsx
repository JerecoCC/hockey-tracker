import { render, screen } from '@testing-library/react';
import GroupedFields from './GroupedFields';

describe('GroupedFields', () => {
  it('renders a labeled fieldset with grouped field content', () => {
    render(
      <GroupedFields legend="Forwards">
        <input aria-label="Forward 1" />
      </GroupedFields>,
    );

    const fieldset = screen.getByRole('group', { name: 'Forwards' });
    expect(fieldset).toHaveClass('groupedFields');
    expect(screen.getByLabelText('Forward 1')).toBeInTheDocument();
  });

  it('forwards fieldset attributes and custom classes', () => {
    render(
      <GroupedFields
        legend="Defense"
        disabled
        className="customGroup"
        legendClassName="customLegend"
        fieldsClassName="customFields"
      >
        <button type="button">Pick player</button>
      </GroupedFields>,
    );

    const fieldset = screen.getByRole('group', { name: 'Defense' });
    expect(fieldset).toBeDisabled();
    expect(fieldset).toHaveClass('customGroup');
    expect(screen.getByText('Defense')).toHaveClass('customLegend');
    expect(screen.getByText('Pick player').parentElement).toHaveClass('customFields');
  });

  it('can render without a legend as plain grouped content', () => {
    render(
      <GroupedFields variant="plain">
        <input aria-label="Round" />
      </GroupedFields>,
    );

    const fieldset = screen.getByRole('group');
    expect(fieldset).toHaveClass('plain');
    expect(screen.queryByText('Playoff Details')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Round')).toBeInTheDocument();
  });
});
