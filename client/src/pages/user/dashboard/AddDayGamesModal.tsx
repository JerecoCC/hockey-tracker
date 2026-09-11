import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import ListItem, { type ListItemAction } from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import Tooltip from '@jerecocc/tracker-ui/components/Tooltip/Tooltip';
import EmptyMessage from '@/shared/EmptyMessage/EmptyMessage';
import type { GameRecord, TeamInfo } from '@/hooks/useGames';
import { API, authHeaders } from '@/lib/apiClient';
import {
  dateKeyToDate,
  formatGameTime,
  getOriginalGameDateKey,
  getScheduledInstant,
  getScheduledWatchDateKey,
} from '@/lib/gameSchedule';
import styles from './AddDayGamesModal.module.scss';

const ORIGINAL_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});

const isPostponedGame = (game: GameRecord) => {
  const watchDate = getScheduledWatchDateKey(game.scheduled_for);
  const originalDate = getOriginalGameDateKey(game, 'local');
  return !!watchDate && !!originalDate && watchDate !== originalDate;
};

const getOriginalDateLabel = (game: GameRecord) => {
  const dateKey = getOriginalGameDateKey(game, 'local');
  return dateKey ? ORIGINAL_DATE_FMT.format(dateKeyToDate(dateKey)) : 'Date TBD';
};

const sortGamesByTime = (a: GameRecord, b: GameRecord) =>
  (getScheduledInstant(a.scheduled_at, a.scheduled_time)?.getTime() ?? Infinity) -
  (getScheduledInstant(b.scheduled_at, b.scheduled_time)?.getTime() ?? Infinity);

const MatchupTeam = ({ team }: { team: TeamInfo }) => (
  <Tooltip text={team.name}>
    <span
      className={styles.team}
      tabIndex={0}
      aria-label={team.name}
    >
      <span className={styles.logo}>
        <TeamLogo
          code={team.code}
          logo={team.logo}
          logoDark={team.logo_dark}
          logoLight={team.logo_light}
          primaryColor={team.primary_color}
          textColor={team.text_color}
          size={26}
          shape="circle"
          alt=""
        />
      </span>
      <span className={styles.teamCode}>{team.code}</span>
    </span>
  </Tooltip>
);

interface Props {
  dateKey: string;
  dateLabel: string;
  favoriteTeamIds: string[];
  scheduledGames: GameRecord[];
  onAdded: (games: GameRecord[]) => void;
  getGameActions?: (game: GameRecord) => (ListItemAction | false | null | undefined)[];
  onClose: () => void;
}

