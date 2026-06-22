'use strict';

jest.mock('../db', () => ({
  sql: jest.fn(),
  db: { select: jest.fn() },
  schema: jest.requireActual('../schema'),
}));

jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, _res, next) => {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  },
}));

jest.mock('@vercel/blob', () => ({
  list: jest.fn(),
  del: jest.fn(),
}));

jest.mock('../lib/blobCleanup', () => ({
  cleanupUnusedBlobs: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { sql } = require('../db');
const adminRouter = require('./admin');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);

describe('GET /api/admin/game-data-storage', () => {
  beforeEach(() => {
    sql.mockReset();
  });

  it('returns game-data table storage totals', async () => {
    sql.mockResolvedValueOnce([
      {
        table_name: 'game_rosters',
        label: 'Game Rosters',
        category: 'participation',
        is_legacy: false,
        present: true,
        estimated_rows: '64000',
        table_bytes: '4096',
        index_bytes: '8192',
        total_bytes: '12288',
        table_pretty: '4096 bytes',
        index_pretty: '8192 bytes',
        total_pretty: '12 kB',
        pct_of_total: '75.00',
      },
    ]);

    const res = await request(app).get('/api/admin/game-data-storage');

    expect(res.status).toBe(200);
    expect(res.body.row_count_source).toBe('pg_stat_user_tables.n_live_tup');
    expect(res.body.tables).toHaveLength(1);
    expect(res.body.tables[0]).toMatchObject({
      table_name: 'game_rosters',
      estimated_rows: 64000,
      total_bytes: 12288,
      is_legacy: false,
      present: true,
    });
    expect(res.body.totals).toMatchObject({
      estimated_rows: 64000,
      table_bytes: 4096,
      index_bytes: 8192,
      total_bytes: 12288,
    });
    expect(res.body.cleanup_candidates).toEqual([]);
  });

  it('returns 500 when the storage report query fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    sql.mockRejectedValueOnce(new Error('DB down'));

    try {
      const res = await request(app).get('/api/admin/game-data-storage');

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/storage report/i);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
