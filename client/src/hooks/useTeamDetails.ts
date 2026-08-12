import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import type { AwardCompetitionScope } from '@/lib/awardDefinitions';
import { type CreateTeamData } from './useTeams';

import { API, authHeaders, getApiErrorMessage as apiError } from '@/lib/apiClient';

export interface TeamDetailRecord {
  id: string;
  name: string;
  place_name?: string | null;
  team_name?: string | null;
  code: string;
  description: string | null;
  location: string | null;
  city: string | null;
  home_arena: string | null;
  logo: string | null;
  logo_dark: string | null;
  logo_light: string | null;
  icon: string | null;
  league_id: string | null;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  league_name: string | null;
  league_code: string | null;
  league_logo: string | null;
  league_primary_color: string | null;
  league_text_color: string | null;
  created_at: string;
  start_season_id: string | null;
  latest_season_id: string | null;
  /** start_date of the first season this team was added to */
  start_season_start_date: string | null;
  /** end_date of the most recent season this team was added to (null = open-ended / present) */
  latest_season_end_date: string | null;
}

export interface TeamAwardRecord {
  id: string;
  award_id: string;
  season_award_id: string;
  award_name: string;
  award_description: string | null;
  competition_scope: AwardCompetitionScope | null;
  stat_key: string | null;
  season_id: string;
  season_name: string;
  awarded_at: string | null;
  team_id: string | null;
  team_name: string | null;
  team_place_name?: string | null;
  team_team_name?: string | null;
  team_code: string | null;
  team_logo: string | null;
  team_logo_dark?: string | null;
  team_logo_light?: string | null;
  team_primary_color: string | null;
  team_secondary_color: string | null;
  team_text_color: string | null;
}

export interface TeamSeasonRecord {
  id: string;
  name: string;
  league_id: string;
  start_date: string | null;
  started_at: string | null;
  end_date: string | null;
  is_current: boolean;
  is_ended: boolean;
  playoffs_started: boolean;
  created_at: string;
}


type TeamDetailsMode = 'admin' | 'user';

export const useTeamSeasons = (teamId: string | null | undefined) => {
  const { data: seasons = [], isLoading: loading } = useQuery<TeamSeasonRecord[]>({
    queryKey: ['team-seasons', teamId],
    queryFn: async () => {
      const { data } = await axios.get<TeamSeasonRecord[]>(
        `${API}/admin/teams/${teamId}/seasons`,
        { headers: authHeaders() },
      );
      return data;
    },
    enabled: !!teamId,
  });

  return { seasons, loading };
};

export const useTeamAwards = (
  teamId: string | null | undefined,
  options: { mode?: TeamDetailsMode } = {},
) => {
  const mode = options.mode ?? 'admin';
  const basePath = mode === 'user' ? 'user' : 'admin';

  const { data: awards = [], isLoading: loading } = useQuery<TeamAwardRecord[]>({
    queryKey: [mode === 'user' ? 'user-team-awards' : 'team-awards', teamId],
    queryFn: async () => {
      try {
        const { data } = await axios.get<TeamAwardRecord[]>(
          `${API}/${basePath}/teams/${teamId}/awards`,
          { headers: authHeaders() },
        );
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load team awards'));
        return [];
      }
    },
    enabled: !!teamId,
  });

  return { awards, loading };
};

const useTeamDetails = (id: string | undefined, options: { mode?: TeamDetailsMode } = {}) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const mode = options.mode ?? 'admin';
  const basePath = mode === 'user' ? 'user' : 'admin';

  const { data: team = null, isLoading: loading } = useQuery({
    queryKey: [mode === 'user' ? 'user-team-details' : 'teams', id],
    queryFn: async () => {
      try {
        const { data } = await axios.get<TeamDetailRecord>(`${API}/${basePath}/teams/${id}`, {
          headers: authHeaders(),
        });
        return data;
      } catch (err) {
        toast.error(apiError(err, 'Failed to load team'));
        return null;
      }
    },
    enabled: !!id,
  });

  const uploadLogo = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const { data } = await axios.post<{ url: string }>(`${API}/admin/teams/upload`, formData, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      return data.url;
    } catch (err) {
      toast.error(apiError(err, 'Failed to upload logo'));
      return null;
    }
  };

  const updateTeam = async (teamId: string, payload: Partial<CreateTeamData>): Promise<boolean> => {
    setBusy(teamId);
    try {
      await axios.patch(`${API}/admin/teams/${teamId}`, payload, { headers: authHeaders() });
      toast.success('Team updated!');
      await queryClient.invalidateQueries({ queryKey: ['teams', teamId] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      await queryClient.invalidateQueries({ queryKey: ['leagues'] });
      // Remove the specific league detail from cache so the league details page
      // fetches fresh data on next mount instead of flashing stale team info.
      if (team?.league_id) {
        queryClient.removeQueries({ queryKey: ['leagues', team.league_id] });
      }
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to update team'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { team, loading, busy, uploadLogo, updateTeam };
};

export default useTeamDetails;
