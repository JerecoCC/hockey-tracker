import { useEffect, useState, useCallback } from 'react';
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
}

export interface GroupRecord {
  id: string;
  league_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
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
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchGroups = useCallback(
    async (signal?: AbortSignal) => {
      if (!leagueId) return;
      try {
        const { data } = await axios.get<GroupRecord[]>(
          `${API}/admin/groups`,
          { params: { league_id: leagueId }, headers: authHeaders(), signal },
        );
        setGroups(data);
        setLoading(false);
      } catch (err) {
        if (axios.isCancel(err)) return;
        toast.error(apiError(err, 'Failed to load groups'));
        setLoading(false);
      }
    },
    [leagueId],
  );

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    fetchGroups(controller.signal);
    return () => controller.abort();
  }, [fetchGroups]);

  const addGroup = async (payload: CreateGroupData): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/groups`, payload, { headers: authHeaders() });
      toast.success('Group created!');
      await fetchGroups();
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
      await fetchGroups();
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
      await fetchGroups();
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
      await fetchGroups();
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
