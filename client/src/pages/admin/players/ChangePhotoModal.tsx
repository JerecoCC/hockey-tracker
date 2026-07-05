import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import Banner from '@/components/Banner/Banner';
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
  initialSeasonId?: string | null;
  mode?: 'set' | 'edit';
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
  initialSeasonId,
  mode = 'set',
  seasons,
  history,
  onClose,
  uploadPhoto,
  changePlayerPhoto,
}: Props) => {
  const [inheritedBannerDismissed, setInheritedBannerDismissed] = useState(false);
  const formValues = useMemo<FormValues>(
    () => {
      const seasonId = initialSeasonId ?? stint?.season_id ?? '';
      return {
        season_id: seasonId,
        photo:
          history.find(
            (entry) => entry.team_id === stint?.team_id && entry.season_id === seasonId,
          )?.photo ?? null,
      };
    },
    [history, initialSeasonId, stint],
  );
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<FormValues>({
    defaultValues: formValues,
    mode: 'onChange',
  });

  const selectedSeasonId = useWatch({ control, name: 'season_id' });
  const isEditMode = mode === 'edit';
  const explicitPhoto = history.find(
    (entry) => entry.team_id === stint?.team_id && entry.season_id === selectedSeasonId,
  );
  const inheritedSeasonPhoto = history.find(
    (entry) => entry.season_id === selectedSeasonId && entry.team_id !== stint?.team_id,
  );
  const inheritedPhoto = !explicitPhoto ? (inheritedSeasonPhoto?.photo ?? stint?.photo ?? null) : null;
  const inheritedTeamName = inheritedSeasonPhoto?.team_name ?? 'another team';
  const selectedSeasonName =
    seasons.find((season) => season.id === selectedSeasonId)?.name ??
    explicitPhoto?.season_name ??
    'Selected season';
  const showInheritedBanner = Boolean(inheritedPhoto) && !inheritedBannerDismissed;

  useLayoutEffect(() => {
    reset(formValues);
  }, [formValues, reset]);

  const handleClose = useCallback(() => {
    reset(formValues);
    onClose();
  }, [formValues, onClose, reset]);

  useEffect(() => {
    if (!open || !selectedSeasonId) return;
    setValue('photo', explicitPhoto?.photo ?? null, { shouldValidate: true });
  }, [open, selectedSeasonId, explicitPhoto, setValue]);

  useEffect(() => {
    setInheritedBannerDismissed(false);
  }, [open, selectedSeasonId, inheritedPhoto]);

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
      title={isEditMode ? 'Edit Season Photo' : 'Set Team Photo'}
      onClose={handleClose}
      confirmLabel={isSubmitting ? 'Saving...' : 'Save'}
      confirmForm="change-photo-form"
      confirmDisabled={isSubmitting || !isDirty || !isValid}
      busy={isSubmitting}
    >
      <form
        id="change-photo-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        {isEditMode ? (
          <div className={styles.readonlyField}>
            <span className={styles.readonlyFieldLabel}>Season</span>
            <div
              className={styles.readonlyFieldBox}
              title="This photo record already belongs to this season."
            >
              <span className={styles.readonlyFieldValue}>{selectedSeasonName}</span>
            </div>
          </div>
        ) : (
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
        )}
        <LogoUpload
          control={control}
          name="photo"
          label="Season Photo"
          shape="circle"
          disabled={isSubmitting}
        />
        {showInheritedBanner && (
          <Banner
            intent="info"
            icon="info"
            title="Inherited photo"
            onClose={() => setInheritedBannerDismissed(true)}
          >
            No photo is saved for {stint?.team.name ?? 'this team'} in this season. Until you
            upload one, the player uses the latest season photo
            {inheritedSeasonPhoto ? ` from ${inheritedTeamName}` : ''}.
          </Banner>
        )}
      </form>
    </Modal>
  );
};

export default ChangePhotoModal;
