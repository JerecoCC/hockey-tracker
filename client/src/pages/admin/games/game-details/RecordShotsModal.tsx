import {
  useState,
  useEffect,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import type { Control } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import { type GameRecord, type CurrentPeriod } from '@/hooks/useGames';
import { type GameRosterEntry } from '@/hooks/useGameRoster';
import { type GoalieStatRecord } from '@/hooks/useGameGoalieStats';
import { type GoalRecord } from '@/hooks/useGameGoals';
import styles from './GameDetailsPage.module.scss';
import { PERIOD, PERIOD_ORDER, PERIOD_TITLE_LABEL } from './constants';
import { etHHMMtoISO, isoToETDate, isoToETHHMM, nextETDate } from './formatUtils';

export type ShotsNextAction =
  | { type: 'advance'; label: string; next: CurrentPeriod }
  | { type: 'next-ot' }
  | { type: 'end-game' };

type ShotsFormValues = {
  away_shots: string;
  home_shots: string;
  end_time: string;
};

const PERIOD_LABEL: Record<string, string> = {
  [PERIOD.FIRST]: '1st',
  [PERIOD.SECOND]: '2nd',
  [PERIOD.THIRD]: '3rd',
  [PERIOD.OVERTIME]: PERIOD.OVERTIME,
  [PERIOD.SHOOTOUT]: PERIOD.SHOOTOUT,
};

const periodIdx = (p: string) => PERIOD_ORDER.indexOf(p);

/**
 * Computes the expected shots-against for a goalie in a game:
 * opposing team's total shots (for the periods the goalie played) minus empty-net goals.
 *
 * Phase 2+: when the GoalieStatRecord has a `stints` array we walk each
 * stint's window to determine which periods were covered, correctly handling
 * pull-and-return scenarios.  A period P is considered "played" by a stint
 * when: entered_period_ord ≤ p_ord AND (exited_period_ord > p_ord OR no exit).
 * Note: if a goalie exited in P (same ordinal as P), P is not counted for them
 * automatically — both goalies partially played it and the admin adjusts SA.
 *
 * Legacy fallback (no stints): uses entered_period aggregation as before.
 */
export const computeAutoSA = (
  goalie: GameRosterEntry,
  goalieStats: GoalieStatRecord[],
  game: GameRecord,
  periodShots: { period: string; home_shots: number; away_shots: number }[],
  goals: GoalRecord[],
): string => {
  const isAway = goalie.team_id === game.away_team.id;
  const opposingTeamId = isAway ? game.home_team.id : game.away_team.id;

  const thisStat = goalieStats.find((gs) => gs.goalie_id === goalie.player_id);
  const stints = thisStat?.stints;

  let playedPeriod: (p: string) => boolean;

  if (stints && stints.length > 0) {
    // Phase 2+: derive from stint windows
    playedPeriod = (p: string) => {
      const pOrd = periodIdx(p);
      return stints.some((st) => {
        const enterOrd = periodIdx(st.entered_period);
        const exitOrd = st.exited_period != null ? periodIdx(st.exited_period) : Infinity;
        return pOrd >= enterOrd && pOrd < exitOrd;
      });
    };
  } else {
    // Legacy fallback: single entered_period on the aggregate record
    const enteredPeriod = thisStat?.entered_period ?? null;
    const subStat = goalieStats.find(
      (gs) =>
        gs.team_id === goalie.team_id &&
        gs.goalie_id !== goalie.player_id &&
        gs.entered_period !== null,
    );
    playedPeriod = (p: string) => {
      if (enteredPeriod !== null) return periodIdx(p) >= periodIdx(enteredPeriod);
      if (subStat) return periodIdx(p) < periodIdx(subStat.entered_period!);
      return true;
    };
  }

  const totalOpposingShots = periodShots
    .filter((ps) => playedPeriod(ps.period))
    .reduce((sum, ps) => sum + (isAway ? ps.home_shots : ps.away_shots), 0);

  const emptyNetGoals = goals.filter(
    (g) => g.team_id === opposingTeamId && g.empty_net && playedPeriod(g.period),
  ).length;

  return String(Math.max(0, totalOpposingShots - emptyNetGoals));
};

interface Props {
  open: boolean;
  period: string;
  nextAction: ShotsNextAction;
  showShootsFirst: boolean;
  game: GameRecord;
  onClose: () => void;
  updatePeriodShots: (period: string, home: number, away: number) => Promise<boolean | undefined>;
  updateGameInfo: (data: {
    time_end?: string | null;
    shootout_first_team_id?: string | null;
  }) => Promise<boolean>;
  onAdvancePeriod: (next: CurrentPeriod) => void;
  onNextOTPeriod: () => void;
  onEndGameReady: () => void;
}

const RecordShotsModal = ({
  open,
  period,
  nextAction,
  showShootsFirst,
  game,
  onClose,
  updatePeriodShots,
  updateGameInfo,
  onAdvancePeriod,
  onNextOTPeriod,
  onEndGameReady,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [soFirstTeam, setSoFirstTeam] = useState<'away' | 'home' | null>('home');

  const {
    control,
    reset,
    getValues,
    watch,
    formState: { isValid },
  } = useForm<ShotsFormValues>({
    defaultValues: { away_shots: '', home_shots: '', end_time: '' },
    mode: 'onChange',
  });

  useEffect(() => {
    if (open) {
      const existing = game.period_shots.find((ps) => ps.period === period);
      reset({
        away_shots: existing ? String(existing.away_shots) : '',
        home_shots: existing ? String(existing.home_shots) : '',
        end_time: isEndGame && game.time_end ? isoToETHHMM(game.time_end) : '',
      });
      setSoFirstTeam('home');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const endTimeValue = watch('end_time');
  const isEndGame = nextAction.type === 'end-game';

  const endTimeValid = !isEndGame || !!endTimeValue;
  const shootsFirstValid = !showShootsFirst || !!soFirstTeam;

  const isNextOT = nextAction.type === 'next-ot';
  // "OT1", "OT2", etc. → "Overtime 1", "Overtime 2", etc.
  const otNumMatch = /^OT([0-9]+)$/.exec(period);
  const periodTitleLabel = otNumMatch
    ? `Overtime ${otNumMatch[1]}`
    : (PERIOD_TITLE_LABEL[period] ?? period);
  const modalTitle = showShootsFirst
    ? 'Go To Shootout'
    : isEndGame
      ? `End Game — ${periodTitleLabel}`
      : isNextOT
        ? `Record Shots — ${periodTitleLabel}`
        : `Record Shots — ${PERIOD_LABEL[period] ?? period} Period`;
  const confirmLabel = submitting
    ? 'Saving…'
    : isEndGame
      ? 'Award Three Stars'
      : nextAction.type === 'advance'
        ? nextAction.label
        : isNextOT
          ? 'Next Overtime'
          : 'Confirm';

  const handleConfirm = async (e?: FormEvent) => {
    e?.preventDefault();
    const { away_shots, home_shots, end_time } = getValues();
    const isSOEndGame = period === PERIOD.SHOOTOUT && isEndGame;
    setSubmitting(true);
    if (!isSOEndGame) {
      const away = parseInt(away_shots || '0', 10);
      const home = parseInt(home_shots || '0', 10);
      const ok = await updatePeriodShots(period, home, away);
      if (!ok) {
        setSubmitting(false);
        return;
      }
    }
    if (isEndGame && end_time) {
      // Anchor to the game's actual start date in ET (falling back to scheduled date).
      // If the end time HH:mm is earlier than the start HH:mm the game ran past midnight —
      // use the next ET calendar day, mirroring the logic in GameInfoEditModal.
      const anchor = game.time_start ?? game.scheduled_at;
      const etBase = anchor ? isoToETDate(anchor) : undefined;
      const startHHMM = game.time_start ? isoToETHHMM(game.time_start) : null;
      const isPastMidnight = !!startHHMM && end_time < startHHMM;
      const endDate = isPastMidnight && etBase ? nextETDate(etBase) : etBase;
      await updateGameInfo({ time_end: etHHMMtoISO(end_time, endDate) });
    }
    if (showShootsFirst && soFirstTeam) {
      const firstTeamId = soFirstTeam === 'away' ? game.away_team.id : game.home_team.id;
      await updateGameInfo({ shootout_first_team_id: firstTeamId });
    }
    setSubmitting(false);
    onClose();
    if (nextAction.type === 'advance') {
      onAdvancePeriod(nextAction.next);
    } else if (nextAction.type === 'next-ot') {
      onNextOTPeriod();
    } else {
      onEndGameReady();
    }
  };

  return (
    <Modal
      open={open}
      title={modalTitle}
      onClose={onClose}
      confirmLabel={confirmLabel}
      confirmIcon={isEndGame ? 'star' : 'flag'}
      confirmForm="record-shots-form"
      confirmDisabled={submitting || !isValid || !endTimeValid || !shootsFirstValid}
      busy={submitting}
    >
      <form
        id="record-shots-form"
        onSubmit={handleConfirm}
      >
        <RecordShotsBody
          isEndGame={isEndGame}
          period={period}
          game={game}
          control={control}
          showShootsFirst={showShootsFirst}
          soFirstTeam={soFirstTeam}
          setSoFirstTeam={setSoFirstTeam}
          submitting={submitting}
        />
      </form>
    </Modal>
  );
};

interface BodyProps {
  isEndGame: boolean;
  period: string;
  game: GameRecord;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<ShotsFormValues, any>;
  showShootsFirst: boolean;
  soFirstTeam: 'away' | 'home' | null;
  setSoFirstTeam: Dispatch<SetStateAction<'away' | 'home' | null>>;
  submitting: boolean;
}

const RecordShotsBody = ({
  isEndGame,
  period,
  game,
  control,
  showShootsFirst,
  soFirstTeam,
  setSoFirstTeam,
  submitting,
}: BodyProps) => {
  const teamRows = [
    {
      key: 'away',
      logo: game.away_team.logo,
      code: game.away_team.code,
      name: game.away_team.name,
      primaryColor: game.away_team.primary_color,
      textColor: game.away_team.text_color,
      fieldName: 'away_shots' as const,
    },
    {
      key: 'home',
      logo: game.home_team.logo,
      code: game.home_team.code,
      name: game.home_team.name,
      primaryColor: game.home_team.primary_color,
      textColor: game.home_team.text_color,
      fieldName: 'home_shots' as const,
    },
  ];

  return (
    <div className={styles.shotsModalBody}>
      {!(isEndGame && period === PERIOD.SHOOTOUT) && (
        <>
          <hr className={styles.lineupDivider} />
          <div className={styles.shotsGoalieHeader}>
            <span className={styles.goalFormLabel}>Period Shots</span>
            <span className={styles.shotsSectionColLabel}>SOG</span>
          </div>
          {teamRows.map((row, rowIdx) => (
            <div
              key={row.key}
              className={styles.shotsTeamRow}
            >
              <span className={styles.shotsTeamInfo}>
                <TeamLogo
                  logo={row.logo}
                  code={row.code}
                  primaryColor={row.primaryColor}
                  textColor={row.textColor}
                  size={28}
                  shape={row.logo ? 'square' : 'circle'}
                />
                <span className={styles.shotsTeamName}>{row.name}</span>
              </span>
              <div className={styles.shotsFieldWrap}>
                <Field
                  type="number"
                  control={control}
                  name={row.fieldName}
                  placeholder="0"
                  min={0}
                  disabled={submitting}
                  transform={(v) => v.replace(/[^0-9]/g, '')}
                  autoFocus={rowIdx === 0}
                />
              </div>
            </div>
          ))}
        </>
      )}
      {isEndGame && (
        <Field
          label="End Time"
          required
          type="timepicker"
          control={control}
          name="end_time"
          disabled={submitting}
          rules={{ required: 'End time is required' }}
        />
      )}
      {showShootsFirst && (
        <>
          <hr className={styles.lineupDivider} />
          <span className={styles.goalFormLabel}>Who Shoots First</span>
          <SegmentedControl
            value={soFirstTeam ?? ''}
            onChange={(v) => setSoFirstTeam(v as 'away' | 'home')}
            options={(['away', 'home'] as const).map((side) => {
              const logo = side === 'away' ? game.away_team.logo : game.home_team.logo;
              const code = side === 'away' ? game.away_team.code : game.home_team.code;
              const primary =
                side === 'away' ? game.away_team.primary_color : game.home_team.primary_color;
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
            })}
            disabled={submitting}
          />
        </>
      )}
    </div>
  );
};

export default RecordShotsModal;
