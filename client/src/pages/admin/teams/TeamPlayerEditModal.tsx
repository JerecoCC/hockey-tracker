import { useCallback, useLayoutEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  ControlledDatePickerField,
  ControlledInputField,
  ControlledSelectField,
} from '@/components/form/ControlledFields';
import LogoUpload from '@jerecocc/tracker-ui/components/LogoUpload/LogoUpload';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import useBackgroundModalAction from '@/hooks/useBackgroundModalAction';
import SegmentedControl from '@jerecocc/tracker-ui/components/SegmentedControl/SegmentedControl';
import {
  type CreatePlayerData,
  type PlayerPosition,
  type PlayerStatus,
} from '@/hooks/useLeaguePlayers';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import { getPlayerStatus } from '@/lib/playerStatus';
import styles from '../leagues/PlayerFormModal.module.scss';

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

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

interface FormValues {
  photo: File | string | null;
  jersey_number: string;
  jersey_effective_date: string;
  first_name: string;
  last_name: string;
  position: PlayerPosition | null;
  status: PlayerStatus;
}

interface Props {
  open: boolean;
  editTarget: TeamPlayerRecord | null;
  teamId: string;
  seasonId: string | null;
  onClose: () => void;
  updatePlayer: (id: string, data: Partial<CreatePlayerData>) => Promise<boolean>;
  updatePlayerTeam: (
    playerId: string,
    teamId: string,
    seasonId: string,
    payload: {
      jersey_number?: number | null;
      effective_date?: string;
      photo?: string | null;
    },
  ) => Promise<boolean>;
  uploadPlayerPhoto: (file: File) => Promise<string | null>;
}

const TeamPlayerEditModal = ({
  open,
  editTarget,
  teamId,
  seasonId,
  onClose,
  updatePlayer,
  updatePlayerTeam,
  uploadPlayerPhoto,
}: Props) => {
  const playerStatus = editTarget ? getPlayerStatus(editTarget) : 'active';
  const isRetired = playerStatus === 'retired';
  const formValues = useMemo<FormValues>(
    () => ({
      photo: editTarget?.photo ?? null,
      jersey_number: editTarget?.jersey_number != null ? String(editTarget.jersey_number) : '',
      jersey_effective_date: '',
      first_name: editTarget?.first_name ?? '',
      last_name: editTarget?.last_name ?? '',
      position: editTarget?.position ?? null,
      status: playerStatus,
    }),
    [editTarget, playerStatus],
  );
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isValid },
  } = useForm<FormValues>({
    defaultValues: formValues,
    mode: 'onChange',
  });

  useLayoutEffect(() => {
    reset(formValues);
  }, [formValues, reset]);

  const jerseyNumber = useWatch({ control, name: 'jersey_number' });
  const normalizedJerseyNumber = jerseyNumber === '' ? null : Number(jerseyNumber);
  const jerseyNumberChanged = normalizedJerseyNumber !== (editTarget?.jersey_number ?? null);

  const handleClose = useCallback(() => {
    reset(formValues);
    onClose();
  }, [formValues, onClose, reset]);

  // Saving (photo upload included) runs behind a progress toast with the modal hidden; it
  // reappears with what was entered if any step fails.
  const { hidden, runSettled } = useBackgroundModalAction({
    target: open ? (editTarget?.id ?? null) : null,
    onDone: handleClose,
  });

  const save = async (player: TeamPlayerRecord, data: FormValues) => {
    // Upload photo if a new file was selected
    let photoUrl: string | null = typeof data.photo === 'string' ? data.photo : null;
    if (data.photo instanceof File) {
      const url = await uploadPlayerPhoto(data.photo);
      if (!url) return false;
      photoUrl = url;
    }

    // Update name + position on the global players record
    const playerOk = await updatePlayer(player.id, {
      first_name: data.first_name,
      last_name: data.last_name,
      position: data.position || null,
      ...(!isRetired ? { status: data.status } : {}),
    });
    if (!playerOk) return false;

    // Route jersey changes through the dated history mechanism instead of
    // silently overwriting the current player_teams value.
    if (seasonId) {
      const nextJerseyNumber = data.jersey_number ? Number(data.jersey_number) : null;
      const teamOk = await updatePlayerTeam(player.id, teamId, seasonId, {
        ...(nextJerseyNumber !== player.jersey_number
          ? {
              jersey_number: nextJerseyNumber,
              ...(nextJerseyNumber != null
                ? { effective_date: data.jersey_effective_date }
                : {}),
            }
          : {}),
        photo: photoUrl,
      });
      if (!teamOk) return false;
    }

    return true;
  };

  const onSubmit = handleSubmit((data) => {
    if (!editTarget) return;
    void runSettled(() => save(editTarget, data), { pending: 'Saving player…' });
  });

  return (
    <Modal
      open={open && !hidden}
      title="Edit Player"
      onClose={handleClose}
      confirmLabel="Save Changes"
      confirmForm="team-player-edit-form"
      confirmDisabled={!isDirty || !isValid}
    >
      <form
        id="team-player-edit-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <LogoUpload
          control={control}
          name="photo"
          label="Player Photo"
          shape="circle"          autoFocus
        />
        <div className={styles.nameRowWithJersey}>
          <ControlledInputField
            type="number"
            label="Jersey #"
            control={control}
            name="jersey_number"
            placeholder="e.g. 97"
            min={0}
            max={99}            rules={{
              validate: (v) =>
                !v || (Number(v) >= 0 && Number(v) <= 99 && Number.isInteger(Number(v))),
            }}
          />
          <ControlledInputField
            label="First Name"
            required
            control={control}
            name="first_name"
            rules={{ required: true }}
            placeholder="e.g. Connor"          />
          <ControlledInputField
            label="Last Name"
            required
            control={control}
            name="last_name"
            rules={{ required: true }}
            placeholder="e.g. McDavid"          />
        </div>
        {jerseyNumberChanged && normalizedJerseyNumber != null && (
          <div className={styles.fullRow}>
            <ControlledDatePickerField
              label="Jersey Effective Date"
              control={control}
              name="jersey_effective_date"
              required
              rules={{ required: true }}            />
          </div>
        )}
        <div className={styles.row}>
          <ControlledSelectField
            label="Position"
            required
            control={control}
            name="position"
            options={POSITION_OPTIONS}
            placeholder="Select position"
            rules={{ required: true }}          />
          {!isRetired && (
            <div className={styles.segmentedField}>
              <span className={styles.heightGroupLabel}>Status</span>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <SegmentedControl
                    value={field.value}
                    onChange={(value) => field.onChange(value as PlayerStatus)}
                    variant="field"
                    options={STATUS_OPTIONS}                  />
                )}
              />
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default TeamPlayerEditModal;
