'use strict';

const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { sql } = require('../db');

router.use(requireAdmin);

const VALID_STRUCTURE_TYPES = new Set(['groups', 'league']);
const VALID_ROLES = new Set(['conference', 'division']);

const normalizeStructureType = (value, fallback = 'groups') =>
  VALID_STRUCTURE_TYPES.has(value) ? value : fallback;

const normalizeRole = (role) => {
  if (role === undefined || role === null || role === '') return null;
  return VALID_ROLES.has(role) ? role : undefined;
};

async function fetchAlignmentGroups(alignmentSetId) {
  return sql`
    SELECT
      g.id,
      s.league_id,
      g.alignment_set_id,
      g.parent_id,
      g.stable_key,
      g.name,
      g.sort_order,
      g.created_at,
      g.role,
      false AS is_auto,
      COALESCE(
        json_agg(
          json_build_object(
            'id', t.id,
            'name', ti.name,
            'place_name', ti.place_name,
            'team_name', ti.team_name,
            'code', ti.code,
            'logo', ti.logo,
            'logo_dark', ti.logo_dark,
            'logo_light', ti.logo_light,
            'primary_color', t.primary_color,
            'text_color', t.text_color,
            'home_arena', t.home_arena
          )
          ORDER BY ti.name
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'::json
      ) AS teams
    FROM group_alignment_groups g
    JOIN group_alignment_sets s ON s.id = g.alignment_set_id
    LEFT JOIN group_alignment_teams gt ON gt.alignment_group_id = g.id
    LEFT JOIN teams t ON t.id = gt.team_id
    LEFT JOIN LATERAL (
      SELECT
        name,
        place_name,
        team_name,
        code,
        team_logo_default(logo_dark, logo_light) AS logo,
        team_logo_dark(logo_dark, logo_light) AS logo_dark,
        team_logo_light(logo_dark, logo_light) AS logo_light
      FROM team_iterations
      WHERE team_id = t.id
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ) ti ON true
    WHERE g.alignment_set_id = ${alignmentSetId}
    GROUP BY g.id, s.league_id
    ORDER BY g.parent_id NULLS FIRST, g.sort_order, g.name
  `;
}

async function fetchAlignmentSetTeams(alignmentSetId) {
  return sql`
    SELECT
      t.id,
      ti.name,
      ti.place_name,
      ti.team_name,
      ti.code,
      ti.logo,
      ti.logo_dark,
      ti.logo_light,
      t.primary_color,
      t.text_color,
      t.secondary_color,
      t.home_arena
    FROM group_alignment_set_teams ast
    JOIN teams t ON t.id = ast.team_id
    LEFT JOIN LATERAL (
      SELECT
        name,
        place_name,
        team_name,
        code,
        team_logo_default(logo_dark, logo_light) AS logo,
        team_logo_dark(logo_dark, logo_light) AS logo_dark,
        team_logo_light(logo_dark, logo_light) AS logo_light
      FROM team_iterations
      WHERE team_id = t.id
      ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, recorded_at DESC
      LIMIT 1
    ) ti ON true
    WHERE ast.alignment_set_id = ${alignmentSetId}
    ORDER BY ti.name
  `;
}

async function setAlignmentSetTeams(alignmentSetId, teamIds) {
  await sql`DELETE FROM group_alignment_set_teams WHERE alignment_set_id = ${alignmentSetId}`;
  for (const teamId of teamIds) {
    await sql`
      INSERT INTO group_alignment_set_teams (alignment_set_id, team_id)
      VALUES (${alignmentSetId}, ${teamId})
      ON CONFLICT DO NOTHING
    `;
  }
  return fetchAlignmentSetTeams(alignmentSetId);
}

async function teamIdsBelongToLeague(leagueId, teamIds) {
  if (teamIds.length === 0) return true;
  const validTeams = await sql`
    SELECT id
    FROM teams
    WHERE league_id = ${leagueId}
  `;
  const validIds = new Set(validTeams.map((team) => team.id));
  return [...new Set(teamIds)].every((teamId) => validIds.has(teamId));
}

