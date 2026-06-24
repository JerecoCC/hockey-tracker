import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import Select, { type SelectOption } from '@/components/Select/Select';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import Tooltip from '@/components/Tooltip/Tooltip';
import useSeasonAwards, {
  type AwardRecipientType,
  type SeasonAwardRecipient,
  type SeasonAwardRecord,
} from '@/hooks/useSeasonAwards';
import type { SeasonTeam } from '@/hooks/useSeasonDetails';
import type { TeamStandingRecord } from '@/hooks/useSeasonStandings';
import type { GoalieStatRecord, SkaterStatRecord } from '@/hooks/useSeasonStats';
import styles from './SeasonDetails.module.scss';

const TEAM_SELECTION_AWARD_NAMES = new Set([
  'First All-Star Team',
  'Second All-Star Team',
  'All-Rookie Team',
]);

type AwardTeamSelectionField =
  | 'forward_1'
  | 'forward_2'
  | 'forward_3'
  | 'defender_1'
  | 'defender_2'
  | 'goalie_1';

type AwardTeamSelectionGroup = 'Forward' | 'Defender' | 'Goalie';

interface TeamSelectionFormValues {
  forward_1: string;
  forward_2: string;
  forward_3: string;
  defender_1: string;
  defender_2: string;
  goalie_1: string;
}

const TEAM_SELECTION_GROUPS: {
  group: AwardTeamSelectionGroup;
  label: string;
  count: number;
}[] = [
  { group: 'Forward', label: 'Forwards', count: 3 },
  { group: 'Defender', label: 'Defenders', count: 2 },
  { group: 'Goalie', label: 'Goalie', count: 1 },
];

const TEAM_SELECTION_SLOTS: {
  field: AwardTeamSelectionField;
  group: AwardTeamSelectionGroup;
  label: string;
  rank: number;
}[] = [
  { field: 'forward_1', group: 'Forward', label: 'Forward 1', rank: 1 },
  { field: 'forward_2', group: 'Forward', label: 'Forward 2', rank: 2 },
  { field: 'forward_3', group: 'Forward', label: 'Forward 3', rank: 3 },
  { field: 'defender_1', group: 'Defender', label: 'Defender 1', rank: 4 },
  { field: 'defender_2', group: 'Defender', label: 'Defender 2', rank: 5 },
  { field: 'goalie_1', group: 'Goalie', label: 'Goalie', rank: 6 },
];

const emptyTeamSelectionValues: TeamSelectionFormValues = {
  forward_1: '',
  forward_2: '',
  forward_3: '',
  defender_1: '',
  defender_2: '',
  goalie_1: '',
};

interface RecipientFormValues {
  recipient_id: string;
}

interface NomineeDraft {
  id: string;
  recipient_id: string;
}

interface SuggestedRecipient {
  id: string;
  type: AwardRecipientType;
  label: string;
}

interface Props {
  seasonId: string;
  seasonTeams: SeasonTeam[];
  skaters: SkaterStatRecord[];
  goalies: GoalieStatRecord[];
  standings: TeamStandingRecord[];
}

const playerName = (player: Pick<SkaterStatRecord, 'first_name' | 'last_name'>) =>
  [player.first_name, player.last_name].filter(Boolean).join(' ');

const numericFieldValue = (record: object, field: string | null | undefined) => {
  if (!field) return null;
  const value = (record as Record<string, unknown>)[field];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isTeamSelectionAward = (awardName: string) => TEAM_SELECTION_AWARD_NAMES.has(awardName);

const supportsNominees = (award: SeasonAwardRecord) =>
  award.selection_method === 'voted' && !isTeamSelectionAward(award.name);

const createNomineeDraft = (): NomineeDraft => ({
  id:
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  recipient_id: '',
});

const normalizedPosition = (position: string | null | undefined) =>
  position?.trim().toUpperCase() ?? '';

const isDefensePosition = (position: string | null | undefined) =>
  ['D', 'LD', 'RD', 'DEF', 'DEFENSE', 'DEFENDER'].includes(normalizedPosition(position));

const isGoaliePosition = (position: string | null | undefined) =>
  ['G', 'GK', 'GOL', 'GOALIE', 'GOALTENDER'].includes(normalizedPosition(position));

const groupFromText = (value: string | null | undefined): AwardTeamSelectionGroup | null => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith('forward')) return 'Forward';
  if (normalized.startsWith('defen') || normalized.startsWith('defender')) return 'Defender';
  if (normalized.startsWith('goal')) return 'Goalie';
  return null;
};

