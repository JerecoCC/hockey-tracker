import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import ConfirmModal from '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import {
  ControlledFieldGroup,
  ControlledInputField,
  ControlledSelectField,
  ControlledTextareaField,
} from '@/components/form/ControlledFields';
import GroupedFields from '@jerecocc/tracker-ui/components/GroupedFields/GroupedFields';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import MultiSelect, {
  type MultiSelectOption,
} from '@jerecocc/tracker-ui/components/MultiSelect/MultiSelect';
import RadioList, {
  type RadioListOption,
} from '@jerecocc/tracker-ui/components/RadioList/RadioList';
import ReorderableField from '@jerecocc/tracker-ui/components/ReorderableField/ReorderableField';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import SegmentedControl from '@jerecocc/tracker-ui/components/SegmentedControl/SegmentedControl';
import Tag, { type TagIntent } from '@jerecocc/tracker-ui/components/Tag/Tag';
import useLeagueAwards, {
  type LeagueAwardPayload,
  type LeagueAwardRecord,
} from '@/hooks/useLeagueAwards';
import useGroupAlignmentSets, { type GroupAlignmentSet } from '@/hooks/useGroupAlignmentSets';
import useLeagueGroups from '@/hooks/useLeagueGroups';
import type { AwardRecipientType } from '@/hooks/useSeasonAwards';
import {
  awardCompetitionScopeLabel,
  awardPlayerEligibilityLabel,
  awardSelectionSourceLabel,
  awardTeamEligibilityLabel,
  type AwardCompetitionScope,
  type AwardSelectionSource,
  type AwardWinnerMode,
  type AwardPlayerPositionGroup,
  getAwardCompetitionScope,
  getAwardRecordingGate,
  getAwardSelectionSource,
  getAwardWinnerMode,
  normalizeAwardPlayerEligibility,
  normalizeAwardTeamEligibility,
} from '@/lib/awardDefinitions';
import {
  LeagueListRowSkeleton,
  TabActionSkeleton,
  type TabSkeletonProps,
} from './LeagueTabSkeletonHelpers';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import styles from './LeagueDetails.module.scss';

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'voted', label: 'Voted' },
  { value: 'automatic', label: 'Automatic' },
];

const COMPETITION_SCOPE_OPTIONS = [
  { value: 'full_season', label: 'Full Season' },
  { value: 'regular_season', label: 'Regular Season' },
  { value: 'playoffs', label: 'Playoffs' },
];

const RECIPIENT_TYPE_OPTIONS = [
  { value: 'player', label: 'Player' },
  { value: 'team', label: 'Team' },
];

const STAT_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'points', label: 'Player Points' },
  { value: 'goals', label: 'Player Goals' },
  { value: 'assists', label: 'Player Assists' },
  { value: 'save_pct', label: 'Goalie Save %' },
  { value: 'gaa', label: 'Goalie GAA' },
  { value: 'shutouts', label: 'Goalie Shutouts' },
  { value: 'standings_points', label: 'Team Points' },
  { value: 'wins', label: 'Team Wins' },
  { value: 'playoff_champion', label: 'Playoff Champion' },
];

const PLAYER_STAT_OPTIONS = STAT_OPTIONS.filter((option) =>
  ['', 'points', 'goals', 'assists', 'save_pct', 'gaa', 'shutouts'].includes(option.value),
);

const TEAM_STAT_OPTIONS = STAT_OPTIONS.filter((option) =>
  ['', 'standings_points', 'wins', 'playoff_champion'].includes(option.value),
);

const REGULAR_SEASON_STAT_KEYS = new Set([
  'points',
  'goals',
  'assists',
  'save_pct',
  'gaa',
  'shutouts',
  'standings_points',
  'wins',
]);

const RESULT_MODE_OPTIONS = [
  {
    value: 'single',
    name: 'Single Winner',
    subtitle: 'Award one recipient for this definition.',
    hideImage: true,
  },
  {
    value: 'multiple',
    name: 'Multiple Winners',
    subtitle: 'Record more than one winner for the same award.',
    hideImage: true,
  },
  {
    value: 'team_selection',
    name: 'Team Selection',
    subtitle: 'Build a roster-style team using position slots.',
    hideImage: true,
  },
] satisfies RadioListOption[];