async function copyGroupsIntoSet({ targetSetId, leagueId, sourceSetId = null, fromLegacy = false }) {
  const sourceGroups = fromLegacy
    ? await sql`
        SELECT id, parent_id, name, role, sort_order
        FROM groups
        WHERE league_id = ${leagueId}
          AND season_id IS NULL
          AND COALESCE(is_auto, false) = false
        ORDER BY parent_id NULLS FIRST, sort_order, name
      `
    : await sql`
        SELECT id, parent_id, name, role, sort_order
        FROM group_alignment_groups
        WHERE alignment_set_id = ${sourceSetId}
        ORDER BY parent_id NULLS FIRST, sort_order, name
      `;

  const idMap = new Map();
  const pending = [...sourceGroups];

  while (pending.length > 0) {
    const before = pending.length;
    for (let i = pending.length - 1; i >= 0; i--) {
      const group = pending[i];
      if (group.parent_id && !idMap.has(group.parent_id)) continue;

      const parentId = group.parent_id ? idMap.get(group.parent_id) : null;
      const inserted = await sql`
        INSERT INTO group_alignment_groups (
          alignment_set_id, parent_id, stable_key, name, role, sort_order
        )
        VALUES (
          ${targetSetId},
          ${parentId},
          ${fromLegacy ? `legacy:${group.id}` : `clone:${group.id}`},
          ${group.name},
          ${group.role ?? null},
          ${group.sort_order ?? 0}
        )
        RETURNING id
      `;
      idMap.set(group.id, inserted[0].id);
      pending.splice(i, 1);
    }
    if (pending.length === before) break;
  }

  for (const source of sourceGroups) {
    const targetGroupId = idMap.get(source.id);
    if (!targetGroupId) continue;
    const teams = fromLegacy
      ? await sql`SELECT team_id FROM group_teams WHERE group_id = ${source.id}`
      : await sql`SELECT team_id FROM group_alignment_teams WHERE alignment_group_id = ${source.id}`;

    for (const { team_id: teamId } of teams) {
      await sql`
        INSERT INTO group_alignment_teams (alignment_group_id, team_id)
        VALUES (${targetGroupId}, ${teamId})
        ON CONFLICT DO NOTHING
      `;
    }
  }
}

async function copyFlatTeamsIntoSet({ targetSetId, sourceSetId }) {
  const teams = await sql`
    SELECT team_id
    FROM group_alignment_set_teams
    WHERE alignment_set_id = ${sourceSetId}
  `;
  for (const { team_id: teamId } of teams) {
    await sql`
      INSERT INTO group_alignment_set_teams (alignment_set_id, team_id)
      VALUES (${targetSetId}, ${teamId})
      ON CONFLICT DO NOTHING
    `;
  }
}

