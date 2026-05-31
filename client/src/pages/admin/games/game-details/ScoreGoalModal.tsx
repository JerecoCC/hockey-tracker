import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import Select from '@/components/Select/Select';
import TimePicker from '@/components/TimePicker/TimePicker';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import { type GameRecord } from '@/hooks/useGames';
import { type GameRosterEntry } from '@/hooks/useGameRoster';
import { type GoalRecord, type PostGoalData } from '@/hooks/useGameGoals';
import styles from './GameDetailsPage.module.scss';

const GOAL_TYPES = [
  { value: 'even-strength', label: 'Even Strength' },
  { value: 'power-play', label: 'Power Play' },
  { value: 'shorthanded', label: 'Shorthanded' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'own', label: 'Own Goal' },
];

interface Props {
  open: boolean;
  period: string;
  editGoal: GoalRecord | null;
  game: GameRecord;
  goals: GoalRecord[];
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  busy: boolean;
  lockTimingFields?: boolean;
  onClose: () => void;
  onAdd: (payload: PostGoalData) => Promise<unknown>;
  onUpdate: (id: string, payload: PostGoalData) => Promise<unknown>;
}

type FormValues = {
  goalTeam: 'away' | 'home' | null;
  goalPeriodTime: string;
  goalType: string;
  goalEmptyNet: boolean;
  goalPenaltyShot: boolean;
  goalScorerId: string;
  goalAssist1Id: string;
  goalAssist2Id: string;
};

