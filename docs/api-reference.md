# API Reference

All endpoints are prefixed with `/api`. UUIDs are used for all entity IDs.

---

## Auth — `/api/auth`

### `POST /api/auth/signup`

Create a new user account.

**Body**

```json
{ "name": "string", "email": "string", "password": "string (min 6 chars)" }
```

**Response `201`**

```json
{ "token": "JWT", "user": { "id", "displayName", "email", "photo", "role" } }
```

---

### `POST /api/auth/login`

Log in with email/password.

**Body**

```json
{ "email": "string", "password": "string" }
```

**Response `200`**

```json
{ "token": "JWT", "user": { "id", "displayName", "email", "photo", "role" } }
```

---

### `GET /api/auth/google`

Initiates Google OAuth flow. Redirects to Google.

---

### `GET /api/auth/google/callback`

Google OAuth redirect target. On success redirects to `CLIENT_URL/auth/callback?token=JWT`.

---

### `GET /api/auth/me` 🔒

Returns the currently authenticated user.

**Response `200`**

```json
{ "id", "displayName", "email", "photo", "role" }
```

---

### `POST /api/auth/logout`

Destroys the server-side session. Token-based auth: no-op server-side.

**Response `200`** `{ "message": "Logged out successfully" }`

---

## Admin — `/api/admin` 🔐

> All `/api/admin/*` routes require `role = admin`.

### `GET /api/admin/users`

List all users.

**Response `200`** Array of `{ id, display_name, email, role, is_google, created_at }`

---

### `PATCH /api/admin/users/:id/role`

Change a user's role.

**Body** `{ "role": "user" | "admin" }`

**Response `200`** `{ id, display_name, email, role }`

---

### `DELETE /api/admin/users/:id`

Delete a user. Cannot delete yourself.

**Response `200`** `{ "message": "User deleted" }`

---

## Leagues — `/api/admin/leagues` 🔐

### `POST /api/admin/leagues/upload`

Upload a league logo to Vercel Blob. Multipart form field: `logo` (image, max 2 MB).

**Response `200`** `{ "url": "https://..." }`

---

### `GET /api/admin/leagues`

List all leagues.

**Response `200`** Array of `{ id, name, code, logo, primary_color, text_color, best_of_playoff, best_of_shootout, scoring_system, playoff_format }`

---

### `GET /api/admin/leagues/:id`

Get a single league with its teams and seasons.

**Response `200`**

```json
{
  "id", "name", "code", "description", "logo",
  "primary_color", "text_color",
  "best_of_playoff", "best_of_shootout", "scoring_system", "playoff_format",
  "created_at",
  "teams": [{ "id", "name", "code", "logo", "primary_color", "text_color", ... }],
  "seasons": [{ "id", "name", "start_date", "end_date", "is_current" }]
}
```

---

### `POST /api/admin/leagues`

Create a league.

**Body** `{ name*, code*, description?, logo?, primary_color?, text_color?, best_of_playoff?, best_of_shootout?, scoring_system?, playoff_format? }`

**Response `201`** Full league object.

---

### `PATCH /api/admin/leagues/:id`

Update a league (partial). All fields optional.

**Body** `{ name?, code?, description?, logo?, primary_color?, text_color?, best_of_playoff?, best_of_shootout?, scoring_system?, playoff_format? }`

**Response `200`** Full league object.

---

### `DELETE /api/admin/leagues/:id`

Delete a league.

**Response `200`** `{ "message": "League deleted" }`

---

## Teams — `/api/admin/teams` 🔐

### `POST /api/admin/teams/upload`

Upload a team logo. Multipart form field: `logo` (image, max 2 MB).

**Response `200`** `{ "url": "https://..." }`

---

### `GET /api/admin/teams`

List all teams. Name/code/logo resolved from the latest base iteration.

**Response `200`** Array of `{ id, name, code, logo, primary_color, secondary_color, text_color, description, location, city, home_arena, league_id, created_at }`

---

### `GET /api/admin/teams/:id`

Get a single team with league info and active/start season references.

**Response `200`** `{ ...team fields, league_name, league_code, league_logo, league_primary_color, league_text_color, start_season_id, latest_season_id, start_season_start_date, latest_season_end_date }`

---

### `POST /api/admin/teams`

Create a team and auto-create its base identity iteration.

**Body** `{ name*, code*, description?, location?, city?, home_arena?, logo?, league_id?, primary_color?, secondary_color?, text_color? }`

