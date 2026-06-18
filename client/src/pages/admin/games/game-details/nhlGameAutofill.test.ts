import axios from 'axios';
import { autofillGameFromNhlGamecenter } from './nhlGameAutofill';
import type { GameRecord } from '@/hooks/useGames';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const game = {
  id: 'game-1',
  season_id: 'season-1',
  league_code: 'NHL',
  league_name: 'NHL',
  season_name: '2025-26',
  game_type: 'regular',
  status: 'scheduled',
  scheduled_at: '2025-11-20T02:30:00Z',
  scheduled_time: '21:30',
  venue: null,
  time_start: null,
  time_end: null,
  home_team: {
    id: 'min-team',
    name: 'Minnesota Wild',
    code: 'MIN',
    logo: null,
    primary_color: '#154734',
    secondary_color: '#a6192e',
    text_color: '#ffffff',
  },
  away_team: {
    id: 'car-team',
    name: 'Carolina Hurricanes',
    code: 'CAR',
    logo: null,
    primary_color: '#cc0000',
    secondary_color: '#111111',
    text_color: '#ffffff',
  },
  overtime_periods: null,
  shootout: false,
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
  created_at: '2025-11-01T00:00:00Z',
  current_period: '1',
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
} as unknown as GameRecord;

const boxscore = {
  gameDate: '2025-11-19',
  startTimeUTC: '2025-11-20T02:30:00Z',
  venue: { default: 'Grand Casino Arena' },
  awayTeam: { id: 12, abbrev: 'CAR', score: 3 },
  homeTeam: { id: 30, abbrev: 'MIN', score: 4 },
  periodDescriptor: { number: 4, periodType: 'SO' },
  gameOutcome: { lastPeriodType: 'SO' },
  playerByGameStats: {
    awayTeam: {
      forwards: [
        { playerId: 1, sweaterNumber: 24, firstName: { default: 'Seth' }, lastName: { default: 'Jarvis' } },
        { playerId: 2, sweaterNumber: 37, firstName: { default: 'Andrei' }, lastName: { default: 'Svechnikov' } },
        { playerId: 3, sweaterNumber: 71, firstName: { default: 'Taylor' }, lastName: { default: 'Hall' } },
      ],
      defense: [],
      goalies: [],
    },
    homeTeam: {
      forwards: [
        { playerId: 4, sweaterNumber: 36, firstName: { default: 'Mats' }, lastName: { default: 'Zuccarello' } },
        { playerId: 5, sweaterNumber: 97, firstName: { default: 'Kirill' }, lastName: { default: 'Kaprizov' } },
        { playerId: 6, sweaterNumber: 12, firstName: { default: 'Matt' }, lastName: { default: 'Boldy' } },
      ],
      defense: [],
      goalies: [],
    },
  },
};

const shootoutReportHtml = `
  <html><body>
    <table>
      <tr>
        <td>#</td><td>Team</td><td>Pos</td><td>Shooter</td>
        <td>Goaltender</td><td>Result</td><td>Shot Type</td><td>Score(V-H)</td>
      </tr>
      <tr><td>1</td><td>MIN</td><td>R</td><td>36 M.ZUCCARELLO</td><td>31 F.ANDERSEN</td><td>S</td><td>Wrist</td><td>0-0</td></tr>
      <tr><td>2</td><td>CAR</td><td>C</td><td>24 S.JARVIS</td><td>30 J.WALLSTEDT</td><td>S</td><td>Wrist</td><td>0-0</td></tr>
      <tr><td>3</td><td>MIN</td><td>L</td><td>97 K.KAPRIZOV</td><td>31 F.ANDERSEN</td><td>S</td><td>Wrist</td><td>0-0</td></tr>
      <tr><td>4</td><td>CAR</td><td>R</td><td>37 A.SVECHNIKOV</td><td>30 J.WALLSTEDT</td><td>S</td><td>Backhand</td><td>0-0</td></tr>
      <tr><td>5</td><td>MIN</td><td>L</td><td>12 M.BOLDY</td><td>31 F.ANDERSEN</td><td>G</td><td>Backhand</td><td>0-1</td></tr>
      <tr><td>6</td><td>CAR</td><td>L</td><td>71 T.HALL</td><td>30 J.WALLSTEDT</td><td>S</td><td>Wrist</td><td>0-1</td></tr>
    </table>
  </body></html>
`;

