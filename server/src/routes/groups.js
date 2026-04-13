'use strict';

const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');

// All group routes require the admin role
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// GET /api/admin/groups?league_id=xxx
// Returns flat list of groups for a league with their default teams.
// Clients build the tree from parent_id.
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { league_id } = req.query;
  if (!league_id) {
    return res.status(400).json({ error: 'league_id query parameter is required' });
  }
  try {
    const groups = await sql`
      SELECT
        g.id, g.league_id, g.parent_id, g.name, g.sort_order, g.created_at,
        COALESCE(
          json_agg(
            json_build_object('id', t.id, 'name', ti.name, 'code', ti.code, 'logo', ti.logo)
            ORDER BY ti.name
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'::json
        ) AS teams
      FROM groups g
      LEFT JOIN group_teams gt ON gt.group_id = g.id
      LEFT JOIN teams t ON t.id = gt.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE g.league_id = ${league_id}
      GROUP BY g.id
      ORDER BY g.parent_id NULLS FIRST, g.sort_order, g.name
    `;
    return res.json(groups);
  } catch (err) {
    console.error('groups list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/groups  – create a group
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { league_id, name, parent_id, sort_order } = req.body;

  if (!league_id) return res.status(400).json({ error: 'league_id is required' });
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }

  // Validate parent belongs to the same league
  if (parent_id) {
    try {
      const parentRows = await sql`
        SELECT id FROM groups WHERE id = ${parent_id} AND league_id = ${league_id}
      `;
      if (parentRows.length === 0) {
        return res.status(400).json({ error: 'parent group not found in this league' });
      }
    } catch (err) {
      console.error('groups parent check error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  try {
    const rows = await sql`
      INSERT INTO groups (league_id, parent_id, name, sort_order)
      VALUES (${league_id}, ${parent_id ?? null}, ${name.trim()}, ${sort_order ?? 0})
      RETURNING id, league_id, parent_id, name, sort_order, created_at
    `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'League not found' });
    console.error('groups create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/groups/:id  – update a group
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, parent_id, sort_order } = req.body;

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }

  try {
    const existing = await sql`SELECT id, league_id FROM groups WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: 'Group not found' });

    if (parent_id !== undefined && parent_id !== null) {
      if (parent_id === id) {
        return res.status(400).json({ error: 'A group cannot be its own parent' });
      }
      const parentRows = await sql`
        SELECT id FROM groups WHERE id = ${parent_id} AND league_id = ${existing[0].league_id}
      `;
      if (parentRows.length === 0) {
        return res.status(400).json({ error: 'parent group not found in this league' });
      }
    }

    const parentInBody = 'parent_id' in req.body;
    const sortInBody   = 'sort_order' in req.body;

    const rows = await sql`
      UPDATE groups SET
        name       = COALESCE(${name?.trim() ?? null}, name),
        parent_id  = CASE WHEN ${parentInBody} THEN ${parent_id ?? null} ELSE parent_id END,
        sort_order = CASE WHEN ${sortInBody}   THEN ${sort_order ?? 0}  ELSE sort_order END
      WHERE id = ${id}
      RETURNING id, league_id, parent_id, name, sort_order, created_at
    `;
    return res.json(rows[0]);
  } catch (err) {
    console.error('groups update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


// ---------------------------------------------------------------------------
// DELETE /api/admin/groups/:id  – delete a group (cascades subgroups + memberships)
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`DELETE FROM groups WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    return res.json({ message: 'Group deleted' });
  } catch (err) {
    console.error('groups delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/groups/:id/teams
// Replace the default team list for a group.  Body: { team_ids: string[] }
// ---------------------------------------------------------------------------
router.put('/:id/teams', async (req, res) => {
  const { id } = req.params;
  const { team_ids } = req.body;

  if (!Array.isArray(team_ids)) {
    return res.status(400).json({ error: 'team_ids must be an array' });
  }

  try {
    const groupRows = await sql`SELECT id FROM groups WHERE id = ${id}`;
    if (groupRows.length === 0) return res.status(404).json({ error: 'Group not found' });

    // Clear existing then re-insert
    await sql`DELETE FROM group_teams WHERE group_id = ${id}`;
    for (const team_id of team_ids) {
      await sql`
        INSERT INTO group_teams (group_id, team_id) VALUES (${id}, ${team_id})
        ON CONFLICT DO NOTHING
      `;
    }

    const teams = await sql`
      SELECT t.id, ti.name, ti.code, ti.logo
      FROM group_teams gt
      JOIN teams t ON t.id = gt.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, logo FROM team_iterations
        WHERE team_id = t.id
        ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
        LIMIT 1
      ) ti ON true
      WHERE gt.group_id = ${id}
      ORDER BY ti.name
    `;
    return res.json({ group_id: id, teams });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'One or more teams not found' });
    console.error('groups set teams error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
