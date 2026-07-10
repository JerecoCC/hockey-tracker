import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import type { DraftDateLookupRow } from '@/lib/draftDates';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

export interface LeagueDraftDateRecord extends DraftDateLookupRow {
  id: string;
  league_id: string;
  draft_year: number;
  start_round: number;
  end_round: number;
  draft_date: string;
  notes: string | null;
  created_at: string;
}

export interface LeagueDraftDatePayload {
  draft_year: number;
  start_round: number;
  end_round: number;
  draft_date: string;
  notes?: string | null;
}

export interface LeagueDraftEventDayPayload {
  draft_date: string;
  start_round: number;
  end_round: number;
}

export interface LeagueDraftEventPayload {
  draft_year: number;
  start_date: string;
  end_date: string;
  total_rounds: number;
  days: LeagueDraftEventDayPayload[];
}

const useLeagueDraftDates = (
  leagueId: string | null | undefined,
  options: { enabled?: boolean } = {},
) => {
  const queryClient = useQueryClient();
  const queryKey = ['league-draft-dates', leagueId];
  const enabled = options.enabled !== false && !!leagueId;

  const { data = [], isLoading } = useQuery<LeagueDraftDateRecord[]>({
    queryKey,
    queryFn: async () => {
      try {
        const { data } = await axios.get<LeagueDraftDateRecord[]>(
          `${API}/admin/leagues/${leagueId}/draft-dates`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load draft dates'));
        return [];
      }
    },
    enabled,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey });
  };

  const createDraftDate = async (payload: LeagueDraftDatePayload): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/leagues/${leagueId}/draft-dates`, payload, {
        headers: authHeaders(),
      });
      toast.success('Draft date created');
      await refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create draft date'));
      return false;
    }
  };

  const updateDraftDate = async (
    draftDateId: string,
    payload: Partial<LeagueDraftDatePayload>,
  ): Promise<boolean> => {
    try {
      await axios.patch(`${API}/admin/leagues/${leagueId}/draft-dates/${draftDateId}`, payload, {
        headers: authHeaders(),
      });
      toast.success('Draft date updated');
      await refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update draft date'));
      return false;
    }
  };

  const createDraftEvent = async (payload: LeagueDraftEventPayload): Promise<boolean> => {
    try {
      await axios.post(`${API}/admin/leagues/${leagueId}/draft-dates/events`, payload, {
        headers: authHeaders(),
      });
      toast.success('Draft created');
      await refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to create draft'));
      return false;
    }
  };

  const updateDraftEvent = async (
    draftYear: number,
    payload: LeagueDraftEventPayload,
  ): Promise<boolean> => {
    try {
      await axios.put(`${API}/admin/leagues/${leagueId}/draft-dates/events/${draftYear}`, payload, {
        headers: authHeaders(),
      });
      toast.success('Draft updated');
      await refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update draft'));
      return false;
    }
  };

  const deleteDraftEvent = async (draftYear: number): Promise<boolean> => {
    try {
      await axios.delete(`${API}/admin/leagues/${leagueId}/draft-dates/events/${draftYear}`, {
        headers: authHeaders(),
      });
      toast.success('Draft removed');
      await refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to remove draft'));
      return false;
    }
  };

  const deleteDraftDate = async (draftDateId: string): Promise<boolean> => {
    try {
      await axios.delete(`${API}/admin/leagues/${leagueId}/draft-dates/${draftDateId}`, {
        headers: authHeaders(),
      });
      toast.success('Draft date removed');
      await refresh();
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to remove draft date'));
      return false;
    }
  };

  return {
    draftDates: data,
    loading: isLoading,
    createDraftDate,
    updateDraftDate,
    createDraftEvent,
    updateDraftEvent,
    deleteDraftEvent,
    deleteDraftDate,
  };
};

export default useLeagueDraftDates;
