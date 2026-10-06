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

  it('uses a success action for mark as watched', () => {
    expect(getActionByTooltip({}, 'Mark as watched')).toMatchObject({
      icon: 'visibility',
      intent: 'success',
    });
  });

  it('opens personal games for editing and never offers skip or cancel watch', () => {
    const tooltips = getUserGameActions({ ...baseProps, personal: true, onCancelWatch: noop })
      .filter((action) => action !== false)
      .map((action) => action.tooltip);

    expect(tooltips).toEqual(['Edit game', 'Postpone watch', 'Mark as watched']);
    expect(getActionByTooltip({ personal: true }, 'Edit game')).toMatchObject({ icon: 'edit' });
  });
});
