import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { useParams } from 'react-router-dom';
import { toast, type TypeOptions } from 'react-toastify';
import Badge from '@/components/Badge/Badge';
import Button from '@/components/Button/Button';
import Section from '@/components/Section/Section';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import GameListItem from '@/components/GameListItem';
import type { TagIntent } from '@/components/Tag/Tag';
import type { SelectOption } from '@/components/Select/Select';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import useDocumentIcon from '@/hooks/useDocumentIcon';
import useGames, { type GameRecord, type GameStatus } from '@/hooks/useGames';
import useLeagueDetails from '@/hooks/useLeagueDetails';
import useLeagues from '@/hooks/useLeagues';
import useSeasonDetails from '@/hooks/useSeasonDetails';
import {
  buildGameDetailsPath,
  buildLeagueDetailsPath,
  buildSeasonDetailsPath,
  gameDateRouteSlugToDateKey,
  toRouteSlug,
  UUID_PATTERN,
} from '@/lib/routeSlugs';
import BulkCreateGamesModal from './BulkCreateGamesModal';
import GameFormModal from './GameFormModal';
import { autofillGameFromNhlGamecenter } from '@/pages/admin/games/game-details/nhlGameAutofill';
import { autofillGameFromPwhlGamecenter } from '@/pages/admin/games/game-details/pwhlGameAutofill';
import {
  GAME_AUTOFILL_ACTION_ICON,
  isManualPlayerMovementRequiredError,
  type GameAutofillManualMoveReport,
} from '@/pages/admin/games/game-details/gameAutofillTypes';
import GameAutofillManualMoveReportModal from '@/pages/admin/games/game-details/GameAutofillManualMoveReportModal';
import { toEasternDateKey } from './seasonDateUtils';
import styles from './SeasonDayGamesPage.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const AUTOFILL_RESULT_TOAST_MS = 4000;
const AUTOFILL_FAILURE_TOAST_MS = 12000;

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const getErrorMessage = (err: unknown, fallback = 'Something went wrong'): string => {
  const responseError = (err as AxiosError<{ error?: string }>).response?.data?.error;
  if (responseError) return responseError;

  const aggregateErrors = (err as { errors?: unknown[] }).errors;
  if (Array.isArray(aggregateErrors) && aggregateErrors.length > 0) {
    const messages = aggregateErrors.map((nested) => getErrorMessage(nested, '')).filter(Boolean);
    if (messages.length > 0) return messages.join('; ');
  }

  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    const causeMessage = cause && cause !== err ? getErrorMessage(cause, '') : '';
    if (err.message && causeMessage && !err.message.includes(causeMessage)) {
      return `${err.message}: ${causeMessage}`;
    }
    return err.message || causeMessage || fallback;
  }

  return typeof err === 'string' && err ? err : fallback;
};

const STATUS_LABEL: Record<GameStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  final: 'Final',
  postponed: 'Postponed',
};

const STATUS_INTENT: Record<GameStatus, TagIntent> = {
  scheduled: 'info',
  in_progress: 'warning',
  final: 'success',
  postponed: 'warning',
};

interface NhlScheduleTeam {
  abbrev?: string;
}

interface NhlScheduleGame {
  id?: number;
  gameDate?: string;
  awayTeam?: NhlScheduleTeam;
  homeTeam?: NhlScheduleTeam;
}

interface NhlScheduleDay {
  date: string;
  games?: NhlScheduleGame[];
}

interface NhlScheduleResponse {
  gameWeek?: NhlScheduleDay[];
  games?: NhlScheduleGame[];
}

const normalizeCode = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

const nhlScheduleKey = (
  dateKey: string,
  awayCode: string | null | undefined,
  homeCode: string | null | undefined,
) => `${dateKey}|${normalizeCode(awayCode)}|${normalizeCode(homeCode)}`;

const isNhlGame = (game: GameRecord, leagueCode: string | null | undefined) =>
  normalizeCode(game.league_code ?? leagueCode) === 'NHL';

const getAutofillLeagueCode = (
  game: GameRecord,
  leagueCode: string | null | undefined,
): 'NHL' | 'PWHL' | null => {
  const code = normalizeCode(game.league_code ?? leagueCode);
  return code === 'NHL' || code === 'PWHL' ? code : null;
};