router.get('/', async (req, res) => {
  const { league_id: leagueId } = req.query;
  if (!leagueId) return res.status(400).json({ error: 'league_id is required' });

  try {
    const rows = await sql`
      SELECT
        s.id,
        s.league_id,
        s.name,
        s.structure_type,
        s.created_at,
        COUNT(DISTINCT g.id)::int AS group_count,
        COUNT(DISTINCT COALESCE(gt.team_id, ast.team_id))::int AS team_count
      FROM group_alignment_sets s
      LEFT JOIN group_alignment_groups g ON g.alignment_set_id = s.id
      LEFT JOIN group_alignment_teams gt ON gt.alignment_group_id = g.id
      LEFT JOIN group_alignment_set_teams ast ON ast.alignment_set_id = s.id
      WHERE s.league_id = ${leagueId}
      GROUP BY s.id
      ORDER BY s.name ASC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('group alignment sets list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const sets = await sql`
      SELECT id, league_id, name, structure_type, created_at
      FROM group_alignment_sets
      WHERE id = ${id}
    `;
    if (sets.length === 0) return res.status(404).json({ error: 'Alignment set not found' });
    const groups = sets[0].structure_type === 'league' ? [] : await fetchAlignmentGroups(id);
    const teams = sets[0].structure_type === 'league' ? await fetchAlignmentSetTeams(id) : [];
    return res.json({ ...sets[0], groups, teams });
  } catch (err) {
    console.error('group alignment set get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const {
    league_id: leagueId,
    name,
    structure_type: requestedStructureType,
    source = 'empty',
    clone_from_set_id: cloneFromSetId,
    team_ids: teamIds = [],
  } = req.body;

  if (!leagueId) return res.status(400).json({ error: 'league_id is required' });
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    const structureType =
      source === 'league' ? 'league' : normalizeStructureType(requestedStructureType, 'groups');

  if (!Array.isArray(teamIds)) {
    return res.status(400).json({ error: 'team_ids must be an array' });
  }

  try {
    if (cloneFromSetId) {
      const sourceRows = await sql`
        SELECT id, league_id, structure_type FROM group_alignment_sets WHERE id = ${cloneFromSetId}
      `;
      if (sourceRows.length === 0) {
        return res.status(400).json({ error: 'clone_from_set_id was not found' });
      }
      if (sourceRows[0].league_id !== leagueId) {
        return res.status(400).json({ error: 'Cannot clone an alignment set from another league' });
      }
    }
    if (!(await teamIdsBelongToLeague(leagueId, teamIds))) {
      return res
        .status(400)
        .json({ error: 'One or more teams do not belong to this league' });
    }

    const rows = await sql`
      INSERT INTO group_alignment_sets (league_id, name, structure_type)
      VALUES (${leagueId}, ${name.trim()}, ${structureType})
      RETURNING id, league_id, name, structure_type, created_at
    `;
    const created = rows[0];

    if (structureType === 'league') {
      if (cloneFromSetId) {
        await copyFlatTeamsIntoSet({ targetSetId: created.id, sourceSetId: cloneFromSetId });
      } else if (teamIds.length > 0) {
        await setAlignmentSetTeams(created.id, teamIds);
      }
    } else {
      if (cloneFromSetId) {
        await copyGroupsIntoSet({
          targetSetId: created.id,
          leagueId,
          sourceSetId: cloneFromSetId,
        });
      } else if (source === 'legacy') {
        await copyGroupsIntoSet({ targetSetId: created.id, leagueId, fromLegacy: true });
      }
    }

    const groups = created.structure_type === 'league' ? [] : await fetchAlignmentGroups(created.id);
    const teams = created.structure_type === 'league' ? await fetchAlignmentSetTeams(created.id) : [];
    return res.status(201).json({ ...created, groups, teams });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'League not found' });
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An alignment set with that name already exists' });
    }
    console.error('group alignment set create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, structure_type: structureType } = req.body;
  const nameInBody = 'name' in req.body;
  const structureInBody = 'structure_type' in req.body;

  if (nameInBody && !name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (structureInBody && !VALID_STRUCTURE_TYPES.has(structureType)) {
    return res.status(400).json({ error: 'structure_type must be groups or league' });
  }

  try {
    const rows = await sql`
      UPDATE group_alignment_sets
      SET
        name = CASE WHEN ${nameInBody} THEN ${name?.trim() ?? null} ELSE name END,
        structure_type = CASE WHEN ${structureInBody} THEN ${structureType} ELSE structure_type END
      WHERE id = ${id}
      RETURNING id, league_id, name, structure_type, created_at
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Alignment set not found' });
    return res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An alignment set with that name already exists' });
    }
    console.error('group alignment set update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      DELETE FROM group_alignment_sets WHERE id = ${id} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Alignment set not found' });
    return res.json({ message: 'Alignment set deleted' });
  } catch (err) {
    console.error('group alignment set delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/teams', async (req, res) => {
  const { id: alignmentSetId } = req.params;
  const { team_ids: teamIds } = req.body;

  if (!Array.isArray(teamIds)) {
    return res.status(400).json({ error: 'team_ids must be an array' });
  }

  try {
    const sets = await sql`
      SELECT id, league_id
      FROM group_alignment_sets
      WHERE id = ${alignmentSetId}
    `;
    if (sets.length === 0) return res.status(404).json({ error: 'Alignment set not found' });

    if (!(await teamIdsBelongToLeague(sets[0].league_id, teamIds))) {
      return res
        .status(400)
        .json({ error: 'One or more teams do not belong to this league' });
    }

    await sql`
      UPDATE group_alignment_sets
      SET structure_type = 'league'
      WHERE id = ${alignmentSetId}
    `;
    const teams = await setAlignmentSetTeams(alignmentSetId, teamIds);
    return res.json({ alignment_set_id: alignmentSetId, teams });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'One or more teams not found' });
    }
    console.error('group alignment set teams update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/groups', async (req, res) => {
  const { id: alignmentSetId } = req.params;
  const { name, parent_id: parentId, sort_order: sortOrder, role } = req.body;
  const normalizedRole = normalizeRole(role);

  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (normalizedRole === undefined) {
    return res.status(400).json({ error: 'role must be conference, division, or null' });
  }

  try {
    const sets = await sql`
      SELECT id, league_id FROM group_alignment_sets WHERE id = ${alignmentSetId}
    `;
    if (sets.length === 0) return res.status(404).json({ error: 'Alignment set not found' });

    if (parentId) {
      const parentRows = await sql`
        SELECT id FROM group_alignment_groups
        WHERE id = ${parentId} AND alignment_set_id = ${alignmentSetId}
      `;
      if (parentRows.length === 0) {
        return res.status(400).json({ error: 'parent group not found in this alignment set' });
      }
    }

    await sql`
      UPDATE group_alignment_sets SET structure_type = 'groups' WHERE id = ${alignmentSetId}
    `;

    const rows = await sql`
      INSERT INTO group_alignment_groups (
        alignment_set_id, parent_id, name, role, sort_order
      )
      VALUES (
        ${alignmentSetId},
        ${parentId ?? null},
        ${name.trim()},
        ${normalizedRole},
        ${sortOrder ?? 0}
      )
      RETURNING id, ${sets[0].league_id}::uuid AS league_id, alignment_set_id, parent_id,
                name, sort_order, created_at, role, false AS is_auto
    `;
    return res.status(201).json({ ...rows[0], teams: [] });
  } catch (err) {
    console.error('group alignment group create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/groups/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const { name, parent_id: parentId, sort_order: sortOrder, role } = req.body;
  const normalizedRole = normalizeRole(role);

  if (name !== undefined && !name?.trim()) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }
  if (normalizedRole === undefined) {
    return res.status(400).json({ error: 'role must be conference, division, or null' });
  }

  try {
    const existing = await sql`
      SELECT g.id, g.alignment_set_id, s.league_id
      FROM group_alignment_groups g
      JOIN group_alignment_sets s ON s.id = g.alignment_set_id
      WHERE g.id = ${groupId}
    `;
    if (existing.length === 0) return res.status(404).json({ error: 'Group not found' });

    if (parentId !== undefined && parentId !== null) {
      if (parentId === groupId) {
        return res.status(400).json({ error: 'A group cannot be its own parent' });
      }
      const parentRows = await sql`
        SELECT id FROM group_alignment_groups
        WHERE id = ${parentId} AND alignment_set_id = ${existing[0].alignment_set_id}
      `;
      if (parentRows.length === 0) {
        return res.status(400).json({ error: 'parent group not found in this alignment set' });
      }
    }

    const nameInBody = 'name' in req.body;
    const parentInBody = 'parent_id' in req.body;
    const sortInBody = 'sort_order' in req.body;
    const roleInBody = 'role' in req.body;

    const rows = await sql`
      UPDATE group_alignment_groups
      SET
        name       = CASE WHEN ${nameInBody} THEN ${name?.trim() ?? null} ELSE name END,
        parent_id  = CASE WHEN ${parentInBody} THEN ${parentId ?? null} ELSE parent_id END,
        sort_order = CASE WHEN ${sortInBody} THEN ${sortOrder ?? 0} ELSE sort_order END,
        role       = CASE WHEN ${roleInBody} THEN ${normalizedRole} ELSE role END
      WHERE id = ${groupId}
      RETURNING id, ${existing[0].league_id}::uuid AS league_id, alignment_set_id, parent_id,
                name, sort_order, created_at, role, false AS is_auto
    `;
    return res.json(rows[0]);
  } catch (err) {
    console.error('group alignment group update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/groups/:groupId', async (req, res) => {
  const { groupId } = req.params;
  try {
    const rows = await sql`
      DELETE FROM group_alignment_groups WHERE id = ${groupId} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    return res.json({ message: 'Group deleted' });
  } catch (err) {
    console.error('group alignment group delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/groups/:groupId/teams', async (req, res) => {
  const { groupId } = req.params;
  const { team_ids: teamIds } = req.body;

  if (!Array.isArray(teamIds)) {
    return res.status(400).json({ error: 'team_ids must be an array' });
  }

  try {
    const groups = await sql`
      SELECT id FROM group_alignment_groups WHERE id = ${groupId}
    `;
    if (groups.length === 0) return res.status(404).json({ error: 'Group not found' });

    await sql`DELETE FROM group_alignment_teams WHERE alignment_group_id = ${groupId}`;
    for (const teamId of teamIds) {
      await sql`
        INSERT INTO group_alignment_teams (alignment_group_id, team_id)
        VALUES (${groupId}, ${teamId})
        ON CONFLICT DO NOTHING
      `;
    }

    const rows = await fetchAlignmentGroups(
      (await sql`
        SELECT alignment_set_id FROM group_alignment_groups WHERE id = ${groupId}
      `)[0].alignment_set_id,
    );
    const group = rows.find((row) => row.id === groupId);
    return res.json({ group_id: groupId, teams: group?.teams ?? [] });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'One or more teams not found' });
    }
    console.error('group alignment teams update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
