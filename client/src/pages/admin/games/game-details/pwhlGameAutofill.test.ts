import axios from 'axios';
import { autofillGameFromPwhlGamecenter } from './pwhlGameAutofill';
import type { GameRecord } from '@/hooks/useGames';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

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

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'token');
    extraPlayers = [];
    createdPlayerStore = new Map();

    mockedAxios.get.mockImplementation((url, config) => {
      const u = String(url);
      if (u.endsWith('/admin/games/pwhl-api')) {
        const targetUrl = String(config?.params?.url ?? '');
        if (targetUrl.includes('view=gameSummary')) return Promise.resolve({ data: summary });
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

    mockedAxios.post.mockImplementation((url, body: any) => {
      const u = String(url);
      if (u.endsWith('/admin/players/bulk')) {
        const created = (body?.players ?? []).map((row: any) => {
          const id = `auto-${row.league_player_number}`;
          createdPlayerStore.set(id, row);
          return { id };
        });
        return Promise.resolve({ data: { created } });
      }
      if (u.endsWith('/admin/player-teams/bulk')) {
        for (const row of body?.players ?? []) {
          const playerRecord = createdPlayerStore.get(row.player_id) ?? {};
          extraPlayers.push({
            id: row.player_id,
            team_id: body.team_id,
            jersey_number: row.jersey_number,
            league_player_number: playerRecord.league_player_number,
            first_name: playerRecord.first_name,
            last_name: playerRecord.last_name,
            position: playerRecord.position,
          });
        }
        return Promise.resolve({ data: { created: body?.players ?? [], skipped: 0 } });
      }
      if (u.endsWith('/admin/games/game-1/roster')) return Promise.resolve({ data: [] });
      if (u.endsWith('/admin/games/game-1/goals')) {
        return Promise.resolve({ data: { id: 'goal-1', game_id: 'game-1', ...body } });
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
      .flatMap(([, body]) => (body as any).players);
    expect(createdPlayers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ first_name: 'Kiara', last_name: 'Zanon', league_player_number: '317' }),
        expect.objectContaining({ first_name: 'Raygan', last_name: 'Kirk', league_player_number: '211' }),
        expect.objectContaining({ first_name: 'Maddie', last_name: 'Rooney', league_player_number: '123' }),
      ]),
    );

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
        expect.objectContaining({ goalie_id: 'auto-211', time_on_ice: 3575, shots_against: 31 }),
        expect.objectContaining({ goalie_id: 'auto-123', time_on_ice: 3528, exited_time: '18:48' }),
      ]),
    );
  });
});