const localPlayers = [
  { id: 'jarvis', first_name: 'Seth', last_name: 'Jarvis', jersey_number: 24, team_id: 'car-team', position: 'F' },
  { id: 'svechnikov', first_name: 'Andrei', last_name: 'Svechnikov', jersey_number: 37, team_id: 'car-team', position: 'F' },
  { id: 'hall', first_name: 'Taylor', last_name: 'Hall', jersey_number: 71, team_id: 'car-team', position: 'F' },
  { id: 'andersen', first_name: 'Frederik', last_name: 'Andersen', jersey_number: 31, team_id: 'car-team', position: 'G' },
  { id: 'zuccarello', first_name: 'Mats', last_name: 'Zuccarello', jersey_number: 36, team_id: 'min-team', position: 'F' },
  { id: 'kaprizov', first_name: 'Kirill', last_name: 'Kaprizov', jersey_number: 97, team_id: 'min-team', position: 'F' },
  { id: 'boldy', first_name: 'Matt', last_name: 'Boldy', jersey_number: 12, team_id: 'min-team', position: 'F' },
  { id: 'wallstedt', first_name: 'Jesper', last_name: 'Wallstedt', jersey_number: 30, team_id: 'min-team', position: 'G' },
  { id: 'gustavsson', first_name: 'Filip', last_name: 'Gustavsson', jersey_number: 32, team_id: 'min-team', position: 'G' },
];

let playByPlayData: { plays: unknown[] };
let optionalShootoutReportHtml: string | null;
let optionalGameSummaryReportHtml: string | null;
let optionalGoalieToiReportHtml: string | null;
let boxscoreData: typeof boxscore;
let existingGoalsData: unknown[];
let existingGoalieStatsData: unknown[];

