import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Control, FieldArrayWithId } from 'react-hook-form';
import { useForm, useFieldArray } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import { type GameRecord, type CurrentPeriod } from '@/hooks/useGames';
import { type GameRosterEntry } from '@/hooks/useGameRoster';
import { type GoalieStatRecord, type UpsertGoalieStatData } from '@/hooks/useGameGoalieStats';
import { type LineupEntry } from '@/hooks/useGameLineup';
import styles from './GameDetailsPage.module.scss';

export type ShotsNextAction =
  | { type: 'advance'; label: string; next: CurrentPeriod }
  | { type: 'end-game' };

type ShotsFormValues = {
  away_shots: string;
  home_shots: string;
  end_time: string;
  goalies: Array<{ shots_against: string }>;
};

const PERIOD_LABEL: Record<string, string> = {
  '1': '1st',
  '2': '2nd',
  '3': '3rd',
  OT: 'OT',
  SO: 'SO',
};

const PERIOD_TITLE_LABEL: Record<string, string> = {
  '1': '1st Period',
  '2': '2nd Period',
  '3': '3rd Period',
  OT: 'Overtime',
  SO: 'Shootout',
};

const fmt = (first: string | null, last: string | null) =>
  last ? `${first ? `${first.charAt(0)}. ` : ''}${last}` : '';

const isoToETHHMM = (iso: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = parts.find((p) => p.type === 'hour')?.value ?? '';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '';
  return h && m ? `${h}:${m}` : '';
};

const etHHMMtoISO = (hhmm: string): string => {
  const etDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
    new Date(),
  );
  const probe = new Date(`${etDate}T${hhmm}:00-05:00`);
  const tzName =
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })
      .formatToParts(probe)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'EST';
  const offset = tzName === 'EDT' ? '-04:00' : '-05:00';
  return new Date(`${etDate}T${hhmm}:00${offset}`).toISOString();
};

interface Props {
  open: boolean;
  period: string;
  nextAction: ShotsNextAction;
  showGoalies: boolean;
  showShootsFirst: boolean;
  game: GameRecord;
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  goalieStats: GoalieStatRecord[];
  lineup: LineupEntry[];
  onClose: () => void;
  updatePeriodShots: (period: string, home: number, away: number) => Promise<boolean | undefined>;
  upsertGoalieStat: (data: UpsertGoalieStatData) => Promise<void>;
  updateGameInfo: (data: {
    time_end?: string | null;
    shootout_first_team_id?: string | null;
  }) => Promise<boolean>;
  onAdvancePeriod: (next: CurrentPeriod) => void;
  onEndGameReady: () => void;
}

