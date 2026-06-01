const router = require('express').Router();
const { list, del } = require('@vercel/blob');
const { requireAdmin } = require('../middleware/auth');
const { desc, eq, sql } = require('drizzle-orm');
const { db, schema, sql: rawSql } = require('../db');
const { cleanupUnusedBlobs } = require('../lib/blobCleanup');

const { users } = schema;

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

module.exports = router;
