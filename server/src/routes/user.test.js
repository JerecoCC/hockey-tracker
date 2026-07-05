'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: 'user-1', role: 'user' };
    next();
  },
}));

const request = require('supertest');
const express = require('express');
const { sql } = require('../db');
const userRouter = require('./user');

const app = express();
app.use(express.json());
app.use('/api/user', userRouter);

afterEach(() => jest.clearAllMocks());

const GAME = {
  id: 'game-1',
  season_id: 'season-1',
  game_type: 'regular',
  status: 'scheduled',
  scheduled_at: '2024-10-10T19:00:00Z',
  scheduled_time: '19:00',
  venue: null,
  home_score: 0,
  away_score: 0,
  winner_team_id: null,
  overtime_periods: null,
  shootout: false,
  playoff_series_id: null,
  game_number_in_series: null,
  game_number: 1,
  notes: null,
  current_period: null,
  created_at: '2024-01-01T00:00:00Z',
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  playoff_round: null,
  series_home_team_id: null,
  series_away_team_id: null,
  series_home_wins: null,
  series_away_wins: null,
  series_home_wins_at_game: null,
  series_away_wins_at_game: null,
  series_games_to_win: null,
  playoff_round_names: null,
  playoff_matchup_names: null,
  bracket_slot_key: null,
  period_scores: [],
  period_shots: [],
  home_team: { id: 'team-1', name: 'Home', code: 'HOM', logo: null, primary_color: '#111', secondary_color: '#222', text_color: '#fff' },
  away_team: { id: 'team-2', name: 'Away', code: 'AWY', logo: null, primary_color: '#333', secondary_color: '#444', text_color: '#fff' },
  season_name: '2024-25',
  league_id: 'league-1',
  league_code: 'NHL',
  league_name: 'NHL',
  league_primary_color: '#0a4fa3',
  league_text_color: '#ffffff',
  watched_by_user: false,
  watched_on: null,
  skipped_by_user: false,
  scheduled_for: '2024-10-12',
};

describe('GET /api/user/favorites', () => {
  it('returns the authenticated user favorite team ids', async () => {
    sql.mockResolvedValueOnce([{ team_id: 'team-1' }, { team_id: 'team-2' }]);

    const res = await request(app).get('/api/user/favorites');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(['team-1', 'team-2']);
  });
});

describe('GET /api/user/teams', () => {
  it('returns all teams for user-facing filters', async () => {
    sql.mockResolvedValueOnce([
      { id: 'team-1', league_id: 'league-1', name: 'Home', code: 'HOM', logo: null },
      { id: 'team-2', league_id: 'league-1', name: 'Idle', code: 'IDL', logo: null },
    ]);

    const res = await request(app).get('/api/user/teams');
    const queryText = sql.mock.calls[0][0].join(' ');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[1]).toMatchObject({ id: 'team-2', name: 'Idle', code: 'IDL' });
    expect(queryText).toContain('FROM teams t');
    expect(queryText).not.toContain('games');
  });

  it('returns teams from the selected season alignment', async () => {
    sql.mockResolvedValueOnce([
      {
        id: 'team-1',
        league_id: 'league-1',
        name: 'Aligned Home',
        place_name: 'Aligned',
        team_name: 'Home',
        code: 'HOM',
        logo: null,
        logo_dark: null,
        logo_light: null,
        primary_color: '#111111',
        secondary_color: '#222222',
        text_color: '#ffffff',
        home_arena: 'Arena',
      },
    ]);

    const seasonId = '00000000-0000-0000-0000-000000000002';
    const res = await request(app).get(`/api/user/teams?season_id=${seasonId}`);
    const queryText = sql.mock.calls[0][0].join(' ');

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      id: 'team-1',
      name: 'Aligned Home',
      code: 'HOM',
      primary_color: '#111111',
    });
    expect(sql.mock.calls[0].slice(1)).toContain(seasonId);
    expect(queryText).toContain('season_alignment_group_teams');
    expect(queryText).toContain('group_alignment_teams');
    expect(queryText).toContain('group_alignment_set_teams');
    expect(queryText).toContain('season_teams');
  });
});

