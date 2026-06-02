import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import useTeamPlayers, { type TeamPlayerRecord } from './useTeamPlayers';

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
  nationality: null,
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
});