type EligibilityScope = 'all' | 'skaters' | 'forward' | 'defender' | 'goalie' | 'custom';

const POSITION_ELIGIBILITY_OPTIONS = [
  {
    value: 'all',
    name: 'All Positions',
    subtitle: 'Any player position can be selected.',
    hideImage: true,
  },
  {
    value: 'skaters',
    name: 'Skaters',
    subtitle: 'Forwards and defenders only.',
    hideImage: true,
  },
  {
    value: 'forward',
    name: 'Forwards',
    subtitle: 'Only forwards are eligible.',
    hideImage: true,
  },
  {
    value: 'defender',
    name: 'Defenders',
    subtitle: 'Only defenders are eligible.',
    hideImage: true,
  },
  {
    value: 'goalie',
    name: 'Goalies',
    subtitle: 'Only goalies are eligible.',
    hideImage: true,
  },
] satisfies RadioListOption[];

const ROOKIE_ELIGIBILITY_OPTIONS = [
  {
    value: 'all',
    name: 'All Players',
    subtitle: 'No rookie restriction.',
    hideImage: true,
  },
  {
    value: 'rookies',
    name: 'Rookies Only',
    subtitle: 'Only players marked as rookies for this season.',
    hideImage: true,
  },
] satisfies RadioListOption[];

const ELIGIBILITY_SCOPE_GROUPS: Record<
  Exclude<EligibilityScope, 'custom'>,
  AwardPlayerPositionGroup[]
> = {
  all: [],
  skaters: ['forward', 'defender'],
  forward: ['forward'],
  defender: ['defender'],
  goalie: ['goalie'],
};

const CUSTOM_POSITION_ELIGIBILITY_OPTION = {
  value: 'custom',
  name: 'Custom Positions',
  subtitle: 'This award uses a mixed eligibility set from older data.',
  hideImage: true,
} satisfies RadioListOption;

const positionGroupsToEligibilityScope = (groups: AwardPlayerPositionGroup[]): EligibilityScope => {
  if (groups.length === 0) return 'all';
  if (groups.length === 1) return groups[0];

  const unique = new Set(groups);
  if (unique.size === 2 && unique.has('forward') && unique.has('defender')) {
    return 'skaters';
  }

  return 'custom';
};

const eligibilityScopeToPositionGroups = (
  scope: EligibilityScope,
): AwardPlayerPositionGroup[] | null => {
  if (scope === 'custom') return null;
  return ELIGIBILITY_SCOPE_GROUPS[scope];
};

const winnerModeFromValue = (value: string): AwardWinnerMode | null => {
  if (value === 'single' || value === 'multiple' || value === 'team_selection') return value;
  return null;
};

const eligibilityScopeFromValue = (value: string): EligibilityScope | null => {
  if (
    value === 'all' ||
    value === 'skaters' ||
    value === 'forward' ||
    value === 'defender' ||
    value === 'goalie' ||
    value === 'custom'
  ) {
    return value;
  }
  return null;
};

const rookieEligibilityFromValue = (value: string) => {
  if (value === 'all' || value === 'rookies') return value;
  return null;
};

const awardSelectionSourceFromValue = (value: string): AwardSelectionSource | null => {
  if (value === 'manual' || value === 'voted' || value === 'automatic') return value;
  return null;
};

const awardCompetitionScopeFromValue = (value: string): AwardCompetitionScope | null => {
  if (value === 'full_season' || value === 'regular_season' || value === 'playoffs') {
    return value;
  }
  return null;
};

const competitionScopeForValues = (values: Pick<FormValues, 'competition_scope' | 'stat_key'>) => {
  if (values.stat_key === 'playoff_champion') return 'playoffs';
  if (REGULAR_SEASON_STAT_KEYS.has(values.stat_key)) return 'regular_season';
  return values.competition_scope;
};

const statOptionsFor = (
  recipientType: AwardRecipientType,
  competitionScope: AwardCompetitionScope,
) => {
  if (competitionScope === 'full_season') {
    return STAT_OPTIONS.filter((option) => option.value === '');
  }
  if (competitionScope === 'playoffs') {
    return recipientType === 'team'
      ? STAT_OPTIONS.filter((option) => ['', 'playoff_champion'].includes(option.value))
      : STAT_OPTIONS.filter((option) => option.value === '');
  }
  return recipientType === 'team' ? TEAM_STAT_OPTIONS : PLAYER_STAT_OPTIONS;
};

