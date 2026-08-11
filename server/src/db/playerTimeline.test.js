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
});
