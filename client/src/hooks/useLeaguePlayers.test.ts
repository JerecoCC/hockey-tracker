import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import useLeaguePlayers from '@/hooks/useLeaguePlayers';

jest.mock('axios');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedAxios = jest.mocked(axios);

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const PLAYER = {
  id: 'player-1',
  first_name: 'Wayne',
  last_name: 'Gretzky',
  photo: null,
  date_of_birth: '1961-01-26',
  birth_city: 'Brantford',
  birth_country: 'CAN',
  nationality: 'CAN',
  height_cm: 183,
  weight_lbs: 185,
  position: 'C' as const,
  shoots: 'L' as const,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

const PLAYER_WITH_ROSTER = {
  ...PLAYER,
  jersey_number: 99,
  team_name: 'Oilers',
  primary_color: '#ff4500',
  text_color: '#ffffff',
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
  mockedAxios.get.mockResolvedValue({ data: [PLAYER] });
  (axios.isCancel as unknown as jest.Mock).mockReturnValue(false);
});

afterEach(() => localStorage.clear());

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
describe('useLeaguePlayers – fetch', () => {
  it('fetches players on mount and clears loading', async () => {
    const { result } = renderHook(() => useLeaguePlayers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.players).toEqual([PLAYER]);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/players'),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('starts with loading true', () => {
    const { result } = renderHook(() => useLeaguePlayers(), { wrapper: createWrapper() });
    expect(result.current.loading).toBe(true);
  });

  it('omits params when leagueId is not provided', async () => {
    const { result } = renderHook(() => useLeaguePlayers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/players'),
      expect.objectContaining({ params: undefined }),
    );
  });

  it('passes league_id as query param when leagueId is provided', async () => {
    const { result } = renderHook(() => useLeaguePlayers('league-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/players'),
      expect.objectContaining({ params: { league_id: 'league-1' } }),
    );
  });

  it('exposes optional roster fields from the API response', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [PLAYER_WITH_ROSTER] });
    const { result } = renderHook(() => useLeaguePlayers('league-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.players[0]).toMatchObject({
      jersey_number: 99,
      team_name: 'Oilers',
      primary_color: '#ff4500',
      text_color: '#ffffff',
    });
  });
});

// ---------------------------------------------------------------------------
// addPlayer
// ---------------------------------------------------------------------------
describe('useLeaguePlayers – addPlayer', () => {
  it('posts to /admin/players and shows success toast', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: PLAYER });
    const { result } = renderHook(() => useLeaguePlayers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean;
    await act(async () => {
      ok = await result.current.addPlayer({
        first_name: 'Wayne', last_name: 'Gretzky', position: 'C', shoots: 'L',
      });
    });
    expect(ok!).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/admin/players'),
      expect.any(Object),
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows error toast and returns false on failure', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useLeaguePlayers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean;
    await act(async () => {
      ok = await result.current.addPlayer({ first_name: 'Wayne', last_name: 'Gretzky' });
    });
    expect(ok!).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// bulkAddPlayers
// ---------------------------------------------------------------------------
describe('useLeaguePlayers – bulkAddPlayers', () => {
  it('posts to /admin/players/bulk and shows count toast', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { created: [PLAYER] } });
    const { result } = renderHook(() => useLeaguePlayers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean;
    await act(async () => {
      ok = await result.current.bulkAddPlayers([
        { first_name: 'Wayne', last_name: 'Gretzky', position: 'C', shoots: 'L' },
      ]);
    });
    expect(ok!).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/admin/players/bulk'),
      expect.objectContaining({ players: expect.any(Array) }),
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/1 player/i));
  });

  it('shows plural in success toast for multiple players', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { created: [PLAYER, PLAYER] } });
    const { result } = renderHook(() => useLeaguePlayers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.bulkAddPlayers([
        { first_name: 'Wayne', last_name: 'Gretzky', position: 'C', shoots: 'L' },
        { first_name: 'Mario', last_name: 'Lemieux', position: 'C', shoots: 'R' },
      ]);
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/2 players/i));
  });

  it('shows error toast and returns false on failure', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useLeaguePlayers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean;
    await act(async () => {
      ok = await result.current.bulkAddPlayers([
        { first_name: 'Wayne', last_name: 'Gretzky', position: 'C', shoots: 'L' },
      ]);
    });
    expect(ok!).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updatePlayer
// ---------------------------------------------------------------------------
describe('useLeaguePlayers – updatePlayer', () => {
  it('patches player and shows success toast', async () => {
    mockedAxios.patch.mockResolvedValueOnce({ data: { ...PLAYER, weight_lbs: 190 } });
    const { result } = renderHook(() => useLeaguePlayers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean;
    await act(async () => {
      ok = await result.current.updatePlayer('player-1', { weight_lbs: 190 });
    });
    expect(ok!).toBe(true);
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/players/player-1'),
      expect.any(Object),
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows error toast and returns false on failure', async () => {
    mockedAxios.patch.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useLeaguePlayers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean;
    await act(async () => {
      ok = await result.current.updatePlayer('player-1', { weight_lbs: 190 });
    });
    expect(ok!).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deletePlayer
// ---------------------------------------------------------------------------
describe('useLeaguePlayers – deletePlayer', () => {
  it('deletes a player and shows success toast', async () => {
    mockedAxios.delete.mockResolvedValueOnce({ data: { message: 'Player deleted' } });
    const { result } = renderHook(() => useLeaguePlayers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deletePlayer('player-1');
    });
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/admin/players/player-1'),
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows error toast on failure', async () => {
    mockedAxios.delete.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useLeaguePlayers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deletePlayer('player-1');
    });
    expect(toast.error).toHaveBeenCalled();
  });
});
