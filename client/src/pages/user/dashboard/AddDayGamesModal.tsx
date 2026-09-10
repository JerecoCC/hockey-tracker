import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import SelectableListItem from '@jerecocc/tracker-ui/components/SelectableListItem/SelectableListItem';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import Tooltip from '@jerecocc/tracker-ui/components/Tooltip/Tooltip';
import EmptyMessage from '@/shared/EmptyMessage/EmptyMessage';
import type { GameRecord, TeamInfo } from '@/hooks/useGames';
import { API, authHeaders } from '@/lib/apiClient';
import { formatGameTime, getOriginalGameDateKey, getScheduledInstant } from '@/lib/gameSchedule';
import styles from './AddDayGamesModal.module.scss';

const MatchupTeam = ({ team }: { team: TeamInfo }) => (
  <span className={styles.team}>
    <Tooltip text={team.name}>
      <span
        className={styles.logo}
        tabIndex={0}
        aria-label={team.name}
      >
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
    </Tooltip>
    <span className={styles.teamCode}>{team.code}</span>
  </span>
);

interface Props {
  dateKey: string;
  dateLabel: string;
  favoriteTeamIds: string[];
  scheduledGames: GameRecord[];
  onAdded: (games: GameRecord[]) => void;
  onClose: () => void;
}

const AddDayGamesModal = ({
  dateKey,
  dateLabel,
  favoriteTeamIds,
  scheduledGames,
  onAdded,
  onClose,
}: Props) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
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
  const existingIds = new Set(scheduledGames.map((game) => game.id));
  const groups = useMemo(() => {
    const favorites = new Set(favoriteTeamIds);
    const ordered = [...games].sort(
      (a, b) =>
        (getScheduledInstant(a.scheduled_at, a.scheduled_time)?.getTime() ?? Infinity) -
        (getScheduledInstant(b.scheduled_at, b.scheduled_time)?.getTime() ?? Infinity),
    );
    const favoriteGames: GameRecord[] = [];
    const otherGames: GameRecord[] = [];
    for (const game of ordered) {
      (favorites.has(game.home_team.id) || favorites.has(game.away_team.id)
        ? favoriteGames
        : otherGames
      ).push(game);
    }
    return [favoriteGames, otherGames];
  }, [games, favoriteTeamIds]);
  const selectedGames = groups[1].filter(
    (game) => selectedIds.has(game.id) && !existingIds.has(game.id),
  );

  const toggle = (id: string) => {
    if (busy || existingIds.has(id)) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (busy || selectedGames.length === 0) return;
    setBusy(true);
    const results = await Promise.allSettled(
      selectedGames.map(async (game) => {
        await axios.put(
          `${API}/user/watched-games/${game.id}/schedule`,
          { scheduled_for: dateKey },
          { headers: authHeaders() },
        );
        return { ...game, scheduled_for: dateKey, skipped_by_user: false };
      }),
    );
    const added = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    if (added.length) {
      onAdded(added);
      setSelectedIds(
        (previous) => new Set([...previous].filter((id) => !added.some((game) => game.id === id))),
      );
    }
    setBusy(false);
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
        if (!busy) onClose();
      }}
      onConfirm={() => void save()}
      confirmLabel={busy ? 'Adding...' : 'Add selected games'}
      confirmDisabled={isLoading || isError || selectedGames.length === 0}
      busy={busy}
      disableBackdropClose={busy}
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
                {index === 0 ? 'Favorite teams' : 'Other games'}
              </h4>
              {group.length === 0 ? (
                <EmptyMessage>
                  {index === 0
                    ? 'No favorite-team games on this day.'
                    : 'No other games on this day.'}
                </EmptyMessage>
              ) : (
                <ul
                  className={styles.list}
                  aria-labelledby={`day-games-group-${index}`}
                >
                  {group.map((game) => {
                    const existing = existingIds.has(game.id);
                    const checked = existing || selectedIds.has(game.id);
                    const content = (
                      <>
                        <div className={styles.mainContent}>
                          <div className={styles.matchup}>
                            <MatchupTeam team={game.away_team} />
                            <span className={styles.at}>@</span>
                            <MatchupTeam team={game.home_team} />
                          </div>
                          {index !== 0 && existing && (
                            <span className={styles.scheduled}>Already scheduled</span>
                          )}
                        </div>
                        <span className={styles.time}>
                          {game.scheduled_time
                            ? formatGameTime(game.scheduled_at, game.scheduled_time, 'local')
                            : 'Time TBD'}
                        </span>
                      </>
                    );
                    if (index === 0) {
                      return (
                        <li
                          key={game.id}
                          className={styles.favoriteRow}
                        >
                          {content}
                        </li>
                      );
                    }
                    return (
                      <SelectableListItem
                        key={game.id}
                        checked={checked}
                        onToggle={() => toggle(game.id)}
                        disabled={busy || existing}
                        hideImage
                        name={`${game.away_team.name} at ${game.home_team.name}`}
                        rightContent={content}
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