describe('GET /api/user/seasons', () => {
  it('includes bracket round and matchup names for score card playoff round options', async () => {
    sql.mockResolvedValueOnce([
      {
        id: 'season-1',
        name: '2025-26',
        bracket_rule_set_id: 'rule-set-1',
        playoff_round_names: { 1: 'Wild Card', 2: 'Final' },
        playoff_matchup_names: { r1m0: 'Opening Matchup' },
      },
    ]);

    const res = await request(app).get('/api/user/seasons?league_id=00000000-0000-0000-0000-000000000001');
    const queryText = sql.mock.calls[0][0].join(' ');

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      bracket_rule_set_id: 'rule-set-1',
      playoff_round_names: { 1: 'Wild Card', 2: 'Final' },
      playoff_matchup_names: { r1m0: 'Opening Matchup' },
    });
    expect(queryText).toContain('brs.round_names AS playoff_round_names');
    expect(queryText).toContain('brs.matchup_names AS playoff_matchup_names');
    expect(queryText).toContain('LEFT JOIN bracket_rule_sets brs');
  });
});

describe('GET /api/user/players/route-lookup', () => {
  it('resolves a user player details route to database ids', async () => {
    const lookup = {
      player_id: 'player-1',
      team_id: 'team-1',
      league_id: 'league-1',
      league_code: 'NHL',
      team_code: 'TOR',
      player_slug: 'auston-matthews',
    };
    sql.mockResolvedValueOnce([lookup]);

    const res = await request(app).get(
      '/api/user/players/route-lookup?league_code=nhl&team_code=tor&player_slug=auston-matthews',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(lookup);
    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('jersey_number::text');
    expect(queryText).toContain('league_player_slug');
  });

  it('resolves a user league-scoped player details route by league player number', async () => {
    const lookup = {
      player_id: 'player-1',
      team_id: null,
      league_id: 'league-1',
      league_code: 'NHL',
      team_code: null,
      player_slug: '8478402',
    };
    sql.mockResolvedValueOnce([lookup]);

    const res = await request(app).get(
      '/api/user/players/route-lookup?league_code=nhl&player_slug=8478402',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(lookup);
  });
});

describe('GET /api/user/players/:id/stats', () => {
  it('returns career stats using the game_player_stats read model', async () => {
    sql.mockResolvedValueOnce([
      {
        season_id: 'season-1',
        season_name: '2025-26',
        jersey_number: 34,
        gp: 10,
        goals: 7,
        assists: 4,
        points: 11,
      },
    ]);

    const res = await request(app).get('/api/user/players/player-1/stats');
    const queryText = sql.mock.calls[0][0].join(' ');

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ season_id: 'season-1', points: 11 });
    expect(queryText).toMatch(/WITH\s+stat_rows AS/);
    expect(queryText).toContain('FROM game_player_stats gps');
  });
});

describe('GET /api/user/players/:id/latest-season-stats', () => {
  it('returns latest played season stats split by game type', async () => {
    sql
      .mockResolvedValueOnce([
        { season_id: 'season-1', season_name: '2025-26', player_position: 'C' },
      ])
      .mockResolvedValueOnce([
        {
          game_type: 'regular',
          skater_gp: 12,
          goals: 8,
          assists: 9,
          points: 17,
          goalie_gp: 0,
        },
      ]);

    const res = await request(app).get('/api/user/players/player-1/latest-season-stats');

    expect(res.status).toBe(200);
    expect(res.body.regular).toMatchObject({ gp: 12, goals: 8, points: 17 });
    expect(res.body.playoffs).toBeNull();
  });

  it('returns requested season stats when season_id is provided', async () => {
    sql
      .mockResolvedValueOnce([
        { season_id: 'season-2', season_name: '2024-25', player_position: 'C' },
      ])
      .mockResolvedValueOnce([
        {
          game_type: 'playoff',
          skater_gp: 3,
          goals: 1,
          assists: 2,
          points: 3,
          goalie_gp: 0,
        },
      ]);

    const res = await request(app).get(
      '/api/user/players/player-1/latest-season-stats?season_id=season-2',
    );

    expect(res.status).toBe(200);
    expect(res.body.season_id).toBe('season-2');
    expect(res.body.regular).toBeNull();
    expect(res.body.playoffs).toMatchObject({ gp: 3, goals: 1, assists: 2, points: 3 });
    expect(sql.mock.calls[0][0].join(' ')).toContain('WHERE s.id =');
  });
});