**Response `201`** Full team object (with resolved name/code/logo).

---

### `PATCH /api/admin/teams/:id`

Update a team. Identity fields (`name`, `code`, `logo`) update the base iteration (`season_id IS NULL`).

**Body** `{ name?, code?, description?, location?, city?, home_arena?, logo?, league_id?, primary_color?, secondary_color?, text_color?, start_season_id?, latest_season_id? }`

**Response `200`** Full team object.

---

### `GET /api/admin/teams/:id/iterations`

List all recorded identity snapshots for a team.

**Response `200`** Array of `{ id, team_id, name, code, logo, note, recorded_at, start_season_id, start_season_name, latest_season_id, latest_season_name }`

---

### `POST /api/admin/teams/:id/iterations`

Record a new identity snapshot.

**Body** `{ name*, code?, logo?, note?, start_season_id?, latest_season_id? }`

**Response `201`** Iteration object.

---

### `PATCH /api/admin/teams/:id/iterations/:iterationId`

Update a specific identity snapshot.

**Body** `{ name?, code?, logo?, note?, start_season_id?, latest_season_id? }`

**Response `200`** Iteration object.

---

### `DELETE /api/admin/teams/:id/iterations/:iterationId`

Delete an identity snapshot.

**Response `200`** `{ "message": "Iteration deleted" }`

---

### `DELETE /api/admin/teams/:id`

Delete a team.

**Response `200`** `{ "message": "Team deleted" }`

---

## Seasons — `/api/admin/seasons` 🔐

### `GET /api/admin/seasons`

List seasons. Optionally filter by `?league_id=`.

**Response `200`** Array of `{ id, name, league_id, is_current, is_ended, start_date, end_date, games_per_season, created_at, league_name, league_code, league_logo }`

---

### `GET /api/admin/seasons/:id`

Get a single season with league settings.

**Response `200`** `{ ...season fields, playoff_format, best_of_playoff, best_of_shootout, scoring_system, bracket_rule_set_id, league_scoring_system, league_best_of_playoff, league_best_of_shootout }`

---

### `POST /api/admin/seasons`

Create a season.

**Body** `{ league_id*, name*, start_date?, end_date?, games_per_season? }`

**Response `201`** Season object.

---

### `PATCH /api/admin/seasons/:id`

Update a season. Setting an `end_date` automatically unsets the league's `current_season_id`.

**Body** `{ league_id?, name?, start_date?, end_date?, games_per_season?, playoff_format?, best_of_playoff?, best_of_shootout?, scoring_system?, bracket_rule_set_id? }`

**Response `200`** Full season object.

---

### `PATCH /api/admin/seasons/:id/current`

Set or unset a season as the league's current season.

**Body** `{ "is_current": boolean }`

**Response `200`** Season object (with updated `is_current`).

---

### `DELETE /api/admin/seasons/:id`

Delete a season.

**Response `200`** `{ "message": "Season deleted" }`

---

### `GET /api/admin/seasons/:seasonId/teams`

List teams participating in the season. Falls back to the previous season's roster (tagged `inherited: true`) when no roster is set.

**Response `200`** Array of `{ id, name, code, logo, primary_color, secondary_color, text_color, home_arena, inherited }`

---

### `PUT /api/admin/seasons/:seasonId/teams`

Replace the season's team roster. Also syncs the auto group and updates `start_season_id`/`latest_season_id` on each team.

**Body** `{ "team_ids": ["uuid", ...] }`

**Response `200`** `{ season_id, auto_group_id, teams: [...] }`

---

### `GET /api/admin/seasons/:seasonId/groups`

List groups for a season with versioned team membership (current season override → previous override → league default → auto group).

**Response `200`** Array of `{ id, league_id, parent_id, name, sort_order, is_auto, role, teams: [...], has_season_override, is_inherited }`

---

### `PUT /api/admin/seasons/:seasonId/groups/:groupId/teams`

Set season-specific team list for a group.

**Body** `{ "team_ids": ["uuid", ...] }`

**Response `200`** `{ season_id, group_id, teams: [...] }`

---

### `DELETE /api/admin/seasons/:seasonId/groups/:groupId/teams`

Remove the season override for a group, reverting it to its default team list.

**Response `200`** `{ "message": "Season override removed; group reverts to defaults" }`

---

