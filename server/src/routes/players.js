const path = require('path');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { put } = require('@vercel/blob');
const { sql } = require('../db');
const { requireAdmin } = require('../middleware/auth');

// ---------------------------------------------------------------------------
// Multer – memory storage for player photo uploads
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.use(requireAdmin);

const isValidDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

// ---------------------------------------------------------------------------
// POST /api/admin/players/upload  – upload a player photo to Vercel Blob
// ---------------------------------------------------------------------------
router.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const ext = path.extname(req.file.originalname);
    const filename = `players/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const blob = await put(filename, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });
    return res.json({ url: blob.url });
  } catch (err) {
    console.error('player photo upload error:', err);
    return res.status(500).json({ error: 'Failed to upload image' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/players  – list all players
// Supports optional ?league_id= or ?team_id= to scope results.
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { league_id, team_id, season_id, game_date } = req.query;
  const prospectsOnly = req.query.prospects_only === 'true';
  const includeProspects = prospectsOnly || req.query.include_prospects === 'true';
  const unassignedOnly = req.query.unassigned === 'true';
  const rookiesOnly = req.query.rookies_only === 'true';
  const includeRetired = req.query.include_retired === 'true';
  const wantsPagination = req.query.page !== undefined || req.query.page_size !== undefined || req.query.search !== undefined;
  const page = Math.max(1, Number.parseInt(req.query.page ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.page_size ?? '20', 10) || 20));
  const offset = (page - 1) * pageSize;
  const search = String(req.query.search ?? '').trim();
  const searchPattern = `%${search.toLowerCase()}%`;
  const jerseyPattern = `${search.replace('#', '')}%`;
  try {
    if (unassignedOnly) {
      if (!league_id) {
        return res.status(400).json({ error: 'league_id is required when unassigned is true' });
      }

      const players = await sql`
        SELECT
          p.id, p.first_name, p.last_name,
          COALESCE(best_player_photo(p.id, latest_pt.season_id, latest_pt.team_id), p.photo) AS photo,
          p.date_of_birth::text AS date_of_birth,
          p.birth_city, p.birth_country,
          p.height_cm, p.weight_lbs, COALESCE(latest_pt.position, p.position) AS position, p.shoots,
          p.rookie_season_id,
          (SELECT rs.name FROM seasons rs WHERE rs.id = p.rookie_season_id) AS rookie_season_name,
          p.is_active, p.created_at,
          COALESCE(latest_jnh.jersey_number, latest_pt.jersey_number) AS jersey_number,
          latest_pt.id AS player_team_id,
          latest_pt.team_id,
          latest_pt.is_prospect,
          latest_ti.name AS team_name,
          latest_ti.code AS team_code,
          latest_ti.logo AS team_logo,
          latest_ti.logo_dark AS team_logo_dark,
          latest_ti.logo_light AS team_logo_light,
          latest_t.primary_color,
          latest_t.text_color
        FROM players p
        LEFT JOIN LATERAL (
          SELECT pt.*
          FROM player_teams pt
          JOIN teams t ON t.id = pt.team_id
          WHERE pt.player_id = p.id
            AND t.league_id = ${league_id}
          ORDER BY
            CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
            COALESCE(pt.end_date, pt.start_date, pt.created_at::date) DESC NULLS LAST,
            pt.created_at DESC,
            pt.id DESC
          LIMIT 1
        ) latest_pt ON TRUE
        LEFT JOIN teams latest_t ON latest_t.id = latest_pt.team_id
        LEFT JOIN LATERAL (
          SELECT
            name,
            code,
            team_logo_default(logo_dark, logo_light) AS logo,
            team_logo_dark(logo_dark, logo_light) AS logo_dark,
            team_logo_light(logo_dark, logo_light) AS logo_light
          FROM team_iterations
          WHERE team_id = latest_pt.team_id
          ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC NULLS LAST, recorded_at DESC
          LIMIT 1
        ) latest_ti ON TRUE
        LEFT JOIN LATERAL (
          SELECT jersey_number
          FROM jersey_number_history
          WHERE player_teams_id = latest_pt.id
          ORDER BY effective_from DESC, id DESC
          LIMIT 1
        ) latest_jnh ON TRUE
        WHERE NOT EXISTS (
          SELECT 1
          FROM player_teams active_pt
          JOIN teams active_t ON active_t.id = active_pt.team_id
          WHERE active_pt.player_id = p.id
            AND active_t.league_id = ${league_id}
            AND (${season_id ?? null}::uuid IS NULL OR active_pt.season_id = ${season_id})
            AND active_pt.end_date IS NULL
        )
        AND (
          NOT EXISTS (
            SELECT 1
            FROM player_teams any_pt
            WHERE any_pt.player_id = p.id
          )
          OR EXISTS (
            SELECT 1
            FROM player_teams league_pt
            JOIN teams league_t ON league_t.id = league_pt.team_id
            WHERE league_pt.player_id = p.id
              AND league_t.league_id = ${league_id}
          )
        )
        ORDER BY p.last_name, p.first_name, p.id
      `;

      return res.json(players);
    }

    if (wantsPagination && league_id) {
      const players = league_id && season_id
        ? await sql`
            WITH roster AS (
              SELECT
                id, first_name, last_name, photo,
                date_of_birth::text AS date_of_birth,
                birth_city, birth_country,
                height_cm, weight_lbs, position, shoots,
                rookie_season_id, rookie_season_name,
                is_active, created_at,
                jersey_number, player_team_id, team_id, team_name, team_code, team_logo, team_logo_dark, team_logo_light, primary_color, text_color, is_prospect,
                acquisition_type, start_date::text AS start_date, has_games, season_points
              FROM (
                SELECT DISTINCT ON (p.id)
                  p.id, p.first_name, p.last_name,
                  COALESCE(best_player_photo(p.id, pt.season_id, pt.team_id), p.photo) AS photo,
                  p.date_of_birth,
                  p.birth_city, p.birth_country,
                  p.height_cm, p.weight_lbs, COALESCE(pt.position, p.position) AS position, p.shoots,
                  p.rookie_season_id,
                  (SELECT rs.name FROM seasons rs WHERE rs.id = p.rookie_season_id) AS rookie_season_name,
                  p.is_active, p.created_at,
                  pt.jersey_number,
                  pt.id          AS player_team_id,
                  pt.is_prospect,
                  t.id           AS team_id,
                  ti.name        AS team_name,
                  ti.code        AS team_code,
                  ti.logo        AS team_logo,
                  ti.logo_dark   AS team_logo_dark,
                  ti.logo_light  AS team_logo_light,
                  t.primary_color,
                  t.text_color,
                  COALESCE(pt.acquisition_type, cs.acquisition_type) AS acquisition_type,
                  COALESCE(pt.start_date, cs.start_date) AS start_date,
                  EXISTS (
                    SELECT 1
                    FROM game_rosters gr
                    JOIN games rg ON rg.id = gr.game_id
                    WHERE gr.player_id = p.id
                      AND rg.season_id = ${season_id}
                  ) AS has_games,
                  (
                    (
                      SELECT COUNT(*)
                      FROM goals sg
                      JOIN games sgg ON sgg.id = sg.game_id
                      WHERE sg.scorer_id = p.id
                        AND sg.goal_type != 'own'
                        AND sgg.season_id = ${season_id}
                    ) + (
                      SELECT COUNT(*)
                      FROM goals ag
                      JOIN games agg ON agg.id = ag.game_id
                      WHERE (ag.assist_1_id = p.id OR ag.assist_2_id = p.id)
                        AND agg.season_id = ${season_id}
                    )
                  )::int AS season_points
                FROM players p
                JOIN player_teams pt ON pt.player_id = p.id
                                    AND pt.season_id  = ${season_id}
                                    AND (${includeProspects} OR pt.is_prospect = FALSE)
                                    AND (${!prospectsOnly} OR pt.is_prospect = TRUE)
                JOIN teams        t  ON t.id          = pt.team_id
                                    AND t.league_id   = ${league_id}
                JOIN seasons      s  ON s.id          = pt.season_id
                LEFT JOIN LATERAL (
                  SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
                  WHERE team_id = t.id
                  ORDER BY
                    CASE
                      WHEN (start_date IS NULL OR start_date <= COALESCE(pt.start_date, pt.created_at::date, s.start_date))
                       AND (end_date IS NULL OR end_date >= COALESCE(pt.start_date, pt.created_at::date, s.start_date))
                      THEN 0
                      WHEN end_date IS NULL THEN 1
                      ELSE 2
                    END,
                    start_date DESC NULLS LAST,
                    recorded_at DESC
                  LIMIT 1
                ) ti ON TRUE
                LEFT JOIN LATERAL (
                  SELECT acquisition_type, start_date
                  FROM player_team_stints
                  WHERE player_id = p.id AND team_id = t.id
                  ORDER BY start_date DESC NULLS LAST, created_at DESC
                  LIMIT 1
                ) cs ON TRUE
                ORDER BY
                  p.id,
                  CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
                  COALESCE(pt.end_date, pt.start_date, pt.created_at::date) DESC NULLS LAST,
                  pt.created_at DESC,
                  pt.id DESC
              ) sub
            )
            SELECT *
            FROM roster
            WHERE (
              ${search} = ''
              OR LOWER(first_name || ' ' || last_name) LIKE ${searchPattern}
              OR LOWER(COALESCE(position, '')) LIKE ${searchPattern}
              OR COALESCE(jersey_number::text, '') LIKE ${jerseyPattern}
            )
            AND (${includeRetired} OR is_active = TRUE)
            AND (
              ${!rookiesOnly}
              OR (${season_id ?? null}::uuid IS NOT NULL AND rookie_season_id = ${season_id ?? null}::uuid)
            )
            ORDER BY first_name, last_name, id
            LIMIT ${pageSize} OFFSET ${offset}
          `
        : await sql`
            WITH roster AS (
              SELECT
                id, first_name, last_name, photo,
                date_of_birth::text AS date_of_birth,
                birth_city, birth_country,
                height_cm, weight_lbs, position, shoots,
                rookie_season_id, rookie_season_name,
                is_active, created_at,
                jersey_number, player_team_id, team_id, team_name, team_code, team_logo, team_logo_dark, team_logo_light, primary_color, text_color, is_prospect,
                acquisition_type, start_date::text AS start_date, has_games
              FROM (
                SELECT DISTINCT ON (p.id)
                  p.id, p.first_name, p.last_name,
                  COALESCE(best_player_photo(p.id, pt.season_id, pt.team_id), p.photo) AS photo,
                  p.date_of_birth,
                  p.birth_city, p.birth_country,
                  p.height_cm, p.weight_lbs, COALESCE(pt.position, p.position) AS position, p.shoots,
                  p.rookie_season_id,
                  (SELECT rs.name FROM seasons rs WHERE rs.id = p.rookie_season_id) AS rookie_season_name,
                  p.is_active, p.created_at,
                  pt.jersey_number,
                  pt.id          AS player_team_id,
                  pt.is_prospect,
                  t.id           AS team_id,
                  ti.name        AS team_name,
                  ti.code        AS team_code,
                  ti.logo        AS team_logo,
                  ti.logo_dark   AS team_logo_dark,
                  ti.logo_light  AS team_logo_light,
                  t.primary_color,
                  t.text_color,
                  COALESCE(pt.acquisition_type, cs.acquisition_type) AS acquisition_type,
                  COALESCE(pt.start_date, cs.start_date) AS start_date,
                  EXISTS (
                    SELECT 1
                    FROM game_rosters gr
                    JOIN games rg ON rg.id = gr.game_id
                    JOIN seasons rs ON rs.id = rg.season_id
                    WHERE gr.player_id = p.id
                      AND rs.league_id = ${league_id}
                  ) AS has_games
                FROM players p
                JOIN player_teams pt ON pt.player_id = p.id
                                    AND (${includeProspects} OR pt.is_prospect = FALSE)
                                    AND (${!prospectsOnly} OR pt.is_prospect = TRUE)
                JOIN teams        t  ON t.id          = pt.team_id
                                    AND t.league_id   = ${league_id}
                JOIN seasons      s  ON s.id          = pt.season_id
                LEFT JOIN LATERAL (
                  SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
                  WHERE team_id = t.id
                  ORDER BY
                    CASE
                      WHEN (start_date IS NULL OR start_date <= COALESCE(pt.start_date, pt.created_at::date, s.start_date))
                       AND (end_date IS NULL OR end_date >= COALESCE(pt.start_date, pt.created_at::date, s.start_date))
                      THEN 0
                      WHEN end_date IS NULL THEN 1
                      ELSE 2
                    END,
                    start_date DESC NULLS LAST,
                    recorded_at DESC
                  LIMIT 1
                ) ti ON TRUE
                LEFT JOIN LATERAL (
                  SELECT acquisition_type, start_date
                  FROM player_team_stints
                  WHERE player_id = p.id AND team_id = t.id
                  ORDER BY start_date DESC NULLS LAST, created_at DESC
                  LIMIT 1
                ) cs ON TRUE
                ORDER BY
                  p.id,
                  CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
                  COALESCE(pt.end_date, pt.start_date, pt.created_at::date, s.start_date) DESC NULLS LAST,
                  s.start_date DESC NULLS LAST,
                  pt.created_at DESC,
                  pt.id DESC
              ) sub
            )
            SELECT *
            FROM roster
            WHERE (
              ${search} = ''
              OR LOWER(first_name || ' ' || last_name) LIKE ${searchPattern}
              OR LOWER(COALESCE(position, '')) LIKE ${searchPattern}
              OR COALESCE(jersey_number::text, '') LIKE ${jerseyPattern}
            )
            AND (${includeRetired} OR is_active = TRUE)
            AND (
              ${!rookiesOnly}
              OR (${season_id ?? null}::uuid IS NOT NULL AND rookie_season_id = ${season_id ?? null}::uuid)
            )
            ORDER BY first_name, last_name, id
            LIMIT ${pageSize} OFFSET ${offset}
          `;

      const countRows = league_id && season_id
        ? await sql`
            WITH roster AS (
              SELECT id, first_name, last_name, position, jersey_number, rookie_season_id, is_active
              FROM (
                SELECT DISTINCT ON (p.id)
                  p.id, p.first_name, p.last_name,
                  COALESCE(pt.position, p.position) AS position,
                  pt.jersey_number,
                  p.rookie_season_id,
                  p.is_active
                FROM players p
                JOIN player_teams pt ON pt.player_id = p.id
                                    AND pt.season_id  = ${season_id}
                                    AND (${includeProspects} OR pt.is_prospect = FALSE)
                                    AND (${!prospectsOnly} OR pt.is_prospect = TRUE)
                JOIN teams        t  ON t.id          = pt.team_id
                                    AND t.league_id   = ${league_id}
                ORDER BY
                  p.id,
                  CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
                  COALESCE(pt.end_date, pt.start_date, pt.created_at::date) DESC NULLS LAST,
                  pt.created_at DESC,
                  pt.id DESC
              ) sub
            )
            SELECT COUNT(*)::int AS total
            FROM roster
            WHERE (
              ${search} = ''
              OR LOWER(first_name || ' ' || last_name) LIKE ${searchPattern}
              OR LOWER(COALESCE(position, '')) LIKE ${searchPattern}
              OR COALESCE(jersey_number::text, '') LIKE ${jerseyPattern}
            )
            AND (${includeRetired} OR is_active = TRUE)
            AND (
              ${!rookiesOnly}
              OR (${season_id ?? null}::uuid IS NOT NULL AND rookie_season_id = ${season_id ?? null}::uuid)
            )
          `
        : await sql`
            WITH roster AS (
              SELECT id, first_name, last_name, position, jersey_number, rookie_season_id, is_active
              FROM (
                SELECT DISTINCT ON (p.id)
                  p.id, p.first_name, p.last_name,
                  COALESCE(pt.position, p.position) AS position,
                  pt.jersey_number,
                  p.rookie_season_id,
                  p.is_active
                FROM players p
                JOIN player_teams pt ON pt.player_id = p.id
                                    AND (${includeProspects} OR pt.is_prospect = FALSE)
                                    AND (${!prospectsOnly} OR pt.is_prospect = TRUE)
                JOIN teams        t  ON t.id          = pt.team_id
                                    AND t.league_id   = ${league_id}
                JOIN seasons      s  ON s.id          = pt.season_id
                ORDER BY
                  p.id,
                  CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
                  COALESCE(pt.end_date, pt.start_date, pt.created_at::date, s.start_date) DESC NULLS LAST,
                  s.start_date DESC NULLS LAST,
                  pt.created_at DESC,
                  pt.id DESC
              ) sub
            )
            SELECT COUNT(*)::int AS total
            FROM roster
            WHERE (
              ${search} = ''
              OR LOWER(first_name || ' ' || last_name) LIKE ${searchPattern}
              OR LOWER(COALESCE(position, '')) LIKE ${searchPattern}
              OR COALESCE(jersey_number::text, '') LIKE ${jerseyPattern}
            )
            AND (${includeRetired} OR is_active = TRUE)
            AND (
              ${!rookiesOnly}
              OR (${season_id ?? null}::uuid IS NOT NULL AND rookie_season_id = ${season_id ?? null}::uuid)
            )
          `;

      return res.json({
        players,
        total: countRows[0]?.total ?? 0,
        page,
        page_size: pageSize,
      });
    }

    const players = league_id && season_id
      ? await sql`
          SELECT
            id, first_name, last_name, photo,
            date_of_birth::text AS date_of_birth,
            birth_city, birth_country,
            height_cm, weight_lbs, position, shoots,
            rookie_season_id, rookie_season_name,
            is_active, created_at,
            jersey_number, player_team_id, team_id, team_name, team_code, team_logo, team_logo_dark, team_logo_light, primary_color, text_color, is_prospect,
            acquisition_type, start_date::text AS start_date, has_games, season_points
          FROM (
            SELECT DISTINCT ON (p.id)
              p.id, p.first_name, p.last_name,
              COALESCE(best_player_photo(p.id, pt.season_id, pt.team_id), p.photo) AS photo,
              p.date_of_birth,
              p.birth_city, p.birth_country,
              p.height_cm, p.weight_lbs, COALESCE(pt.position, p.position) AS position, p.shoots,
              p.rookie_season_id,
              (SELECT rs.name FROM seasons rs WHERE rs.id = p.rookie_season_id) AS rookie_season_name,
              p.is_active, p.created_at,
              pt.jersey_number,
              pt.id          AS player_team_id,
              pt.is_prospect,
              t.id          AS team_id,
              ti.name       AS team_name,
              ti.code       AS team_code,
              ti.logo       AS team_logo,
              ti.logo_dark  AS team_logo_dark,
              ti.logo_light AS team_logo_light,
              t.primary_color,
              t.text_color,
              pt.acquisition_type,
              pt.start_date,
              EXISTS (
                SELECT 1
                FROM game_rosters gr
                JOIN games rg ON rg.id = gr.game_id
                WHERE gr.player_id = p.id
                  AND rg.season_id = ${season_id}
              ) AS has_games,
              (
                (
                  SELECT COUNT(*)
                  FROM goals sg
                  JOIN games sgg ON sgg.id = sg.game_id
                  WHERE sg.scorer_id = p.id
                    AND sg.goal_type != 'own'
                    AND sgg.season_id = ${season_id}
                ) + (
                  SELECT COUNT(*)
                  FROM goals ag
                  JOIN games agg ON agg.id = ag.game_id
                  WHERE (ag.assist_1_id = p.id OR ag.assist_2_id = p.id)
                    AND agg.season_id = ${season_id}
                )
              )::int AS season_points
            FROM players p
            JOIN player_teams pt ON pt.player_id = p.id
                                AND pt.season_id  = ${season_id}
                                AND (${includeProspects} OR pt.is_prospect = FALSE)
                                AND (${!prospectsOnly} OR pt.is_prospect = TRUE)
            JOIN teams        t  ON t.id          = pt.team_id
                                AND t.league_id   = ${league_id}
            JOIN seasons      s  ON s.id          = pt.season_id
            LEFT JOIN LATERAL (
              SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
              WHERE team_id = t.id
              ORDER BY
                CASE
                  WHEN (start_date IS NULL OR start_date <= COALESCE(pt.start_date, pt.created_at::date, s.start_date))
                   AND (end_date IS NULL OR end_date >= COALESCE(pt.start_date, pt.created_at::date, s.start_date))
                  THEN 0
                  WHEN end_date IS NULL THEN 1
                  ELSE 2
                END,
                start_date DESC NULLS LAST,
                recorded_at DESC
              LIMIT 1
            ) ti ON TRUE
            ORDER BY
              p.id,
              CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
              COALESCE(pt.end_date, pt.start_date, pt.created_at::date) DESC NULLS LAST,
              pt.created_at DESC,
              pt.id DESC
          ) sub
          ORDER BY last_name, first_name
        `
      : league_id
      ? await sql`
          SELECT
            id, first_name, last_name, photo,
            date_of_birth::text AS date_of_birth,
            birth_city, birth_country,
            height_cm, weight_lbs, position, shoots,
            rookie_season_id, rookie_season_name,
            is_active, created_at,
            jersey_number, player_team_id, team_id, team_name, team_code, team_logo, team_logo_dark, team_logo_light, primary_color, text_color, is_prospect,
            acquisition_type, start_date::text AS start_date, has_games
          FROM (
            SELECT DISTINCT ON (p.id)
              p.id, p.first_name, p.last_name,
              COALESCE(best_player_photo(p.id, pt.season_id, pt.team_id), p.photo) AS photo,
              p.date_of_birth,
              p.birth_city, p.birth_country,
              p.height_cm, p.weight_lbs, COALESCE(pt.position, p.position) AS position, p.shoots,
              p.rookie_season_id,
              (SELECT rs.name FROM seasons rs WHERE rs.id = p.rookie_season_id) AS rookie_season_name,
              p.is_active, p.created_at,
              pt.jersey_number,
              pt.id          AS player_team_id,
              pt.is_prospect,
              t.id          AS team_id,
              ti.name       AS team_name,
              ti.code       AS team_code,
              ti.logo       AS team_logo,
              ti.logo_dark  AS team_logo_dark,
              ti.logo_light AS team_logo_light,
              t.primary_color,
              t.text_color,
              pt.acquisition_type,
              pt.start_date,
              EXISTS (
                SELECT 1
                FROM game_rosters gr
                JOIN games rg ON rg.id = gr.game_id
                JOIN seasons rs ON rs.id = rg.season_id
                WHERE gr.player_id = p.id
                  AND rs.league_id = ${league_id}
              ) AS has_games
            FROM players p
            JOIN player_teams pt ON pt.player_id = p.id
                                AND (${includeProspects} OR pt.is_prospect = FALSE)
                                AND (${!prospectsOnly} OR pt.is_prospect = TRUE)
            JOIN teams        t  ON t.id          = pt.team_id
                                AND t.league_id   = ${league_id}
            JOIN seasons      s  ON s.id          = pt.season_id
            LEFT JOIN LATERAL (
              SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo, team_logo_dark(logo_dark, logo_light) AS logo_dark, team_logo_light(logo_dark, logo_light) AS logo_light FROM team_iterations
              WHERE team_id = t.id
              ORDER BY
                CASE
                  WHEN (start_date IS NULL OR start_date <= COALESCE(pt.start_date, pt.created_at::date, s.start_date))
                   AND (end_date IS NULL OR end_date >= COALESCE(pt.start_date, pt.created_at::date, s.start_date))
                  THEN 0
                  WHEN end_date IS NULL THEN 1
                  ELSE 2
                END,
                start_date DESC NULLS LAST,
                recorded_at DESC
              LIMIT 1
            ) ti ON TRUE
            ORDER BY
              p.id,
              CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
              COALESCE(pt.end_date, pt.start_date, pt.created_at::date, s.start_date) DESC NULLS LAST,
              s.start_date DESC NULLS LAST,
              pt.created_at DESC,
              pt.id DESC
          ) sub
          ORDER BY last_name, first_name
        `
      : team_id && season_id
      ? await sql`
          SELECT
            id, first_name, last_name, photo,
            date_of_birth::text AS date_of_birth,
            birth_city, birth_country,
            height_cm, weight_lbs, position, shoots,
            rookie_season_id, rookie_season_name,
            is_active, created_at,
            jersey_number, player_team_id, team_id, team_name, primary_color, text_color, is_prospect
          FROM (
            SELECT DISTINCT ON (p.id)
              p.id, p.first_name, p.last_name,
              COALESCE(best_player_photo(p.id, pt.season_id, pt.team_id), p.photo) AS photo,
              p.date_of_birth,
              p.birth_city, p.birth_country,
              p.height_cm, p.weight_lbs, COALESCE(pt.position, p.position) AS position, p.shoots,
              p.rookie_season_id,
              (SELECT rs.name FROM seasons rs WHERE rs.id = p.rookie_season_id) AS rookie_season_name,
              p.is_active, p.created_at,
              pt.jersey_number,
              pt.id          AS player_team_id,
              pt.team_id,
              pt.is_prospect,
              ti.name       AS team_name,
              t.primary_color,
              t.text_color
            FROM players p
            JOIN player_teams pt ON pt.player_id = p.id
                                AND pt.team_id   = ${team_id}
                                AND pt.season_id = ${season_id}
                                AND (${includeProspects} OR pt.is_prospect = FALSE)
                                AND (${!prospectsOnly} OR pt.is_prospect = TRUE)
                                AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(${game_date ?? null}::date, CURRENT_DATE))
                                AND (pt.end_date   IS NULL OR pt.end_date   >= COALESCE(${game_date ?? null}::date, CURRENT_DATE))
            JOIN teams        t  ON t.id          = pt.team_id
            LEFT JOIN LATERAL (
              SELECT name FROM team_iterations
              WHERE team_id = t.id
              ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC NULLS LAST, recorded_at DESC
              LIMIT 1
            ) ti ON TRUE
            ORDER BY p.id
          ) sub
          ORDER BY last_name, first_name
        `
      : team_id
      ? await sql`
          SELECT
            id, first_name, last_name, photo,
            date_of_birth::text AS date_of_birth,
            birth_city, birth_country,
            height_cm, weight_lbs, position, shoots,
            rookie_season_id, rookie_season_name,
            is_active, created_at,
            jersey_number, player_team_id, team_id, team_name, primary_color, text_color, is_prospect
          FROM (
            SELECT DISTINCT ON (p.id)
              p.id, p.first_name, p.last_name, COALESCE(best_player_photo(p.id, pt.season_id, pt.team_id), p.photo) AS photo,
              p.date_of_birth,
              p.birth_city, p.birth_country,
              p.height_cm, p.weight_lbs, COALESCE(pt.position, p.position) AS position, p.shoots,
              p.rookie_season_id,
              (SELECT rs.name FROM seasons rs WHERE rs.id = p.rookie_season_id) AS rookie_season_name,
              p.is_active, p.created_at,
              pt.jersey_number,
              pt.id          AS player_team_id,
              pt.team_id,
              pt.is_prospect,
              ti.name       AS team_name,
              t.primary_color,
              t.text_color
            FROM players p
            JOIN player_teams pt ON pt.player_id = p.id
                                AND pt.team_id   = ${team_id}
                                AND (${includeProspects} OR pt.is_prospect = FALSE)
                                AND (${!prospectsOnly} OR pt.is_prospect = TRUE)
            JOIN teams        t  ON t.id          = pt.team_id
            LEFT JOIN LATERAL (
              SELECT name FROM team_iterations
              WHERE team_id = t.id
              ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC NULLS LAST, recorded_at DESC
              LIMIT 1
            ) ti ON TRUE
            ORDER BY p.id, pt.season_id DESC
          ) sub
          ORDER BY last_name, first_name
        `
      : await sql`
          SELECT
            id, first_name, last_name, photo,
            date_of_birth::text AS date_of_birth,
            birth_city, birth_country,
            height_cm, weight_lbs, position, shoots,
            rookie_season_id,
            (SELECT rs.name FROM seasons rs WHERE rs.id = rookie_season_id) AS rookie_season_name,
            is_active, created_at
          FROM players ORDER BY last_name, first_name
        `;
    return res.json(players);
  } catch (err) {
    console.error('players list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id/stats  – career stats for one player
// Returns one row per season/team so mid-season trades keep each team's stats separate.
// Columns: season_id, season_name, jersey_number, gp, goals, assists, points,
//          team_id, team_name, team_logo, primary_color, text_color
// ---------------------------------------------------------------------------
router.get('/:id/stats', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      WITH
      stat_rows AS (
        SELECT
          gps.season_id,
          gps.team_id,
          COUNT(*)::int AS gp,
          SUM(gps.goals)::int AS goals,
          SUM(gps.assists)::int AS assists,
          SUM(gps.points)::int AS points
        FROM game_player_stats gps
        WHERE gps.player_id = ${id}
        GROUP BY gps.season_id, gps.team_id
      )
      SELECT
        s.id         AS season_id,
        s.name       AS season_name,
        ptr.jersey_number,
        COALESCE(sr.gp, 0)      AS gp,
        COALESCE(sr.goals, 0)   AS goals,
        COALESCE(sr.assists, 0) AS assists,
        COALESCE(sr.points, 0)  AS points,
        sr.team_id,
        ti.name  AS team_name,
        ti.logo  AS team_logo,
        ti.logo_dark AS team_logo_dark,
        ti.logo_light AS team_logo_light,
        t.primary_color,
        t.text_color
      FROM stat_rows sr
      JOIN seasons s ON s.id = sr.season_id
      LEFT JOIN LATERAL (
        SELECT
          pt.jersey_number,
          pt.start_date,
          pt.end_date,
          pt.created_at
        FROM player_teams pt
        WHERE pt.player_id = ${id}
          AND pt.season_id = sr.season_id
          AND pt.team_id = sr.team_id
        ORDER BY pt.end_date DESC NULLS FIRST, pt.created_at DESC
        LIMIT 1
      ) ptr ON TRUE
      LEFT JOIN teams t ON t.id = sr.team_id
      LEFT JOIN LATERAL (
        SELECT
          name,
          team_logo_default(logo_dark, logo_light) AS logo,
          team_logo_dark(logo_dark, logo_light) AS logo_dark,
          team_logo_light(logo_dark, logo_light) AS logo_light
        FROM team_iterations
        WHERE team_id = sr.team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(ptr.end_date, s.end_date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(ptr.start_date, s.start_date, ptr.created_at::date))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) ti ON sr.team_id IS NOT NULL
      ORDER BY s.created_at DESC, ti.name NULLS LAST
    `;
    return res.json(rows);
  } catch (err) {
    console.error('players stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id/awards - winner awards for one player.
// ---------------------------------------------------------------------------
router.get('/:id/awards', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      WITH winning_awards AS (
        SELECT
          sar.id,
          la.id AS award_id,
          sa.id AS season_award_id,
          la.name AS award_name,
          s.id AS season_id,
          s.name AS season_name,
          sa.awarded_at::text AS awarded_at,
          t.id AS team_id,
          ti.name AS team_name,
          ti.code AS team_code,
          ti.logo AS team_logo,
          ti.logo_dark AS team_logo_dark,
          ti.logo_light AS team_logo_light,
          t.primary_color AS team_primary_color,
          t.text_color AS team_text_color,
          s.start_date AS season_start_date,
          s.created_at AS season_created_at,
          sa.awarded_at AS awarded_date,
          la.sort_order,
          0 AS source_order
        FROM season_award_recipients sar
        JOIN season_awards sa ON sa.id = sar.season_award_id
        JOIN league_awards la ON la.id = sa.award_id
        JOIN seasons s ON s.id = sa.season_id
        LEFT JOIN LATERAL (
          SELECT team_id, start_date, end_date, created_at
          FROM player_teams pt
          WHERE pt.player_id = sar.player_id
            AND pt.season_id = s.id
          ORDER BY
            CASE
              WHEN sa.awarded_at IS NOT NULL
               AND (pt.start_date IS NULL OR pt.start_date <= sa.awarded_at)
               AND (pt.end_date IS NULL OR pt.end_date >= sa.awarded_at)
              THEN 0
              WHEN pt.end_date IS NULL THEN 1
              ELSE 2
            END,
            COALESCE(pt.end_date, pt.start_date, pt.created_at::date) DESC NULLS LAST,
            pt.created_at DESC,
            pt.id DESC
          LIMIT 1
        ) ptr ON TRUE
        LEFT JOIN teams t ON t.id = COALESCE(sar.team_id, ptr.team_id)
        LEFT JOIN LATERAL (
          SELECT
            name,
            code,
            team_logo_default(logo_dark, logo_light) AS logo,
            team_logo_dark(logo_dark, logo_light) AS logo_dark,
            team_logo_light(logo_dark, logo_light) AS logo_light
          FROM team_iterations
          WHERE team_id = t.id
          ORDER BY
            CASE
              WHEN (start_date IS NULL OR start_date <= COALESCE(sa.awarded_at, s.end_date, s.start_date, CURRENT_DATE))
               AND (end_date IS NULL OR end_date >= COALESCE(sa.awarded_at, s.start_date, CURRENT_DATE))
              THEN 0
              WHEN end_date IS NULL THEN 1
              ELSE 2
            END,
            start_date DESC NULLS LAST,
            recorded_at DESC
          LIMIT 1
        ) ti ON TRUE
        WHERE sar.recipient_type = 'player'
          AND sar.role = 'winner'
          AND sar.player_id = ${id}

        UNION ALL

        SELECT
          sar.id,
          la.id AS award_id,
          sa.id AS season_award_id,
          la.name AS award_name,
          s.id AS season_id,
          s.name AS season_name,
          sa.awarded_at::text AS awarded_at,
          t.id AS team_id,
          ti.name AS team_name,
          ti.code AS team_code,
          ti.logo AS team_logo,
          ti.logo_dark AS team_logo_dark,
          ti.logo_light AS team_logo_light,
          t.primary_color AS team_primary_color,
          t.text_color AS team_text_color,
          s.start_date AS season_start_date,
          s.created_at AS season_created_at,
          sa.awarded_at AS awarded_date,
          la.sort_order,
          1 AS source_order
        FROM season_award_recipients sar
        JOIN season_awards sa ON sa.id = sar.season_award_id
        JOIN league_awards la ON la.id = sa.award_id
        JOIN seasons s ON s.id = sa.season_id
        JOIN LATERAL (
          SELECT team_id
          FROM player_teams pt
          WHERE pt.player_id = ${id}
            AND pt.season_id = s.id
          ORDER BY
            CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
            COALESCE(pt.end_date, pt.start_date, pt.created_at::date, s.start_date) DESC NULLS LAST,
            pt.created_at DESC,
            pt.id DESC
          LIMIT 1
        ) latest_pt ON latest_pt.team_id = sar.team_id
        LEFT JOIN teams t ON t.id = sar.team_id
        LEFT JOIN LATERAL (
          SELECT
            name,
            code,
            team_logo_default(logo_dark, logo_light) AS logo,
            team_logo_dark(logo_dark, logo_light) AS logo_dark,
            team_logo_light(logo_dark, logo_light) AS logo_light
          FROM team_iterations
          WHERE team_id = t.id
          ORDER BY
            CASE
              WHEN (start_date IS NULL OR start_date <= COALESCE(sa.awarded_at, s.end_date, s.start_date, CURRENT_DATE))
               AND (end_date IS NULL OR end_date >= COALESCE(sa.awarded_at, s.start_date, CURRENT_DATE))
              THEN 0
              WHEN end_date IS NULL THEN 1
              ELSE 2
            END,
            start_date DESC NULLS LAST,
            recorded_at DESC
          LIMIT 1
        ) ti ON TRUE
        WHERE sar.recipient_type = 'team'
          AND sar.role = 'winner'
      )
      SELECT
        id,
        award_id,
        season_award_id,
        award_name,
        season_id,
        season_name,
        awarded_at,
        team_id,
        team_name,
        team_code,
        team_logo,
        team_primary_color,
        team_text_color
      FROM winning_awards
      ORDER BY
        season_start_date DESC NULLS LAST,
        season_created_at DESC,
        sort_order ASC,
        award_name ASC,
        source_order ASC,
        id ASC
    `;
    return res.json(rows);
  } catch (err) {
    console.error('players awards error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id/latest-season-stats
// (Also accepts the legacy /current-season-stats path.)
// Returns the player's stats for the latest season in which they actually
// appeared in a final game, split by game_type (regular / playoff).
// Skater fields: gp, goals, assists, points.
// Goalie fields additionally: wins, shootout_wins, goals_against,
// shots_against, save_pct. Returns null when the player has never played.
// ---------------------------------------------------------------------------
router.get(['/:id/current-season-stats', '/:id/latest-season-stats'], async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Resolve the latest season where the player actually appeared in a final game.
    // Goalies only count as having appeared when they have an active goalie stint.
    const playedSeasonRows = await sql`
      WITH player_info AS (
        SELECT position FROM players WHERE id = ${id}
      ),
      played_seasons AS (
        SELECT DISTINCT season_id
        FROM game_player_stats
        WHERE player_id = ${id}
      )
      SELECT
        s.id AS season_id,
        s.name AS season_name,
        (SELECT position FROM player_info) AS player_position
      FROM played_seasons ps
      JOIN seasons s ON s.id = ps.season_id
      ORDER BY s.start_date DESC NULLS LAST, s.created_at DESC, s.name DESC
      LIMIT 1
    `;
    if (playedSeasonRows.length === 0) return res.json(null);
    const { season_id, season_name, player_position } = playedSeasonRows[0];

    // 2. Skater stats (GP / goals / assists) per game_type
    const skaterRows = await sql`
      SELECT
        gps.game_type,
        COUNT(*)::int AS gp,
        SUM(gps.goals)::int AS goals,
        SUM(gps.assists)::int AS assists,
        SUM(gps.points)::int AS points
      FROM game_player_stats gps
      WHERE gps.player_id = ${id}
        AND gps.season_id = ${season_id}
        AND gps.is_goalie = false
      GROUP BY gps.game_type
    `;

    // 3. Goalie stats (wins / GA / SA) per game_type – same stint-based attribution
    //    logic used by the season stats leaderboard.
    const goalieRows = await sql`
      WITH period_vals (p, v) AS (
        VALUES ('1',1),('2',2),('3',3),('OT',4),('SO',5)
      ),
      -- Position windows for every stint this goalie played this season
      stint_ranges AS (
        SELECT
          st.id, st.game_id, g.season_id, g.scheduled_at, st.team_id, st.stint_ord,
          g.game_type, g.shootout,
          st.shots_against,
          st.goals_against AS goals_against_override,
          pv_in.v * 100000
            + COALESCE(
                SPLIT_PART(st.entered_time, ':', 1)::int * 60
                + SPLIT_PART(st.entered_time, ':', 2)::int,
                0
              ) AS from_pos,
          CASE
            WHEN st.exited_period IS NULL THEN NULL
            ELSE pv_out.v * 100000
                 + COALESCE(
                     SPLIT_PART(st.exited_time, ':', 1)::int * 60
                     + SPLIT_PART(st.exited_time, ':', 2)::int,
                     0
                   )
          END AS until_pos,
          COALESCE(
            st.time_on_ice,
            GREATEST(
              COALESCE(
                CASE WHEN st.exited_period IS NULL THEN NULL
                  ELSE (CASE st.exited_period WHEN '1' THEN 0 WHEN '2' THEN 1200 WHEN '3' THEN 2400 WHEN 'OT' THEN 3600 ELSE 6000 END
                    + COALESCE(SPLIT_PART(st.exited_time, ':', 1)::int * 60 + SPLIT_PART(st.exited_time, ':', 2)::int, 0))
                END,
                CASE WHEN g.shootout THEN 3900
                  WHEN EXISTS (SELECT 1 FROM goals og WHERE og.game_id = g.id AND og.period = 'OT')
                    THEN 3600 + COALESCE((SELECT MAX(SPLIT_PART(og.period_time, ':', 1)::int * 60 + SPLIT_PART(og.period_time, ':', 2)::int) FROM goals og WHERE og.game_id = g.id AND og.period = 'OT'), 0)
                  ELSE 3600 END
              )
              - (CASE st.entered_period WHEN '1' THEN 0 WHEN '2' THEN 1200 WHEN '3' THEN 2400 WHEN 'OT' THEN 3600 ELSE 6000 END
                 + COALESCE(SPLIT_PART(st.entered_time, ':', 1)::int * 60 + SPLIT_PART(st.entered_time, ':', 2)::int, 0)),
              0
            )
          )::int AS toi
        FROM game_goalie_stints st
        JOIN games g ON g.id = st.game_id
          AND g.season_id = ${season_id}
          AND g.status    = 'final'
        JOIN      period_vals pv_in  ON pv_in.p  = st.entered_period
        LEFT JOIN period_vals pv_out ON pv_out.p = st.exited_period
        WHERE st.goalie_id = ${id}
      ),
      -- All stints for all goalies this season (needed to find last goalie in net)
      all_stints AS (
        SELECT st.game_id, st.team_id, st.goalie_id, st.stint_ord
        FROM game_goalie_stints st
        JOIN games g ON g.id = st.game_id
          AND g.season_id = ${season_id}
          AND g.status    = 'final'
      ),
      team_game_last_goalie AS (
        SELECT DISTINCT ON (game_id, team_id)
          game_id, team_id, goalie_id
        FROM all_stints
        ORDER BY game_id, team_id, stint_ord DESC
      ),
      -- Goal totals per team per game (used to determine winner)
      game_team_goals AS (
        SELECT gl.game_id, gl.team_id, COUNT(*)::int AS goals
        FROM goals gl
        JOIN games g ON g.id = gl.game_id
          AND g.season_id = ${season_id}
          AND g.status    = 'final'
        GROUP BY gl.game_id, gl.team_id
      ),
      game_winner AS (
        SELECT
          g.id          AS game_id,
          g.game_type,
          g.shootout,
          CASE
            WHEN COALESCE(hg.goals, 0) > COALESCE(ag.goals, 0)
              THEN g.home_team_id
            ELSE g.away_team_id
          END AS winner_team_id
        FROM games g
        LEFT JOIN game_team_goals hg ON hg.game_id = g.id AND hg.team_id = g.home_team_id
        LEFT JOIN game_team_goals ag ON ag.game_id = g.id AND ag.team_id = g.away_team_id
        WHERE g.season_id = ${season_id}
          AND g.status    = 'final'
      ),
      -- Derive GA per stint from goal timestamps (respecting position windows)
      stint_ga_derived AS (
        SELECT
          sr.id AS stint_id,
          COUNT(*)::int AS ga,
          COUNT(*) FILTER (WHERE gl.goal_type = 'own' OR own_goal.is_own_goal)::int AS own_goal_ga,
          COUNT(*) FILTER (
            WHERE gl.goal_type != 'own' AND own_goal.is_own_goal IS NULL
          )::int AS save_ga
        FROM stint_ranges sr
        JOIN goals gl
          ON gl.game_id   = sr.game_id
         AND gl.team_id  != sr.team_id
         AND gl.empty_net = false
        JOIN period_vals pv ON pv.p = gl.period
        LEFT JOIN LATERAL (
          SELECT true AS is_own_goal
          FROM player_teams pt
          WHERE pt.player_id = gl.scorer_id
            AND pt.team_id = sr.team_id
            AND pt.season_id = sr.season_id
            AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(sr.scheduled_at::date, CURRENT_DATE))
            AND (pt.end_date IS NULL OR pt.end_date >= COALESCE(sr.scheduled_at::date, CURRENT_DATE))
          LIMIT 1
        ) own_goal ON true
        WHERE (pv.v * 100000
               + COALESCE(
                   SPLIT_PART(gl.period_time, ':', 1)::int * 60
                   + SPLIT_PART(gl.period_time, ':', 2)::int,
                   0
                 )) >= sr.from_pos
          AND (sr.until_pos IS NULL
               OR (pv.v * 100000
                   + COALESCE(
                       SPLIT_PART(gl.period_time, ':', 1)::int * 60
                       + SPLIT_PART(gl.period_time, ':', 2)::int,
                       0
                     )) < sr.until_pos)
        GROUP BY sr.id
      ),
      stints_resolved AS (
        SELECT
          sr.game_id, sr.game_type, sr.team_id, sr.shootout,
          COALESCE(sr.goals_against_override, sgd.ga, 0)::int AS resolved_ga,
          CASE
            WHEN sr.goals_against_override IS NULL
              THEN COALESCE(sgd.save_ga, 0)::int
            ELSE GREATEST(sr.goals_against_override - COALESCE(sgd.own_goal_ga, 0), 0)::int
          END AS resolved_save_ga,
          sr.shots_against,
          sr.toi
        FROM stint_ranges sr
        LEFT JOIN stint_ga_derived sgd ON sgd.stint_id = sr.id
      ),
      -- Aggregate per game (a goalie may have multiple stints in one game)
      goalie_game AS (
        SELECT
          game_id, game_type, team_id, shootout,
          SUM(shots_against)::int AS shots_against,
          SUM(resolved_ga)::int   AS goals_against,
          SUM(resolved_save_ga)::int AS save_goals_against,
          SUM(toi)::int AS toi
        FROM stints_resolved
        GROUP BY game_id, game_type, team_id, shootout
      ),
      goalie_agg AS (
        SELECT
          gps.game_type,
          COUNT(*)::int AS gp,
          SUM(gps.shots_against)::int AS shots_against,
          SUM(gps.goals_against)::int AS goals_against,
          SUM(gps.saves)::int AS saves,
          SUM(gps.time_on_ice)::int AS time_on_ice,
          SUM(CASE WHEN gps.goalie_win THEN 1 ELSE 0 END)::int AS wins,
          SUM(CASE WHEN gps.shootout_win THEN 1 ELSE 0 END)::int AS shootout_wins
        FROM game_player_stats gps
        WHERE gps.player_id = ${id}
          AND gps.season_id = ${season_id}
          AND gps.is_goalie = true
        GROUP BY gps.game_type
      )
      SELECT game_type, gp, shots_against, goals_against, saves, time_on_ice, wins, shootout_wins
      FROM goalie_agg
    `;

    // 4. Shape the response
    const skaterByType  = Object.fromEntries(skaterRows.map(r => [r.game_type, r]));
    const goalieByType  = Object.fromEntries(goalieRows.map(r => [r.game_type, r]));

    const makeStats = (gameType) => {
      const sk = skaterByType[gameType];
      const go = goalieByType[gameType];
      if (player_position === 'G') {
        if (!go) return null;
        const sa = Number(go.shots_against ?? 0);
        const ga = Number(go.goals_against ?? 0);
        const saves = Number(go.saves ?? (sa - ga));
        return {
          gp:            Number(go.gp ?? 0),
          goals:         0,
          assists:       0,
          points:        0,
          wins:          Number(go.wins ?? 0),
          shootout_wins: Number(go.shootout_wins ?? 0),
          goals_against: ga,
          shots_against: sa,
          save_pct:      sa > 0 ? Math.round(saves / sa * 1000) / 1000 : null,
          time_on_ice:   Number(go.time_on_ice ?? 0),
        };
      }
      if (!sk && !go) return null;
      const sa = Number(go?.shots_against ?? 0);
      const ga = Number(go?.goals_against ?? 0);
      const saves = Number(go?.saves ?? (sa - ga));
      return {
        gp:            Number(sk?.gp       ?? 0),
        goals:         Number(sk?.goals    ?? 0),
        assists:       Number(sk?.assists  ?? 0),
        points:        Number(sk?.points   ?? 0),
        wins:          Number(go?.wins     ?? 0),
        shootout_wins: Number(go?.shootout_wins ?? 0),
        goals_against: ga,
        shots_against: sa,
        save_pct:      sa > 0 ? Math.round(saves / sa * 1000) / 1000 : null,
        time_on_ice:   Number(go?.time_on_ice ?? 0),
      };
    };

    return res.json({
      season_id,
      season_name,
      regular:  makeStats('regular'),
      playoffs: makeStats('playoff'),
    });
  } catch (err) {
    console.error('players latest-season-stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/route-lookup
// Resolves pretty player detail URLs back to the IDs used by the data APIs.
// ---------------------------------------------------------------------------
router.get('/route-lookup', async (req, res) => {
  const leagueCode = String(req.query.league_code || '').trim();
  const teamCode = String(req.query.team_code || '').trim();
  const playerSlug = String(req.query.player_slug || '').trim().toLowerCase();

  if (!leagueCode || !playerSlug) {
    return res.status(400).json({ error: 'league_code and player_slug are required' });
  }

  try {
    const rows = await sql`
      SELECT
        p.id AS player_id,
        t.id AS team_id,
        l.id AS league_id,
        l.code AS league_code,
        ti.code AS team_code,
        trim(both '-' from regexp_replace(
          lower(trim(concat_ws(' ', p.first_name, p.last_name))),
          '[^a-z0-9]+',
          '-',
          'g'
        )) AS player_slug
      FROM players p
      JOIN player_teams pt ON pt.player_id = p.id
      JOIN teams t ON t.id = pt.team_id
      JOIN leagues l ON l.id = t.league_id
      LEFT JOIN LATERAL (
        SELECT code
        FROM team_iterations
        WHERE team_id = t.id
        ORDER BY
          CASE WHEN end_date IS NULL THEN 0 ELSE 1 END,
          start_date DESC NULLS LAST,
          recorded_at DESC NULLS LAST
        LIMIT 1
      ) ti ON true
      WHERE lower(l.code) = lower(${leagueCode})
        AND (${teamCode || null}::text IS NULL OR lower(ti.code) = lower(${teamCode}))
        AND trim(both '-' from regexp_replace(
          lower(trim(concat_ws(' ', p.first_name, p.last_name))),
          '[^a-z0-9]+',
          '-',
          'g'
        )) = ${playerSlug}
      ORDER BY
        CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
        pt.end_date DESC NULLS LAST,
        pt.created_at DESC NULLS LAST
      LIMIT 1
    `;

    if (!rows.length) {
      return res.status(404).json({ error: 'Player route not found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('players route-lookup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id/last-five-games
// Returns the player's five most recent final games with per-game stats.
// Goalies are attributed only through active goalie stints.
// ---------------------------------------------------------------------------
router.get('/:id/last-five-games', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      WITH player_info AS (
        SELECT position FROM players WHERE id = ${id}
      ),
      period_vals (p, v) AS (
        VALUES ('1',1),('2',2),('3',3),('OT',4),('SO',5)
      ),
      skater_games AS (
        SELECT
          g.id AS game_id,
          g.season_id,
          g.scheduled_at,
          g.game_type,
          gr.team_id,
          CASE WHEN g.home_team_id = gr.team_id THEN g.away_team_id ELSE g.home_team_id END AS opponent_team_id,
          g.home_team_id = gr.team_id AS is_home,
          COUNT(gl.id) FILTER (WHERE gl.scorer_id = ${id})::int AS goals,
          COUNT(gl.id) FILTER (WHERE gl.assist_1_id = ${id} OR gl.assist_2_id = ${id})::int AS assists,
          NULL::boolean AS goalie_started,
          NULL::int AS shots_against,
          NULL::int AS goals_against,
          NULL::float AS save_pct,
          NULL::int AS time_on_ice
        FROM game_rosters gr
        JOIN games g ON g.id = gr.game_id
          AND g.status = 'final'
        LEFT JOIN goals gl ON gl.game_id = g.id
          AND gl.team_id = gr.team_id
        WHERE gr.player_id = ${id}
          AND COALESCE((SELECT position FROM player_info), '') <> 'G'
        GROUP BY g.id, g.season_id, g.scheduled_at, g.game_type, gr.team_id, g.home_team_id, g.away_team_id
      ),
      goalie_stint_ranges AS (
        SELECT
          st.id,
          st.game_id,
          g.season_id,
          st.team_id,
          st.stint_ord,
          g.scheduled_at,
          g.game_type,
          CASE WHEN g.home_team_id = st.team_id THEN g.away_team_id ELSE g.home_team_id END AS opponent_team_id,
          g.home_team_id = st.team_id AS is_home,
          st.shots_against,
          st.goals_against AS goals_against_override,
          pv_in.v * 100000
            + COALESCE(
                SPLIT_PART(st.entered_time, ':', 1)::int * 60
                + SPLIT_PART(st.entered_time, ':', 2)::int,
                0
              ) AS from_pos,
          CASE
            WHEN st.exited_period IS NULL THEN NULL
            ELSE pv_out.v * 100000
                 + COALESCE(
                     SPLIT_PART(st.exited_time, ':', 1)::int * 60
                     + SPLIT_PART(st.exited_time, ':', 2)::int,
                     0
                   )
          END AS until_pos,
          COALESCE(
            st.time_on_ice,
            GREATEST(
              COALESCE(
                CASE WHEN st.exited_period IS NULL THEN NULL
                  ELSE (CASE st.exited_period WHEN '1' THEN 0 WHEN '2' THEN 1200 WHEN '3' THEN 2400 WHEN 'OT' THEN 3600 ELSE 6000 END
                    + COALESCE(SPLIT_PART(st.exited_time, ':', 1)::int * 60 + SPLIT_PART(st.exited_time, ':', 2)::int, 0))
                END,
                CASE WHEN g.shootout THEN 3900
                  WHEN EXISTS (SELECT 1 FROM goals og WHERE og.game_id = g.id AND og.period = 'OT')
                    THEN 3600 + COALESCE((SELECT MAX(SPLIT_PART(og.period_time, ':', 1)::int * 60 + SPLIT_PART(og.period_time, ':', 2)::int) FROM goals og WHERE og.game_id = g.id AND og.period = 'OT'), 0)
                  ELSE 3600 END
              )
              - (CASE st.entered_period WHEN '1' THEN 0 WHEN '2' THEN 1200 WHEN '3' THEN 2400 WHEN 'OT' THEN 3600 ELSE 6000 END
                 + COALESCE(SPLIT_PART(st.entered_time, ':', 1)::int * 60 + SPLIT_PART(st.entered_time, ':', 2)::int, 0)),
              0
            )
          )::int AS toi
        FROM game_goalie_stints st
        JOIN games g ON g.id = st.game_id
          AND g.status = 'final'
        JOIN      period_vals pv_in  ON pv_in.p  = st.entered_period
        LEFT JOIN period_vals pv_out ON pv_out.p = st.exited_period
        WHERE st.goalie_id = ${id}
          AND (SELECT position FROM player_info) = 'G'
      ),
      goalie_stint_ga AS (
        SELECT
          sr.id AS stint_id,
          COUNT(gl.id)::int AS goals_against,
          COUNT(*) FILTER (WHERE gl.goal_type = 'own' OR own_goal.is_own_goal)::int AS own_goal_ga,
          COUNT(*) FILTER (
            WHERE gl.goal_type != 'own' AND own_goal.is_own_goal IS NULL
          )::int AS save_goals_against
        FROM goalie_stint_ranges sr
        JOIN goals gl
          ON gl.game_id = sr.game_id
         AND gl.team_id != sr.team_id
         AND gl.empty_net = false
        JOIN period_vals pv ON pv.p = gl.period
        LEFT JOIN LATERAL (
          SELECT true AS is_own_goal
          FROM player_teams pt
          WHERE pt.player_id = gl.scorer_id
            AND pt.team_id = sr.team_id
            AND pt.season_id = sr.season_id
            AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(sr.scheduled_at::date, CURRENT_DATE))
            AND (pt.end_date IS NULL OR pt.end_date >= COALESCE(sr.scheduled_at::date, CURRENT_DATE))
          LIMIT 1
        ) own_goal ON true
        WHERE (pv.v * 100000
               + COALESCE(
                   SPLIT_PART(gl.period_time, ':', 1)::int * 60
                   + SPLIT_PART(gl.period_time, ':', 2)::int,
                   0
                 )) >= sr.from_pos
          AND (sr.until_pos IS NULL
               OR (pv.v * 100000
                   + COALESCE(
                       SPLIT_PART(gl.period_time, ':', 1)::int * 60
                       + SPLIT_PART(gl.period_time, ':', 2)::int,
                       0
                     )) < sr.until_pos)
        GROUP BY sr.id
      ),
      goalie_games AS (
        SELECT
          sr.game_id,
          sr.season_id,
          sr.scheduled_at,
          sr.game_type,
          sr.team_id,
          sr.opponent_team_id,
          sr.is_home,
          0::int AS goals,
          0::int AS assists,
          MIN(sr.stint_ord) = 1 AS goalie_started,
          SUM(sr.shots_against)::int AS shots_against,
          SUM(COALESCE(sr.goals_against_override, sga.goals_against, 0))::int AS goals_against,
          CASE
            WHEN SUM(sr.shots_against) > 0
              THEN ROUND(
                ((SUM(sr.shots_against) - SUM(
                  CASE
                    WHEN sr.goals_against_override IS NULL
                      THEN COALESCE(sga.save_goals_against, 0)
                    ELSE GREATEST(sr.goals_against_override - COALESCE(sga.own_goal_ga, 0), 0)
                  END
                ))::numeric
                  / SUM(sr.shots_against)),
                3
              )::float
            ELSE NULL::float
          END AS save_pct,
          SUM(sr.toi)::int AS time_on_ice
        FROM goalie_stint_ranges sr
        LEFT JOIN goalie_stint_ga sga ON sga.stint_id = sr.id
        GROUP BY sr.game_id, sr.season_id, sr.scheduled_at, sr.game_type, sr.team_id, sr.opponent_team_id, sr.is_home
      ),
      combined_games AS (
        SELECT
          gps.game_id,
          gps.season_id,
          g.scheduled_at,
          gps.game_type,
          gps.team_id,
          gps.opponent_team_id,
          gps.is_home,
          gps.goals,
          gps.assists,
          CASE WHEN gps.is_goalie THEN gps.goalie_started ELSE NULL::boolean END AS goalie_started,
          CASE WHEN gps.is_goalie THEN gps.shots_against ELSE NULL::int END AS shots_against,
          CASE WHEN gps.is_goalie THEN gps.goals_against ELSE NULL::int END AS goals_against,
          CASE
            WHEN gps.is_goalie AND gps.shots_against > 0
              THEN ROUND(gps.saves::numeric / gps.shots_against, 3)::float
            ELSE NULL::float
          END AS save_pct,
          CASE WHEN gps.is_goalie THEN gps.time_on_ice ELSE NULL::int END AS time_on_ice
        FROM game_player_stats gps
        JOIN games g ON g.id = gps.game_id
        WHERE gps.player_id = ${id}
      ),
      recent_games AS (
        SELECT *
        FROM combined_games
        ORDER BY scheduled_at DESC NULLS LAST, game_id DESC
        LIMIT 5
      )
      SELECT
        rg.game_id,
        rg.season_id,
        rg.scheduled_at,
        rg.game_type,
        rg.team_id,
        ti.name AS team_name,
        ti.code AS team_code,
        ti.logo AS team_logo,
        t.primary_color AS team_primary_color,
        t.text_color AS team_text_color,
        rg.opponent_team_id,
        oti.name AS opponent_name,
        oti.code AS opponent_code,
        oti.logo AS opponent_logo,
        ot.primary_color AS opponent_primary_color,
        ot.text_color AS opponent_text_color,
        rg.is_home,
        rg.goals,
        rg.assists,
        rg.goals + rg.assists AS points,
        rg.goalie_started,
        rg.shots_against,
        rg.goals_against,
        rg.save_pct,
        rg.time_on_ice
      FROM recent_games rg
      LEFT JOIN teams t ON t.id = rg.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo
        FROM team_iterations
        WHERE team_id = rg.team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(rg.scheduled_at::date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(rg.scheduled_at::date, CURRENT_DATE))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) ti ON TRUE
      LEFT JOIN teams ot ON ot.id = rg.opponent_team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo
        FROM team_iterations
        WHERE team_id = rg.opponent_team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(rg.scheduled_at::date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(rg.scheduled_at::date, CURRENT_DATE))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) oti ON TRUE
      ORDER BY rg.scheduled_at DESC NULLS LAST, rg.game_id DESC
    `;

    return res.json(rows);
  } catch (err) {
    console.error('players last-five-games error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/players/:id/game-logs
// Paginated game log with the same per-game stats as the last-five endpoint.
// Supports optional season_id and game_type filters.
// ---------------------------------------------------------------------------
router.get('/:id/game-logs', async (req, res) => {
  const { id } = req.params;
  const seasonId = typeof req.query.season_id === 'string' ? req.query.season_id : null;
  const gameType = typeof req.query.game_type === 'string' ? req.query.game_type : null;
  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);
  const offset = Math.max(Number.parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

  try {
    const rows = await sql`
      WITH player_info AS (
        SELECT position FROM players WHERE id = ${id}
      ),
      period_vals (p, v) AS (
        VALUES ('1',1),('2',2),('3',3),('OT',4),('SO',5)
      ),
      skater_games AS (
        SELECT
          g.id AS game_id,
          g.season_id,
          s.name AS season_name,
          g.scheduled_at,
          g.game_type,
          gr.team_id,
          CASE WHEN g.home_team_id = gr.team_id THEN g.away_team_id ELSE g.home_team_id END AS opponent_team_id,
          g.home_team_id = gr.team_id AS is_home,
          COUNT(gl.id) FILTER (WHERE gl.scorer_id = ${id})::int AS goals,
          COUNT(gl.id) FILTER (WHERE gl.assist_1_id = ${id} OR gl.assist_2_id = ${id})::int AS assists,
          NULL::boolean AS goalie_started,
          NULL::int AS shots_against,
          NULL::int AS goals_against,
          NULL::float AS save_pct,
          NULL::int AS time_on_ice
        FROM game_rosters gr
        JOIN games g ON g.id = gr.game_id
          AND g.status = 'final'
          AND (${seasonId}::uuid IS NULL OR g.season_id = ${seasonId}::uuid)
          AND (${gameType}::text IS NULL OR g.game_type = ${gameType}::text)
        JOIN seasons s ON s.id = g.season_id
        LEFT JOIN goals gl ON gl.game_id = g.id
          AND gl.team_id = gr.team_id
        WHERE gr.player_id = ${id}
          AND COALESCE((SELECT position FROM player_info), '') <> 'G'
        GROUP BY g.id, g.season_id, s.name, g.scheduled_at, g.game_type, gr.team_id, g.home_team_id, g.away_team_id
      ),
      goalie_stint_ranges AS (
        SELECT
          st.id,
          st.game_id,
          g.season_id,
          s.name AS season_name,
          st.team_id,
          st.stint_ord,
          g.scheduled_at,
          g.game_type,
          CASE WHEN g.home_team_id = st.team_id THEN g.away_team_id ELSE g.home_team_id END AS opponent_team_id,
          g.home_team_id = st.team_id AS is_home,
          st.shots_against,
          st.goals_against AS goals_against_override,
          pv_in.v * 100000
            + COALESCE(
                SPLIT_PART(st.entered_time, ':', 1)::int * 60
                + SPLIT_PART(st.entered_time, ':', 2)::int,
                0
              ) AS from_pos,
          CASE
            WHEN st.exited_period IS NULL THEN NULL
            ELSE pv_out.v * 100000
                 + COALESCE(
                     SPLIT_PART(st.exited_time, ':', 1)::int * 60
                     + SPLIT_PART(st.exited_time, ':', 2)::int,
                     0
                   )
          END AS until_pos,
          COALESCE(
            st.time_on_ice,
            GREATEST(
              COALESCE(
                CASE WHEN st.exited_period IS NULL THEN NULL
                  ELSE (CASE st.exited_period WHEN '1' THEN 0 WHEN '2' THEN 1200 WHEN '3' THEN 2400 WHEN 'OT' THEN 3600 ELSE 6000 END
                    + COALESCE(SPLIT_PART(st.exited_time, ':', 1)::int * 60 + SPLIT_PART(st.exited_time, ':', 2)::int, 0))
                END,
                CASE WHEN g.shootout THEN 3900
                  WHEN EXISTS (SELECT 1 FROM goals og WHERE og.game_id = g.id AND og.period = 'OT')
                    THEN 3600 + COALESCE((SELECT MAX(SPLIT_PART(og.period_time, ':', 1)::int * 60 + SPLIT_PART(og.period_time, ':', 2)::int) FROM goals og WHERE og.game_id = g.id AND og.period = 'OT'), 0)
                  ELSE 3600 END
              )
              - (CASE st.entered_period WHEN '1' THEN 0 WHEN '2' THEN 1200 WHEN '3' THEN 2400 WHEN 'OT' THEN 3600 ELSE 6000 END
                 + COALESCE(SPLIT_PART(st.entered_time, ':', 1)::int * 60 + SPLIT_PART(st.entered_time, ':', 2)::int, 0)),
              0
            )
          )::int AS toi
        FROM game_goalie_stints st
        JOIN games g ON g.id = st.game_id
          AND g.status = 'final'
          AND (${seasonId}::uuid IS NULL OR g.season_id = ${seasonId}::uuid)
          AND (${gameType}::text IS NULL OR g.game_type = ${gameType}::text)
        JOIN seasons s ON s.id = g.season_id
        JOIN      period_vals pv_in  ON pv_in.p  = st.entered_period
        LEFT JOIN period_vals pv_out ON pv_out.p = st.exited_period
        WHERE st.goalie_id = ${id}
          AND (SELECT position FROM player_info) = 'G'
      ),
      goalie_stint_ga AS (
        SELECT
          sr.id AS stint_id,
          COUNT(gl.id)::int AS goals_against,
          COUNT(*) FILTER (WHERE gl.goal_type = 'own' OR own_goal.is_own_goal)::int AS own_goal_ga,
          COUNT(*) FILTER (
            WHERE gl.goal_type != 'own' AND own_goal.is_own_goal IS NULL
          )::int AS save_goals_against
        FROM goalie_stint_ranges sr
        JOIN goals gl
          ON gl.game_id = sr.game_id
         AND gl.team_id != sr.team_id
         AND gl.empty_net = false
        JOIN period_vals pv ON pv.p = gl.period
        LEFT JOIN LATERAL (
          SELECT true AS is_own_goal
          FROM player_teams pt
          WHERE pt.player_id = gl.scorer_id
            AND pt.team_id = sr.team_id
            AND pt.season_id = sr.season_id
            AND (pt.start_date IS NULL OR pt.start_date <= COALESCE(sr.scheduled_at::date, CURRENT_DATE))
            AND (pt.end_date IS NULL OR pt.end_date >= COALESCE(sr.scheduled_at::date, CURRENT_DATE))
          LIMIT 1
        ) own_goal ON true
        WHERE (pv.v * 100000
               + COALESCE(
                   SPLIT_PART(gl.period_time, ':', 1)::int * 60
                   + SPLIT_PART(gl.period_time, ':', 2)::int,
                   0
                 )) >= sr.from_pos
          AND (sr.until_pos IS NULL
               OR (pv.v * 100000
                   + COALESCE(
                       SPLIT_PART(gl.period_time, ':', 1)::int * 60
                       + SPLIT_PART(gl.period_time, ':', 2)::int,
                       0
                     )) < sr.until_pos)
        GROUP BY sr.id
      ),
      goalie_games AS (
        SELECT
          sr.game_id,
          sr.season_id,
          sr.season_name,
          sr.scheduled_at,
          sr.game_type,
          sr.team_id,
          sr.opponent_team_id,
          sr.is_home,
          0::int AS goals,
          0::int AS assists,
          MIN(sr.stint_ord) = 1 AS goalie_started,
          SUM(sr.shots_against)::int AS shots_against,
          SUM(COALESCE(sr.goals_against_override, sga.goals_against, 0))::int AS goals_against,
          CASE
            WHEN SUM(sr.shots_against) > 0
              THEN ROUND(
                ((SUM(sr.shots_against) - SUM(
                  CASE
                    WHEN sr.goals_against_override IS NULL
                      THEN COALESCE(sga.save_goals_against, 0)
                    ELSE GREATEST(sr.goals_against_override - COALESCE(sga.own_goal_ga, 0), 0)
                  END
                ))::numeric
                  / SUM(sr.shots_against)),
                3
              )::float
            ELSE NULL::float
          END AS save_pct,
          SUM(sr.toi)::int AS time_on_ice
        FROM goalie_stint_ranges sr
        LEFT JOIN goalie_stint_ga sga ON sga.stint_id = sr.id
        GROUP BY sr.game_id, sr.season_id, sr.season_name, sr.scheduled_at, sr.game_type, sr.team_id, sr.opponent_team_id, sr.is_home
      ),
      combined_games AS (
        SELECT
          gps.game_id,
          gps.season_id,
          s.name AS season_name,
          g.scheduled_at,
          gps.game_type,
          gps.team_id,
          gps.opponent_team_id,
          gps.is_home,
          gps.goals,
          gps.assists,
          CASE WHEN gps.is_goalie THEN gps.goalie_started ELSE NULL::boolean END AS goalie_started,
          CASE WHEN gps.is_goalie THEN gps.shots_against ELSE NULL::int END AS shots_against,
          CASE WHEN gps.is_goalie THEN gps.goals_against ELSE NULL::int END AS goals_against,
          CASE
            WHEN gps.is_goalie AND gps.shots_against > 0
              THEN ROUND(gps.saves::numeric / gps.shots_against, 3)::float
            ELSE NULL::float
          END AS save_pct,
          CASE WHEN gps.is_goalie THEN gps.time_on_ice ELSE NULL::int END AS time_on_ice
        FROM game_player_stats gps
        JOIN games g ON g.id = gps.game_id
        JOIN seasons s ON s.id = gps.season_id
        WHERE gps.player_id = ${id}
          AND (${seasonId}::uuid IS NULL OR gps.season_id = ${seasonId}::uuid)
          AND (${gameType}::text IS NULL OR gps.game_type = ${gameType}::text)
      ),
      counted_games AS (
        SELECT *, COUNT(*) OVER ()::int AS total_count
        FROM combined_games
      ),
      page_games AS (
        SELECT *
        FROM counted_games
        ORDER BY scheduled_at DESC NULLS LAST, game_id DESC
        LIMIT ${limit}
        OFFSET ${offset}
      )
      SELECT
        pg.total_count,
        pg.game_id,
        pg.season_id,
        pg.season_name,
        pg.scheduled_at,
        pg.game_type,
        pg.team_id,
        ti.name AS team_name,
        ti.code AS team_code,
        ti.logo AS team_logo,
        t.primary_color AS team_primary_color,
        t.text_color AS team_text_color,
        pg.opponent_team_id,
        oti.name AS opponent_name,
        oti.code AS opponent_code,
        oti.logo AS opponent_logo,
        ot.primary_color AS opponent_primary_color,
        ot.text_color AS opponent_text_color,
        pg.is_home,
        pg.goals,
        pg.assists,
        pg.goals + pg.assists AS points,
        pg.goalie_started,
        pg.shots_against,
        pg.goals_against,
        pg.save_pct,
        pg.time_on_ice
      FROM page_games pg
      LEFT JOIN teams t ON t.id = pg.team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo
        FROM team_iterations
        WHERE team_id = pg.team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(pg.scheduled_at::date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(pg.scheduled_at::date, CURRENT_DATE))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) ti ON TRUE
      LEFT JOIN teams ot ON ot.id = pg.opponent_team_id
      LEFT JOIN LATERAL (
        SELECT name, code, team_logo_default(logo_dark, logo_light) AS logo
        FROM team_iterations
        WHERE team_id = pg.opponent_team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(pg.scheduled_at::date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(pg.scheduled_at::date, CURRENT_DATE))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) oti ON TRUE
      ORDER BY pg.scheduled_at DESC NULLS LAST, pg.game_id DESC
    `;

    const total = Number(rows[0]?.total_count ?? 0);
    return res.json({
      total,
      games: rows.map(({ total_count, ...row }) => row),
    });
  } catch (err) {
    console.error('players game-logs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`
      SELECT
        id, first_name, last_name, photo,
        date_of_birth::text AS date_of_birth,
        birth_city, birth_country,
        height_cm, weight_lbs, position, shoots,
        rookie_season_id,
        (SELECT rs.name FROM seasons rs WHERE rs.id = rookie_season_id) AS rookie_season_name,
        is_active, created_at
      FROM players WHERE id = ${id}
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('players get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/players  – create a player
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const {
    first_name, last_name, position, shoots,
    date_of_birth, birth_city, birth_country,
    height_cm, weight_lbs, rookie_season_id, is_active,
  } = req.body;

  if (!first_name || typeof first_name !== 'string' || first_name.trim() === '') {
    return res.status(400).json({ error: 'first_name is required' });
  }
  if (!last_name || typeof last_name !== 'string' || last_name.trim() === '') {
    return res.status(400).json({ error: 'last_name is required' });
  }

  try {
    const rows = await sql`
      INSERT INTO players (
        first_name, last_name, position, shoots,
        date_of_birth, birth_city, birth_country,
        height_cm, weight_lbs, rookie_season_id, is_active
      ) VALUES (
        ${first_name.trim()}, ${last_name.trim()},
        ${position ?? null}, ${shoots ?? null},
        ${date_of_birth ?? null}, ${birth_city?.trim() ?? null},
        ${birth_country?.trim().toUpperCase() ?? null},
        ${height_cm ?? null}, ${weight_lbs ?? null},
        ${rookie_season_id || null},
        ${is_active ?? true}
      )
      RETURNING
        id, first_name, last_name, photo,
        date_of_birth::text AS date_of_birth,
        birth_city, birth_country,
        height_cm, weight_lbs, position, shoots,
        rookie_season_id,
        (SELECT rs.name FROM seasons rs WHERE rs.id = rookie_season_id) AS rookie_season_name,
        is_active, created_at
    `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('players create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/players/bulk  – create multiple players in one request
// Body: { players: [{ first_name, last_name, position, shoots, rookie_season_id? }, ...] }
// ---------------------------------------------------------------------------
router.post('/bulk', async (req, res) => {
  const { players } = req.body;

  if (!Array.isArray(players) || players.length === 0) {
    return res.status(400).json({ error: 'players must be a non-empty array' });
  }

  // Validate every row before touching the DB
  for (let i = 0; i < players.length; i++) {
    const { first_name, last_name, position, shoots } = players[i];
    if (!first_name || typeof first_name !== 'string' || !first_name.trim())
      return res.status(400).json({ error: `Row ${i + 1}: first_name is required` });
    if (!last_name || typeof last_name !== 'string' || !last_name.trim())
      return res.status(400).json({ error: `Row ${i + 1}: last_name is required` });
    if (!position)
      return res.status(400).json({ error: `Row ${i + 1}: position is required` });
  }

  try {
    const created = [];
    for (const { first_name, last_name, position, shoots, rookie_season_id } of players) {
      const rows = await sql`
        INSERT INTO players (first_name, last_name, position, shoots, rookie_season_id, is_active)
        VALUES (
          ${first_name.trim()}, ${last_name.trim()},
          ${position}, ${shoots ?? null}, ${rookie_season_id || null}, true
        )
        RETURNING
          id, first_name, last_name, photo,
          date_of_birth::text AS date_of_birth,
          birth_city, birth_country,
          height_cm, weight_lbs, position, shoots,
          rookie_season_id,
          (SELECT rs.name FROM seasons rs WHERE rs.id = rookie_season_id) AS rookie_season_name,
          is_active, created_at
      `;
      created.push(rows[0]);
    }
    return res.status(201).json({ created });
  } catch (err) {
    console.error('players bulk create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/players/:id/retire
// Body: { retirement_date }
// Marks a player inactive and closes their latest open career/roster stint.
// ---------------------------------------------------------------------------
router.patch('/:id/retire', async (req, res) => {
  const { id } = req.params;
  const { retirement_date } = req.body;

  if (!isValidDateOnly(retirement_date)) {
    return res.status(400).json({ error: 'retirement_date must be a valid YYYY-MM-DD date' });
  }

  try {
    const rows = await sql`
      WITH retired_player AS (
        UPDATE players
        SET is_active = FALSE
        WHERE id = ${id}
        RETURNING
          id, first_name, last_name, photo,
          date_of_birth::text AS date_of_birth,
          birth_city, birth_country,
          height_cm, weight_lbs, position, shoots,
          rookie_season_id,
          (SELECT rs.name FROM seasons rs WHERE rs.id = rookie_season_id) AS rookie_season_name,
          is_active, created_at
      ),
      latest_career_stint AS (
        SELECT pts.id, pts.team_id
        FROM player_team_stints pts
        WHERE pts.player_id = ${id}
          AND pts.end_date IS NULL
          AND EXISTS (SELECT 1 FROM retired_player)
        ORDER BY pts.start_date DESC NULLS LAST, pts.created_at DESC, pts.id DESC
        LIMIT 1
      ),
      closed_career_stint AS (
        UPDATE player_team_stints pts
        SET end_date = ${retirement_date}::date
        FROM latest_career_stint latest
        WHERE pts.id = latest.id
        RETURNING pts.id, pts.team_id
      ),
      latest_roster_stint AS (
        SELECT pt.id
        FROM player_teams pt
        WHERE pt.player_id = ${id}
          AND pt.end_date IS NULL
          AND EXISTS (SELECT 1 FROM retired_player)
          AND (
            (
              EXISTS (SELECT 1 FROM closed_career_stint)
              AND pt.team_id = (SELECT team_id FROM closed_career_stint LIMIT 1)
            )
            OR NOT EXISTS (SELECT 1 FROM closed_career_stint)
          )
        ORDER BY pt.start_date DESC NULLS LAST, pt.created_at DESC, pt.id DESC
        LIMIT 1
      ),
      closed_roster_stint AS (
        UPDATE player_teams pt
        SET end_date = ${retirement_date}::date
        FROM latest_roster_stint latest
        WHERE pt.id = latest.id
        RETURNING pt.id, pt.team_id, pt.season_id
      )
      SELECT
        retired_player.*,
        ${retirement_date}::date::text AS retirement_date,
        (SELECT id FROM closed_career_stint LIMIT 1) AS retired_stint_id,
        (SELECT team_id FROM closed_career_stint LIMIT 1) AS retired_team_id,
        (SELECT id FROM closed_roster_stint LIMIT 1) AS retired_player_team_id,
        (SELECT season_id FROM closed_roster_stint LIMIT 1) AS retired_season_id
      FROM retired_player
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('players retire error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/players/:id - update a player
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    first_name, last_name, position, shoots,
    date_of_birth, birth_city, birth_country,
    height_cm, weight_lbs, rookie_season_id, is_active,
  } = req.body;

  const firstNameInBody    = 'first_name'    in req.body;
  const lastNameInBody     = 'last_name'     in req.body;
  const positionInBody     = 'position'      in req.body;
  const shootsInBody       = 'shoots'        in req.body;
  const dobInBody          = 'date_of_birth' in req.body;
  const birthCityInBody    = 'birth_city'    in req.body;
  const birthCountryInBody = 'birth_country' in req.body;
  const heightInBody       = 'height_cm'     in req.body;
  const weightInBody       = 'weight_lbs'    in req.body;
  const rookieSeasonInBody = 'rookie_season_id' in req.body;
  const isActiveInBody     = 'is_active'     in req.body;

  try {
    const rows = await sql`
      UPDATE players SET
        first_name    = CASE WHEN ${firstNameInBody}    THEN ${first_name?.trim() ?? null}                    ELSE first_name    END,
        last_name     = CASE WHEN ${lastNameInBody}     THEN ${last_name?.trim() ?? null}                     ELSE last_name     END,
        position      = CASE WHEN ${positionInBody}     THEN ${position ?? null}                              ELSE position      END,
        shoots        = CASE WHEN ${shootsInBody}       THEN ${shoots ?? null}                                ELSE shoots        END,
        date_of_birth = CASE WHEN ${dobInBody}          THEN ${date_of_birth ?? null}                         ELSE date_of_birth END,
        birth_city    = CASE WHEN ${birthCityInBody}    THEN ${birth_city?.trim() ?? null}                    ELSE birth_city    END,
        birth_country = CASE WHEN ${birthCountryInBody} THEN ${birth_country?.trim().toUpperCase() ?? null}   ELSE birth_country END,
        height_cm     = CASE WHEN ${heightInBody}       THEN ${height_cm ?? null}                             ELSE height_cm     END,
        weight_lbs    = CASE WHEN ${weightInBody}       THEN ${weight_lbs ?? null}                            ELSE weight_lbs    END,
        rookie_season_id = CASE WHEN ${rookieSeasonInBody} THEN ${rookie_season_id || null}                   ELSE rookie_season_id END,
        is_active     = CASE WHEN ${isActiveInBody}     THEN ${is_active ?? true}                             ELSE is_active     END
      WHERE id = ${id}
      RETURNING
        id, first_name, last_name, photo,
        date_of_birth::text AS date_of_birth,
        birth_city, birth_country,
        height_cm, weight_lbs, position, shoots,
        rookie_season_id,
        (SELECT rs.name FROM seasons rs WHERE rs.id = rookie_season_id) AS rookie_season_name,
        is_active, created_at
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('players update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/players/:id  – delete a player
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sql`DELETE FROM players WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    return res.json({ message: 'Player deleted' });
  } catch (err) {
    console.error('players delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

