import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import Button from '@/components/Button/Button';
import Field from '@/components/Field/Field';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import Select from '@/components/Select/Select';
/** Minimal group shape used for scope filtering — satisfied by both SeasonGroupRecord and GroupRecord. */
export interface GroupEntry {
  id: string;
  name: string;
  role: 'conference' | 'division' | null;
}
import useBracketRuleSets, {
  type BracketSlotRule,
  type SaveSlotsPayload,
} from '@/hooks/useBracketRuleSets';
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

export const getRoundLabel = (round: number, totalRounds: number): string => {
  if (round === totalRounds) return 'Final';
  if (round === 1) return 'First Round';
  if (round === totalRounds - 1) return 'Conference Finals';
  if (round === totalRounds - 2) return 'Second Round';
  return `Round ${round}`;
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
  slots: SlotFormItem[];
}

export const makeSlotKey = (round: number, matchup: number, pos: 'away' | 'home') =>
  `r${round}m${matchup}${pos}`;

export const slotKeyToLabel = (key: string, rounds: BracketRound[]): string => {
  const m = key.match(/^r(\d+)m(\d+)(away|home)$/);
  if (!m) return key;
  const roundInfo = rounds.find((r) => r.round === Number(m[1]));
  return `${roundInfo?.label ?? `Round ${m[1]}`} · Matchup ${Number(m[2]) + 1} · Slot ${m[3] === 'away' ? '1' : '2'}`;
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
    slots.push(blankSlotItem(makeSlotKey(1, mi, 'away')));
    slots.push(blankSlotItem(makeSlotKey(1, mi, 'home')));
  }
  return slots;
};

const mergeApiSlots = (
  structure: BracketStructure,
  apiSlots: BracketSlotRule[],
): SlotFormItem[] => {
  const apiMap: Record<string, BracketSlotRule> = {};
  for (const s of apiSlots) apiMap[s.slot_key] = s;
  return buildDefaultSlots(structure).map((blank) => {
    const api = apiMap[blank.key];
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
        slot_key: makeSlotKey(r.round, mi, 'away'),
        rule_type: 'winner',
        matchup_ref: `r${r.round - 1}m${mi * 2}`,
      });
      slots.push({
        slot_key: makeSlotKey(r.round, mi, 'home'),
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
            <button
              type="button"
              className={styles.poolSeedRemove}
              onClick={() => remove(i)}
              aria-label="Remove position"
            >
              <Icon
                name="delete"
                size="1em"
              />
            </button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        intent="neutral"
        icon="add"
        size="sm"
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
  const ruleType = useWatch({ control, name: `slots.${slotIndex}.type` }) as string;
  const scope = useWatch({ control, name: `slots.${slotIndex}.scope` }) as string;

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
      <div className={styles.bracketRulesSlotFields}>
        <div className={styles.slotTypeField}>
          <Field
            type="select"
            control={control}
            name={`slots.${slotIndex}.type`}
            options={ruleTypeOptions}
            onChange={handleTypeChange}
          />
        </div>

        {ruleType === 'winner' && (
          <div className={styles.slotScopeField}>
            <Field
              type="select"
              control={control}
              name={`slots.${slotIndex}.matchupRef`}
              options={prevRoundMatchupOptions}
              placeholder="Select matchup…"
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
            {needsGroup && (
              <div className={styles.slotScopeField}>
                <Field
                  type="select"
                  control={control}
                  name={`slots.${slotIndex}.groupId`}
                  options={groupOptions}
                  placeholder="Select…"
                />
              </div>
            )}
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
              placeholder="Select choice slot…"
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

  // When no external structure is provided (league context), the user picks a size.
  const [selectedSize, setSelectedSize] = useState<number>(8);

  const effectiveStructure = useMemo(
    () => externalStructure ?? deriveBracketStructureFromSize(selectedSize),
    [externalStructure, selectedSize],
  );

  const {
    control,
    setValue,
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<BracketRulesFormValues>({ defaultValues: { name: '', slots: [] } });

  // Load existing rules (or blank defaults) whenever the modal opens
  useEffect(() => {
    if (!open) return;
    if (ruleSetId) {
      fetchRuleSet(ruleSetId).then((ruleSet) => {
        if (ruleSet) {
          // Infer size from existing slots when no external structure
          if (!externalStructure) {
            const inferred = inferBracketSizeFromSlots(ruleSet.slots);
            setSelectedSize(inferred);
            const structure = deriveBracketStructureFromSize(inferred);
            reset({ name: ruleSet.name ?? '', slots: mergeApiSlots(structure, ruleSet.slots) });
          } else {
            reset({
              name: ruleSet.name ?? '',
              slots: mergeApiSlots(externalStructure, ruleSet.slots),
            });
          }
        }
      });
    } else {
      reset({ name: '', slots: buildDefaultSlots(effectiveStructure) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ruleSetId]);

  // Rebuild blank slots whenever size changes (league context only, no existing rule set being edited)
  useEffect(() => {
    if (!open || externalStructure || ruleSetId) return;
    reset((prev) => ({
      ...prev,
      slots: buildDefaultSlots(deriveBracketStructureFromSize(selectedSize)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSize]);

  // Build a lookup: slot key → flat index in the slots array
  const slotIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    let idx = 0;
    for (const roundInfo of effectiveStructure.rounds) {
      for (let mi = 0; mi < roundInfo.series; mi++) {
        map[makeSlotKey(roundInfo.round, mi, 'away')] = idx++;
        map[makeSlotKey(roundInfo.round, mi, 'home')] = idx++;
      }
    }
    return map;
  }, [effectiveStructure]);

  const allSlots = useWatch({ control, name: 'slots' }) as SlotFormItem[];
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

  const onSubmit = handleSubmit(async ({ name, slots }) => {
    const payload = [...serializeSlots(slots), ...buildAutoWinnerSlots(effectiveStructure)];
    let savedId = ruleSetId;
    if (ruleSetId) {
      await updateSlots(ruleSetId, name || 'Bracket Rules', payload);
    } else {
      const created = await createRuleSet(name || 'Bracket Rules', payload);
      if (!created) return;
      savedId = created.id;
    }
    if (savedId) onSave?.(savedId);
    onClose();
  });

  return (
    <Modal
      open={open}
      title="Bracket Rules"
      size="lg"
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : 'Save'}
      onConfirm={onSubmit}
      confirmDisabled={isSubmitting}
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
              <p className={styles.bracketRulesRoundLabel}>{round1.label}</p>
              <div className={styles.bracketRulesMatchups}>
                {Array.from({ length: round1.series }, (_, mi) => (
                  <div
                    key={mi}
                    className={styles.bracketRulesMatchup}
                  >
                    <span className={styles.bracketRulesMatchupLabel}>Matchup {mi + 1}</span>
                    <SingleSlotEditor
                      label="1"
                      slotIndex={slotIndexMap[makeSlotKey(1, mi, 'away')] ?? 0}
                      round={1}
                      control={control}
                      setValue={setValue}
                      groups={groups}
                      choiceSlotOptions={choiceSlotOptions}
                      prevRoundMatchupOptions={[]}
                    />
                    <SingleSlotEditor
                      label="2"
                      slotIndex={slotIndexMap[makeSlotKey(1, mi, 'home')] ?? 0}
                      round={1}
                      control={control}
                      setValue={setValue}
                      groups={groups}
                      choiceSlotOptions={choiceSlotOptions}
                      prevRoundMatchupOptions={[]}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        {effectiveStructure.rounds.length > 1 && (
          <p className={styles.bracketRulesAutoNote}>
            Rounds 2 and beyond automatically advance winners in bracket order.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default BracketRulesModal;