### `GET /api/admin/seasons/:id/standings`

Calculate standings for regular-season final games. Points awarded per `scoring_system` (`2-1-0` or `3-2-1-0`).

**Response `200`** Array of `{ team_id, team_name, team_code, team_logo, team_primary_color, team_text_color, gp, wins, reg_wins, ot_wins, losses, otl, points, games_remaining }`

---

### `GET /api/admin/seasons/:id/stats`

Aggregate player stats for all final games in a season.

**Response `200`** `{ skaters: [...], goalies: [...] }`

Skater fields: `player_id, first_name, last_name, photo, position, jersey_number, team_id, team_code, team_name, team_logo, team_primary_color, team_text_color, gp, goals, assists, points`

Goalie fields: `player_id, first_name, last_name, photo, jersey_number, team_id, team_code, team_name, team_logo, team_primary_color, team_text_color, gp, shots_against, saves, goals_against, save_pct, shutouts, gaa`

## Players — `/api/admin/players` 🔐

### `POST /api/admin/players/upload`

Upload a player photo. Multipart form field: `photo` (image, max 2 MB).

**Response `200`** `{ "url": "https://..." }`

---

### `GET /api/admin/players`

List players. Query params: `league_id`, `team_id`, `season_id` (combinable).

**Response `200`** Array of player objects. Fields vary by filter:

- No filter: `{ id, first_name, last_name, photo, date_of_birth, birth_city, birth_country, nationality, height_cm, weight_lbs, position, shoots, is_active, created_at }`
- With `league_id` or `team_id`: also includes `jersey_number, team_id, team_name, team_code, team_logo, primary_color, text_color`

---

### `GET /api/admin/players/:id`

Get a single player.

**Response `200`** `{ id, first_name, last_name, photo, date_of_birth, birth_city, birth_country, nationality, height_cm, weight_lbs, position, shoots, is_active, created_at }`

---

### `GET /api/admin/players/:id/stats`

Career stats per season for a player.

**Response `200`** Array of `{ season_id, season_name, jersey_number, gp, goals, assists, points, team_id, team_name, team_logo, primary_color, text_color }`

---

### `POST /api/admin/players`

Create a player.

**Body** `{ first_name*, last_name*, position?, shoots?, date_of_birth?, birth_city?, birth_country?, nationality?, height_cm?, weight_lbs?, is_active? }`

**Response `201`** Player object.

---

### `POST /api/admin/players/bulk`

Create multiple players at once.

**Body** `{ "players": [{ first_name*, last_name*, position*, shoots? }] }`

**Response `201`** `{ "created": [...player objects] }`

---

### `PATCH /api/admin/players/:id`

Update a player (partial).

**Body** `{ first_name?, last_name?, position?, shoots?, date_of_birth?, birth_city?, birth_country?, nationality?, height_cm?, weight_lbs?, is_active? }`

**Response `200`** Player object.

---

### `DELETE /api/admin/players/:id`

Delete a player.

**Response `200`** `{ "message": "Player deleted" }`

---

## Player Teams (Stints) — `/api/admin/player-teams` 🔐

Manages player-to-team associations per season ("stints"). A player can have multiple stints per season (e.g. after a trade).

### `POST /api/admin/player-teams/bulk`

Bulk-add players to a team for a season.

**Body** `{ team_id*, season_id*, players*: [{ player_id*, jersey_number? }] }`

**Response `201`** `{ created: [...stint objects], skipped: N }`

---

### `POST /api/admin/player-teams`

Create a single stint.

**Body** `{ player_id*, team_id*, season_id*, jersey_number?, photo?, start_date?, end_date? }`

**Response `201`** `{ id, player_id, team_id, season_id, jersey_number, photo, start_date, end_date }`

---

### `PATCH /api/admin/player-teams`

Update jersey number or photo on the active (open) stint for a player/team/season. Automatically records jersey number history when the number changes.

**Body** `{ player_id*, team_id*, season_id*, jersey_number?, photo?, effective_date? }`

**Response `200`** `{ id, player_id, team_id, season_id, jersey_number, photo }`

---

### `PATCH /api/admin/player-teams/:id`

Update any field on a specific stint row by UUID.

**Body** `{ team_id?, season_id?, jersey_number?, photo?, start_date?, end_date? }`

**Response `200`** `{ id, player_id, team_id, season_id, jersey_number, photo, start_date, end_date }`

---

