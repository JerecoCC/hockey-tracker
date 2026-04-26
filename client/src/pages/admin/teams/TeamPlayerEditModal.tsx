import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '../../../components/Field/Field';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import Modal from '../../../components/Modal/Modal';
import { type CreatePlayerData, type PlayerPosition } from '../../../hooks/useLeaguePlayers';
import { type TeamPlayerRecord } from '../../../hooks/useTeamPlayers';
import styles from '../leagues/PlayerFormModal.module.scss';

const POSITION_OPTIONS = [
  { value: 'C', label: 'Center' },
  { value: 'LW', label: 'Left Wing' },
  { value: 'RW', label: 'Right Wing' },
  { value: 'D', label: 'Defense' },
  { value: 'G', label: 'Goalie' },
];

interface FormValues {
  photo: File | string | null;
  jersey_number: string;
  first_name: string;
  last_name: string;
  position: PlayerPosition | null;
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
    payload: { jersey_number?: number | null; photo?: string | null },
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
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      photo: null,
      jersey_number: '',
      first_name: '',
      last_name: '',
      position: null,
    },
  });

  useEffect(() => {
    if (!open || !editTarget) return;
    reset({
      photo: editTarget.photo ?? null,
      jersey_number: editTarget.jersey_number != null ? String(editTarget.jersey_number) : '',
      first_name: editTarget.first_name,
      last_name: editTarget.last_name,
      position: editTarget.position ?? null,
    });
  }, [open, editTarget, reset]);

  const onSubmit = handleSubmit(async (data) => {
    if (!editTarget) return;

    // Upload photo if a new file was selected
    let photoUrl: string | null = typeof data.photo === 'string' ? data.photo : null;
    if (data.photo instanceof File) {
      const url = await uploadPlayerPhoto(data.photo);
      if (!url) return;
      photoUrl = url;
    }

    // Update name + position on the global players record
    const playerOk = await updatePlayer(editTarget.id, {
      first_name: data.first_name,
      last_name: data.last_name,
      position: data.position || null,
    });
    if (!playerOk) return;

    // Update jersey number + photo on the player_teams stint
    if (seasonId) {
      const jerseyNumber = data.jersey_number ? Number(data.jersey_number) : null;
      const teamOk = await updatePlayerTeam(editTarget.id, teamId, seasonId, {
        jersey_number: jerseyNumber,
        photo: photoUrl,
      });
      if (!teamOk) return;
    }

    onClose();
  });

  return (
    <Modal
      open={open}
      title="Edit Player"
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : 'Save Changes'}
      confirmForm="team-player-edit-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
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
          disabled={isSubmitting}
        />
        <div className={styles.nameRowWithJersey}>
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
      </form>
    </Modal>
  );
};

export default TeamPlayerEditModal;