const isDayAutofillCandidate = (game: GameRecord, leagueCode: string | null | undefined) =>
  !!getAutofillLeagueCode(game, leagueCode) &&
  !!game.scheduled_at &&
  (game.status === 'scheduled' ||
    game.status === 'in_progress' ||
    (game.status === 'final' && (!game.time_start || !game.time_end)));

const fetchNhlScheduleIndex = async (dateKey: string) => {
  const { data } = await axios.get<NhlScheduleResponse>(`${API}/admin/games/nhl-api`, {
    headers: authHeaders(),
    params: { url: `https://api-web.nhle.com/v1/schedule/${dateKey}` },
  });
  const index = new Map<string, string>();
  const days = [
    ...(data.gameWeek ?? []),
    ...(data.games ? [{ date: dateKey, games: data.games }] : []),
  ];

  for (const day of days) {
    for (const game of day.games ?? []) {
      if (!game.id || !game.awayTeam?.abbrev || !game.homeTeam?.abbrev) continue;
      index.set(
        nhlScheduleKey(game.gameDate ?? day.date, game.awayTeam.abbrev, game.homeTeam.abbrev),
        String(game.id),
      );
    }
  }

  return index;
};

const nhlScheduleDateKeys = (game: GameRecord) => {
  const scheduledAt = game.scheduled_at;
  if (!scheduledAt) return [];
  const easternDate = toEasternDateKey(scheduledAt);
  return Array.from(new Set([easternDate].filter((dateKey): dateKey is string => !!dateKey)));
};

const dayAutofillLeagueLabel = (
  games: GameRecord[],
  leagueCode: string | null | undefined,
) => {
  const labels = new Set(
    games
      .map((game) => getAutofillLeagueCode(game, leagueCode))
      .filter((code): code is 'NHL' | 'PWHL' => !!code),
  );
  if (labels.size === 1) return [...labels][0];
  return 'League';
};

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const DAY_TITLE_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const compareOptionalStringAsc = (
  left: string | null | undefined,
  right: string | null | undefined,
) => {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const dateFromKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDayTitle = (dateKey: string | null) =>
  dateKey ? DAY_TITLE_FMT.format(dateFromKey(dateKey)) : 'Schedule Day';

const formatBreadcrumbDate = (dateKey: string | null) =>
  dateKey ? DATE_FMT.format(dateFromKey(dateKey)) : 'Schedule Day';

const formatDate = (scheduledAt: string | null) => {
  if (!scheduledAt) return undefined;
  return DATE_FMT.format(dateFromKey(toEasternDateKey(scheduledAt)));
};

const formatTime = (hhmm: string | null, scheduledAt: string | null) => {
  if (!hhmm) return undefined;
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;

  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minute = String(m).padStart(2, '0');
  const dateKey = scheduledAt ? toEasternDateKey(scheduledAt) : null;
  const base = dateKey ? dateFromKey(dateKey) : new Date();
  const abbr =
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })
      .formatToParts(base)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'ET';
  return `${hour12}:${minute} ${period} ${abbr}`;
};

const formatStatusLabel = (game: GameRecord) => {
  if (game.status !== 'final') return STATUS_LABEL[game.status];
  if (game.shootout) return 'Final/SO';
  if ((game.overtime_periods ?? 0) > 0) return 'Final/OT';
  return 'Final';
};

const playoffRoundLabel = (game: GameRecord) => {
  if (game.playoff_round == null) return null;
  return game.playoff_round_names?.[String(game.playoff_round)] ?? null;
};

