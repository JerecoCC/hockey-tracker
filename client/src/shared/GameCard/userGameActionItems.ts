import type { ListItemAction } from '@jerecocc/tracker-ui/components/ListItem/ListItem';

type MaybePromise = void | Promise<void>;

export interface UserGameActionsProps {
  watched: boolean;
  skipped: boolean;
  favoriteTeamGame?: boolean;
  canMarkWatched?: boolean;
  /** A personal game: it opens for editing, and is deleted rather than skipped. */
  personal?: boolean;
  busy: boolean;
  onView: () => MaybePromise;
  onDownloadScoreCard: () => MaybePromise;
  onMarkWatched: () => MaybePromise;
  onUnwatch: () => MaybePromise;
  onUndoSkip?: () => MaybePromise;
  onCancelWatch?: () => MaybePromise;
  onSchedule: () => MaybePromise;
  onSkip: () => MaybePromise;
}

const run = (handler: () => MaybePromise) => {
  void handler();
};

export const getUserGameActions = ({
  watched,
  skipped,
  favoriteTeamGame = true,
  canMarkWatched = true,
  personal = false,
  busy,
  onView,
  onDownloadScoreCard,
  onMarkWatched,
  onUnwatch,
  onUndoSkip,
  onCancelWatch,
  onSchedule,
  onSkip,
}: UserGameActionsProps): (ListItemAction | false)[] => [
  // Details stay open to everyone: an unwatched result is censored on the page.
  {
    icon: personal ? 'edit' : 'open_in_new',
    intent: 'neutral',
    tooltip: personal ? 'Edit game' : 'View game details',
    onClick: () => run(onView),
  },
  skipped && {
    icon: 'undo',
    intent: 'warning',
    tooltip: 'Undo skip',
    disabled: busy,
    onClick: () => run(onUndoSkip ?? onUnwatch),
  },
  watched && {
    icon: 'download',
    intent: 'neutral',
    tooltip: 'Download score card',
    onClick: () => run(onDownloadScoreCard),
  },
  watched && {
    icon: 'visibility_off',
    intent: 'danger',
    tooltip: 'Unwatch',
    disabled: busy,
    onClick: () => run(onUnwatch),
  },
  !watched &&
    !skipped &&
    !personal && {
      icon: favoriteTeamGame ? 'remove_circle_outline' : 'cancel',
      intent: favoriteTeamGame ? 'warning' : 'danger',
      tooltip: favoriteTeamGame ? 'Skip game' : 'Cancel watch',
      disabled: busy,
      onClick: () => run(favoriteTeamGame ? onSkip : (onCancelWatch ?? onSkip)),
    },
  !watched &&
    !skipped && {
      icon: 'calendar_month',
      intent: 'info',
      tooltip: 'Postpone watch',
      disabled: busy,
      onClick: () => run(onSchedule),
    },
  !watched &&
    !skipped &&
    canMarkWatched && {
      icon: 'visibility',
      intent: 'success',
      tooltip: 'Mark as watched',
      disabled: busy,
      onClick: () => run(onMarkWatched),
    },
];
