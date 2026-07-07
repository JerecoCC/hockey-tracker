/* eslint-disable react/prop-types */
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SeasonRecord } from '@/hooks/useSeasons';
import type { TeamRecord } from '@/hooks/useTeams';
import StintEditModal from './StintEditModal';

jest.mock('@/components/Modal/Modal', () => {
  interface MockModalProps {
    title: string;
    children: ReactNode;
    confirmForm?: string;
  }

  const MockModal = ({ title, children, confirmForm }: MockModalProps) => (
    <div>
      <h1>{title}</h1>
      {children}
      <button
        type="submit"
        form={confirmForm}
      >
        Save
      </button>
    </div>
  );
  MockModal.displayName = 'MockModal';
  return MockModal;
});

jest.mock('@/components/Field/Field', () => {
  const { Controller } = jest.requireActual('react-hook-form');

  interface MockFieldProps {
    control: unknown;
    name: string;
    rules?: unknown;
    type?: string;
    label: string;
    placeholder?: string;
    disabled?: boolean;
    options?: Array<{ value: string; label: string; logo?: string; code?: string | null }>;
  }

  const MockField = (props: MockFieldProps) => (
    <Controller
      control={props.control}
      name={props.name}
      rules={props.rules}
      render={({ field }: { field: { value: string; onChange: (value: string) => void } }) => (
        <label>
          {props.label}
          {props.type === 'select' ? (
            <select
              aria-label={props.label}
              value={field.value ?? ''}
              onChange={(event) => field.onChange(event.target.value)}
              disabled={props.disabled}
            >
              <option value="">{props.placeholder ?? ''}</option>
              {(props.options ?? []).map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label={props.label}
              value={field.value ?? ''}
              onChange={(event) => field.onChange(event.target.value)}
              disabled={props.disabled}
            />
          )}
        </label>
      )}
    />
  );
  MockField.displayName = 'MockField';
  return MockField;
});

const teams = [
  {
    id: 'team-sjs',
    name: 'San Jose Sharks',
    code: 'SJS',
    logo: null,
    league_id: 'league-1',
  },
  {
    id: 'team-ana',
    name: 'Anaheim Ducks',
    code: 'ANA',
    logo: '/ducks.png',
    league_id: 'league-1',
  },
  {
    id: 'team-bos',
    name: 'Boston Bruins',
    code: 'BOS',
    logo: null,
    league_id: 'league-2',
  },
] as unknown as TeamRecord[];

const seasons = [
  {
    id: 'season-1',
    league_id: 'league-1',
    name: '2024-25',
    start_date: '2024-10-01',
    end_date: '2025-06-30',
    is_current: true,
  },
] as unknown as SeasonRecord[];

describe('StintEditModal', () => {
  it('records a new stint with move-style defaults and jersey number', async () => {
    const user = userEvent.setup();
    const createStint = jest.fn().mockResolvedValue(true);

    render(
      <StintEditModal
        open
        stint={null}
        teams={teams}
        seasons={seasons}
        leagueId="league-1"
        currentTeamId="team-sjs"
        onClose={jest.fn()}
        createStint={createStint}
        updateStint={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Acquisition Type')).toHaveValue('signing');
    expect(screen.getByRole('option', { name: 'Foundational Signing' })).toHaveValue(
      'foundational_signing',
    );
    expect(screen.queryByText('Roster Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Team History')).not.toBeInTheDocument();
    expect(
      Array.from((screen.getByLabelText('Team') as HTMLSelectElement).options).map(
        (option) => option.value,
      ),
    ).toEqual(['', 'team-ana']);

    await user.selectOptions(screen.getByLabelText('Team'), 'team-ana');
    await user.type(screen.getByLabelText('Start Date'), '2025-01-15');
    await user.type(screen.getByLabelText('Jersey #'), '23');
    await user.selectOptions(screen.getByLabelText('Position'), 'RW');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(createStint).toHaveBeenCalledWith(
      expect.objectContaining({
        team_id: 'team-ana',
        season_id: 'season-1',
        jersey_number: 23,
        is_prospect: false,
        position: 'RW',
        acquisition_type: 'signing',
        start_date: '2025-01-15',
      }),
    );
  });

  it('submits stint edits without changing prospect status', async () => {
    const user = userEvent.setup();
    const updateStint = jest.fn().mockResolvedValue(true);

    render(
      <StintEditModal
        open
        stint={
          {
            id: 'stint-1',
            player_id: 'player-kyle-masters',
            team_id: 'team-sjs',
            season_id: 'season-1',
            roster_player_team_id: 'roster-1',
            jersey_number: 44,
            is_prospect: false,
            photo: null,
            position: 'C',
            acquisition_type: 'draft',
            start_date: '2024-10-01',
            end_date: null,
            created_at: '2024-10-01T00:00:00.000Z',
            team: {
              id: 'team-sjs',
              name: 'San Jose Sharks',
              code: 'SJS',
              logo: null,
              primary_color: '#006d75',
              text_color: '#ffffff',
            },
          }
        }
        teams={teams}
        seasons={seasons}
        leagueId="league-1"
        currentTeamId="team-sjs"
        onClose={jest.fn()}
        createStint={jest.fn()}
        updateStint={updateStint}
      />,
    );

    expect(
      Array.from((screen.getByLabelText('Team') as HTMLSelectElement).options).map(
        (option) => option.value,
      ),
    ).toEqual(['', 'team-sjs', 'team-ana']);

    expect(screen.queryByText('Roster Status')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Jersey #'));
    await user.type(screen.getByLabelText('Jersey #'), '45');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const updatePayload = updateStint.mock.calls[0][1];
    expect(updateStint).toHaveBeenCalledWith(
      'stint-1',
      expect.objectContaining({
        team_id: 'team-sjs',
        season_id: 'season-1',
        jersey_number: 45,
      }),
    );
    expect(updatePayload).not.toHaveProperty('is_prospect');
  });

  it('does not submit jersey changes when editing an unlinked career stint', async () => {
    const user = userEvent.setup();
    const updateStint = jest.fn().mockResolvedValue(true);

    render(
      <StintEditModal
        open
        stint={
          {
            id: 'career-stint-1',
            player_id: 'player-kyle-masters',
            team_id: 'team-sjs',
            season_id: null,
            roster_player_team_id: null,
            jersey_number: null,
            is_prospect: false,
            photo: null,
            position: 'C',
            acquisition_type: 'draft',
            start_date: '2024-10-01',
            end_date: null,
            created_at: '2024-10-01T00:00:00.000Z',
            team: {
              id: 'team-sjs',
              name: 'San Jose Sharks',
              code: 'SJS',
              logo: null,
              primary_color: '#006d75',
              text_color: '#ffffff',
            },
          }
        }
        teams={teams}
        seasons={seasons}
        leagueId="league-1"
        currentTeamId="team-sjs"
        onClose={jest.fn()}
        createStint={jest.fn()}
        updateStint={updateStint}
      />,
    );

    expect(screen.getByLabelText('Jersey #')).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Acquisition Type'), 'trade');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateStint).toHaveBeenCalledWith(
      'career-stint-1',
      expect.not.objectContaining({
        jersey_number: expect.anything(),
      }),
    );
  });
});
