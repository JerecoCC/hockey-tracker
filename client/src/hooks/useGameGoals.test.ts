import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import useGameGoals from './useGameGoals';

jest.mock('axios');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedAxios = jest.mocked(axios);

const createWrapper = (queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const GOAL = {
  id: 'goal-1', game_id: 'game-1', team_id: 'team-1',
  period: '1', goal_type: 'even-strength', empty_net: false, penalty_shot: false,
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

const GOAL_2 = {
  ...GOAL,
  id: 'goal-2',
  period: '2',
  created_at: '2024-10-15T00:05:00Z',
};

const GAME = {
  id: 'game-1',
  season_id: 'season-1',
  game_type: 'regular',
  status: 'in_progress',
  scheduled_at: '2024-10-15T19:00:00Z',
  scheduled_time: '19:00',
  venue: null,
  time_start: null,
  time_end: null,
  home_team: {
    id: 'team-1',
    name: 'Sharks',
    code: 'SJS',
    logo: null,
    primary_color: '#006272',
    secondary_color: '#EA7200',
    text_color: '#ffffff',
  },
  away_team: {
    id: 'team-2',
    name: 'Kings',
    code: 'LAK',
    logo: null,
    primary_color: '#111111',
    secondary_color: '#A2AAAD',
    text_color: '#ffffff',
  },
  home_score: 0,
  away_score: 0,
  overtime_periods: null,
  shootout: false,
  winner_team_id: null,
  shootout_first_team_id: null,
  playoff_series_id: null,
  game_number_in_series: null,
  game_number: null,
  playoff_round: null,
  series_home_team_id: null,
  series_away_team_id: null,
  series_home_wins: null,
  series_away_wins: null,
  series_games_to_win: null,
  notes: null,
  created_at: '2024-09-01T00:00:00Z',
  current_period: '1',
  period_scores: [
    { period: '1', home_goals: 0, away_goals: 0 },
    { period: '2', home_goals: 0, away_goals: 0 },
    { period: '3', home_goals: 0, away_goals: 0 },
  ],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
};

const POST_DATA = {
  team_id: 'team-1', period: '1', scorer_id: 'player-1',
  goal_type: 'even-strength' as const, empty_net: false, penalty_shot: false, period_time: '10:23',
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
    mockedAxios.get.mockClear();

    let ok: boolean;
    await act(async () => { ok = await result.current.addGoal(POST_DATA); });

    expect(ok!).toBe(true);
    expect(mockedAxios.get).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.goals).toEqual([GOAL]));
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/admin/games/game-1/goals'),
      POST_DATA,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('updates game caches without invalidating game list queries', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const goalieKey = ['game-goalie-stats', 'game-1'];
    const playerStatsKey = ['player-game-logs', 'player-1'];
    queryClient.setQueryData(['games', 'game-1'], GAME);
    queryClient.setQueryData(['games', {}], [GAME]);
    queryClient.setQueryData(goalieKey, []);
    queryClient.setQueryData(playerStatsKey, []);
    mockedAxios.post.mockResolvedValueOnce({ data: GOAL });

    const { result } = renderHook(() => useGameGoals('game-1'), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedAxios.get.mockClear();

    await act(async () => {
      await result.current.addGoal(POST_DATA);
    });

    const cachedGame = queryClient.getQueryData<typeof GAME>(['games', 'game-1']);
    expect(cachedGame?.home_score).toBe(1);
    expect(cachedGame?.away_score).toBe(0);
    expect(cachedGame?.period_scores).toEqual([
      { period: '1', home_goals: 1, away_goals: 0 },
      { period: '2', home_goals: 0, away_goals: 0 },
      { period: '3', home_goals: 0, away_goals: 0 },
    ]);
    expect(queryClient.getQueryState(['games', 'game-1'])?.isInvalidated).toBe(false);
    const cachedGames = queryClient.getQueryData<typeof GAME[]>(['games', {}]);
    expect(cachedGames?.[0].home_score).toBe(1);
    expect(cachedGames?.[0].away_score).toBe(0);
    expect(cachedGames?.[0].period_scores).toEqual([
      { period: '1', home_goals: 1, away_goals: 0 },
      { period: '2', home_goals: 0, away_goals: 0 },
      { period: '3', home_goals: 0, away_goals: 0 },
    ]);
    expect(queryClient.getQueryState(['games', {}])?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(goalieKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(playerStatsKey)?.isInvalidated).toBe(true);
    expect(mockedAxios.get).not.toHaveBeenCalled();
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
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const goalieKey = ['game-goalie-stats', 'game-1'];
    const playerStatsKey = ['player-game-logs', 'player-1'];
    queryClient.setQueryData(goalieKey, []);
    queryClient.setQueryData(playerStatsKey, []);
    const updatedGoal = { ...GOAL, period: '2' };
    mockedAxios.put.mockResolvedValueOnce({ data: updatedGoal });
    const { result } = renderHook(() => useGameGoals('game-1'), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedAxios.get.mockClear();

    let ok: boolean;
    await act(async () => { ok = await result.current.updateGoal('goal-1', POST_DATA); });

    expect(ok!).toBe(true);
    expect(mockedAxios.get).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.goals).toEqual([updatedGoal]));
    expect(mockedAxios.put).toHaveBeenCalledWith(
      expect.stringContaining('/admin/games/game-1/goals/goal-1'),
      POST_DATA,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(queryClient.getQueryState(goalieKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(playerStatsKey)?.isInvalidated).toBe(true);
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
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const goalieKey = ['game-goalie-stats', 'game-1'];
    const playerStatsKey = ['player-game-logs', 'player-1'];
    queryClient.setQueryData(goalieKey, []);
    queryClient.setQueryData(playerStatsKey, []);
    mockedAxios.delete.mockResolvedValueOnce({});
    mockedAxios.get.mockResolvedValueOnce({ data: [GOAL, GOAL_2] });
    const { result } = renderHook(() => useGameGoals('game-1'), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedAxios.get.mockClear();

    let ok: boolean;
    await act(async () => { ok = await result.current.deleteGoal('goal-1'); });

    expect(ok!).toBe(true);
    expect(mockedAxios.get).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.goals).toEqual([GOAL_2]));
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/admin/games/game-1/goals/goal-1'),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(queryClient.getQueryState(goalieKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(playerStatsKey)?.isInvalidated).toBe(true);
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
