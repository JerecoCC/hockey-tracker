import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API, authHeaders, getApiErrorMessage } from '@/lib/apiClient';

export interface ProjectedLineupSlot {
  id: string;
  season_id: string;
  team_id: string;
  player_id: string;
  slot_key: string;
  sort_order: number;
  first_name?: string;
  last_name?: string;
  position?: string | null;
  jersey_number?: number | null;
  photo?: string | null;
}

interface UseProjectedLineupOptions {
  mode?: 'admin' | 'user';
}

export const useProjectedLineup = (
  teamId?: string,
  seasonId?: string | null,
  options: UseProjectedLineupOptions = {},
) => {
  const queryClient = useQueryClient();
  const mode = options.mode ?? 'admin';
  const queryKey = [mode === 'user' ? 'user-projected-lineup' : 'projected-lineup', teamId, seasonId] as const;
  const query = useQuery<ProjectedLineupSlot[]>({
    queryKey,
    queryFn: async () => {
      const { data } = await axios.get<ProjectedLineupSlot[]>(
        `${API}/${mode}/teams/${teamId}/seasons/${seasonId}/projected-lineup`,
        { headers: authHeaders() },
      );
      return data;
    },
    enabled: !!teamId && !!seasonId,
  });
  const mutation = useMutation({
    mutationFn: async (slots: Array<{ slot_key: string; player_id: string }>) => {
      const { data } = await axios.put<ProjectedLineupSlot[]>(
        `${API}/admin/teams/${teamId}/seasons/${seasonId}/projected-lineup`,
        { slots },
        { headers: authHeaders() },
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      toast.success('Projected lineup saved');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to save projected lineup')),
  });

  return {
    slots: query.data ?? [],
    loading: query.isLoading,
    saving: mutation.isPending,
    save: async (slots: Array<{ slot_key: string; player_id: string }>) => {
      try {
        await mutation.mutateAsync(slots);
        return true;
      } catch {
        return false;
      }
    },
  };
};
