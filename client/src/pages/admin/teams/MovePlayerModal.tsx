import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@jerecocc/tracker-ui/Field';
import Modal from '@jerecocc/tracker-ui/Modal';
import { type SeasonRecord } from '@/hooks/useSeasons';
import useTeams from '@/hooks/useTeams';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import { ACQUISITION_TYPE_OPTIONS } from '../players/StintEditModal';
import styles from './MovePlayerModal.module.scss';

const POSITION_OPTIONS = [
  { value: 'C', label: 'Center' },
  { value: 'LW', label: 'Left Wing' },
  { value: 'RW', label: 'Right Wing' },
  { value: 'F', label: 'Forward' },
  { value: 'D', label: 'Defense' },
  { value: 'LD', label: 'Left Defense' },
  { value: 'RD', label: 'Right Defense' },
  { value: 'G', label: 'Goalie' },
];

interface FormValues {
  to_team_id: string | null;
  trade_date: string;
  jersey_number: string;
  position: string;
  acquisition_type: string;
  target_season_id: string;
}

interface Props {
  open: boolean;
  player: TeamPlayerRecord | null;
  currentTeamId: string;
  seasonId: string;
  leagueId: string;
  seasons?: SeasonRecord[];
  onClose: () => void;
  movePlayer: (
    playerId: string,
    seasonId: string,
    toTeamId: string,
    moveDate: string,
    jerseyNumber?: number | null,
    position?: string | null,
    acquisitionType?: string | null,
    targetSeasonId?: string | null,
  ) => Promise<boolean>;
}

const dateKey = (value?: string | null) => value?.slice(0, 10) ?? null;

const sortSeasonsOldestFirst = (seasons: SeasonRecord[]) =>
  [...seasons].sort((a, b) => {
    const startCmp = (a.start_date ?? '').localeCompare(b.start_date ?? '');
    if (startCmp !== 0) return startCmp;
    const createdCmp = (a.created_at ?? '').localeCompare(b.created_at ?? '');
    if (createdCmp !== 0) return createdCmp;
    return a.name.localeCompare(b.name);
  });

const findNextSeasonId = (sourceSeason: SeasonRecord | null, seasons: SeasonRecord[]) => {
  if (!sourceSeason) return null;
  const sourceStart = dateKey(sourceSeason.start_date);
  const sourceEnd = dateKey(sourceSeason.end_date);
  const futureSeasons = sortSeasonsOldestFirst(seasons).filter((season) => {
    if (season.id === sourceSeason.id || season.league_id !== sourceSeason.league_id) return false;
    const start = dateKey(season.start_date);
    if (!start) return false;
    if (sourceStart) return start > sourceStart;
    return sourceEnd ? start > sourceEnd : true;
  });
  return futureSeasons[0]?.id ?? null;
};

