import { toast, type Id, type TypeOptions } from 'react-toastify';
import type { GameAutofillProgress } from './gameAutofillTypes';

export const AUTOFILL_RESULT_TOAST_MS = 4000;
export const AUTOFILL_FAILURE_TOAST_MS = 12000;

interface GameAutofillProgressToastOptions {
  leagueLabel: string;
  progressClassName: string;
}

interface GameAutofillProgressToast {
  update: (progress: GameAutofillProgress) => void;
  finish: (type: TypeOptions, message: string) => void;
}

const commonLoadingToastOptions = (progressClassName: string) => ({
  autoClose: false,
  closeButton: false,
  closeOnClick: false,
  draggable: false,
  hideProgressBar: false,
  pauseOnHover: false,
  progressClassName,
});

export const startGameAutofillProgressToast = ({
  leagueLabel,
  progressClassName,
}: GameAutofillProgressToastOptions): GameAutofillProgressToast => {
  let progressValue = 0;
  const renderProgressMessage = (message: string) => `Auto-filling ${leagueLabel} game: ${message}`;
  const progressToastId: Id = toast.loading(renderProgressMessage('starting...'), {
    ...commonLoadingToastOptions(progressClassName),
    progress: progressValue,
  });

  const nextProgressValue = (progress: GameAutofillProgress) => {
    if (
      typeof progress.completed === 'number' &&
      typeof progress.total === 'number' &&
      progress.total > 0
    ) {
      progressValue = Math.max(
        progressValue,
        Math.min(Math.max(progress.completed / progress.total, 0), 0.98),
      );
      return progressValue;
    }

    progressValue = Math.max(progressValue, Math.min(progressValue + 0.08, 0.9));
    return progressValue;
  };

  return {
    update: (progress) => {
      toast.update(progressToastId, {
        render: renderProgressMessage(progress.message),
        isLoading: true,
        ...commonLoadingToastOptions(progressClassName),
        progress: nextProgressValue(progress),
      });
    },
    finish: (type, message) => {
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
        progressClassName,
      });
    },
  };
};
