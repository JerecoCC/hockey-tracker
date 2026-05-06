import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import Field from '@/components/Field/Field';
import LogoUpload from '@/components/LogoUpload/LogoUpload';
import Modal from '@/components/Modal/Modal';
import {
  type PlayerStintRecord,
  type UpdateStintData,
  type CreateStintData,
} from '@/hooks/useTeamPlayers';
import { type TeamRecord } from '@/hooks/useTeams';
import { type SeasonRecord } from '@/hooks/useSeasons';
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

interface FormValues {
  team_id: string;
  season_id: string;
  photo: File | string | null;
  jersey_number: string;
  position: string;
  start_date: string;
  end_date: string;
}

interface Props {
  open: boolean;
  /** null = create mode, PlayerStintRecord = edit mode */
  stint: PlayerStintRecord | null;
  teams: TeamRecord[];
  seasons: SeasonRecord[];
  onClose: () => void;
  createStint: (data: CreateStintData) => Promise<boolean>;
  updateStint: (stintId: string, data: UpdateStintData) => Promise<boolean>;
  uploadStintPhoto: (file: File) => Promise<string | null>;
}

const StintEditModal = ({
  open,
  stint,
  teams,
  seasons,
  onClose,
  createStint,
  updateStint,
  uploadStintPhoto,
}: Props) => {
  const mode = stint ? 'edit' : 'create';

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      team_id: '',
      season_id: '',
      photo: null,
      jersey_number: '',
      position: '',
      start_date: '',
      end_date: '',
    },
  });

  // Watch team_id so the season list can be filtered by the selected team's league.
  const selectedTeamId = useWatch({ control, name: 'team_id' });
  const selectedLeagueId = teams.find((t) => t.id === selectedTeamId)?.league_id ?? null;
  const filteredSeasons = selectedLeagueId
    ? seasons.filter((s) => s.league_id === selectedLeagueId)
    : [];

  useEffect(() => {
    if (!open) return;
    if (stint) {
      reset({
        team_id: stint.team_id,
        season_id: stint.season_id,
        photo: stint.photo ?? null,
        jersey_number: stint.jersey_number != null ? String(stint.jersey_number) : '',
        position: stint.position ?? '',
        start_date: stint.start_date?.slice(0, 10) ?? '',
        end_date: stint.end_date?.slice(0, 10) ?? '',
      });
    } else {
      reset({
        team_id: '',
        season_id: '',
        photo: null,
        jersey_number: '',
        position: '',
        start_date: '',
        end_date: '',
      });
    }
  }, [open, stint, reset]);

  const onSubmit = handleSubmit(async (data) => {
    let photoUrl: string | null = typeof data.photo === 'string' ? data.photo : null;
    if (data.photo instanceof File) {
      const url = await uploadStintPhoto(data.photo);
      if (!url) return;
      photoUrl = url;
    }

    if (mode === 'create') {
      const ok = await createStint({
        team_id: data.team_id,
        season_id: data.season_id,
        photo: photoUrl,
        jersey_number: data.jersey_number ? Number(data.jersey_number) : null,
        position: data.position || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      });
      if (ok) onClose();
    } else {
      if (!stint) return;
      const ok = await updateStint(stint.id, {
        team_id: data.team_id,
        season_id: data.season_id,
        photo: photoUrl,
        jersey_number: data.jersey_number ? Number(data.jersey_number) : null,
        position: data.position || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      });
      if (ok) onClose();
    }
  });

  const title =
    mode === 'create' ? 'Record New Stint' : `Edit Stint — ${stint?.team_name ?? 'Stint'}`;
  const confirmLabel = isSubmitting
    ? 'Saving…'
    : mode === 'create'
      ? 'Record Stint'
      : 'Save Changes';

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      confirmLabel={confirmLabel}
      confirmForm="stint-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
    >
      <form
        id="stint-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <Field
          type="select"
          label="Team"
          control={control}
          name="team_id"
          options={teams.map((t) => ({ value: t.id, label: t.name }))}
          placeholder="Select team…"
          required
          rules={{ required: true }}
          disabled={isSubmitting}
          onChange={() => setValue('season_id', '')}
        />
        <Field
          type="select"
          label="Season"
          control={control}
          name="season_id"
          options={filteredSeasons.map((s) => ({ value: s.id, label: s.name }))}
          placeholder={selectedTeamId ? 'Select season…' : 'Select a team first…'}
          required
          rules={{ required: true }}
          disabled={isSubmitting || !selectedTeamId}
        />
        <hr className={styles.divider} />
        <LogoUpload
          control={control}
          name="photo"
          label="Player Photo (this stint)"
          disabled={isSubmitting}
        />
        <div className={styles.jerseyDateRow}>
          <Field
            type="number"
            label="Jersey #"
            control={control}
            name="jersey_number"
            placeholder="e.g. 97"
            min={0}
            max={99}
            required
            disabled={isSubmitting}
            rules={{
              required: true,
              validate: (v) =>
                !!v && Number(v) >= 0 && Number(v) <= 99 && Number.isInteger(Number(v)),
            }}
          />
          <Field
            type="select"
            label="Position (this stint)"
            control={control}
            name="position"
            options={POSITION_OPTIONS}
            placeholder="Inherit from player…"
            disabled={isSubmitting}
          />
        </div>
        <div className={styles.row}>
          <Field
            type="datepicker"
            label="Start Date"
            control={control}
            name="start_date"
            placeholder="YYYY-MM-DD"
            disabled={isSubmitting}
          />
          <Field
            type="datepicker"
            label="End Date"
            control={control}
            name="end_date"
            placeholder="YYYY-MM-DD (leave blank if current)"
            disabled={isSubmitting}
          />
        </div>
      </form>
    </Modal>
  );
};

export default StintEditModal;
