import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Button from '@/components/Button/Button';
import Divider from '@/components/Divider/Divider';
import Icon from '@/components/Icon/Icon';
import MonthCalendar from '@/components/MonthCalendar/MonthCalendar';
import PeriodPicker from '@/components/PeriodPicker/PeriodPicker';
import Section from '@/components/Section/Section';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import SeasonSelect from '@/components/SeasonSelect/SeasonSelect';
import TeamCalendarGameCard from '@/components/TeamCalendarGameCard/TeamCalendarGameCard';
import useGames, { type GameRecord, type GameStatus } from '@/hooks/useGames';
import useSeasons from '@/hooks/useSeasons';
import GameFormModal, { type GameFormTeam } from '@/pages/admin/seasons/GameFormModal';
import GameListItem from '@/components/GameListItem';
import { buildGameDetailsPath } from '@/lib/routeSlugs';
import { downloadMonthScheduleImage } from '@/lib/monthScheduleImage';
import seasonStyles from '@/pages/admin/seasons/SeasonGamesTab.module.scss';
import styles from './TeamGamesTab.module.scss';

// ── Display helpers ───────────────────────────────────────────────────────────

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
const toDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const dateToISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromISODate = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const toMonthPickerValue = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const fromMonthPickerValue = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1);
};
const fmtDayHeading = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};
const SHORT_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const SHORT_FMT_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const fmtWeekRange = (start: Date, end: Date) => {
  if (start.getFullYear() === end.getFullYear()) {
    return `${SHORT_FMT.format(start)} - ${SHORT_FMT_YEAR.format(end)}`;
  }
  return `${SHORT_FMT_YEAR.format(start)} - ${SHORT_FMT_YEAR.format(end)}`;
};

const displayScore = (game: GameRecord) => {
  return {
    away: game.away_score,
    home: game.home_score,
    winnerTeamId: game.winner_team_id ?? null,
  };
};

const STATUS_INTENT: Record<GameStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  scheduled: 'info',
  in_progress: 'warning',
  final: 'success',
  postponed: 'warning',
};

const formatStatusLabel = (game: GameRecord): string => {
  if (game.status !== 'final') return STATUS_LABEL[game.status];
  if (game.shootout || game.period_scores.some((ps) => ps.period === 'SO')) return 'Final/SO';
  if ((game.overtime_periods ?? 0) > 0 || game.period_scores.some((ps) => ps.period === 'OT'))
    return 'Final/OT';
  return 'Final';
};

const sortGamesBySchedule = (games: GameRecord[]) =>
  [...games].sort((a, b) => {
    if (!a.scheduled_at && !b.scheduled_at) return 0;
    if (!a.scheduled_at) return 1;
    if (!b.scheduled_at) return -1;
    if (a.scheduled_at !== b.scheduled_at) return a.scheduled_at < b.scheduled_at ? -1 : 1;
    if (!a.scheduled_time && !b.scheduled_time) return 0;
    if (!a.scheduled_time) return 1;
    if (!b.scheduled_time) return -1;
    return a.scheduled_time < b.scheduled_time ? -1 : 1;
  });

type CalendarDayStyle = CSSProperties & {
  '--team-calendar-day-accent'?: string;
  '--team-calendar-day-text'?: string;
};

