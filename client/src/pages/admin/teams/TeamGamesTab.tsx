import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Button from '@/components/Button/Button';
import MonthCalendar from '@/components/MonthCalendar/MonthCalendar';
import PeriodPicker from '@/components/PeriodPicker/PeriodPicker';
import Section from '@/components/Section/Section';
import { ScheduleGamesTitle } from '@/components/ScheduleGamesLayout/ScheduleGamesLayout';
import TeamCalendarGameCard from '@/components/TeamCalendarGameCard/TeamCalendarGameCard';
import useGames, { type GameRecord, type GameStatus } from '@/hooks/useGames';
import { downloadMonthScheduleImage } from '@/lib/monthScheduleImage';
import { buildGameDetailsPath } from '@/lib/routeSlugs';
import styles from './TeamGamesTab.module.scss';

const MONTH_LABEL_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

const formatTime = (hhmm: string, scheduledAt?: string | null): string => {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return hhmm;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const base = scheduledAt ? new Date(scheduledAt) : new Date();
  const etDatePart = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
    base,
  );
  const abbr =
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })
      .formatToParts(new Date(`${etDatePart}T12:00:00`))
      .find((p) => p.type === 'timeZoneName')?.value ?? 'ET';
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'} ${abbr}`;
};

const STATUS_LABEL: Record<GameStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'Live',
  final: 'Final',
  postponed: 'Postponed',
};

const toLocalDateKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const toMonthPickerValue = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const fromMonthPickerValue = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1);
};

const displayScore = (game: GameRecord) => {
  return {
    away: game.away_score,
    home: game.home_score,
    winnerTeamId: game.winner_team_id ?? null,
  };
};

const formatWinnerFirstScore = (away: number, home: number) =>
  `${Math.max(away, home)}-${Math.min(away, home)}`;

type CalendarDayStyle = CSSProperties & {
  '--team-calendar-day-accent'?: string;
  '--team-calendar-day-text'?: string;
  '--team-calendar-card-text'?: string;
};

const getTeamCalendarDayStyle = (game: GameRecord, teamId: string): CalendarDayStyle => {
  const isHomeGame = game.home_team.id === teamId;
  const homeTextColor = game.home_team.text_color || '#ffffff';
  const dayAccent = isHomeGame
    ? game.home_team.primary_color || '#334155'
    : 'var(--team-calendar-away-day-accent, #ffffff)';

  return {
    '--team-calendar-day-accent': dayAccent,
    '--team-calendar-day-text': isHomeGame
      ? homeTextColor
      : 'var(--team-calendar-away-day-text, #14181f)',
    ...(isHomeGame
      ? {
          '--team-calendar-card-text': `var(--team-calendar-home-card-text, ${homeTextColor})`,
        }
      : {}),
  };
};

const TeamCalendarGame = ({
  game,
  teamId,
  onOpen,
  dayNumber,
}: {
  game: GameRecord;
  teamId: string;
  onOpen: (game: GameRecord) => void;
  dayNumber?: number;
}) => {
  const isHomeGame = game.home_team.id === teamId;
  const team = isHomeGame ? game.home_team : game.away_team;
  const opponent = isHomeGame ? game.away_team : game.home_team;
  const logoAccentColor = isHomeGame ? team.text_color || '#ffffff' : '#ffffff';
  const { home, away, winnerTeamId } = displayScore(game);
  const teamGoals = isHomeGame ? home : away;
  const opponentGoals = isHomeGame ? away : home;
  const isOT =
    (game.overtime_periods ?? 0) > 0 || game.period_scores.some((ps) => ps.period === 'OT');
  const isSO = game.shootout || game.period_scores.some((ps) => ps.period === 'SO');
  const extraTimeLabel = isSO ? ' (SO)' : isOT ? ' (OT)' : '';
  const resultLabel =
    game.status === 'final' && winnerTeamId
      ? winnerTeamId === teamId
        ? 'W'
        : 'L'
      : teamGoals > opponentGoals
        ? 'W'
        : teamGoals < opponentGoals
          ? 'L'
          : 'T';

  const detail =
    game.status === 'final'
      ? `${resultLabel} ${formatWinnerFirstScore(away, home)}${extraTimeLabel}`
      : game.status === 'in_progress'
        ? `LIVE ${formatWinnerFirstScore(away, home)}`
        : game.status === 'scheduled'
          ? game.scheduled_time
            ? formatTime(game.scheduled_time, game.scheduled_at)
            : 'Scheduled'
          : STATUS_LABEL[game.status];

  return (
    <TeamCalendarGameCard
      variant={isHomeGame ? 'home' : 'away'}
      opponent={{
        name: opponent.name,
        code: opponent.code,
        logo: opponent.logo,
        logoDark: opponent.logo_dark,
        logoLight: opponent.logo_light,
        primaryColor: opponent.primary_color,
        textColor: opponent.text_color,
      }}
      detail={detail}
      topLabel={dayNumber}
      homePrimaryColor={team.primary_color}
      logoAccentColor={logoAccentColor}
      live={game.status === 'in_progress'}
      fillContainer
      flush
      transparentBackground
      ariaLabel={`Open game ${isHomeGame ? 'vs' : 'at'} ${opponent.name}`}
      onOpen={() => onOpen(game)}
    />
  );
};

