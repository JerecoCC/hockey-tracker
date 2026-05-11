import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import type { GameRecord } from '@/hooks/useGames';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type { GoalieSwitchData, GoalieStatRecord } from '@/hooks/useGameGoalieStats';
import styles from './GameDetailsPage.module.scss';

const PERIOD_OPTIONS = [
  { value: '1', label: '1st Period' },
  { value: '2', label: '2nd Period' },
  { value: '3', label: '3rd Period' },
  { value: 'OT', label: 'Overtime' },
];

interface Props {
  open: boolean;
  game: GameRecord;
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  existingStats: GoalieStatRecord[];
  onClose: () => void;
  switchGoalie: (data: GoalieSwitchData) => Promise<GoalieStatRecord[] | null>;
}

type FormValues = {
  team_side: 'away' | 'home';
  // Outgoing goalie — close their currently-open stint
  exited_period: string;
  exited_time: string;
  // Incoming goalie — new stint
  goalie_id: string;
  entered_period: string;
  entered_time: string;
};

const GoalieSwitchModal = ({
  open,
  game,
  awayRoster,
  homeRoster,
  existingStats,
  onClose,
  switchGoalie,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);

  const { control, reset, watch, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      team_side: 'away',
      exited_period: '2',
      exited_time: '',
      goalie_id: '',
      entered_period: '2',
      entered_time: '',
    },
  });

  const teamSide = watch('team_side');
  const teamId = teamSide === 'away' ? game.away_team.id : game.home_team.id;
  const roster = teamSide === 'away' ? awayRoster : homeRoster;

  // Find the goalie currently in net (the team's most-recent open stint).
  const currentInNetGoalieId = useMemo(() => {
    const teamStats = existingStats.filter((s) => s.team_id === teamId);
    for (const stat of teamStats) {
      if ((stat.stints ?? []).some((st) => st.exited_period === null)) {
        return stat.goalie_id;
      }
    }
    return null;
  }, [existingStats, teamId]);

  const currentInNetName = useMemo(() => {
    if (!currentInNetGoalieId) return null;
    const entry = roster.find((e) => e.player_id === currentInNetGoalieId);
    if (!entry) return null;
    return `${entry.first_name} ${entry.last_name}${entry.jersey_number != null ? ` (#${entry.jersey_number})` : ''}`;
  }, [currentInNetGoalieId, roster]);

  // Incoming goalie options: all roster goalies except whoever is currently in net.
  const goalieOptions = roster
    .filter((e) => e.position === 'G' && e.player_id !== currentInNetGoalieId)
    .map((e) => ({
      value: e.player_id,
      label: `${e.first_name} ${e.last_name}${e.jersey_number != null ? ` (#${e.jersey_number})` : ''}`,
    }));

  useEffect(() => {
    if (open) {
      reset({
        team_side: 'away',
        exited_period: '2',
        exited_time: '',
        goalie_id: '',
        entered_period: '2',
        entered_time: '',
      });
    }
  }, [open, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!values.goalie_id || !values.entered_period) return;
    setSubmitting(true);
    await switchGoalie({
      goalie_id: values.goalie_id,
      team_id: teamId,
      entered_period: values.entered_period,
      entered_time: values.entered_time || null,
      close_previous: currentInNetGoalieId
        ? { exited_period: values.exited_period, exited_time: values.exited_time || null }
        : undefined,
    });
    setSubmitting(false);
    onClose();
  };

  const teamOptions = [
    { value: 'away', label: `${game.away_team.code} (Away)` },
    { value: 'home', label: `${game.home_team.code} (Home)` },
  ];

  const noIncoming = goalieOptions.length === 0;

  return (
    <Modal
      open={open}
      title="Switch Goalie"
      onClose={onClose}
      confirmLabel={submitting ? 'Saving…' : 'Record Switch'}
      onConfirm={handleSubmit(onSubmit)}
      confirmDisabled={submitting || noIncoming}
      busy={submitting}
    >
      <div className={styles.shotsModalBody}>
        <Field
          label="Team"
          type="select"
          control={control}
          name="team_side"
          options={teamOptions}
          disabled={submitting}
        />

        {/* ── Outgoing goalie — close their open stint ── */}
        {currentInNetGoalieId && (
          <>
            <p className={styles.goalieSubLabel}>
              Outgoing: <strong>{currentInNetName ?? currentInNetGoalieId}</strong>
            </p>
            <div className={styles.goalieSubRow}>
              <Field
                label="Exited in Period"
                type="select"
                control={control}
                name="exited_period"
                options={PERIOD_OPTIONS}
                required
                disabled={submitting}
              />
              <Field
                label="Exit Time"
                type="timepicker"
                mode="duration"
                control={control}
                name="exited_time"
                placeholder="MM:SS"
                disabled={submitting}
              />
            </div>
          </>
        )}

        {/* ── Incoming goalie ── */}
        {noIncoming ? (
          <p className={styles.noGoalsText}>No other goalies on the roster for this team.</p>
        ) : (
          <>
            <p className={styles.goalieSubLabel}>Incoming Goalie</p>
            <Field
              type="select"
              control={control}
              name="goalie_id"
              options={goalieOptions}
              required
              disabled={submitting}
            />
            <div className={styles.goalieSubRow}>
              <Field
                label="Entered in Period"
                type="select"
                control={control}
                name="entered_period"
                options={PERIOD_OPTIONS}
                required
                disabled={submitting}
              />
              <Field
                label="Entry Time"
                type="timepicker"
                mode="duration"
                control={control}
                name="entered_time"
                placeholder="MM:SS"
                disabled={submitting}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default GoalieSwitchModal;