describe('GET /api/user/players/:id', () => {
  it('returns read-only player details with roster context', async () => {
    sql.mockResolvedValueOnce([
      {
        id: 'player-1',
        first_name: 'Auston',
        last_name: 'Matthews',
        team_id: 'team-1',
        team_name: 'Maple Leafs',
        jersey_number: 34,
      },
    ]);

    const res = await request(app).get('/api/user/players/player-1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'player-1',
      team_name: 'Maple Leafs',
      jersey_number: 34,
    });
  });
});

describe('GET /api/user/games', () => {
  it('returns games and scopes the query to the authenticated user favorites', async () => {
    sql.mockResolvedValueOnce([GAME]);

    const res = await request(app).get('/api/user/games');
    const queryText = sql.mock.calls[0][0].join(' ');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('game-1');
    expect(res.body[0].watched_by_user).toBe(false);
    expect(res.body[0].skipped_by_user).toBe(false);
    expect(res.body[0].scheduled_for).toBe('2024-10-12');
    expect(queryText).toContain('ps.bracket_slot_key AS bracket_slot_key');
    expect(queryText).toContain('brs.matchup_names AS playoff_matchup_names');
    expect(res.body[0]).toMatchObject({ home_score: 0, away_score: 0, winner_team_id: null });
    expect(sql.mock.calls[0].slice(1)).toContain('user-1');
    expect(queryText).toContain('user_favorite_teams');
    expect(queryText).toContain('::uuid[] IS NULL');
    expect(queryText).toContain('uwg.skipped_at IS NULL');
  });

  it('can include skipped games when requested', async () => {
    sql.mockResolvedValueOnce([{ ...GAME, skipped_by_user: true }]);

    const res = await request(app).get('/api/user/games?include_skipped=true');
    const queryText = sql.mock.calls[0][0].join(' ');

    expect(res.status).toBe(200);
    expect(res.body[0].skipped_by_user).toBe(true);
    expect(sql.mock.calls[0].slice(1)).toContain(true);
    expect(queryText).toContain('OR uwg.skipped_at IS NULL');
  });

  it('can filter to watched games when requested', async () => {
    sql.mockResolvedValueOnce([{ ...GAME, watched_by_user: true, watched_on: '2024-10-12' }]);

    const res = await request(app).get('/api/user/games?watched=true');
    const queryText = sql.mock.calls[0][0].join(' ');

    expect(res.status).toBe(200);
    expect(res.body[0].watched_by_user).toBe(true);
    expect(sql.mock.calls[0].slice(1)).toContain(true);
    expect(queryText).toContain('uwg.watched_on IS NOT NULL');
    expect(queryText).toContain('uwg.watched_at IS NOT NULL');
  });

  it('can include watched games across all teams when requested', async () => {
    sql.mockResolvedValueOnce([{ ...GAME, watched_by_user: true, watched_on: '2024-10-12' }]);

    const res = await request(app).get('/api/user/games?watched=true&all_teams=true');
    const queryText = sql.mock.calls[0][0].join(' ');
    const args = sql.mock.calls[0].slice(1);

    expect(res.status).toBe(200);
    expect(res.body[0].watched_by_user).toBe(true);
    expect(args.filter((value) => value === true)).toHaveLength(2);
    expect(queryText).toContain('::boolean IS TRUE');
    expect(queryText).toContain('OR EXISTS');
    expect(queryText).toContain('uwg.watched_on IS NOT NULL');
  });

  it('keeps league and status filters working on top of favorite-team scoping', async () => {
    sql.mockResolvedValueOnce([GAME]);

    const res = await request(app)
      .get('/api/user/games?league_id=league-1&status=scheduled');

    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe('game-1');
  });

  it('filters games by multiple selected teams', async () => {
    sql.mockResolvedValueOnce([GAME]);

    const firstTeamId = '00000000-0000-0000-0000-000000000001';
    const secondTeamId = '00000000-0000-0000-0000-000000000002';
    const res = await request(app).get(
      `/api/user/games?team_ids=${firstTeamId},${secondTeamId}`,
    );
    const queryText = sql.mock.calls[0][0].join(' ');

    expect(res.status).toBe(200);
    expect(sql.mock.calls[0].slice(1)).toContain(`{${firstTeamId},${secondTeamId}}`);
    expect(queryText).toContain('::uuid[] IS NOT NULL');
    expect(queryText).toContain('g.home_team_id = ANY');
    expect(queryText).toContain('g.away_team_id = ANY');
  });

  it('filters games by week start using the effective user date', async () => {
    sql.mockResolvedValueOnce([GAME]);

    const res = await request(app).get('/api/user/games?week=2024-10-07');
    const queryText = sql.mock.calls[0][0].join(' ');

    expect(res.status).toBe(200);
    expect(sql.mock.calls[0].slice(1)).toContain('2024-10-07');
    expect(queryText).toContain('uwg.scheduled_for');
    expect(queryText).toContain("INTERVAL '1 day'");
    expect(queryText).toContain("INTERVAL '8 days'");
  });

  it('filters games by month using the effective user date', async () => {
    sql.mockResolvedValueOnce([GAME]);

    const res = await request(app).get('/api/user/games?month=2024-10');
    const queryText = sql.mock.calls[0][0].join(' ');

    expect(res.status).toBe(200);
    expect(sql.mock.calls[0].slice(1)).toContain('2024-10');
    expect(queryText).toContain('uwg.scheduled_for');
    expect(queryText).toContain("INTERVAL '1 day'");
    expect(queryText).toContain("INTERVAL '1 month'");
  });

  it('rejects invalid week and month query values', async () => {
    const weekRes = await request(app).get('/api/user/games?week=October-7');
    const monthRes = await request(app).get('/api/user/games?month=2024-October');

    expect(weekRes.status).toBe(400);
    expect(weekRes.body.error).toMatch(/week must be/i);
    expect(monthRes.status).toBe(400);
    expect(monthRes.body.error).toMatch(/month must be/i);
    expect(sql).not.toHaveBeenCalled();
  });
});

