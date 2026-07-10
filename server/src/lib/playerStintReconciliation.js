'use strict';

const STINT_FIELDS = ['team_id', 'position', 'acquisition_type', 'start_date', 'end_date'];

const nullable = (value) => (value === undefined || value === '' ? null : value);

const stintSnapshot = (stint) => ({
  team_id: nullable(stint.team_id),
  position: nullable(stint.position),
  acquisition_type: nullable(stint.acquisition_type),
  start_date: nullable(stint.start_date),
  end_date: nullable(stint.end_date),
});

const parseSnapshot = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return stintSnapshot(value);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return stintSnapshot(parsed);
      }
    } catch {
      // Fall back to the current row. This is safe for legacy imported rows
      // because the first reconciliation will treat their current values as
      // the last values written by the importer.
    }
  }
  return null;
};

const sameValue = (left, right) => nullable(left) === nullable(right);

const snapshotsEqual = (left, right) => STINT_FIELDS.every((field) => sameValue(left[field], right[field]));

/**
 * Stint boundaries in this project use the same movement date to close the old
 * team and open the new team. Treat a shared boundary as touching, not as an
 * overlap, so normal trade timelines do not conflict with themselves.
 */
const stintRangesOverlap = (left, right) => {
  const leftStart = nullable(left.start_date);
  const leftEnd = nullable(left.end_date);
  const rightStart = nullable(right.start_date);
  const rightEnd = nullable(right.end_date);

  if (leftEnd && rightStart && leftEnd <= rightStart) return false;
  if (rightEnd && leftStart && rightEnd <= leftStart) return false;
  return true;
};

const conflictAction = (incoming, details = {}) => ({
  action: 'conflict',
  import_key: incoming.import_key,
  stint_id: details.stint_id ?? null,
  incoming,
  changes: [],
  conflicts: details.conflicts ?? [],
  conflict_type: details.conflict_type ?? 'manual_difference',
  conflict_stint_ids: details.conflict_stint_ids ?? [],
  previous_snapshot: details.previous_snapshot ?? null,
});

const planImportedStint = (incoming, existing) => {
  const previousSnapshot = parseSnapshot(existing.import_snapshot);
  if (!previousSnapshot) {
    return conflictAction(incoming, {
      stint_id: existing.id,
      conflict_type: 'invalid_import_snapshot',
      conflict_stint_ids: [existing.id],
    });
  }
  const changes = [];
  const conflicts = [];

  for (const field of STINT_FIELDS) {
    const desiredValue = incoming[field];
    const currentValue = existing[field];
    const previousValue = previousSnapshot[field];

    if (sameValue(currentValue, desiredValue)) continue;
    if (sameValue(currentValue, previousValue)) changes.push(field);
    else conflicts.push(field);
  }

  const sourceSnapshotChanged = !snapshotsEqual(previousSnapshot, incoming);
  if (changes.length > 0 || sourceSnapshotChanged) {
    return {
      action: 'update',
      import_key: incoming.import_key,
      stint_id: existing.id,
      incoming,
      changes,
      conflicts,
      conflict_type: conflicts.length > 0 ? 'manual_override' : null,
      conflict_stint_ids: [],
      previous_snapshot: previousSnapshot,
    };
  }

  if (conflicts.length > 0) {
    return conflictAction(incoming, {
      stint_id: existing.id,
      conflicts,
      conflict_type: 'manual_override',
      previous_snapshot: previousSnapshot,
    });
  }

  return {
    action: 'unchanged',
    import_key: incoming.import_key,
    stint_id: existing.id,
    incoming,
    changes: [],
    conflicts: [],
    conflict_type: null,
    conflict_stint_ids: [],
    previous_snapshot: previousSnapshot,
  };
};

const planManualMatch = (incoming, manualMatches) => {
  if (manualMatches.length > 1) {
    return conflictAction(incoming, {
      conflict_type: 'ambiguous_manual_match',
      conflict_stint_ids: manualMatches.map((stint) => stint.id),
    });
  }

  const existing = manualMatches[0];
  const changes = [];
  const conflicts = [];
  for (const field of STINT_FIELDS) {
    if (sameValue(existing[field], incoming[field])) continue;
    if (nullable(existing[field]) == null && nullable(incoming[field]) != null) changes.push(field);
    else conflicts.push(field);
  }

  return {
    action: 'adopt',
    import_key: incoming.import_key,
    stint_id: existing.id,
    incoming,
    changes,
    conflicts,
    conflict_type: conflicts.length > 0 ? 'manual_override' : null,
    conflict_stint_ids: conflicts.length > 0 ? [existing.id] : [],
    previous_snapshot: stintSnapshot(existing),
  };
};

const summarizeReconciliationActions = (actions) => ({
  total: actions.length,
  create: actions.filter((action) => action.action === 'create').length,
  update: actions.filter((action) => action.action === 'update').length,
  adopt: actions.filter((action) => action.action === 'adopt').length,
  unchanged: actions.filter((action) => action.action === 'unchanged').length,
  conflict: actions.filter((action) => action.action === 'conflict' || action.conflicts.length > 0).length,
});

/**
 * Build a conservative reconciliation plan.
 *
 * Imported rows are matched only by their stable source key. Manual rows may
 * be adopted only when their full persisted values exactly match an incoming
 * team/start-date identity. Anything ambiguous or overlapping is surfaced as
 * a conflict; the planner never schedules a deletion.
 */
