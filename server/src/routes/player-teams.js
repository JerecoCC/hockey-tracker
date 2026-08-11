const router = require("express").Router();
const { requireAdmin } = require("../middleware/auth");
const { sql } = require("../db");
const {
  planPlayerStintReconciliation,
  stintRangesOverlap,
  stintSnapshot,
  summarizeReconciliationActions,
} = require("../lib/playerStintReconciliation");

router.use(requireAdmin);

const ACQUISITION_TYPES = new Set([
  "draft",
  "trade",
  "free_agency",
  "waivers",
  "signing",
  "foundational_signing",
  "expansion_signing",
  "expansion_draft",
  "team_transfer",
  "loan",
  "other",
]);
const PLAYER_POSITIONS = new Set(["C", "LW", "RW", "F", "D", "LD", "RD", "G"]);
const NHL_PUCKPEDIA_IMPORT_SOURCE = "nhl_puckpedia";
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const isValidUuid = (value) =>
  typeof value === "string" && UUID_PATTERN.test(value);
const normalizeAcquisitionType = (value) =>
  value === "" || value == null ? null : value;
const isValidAcquisitionType = (value) =>
  value == null || ACQUISITION_TYPES.has(value);
const isValidDateOnly = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};
const isValidJerseyNumber = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 99;
};

const normalizeReconcileStint = (stint) => ({
  import_key:
    typeof stint?.import_key === "string" ? stint.import_key.trim() : "",
  team_id: typeof stint?.team_id === "string" ? stint.team_id.trim() : "",
  position:
    stint?.position === "" || stint?.position == null ? null : stint.position,
  acquisition_type: normalizeAcquisitionType(stint?.acquisition_type),
  start_date:
    stint?.start_date === "" || stint?.start_date == null
      ? null
      : stint.start_date,
  end_date:
    stint?.end_date === "" || stint?.end_date == null ? null : stint.end_date,
});

const validateReconcileStints = (rawStints) => {
  if (!Array.isArray(rawStints) || rawStints.length === 0) {
    return { error: "stints must be a non-empty array" };
  }
  if (rawStints.length > 500)
    return { error: "stints cannot contain more than 500 rows" };

  const stints = rawStints.map(normalizeReconcileStint);
  const seenImportKeys = new Set();
  let openStints = 0;

  for (let index = 0; index < stints.length; index += 1) {
    const stint = stints[index];
    const rowLabel = `Row ${index + 1}`;
    if (!stint.import_key)
      return { error: `${rowLabel}: import_key is required` };
    if (seenImportKeys.has(stint.import_key)) {
      return {
        error: `${rowLabel}: import_key must be unique within the request`,
      };
    }
    seenImportKeys.add(stint.import_key);
    if (!stint.team_id) return { error: `${rowLabel}: team_id is required` };
    if (!isValidUuid(stint.team_id))
      return { error: `${rowLabel}: team_id must be a UUID` };
    if (stint.position != null && !PLAYER_POSITIONS.has(stint.position)) {
      return { error: `${rowLabel}: Invalid position` };
    }
    if (!isValidAcquisitionType(stint.acquisition_type)) {
      return { error: `${rowLabel}: Invalid acquisition_type` };
    }
    if (stint.start_date != null && !isValidDateOnly(stint.start_date)) {
      return { error: `${rowLabel}: start_date must be YYYY-MM-DD or null` };
    }
    if (stint.end_date != null && !isValidDateOnly(stint.end_date)) {
      return { error: `${rowLabel}: end_date must be YYYY-MM-DD or null` };
    }
    if (
      stint.start_date &&
      stint.end_date &&
      stint.end_date < stint.start_date
    ) {
      return { error: `${rowLabel}: end_date cannot be before start_date` };
    }
    if (stint.end_date == null) openStints += 1;
  }

  if (openStints > 1)
    return { error: "Only one imported stint may have an open end date" };

  for (let left = 0; left < stints.length; left += 1) {
    for (let right = left + 1; right < stints.length; right += 1) {
      if (stintRangesOverlap(stints[left], stints[right])) {
        return {
          error: `Imported stints ${left + 1} and ${right + 1} overlap`,
        };
      }
    }
  }

  return { stints };
};

const upsertCareerStint = async ({
  player_id,
  team_id,
  position = null,
  acquisition_type = null,
  is_prospect = false,
  start_date = null,
  end_date = null,
}) => {
  const rows =
    (await sql`
    WITH existing AS (
      SELECT id
      FROM player_team_stints
      WHERE player_id = ${player_id}
        AND team_id = ${team_id}
        AND end_date IS NULL
      ORDER BY start_date DESC NULLS LAST, created_at DESC
      LIMIT 1
    ),
    updated AS (
      UPDATE player_team_stints pts
      SET
        position = COALESCE(${position}, pts.position),
        acquisition_type = COALESCE(${acquisition_type}, pts.acquisition_type),
        is_prospect = ${!!is_prospect},
        start_date = COALESCE(pts.start_date, ${start_date}::date),
        end_date = CASE WHEN ${end_date}::date IS NULL THEN pts.end_date ELSE ${end_date}::date END
      FROM existing
      WHERE pts.id = existing.id
      RETURNING pts.*, FALSE AS created
    ),
    inserted AS (
      INSERT INTO player_team_stints (
        player_id, team_id, position, acquisition_type, is_prospect, start_date, end_date
      )
      SELECT
        ${player_id}, ${team_id}, ${position}, ${acquisition_type}, ${!!is_prospect},
        ${start_date}::date, ${end_date}::date
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      RETURNING player_team_stints.*, TRUE AS created
    )
    SELECT * FROM updated
    UNION ALL
    SELECT * FROM inserted
  `) ?? [];
  return rows[0] ?? null;
};

const resolveSeasonStart = async (season_id) => {
  const rows =
    (await sql`
    SELECT COALESCE(start_date, created_at::date, CURRENT_DATE)::text AS start_date
    FROM seasons
    WHERE id = ${season_id}
  `) ?? [];
  return rows[0]?.start_date ?? null;
};

const setJerseyAssignment = async ({
  player_id,
  jersey_number,
  effective_date,
}) => {
  const rows =
    (await sql`
    WITH current_assignment AS (
      SELECT id, jersey_number
      FROM player_jersey_stints
      WHERE player_id = ${player_id}
        AND start_date <= ${effective_date}::date
        AND (end_date IS NULL OR end_date >= ${effective_date}::date)
      ORDER BY start_date DESC, created_at DESC
      LIMIT 1
    ),
    closed AS (
      UPDATE player_jersey_stints pjs
      SET end_date = ${effective_date}::date - 1
      FROM current_assignment current
      WHERE pjs.id = current.id
        AND current.jersey_number IS DISTINCT FROM ${jersey_number}::smallint
        AND pjs.start_date < ${effective_date}::date
      RETURNING pjs.id
    ),
    replaced AS (
      DELETE FROM player_jersey_stints pjs
      USING current_assignment current
      WHERE pjs.id = current.id
        AND current.jersey_number IS DISTINCT FROM ${jersey_number}::smallint
        AND pjs.start_date = ${effective_date}::date
      RETURNING pjs.id
    ),
    next_assignment AS (
      SELECT MIN(start_date) AS start_date
      FROM player_jersey_stints
      WHERE player_id = ${player_id}
        AND start_date > ${effective_date}::date
    ),
    inserted AS (
      INSERT INTO player_jersey_stints (
        player_id, jersey_number, start_date, end_date
      )
      SELECT
        ${player_id},
        ${jersey_number}::smallint,
        ${effective_date}::date,
        next_assignment.start_date - 1
      FROM next_assignment
      WHERE ${jersey_number}::smallint IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM current_assignment
          WHERE jersey_number = ${jersey_number}::smallint
        )
      RETURNING *, TRUE AS created
    )
    SELECT * FROM inserted
  `) ?? [];
  return rows[0] ?? null;
};