const NOMINEE_WORKFLOW_OPTIONS = [
  { value: 'direct', label: 'Direct Awarding' },
  { value: 'nominees', label: 'Nominees First' },
];

const TIMING_OPTIONS = [
  { value: 'anytime', label: 'Any Time' },
  { value: 'after_playoffs_start', label: 'After Playoffs Start' },
];

const AWARD_FIELD_GROUP_TAG_INTENTS = {
  selection: 'info',
  result: 'accent',
  eligibility: 'success',
} satisfies Record<'selection' | 'result' | 'eligibility', TagIntent>;

interface FormValues {
  name: string;
  description: string;
  recipient_type: AwardRecipientType;
  selection_method: AwardSelectionSource;
  competition_scope: AwardCompetitionScope;
  stat_key: string;
  awarded_after_playoffs: boolean;
  uses_nominees: boolean;
  allow_multiple_winners: boolean;
  uses_team_selection: boolean;
  eligible_position_groups: AwardPlayerPositionGroup[];
  rookies_only: boolean;
  eligible_conference_names: string[];
}

interface Props {
  leagueId: string;
  className?: string;
}

const emptyValues: FormValues = {
  name: '',
  description: '',
  recipient_type: 'player',
  selection_method: 'manual',
  competition_scope: 'full_season',
  stat_key: '',
  awarded_after_playoffs: true,
  uses_nominees: false,
  allow_multiple_winners: false,
  uses_team_selection: false,
  eligible_position_groups: [],
  rookies_only: false,
  eligible_conference_names: [],
};

const statLabel = (statKey: string | null) =>
  statKey ? (STAT_OPTIONS.find((option) => option.value === statKey)?.label ?? statKey) : null;

const recipientTypeLabel = (recipientType: AwardRecipientType) =>
  recipientType === 'player' ? 'Player' : 'Team';

const toPayload = (values: FormValues): LeagueAwardPayload => ({
  name: values.name,
  description: values.description || null,
  recipient_type: values.recipient_type,
  selection_method: values.selection_method,
  competition_scope: competitionScopeForValues(values),
  stat_key: values.stat_key || null,
  awarded_after_playoffs: values.awarded_after_playoffs,
  uses_nominees: values.uses_nominees,
  allow_multiple_winners: values.allow_multiple_winners,
  uses_team_selection: values.uses_team_selection,
  player_eligibility:
    values.recipient_type === 'player'
      ? {
          position_groups: values.eligible_position_groups,
          rookies_only: values.rookies_only,
        }
      : null,
  team_eligibility:
    values.recipient_type === 'team'
      ? {
          conference_names: values.eligible_conference_names,
        }
      : null,
});

