import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import {
  type CreatePlayerData,
  type PlayerRecord,
  type PlayerPosition,
  type PlayerShoots,
} from '@/hooks/useLeaguePlayers';
import { getPlayerStatus, type PlayerStatus } from '@/lib/playerStatus';
import styles from './PlayerFormModal.module.scss';

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

const SHOOTS_OPTIONS = [
  { value: 'L', label: 'Left' },
  { value: 'R', label: 'Right' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'retired', label: 'Retired' },
];

const NO_ROOKIE_SEASON = 'none';

interface FormValues {
  first_name: string;
  last_name: string;
  position: PlayerPosition | null;
  shoots: PlayerShoots | null;
  status: PlayerStatus;
  rookie_season_id: string;
  jersey_number: string;
}

interface RookieSeasonOption {
  id: string;
  name: string;
  is_current?: boolean;
}

interface Props {
  open: boolean;
  editTarget: PlayerRecord | null;
  seasons: RookieSeasonOption[];
  onClose: () => void;
  addPlayer?: (data: CreatePlayerData) => Promise<boolean>;
  updatePlayer: (id: string, data: Partial<CreatePlayerData>) => Promise<boolean>;
  /** When provided, the Jersey Number field is shown and saved via this callback on edit. */
  updateJerseyNumber?: (jerseyNumber: number | null) => Promise<boolean>;
}

const PlayerFormModal = ({
  open,
  editTarget,
  seasons,
  onClose,
  addPlayer,
  updatePlayer,
  updateJerseyNumber,
}: Props) => {
  const formValues = useMemo<FormValues>(() => {
    return {
      first_name: editTarget?.first_name ?? '',
      last_name: editTarget?.last_name ?? '',
      position: editTarget?.position ?? null,
      shoots: editTarget?.shoots ?? null,
      status: editTarget ? getPlayerStatus(editTarget) : 'active',
      rookie_season_id: editTarget?.rookie_season_id ?? NO_ROOKIE_SEASON,
      jersey_number: editTarget?.jersey_number != null ? String(editTarget.jersey_number) : '',
    };
  }, [editTarget]);
  const rookieSeasonOptions = useMemo(
    () => [
      { value: NO_ROOKIE_SEASON, label: 'No rookie season' },
      ...seasons.map((season) => ({
        value: season.id,
        label: season.is_current ? `${season.name} (Current)` : season.name,
      })),
    ],
    [seasons],
  );
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
    const payload: CreatePlayerData = {
      first_name: data.first_name,
      last_name: data.last_name,
      position: data.position || null,
      shoots: data.shoots || null,
      status: data.status,
      ...(seasons.length > 0
        ? {
            rookie_season_id:
              data.rookie_season_id === NO_ROOKIE_SEASON ? null : data.rookie_season_id,
          }
        : {}),
    };
    const ok = editTarget
      ? await updatePlayer(editTarget.id, payload)
      : addPlayer
        ? await addPlayer(payload)
        : false;
    if (!ok) return;

    if (editTarget && updateJerseyNumber) {
      const newJersey = data.jersey_number ? Number(data.jersey_number) : null;
      await updateJerseyNumber(newJersey);
    }

    handleClose();
  });

  const statusField = (
    <Field
      type="select"
      label="Status"
      required
      control={control}
      name="status"
      options={STATUS_OPTIONS}
      rules={{ required: true }}
      disabled={isSubmitting}
    />
  );

  return (
    <Modal
      open={open}
      title={editTarget ? 'Edit Player' : 'Create Player'}
      onClose={handleClose}
      confirmLabel={isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Player'}
      confirmForm="player-form"
      confirmDisabled={isSubmitting || !isDirty || !isValid}
      busy={isSubmitting}
    >
      <form
        id="player-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <div className={updateJerseyNumber ? styles.nameRowWithJersey : styles.row}>
          {updateJerseyNumber && (
            <Field
              type="number"
              label="Jersey #"
              control={control}
              name="jersey_number"
              placeholder="e.g. 97"
              min={0}
              max={99}
              disabled={isSubmitting}
              rules={{
                validate: (v) =>
                  !v || (Number(v) >= 0 && Number(v) <= 99 && Number.isInteger(Number(v))),
              }}
            />
          )}
          <Field
            label="First Name"
            required
            control={control}
            name="first_name"
            rules={{ required: true }}
            placeholder="e.g. Connor"
            autoFocus
            disabled={isSubmitting}
          />
          <Field
            label="Last Name"
            required
            control={control}
            name="last_name"
            rules={{ required: true }}
            placeholder="e.g. McDavid"
            disabled={isSubmitting}
          />
        </div>
        <div className={styles.row}>
          <Field
            type="select"
            label="Position"
            required
            control={control}
            name="position"
            options={POSITION_OPTIONS}
            placeholder="Select position"
            rules={{ required: true }}
            disabled={isSubmitting}
          />
          <Field
            type="select"
            label="Shoots"
            control={control}
            name="shoots"
            options={SHOOTS_OPTIONS}
            placeholder="Select side"
            disabled={isSubmitting}
          />
        </div>
        <div className={seasons.length > 0 ? styles.playerInfoIdentityRow : styles.fullRow}>
          {seasons.length > 0 && (
            <Field
              type="select"
              label="Rookie Season"
              control={control}
              name="rookie_season_id"
              options={rookieSeasonOptions}
              placeholder="Select rookie season"
              disabled={isSubmitting}
            />
          )}
          {statusField}
        </div>
      </form>
    </Modal>
  );
};

export default PlayerFormModal;
