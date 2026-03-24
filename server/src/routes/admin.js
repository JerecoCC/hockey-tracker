const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');

// All admin routes require the admin role
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// GET /api/admin/users  – list all users
// ---------------------------------------------------------------------------
router.get('/users', async (_req, res) => {
  try {
    const users = await sql`
      SELECT id, display_name, email, role, google_id IS NOT NULL AS is_google, created_at
      FROM users
      ORDER BY created_at DESC
    `;
    return res.json(users);
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
    const rows = await sql`
      UPDATE users SET role = ${role}
      WHERE id = ${id}
      RETURNING id, display_name, email, role
    `;
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
    const rows = await sql`
      DELETE FROM users WHERE id = ${id} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    return res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('admin delete user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

