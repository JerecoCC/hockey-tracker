import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import { type PlayoffFormatRule } from './useLeagues';

import { API, authHeaders, getApiErrorMessage as apiError } from '@/lib/apiClient';

export interface PlayoffQualificationFormat {
  id: string;
  league_id: string;
  name: string;
  rules: PlayoffFormatRule[];
  created_at: string;
}

export interface PlayoffQualificationFormatPayload {
  name: string;
  rules: PlayoffFormatRule[];
}



const usePlayoffQualificationFormats = (leagueId: string | null | undefined) => {
  const queryClient = useQueryClient();

  const queryKey = ['playoff-qualification-formats', leagueId];
  const { data: formats = [], isLoading: loading } = useQuery({
    queryKey,
    enabled: !!leagueId,
    queryFn: async () => {
      if (!leagueId) return [] as PlayoffQualificationFormat[];
      try {
        const { data } = await axios.get<PlayoffQualificationFormat[]>(
          `${API}/admin/playoff-qualification-formats`,
          {
            params: { league_id: leagueId },
            headers: authHeaders(),
          },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load qualification formats'));
        return [] as PlayoffQualificationFormat[];
      }
    },
  });

  const createFormat = async (payload: PlayoffQualificationFormatPayload): Promise<boolean> => {
    if (!leagueId) return false;
    try {
      await axios.post(
        `${API}/admin/playoff-qualification-formats`,
        { league_id: leagueId, ...payload },
        { headers: authHeaders() },
      );
      toast.success('Qualification format created!');
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['bracket-rule-sets', leagueId] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create qualification format'));
      return false;
    }
  };

  const updateFormat = async (
    id: string,
    payload: PlayoffQualificationFormatPayload,
  ): Promise<boolean> => {
    try {
      await axios.patch(`${API}/admin/playoff-qualification-formats/${id}`, payload, {
        headers: authHeaders(),
      });
      toast.success('Qualification format updated!');
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['bracket-rule-sets', leagueId] });
      await queryClient.invalidateQueries({ queryKey: ['season'] });
      await queryClient.invalidateQueries({ queryKey: ['seasons'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update qualification format'));
      return false;
    }
  };

  const deleteFormat = async (id: string): Promise<boolean> => {
    try {
      await axios.delete(`${API}/admin/playoff-qualification-formats/${id}`, {
        headers: authHeaders(),
      });
      toast.success('Qualification format deleted');
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['bracket-rule-sets', leagueId] });
      await queryClient.invalidateQueries({ queryKey: ['season'] });
      await queryClient.invalidateQueries({ queryKey: ['seasons'] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete qualification format'));
      return false;
    }
  };

  return { formats, loading, createFormat, updateFormat, deleteFormat };
};

export default usePlayoffQualificationFormats;
