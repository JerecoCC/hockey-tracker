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
  game_type: 'regular',
  status: 'scheduled',
  scheduled_at: '2025-11-21T12:00:00Z',
  scheduled_time: '19:00',
  home_team: { id: 'min-team', name: 'Minnesota Frost', code: 'MIN' },
  away_team: { id: 'tor-team', name: 'Toronto Sceptres', code: 'TOR' },
  overtime_periods: null,
  shootout: false,
  playoff_series_id: null,
  game_number_in_series: null,
  game_number: null,
  league_game_number: null,
} as unknown as GameRecord;

// PWHL's game summary, trimmed to what the auto-fill reads. Team `goals` is the final score,
// a shootout win counting as one goal.
const pwhlSummary = (
  overrides: {
    details?: Record<string, unknown>;
    awayGoals?: number | null;
    homeGoals?: number | null;
    periods?: number;
    hasShootout?: boolean;
    awayCode?: string;
  } = {},
) => ({
  details: {
    id: 210,
    date: 'Friday, November 21, 2025',
    gameNumber: '1',
    started: '1',
    final: '1',
    status: 'Final',
    GameDateISO8601: '2025-11-21T19:00:00-05:00',
    ...overrides.details,
  },
  hasShootout: overrides.hasShootout ?? false,
  visitingTeam: {
    info: { id: 6, name: 'Toronto Sceptres', abbreviation: overrides.awayCode ?? 'TOR' },
    stats: { goals: overrides.awayGoals === undefined ? 2 : overrides.awayGoals },
  },
  homeTeam: {
    info: { id: 2, name: 'Minnesota Frost', abbreviation: 'MIN' },
    stats: { goals: overrides.homeGoals === undefined ? 1 : overrides.homeGoals },
  },
  periods: Array.from({ length: overrides.periods ?? 3 }, (_, index) => ({
    info: { id: String(index + 1) },
  })),
});