const reorderItems = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const LeagueAwardsTab = ({ leagueId, className }: Props) => {
  const { awards, loading, createAward, updateAward, reorderAwards, deleteAward } =
    useLeagueAwards(leagueId);
  const { groups: leagueGroups } = useLeagueGroups(leagueId);
  const { alignmentSets, fetchAlignmentSet } = useGroupAlignmentSets(leagueId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeagueAwardRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeagueAwardRecord | null>(null);
  const [alignmentDetails, setAlignmentDetails] = useState<
    Record<string, GroupAlignmentSet | null>
  >({});
  const [orderedAwardIds, setOrderedAwardIds] = useState<string[] | null>(null);
  const orderedAwardIdsRef = useRef<string[] | null>(null);
  const dropHandledRef = useRef(false);
  const [draggingAwardId, setDraggingAwardId] = useState<string | null>(null);
  const [reorderingAwards, setReorderingAwards] = useState(false);
  const form = useForm<FormValues>({ defaultValues: emptyValues, mode: 'onChange' });

  const openCreate = () => {
    setEditTarget(null);
    form.reset(emptyValues);
    setModalOpen(true);
  };

  const openEdit = (award: LeagueAwardRecord) => {
    const eligibility = normalizeAwardPlayerEligibility(award.player_eligibility);
    const teamEligibility = normalizeAwardTeamEligibility(award.team_eligibility);
    setEditTarget(award);
    form.reset({
      name: award.name,
      description: award.description ?? '',
      recipient_type: award.recipient_type,
      selection_method: getAwardSelectionSource(award),
      competition_scope: getAwardCompetitionScope(award),
      stat_key: award.stat_key ?? '',
      awarded_after_playoffs: award.awarded_after_playoffs,
      uses_nominees: award.uses_nominees,
      allow_multiple_winners: award.allow_multiple_winners,
      uses_team_selection: award.uses_team_selection,
      eligible_position_groups: eligibility.position_groups,
      rookies_only: eligibility.rookies_only,
      eligible_conference_names: teamEligibility.conference_names,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    form.reset(emptyValues);
  };

  const submit = form.handleSubmit(async (values) => {
    const payload = toPayload(values);
    const ok = editTarget ? await updateAward(editTarget.id, payload) : await createAward(payload);
    if (ok) closeModal();
  });

  const setRecipientType = (value: string) => {
    if (value !== 'player' && value !== 'team') return;
    form.setValue('recipient_type', value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('stat_key', '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (value === 'team') {
      form.setValue('uses_nominees', false, { shouldDirty: true, shouldValidate: true });
      form.setValue('allow_multiple_winners', false, { shouldDirty: true, shouldValidate: true });
      form.setValue('uses_team_selection', false, { shouldDirty: true, shouldValidate: true });
      form.setValue('eligible_position_groups', [], { shouldDirty: true, shouldValidate: true });
      form.setValue('rookies_only', false, { shouldDirty: true, shouldValidate: true });
    } else {
      form.setValue('eligible_conference_names', [], { shouldDirty: true, shouldValidate: true });
    }
  };

  const setSelectionMethod = (value: string) => {
    const source = awardSelectionSourceFromValue(value);
    if (!source) return;
    form.setValue('selection_method', source, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const setCompetitionScope = (value: string) => {
    const scope = awardCompetitionScopeFromValue(value);
    if (!scope) return;

    form.setValue('competition_scope', scope, {
      shouldDirty: true,
      shouldValidate: true,
    });

    const statKey = form.getValues('stat_key');
    if (
      (scope === 'full_season' && statKey) ||
      (scope === 'regular_season' && statKey === 'playoff_champion') ||
      (scope === 'playoffs' && REGULAR_SEASON_STAT_KEYS.has(statKey))
    ) {
      form.setValue('stat_key', '', {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const setWinnerMode = (value: string) => {
    const mode = winnerModeFromValue(value);
    if (!mode) return;

    const usesTeamSelection = mode === 'team_selection';
    form.setValue('uses_team_selection', usesTeamSelection, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('allow_multiple_winners', mode === 'multiple', {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (usesTeamSelection) {
      form.setValue('uses_nominees', false, { shouldDirty: true, shouldValidate: true });
    }
  };

  const setNomineeWorkflow = (value: string) => {
    form.setValue('uses_nominees', value === 'nominees', {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const setTiming = (value: string) => {
    form.setValue('awarded_after_playoffs', value === 'after_playoffs_start', {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const setEligibilityScope = (value: string) => {
    const scope = eligibilityScopeFromValue(value);
    if (!scope) return;

    const next = eligibilityScopeToPositionGroups(scope);
    if (!next) return;

    form.setValue('eligible_position_groups', next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const setRookieEligibility = (value: string) => {
    const eligibility = rookieEligibilityFromValue(value);
    if (!eligibility) return;

    form.setValue('rookies_only', eligibility === 'rookies', {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const awardsById = new Map(awards.map((award) => [award.id, award]));
  const localOrderIds = orderedAwardIds ?? awards.map((award) => award.id);
  const localOrderIdSet = new Set(localOrderIds);
  const orderedAwards = [
    ...localOrderIds
      .map((awardId) => awardsById.get(awardId))
      .filter((award): award is LeagueAwardRecord => !!award),
    ...awards.filter((award) => !localOrderIdSet.has(award.id)),
  ];

  const setLocalAwardOrder = (awardIds: string[] | null) => {
    orderedAwardIdsRef.current = awardIds;
    setOrderedAwardIds(awardIds);
  };

  const persistAwardOrder = async (nextAwards: LeagueAwardRecord[]) => {
    const nextAwardIds = nextAwards.map((award) => award.id);
    setLocalAwardOrder(nextAwardIds);
    setReorderingAwards(true);
    const ok = await reorderAwards(nextAwardIds);
    setReorderingAwards(false);
    setLocalAwardOrder(null);
    return ok;
  };

  const moveAward = (awardId: string, delta: number) => {
    const fromIndex = orderedAwards.findIndex((award) => award.id === awardId);
    void persistAwardOrder(reorderItems(orderedAwards, fromIndex, fromIndex + delta));
  };

  const moveAwardTo = (awardId: string, targetAwardId: string, placement: 'before' | 'after') => {
    if (awardId === targetAwardId) return;

    const fromIndex = orderedAwards.findIndex((award) => award.id === awardId);
    const targetIndex = orderedAwards.findIndex((award) => award.id === targetAwardId);
    if (fromIndex < 0 || targetIndex < 0) return;

    const adjustedTargetIndex =
      placement === 'after'
        ? targetIndex + (fromIndex < targetIndex ? 0 : 1)
        : targetIndex - (fromIndex < targetIndex ? 1 : 0);
    const nextAwards = reorderItems(orderedAwards, fromIndex, adjustedTargetIndex);
    setLocalAwardOrder(nextAwards.map((award) => award.id));
  };

  const handleAwardDragStart = (awardId: string) => (event: DragEvent<HTMLDivElement>) => {
    if (reorderingAwards) {
      event.preventDefault();
      return;
    }
    dropHandledRef.current = false;
    setDraggingAwardId(awardId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/league-award-id', awardId);
  };

  const handleAwardDragOver = (targetAwardId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const draggedAwardId = draggingAwardId || event.dataTransfer.getData('text/league-award-id');
    if (!draggedAwardId || draggedAwardId === targetAwardId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
    moveAwardTo(draggedAwardId, targetAwardId, placement);
  };

  const handleAwardDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dropHandledRef.current = true;
    setDraggingAwardId(null);
    const currentOrderIds = orderedAwardIdsRef.current;
    if (!currentOrderIds) return;
    const nextAwards = currentOrderIds
      .map((awardId) => awardsById.get(awardId))
      .filter((award): award is LeagueAwardRecord => !!award);
    void persistAwardOrder(nextAwards);
  };

  const handleAwardDragEnd = () => {
    setDraggingAwardId(null);
    if (!dropHandledRef.current) {
      setLocalAwardOrder(null);
    }
    dropHandledRef.current = false;
  };

  const awardedAfterPlayoffs = form.watch('awarded_after_playoffs');
  const awardName = form.watch('name');
  const recipientType = form.watch('recipient_type');
  const selectionMethod = form.watch('selection_method');
  const competitionScope = form.watch('competition_scope');
  const statOptions = statOptionsFor(recipientType, competitionScope);
  const usesNominees = form.watch('uses_nominees');
  const allowMultipleWinners = form.watch('allow_multiple_winners');
  const usesTeamSelection = form.watch('uses_team_selection');
  const winnerMode = usesTeamSelection
    ? 'team_selection'
    : allowMultipleWinners
      ? 'multiple'
      : 'single';
  const nomineeWorkflow = usesNominees ? 'nominees' : 'direct';
  const timingValue = awardedAfterPlayoffs ? 'after_playoffs_start' : 'anytime';
  const eligiblePositionGroups = form.watch('eligible_position_groups');
  const rookiesOnly = form.watch('rookies_only');
  const eligibleConferenceNames = form.watch('eligible_conference_names');
  const eligibilityScope = positionGroupsToEligibilityScope(eligiblePositionGroups);
  const positionEligibilityOptions =
    eligibilityScope === 'custom'
      ? [...POSITION_ELIGIBILITY_OPTIONS, CUSTOM_POSITION_ELIGIBILITY_OPTION]
      : POSITION_ELIGIBILITY_OPTIONS;
  useEffect(() => {
    if (!modalOpen || recipientType !== 'team') return;

    const setsToFetch = alignmentSets.filter(
      (set) =>
        set.structure_type === 'groups' &&
        (set.conference_count ?? 0) > 0 &&
        !(set.id in alignmentDetails),
    );
    if (setsToFetch.length === 0) return;

    let cancelled = false;
    void Promise.all(
      setsToFetch.map(async (set) => [set.id, await fetchAlignmentSet(set.id)] as const),
    ).then((entries) => {
      if (cancelled) return;
      setAlignmentDetails((current) => {
        const next = { ...current };
        entries.forEach(([setId, details]) => {
          next[setId] = details;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [alignmentDetails, alignmentSets, fetchAlignmentSet, modalOpen, recipientType]);

  const conferenceOptions = useMemo<MultiSelectOption[]>(() => {
    const optionsByName = new Map<string, MultiSelectOption>();
    const addConference = (name?: string | null) => {
      const trimmed = name?.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!optionsByName.has(key)) {
        optionsByName.set(key, { value: trimmed, label: trimmed });
      }
    };

    leagueGroups
      .filter((group) => group.role === 'conference')
      .forEach((group) => addConference(group.name));
    Object.values(alignmentDetails).forEach((details) => {
      details?.groups
        ?.filter((group) => group.role === 'conference')
        .forEach((group) => addConference(group.name));
    });
    eligibleConferenceNames.forEach(addConference);

    return [...optionsByName.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [alignmentDetails, eligibleConferenceNames, leagueGroups]);

  if (loading) return <LeagueAwardsTabSkeleton className={className} />;

  return (
    <>
      <div className={styles.grid}>
        <Section
          className={[styles.col12, className].filter(Boolean).join(' ')}
          title="Awards"
          action={
            <Button
              icon="add"
              size="medium"
              onClick={openCreate}
            >
              Create Award
            </Button>
          }
        >
          {awards.length === 0 ? (
            <p className={styles.emptyMsg}>
              No award definitions yet. Create one to apply it across seasons.
            </p>
          ) : (
            <ResponsiveList
              className={styles.awardDefinitionList}
              aria-label="Award definitions"
            >
              {orderedAwards.map((award, index) => {
                const stat = statLabel(award.stat_key);
                const competitionScope = getAwardCompetitionScope(award);
                const recordingGate = getAwardRecordingGate(award);
                const selectionSource = getAwardSelectionSource(award);
                const winnerMode = getAwardWinnerMode(award);
                const eligibility = awardPlayerEligibilityLabel(award);
                const teamEligibility = awardTeamEligibilityLabel(award);

                return (
                  <li
                    key={award.id}
                    className={styles.awardDefinitionSortableItem}
                  >
                    <ReorderableField
                      dragging={draggingAwardId === award.id}
                      draggable={!reorderingAwards}
                      disabled={reorderingAwards}
                      moveUpDisabled={index === 0}
                      moveDownDisabled={index === orderedAwards.length - 1}
                      moveUpLabel={`Move ${award.name} up`}
                      moveDownLabel={`Move ${award.name} down`}
                      onMoveUp={() => moveAward(award.id, -1)}
                      onMoveDown={() => moveAward(award.id, 1)}
                      onDragStart={handleAwardDragStart(award.id)}
                      onDragOver={handleAwardDragOver(award.id)}
                      onDrop={handleAwardDrop}
                      onDragEnd={handleAwardDragEnd}
                      className={styles.awardDefinitionReorderable}
                    >
                      <div className={styles.awardDefinitionItem}>
                        <div className={styles.awardDefinitionHeader}>
                          <div className={styles.awardDefinitionMain}>
                            <span className={styles.awardDefinitionName}>{award.name}</span>
                            {award.description && (
                              <span className={styles.awardDefinitionDescription}>
                                {award.description}
                              </span>
                            )}
                          </div>
                          <div className={styles.awardDefinitionActions}>
                            <Button
                              variant="outlined"
                              intent="neutral"
                              icon="edit"
                              tooltip="Edit award"
                              aria-label={`Edit ${award.name}`}
                              disabled={reorderingAwards}
                              onClick={() => openEdit(award)}
                            />
                            <Button
                              variant="outlined"
                              intent="danger"
                              icon="delete"
                              tooltip="Remove award"
                              aria-label={`Remove ${award.name}`}
                              disabled={reorderingAwards}
                              onClick={() => setConfirmDelete(award)}
                            />
                          </div>
                        </div>
                        <Divider
                          orientation="horizontal"
                          className={styles.awardDefinitionDivider}
                        />
                        <div
                          className={styles.awardDefinitionMeta}
                          aria-label="Award details"
                        >
                          <Tag
                            label={recipientTypeLabel(award.recipient_type)}
                            intent={AWARD_FIELD_GROUP_TAG_INTENTS.selection}
                          />
                          <Tag
                            label={awardSelectionSourceLabel(selectionSource)}
                            intent={AWARD_FIELD_GROUP_TAG_INTENTS.selection}
                          />
                          {stat && (
                            <Tag
                              label={stat}
                              intent={AWARD_FIELD_GROUP_TAG_INTENTS.selection}
                            />
                          )}
                          {eligibility && (
                            <Tag
                              label={eligibility}
                              intent={AWARD_FIELD_GROUP_TAG_INTENTS.eligibility}
                            />
                          )}
                          {teamEligibility && (
                            <Tag
                              label={teamEligibility}
                              intent={AWARD_FIELD_GROUP_TAG_INTENTS.eligibility}
                            />
                          )}
                          <Tag
                            label={awardCompetitionScopeLabel(competitionScope)}
                            intent={AWARD_FIELD_GROUP_TAG_INTENTS.selection}
                          />
                          {recordingGate === 'after_playoffs_start' && (
                            <Tag
                              label="After playoffs start"
                              intent={AWARD_FIELD_GROUP_TAG_INTENTS.result}
                            />
                          )}
                          {award.uses_nominees && winnerMode !== 'team_selection' && (
                            <Tag
                              label="Nominees"
                              intent={AWARD_FIELD_GROUP_TAG_INTENTS.result}
                            />
                          )}
                          {winnerMode === 'multiple' && (
                            <Tag
                              label="Multiple winners"
                              intent={AWARD_FIELD_GROUP_TAG_INTENTS.result}
                            />
                          )}
                          {winnerMode === 'team_selection' && (
                            <Tag
                              label="Team selection"
                              intent={AWARD_FIELD_GROUP_TAG_INTENTS.result}
                            />
                          )}
                        </div>
                      </div>
                    </ReorderableField>
                  </li>
                );
              })}
            </ResponsiveList>
          )}
        </Section>
      </div>

      <Modal
        open={modalOpen}
        title={editTarget ? 'Edit Award Definition' : 'Create Award'}
        onClose={closeModal}
        confirmForm="league-award-form"
        confirmLabel={
          form.formState.isSubmitting ? 'Saving...' : editTarget ? 'Save Changes' : 'Create Award'
        }
        confirmIcon="save"
        confirmDisabled={
          form.formState.isSubmitting || !form.formState.isDirty || awardName.trim() === ''
        }
        busy={form.formState.isSubmitting}
      >
        <form
          id="league-award-form"
          className={styles.awardDefinitionForm}
          onSubmit={submit}
        >
          <GroupedFields
            legend="Definition"
            fieldsClassName={styles.awardDefinitionGroupFields}
          >
            <ControlledInputField
              control={form.control}
              name="name"
              label="Award Name"
              required
              rules={{ required: 'Award name is required' }}
            />
            <ControlledTextareaField
              control={form.control}
              name="description"
              label="Description"
              rows={3}
            />
          </GroupedFields>

          <GroupedFields
            legend="Selection"
            fieldsClassName={styles.awardDefinitionGroupFields}
          >
            <ControlledFieldGroup
              control={form.control}
              name="recipient_type"
              label="Recipient"
            >
              <SegmentedControl
                value={recipientType}
                onChange={setRecipientType}
                options={RECIPIENT_TYPE_OPTIONS}
                variant="field"
                className={styles.awardDefinitionSegmented}
              />
            </ControlledFieldGroup>
            <ControlledFieldGroup
              control={form.control}
              name="selection_method"
              label="Source"
            >
              <SegmentedControl
                value={selectionMethod}
                onChange={setSelectionMethod}
                options={SOURCE_OPTIONS}
                variant="field"
                className={styles.awardDefinitionSegmented}
              />
            </ControlledFieldGroup>
            <ControlledFieldGroup
              control={form.control}
              name="competition_scope"
              label="Competition"
            >
              <SegmentedControl
                value={competitionScope}
                onChange={setCompetitionScope}
                options={COMPETITION_SCOPE_OPTIONS}
                variant="field"
                className={styles.awardDefinitionSegmented}
              />
            </ControlledFieldGroup>
            <ControlledSelectField
              control={form.control}
              name="stat_key"
              label="Stat Resolver"
              options={statOptions}
            />
          </GroupedFields>

          <GroupedFields
            legend="Result"
            fieldsClassName={styles.awardDefinitionGroupFields}
          >
            <ControlledFieldGroup
              control={form.control}
              name="uses_team_selection"
              label="Winner Format"
            >
              <RadioList
                value={winnerMode}
                onChange={setWinnerMode}
                options={RESULT_MODE_OPTIONS}
                ariaLabel="Winner Format"
                disabled={recipientType === 'team'}
              />
            </ControlledFieldGroup>
            <ControlledFieldGroup
              control={form.control}
              name="uses_nominees"
              label="Workflow"
            >
              <SegmentedControl
                value={nomineeWorkflow}
                onChange={setNomineeWorkflow}
                options={NOMINEE_WORKFLOW_OPTIONS}
                variant="field"
                className={styles.awardDefinitionSegmented}
                disabled={usesTeamSelection || recipientType === 'team'}
              />
            </ControlledFieldGroup>
            <ControlledFieldGroup
              control={form.control}
              name="awarded_after_playoffs"
              label="Recording Availability"
            >
              <SegmentedControl
                value={timingValue}
                onChange={setTiming}
                options={TIMING_OPTIONS}
                variant="field"
                className={styles.awardDefinitionSegmented}
              />
            </ControlledFieldGroup>
          </GroupedFields>

          {recipientType === 'player' && (
            <GroupedFields
              legend="Eligible Players"
              fieldsClassName={styles.awardDefinitionEligibility}
            >
              <ControlledFieldGroup
                control={form.control}
                name="eligible_position_groups"
                label="Position Eligibility"
              >
                <RadioList
                  value={eligibilityScope}
                  onChange={setEligibilityScope}
                  options={positionEligibilityOptions}
                  ariaLabel="Position Eligibility"
                />
              </ControlledFieldGroup>
              <ControlledFieldGroup
                control={form.control}
                name="rookies_only"
                label="Rookie Eligibility"
              >
                <RadioList
                  value={rookiesOnly ? 'rookies' : 'all'}
                  onChange={setRookieEligibility}
                  options={ROOKIE_ELIGIBILITY_OPTIONS}
                  ariaLabel="Rookie Eligibility"
                />
              </ControlledFieldGroup>
            </GroupedFields>
          )}

          {recipientType === 'team' && (
            <GroupedFields
              legend="Eligible Teams"
              fieldsClassName={styles.awardDefinitionEligibility}
            >
              <ControlledFieldGroup
                control={form.control}
                name="eligible_conference_names"
                label="Conference Eligibility"
              >
                <MultiSelect
                  value={eligibleConferenceNames}
                  options={conferenceOptions}
                  placeholder="All conferences"
                  emptyMessage="No conferences found"
                  selectionLayout="wrap"
                  searchable
                  onChange={(values) =>
                    form.setValue('eligible_conference_names', values, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </ControlledFieldGroup>
            </GroupedFields>
          )}
        </form>
      </Modal>

      <ConfirmModal
        open={confirmDelete !== null}
        title="Remove Award Definition"
        body={
          <>
            Remove <strong>{confirmDelete?.name}</strong> from this league&apos;s active award
            definitions? Existing recorded season results will remain in the database.
          </>
        }
        confirmLabel="Remove"
        intent="danger"
        onConfirm={async () => {
          if (confirmDelete) await deleteAward(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
};

export const LeagueAwardsTabSkeleton = ({ className }: TabSkeletonProps) => (
  <div className={styles.grid}>
    <Section
      className={[styles.col12, className].filter(Boolean).join(' ')}
      title="Awards"
      action={<TabActionSkeleton width="112px" />}
      role="status"
      aria-busy="true"
      aria-label="Loading awards"
    >
      <ResponsiveList className={styles.awardDefinitionList}>
        {Array.from({ length: 5 }, (_, index) => (
          <LeagueListRowSkeleton key={index} />
        ))}
      </ResponsiveList>
    </Section>
  </div>
);

export default LeagueAwardsTab;