describe('autofillGameFromNhlGamecenter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'token');
    boxscoreData = boxscore;
    playByPlayData = { plays: [] };
    optionalShootoutReportHtml = shootoutReportHtml;
    optionalGameSummaryReportHtml = null;
    optionalGoalieToiReportHtml = null;
    existingGoalsData = [];
    existingGoalieStatsData = [];
    mockedAxios.get.mockImplementation((url, config) => {
      if (String(url).endsWith('/admin/games/nhl-api')) {
        const targetUrl = String(config?.params?.url ?? '');
        if (targetUrl.endsWith('/boxscore')) return Promise.resolve({ data: boxscoreData });
        if (targetUrl.endsWith('/play-by-play')) return Promise.resolve({ data: playByPlayData });
        if (targetUrl.includes('/GS020317.HTM') && optionalGameSummaryReportHtml) {
          return Promise.resolve({ data: optionalGameSummaryReportHtml });
        }
        if (targetUrl.includes('/SO020317.HTM') && optionalShootoutReportHtml) {
          return Promise.resolve({ data: optionalShootoutReportHtml });
        }
        if (/\/T[HV]020317\.HTM$/i.test(targetUrl) && optionalGoalieToiReportHtml) {
          return Promise.resolve({ data: optionalGoalieToiReportHtml });
        }
        return Promise.reject(new Error('Optional report unavailable'));
      }
      if (String(url).endsWith('/admin/games/game-1/goals')) return Promise.resolve({ data: existingGoalsData });
      if (String(url).endsWith('/admin/games/game-1/shootout-attempts')) return Promise.resolve({ data: [] });
      if (String(url).endsWith('/admin/games/game-1/goalie-stats')) {
        return Promise.resolve({ data: existingGoalieStatsData });
      }
      if (String(url).endsWith('/admin/players')) {
        return Promise.resolve({
          data: localPlayers.filter((player) => player.team_id === config?.params?.team_id),
        });
      }
      if (String(url).endsWith('/admin/games/game-1/roster')) return Promise.resolve({ data: [] });
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    mockedAxios.post.mockResolvedValue({ data: {} });
    mockedAxios.patch.mockResolvedValue({ data: {} });
    mockedAxios.put.mockResolvedValue({ data: {} });
  });

  it('marks GameCenter goals with a pulled defending goalie as empty net goals', async () => {
    boxscoreData = {
      ...boxscore,
      homeTeam: { ...boxscore.homeTeam, score: 1 },
      awayTeam: { ...boxscore.awayTeam, score: 0 },
      periodDescriptor: { number: 3, periodType: 'REG' },
      gameOutcome: { lastPeriodType: 'REG' },
    };
    playByPlayData = {
      plays: [
        {
          sortOrder: 1,
          typeDescKey: 'goal',
          periodDescriptor: { number: 3, periodType: 'REG' },
          timeInPeriod: '18:59',
          situationCode: '0651',
          details: {
            eventOwnerTeamId: 30,
            scoringPlayerId: 6,
            awayScore: 0,
            homeScore: 1,
          },
        },
      ],
    };

    const result = await autofillGameFromNhlGamecenter(game, '317');
    const goalPosts = mockedAxios.post.mock.calls.filter(([url]) =>
      String(url).endsWith('/admin/games/game-1/goals'),
    );

    expect(result.summary.goalsCreated).toBe(1);
    expect(goalPosts).toHaveLength(1);
    expect(goalPosts[0][1]).toEqual(
      expect.objectContaining({
        team_id: 'min-team',
        scorer_id: 'boldy',
        period: '3',
        period_time: '18:59',
        goal_type: 'even-strength',
        empty_net: true,
      }),
    );
  });

  it('updates an existing matching goal when autofill detects it should be empty net', async () => {
    boxscoreData = {
      ...boxscore,
      homeTeam: { ...boxscore.homeTeam, score: 1 },
      awayTeam: { ...boxscore.awayTeam, score: 0 },
      periodDescriptor: { number: 3, periodType: 'REG' },
      gameOutcome: { lastPeriodType: 'REG' },
    };
    existingGoalsData = [
      {
        id: 'goal-1',
        team_id: 'min-team',
        period: '3',
        period_time: '18:59',
        scorer_id: 'boldy',
        goal_type: 'short-handed',
        empty_net: false,
        penalty_shot: false,
      },
    ];
    playByPlayData = {
      plays: [
        {
          sortOrder: 1,
          typeDescKey: 'goal',
          periodDescriptor: { number: 3, periodType: 'REG' },
          timeInPeriod: '18:59',
          situationCode: '0651',
          details: {
            eventOwnerTeamId: 30,
            scoringPlayerId: 6,
            awayScore: 0,
            homeScore: 1,
          },
        },
      ],
    };

    const result = await autofillGameFromNhlGamecenter(game, '317');

    expect(result.summary.goalsCreated).toBe(0);
    expect(mockedAxios.put).toHaveBeenCalledWith(
      '/api/admin/games/game-1/goals/goal-1',
      expect.objectContaining({
        team_id: 'min-team',
        scorer_id: 'boldy',
        goal_type: 'even-strength',
        empty_net: true,
      }),
      expect.any(Object),
    );
  });

  it('creates attempts from GameCenter shootout play-by-play', async () => {
    optionalShootoutReportHtml = null;
    playByPlayData = {
      plays: [
        {
          sortOrder: 1,
          typeDescKey: 'shot-on-goal',
          periodDescriptor: { periodType: 'SO' },
          details: { eventOwnerTeamId: 30, shootingPlayerId: 4 },
        },
        {
          sortOrder: 2,
          typeDescKey: 'shot-on-goal',
          periodDescriptor: { periodType: 'SO' },
          details: { eventOwnerTeamId: 12, shootingPlayerId: 1 },
        },
        {
          sortOrder: 3,
          typeDescKey: 'missed-shot',
          periodDescriptor: { periodType: 'SO' },
          details: { eventOwnerTeamId: 30, shootingPlayerId: 5 },
        },
        {
          sortOrder: 4,
          typeDescKey: 'shot-on-goal',
          periodDescriptor: { periodType: 'SO' },
          details: { eventOwnerTeamId: 12, shootingPlayerId: 2 },
        },
        {
          sortOrder: 5,
          typeDescKey: 'goal',
          periodDescriptor: { periodType: 'SO' },
          details: { eventOwnerTeamId: 30, scoringPlayerId: 6 },
        },
        {
          sortOrder: 6,
          typeDescKey: 'shot-on-goal',
          periodDescriptor: { periodType: 'SO' },
          details: { eventOwnerTeamId: 12, shootingPlayerId: 3 },
        },
      ],
    };

    const result = await autofillGameFromNhlGamecenter(game, '317');
    const shootoutPosts = mockedAxios.post.mock.calls.filter(([url]) =>
      String(url).endsWith('/admin/games/game-1/shootout-attempts'),
    );

    expect(result.summary.shootoutAttempts).toBe(6);
    expect(shootoutPosts.map(([, payload]) => payload)).toEqual([
      { team_id: 'min-team', shooter_id: 'zuccarello', scored: false },
      { team_id: 'car-team', shooter_id: 'jarvis', scored: false },
      { team_id: 'min-team', shooter_id: 'kaprizov', scored: false },
      { team_id: 'car-team', shooter_id: 'svechnikov', scored: false },
      { team_id: 'min-team', shooter_id: 'boldy', scored: true },
      { team_id: 'car-team', shooter_id: 'hall', scored: false },
    ]);
    expect(mockedAxios.patch.mock.calls).toContainEqual([
      '/api/admin/games/game-1',
      expect.objectContaining({
        status: 'final',
        current_period: 'SO',
        shootout: true,
        shootout_first_team_id: 'min-team',
      }),
      expect.any(Object),
    ]);
  });

  it('creates attempts from NHL shootout report rows that use compact result codes', async () => {
    const result = await autofillGameFromNhlGamecenter(game, '317');
    const shootoutPosts = mockedAxios.post.mock.calls.filter(([url]) =>
      String(url).endsWith('/admin/games/game-1/shootout-attempts'),
    );

    expect(result.summary.shootoutAttempts).toBe(6);
    expect(shootoutPosts.map(([, payload]) => payload)).toEqual([
      { team_id: 'min-team', shooter_id: 'zuccarello', scored: false },
      { team_id: 'car-team', shooter_id: 'jarvis', scored: false },
      { team_id: 'min-team', shooter_id: 'kaprizov', scored: false },
      { team_id: 'car-team', shooter_id: 'svechnikov', scored: false },
      { team_id: 'min-team', shooter_id: 'boldy', scored: true },
      { team_id: 'car-team', shooter_id: 'hall', scored: false },
    ]);
  });

  it('uses official 3 Stars By rows from the NHL game summary report', async () => {
    optionalGameSummaryReportHtml = `
      <html><body>
        <table><tr><td>Scoring Summary</td></tr><tr><td>1</td><td>MIN</td><td>Goal</td></tr></table>
        <table>
          <tr><td colspan="5">3 Stars By Media</td></tr>
          <tr><td>Star</td><td>Team</td><td>Pos</td><td>No.</td><td>Player</td></tr>
          <tr><td>1</td><td>MIN</td><td>L</td><td>12</td><td>M.BOLDY</td></tr>
          <tr><td>2</td><td>MIN</td><td>R</td><td>36</td><td>M.ZUCCARELLO</td></tr>
          <tr><td>3</td><td>CAR</td><td>C</td><td>24</td><td>S.JARVIS</td></tr>
        </table>
      </body></html>
    `;

    const result = await autofillGameFromNhlGamecenter(game, '317');
    const finalPatch = mockedAxios.patch.mock.calls.find(
      ([url, payload]) =>
        String(url).endsWith('/admin/games/game-1') &&
        (payload as Record<string, unknown>)?.status === 'final',
    );

    expect(result.summary.starsSet).toBe(3);
    expect(finalPatch?.[1]).toEqual(
      expect.objectContaining({
        star_1_id: 'boldy',
        star_2_id: 'zuccarello',
        star_3_id: 'jarvis',
      }),
    );
  });

  it('writes multi-goalie NHL games through native goalie stints with parsed entry times', async () => {
    boxscoreData = {
      ...boxscore,
      playerByGameStats: {
        awayTeam: {
          ...boxscore.playerByGameStats.awayTeam,
          goalies: [
            {
              playerId: 7,
              sweaterNumber: 31,
              firstName: { default: 'Frederik' },
              lastName: { default: 'Andersen' },
              toi: '65:00',
              shotsAgainst: 30,
              goalsAgainst: 3,
            },
          ],
        },
        homeTeam: {
          ...boxscore.playerByGameStats.homeTeam,
          goalies: [
            {
              playerId: 8,
              sweaterNumber: 30,
              firstName: { default: 'Jesper' },
              lastName: { default: 'Wallstedt' },
              toi: '20:00',
              shotsAgainst: 10,
              goalsAgainst: 1,
            },
            {
              playerId: 9,
              sweaterNumber: 32,
              firstName: { default: 'Filip' },
              lastName: { default: 'Gustavsson' },
              toi: '45:00',
              shotsAgainst: 20,
              goalsAgainst: 2,
            },
          ],
        },
      },
    };
    optionalGoalieToiReportHtml = `
      <html><body><table>
        <tr><td>31 ANDERSEN, FREDERIK</td></tr>
        <tr><td>1 1 00:00 / 00:00 20:00 / 20:00 20:00</td></tr>
        <tr><td>2 2 00:00 / 20:00 20:00 / 40:00 20:00</td></tr>
        <tr><td>3 3 00:00 / 40:00 20:00 / 60:00 20:00</td></tr>
        <tr><td>4 4 00:00 / 60:00 05:00 / 65:00 05:00</td></tr>
        <tr><td>30 WALLSTEDT, JESPER</td></tr>
        <tr><td>1 1 00:00 / 00:00 20:00 / 20:00 20:00</td></tr>
        <tr><td>32 GUSTAVSSON, FILIP</td></tr>
        <tr><td>1 2 00:00 / 20:00 20:00 / 40:00 20:00</td></tr>
        <tr><td>2 3 00:00 / 40:00 20:00 / 60:00 20:00</td></tr>
        <tr><td>3 4 00:00 / 60:00 05:00 / 65:00 05:00</td></tr>
      </table></body></html>
    `;

    const result = await autofillGameFromNhlGamecenter(game, '317');
    const goalieStatPuts = mockedAxios.put.mock.calls.filter(([url]) =>
      String(url).endsWith('/admin/games/game-1/goalie-stats'),
    );
    const goalieStintPosts = mockedAxios.post.mock.calls.filter(([url]) =>
      String(url).endsWith('/admin/games/game-1/goalie-stints'),
    );

    expect(result.summary.goalieStats).toBe(3);
    expect(goalieStatPuts).toHaveLength(0);
    expect(goalieStintPosts.map(([, payload]) => payload)).toEqual([
      expect.objectContaining({
        goalie_id: 'andersen',
        team_id: 'car-team',
        entered_period: '1',
        entered_time: null,
        exited_period: 'OT',
        exited_time: '5:00',
        shots_against: 30,
        goals_against: 3,
      }),
      expect.objectContaining({
        goalie_id: 'wallstedt',
        team_id: 'min-team',
        entered_period: '1',
        entered_time: null,
        exited_period: '1',
        exited_time: '20:00',
        shots_against: 10,
        goals_against: 1,
      }),
      expect.objectContaining({
        goalie_id: 'gustavsson',
        team_id: 'min-team',
        entered_period: '2',
        entered_time: '0:00',
        exited_period: 'OT',
        exited_time: '5:00',
        shots_against: 20,
        goals_against: 2,
      }),
    ]);
  });
});
