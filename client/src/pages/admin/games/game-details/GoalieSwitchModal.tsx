import { useState, useEffect } from 'react';
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
  goalie_id: string;
  entered_period: string;
  sub_time: string;
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
    defaultValues: { team_side: 'away', goalie_id: '', entered_period: '2', sub_time: '' },
  });

  const teamSide = watch('team_side');

  // Goalies on the selected team who don't already have a stat entry (so we
  // can't switch to a goalie who is already in the stats list as a starter).
  const teamId = teamSide === 'away' ? game.away_team.id : game.home_team.id;
  const roster = teamSide === 'away' ? awayRoster : homeRoster;
  const goalieOptions = roster
    .filter((e) => e.position === 'G' && !existingStats.some((s) => s.goalie_id === e.player_id))
    .map((e) => ({
      value: e.player_id,
      label: `${e.first_name} ${e.last_name}${e.jersey_number != null ? ` (#${e.jersey_number})` : ''}`,
    }));

  useEffect(() => {
    if (open) reset({ team_side: 'away', goalie_id: '', entered_period: '2', sub_time: '' });
  }, [open, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!values.goalie_id || !values.entered_period) return;
    setSubmitting(true);
    await switchGoalie({
      goalie_id: values.goalie_id,
      team_id: teamId,
      entered_period: values.entered_period,
      sub_time: values.sub_time || null,
    });
    setSubmitting(false);
    onClose();
  };

  const teamOptions = [
    {
      value: 'away',
      label: `${game.away_team.code} (Away)`,
    },
    {
      value: 'home',
      label: `${game.home_team.code} (Home)`,
    },
  ];

  return (
    <Modal
      open={open}
      title="Switch Goalie"
      onClose={onClose}
      confirmLabel={submitting ? 'Saving…' : 'Record Switch'}
      onConfirm={handleSubmit(onSubmit)}
      confirmDisabled={submitting || goalieOptions.length === 0}
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
        {goalieOptions.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            No eligible backup goalies on the roster for this team.
          </p>
        ) : (
          <>
            <Field
              label="Incoming Goalie"
              type="select"
              control={control}
              name="goalie_id"
              options={goalieOptions}
              required
              disabled={submitting}
            />
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
              label="Time of Sub"
              type="timepicker"
              mode="duration"
              control={control}
              name="sub_time"
              placeholder="MM:SS"
              disabled={submitting}
            />
          </>
        )}
      </div>
    </Modal>
  );
};

export default GoalieSwitchModal;
