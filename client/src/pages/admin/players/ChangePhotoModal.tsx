import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import Field from '@/components/Field/Field';
import LogoUpload from '@/components/LogoUpload/LogoUpload';
import Modal from '@/components/Modal/Modal';
import {
  type PlayerPhotoEntry,
  type PlayerStintRecord,
} from '@/hooks/useTeamPlayers';
import { type SeasonRecord } from '@/hooks/useSeasons';
import styles from '../leagues/PlayerFormModal.module.scss';

interface FormValues {
  season_id: string;
  photo: File | string | null;
}

interface Props {
  open: boolean;
  stint: PlayerStintRecord | null;
  seasons: SeasonRecord[];
  history: PlayerPhotoEntry[];
  onClose: () => void;
  uploadPhoto: (file: File) => Promise<string | null>;
  changePlayerPhoto: (
    stint: PlayerStintRecord,
    seasonId: string,
    photo: string,
  ) => Promise<boolean>;
}

const ChangePhotoModal = ({
  open,
  stint,
  seasons,
  history,
  onClose,
  uploadPhoto,
  changePlayerPhoto,
}: Props) => {
  const formValues = useMemo<FormValues>(
    () => ({
      season_id: stint?.season_id ?? '',
      photo:
        history.find(
          (entry) => entry.team_id === stint?.team_id && entry.season_id === stint?.season_id,
        )?.photo ?? null,
    }),
    [history, stint],
  );
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: formValues,
  });

  const selectedSeasonId = useWatch({ control, name: 'season_id' });
  const explicitPhoto = history.find(
    (entry) => entry.team_id === stint?.team_id && entry.season_id === selectedSeasonId,
  );
  const inheritedSeasonPhoto = history.find(
    (entry) => entry.season_id === selectedSeasonId && entry.team_id !== stint?.team_id,
  );
  const inheritedPhoto = !explicitPhoto ? (inheritedSeasonPhoto?.photo ?? stint?.photo ?? null) : null;
  const inheritedTeamName = inheritedSeasonPhoto?.team_name ?? 'another team';

  useLayoutEffect(() => {
    reset(formValues);
  }, [formValues, reset]);

  const handleClose = useCallback(() => {
    reset(formValues);
    onClose();
  }, [formValues, onClose, reset]);

  useEffect(() => {
    if (!open || !selectedSeasonId) return;
    setValue('photo', explicitPhoto?.photo ?? null);
  }, [open, selectedSeasonId, explicitPhoto, setValue]);

  const onSubmit = handleSubmit(async (data) => {
    if (!stint || !data.season_id) return;
    let photoUrl = typeof data.photo === 'string' ? data.photo : null;
    if (data.photo instanceof File) {
      const uploadedUrl = await uploadPhoto(data.photo);
      if (!uploadedUrl) return;
      photoUrl = uploadedUrl;
    }
    if (!photoUrl) return;
    const ok = await changePlayerPhoto(stint, data.season_id, photoUrl);
    if (ok) handleClose();
  });

  return (
    <Modal
      open={open}
      title="Change Season Photo"
      onClose={handleClose}
      confirmLabel={isSubmitting ? 'Saving...' : 'Save'}
      confirmForm="change-photo-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
    >
      <form
        id="change-photo-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <Field
          type="select"
          label="Season"
          control={control}
          name="season_id"
          options={seasons.map((s) => ({ value: s.id, label: s.name }))}
          placeholder="Select season..."
          required
          rules={{ required: true }}
          disabled={isSubmitting}
        />
        <LogoUpload
          control={control}
          name="photo"
          label="Season Photo"
          shape="circle"
          disabled={isSubmitting}
        />
        {inheritedPhoto && (
          <div className={styles.photoInheritanceNotice}>
            <span className={styles.photoInheritanceLabel}>Inherited photo</span>
            <span>
              No photo is saved for {stint?.team.name ?? 'this team'} in this season.
              Until you upload one, the player uses the latest season photo
              {inheritedSeasonPhoto ? ` from ${inheritedTeamName}` : ''}.
            </span>
          </div>
        )}

        {history.length > 0 && (
          <>
            <hr className={styles.divider} />
            <div className={styles.historySection}>
              <span className={styles.historyLabel}>History</span>
              <div className={styles.historyList}>
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className={styles.historyEntry}
                  >
                    <span className={styles.historyEntryNumber}>
                      {entry.season_name ?? 'Season'}
                    </span>
                    <span className={styles.historyEntryDates}>
                      {entry.team_name ?? stint?.team.name ?? 'Team'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};

export default ChangePhotoModal;
