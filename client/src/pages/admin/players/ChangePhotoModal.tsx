import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { season_id: '', photo: null },
  });

  useEffect(() => {
    if (!open) return;
    const latestPhoto = history.find((entry) => entry.season_id === stint?.season_id)?.photo;
    reset({
      season_id: stint?.season_id ?? '',
      photo: latestPhoto ?? stint?.photo ?? null,
    });
  }, [open, stint, history, reset]);

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
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title="Change Season Photo"
      onClose={onClose}
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
                      {entry.team_name ?? stint?.team_name ?? 'Team'}
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
