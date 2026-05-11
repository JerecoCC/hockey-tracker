-- Migration: drop game_goalie_stats (deferred – run after one release of grace)
--
-- Prerequisites before running this migration:
--   1. seasons.js reads from game_goalie_stints   ✓ (done in this release)
--   2. No other consumer reads from game_goalie_stats
--   3. The legacy write endpoints (PUT /goalie-stats, POST /goalie-stats/switch,
--      DELETE /goalie-stats/:goalieId) have been updated to write directly to
--      game_goalie_stints and no longer call rebuild_goalie_stints().
--   4. The rebuild_goalie_stints() and rebuild_legacy_goalie_stats() DB functions
--      are no longer referenced by application code.
--
-- Run with: psql $DATABASE_URL -f server/scripts/drop-game-goalie-stats.sql

BEGIN;

DROP TABLE IF EXISTS game_goalie_stats;

-- Clean up the sync helper functions that are no longer needed.
DROP FUNCTION IF EXISTS rebuild_goalie_stints(uuid);
DROP FUNCTION IF EXISTS rebuild_legacy_goalie_stats(uuid);

COMMIT;
