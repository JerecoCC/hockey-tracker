const router = require('express').Router();
const { list, del } = require('@vercel/blob');
const { requireAdmin } = require('../middleware/auth');
const { desc, eq, sql } = require('drizzle-orm');
const { db, schema, sql: rawSql } = require('../db');
const { cleanupUnusedBlobs } = require('../lib/blobCleanup');

const { users } = schema;

const toNumber = (value) => Number(value ?? 0);

const mapStorageRow = (row) => ({
  table_name: row.table_name,
  label: row.label,
  category: row.category,
  is_legacy: row.is_legacy === true,
  present: row.present === true,
  estimated_rows: toNumber(row.estimated_rows),
  table_bytes: toNumber(row.table_bytes),
  index_bytes: toNumber(row.index_bytes),
  total_bytes: toNumber(row.total_bytes),
  table_pretty: row.table_pretty,
  index_pretty: row.index_pretty,
  total_pretty: row.total_pretty,
  pct_of_total: toNumber(row.pct_of_total),
});

// All admin routes require the admin role
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// GET /api/admin/users  – list all users
// ---------------------------------------------------------------------------
router.get('/users', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        display_name: users.displayName,
        email: users.email,
        role: users.role,
        is_google: sql`${users.googleId} IS NOT NULL`,
        created_at: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    return res.json(rows);
  } catch (err) {
    console.error('admin list users error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id/role  – change a user's role
// ---------------------------------------------------------------------------
router.patch('/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'role must be "user" or "admin"' });
  }

  // Prevent an admin from demoting themselves
  if (id === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot demote yourself' });
  }

  try {
    const rows = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        display_name: users.displayName,
        email: users.email,
        role: users.role,
      });
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('admin update role error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id  – delete a user
// ---------------------------------------------------------------------------
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete yourself' });
  }

  try {
    const rows = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    return res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('admin delete user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/blob-cleanup  – dry-run or delete unreferenced upload blobs
// Body: { dryRun?: boolean }  (defaults to true)
// ---------------------------------------------------------------------------
router.post('/blob-cleanup', async (req, res) => {
  const dryRun = req.body?.dryRun !== false;

  try {
    const result = await cleanupUnusedBlobs({
      sql: rawSql,
      listBlobs: list,
      deleteBlobs: del,
      dryRun,
    });
    return res.json(result);
  } catch (err) {
    console.error('admin blob cleanup error:', err);
    return res.status(500).json({ error: 'Failed to clean up uploaded images' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/game-data-storage - inspect DB footprint for game data tables
// ---------------------------------------------------------------------------
router.get('/game-data-storage', async (_req, res) => {
  try {
    const rows = await rawSql`
      WITH tracked(table_name, label, category, is_legacy) AS (
        VALUES
          ('games',                'Games',                'core',          false),
          ('playoff_series',       'Playoff Series',       'core',          false),
          ('goals',                'Goals',                'events',        false),
          ('shootout_attempts',    'Shootout Attempts',    'events',        false),
          ('game_rosters',         'Game Rosters',         'participation', false),
          ('game_goalie_stints',   'Goalie Stints',        'goalies',       false),
          ('user_watched_games',   'User Watched Games',   'user',          false)
      ),
      relation_sizes AS (
        SELECT
          t.table_name,
          t.label,
          t.category,
          t.is_legacy,
          c.oid,
          c.oid IS NOT NULL AS present,
          COALESCE(s.n_live_tup, 0)::bigint AS estimated_rows,
          CASE WHEN c.oid IS NULL THEN 0 ELSE pg_relation_size(c.oid) END::bigint AS table_bytes,
          CASE WHEN c.oid IS NULL THEN 0 ELSE pg_indexes_size(c.oid) END::bigint AS index_bytes,
          CASE WHEN c.oid IS NULL THEN 0 ELSE pg_total_relation_size(c.oid) END::bigint AS total_bytes
        FROM tracked t
        LEFT JOIN pg_class c ON c.oid = to_regclass(format('public.%I', t.table_name))
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      )
      SELECT
        table_name,
        label,
        category,
        is_legacy,
        present,
        estimated_rows,
        table_bytes,
        index_bytes,
        total_bytes,
        pg_size_pretty(table_bytes) AS table_pretty,
        pg_size_pretty(index_bytes) AS index_pretty,
        pg_size_pretty(total_bytes) AS total_pretty,
        CASE
          WHEN SUM(total_bytes) OVER () > 0
            THEN ROUND((total_bytes::numeric / SUM(total_bytes) OVER ()) * 100, 2)
          ELSE 0
        END AS pct_of_total
      FROM relation_sizes
      ORDER BY total_bytes DESC, table_name ASC
    `;

    const tables = rows.map(mapStorageRow);
    const totals = tables.reduce(
      (acc, table) => ({
        estimated_rows: acc.estimated_rows + table.estimated_rows,
        table_bytes: acc.table_bytes + table.table_bytes,
        index_bytes: acc.index_bytes + table.index_bytes,
        total_bytes: acc.total_bytes + table.total_bytes,
      }),
      { estimated_rows: 0, table_bytes: 0, index_bytes: 0, total_bytes: 0 },
    );
    const cleanupCandidates = tables
      .filter(
        (table) => table.is_legacy && table.present && table.total_bytes > 0,
      )
      .map((table) => ({
        table_name: table.table_name,
        label: table.label,
        total_bytes: table.total_bytes,
        total_pretty: table.total_pretty,
      }));

    return res.json({
      generated_at: new Date().toISOString(),
      row_count_source: 'pg_stat_user_tables.n_live_tup',
      tables,
      totals,
      cleanup_candidates: cleanupCandidates,
    });
  } catch (err) {
    console.error('admin game data storage report error:', err);
    return res
      .status(500)
      .json({ error: 'Failed to load game data storage report' });
  }
});

module.exports = router;