const MovePlayerModal = ({
  open,
  player,
  currentTeamId,
  seasonId,
  leagueId,
  seasons = [],
  onClose,
  movePlayer,
}: Props) => {
  const formValues = useMemo<FormValues>(
    () => ({
      to_team_id: null,
      trade_date: '',
      jersey_number: player?.jersey_number == null ? '' : String(player.jersey_number),
      position: '',
      acquisition_type: 'trade',
      target_season_id: '',
    }),
    [player?.jersey_number],
  );
  const { teams } = useTeams();
  const sourceSeason = useMemo(
    () => seasons.find((season) => season.id === seasonId) ?? null,
    [seasonId, seasons],
  );
  const leagueSeasons = useMemo(
    () => seasons.filter((season) => season.league_id === leagueId),
    [leagueId, seasons],
  );
  const nextSeasonId = useMemo(
    () => findNextSeasonId(sourceSeason, seasons),
    [seasons, sourceSeason],
  );

  const teamOptions = teams
    .filter((t) => t.league_id === leagueId && t.id !== currentTeamId)
    .map((t) => ({
      value: t.id,
      label: t.name,
      logo: t.logo ?? undefined,
      logoDark: t.logo_dark ?? undefined,
      logoLight: t.logo_light ?? undefined,
      code: t.code,
    }));

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<FormValues>({
    defaultValues: formValues,
    mode: 'onChange',
  });
  const tradeDate = watch('trade_date');
  const targetSeasonId = watch('target_season_id');
  const sourceSeasonEnd = dateKey(sourceSeason?.end_date);
  const showRosterSeasonSelect = !!sourceSeasonEnd && !!tradeDate && tradeDate > sourceSeasonEnd;
  const seasonOptions = useMemo(
    () =>
      [...leagueSeasons]
        .sort((a, b) => {
          const startCmp = (b.start_date ?? '').localeCompare(a.start_date ?? '');
          if (startCmp !== 0) return startCmp;
          const createdCmp = (b.created_at ?? '').localeCompare(a.created_at ?? '');
          if (createdCmp !== 0) return createdCmp;
          return b.name.localeCompare(a.name);
        })
        .map((season) => ({
          value: season.id,
          label: season.name,
        })),
    [leagueSeasons],
  );

  useLayoutEffect(() => {
    reset(formValues);
  }, [formValues, reset]);

  useEffect(() => {
    if (!showRosterSeasonSelect) {
      if (targetSeasonId) setValue('target_season_id', '', { shouldDirty: false });
      return;
    }
    if (!targetSeasonId && nextSeasonId) {
      setValue('target_season_id', nextSeasonId, { shouldDirty: false, shouldValidate: true });
    }
  }, [nextSeasonId, setValue, showRosterSeasonSelect, targetSeasonId]);

  const handleClose = useCallback(() => {
    reset(formValues);
    onClose();
  }, [formValues, onClose, reset]);

  const onSubmit = handleSubmit(async (data) => {
    if (!player || !data.to_team_id) return;
    const jerseyNumber = data.jersey_number ? Number(data.jersey_number) : null;
    const position = data.position || null;
    const rosterSeasonId = showRosterSeasonSelect ? data.target_season_id || null : null;
    const ok = await movePlayer(
      player.id,
      seasonId,
      data.to_team_id,
      data.trade_date,
      jerseyNumber,
      position,
      data.acquisition_type || 'trade',
      rosterSeasonId,
    );
    if (ok) handleClose();
  });

  return (
    <Modal
      open={open}
      title={player ? `Move ${player.first_name} ${player.last_name}` : 'Move Player'}
      onClose={handleClose}
      confirmLabel={isSubmitting ? 'Moving...' : 'Move Player'}
      confirmIcon="swap_horiz"
      confirmForm="move-player-form"
      confirmDisabled={isSubmitting || !isDirty || !isValid}
      busy={isSubmitting}
    >
      <div className={styles.layout}>
        <form
          id="move-player-form"
          className={styles.form}
          onSubmit={onSubmit}
        >
          <Field
            type="select"
            label="Position (new team)"
            control={control}
            name="position"
            options={POSITION_OPTIONS}
            placeholder="Inherit from player..."
            disabled={isSubmitting}
          />
          <div className={styles.teamRow}>
            <Field
              type="select"
              label="Move To"
              required
              control={control}
              name="to_team_id"
              options={teamOptions}
              placeholder="Select destination team..."
              searchable
              rules={{ required: true }}
              disabled={isSubmitting}
            />
            <Field
              type="number"
              label="Jersey #"
              control={control}
              name="jersey_number"
              placeholder="e.g. 97"
              min={0}
              max={99}
              disabled={isSubmitting}
            />
          </div>
          <fieldset className={styles.fieldGroup}>
            <legend className={styles.groupLabel}>MOVEMENT</legend>
            <div className={styles.movementRow}>
              <Field
                type="select"
                label="Type"
                control={control}
                name="acquisition_type"
                options={ACQUISITION_TYPE_OPTIONS}
                disabled={isSubmitting}
              />
              <Field
                type="datepicker"
                label="Date"
                control={control}
                name="trade_date"
                required
                rules={{ required: 'Move date is required' }}
                disabled={isSubmitting}
              />
            </div>
            {showRosterSeasonSelect && (
              <Field
                type="select"
                label="Roster Season"
                control={control}
                name="target_season_id"
                options={seasonOptions}
                placeholder="Select roster season..."
                searchable
                required
                rules={{ required: 'Roster season is required' }}
                disabled={isSubmitting}
              />
            )}
          </fieldset>
        </form>
      </div>
    </Modal>
  );
};

export default MovePlayerModal;
