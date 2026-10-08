import {
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useWatch } from 'react-hook-form';
import BulkCreateModal, {
  type BulkCreateModalContext,
  type BulkCreateRowRenderProps,
} from '@jerecocc/tracker-ui/components/BulkCreateModal/BulkCreateModal';
import {
  ControlledDatePickerField,
  ControlledSelectField,
  ControlledTimePickerField,
} from '@/components/form/ControlledFields';
import type { GameType } from '@/hooks/useGames';
import usePersonalGames from '@/hooks/usePersonalGames';
import styles from './PersonalGameModal.module.scss';
import usePersonalGameOptions, { type PersonalGameOption } from './usePersonalGameOptions';

const GAME_TYPE_OPTIONS: { value: GameType; label: string }[] = [
  { value: 'preseason', label: 'Preseason' },
  { value: 'regular', label: 'Regular Season' },
  { value: 'playoff', label: 'Playoffs' },
];

interface RowValues {
  away_team_id: string | null;
  home_team_id: string | null;
  scheduled_at: string;
  /** Eastern HH:MM, or empty when the start time isn't known. */
  scheduled_time: string;
}

interface FormValues {
  league_id: string;
  season_id: string;
  /** One game type for every game in the batch. */
  game_type: GameType;
  rows: RowValues[];
}

type Context = BulkCreateModalContext<FormValues, RowValues>;

const EMPTY_ROW: RowValues = {
  away_team_id: null,
  home_team_id: null,
  scheduled_at: '',
  scheduled_time: '',
};

const hasRowValue = (value: unknown) => value != null && String(value).trim() !== '';

// Keeps the latest rows available to createRow, which the modal calls without arguments.
const RowsTracker = ({
  rows,
  rowsRef,
}: {
  rows: RowValues[];
  rowsRef: MutableRefObject<RowValues[]>;
}) => {
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows, rowsRef]);
  return null;
};

/**
 * The single League, Season and Game Type fields above the rows. They narrow every row's team pickers,
 * and a team no longer in the chosen league or season is cleared from its row.
 */
const LeagueSeasonFields = ({
  open,
  ctx,
  onTeamOptionsChange,
}: {
  open: boolean;
  ctx: Context;
  onTeamOptionsChange: (options: PersonalGameOption[], leagueId: string) => void;
}) => {
  const { control, setValue, isSubmitting, rows } = ctx;
  const [leagueId, seasonId] = useWatch({ control, name: ['league_id', 'season_id'] });
  const autoPickSeason = useRef(true);
  const { leagueOptions, seasonOptions, teamOptions, teamsLoading, seasonPlaceholder } =
    usePersonalGameOptions({
      open,
      leagueId,
      seasonId,
      autoPickSeason: autoPickSeason.current,
      onPickSeason: (pickedSeasonId) => {
        autoPickSeason.current = false;
        setValue('season_id', pickedSeasonId, { shouldDirty: true, shouldValidate: true });
      },
    });

  useEffect(() => {
    onTeamOptionsChange(teamOptions, leagueId);
  }, [leagueId, onTeamOptionsChange, teamOptions]);

  useEffect(() => {
    if (teamsLoading || !leagueId) return;
    const available = new Set(teamOptions.map((option) => option.value));
    rows.forEach((row, index) => {
      if (row.away_team_id && !available.has(row.away_team_id)) {
        setValue(`rows.${index}.away_team_id`, null, { shouldValidate: true });
      }
      if (row.home_team_id && !available.has(row.home_team_id)) {
        setValue(`rows.${index}.home_team_id`, null, { shouldValidate: true });
      }
    });
  }, [leagueId, rows, setValue, teamOptions, teamsLoading]);

  return (
    <div className={styles.bulkFields}>
      <ControlledSelectField
        label="League"
        control={control}
        name="league_id"
        options={leagueOptions}
        searchable
        placeholder="Select league…"
        disabled={isSubmitting}
        required
        rules={{ required: 'League is required' }}
        onChange={() => {
          setValue('season_id', '', { shouldDirty: true });
          autoPickSeason.current = true;
        }}
      />
      <ControlledSelectField
        label="Season"
        control={control}
        name="season_id"
        options={seasonOptions}
        placeholder={seasonPlaceholder}
        disabled={isSubmitting || !leagueId || seasonOptions.length === 0}
        rules={{
          validate: (value) => !!value || seasonOptions.length === 0 || 'Season is required',
        }}
      />
      <ControlledSelectField
        label="Game Type"
        control={control}
        name="game_type"
        options={GAME_TYPE_OPTIONS}
        disabled={isSubmitting}
        required
        rules={{ required: 'Game type is required' }}
      />
    </div>
  );
};

interface GameRowProps {
  index: number;
  control: BulkCreateRowRenderProps<FormValues, RowValues>['control'];
  teamOptions: PersonalGameOption[];
  teamsEnabled: boolean;
  isSubmitting: boolean;
  autoFocus?: boolean;
  deleteButton: ReactNode;
}

