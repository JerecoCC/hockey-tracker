# Player timeline overhaul

## Data ownership

- `player_team_stints` is the canonical effective-dated team affiliation. A player is not re-added merely because a new season starts.
- `player_jersey_stints` is the canonical player-wide, effective-dated jersey assignment. Identical numbers span seasons and team changes without creating another assignment.
- `player_season_rosters` is a read-only compatibility view. It returns preserved `player_teams` snapshots first and derives only missing season memberships from team stints.
- `season_projected_lineup_slots` is an editable season/team template. Creating a game copies the projection into `game_rosters`; later projection edits do not rewrite a historical game.
- `game_rosters` remains the record of actual game participation.

## Migration behavior

`ensurePlayerTimelineSchema` is idempotent and ledgered in `_migrations`.

1. `canonical_player_timelines_v1` adds the temporal tables, copies roster roles, infers conservative starts for undated manual affiliations, and collapses repeated legacy jersey snapshots into assignments.
2. `canonical_player_timelines_v2_exclusive_boundaries` corrects inferred manual moves so the previous affiliation ends one day before the next begins. Provider-imported boundaries are not changed.

Legacy `player_teams` and `jersey_number_history` rows are intentionally retained during the transition. New roster additions and trades write canonical stints; existing legacy rows are mirrored only where required by transitional clients.

## Backup and rollback

The pre-migration custom-format PostgreSQL dump is stored outside version control at:

`D:\Code\hockey-tracker\.backups\database\hockey-tracker-20260811-193303.dump`

The dump was validated with `pg_restore --list`. A full rollback should restore that dump into a fresh database and point `POSTGRES_URL` at the restored database. Avoid dropping the new objects in place unless a fresh restore is impossible, because the application can continue reading preserved legacy rows through the compatibility period.
