import Button from '@/components/Button/Button';

type MaybePromise = void | Promise<void>;

interface UserGameActionsProps {
  watched: boolean;
  skipped: boolean;
  scheduled: boolean;
  canMarkWatched?: boolean;
  busy: boolean;
  onView: () => MaybePromise;
  onDownloadScoreCard: () => MaybePromise;
  onMarkWatched: () => MaybePromise;
  onUnwatch: () => MaybePromise;
  onUndoSkip?: () => MaybePromise;
  onSchedule: () => MaybePromise;
  onSkip: () => MaybePromise;
}

const run = (handler: () => MaybePromise) => {
  void handler();
};

const UserGameActions = ({
  watched,
  skipped,
  scheduled,
  canMarkWatched = true,
  busy,
  onView,
  onDownloadScoreCard,
  onMarkWatched,
  onUnwatch,
  onUndoSkip,
  onSchedule,
  onSkip,
}: UserGameActionsProps) => (
  <>
    {(watched || skipped) && (
      <Button
        type="button"
        variant="outlined"
        intent="neutral"
        icon="open_in_new"
        size="small"
        tooltip="View game details"
        onClick={(e) => {
          e.stopPropagation();
          run(onView);
        }}
      />
    )}
    {skipped && (
      <Button
        type="button"
        variant="outlined"
        intent="warning"
        icon="undo"
        size="small"
        tooltip="Undo skip"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          run(onUndoSkip ?? onUnwatch);
        }}
      />
    )}
    {watched && (
      <Button
        type="button"
        variant="outlined"
        intent="neutral"
        icon="download"
        size="small"
        tooltip="Download score card"
        onClick={(e) => {
          e.stopPropagation();
          run(onDownloadScoreCard);
        }}
      />
    )}
    {watched && (
      <Button
        type="button"
        variant="outlined"
        intent="danger"
        icon="visibility_off"
        size="small"
        tooltip="Unwatch"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          run(onUnwatch);
        }}
      />
    )}
    {!watched && !skipped && (
      <Button
        type="button"
        variant="outlined"
        intent="warning"
        icon="remove_circle_outline"
        size="small"
        tooltip="Skip game"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          run(onSkip);
        }}
      />
    )}
    {!watched && !skipped && (
      <Button
        type="button"
        variant="outlined"
        intent="neutral"
        icon="calendar_month"
        size="small"
        tooltip={scheduled ? 'Edit watch schedule' : 'Schedule watch'}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          run(onSchedule);
        }}
      />
    )}
    {!watched && !skipped && canMarkWatched && (
      <Button
        type="button"
        variant="outlined"
        intent="accent"
        icon="visibility"
        size="small"
        tooltip="Mark as watched"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          run(onMarkWatched);
        }}
      />
    )}
  </>
);

export default UserGameActions;