const ScoreGoalModal = ({
  open,
  period,
  editGoal,
  game,
  goals,
  awayRoster,
  homeRoster,
  busy,
  lockTimingFields = false,
  onClose,
  onAdd,
  onUpdate,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const {
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      goalTeam: null,
      goalPeriodTime: '',
      goalType: 'even-strength',
      goalEmptyNet: false,
      goalPenaltyShot: false,
      goalScorerId: '',
      goalAssist1Id: '',
      goalAssist2Id: '',
    },
  });

  const goalTeam = watch('goalTeam');
  const goalPeriodTime = watch('goalPeriodTime');
  const goalType = watch('goalType');
  const goalEmptyNet = watch('goalEmptyNet');
  const goalPenaltyShot = watch('goalPenaltyShot');
  const goalScorerId = watch('goalScorerId');
  const goalAssist1Id = watch('goalAssist1Id');
  const goalAssist2Id = watch('goalAssist2Id');

  useEffect(() => {
    if (open) {
      if (editGoal) {
        reset({
          goalTeam: editGoal.team_id === game.away_team.id ? 'away' : 'home',
          goalPeriodTime: editGoal.period_time ?? '',
          goalType:
            editGoal.goal_type === 'empty-net' || editGoal.goal_type === 'penalty-shot'
              ? 'even-strength'
              : editGoal.goal_type,
          goalEmptyNet: editGoal.empty_net || editGoal.goal_type === 'empty-net',
          goalPenaltyShot: editGoal.penalty_shot || editGoal.goal_type === 'penalty-shot',
          goalScorerId: editGoal.scorer_id,
          goalAssist1Id: editGoal.assist_1_id ?? '',
          goalAssist2Id: editGoal.assist_2_id ?? '',
        });
      } else {
        reset({
          goalTeam: null,
          goalPeriodTime: '',
          goalType: 'even-strength',
          goalEmptyNet: false,
          goalPenaltyShot: false,
          goalScorerId: '',
          goalAssist1Id: '',
          goalAssist2Id: '',
        });
      }
    }
  }, [open, editGoal, game.away_team.id, reset]);

  const handleTeamChange = (team: 'away' | 'home') => {
    setValue('goalTeam', team, { shouldDirty: true });
    setValue('goalScorerId', '', { shouldDirty: true });
    setValue('goalAssist1Id', '', { shouldDirty: true });
    setValue('goalAssist2Id', '', { shouldDirty: true });
  };

  /** OT allows at most one goal. Block adding when one already exists (editing that goal is still OK). */
  const otGoalExists =
    period === 'OT' && goals.some((g) => g.period === 'OT' && g.id !== editGoal?.id);

  /** Latest period_time already recorded for this period (excluding the goal being edited). */
  const toSecs = (t: string | null | undefined) => {
    if (!t) return 0;
    const [m, s] = t.split(':').map(Number);
    return (m || 0) * 60 + (s || 0);
  };
  const latestPeriodTime = goals
    .filter((g) => g.period === period && g.id !== editGoal?.id)
    .reduce<string | null>((max, g) => {
      if (!g.period_time) return max;
      return max === null || toSecs(g.period_time) > toSecs(max) ? g.period_time : max;
    }, null);

  const periodTimeError =
    !editGoal &&
    goalPeriodTime &&
    latestPeriodTime &&
    toSecs(goalPeriodTime) < toSecs(latestPeriodTime)
      ? `Must be ${latestPeriodTime} or later`
      : null;

  const teamRoster = goalTeam === 'away' ? awayRoster : goalTeam === 'home' ? homeRoster : [];
  const playerOptions = teamRoster.map((e) => ({
    value: e.player_id,
    label:
      e.jersey_number != null
        ? `#${e.jersey_number} ${e.first_name} ${e.last_name}`
        : `${e.first_name} ${e.last_name}`,
  }));

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
            size={20}
            shape="square"
          />
          {code}
        </>
      ),
    };
  });

  const handleConfirm = handleSubmit(async (values) => {
    if (!values.goalTeam) return;
    const teamId = values.goalTeam === 'away' ? game.away_team.id : game.home_team.id;
    const payload: PostGoalData = {
      team_id: teamId,
      period,
      goal_type: values.goalType,
      empty_net: values.goalEmptyNet,
      penalty_shot: values.goalPenaltyShot,
      period_time: values.goalPeriodTime || '00:00',
      scorer_id: values.goalScorerId,
      assist_1_id: values.goalAssist1Id || null,
      assist_2_id: values.goalAssist2Id || null,
    };
    setSubmitting(true);
    try {
      if (editGoal) {
        await onUpdate(editGoal.id, payload);
      } else {
        await onAdd(payload);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Modal
      open={open}
      title={editGoal ? 'Edit Goal' : 'Score Goal'}
      onClose={onClose}
      confirmLabel={submitting ? 'Saving…' : editGoal ? 'Save Changes' : 'Record Goal'}
      confirmDisabled={
        busy ||
        submitting ||
        !goalTeam ||
        !goalScorerId ||
        otGoalExists ||
        !!periodTimeError ||
        (!!editGoal && !isDirty)
      }
      busy={submitting}
      onConfirm={handleConfirm}
    >
      <div className={styles.goalForm}>
        <div className={styles.goalFormField}>
          <label className={styles.goalFormLabel}>Scoring Team</label>
          <SegmentedControl
            value={goalTeam}
            onChange={(v) => handleTeamChange(v as 'away' | 'home')}
            options={teamOptions}
            disabled={submitting || otGoalExists || lockTimingFields}
            autoFocus
          />
        </div>
        <div className={styles.goalFormTimeRow}>
          <div className={`${styles.goalFormField} ${styles.goalPeriodTimeField}`}>
            <label className={styles.goalFormLabel}>
              Period Time <span className={styles.required}>*</span>
            </label>
            <TimePicker
              mode="duration"
              value={goalPeriodTime}
              onChange={(value) => setValue('goalPeriodTime', value, { shouldDirty: true })}
              disabled={submitting || lockTimingFields}
            />
            {periodTimeError && (
              <span className={styles.goalPeriodTimeError}>{periodTimeError}</span>
            )}
          </div>
          <div className={`${styles.goalFormField} ${styles.goalTypeField}`}>
            <label className={styles.goalFormLabel}>Goal Type</label>
            <Select
              value={goalType}
              options={GOAL_TYPES}
              onChange={(next) => {
                const nextType = next ?? 'even-strength';
                setValue('goalType', nextType, { shouldDirty: true });
                if (nextType === 'own') {
                  setValue('goalEmptyNet', false, { shouldDirty: true });
                  setValue('goalPenaltyShot', false, { shouldDirty: true });
                }
              }}
              disabled={submitting}
            />
          </div>
          {goalType !== 'own' && !goalPenaltyShot && (
            <div className={styles.goalFormField}>
              <label className={styles.goalFormLabel}>EN</label>
              <button
                type="button"
                className={[styles.emptyNetToggle, goalEmptyNet ? styles.emptyNetToggleOn : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() =>
                  setValue('goalEmptyNet', !goalEmptyNet, { shouldDirty: true })
                }
                disabled={submitting}
                title="Empty Net"
              >
                <Icon
                  name={goalEmptyNet ? 'check_box' : 'check_box_outline_blank'}
                  size="1.25rem"
                />
              </button>
            </div>
          )}
          {goalType !== 'own' && (
            <div className={styles.goalFormField}>
              <label className={styles.goalFormLabel}>PS</label>
              <button
                type="button"
                className={[styles.emptyNetToggle, goalPenaltyShot ? styles.emptyNetToggleOn : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setValue('goalPenaltyShot', !goalPenaltyShot, { shouldDirty: true });
                  setValue('goalEmptyNet', false, { shouldDirty: true });
                }}
                disabled={submitting}
                title="Penalty Shot"
              >
                <Icon
                  name={goalPenaltyShot ? 'check_box' : 'check_box_outline_blank'}
                  size="1.25rem"
                />
              </button>
            </div>
          )}
        </div>
        <div className={styles.goalFormField}>
          <label className={styles.goalFormLabel}>
            Scorer <span className={styles.required}>*</span>
          </label>
          <Select
            value={goalScorerId || null}
            options={playerOptions}
            placeholder="— Select scorer —"
            onChange={(value) => setValue('goalScorerId', value ?? '', { shouldDirty: true })}
            searchable
            disabled={submitting || !goalTeam}
          />
        </div>
        <div className={styles.goalFormRow}>
          <div className={styles.goalFormField}>
            <label className={styles.goalFormLabel}>1st Assist</label>
            <Select
              value={goalAssist1Id || null}
              options={playerOptions}
              placeholder="— Optional —"
              onChange={(value) => setValue('goalAssist1Id', value ?? '', { shouldDirty: true })}
              searchable
              disabled={submitting || !goalTeam}
            />
          </div>
          <div className={styles.goalFormField}>
            <label className={styles.goalFormLabel}>2nd Assist</label>
            <Select
              value={goalAssist2Id || null}
              options={playerOptions}
              placeholder="— Optional —"
              onChange={(value) => setValue('goalAssist2Id', value ?? '', { shouldDirty: true })}
              searchable
              disabled={submitting || !goalTeam}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ScoreGoalModal;
