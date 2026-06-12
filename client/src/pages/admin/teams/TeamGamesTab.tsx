import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import DatePicker from '@/components/DatePicker/DatePicker';
import Icon from '@/components/Icon/Icon';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import SeasonSelect from '@/components/SeasonSelect/SeasonSelect';
import TeamCalendarGameCard from '@/components/TeamCalendarGameCard/TeamCalendarGameCard';
import useGames, { type GameRecord, type GameStatus } from '@/hooks/useGames';
import useSeasons from '@/hooks/useSeasons';
import GameListItem from '@/pages/admin/seasons/GameListItem';
import { buildGameDetailsPath } from '@/lib/routeSlugs';
import { downloadMonthScheduleImage } from '@/lib/monthScheduleImage';
import seasonStyles from '@/pages/admin/seasons/SeasonGamesTab.module.scss';
import styles from './TeamGamesTab.module.scss';

// ── Display helpers ───────────────────────────────────────────────────────────

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const MONTH_LABEL_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  cancelled: 'Cancelled',
};

const toLocalDateKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const daysInMonth = (year: number, monthIndex: number) =>
  new Date(year, monthIndex + 1, 0).getDate();
const firstDayOfWeek = (year: number, monthIndex: number) => new Date(year, monthIndex, 1).getDay();
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

const STATUS_INTENT: Record<GameStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  scheduled: 'info',
  in_progress: 'warning',
  final: 'success',
  postponed: 'warning',
  cancelled: 'danger',
};

const formatStatusLabel = (game: GameRecord): string => {
  if (game.status !== 'final') return STATUS_LABEL[game.status];
  if (game.shootout || game.period_scores.some((ps) => ps.period === 'SO')) return 'Final/SO';
  if ((game.overtime_periods ?? 0) > 0 || game.period_scores.some((ps) => ps.period === 'OT'))
    return 'Final/OT';
  return 'Final';
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
      live={game.status === 'in_progress'}
      fillContainer
      flush
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
}

const TeamGamesTab = ({ teamId, teamName, leagueId, leagueCode, defaultSeasonId }: Props) => {
  const navigate = useNavigate();
  const { seasons, loading: seasonsLoading } = useSeasons(leagueId);
  const [seasonId, setSeasonId] = useState<string>(defaultSeasonId ?? '');
  const [view, setView] = useState<'list' | 'calendar'>('calendar');
  const [exportingMonthImage, setExportingMonthImage] = useState(false);
  const calendarGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!seasonId && defaultSeasonId) setSeasonId(defaultSeasonId);
  }, [defaultSeasonId, seasonId]);

  const { games, loading: gamesLoading } = useGames({
    teamId,
    seasonId: seasonId || undefined,
  });

  const scheduledGames = useMemo(() => games.filter((game) => !!game.scheduled_at), [games]);

  const preferredMonth = useMemo(() => {
    const now = monthStart(new Date());
    if (
      scheduledGames.some(
        (game) =>
          game.scheduled_at && monthKey(monthStart(new Date(game.scheduled_at))) === monthKey(now),
      )
    ) {
      return now;
    }
    return scheduledGames[0]?.scheduled_at
      ? monthStart(new Date(scheduledGames[0].scheduled_at))
      : now;
  }, [scheduledGames]);

  const [calendarMonth, setCalendarMonth] = useState<Date>(preferredMonth);

  useEffect(() => {
    setCalendarMonth(preferredMonth);
  }, [preferredMonth]);

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

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const monthIndex = calendarMonth.getMonth();
    const total = daysInMonth(year, monthIndex);
    const startDow = firstDayOfWeek(year, monthIndex);
    const cells: (number | null)[] = Array(startDow).fill(null);
    for (let day = 1; day <= total; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth]);

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
    setExportingMonthImage(true);
    try {
      await downloadMonthScheduleImage({
        calendarNode,
        calendarMonth,
        headerLabel: MONTH_LABEL_FMT.format(calendarMonth),
        exportWidth: 1120,
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

  return (
    <Card
      title="Games"
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
      ) : games.length === 0 ? (
        <p className={seasonStyles.empty}>No games scheduled for this season.</p>
      ) : view === 'list' ? (
        <ul className={seasonStyles.list}>
          {games.map((game) => (
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
              date={game.scheduled_at ? DATE_FMT.format(new Date(game.scheduled_at)) : undefined}
              time={
                game.scheduled_time ? formatTime(game.scheduled_time, game.scheduled_at) : undefined
              }
              venue={game.venue ?? undefined}
              round={game.playoff_round}
              roundLabel={
                game.playoff_round != null
                  ? (game.playoff_round_names?.[game.playoff_round] ?? null)
                  : null
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
          ))}
        </ul>
      ) : scheduledGames.length === 0 ? (
        <p className={seasonStyles.empty}>No scheduled games to place on the calendar.</p>
      ) : (
        <div className={styles.calendarWrap}>
          <div className={styles.calendarToolbar}>
            <div className={styles.calendarToolbarControls}>
              <Button
                variant="outlined"
                intent="neutral"
                icon="chevron_left"
                size="sm"
                tooltip="Previous month"
                aria-label="Previous month"
                onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
              />
              <div className={styles.calendarMonthPicker}>
                <DatePicker
                  value={toMonthPickerValue(calendarMonth)}
                  onChange={changeCalendarMonth}
                  granularity="month"
                  triggerLabel={MONTH_LABEL_FMT.format(calendarMonth)}
                  triggerAriaLabel={`Select month: ${MONTH_LABEL_FMT.format(calendarMonth)}`}
                />
              </div>
              <Button
                variant="outlined"
                intent="neutral"
                icon="chevron_right"
                size="sm"
                tooltip="Next month"
                aria-label="Next month"
                onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
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
              disabled={exportingMonthImage}
            />
          </div>
          <div className={styles.calendarScroll}>
            <div
              ref={calendarGridRef}
              className={styles.calendarGrid}
            >
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className={styles.calendarDayName}
                >
                  {label}
                </div>
              ))}
              {calendarCells.map((day, index) => {
                if (day === null) {
                  return (
                    <div
                      key={`blank-${index}`}
                      className={styles.calendarEmptyCell}
                    />
                  );
                }

                const dateKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayGame = gamesByDate.get(dateKey);
                return (
                  <div
                    key={dateKey}
                    className={styles.calendarDayCell}
                  >
                    {dayGame ? (
                      <div className={styles.calendarDayGamesFilled}>
                        <TeamCalendarGame
                          key={dayGame.id}
                          game={dayGame}
                          teamId={teamId}
                          onOpen={openGame}
                          dayNumber={day}
                        />
                      </div>
                    ) : (
                      <div className={styles.calendarDayEmpty}>
                        <span className={styles.calendarDayNumber}>{day}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default TeamGamesTab;
