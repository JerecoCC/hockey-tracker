import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';

import { API, authHeaders } from '@/lib/apiClient';
const QUERY_KEY = ['user-favorites'];

interface PendingRemoval {
  teamId: string;
  scheduleCount: number;
  timeZone: string;
}

const useFavoriteTeams = () => {
  const queryClient = useQueryClient();
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const { data: favorites = [] } = useQuery<string[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await axios.get<string[]>(`${API}/user/favorites`, {
        headers: authHeaders(),
      });
      return data;
    },
  });

  const updateFavorite = useCallback(
    async (
      teamId: string,
      remove: boolean,
      confirmed = false,
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    ) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        if (remove) {
          await axios.delete(`${API}/user/favorites/${teamId}`, {
            headers: authHeaders(),
            data: { time_zone: timeZone, confirm_schedule_removal: confirmed },
          });
        } else {
          await axios.post(`${API}/user/favorites/${teamId}`, {}, { headers: authHeaders() });
        }
        queryClient.setQueryData<string[]>(QUERY_KEY, (previous = []) =>
          remove ? previous.filter((id) => id !== teamId) : [...new Set([...previous, teamId])],
        );
        setPendingRemoval(null);
        for (const key of [
          'user-games',
          'user-dashboard-games',
          'user-dashboard-available-games',
          'user-dashboard-watched-games',
          'user-games-watched',
        ]) {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
      } catch (error) {
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 409 &&
          error.response.data?.code === 'scheduled_games_confirmation_required'
        ) {
          setPendingRemoval({
            teamId,
            scheduleCount: error.response.data.schedule_count,
            timeZone,
          });
          return;
        }
        toast.error('Failed to update favorites');
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [queryClient],
  );

  const toggle = useCallback(
    async (teamId: string) => {
      if (pendingRemoval) return;
      await updateFavorite(teamId, favorites.includes(teamId));
    },
    [favorites, pendingRemoval, updateFavorite],
  );

  const confirmRemoval = async () => {
    if (pendingRemoval)
      await updateFavorite(pendingRemoval.teamId, true, true, pendingRemoval.timeZone);
  };
  const cancelRemoval = () => {
    if (!inFlight.current) setPendingRemoval(null);
  };
  const isFavorite = useCallback((teamId: string) => favorites.includes(teamId), [favorites]);

  return { favorites, toggle, isFavorite, busy, pendingRemoval, confirmRemoval, cancelRemoval };
};

export default useFavoriteTeams;
