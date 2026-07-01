import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { useGameDetails, type GameRecord } from './useGames';
import useGameRoster, { type GameRosterEntry } from './useGameRoster';
import useGameLineup, { type LineupEntry } from './useGameLineup';
import useGameGoalieStats, { type GoalieStatRecord } from './useGameGoalieStats';
import useShootoutAttempts, { type ShootoutAttempt } from './useShootoutAttempts';

jest.mock('axios');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedAxios = jest.mocked(axios);

const createWrapper = (
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) => {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const GAME = {
  id: 'game-1',
  season_id: 'season-1',
  game_type: 'regular',
  status: 'scheduled',
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
    secondary_color: '#ea7200',
    text_color: '#ffffff',
  },
  away_team: {
    id: 'team-2',
    name: 'Kings',
    code: 'LAK',
    logo: null,
    primary_color: '#111111',
    secondary_color: '#a2aaad',
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
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
} as GameRecord;

const ROSTER_ENTRY: GameRosterEntry = {
  id: 'roster-1',
  game_id: 'game-1',
  team_id: 'team-1',
  player_id: 'player-1',
  first_name: 'John',
  last_name: 'Smith',
  photo: null,
  position: 'C',
  jersey_number: 12,
  date_of_birth: null,
  start_date: null,
  acquisition_type: null,
};

const LINEUP_ENTRY: LineupEntry = {
  id: 'lineup-1-F1',
  game_id: 'game-1',
  team_id: 'team-1',
  player_id: 'player-1',
  position_slot: 'F1',
  player_first_name: 'John',
  player_last_name: 'Smith',
  player_photo: null,
  jersey_number: 12,
};

const GOALIE_STAT: GoalieStatRecord = {
  id: 'goalie-stat-1',
  game_id: 'game-1',
  team_id: 'team-1',
  goalie_id: 'goalie-1',
  shots_against: 10,
  goals_against: 1,
  saves: 9,
  entered_period: null,
  sub_time: null,
  created_at: '2024-10-15T00:00:00Z',
  stints: [],
  goalie_first_name: 'Goalie',
  goalie_last_name: 'One',
  goalie_photo: null,
  goalie_jersey_number: 30,
  team_name: 'Sharks',
  team_code: 'SJS',
  team_logo: null,
  team_primary_color: '#006272',
  team_text_color: '#ffffff',
};

const ATTEMPT: ShootoutAttempt = {
  id: 'attempt-1',
  game_id: 'game-1',
  team_id: 'team-1',
  shooter_id: 'player-1',
  scored: true,
  attempt_order: 1,
  created_at: '2024-10-15T00:00:00Z',
  shooter_first_name: 'John',
  shooter_last_name: 'Smith',
  shooter_photo: null,
  shooter_jersey_number: 12,
  shooter_date_of_birth: null,
  shooter_start_date: null,
  shooter_acquisition_type: null,
  team_name: 'Sharks',
  team_code: 'SJS',
  team_logo: null,
  team_primary_color: '#006272',
  team_text_color: '#ffffff',
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
});

afterEach(() => localStorage.clear());

describe('game details mutation cache updates', () => {
  it('updates game detail and list caches after a game PATCH without refetching', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const listKey = ['games', { season_id: 'season-1' }];
    queryClient.setQueryData(['games', 'game-1'], GAME);
    queryClient.setQueryData(listKey, [GAME]);
    mockedAxios.get.mockResolvedValue({ data: GAME });
    mockedAxios.patch.mockResolvedValueOnce({ data: { ...GAME, status: 'in_progress' } });

    const { result } = renderHook(() => useGameDetails('game-1'), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedAxios.get.mockClear();

    await act(async () => {
      await result.current.updateStatus('in_progress');
    });

    expect(queryClient.getQueryData<GameRecord>(['games', 'game-1'])?.status).toBe('in_progress');
    expect(queryClient.getQueryData<GameRecord[]>(listKey)?.[0].status).toBe('in_progress');
    expect(queryClient.getQueryState(['games', 'game-1'])?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('updates game roster cache after adding players without refetching', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const rosterKey = ['game-roster', 'game-1'];
    const nextEntry = { ...ROSTER_ENTRY, id: 'roster-2', player_id: 'player-2' };
    queryClient.setQueryData(rosterKey, [ROSTER_ENTRY]);
    mockedAxios.get.mockResolvedValue({ data: [ROSTER_ENTRY] });
    mockedAxios.post.mockResolvedValueOnce({ data: [ROSTER_ENTRY, nextEntry] });

    const { result } = renderHook(() => useGameRoster('game-1'), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedAxios.get.mockClear();

    await act(async () => {
      await result.current.addToRoster('team-1', ['player-2']);
    });

    expect(queryClient.getQueryData<GameRosterEntry[]>(rosterKey)).toEqual([ROSTER_ENTRY, nextEntry]);
    expect(queryClient.getQueryState(rosterKey)?.isInvalidated).toBe(false);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('updates lineup cache after saving team lineup without refetching', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const lineupKey = ['game-lineup', 'game-1'];
    const goalieKey = ['game-goalie-stats', 'game-1'];
    const nextEntry = { ...LINEUP_ENTRY, position_slot: 'F2' as const };
    queryClient.setQueryData(lineupKey, [LINEUP_ENTRY]);
    queryClient.setQueryData(goalieKey, [GOALIE_STAT]);
    mockedAxios.get.mockResolvedValue({ data: [LINEUP_ENTRY] });
    mockedAxios.put.mockResolvedValueOnce({ data: [nextEntry] });

    const { result } = renderHook(() => useGameLineup('game-1'), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedAxios.get.mockClear();

    await act(async () => {
      await result.current.saveTeamLineup('team-1', [{ position_slot: 'F2', player_id: 'player-1' }]);
    });

    expect(queryClient.getQueryData<LineupEntry[]>(lineupKey)).toEqual([nextEntry]);
    expect(queryClient.getQueryState(lineupKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(goalieKey)?.isInvalidated).toBe(true);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('updates goalie stat cache after upsert without refetching', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const goalieKey = ['game-goalie-stats', 'game-1'];
    queryClient.setQueryData(goalieKey, []);
    mockedAxios.get.mockResolvedValue({ data: [] });
    mockedAxios.post.mockResolvedValueOnce({ data: [GOALIE_STAT] });

    const { result } = renderHook(() => useGameGoalieStats('game-1'), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedAxios.get.mockClear();

    await act(async () => {
      await result.current.upsertGoalieStat({
        goalie_id: 'goalie-1',
        team_id: 'team-1',
        shots_against: 10,
        goals_against: 1,
      });
    });

    expect(queryClient.getQueryData<GoalieStatRecord[]>(goalieKey)).toEqual([GOALIE_STAT]);
    expect(queryClient.getQueryState(goalieKey)?.isInvalidated).toBe(false);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('updates shootout attempt cache after adding an attempt without refetching', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const attemptsKey = ['shootout-attempts', 'game-1'];
    queryClient.setQueryData(attemptsKey, []);
    mockedAxios.get.mockResolvedValue({ data: [] });
    mockedAxios.post.mockResolvedValueOnce({ data: ATTEMPT });

    const { result } = renderHook(() => useShootoutAttempts('game-1'), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedAxios.get.mockClear();

    await act(async () => {
      await result.current.addAttempt({ team_id: 'team-1', shooter_id: 'player-1', scored: true });
    });

    expect(queryClient.getQueryData<ShootoutAttempt[]>(attemptsKey)).toEqual([ATTEMPT]);
    expect(queryClient.getQueryState(attemptsKey)?.isInvalidated).toBe(false);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
