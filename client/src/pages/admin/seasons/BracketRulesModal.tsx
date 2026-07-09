import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import BorderedFieldset from '@jerecocc/tracker-ui/components/BorderedFieldset/BorderedFieldset';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import InfoTooltip from '@jerecocc/tracker-ui/components/InfoTooltip/InfoTooltip';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import Select from '@jerecocc/tracker-ui/components/Select/Select';
import ToggleButton from '@jerecocc/tracker-ui/components/ToggleButton/ToggleButton';
/** Minimal group shape used for scope filtering — satisfied by both SeasonGroupRecord and GroupRecord. */
export interface GroupEntry {
  id: string;
  name: string;
  role: 'conference' | 'division' | null;
}
import useBracketRuleSets, {
  type BracketRuleSet,
  type BracketSlotRule,
  type SaveSlotsPayload,
} from '@/hooks/useBracketRuleSets';
import usePlayoffQualificationFormats from '@/hooks/usePlayoffQualificationFormats';
import styles from './SeasonPlayoffsTab.module.scss';

// ── Constants ─────────────────────────────────────────────────────────────────

export const SLOT_SCOPE_OPTIONS = [
  { value: 'league', label: 'Whole League' },
  { value: 'specific_conference', label: 'Specific Conference' },
  { value: 'specific_division', label: 'Specific Division' },
];

export const SPECIFIC_SCOPES = new Set(['specific_conference', 'specific_division']);

const RANK_OPTIONS = Array.from({ length: 16 }, (_, i) => ({
  value: String(i + 1),
  label: `#${i + 1}`,
}));

const ROUND1_RULE_TYPE_OPTIONS = [
  { value: 'none', label: 'No rule' },
  { value: 'seed', label: 'Position' },
  { value: 'choice', label: 'Choice Pick' },
  { value: 'unchosen', label: 'Unchosen' },
];

const LATER_RULE_TYPE_OPTIONS = [
  { value: 'none', label: 'No rule' },
  { value: 'winner', label: 'Winner of…' },
  { value: 'seed', label: 'Position' },
  { value: 'choice', label: 'Choice Pick' },
  { value: 'unchosen', label: 'Unchosen' },
];

const BRACKET_SIZE_OPTIONS = [
  { value: '4', label: '4 teams' },
  { value: '8', label: '8 teams' },
  { value: '16', label: '16 teams' },
  { value: '32', label: '32 teams' },
];

const AUTO_ADVANCE_TOOLTIP = 'Rounds 2 and beyond automatically advance winners in bracket order.';
const NO_QUALIFICATION_FORMAT_VALUE = '__none__';

// ── Bracket structure ─────────────────────────────────────────────────────────

export interface BracketRound {
  round: number;
  label: string;
  series: number;
}

export interface BracketStructure {
  totalTeams: number;
  bracketSize: number;
  byes: number;
  rounds: BracketRound[];
}

export const getRoundLabel = (
  round: number,
  totalRounds: number,
  roundNames?: Record<string, string> | null,
): string => {
  if (roundNames?.[round]) return roundNames[round];
  if (round === totalRounds) return 'Final';
  return `Round ${round}`;
};

export const getMatchupLabel = (
  matchupKey: string,
  matchupNames?: Record<string, string> | null,
): string | null => {
  const label = matchupNames?.[matchupKey]?.trim();
  return label || null;
};

export const deriveBracketStructureFromSize = (totalTeams: number): BracketStructure => {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(totalTeams, 2))));
  const numRounds = Math.log2(bracketSize);
  return {
    totalTeams,
    bracketSize,
    byes: bracketSize - totalTeams,
    rounds: Array.from({ length: numRounds }, (_, i) => ({
      round: i + 1,
      label: getRoundLabel(i + 1, numRounds),
      series: bracketSize / Math.pow(2, i + 1),
    })),
  };
};

const inferBracketSizeFromSlots = (slots: BracketSlotRule[]): number => {
  const round1Matchups = new Set(
    slots
      .map((s) => s.slot_key.match(/^r1m(\d+)/)?.[1])
      .filter((v): v is string => v !== undefined),
  ).size;
  return Math.max(4, round1Matchups * 2);
};

