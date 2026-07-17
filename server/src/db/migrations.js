/**
 * Creates the ledger used by one-time data migrations.
 *
 * Keeping this bootstrap in one place prevents schema sections from each
 * redefining the same table and gives future migration modules a stable entry
 * point without changing the database client used by the application.
 */
async function ensureMigrationLedger(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

module.exports = { ensureMigrationLedger };
