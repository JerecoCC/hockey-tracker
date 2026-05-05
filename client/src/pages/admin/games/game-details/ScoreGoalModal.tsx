import { useState, useEffect } from 'react';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import Select from '@/components/Select/Select';
import TimePicker from '@/components/TimePicker/TimePicker';
import { type GameRecord } from '@/hooks/useGames';
import { type GameRosterEntry } from '@/hooks/useGameRoster';
import { type GoalRecord, type PostGoalData } from '@/hooks/useGameGoals';
import styles from './GameDetailsPage.module.scss';

const GOAL_TYPES = [
  { value: 'even-strength', label: 'Even Strength' },
  { value: 'power-play', label: 'Power Play' },
  { value: 'shorthanded', label: 'Shorthanded' },
  { value: 'penalty-shot', label: 'Penalty Shot' },
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
  onClose: () => void;
  onAdd: (payload: PostGoalData) => Promise<unknown>;
  onUpdate: (id: string, payload: PostGoalData) => Promise<unknown>;
}

const ScoreGoalModal = ({
  open,
  period,
  editGoal,
  game,
  goals,
  awayRoster,
  homeRoster,
  busy,
  onClose,
  onAdd,
  onUpdate,
}: Props) => {
  const [goalTeam, setGoalTeam] = useState<'away' | 'home' | null>(null);
  const [goalPeriodTime, setGoalPeriodTime] = useState('');
  const [goalType, setGoalType] = useState('even-strength');
  const [goalEmptyNet, setGoalEmptyNet] = useState(false);
  const [goalScorerId, setGoalScorerId] = useState('');
  const [goalAssist1Id, setGoalAssist1Id] = useState('');
  const [goalAssist2Id, setGoalAssist2Id] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (editGoal) {
        setGoalTeam(editGoal.team_id === game.away_team_id ? 'away' : 'home');
        setGoalPeriodTime(editGoal.period_time ?? '');
        setGoalType(editGoal.goal_type === 'empty-net' ? 'even-strength' : editGoal.goal_type);
        setGoalEmptyNet(editGoal.empty_net || editGoal.goal_type === 'empty-net');
        setGoalScorerId(editGoal.scorer_id);
        setGoalAssist1Id(editGoal.assist_1_id ?? '');
        setGoalAssist2Id(editGoal.assist_2_id ?? '');
      } else {
        setGoalTeam(null);
        setGoalPeriodTime('');
        setGoalType('even-strength');
        setGoalEmptyNet(false);
        setGoalScorerId('');
        setGoalAssist1Id('');
        setGoalAssist2Id('');
      }
    }
  }, [open, editGoal, game.away_team_id]);

  const handleTeamChange = (team: 'away' | 'home') => {
    setGoalTeam(team);
    setGoalScorerId('');
    setGoalAssist1Id('');
    setGoalAssist2Id('');
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
    goalPeriodTime && latestPeriodTime && toSecs(goalPeriodTime) < toSecs(latestPeriodTime)
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
    const logo = side === 'away' ? game.away_team_logo : game.home_team_logo;
    const code = side === 'away' ? game.away_team_code : game.home_team_code;
    const primary = side === 'away' ? game.away_team_primary_color : game.home_team_primary_color;
    const text = side === 'away' ? game.away_team_text_color : game.home_team_text_color;
    return {
      value: side,
      label: (
        <>
          {logo ? (
            <img
              src={logo}
              alt={code}
              className={styles.teamSegmentLogo}
            />
          ) : (
            <span
              className={styles.teamSegmentLogoPlaceholder}
              style={{ background: primary, color: text }}
            >
              {code.slice(0, 1)}
            </span>
          )}
          {code}
        </>
      ),
    };
  });

  const handleConfirm = async () => {
    if (!goalTeam) return;
    const teamId = goalTeam === 'away' ? game.away_team_id : game.home_team_id;
    const payload: PostGoalData = {
      team_id: teamId,
      period,
      goal_type: goalType,
      empty_net: goalEmptyNet,
      period_time: goalPeriodTime || '00:00',
      scorer_id: goalScorerId,
      assist_1_id: goalAssist1Id || null,
      assist_2_id: goalAssist2Id || null,
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
  };

  return (
    <Modal
      open={open}
      title={editGoal ? 'Edit Goal' : 'Score Goal'}
      onClose={onClose}
      confirmLabel={submitting ? 'Saving…' : editGoal ? 'Save Changes' : 'Record Goal'}
      confirmDisabled={
        busy || submitting || !goalTeam || !goalScorerId || otGoalExists || !!periodTimeError
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
            disabled={submitting || otGoalExists}
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
              onChange={setGoalPeriodTime}
              disabled={submitting}
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
              onChange={setGoalType}
              disabled={submitting}
            />
          </div>
          {goalType !== 'penalty-shot' && goalType !== 'own' && (
            <div className={styles.goalFormField}>
              <label className={styles.goalFormLabel}>EN</label>
              <button
                type="button"
                className={[styles.emptyNetToggle, goalEmptyNet ? styles.emptyNetToggleOn : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setGoalEmptyNet((v) => !v)}
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
        </div>
        <div className={styles.goalFormField}>
          <label className={styles.goalFormLabel}>
            Scorer <span className={styles.required}>*</span>
          </label>
          <Select
            value={goalScorerId || null}
            options={playerOptions}
            placeholder="— Select scorer —"
            onChange={setGoalScorerId}
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
              onChange={setGoalAssist1Id}
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
              onChange={setGoalAssist2Id}
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
