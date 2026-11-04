import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import Banner from '@jerecocc/tracker-ui/components/Banner/Banner';
import { ControlledSelectField } from '@/components/form/ControlledFields';
import LogoUpload from '@jerecocc/tracker-ui/components/LogoUpload/LogoUpload';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import ReadOnlyField from '@jerecocc/tracker-ui/components/ReadOnlyField/ReadOnlyField';
import useBackgroundModalAction from '@/hooks/useBackgroundModalAction';
import { type PlayerPhotoEntry, type PlayerStintRecord } from '@/hooks/useTeamPlayers';
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

const isSavedPhotoEntry = (entry: PlayerPhotoEntry | undefined) =>
  Boolean(entry?.has_saved_photo ?? entry?.id);

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
  const formValues = useMemo<FormValues>(() => {
    const seasonId = initialSeasonId ?? stint?.season_id ?? '';
    const teamSeasonPhoto = history.find(
      (entry) => entry.team_id === stint?.team_id && entry.season_id === seasonId,
    );
    return {
      season_id: seasonId,
      photo: teamSeasonPhoto?.photo ?? null,
    };
  }, [history, initialSeasonId, stint]);
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
  const teamSeasonPhoto = history.find(
    (entry) => entry.team_id === stint?.team_id && entry.season_id === selectedSeasonId,
  );
  const explicitPhoto = isSavedPhotoEntry(teamSeasonPhoto) ? teamSeasonPhoto : undefined;
  const inheritedSeasonPhoto = history.find(
    (entry) =>
      entry.season_id === selectedSeasonId &&
      entry.team_id !== stint?.team_id &&
      isSavedPhotoEntry(entry),
  );
  const inheritedPhoto = !explicitPhoto
    ? (inheritedSeasonPhoto?.photo ?? stint?.photo ?? null)
    : null;
  const inheritedTeamName = inheritedSeasonPhoto?.team_name ?? 'another team';
  const selectedSeasonName =
    seasons.find((season) => season.id === selectedSeasonId)?.name ??
    teamSeasonPhoto?.season_name ??
    'Season unavailable';
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
    setValue('photo', teamSeasonPhoto?.photo ?? null, { shouldValidate: true });
  }, [open, selectedSeasonId, teamSeasonPhoto, setValue]);

  useEffect(() => {
    setInheritedBannerDismissed(false);
  }, [open, selectedSeasonId, inheritedPhoto]);

  // The modal hides while the photo uploads and saves behind a progress toast, and reappears
  // with the season and photo chosen if it fails.
  const { hidden, runSettled } = useBackgroundModalAction({
    target: open ? (stint?.id ?? null) : null,
    onDone: handleClose,
  });

  const onSubmit = handleSubmit((data) => {
    if (!stint || !data.season_id) return;
    const { photo, season_id: seasonId } = data;
    if (!photo) return;
    void runSettled(
      async () => {
        const photoUrl = photo instanceof File ? await uploadPhoto(photo) : photo;
        if (!photoUrl) return false;
        return changePlayerPhoto(stint, seasonId, photoUrl);
      },
      { pending: 'Saving season photo…' },
    );
  });

  return (
    <Modal
      open={open && !hidden}
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
          <ReadOnlyField
            label="Season"
            value={selectedSeasonName}
            title="This photo record already belongs to this season."
          />
        ) : (
          <ControlledSelectField
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
            No photo is saved for {stint?.team.name ?? 'this team'} in this season. Until you upload
            one, the player uses the latest season photo
            {inheritedSeasonPhoto ? ` from ${inheritedTeamName}` : ''}.
          </Banner>
        )}
      </form>
    </Modal>
  );
};

export default ChangePhotoModal;
