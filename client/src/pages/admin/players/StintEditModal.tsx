import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import {
  type PlayerStintRecord,
  type UpdateStintData,
  type CreateStintData,
} from '@/hooks/useTeamPlayers';
import { type TeamRecord } from '@/hooks/useTeams';
import { type SeasonRecord } from '@/hooks/useSeasons';
import { ACQUISITION_TYPE_OPTIONS } from './stintOptions';
import styles from '../teams/MovePlayerModal.module.scss';

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
  jersey_number: string;
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
  leagueId?: string | null;
  currentTeamId?: string | null;
  onClose: () => void;
  createStint: (data: CreateStintData) => Promise<boolean>;
  updateStint: (stintId: string, data: UpdateStintData) => Promise<boolean>;
}

const StintEditModal = ({
  open,
  stint,
  teams,
  seasons,
  leagueId,
  currentTeamId,
  onClose,
  createStint,
  updateStint,
}: Props) => {
  const mode = stint ? 'edit' : 'create';
  const canEditJerseyNumber = mode === 'create' || !!stint?.roster_player_team_id;
  const formValues = useMemo<FormValues>(
    () =>
      stint
        ? {
            team_id: stint.team_id,
            jersey_number: stint.jersey_number == null ? '' : String(stint.jersey_number),
            position: stint.position ?? '',
            acquisition_type: stint.acquisition_type ?? '',
            start_date: stint.start_date?.slice(0, 10) ?? '',
            end_date: stint.end_date?.slice(0, 10) ?? '',
          }
        : {
            team_id: '',
            jersey_number: '',
            position: '',
            acquisition_type: 'free_agency',
            start_date: '',
            end_date: '',
          },
    [stint],
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

  const teamOptions = useMemo(
    () =>
      teams
        .filter((team) => {
          if (leagueId && team.league_id !== leagueId) return false;
          if (mode === 'create' && currentTeamId && team.id === currentTeamId) return false;
          return true;
        })
        .map((team) => ({
          value: team.id,
          label: team.name,
          logo: team.logo ?? undefined,
          logoDark: team.logo_dark ?? undefined,
          logoLight: team.logo_light ?? undefined,
          code: team.code,
        })),
    [currentTeamId, leagueId, mode, teams],
  );

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

  useLayoutEffect(() => {
    reset(formValues);
  }, [formValues, reset]);

  const handleClose = useCallback(() => {
    reset(formValues);
    onClose();
  }, [formValues, onClose, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const jerseyNumber = data.jersey_number ? Number(data.jersey_number) : null;
    if (mode === 'create') {
      const seasonId = inferSeasonId(data.team_id, data.start_date, data.end_date);
      if (!seasonId) return;
      const ok = await createStint({
        team_id: data.team_id,
        season_id: seasonId,
        jersey_number: jerseyNumber,
        is_prospect: false,
        position: data.position || null,
        acquisition_type: data.acquisition_type || 'free_agency',
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      });
      if (ok) handleClose();
    } else {
      if (!stint) return;
      const seasonId = inferSeasonId(data.team_id, data.start_date, data.end_date);
      const ok = await updateStint(stint.id, {
        team_id: data.team_id,
        ...(seasonId ? { season_id: seasonId } : {}),
        ...(canEditJerseyNumber ? { jersey_number: jerseyNumber } : {}),
        position: data.position || null,
        acquisition_type: data.acquisition_type || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      });
      if (ok) handleClose();
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
      onClose={handleClose}
      confirmLabel={confirmLabel}
      confirmForm="stint-form"
      confirmDisabled={isSubmitting || !isDirty || !isValid}
      busy={isSubmitting}
    >
      <div className={styles.layout}>
        <form
          id="stint-form"
          className={styles.form}
          onSubmit={onSubmit}
        >
          <Field
            type="select"
            label="Position"
            control={control}
            name="position"
            options={POSITION_OPTIONS}
            placeholder="Inherit from player..."
            disabled={isSubmitting}
          />
          <div className={styles.teamRow}>
            <Field
              type="select"
              label="Team"
              control={control}
              name="team_id"
              options={teamOptions}
              placeholder="Select team..."
              searchable
              required
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
              disabled={isSubmitting || !canEditJerseyNumber}
            />
          </div>
          <Field
            type="select"
            label="Acquisition Type"
            control={control}
            name="acquisition_type"
            options={ACQUISITION_TYPE_OPTIONS}
            disabled={isSubmitting}
          />
          <div className={styles.dateRow}>
            <Field
              type="datepicker"
              label="Start Date"
              control={control}
              name="start_date"
              placeholder="YYYY-MM-DD"
              required={mode === 'create'}
              rules={mode === 'create' ? { required: 'Start date is required' } : undefined}
              disabled={isSubmitting}
            />
            <Field
              type="datepicker"
              label="End Date"
              control={control}
              name="end_date"
              placeholder="YYYY-MM-DD"
              disabled={isSubmitting}
            />
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default StintEditModal;