const planPlayerStintReconciliation = ({ incomingStints, existingStints, importSource }) => {
  const normalizedIncoming = incomingStints
    .map((stint, originalIndex) => ({
      import_key: stint.import_key,
      ...stintSnapshot(stint),
      originalIndex,
    }))
    .sort(
      (left, right) =>
        (left.start_date ?? '').localeCompare(right.start_date ?? '') || left.originalIndex - right.originalIndex,
    );
  const virtualStints = existingStints.map((stint) => ({ ...stint }));

  const projectAction = (action, existing) => {
    if (action.action === 'create') {
      const created = {
        id: `planned:${action.import_key}`,
        ...action.incoming,
        import_source: importSource,
        import_key: action.import_key,
        import_snapshot: stintSnapshot(action.incoming),
      };
      virtualStints.push(created);
      return;
    }
    if (!existing || !['adopt', 'update'].includes(action.action)) return;
    for (const field of action.changes) existing[field] = action.incoming[field];
    existing.import_source = importSource;
    existing.import_key = action.import_key;
    existing.import_snapshot = stintSnapshot(action.incoming);
  };

  const actions = normalizedIncoming.map((normalizedStint) => {
    const incoming = {
      import_key: normalizedStint.import_key,
      ...stintSnapshot(normalizedStint),
    };
    const importedMatch = virtualStints.find(
      (existing) => existing.import_source === importSource && existing.import_key === incoming.import_key,
    );
    if (importedMatch) {
      const action = planImportedStint(incoming, importedMatch);
      if (
        action.action === 'update' &&
        action.changes.some((field) => ['team_id', 'start_date', 'end_date'].includes(field))
      ) {
        const projected = { ...importedMatch };
        for (const field of action.changes) projected[field] = incoming[field];
        const overlaps = virtualStints.filter(
          (existing) => existing.id !== importedMatch.id && stintRangesOverlap(existing, projected),
        );
        if (overlaps.length > 0) {
          return conflictAction(incoming, {
            stint_id: importedMatch.id,
            conflict_type: 'overlap',
            conflict_stint_ids: overlaps.map((stint) => stint.id),
            previous_snapshot: action.previous_snapshot,
          });
        }
      }
      projectAction(action, importedMatch);
      return action;
    }

    const manualMatches = virtualStints.filter(
      (existing) =>
        existing.import_source == null &&
        sameValue(existing.team_id, incoming.team_id) &&
        sameValue(existing.start_date, incoming.start_date),
    );
    if (manualMatches.length > 0) {
      const action = planManualMatch(incoming, manualMatches);
      const existing = manualMatches.length === 1 ? manualMatches[0] : null;
      if (existing && action.action === 'adopt') {
        const projected = { ...existing };
        for (const field of action.changes) projected[field] = incoming[field];
        const overlaps = virtualStints.filter(
          (stint) => stint.id !== existing.id && stintRangesOverlap(stint, projected),
        );
        if (overlaps.length > 0) {
          return conflictAction(incoming, {
            stint_id: existing.id,
            conflicts: action.conflicts,
            conflict_type: 'overlap',
            conflict_stint_ids: overlaps.map((stint) => stint.id),
          });
        }
      }
      projectAction(action, existing);
      return action;
    }

    const overlappingStints = virtualStints.filter((existing) => stintRangesOverlap(existing, incoming));
    if (overlappingStints.length > 0) {
      return conflictAction(incoming, {
        conflict_type: 'overlap',
        conflict_stint_ids: overlappingStints.map((stint) => stint.id),
      });
    }

    const action = {
      action: 'create',
      import_key: incoming.import_key,
      stint_id: null,
      incoming,
      changes: [...STINT_FIELDS],
      conflicts: [],
      conflict_type: null,
      conflict_stint_ids: [],
      previous_snapshot: null,
    };
    projectAction(action, null);
    return action;
  });

  const incomingKeys = new Set(normalizedIncoming.map((stint) => stint.import_key));
  const projectedConflicts = new Map();
  for (let left = 0; left < virtualStints.length; left += 1) {
    for (let right = left + 1; right < virtualStints.length; right += 1) {
      const leftStint = virtualStints[left];
      const rightStint = virtualStints[right];
      if (!stintRangesOverlap(leftStint, rightStint)) continue;
      if (incomingKeys.has(leftStint.import_key)) {
        const conflicts = projectedConflicts.get(leftStint.import_key) ?? [];
        conflicts.push(rightStint.id);
        projectedConflicts.set(leftStint.import_key, conflicts);
      }
      if (incomingKeys.has(rightStint.import_key)) {
        const conflicts = projectedConflicts.get(rightStint.import_key) ?? [];
        conflicts.push(leftStint.id);
        projectedConflicts.set(rightStint.import_key, conflicts);
      }
    }
  }

  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    const conflictStintIds = projectedConflicts.get(action.import_key);
    if (!conflictStintIds || conflictStintIds.length === 0) continue;
    actions[index] = conflictAction(action.incoming, {
      stint_id: action.stint_id,
      conflicts: action.conflicts,
      conflict_type: 'overlap',
      conflict_stint_ids: [...new Set(conflictStintIds)],
      previous_snapshot: action.previous_snapshot,
    });
  }

  actions.sort((left, right) => {
    const leftIndex = normalizedIncoming.find((stint) => stint.import_key === left.import_key)?.originalIndex ?? 0;
    const rightIndex = normalizedIncoming.find((stint) => stint.import_key === right.import_key)?.originalIndex ?? 0;
    return leftIndex - rightIndex;
  });

  return {
    actions,
    summary: summarizeReconciliationActions(actions),
  };
};

module.exports = {
  STINT_FIELDS,
  planPlayerStintReconciliation,
  stintRangesOverlap,
  stintSnapshot,
  summarizeReconciliationActions,
};