describe('GET /api/user/games/route-lookup', () => {
  it('resolves a favorite-team slug game route to a game id', async () => {
    sql.mockResolvedValueOnce([{ game_id: 'game-1' }]);

    const res = await request(app)
      .get('/api/user/games/route-lookup?game_date=10-10-2024&game_slug=awy-vs-hom');
    const queryText = sql.mock.calls[0][0].join(' ');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ game_id: 'game-1' });
    expect(sql.mock.calls[0].slice(1)).toContain('user-1');
    expect(sql.mock.calls[0].slice(1)).toContain('2024-10-10');
    expect(sql.mock.calls[0].slice(1)).toContain('awy-vs-hom');
    expect(queryText).toContain('JOIN seasons');
    expect(queryText).toContain('JOIN leagues');
    expect(queryText).not.toContain("lower(l.code) = 'nhl'");
    expect(queryText).toContain("AT TIME ZONE 'America/New_York'");
    expect(queryText).toContain("AT TIME ZONE 'UTC'");
    expect(queryText).not.toContain("g.scheduled_time <> '00:00'");
    expect(queryText).toContain('user_favorite_teams');
    expect(queryText).not.toContain('uwg.skipped_at IS NULL');
  });

  it('rejects invalid route lookup dates', async () => {
    const res = await request(app)
      .get('/api/user/games/route-lookup?game_date=2024-10-10&game_slug=awy-vs-hom');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/MM-DD-YYYY/);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns 404 when no favorite-team game matches the slug route', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/user/games/route-lookup?game_date=10-10-2024&game_slug=awy-vs-hom');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe('GET /api/user/games/:id', () => {
  it('returns a single favorite-team game for the authenticated user', async () => {
    sql.mockResolvedValueOnce([GAME]);

    const res = await request(app).get('/api/user/games/game-1');
    const queryText = sql.mock.calls[0][0].join(' ');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('game-1');
    expect(res.body).toMatchObject({ home_score: 0, away_score: 0, winner_team_id: null });
    expect(sql.mock.calls[0].slice(1)).toContain('user-1');
    expect(sql.mock.calls[0].slice(1)).toContain('game-1');
    expect(queryText).toContain('user_favorite_teams');
    expect(queryText).toContain('(uwg.skipped_at IS NOT NULL) AS skipped_by_user');
    expect(queryText).not.toContain('uwg.skipped_at IS NULL');
    expect(queryText).toContain('series_progress.series_home_wins_at_game');
    expect(queryText).toContain('home_l5.home_last_five');
    expect(queryText).toContain('away_l5.away_last_five');
    expect(queryText).toContain('prev.previous_meetings');
    expect(queryText).toContain('ps.bracket_slot_key AS bracket_slot_key');
    expect(queryText).toContain('brs.matchup_names AS playoff_matchup_names');
    expect(queryText).not.toContain('NULL::int AS series_home_wins_at_game');
    expect(queryText).not.toContain("'[]'::json AS home_last_five");
  });

  it('returns 404 when the game is not visible to the authenticated user', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/user/games/nope');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/game not found/i);
  });
});