const recipientTeamSelectionGroup = (recipient: SeasonAwardRecipient): AwardTeamSelectionGroup => {
  const noteGroup = groupFromText(recipient.notes);
  if (noteGroup) return noteGroup;
  if (isGoaliePosition(recipient.position)) return 'Goalie';
  if (isDefensePosition(recipient.position)) return 'Defender';
  return 'Forward';
};

const SeasonAwardsTab = ({ seasonId, seasonTeams, skaters, goalies, standings }: Props) => {
  const { awards, loading, createAward, addRecipient, deleteRecipient, refresh } =
    useSeasonAwards(seasonId);
  const [recipientAward, setRecipientAward] = useState<SeasonAwardRecord | null>(null);
  const [nomineeAward, setNomineeAward] = useState<SeasonAwardRecord | null>(null);
  const [nomineeDrafts, setNomineeDrafts] = useState<NomineeDraft[]>([]);
  const [nomineesSaving, setNomineesSaving] = useState(false);
  const [teamSelectionAward, setTeamSelectionAward] = useState<SeasonAwardRecord | null>(null);

  const recipientForm = useForm<RecipientFormValues>({
    defaultValues: {
      recipient_id: '',
    },
    mode: 'onChange',
  });
  const teamSelectionForm = useForm<TeamSelectionFormValues>({
    defaultValues: emptyTeamSelectionValues,
    mode: 'onChange',
  });

  const players = useMemo(() => {
    const byId = new Map<string, SkaterStatRecord | GoalieStatRecord>();
    skaters.forEach((player) => byId.set(player.player_id, player));
    goalies.forEach((player) => {
      if (!byId.has(player.player_id)) byId.set(player.player_id, player);
    });
    return [...byId.values()].sort((a, b) => playerName(a).localeCompare(playerName(b)));
  }, [goalies, skaters]);

  const playerOptions = players.map((player) => ({
    value: player.player_id,
    label: playerName(player),
    logo: player.team_logo,
    code: player.team_code ?? undefined,
  }));

  const forwardOptions = skaters
    .filter((player) => !isDefensePosition(player.position) && !isGoaliePosition(player.position))
    .map((player) => ({
      value: player.player_id,
      label: playerName(player),
      logo: player.team_logo,
      code: player.team_code ?? undefined,
    }));

  const defenderOptions = skaters
    .filter((player) => isDefensePosition(player.position))
    .map((player) => ({
      value: player.player_id,
      label: playerName(player),
      logo: player.team_logo,
      code: player.team_code ?? undefined,
    }));

  const goalieOptions = goalies.map((player) => ({
    value: player.player_id,
    label: playerName(player),
    logo: player.team_logo,
    code: player.team_code ?? undefined,
  }));

  const teamSelectionOptions = {
    Forward: forwardOptions,
    Defender: defenderOptions,
    Goalie: goalieOptions,
  } satisfies Record<AwardTeamSelectionGroup, typeof playerOptions>;
  const teamSelectionValues = teamSelectionForm.watch();
  const teamSelectionIds = Object.values(teamSelectionValues).filter(Boolean);
  const teamSelectionComplete = teamSelectionIds.length === TEAM_SELECTION_SLOTS.length;
  const teamSelectionHasDuplicates = new Set(teamSelectionIds).size !== teamSelectionIds.length;

  const teamOptions = seasonTeams.map((team) => ({
    value: team.id,
    label: team.name,
    logo: team.logo,
    code: team.code,
  }));

  const recipientValueId = (recipient: SeasonAwardRecipient) =>
    recipient.recipient_type === 'team' ? recipient.team_id : recipient.player_id;

  const recipientToOption = (recipient: SeasonAwardRecipient): SelectOption | null => {
    const value = recipientValueId(recipient);
    if (!value) return null;
    return {
      value,
      label: recipientName(recipient),
      logo: recipient.team_logo,
      code: recipient.team_code ?? undefined,
    };
  };

  const nomineeOptionsForAward = (award: SeasonAwardRecord): SelectOption[] =>
    award.recipients
      .filter((recipient) => recipient.role === 'nominee')
      .map(recipientToOption)
      .filter((option): option is SelectOption => option !== null);

  const recipientOptionsForAward = (award: SeasonAwardRecord): SelectOption[] => {
    if (supportsNominees(award)) return nomineeOptionsForAward(award);
    return award.recipient_type === 'player' ? playerOptions : teamOptions;
  };

  const suggestions = useMemo(() => {
    const byAward = new Map<string, SuggestedRecipient>();
    for (const award of awards) {
      if (award.selection_method !== 'automatic' || !award.stat_key) continue;

      if (award.recipient_type === 'team') {
        const field = award.stat_key === 'standings_points' ? 'points' : award.stat_key;
        const candidates = standings.filter((team) =>
          numericFieldValue(team, field) !== null,
        );
        const top = candidates.sort(
          (a, b) => (numericFieldValue(b, field) ?? 0) - (numericFieldValue(a, field) ?? 0),
        )[0];
        if (top) {
          byAward.set(award.award_id, {
            id: top.team_id,
            type: 'team',
            label: top.team_name ?? top.team_code ?? 'Team',
          });
        }
        continue;
      }

      if (['points', 'goals', 'assists'].includes(award.stat_key)) {
        const top = [...skaters].sort(
          (a, b) =>
            (numericFieldValue(b, award.stat_key) ?? 0) -
            (numericFieldValue(a, award.stat_key) ?? 0),
        )[0];
        if (top) {
          byAward.set(award.award_id, {
            id: top.player_id,
            type: 'player',
            label: playerName(top),
          });
        }
      } else if (['save_pct', 'gaa', 'shutouts'].includes(award.stat_key)) {
        const ascending = award.stat_key === 'gaa';
        const candidates = goalies.filter(
          (goalie) => numericFieldValue(goalie, award.stat_key) !== null,
        );
        const top = candidates.sort((a, b) => {
          const diff =
            (numericFieldValue(a, award.stat_key) ?? 0) -
            (numericFieldValue(b, award.stat_key) ?? 0);
          return ascending ? diff : -diff;
        })[0];
        if (top) {
          byAward.set(award.award_id, {
            id: top.player_id,
            type: 'player',
            label: playerName(top),
          });
        }
      }
    }
    return byAward;
  }, [awards, goalies, skaters, standings]);

  const activeRecipientAward = recipientAward
    ? (awards.find((award) => award.award_id === recipientAward.award_id) ?? recipientAward)
    : null;
  const activeNomineeAward = nomineeAward
    ? (awards.find((award) => award.award_id === nomineeAward.award_id) ?? nomineeAward)
    : null;

  const openRecipientModal = (award: SeasonAwardRecord) => {
    setRecipientAward(award);
    recipientForm.reset({
      recipient_id: '',
    });
  };

  const closeRecipientModal = () => {
    setRecipientAward(null);
    recipientForm.reset();
  };

  const openNomineesModal = (award: SeasonAwardRecord) => {
    setNomineeAward(award);
    const drafts = award.recipients
      .filter((recipient) => recipient.role === 'nominee')
      .map((recipient) => ({
        id: recipient.id,
        recipient_id: recipientValueId(recipient) ?? '',
      }));
    setNomineeDrafts(drafts.length > 0 ? drafts : [createNomineeDraft()]);
  };

  const closeNomineesModal = () => {
    setNomineeAward(null);
    setNomineeDrafts([]);
    setNomineesSaving(false);
  };

  const addNomineeDraft = () => {
    setNomineeDrafts((drafts) => [...drafts, createNomineeDraft()]);
  };

  const updateNomineeDraft = (draftId: string, recipientId: string) => {
    setNomineeDrafts((drafts) =>
      drafts.map((draft) =>
        draft.id === draftId ? { ...draft, recipient_id: recipientId } : draft,
      ),
    );
  };

  const removeNomineeDraft = (draftId: string) => {
    setNomineeDrafts((drafts) => drafts.filter((draft) => draft.id !== draftId));
  };

  const openTeamSelectionModal = (award: SeasonAwardRecord) => {
    setTeamSelectionAward(award);
    const values = { ...emptyTeamSelectionValues };
    const winnersByGroup = new Map<AwardTeamSelectionGroup, SeasonAwardRecipient[]>();
    award.recipients
      .filter((recipient) => recipient.role === 'winner' && recipient.player_id)
      .forEach((recipient) => {
        const group = recipientTeamSelectionGroup(recipient);
        const list = winnersByGroup.get(group) ?? [];
        list.push(recipient);
        winnersByGroup.set(group, list);
      });

    for (const list of winnersByGroup.values()) {
      list.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    }

    TEAM_SELECTION_SLOTS.forEach((slot) => {
      const groupSlots = TEAM_SELECTION_SLOTS.filter((candidate) => candidate.group === slot.group);
      const groupIndex = groupSlots.findIndex((candidate) => candidate.field === slot.field);
      values[slot.field] = winnersByGroup.get(slot.group)?.[groupIndex]?.player_id ?? '';
    });

    teamSelectionForm.reset(values);
  };

  const closeTeamSelectionModal = () => {
    setTeamSelectionAward(null);
    teamSelectionForm.reset(emptyTeamSelectionValues);
  };

  const submitRecipient = recipientForm.handleSubmit(async (values) => {
    if (!activeRecipientAward?.season_award_id) return;
    const ok = await addRecipient(activeRecipientAward.season_award_id, {
      recipient_type: activeRecipientAward.recipient_type,
      player_id: activeRecipientAward.recipient_type === 'player' ? values.recipient_id : null,
      team_id: activeRecipientAward.recipient_type === 'team' ? values.recipient_id : null,
      role: 'winner',
    });
    if (ok) closeRecipientModal();
  });

  const activeNominees =
    activeNomineeAward?.recipients.filter((recipient) => recipient.role === 'nominee') ?? [];
  const activeNomineeRecipientIds = activeNominees.map(recipientValueId).filter(Boolean);
  const nomineeDraftRecipientIds = nomineeDrafts.map((draft) => draft.recipient_id).filter(Boolean);
  const nomineeDraftHasDuplicates =
    new Set(nomineeDraftRecipientIds).size !== nomineeDraftRecipientIds.length;
  const nomineeDraftHasEmpty = nomineeDraftRecipientIds.length !== nomineeDrafts.length;
  const sortedActiveNomineeIds = [...activeNomineeRecipientIds].sort().join('|');
  const sortedDraftNomineeIds = [...nomineeDraftRecipientIds].sort().join('|');
  const nomineeDraftHasChanges = sortedActiveNomineeIds !== sortedDraftNomineeIds;
  const nomineeDraftCanSave =
    !nomineeDraftHasEmpty && !nomineeDraftHasDuplicates && nomineeDraftHasChanges;

  const submitNominees = async () => {
    if (!activeNomineeAward?.season_award_id || !nomineeDraftCanSave) return;
    setNomineesSaving(true);

    const desiredRecipientIds = new Set(nomineeDraftRecipientIds);
    const nomineesToKeep = new Set<string>();

    for (const recipient of activeNominees) {
      const recipientId = recipientValueId(recipient);
      if (recipientId && desiredRecipientIds.has(recipientId) && !nomineesToKeep.has(recipientId)) {
        nomineesToKeep.add(recipientId);
        desiredRecipientIds.delete(recipientId);
        continue;
      }

      const ok = await deleteRecipient(activeNomineeAward.season_award_id, recipient.id, {
        silent: true,
        refresh: false,
      });
      if (!ok) {
        setNomineesSaving(false);
        return;
      }
    }

    for (const recipientId of desiredRecipientIds) {
      const ok = await addRecipient(
        activeNomineeAward.season_award_id,
        {
          recipient_type: activeNomineeAward.recipient_type,
          player_id: activeNomineeAward.recipient_type === 'player' ? recipientId : null,
          team_id: activeNomineeAward.recipient_type === 'team' ? recipientId : null,
          role: 'nominee',
        },
        {
          silent: true,
          refresh: false,
        },
      );
      if (!ok) {
        setNomineesSaving(false);
        return;
      }
    }

    refresh();
    closeNomineesModal();
  };

  const addSuggestedWinner = async (award: SeasonAwardRecord, suggestion: SuggestedRecipient) => {
    if (!award.season_award_id) return;
    await addRecipient(award.season_award_id, {
      recipient_type: suggestion.type,
      player_id: suggestion.type === 'player' ? suggestion.id : null,
      team_id: suggestion.type === 'team' ? suggestion.id : null,
      role: 'winner',
    });
  };

  const attachAwardToSeason = (award: SeasonAwardRecord) =>
    createAward({ award_id: award.award_id });

  const submitTeamSelection = teamSelectionForm.handleSubmit(async (values) => {
    if (
      !teamSelectionAward?.season_award_id ||
      !teamSelectionComplete ||
      teamSelectionHasDuplicates
    ) {
      return;
    }

    const existingWinners = teamSelectionAward.recipients.filter(
      (recipient) => recipient.role === 'winner',
    );
    for (const recipient of existingWinners) {
      const ok = await deleteRecipient(teamSelectionAward.season_award_id, recipient.id, {
        silent: true,
        refresh: false,
      });
      if (!ok) return;
    }

    for (const slot of TEAM_SELECTION_SLOTS) {
      const ok = await addRecipient(
        teamSelectionAward.season_award_id,
        {
          recipient_type: 'player',
          player_id: values[slot.field],
          role: 'winner',
          rank: slot.rank,
          notes: slot.group,
        },
        {
          silent: true,
          refresh: false,
        },
      );
      if (!ok) return;
    }

    refresh();
    closeTeamSelectionModal();
  });

  const nomineeRecipientOptions =
    activeNomineeAward?.recipient_type === 'team' ? teamOptions : playerOptions;
  const nomineeOptionsForDraft = (draft: NomineeDraft) =>
    nomineeRecipientOptions.filter((option) => {
      if ('divider' in option) return true;
      const selectedInAnotherDraft = nomineeDrafts.some(
        (candidate) => candidate.id !== draft.id && candidate.recipient_id === option.value,
      );
      return option.value === draft.recipient_id || !selectedInAnotherDraft;
    });

  return (
    <>
      <Card title="Awards">
        {loading ? (
          <p className={styles.tabPlaceholder}>Loading awards...</p>
        ) : awards.length === 0 ? (
          <p className={styles.tabPlaceholder}>No league award definitions yet.</p>
        ) : (
          <div className={styles.awardsList}>
            {awards.map((award) => {
              const winners = award.recipients.filter((recipient) => recipient.role === 'winner');
              const nominees = award.recipients.filter((recipient) => recipient.role === 'nominee');
              const suggestion = suggestions.get(award.award_id);
              const isGroupedAward = isTeamSelectionAward(award.name);
              const canManageNominees = supportsNominees(award);
              const awardRequiresNominees = canManageNominees && nominees.length === 0;
              const awardRecipientLabel =
                award.recipient_type === 'player' ? 'Award Player' : 'Award Team';
              return (
                <section
                  key={award.award_id}
                  className={styles.awardItem}
                >
                  <div className={styles.awardHeader}>
                    <div className={styles.awardTitleBlock}>
                      {award.description ? (
                        <h4>
                          <Tooltip
                            text={award.description}
                            className={styles.awardTitleTooltip}
                          >
                            <span>{award.name}</span>
                          </Tooltip>
                        </h4>
                      ) : (
                        <h4>{award.name}</h4>
                      )}
                    </div>
                    <div className={styles.awardActions}>
                      {!award.season_award_id ? (
                        <Button
                          size="sm"
                          variant="outlined"
                          intent="neutral"
                          icon="playlist_add"
                          tooltip="Track award"
                          aria-label="Track award"
                          onClick={() => attachAwardToSeason(award)}
                        />
                      ) : (
                        <>
                          {suggestion && (
                            <Button
                              size="sm"
                              variant="outlined"
                              intent="success"
                              icon="stars"
                              tooltip={`Use suggested winner: ${suggestion.label}`}
                              aria-label={`Use suggested winner: ${suggestion.label}`}
                              onClick={() => addSuggestedWinner(award, suggestion)}
                            />
                          )}
                          <div className={styles.awardRecipientActions}>
                            {canManageNominees && (
                              <Button
                                size="sm"
                                variant="outlined"
                                intent="neutral"
                                icon="person_add"
                                tooltip="Nominees"
                                aria-label="Nominees"
                                onClick={() => openNomineesModal(award)}
                              />
                            )}
                            {isGroupedAward ? (
                              <Button
                                size="sm"
                                icon="groups"
                                tooltip="Set team"
                                aria-label="Set team"
                                onClick={() => openTeamSelectionModal(award)}
                              />
                            ) : (
                              <Button
                                size="sm"
                                icon="emoji_events"
                                tooltip={
                                  awardRequiresNominees
                                    ? 'Add nominees before awarding'
                                    : awardRecipientLabel
                                }
                                aria-label={awardRecipientLabel}
                                disabled={awardRequiresNominees}
                                onClick={() => openRecipientModal(award)}
                              />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {isGroupedAward ? (
                    <AwardTeamSelectionList
                      recipients={winners}
                      seasonAwardId={award.season_award_id}
                      onDelete={deleteRecipient}
                    />
                  ) : (
                    <AwardWinnerList
                      recipients={winners}
                      seasonAwardId={award.season_award_id}
                      onDelete={deleteRecipient}
                    />
                  )}
                  {nominees.length > 0 && (
                    <AwardRecipientList
                      title="Nominees"
                      empty=""
                      recipients={nominees}
                      seasonAwardId={award.season_award_id}
                      onDelete={deleteRecipient}
                    />
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={!!recipientAward}
        title={
          activeRecipientAward
            ? `${
                activeRecipientAward.recipient_type === 'team' ? 'Award Team' : 'Award Player'
              }: ${
                activeRecipientAward.name
              }`
            : 'Award Recipient'
        }
        onClose={closeRecipientModal}
        confirmForm="season-award-recipient-form"
        confirmLabel={
          recipientForm.formState.isSubmitting
            ? 'Saving...'
            : activeRecipientAward?.recipient_type === 'team'
              ? 'Award Team'
              : 'Award Player'
        }
        confirmIcon="emoji_events"
        confirmDisabled={
          recipientForm.formState.isSubmitting ||
          !recipientForm.formState.isDirty ||
          !recipientForm.formState.isValid
        }
        busy={recipientForm.formState.isSubmitting}
      >
        {activeRecipientAward && (
          <form
            id="season-award-recipient-form"
            className={styles.awardForm}
            onSubmit={submitRecipient}
          >
            <Field
              control={recipientForm.control}
              name="recipient_id"
              type="select"
              label={activeRecipientAward.recipient_type === 'player' ? 'Player' : 'Team'}
              options={recipientOptionsForAward(activeRecipientAward)}
              searchable
              required
              rules={{ required: 'Recipient is required' }}
            />
          </form>
        )}
      </Modal>

      <Modal
        open={!!nomineeAward}
        title={activeNomineeAward ? `Nominees: ${activeNomineeAward.name}` : 'Nominees'}
        onClose={closeNomineesModal}
        onConfirm={submitNominees}
        confirmLabel={nomineesSaving ? 'Saving...' : 'Save Nominees'}
        confirmIcon="save"
        confirmDisabled={nomineesSaving || !nomineeDraftCanSave}
        busy={nomineesSaving}
      >
        {activeNomineeAward && (
          <div className={styles.awardNomineeManager}>
            <div className={styles.awardNomineeDraftList}>
              {nomineeDrafts.map((draft, index) => {
                const labelId = `nominee-draft-${draft.id}`;
                return (
                  <div
                    key={draft.id}
                    className={styles.awardNomineeDraftRow}
                  >
                    <span
                      id={labelId}
                      className={styles.awardNomineeDraftCount}
                    >
                      {index + 1}
                    </span>
                    <Select
                      value={draft.recipient_id || null}
                      options={nomineeOptionsForDraft(draft)}
                      placeholder={
                        activeNomineeAward.recipient_type === 'player'
                          ? 'Select player'
                          : 'Select team'
                      }
                      emptyMessage="No nominees available"
                      onChange={(value) => updateNomineeDraft(draft.id, value)}
                      searchable
                      ariaLabelledBy={labelId}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outlined"
                      intent="danger"
                      icon="cancel"
                      iconHeight="field"
                      tooltip="Remove nominee"
                      aria-label={`Remove nominee ${index + 1}`}
                      disabled={nomineeDrafts.length <= 1}
                      onClick={() => removeNomineeDraft(draft.id)}
                    />
                  </div>
                );
              })}
              <div className={styles.awardNomineeAddRow}>
                <span aria-hidden="true" />
                <Button
                  type="button"
                  size="sm"
                  variant="outlined"
                  intent="accent"
                  icon="add"
                  className={styles.awardNomineeAddButton}
                  onClick={addNomineeDraft}
                >
                  Add Nominee
                </Button>
              </div>
            </div>
            {nomineeDraftHasDuplicates && (
              <p className={styles.awardTeamSelectionError}>
                Each nominee row must have a different selection.
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!teamSelectionAward}
        title={teamSelectionAward ? `Set Team: ${teamSelectionAward.name}` : 'Set Team'}
        onClose={closeTeamSelectionModal}
        confirmForm="season-award-team-selection-form"
        confirmLabel={teamSelectionForm.formState.isSubmitting ? 'Saving...' : 'Save Team'}
        confirmIcon="save"
        confirmDisabled={
          teamSelectionForm.formState.isSubmitting ||
          !teamSelectionComplete ||
          teamSelectionHasDuplicates
        }
        busy={teamSelectionForm.formState.isSubmitting}
        size="lg"
      >
        <form
          id="season-award-team-selection-form"
          className={styles.awardTeamSelectionForm}
          onSubmit={submitTeamSelection}
        >
          {TEAM_SELECTION_GROUPS.map((group) => (
            <fieldset
              key={group.group}
              className={styles.awardTeamSelectionFieldset}
            >
              <legend>{group.label}</legend>
              <div className={styles.awardTeamSelectionFields}>
                {TEAM_SELECTION_SLOTS.filter((slot) => slot.group === group.group).map((slot) => (
                  <Field
                    key={slot.field}
                    control={teamSelectionForm.control}
                    name={slot.field}
                    type="select"
                    label={slot.label}
                    options={teamSelectionOptions[slot.group]}
                    searchable
                    required
                    rules={{ required: `${slot.label} is required` }}
                  />
                ))}
              </div>
            </fieldset>
          ))}
          {teamSelectionHasDuplicates && (
            <p className={styles.awardTeamSelectionError}>
              Each team selection slot must use a different player.
            </p>
          )}
        </form>
      </Modal>
    </>
  );
};

interface RecipientListProps {
  title: string;
  empty: string;
  recipients: SeasonAwardRecord['recipients'];
  seasonAwardId: string | null;
  onDelete: (seasonAwardId: string, recipientId: string) => Promise<boolean>;
}

interface WinnerListProps {
  recipients: SeasonAwardRecipient[];
  seasonAwardId: string | null;
  onDelete: (seasonAwardId: string, recipientId: string) => Promise<boolean>;
}

const recipientName = (recipient: SeasonAwardRecipient) =>
  recipient.player_name ?? recipient.team_name ?? 'Unknown';

const recipientInitials = (recipient: SeasonAwardRecipient) => {
  const name = recipientName(recipient);
  const parts = name.split(' ').filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2);
};

const recipientMeta = (recipient: SeasonAwardRecipient) =>
  [
    recipient.jersey_number != null ? `#${recipient.jersey_number}` : null,
    recipient.position,
    recipient.team_code,
  ]
    .filter(Boolean)
    .join(' | ');

const AwardTeamSelectionList = ({ recipients, seasonAwardId, onDelete }: WinnerListProps) => {
  const byGroup = new Map<AwardTeamSelectionGroup, SeasonAwardRecipient[]>();
  recipients.forEach((recipient) => {
    const group = recipientTeamSelectionGroup(recipient);
    const list = byGroup.get(group) ?? [];
    list.push(recipient);
    byGroup.set(group, list);
  });

  for (const list of byGroup.values()) {
    list.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  }

  const assignedIds = new Set<string>();

  return (
    <div className={styles.awardTeamSelection}>
      {TEAM_SELECTION_GROUPS.map((group) => {
        const groupRecipients = byGroup.get(group.group) ?? [];
        const slots = Array.from({ length: group.count }, (_, index) => {
          const recipient = groupRecipients[index] ?? null;
          if (recipient) assignedIds.add(recipient.id);
          return recipient;
        });

        return (
          <div
            key={group.group}
            className={styles.awardTeamSelectionGroup}
          >
            <span className={styles.awardTeamSelectionGroupTitle}>{group.label}</span>
            <div className={styles.awardTeamSelectionSlots}>
              {slots.map((recipient, index) =>
                recipient ? (
                  <div
                    key={recipient.id}
                    className={styles.awardTeamSelectionSlot}
                  >
                    <PlayerAvatar
                      photo={recipient.player_photo}
                      initials={recipientInitials(recipient)}
                      primaryColor={recipient.team_primary_color ?? undefined}
                      textColor={recipient.team_text_color ?? undefined}
                      ringColor={recipient.team_primary_color ?? undefined}
                      size={34}
                    />
                    <div className={styles.awardTeamSelectionText}>
                      <strong>{recipientName(recipient)}</strong>
                      <span>
                        {[
                          recipient.position,
                          recipient.jersey_number != null ? `#${recipient.jersey_number}` : null,
                          recipient.team_code,
                        ]
                          .filter(Boolean)
                          .join(' | ')}
                      </span>
                    </div>
                    {seasonAwardId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        intent="danger"
                        icon="delete"
                        tooltip="Remove"
                        onClick={() => onDelete(seasonAwardId, recipient.id)}
                      />
                    )}
                  </div>
                ) : (
                  <div
                    key={`${group.group}-${index}`}
                    className={styles.awardTeamSelectionSlotEmpty}
                  >
                    Empty {group.group.toLowerCase()} slot
                  </div>
                ),
              )}
            </div>
          </div>
        );
      })}
      {recipients.some((recipient) => !assignedIds.has(recipient.id)) && (
        <AwardRecipientList
          title="Additional"
          empty=""
          recipients={recipients.filter((recipient) => !assignedIds.has(recipient.id))}
          seasonAwardId={seasonAwardId}
          onDelete={onDelete}
        />
      )}
    </div>
  );
};

const AwardWinnerList = ({ recipients, seasonAwardId, onDelete }: WinnerListProps) => (
  <div className={styles.awardWinnerSection}>
    {recipients.length === 0 ? (
      <span className={styles.awardEmpty}>No winner recorded.</span>
    ) : (
      <div className={styles.awardWinnerGrid}>
        {recipients.map((recipient) => (
          <div
            key={recipient.id}
            className={styles.awardWinnerCard}
          >
            <div className={styles.awardWinnerImageWrap}>
              {recipient.recipient_type === 'team' ? (
                <TeamLogo
                  logo={recipient.team_logo}
                  code={recipient.team_code ?? 'T'}
                  primaryColor={recipient.team_primary_color}
                  textColor={recipient.team_text_color}
                  size={86}
                  className={styles.awardWinnerTeamLogo}
                />
              ) : (
                <PlayerAvatar
                  photo={recipient.player_photo}
                  initials={recipientInitials(recipient)}
                  primaryColor={recipient.team_primary_color ?? undefined}
                  textColor={recipient.team_text_color ?? undefined}
                  ringColor={recipient.team_primary_color ?? undefined}
                  size={88}
                />
              )}
            </div>
            <div className={styles.awardWinnerInfo}>
              <strong>{recipientName(recipient)}</strong>
              {recipientMeta(recipient) && <span>{recipientMeta(recipient)}</span>}
            </div>
            {seasonAwardId && (
              <div className={styles.awardWinnerOverlay}>
                <Button
                  type="button"
                  size="sm"
                  intent="danger"
                  icon="delete"
                  tooltip="Remove winner"
                  onClick={() => onDelete(seasonAwardId, recipient.id)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

const AwardRecipientList = ({
  title,
  empty,
  recipients,
  seasonAwardId,
  onDelete,
}: RecipientListProps) => (
  <div className={styles.awardRecipients}>
    <span className={styles.awardRecipientsTitle}>{title}</span>
    {recipients.length === 0 ? (
      empty ? (
        <span className={styles.awardEmpty}>{empty}</span>
      ) : null
    ) : (
      <div className={styles.awardRecipientList}>
        {recipients.map((recipient) => (
          <div
            key={recipient.id}
            className={styles.awardRecipient}
          >
            {recipient.recipient_type === 'team' && (
              <TeamLogo
                logo={recipient.team_logo}
                code={recipient.team_code ?? 'T'}
                size={28}
              />
            )}
            <div className={styles.awardRecipientText}>
              <strong>{recipient.player_name ?? recipient.team_name ?? 'Unknown'}</strong>
              {recipientMeta(recipient) && <span>{recipientMeta(recipient)}</span>}
            </div>
            {seasonAwardId && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                intent="danger"
                icon="delete"
                tooltip="Remove"
                onClick={() => onDelete(seasonAwardId, recipient.id)}
              />
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

export default SeasonAwardsTab;