const closeActiveCareerStints = (player_id, end_date) => sql`
  UPDATE player_team_stints
  SET end_date = ${end_date}::date - 1
  WHERE player_id = ${player_id}
    AND end_date IS NULL
  RETURNING id, team_id
`;

const resolveTradeRosterSeason = async ({
  sourceSeasonId,
  tradeDate,
  requestedSeasonId = null,
}) => {
  const rows =
    (await sql`
    WITH source_season AS (
      SELECT id, league_id, start_date, end_date
      FROM seasons
      WHERE id = ${sourceSeasonId}
    ),
    requested_season AS (
      SELECT id, league_id
      FROM seasons
      WHERE id = ${requestedSeasonId}::uuid
    ),
    next_season AS (
      SELECT s.id
      FROM seasons s
      JOIN source_season source ON source.league_id = s.league_id
      WHERE s.id <> source.id
        AND (
          (source.start_date IS NOT NULL AND s.start_date > source.start_date)
          OR (source.start_date IS NULL AND source.end_date IS NOT NULL AND s.start_date > source.end_date)
          OR (source.start_date IS NULL AND source.end_date IS NULL)
        )
      ORDER BY s.start_date ASC NULLS LAST, s.created_at ASC
      LIMIT 1
    )
    SELECT
      source.id AS source_season_id,
      source.league_id AS source_league_id,
      source.start_date::text AS source_start_date,
      source.end_date::text AS source_end_date,
      requested.id AS requested_season_id,
      requested.league_id AS requested_league_id,
      (source.end_date IS NOT NULL AND ${tradeDate}::date > source.end_date) AS is_after_source_end,
      CASE
        WHEN ${requestedSeasonId}::uuid IS NOT NULL
          AND requested.id IS NOT NULL
          AND requested.league_id = source.league_id
        THEN requested.id
        WHEN source.end_date IS NOT NULL AND ${tradeDate}::date > source.end_date
        THEN next_season.id
        ELSE source.id
      END AS roster_season_id
    FROM source_season source
    LEFT JOIN requested_season requested ON TRUE
    LEFT JOIN next_season ON TRUE
  `) ?? [];

  if (rows.length === 0) {
    return { error: { status: 404, message: "Season not found" } };
  }

  const row = rows[0];
  if (requestedSeasonId && !row.requested_season_id) {
    return { error: { status: 404, message: "Roster season not found" } };
  }
  if (requestedSeasonId && row.requested_league_id !== row.source_league_id) {
    return {
      error: {
        status: 400,
        message: "Roster season must belong to the same league",
      },
    };
  }
  if (!requestedSeasonId && row.is_after_source_end && !row.roster_season_id) {
    return {
      error: {
        status: 400,
        message:
          "No later season found for this move. Choose a roster season first.",
      },
    };
  }

  return {
    rosterSeasonId: row.roster_season_id,
    isAfterSourceEnd: !!row.is_after_source_end,
  };
};

const playerHasStatsForTeam = async (playerId, teamId) => {
  const rows =
    (await sql`
    SELECT
      EXISTS (
        SELECT 1
        FROM game_player_stats
        WHERE player_id = ${playerId}
          AND team_id = ${teamId}
        LIMIT 1
      ) AS has_player_stats,
      EXISTS (
        SELECT 1
        FROM game_goalie_stints
        WHERE goalie_id = ${playerId}
          AND team_id = ${teamId}
        LIMIT 1
      ) AS has_goalie_stats
  `) ?? [];
  return Boolean(rows[0]?.has_player_stats || rows[0]?.has_goalie_stats);
};

const mapHistoryRow = (row) => ({
  id: row.id,
  player_id: row.player_id,
  team_id: row.team_id,
  season_id: row.season_id,
  roster_player_team_id: row.roster_player_team_id,
  jersey_number: row.jersey_number,
  is_prospect: row.is_prospect ?? false,
  photo: row.photo,
  position: row.position,
  acquisition_type: row.acquisition_type,
  start_date: row.start_date,
  end_date: row.end_date,
  created_at: row.created_at,
  has_stats: Boolean(row.has_player_stats || row.has_goalie_stats),
  can_delete: !Boolean(row.has_player_stats || row.has_goalie_stats),
  team: {
    id: row.team_id,
    name: row.team_name,
    code: row.team_code,
    logo: row.team_logo,
    logo_dark: row.team_logo_dark,
    logo_light: row.team_logo_light,
    primary_color: row.primary_color,
    text_color: row.text_color,
  },
});