const AddDayGamesModal = ({
  dateKey,
  dateLabel,
  favoriteTeamIds,
  scheduledGames,
  onAdded,
  getGameActions,
  onClose,
}: Props) => {
  const [locallyAddedIds, setLocallyAddedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const {
    data: games = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<GameRecord[]>({
    queryKey: ['user-dashboard-available-games', dateKey],
    queryFn: async () => {
      // Fetch surrounding original dates, then apply the browser's local day.
      // Personal watch dates must not hide games from their actual game day.
      const { data } = await axios.get<GameRecord[]>(`${API}/user/games`, {
        headers: authHeaders(),
        params: { original_date: dateKey, all_teams: true, include_skipped: true },
      });
      return data.filter((game) => getOriginalGameDateKey(game, 'local') === dateKey);
    },
  });
  const scheduledIds = useMemo(
    () => new Set(scheduledGames.map((game) => game.id)),
    [scheduledGames],
  );
  const availableGames = useMemo(() => {
    const gamesById = new Map(games.map((game) => [game.id, game]));
    scheduledGames.forEach((game) => gamesById.set(game.id, game));
    return [...gamesById.values()];
  }, [games, scheduledGames]);

  const groups = useMemo(() => {
    const favorites = new Set(favoriteTeamIds);
    const ordered = [...availableGames].sort(sortGamesByTime);
    const gamesToWatch: GameRecord[] = [];
    const otherGames: GameRecord[] = [];
    for (const game of ordered) {
      const isFavoriteGame = favorites.has(game.home_team.id) || favorites.has(game.away_team.id);
      const isDefaultWatch =
        isFavoriteGame && !game.skipped_by_user && !getScheduledWatchDateKey(game.scheduled_for);
      const isWatching =
        scheduledIds.has(game.id) || locallyAddedIds.has(game.id) || isDefaultWatch;
      (isWatching ? gamesToWatch : otherGames).push(game);
    }
    gamesToWatch.sort(
      (a, b) => Number(isPostponedGame(b)) - Number(isPostponedGame(a)) || sortGamesByTime(a, b),
    );
    return [gamesToWatch, otherGames];
  }, [availableGames, favoriteTeamIds, locallyAddedIds, scheduledIds]);

  const save = async () => {
    if (saving || locallyAddedIds.size === 0) return;
    setSaving(true);
    const pendingGames = availableGames.filter((game) => locallyAddedIds.has(game.id));
    const results = await Promise.allSettled(
      pendingGames.map(async (game) => {
        await axios.put(
          `${API}/user/watched-games/${game.id}/schedule`,
          { scheduled_for: dateKey },
          { headers: authHeaders() },
        );
        return { ...game, scheduled_for: dateKey, skipped_by_user: false };
      }),
    );
    const addedGames = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    if (addedGames.length > 0) {
      onAdded(addedGames);
      const addedIds = new Set(addedGames.map((game) => game.id));
      setLocallyAddedIds((previous) => new Set([...previous].filter((id) => !addedIds.has(id))));
    }
    setSaving(false);
    if (results.some((result) => result.status === 'rejected')) {
      toast.error('Some games could not be added. Please try again.');
    } else {
      onClose();
    }
  };

  return (
    <Modal
      open
      title="Add games"
      onClose={() => {
        if (!saving) onClose();
      }}
      onConfirm={() => void save()}
      confirmLabel={saving ? 'Saving...' : 'Save'}
      confirmDisabled={isLoading || isError || locallyAddedIds.size === 0}
      busy={saving}
      disableBackdropClose={saving}
    >
      <p className={styles.date}>{dateLabel} · Local time</p>
      {isLoading ? (
        <EmptyMessage>Loading games...</EmptyMessage>
      ) : isError ? (
        <div role="alert">
          <EmptyMessage>Unable to load games.</EmptyMessage>
          <Button
            variant="outlined"
            onClick={() => void refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className={styles.groups}>
          {groups.map((group, index) => (
            <div key={index}>
              {index === 1 && <Divider className={styles.divider} />}
              <h4
                id={`day-games-group-${index}`}
                className={styles.heading}
              >
                {index === 0 ? 'Games to Watch' : 'Other games'}
              </h4>
              {group.length === 0 ? (
                <EmptyMessage>
                  {index === 0 ? 'No games to watch on this day.' : 'No other games on this day.'}
                </EmptyMessage>
              ) : (
                <ul
                  className={styles.list}
                  aria-labelledby={`day-games-group-${index}`}
                >
                  {group.map((game) => {
                    const content = (
                      <>
                        <div className={styles.mainContent}>
                          <div className={styles.matchup}>
                            <MatchupTeam team={game.away_team} />
                            <span className={styles.at}>@</span>
                            <MatchupTeam team={game.home_team} />
                          </div>
                        </div>
                        <span className={styles.time}>
                          {isPostponedGame(game)
                            ? getOriginalDateLabel(game)
                            : game.scheduled_time
                              ? formatGameTime(game.scheduled_at, game.scheduled_time, 'local')
                              : 'Time TBD'}
                        </span>
                      </>
                    );
                    return (
                      <ListItem
                        key={game.id}
                        fullWidth
                        className={styles.gameRow}
                        hideImage
                        name=""
                        ariaLabel={`${game.away_team.name} at ${game.home_team.name}`}
                        rightContent={content}
                        actions={
                          index === 0
                            ? locallyAddedIds.has(game.id) && !scheduledIds.has(game.id)
                              ? [
                                  {
                                    icon: 'remove_circle_outline',
                                    intent: 'danger',
                                    tooltip: 'Cancel watch',
                                    disabled: saving,
                                    onClick: () =>
                                      setLocallyAddedIds((previous) => {
                                        const next = new Set(previous);
                                        next.delete(game.id);
                                        return next;
                                      }),
                                  },
                                ]
                              : getGameActions?.(game)
                            : [
                                {
                                  icon: 'add',
                                  intent: 'accent',
                                  tooltip: 'Add to games to watch',
                                  disabled: saving,
                                  onClick: () =>
                                    setLocallyAddedIds((previous) =>
                                      new Set(previous).add(game.id),
                                    ),
                                },
                              ]
                        }
                      />
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default AddDayGamesModal;