### `GET /api/admin/player-teams/history/:playerId`

All stints for a player. Optionally filter by `?season_id=`.

**Response `200`** Array of `{ id, player_id, team_id, season_id, jersey_number, photo, start_date, end_date, created_at, team_name, team_code, team_logo, primary_color, text_color }`

---

### `GET /api/admin/player-teams/history/:playerId/jerseys`

Jersey number history across all stints for a player.

**Response `200`** Array of `{ id, player_teams_id, jersey_number, effective_from }`

---

### `POST /api/admin/player-teams/trade`

Trade a single player: closes their current active stint and opens a new one on the destination team.

**Body** `{ player_id*, season_id*, to_team_id*, trade_date*, jersey_number? }`

**Response `201`** `{ from_team_id, new_stint: { id, player_id, team_id, season_id, jersey_number, start_date, end_date } }`

---

### `POST /api/admin/player-teams/bulk-trade`

Trade multiple players at once.

**Body** `{ players*: [{ player_id*, jersey_number? }], season_id*, to_team_id*, trade_date* }`

**Response `201`** `{ traded: [...new stints], failed: [player_ids with no active stint] }`

---

## Groups — `/api/admin/groups` 🔐

Groups are hierarchical team collections (conferences, divisions) scoped to a league. They support per-season overrides.

### `GET /api/admin/groups`

List all groups for a league with default teams. **Required query param:** `?league_id=`.

**Response `200`** Array of `{ id, league_id, parent_id, name, sort_order, is_auto, role, created_at, teams: [{ id, name, code, logo, primary_color, text_color }] }`

---

### `POST /api/admin/groups`

Create a group.

**Body** `{ league_id*, name*, parent_id?, sort_order?, role?: "conference" | "division" | null }`

**Response `201`** `{ id, league_id, parent_id, name, sort_order, created_at, role }`

---

### `PATCH /api/admin/groups/:id`

Update a group.

**Body** `{ name?, parent_id?, sort_order?, role? }`

**Response `200`** Group object.

---

### `DELETE /api/admin/groups/:id`

Delete a group (cascades to subgroups and memberships).

**Response `200`** `{ "message": "Group deleted" }`

---

### `PUT /api/admin/groups/:id/teams`

Replace the default team list for a group.

**Body** `{ "team_ids": ["uuid", ...] }`

**Response `200`** `{ group_id, teams: [{ id, name, code, logo }] }`

---

## Bracket Rule Sets — `/api/admin/bracket-rule-sets` 🔐

### `GET /api/admin/bracket-rule-sets`

List rule sets for a league. **Required query param:** `?league_id=`.

**Response `200`** Array of `{ id, league_id, name, created_at }`

---

### `GET /api/admin/bracket-rule-sets/:id`

Get a rule set with its slot rules.

**Response `200`** `{ id, league_id, name, created_at, slots: [{ slot_key, rule_type, rank, scope, group_id, pool, choice_ref, matchup_ref }] }`

---

### `POST /api/admin/bracket-rule-sets`

Create a rule set, optionally with initial slots.

**Body** `{ league_id*, name*, slots?: [{ slot_key, rule_type, rank?, scope?, group_id?, pool?, choice_ref?, matchup_ref? }] }`

**Response `201`** Rule set object with slots.

---

### `PATCH /api/admin/bracket-rule-sets/:id`

Rename a rule set.

**Body** `{ "name": "string" }`

**Response `200`** `{ id, league_id, name, created_at }`

---

### `PUT /api/admin/bracket-rule-sets/:id/slots`

Replace all slot rules for a rule set.

**Body** `{ "slots": [{ slot_key, rule_type, rank?, scope?, group_id?, pool?, choice_ref?, matchup_ref? }] }`

**Response `200`** `{ id, slots: [...] }`

---

### `DELETE /api/admin/bracket-rule-sets/:id`

Delete a rule set.

**Response `200`** `{ "message": "Rule set deleted" }`

---

## Games — `/api/admin/games` 🔐

### TeamInfo object (used in game responses)

```json
{ "id", "name", "code", "logo", "primary_color", "secondary_color", "text_color" }
```

### Game object (list)

