import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import useGameGoals from './useGameGoals';

jest.mock('axios');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedAxios = jest.mocked(axios);

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const GOAL = {
  id: 'goal-1', game_id: 'game-1', team_id: 'team-1',
  period: '1', goal_type: 'even-strength', empty_net: false,
  period_time: '10:23', scorer_id: 'player-1',
  assist_1_id: 'player-2', assist_2_id: null, created_at: '2024-10-15T00:00:00Z',
  team_name: 'Sharks', team_code: 'SJS', team_logo: null,
  team_primary_color: '#006272', team_text_color: '#ffffff',
  scorer_first_name: 'Joe', scorer_last_name: 'Smith',
  scorer_photo: null, scorer_jersey_number: 39,
  assist_1_first_name: 'Wayne', assist_1_last_name: 'Gretzky',
  assist_1_photo: null, assist_1_jersey_number: 99,
  assist_2_first_name: null, assist_2_last_name: null,
  assist_2_photo: null, assist_2_jersey_number: null,
  scorer_prior_goals: 2, assist_1_prior_assists: 5, assist_2_prior_assists: 0,
};

const POST_DATA = {
  team_id: 'team-1', period: '1', scorer_id: 'player-1',
  goal_type: 'even-strength' as const, empty_net: false, period_time: '10:23',
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
  mockedAxios.get.mockResolvedValue({ data: [GOAL] });
  (axios.isCancel as unknown as jest.Mock).mockReturnValue(false);
});

afterEach(() => localStorage.clear());

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
describe('useGameGoals – fetch', () => {
  it('fetches goals on mount and clears loading', async () => {
    const { result } = renderHook(() => useGameGoals('game-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.goals).toEqual([GOAL]);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/games/game-1/goals'),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('does not fetch when gameId is undefined', () => {
    const { result } = renderHook(() => useGameGoals(undefined), { wrapper: createWrapper() });
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(result.current.goals).toEqual([]);
  });

  it('returns empty array and shows error toast on fetch failure', async () => {
    mockedAxios.get.mockRejectedValueOnce({ response: { data: { error: 'Failed to load goals' } } });
    const { result } = renderHook(() => useGameGoals('game-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.goals).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith('Failed to load goals');
  });
});

// ---------------------------------------------------------------------------
// addGoal
// ---------------------------------------------------------------------------
describe('useGameGoals – addGoal', () => {
  it('posts to /admin/games/:id/goals and returns true', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: GOAL });
    const { result } = renderHook(() => useGameGoals('game-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean;
    await act(async () => { ok = await result.current.addGoal(POST_DATA); });

    expect(ok!).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/admin/games/game-1/goals'),
      POST_DATA,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('returns false and shows error toast on failure', async () => {
    mockedAxios.post.mockRejectedValueOnce({ response: { data: { error: 'Failed to record goal' } } });
    const { result } = renderHook(() => useGameGoals('game-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean;
    await act(async () => { ok = await result.current.addGoal(POST_DATA); });

    expect(ok!).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Failed to record goal');
  });

  it('returns false immediately when gameId is undefined', async () => {
    const { result } = renderHook(() => useGameGoals(undefined), { wrapper: createWrapper() });
    let ok: boolean;
    await act(async () => { ok = await result.current.addGoal(POST_DATA); });
    expect(ok!).toBe(false);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});


// ---------------------------------------------------------------------------
// updateGoal
// ---------------------------------------------------------------------------
describe('useGameGoals – updateGoal', () => {
  it('puts to /admin/games/:id/goals/:goalId and returns true', async () => {
    mockedAxios.put.mockResolvedValueOnce({ data: GOAL });
    const { result } = renderHook(() => useGameGoals('game-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean;
    await act(async () => { ok = await result.current.updateGoal('goal-1', POST_DATA); });

    expect(ok!).toBe(true);
    expect(mockedAxios.put).toHaveBeenCalledWith(
      expect.stringContaining('/admin/games/game-1/goals/goal-1'),
      POST_DATA,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('returns false and shows error toast on failure', async () => {
    mockedAxios.put.mockRejectedValueOnce({ response: { data: { error: 'Failed to update goal' } } });
    const { result } = renderHook(() => useGameGoals('game-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean;
    await act(async () => { ok = await result.current.updateGoal('goal-1', POST_DATA); });

    expect(ok!).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Failed to update goal');
  });

  it('returns false immediately when gameId is undefined', async () => {
    const { result } = renderHook(() => useGameGoals(undefined), { wrapper: createWrapper() });
    let ok: boolean;
    await act(async () => { ok = await result.current.updateGoal('goal-1', POST_DATA); });
    expect(ok!).toBe(false);
    expect(mockedAxios.put).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteGoal
// ---------------------------------------------------------------------------
describe('useGameGoals – deleteGoal', () => {
  it('deletes /admin/games/:id/goals/:goalId and returns true', async () => {
    mockedAxios.delete.mockResolvedValueOnce({});
    const { result } = renderHook(() => useGameGoals('game-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean;
    await act(async () => { ok = await result.current.deleteGoal('goal-1'); });

    expect(ok!).toBe(true);
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/admin/games/game-1/goals/goal-1'),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('returns false and shows error toast on failure', async () => {
    mockedAxios.delete.mockRejectedValueOnce({ response: { data: { error: 'Failed to delete goal' } } });
    const { result } = renderHook(() => useGameGoals('game-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean;
    await act(async () => { ok = await result.current.deleteGoal('goal-1'); });

    expect(ok!).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Failed to delete goal');
  });

  it('returns false immediately when gameId is undefined', async () => {
    const { result } = renderHook(() => useGameGoals(undefined), { wrapper: createWrapper() });
    let ok: boolean;
    await act(async () => { ok = await result.current.deleteGoal('goal-1'); });
    expect(ok!).toBe(false);
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });
});