interface Props {
  teamId: string;
  teamName: string;
  leagueId: string;
  leagueCode?: string | null;
  calendarMonth?: Date;
  onCalendarMonthChange?: (month: Date) => void;
}

const TeamGamesTab = ({
  teamId,
  teamName,
  leagueId,
  leagueCode,
  calendarMonth: controlledCalendarMonth,
  onCalendarMonthChange,
}: Props) => {
  const navigate = useNavigate();
  const [exportingMonthImage, setExportingMonthImage] = useState(false);
  const [internalCalendarMonth, setInternalCalendarMonth] = useState<Date>(() =>
    monthStart(new Date()),
  );
  const calendarGridRef = useRef<HTMLDivElement>(null);

  const normalizedControlledCalendarMonth = useMemo(
    () => (controlledCalendarMonth ? monthStart(controlledCalendarMonth) : null),
    [controlledCalendarMonth],
  );
  const calendarMonth = normalizedControlledCalendarMonth ?? internalCalendarMonth;
  const setCalendarMonth = (next: Date | ((current: Date) => Date)) => {
    const nextMonth = monthStart(typeof next === 'function' ? next(calendarMonth) : next);
    if (onCalendarMonthChange) {
      onCalendarMonthChange(nextMonth);
    } else {
      setInternalCalendarMonth(nextMonth);
    }
  };

  const { games, loading } = useGames({
    teamId,
    month: toMonthPickerValue(calendarMonth),
  });

  const scheduledGames = useMemo(() => games.filter((game) => !!game.scheduled_at), [games]);

  const gamesByDate = useMemo(() => {
    const map = new Map<string, GameRecord>();
    scheduledGames.forEach((game) => {
      const key = toLocalDateKey(game.scheduled_at!);
      if (!map.has(key)) {
        map.set(key, game);
      }
    });
    return map;
  }, [scheduledGames]);

  const openGame = (game: GameRecord) =>
    navigate(
      buildGameDetailsPath({
        leagueCode: game.league_code ?? leagueCode,
        leagueId,
        seasonName: game.season_name,
        seasonId: game.season_id,
        gameId: game.id,
        awayTeamCode: game.away_team.code,
        homeTeamCode: game.home_team.code,
        scheduledAt: game.scheduled_at,
      }),
    );
  const changeCalendarMonth = (value: string) => {
    if (!value) return;
    setCalendarMonth(fromMonthPickerValue(value));
  };
  const handleDownloadMonthImage = async () => {
    const calendarNode = calendarGridRef.current;
    if (exportingMonthImage || scheduledGames.length === 0 || !calendarNode) return;
    const renderedCalendarWidth = Math.ceil(
      Math.max(calendarNode.getBoundingClientRect().width, calendarNode.scrollWidth),
    );
    setExportingMonthImage(true);
    try {
      await downloadMonthScheduleImage({
        calendarNode,
        calendarMonth,
        headerLabel: MONTH_LABEL_FMT.format(calendarMonth),
        exportWidth: renderedCalendarWidth || undefined,
        filename: `${teamName} Game Schedule - ${new Intl.DateTimeFormat('en-US', {
          month: 'short',
          year: 'numeric',
        }).format(calendarMonth)}.png`,
      });
      toast.success('Monthly schedule downloaded!');
    } catch {
      toast.error('Failed to generate schedule image');
    } finally {
      setExportingMonthImage(false);
    }
  };

  return (
    <Section
      title={
        <ScheduleGamesTitle
          picker={
            <PeriodPicker
              kind="month"
              value={toMonthPickerValue(calendarMonth)}
              label={MONTH_LABEL_FMT.format(calendarMonth)}
              onChange={changeCalendarMonth}
              onPrevious={() => setCalendarMonth((current) => addMonths(current, -1))}
              onNext={() => setCalendarMonth((current) => addMonths(current, 1))}
            />
          }
        />
      }
      action={
        <Button
          type="button"
          variant="outlined"
          intent="neutral"
          size="sm"
          icon="download"
          iconHeight="field"
          aria-label="Download monthly schedule"
          tooltip="Download monthly schedule"
          className={styles.calendarExportButton}
          onClick={() => void handleDownloadMonthImage()}
          disabled={exportingMonthImage || scheduledGames.length === 0}
        />
      }
    >
      <div className={styles.calendarWrap}>
        <div className={styles.calendarScroll}>
          <MonthCalendar
            ref={calendarGridRef}
            month={calendarMonth}
            loading={loading}
            dayBodyClassName={styles.calendarDayBody}
            getDayClassName={({ dateKey }) =>
              gamesByDate.has(dateKey) ? styles.calendarDayGameCell : undefined
            }
            getDayProps={({ dateKey }) => {
              const dayGame = gamesByDate.get(dateKey);
              if (!dayGame) return {};
              return { style: getTeamCalendarDayStyle(dayGame, teamId) };
            }}
            renderDayContent={({ dateKey }) => {
              const dayGame = gamesByDate.get(dateKey);
              return dayGame ? (
                <div className={styles.calendarDayGamesFilled}>
                  <TeamCalendarGame
                    key={dayGame.id}
                    game={dayGame}
                    teamId={teamId}
                    onOpen={openGame}
                  />
                </div>
              ) : null;
            }}
          />
        </div>
      </div>
    </Section>
  );
};

export default TeamGamesTab;
