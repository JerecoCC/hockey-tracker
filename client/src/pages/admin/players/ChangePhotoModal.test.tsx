import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SeasonRecord } from '@/hooks/useSeasons';
import type { PlayerPhotoEntry, PlayerStintRecord } from '@/hooks/useTeamPlayers';
import ChangePhotoModal from './ChangePhotoModal';

jest.mock('@/components/Modal/Modal', () => {
  interface MockModalProps {
    open: boolean;
    title: string;
    children: ReactNode;
  }

  const MockModal = ({ open, title, children }: MockModalProps) =>
    open ? (
      <div
        role="dialog"
        aria-label={title}
      >
        {children}
      </div>
    ) : null;

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
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    disabled?: boolean;
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
              disabled={props.disabled}
              onChange={(event) => field.onChange(event.target.value)}
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
              disabled={props.disabled}
              onChange={(event) => field.onChange(event.target.value)}
            />
          )}
        </label>
      )}
    />
  );

  MockField.displayName = 'MockField';
  return MockField;
});

jest.mock('@/components/LogoUpload/LogoUpload', () => {
  interface MockLogoUploadProps {
    label: string;
  }

  const MockLogoUpload = ({ label }: MockLogoUploadProps) => <input aria-label={label} />;

  MockLogoUpload.displayName = 'MockLogoUpload';
  return MockLogoUpload;
});

const stint = {
  id: 'stint-1',
  player_id: 'player-1',
  team_id: 'team-1',
  season_id: 'season-1',
  roster_player_team_id: null,
  jersey_number: 91,
  is_prospect: false,
  photo: null,
  position: 'C',
  acquisition_type: null,
  start_date: '2024-10-01',
  end_date: null,
  created_at: '2024-10-01T00:00:00.000Z',
  team: {
    id: 'team-1',
    name: 'Toronto Maple Leafs',
    code: 'TOR',
    logo: null,
    primary_color: '#003e7e',
    text_color: '#ffffff',
  },
} as PlayerStintRecord;

const seasons = [
  {
    id: 'season-1',
    league_id: 'league-1',
    name: '2024-25',
    start_date: '2024-10-01',
  },
  {
    id: 'season-2',
    league_id: 'league-1',
    name: '2025-26',
    start_date: '2025-10-01',
  },
] as unknown as SeasonRecord[];

const history = [
  {
    id: 'photo-1',
    player_id: 'player-1',
    team_id: 'team-1',
    season_id: 'season-1',
    photo: '/photo.jpg',
    created_at: '2025-01-01T00:00:00Z',
    season_name: '2024-25',
    team_name: 'Toronto Maple Leafs',
  },
] as PlayerPhotoEntry[];

const renderModal = (
  mode: 'set' | 'edit',
  overrides: {
    initialSeasonId?: string;
    history?: PlayerPhotoEntry[];
  } = {},
) =>
  render(
    <ChangePhotoModal
      open
      stint={stint}
      initialSeasonId={overrides.initialSeasonId ?? 'season-1'}
      mode={mode}
      seasons={seasons}
      history={overrides.history ?? history}
      onClose={jest.fn()}
      uploadPhoto={jest.fn()}
      changePlayerPhoto={jest.fn()}
    />,
  );

describe('ChangePhotoModal', () => {
  it('shows the season picker when setting a team photo', () => {
    renderModal('set');

    expect(screen.getByRole('dialog', { name: 'Set Team Photo' })).toBeInTheDocument();
    expect(screen.getByLabelText('Season')).toBeInTheDocument();
  });

  it('shows the season as a read-only box when editing an existing season photo', () => {
    renderModal('edit');

    expect(screen.getByRole('dialog', { name: 'Edit Season Photo' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Season' })).not.toBeInTheDocument();
    expect(screen.getByText('Season')).toBeInTheDocument();
    expect(screen.getByText('2024-25').closest('[aria-disabled="true"]')).toBeInTheDocument();
  });

  it('uses a dismissible banner for inherited photos', async () => {
    const user = userEvent.setup();
    renderModal('edit', {
      initialSeasonId: 'season-2',
      history: [
        ...history,
        {
          id: 'photo-2',
          player_id: 'player-1',
          team_id: 'team-2',
          season_id: 'season-2',
          photo: '/inherited-photo.jpg',
          created_at: '2026-01-01T00:00:00Z',
          season_name: '2025-26',
          team_name: 'Boston Bruins',
        },
      ],
    });

    expect(screen.getByText('Inherited photo')).toBeInTheDocument();
    expect(
      screen.getByText(/No photo is saved for Toronto Maple Leafs in this season/),
    ).toBeInTheDocument();
    expect(screen.getByText(/from Boston Bruins/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss banner' }));

    expect(screen.queryByText('Inherited photo')).not.toBeInTheDocument();
  });
});
