const { ensurePlayerTimelineSchema } = require("./playerTimeline");

describe("ensurePlayerTimelineSchema", () => {
  it("installs temporal affiliations, jersey assignments, projections, and the compatibility view", async () => {
    const sql = jest.fn().mockResolvedValue([]);

    await ensurePlayerTimelineSchema(sql);

    const statements = sql.mock.calls
      .map(([strings]) => strings.join(" "))
      .join("\n");
    expect(statements).toContain("ADD COLUMN IF NOT EXISTS is_prospect");
    expect(statements).toContain(
      "CREATE TABLE IF NOT EXISTS player_jersey_stints",
    );
    expect(statements).toContain(
      "CREATE TABLE IF NOT EXISTS season_projected_lineup_slots",
    );
    expect(statements).toContain("canonical_player_timelines_v1");
    expect(statements).toContain(
      "canonical_player_timelines_v2_exclusive_boundaries",
    );
    expect(statements).toContain(
      "canonical_player_timelines_v3_player_wide_jerseys",
    );
    expect(statements).toContain(
      "ALTER TABLE player_jersey_stints DROP COLUMN team_id",
    );
    expect(statements).toContain("DROP VIEW IF EXISTS player_season_rosters");
    expect(statements).toContain(
      "ON player_jersey_stints (player_id, start_date)",
    );
    expect(statements).toContain(
      "CREATE OR REPLACE VIEW season_participant_teams",
    );
    expect(statements).toContain("FROM season_alignment_group_teams override");
    expect(statements).toContain("JOIN season_participant_teams season_team");
    expect(statements).toContain(
      "CREATE OR REPLACE VIEW player_season_rosters",
    );
    expect(statements).toContain("'derived'::text AS roster_source");
  });

  it("builds season rosters from the team stints alone", async () => {
    const sql = jest.fn().mockResolvedValue([]);

    await ensurePlayerTimelineSchema(sql);

    const view = sql.mock.calls
      .map(([strings]) => strings.join(" "))
      .find((statement) => statement.includes("CREATE OR REPLACE VIEW player_season_rosters"));
    expect(view).toContain("FROM player_team_stints pts");
    expect(view).not.toContain("player_teams");
    expect(view).not.toContain("UNION");
    expect(view).not.toContain("'legacy'::text");
  });

  it("merges duplicate stints and records the jersey worn on each game roster", async () => {
    const sql = jest.fn().mockResolvedValue([]);

    await ensurePlayerTimelineSchema(sql);

    const statements = sql.mock.calls.map(([strings]) => strings.join(" "));
    const merge = statements.find((s) => s.includes("player_team_stints_merge_duplicates_v1"));
    expect(merge).toContain("PARTITION BY player_id, team_id, start_date, end_date");
    expect(merge).toContain("DELETE FROM player_team_stints");

    expect(statements.join("\n")).toMatch(
      /ALTER TABLE game_rosters\s+ADD COLUMN IF NOT EXISTS jersey_number SMALLINT/,
    );
    const backfill = statements.find((s) => s.includes("game_roster_jersey_numbers_v1"));
    // Only finished games are frozen; a scheduled one keeps following the timeline.
    expect(backfill).toContain("g.status = 'final'");
    expect(backfill).toContain("gr.jersey_number IS NULL");
  });

  it("corrects stint boundaries from preseason games, backdating before trimming", async () => {
    const sql = jest.fn().mockResolvedValue([]);

    await ensurePlayerTimelineSchema(sql);

    const fix = sql.mock.calls
      .map(([strings]) => strings.join(" "))
      .find((s) => s.includes("player_team_stints_game_boundaries_v1"));
    // The stored schedule day, not the session's Eastern reading of it.
    expect(fix).toContain("(g.scheduled_at AT TIME ZONE 'UTC')::date");
    expect(fix).toContain("g.game_type = 'preseason'");
    // The trim has to see the corrected starts.
    expect(fix.indexOf("SET start_date = backdate.new_start")).toBeLessThan(
      fix.indexOf("SET end_date = trim.new_end"),
    );
    // A stint wholly inside another is a tangle for a person, not a trim.
    expect(fix).toContain("(b.end_date IS NULL OR b.end_date > a.end_date)");
    // Players whose trade records need a manual look are left alone in both steps.
    expect(fix.match(/6672ce7b-40cc-4ae6-a4e1-d6bfd9671fdb/g)).toHaveLength(2);
  });
});
