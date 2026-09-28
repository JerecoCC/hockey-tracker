# Player timeline overhaul

## Data ownership

- `player_team_stints` is the canonical effective-dated team affiliation. A player is not re-added merely because a new season starts.
- `player_jersey_stints` is the canonical player-wide, effective-dated jersey assignment. Identical numbers span seasons and team changes without creating another assignment.
- `player_season_rosters` is a read-only view that derives each season's roster from the team stints alone. It no longer reads `player_teams`.
- `season_projected_lineup_slots` is an editable season/team template. Creating a game copies the projection into `game_rosters`; later projection edits do not rewrite a historical game.
- `game_rosters` is the record of actual game participation, including the `jersey_number` each player wore. A game's own number wins when it is read back; a scheduled game defaults to the number worn in each player's last game unless the jersey timeline changed after it.

## Games advance the timeline

Auto-fill treats a completed game as proof of who played where and in what number:

- A dressed player still affiliated with another team is moved to the team they dressed for, dated to the game (the old stint ends the day before). The move carries no acquisition type, since the game cannot say how the player arrived; edit the stint to record the real transaction.
- A number worn in the game that the jersey timeline still gives to someone else is recorded for the dressed player. The other holder is named in the run's warnings rather than changed, because the game cannot say what they wear now.
- The manual player update report remains only for a game without a valid date, where no move can be dated.

## Migration behavior

`ensurePlayerTimelineSchema` is idempotent and ledgered in `_migrations`.

1. `canonical_player_timelines_v1` adds the temporal tables, copies roster roles, infers conservative starts for undated manual affiliations, and collapses repeated legacy jersey snapshots into assignments.
2. `canonical_player_timelines_v2_exclusive_boundaries` corrects inferred manual moves so the previous affiliation ends one day before the next begins. Provider-imported boundaries are not changed.
3. `player_team_stints_merge_duplicates_v1` removes a stint that repeats another's player, team and window, keeping the most complete row. Once rosters read stints directly, a duplicate would list the player twice.
4. `game_roster_jersey_numbers_v1` adds `game_rosters.jersey_number` and backfills finished games from the jersey timeline. Scheduled games are left blank so they still pick up a number change made before they are played.
5. `player_team_stints_game_boundaries_v1` applies the data audit's boundary fixes: 7 stints pulled back to the player's first preseason game for that team (roster adds had opened them on the season start), then 32 older stints on another team ended the day before the next team begins (23 one-day overlaps, mostly provider imports that v2 skipped, 3 preseason moves still running to the season start, and 6 previous teams moved to meet the backdated starts). Game days use the stored schedule day (UTC). Samuel Ersson, Logan Mailloux and Cole Smith are excluded; their trade records need a manual look.

Legacy `player_teams` and `jersey_number_history` rows are retained on disk but no longer feed any roster read. When the view was switched, the legacy snapshots disagreed with the stints for 112 current-season windows (almost all the one-day overlap that v2 fixed, or a missing acquisition date) and 29 rows had no stint at all (offseason signings filed under the season that had already ended, with no games behind them). Some writes still mirror into `player_teams`; they are inert and can be removed before the tables are dropped.

## Backup and rollback

The pre-migration custom-format PostgreSQL dump is stored outside version control at:

`D:\Code\hockey-tracker\.backups\database\hockey-tracker-20260811-193303.dump`

The dump was validated with `pg_restore --list`. A full rollback should restore that dump into a fresh database and point `POSTGRES_URL` at the restored database. Avoid dropping the new objects in place unless a fresh restore is impossible, because the application can continue reading preserved legacy rows through the compatibility period.

Before steps 3 and 4, the affected tables were exported as JSON (the local `pg_dump` 15 cannot read the v17 server) to:

`D:\Code\hockey-tracker\.backups\database\hybrid-rosters-20260925-155945\`

It holds `game_rosters`, `player_team_stints`, `player_jersey_stints`, `player_teams` and `jersey_number_history`. Undoing these steps in place:

- The roster view: restore the previous `player_season_rosters` definition from git. Nothing depends on the view and no data was changed.
- Step 4: `ALTER TABLE game_rosters DROP COLUMN jersey_number`. The backfill only wrote that column.
- Step 3: reinsert the one removed row (A.J. Greer's position-less FLA stint, `e93b7a7e-ee86-4827-9caf-70ab39754c0a`) from `player_team_stints.json`.

Before step 5, `player_team_stints` was exported again to `D:\Code\hockey-tracker\.backups\database\stint-fixes-20260925-170255\`. To undo it, restore `start_date` and `end_date` by id from that file; the step changed no other columns and added or removed no rows.

Delete the matching `_migrations` rows if a step should run again.
