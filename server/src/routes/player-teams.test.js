'use strict';

jest.mock('drizzle-orm', () => ({
  and: jest.fn((...args) => ({ type: 'and', args })),
  desc: jest.fn((column) => ({ type: 'desc', column })),
  eq: jest.fn((left, right) => ({ type: 'eq', left, right })),
  sql: jest.fn((strings, ...values) => ({ type: 'sql', strings, values })),
}));

jest.mock('../db', () => {
  const mockSql = jest.fn();
  mockSql.transaction = jest.fn();
  const mockDbChain = {
    from: jest.fn(() => mockDbChain),
    innerJoin: jest.fn(() => mockDbChain),
    where: jest.fn(() => mockDbChain),
    orderBy: jest.fn(),
  };
  const playerTeams = {
    id: 'pt.id',
    playerId: 'pt.player_id',
    teamId: 'pt.team_id',
    seasonId: 'pt.season_id',
    jerseyNumber: 'pt.jersey_number',
    isProspect: 'pt.is_prospect',
    position: 'pt.position',
    acquisitionType: 'pt.acquisition_type',
    startDate: 'pt.start_date',
    endDate: 'pt.end_date',
    createdAt: 'pt.created_at',
  };
  const teams = {
    id: 't.id',
    primaryColor: 't.primary_color',
    textColor: 't.text_color',
  };
  return {
    sql: mockSql,
    db: {
      select: jest.fn(() => mockDbChain),
    },
    schema: { playerTeams, teams },
    __mockDbChain: mockDbChain,
  };
});

jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, res, next) => {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  },
}));

const request = require('supertest');
const express = require('express');
const { sql, __mockDbChain } = require('../db');
const playerTeamsRouter = require('./player-teams');

const app = express();
app.use(express.json());
app.use('/api/admin/player-teams', playerTeamsRouter);

const STINT_ROW = {
  id: 'stint-1',
  player_id: 'player-1',
  team_id: 'team-1',
  roster_player_team_id: 'roster-1',
  season_id: 'season-1',
  jersey_number: 16,
  is_prospect: false,
  photo: 'https://example.com/player.png',
  position: 'C',
  acquisition_type: 'trade',
  start_date: '2024-10-01',
  end_date: null,
  created_at: '2024-10-01T00:00:00.000Z',
  team_name: 'Toronto Maple Leafs',
  team_code: 'TOR',
  team_logo: 'https://example.com/leafs.png',
  primary_color: '#003e7e',
  text_color: '#ffffff',
};

const RECONCILE_PLAYER_ID = '11111111-1111-4111-8111-111111111111';
const RECONCILE_TEAM_ID = '22222222-2222-4222-8222-222222222222';
const RECONCILE_OLD_TEAM_ID = '33333333-3333-4333-8333-333333333333';
const RECONCILE_URL = `/api/admin/player-teams/history/${RECONCILE_PLAYER_ID}/reconcile`;

const RECONCILE_STINT = {
  import_key: 'nhl_puckpedia:v1:event:2025-03-07',
  team_id: RECONCILE_TEAM_ID,
  position: 'D',
  acquisition_type: 'trade',
  start_date: '2025-03-07',
  end_date: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  sql.mockReset();
  sql.transaction.mockReset();
  __mockDbChain.from.mockClear();
  __mockDbChain.innerJoin.mockClear();
  __mockDbChain.where.mockClear();
  __mockDbChain.orderBy.mockReset();
});