// ── Form types & helpers ──────────────────────────────────────────────────────

interface SlotFormItem {
  key: string;
  type: string;
  rank: string;
  scope: string;
  groupId: string;
  pool: Array<{ rank: string; scope: string; groupId: string }>;
  choiceRef: string;
  matchupRef: string;
}

interface BracketRulesFormValues {
  name: string;
  qualificationFormatId: string;
  slots: SlotFormItem[];
  /** Custom display name per round, keyed by round number string. Empty string = use default. */
  roundNames: Record<string, string>;
  /** Custom display name per matchup, keyed by matchup slot like r3m0. Empty string = use round label. */
  matchupNames: Record<string, string>;
}

export const makeSlotKey = (round: number, matchup: number, pos: 'team1' | 'team2') =>
  `r${round}m${matchup}${pos}`;

export const slotKeyToLabel = (key: string, rounds: BracketRound[]): string => {
  const m = key.match(/^r(\d+)m(\d+)(team1|team2)$/);
  if (!m) return key;
  const roundInfo = rounds.find((r) => r.round === Number(m[1]));
  return `${roundInfo?.label ?? `Round ${m[1]}`} · Matchup ${Number(m[2]) + 1} · Team ${m[3] === 'team1' ? '1' : '2'}`;
};

const blankSlotItem = (key: string): SlotFormItem => ({
  key,
  type: 'none',
  rank: '1',
  scope: 'league',
  groupId: '',
  pool: [],
  choiceRef: '',
  matchupRef: '',
});

// Only Round 1 slots are user-configurable; later rounds always advance winners.
const buildDefaultSlots = (structure: BracketStructure): SlotFormItem[] => {
  const round1 = structure.rounds.find((r) => r.round === 1);
  if (!round1) return [];
  const slots: SlotFormItem[] = [];
  for (let mi = 0; mi < round1.series; mi++) {
    slots.push(blankSlotItem(makeSlotKey(1, mi, 'team1')));
    slots.push(blankSlotItem(makeSlotKey(1, mi, 'team2')));
  }
  return slots;
};

/** Maps a canonical team1/team2 key to its legacy away/home equivalent for backward compat. */
const legacySlotKey = (key: string): string =>
  key.replace(/team1$/, 'away').replace(/team2$/, 'home');

const mergeApiSlots = (
  structure: BracketStructure,
  apiSlots: BracketSlotRule[],
): SlotFormItem[] => {
  const apiMap: Record<string, BracketSlotRule> = {};
  for (const s of apiSlots) apiMap[s.slot_key] = s;
  return buildDefaultSlots(structure).map((blank) => {
    // Try canonical key first, then the old away/home format for backward compat
    const api = apiMap[blank.key] ?? apiMap[legacySlotKey(blank.key)];
    if (!api) return blank;
    return {
      key: blank.key,
      type: api.rule_type,
      rank: String(api.rank ?? 1),
      scope: api.scope ?? 'league',
      groupId: api.group_id ?? '',
      pool: (api.pool ?? []).map((p) => ({
        rank: String(p.rank),
        scope: p.scope,
        groupId: p.group_id ?? '',
      })),
      choiceRef: api.choice_ref ?? '',
      matchupRef: api.matchup_ref ?? '',
    };
  });
};

const serializeSlots = (slots: SlotFormItem[]): SaveSlotsPayload[] =>
  slots
    .filter((s) => s.type !== 'none')
    .map((s) => ({
      slot_key: s.key,
      rule_type: s.type,
      rank: s.type === 'seed' ? parseInt(s.rank, 10) : null,
      scope: s.type === 'seed' ? s.scope : null,
      group_id: s.type === 'seed' && SPECIFIC_SCOPES.has(s.scope) ? s.groupId || null : null,
      pool:
        s.type === 'choice'
          ? s.pool.map((p) => ({
              rank: parseInt(p.rank, 10),
              scope: p.scope,
              group_id: SPECIFIC_SCOPES.has(p.scope) ? p.groupId || null : null,
            }))
          : [],
      choice_ref: s.type === 'unchosen' ? s.choiceRef : null,
      matchup_ref: s.type === 'winner' ? s.matchupRef : null,
    }));

