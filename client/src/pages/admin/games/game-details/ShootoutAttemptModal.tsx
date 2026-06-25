import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import Modal from '@/components/Modal/Modal';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import Select from '@/components/Select/Select';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import { type GameRecord } from '@/hooks/useGames';
import { type GameRosterEntry } from '@/hooks/useGameRoster';
import { type PostAttemptData, type PutAttemptData } from '@/hooks/useShootoutAttempts';
import styles from './GameDetailsPage.module.scss';

interface Props {
  /** null = closed; 'add' = add mode; any other string = edit mode (the attempt id) */
  mode: null | 'add' | string;
  /** Initial team side when adding (auto-determined by parent). */
  initialTeam: 'away' | 'home';
  /** Initial shooter id when editing. */
  initialShooterId: string;
  /** Initial scored state when editing. null = no selection yet (add mode). */
  initialScored: boolean | null;
  game: GameRecord;
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  busy: boolean;
  onClose: () => void;
  onAdd: (payload: PostAttemptData) => Promise<unknown>;
  onUpdate: (id: string, payload: PutAttemptData) => Promise<unknown>;
}

type FormValues = {
  team: 'away' | 'home';
  shooterId: string;
  scored: '' | 'goal' | 'miss';
};

const ShootoutAttemptModal = ({
  mode,
  initialTeam,
  initialShooterId,
  initialScored,
  game,
  awayRoster,
  homeRoster,
  busy,
  onClose,
  onAdd,
  onUpdate,
}: Props) => {
  const isEditMode = mode !== null && mode !== 'add';
  const formValues = useMemo<FormValues>(
    () => ({
      team: initialTeam,
      shooterId: initialShooterId,
      scored: initialScored == null ? '' : initialScored ? 'goal' : 'miss',
    }),
    [initialTeam, initialShooterId, initialScored],
  );
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<FormValues>({
    defaultValues: formValues,
    mode: 'onChange',
  });

  useEffect(() => {
    if (mode !== null) reset(formValues);
  }, [mode, formValues, reset]);

  const team = watch('team');

  const attemptRoster = (team === 'away' ? awayRoster : homeRoster).filter(
    (e) => e.position !== 'G',
  );
  const shooterOptions = attemptRoster.map((e) => ({
    value: e.player_id,
    label:
      e.jersey_number != null
        ? `#${e.jersey_number} ${e.first_name} ${e.last_name}`
        : `${e.first_name} ${e.last_name}`,
  }));
  const attemptTeamName = team === 'away' ? game.away_team.name : game.home_team.name;

  const teamOptions = (['away', 'home'] as const).map((side) => {
    const logo = side === 'away' ? game.away_team.logo : game.home_team.logo;
    const code = side === 'away' ? game.away_team.code : game.home_team.code;
    const primary = side === 'away' ? game.away_team.primary_color : game.home_team.primary_color;
    const text = side === 'away' ? game.away_team.text_color : game.home_team.text_color;
    return {
      value: side,
      label: (
        <>
          <TeamLogo
            logo={logo}
            code={code}
            primaryColor={primary}
            textColor={text}
            size={18}
            shape="square"
          />
          {code}
        </>
      ),
    };
  });

  const resultOptions = [
    {
      value: 'miss',
      label: (
        <>
          <span className={styles.soResultOptionIcon}>✕</span>
          Miss
        </>
      ),
      activeClassName: styles.resultOptionMissActive,
    },
    {
      value: 'goal',
      label: (
        <>
          <span className={styles.soResultOptionIcon}>✓</span>
          Goal
        </>
      ),
      activeClassName: styles.resultOptionGoalActive,
    },
  ];

  const handleConfirm = handleSubmit(async (values) => {
    const teamId = values.team === 'away' ? game.away_team.id : game.home_team.id;
    const payload = {
      team_id: teamId,
      shooter_id: values.shooterId,
      scored: values.scored === 'goal',
    };
    if (isEditMode) {
      await onUpdate(mode as string, payload);
    } else {
      await onAdd(payload);
    }
    onClose();
  });

  return (
    <Modal
      open={mode !== null}
      title={isEditMode ? 'Edit Attempt' : `Add Attempt — ${attemptTeamName}`}
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : isEditMode ? 'Save Changes' : 'Record Attempt'}
      confirmDisabled={busy || isSubmitting || !isDirty || !isValid}
      busy={isSubmitting}
      onConfirm={handleConfirm}
    >
      <div className={styles.goalForm}>
        {isEditMode && (
          <Controller
            control={control}
            name="team"
            rules={{ required: 'Team is required' }}
            render={({ field }) => (
              <SegmentedControl
                value={field.value}
                onChange={(v) => {
                  field.onChange(v as 'away' | 'home');
                  setValue('shooterId', '', { shouldDirty: true, shouldValidate: true });
                }}
                variant="field"
                options={teamOptions}
                disabled={isSubmitting}
              />
            )}
          />
        )}
        <div className={styles.goalFormField}>
          <label className={styles.goalFormLabel}>
            Shooter <span className={styles.required}>*</span>
          </label>
          <Controller
            control={control}
            name="shooterId"
            rules={{ required: 'Shooter is required' }}
            render={({ field }) => (
              <Select
                options={shooterOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                placeholder="Select shooter…"
                searchable
                autoFocus
                disabled={isSubmitting}
              />
            )}
          />
        </div>
        <div className={styles.goalFormField}>
          <label className={styles.goalFormLabel}>
            Result <span className={styles.required}>*</span>
          </label>
          <Controller
            control={control}
            name="scored"
            rules={{ required: 'Result is required' }}
            render={({ field }) => (
              <SegmentedControl
                value={field.value || null}
                onChange={(v) => field.onChange(v as FormValues['scored'])}
                variant="field"
                options={resultOptions}
                disabled={isSubmitting}
              />
            )}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ShootoutAttemptModal;
