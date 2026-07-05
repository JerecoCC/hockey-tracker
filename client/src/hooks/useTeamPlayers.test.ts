import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import useTeamPlayers, {
  usePlayerTradeHistory,
  useStintActions,
  type TeamPlayerRecord,
} from './useTeamPlayers';

jest.mock('axios');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedAxios = jest.mocked(axios);

const createWrapper = (
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) => {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const PLAYER: TeamPlayerRecord = {
  id: 'player-1',
  first_name: 'John',
  last_name: 'Smith',
  photo: null,
  date_of_birth: null,
  birth_city: null,
  birth_country: null,
  height_cm: null,
  weight_lbs: null,
  position: 'C',
  shoots: 'L',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  player_team_id: 'player-team-1',
  jersey_number: 12,
  team_id: 'team-1',
  team_name: 'Sharks',
  primary_color: '#006272',
  text_color: '#ffffff',
  is_prospect: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
  mockedAxios.get.mockResolvedValue({ data: [PLAYER] });
});

afterEach(() => localStorage.clear());

describe('useTeamPlayers roster updates', () => {
  it('updates the roster cache without invalidating or refetching team players', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const rosterKey = [
      'players',
      { team_id: 'team-1', season_id: 'season-1', includeProspects: true },
    ];
    queryClient.setQueryData(rosterKey, [PLAYER]);
    mockedAxios.patch.mockResolvedValueOnce({});

    const { result } = renderHook(
      () => useTeamPlayers('team-1', 'season-1', { includeProspects: true }),
      { wrapper: createWrapper(queryClient) },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedAxios.get.mockClear();

    await act(async () => {
      await result.current.updatePlayerTeam('player-1', 'team-1', 'season-1', {
        jersey_number: 19,
        photo: 'https://example.com/player.jpg',
      });
    });

    const cachedRoster = queryClient.getQueryData<TeamPlayerRecord[]>(rosterKey);
    expect(cachedRoster?.[0]).toMatchObject({
      id: 'player-1',
      jersey_number: 19,
      photo: 'https://example.com/player.jpg',
    });
    expect(queryClient.getQueryState(rosterKey)?.isInvalidated).toBe(false);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('updates player info in cached roster rows without invalidating team players', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const rosterKey = [
      'players',
      { team_id: 'team-1', season_id: 'season-1', includeProspects: true },
    ];
    queryClient.setQueryData(rosterKey, [PLAYER]);
    mockedAxios.patch.mockResolvedValueOnce({});

    const { result } = renderHook(
      () => useTeamPlayers('team-1', 'season-1', { includeProspects: true }),
      { wrapper: createWrapper(queryClient) },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedAxios.get.mockClear();

    await act(async () => {
      await result.current.updatePlayer('player-1', {
        first_name: 'Jane',
        last_name: 'Doe',
        position: 'D',
      });
    });

    const cachedRoster = queryClient.getQueryData<TeamPlayerRecord[]>(rosterKey);
    expect(cachedRoster?.[0]).toMatchObject({
      id: 'player-1',
      first_name: 'Jane',
      last_name: 'Doe',
      position: 'D',
    });
    expect(queryClient.getQueryState(rosterKey)?.isInvalidated).toBe(false);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('removes only the matching season roster row from cached team players', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const season2025Key = ['players', { team_id: 'team-1', season_id: 'season-2025' }];
    const season2026Key = ['players', { team_id: 'team-1', season_id: 'season-2026' }];
    const player2025 = { ...PLAYER, player_team_id: 'player-team-2025' };
    const player2026 = { ...PLAYER, player_team_id: 'player-team-2026', is_prospect: true };
    queryClient.setQueryData(season2025Key, [player2025]);
    queryClient.setQueryData(season2026Key, [player2026]);
    mockedAxios.delete.mockResolvedValueOnce({});

    const { result } = renderHook(
      () => useTeamPlayers(undefined, 'season-2026'),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.removePlayerFromTeam(player2026);
    });

    expect(queryClient.getQueryData<TeamPlayerRecord[]>(season2025Key)).toEqual([player2025]);
    expect(queryClient.getQueryData<TeamPlayerRecord[]>(season2026Key)).toEqual([]);
  });

  it('updates prospect status only on the matching season roster row', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const season2025Key = ['players', { team_id: 'team-1', season_id: 'season-2025' }];
    const season2026Key = ['players', { team_id: 'team-1', season_id: 'season-2026', prospectsOnly: true }];
    const player2025 = { ...PLAYER, player_team_id: 'player-team-2025', is_prospect: false };
    const player2026 = { ...PLAYER, player_team_id: 'player-team-2026', is_prospect: true };
    queryClient.setQueryData(season2025Key, [player2025]);
    queryClient.setQueryData(season2026Key, [player2026]);
    mockedAxios.patch.mockResolvedValueOnce({});

    const { result } = renderHook(
      () => useTeamPlayers(undefined, 'season-2026', { prospectsOnly: true }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.updatePlayerRosterRole(player2026, false);
    });

    expect(queryClient.getQueryData<TeamPlayerRecord[]>(season2025Key)).toEqual([player2025]);
    expect(queryClient.getQueryData<TeamPlayerRecord[]>(season2026Key)).toEqual([]);
  });
});

describe('usePlayerTradeHistory', () => {
  it('does not immediately refetch cached history after a remount', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = createWrapper(queryClient);

    const first = renderHook(() => usePlayerTradeHistory('player-1'), { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);

    first.unmount();

    const second = renderHook(() => usePlayerTradeHistory('player-1'), { wrapper });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.stints).toEqual([PLAYER]);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });
});

describe('useStintActions', () => {
  it('updates a jersey history row and refreshes related player data', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    mockedAxios.patch.mockResolvedValueOnce({});

    const { result } = renderHook(() => useStintActions('player-1'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.updateJerseyHistoryEntry('jersey-1', {
          jersey_number: 72,
          effective_from: '2026-01-25',
        }),
      ).resolves.toBe(true);
    });

    expect(mockedAxios.patch).toHaveBeenCalledWith(
      '/api/admin/player-teams/history/jerseys/jersey-1',
      { jersey_number: 72, effective_from: '2026-01-25' },
      { headers: { Authorization: 'Bearer test-token' } },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['jersey-history', 'player-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['player-trade-history', 'player-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['players'] });
  });

  it('deletes a jersey history row and refreshes related player data', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    mockedAxios.delete.mockResolvedValueOnce({});

    const { result } = renderHook(() => useStintActions('player-1'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.deleteJerseyHistoryEntry('jersey-1')).resolves.toBe(true);
    });

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      '/api/admin/player-teams/history/jerseys/jersey-1',
      { headers: { Authorization: 'Bearer test-token' } },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['jersey-history', 'player-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['player-trade-history', 'player-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['players'] });
  });

  it('deletes a season photo and refreshes related player data', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    mockedAxios.delete.mockResolvedValueOnce({});

    const { result } = renderHook(() => useStintActions('player-1'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.deletePlayerPhoto('photo-1')).resolves.toBe(true);
    });

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      '/api/admin/player-teams/history/photos/photo-1',
      { headers: { Authorization: 'Bearer test-token' } },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['player-photo-history', 'player-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['player-trade-history', 'player-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['players'] });
  });

  it('deletes a stint and refreshes related player data', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    mockedAxios.delete.mockResolvedValueOnce({});

    const { result } = renderHook(() => useStintActions('player-1'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.deleteStint('stint-1')).resolves.toBe(true);
    });

    expect(mockedAxios.delete).toHaveBeenCalledWith('/api/admin/player-teams/stint-1', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['player-trade-history', 'player-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['players'] });
  });
});