describe('autofillGameFromPwhlGamecenter', () => {
  let summary: ReturnType<typeof pwhlSummary>;
  let seasonGames: GameRecord[];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'token');
    summary = pwhlSummary();
    seasonGames = [game];

    mockedAxios.get.mockImplementation((url, config) => {
      const u = String(url);
      if (u.endsWith('/admin/games/pwhl-api')) {
        expect(String(config?.params?.url)).toContain('view=gameSummary');
        return Promise.resolve({ data: summary });
      }
      if (u.includes('/admin/games?season_id=')) return Promise.resolve({ data: seasonGames });
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    mockedAxios.patch.mockResolvedValue({ data: {} });
  });

  const expectOnlyGamePatch = () => {
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.put).not.toHaveBeenCalled();
    expect(mockedAxios.delete).not.toHaveBeenCalled();
    expect(mockedAxios.patch).toHaveBeenCalledTimes(1);
    expect(mockedAxios.patch.mock.calls[0][0]).toMatch(/\/admin\/games\/game-1$/);
    return mockedAxios.patch.mock.calls[0][1] as Record<string, unknown>;
  };

  it('saves the final score and schedule of a game decided in regulation, and nothing else', async () => {
    const result = await autofillGameFromPwhlGamecenter(game, '210');

    expect(expectOnlyGamePatch()).toEqual({
      league_game_number: '210',
      scheduled_at: '2025-11-21',
      scheduled_time: '19:00',
      status: 'final',
      current_period: '3',
      overtime_periods: 0,
      shootout: false,
      final_home_score: 1,
      final_away_score: 2,
    });
    expect(result.summary).toEqual({
      gameId: '210',
      state: 'final',
      finalScore: { away: 2, home: 1 },
      decidedIn: 'regulation',
    });
    expect(result.message).toBe('Filled PWHL game 210: TOR 2, MIN 1.');
    expect(result.warnings).toEqual([]);
  });

  it('records a game decided in overtime', async () => {
    summary = pwhlSummary({ details: { status: 'Final OT2' }, periods: 5, homeGoals: 3 });

    const result = await autofillGameFromPwhlGamecenter(game, '210');

    expect(expectOnlyGamePatch()).toEqual(
      expect.objectContaining({
        status: 'final',
        current_period: 'OT',
        overtime_periods: 2,
        shootout: false,
        final_home_score: 3,
        final_away_score: 2,
      }),
    );
    expect(result.summary.decidedIn).toBe('overtime');
    expect(result.message).toBe('Filled PWHL game 210: TOR 2, MIN 3 (OT).');
  });

  it('records a game decided in a shootout with the shootout win in the final score', async () => {
    summary = pwhlSummary({
      details: { status: 'Final SO' },
      hasShootout: true,
      periods: 4,
      awayGoals: 2,
      homeGoals: 1,
    });

    const result = await autofillGameFromPwhlGamecenter(game, '210');

    expect(expectOnlyGamePatch()).toEqual(
      expect.objectContaining({
        status: 'final',
        current_period: 'SO',
        overtime_periods: 1,
        shootout: true,
        final_home_score: 1,
        final_away_score: 2,
      }),
    );
    expect(result.summary.decidedIn).toBe('shootout');
    expect(result.message).toBe('Filled PWHL game 210: TOR 2, MIN 1 (SO).');
  });

  it('marks a game still being played as in progress without a final score', async () => {
    summary = pwhlSummary({ details: { final: '0', status: '2nd Period' } });

    const result = await autofillGameFromPwhlGamecenter(game, '210');

    expect(expectOnlyGamePatch()).toEqual({
      league_game_number: '210',
      scheduled_at: '2025-11-21',
      scheduled_time: '19:00',
      status: 'in_progress',
    });
    expect(result.summary).toEqual(
      expect.objectContaining({ state: 'in_progress', finalScore: null, decidedIn: null }),
    );
    expect(result.warnings).toEqual(["It isn't final yet, so no final score was saved."]);
  });

  it("only updates the schedule of a game that hasn't started", async () => {
    summary = pwhlSummary({ details: { started: '0', final: '0', status: '7:00 pm EST' } });

    const result = await autofillGameFromPwhlGamecenter(game, '210');

    expect(expectOnlyGamePatch()).toEqual({
      league_game_number: '210',
      scheduled_at: '2025-11-21',
      scheduled_time: '19:00',
    });
    expect(result.summary.state).toBe('scheduled');
  });

  it('rejects a PWHL game between different teams before writing', async () => {
    summary = pwhlSummary({ awayCode: 'BOS' });

    await expect(autofillGameFromPwhlGamecenter(game, '210')).rejects.toThrow(
      'PWHL game is BOS @ MIN, but this page is TOR @ MIN.',
    );
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it('rejects before writing when the local regular season game number is not the PWHL game number', async () => {
    const numberedGame = { ...game, game_number: 2 } as GameRecord;
    seasonGames = [numberedGame];

    await expect(autofillGameFromPwhlGamecenter(numberedGame, '210')).rejects.toThrow(
      /PWHL game number 1 does not match local regular season game 2/i,
    );
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it('rejects a final game without a usable final score', async () => {
    summary = pwhlSummary({ homeGoals: null });
    await expect(autofillGameFromPwhlGamecenter(game, '210')).rejects.toThrow(
      'PWHL game summary did not include the final score.',
    );

    summary = pwhlSummary({ homeGoals: 2, awayGoals: 2 });
    await expect(autofillGameFromPwhlGamecenter(game, '210')).rejects.toThrow(/tied final score/);
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it('reads the game id from a PWHL game-center URL', async () => {
    await autofillGameFromPwhlGamecenter(
      game,
      'https://www.thepwhl.com/en/stats/game-center?game_id=210',
    );

    expect(String(mockedAxios.get.mock.calls[0][1]?.params?.url)).toContain('game_id=210');
  });
});
