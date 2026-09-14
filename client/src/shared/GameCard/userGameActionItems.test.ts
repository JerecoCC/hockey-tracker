import { getUserGameActions, type UserGameActionsProps } from './userGameActionItems';

const noop = () => {};

const baseProps: UserGameActionsProps = {
  watched: false,
  skipped: false,
  canMarkWatched: true,
  busy: false,
  onView: noop,
  onDownloadScoreCard: noop,
  onMarkWatched: noop,
  onUnwatch: noop,
  onSchedule: noop,
  onSkip: noop,
};

const getActionByTooltip = (
  props: Partial<UserGameActionsProps>,
  tooltip: string,
) =>
  getUserGameActions({ ...baseProps, ...props }).find(
    (action) => action && action.tooltip === tooltip,
  );

describe('getUserGameActions', () => {
  it('uses a warning remove action for skip game and a danger cancel action for cancel watch', () => {
    const skipGame = getActionByTooltip({ favoriteTeamGame: true }, 'Skip game');
    const cancelWatch = getActionByTooltip(
      { favoriteTeamGame: false, onCancelWatch: noop },
      'Cancel watch',
    );

    expect(skipGame).toMatchObject({ icon: 'remove_circle_outline', intent: 'warning' });
    expect(cancelWatch).toMatchObject({ icon: 'cancel', intent: 'danger' });
  });
});
