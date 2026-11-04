import { useEffect, useRef, useState } from 'react';
import { toast, type Id } from 'react-toastify';
import { getApiErrorMessage } from '@/lib/apiClient';

interface BackgroundModalMessages<T> {
  /** Shown in the progress toast while the action runs, e.g. "Saving game…". */
  pending: string;
  /** The progress toast's text once the action succeeds. */
  success: string | ((result: T) => string);
  /** Shown when the action fails without a message from the server. */
  error: string;
}

const finishToast = (id: Id, type: 'success' | 'error', message: string) =>
  toast.update(id, {
    render: message,
    type,
    isLoading: false,
    autoClose: type === 'success' ? 3000 : 5000,
    closeButton: true,
    closeOnClick: true,
    draggable: true,
  });

/**
 * Runs a modal's action in the background so the modal doesn't wait on the server: it hides as
 * soon as the action starts, a progress toast tracks it, and the toast turns into the success
 * message when it's done. If the action fails, the modal shows again with what was entered (it
 * stays mounted while hidden, so its form keeps its values) and the toast shows the error.
 *
 * `target` names what the modal is open for (a game id, say). If the modal moves on to another
 * target while hidden, the old action's outcome no longer closes or reopens it.
 */
const useBackgroundModalAction = ({
  target,
  onDone,
}: {
  target: string | null;
  /** Called once the action succeeds, to close the modal for good. */
  onDone: () => void;
}) => {
  const [hidden, setHidden] = useState(false);
  const targetRef = useRef(target);
  targetRef.current = target;

  // A modal opened for another target shows straight away.
  useEffect(() => {
    setHidden(false);
  }, [target]);

  const run = async <T>(
    action: () => Promise<T>,
    messages: BackgroundModalMessages<T>,
  ): Promise<T | null> => {
    const runTarget = targetRef.current;
    setHidden(true);
    const toastId = toast.loading(messages.pending);
    try {
      const result = await action();
      finishToast(
        toastId,
        'success',
        typeof messages.success === 'function' ? messages.success(result) : messages.success,
      );
      if (targetRef.current === runTarget) onDone();
      return result;
    } catch (err) {
      finishToast(toastId, 'error', getApiErrorMessage(err, messages.error));
      if (targetRef.current === runTarget) setHidden(false);
      return null;
    }
  };

  /**
   * Like run, for an action that shows its own success and error toasts and resolves to whether
   * it succeeded (most data hooks' save functions): the progress toast is dismissed when it
   * settles, leaving the action's own message.
   */
  const runSettled = async (
    action: () => Promise<unknown>,
    { pending }: { pending: string },
  ): Promise<boolean> => {
    const runTarget = targetRef.current;
    setHidden(true);
    const toastId = toast.loading(pending);
    let ok = false;
    try {
      ok = Boolean(await action());
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Something went wrong'));
    } finally {
      toast.dismiss(toastId);
    }
    if (targetRef.current === runTarget) {
      if (ok) onDone();
      else setHidden(false);
    }
    return ok;
  };

  return { hidden, run, runSettled };
};

export default useBackgroundModalAction;
