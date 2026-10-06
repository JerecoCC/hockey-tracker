'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));

const { sql } = require('../db');
const {
  assertValidResult,
  fetchPersonalGames,
  findOwnedPersonalGame,
  normalizePersonalGameInput,
} = require('./personalGames');

const HOME = '11111111-1111-4111-8111-111111111111';
const AWAY = '22222222-2222-4222-8222-222222222222';

describe('normalizePersonalGameInput', () => {
  it('fills defaults for a new unplayed game', () => {
    expect(
      normalizePersonalGameInput({
        home_team_id: HOME,
        away_team_id: AWAY,
        scheduled_at: '2026-10-10',
      }),
    ).toEqual({
      season_id: null,
      home_team_id: HOME,
      away_team_id: AWAY,
      game_type: 'regular',
      scheduled_at: '2026-10-10',
      scheduled_time: null,
      home_score: null,
      away_score: null,
      result_type: 'regulation',
      scheduled_for: null,
    });
  });

  it('keeps a recorded final with its result type', () => {
    expect(
      normalizePersonalGameInput({
        home_team_id: HOME,
        away_team_id: AWAY,
        game_type: 'playoff',
        scheduled_at: '2026-10-10',
        scheduled_time: '19:30',
        home_score: '3',
        away_score: 2,
        result_type: 'overtime',
        scheduled_for: '2026-10-12',
      }),
    ).toMatchObject({ home_score: 3, away_score: 2, result_type: 'overtime', scheduled_time: '19:30' });
  });

  it('only returns the fields present when partial', () => {
    expect(normalizePersonalGameInput({ scheduled_for: null }, { partial: true })).toEqual({
      scheduled_for: null,
    });
  });

  it.each([
    [{ season_id: 'season-1', home_team_id: HOME, away_team_id: AWAY, scheduled_at: '2026-10-10' }, /season_id/],
    [{ home_team_id: HOME, away_team_id: HOME, scheduled_at: '2026-10-10' }, /must be different/],
    [{ home_team_id: HOME, away_team_id: AWAY, scheduled_at: 'Oct 10' }, /scheduled_at/],
    [{ home_team_id: HOME, away_team_id: AWAY, scheduled_at: '2026-10-10', game_type: 'exhibition' }, /game_type/],
    [{ home_team_id: HOME, away_team_id: AWAY, scheduled_at: '2026-10-10', scheduled_time: '7pm' }, /HH:MM/],
    [{ home_team_id: HOME, away_team_id: AWAY, scheduled_at: '2026-10-10', home_score: 3 }, /both scores/],
    [{ home_team_id: HOME, away_team_id: AWAY, scheduled_at: '2026-10-10', home_score: -1, away_score: 2 }, /0 to 99/],
    [{ home_team_id: 'team-1', away_team_id: AWAY, scheduled_at: '2026-10-10' }, /home_team_id is required/],
  ])('rejects %j', (body, message) => {
    expect(() => normalizePersonalGameInput(body)).toThrow(message);
  });
});

describe('assertValidResult', () => {
  it('only allows a tie in regulation', () => {
    expect(() => assertValidResult({ home_score: 2, away_score: 2, result_type: 'regulation' })).not.toThrow();
    expect(() => assertValidResult({ home_score: 2, away_score: 2, result_type: 'shootout' })).toThrow(/winner/);
    expect(() => assertValidResult({ home_score: null, away_score: null, result_type: 'overtime' })).not.toThrow();
  });
});

describe('fetchPersonalGames', () => {
  beforeEach(() => sql.mockReset());

  it('filters by the season the game was filed under', async () => {
    sql.mockResolvedValueOnce([]);
    await fetchPersonalGames('user-1', { seasonId: 'season-1' });

    const query = sql.mock.calls[0][0].join('?');
    expect(query).toContain('pg.season_id = ?::uuid');
    expect(query).toContain('COALESCE(s.league_id, t_home.league_id, t_away.league_id)');
    expect(sql.mock.calls[0].slice(1)).toContain('season-1');
  });

  it("filters the user's games on their effective date", async () => {
    sql.mockResolvedValueOnce([]);
    await fetchPersonalGames('user-1', { from: '2026-09-27', to: '2026-11-07' });

    const query = sql.mock.calls[0][0].join('?');
    expect(query).toContain('FROM user_personal_games pg');
    expect(query).toContain('COALESCE(pg.scheduled_for, pg.scheduled_at) AS effective_user_date');
    expect(query).toContain('true AS is_personal');
    expect(sql.mock.calls[0].slice(1)).toEqual(
      expect.arrayContaining(['user-1', '2026-09-27', '2026-11-07']),
    );
  });
});

describe('findOwnedPersonalGame', () => {
  beforeEach(() => sql.mockReset());

  it('skips the lookup for ids that are not uuids', async () => {
    await expect(findOwnedPersonalGame('user-1', 'game-1')).resolves.toBeNull();
    expect(sql).not.toHaveBeenCalled();
  });

  it('looks the game up by id and owner', async () => {
    sql.mockResolvedValueOnce([{ id: HOME }]);
    await expect(findOwnedPersonalGame('user-1', HOME)).resolves.toEqual({ id: HOME });
    expect(sql.mock.calls[0].slice(1)).toEqual([HOME, 'user-1']);
  });
});