const RecordShotsModal = ({
  open,
  period,
  nextAction,
  showGoalies,
  showShootsFirst,
  game,
  awayRoster,
  homeRoster,
  goalieStats,
  lineup,
  onClose,
  updatePeriodShots,
  upsertGoalieStat,
  updateGameInfo,
  onAdvancePeriod,
  onEndGameReady,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [soFirstTeam, setSoFirstTeam] = useState<'away' | 'home' | null>('home');

  const allRosterGoalies = [...awayRoster, ...homeRoster].filter((e) => e.position === 'G');
  const lineupGoalieIds = new Set(
    lineup.filter((l) => l.position_slot === 'G').map((l) => l.player_id),
  );
  const hasSubstitution = goalieStats.some((gs) => gs.entered_period !== null);
  const hasLineupStarters = allRosterGoalies.some((e) => lineupGoalieIds.has(e.player_id));

  const goalieRosterList = showGoalies
    ? hasLineupStarters
      ? allRosterGoalies.filter(
          (e) =>
            lineupGoalieIds.has(e.player_id) ||
            (hasSubstitution && goalieStats.some((gs) => gs.goalie_id === e.player_id)),
        )
      : allRosterGoalies
    : [];

  const { control, reset, getValues, watch } = useForm<ShotsFormValues>({
    defaultValues: { away_shots: '', home_shots: '', end_time: '', goalies: [] },
  });
  const { fields: goalieFields } = useFieldArray({ control, name: 'goalies' });

  useEffect(() => {
    if (open) {
      const existing = game.period_shots.find((ps) => ps.period === period);
      reset({
        away_shots: existing ? String(existing.away_shots) : '',
        home_shots: existing ? String(existing.home_shots) : '',
        end_time: isEndGame && game.time_end ? isoToETHHMM(game.time_end) : '',
        goalies: goalieRosterList.map((g) => {
          const stat = goalieStats.find((gs) => gs.goalie_id === g.player_id);
          return { shots_against: stat ? String(stat.shots_against) : '' };
        }),
      });
      setSoFirstTeam('home');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const goalieFormValues = watch('goalies');
  const endTimeValue = watch('end_time');
  const isEndGame = nextAction.type === 'end-game';

  const goalieStatsValid =
    !showGoalies ||
    goalieRosterList.length === 0 ||
    (goalieRosterList.some(
      (g, i) => g.team_id === game.away_team.id && goalieFormValues[i]?.shots_against !== '',
    ) &&
      goalieRosterList.some(
        (g, i) => g.team_id === game.home_team.id && goalieFormValues[i]?.shots_against !== '',
      ));

  const endTimeValid = !isEndGame || !!endTimeValue;
  const shootsFirstValid = !showShootsFirst || !!soFirstTeam;

  const modalTitle = showShootsFirst
    ? 'Go To Shootout'
    : isEndGame
      ? `End Game — ${PERIOD_TITLE_LABEL[period] ?? period}`
      : `Record Shots — ${PERIOD_LABEL[period] ?? period} Period`;
  const confirmLabel = submitting
    ? 'Saving…'
    : isEndGame
      ? 'Award Three Stars'
      : nextAction.type === 'advance'
        ? nextAction.label
        : 'Confirm';

  const handleConfirm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const { away_shots, home_shots, end_time, goalies: goalieVals } = getValues();
    const isSOEndGame = period === 'SO' && isEndGame;
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
    if (showGoalies) {
      for (let i = 0; i < goalieRosterList.length; i++) {
        const goalie = goalieRosterList[i];
        const row = goalieVals[i];
        if (!row || !goalie) continue;
        const shots = parseInt(row.shots_against, 10);
        if (!isNaN(shots)) {
          await upsertGoalieStat({
            goalie_id: goalie.player_id,
            team_id: goalie.team_id,
            shots_against: shots,
          });
        }
      }
    }
    if (isEndGame && end_time) await updateGameInfo({ time_end: etHHMMtoISO(end_time) });
    if (showShootsFirst && soFirstTeam) {
      const firstTeamId = soFirstTeam === 'away' ? game.away_team.id : game.home_team.id;
      await updateGameInfo({ shootout_first_team_id: firstTeamId });
    }
    setSubmitting(false);
    onClose();
    if (nextAction.type === 'advance') {
      onAdvancePeriod(nextAction.next);
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
      confirmDisabled={submitting || !goalieStatsValid || !endTimeValid || !shootsFirstValid}
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
          goalieFields={goalieFields}
          goalieRosterList={goalieRosterList}
          lineup={lineup}
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
  goalieFields: FieldArrayWithId<ShotsFormValues, 'goalies'>[];
  goalieRosterList: GameRosterEntry[];
  lineup: LineupEntry[];
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
  goalieFields,
  goalieRosterList,
  lineup,
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

  const renderTeamLogo = (
    logo: string | null,
    code: string,
    primary: string,
    text: string,
    cls: string,
    placeholder: string,
  ) =>
    logo ? (
      <img
        src={logo}
        alt={code}
        className={cls}
      />
    ) : (
      <span
        className={placeholder}
        style={{ background: primary, color: text }}
      >
        {code?.slice(0, 1)}
      </span>
    );

  return (
    <div className={styles.shotsModalBody}>
      {isEndGame && (
        <Field
          label="End Time"
          required
          type="timepicker"
          control={control}
          name="end_time"
          disabled={submitting}
          autoFocus
        />
      )}
      {!(isEndGame && period === 'SO') && (
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
                {renderTeamLogo(
                  row.logo,
                  row.code,
                  row.primaryColor,
                  row.textColor,
                  styles.shotsTeamLogo,
                  styles.shotsTeamLogoPlaceholder,
                )}
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
                  autoFocus={!isEndGame && rowIdx === 0}
                />
              </div>
            </div>
          ))}
        </>
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
                    {renderTeamLogo(
                      logo,
                      code,
                      primary,
                      text,
                      styles.teamSegmentLogo,
                      styles.teamSegmentLogoPlaceholder,
                    )}
                    {code}
                  </>
                ),
              };
            })}
            disabled={submitting}
          />
        </>
      )}
      {goalieFields.length > 0 && (
        <>
          <hr className={styles.lineupDivider} />
          <div className={styles.shotsGoalieHeader}>
            <span className={styles.goalFormLabel}>Goalie Stats</span>
            <div className={styles.shotsGoalieInputs}>
              <span className={styles.shotsGoalieColLabel}>SA</span>
            </div>
          </div>
          {goalieFields.map((field, i) => {
            const goalie = goalieRosterList[i];
            if (!goalie) return null;
            const isAway = goalie.team_id === game.away_team.id;
            const logo = isAway ? game.away_team.logo : game.home_team.logo;
            const code = isAway ? game.away_team.code : game.home_team.code;
            const primary = isAway ? game.away_team.primary_color : game.home_team.primary_color;
            const text = isAway ? game.away_team.text_color : game.home_team.text_color;
            const isStarter = lineup.some(
              (e) => e.player_id === goalie.player_id && e.position_slot === 'G',
            );
            return (
              <div
                key={field.id}
                className={[styles.shotsGoalieRow, isStarter ? styles.shotsGoalieRowStarter : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className={styles.goalieNameCell}>
                  {renderTeamLogo(
                    logo,
                    code,
                    primary,
                    text,
                    styles.goalTeamLogo,
                    styles.goalTeamLogoPlaceholder,
                  )}
                  {goalie.photo ? (
                    <img
                      src={goalie.photo}
                      alt=""
                      className={styles.goalScorerPhoto}
                    />
                  ) : (
                    <span
                      className={styles.goalScorerPhotoPlaceholder}
                      style={{ background: primary, color: text }}
                    >
                      {goalie.last_name?.charAt(0)}
                    </span>
                  )}
                  <div className={styles.goalInfo}>
                    {goalie.jersey_number != null && (
                      <span className={styles.goalAssists}>#{goalie.jersey_number}</span>
                    )}
                    <span className={styles.goalScorer}>
                      {fmt(goalie.first_name, goalie.last_name)}
                    </span>
                  </div>
                </span>
                <div className={styles.shotsGoalieInputs}>
                  <Field
                    type="number"
                    control={control}
                    name={`goalies.${i}.shots_against`}
                    placeholder="0"
                    min={0}
                    disabled={submitting}
                    transform={(v) => v.replace(/[^0-9]/g, '')}
                  />
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default RecordShotsModal;
