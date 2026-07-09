import { type ReactNode, useCallback } from 'react';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import BulkCreateModal, {
  type BulkCreateRowRenderProps,
} from '@jerecocc/tracker-ui/components/BulkCreateModal/BulkCreateModal';
import type { SelectOption } from '@jerecocc/tracker-ui/components/Select/Select';
import { type CreateGameData } from '@/hooks/useGames';
import { type SeasonTeam } from '@/hooks/useSeasonDetails';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RowValues {
  away_team_id: string | null;
  home_team_id: string | null;
  scheduled_date: string;
  venue: string;
}

const EMPTY_ROW: RowValues = {
  away_team_id: null,
  home_team_id: null,
  scheduled_date: '',
  venue: '',
};

const fmtModalDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
};

const hasRowValue = (value: unknown) => value != null && String(value).trim() !== '';

// ── Per-row sub-component ─────────────────────────────────────────────────────

interface GameRowProps {
  index: number;
  control: BulkCreateRowRenderProps<{ rows: RowValues[] }, RowValues>['control'];
  setValue: BulkCreateRowRenderProps<{ rows: RowValues[] }, RowValues>['setValue'];
  seasonTeams: SeasonTeam[];
  teamOptions: SelectOption[];
  isSubmitting: boolean;
  dateDisabled?: boolean;
  autoFocus?: boolean;
  deleteButton: ReactNode;
}

const GameRow = ({
  index,
  control,
  setValue,
  seasonTeams,
  teamOptions,
  isSubmitting,
  dateDisabled,
  autoFocus,
  deleteButton,
}: GameRowProps) => {
  const handleHomeTeamChange = (teamId: string | null) => {
    const team = seasonTeams.find((t) => t.id === teamId);
    setValue(`rows.${index}.venue`, team?.home_arena ?? '');
  };

  return (
    <>
      <Field
        type="datepicker"
        control={control}
        name={`rows.${index}.scheduled_date`}
        required
        rules={{ required: 'Date is required' }}
        placeholder="Date…"
        disabled={isSubmitting || dateDisabled}
        autoFocus={autoFocus && !dateDisabled}
      />
      <Field
        type="select"
        control={control}
        name={`rows.${index}.away_team_id`}
        required
        rules={{ required: 'Away team is required' }}
        options={teamOptions}
        placeholder="— Select away team —"
        disabled={isSubmitting}
        searchable
      />
      <Field
        type="select"
        control={control}
        name={`rows.${index}.home_team_id`}
        required
        rules={{ required: 'Home team is required' }}
        options={teamOptions}
        placeholder="— Select home team —"
        disabled={isSubmitting}
        searchable
        onChange={handleHomeTeamChange}
      />
      <Field
        control={control}
        name={`rows.${index}.venue`}
        placeholder="Arena"
        disabled={isSubmitting}
      />
      {deleteButton}
    </>
  );
};

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  seasonId: string;
  seasonTeams: SeasonTeam[];
  teamOptions: SelectOption[];
  bulkCreateGames: (data: CreateGameData[]) => Promise<boolean>;
  onClose: () => void;
  /** When provided, pre-fills and locks the date field on every row. */
  defaultDate?: string;
}

const BulkCreateGamesModal = ({
  open,
  seasonId,
  seasonTeams,
  teamOptions,
  bulkCreateGames,
  onClose,
  defaultDate,
}: Props) => {
  const createRow = useCallback(
    () => ({ ...EMPTY_ROW, scheduled_date: defaultDate ?? '' }),
    [defaultDate],
  );
  const shouldConfirmRemove = useCallback(
    (row: RowValues) => {
      const fieldsToCheck = defaultDate
        ? [row.away_team_id, row.home_team_id, row.venue]
        : [row.scheduled_date, row.away_team_id, row.home_team_id, row.venue];

      return fieldsToCheck.some(hasRowValue);
    },
    [defaultDate],
  );

  return (
    <BulkCreateModal<{ rows: RowValues[] }, RowValues>
      createDefaultValues={() => ({ rows: [{ ...EMPTY_ROW, scheduled_date: defaultDate ?? '' }] })}
      rowArrayName="rows"
      open={open}
      title={defaultDate ? `Bulk Create — ${fmtModalDate(defaultDate)}` : 'Bulk Create Games'}
      size="xl"
      onClose={onClose}
      formId="bulk-create-games-form"
      createRow={createRow}
      columnsTemplate="0.9fr 1.1fr 1.1fr 1.2fr"
      headerCells={[
        { label: 'Date', required: true },
        { label: 'Away Team', required: true },
        { label: 'Home Team', required: true },
        { label: 'Venue' },
      ]}
      requiredRowFields={['scheduled_date', 'away_team_id', 'home_team_id']}
      addRowLabel="Add Game"
      itemLabel="game"
      getConfirmLabel={(count, isSubmitting) =>
        isSubmitting ? 'Creating…' : `Create ${count} Game${count !== 1 ? 's' : ''}`
      }
      shouldConfirmRemove={shouldConfirmRemove}
      getRemoveConfirmBody={() => 'Remove this game from the list?'}
      onSubmitForm={async (data) => {
        const payload: CreateGameData[] = data.rows.map((row) => ({
          season_id: seasonId,
          home_team_id: row.home_team_id!,
          away_team_id: row.away_team_id!,
          game_type: 'regular',
          status: 'scheduled',
          scheduled_at: row.scheduled_date || null,
          scheduled_time: null,
          venue: row.venue || null,
        }));
        return bulkCreateGames(payload);
      }}
      renderRow={({ index, control, setValue, isSubmitting, autoFocus, deleteButton }) => (
        <GameRow
          index={index}
          control={control}
          setValue={setValue}
          seasonTeams={seasonTeams}
          teamOptions={teamOptions}
          isSubmitting={isSubmitting}
          dateDisabled={!!defaultDate}
          autoFocus={autoFocus}
          deleteButton={deleteButton}
        />
      )}
    />
  );
};

export default BulkCreateGamesModal;
