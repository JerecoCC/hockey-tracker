import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import useSeasonAwards, {
  type AwardRecipientRole,
  type AwardRecipientType,
  type SeasonAwardRecord,
} from '@/hooks/useSeasonAwards';
import type { SeasonTeam } from '@/hooks/useSeasonDetails';
import type { TeamStandingRecord } from '@/hooks/useSeasonStandings';
import type { GoalieStatRecord, SkaterStatRecord } from '@/hooks/useSeasonStats';
import styles from './SeasonDetails.module.scss';

const METHOD_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'voted', label: 'Voted' },
  { value: 'automatic', label: 'Automatic' },
  { value: 'playoff', label: 'Playoff' },
];

const ROLE_OPTIONS = [
  { value: 'winner', label: 'Winner' },
  { value: 'nominee', label: 'Nominee' },
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

interface RecipientFormValues {
  recipient_id: string;
  role: AwardRecipientRole;
  rank: string;
  vote_points: string;
  stat_value: string;
  notes: string;
}

interface SuggestedRecipient {
  id: string;
  type: AwardRecipientType;
  label: string;
  statValue: string;
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

const methodLabel = (method: string) =>
  METHOD_OPTIONS.find((option) => option.value === method)?.label ?? method;

const statLabel = (statKey: string | null) =>
  statKey ? (STAT_OPTIONS.find((option) => option.value === statKey)?.label ?? statKey) : null;

const numberOrNull = (value: string) => {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const SeasonAwardsTab = ({ seasonId, seasonTeams, skaters, goalies, standings }: Props) => {
  const { awards, loading, createAward, addRecipient, deleteRecipient } = useSeasonAwards(seasonId);
  const [recipientAward, setRecipientAward] = useState<SeasonAwardRecord | null>(null);
  const [defaultRole, setDefaultRole] = useState<AwardRecipientRole>('winner');

  const recipientForm = useForm<RecipientFormValues>({
    defaultValues: {
      recipient_id: '',
      role: 'winner',
      rank: '',
      vote_points: '',
      stat_value: '',
      notes: '',
    },
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

  const teamOptions = seasonTeams.map((team) => ({
    value: team.id,
    label: team.name,
    logo: team.logo,
    code: team.code,
  }));

  const suggestions = useMemo(() => {
    const byAward = new Map<string, SuggestedRecipient>();
    for (const award of awards) {
      if (award.selection_method !== 'automatic' || !award.stat_key) continue;

      if (award.recipient_type === 'team') {
        const field = award.stat_key === 'standings_points' ? 'points' : award.stat_key;
        const candidates = standings.filter((team) => Number.isFinite(Number((team as any)[field])));
        const top = candidates.sort((a, b) => Number((b as any)[field]) - Number((a as any)[field]))[0];
        if (top) {
          byAward.set(award.award_id, {
            id: top.team_id,
            type: 'team',
            label: top.team_name ?? top.team_code ?? 'Team',
            statValue: String((top as any)[field]),
          });
        }
        continue;
      }

      if (['points', 'goals', 'assists'].includes(award.stat_key)) {
        const top = [...skaters].sort(
          (a, b) => Number((b as any)[award.stat_key!]) - Number((a as any)[award.stat_key!]),
        )[0];
        if (top) {
          byAward.set(award.award_id, {
            id: top.player_id,
            type: 'player',
            label: playerName(top),
            statValue: String((top as any)[award.stat_key]),
          });
        }
      } else if (['save_pct', 'gaa', 'shutouts'].includes(award.stat_key)) {
        const ascending = award.stat_key === 'gaa';
        const candidates = goalies.filter((goalie) => (goalie as any)[award.stat_key!] != null);
        const top = candidates.sort((a, b) => {
          const diff = Number((a as any)[award.stat_key!]) - Number((b as any)[award.stat_key!]);
          return ascending ? diff : -diff;
        })[0];
        if (top) {
          byAward.set(award.award_id, {
            id: top.player_id,
            type: 'player',
            label: playerName(top),
            statValue: String((top as any)[award.stat_key]),
          });
        }
      }
    }
    return byAward;
  }, [awards, goalies, skaters, standings]);

  const openRecipientModal = (award: SeasonAwardRecord, role: AwardRecipientRole) => {
    setRecipientAward(award);
    setDefaultRole(role);
    recipientForm.reset({
      recipient_id: '',
      role,
      rank: '',
      vote_points: '',
      stat_value: '',
      notes: '',
    });
  };

  const closeRecipientModal = () => {
    setRecipientAward(null);
    recipientForm.reset();
  };

  const submitRecipient = recipientForm.handleSubmit(async (values) => {
    if (!recipientAward?.season_award_id) return;
    const ok = await addRecipient(recipientAward.season_award_id, {
      recipient_type: recipientAward.recipient_type,
      player_id: recipientAward.recipient_type === 'player' ? values.recipient_id : null,
      team_id: recipientAward.recipient_type === 'team' ? values.recipient_id : null,
      role: values.role,
      rank: numberOrNull(values.rank),
      vote_points: numberOrNull(values.vote_points),
      stat_value: values.stat_value || null,
      notes: values.notes || null,
    });
    if (ok) closeRecipientModal();
  });

  const addSuggestedWinner = async (award: SeasonAwardRecord, suggestion: SuggestedRecipient) => {
    if (!award.season_award_id) return;
    await addRecipient(award.season_award_id, {
      recipient_type: suggestion.type,
      player_id: suggestion.type === 'player' ? suggestion.id : null,
      team_id: suggestion.type === 'team' ? suggestion.id : null,
      role: 'winner',
      stat_value: suggestion.statValue,
    });
  };

  const attachAwardToSeason = (award: SeasonAwardRecord) => createAward({ award_id: award.award_id });

  return (
    <>
      <Card
        title="Awards"
      >
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
              return (
                <section
                  key={award.award_id}
                  className={styles.awardItem}
                >
                  <div className={styles.awardHeader}>
                    <div className={styles.awardTitleBlock}>
                      <h4>{award.name}</h4>
                      <div className={styles.awardMeta}>
                        <span>{award.recipient_type}</span>
                        <span>{methodLabel(award.selection_method)}</span>
                        {statLabel(award.stat_key) && <span>{statLabel(award.stat_key)}</span>}
                        <span>{award.awarded_after_playoffs ? 'After playoffs' : 'Regular season'}</span>
                      </div>
                      {award.description && <p>{award.description}</p>}
                    </div>
                    <div className={styles.awardActions}>
                      {!award.season_award_id ? (
                        <Button
                          size="sm"
                          variant="outlined"
                          intent="neutral"
                          onClick={() => attachAwardToSeason(award)}
                        >
                          Track
                        </Button>
                      ) : (
                        <>
                          {suggestion && (
                            <Button
                              size="sm"
                              variant="outlined"
                              intent="success"
                              icon="auto_awesome"
                              onClick={() => addSuggestedWinner(award, suggestion)}
                            >
                              Use {suggestion.label}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outlined"
                            intent="neutral"
                            onClick={() => openRecipientModal(award, 'nominee')}
                          >
                            Nominee
                          </Button>
                          <Button
                            size="sm"
                            icon="emoji_events"
                            onClick={() => openRecipientModal(award, 'winner')}
                          >
                            Winner
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <AwardRecipientList
                    title="Winners"
                    empty="No winner recorded."
                    recipients={winners}
                    seasonAwardId={award.season_award_id}
                    onDelete={deleteRecipient}
                  />
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
        title={`${defaultRole === 'winner' ? 'Record Winner' : 'Add Nominee'}${
          recipientAward ? `: ${recipientAward.name}` : ''
        }`}
        onClose={closeRecipientModal}
        confirmForm="season-award-recipient-form"
        confirmLabel="Save"
        confirmIcon="save"
      >
        {recipientAward && (
          <form
            id="season-award-recipient-form"
            className={styles.awardForm}
            onSubmit={submitRecipient}
          >
            <Field
              control={recipientForm.control}
              name="recipient_id"
              type="select"
              label={recipientAward.recipient_type === 'player' ? 'Player' : 'Team'}
              options={recipientAward.recipient_type === 'player' ? playerOptions : teamOptions}
              searchable
              required
              rules={{ required: 'Recipient is required' }}
            />
            <div className={styles.awardFormGrid}>
              <Field
                control={recipientForm.control}
                name="role"
                type="select"
                label="Role"
                options={ROLE_OPTIONS}
              />
              <Field
                control={recipientForm.control}
                name="rank"
                type="number"
                label="Rank"
                min={1}
              />
            </div>
            <div className={styles.awardFormGrid}>
              <Field
                control={recipientForm.control}
                name="vote_points"
                type="number"
                label="Vote Points"
                min={0}
              />
              <Field
                control={recipientForm.control}
                name="stat_value"
                label="Stat Value"
              />
            </div>
            <Field
              control={recipientForm.control}
              name="notes"
              type="textarea"
              label="Notes"
              rows={2}
            />
          </form>
        )}
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
      empty ? <span className={styles.awardEmpty}>{empty}</span> : null
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
              <span>
                {[
                  recipient.rank ? `Rank ${recipient.rank}` : null,
                  recipient.vote_points != null ? `${recipient.vote_points} votes` : null,
                  recipient.stat_value,
                ]
                  .filter(Boolean)
                  .join(' · ')}
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
        ))}
      </div>
    )}
  </div>
);

export default SeasonAwardsTab;
