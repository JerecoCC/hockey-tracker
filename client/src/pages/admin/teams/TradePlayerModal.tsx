import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import useTeams from '@/hooks/useTeams';
import {
  usePlayerTradeHistory,
  type PlayerStintRecord,
  type TeamPlayerRecord,
} from '@/hooks/useTeamPlayers';
import styles from './TradePlayerModal.module.scss';

interface FormValues {
  to_team_id: string | null;
  trade_date: string;
  jersey_number: string;
}

interface Props {
  open: boolean;
  player: TeamPlayerRecord | null;
  currentTeamId: string;
  seasonId: string;
  leagueId: string;
  onClose: () => void;
  tradePlayer: (
    playerId: string,
    seasonId: string,
    toTeamId: string,
    tradeDate: string,
    jerseyNumber?: number | null,
  ) => Promise<boolean>;
}

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const TradePlayerModal = ({
  open,
  player,
  currentTeamId,
  seasonId,
  leagueId,
  onClose,
  tradePlayer,
}: Props) => {
  const { teams } = useTeams();

  // Teams in same league excluding the current team
  const teamOptions = teams
    .filter((t) => t.league_id === leagueId && t.id !== currentTeamId)
    .map((t) => ({ value: t.id, label: t.name }));

  const { stints } = usePlayerTradeHistory(player?.id ?? null, seasonId);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { to_team_id: null, trade_date: today(), jersey_number: '' },
  });

  useEffect(() => {
    if (open) reset({ to_team_id: null, trade_date: today(), jersey_number: '' });
  }, [open, reset]);

  const onSubmit = handleSubmit(async (data) => {
    if (!player || !data.to_team_id) return;
    const jerseyNumber = data.jersey_number ? Number(data.jersey_number) : null;
    const ok = await tradePlayer(player.id, seasonId, data.to_team_id, data.trade_date, jerseyNumber);
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title={player ? `Trade ${player.first_name} ${player.last_name}` : 'Trade Player'}
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Trading…' : 'Execute Trade'}
      confirmIcon="swap_horiz"
      confirmForm="trade-player-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
    >
      <div className={styles.layout}>
        <form id="trade-player-form" className={styles.form} onSubmit={onSubmit}>
          <Field
            type="select"
            label="Trade To"
            required
            control={control}
            name="to_team_id"
            options={teamOptions}
            placeholder="Select destination team…"
            searchable
            rules={{ required: true }}
            disabled={isSubmitting}
          />
          <div className={styles.row}>
            <Field
              type="datepicker"
              label="Trade Date"
              control={control}
              name="trade_date"
              disabled={isSubmitting}
            />
            <Field
              type="number"
              label="Jersey # (new team)"
              control={control}
              name="jersey_number"
              placeholder="e.g. 97"
              min={0}
              max={99}
              disabled={isSubmitting}
            />
          </div>
        </form>

        {stints.length > 0 && (
          <div className={styles.history}>
            <h4 className={styles.historyTitle}>Trade History This Season</h4>
            <ul className={styles.stintList}>
              {stints.map((s: PlayerStintRecord) => (
                <li key={s.id} className={styles.stintItem}>
                  {s.team_logo && (
                    <img src={s.team_logo} alt={s.team_name ?? ''} className={styles.stintLogo} />
                  )}
                  <div className={styles.stintInfo}>
                    <span className={styles.stintTeam}>{s.team_name ?? 'Unknown Team'}</span>
                    {s.jersey_number != null && (
                      <span className={styles.stintJersey}>#{s.jersey_number}</span>
                    )}
                  </div>
                  <span className={styles.stintDates}>
                    {formatDate(s.start_date)} → {s.end_date ? formatDate(s.end_date) : 'Present'}
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

export default TradePlayerModal;