```json
{
  "id", "season_id", "game_type", "status",
  "scheduled_at", "scheduled_time", "venue",
  "overtime_periods", "shootout",
  "playoff_series_id", "notes", "current_period", "created_at",
  "star_1_id", "star_2_id", "star_3_id",
  "home_team": TeamInfo,
  "away_team": TeamInfo,
  "period_scores": [{ "period", "home_goals", "away_goals" }],
  "period_shots": [{ "period", "home_shots", "away_shots" }]
}
```

### Game object (detail — `GET /:id`)

Extends the list shape with:

```json
{
  "time_start", "time_end", "shootout_first_team_id",
  "season_name", "league_id", "league_name", "best_of_shootout",
  "home_last_five": [...last-5-game summaries],
  "away_last_five": [...last-5-game summaries],
  "previous_meetings": [...meeting summaries]
}
```

---

### `GET /api/admin/games`

List games. Query params (all optional): `season_id`, `team_id`, `game_type`, `status`.

**Response `200`** Array of Game (list) objects.

---

### `POST /api/admin/games`

Create a game.

**Body** `{ season_id*, home_team_id*, away_team_id*, scheduled_at?, scheduled_time?, venue?, game_type?, status?, overtime_periods?, shootout?, playoff_series_id?, notes? }`

**Response `201`** Game (list) object.

---

### `GET /api/admin/games/:id`

Get full game details including last-five records and previous meetings.

**Response `200`** Game (detail) object.

---

### `PATCH /api/admin/games/:id`

Update a game. All fields optional.

**Body** `{ scheduled_at?, scheduled_time?, venue?, game_type?, status?, time_start?, time_end?, overtime_periods?, shootout?, playoff_series_id?, notes?, current_period?, star_1_id?, star_2_id?, star_3_id?, shootout_first_team_id? }`

**Response `200`** Game (list) object.

---

### `DELETE /api/admin/games/:id`

Delete a game. **Response `204`** (no body).

---

### `GET /api/admin/games/playoff-series`

List playoff series. Optional `?season_id=`.

**Response `200`** Array of `{ id, season_id, round, series_letter, home_team_id, away_team_id, games_to_win, home_wins, away_wins, status, winner_team_id, created_at, home_team_name, home_team_code, home_team_logo, away_team_name, away_team_code, away_team_logo }`

---

### `POST /api/admin/games/playoff-series`

Create a playoff series.

**Body** `{ season_id*, round*, home_team_id*, away_team_id*, series_letter?, games_to_win?, status? }`

**Response `201`** Playoff series object (without team name/logo).

---

### `PATCH /api/admin/games/playoff-series/:seriesId`

Update a playoff series.

**Body** `{ home_wins?, away_wins?, status?, winner_team_id?, series_letter?, games_to_win? }`

**Response `200`** Playoff series object.

---

### `DELETE /api/admin/games/playoff-series/:seriesId`

Delete a playoff series. **Response `200`** `{ "message": "Playoff series deleted" }`

---

### `GET /api/admin/games/:id/lineup`

Get starting lineup for both teams. Falls back to the most-recent final game's lineup per team when no lineup is set (tagged `inherited: true`).

**Response `200`** Array of `{ id, game_id, team_id, player_id, position_slot, player_first_name, player_last_name, player_photo, jersey_number, inherited }`

---

### `PUT /api/admin/games/:id/lineup`

Upsert starting lineup for one team. One row per team per game.

**Body** `{ team_id*, slots*: [{ position_slot: "C"|"LW"|"RW"|"D1"|"D2"|"G", player_id }] }`

**Response `200`** Array of saved lineup entries.

---

### `DELETE /api/admin/games/:id/lineup/:teamId`

Clear a team's starting lineup. **Response `204`** (no body).

---

### `GET /api/admin/games/:id/roster`

Get game-day roster for both teams. Falls back to most-recent final game's roster per team (tagged `inherited: true`).

**Response `200`** Array of `{ id, game_id, team_id, player_id, first_name, last_name, photo, position, jersey_number, inherited }`

---

### `POST /api/admin/games/:id/roster`

Add players to game roster.

**Body** `{ team_id*, player_ids*: ["uuid", ...] }`

**Response `201`** Array of roster entries for that team.

---

### `DELETE /api/admin/games/:id/roster/:rosterId`

Remove one player from the roster. **Response `204`** (no body).

---

### `GET /api/admin/games/:id/goals`

List all goals for a game with player details and prior-season cumulative stats.

