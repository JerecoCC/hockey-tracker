import axios from 'axios';
import { autofillGameFromPwhlGamecenter } from './pwhlGameAutofill';
import type { GameRecord } from '@/hooks/useGames';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

type MockPostBody = {
  players?: Array<Record<string, unknown>>;
  team_id?: string;
  [key: string]: unknown;
};

const game = {
  id: 'game-1',
  season_id: 'season-1',
  league_id: 'league-pwhl',
  league_code: 'PWHL',
  league_name: 'PWHL',
  season_name: '2025-26',
  game_type: 'regular',
  status: 'scheduled',
  scheduled_at: '2025-11-21T12:00:00Z',
  scheduled_time: '19:00',
  venue: null,
  time_start: null,
  time_end: null,
  home_team: {
    id: 'min-team',
    name: 'Minnesota Frost',
    code: 'MIN',
    logo: null,
    primary_color: '#211c36',
    secondary_color: '#6aa7c8',
    text_color: '#ffffff',
  },
  away_team: {
    id: 'tor-team',
    name: 'Toronto Sceptres',
    code: 'TOR',
    logo: null,
    primary_color: '#143c2c',
    secondary_color: '#d6b36a',
    text_color: '#ffffff',
  },
  overtime_periods: null,
  shootout: false,
  shootout_first_team_id: null,
  playoff_series_id: null,
  game_number_in_series: null,
  game_number: null,
  league_game_number: null,
  playoff_round: null,
  series_home_team_id: null,
  series_away_team_id: null,
  series_home_wins: null,
  series_away_wins: null,
  series_games_to_win: null,
  notes: null,
  created_at: '2025-11-01T00:00:00Z',
  current_period: '1',
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
} as unknown as GameRecord;

const player = (
  id: number,
  firstName: string,
  lastName: string,
  jerseyNumber: number,
  position: string,
  stats: Record<string, unknown> = {},
  starting = 0,
) => ({
  info: {
    id,
    firstName,
    lastName,
    jerseyNumber,
    position,
    birthDate: '',
    playerImageURL: `https://assets.leaguestat.com/pwhl/120x160/${id}.jpg`,
  },
  stats,
  starting,
  status: '',
});

const summary = {
  details: {
    id: 210,
    date: 'Friday, November 21, 2025',
    gameNumber: '1',
    venue: 'Grand Casino Arena | St. Paul',
    startTime: '6:21 pm EST',
    endTime: '8:38 pm EST',
    started: '1',
    final: '1',
    status: 'Final',
    seasonId: '8',
    GameDateISO8601: '2025-11-21T19:00:00-05:00',
  },
  hasShootout: false,
  visitingTeam: {
    info: { id: 6, name: 'Toronto Sceptres', abbreviation: 'TOR' },
    skaters: [player(317, 'Kiara', 'Zanon', 11, 'LW', { toi: '9:43' })],
    goalies: [
      player(211, 'Raygan', 'Kirk', 1, 'G', {
        timeOnIce: '59:35',
        shotsAgainst: 31,
        goalsAgainst: 1,
        saves: 30,
      }, 1),
    ],
    goalieLog: [
      {
        info: player(211, 'Raygan', 'Kirk', 1, 'G').info,
        stats: { timeOnIce: '59:35', shotsAgainst: 31, goalsAgainst: 1, saves: 30 },
        periodStart: { id: '1' },
        timeStart: '0:00',
        periodEnd: { id: '3' },
        timeEnd: '20:00',
      },
    ],
  },
  homeTeam: {
    info: { id: 2, name: 'Minnesota Frost', abbreviation: 'MIN' },
    skaters: [
      player(20, 'Kendall', 'Coyne Schofield', 26, 'LW', { shots: 2, toi: '17:03' }),
      player(23, 'Kelly', 'Pannek', 12, 'C', { assists: 1, toi: '15:50' }),
    ],
    goalies: [
      player(123, 'Maddie', 'Rooney', 35, 'G', {
        timeOnIce: '58:48',
        shotsAgainst: 19,
        goalsAgainst: 2,
        saves: 17,
      }, 1),
    ],
    goalieLog: {
      info: player(123, 'Maddie', 'Rooney', 35, 'G').info,
      stats: { timeOnIce: '58:48', shotsAgainst: 19, goalsAgainst: 2, saves: 17 },
      periodStart: { id: '1' },
      timeStart: '0:00',
      periodEnd: { id: '3' },
      timeEnd: '18:48',
    },
  },
  periods: [
    {
      info: { id: '1', shortName: '1', longName: '1st' },
      stats: { homeGoals: '1', homeShots: '11', visitingGoals: '0', visitingShots: '6' },
      goals: [
        {
          game_goal_id: '1058',
          team: { id: 2, abbreviation: 'MIN' },
          period: { id: '1' },
          time: '4:00',
          scoredBy: player(20, 'Kendall', 'Coyne Schofield', 26, 'LW').info,
          assists: [player(23, 'Kelly', 'Pannek', 12, 'C').info],
          properties: {
            isPowerPlay: '0',
            isShortHanded: '0',
            isEmptyNet: '0',
            isPenaltyShot: '0',
          },
        },
      ],
    },
    {
      info: { id: '2', shortName: '2', longName: '2nd' },
      stats: { homeGoals: '0', homeShots: '8', visitingGoals: '0', visitingShots: '8' },
      goals: [],
    },
    {
      info: { id: '3', shortName: '3', longName: '3rd' },
      stats: { homeGoals: '0', homeShots: '12', visitingGoals: '0', visitingShots: '5' },
      goals: [],
    },
  ],
  mostValuablePlayers: [
    { player: { info: player(211, 'Raygan', 'Kirk', 1, 'G').info } },
    { player: { info: player(20, 'Kendall', 'Coyne Schofield', 26, 'LW').info } },
    { player: { info: player(317, 'Kiara', 'Zanon', 11, 'LW').info } },
  ],
};

