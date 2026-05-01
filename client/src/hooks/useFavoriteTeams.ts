import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const QUERY_KEY = ['user-favorites'];

const useFavoriteTeams = () => {
  const queryClient = useQueryClient();

  const { data: favorites = [] } = useQuery<string[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await axios.get<string[]>(`${API}/user/favorites`, {
        headers: authHeaders(),
      });
      return data;
    },
  });

  const toggle = useCallback(
    async (teamId: string) => {
      const wasFavorite = favorites.includes(teamId);

      // Optimistic update
      queryClient.setQueryData<string[]>(QUERY_KEY, (prev = []) =>
        wasFavorite ? prev.filter((id) => id !== teamId) : [...prev, teamId],
      );

      try {
        if (wasFavorite) {
          await axios.delete(`${API}/user/favorites/${teamId}`, { headers: authHeaders() });
        } else {
          await axios.post(`${API}/user/favorites/${teamId}`, {}, { headers: authHeaders() });
        }
      } catch {
        // Revert on failure
        queryClient.setQueryData<string[]>(QUERY_KEY, favorites);
        toast.error('Failed to update favorites');
      }
    },
    [favorites, queryClient],
  );

  const isFavorite = useCallback((teamId: string) => favorites.includes(teamId), [favorites]);

  return { favorites, toggle, isFavorite };
};

export default useFavoriteTeams;
