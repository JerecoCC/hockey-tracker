import { useCallback, useLayoutEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import {
  type PlayerStintRecord,
  type UpdateStintData,
  type CreateStintData,
} from '@/hooks/useTeamPlayers';
import { formatPlayerPosition } from '@/lib/playerPosition';
import { type TeamRecord } from '@/hooks/useTeams';
import { type SeasonRecord } from '@/hooks/useSeasons';
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

export const ACQUISITION_TYPE_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'trade', label: 'Trade' },
  { value: 'free_agency', label: 'Free Agency' },
  { value: 'waivers', label: 'Waivers' },
  { value: 'signing', label: 'Signing' },
  { value: 'expansion_draft', label: 'Expansion Draft' },
  { value: 'team_transfer', label: 'Team Transfer' },
  { value: 'loan', label: 'Loan' },
  { value: 'other', label: 'Other' },
];

export const ACQUISITION_TYPE_LABELS = Object.fromEntries(
  ACQUISITION_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>;

interface FormValues {
  team_id: string;
  jersey_number: string;
  position: string;
  roster_status: 'roster' | 'prospect';
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
  history?: PlayerStintRecord[];
  leagueId?: string | null;
  currentTeamId?: string | null;
  onClose: () => void;
  createStint: (data: CreateStintData) => Promise<boolean>;
  updateStint: (stintId: string, data: UpdateStintData) => Promise<boolean>;
}

const formatDate = (d: string | null) => {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const StintEditModal = ({
  open,
  stint,
  teams,
  seasons,
  history = [],
  leagueId,
  currentTeamId,
  onClose,
  createStint,
  updateStint,
}: Props) => {
  const mode = stint ? 'edit' : 'create';
  const formValues = useMemo<FormValues>(
    () =>
      stint
        ? {
            team_id: stint.team_id,
            jersey_number: stint.jersey_number == null ? '' : String(stint.jersey_number),
            position: stint.position ?? '',
            roster_status: stint.is_prospect ? 'prospect' : 'roster',
            acquisition_type: stint.acquisition_type ?? '',
            start_date: stint.start_date?.slice(0, 10) ?? '',
            end_date: stint.end_date?.slice(0, 10) ?? '',
          }
        : {
            team_id: '',
            jersey_number: '',
            position: '',
            roster_status: 'roster',
            acquisition_type: 'signing',
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
        is_prospect: data.roster_status === 'prospect',
        position: data.position || null,
        acquisition_type: data.acquisition_type || 'signing',
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
        jersey_number: jerseyNumber,
        is_prospect: data.roster_status === 'prospect',
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
              disabled={isSubmitting}
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
          <div className={styles.segmentedField}>
            <span className={styles.segmentedLabel}>Roster Status</span>
            <Controller
              control={control}
              name="roster_status"
              render={({ field }) => (
                <SegmentedControl
                  value={field.value}
                  onChange={field.onChange}
                  variant="field"
                  options={[
                    { value: 'roster', label: 'Roster' },
                    { value: 'prospect', label: 'Prospect' },
                  ]}
                  disabled={isSubmitting}
                />
              )}
            />
          </div>
        </form>

        {history.length > 0 && (
          <div className={styles.history}>
            <h4 className={styles.historyTitle}>Team History</h4>
            <ul className={styles.stintList}>
              {history.map((s) => (
                <li
                  key={s.id}
                  className={styles.stintItem}
                >
                  {s.team.logo && (
                    <img
                      src={s.team.logo}
                      alt={s.team.name ?? ''}
                      className={styles.stintLogo}
                    />
                  )}
                  <div className={styles.stintInfo}>
                    <span className={styles.stintTeam}>{s.team.name ?? 'Unknown Team'}</span>
                    {s.jersey_number != null && (
                      <span className={styles.stintJersey}>#{s.jersey_number}</span>
                    )}
                    {s.position && (
                      <span className={styles.stintJersey}>{formatPlayerPosition(s.position)}</span>
                    )}
                    {s.acquisition_type && (
                      <span className={styles.stintJersey}>
                        {ACQUISITION_TYPE_LABELS[s.acquisition_type] ?? s.acquisition_type}
                      </span>
                    )}
                  </div>
                  <span className={styles.stintDates}>
                    {formatDate(s.start_date)} - {s.end_date ? formatDate(s.end_date) : 'Present'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default StintEditModal;