describe('POST /api/user/watched-games/:gameId', () => {
  it('marks a game as watched for the authenticated user', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'game-1', status: 'final' }])
      .mockResolvedValueOnce([{ watched_on: '2024-10-15', scheduled_for: null }]);

    const res = await request(app).post('/api/user/watched-games/game-1');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user_id: 'user-1',
      game_id: 'game-1',
      watched_on: '2024-10-15',
      scheduled_for: null,
    });
  });

  it('keeps a scheduled watch date when a delayed game is marked watched', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'game-1', status: 'final' }])
      .mockResolvedValueOnce([{ watched_on: '2024-10-12', scheduled_for: '2024-10-12' }]);

    const res = await request(app).post('/api/user/watched-games/game-1');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user_id: 'user-1',
      game_id: 'game-1',
      watched_on: '2024-10-12',
      scheduled_for: '2024-10-12',
    });
  });

  it('returns 404 when the game does not exist', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app).post('/api/user/watched-games/nope');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/game not found/i);
  });

  it('rejects marking non-final games as watched', async () => {
    sql.mockResolvedValueOnce([{ id: 'game-1', status: 'scheduled' }]);

    const res = await request(app).post('/api/user/watched-games/game-1');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/only final games/i);
    expect(sql).toHaveBeenCalledTimes(1);
  });
});

describe('PUT /api/user/watched-games/:gameId/schedule', () => {
  it('stores a scheduled watch date for the authenticated user', async () => {
    sql.mockResolvedValueOnce([{ id: 'game-1' }]).mockResolvedValueOnce([]);

    const res = await request(app)
      .put('/api/user/watched-games/game-1/schedule')
      .send({ scheduled_for: '2024-10-14' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user_id: 'user-1',
      game_id: 'game-1',
      scheduled_for: '2024-10-14',
    });
  });
});

describe('DELETE /api/user/watched-games/:gameId', () => {
  it('deletes the watched record when no scheduled watch date exists', async () => {
    sql.mockResolvedValueOnce([{ scheduled_for: null }]).mockResolvedValueOnce([]);

    const res = await request(app).delete('/api/user/watched-games/game-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user_id: 'user-1',
      game_id: 'game-1',
      watched_on: null,
      scheduled_for: null,
      deleted: true,
    });
  });

  it('preserves the scheduled watch date when clearing watched state', async () => {
    sql.mockResolvedValueOnce([{ scheduled_for: '2024-10-14' }]).mockResolvedValueOnce([]);

    const res = await request(app).delete('/api/user/watched-games/game-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user_id: 'user-1',
      game_id: 'game-1',
      watched_on: null,
      scheduled_for: '2024-10-14',
    });
  });
});

describe('POST /api/user/watched-games/:gameId/skip', () => {
  it('marks a game as skipped for the authenticated user', async () => {
    sql.mockResolvedValueOnce([{ id: 'game-1' }]).mockResolvedValueOnce([]);

    const res = await request(app).post('/api/user/watched-games/game-1/skip');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user_id: 'user-1',
      game_id: 'game-1',
      skipped: true,
    });
  });
});