const cleanLabelMap = (
  labels: Record<string, string> | undefined,
): Record<string, string> | null => {
  const cleaned = Object.fromEntries(
    Object.entries(labels ?? {})
      .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
      .map(([key, value]) => [key, value.trim()]),
  );
  return Object.keys(cleaned).length > 0 ? cleaned : null;
};

const hasRoundMatchupLabels = (
  roundInfo: BracketRound,
  matchupNames?: Record<string, string> | null,
): boolean =>
  Array.from({ length: roundInfo.series }, (_, mi) => `r${roundInfo.round}m${mi}`).some(
    (key) => !!matchupNames?.[key]?.trim(),
  );

const getExpandedMatchupLabelRounds = (
  structure: BracketStructure,
  matchupNames?: Record<string, string> | null,
): Record<number, boolean> =>
  Object.fromEntries(
    structure.rounds
      .filter((roundInfo) => roundInfo.series > 1 && hasRoundMatchupLabels(roundInfo, matchupNames))
      .map((roundInfo) => [roundInfo.round, true]),
  ) as Record<number, boolean>;

/**
 * Generates winner-advancement slots for every round after Round 1.
 * Round N, Matchup M pairs the winners of Round (N-1) Matchup 2M and 2M+1.
 */
const buildAutoWinnerSlots = (structure: BracketStructure): SaveSlotsPayload[] => {
  const slots: SaveSlotsPayload[] = [];
  for (const r of structure.rounds) {
    if (r.round === 1) continue;
    for (let mi = 0; mi < r.series; mi++) {
      slots.push({
        slot_key: makeSlotKey(r.round, mi, 'team1'),
        rule_type: 'winner',
        matchup_ref: `r${r.round - 1}m${mi * 2}`,
      });
      slots.push({
        slot_key: makeSlotKey(r.round, mi, 'team2'),
        rule_type: 'winner',
        matchup_ref: `r${r.round - 1}m${mi * 2 + 1}`,
      });
    }
  }
  return slots;
};

// ── Pool Editor ───────────────────────────────────────────────────────────────

interface PoolEditorProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  slotIndex: number;
  groups: GroupEntry[];
}

const PoolEditor = ({ control, slotIndex, groups }: PoolEditorProps) => {
  const { fields, append, remove } = useFieldArray({ control, name: `slots.${slotIndex}.pool` });
  const poolScopes = useWatch({ control, name: `slots.${slotIndex}.pool` }) as
    | Array<{ scope: string }>
    | undefined;

  return (
    <div className={styles.poolEditor}>
      {fields.map((field, i) => {
        const scope = poolScopes?.[i]?.scope ?? 'league';
        const needsGroup = SPECIFIC_SCOPES.has(scope);
        const groupRole = scope === 'specific_conference' ? 'conference' : 'division';
        const groupOptions = groups
          .filter((g) => g.role === groupRole)
          .map((g) => ({ value: g.id, label: g.name }));
        return (
          <div
            key={field.id}
            className={styles.poolSeedRow}
          >
            <div className={styles.poolSeedRank}>
              <Field
                type="select"
                control={control}
                name={`slots.${slotIndex}.pool.${i}.rank`}
                options={RANK_OPTIONS}
              />
            </div>
            <div className={styles.poolSeedScope}>
              <Field
                type="select"
                control={control}
                name={`slots.${slotIndex}.pool.${i}.scope`}
                options={SLOT_SCOPE_OPTIONS}
              />
            </div>
            {needsGroup && (
              <div className={styles.poolSeedScope}>
                <Field
                  type="select"
                  control={control}
                  name={`slots.${slotIndex}.pool.${i}.groupId`}
                  options={groupOptions}
                  placeholder="Select…"
                />
              </div>
            )}
            <Button
              type="button"
              variant="outlined"
              intent="danger"
              icon="delete"
              iconHeight="field"
              tooltip="Remove position"
              aria-label="Remove position"
              onClick={() => remove(i)}
            />
          </div>
        );
      })}
      <Button
        type="button"
        variant="outlined"
        intent="neutral"
        icon="add"
        onClick={() => append({ rank: '1', scope: 'league', groupId: '' })}
      >
        Add position
      </Button>
    </div>
  );
};

