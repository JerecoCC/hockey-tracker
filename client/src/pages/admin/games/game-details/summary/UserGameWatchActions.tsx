import { useState } from 'react';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import MoreActionsMenu, {
  type MoreActionsMenuItem,
} from '@jerecocc/tracker-ui/components/MoreActionsMenu/MoreActionsMenu';
import type { GameRecord } from '@/hooks/useGames';
import useBackgroundModalAction from '@/hooks/useBackgroundModalAction';
import useFavoriteTeams from '@/hooks/useFavoriteTeams';
import useUserGameWatchActions from '@/hooks/useUserGameWatchActions';
import { canMarkGameWatched } from '@/lib/gamePresentation';
import ScheduleWatchModal from '@/shared/ScheduleWatchModal/ScheduleWatchModal';
import styles from './GameInfoCard.module.scss';

interface Props {
  game: GameRecord;
  onDownloadScoreCard: () => void;
}

/**
 * The watch actions the games list offers on hover, for the one game the
 * details page is showing. Marking as watched leads as its own button; the
 * rest sit behind the menu beside it.
 */
const UserGameWatchActions = ({ game, onDownloadScoreCard }: Props) => {
  const { favorites } = useFavoriteTeams();
  const { busy, markWatched, unwatch, undoSkip, skip, postponeWatch } =
    useUserGameWatchActions(game);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  // The postpone modal hides while the new date saves behind a progress toast, and reappears
  // with that date if it fails.
  const scheduleAction = useBackgroundModalAction({
    target: scheduleOpen ? game.id : null,
    onDone: () => setScheduleOpen(false),
  });

  const watched = !!game.watched_by_user;
  const skipped = !!game.skipped_by_user;
  const pending = !watched && !skipped;
  const favoriteTeamGame =
    favorites.includes(game.home_team.id) || favorites.includes(game.away_team.id);

  const items: MoreActionsMenuItem[] = [
    ...(skipped
      ? [{ label: 'Undo skip', icon: 'undo', onClick: () => void undoSkip() }]
      : []),
    ...(watched
      ? [
          { label: 'Download score card', icon: 'download', onClick: onDownloadScoreCard },
          {
            label: 'Unwatch',
            icon: 'visibility_off',
            intent: 'danger' as const,
            onClick: () => void unwatch(),
          },
        ]
      : []),
    ...(pending
      ? [
          favoriteTeamGame
            ? { label: 'Skip game', icon: 'remove_circle_outline', onClick: () => void skip() }
            : {
                label: 'Cancel watch',
                icon: 'cancel',
                intent: 'danger' as const,
                onClick: () => void postponeWatch(null),
              },
          {
            label: 'Postpone watch',
            icon: 'calendar_month',
            onClick: () => {
              setScheduleDate(game.scheduled_for ?? '');
              setScheduleOpen(true);
            },
          },
        ]
      : []),
  ];

  const showMarkWatched = pending && canMarkGameWatched(game);

  if (!showMarkWatched && items.length === 0) return null;

  return (
    <>
      <div className={styles.watchActions}>
        {showMarkWatched && (
          <Button
            variant="outlined"
            intent="success"
            icon="visibility"
            size="medium"
            tooltip="Mark as watched"
            disabled={busy}
            onClick={() => void markWatched()}
            iconHeight="field"
          />
        )}
        {items.length > 0 && (
          <MoreActionsMenu
            items={items}
            disabled={busy}
            size="medium"
            iconHeight="field"
            iconSize="1.35rem"
          />
        )}
      </div>

      <ScheduleWatchModal
        open={scheduleOpen && !scheduleAction.hidden}
        game={game}
        value={scheduleDate}
        busy={busy}
        onChange={setScheduleDate}
        onClose={() => setScheduleOpen(false)}
        onSave={() => {
          const scheduledFor = scheduleDate || null;
          void scheduleAction.runSettled(() => postponeWatch(scheduledFor), {
            pending: scheduledFor ? 'Postponing watch…' : 'Saving watch date…',
          });
        }}
      />
    </>
  );
};

export default UserGameWatchActions;
