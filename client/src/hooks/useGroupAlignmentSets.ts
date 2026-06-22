import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { type GroupTeamRecord } from './useLeagueGroups';
import { type SeasonGroupRecord } from './useSeasonDetails';

const API = import.meta.env.VITE_API_URL || '/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

export type GroupAlignmentStructureType = 'groups' | 'league';

export interface GroupAlignmentSet {
  id: string;
  league_id: string;
  name: string;
  structure_type: GroupAlignmentStructureType;
  created_at: string;
  group_count?: number;
  team_count?: number;
  groups?: AlignmentGroupRecord[];
  teams?: GroupTeamRecord[];
}

export type AlignmentGroupRecord = Omit<
  SeasonGroupRecord,
  'has_season_override' | 'is_inherited'
> & {
  alignment_set_id?: string;
  stable_key?: string | null;
  has_season_override?: boolean;
  is_inherited?: boolean;
};

interface CreateAlignmentSetPayload {
  name: string;
  structure_type?: GroupAlignmentStructureType;
  source?: 'empty' | 'legacy' | 'league';
  clone_from_set_id?: string | null;
  team_ids?: string[];
}

interface UpdateAlignmentSetPayload {
  name?: string;
  structure_type?: GroupAlignmentStructureType;
}

const useGroupAlignmentSets = (leagueId: string | undefined) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: alignmentSets = [], isLoading: loading } = useQuery<GroupAlignmentSet[]>({
    queryKey: ['group-alignment-sets', leagueId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<GroupAlignmentSet[]>(
          `${API}/admin/group-alignment-sets`,
          { headers: authHeaders(), params: { league_id: leagueId } },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load alignment sets'));
        return [];
      }
    },
    enabled: !!leagueId,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['group-alignment-sets', leagueId] });
  };

  const createAlignmentSet = async (
    payload: CreateAlignmentSetPayload,
  ): Promise<GroupAlignmentSet | null> => {
    if (!leagueId) return null;
    setBusy('create');
    try {
      const { data } = await axios.post<GroupAlignmentSet>(
        `${API}/admin/group-alignment-sets`,
        { ...payload, league_id: leagueId },
        { headers: authHeaders() },
      );
      toast.success('Alignment set created!');
      await invalidate();
      return data;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create alignment set'));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const fetchAlignmentSet = async (alignmentSetId: string): Promise<GroupAlignmentSet | null> => {
    try {
      const { data } = await axios.get<GroupAlignmentSet>(
        `${API}/admin/group-alignment-sets/${alignmentSetId}`,
        { headers: authHeaders() },
      );
      return data;
    } catch (err) {
      toast.error(apiError(err, 'Failed to load alignment set'));
      return null;
    }
  };

  const updateAlignmentSet = async (
    alignmentSetId: string,
    payload: UpdateAlignmentSetPayload,
  ): Promise<boolean> => {
    setBusy(alignmentSetId);
    try {
      await axios.patch(`${API}/admin/group-alignment-sets/${alignmentSetId}`, payload, {
        headers: authHeaders(),
      });
      toast.success('Alignment set updated!');
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update alignment set'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteAlignmentSet = async (alignmentSetId: string): Promise<boolean> => {
    setBusy(alignmentSetId);
    try {
      await axios.delete(`${API}/admin/group-alignment-sets/${alignmentSetId}`, {
        headers: authHeaders(),
      });
      toast.success('Alignment set deleted');
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete alignment set'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addGroup = async (
    alignmentSetId: string,
    payload: { name: string; parent_id?: string | null; role?: 'conference' | 'division' | null },
  ): Promise<boolean> => {
    setBusy(alignmentSetId);
    try {
      await axios.post(`${API}/admin/group-alignment-sets/${alignmentSetId}/groups`, payload, {
        headers: authHeaders(),
      });
      toast.success('Group created!');
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create group'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const updateGroup = async (
    groupId: string,
    payload: { name?: string; role?: 'conference' | 'division' | null },
  ): Promise<boolean> => {
    setBusy(groupId);
    try {
      await axios.patch(`${API}/admin/group-alignment-sets/groups/${groupId}`, payload, {
        headers: authHeaders(),
      });
      toast.success('Group updated!');
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update group'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteGroup = async (groupId: string): Promise<boolean> => {
    setBusy(groupId);
    try {
      await axios.delete(`${API}/admin/group-alignment-sets/groups/${groupId}`, {
        headers: authHeaders(),
      });
      toast.success('Group deleted');
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete group'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const setGroupTeams = async (groupId: string, teamIds: string[]): Promise<boolean> => {
    setBusy(groupId);
    try {
      await axios.put(
        `${API}/admin/group-alignment-sets/groups/${groupId}/teams`,
        { team_ids: teamIds },
        { headers: authHeaders() },
      );
      toast.success('Alignment group teams updated!');
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update alignment group teams'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const setAlignmentTeams = async (
    alignmentSetId: string,
    teamIds: string[],
  ): Promise<boolean> => {
    setBusy(alignmentSetId);
    try {
      await axios.put(
        `${API}/admin/group-alignment-sets/${alignmentSetId}/teams`,
        { team_ids: teamIds },
        { headers: authHeaders() },
      );
      toast.success('Alignment teams updated!');
      await invalidate();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update alignment teams'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return {
    alignmentSets,
    loading,
    busy,
    fetchAlignmentSet,
    createAlignmentSet,
    updateAlignmentSet,
    deleteAlignmentSet,
    addGroup,
    updateGroup,
    deleteGroup,
    setGroupTeams,
    setAlignmentTeams,
  };
};

export default useGroupAlignmentSets;