**Response `200`** Array of `{ id, game_id, team_id, period, goal_type, empty_net, period_time, scorer_id, assist_1_id, assist_2_id, created_at, team_name, team_code, team_logo, team_primary_color, team_text_color, scorer_first_name, scorer_last_name, scorer_photo, scorer_jersey_number, assist_1_first_name, assist_1_last_name, assist_1_photo, assist_1_jersey_number, assist_2_*, scorer_prior_goals, assist_1_prior_assists, assist_2_prior_assists }`

---

### `POST /api/admin/games/:id/goals`

Record a goal.

**Body** `{ team_id*, period*, scorer_id*, goal_type?, empty_net?, period_time?, assist_1_id?, assist_2_id? }`

**Response `201`** Full goal object.

---

### `PUT /api/admin/games/:id/goals/:goalId`

Update an existing goal (full replacement of mutable fields).

**Body** `{ team_id*, period*, scorer_id*, goal_type?, empty_net?, period_time?, assist_1_id?, assist_2_id? }`

**Response `200`** `{ id }`

---

### `DELETE /api/admin/games/:id/goals/:goalId`

Delete a goal. **Response `204`** (no body).

---

### `PATCH /api/admin/games/:id/shots`

Upsert shots on goal for one period.

**Body** `{ period*, home_shots*, away_shots* }`

**Response `200`** `{ "period_shots": [...] }`

---

### `GET /api/admin/games/:id/goalie-stats`

List goalie stats for both teams.

**Response `200`** Array of `{ id, game_id, team_id, goalie_id, shots_against, saves, created_at, goalie_first_name, goalie_last_name, goalie_photo, goalie_jersey_number, team_name, team_code, team_logo, team_primary_color, team_text_color }`

---

### `PUT /api/admin/games/:id/goalie-stats`

Upsert one goalie's stats for this game.

**Body** `{ goalie_id*, team_id*, shots_against*, saves* }`

**Response `200`** Full goalie stats object.

---

### `GET /api/admin/games/:id/shootout-attempts`

List all shootout attempts for a game.

**Response `200`** Array of `{ id, game_id, team_id, shooter_id, scored, attempt_order, created_at, shooter_first_name, shooter_last_name, shooter_photo, shooter_jersey_number, team_name, team_code, team_logo, team_primary_color, team_text_color }`

---

### `POST /api/admin/games/:id/shootout-attempts`

Record a shootout attempt. `attempt_order` is auto-assigned.

**Body** `{ team_id*, shooter_id*, scored? }`

**Response `201`** Full attempt object.

---

### `PUT /api/admin/games/:id/shootout-attempts/:attemptId`

Update a shootout attempt.

**Body** `{ team_id?, shooter_id?, scored? }`

**Response `200`** Full attempt object.

---

### `DELETE /api/admin/games/:id/shootout-attempts/:attemptId`

Delete a shootout attempt. **Response `204`** (no body).

---

## User — `/api/user` 🔒

> All `/api/user/*` routes require authentication (any role). Note: `GET /api/user/games` uses flat team fields (`home_team_name`, `home_team_code`, etc.) instead of nested objects — it has not yet been migrated.

### `GET /api/user/favorites`

List the authenticated user's favourite team IDs.

**Response `200`** `["uuid", ...]`

---

### `POST /api/user/favorites/:teamId`

Add a team to favourites (idempotent).

**Response `201`** `{ user_id, team_id }`

---

### `DELETE /api/user/favorites/:teamId`

Remove a team from favourites.

**Response `200`** `{ "message": "Removed from favorites" }`

---

### `GET /api/user/games`

Read-only game list. Query params (all optional): `season_id`, `league_id`, `team_id`, `game_type`, `status`.

**Response `200`** Array of game objects with flat team fields (`home_team_id`, `home_team_name`, `home_team_code`, `home_team_logo`, `home_team_primary_color`, `home_team_text_color`, and away equivalents), plus `period_scores`, `season_name`, `league_id`, `league_name`.

---

### `GET /api/user/leagues`

List all leagues (for filter picker).

**Response `200`** Array of `{ id, name, code, logo }`

---

### `GET /api/user/seasons`

List seasons, optionally filtered by `?league_id=`.

**Response `200`** Array of `{ id, name }`

---

## Legend

| Symbol | Meaning                                |
| ------ | -------------------------------------- |
| `*`    | Required field                         |
| 🔒     | Requires any valid JWT (`requireAuth`) |
| 🔐     | Requires admin JWT (`requireAdmin`)    |