describe('autofillGameFromPwhlGamecenter', () => {
  let extraPlayers: Array<Record<string, unknown>>;
  let createdPlayerStore: Map<string, Record<string, unknown>>;
  let currentSummary: typeof summary;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'token');
    extraPlayers = [];
    createdPlayerStore = new Map();
    currentSummary = summary;

    mockedAxios.get.mockImplementation((url, config) => {
      const u = String(url);
      if (u.endsWith('/admin/games/pwhl-api')) {
        const targetUrl = String(config?.params?.url ?? '');
        if (targetUrl.includes('view=gameSummary')) return Promise.resolve({ data: currentSummary });
        if (targetUrl.includes('view=gameCenterPlayByPlay')) return Promise.resolve({ data: [] });
      }
      if (u.endsWith('/admin/games/game-1/goals')) return Promise.resolve({ data: [] });
      if (u.endsWith('/admin/games/game-1/goalie-stints')) return Promise.resolve({ data: [] });
      if (u.endsWith('/admin/games/game-1/roster')) return Promise.resolve({ data: [] });
      if (u.endsWith('/admin/players')) {
        if (config?.params?.league_id && !config?.params?.team_id) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({
          data: extraPlayers.filter((row) => row.team_id === config?.params?.team_id),
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    mockedAxios.post.mockImplementation((url, body) => {
      const u = String(url);
      const postBody = (body ?? {}) as MockPostBody;
      if (u.endsWith('/admin/players/bulk')) {
        const created = (postBody.players ?? []).map((row) => {
          const id = `auto-${row.league_player_number}`;
          createdPlayerStore.set(id, row);
          return { id };
        });
        return Promise.resolve({ data: { created } });
      }
      if (u.endsWith('/admin/player-teams/bulk')) {
        for (const row of postBody.players ?? []) {
          const playerId = String(row.player_id ?? '');
          const playerRecord = createdPlayerStore.get(playerId) ?? {};
          extraPlayers.push({
            id: playerId,
            team_id: postBody.team_id,
            jersey_number: row.jersey_number,
            league_player_number: playerRecord.league_player_number,
            first_name: playerRecord.first_name,
            last_name: playerRecord.last_name,
            position: playerRecord.position,
          });
        }
        return Promise.resolve({ data: { created: postBody.players ?? [], skipped: 0 } });
      }
      if (u.endsWith('/admin/games/game-1/roster')) return Promise.resolve({ data: [] });
      if (u.endsWith('/admin/games/game-1/goals')) {
        return Promise.resolve({ data: { id: 'goal-1', game_id: 'game-1', ...postBody } });
      }
      if (u.endsWith('/admin/games/game-1/goalie-stints')) return Promise.resolve({ data: [] });
      return Promise.reject(new Error(`Unexpected POST ${url}`));
    });

    mockedAxios.put.mockResolvedValue({ data: {} });
    mockedAxios.patch.mockResolvedValue({ data: {} });
    mockedAxios.delete.mockResolvedValue({ data: {} });
  });

  it('fills a PWHL game and creates missing players with league player numbers', async () => {
    const result = await autofillGameFromPwhlGamecenter(game, '210');

    expect(result.summary).toEqual(
      expect.objectContaining({
        gameId: '210',
        goalsCreated: 1,
        rosterPlayers: 5,
        goalieStints: 2,
        startingGoaliesSet: 2,
      }),
    );

    const createdPlayers = mockedAxios.post.mock.calls
      .filter(([url]) => String(url).endsWith('/admin/players/bulk'))
      .flatMap(([, body]) => ((body ?? {}) as MockPostBody).players ?? []);
    expect(createdPlayers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ first_name: 'Kiara', last_name: 'Zanon', league_player_number: '317' }),
        expect.objectContaining({ first_name: 'Raygan', last_name: 'Kirk', league_player_number: '211' }),
        expect.objectContaining({ first_name: 'Maddie', last_name: 'Rooney', league_player_number: '123' }),
      ]),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('league player number 317'),
        expect.stringContaining('league player number 20'),
      ]),
    );
    expect(result.warnings.join(' ')).not.toContain('#11 Kiara Zanon');

    expect(mockedAxios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/games/game-1'),
      expect.objectContaining({
        league_game_number: '210',
        status: 'in_progress',
        scheduled_at: '2025-11-21',
      }),
      expect.anything(),
    );
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/games/game-1'),
      expect.objectContaining({
        status: 'final',
        star_1_id: 'auto-211',
        star_2_id: 'auto-20',
        star_3_id: 'auto-317',
      }),
      expect.anything(),
    );

    const goalieStints = mockedAxios.post.mock.calls
      .filter(([url]) => String(url).endsWith('/admin/games/game-1/goalie-stints'))
      .map(([, body]) => body);
    expect(goalieStints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          goalie_id: 'auto-211',
          time_on_ice: 3575,
          shots_against: 31,
          exited_period: null,
          exited_time: null,
        }),
        expect.objectContaining({
          goalie_id: 'auto-123',
          time_on_ice: 3528,
          exited_period: null,
          exited_time: null,
        }),
      ]),
    );
  });

  it('collapses split PWHL goalie log rows when a team did not switch goalies', async () => {
    currentSummary = {
      ...summary,
      visitingTeam: {
        ...summary.visitingTeam,
        goalieLog: [
          {
            info: player(211, 'Raygan', 'Kirk', 1, 'G').info,
            stats: { timeOnIce: '20:00', shotsAgainst: 9, goalsAgainst: 0, saves: 9 },
            periodStart: { id: '1' },
            timeStart: '0:00',
            periodEnd: { id: '1' },
            timeEnd: '20:00',
          },
          {
            info: player(211, 'Raygan', 'Kirk', 1, 'G').info,
            stats: { timeOnIce: '39:35', shotsAgainst: 22, goalsAgainst: 1, saves: 21 },
            periodStart: { id: '2' },
            timeStart: '0:00',
            periodEnd: { id: '3' },
            timeEnd: '19:35',
          },
        ],
      },
    };

    const result = await autofillGameFromPwhlGamecenter(game, '210');

    expect(result.summary.goalieStints).toBe(2);

    const goalieStints = mockedAxios.post.mock.calls
      .filter(([url]) => String(url).endsWith('/admin/games/game-1/goalie-stints'))
      .map(([, body]) => body as Record<string, unknown>);
    const awayStints = goalieStints.filter((stint) => stint.goalie_id === 'auto-211');

    expect(awayStints).toHaveLength(1);
    expect(awayStints[0]).toEqual(
      expect.objectContaining({
        time_on_ice: 3575,
        shots_against: 31,
        goals_against: 1,
        entered_period: '1',
        entered_time: null,
        exited_period: null,
        exited_time: null,
      }),
    );
  });

  it('keeps separate PWHL goalie log rows when a team switches goalies', async () => {
    currentSummary = {
      ...summary,
      visitingTeam: {
        ...summary.visitingTeam,
        goalies: [
          player(211, 'Raygan', 'Kirk', 1, 'G', {
            timeOnIce: '29:35',
            shotsAgainst: 17,
            goalsAgainst: 1,
            saves: 16,
          }, 1),
          player(212, 'Elaine', 'Chuli', 29, 'G', {
            timeOnIce: '30:00',
            shotsAgainst: 14,
            goalsAgainst: 0,
            saves: 14,
          }),
        ],
        goalieLog: [
          {
            info: player(211, 'Raygan', 'Kirk', 1, 'G').info,
            stats: { timeOnIce: '29:35', shotsAgainst: 17, goalsAgainst: 1, saves: 16 },
            periodStart: { id: '1' },
            timeStart: '0:00',
            periodEnd: { id: '2' },
            timeEnd: '9:35',
          },
          {
            info: player(212, 'Elaine', 'Chuli', 29, 'G').info,
            stats: { timeOnIce: '30:00', shotsAgainst: 14, goalsAgainst: 0, saves: 14 },
            periodStart: { id: '2' },
            timeStart: '9:35',
            periodEnd: { id: '3' },
            timeEnd: '20:00',
          },
        ],
      },
    };

    const result = await autofillGameFromPwhlGamecenter(game, '210');

    expect(result.summary.goalieStints).toBe(3);

    const goalieStints = mockedAxios.post.mock.calls
      .filter(([url]) => String(url).endsWith('/admin/games/game-1/goalie-stints'))
      .map(([, body]) => body as Record<string, unknown>);

    expect(goalieStints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          goalie_id: 'auto-211',
          entered_period: '1',
          entered_time: null,
          exited_period: '2',
          exited_time: '9:35',
          time_on_ice: 1775,
        }),
        expect.objectContaining({
          goalie_id: 'auto-212',
          entered_period: '2',
          entered_time: '9:35',
          exited_period: null,
          exited_time: null,
          time_on_ice: 1800,
        }),
      ]),
    );
  });

  it('labels PWHL jersey conflicts with league player numbers when available', async () => {
    extraPlayers.push({
      id: 'wrong-player',
      team_id: 'min-team',
      league_player_number: '999',
      first_name: 'Wrong',
      last_name: 'Player',
      jersey_number: 26,
      position: 'F',
    });

    await expect(autofillGameFromPwhlGamecenter(game, '210')).rejects.toThrow(
      'league player number 20 conflicts with league player number 999',
    );
  });
});