describe('POST /api/admin/player-teams/bulk', () => {
  it('returns 400 when players is empty', async () => {
    const res = await request(app)
      .post('/api/admin/player-teams/bulk')
      .send({ team_id: 'team-1', season_id: 'season-1', players: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/players must be a non-empty array/i);
  });

  it('creates roster rows and reports skipped duplicates', async () => {
    sql
      .mockResolvedValueOnce([{ start_date: '2025-10-01' }])
      .mockResolvedValueOnce([{ id: 'career-stint-1', player_id: 'player-1', created: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/admin/player-teams/bulk')
      .send({
        team_id: 'team-1',
        season_id: 'season-1',
        players: [
          { player_id: 'player-1', jersey_number: 16 },
          { player_id: 'player-2', jersey_number: 34 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.skipped).toBe(1);
    expect(sql).toHaveBeenCalledTimes(4);
    expect(sql.mock.calls.some((call) => call[0].join(' ').includes('INSERT INTO player_teams'))).toBe(false);
  });
});

describe('POST /api/admin/player-teams', () => {
  it('rejects invalid acquisition_type', async () => {
    const res = await request(app)
      .post('/api/admin/player-teams')
      .send({
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        acquisition_type: 'call_up',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid acquisition_type/i);
  });

  it('accepts expansion signing as an acquisition_type', async () => {
    sql
      .mockResolvedValueOnce([{ start_date: '2024-10-01' }])
      .mockResolvedValueOnce([{
        id: 'career-stint-1',
        player_id: 'player-1',
        team_id: 'team-1',
        position: 'C',
        acquisition_type: 'expansion_signing',
        start_date: '2024-10-01',
        end_date: null,
      }]);

    const res = await request(app)
      .post('/api/admin/player-teams')
      .send({
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        acquisition_type: 'expansion_signing',
      });

    expect(res.status).toBe(201);
    expect(res.body.acquisition_type).toBe('expansion_signing');
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it('creates a stint and stores the season photo when provided', async () => {
    sql
      .mockResolvedValueOnce([{
        id: 'stint-1',
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        jersey_number: 16,
        position: 'C',
        acquisition_type: 'foundational_signing',
        start_date: '2024-10-01',
        end_date: null,
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'career-stint-1' }]);

    const res = await request(app)
      .post('/api/admin/player-teams')
      .send({
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        jersey_number: 16,
        position: 'C',
        acquisition_type: 'foundational_signing',
        start_date: '2024-10-01',
        photo: 'https://example.com/player.png',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 'stint-1',
      acquisition_type: 'foundational_signing',
      photo: 'https://example.com/player.png',
    });
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it('returns 409 when an active stint already exists', async () => {
    const err = Object.assign(new Error('duplicate'), { code: '23505' });
    sql.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/admin/player-teams')
      .send({ player_id: 'player-1', team_id: 'team-1', season_id: 'season-1' });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/admin/player-teams/history/:playerId', () => {
  it('returns stints with team data nested under team', async () => {
    sql.mockResolvedValueOnce([STINT_ROW]);

    const res = await request(app).get('/api/admin/player-teams/history/player-1');

    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual([
      {
        id: 'stint-1',
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        roster_player_team_id: 'roster-1',
        jersey_number: 16,
        is_prospect: false,
        photo: 'https://example.com/player.png',
        position: 'C',
        acquisition_type: 'trade',
        start_date: '2024-10-01',
        end_date: null,
        created_at: '2024-10-01T00:00:00.000Z',
        has_stats: false,
        can_delete: true,
        team: {
          id: 'team-1',
          name: 'Toronto Maple Leafs',
          code: 'TOR',
          logo: 'https://example.com/leafs.png',
          primary_color: '#003e7e',
          text_color: '#ffffff',
        },
      },
    ]);
    const queryText = sql.mock.calls[0][0].join(' ');
    const openRosterIndex = queryText.indexOf('CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END');
    const rosterDateIndex = queryText.indexOf(
      'COALESCE(pt.end_date, pt.start_date, s.start_date, pt.created_at::date) DESC NULLS LAST',
    );
    const openStintIndex = queryText.indexOf('CASE WHEN pts.end_date IS NULL THEN 0 ELSE 1 END');
    const stintDateIndex = queryText.indexOf(
      'COALESCE(pts.end_date, pts.start_date, pts.created_at::date) DESC NULLS LAST',
    );
    expect(openRosterIndex).toBeGreaterThanOrEqual(0);
    expect(rosterDateIndex).toBeGreaterThan(openRosterIndex);
    expect(openStintIndex).toBeGreaterThanOrEqual(0);
    expect(stintDateIndex).toBeGreaterThan(openStintIndex);
  });

  it('returns null acquisition_type when the stint has no acquisition type', async () => {
    sql.mockResolvedValueOnce([{ ...STINT_ROW, acquisition_type: null }]);

    const res = await request(app).get('/api/admin/player-teams/history/player-1');

    expect(res.status).toBe(200);
    expect(res.body[0].acquisition_type).toBeNull();
  });

  it('marks stints with team stats as not deletable', async () => {
    sql.mockResolvedValueOnce([{ ...STINT_ROW, has_player_stats: true, has_goalie_stats: false }]);

    const res = await request(app).get('/api/admin/player-teams/history/player-1');

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      has_stats: true,
      can_delete: false,
    });
  });

  it('returns 500 when history lookup fails', async () => {
    sql.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app).get('/api/admin/player-teams/history/player-1');

    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/player-teams/history/:playerId/reconcile', () => {
  const mockReconcileReads = (existingStints = [], leagueCode = 'NHL') => {
    sql
      .mockResolvedValueOnce([{ id: RECONCILE_PLAYER_ID, league_player_number: '8478402' }])
      .mockResolvedValueOnce([{ id: RECONCILE_TEAM_ID, league_code: leagueCode }])
      .mockResolvedValueOnce(existingStints);
  };

  it('rejects malformed player and team UUIDs before querying the database', async () => {
    const malformedPlayer = await request(app)
      .post('/api/admin/player-teams/history/not-a-uuid/reconcile')
      .send({ stints: [RECONCILE_STINT] });

    expect(malformedPlayer.status).toBe(400);
    expect(malformedPlayer.body.error).toMatch(/playerId must be a UUID/i);

    const malformedTeam = await request(app)
      .post(RECONCILE_URL)
      .send({ stints: [{ ...RECONCILE_STINT, team_id: 'not-a-uuid' }] });

    expect(malformedTeam.status).toBe(400);
    expect(malformedTeam.body.error).toMatch(/team_id must be a UUID/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('rejects display-only acquisition values before querying the database', async () => {
    const res = await request(app)
      .post(RECONCILE_URL)
      .send({
        stints: [{ ...RECONCILE_STINT, acquisition_type: 'current_stint' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid acquisition_type/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('previews career-only creates without opening a transaction', async () => {
    mockReconcileReads();

    const res = await request(app)
      .post(RECONCILE_URL)
      .send({ stints: [RECONCILE_STINT], dry_run: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      source: 'nhl_puckpedia',
      dry_run: true,
      applied: false,
      summary: { total: 1, create: 1, conflict: 0 },
      actions: [expect.objectContaining({ action: 'create' })],
    });
    expect(sql.transaction).not.toHaveBeenCalled();
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it('atomically applies only player_team_stints writes behind an advisory lock', async () => {
    mockReconcileReads();
    let transactionQueries = [];
    sql.transaction.mockImplementationOnce(async (buildQueries) => {
      const txn = jest.fn((strings, ...values) => ({ strings, values }));
      transactionQueries = buildQueries(txn);
      return [[], [], [{ id: 'career-stint-1' }], []];
    });

    const res = await request(app)
      .post(RECONCILE_URL)
      .send({ stints: [RECONCILE_STINT], apply: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      dry_run: false,
      applied: true,
      summary: { create: 1, conflict: 0 },
      actions: [
        expect.objectContaining({
          action: 'create',
          stint_id: 'career-stint-1',
          applied: true,
        }),
      ],
    });
    expect(sql.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(transactionQueries).toHaveLength(4);
    expect(transactionQueries[0].strings.join(' ')).toContain('pg_advisory_xact_lock');
    expect(transactionQueries[1].strings.join(' ')).toContain('current_state');
    const writeQuery = transactionQueries[2].strings.join(' ');
    expect(writeQuery).toContain('INSERT INTO player_team_stints');
    expect(writeQuery).not.toMatch(/\bplayer_teams\b/);
    expect(writeQuery).toContain('ON CONFLICT (player_id, import_source, import_key)');
  });

  it('does no writes when an identical imported stint is applied again', async () => {
    mockReconcileReads([
      {
        id: 'career-stint-1',
        player_id: RECONCILE_PLAYER_ID,
        ...RECONCILE_STINT,
        import_source: 'nhl_puckpedia',
        import_snapshot: {
          team_id: RECONCILE_TEAM_ID,
          position: 'D',
          acquisition_type: 'trade',
          start_date: '2025-03-07',
          end_date: null,
        },
      },
    ]);

    const res = await request(app)
      .post(RECONCILE_URL)
      .send({ stints: [RECONCILE_STINT], apply: true });

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      unchanged: 1,
      create: 0,
      update: 0,
    });
    expect(res.body.actions[0]).toMatchObject({
      action: 'unchanged',
      applied: false,
      stint_id: 'career-stint-1',
    });
    expect(sql.transaction).not.toHaveBeenCalled();
  });

  it('returns 409 when the under-lock state guard detects a stale preview', async () => {
    mockReconcileReads();
    sql.transaction.mockRejectedValueOnce(Object.assign(new Error('state changed'), { code: '22P02' }));

    const res = await request(app)
      .post(RECONCILE_URL)
      .send({ stints: [RECONCILE_STINT], apply: true });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/changed during reconciliation/i);
  });

  it('preserves a manual override while applying other source-owned updates', async () => {
    mockReconcileReads([
      {
        id: 'career-stint-1',
        player_id: RECONCILE_PLAYER_ID,
        ...RECONCILE_STINT,
        acquisition_type: 'other',
        import_source: 'nhl_puckpedia',
        import_snapshot: {
          team_id: RECONCILE_TEAM_ID,
          position: 'D',
          acquisition_type: 'trade',
          start_date: '2025-03-07',
          end_date: null,
        },
      },
    ]);
    let transactionQueries = [];
    sql.transaction.mockImplementationOnce(async (buildQueries) => {
      const txn = jest.fn((strings, ...values) => ({ strings, values }));
      transactionQueries = buildQueries(txn);
      return [[], [], [{ id: 'career-stint-1', runtime_conflicts: ['acquisition_type'] }], []];
    });

    const res = await request(app)
      .post(RECONCILE_URL)
      .send({
        stints: [
          {
            ...RECONCILE_STINT,
            acquisition_type: 'waivers',
            end_date: '2026-03-06',
          },
        ],
        apply: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.actions[0]).toMatchObject({
      action: 'update',
      applied: true,
      changes: ['end_date'],
      conflicts: ['acquisition_type'],
      conflict_type: 'manual_override',
    });
    expect(res.body.summary).toMatchObject({ update: 1, conflict: 1 });
    const writeQuery = transactionQueries[2].strings.join(' ');
    expect(writeQuery).toContain('WITH before AS');
    expect(writeQuery).toContain('import_snapshot');
    expect(writeQuery).not.toMatch(/\bplayer_teams\b/);
  });

  it('previews a differing manual row as an adoption that preserves its override', async () => {
    mockReconcileReads([
      {
        id: 'manual-stint-1',
        player_id: RECONCILE_PLAYER_ID,
        ...RECONCILE_STINT,
        acquisition_type: 'draft',
        import_source: null,
        import_key: null,
        import_snapshot: null,
      },
    ]);

    const res = await request(app)
      .post(RECONCILE_URL)
      .send({ stints: [RECONCILE_STINT], dry_run: true });

    expect(res.status).toBe(200);
    expect(res.body.actions[0]).toMatchObject({
      action: 'adopt',
      stint_id: 'manual-stint-1',
      conflicts: ['acquisition_type'],
      conflict_type: 'manual_override',
    });
    expect(sql.transaction).not.toHaveBeenCalled();
  });

  it('applies an inferred start date to an existing manual stint whose start is null', async () => {
    mockReconcileReads([
      {
        id: 'manual-stint-1',
        player_id: RECONCILE_PLAYER_ID,
        ...RECONCILE_STINT,
        start_date: null,
        import_source: null,
        import_key: null,
        import_snapshot: null,
      },
    ]);
    let transactionQueries = [];
    sql.transaction.mockImplementationOnce(async (buildQueries) => {
      const txn = jest.fn((strings, ...values) => ({ strings, values }));
      transactionQueries = buildQueries(txn);
      return [[], [], [{ id: 'manual-stint-1' }], []];
    });

    const res = await request(app)
      .post(RECONCILE_URL)
      .send({ stints: [RECONCILE_STINT], apply: true });

    expect(res.status).toBe(200);
    expect(res.body.actions[0]).toMatchObject({
      action: 'adopt',
      stint_id: 'manual-stint-1',
      changes: ['start_date'],
      applied: true,
    });
    expect(res.body.summary).toMatchObject({ adopt: 1, conflict: 0 });
    expect(transactionQueries[2].strings.join(' ')).toContain(
      'WHEN before.start_date IS NULL',
    );
  });

  it('virtually closes an exact manual anchor before planning the destination create', async () => {
    sql
      .mockResolvedValueOnce([{ id: RECONCILE_PLAYER_ID, league_player_number: '8478402' }])
      .mockResolvedValueOnce([
        { id: RECONCILE_OLD_TEAM_ID, league_code: 'NHL' },
        { id: RECONCILE_TEAM_ID, league_code: 'NHL' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'manual-anchor',
          player_id: RECONCILE_PLAYER_ID,
          team_id: RECONCILE_OLD_TEAM_ID,
          position: 'D',
          acquisition_type: 'draft',
          start_date: '2020-10-01',
          end_date: null,
          import_source: null,
          import_key: null,
          import_snapshot: null,
        },
      ]);

    const res = await request(app)
      .post(RECONCILE_URL)
      .send({
        dry_run: true,
        stints: [
          {
            import_key: '2020-10-01|draft|-|team-old',
            team_id: RECONCILE_OLD_TEAM_ID,
            position: 'D',
            acquisition_type: 'draft',
            start_date: '2020-10-01',
            end_date: '2025-03-07',
          },
          RECONCILE_STINT,
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.actions).toEqual([
      expect.objectContaining({
        action: 'adopt',
        stint_id: 'manual-anchor',
        changes: ['end_date'],
      }),
      expect.objectContaining({
        action: 'create',
        import_key: RECONCILE_STINT.import_key,
      }),
    ]);
    expect(res.body.summary).toMatchObject({
      adopt: 1,
      create: 1,
      conflict: 0,
    });
  });

  it('rejects teams outside the NHL league', async () => {
    sql
      .mockResolvedValueOnce([{ id: RECONCILE_PLAYER_ID, league_player_number: '8478402' }])
      .mockResolvedValueOnce([{ id: RECONCILE_TEAM_ID, league_code: 'PWHL' }]);

    const res = await request(app)
      .post(RECONCILE_URL)
      .send({ stints: [RECONCILE_STINT] });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      invalid_team_ids: [RECONCILE_TEAM_ID],
    });
    expect(sql).toHaveBeenCalledTimes(2);
    expect(sql.transaction).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/admin/player-teams', () => {
  it('requires an effective date when changing a jersey number', async () => {
    const res = await request(app)
      .patch('/api/admin/player-teams')
      .send({
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        jersey_number: 91,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/effective_date is required/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it('writes a dated canonical jersey assignment while mirroring a legacy row', async () => {
    sql
      .mockResolvedValueOnce([{
        id: 'stint-1',
        jersey_number: 43,
        effective_start: '2025-12-01',
        season_start: '2025-10-07',
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'stint-1',
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        jersey_number: 19,
        is_prospect: false,
        position: 'C',
      }]);

    const res = await request(app)
      .patch('/api/admin/player-teams')
      .send({
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        jersey_number: 19,
        effective_date: '2025-11-15',
      });

    expect(res.status).toBe(200);
    expect(res.body.jersey_number).toBe(19);
    const legacyLookup = sql.mock.calls.find((call) =>
      call[0].join(' ').includes('AS effective_start'),
    );
    expect(legacyLookup[0].join(' ')).toContain(
      'COALESCE(pt.start_date, s.start_date, pt.created_at::date)::text AS effective_start',
    );
    expect(sql.mock.calls.some((call) =>
      call[0].join(' ').includes('INSERT INTO player_jersey_stints'),
    )).toBe(true);
  });

  it('updates prospect status without creating a new stint', async () => {
    sql
      .mockResolvedValueOnce([{
      id: 'stint-1',
      player_id: 'player-1',
      team_id: 'team-1',
      season_id: 'season-1',
      jersey_number: 16,
      is_prospect: true,
      position: 'C',
      }])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .patch('/api/admin/player-teams')
      .send({
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        is_prospect: true,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'stint-1',
      is_prospect: true,
    });
    expect(sql).toHaveBeenCalledTimes(2);
    expect(sql.mock.calls[0][0].join(' ')).toContain('UPDATE player_team_stints');
  });

  it('updates prospect status on a matching historical stint when no active row exists', async () => {
    sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'stint-sjs',
        player_id: 'player-kyle-masters',
        team_id: 'team-sjs',
        season_id: 'season-1',
        jersey_number: 44,
        is_prospect: true,
        position: 'C',
      }]);

    const res = await request(app)
      .patch('/api/admin/player-teams')
      .send({
        player_id: 'player-kyle-masters',
        team_id: 'team-sjs',
        season_id: 'season-1',
        is_prospect: true,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'stint-sjs',
      is_prospect: true,
    });
    expect(sql).toHaveBeenCalledTimes(2);
  });
});

describe('POST /api/admin/player-teams/trade', () => {
  it('keeps acquisition_type null when explicitly provided as unknown', async () => {
    sql
      .mockResolvedValueOnce([{
        source_season_id: 'season-1',
        source_league_id: 'league-1',
        source_start_date: '2025-10-01',
        source_end_date: '2026-06-30',
        requested_season_id: null,
        requested_league_id: null,
        is_after_source_end: false,
        roster_season_id: 'season-1',
      }])
      .mockResolvedValueOnce([{ id: 'old-stint', team_id: 'team-old' }])
      .mockResolvedValueOnce([{ id: 'old-career-stint' }])
      .mockResolvedValueOnce([{
        id: 'new-stint',
        player_id: 'player-1',
        team_id: 'team-new',
        season_id: 'season-1',
        jersey_number: 28,
        position: 'D',
        acquisition_type: null,
        start_date: '2025-11-15',
        end_date: null,
      }])
      .mockResolvedValueOnce([{ id: 'new-career-stint' }]);

    const res = await request(app)
      .post('/api/admin/player-teams/trade')
      .send({
        player_id: 'player-1',
        season_id: 'season-1',
        to_team_id: 'team-new',
        trade_date: '2025-11-15',
        jersey_number: 28,
        position: 'D',
        acquisition_type: null,
      });

    expect(res.status).toBe(201);
    expect(res.body.new_stint.acquisition_type).toBeNull();
    expect(sql.mock.calls.some((call) => call[0].join(' ').includes('INSERT INTO player_teams'))).toBe(false);
  });

  it('adds the destination row to the next season when the move is after the source season ended', async () => {
    sql
      .mockResolvedValueOnce([{
        source_season_id: 'season-2025',
        source_league_id: 'league-1',
        source_start_date: '2025-10-01',
        source_end_date: '2026-06-30',
        requested_season_id: null,
        requested_league_id: null,
        is_after_source_end: true,
        roster_season_id: 'season-2026',
      }])
      .mockResolvedValueOnce([{ id: 'old-stint', team_id: 'team-old' }])
      .mockResolvedValueOnce([{ id: 'old-career-stint' }])
      .mockResolvedValueOnce([{
        id: 'new-stint',
        player_id: 'player-1',
        team_id: 'team-new',
        season_id: 'season-2026',
        jersey_number: 28,
        position: 'D',
        acquisition_type: 'trade',
        start_date: '2026-07-15',
        end_date: null,
      }])
      .mockResolvedValueOnce([{ id: 'new-career-stint' }]);

    const res = await request(app)
      .post('/api/admin/player-teams/trade')
      .send({
        player_id: 'player-1',
        season_id: 'season-2025',
        to_team_id: 'team-new',
        trade_date: '2026-07-15',
        jersey_number: 28,
        position: 'D',
      });

    expect(res.status).toBe(201);
    expect(res.body.new_stint.season_id).toBe('season-2026');
    expect(res.body.new_stint.roster_source).toBe('derived');
    expect(sql.mock.calls.some((call) => call[0].join(' ').includes('INSERT INTO player_teams'))).toBe(false);
  });

  it('uses the selected roster season when one is provided', async () => {
    sql
      .mockResolvedValueOnce([{
        source_season_id: 'season-2025',
        source_league_id: 'league-1',
        source_start_date: '2025-10-01',
        source_end_date: '2026-06-30',
        requested_season_id: 'season-choice',
        requested_league_id: 'league-1',
        is_after_source_end: true,
        roster_season_id: 'season-choice',
      }])
      .mockResolvedValueOnce([{ id: 'old-stint', team_id: 'team-old' }])
      .mockResolvedValueOnce([{ id: 'old-career-stint' }])
      .mockResolvedValueOnce([{
        id: 'new-stint',
        player_id: 'player-1',
        team_id: 'team-new',
        season_id: 'season-choice',
        jersey_number: 28,
        position: 'D',
        acquisition_type: 'trade',
        start_date: '2026-07-15',
        end_date: null,
      }])
      .mockResolvedValueOnce([{ id: 'new-career-stint' }]);

    const res = await request(app)
      .post('/api/admin/player-teams/trade')
      .send({
        player_id: 'player-1',
        season_id: 'season-2025',
        target_season_id: 'season-choice',
        to_team_id: 'team-new',
        trade_date: '2026-07-15',
        jersey_number: 28,
        position: 'D',
      });

    expect(res.status).toBe(201);
    expect(res.body.new_stint.season_id).toBe('season-choice');
    expect(res.body.new_stint.roster_source).toBe('derived');
    expect(sql.mock.calls.some((call) => call[0].join(' ').includes('INSERT INTO player_teams'))).toBe(false);
  });
});

describe('PATCH /api/admin/player-teams/:id', () => {
  it('updates the latest roster and season photo when editing a career stint', async () => {
    sql
      .mockResolvedValueOnce([{
        id: 'career-stint-1',
        player_id: 'player-1',
        team_id: 'team-1',
        position: 'C',
        acquisition_type: 'trade',
        start_date: '2024-10-01',
        end_date: null,
      }])
      .mockResolvedValueOnce([{
        id: 'roster-1',
        team_id: 'team-1',
        season_id: 'season-1',
        jersey_number: 16,
        is_prospect: false,
        position: 'C',
      }])
      .mockResolvedValueOnce([{
        id: 'roster-1',
        team_id: 'team-1',
        season_id: 'season-1',
        jersey_number: 19,
        is_prospect: false,
        position: 'C',
      }])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .patch('/api/admin/player-teams/career-stint-1')
      .send({
        jersey_number: 19,
        photo: 'https://example.com/new-player.png',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'career-stint-1',
      roster_player_team_id: 'roster-1',
      season_id: 'season-1',
      jersey_number: 19,
      photo: 'https://example.com/new-player.png',
    });
    expect(sql).toHaveBeenCalledTimes(4);
  });

  it('updates the submitted season roster when editing a career stint jersey number', async () => {
    sql
      .mockResolvedValueOnce([{
        id: 'career-stint-1',
        player_id: 'player-1',
        team_id: 'team-1',
        position: 'C',
        acquisition_type: 'trade',
        start_date: '2024-10-01',
        end_date: null,
      }])
      .mockResolvedValueOnce([{
        id: 'roster-season-2',
        team_id: 'team-1',
        season_id: 'season-2',
        jersey_number: 16,
        is_prospect: false,
        position: 'C',
      }])
      .mockResolvedValueOnce([{
        id: 'roster-season-2',
        team_id: 'team-1',
        season_id: 'season-2',
        jersey_number: 88,
        is_prospect: false,
        position: 'C',
      }]);

    const res = await request(app)
      .patch('/api/admin/player-teams/career-stint-1')
      .send({
        season_id: 'season-2',
        jersey_number: 88,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'career-stint-1',
      roster_player_team_id: 'roster-season-2',
      season_id: 'season-2',
      jersey_number: 88,
    });
    expect(sql.mock.calls[1].slice(1)).toEqual(expect.arrayContaining(['season-2']));
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it('saves career stint edits without reporting a jersey number when no season roster exists', async () => {
    sql
      .mockResolvedValueOnce([{
        id: 'career-stint-1',
        player_id: 'player-1',
        team_id: 'team-1',
        position: 'C',
        acquisition_type: 'trade',
        start_date: '2024-10-01',
        end_date: null,
      }])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .patch('/api/admin/player-teams/career-stint-1')
      .send({
        season_id: 'season-2',
        jersey_number: 88,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'career-stint-1',
      season_id: 'season-2',
      roster_player_team_id: null,
      jersey_number: null,
    });
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it('updates prospect status on a legacy season roster row', async () => {
    sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'stint-1',
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        jersey_number: 16,
        is_prospect: true,
        position: 'C',
        acquisition_type: 'draft',
        start_date: '2024-10-01',
        end_date: '2025-01-15',
      }]);

    const res = await request(app)
      .patch('/api/admin/player-teams/stint-1')
      .send({ is_prospect: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'stint-1',
      is_prospect: true,
    });
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it('updates prospect status on a derived career stint roster row', async () => {
    sql
      .mockResolvedValueOnce([{
        id: 'career-stint-1',
        player_id: 'player-1',
        team_id: 'team-1',
        position: 'LW',
        is_prospect: true,
        acquisition_type: 'trade',
        start_date: '2026-07-01',
        end_date: null,
      }])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .patch('/api/admin/player-teams/career-stint-1')
      .send({ is_prospect: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'career-stint-1',
      roster_player_team_id: null,
      is_prospect: true,
    });
    expect(sql.mock.calls[0][0].join(' ')).toContain('is_prospect');
    expect(sql.mock.calls[0].slice(1)).toContain(true);
    expect(sql).toHaveBeenCalledTimes(2);
  });
});

describe('DELETE /api/admin/player-teams/:id', () => {
  it('deletes a career stint when the player has no stats for that team', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'career-stint-1', player_id: 'player-1', team_id: 'team-1' }])
      .mockResolvedValueOnce([{ has_player_stats: false, has_goalie_stats: false }])
      .mockResolvedValueOnce([]);

    const res = await request(app).delete('/api/admin/player-teams/career-stint-1');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Stint deleted');
    expect(sql).toHaveBeenCalledTimes(3);
    const deleteQuery = sql.mock.calls[2][0].join(' ');
    expect(deleteQuery).toContain('DELETE FROM player_teams');
    expect(deleteQuery).toContain('DELETE FROM player_team_stints');
  });

  it('returns 409 when the player has stats for that team', async () => {
    sql
      .mockResolvedValueOnce([{ id: 'career-stint-1', player_id: 'player-1', team_id: 'team-1' }])
      .mockResolvedValueOnce([{ has_player_stats: true, has_goalie_stats: false }]);

    const res = await request(app).delete('/api/admin/player-teams/career-stint-1');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/has stats for this team/i);
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it('removes the player-team association', async () => {
    sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'stint-1', player_id: 'player-1', team_id: 'team-1' }])
      .mockResolvedValueOnce([{ has_player_stats: false, has_goalie_stats: false }])
      .mockResolvedValueOnce([]);

    const res = await request(app).delete('/api/admin/player-teams/stint-1');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Player removed from team');
    expect(sql).toHaveBeenCalledTimes(4);
  });

  it('returns 404 when the stint is not found', async () => {
    sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await request(app).delete('/api/admin/player-teams/missing-stint');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/stint not found/i);
  });
});

describe('GET /api/admin/player-teams/history/:playerId/jerseys', () => {
  it('returns jersey history rows', async () => {
    sql.mockResolvedValueOnce([
      { id: 'j-1', player_teams_id: 'stint-1', jersey_number: 16, effective_from: '2024-10-01' },
    ]);

    const res = await request(app).get('/api/admin/player-teams/history/player-1/jerseys');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].jersey_number).toBe(16);
  });
});

describe('PATCH /api/admin/player-teams/history/jerseys/:id', () => {
  it('updates a jersey assignment and reconnects the timeline', async () => {
    const row = {
      id: 'j-1',
      player_id: 'player-1',
      team_id: 'team-1',
      jersey_number: 72,
      effective_from: '2026-01-25',
    };
    sql
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'stint-1' }]);

    const res = await request(app)
      .patch('/api/admin/player-teams/history/jerseys/j-1')
      .send({ jersey_number: 72, effective_from: '2026-01-25' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...row, player_teams_id: 'stint-1' });
    expect(sql).toHaveBeenCalledTimes(3);
    expect(sql.mock.calls[0][0].join(' ')).toContain('UPDATE player_jersey_stints');
    expect(sql.mock.calls[1][0].join(' ')).toContain('LEAD(start_date)');
  });

  it('validates jersey history update payloads', async () => {
    const res = await request(app)
      .patch('/api/admin/player-teams/history/jerseys/j-1')
      .send({ jersey_number: 172, effective_from: '2026-01-25' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/jersey_number/i);
    expect(sql).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/admin/player-teams/history/jerseys/:id', () => {
  it('deletes a jersey assignment and reconnects the timeline', async () => {
    const row = {
      id: 'j-1',
      player_id: 'player-1',
      team_id: 'team-1',
      jersey_number: 72,
      effective_from: '2026-01-25',
    };
    sql.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);

    const res = await request(app).delete('/api/admin/player-teams/history/jerseys/j-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...row, player_teams_id: null });
    expect(sql).toHaveBeenCalledTimes(2);
    const queryText = sql.mock.calls[0][0].join(' ');
    expect(queryText).toContain('DELETE FROM player_jersey_stints');
  });

  it('returns 404 when the jersey history row is missing', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app).delete('/api/admin/player-teams/history/jerseys/missing');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/jersey history row not found/i);
  });
});

describe('GET /api/admin/player-teams/history/:playerId/photos', () => {
  it('returns season membership photo rows with generated fallbacks', async () => {
    const rows = [
      {
        id: 'photo-1',
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-1',
        photo: 'https://example.com/player.png',
        created_at: '2024-10-01T00:00:00.000Z',
        season_name: '2024-25',
        team_name: 'Toronto Maple Leafs',
        has_saved_photo: true,
      },
      {
        id: null,
        player_id: 'player-1',
        team_id: 'team-1',
        season_id: 'season-2',
        photo: 'https://assets.nhle.com/mugs/nhl/20252026/TOR/8478402.png',
        created_at: null,
        season_name: '2025-26',
        team_name: 'Toronto Maple Leafs',
        has_saved_photo: false,
      },
    ];
    sql.mockResolvedValueOnce(rows);

    const res = await request(app).get('/api/admin/player-teams/history/player-1/photos');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.mock.calls[0][0].join(' ')).toContain('FROM player_teams pt');
    expect(sql.mock.calls[0][0].join(' ')).toContain('player_provider_photo');
  });
});

describe('POST /api/admin/player-teams/history/:playerId/photos', () => {
  it('requires team_id, season_id and photo', async () => {
    const res = await request(app)
      .post('/api/admin/player-teams/history/player-1/photos')
      .send({ team_id: 'team-1', season_id: 'season-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/photo is required/i);
  });

  it('upserts a player season photo', async () => {
    sql.mockResolvedValueOnce([{
      id: 'photo-1',
      player_id: 'player-1',
      team_id: 'team-1',
      season_id: 'season-1',
      photo: 'https://example.com/player.png',
      created_at: '2024-10-01T00:00:00.000Z',
    }]);

    const res = await request(app)
      .post('/api/admin/player-teams/history/player-1/photos')
      .send({
        team_id: 'team-1',
        season_id: 'season-1',
        photo: 'https://example.com/player.png',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('photo-1');
  });
});

describe('DELETE /api/admin/player-teams/history/photos/:id', () => {
  it('deletes a player photo row', async () => {
    const row = {
      id: 'photo-1',
      player_id: 'player-1',
      team_id: 'team-1',
      season_id: 'season-1',
      photo: 'https://example.com/player.png',
      created_at: '2024-10-01T00:00:00.000Z',
    };
    sql.mockResolvedValueOnce([row]);

    const res = await request(app).delete('/api/admin/player-teams/history/photos/photo-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(row);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.mock.calls[0][0].join(' ')).toContain('DELETE FROM player_photos');
  });

  it('returns 404 when the player photo row is missing', async () => {
    sql.mockResolvedValueOnce([]);

    const res = await request(app).delete('/api/admin/player-teams/history/photos/missing');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/player photo row not found/i);
  });
});
