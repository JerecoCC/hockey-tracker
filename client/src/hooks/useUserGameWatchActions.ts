import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import type { GameRecord } from '@/hooks/useGames';
import { API, authHeaders } from '@/lib/apiClient';
import { canMarkGameWatched, getGameMatchupLabel } from '@/lib/gamePresentation';
import { isInvalidWatchScheduleDate } from '@/lib/gameSchedule';

/**
 * Watch actions for a single game, for pages that show one game at a time.
 * The list pages keep their own copies because they patch their own caches
 * optimistically; here a refetch of the affected queries is enough.
 */
const useUserGameWatchActions = (game: GameRecord | null) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!game) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['user-game-details', game.id] }),
      queryClient.invalidateQueries({ queryKey: ['user-games'] }),
      queryClient.invalidateQueries({ queryKey: ['user-dashboard-watched-games'] }),
    ]);
  };

  const run = async (action: () => Promise<void>, failureMessage: string) => {
    if (!game || busy) return false;
    setBusy(true);
    try {
      await action();
      await refresh();
      return true;
    } catch {
      toast.error(failureMessage);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const markWatched = async () => {
    if (!game) return false;
    if (!canMarkGameWatched(game)) {
      toast.error('Only final games can be marked as watched');
      return false;
    }
    const ok = await run(async () => {
      await axios.post(`${API}/user/watched-games/${game.id}`, {}, { headers: authHeaders() });
    }, 'Failed to mark game as watched');
    if (ok) toast.success(`${getGameMatchupLabel(game)} marked as watched`);
    return ok;
  };

  const unwatch = async () => {
    if (!game) return false;
    const ok = await run(async () => {
      await axios.delete(`${API}/user/watched-games/${game.id}`, { headers: authHeaders() });
    }, 'Failed to unwatch game');
    if (ok) toast.success(`${getGameMatchupLabel(game)} marked as unwatched`);
    return ok;
  };

  const undoSkip = async () => {
    if (!game) return false;
    const ok = await run(async () => {
      await axios.delete(`${API}/user/watched-games/${game.id}`, { headers: authHeaders() });
    }, 'Failed to undo skip');
    if (ok) toast.success(`${getGameMatchupLabel(game)} restored`);
    return ok;
  };

  const skip = async () => {
    if (!game) return false;
    const ok = await run(async () => {
      await axios.post(`${API}/user/watched-games/${game.id}/skip`, {}, { headers: authHeaders() });
    }, 'Failed to skip game');
    if (ok) toast.success(`${getGameMatchupLabel(game)} skipped`);
    return ok;
  };

  /** Pass null to clear a postponement, which is how a watch is cancelled. */
  const postponeWatch = async (scheduledFor: string | null) => {
    if (!game) return false;
    if (scheduledFor && isInvalidWatchScheduleDate(game, scheduledFor, 'local')) {
      toast.error('Choose a watch date after the game date');
      return false;
    }
    const ok = await run(async () => {
      await axios.put(
        `${API}/user/watched-games/${game.id}/schedule`,
        { scheduled_for: scheduledFor },
        { headers: authHeaders() },
      );
    }, scheduledFor ? 'Failed to postpone watch' : 'Failed to cancel watch');
    if (ok) {
      toast.success(
        scheduledFor
          ? `${getGameMatchupLabel(game)} watch postponed`
          : `${getGameMatchupLabel(game)} watch cancelled`,
      );
    }
    return ok;
  };

  return { busy, markWatched, unwatch, undoSkip, skip, postponeWatch };
};

export default useUserGameWatchActions;