const reconcileStateSnapshot = (stints) =>
  stints
    .map((stint) => ({
      id: stint.id,
      team_id: stint.team_id,
      position: stint.position ?? null,
      acquisition_type: stint.acquisition_type ?? null,
      start_date: stint.start_date ?? null,
      end_date: stint.end_date ?? null,
      import_source: stint.import_source ?? null,
      import_key: stint.import_key ?? null,
      import_snapshot: stint.import_snapshot ?? null,
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));

const buildReconciliationWriteQuery = (txn, playerId, importSource, action) => {
  const incoming = action.incoming;
  const snapshotJson = JSON.stringify(stintSnapshot(incoming));

  if (action.action === "create") {
    return txn`
      WITH inserted AS (
        INSERT INTO player_team_stints (
          player_id, team_id, position, acquisition_type, start_date, end_date,
          import_source, import_key, import_snapshot, imported_at
        )
        VALUES (
          ${playerId}, ${incoming.team_id}, ${incoming.position},
          ${incoming.acquisition_type}, ${incoming.start_date}::date, ${incoming.end_date}::date,
          ${importSource}, ${incoming.import_key}, ${snapshotJson}::jsonb, NOW()
        )
        ON CONFLICT (player_id, import_source, import_key)
          WHERE import_source IS NOT NULL AND import_key IS NOT NULL
        DO NOTHING
        RETURNING id
      )
      SELECT COALESCE(
        (SELECT id::text FROM inserted),
        'concurrent-player-stint-import'
      )::uuid AS id
    `;
  }

  if (action.action === "adopt") {
    return txn`
      WITH before AS (
        SELECT *
        FROM player_team_stints
        WHERE id = ${action.stint_id}
          AND player_id = ${playerId}
          AND import_source IS NULL
        FOR UPDATE
      ),
      adopted AS (
        UPDATE player_team_stints pts
        SET
          team_id = CASE WHEN before.team_id IS NULL THEN ${incoming.team_id}::uuid ELSE before.team_id END,
          position = CASE WHEN before.position IS NULL THEN ${incoming.position}::text ELSE before.position END,
          acquisition_type = CASE WHEN before.acquisition_type IS NULL THEN ${incoming.acquisition_type}::text ELSE before.acquisition_type END,
          start_date = CASE WHEN before.start_date IS NULL THEN ${incoming.start_date}::date ELSE before.start_date END,
          end_date = CASE WHEN before.end_date IS NULL THEN ${incoming.end_date}::date ELSE before.end_date END,
          import_source = ${importSource},
          import_key = ${incoming.import_key},
          import_snapshot = ${snapshotJson}::jsonb,
          imported_at = NOW()
        FROM before
        WHERE pts.id = before.id
          AND before.team_id IS NOT DISTINCT FROM ${action.previous_snapshot.team_id}::uuid
          AND before.position IS NOT DISTINCT FROM ${action.previous_snapshot.position}::text
          AND before.acquisition_type IS NOT DISTINCT FROM ${action.previous_snapshot.acquisition_type}::text
          AND before.start_date IS NOT DISTINCT FROM ${action.previous_snapshot.start_date}::date
          AND before.end_date IS NOT DISTINCT FROM ${action.previous_snapshot.end_date}::date
        RETURNING pts.id
      )
      SELECT COALESCE(
        (SELECT id::text FROM adopted),
        'concurrent-player-stint-adoption'
      )::uuid AS id
    `;
  }

  const previous = action.previous_snapshot;
  return txn`
    WITH before AS (
      SELECT
        pts.*,
        ARRAY_REMOVE(ARRAY[
          CASE
            WHEN pts.team_id IS DISTINCT FROM ${incoming.team_id}::uuid
             AND pts.team_id IS DISTINCT FROM ${previous.team_id}::uuid
            THEN 'team_id'
          END,
          CASE
            WHEN pts.position IS DISTINCT FROM ${incoming.position}::text
             AND pts.position IS DISTINCT FROM ${previous.position}::text
            THEN 'position'
          END,
          CASE
            WHEN pts.acquisition_type IS DISTINCT FROM ${incoming.acquisition_type}::text
             AND pts.acquisition_type IS DISTINCT FROM ${previous.acquisition_type}::text
            THEN 'acquisition_type'
          END,
          CASE
            WHEN pts.start_date IS DISTINCT FROM ${incoming.start_date}::date
             AND pts.start_date IS DISTINCT FROM ${previous.start_date}::date
            THEN 'start_date'
          END,
          CASE
            WHEN pts.end_date IS DISTINCT FROM ${incoming.end_date}::date
             AND pts.end_date IS DISTINCT FROM ${previous.end_date}::date
            THEN 'end_date'
          END
        ], NULL) AS runtime_conflicts
      FROM player_team_stints pts
      WHERE pts.id = ${action.stint_id}
        AND pts.player_id = ${playerId}
        AND pts.import_source = ${importSource}
        AND pts.import_key = ${incoming.import_key}
      FOR UPDATE
    ),
    updated AS (
      UPDATE player_team_stints pts
      SET
        team_id = CASE
          WHEN before.team_id IS NOT DISTINCT FROM ${previous.team_id}::uuid
            OR before.team_id IS NOT DISTINCT FROM ${incoming.team_id}::uuid
          THEN ${incoming.team_id}::uuid
          ELSE before.team_id
        END,
        position = CASE
          WHEN before.position IS NOT DISTINCT FROM ${previous.position}::text
            OR before.position IS NOT DISTINCT FROM ${incoming.position}::text
          THEN ${incoming.position}::text
          ELSE before.position
        END,
        acquisition_type = CASE
          WHEN before.acquisition_type IS NOT DISTINCT FROM ${previous.acquisition_type}::text
            OR before.acquisition_type IS NOT DISTINCT FROM ${incoming.acquisition_type}::text
          THEN ${incoming.acquisition_type}::text
          ELSE before.acquisition_type
        END,
        start_date = CASE
          WHEN before.start_date IS NOT DISTINCT FROM ${previous.start_date}::date
            OR before.start_date IS NOT DISTINCT FROM ${incoming.start_date}::date
          THEN ${incoming.start_date}::date
          ELSE before.start_date
        END,
        end_date = CASE
          WHEN before.end_date IS NOT DISTINCT FROM ${previous.end_date}::date
            OR before.end_date IS NOT DISTINCT FROM ${incoming.end_date}::date
          THEN ${incoming.end_date}::date
          ELSE before.end_date
        END,
        import_snapshot = ${snapshotJson}::jsonb,
        imported_at = NOW()
      FROM before
      WHERE pts.id = before.id
        AND before.import_snapshot IS NOT DISTINCT FROM ${JSON.stringify(previous)}::jsonb
      RETURNING pts.id, before.runtime_conflicts
    )
    SELECT
      COALESCE(
        (SELECT id::text FROM updated),
        'concurrent-player-stint-update'
      )::uuid AS id,
      (SELECT runtime_conflicts FROM updated) AS runtime_conflicts
  `;
};

const applyReconciliationPlan = async ({
  playerId,
  importSource,
  plan,
  existingStints,
}) => {
  const writableActions = plan.actions.filter((action) =>
    ["create", "adopt", "update"].includes(action.action),
  );
  if (writableActions.length === 0) {
    return {
      actions: plan.actions.map((action) => ({ ...action, applied: false })),
      summary: plan.summary,
    };
  }

  const expectedStateJson = JSON.stringify(
    reconcileStateSnapshot(existingStints),
  );
  const lockKey = `player-stint-reconcile:${playerId}`;
  const results = await sql.transaction(
    (txn) => [
      txn`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}::text, 0))`,
      txn`
        WITH current_state AS (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', id::text,
                'team_id', team_id::text,
                'position', position,
                'acquisition_type', acquisition_type,
                'start_date', start_date::text,
                'end_date', end_date::text,
                'import_source', import_source,
                'import_key', import_key,
                'import_snapshot', import_snapshot
              ) ORDER BY id::text
            ),
            '[]'::jsonb
          ) AS value
          FROM player_team_stints
          WHERE player_id = ${playerId}
        )
        SELECT CASE
          WHEN value = ${expectedStateJson}::jsonb THEN TRUE
          ELSE value::text::uuid IS NULL
        END AS state_matches
        FROM current_state
      `,
      ...writableActions.map((action) =>
        buildReconciliationWriteQuery(txn, playerId, importSource, action),
      ),
      txn`
        WITH overlapping AS (
          SELECT 1
          FROM player_team_stints left_stint
          JOIN player_team_stints right_stint
            ON right_stint.player_id = left_stint.player_id
           AND right_stint.id > left_stint.id
          WHERE left_stint.player_id = ${playerId}
            AND NOT (
              left_stint.end_date IS NOT NULL
              AND right_stint.start_date IS NOT NULL
              AND left_stint.end_date <= right_stint.start_date
            )
            AND NOT (
              right_stint.end_date IS NOT NULL
              AND left_stint.start_date IS NOT NULL
              AND right_stint.end_date <= left_stint.start_date
            )
          LIMIT 1
        ),
        open_count AS (
          SELECT COUNT(*)::int AS value
          FROM player_team_stints
          WHERE player_id = ${playerId}
            AND end_date IS NULL
        )
        SELECT CASE
          WHEN NOT EXISTS (SELECT 1 FROM overlapping)
           AND (SELECT value FROM open_count) <= 1
          THEN TRUE
          ELSE ('invalid-player-stint-timeline-' || (SELECT value FROM open_count))::uuid IS NULL
        END AS timeline_valid
      `,
    ],
    { isolationLevel: "Serializable" },
  );

  const resultByAction = new Map();
  writableActions.forEach((action, index) => {
    resultByAction.set(action.import_key, results[index + 2] ?? []);
  });

  const actions = plan.actions.map((action) => {
    if (!resultByAction.has(action.import_key))
      return { ...action, applied: false };
    const rows = resultByAction.get(action.import_key);
    const row = rows[0] ?? null;

    if (!row) {
      if (action.action === "create") {
        return {
          ...action,
          action: "unchanged",
          applied: false,
          changes: [],
        };
      }
      return {
        ...action,
        action: "conflict",
        applied: false,
        changes: [],
        conflicts: [...new Set([...action.conflicts, "concurrent_change"])],
        conflict_type: "concurrent_change",
      };
    }

    const runtimeConflicts = Array.isArray(row.runtime_conflicts)
      ? row.runtime_conflicts
      : [];
    return {
      ...action,
      stint_id: row.id ?? action.stint_id,
      applied: true,
      conflicts: [...new Set([...action.conflicts, ...runtimeConflicts])],
      conflict_type:
        action.conflict_type ??
        (runtimeConflicts.length > 0 ? "manual_override" : null),
    };
  });

  return { actions, summary: summarizeReconciliationActions(actions) };
};

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams/bulk
// Body: { team_id, season_id, players: [{ player_id, jersey_number? }] }
// Opens long-lived team affiliations. season_id supplies the effective start
// date for newly added players; it no longer creates a duplicate row per year.
// Returns { created: [...], skipped: N }
// ---------------------------------------------------------------------------
router.post("/bulk", async (req, res) => {
  const { team_id, season_id, players } = req.body;

  if (!team_id) return res.status(400).json({ error: "team_id is required" });
  if (!season_id)
    return res.status(400).json({ error: "season_id is required" });
  if (!Array.isArray(players) || players.length === 0)
    return res.status(400).json({ error: "players must be a non-empty array" });

  for (let i = 0; i < players.length; i++) {
    if (!players[i].player_id)
      return res
        .status(400)
        .json({ error: `Row ${i + 1}: player_id is required` });
  }

  try {
    const created = [];
    const effectiveStart = await resolveSeasonStart(season_id);
    if (!effectiveStart)
      return res.status(404).json({ error: "Season not found" });
    for (const {
      player_id,
      jersey_number = null,
      is_prospect = false,
    } of players) {
      const stint = await upsertCareerStint({
        player_id,
        team_id,
        is_prospect,
        start_date: effectiveStart,
      });
      if (stint?.created) {
        if (jersey_number != null) {
          await setJerseyAssignment({
            player_id,
            jersey_number,
            effective_date: effectiveStart,
          });
        }
        created.push({
          id: stint.id,
          player_team_stint_id: stint.id,
          player_id,
          team_id,
          season_id,
          jersey_number,
          is_prospect: !!is_prospect,
          roster_source: "derived",
        });
      }
    }
    return res
      .status(201)
      .json({ created, skipped: players.length - created.length });
  } catch (err) {
    console.error("player-teams bulk error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams
// Body: { player_id, team_id, season_id, jersey_number?, photo?, position?, acquisition_type?, start_date?, end_date? }
// Creates or updates the canonical team affiliation. season_id remains in the
// request as the date context used by existing clients.
// ---------------------------------------------------------------------------
router.post("/", async (req, res) => {
  const {
    player_id,
    team_id,
    season_id,
    jersey_number,
    photo,
    position,
    start_date,
    end_date,
  } = req.body;
  const is_prospect = !!req.body.is_prospect;
  const acquisition_type = normalizeAcquisitionType(req.body.acquisition_type);
  if (!player_id)
    return res.status(400).json({ error: "player_id is required" });
  if (!team_id) return res.status(400).json({ error: "team_id is required" });
  if (!season_id)
    return res.status(400).json({ error: "season_id is required" });
  if (!isValidAcquisitionType(acquisition_type))
    return res.status(400).json({ error: "Invalid acquisition_type" });

  try {
    const effectiveStart = start_date ?? (await resolveSeasonStart(season_id));
    if (!effectiveStart)
      return res.status(404).json({ error: "Season not found" });
    const stint = await upsertCareerStint({
      player_id,
      team_id,
      position: position ?? null,
      acquisition_type,
      is_prospect,
      start_date: effectiveStart,
      end_date: end_date ?? null,
    });
    if (jersey_number != null) {
      await setJerseyAssignment({
        player_id,
        jersey_number,
        effective_date: effectiveStart,
      });
    }
    if (photo) {
      await sql`
        INSERT INTO player_photos (player_id, team_id, season_id, photo)
        VALUES (${player_id}, ${team_id}, ${season_id}, ${photo})
        ON CONFLICT (player_id, team_id, season_id)
        DO UPDATE SET photo = EXCLUDED.photo, created_at = NOW()
      `;
    }
    return res.status(201).json({
      ...stint,
      player_team_stint_id: stint.id,
      season_id,
      jersey_number: jersey_number ?? null,
      position: position ?? stint.position ?? null,
      acquisition_type,
      is_prospect,
      photo: photo ?? null,
      roster_source: "derived",
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error:
          "Player already has an active stint in this season. Set an end date or close the existing stint first.",
      });
    }
    console.error("player-teams create error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/player-teams
// Body: { player_id, team_id, season_id, jersey_number?, photo?, position?, effective_date? }
// Updates jersey_number and/or position on the active stint; photo is stored per player/team/season.
// When jersey_number changes, the old value is preserved in jersey_number_history
// so that game queries can resolve the correct number by date.
// ---------------------------------------------------------------------------
router.patch("/", async (req, res) => {
  const {
    player_id,
    team_id,
    season_id,
    jersey_number,
    photo,
    position,
    effective_date,
  } = req.body;
  if (!player_id)
    return res.status(400).json({ error: "player_id is required" });
  if (!team_id) return res.status(400).json({ error: "team_id is required" });
  if (!season_id)
    return res.status(400).json({ error: "season_id is required" });

  const jerseyInBody = "jersey_number" in req.body;
  const photoInBody = "photo" in req.body;
  const positionInBody = "position" in req.body;
  const prospectInBody = "is_prospect" in req.body;

  if (jerseyInBody && !effective_date) {
    return res
      .status(400)
      .json({
        error: "effective_date is required when changing jersey number",
      });
  }

  try {
    const canonicalRows =
      (await sql`
      UPDATE player_team_stints
      SET
        position = CASE WHEN ${positionInBody} THEN ${position ?? null} ELSE position END,
        is_prospect = CASE WHEN ${prospectInBody} THEN ${!!req.body.is_prospect} ELSE is_prospect END
      WHERE id = (
        SELECT id
        FROM player_team_stints
        WHERE player_id = ${player_id}
          AND team_id = ${team_id}
          AND end_date IS NULL
        ORDER BY start_date DESC NULLS LAST, created_at DESC
        LIMIT 1
      )
      RETURNING id, player_id, team_id, position, is_prospect,
                start_date::text AS start_date, end_date::text AS end_date
    `) ?? [];
    if (jerseyInBody) {
      await setJerseyAssignment({
        player_id,
        jersey_number: jersey_number ?? null,
        effective_date,
      });
    }

    // If jersey_number is changing, record history before the update.
    if (jerseyInBody && jersey_number != null) {
      const [current] =
        (await sql`
        SELECT
          pt.id,
          pt.jersey_number,
          COALESCE(pt.start_date, s.start_date, pt.created_at::date)::text AS effective_start,
          s.start_date::text AS season_start
        FROM player_teams pt
        LEFT JOIN seasons s ON s.id = pt.season_id
        WHERE pt.player_id = ${player_id}
          AND pt.team_id   = ${team_id}
          AND pt.season_id = ${season_id}
          AND pt.end_date IS NULL
      `) ?? [];
      if (current && current.jersey_number !== jersey_number) {
        const changeDate = effective_date;
        // Seed initial history if none exists for this stint yet.
        const existingHistory =
          (await sql`
          SELECT 1 FROM jersey_number_history WHERE player_teams_id = ${current.id} LIMIT 1
        `) ?? [];
        if (existingHistory.length === 0 && current.jersey_number != null) {
          // Prefer the roster/season start for the old number. If the change
          // predates that, fall back to season start so the old entry can sort
          // before the new one.
          let seedDate = current.effective_start;
          if (seedDate >= changeDate) {
            seedDate = current.season_start ?? changeDate;
          }
          await sql`
            INSERT INTO jersey_number_history (player_teams_id, jersey_number, effective_from)
            VALUES (${current.id}, ${current.jersey_number}, ${seedDate})
          `;
        }
        // Record the new number going forward.
        await sql`
          INSERT INTO jersey_number_history (player_teams_id, jersey_number, effective_from)
          VALUES (${current.id}, ${jersey_number}, ${changeDate})
        `;
      }
    }

    let rows =
      (await sql`
      UPDATE player_teams
      SET
        jersey_number = CASE WHEN ${jerseyInBody}   THEN ${jersey_number ?? null} ELSE jersey_number END,
        position      = CASE WHEN ${positionInBody}  THEN ${position ?? null}      ELSE position      END,
        is_prospect   = CASE WHEN ${prospectInBody}  THEN ${!!req.body.is_prospect} ELSE is_prospect END
      WHERE player_id = ${player_id}
        AND team_id   = ${team_id}
        AND season_id = ${season_id}
        AND end_date IS NULL
      RETURNING id, player_id, team_id, season_id, jersey_number, is_prospect, position
    `) ?? [];

    if (
      rows.length === 0 &&
      canonicalRows.length === 0 &&
      prospectInBody &&
      !jerseyInBody &&
      !photoInBody &&
      !positionInBody
    ) {
      rows =
        (await sql`
        UPDATE player_teams
        SET is_prospect = ${!!req.body.is_prospect}
        WHERE id = (
          SELECT id
          FROM player_teams
          WHERE player_id = ${player_id}
            AND team_id   = ${team_id}
            AND season_id = ${season_id}
          ORDER BY end_date DESC NULLS FIRST, created_at DESC
          LIMIT 1
        )
        RETURNING id, player_id, team_id, season_id, jersey_number, is_prospect, position
      `) ?? [];
    }

    if (rows.length === 0 && canonicalRows.length > 0) {
      rows = [
        {
          ...canonicalRows[0],
          player_team_stint_id: canonicalRows[0].id,
          season_id,
          jersey_number: jerseyInBody ? (jersey_number ?? null) : undefined,
          roster_source: "derived",
        },
      ];
    }
    if (rows.length === 0)
      return res.status(404).json({ error: "Player team record not found" });
    if (photoInBody) {
      if (photo) {
        await sql`
          INSERT INTO player_photos (player_id, team_id, season_id, photo)
          VALUES (${player_id}, ${team_id}, ${season_id}, ${photo})
          ON CONFLICT (player_id, team_id, season_id)
          DO UPDATE SET photo = EXCLUDED.photo, created_at = NOW()
        `;
      } else {
        await sql`
          DELETE FROM player_photos
          WHERE player_id = ${player_id} AND team_id = ${team_id} AND season_id = ${season_id}
        `;
      }
    }
    rows[0].photo = photoInBody ? (photo ?? null) : null;
    return res.json(rows[0]);
  } catch (err) {
    console.error("player-teams update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/player-teams/history/:playerId?season_id=
// Returns all stints for this player (optionally filtered to a season),
// newest first. Each row includes team name/logo via team_iterations.
// ---------------------------------------------------------------------------
router.get("/history/:playerId", async (req, res) => {
  const { playerId } = req.params;
  const { season_id } = req.query;

  try {
    const rows = await sql`
      SELECT
        pts.id,
        pts.player_id,
        pts.team_id,
        roster.id AS roster_player_team_id,
        roster.season_id,
        roster.jersey_number,
        roster.is_prospect,
        best_player_photo(pts.player_id, roster.season_id, pts.team_id) AS photo,
        COALESCE(pts.position, roster.position) AS position,
        pts.acquisition_type,
        pts.start_date::text AS start_date,
        pts.end_date::text AS end_date,
        pts.created_at,
        ti.name AS team_name,
        ti.code AS team_code,
        ti.logo AS team_logo,
        ti.logo_dark AS team_logo_dark,
        ti.logo_light AS team_logo_light,
        t.primary_color,
        t.text_color,
        EXISTS (
          SELECT 1
          FROM game_player_stats gps
          WHERE gps.player_id = pts.player_id
            AND gps.team_id = pts.team_id
          LIMIT 1
        ) AS has_player_stats,
        EXISTS (
          SELECT 1
          FROM game_goalie_stints ggs
          WHERE ggs.goalie_id = pts.player_id
            AND ggs.team_id = pts.team_id
          LIMIT 1
        ) AS has_goalie_stats
      FROM player_team_stints pts
      JOIN teams t ON t.id = pts.team_id
      LEFT JOIN LATERAL (
        SELECT pt.*
        FROM player_teams pt
        LEFT JOIN seasons s ON s.id = pt.season_id
        WHERE pt.player_id = pts.player_id
          AND pt.team_id = pts.team_id
          AND (${season_id ?? null}::uuid IS NULL OR pt.season_id = ${season_id ?? null}::uuid)
        ORDER BY
          CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
          COALESCE(pt.end_date, pt.start_date, s.start_date, pt.created_at::date) DESC NULLS LAST,
          COALESCE(pt.start_date, s.start_date, pt.created_at::date) DESC NULLS LAST,
          pt.created_at DESC
        LIMIT 1
      ) roster ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          name,
          code,
          team_logo_default(logo_dark, logo_light) AS logo,
          team_logo_dark(logo_dark, logo_light) AS logo_dark,
          team_logo_light(logo_dark, logo_light) AS logo_light
        FROM team_iterations
        WHERE team_id = pts.team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(pts.end_date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(pts.start_date, pts.created_at::date))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) ti ON TRUE
      WHERE pts.player_id = ${playerId}
        AND (
          ${season_id ?? null}::uuid IS NULL
          OR roster.id IS NOT NULL
        )
      ORDER BY
        CASE WHEN pts.end_date IS NULL THEN 0 ELSE 1 END,
        COALESCE(pts.end_date, pts.start_date, pts.created_at::date) DESC NULLS LAST,
        COALESCE(pts.start_date, pts.created_at::date) DESC NULLS LAST,
        pts.created_at DESC
    `;
    return res.json(rows.map(mapHistoryRow));
  } catch (err) {
    console.error("player-teams history error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams/history/:playerId/reconcile
// Body: { source?, dry_run?, apply?, stints: [{ import_key, team_id,
//         position?, acquisition_type?, start_date?, end_date? }] }
// Previews or atomically applies NHL/PuckPedia career-stint changes. This route
// intentionally writes only player_team_stints; season rosters are never
// inferred from transaction history.
// ---------------------------------------------------------------------------
router.post("/history/:playerId/reconcile", async (req, res) => {
  const { playerId } = req.params;
  if (!isValidUuid(playerId))
    return res.status(400).json({ error: "playerId must be a UUID" });

  const importSource =
    req.body.source ?? req.body.import_source ?? NHL_PUCKPEDIA_IMPORT_SOURCE;

  if (importSource !== NHL_PUCKPEDIA_IMPORT_SOURCE) {
    return res
      .status(400)
      .json({ error: "Only nhl_puckpedia stint imports are supported" });
  }
  if ("dry_run" in req.body && typeof req.body.dry_run !== "boolean") {
    return res.status(400).json({ error: "dry_run must be a boolean" });
  }
  if ("apply" in req.body && typeof req.body.apply !== "boolean") {
    return res.status(400).json({ error: "apply must be a boolean" });
  }
  if (
    "dry_run" in req.body &&
    "apply" in req.body &&
    req.body.dry_run === req.body.apply
  ) {
    return res
      .status(400)
      .json({ error: "dry_run and apply must request opposite modes" });
  }

  const dryRun =
    "apply" in req.body ? !req.body.apply : (req.body.dry_run ?? true);
  const validation = validateReconcileStints(req.body.stints);
  if (validation.error)
    return res.status(400).json({ error: validation.error });
  const incomingStints = validation.stints;

  try {
    const playerRows = await sql`
      SELECT id, league_player_number
      FROM players
      WHERE id = ${playerId}
    `;
    if (playerRows.length === 0)
      return res.status(404).json({ error: "Player not found" });

    const teamIds = [...new Set(incomingStints.map((stint) => stint.team_id))];
    const teamRows = await sql`
      SELECT t.id, UPPER(l.code) AS league_code
      FROM teams t
      JOIN leagues l ON l.id = t.league_id
      WHERE t.id = ANY(${teamIds}::uuid[])
    `;
    const validNhlTeamIds = new Set(
      teamRows
        .filter((team) => team.league_code === "NHL")
        .map((team) => team.id),
    );
    const invalidTeamIds = teamIds.filter(
      (teamId) => !validNhlTeamIds.has(teamId),
    );
    if (invalidTeamIds.length > 0) {
      return res.status(400).json({
        error: "Every imported team must belong to the NHL league",
        invalid_team_ids: invalidTeamIds,
      });
    }

    const existingStints = await sql`
      SELECT
        id,
        player_id,
        team_id,
        position,
        acquisition_type,
        start_date::text AS start_date,
        end_date::text AS end_date,
        import_source,
        import_key,
        import_snapshot,
        imported_at
      FROM player_team_stints
      WHERE player_id = ${playerId}
      ORDER BY start_date ASC NULLS FIRST, created_at ASC, id ASC
    `;

    const plan = planPlayerStintReconciliation({
      incomingStints,
      existingStints,
      importSource,
    });

    if (dryRun) {
      return res.json({
        source: importSource,
        dry_run: true,
        applied: false,
        actions: plan.actions,
        summary: plan.summary,
      });
    }

    const appliedPlan = await applyReconciliationPlan({
      playerId,
      importSource,
      plan,
      existingStints,
    });
    return res.json({
      source: importSource,
      dry_run: false,
      applied: true,
      actions: appliedPlan.actions,
      summary: appliedPlan.summary,
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error:
          "The stint import changed concurrently. Preview the reconciliation again.",
      });
    }
    if (err.code === "40001") {
      return res.status(409).json({
        error:
          "The stint import was updated concurrently. Retry the reconciliation.",
      });
    }
    if (err.code === "22P02") {
      return res.status(409).json({
        error:
          "The stint history changed during reconciliation. Preview and retry the import.",
      });
    }
    console.error("player-teams reconcile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams/history/:playerId/jerseys
// Records a player-wide jersey change without requiring a team affiliation.
// ---------------------------------------------------------------------------
router.post("/history/:playerId/jerseys", async (req, res) => {
  const { playerId } = req.params;
  const { jersey_number, effective_date } = req.body;
  if (!isValidJerseyNumber(jersey_number)) {
    return res
      .status(400)
      .json({ error: "jersey_number must be an integer between 0 and 99" });
  }
  if (!isValidDateOnly(effective_date)) {
    return res
      .status(400)
      .json({ error: "effective_date must be a YYYY-MM-DD date" });
  }

  try {
    const assignment = await setJerseyAssignment({
      player_id: playerId,
      jersey_number: Number(jersey_number),
      effective_date,
    });
    return res.status(201).json({ changed: assignment != null, assignment });
  } catch (err) {
    console.error("jersey history create error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/player-teams/history/:playerId/jerseys
// Returns the player's canonical effective-dated jersey assignments.
// ---------------------------------------------------------------------------
router.get("/history/:playerId/jerseys", async (req, res) => {
  const { playerId } = req.params;
  try {
    const rows = await sql`
      SELECT
        pjs.id,
        pjs.player_id,
        pjs.jersey_number,
        pjs.start_date::text AS effective_from,
        pjs.end_date::text AS effective_to
      FROM player_jersey_stints pjs
      WHERE pjs.player_id = ${playerId}
      ORDER BY pjs.start_date DESC, pjs.created_at DESC
    `;
    return res.json(rows);
  } catch (err) {
    console.error("jersey history error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/player-teams/history/jerseys/:id
// Updates a canonical jersey assignment and recalculates interval boundaries.
// ---------------------------------------------------------------------------
router.patch("/history/jerseys/:id", async (req, res) => {
  const { id } = req.params;
  const { jersey_number, effective_from } = req.body;
  if (!isValidJerseyNumber(jersey_number)) {
    return res
      .status(400)
      .json({ error: "jersey_number must be an integer between 0 and 99" });
  }
  if (!isValidDateOnly(effective_from)) {
    return res
      .status(400)
      .json({ error: "effective_from must be a YYYY-MM-DD date" });
  }

  try {
    const rows = await sql`
      UPDATE player_jersey_stints
      SET
        jersey_number = ${Number(jersey_number)},
        start_date = ${effective_from}::date
      WHERE id = ${id}
      RETURNING id, player_id, jersey_number, start_date::text AS effective_from
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: "Jersey history row not found" });
    }

    await sql`
      WITH ordered AS (
        SELECT
          id,
          LEAD(start_date) OVER (ORDER BY start_date, created_at, id) - 1 AS end_date
        FROM player_jersey_stints
        WHERE player_id = ${rows[0].player_id}
      )
      UPDATE player_jersey_stints pjs
      SET end_date = ordered.end_date
      FROM ordered
      WHERE pjs.id = ordered.id
    `;
    return res.json(rows[0]);
  } catch (err) {
    console.error("jersey history update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/player-teams/history/jerseys/:id
// Deletes a canonical jersey assignment and reconnects adjacent intervals.
// ---------------------------------------------------------------------------
router.delete("/history/jerseys/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const rows = await sql`
      WITH deleted AS (
        DELETE FROM player_jersey_stints
        WHERE id = ${id}
        RETURNING id, player_id, jersey_number, start_date::text AS effective_from
      )
      SELECT * FROM deleted
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: "Jersey history row not found" });
    }
    await sql`
      WITH ordered AS (
        SELECT
          id,
          LEAD(start_date) OVER (ORDER BY start_date, created_at, id) - 1 AS end_date
        FROM player_jersey_stints
        WHERE player_id = ${rows[0].player_id}
      )
      UPDATE player_jersey_stints pjs
      SET end_date = ordered.end_date
      FROM ordered
      WHERE pjs.id = ordered.id
    `;
    return res.json(rows[0]);
  } catch (err) {
    console.error("jersey history delete error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/player-teams/history/:playerId/photos
// Returns one photo row per season/team membership, with saved photos when
// present and provider-generated season URLs as display fallbacks.
// ---------------------------------------------------------------------------
router.get("/history/:playerId/photos", async (req, res) => {
  const { playerId } = req.params;
  try {
    const rows = await sql`
      WITH season_membership AS (
        SELECT DISTINCT ON (pt.player_id, pt.team_id, pt.season_id)
          pt.player_id,
          pt.team_id,
          pt.season_id,
          pt.start_date,
          pt.end_date,
          pt.created_at
        FROM player_teams pt
        WHERE pt.player_id = ${playerId}
        ORDER BY
          pt.player_id,
          pt.team_id,
          pt.season_id,
          CASE WHEN pt.end_date IS NULL THEN 0 ELSE 1 END,
          COALESCE(pt.end_date, pt.start_date, pt.created_at::date) DESC NULLS LAST,
          COALESCE(pt.start_date, pt.created_at::date) DESC NULLS LAST,
          pt.created_at DESC
      )
      SELECT
        pp.id,
        sm.player_id,
        sm.team_id,
        sm.season_id,
        COALESCE(pp.photo, player_provider_photo(sm.player_id, sm.season_id, sm.team_id)) AS photo,
        pp.created_at,
        s.name AS season_name,
        ti.name AS team_name,
        (pp.id IS NOT NULL) AS has_saved_photo
      FROM season_membership sm
      JOIN seasons s ON s.id = sm.season_id
      LEFT JOIN LATERAL (
        SELECT id, NULLIF(photo, '') AS photo, created_at
        FROM player_photos
        WHERE player_id = sm.player_id
          AND team_id = sm.team_id
          AND season_id = sm.season_id
          AND NULLIF(photo, '') IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      ) pp ON true
      LEFT JOIN LATERAL (
        SELECT name FROM team_iterations
        WHERE team_id = sm.team_id
        ORDER BY
          CASE
            WHEN (start_date IS NULL OR start_date <= COALESCE(s.end_date, CURRENT_DATE))
             AND (end_date IS NULL OR end_date >= COALESCE(s.start_date, s.created_at::date))
            THEN 0
            WHEN end_date IS NULL THEN 1
            ELSE 2
          END,
          start_date DESC NULLS LAST,
          recorded_at DESC
        LIMIT 1
      ) ti ON true
      ORDER BY
        s.start_date DESC NULLS LAST,
        s.created_at DESC,
        COALESCE(sm.start_date, sm.created_at::date) DESC NULLS LAST,
        pp.created_at DESC NULLS LAST
    `;
    return res.json(rows);
  } catch (err) {
    console.error("player photo history error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams/history/:playerId/photos
// Body: { team_id, season_id, photo }
// Upserts one player photo for that player/team/season.
// ---------------------------------------------------------------------------
router.post("/history/:playerId/photos", async (req, res) => {
  const { playerId } = req.params;
  const { team_id, season_id, photo } = req.body;

  if (!team_id) return res.status(400).json({ error: "team_id is required" });
  if (!season_id)
    return res.status(400).json({ error: "season_id is required" });
  if (!photo) return res.status(400).json({ error: "photo is required" });

  try {
    const rows = await sql`
      INSERT INTO player_photos (player_id, team_id, season_id, photo)
      VALUES (${playerId}, ${team_id}, ${season_id}, ${photo})
      ON CONFLICT (player_id, team_id, season_id)
      DO UPDATE SET photo = EXCLUDED.photo, created_at = NOW()
      RETURNING id, player_id, team_id, season_id, photo, created_at
    `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("player photo upsert error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/player-teams/history/photos/:id
// Deletes one saved player photo record.
// ---------------------------------------------------------------------------
router.delete("/history/photos/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const rows = await sql`
      DELETE FROM player_photos
      WHERE id = ${id}
      RETURNING id, player_id, team_id, season_id, photo, created_at
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: "Player photo row not found" });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error("player photo delete error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/player-teams/:id
// Body: { team_id?, season_id?, jersey_number?, photo?, position?, acquisition_type?, start_date?, end_date? }
// Updates editable fields on a specific stint row by its UUID.
// ---------------------------------------------------------------------------
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    team_id,
    season_id,
    jersey_number,
    photo,
    position,
    start_date,
    end_date,
  } = req.body;
  const acquisition_type = normalizeAcquisitionType(req.body.acquisition_type);

  const teamInBody = "team_id" in req.body;
  const seasonInBody = "season_id" in req.body;
  const jerseyInBody = "jersey_number" in req.body;
  const prospectInBody = "is_prospect" in req.body;
  const photoInBody = "photo" in req.body;
  const positionInBody = "position" in req.body;
  const acquisitionInBody = "acquisition_type" in req.body;
  const startDateInBody = "start_date" in req.body;
  const endDateInBody = "end_date" in req.body;
  const rosterSeasonId = seasonInBody ? season_id : null;
  if (!isValidAcquisitionType(acquisition_type))
    return res.status(400).json({ error: "Invalid acquisition_type" });

  try {
    const stintRows =
      (await sql`
      UPDATE player_team_stints
      SET
        team_id       = CASE WHEN ${teamInBody}      THEN ${team_id}::uuid                   ELSE team_id       END,
        position      = CASE WHEN ${positionInBody}  THEN ${position ?? null}                 ELSE position      END,
        is_prospect   = CASE WHEN ${prospectInBody}  THEN ${!!req.body.is_prospect}           ELSE is_prospect   END,
        acquisition_type = CASE WHEN ${acquisitionInBody} THEN ${acquisition_type}             ELSE acquisition_type END,
        start_date    = CASE WHEN ${startDateInBody} THEN ${start_date ?? null}::date         ELSE start_date    END,
        end_date      = CASE WHEN ${endDateInBody}   THEN ${end_date ?? null}::date           ELSE end_date      END
      WHERE id = ${id}
      RETURNING
        id, player_id, team_id,
        position, is_prospect, acquisition_type,
        start_date::text AS start_date,
        end_date::text AS end_date
    `) ?? [];

    if (stintRows.length > 0) {
      let [roster] =
        (await sql`
        SELECT id, team_id, season_id, jersey_number, is_prospect, position
        FROM player_teams
        WHERE player_id = ${stintRows[0].player_id}
          AND team_id = ${stintRows[0].team_id}
          AND (${rosterSeasonId}::uuid IS NULL OR season_id = ${rosterSeasonId}::uuid)
        ORDER BY end_date DESC NULLS FIRST, created_at DESC
        LIMIT 1
      `) ?? [];
      if (roster && (jerseyInBody || prospectInBody || positionInBody)) {
        [roster] =
          (await sql`
          UPDATE player_teams
          SET
            jersey_number = CASE WHEN ${jerseyInBody}   THEN ${jersey_number ?? null}  ELSE jersey_number END,
            is_prospect   = CASE WHEN ${prospectInBody} THEN ${!!req.body.is_prospect} ELSE is_prospect   END,
            position      = CASE WHEN ${positionInBody} THEN ${position ?? null}       ELSE position      END
          WHERE id = ${roster.id}
          RETURNING id, team_id, season_id, jersey_number, is_prospect, position
        `) ?? [];
      }
      const photoSeasonId =
        roster?.season_id ?? (seasonInBody ? season_id : null);
      const photoTeamId = roster?.team_id ?? stintRows[0].team_id;
      if (photoInBody && photoSeasonId) {
        if (photo) {
          await sql`
            INSERT INTO player_photos (player_id, team_id, season_id, photo)
            VALUES (${stintRows[0].player_id}, ${photoTeamId}, ${photoSeasonId}, ${photo})
            ON CONFLICT (player_id, team_id, season_id)
            DO UPDATE SET photo = EXCLUDED.photo, created_at = NOW()
          `;
        } else {
          await sql`
            DELETE FROM player_photos
            WHERE player_id = ${stintRows[0].player_id} AND team_id = ${photoTeamId} AND season_id = ${photoSeasonId}
          `;
        }
      }
      return res.json({
        ...stintRows[0],
        season_id: roster?.season_id ?? (seasonInBody ? season_id : null),
        roster_player_team_id: roster?.id ?? null,
        jersey_number: roster?.jersey_number ?? null,
        is_prospect: roster?.is_prospect ?? stintRows[0].is_prospect ?? false,
        photo: photoInBody ? (photo ?? null) : null,
      });
    }

    const rows = await sql`
      UPDATE player_teams
      SET
        team_id       = CASE WHEN ${teamInBody}      THEN ${team_id}::uuid                   ELSE team_id       END,
        season_id     = CASE WHEN ${seasonInBody}    THEN ${season_id}::uuid                 ELSE season_id     END,
        jersey_number = CASE WHEN ${jerseyInBody}    THEN ${jersey_number ?? null}            ELSE jersey_number END,
        is_prospect   = CASE WHEN ${prospectInBody}  THEN ${!!req.body.is_prospect}           ELSE is_prospect   END,
        position      = CASE WHEN ${positionInBody}  THEN ${position ?? null}                 ELSE position      END,
        acquisition_type = CASE WHEN ${acquisitionInBody} THEN ${acquisition_type}             ELSE acquisition_type END,
        start_date    = CASE WHEN ${startDateInBody} THEN ${start_date ?? null}::date         ELSE start_date    END,
        end_date      = CASE WHEN ${endDateInBody}   THEN ${end_date ?? null}::date           ELSE end_date      END
      WHERE id = ${id}
      RETURNING
        id, player_id, team_id, season_id,
        jersey_number, is_prospect, position, acquisition_type,
        start_date::text AS start_date,
        end_date::text   AS end_date
    `;
    if (rows.length === 0)
      return res.status(404).json({ error: "Stint not found" });
    if (photoInBody) {
      const photoTeamId = teamInBody ? team_id : rows[0].team_id;
      const photoSeasonId = seasonInBody ? season_id : rows[0].season_id;
      if (photo) {
        await sql`
          INSERT INTO player_photos (player_id, team_id, season_id, photo)
          VALUES (${rows[0].player_id}, ${photoTeamId}, ${photoSeasonId}, ${photo})
          ON CONFLICT (player_id, team_id, season_id)
          DO UPDATE SET photo = EXCLUDED.photo, created_at = NOW()
        `;
      } else {
        await sql`
          DELETE FROM player_photos
          WHERE player_id = ${rows[0].player_id} AND team_id = ${photoTeamId} AND season_id = ${photoSeasonId}
        `;
      }
    }
    rows[0].photo = photoInBody ? (photo ?? null) : null;
    return res.json(rows[0]);
  } catch (err) {
    console.error("player-teams patch/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/player-teams/:id
// Removes a player's association with a team for that season.
// ---------------------------------------------------------------------------
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const stintRows =
      (await sql`
      SELECT id, player_id, team_id
      FROM player_team_stints
      WHERE id = ${id}
    `) ?? [];
    if (stintRows.length > 0) {
      const hasStats = await playerHasStatsForTeam(
        stintRows[0].player_id,
        stintRows[0].team_id,
      );
      if (hasStats) {
        return res.status(409).json({
          error:
            "Cannot delete team stint while player has stats for this team.",
        });
      }
      // Career stints are not FK-linked to season roster rows, so remove any
      // roster remnants for the same player/team once the no-stats guard passes.
      await sql`
        WITH target AS (
          SELECT ${stintRows[0].player_id}::uuid AS player_id, ${stintRows[0].team_id}::uuid AS team_id
        ),
        deleted_roster_rows AS (
          DELETE FROM player_teams pt
          USING target
          WHERE pt.player_id = target.player_id
            AND pt.team_id = target.team_id
          RETURNING pt.id
        )
        DELETE FROM player_team_stints
        WHERE id = ${id}
      `;
      return res.json({ message: "Stint deleted" });
    }

    const rows = await sql`
      SELECT id, player_id, team_id
      FROM player_teams
      WHERE id = ${id}
    `;
    if (rows.length === 0)
      return res.status(404).json({ error: "Stint not found" });

    const hasStats = await playerHasStatsForTeam(
      rows[0].player_id,
      rows[0].team_id,
    );
    if (hasStats) {
      return res.status(409).json({
        error: "Cannot delete team stint while player has stats for this team.",
      });
    }
    await sql`
      DELETE FROM player_teams
      WHERE id = ${id}
    `;
    return res.json({ message: "Player removed from team" });
  } catch (err) {
    console.error("player-teams delete/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams/bulk-trade
// Body: { players: [{ player_id, jersey_number?, position? }], season_id, to_team_id, trade_date, acquisition_type? }
// Closes each player's current active stint and opens a new one on to_team_id.
// Returns { traded: [...], failed: [player_ids that had no active stint] }
// ---------------------------------------------------------------------------
router.post("/bulk-trade", async (req, res) => {
  const { players, season_id, to_team_id, trade_date } = req.body;
  const requestedRosterSeasonId =
    req.body.target_season_id ?? req.body.roster_season_id ?? null;
  const acquisition_type =
    "acquisition_type" in req.body
      ? normalizeAcquisitionType(req.body.acquisition_type)
      : "trade";

  if (!Array.isArray(players) || players.length === 0)
    return res.status(400).json({ error: "players must be a non-empty array" });
  if (!season_id)
    return res.status(400).json({ error: "season_id is required" });
  if (!to_team_id)
    return res.status(400).json({ error: "to_team_id is required" });
  if (!trade_date)
    return res.status(400).json({ error: "trade_date is required" });
  if (!isValidDateOnly(trade_date))
    return res.status(400).json({ error: "trade_date must be YYYY-MM-DD" });
  if (!isValidAcquisitionType(acquisition_type))
    return res.status(400).json({ error: "Invalid acquisition_type" });

  try {
    const seasonResolution = await resolveTradeRosterSeason({
      sourceSeasonId: season_id,
      tradeDate: trade_date,
      requestedSeasonId: requestedRosterSeasonId,
    });
    if (seasonResolution.error) {
      return res
        .status(seasonResolution.error.status)
        .json({ error: seasonResolution.error.message });
    }

    const rosterSeasonId = seasonResolution.rosterSeasonId;
    const traded = [];
    const failed = [];

    for (const {
      player_id,
      jersey_number = null,
      position = null,
    } of players) {
      const closed = await closeActiveCareerStints(player_id, trade_date);

      if (closed.length === 0) {
        failed.push(player_id);
        continue;
      }

      const created = await upsertCareerStint({
        player_id,
        team_id: to_team_id,
        position,
        acquisition_type,
        start_date: trade_date,
      });
      if (jersey_number != null) {
        await setJerseyAssignment({
          player_id,
          jersey_number,
          effective_date: trade_date,
        });
      }
      traded.push({
        ...created,
        player_team_stint_id: created.id,
        season_id: rosterSeasonId,
        jersey_number,
        position,
        acquisition_type,
        roster_source: "derived",
      });
    }

    return res.status(201).json({ traded, failed });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error: "Player already has an active roster row in the target season.",
      });
    }
    console.error("player-teams bulk-trade error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/player-teams/trade
// Body: { player_id, season_id, to_team_id, trade_date, jersey_number?, jersey_effective_date?, position?, acquisition_type? }
// Closes the player's current stint (sets end_date) and opens a new one on
// to_team_id starting on trade_date.
// ---------------------------------------------------------------------------
router.post("/trade", async (req, res) => {
  const {
    player_id,
    season_id,
    to_team_id,
    trade_date,
    jersey_number = null,
    jersey_effective_date = null,
    position = null,
  } = req.body;
  const requestedRosterSeasonId =
    req.body.target_season_id ?? req.body.roster_season_id ?? null;
  const acquisition_type =
    "acquisition_type" in req.body
      ? normalizeAcquisitionType(req.body.acquisition_type)
      : "trade";
  if (!player_id)
    return res.status(400).json({ error: "player_id is required" });
  if (!season_id)
    return res.status(400).json({ error: "season_id is required" });
  if (!to_team_id)
    return res.status(400).json({ error: "to_team_id is required" });
  if (!trade_date)
    return res.status(400).json({ error: "trade_date is required" });
  if (!isValidDateOnly(trade_date))
    return res.status(400).json({ error: "trade_date must be YYYY-MM-DD" });
  if (jersey_effective_date != null && !isValidDateOnly(jersey_effective_date))
    return res
      .status(400)
      .json({ error: "jersey_effective_date must be YYYY-MM-DD" });
  if (!isValidAcquisitionType(acquisition_type))
    return res.status(400).json({ error: "Invalid acquisition_type" });

  try {
    const seasonResolution = await resolveTradeRosterSeason({
      sourceSeasonId: season_id,
      tradeDate: trade_date,
      requestedSeasonId: requestedRosterSeasonId,
    });
    if (seasonResolution.error) {
      return res
        .status(seasonResolution.error.status)
        .json({ error: seasonResolution.error.message });
    }

    const rosterSeasonId = seasonResolution.rosterSeasonId;
    const closed = await closeActiveCareerStints(player_id, trade_date);
    if (closed.length === 0) {
      return res
        .status(404)
        .json({
          error: "No active stint found for this player in this season",
        });
    }

    const created = await upsertCareerStint({
      player_id,
      team_id: to_team_id,
      position,
      acquisition_type,
      start_date: trade_date,
    });
    if (jersey_number != null) {
      await setJerseyAssignment({
        player_id,
        jersey_number,
        effective_date: jersey_effective_date ?? trade_date,
      });
    }
    return res.status(201).json({
      from_team_id: closed[0].team_id,
      new_stint: {
        ...created,
        player_team_stint_id: created.id,
        season_id: rosterSeasonId,
        jersey_number,
        position,
        acquisition_type,
        roster_source: "derived",
      },
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error: "Player already has an active roster row in the target season.",
      });
    }
    console.error("player-teams trade error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