// ── Single Slot Editor ────────────────────────────────────────────────────────

interface SingleSlotEditorProps {
  label: string;
  slotIndex: number;
  round: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: any;
  groups: GroupEntry[];
  choiceSlotOptions: Array<{ value: string; label: string }>;
  prevRoundMatchupOptions: Array<{ value: string; label: string }>;
}

const SingleSlotEditor = ({
  label,
  slotIndex,
  round,
  control,
  setValue,
  groups,
  choiceSlotOptions,
  prevRoundMatchupOptions,
}: SingleSlotEditorProps) => {
  const watchedRuleType = useWatch({ control, name: `slots.${slotIndex}.type` }) as
    | string
    | undefined;
  const watchedScope = useWatch({ control, name: `slots.${slotIndex}.scope` }) as
    | string
    | undefined;
  const ruleType = watchedRuleType ?? 'none';
  const scope = watchedScope ?? 'league';

  const ruleTypeOptions = round === 1 ? ROUND1_RULE_TYPE_OPTIONS : LATER_RULE_TYPE_OPTIONS;
  const needsGroup = ruleType === 'seed' && SPECIFIC_SCOPES.has(scope);
  const groupRole = scope === 'specific_conference' ? 'conference' : 'division';
  const groupOptions = groups
    .filter((g) => g.role === groupRole)
    .map((g) => ({ value: g.id, label: g.name }));

  const handleTypeChange = (val: string | null) => {
    setValue(`slots.${slotIndex}.rank`, '1');
    setValue(`slots.${slotIndex}.scope`, 'league');
    setValue(`slots.${slotIndex}.groupId`, '');
    setValue(`slots.${slotIndex}.pool`, []);
    setValue(`slots.${slotIndex}.choiceRef`, '');
    setValue(`slots.${slotIndex}.matchupRef`, '');
    if (val) setValue(`slots.${slotIndex}.type`, val);
  };

  const handleScopeChange = (val: string | null) => {
    setValue(`slots.${slotIndex}.groupId`, '');
    if (val) setValue(`slots.${slotIndex}.scope`, val);
  };

  return (
    <div className={styles.bracketRulesSlotRow}>
      <span className={styles.bracketRulesSlotLabel}>{label}</span>
      <div className={styles.bracketRulesSlotFieldRows}>
        <div className={styles.slotTypeField}>
          <Field
            type="select"
            control={control}
            name={`slots.${slotIndex}.type`}
            options={ruleTypeOptions}
            onChange={handleTypeChange}
          />
        </div>
        {ruleType !== 'none' && (
          <div className={styles.bracketRulesSlotFields}>
            {ruleType === 'winner' && (
              <div className={styles.slotScopeField}>
                <Field
                  type="select"
                  control={control}
                  name={`slots.${slotIndex}.matchupRef`}
                  options={prevRoundMatchupOptions}
                  placeholder="Select matchup..."
                />
              </div>
            )}

            {ruleType === 'seed' && (
              <>
                <div className={styles.slotRankField}>
                  <Field
                    type="select"
                    control={control}
                    name={`slots.${slotIndex}.rank`}
                    options={RANK_OPTIONS}
                  />
                </div>
                <div className={styles.slotScopeField}>
                  <Field
                    type="select"
                    control={control}
                    name={`slots.${slotIndex}.scope`}
                    options={SLOT_SCOPE_OPTIONS}
                    onChange={handleScopeChange}
                  />
                </div>
              </>
            )}

            {ruleType === 'choice' && (
              <PoolEditor
                control={control}
                slotIndex={slotIndex}
                groups={groups}
              />
            )}

            {ruleType === 'unchosen' && (
              <div className={styles.slotScopeField}>
                <Field
                  type="select"
                  control={control}
                  name={`slots.${slotIndex}.choiceRef`}
                  options={choiceSlotOptions}
                  placeholder="Select choice slot..."
                />
              </div>
            )}
          </div>
        )}
        {ruleType === 'seed' && needsGroup && (
          <div className={styles.bracketRulesSlotGroupField}>
            <Field
              type="select"
              control={control}
              name={`slots.${slotIndex}.groupId`}
              options={groupOptions}
              placeholder="Select..."
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ── Bracket Rules Modal ───────────────────────────────────────────────────────

export interface BracketRulesModalProps {
  open: boolean;
  leagueId: string;
  /** ID of an existing rule set to edit. Null = create new. */
  ruleSetId?: string | null;
  /** When provided (season context), slots are derived from it. When absent, shows a bracket-size selector. */
  bracketStructure?: BracketStructure | null;
  /** Groups available for conference/division-scoped rules. */
  groups?: GroupEntry[];
  /** Called after a successful save with the persisted rule set ID. */
  onSave?: (ruleSetId: string) => void;
  onClose: () => void;
}

const BracketRulesModal = ({
  open,
  leagueId,
  ruleSetId = null,
  bracketStructure: externalStructure = null,
  groups = [],
  onSave,
  onClose,
}: BracketRulesModalProps) => {
  const { fetchRuleSet, createRuleSet, updateSlots } = useBracketRuleSets(leagueId);
  const { formats: qualificationFormats, loading: qualificationFormatsLoading } =
    usePlayoffQualificationFormats(leagueId);
  const qualificationFormatOptions = useMemo(
    () => [
      { value: NO_QUALIFICATION_FORMAT_VALUE, label: 'No qualification format' },
      ...qualificationFormats.map((format) => ({ value: format.id, label: format.name })),
    ],
    [qualificationFormats],
  );

  // When no external structure is provided (league context), the user picks a size.
  const [selectedSize, setSelectedSize] = useState<number>(8);

  // Fetched rule set data (null = create mode or loading)
  const [loadedRuleSet, setLoadedRuleSet] = useState<BracketRuleSet | null>(null);
  const [expandedMatchupLabelRounds, setExpandedMatchupLabelRounds] = useState<
    Record<number, boolean>
  >({});

  const effectiveStructure = useMemo(
    () => externalStructure ?? deriveBracketStructureFromSize(selectedSize),
    [externalStructure, selectedSize],
  );

  const {
    control,
    setValue,
    reset,
    handleSubmit,
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<BracketRulesFormValues>({
    defaultValues: {
      name: '',
      qualificationFormatId: NO_QUALIFICATION_FORMAT_VALUE,
      slots: [],
      roundNames: {},
      matchupNames: {},
    },
    mode: 'onChange',
  });

  // Effect 1: Fetch rule set data when modal opens or ruleSetId changes.
  // Separating the fetch from the form reset avoids a race where setSelectedSize and
  // reset() compete for the same React render cycle.
  useEffect(() => {
    if (!open) return;
    if (ruleSetId) {
      // Clear stale data immediately so Effect 2 doesn't flash old values
      setLoadedRuleSet(null);
      fetchRuleSet(ruleSetId).then((ruleSet) => {
        if (ruleSet) {
          // Infer size first so it's committed in the same batch as setLoadedRuleSet
          if (!externalStructure) {
            setSelectedSize(inferBracketSizeFromSlots(ruleSet.slots));
          }
          setLoadedRuleSet(ruleSet);
        }
      });
    } else {
      setLoadedRuleSet(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ruleSetId]);

  // Effect 2: Reset the form once the loaded data (and selectedSize) are stable.
  // Both setSelectedSize and setLoadedRuleSet are called in the same .then() callback,
  // so React 18 batches them into one render. This effect fires once with both updated,
  // ensuring the correct structure is used when building the slot list.
  useEffect(() => {
    if (!open) return;
    if (loadedRuleSet) {
      const structure = externalStructure ?? deriveBracketStructureFromSize(selectedSize);
      reset({
        name: loadedRuleSet.name ?? '',
        qualificationFormatId:
          loadedRuleSet.qualification_format_id ?? NO_QUALIFICATION_FORMAT_VALUE,
        slots: mergeApiSlots(structure, loadedRuleSet.slots),
        roundNames: loadedRuleSet.round_names ?? {},
        matchupNames: loadedRuleSet.matchup_names ?? {},
      });
      setExpandedMatchupLabelRounds(
        getExpandedMatchupLabelRounds(structure, loadedRuleSet.matchup_names),
      );
    } else if (!ruleSetId) {
      // Create mode: reset to empty defaults
      reset({
        name: '',
        qualificationFormatId: NO_QUALIFICATION_FORMAT_VALUE,
        slots: buildDefaultSlots(effectiveStructure),
        roundNames: {},
        matchupNames: {},
      });
      setExpandedMatchupLabelRounds({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadedRuleSet]);

  // Effect 3: Rebuild blank slots when bracket size changes (create mode only).
  // Preserves any name the user has already typed via the functional reset form.
  useEffect(() => {
    if (!open || externalStructure || ruleSetId) return;
    reset((prev) => ({
      ...prev,
      slots: buildDefaultSlots(deriveBracketStructureFromSize(selectedSize)),
    }));
    setExpandedMatchupLabelRounds({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSize]);

  // Build a lookup: slot key → flat index in the slots array
  const slotIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    let idx = 0;
    for (const roundInfo of effectiveStructure.rounds) {
      for (let mi = 0; mi < roundInfo.series; mi++) {
        map[makeSlotKey(roundInfo.round, mi, 'team1')] = idx++;
        map[makeSlotKey(roundInfo.round, mi, 'team2')] = idx++;
      }
    }
    return map;
  }, [effectiveStructure]);

  const allSlots = useWatch({ control, name: 'slots' }) as SlotFormItem[];
  const watchedMatchupNames = useWatch({ control, name: 'matchupNames' }) as
    | Record<string, string>
    | undefined;
  const choiceSlotOptions = useMemo(
    () =>
      (allSlots ?? [])
        .filter((s) => s.type === 'choice')
        .map((s) => ({
          value: s.key,
          label: slotKeyToLabel(s.key, effectiveStructure.rounds),
        })),
    [allSlots, effectiveStructure.rounds],
  );

  const onSubmit = handleSubmit(async ({
    name,
    qualificationFormatId,
    slots,
    roundNames,
    matchupNames,
  }) => {
    const payload = [...serializeSlots(slots), ...buildAutoWinnerSlots(effectiveStructure)];
    // roundNames arrives as a sparse array (numeric-keyed paths → RHF array treatment),
    // so index 0 may be undefined. Guard against that before calling .trim().
    const roundNamesPayload = cleanLabelMap(roundNames);
    const matchupNamesPayload = cleanLabelMap(matchupNames);
    const qualificationFormatIdPayload =
      qualificationFormatId === NO_QUALIFICATION_FORMAT_VALUE ? null : qualificationFormatId;
    let savedId = ruleSetId;
    if (ruleSetId) {
      await updateSlots(
        ruleSetId,
        name || 'Bracket Rules',
        payload,
        roundNamesPayload,
        matchupNamesPayload,
        qualificationFormatIdPayload,
      );
    } else {
      const created = await createRuleSet(
        name || 'Bracket Rules',
        payload,
        roundNamesPayload,
        matchupNamesPayload,
        qualificationFormatIdPayload,
      );
      if (!created) return;
      savedId = created.id;
    }
    if (savedId) onSave?.(savedId);
    onClose();
  });

  const actionLabel = ruleSetId ? 'Edit Rule Set' : 'Create Rule Set';
  const confirmActionLabel = ruleSetId ? 'Save Changes' : actionLabel;

  return (
    <Modal
      open={open}
      title={actionLabel}
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving...' : confirmActionLabel}
      confirmIcon={ruleSetId ? 'save' : undefined}
      onConfirm={onSubmit}
      confirmDisabled={isSubmitting || !isDirty || !isValid}
      busy={isSubmitting}
    >
      <div className={styles.bracketRulesStack}>
        <Field
          label="Rule Set Name"
          control={control}
          name="name"
          placeholder="e.g. PWHL 2025 Bracket Rules"
          disabled={isSubmitting}
        />
        {/* ── Round Labels (optional) ── */}
        <Field
          type="select"
          label="Qualification Format"
          control={control}
          name="qualificationFormatId"
          options={qualificationFormatOptions}
          placeholder={qualificationFormatsLoading ? 'Loading formats...' : 'Select a format...'}
          disabled={isSubmitting || qualificationFormatsLoading}
        />
        {effectiveStructure.rounds.map((r) => {
          const defaultLabel = getRoundLabel(r.round, effectiveStructure.rounds.length);
          const matchupLabelsOpen = !!expandedMatchupLabelRounds[r.round];
          const hasCustomMatchupLabels = hasRoundMatchupLabels(r, watchedMatchupNames);
          return (
            <div
              key={r.round}
              className={styles.bracketRulesLabelGroup}
            >
              <div className={styles.bracketRulesLabelControl}>
                <Field
                  type="text"
                  label={`${defaultLabel} Label`}
                  placeholder={`e.g. ${defaultLabel}`}
                  control={control}
                  name={`roundNames.${r.round}`}
                  disabled={isSubmitting}
                />
                {r.series > 1 && (
                  <ToggleButton
                    active={matchupLabelsOpen}
                    icon="account_tree"
                    iconHeight="field"
                    activeTooltip="Hide matchup labels"
                    inactiveTooltip={
                      hasCustomMatchupLabels ? 'Edit matchup labels' : 'Add matchup labels'
                    }
                    className={styles.bracketRulesMatchupToggle}
                    disabled={isSubmitting}
                    onClick={() =>
                      setExpandedMatchupLabelRounds((prev) => ({
                        ...prev,
                        [r.round]: !prev[r.round],
                      }))
                    }
                  />
                )}
              </div>
              {r.series > 1 && (
                <div
                  className={[
                    styles.bracketRulesMatchupLabelRegion,
                    matchupLabelsOpen ? styles.bracketRulesMatchupLabelRegionOpen : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-hidden={!matchupLabelsOpen}
                  inert={!matchupLabelsOpen}
                >
                  <div className={styles.bracketRulesMatchupLabelFields}>
                    {Array.from({ length: r.series }, (_, mi) => {
                      const matchupKey = `r${r.round}m${mi}`;
                      return (
                        <Field
                          key={matchupKey}
                          type="text"
                          label={`Matchup ${mi + 1} Label`}
                          placeholder={`e.g. ${defaultLabel}`}
                          control={control}
                          name={`matchupNames.${matchupKey}`}
                          disabled={isSubmitting}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!externalStructure && (
          <label className={styles.bracketSizeLabel}>
            <span>Bracket Size</span>
            <Select
              value={String(selectedSize)}
              options={BRACKET_SIZE_OPTIONS}
              onChange={(v) => setSelectedSize(Number(v))}
              disabled={isSubmitting || !!ruleSetId}
            />
          </label>
        )}
        {(() => {
          const round1 = effectiveStructure.rounds.find((r) => r.round === 1);
          if (!round1) return null;
          return (
            <div className={styles.bracketRulesRound}>
              <div className={styles.bracketRulesRoundLabel}>
                <span>{round1.label}</span>
                <InfoTooltip
                  text={AUTO_ADVANCE_TOOLTIP}
                  size="0.9rem"
                />
              </div>
              <div className={styles.bracketRulesMatchups}>
                {Array.from({ length: round1.series }, (_, mi) => (
                  <BorderedFieldset
                    key={mi}
                    className={styles.bracketRulesMatchup}
                  >
                    <legend className={styles.bracketRulesMatchupLabel}>Matchup {mi + 1}</legend>
                    <SingleSlotEditor
                      label="Team 1"
                      slotIndex={slotIndexMap[makeSlotKey(1, mi, 'team1')] ?? 0}
                      round={1}
                      control={control}
                      setValue={setValue}
                      groups={groups}
                      choiceSlotOptions={choiceSlotOptions}
                      prevRoundMatchupOptions={[]}
                    />
                    <SingleSlotEditor
                      label="Team 2"
                      slotIndex={slotIndexMap[makeSlotKey(1, mi, 'team2')] ?? 0}
                      round={1}
                      control={control}
                      setValue={setValue}
                      groups={groups}
                      choiceSlotOptions={choiceSlotOptions}
                      prevRoundMatchupOptions={[]}
                    />
                  </BorderedFieldset>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </Modal>
  );
};

export default BracketRulesModal;