const GameRow = ({
  index,
  control,
  teamOptions,
  teamsEnabled,
  isSubmitting,
  autoFocus,
  deleteButton,
}: GameRowProps) => (
  <>
    <ControlledSelectField
      control={control}
      name={`rows.${index}.away_team_id`}
      required
      rules={{ required: 'Away team is required' }}
      options={teamOptions}
      placeholder={teamsEnabled ? '— Away team —' : 'Select a league first'}
      disabled={isSubmitting || !teamsEnabled}
      searchable
      autoFocus={autoFocus && teamsEnabled}
    />
    <ControlledSelectField
      control={control}
      name={`rows.${index}.home_team_id`}
      required
      rules={{
        required: 'Home team is required',
        validate: (value, values) =>
          !value || value !== values.rows?.[index]?.away_team_id || 'Pick two different teams',
      }}
      options={teamOptions}
      placeholder={teamsEnabled ? '— Home team —' : 'Select a league first'}
      disabled={isSubmitting || !teamsEnabled}
      searchable
    />
    <ControlledDatePickerField
      control={control}
      name={`rows.${index}.scheduled_at`}
      required
      rules={{ required: 'Date is required' }}
      placeholder="Date…"
      disabled={isSubmitting}
    />
    <ControlledTimePickerField
      control={control}
      name={`rows.${index}.scheduled_time`}
      disabled={isSubmitting}
    />
    {deleteButton}
  </>
);

interface Props {
  open: boolean;
  onClose: () => void;
  /** Prefills every row's game date (YYYY-MM-DD). */
  defaultDate?: string;
}

/**
 * Adds several unplayed personal games at once: one league, season and game type for all of
 * them, and a row per game with its away and home teams, date and optional start time.
 */
const PersonalGamesBulkModal = ({ open, onClose, defaultDate }: Props) => {
  const { bulkCreatePersonalGames } = usePersonalGames();
  const [teamOptions, setTeamOptions] = useState<PersonalGameOption[]>([]);
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  const rowsRef = useRef<RowValues[]>([]);

  const handleTeamOptionsChange = useCallback(
    (options: PersonalGameOption[], leagueId: string) => {
      setTeamOptions(options);
      setTeamsEnabled(!!leagueId);
    },
    [],
  );

  // New rows repeat the previous row's date and time, so a run of games is quick to enter.
  const createRow = useCallback(() => {
    const previous = rowsRef.current[rowsRef.current.length - 1];
    return {
      ...EMPTY_ROW,
      scheduled_at: previous?.scheduled_at || defaultDate || '',
      scheduled_time: previous?.scheduled_time ?? '',
    };
  }, [defaultDate]);

  return (
    <BulkCreateModal<FormValues, RowValues>
      open={open}
      title="Bulk Add Personal Games"
      size="xl"
      onClose={onClose}
      formId="bulk-personal-games-form"
      createDefaultValues={() => ({
        league_id: '',
        season_id: '',
        game_type: 'regular',
        rows: [{ ...EMPTY_ROW, scheduled_at: defaultDate ?? '' }],
      })}
      rowArrayName="rows"
      createRow={createRow}
      columnsTemplate="1.2fr 1.2fr 0.9fr 0.9fr"
      headerCells={[
        { label: 'Away Team', required: true },
        { label: 'Home Team', required: true },
        { label: 'Game Date (ET)', required: true },
        { label: 'Start Time (ET)' },
      ]}
      requiredRowFields={['away_team_id', 'home_team_id', 'scheduled_at']}
      requiredFormFields={['league_id', 'game_type']}
      addRowLabel="Add Game"
      itemLabel="game"
      getConfirmLabel={(count, isSubmitting) =>
        isSubmitting ? 'Adding…' : `Add ${count} Personal Game${count !== 1 ? 's' : ''}`
      }
      shouldConfirmRemove={(row) =>
        [row.away_team_id, row.home_team_id, row.scheduled_at].some(hasRowValue)
      }
      getRemoveConfirmBody={() => 'Remove this game from the list?'}
      onSubmit={(data) =>
        bulkCreatePersonalGames({
          season_id: data.season_id || null,
          games: data.rows.map((row) => ({
            away_team_id: row.away_team_id!,
            home_team_id: row.home_team_id!,
            game_type: data.game_type,
            scheduled_at: row.scheduled_at,
            scheduled_time: row.scheduled_time || null,
          })),
        })
      }
      renderBeforeRows={(ctx) => (
        <LeagueSeasonFields
          open={open}
          ctx={ctx}
          onTeamOptionsChange={handleTeamOptionsChange}
        />
      )}
      renderAfterRows={({ rows }) => (
        <RowsTracker
          rows={rows}
          rowsRef={rowsRef}
        />
      )}
      renderRow={({ index, control, isSubmitting, autoFocus, deleteButton }) => (
        <GameRow
          index={index}
          control={control}
          teamOptions={teamOptions}
          teamsEnabled={teamsEnabled}
          isSubmitting={isSubmitting}
          autoFocus={autoFocus}
          deleteButton={deleteButton}
        />
      )}
    />
  );
};

export default PersonalGamesBulkModal;
