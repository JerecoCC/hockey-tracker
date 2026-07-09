import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import type { Control, FieldValues, RegisterOptions } from 'react-hook-form';
import BulkTradeModal from './BulkTradeModal';

jest.mock('@/hooks/useTeams', () => ({
  __esModule: true,
  default: () => ({
    teams: [
      {
        id: 'team-current',
        name: 'Current Team',
        code: 'CUR',
        league_id: 'league-1',
      },
      {
        id: 'team-next',
        name: 'Next Team',
        code: 'NXT',
        league_id: 'league-1',
      },
    ],
  }),
}));

jest.mock('@jerecocc/tracker-ui/Field', () => {
  const { useController } = jest.requireActual('react-hook-form');

  interface MockFieldOption {
    value: string;
    label: string;
  }

  interface MockFieldProps {
    control: Control<FieldValues>;
    name: string;
    label?: string;
    placeholder?: string;
    type?: string;
    options?: MockFieldOption[];
    rules?: RegisterOptions<FieldValues>;
    required?: boolean;
    disabled?: boolean;
  }

  const MockField = ({
    control,
    name,
    label,
    placeholder,
    type,
    options,
    rules,
    required,
    disabled,
  }: MockFieldProps) => {
    const { field } = useController({ name, control, rules: rules ?? {} });

    if (type === 'select') {
      return (
        <label>
          {label}
          <select
            aria-label={label ?? placeholder}
            {...field}
            required={required}
            disabled={disabled}
          >
            <option value="">{placeholder ?? ''}</option>
            {(options ?? []).map((option: { value: string; label: string }) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    return (
      <label>
        {label}
        <input
          aria-label={label ?? placeholder}
          placeholder={placeholder}
          {...field}
          required={required}
          disabled={disabled}
        />
      </label>
    );
  };

  MockField.displayName = 'MockField';
  return { __esModule: true, default: MockField };
});

const players = [
  {
    id: 'player-1',
    first_name: 'Sarah',
    last_name: 'Nurse',
    jersey_number: 20,
  },
  {
    id: 'player-2',
    first_name: 'Marie-Philip',
    last_name: 'Poulin',
    jersey_number: 29,
  },
] as ComponentProps<typeof BulkTradeModal>['players'];

const renderModal = () =>
  render(
    <BulkTradeModal
      open
      onClose={jest.fn()}
      players={players}
      teamId="team-current"
      leagueId="league-1"
      seasonId="season-1"
      bulkTradePlayers={jest.fn()}
    />,
  );

describe('BulkTradeModal', () => {
  it('uses move players wording and a narrower player jersey column', () => {
    const { container } = renderModal();

    expect(screen.getByText('Move Players')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move 1 Player' })).toBeInTheDocument();
    expect(screen.queryByText('Trade Players')).not.toBeInTheDocument();

    const headerRow = container.querySelector('.headerRow') as HTMLElement;
    expect(headerRow).toHaveClass('headerRowWithIntro');
    expect(headerRow).toHaveStyle({ gridTemplateColumns: '4.5rem minmax(0, 1fr) 2rem' });
  });

  it('matches the single-player move form field order before the players list', () => {
    renderModal();

    expect(screen.getByLabelText('Move To')).toBeInTheDocument();
    expect(screen.queryByLabelText('Trade To')).not.toBeInTheDocument();

    const movementGroup = screen.getByRole('group', { name: 'MOVEMENT' });
    expect(
      within(movementGroup)
        .getAllByLabelText(/^(Type|Date)$/)
        .map((control) => control.getAttribute('aria-label')),
    ).toEqual(['Type', 'Date']);
  });
});
