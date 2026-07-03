import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
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
}

interface Props {
  open: boolean;
  player: TeamPlayerRecord | null;
  currentTeamId: string;
  seasonId: string;
  leagueId: string;
  onClose: () => void;
  movePlayer: (
    playerId: string,
    seasonId: string,
    toTeamId: string,
    moveDate: string,
    jerseyNumber?: number | null,
    position?: string | null,
    acquisitionType?: string | null,
  ) => Promise<boolean>;
}

const MovePlayerModal = ({
  open,
  player,
  currentTeamId,
  seasonId,
  leagueId,
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
    }),
    [player?.jersey_number],
  );
  const { teams } = useTeams();

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
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<FormValues>({
    defaultValues: formValues,
    mode: 'onChange',
  });

  useLayoutEffect(() => {
    reset(formValues);
  }, [formValues, reset]);

  const handleClose = useCallback(() => {
    reset(formValues);
    onClose();
  }, [formValues, onClose, reset]);

  const onSubmit = handleSubmit(async (data) => {
    if (!player || !data.to_team_id) return;
    const jerseyNumber = data.jersey_number ? Number(data.jersey_number) : null;
    const position = data.position || null;
    const ok = await movePlayer(
      player.id,
      seasonId,
      data.to_team_id,
      data.trade_date,
      jerseyNumber,
      position,
      data.acquisition_type || 'trade',
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
          </fieldset>
        </form>
      </div>
    </Modal>
  );
};

export default MovePlayerModal;
