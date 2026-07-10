'use strict';

const { planPlayerStintReconciliation, stintRangesOverlap } = require('./playerStintReconciliation');

const SOURCE = 'nhl_puckpedia';

const incoming = (overrides = {}) => ({
  import_key: 'nhl_puckpedia:v1:event:2025-03-07',
  team_id: 'team-b',
  position: 'D',
  acquisition_type: 'trade',
  start_date: '2025-03-07',
  end_date: null,
  ...overrides,
});

const existing = (overrides = {}) => ({
  id: 'stint-1',
  player_id: 'player-1',
  team_id: 'team-b',
  position: 'D',
  acquisition_type: 'trade',
  start_date: '2025-03-07',
  end_date: null,
  import_source: SOURCE,
  import_key: 'nhl_puckpedia:v1:event:2025-03-07',
  import_snapshot: {
    team_id: 'team-b',
    position: 'D',
    acquisition_type: 'trade',
    start_date: '2025-03-07',
    end_date: null,
  },
  ...overrides,
});

const plan = (incomingStints, existingStints = []) =>
  planPlayerStintReconciliation({
    incomingStints,
    existingStints,
    importSource: SOURCE,
  });

describe('planPlayerStintReconciliation', () => {
  it('is idempotent when the imported row still matches its last source snapshot', () => {
    const result = plan([incoming()], [existing()]);

    expect(result.actions).toEqual([
      expect.objectContaining({
        action: 'unchanged',
        import_key: incoming().import_key,
        stint_id: 'stint-1',
        conflicts: [],
      }),
    ]);
    expect(result.summary).toMatchObject({
      unchanged: 1,
      create: 0,
      update: 0,
    });
  });

  it('updates source-owned fields while preserving manually edited fields', () => {
    const result = plan(
      [
        incoming({
          position: 'LD',
          acquisition_type: 'waivers',
          end_date: '2026-03-06',
        }),
      ],
      [existing({ acquisition_type: 'other' })],
    );

    expect(result.actions[0]).toMatchObject({
      action: 'update',
      changes: ['position', 'end_date'],
      conflicts: ['acquisition_type'],
      conflict_type: 'manual_override',
    });
    expect(result.summary).toMatchObject({ update: 1, conflict: 1 });
  });

  it('refreshes provenance without flagging a manual value that now matches the source', () => {
    const result = plan([incoming({ acquisition_type: 'waivers' })], [existing({ acquisition_type: 'waivers' })]);

    expect(result.actions[0]).toMatchObject({
      action: 'update',
      changes: [],
      conflicts: [],
    });
  });

  it('updates corrected source values without changing the immutable import identity', () => {
    const corrected = incoming({ team_id: 'team-c', acquisition_type: 'waivers' });
    const result = plan([corrected], [existing()]);

    expect(result.actions).toEqual([
      expect.objectContaining({
        action: 'update',
        import_key: corrected.import_key,
        stint_id: 'stint-1',
        changes: ['team_id', 'acquisition_type'],
      }),
    ]);
    expect(result.summary).toMatchObject({ update: 1, create: 0, conflict: 0 });
  });

  it('adopts an exactly matching manual row without changing its stint values', () => {
    const manual = existing({
      import_source: null,
      import_key: null,
      import_snapshot: null,
    });
    const result = plan([incoming()], [manual]);

    expect(result.actions[0]).toMatchObject({
      action: 'adopt',
      stint_id: 'stint-1',
      changes: [],
      conflicts: [],
    });
  });

  it('adopts differing manual rows while preserving their non-null overrides', () => {
    const manual = existing({
      import_source: null,
      import_key: null,
      import_snapshot: null,
      acquisition_type: 'draft',
    });
    const result = plan([incoming()], [manual]);

    expect(result.actions[0]).toMatchObject({
      action: 'adopt',
      stint_id: 'stint-1',
      conflicts: ['acquisition_type'],
      conflict_type: 'manual_override',
      changes: [],
    });
  });

  it('does not guess ownership when an imported snapshot is missing', () => {
    const result = plan([incoming()], [existing({ import_snapshot: null })]);

    expect(result.actions[0]).toMatchObject({
      action: 'conflict',
      conflict_type: 'invalid_import_snapshot',
      stint_id: 'stint-1',
    });
  });

  it('keeps returns to the same team distinct when their source keys and dates differ', () => {
    const result = plan([
      incoming({
        import_key: '2020-01-01|draft|-|team-a',
        team_id: 'team-a',
        acquisition_type: 'draft',
        start_date: '2020-01-01',
        end_date: '2022-01-01',
      }),
      incoming({
        import_key: '2022-01-01|trade|team-a|team-b',
        start_date: '2022-01-01',
        end_date: '2024-01-01',
      }),
      incoming({
        import_key: '2024-01-01|trade|team-b|team-a',
        team_id: 'team-a',
        start_date: '2024-01-01',
      }),
    ]);

    expect(result.actions.map((action) => action.action)).toEqual(['create', 'create', 'create']);
    expect(result.actions[0].import_key).not.toBe(result.actions[2].import_key);
  });

  it('reports overlapping history and never plans deletion of source-missing rows', () => {
    const manual = existing({
      id: 'manual-stint',
      team_id: 'team-a',
      start_date: '2024-01-01',
      end_date: null,
      import_source: null,
      import_key: null,
      import_snapshot: null,
    });
    const sourceMissing = existing({
      id: 'source-missing',
      import_key: 'older-source-key',
    });
    const result = plan([incoming()], [manual, sourceMissing]);

    expect(result.actions[0]).toMatchObject({
      action: 'conflict',
      conflict_type: 'overlap',
      conflict_stint_ids: expect.arrayContaining(['manual-stint', 'source-missing']),
    });
    expect(result.actions.some((action) => action.action === 'delete')).toBe(false);
    expect(result.summary.total).toBe(1);
  });
});

describe('stintRangesOverlap', () => {
  it('treats same-day close/open boundaries as touching rather than overlapping', () => {
    expect(
      stintRangesOverlap(
        { start_date: '2024-01-01', end_date: '2025-03-07' },
        { start_date: '2025-03-07', end_date: null },
      ),
    ).toBe(false);
  });
});