const getTeamCalendarDayStyle = (game: GameRecord, teamId: string): CalendarDayStyle => {
  const isHomeGame = game.home_team.id === teamId;

  return {
    '--team-calendar-day-accent': isHomeGame
      ? game.home_team.primary_color || '#334155'
      : '#ffffff',
    '--team-calendar-day-text': isHomeGame ? game.home_team.text_color || '#ffffff' : '#14181f',
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
  const logoAccentColor = isHomeGame ? team.secondary_color || team.primary_color : '#ffffff';
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
      ? `${resultLabel} ${away} - ${home}${extraTimeLabel}`
      : game.status === 'in_progress'
        ? `LIVE ${away} - ${home}`
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

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  teamId: string;
  teamName: string;
  leagueId: string;
  leagueCode?: string | null;
  defaultSeasonId?: string | null;
  calendarMonth?: Date;
  onCalendarMonthChange?: (month: Date) => void;
  seasonTeams?: GameFormTeam[];
}

const TeamGamesTab = ({
  teamId,
  teamName,
  leagueId,
  leagueCode,
  defaultSeasonId,
  calendarMonth: controlledCalendarMonth,
  onCalendarMonthChange,
  seasonTeams = [],
}: Props) => {
  const navigate = useNavigate();
  const { seasons, loading: seasonsLoading } = useSeasons(leagueId);
  const [seasonId, setSeasonId] = useState<string>(defaultSeasonId ?? '');
  const [view, setView] = useState<'list' | 'calendar'>('calendar');
  const [exportingMonthImage, setExportingMonthImage] = useState(false);
  const [createGameDate, setCreateGameDate] = useState<string | null>(null);
  const [internalCalendarMonth, setInternalCalendarMonth] = useState<Date>(() =>
    monthStart(new Date()),
  );
  const weekKey = `team-games-week:${teamId}:${seasonId || 'all'}`;
  const [weekStart, setWeekStartState] = useState<Date>(() => {
    const stored = sessionStorage.getItem(weekKey);
    return stored ? fromISODate(stored) : toDay(new Date());
  });
  const calendarGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!seasonId && defaultSeasonId) setSeasonId(defaultSeasonId);
  }, [defaultSeasonId, seasonId]);

  useEffect(() => {
    const stored = sessionStorage.getItem(weekKey);
    setWeekStartState(stored ? fromISODate(stored) : toDay(new Date()));
  }, [weekKey]);

  const {
    games,
    loading: gamesLoading,
    createGame,
    updateGame,
  } = useGames({
    teamId,
    seasonId: seasonId || undefined,
  });

  const scheduledGames = useMemo(() => games.filter((game) => !!game.scheduled_at), [games]);
  const weekEnd = addDays(weekStart, 6);
  const setWeekStart = (updater: Date | ((current: Date) => Date)) => {
    setWeekStartState((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      const nextDay = toDay(next);
      sessionStorage.setItem(weekKey, dateToISO(nextDay));
      return nextDay;
    });
  };

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

  const groupedWeekGames = useMemo(() => {
    const map = new Map<string, GameRecord[]>();
    for (let i = 0; i < 7; i++) {
      map.set(dateToISO(addDays(weekStart, i)), []);
    }
    for (const game of sortGamesBySchedule(scheduledGames)) {
      const key = toLocalDateKey(game.scheduled_at!);
      map.get(key)?.push(game);
    }
    return Array.from(map.entries());
  }, [scheduledGames, weekStart]);

  const loading = seasonsLoading || gamesLoading;
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
    if (exportingMonthImage || view !== 'calendar' || scheduledGames.length === 0 || !calendarNode)
      return;
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
    } catch {
      toast.error('Failed to generate schedule image');
    } finally {
      setExportingMonthImage(false);
    }
  };

  const renderGameListItem = (game: GameRecord) => (
    <GameListItem
      key={game.id}
      href={buildGameDetailsPath({
        leagueCode: game.league_code ?? leagueCode,
        leagueId,
        seasonName: game.season_name,
        seasonId: game.season_id,
        gameId: game.id,
        awayTeamCode: game.away_team.code,
        homeTeamCode: game.home_team.code,
        scheduledAt: game.scheduled_at,
      })}
      awayTeam={{
        logo: game.away_team.logo,
        code: game.away_team.code,
        primaryColor: game.away_team.primary_color,
        textColor: game.away_team.text_color,
      }}
      homeTeam={{
        logo: game.home_team.logo,
        code: game.home_team.code,
        primaryColor: game.home_team.primary_color,
        textColor: game.home_team.text_color,
      }}
      awayScore={displayScore(game).away}
      homeScore={displayScore(game).home}
      showScore={game.status === 'final' || game.status === 'in_progress'}
      isFinal={game.status === 'final'}
      statusLabel={formatStatusLabel(game)}
      statusIntent={STATUS_INTENT[game.status]}
      gameType={game.game_type}
      time={game.scheduled_time ? formatTime(game.scheduled_time, game.scheduled_at) : undefined}
      venue={game.venue ?? undefined}
      round={game.playoff_round}
      roundLabel={
        game.playoff_round != null ? (game.playoff_round_names?.[game.playoff_round] ?? null) : null
      }
      gameNumberInSeries={game.game_number_in_series}
      gameNumber={game.game_number}
      actions={[
        {
          icon: 'open_in_new',
          intent: 'neutral',
          tooltip: 'View game',
          onClick: () => openGame(game),
        },
      ]}
    />
  );

  const listContent =
    !loading && seasonId && view === 'list' ? (
      <div className={seasonStyles.dayList}>
        {groupedWeekGames.map(([dateKey, dayGames]) => (
          <Section
            key={dateKey}
            title={fmtDayHeading(dateKey)}
            action={
              <Button
                type="button"
                variant="outlined"
                intent="neutral"
                size="sm"
                icon="add"
                tooltip="Create game"
                aria-label={`Create game on ${fmtDayHeading(dateKey)}`}
                onClick={() => setCreateGameDate(dateKey)}
                disabled={seasonTeams.length <= 1}
              />
            }
          >
            {dayGames.length === 0 ? (
              <p className={seasonStyles.dayEmpty}>No games scheduled.</p>
            ) : (
              <ul className={seasonStyles.list}>{dayGames.map(renderGameListItem)}</ul>
            )}
          </Section>
        ))}
      </div>
    ) : null;

  return (
    <>
      <Section
        noHeaderMargin={view === 'list' && !!seasonId && !loading}
        title={
          view === 'list' && seasonId ? (
            <>
              Games
              <Divider
                variant="vertical"
              />
              <span className={styles.weekNav}>
                <PeriodPicker
                  value={dateToISO(weekStart)}
                  label={fmtWeekRange(weekStart, weekEnd)}
                  onChange={(value) =>
                    setWeekStart(value ? fromISODate(value) : toDay(new Date()))
                  }
                  onPrevious={() => setWeekStart((current) => addDays(current, -7))}
                  onNext={() => setWeekStart((current) => addDays(current, 7))}
                />
              </span>
            </>
          ) : (
            'Games'
          )
        }
        action={
          <div className={styles.actionsRow}>
            <div className={styles.seasonSelect}>
              <SeasonSelect
                value={seasonId}
                seasons={seasons}
                onChange={setSeasonId}
                placeholder="Select season…"
                disabled={seasonsLoading}
              />
            </div>
            <SegmentedControl
              value={view}
              onChange={(value) => setView(value as 'list' | 'calendar')}
              className={styles.viewSegmentedControl}
              options={[
                {
                  value: 'calendar',
                  label: <Icon name="calendar_month" />,
                  tooltip: 'Calendar view',
                  ariaLabel: 'Calendar view',
                },
                {
                  value: 'list',
                  label: <Icon name="view_list" />,
                  tooltip: 'List view',
                  ariaLabel: 'List view',
                },
              ]}
            />
          </div>
        }
      >
        {loading ? (
          <p className={seasonStyles.empty}>Loading…</p>
        ) : !seasonId ? (
          <p className={seasonStyles.empty}>Select a season to view games.</p>
        ) : view === 'list' ? null : (
          <div className={styles.calendarWrap}>
            <div className={styles.calendarToolbar}>
              <div className={styles.calendarToolbarControls}>
                <PeriodPicker
                  kind="month"
                  value={toMonthPickerValue(calendarMonth)}
                  label={MONTH_LABEL_FMT.format(calendarMonth)}
                  onChange={changeCalendarMonth}
                  onPrevious={() => setCalendarMonth((current) => addMonths(current, -1))}
                  onNext={() => setCalendarMonth((current) => addMonths(current, 1))}
                />
              </div>
              <Button
                type="button"
                variant="outlined"
                intent="neutral"
                size="sm"
                icon="download"
                iconHeight="field"
                aria-label="Download month image"
                tooltip="Download month image"
                className={styles.calendarExportButton}
                onClick={() => void handleDownloadMonthImage()}
                disabled={exportingMonthImage || scheduledGames.length === 0}
              />
            </div>
            <div className={styles.calendarScroll}>
              <MonthCalendar
                ref={calendarGridRef}
                month={calendarMonth}
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
        )}
      </Section>
      {listContent}
      {seasonId && (
        <GameFormModal
          open={createGameDate !== null}
          seasonId={seasonId}
          editTarget={null}
          seasonTeams={seasonTeams}
          createGame={createGame}
          updateGame={updateGame}
          onClose={() => setCreateGameDate(null)}
          defaultDate={createGameDate ?? undefined}
          teamContext={{ teamId }}
        />
      )}
    </>
  );
};

export default TeamGamesTab;
