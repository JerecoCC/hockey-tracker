import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
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

export const ACQUISITION_TYPE_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'trade', label: 'Trade' },
  { value: 'free_agency', label: 'Free Agency' },
  { value: 'waivers', label: 'Waivers' },
  { value: 'signing', label: 'Signing' },
  { value: 'call_up', label: 'Call-Up' },
  { value: 'loan', label: 'Loan' },
  { value: 'other', label: 'Other' },
];

export const ACQUISITION_TYPE_LABELS = Object.fromEntries(
  ACQUISITION_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>;

interface FormValues {
  team_id: string;
  position: string;
  acquisition_type: string;
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
}

const StintEditModal = ({
  open,
  stint,
  teams,
  seasons,
  onClose,
  createStint,
  updateStint,
}: Props) => {
  const mode = stint ? 'edit' : 'create';

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      team_id: '',
      position: '',
      acquisition_type: '',
      start_date: '',
      end_date: '',
    },
  });

  const inferSeasonId = (teamId: string, startDate: string, endDate: string) => {
    const leagueId = teams.find((t) => t.id === teamId)?.league_id ?? null;
    const leagueSeasons = seasons
      .filter((s) => leagueId && s.league_id === leagueId)
      .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''));
    const anchorDate = startDate || endDate;
    if (anchorDate) {
      const matching = leagueSeasons.find((s) => {
        const startsBefore = !s.start_date || s.start_date <= anchorDate;
        const endsAfter = !s.end_date || s.end_date >= anchorDate;
        return startsBefore && endsAfter;
      });
      if (matching) return matching.id;
    }
    return leagueSeasons.find((s) => s.is_current)?.id ?? leagueSeasons[0]?.id ?? null;
  };

  useEffect(() => {
    if (!open) return;
    if (stint) {
      reset({
        team_id: stint.team_id,
        position: stint.position ?? '',
        acquisition_type: stint.acquisition_type ?? '',
        start_date: stint.start_date?.slice(0, 10) ?? '',
        end_date: stint.end_date?.slice(0, 10) ?? '',
      });
    } else {
      reset({
        team_id: '',
        position: '',
        acquisition_type: '',
        start_date: '',
        end_date: '',
      });
    }
  }, [open, stint, reset]);

  const onSubmit = handleSubmit(async (data) => {
    if (mode === 'create') {
      const seasonId = inferSeasonId(data.team_id, data.start_date, data.end_date);
      if (!seasonId) return;
      const ok = await createStint({
        team_id: data.team_id,
        season_id: seasonId,
        position: data.position || null,
        acquisition_type: data.acquisition_type || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      });
      if (ok) onClose();
    } else {
      if (!stint) return;
      const seasonId = inferSeasonId(data.team_id, data.start_date, data.end_date);
      const ok = await updateStint(stint.id, {
        team_id: data.team_id,
        ...(seasonId ? { season_id: seasonId } : {}),
        position: data.position || null,
        acquisition_type: data.acquisition_type || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      });
      if (ok) onClose();
    }
  });

  const title =
    mode === 'create' ? 'Record New Stint' : `Edit Stint - ${stint?.team.name ?? 'Stint'}`;
  const confirmLabel = isSubmitting
    ? 'Saving...'
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
          placeholder="Select team..."
          required
          rules={{ required: true }}
          disabled={isSubmitting}
        />
        <Field
          type="select"
          label="Position"
          control={control}
          name="position"
          options={POSITION_OPTIONS}
          placeholder="Inherit from player..."
          disabled={isSubmitting}
        />
        <Field
          type="select"
          label="Acquisition Type"
          control={control}
          name="acquisition_type"
          options={ACQUISITION_TYPE_OPTIONS}
          placeholder="Unknown..."
          disabled={isSubmitting}
        />
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