const SeasonDayGamesPage = () => {
  const queryClient = useQueryClient();
  const {
    leagueSlug = '',
    seasonSlug = '',
    dateSlug = '',
    gameSlug = '',
  } = useParams<{
    leagueSlug?: string;
    seasonSlug?: string;
    dateSlug?: string;
    gameSlug?: string;
  }>();
  const dateKey = gameDateRouteSlugToDateKey(dateSlug || gameSlug);
  const month = dateKey?.slice(0, 7);

  const isLegacyLeagueRoute = UUID_PATTERN.test(leagueSlug);
  const isLegacySeasonRoute = UUID_PATTERN.test(seasonSlug);
  const { leagues, loading: leaguesLoading } = useLeagues();
  const routeLeague = isLegacyLeagueRoute
    ? null
    : leagues.find(
        (item) => toRouteSlug(item.code) === leagueSlug || toRouteSlug(item.name) === leagueSlug,
      );
  const routeLeagueId = isLegacyLeagueRoute ? leagueSlug : routeLeague?.id;
  const { league, seasons, loading: leagueDetailsLoading } = useLeagueDetails(routeLeagueId);
  useDocumentIcon(league?.icon);

  const routeSeason = isLegacySeasonRoute
    ? null
    : seasons.find((item) => toRouteSlug(item.name) === seasonSlug);
  const seasonId = isLegacySeasonRoute ? seasonSlug : routeSeason?.id;
  const {
    season,
    seasonTeams,
    loading: seasonDetailsLoading,
  } = useSeasonDetails(seasonId, { leagueId: routeLeagueId });
  const {
    games,
    loading: gamesLoading,
    createGame,
    updateGame,
    bulkCreateGames,
  } = useGames({ seasonId, month });
  const [formOpen, setFormOpen] = useState(false);
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<GameRecord | null>(null);
  const [autofilling, setAutofilling] = useState(false);
  const [manualMoveReports, setManualMoveReports] = useState<GameAutofillManualMoveReport[]>([]);

  const leagueCode = season?.league_code ?? league?.code ?? routeLeague?.code ?? leagueSlug;
  const leagueId = routeLeagueId ?? season?.league_id;
  const seasonName = routeSeason?.name ?? season?.name ?? 'Season';
  const isEnded = !!season?.is_ended;
  const teamOptions: SelectOption[] = seasonTeams.map((team) => ({
    value: team.id,
    label: team.name,
    logo: team.logo,
    logoDark: team.logo_dark,
    logoLight: team.logo_light,
    code: team.code,
  }));
  const leagueHref = buildLeagueDetailsPath({ leagueCode, leagueId });
  const seasonHref = buildSeasonDetailsPath({
    leagueCode,
    leagueId,
    seasonName,
    seasonId,
  });
  const dayTitle = formatDayTitle(dateKey);
  const breadcrumbDate = formatBreadcrumbDate(dateKey);
  const loading = leaguesLoading || leagueDetailsLoading || seasonDetailsLoading || gamesLoading;

  useEffect(() => {
    document.title = `${breadcrumbDate} Season Games`;
    return () => {
      document.title = 'Hockey Tracker';
    };
  }, [breadcrumbDate]);

  usePageBreadcrumbs(
    loading
      ? null
      : {
          backPath: seasonHref,
          backLabel: `Back to ${seasonName}`,
          items: [
            { label: leagueCode, path: leagueHref },
            { label: seasonName, path: seasonHref },
            { label: breadcrumbDate },
          ],
        },
    [breadcrumbDate, leagueCode, leagueHref, loading, seasonHref, seasonName],
  );

  const visibleGames = useMemo(() => {
    if (!dateKey || !seasonId) return [];
    return games
      .filter(
        (game) =>
          game.season_id === seasonId &&
          game.scheduled_at &&
          toEasternDateKey(game.scheduled_at) === dateKey,
      )
      .sort((a, b) => {
        const scheduledAtOrder = compareOptionalStringAsc(a.scheduled_at, b.scheduled_at);
        if (scheduledAtOrder !== 0) return scheduledAtOrder;
        const scheduledTimeOrder = compareOptionalStringAsc(a.scheduled_time, b.scheduled_time);
        if (scheduledTimeOrder !== 0) return scheduledTimeOrder;
        const startTimeOrder = compareOptionalStringAsc(a.time_start, b.time_start);
        if (startTimeOrder !== 0) return startTimeOrder;
        return compareOptionalStringAsc(a.time_end, b.time_end);
      });
  }, [dateKey, games, seasonId]);

  const autofillCandidates = useMemo(
    () => visibleGames.filter((game) => isDayAutofillCandidate(game, leagueCode)),
    [leagueCode, visibleGames],
  );
  const autofillLeagueLabel = dayAutofillLeagueLabel(autofillCandidates, leagueCode);

  const gameHref = (game: GameRecord) =>
    buildGameDetailsPath({
      leagueCode,
      leagueId,
      seasonName,
      seasonId,
      gameId: game.id,
      awayTeamCode: game.away_team.code,
      homeTeamCode: game.home_team.code,
      scheduledAt: game.scheduled_at,
      scheduledTime: game.scheduled_time,
    });

  const handleAdd = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditTarget(null);
  };

  const describeGame = (game: GameRecord) => `${game.away_team.code} @ ${game.home_team.code}`;

  const refreshAutofilledGame = async (gameId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['games', gameId] }),
      queryClient.refetchQueries({ queryKey: ['games'], type: 'active' }),
    ]);
  };

  const handleAutofillDay = async () => {
    const candidates = autofillCandidates;
    const dayLabel = dayTitle;

    if (candidates.length === 0) {
      toast.info('No scheduled NHL or PWHL games to auto-fill for this day.');
      return;
    }

    setAutofilling(true);
    setManualMoveReports([]);
    const failures: string[] = [];
    const manualMoveReportsForRun: GameAutofillManualMoveReport[] = [];
    let filled = 0;
    const nhlCandidates = candidates.filter((game) => isNhlGame(game, leagueCode));
    const needsScheduleLoad = nhlCandidates.length > 0;
    const prefillProgressSteps = needsScheduleLoad ? 1 : 0;
    const totalProgressSteps = candidates.length + prefillProgressSteps;
    const progressToastId = toast.loading(
      needsScheduleLoad
        ? `Auto-filling ${autofillLeagueLabel} games for ${dayLabel}: loading schedule...`
        : `Auto-filling ${autofillLeagueLabel} games for ${dayLabel}: starting...`,
      {
        autoClose: false,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        hideProgressBar: false,
        pauseOnHover: false,
        progress: 0,
        progressClassName: styles.dayAutofillProgressBar,
      },
    );

    const updateProgressToast = (completedSteps: number, message: string) => {
      toast.update(progressToastId, {
        render: message,
        isLoading: true,
        autoClose: false,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        hideProgressBar: false,
        pauseOnHover: false,
        progress: Math.min(completedSteps / totalProgressSteps, 0.98),
        progressClassName: styles.dayAutofillProgressBar,
      });
    };

    const finishProgressToast = (type: TypeOptions, message: string) => {
      toast.update(progressToastId, {
        render: message,
        type,
        isLoading: false,
        autoClose: type === 'success' ? AUTOFILL_RESULT_TOAST_MS : AUTOFILL_FAILURE_TOAST_MS,
        closeButton: true,
        closeOnClick: true,
        draggable: true,
        hideProgressBar: true,
        pauseOnHover: true,
        progress: 1,
        progressClassName: styles.dayAutofillProgressBar,
      });
    };

    try {
      const scheduleIndex = new Map<string, string>();
      if (needsScheduleLoad) {
        const scheduleDates = Array.from(
          new Set(nhlCandidates.flatMap((game) => nhlScheduleDateKeys(game))),
        );
        const scheduleIndexes = await Promise.all(scheduleDates.map(fetchNhlScheduleIndex));
        for (const index of scheduleIndexes) {
          for (const entry of index) scheduleIndex.set(entry[0], entry[1]);
        }
        updateProgressToast(
          1,
          `Auto-filling ${autofillLeagueLabel} games for ${dayLabel}: schedule loaded. 0/${candidates.length} games processed.`,
        );
      }

      for (const [index, game] of candidates.entries()) {
        const autofillCode = getAutofillLeagueCode(game, leagueCode);
        updateProgressToast(
          prefillProgressSteps + index,
          `Auto-filling ${describeGame(game)} (${index + 1}/${candidates.length})...`,
        );
        const gameId = (() => {
          if (autofillCode === 'PWHL') return game.league_game_number?.trim() || null;
          if (autofillCode === 'NHL') {
            const scheduleKeys = nhlScheduleDateKeys(game).map((candidateDateKey) =>
              nhlScheduleKey(candidateDateKey, game.away_team.code, game.home_team.code),
            );
            return (
              scheduleKeys.map((scheduleKey) => scheduleIndex.get(scheduleKey)).find(Boolean) ??
              (game.game_number ? String(game.game_number) : null)
            );
          }
          return null;
        })();

        if (!gameId) {
          const dateKeys = autofillCode === 'NHL' ? nhlScheduleDateKeys(game) : [];
          const missingReason =
            autofillCode === 'PWHL'
              ? 'no PWHL league game number set'
              : `no NHL schedule match${
                  dateKeys.length > 0 ? ` for ${dateKeys.join(' or ')}` : ''
                }`;
          failures.push(`${describeGame(game)}: ${missingReason}`);
          updateProgressToast(
            prefillProgressSteps + index + 1,
            `Skipped ${describeGame(game)} (${index + 1}/${candidates.length}).`,
          );
          continue;
        }

        try {
          const gameWithLeagueId = game.league_id || !leagueId ? game : { ...game, league_id: leagueId };
          if (autofillCode === 'PWHL') {
            await autofillGameFromPwhlGamecenter(gameWithLeagueId, gameId);
          } else {
            await autofillGameFromNhlGamecenter(gameWithLeagueId, gameId);
          }
          filled += 1;
          await refreshAutofilledGame(game.id);
          updateProgressToast(
            prefillProgressSteps + index + 1,
            `Auto-filled ${describeGame(game)} (${index + 1}/${candidates.length}).`,
          );
        } catch (err) {
          const manualMoveError = isManualPlayerMovementRequiredError(err) ? err : null;
          if (manualMoveError) manualMoveReportsForRun.push(manualMoveError.report);
          const message = manualMoveError
            ? 'manual player update required'
            : getErrorMessage(err, 'Auto-fill failed');
          failures.push(`${describeGame(game)}: ${message}`);
          console.warn(`${autofillCode ?? 'League'} day auto-fill skipped ${describeGame(game)}`, err);
          updateProgressToast(
            prefillProgressSteps + index + 1,
            `Skipped ${describeGame(game)} (${index + 1}/${candidates.length}).`,
          );
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['games'] });

      if (failures.length > 0) {
        console.warn(`${autofillLeagueLabel} day auto-fill skipped games:`, failures);
      }
      if (manualMoveReportsForRun.length > 0) {
        setManualMoveReports(manualMoveReportsForRun);
      }

      if (failures.length === 0) {
        finishProgressToast(
          'success',
          `Auto-filled ${filled} ${autofillLeagueLabel} game${filled === 1 ? '' : 's'} for ${dayLabel}.`,
        );
      } else if (filled > 0) {
        finishProgressToast(
          'info',
          `Auto-filled ${filled} ${autofillLeagueLabel} game${filled === 1 ? '' : 's'}; skipped ${failures.length}. First skipped: ${failures[0]}`,
        );
      } else {
        finishProgressToast(
          'error',
          `No ${autofillLeagueLabel} games were auto-filled. First skipped: ${failures[0] ?? 'check the console for details.'}`,
        );
      }
    } catch (err) {
      finishProgressToast(
        'error',
        getErrorMessage(err, `Failed to auto-fill ${autofillLeagueLabel} games for this day.`),
      );
    } finally {
      setAutofilling(false);
    }
  };

  const sectionActions =
    !isEnded && dateKey ? (
      <div className={styles.sectionActions}>
        {autofillCandidates.length > 0 && (
          <Button
            type="button"
            variant="outlined"
            intent="neutral"
            size="medium"
            icon={GAME_AUTOFILL_ACTION_ICON}
            iconHeight="button"
            iconSize="1rem"
            className={styles.sectionActionButton}
            tooltip={
              autofilling
                ? `Auto-filling ${autofillLeagueLabel} Games`
                : `Auto-fill ${autofillLeagueLabel} Games`
            }
            aria-label={
              autofilling
                ? `Auto-filling ${autofillLeagueLabel} Games`
                : `Auto-fill ${autofillLeagueLabel} Games`
            }
            disabled={autofilling}
            onClick={() => {
              void handleAutofillDay();
            }}
          />
        )}
        <Button
          type="button"
          variant="outlined"
          intent="accent"
          size="medium"
          icon="playlist_add"
          iconHeight="button"
          iconSize="1rem"
          className={styles.sectionActionButton}
          tooltip="Bulk Create"
          aria-label="Bulk Create"
          onClick={() => setBulkCreateOpen(true)}
        />
        <Button
          type="button"
          variant="filled"
          intent="accent"
          size="medium"
          icon="add"
          iconHeight="button"
          iconSize="1rem"
          className={styles.sectionActionButton}
          tooltip="Create Game"
          aria-label="Create Game"
          onClick={handleAdd}
        />
      </div>
    ) : undefined;

  if (loading) {
    return (
      <LoadingSpinner
        message="Loading games..."
        layout="page"
        size="lg"
      />
    );
  }

  if (!dateKey || !seasonId) {
    return <p className={styles.emptyState}>Schedule day not found.</p>;
  }

  return (
    <div className={styles.page}>
      <Section
        title={dayTitle}
        titleAccessory={
          <Badge
            className={styles.gameCountBadge}
            value={visibleGames.length}
            label={visibleGames.length === 1 ? 'game' : 'games'}
            aria-label={`${visibleGames.length} ${
              visibleGames.length === 1 ? 'game' : 'games'
            }`}
          />
        }
        action={sectionActions}
      >
        {visibleGames.length === 0 ? (
          <p className={styles.emptyState}>No games are scheduled for {dayTitle}.</p>
        ) : (
          <ul className={styles.gameList}>
            {visibleGames.map((game) => {
              const showScore = game.status === 'final' || game.status === 'in_progress';

              return (
                <GameListItem
                  key={game.id}
                  href={gameHref(game)}
                  awayTeam={{
                    logo: game.away_team.logo,
                    logoDark: game.away_team.logo_dark,
                    logoLight: game.away_team.logo_light,
                    code: game.away_team.code,
                    primaryColor: game.away_team.primary_color,
                    textColor: game.away_team.text_color,
                  }}
                  homeTeam={{
                    logo: game.home_team.logo,
                    logoDark: game.home_team.logo_dark,
                    logoLight: game.home_team.logo_light,
                    code: game.home_team.code,
                    primaryColor: game.home_team.primary_color,
                    textColor: game.home_team.text_color,
                  }}
                  awayScore={game.away_score}
                  homeScore={game.home_score}
                  showScore={showScore}
                  isFinal={game.status === 'final'}
                  statusLabel={formatStatusLabel(game)}
                  statusIntent={STATUS_INTENT[game.status]}
                  date={formatDate(game.scheduled_at)}
                  time={formatTime(game.scheduled_time, game.scheduled_at)}
                  venue={game.venue ?? undefined}
                  round={game.playoff_round}
                  roundLabel={playoffRoundLabel(game)}
                  gameNumberInSeries={game.game_number_in_series}
                  gameNumber={game.game_number}
                  gameType={game.game_type}
                  actions={[
                    {
                      icon: 'edit',
                      tooltip: 'Edit game',
                      onClick: () => setEditTarget(game),
                    },
                  ]}
                />
              );
            })}
          </ul>
        )}
      </Section>

      <GameFormModal
        open={formOpen || editTarget !== null}
        seasonId={seasonId ?? ''}
        editTarget={editTarget}
        seasonTeams={seasonTeams}
        createGame={createGame}
        updateGame={updateGame}
        onClose={handleFormClose}
        defaultDate={!editTarget ? dateKey : undefined}
      />

      <BulkCreateGamesModal
        open={bulkCreateOpen}
        defaultDate={dateKey}
        seasonId={seasonId ?? ''}
        seasonTeams={seasonTeams}
        teamOptions={teamOptions}
        bulkCreateGames={bulkCreateGames}
        onClose={() => setBulkCreateOpen(false)}
      />

      <GameAutofillManualMoveReportModal
        open={manualMoveReports.length > 0}
        reports={manualMoveReports}
        onClose={() => setManualMoveReports([])}
      />
    </div>
  );
};

export default SeasonDayGamesPage;
