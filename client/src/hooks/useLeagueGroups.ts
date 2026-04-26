import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

// ── Types ────────────────────────────────────────────────────────────────────

export interface GroupTeamRecord {
  id: string;
  name: string;
  code: string;
  logo: string | null;
  primary_color: string;
  text_color: string;
}

export interface GroupRecord {
  id: string;
  league_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
  is_auto: boolean;
  teams: GroupTeamRecord[];
}

export interface CreateGroupData {
  league_id: string;
  name: string;
  parent_id?: string | null;
  sort_order?: number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const useLeagueGroups = (leagueId: string | undefined) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: groups = [], isLoading: loading } = useQuery({
    queryKey: ['groups', leagueId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<GroupRecord[]>(
          `${API}/admin/groups`,
          { params: { league_id: leagueId }, headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load groups'));
        return [] as GroupRecord[];
      }
    },
    enabled: !!leagueId,
  });

  const addGroup = async (payload: CreateGroupData): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/groups`, payload, { headers: authHeaders() });
      toast.success('Group created!');
      await queryClient.invalidateQueries({ queryKey: ['groups', leagueId] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create group'));
      return false;
    }
  };

  const updateGroup = async (
    groupId: string,
    payload: Partial<Omit<CreateGroupData, 'league_id'>>,
  ): Promise<boolean> => {
    setBusy(groupId);
    try {
      await axios.patch(`${API}/admin/groups/${groupId}`, payload, { headers: authHeaders() });
      toast.success('Group updated!');
      await queryClient.invalidateQueries({ queryKey: ['groups', leagueId] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update group'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteGroup = async (groupId: string): Promise<void> => {
    setBusy(groupId);
    try {
      await axios.delete(`${API}/admin/groups/${groupId}`, { headers: authHeaders() });
      toast.success('Group deleted');
      await queryClient.invalidateQueries({ queryKey: ['groups', leagueId] });
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete group'));
    } finally {
      setBusy(null);
    }
  };

  const setGroupTeams = async (groupId: string, teamIds: string[]): Promise<boolean> => {
    setBusy(groupId);
    try {
      await axios.put(
        `${API}/admin/groups/${groupId}/teams`,
        { team_ids: teamIds },
        { headers: authHeaders() },
      );
      toast.success('Group teams updated!');
      await queryClient.invalidateQueries({ queryKey: ['groups', leagueId] });
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update group teams'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { groups, loading, busy, addGroup, updateGroup, deleteGroup, setGroupTeams };
};

export default useLeagueGroups;
