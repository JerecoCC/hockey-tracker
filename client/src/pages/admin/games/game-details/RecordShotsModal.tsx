import {
  useState,
  useEffect,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import type { Control } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import SegmentedControl from '@jerecocc/tracker-ui/components/SegmentedControl/SegmentedControl';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import { type GameRecord, type CurrentPeriod } from '@/hooks/useGames';
import {
  type GoalieStatRecord,
  type UpdateGoalieStintData,
} from '@/hooks/useGameGoalieStats';
import fieldStyles from '@/shared/trackerFieldStyles.module.scss';
import styles from './GameDetailsPage.module.scss';
import { PERIOD, PERIOD_TITLE_LABEL } from './constants';
import { etHHMMtoISO, isoToETDate, isoToETHHMM, nextETDate } from './formatUtils';
import { defaultStintToi, parseToiInput, secondsToMMSS } from './goalieTimeOnIce';

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

interface Props {
  open: boolean;
  period: string;
  nextAction: ShotsNextAction;
  showShootsFirst: boolean;
  game: GameRecord;
  goalieStats: GoalieStatRecord[];
  onClose: () => void;
  updatePeriodShots: (period: string, home: number, away: number) => Promise<boolean | undefined>;
  updateGameInfo: (data: {
    time_end?: string | null;
    shootout_first_team_id?: string | null;
  }) => Promise<boolean>;
  updateGoalieStint: (
    stintId: string,
    data: UpdateGoalieStintData,
  ) => Promise<GoalieStatRecord[] | null>;
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
  goalieStats,
  onClose,
  updatePeriodShots,
  updateGameInfo,
  updateGoalieStint,
  onAdvancePeriod,
  onNextOTPeriod,
  onEndGameReady,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [soFirstTeam, setSoFirstTeam] = useState<'away' | 'home' | null>('home');
  // Per-stint time-on-ice inputs (MM:SS), keyed by stint id. Required to end a game.
  const [toiInputs, setToiInputs] = useState<Record<string, string>>({});
  const setToiField = (stintId: string, value: string) =>
    setToiInputs((prev) => ({ ...prev, [stintId]: value }));

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
      if (isEndGame) {
        const init: Record<string, string> = {};
        goalieStats.forEach((stat) =>
          stat.stints.forEach((st) => {
            init[st.id] = secondsToMMSS(
              st.time_on_ice != null ? st.time_on_ice : defaultStintToi(st, game),
            );
          }),
        );
        setToiInputs(init);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const endTimeValue = watch('end_time');
  const isEndGame = nextAction.type === 'end-game';

  const endTimeValid = !isEndGame || !!endTimeValue;
  const shootsFirstValid = !showShootsFirst || !!soFirstTeam;
  const toiValid =
    !isEndGame ||
    goalieStats.every((stat) =>
      stat.stints.every((st) => parseToiInput(toiInputs[st.id] ?? '') != null),
    );

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
    if (isEndGame) {
      // Persist each goalie stint's time on ice (only those the admin changed).
      for (const stat of goalieStats) {
        for (const st of stat.stints) {
          const sec = parseToiInput(toiInputs[st.id] ?? '');
          if (sec != null && sec !== st.time_on_ice) {
            await updateGoalieStint(st.id, { time_on_ice: sec });
          }
        }
      }
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
      confirmDisabled={submitting || !isValid || !endTimeValid || !shootsFirstValid || !toiValid}
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
          goalieStats={goalieStats}
          toiInputs={toiInputs}
          onToiChange={setToiField}
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
  goalieStats: GoalieStatRecord[];
  toiInputs: Record<string, string>;
  onToiChange: (stintId: string, value: string) => void;
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
  goalieStats,
  toiInputs,
  onToiChange,
}: BodyProps) => {
  const teamRows = [
    {
      key: 'away',
      logo: game.away_team.logo,
      logoDark: game.away_team.logo_dark,
      logoLight: game.away_team.logo_light,
      code: game.away_team.code,
      name: game.away_team.name,
      primaryColor: game.away_team.primary_color,
      textColor: game.away_team.text_color,
      fieldName: 'away_shots' as const,
    },
    {
      key: 'home',
      logo: game.home_team.logo,
      logoDark: game.home_team.logo_dark,
      logoLight: game.home_team.logo_light,
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
                  logoDark={row.logoDark}
                  logoLight={row.logoLight}
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
      {isEndGame && goalieStats.length > 0 && (
        <>
          <hr className={styles.lineupDivider} />
          <div className={styles.shotsGoalieHeader}>
            <span className={styles.goalFormLabel}>Time on Ice</span>
            <span className={styles.shotsSectionColLabel}>MM:SS</span>
          </div>
          {goalieStats.flatMap((stat) =>
            stat.stints.map((st, idx) => {
              const initial = stat.goalie_first_name?.charAt(0);
              const name = `${initial ? `${initial}. ` : ''}${stat.goalie_last_name}`;
              const invalid = parseToiInput(toiInputs[st.id] ?? '') == null;
              return (
                <div
                  key={st.id}
                  className={styles.shotsTeamRow}
                >
                  <span className={styles.shotsTeamInfo}>
                    <TeamLogo
                      logo={stat.team_logo}
                      logoDark={
                        stat.team_id === game.away_team.id
                          ? game.away_team.logo_dark
                          : stat.team_id === game.home_team.id
                            ? game.home_team.logo_dark
                            : undefined
                      }
                      logoLight={
                        stat.team_id === game.away_team.id
                          ? game.away_team.logo_light
                          : stat.team_id === game.home_team.id
                            ? game.home_team.logo_light
                            : undefined
                      }
                      code={stat.team_code}
                      primaryColor={stat.team_primary_color}
                      textColor={stat.team_text_color}
                      size={28}
                      shape={stat.team_logo ? 'square' : 'circle'}
                    />
                    <span className={styles.shotsTeamName}>
                      {name}
                      {stat.stints.length > 1 ? ` (stint ${idx + 1})` : ''}
                    </span>
                  </span>
                  <div className={styles.shotsFieldWrap}>
                    <input
                      className={fieldStyles.field}
                      type="text"
                      inputMode="numeric"
                      placeholder="MM:SS"
                      aria-label={`${name} time on ice`}
                      aria-invalid={invalid}
                      value={toiInputs[st.id] ?? ''}
                      disabled={submitting}
                      onChange={(e) => onToiChange(st.id, e.target.value)}
                    />
                  </div>
                </div>
              );
            }),
          )}
        </>
      )}
      {showShootsFirst && (
        <>
          <hr className={styles.lineupDivider} />
          <span className={styles.goalFormLabel}>Who Shoots First</span>
          <SegmentedControl
            value={soFirstTeam ?? ''}
            onChange={(v) => setSoFirstTeam(v as 'away' | 'home')}
            variant="field"
            options={(['away', 'home'] as const).map((side) => {
              const logo = side === 'away' ? game.away_team.logo : game.home_team.logo;
              const logoDark = side === 'away' ? game.away_team.logo_dark : game.home_team.logo_dark;
              const logoLight =
                side === 'away' ? game.away_team.logo_light : game.home_team.logo_light;
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
                      logoDark={logoDark}
                      logoLight={logoLight}
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
