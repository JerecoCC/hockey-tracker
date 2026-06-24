import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Accordion from '@/components/Accordion/Accordion';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import Field from '@/components/Field/Field';
import InfoTooltip from '@/components/InfoTooltip/InfoTooltip';
import ListItem from '@/components/ListItem/ListItem';
import Modal from '@/components/Modal/Modal';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import SearchField from '@/components/SearchField/SearchField';
import SelectableListItem from '@/components/SelectableListItem/SelectableListItem';
import Select, { type SelectOption } from '@/components/Select/Select';
import Skeleton from '@/components/Skeleton/Skeleton';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import { usePlayoffSeries, type PlayoffSeriesRecord } from '@/hooks/useGames';
import useSeasonAwards, {
  type AwardRecipientType,
  type SeasonAwardRecipient,
  type SeasonAwardRecord,
} from '@/hooks/useSeasonAwards';
import type { SeasonTeam } from '@/hooks/useSeasonDetails';
import type { TeamStandingRecord } from '@/hooks/useSeasonStandings';
import type { GoalieStatRecord, SkaterStatRecord } from '@/hooks/useSeasonStats';
import {
  buildLeaguePlayerDetailsPath,
  buildPlayerDetailsPath,
  buildTeamDetailsPath,
} from '@/lib/routeSlugs';
import styles from './SeasonDetails.module.scss';

const TEAM_SELECTION_AWARD_NAMES = new Set([
  'First All-Star Team',
  'Second All-Star Team',
  'All-Rookie Team',
]);

const POSITION_LABELS: Record<string, string> = {
  F: 'Forward',
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defense',
  G: 'Goalie',
};

const STAT_LABELS: Record<string, string> = {
  points: 'Player Points',
  goals: 'Player Goals',
  assists: 'Player Assists',
  save_pct: 'Goalie Save %',
  gaa: 'Goalie GAA',
  shutouts: 'Goalie Shutouts',
  standings_points: 'Team Points',
  wins: 'Team Wins',
  playoff_champion: 'Playoff Champion',
};

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

interface WinnerChecklistOption {
  id: string;
  name: string;
  recipient_type: AwardRecipientType;
  leadingImage?: string | null;
  leadingImagePlaceholder?: string;
  leadingImagePrimaryColor?: string | null;
  leadingImageTextColor?: string | null;
  image?: string | null;
  imagePlaceholder?: string;
  imageShape?: 'square' | 'circle';
  imagePrimaryColor?: string | null;
  imageTextColor?: string | null;
  subtitle?: string;
  searchText: string;
}

interface Props {
  seasonId: string;
  leagueCode: string | null;
  leagueId: string | null;
  seasonName: string | null;
  seasonTeams: SeasonTeam[];
  skaters: SkaterStatRecord[];
  goalies: GoalieStatRecord[];
  standings: TeamStandingRecord[];
}

const playerName = (player: Pick<SkaterStatRecord, 'first_name' | 'last_name'>) =>
  [player.first_name, player.last_name].filter(Boolean).join(' ');

const titleCase = (value: string) =>
  value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : value;

const statLabel = (statKey: string | null | undefined) =>
  statKey ? (STAT_LABELS[statKey] ?? statKey) : null;

const awardSelectionSubtitle = (award: SeasonAwardRecord) =>
  [
    award.recipient_type === 'player' ? 'Player' : 'Team',
    titleCase(award.selection_method),
    statLabel(award.stat_key),
    award.uses_nominees ? 'Nominees' : null,
    award.allow_multiple_winners ? 'Multiple winners' : null,
  ]
    .filter(Boolean)
    .join(' | ');

const numericFieldValue = (record: object, field: string | null | undefined) => {
  if (!field) return null;
  const value = (record as Record<string, unknown>)[field];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isTeamSelectionAward = (awardName: string) => TEAM_SELECTION_AWARD_NAMES.has(awardName);

const supportsNominees = (award: SeasonAwardRecord) =>
  award.uses_nominees && !isTeamSelectionAward(award.name);

const usesWinnerChecklist = (award: SeasonAwardRecord) =>
  !isTeamSelectionAward(award.name) && award.allow_multiple_winners;

const playoffChampionSuggestion = (
  series: PlayoffSeriesRecord[],
  seasonTeams: SeasonTeam[],
): SuggestedRecipient | null => {
  const maxRound = series.reduce((round, item) => Math.max(round, item.round), 0);
  if (maxRound <= 0) return null;

  const finalWinners = series.filter((item) => item.round === maxRound && item.winner_team_id);
  if (finalWinners.length !== 1) return null;

  const finalSeries = finalWinners[0];
  const id = finalSeries.winner_team_id;
  if (!id) return null;

  const seasonTeam = seasonTeams.find((team) => team.id === id);
  const seriesTeam =
    finalSeries.home_team_id === id
      ? {
          name: finalSeries.home_team_name,
          code: finalSeries.home_team_code,
        }
      : finalSeries.away_team_id === id
        ? {
            name: finalSeries.away_team_name,
            code: finalSeries.away_team_code,
          }
        : null;

  return {
    id,
    type: 'team',
    label: seasonTeam?.name ?? seriesTeam?.name ?? seriesTeam?.code ?? 'Team',
  };
};

const playoffChampionFinalSubtitle = (series: PlayoffSeriesRecord[]) => {
  const maxRound = series.reduce((round, item) => Math.max(round, item.round), 0);
  if (maxRound <= 0) return null;

  const finalSeries = series.find(
    (item) => item.round === maxRound && item.status === 'complete' && item.winner_team_id,
  );
  if (!finalSeries?.winner_team_id) return null;

  const winnerIsHome = finalSeries.winner_team_id === finalSeries.home_team_id;
  const wins = winnerIsHome ? finalSeries.home_wins : finalSeries.away_wins;
  const opponentWins = winnerIsHome ? finalSeries.away_wins : finalSeries.home_wins;
  return `Champion - Final ${wins}-${opponentWins}`;
};

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

const SeasonAwardsTab = ({
  seasonId,
  leagueCode,
  leagueId,
  seasonName,
  seasonTeams,
  skaters,
  goalies,
  standings,
}: Props) => {
  const { awards, loading, updateTrackedAwards, addRecipient, deleteRecipient, refresh } =
    useSeasonAwards(seasonId);
  const { series: playoffSeries } = usePlayoffSeries(seasonId);
  const [awardSelectionOpen, setAwardSelectionOpen] = useState(false);
  const [awardSelectionDraftIds, setAwardSelectionDraftIds] = useState<string[]>([]);
  const [awardSelectionQuery, setAwardSelectionQuery] = useState('');
  const [awardSelectionSaving, setAwardSelectionSaving] = useState(false);
  const [recipientAward, setRecipientAward] = useState<SeasonAwardRecord | null>(null);
  const [recipientWinnerDraftIds, setRecipientWinnerDraftIds] = useState<string[]>([]);
  const [recipientWinnerQuery, setRecipientWinnerQuery] = useState('');
  const [recipientWinnerSaving, setRecipientWinnerSaving] = useState(false);
  const [nomineeAward, setNomineeAward] = useState<SeasonAwardRecord | null>(null);
  const [nomineeDrafts, setNomineeDrafts] = useState<NomineeDraft[]>([]);
  const [nomineesSaving, setNomineesSaving] = useState(false);
  const [teamSelectionAward, setTeamSelectionAward] = useState<SeasonAwardRecord | null>(null);
  const [suggestedWinnerSavingAwardId, setSuggestedWinnerSavingAwardId] = useState<string | null>(
    null,
  );

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

  const recipientHref = (recipient: SeasonAwardRecipient) => {
    if (recipient.recipient_type === 'team') {
      return recipient.team_id || recipient.team_code
        ? buildTeamDetailsPath({
            leagueCode,
            leagueId,
            teamCode: recipient.team_code,
            teamId: recipient.team_id,
            seasonName,
            seasonId,
          })
        : undefined;
    }

    if (!recipient.player_name) return undefined;
    const parts = recipient.player_name.split(' ').filter(Boolean);
    if (parts.length === 0) return undefined;
    const playerPathInput = {
      leagueCode,
      leagueId,
      firstName: parts.slice(0, -1).join(' ') || parts[0],
      lastName: parts.length > 1 ? parts[parts.length - 1] : '',
    };
    if (!recipient.team_id && !recipient.team_code) {
      return buildLeaguePlayerDetailsPath(playerPathInput);
    }

    return buildPlayerDetailsPath({
      teamCode: recipient.team_code,
      teamId: recipient.team_id,
      ...playerPathInput,
    });
  };

  const recipientOptionsForAward = (award: SeasonAwardRecord): SelectOption[] => {
    if (supportsNominees(award)) {
      return award.recipients
        .filter((recipient) => recipient.role === 'nominee')
        .map((recipient) => ({
          value: recipientValueId(recipient) ?? '',
          label: recipientName(recipient),
          logo: recipient.team_logo,
          code: recipient.team_code ?? undefined,
        }))
        .filter((option) => option.value);
    }

    return award.recipient_type === 'player' ? playerOptions : teamOptions;
  };

  const playerToWinnerOption = (
    player: SkaterStatRecord | GoalieStatRecord,
  ): WinnerChecklistOption => {
    const position = 'position' in player ? player.position : 'G';
    const subtitle = position ? (POSITION_LABELS[position] ?? position) : undefined;
    const name = playerName(player);

    return {
      id: player.player_id,
      name,
      recipient_type: 'player',
      leadingImage: player.team_logo,
      leadingImagePlaceholder: player.team_code ?? undefined,
      leadingImagePrimaryColor: player.team_primary_color,
      leadingImageTextColor: player.team_text_color,
      image: player.photo,
      imageShape: 'circle',
      imagePlaceholder: `${player.first_name[0] ?? ''}${player.last_name[0] ?? ''}` || undefined,
      imagePrimaryColor: player.team_primary_color,
      imageTextColor: player.team_text_color,
      subtitle,
      searchText: [name, subtitle, player.team_name, player.team_code].filter(Boolean).join(' '),
    };
  };

  const teamToWinnerOption = (team: SeasonTeam): WinnerChecklistOption => ({
    id: team.id,
    name: team.name,
    recipient_type: 'team',
    image: team.logo,
    imagePlaceholder: team.code,
    imagePrimaryColor: team.primary_color,
    imageTextColor: team.text_color,
    searchText: [team.name, team.code].filter(Boolean).join(' '),
  });

  const nomineeToWinnerOption = (recipient: SeasonAwardRecipient): WinnerChecklistOption | null => {
    const id = recipientValueId(recipient);
    if (!id) return null;
    const name = recipientName(recipient);
    const subtitle =
      recipient.recipient_type === 'player' ? recipientPositionLabel(recipient) : undefined;

    return {
      id,
      name,
      recipient_type: recipient.recipient_type,
      leadingImage: recipient.recipient_type === 'player' ? recipient.team_logo : undefined,
      leadingImagePlaceholder:
        recipient.recipient_type === 'player' ? (recipient.team_code ?? undefined) : undefined,
      leadingImagePrimaryColor: recipient.team_primary_color,
      leadingImageTextColor: recipient.team_text_color,
      image: recipient.recipient_type === 'player' ? recipient.player_photo : recipient.team_logo,
      imageShape: recipient.recipient_type === 'player' ? 'circle' : 'square',
      imagePlaceholder:
        recipient.recipient_type === 'player'
          ? recipientInitials(recipient)
          : (recipient.team_code ?? undefined),
      imagePrimaryColor: recipient.team_primary_color,
      imageTextColor: recipient.team_text_color,
      subtitle,
      searchText: [name, subtitle, recipient.team_name, recipient.team_code]
        .filter(Boolean)
        .join(' '),
    };
  };

  const suggestions = useMemo(() => {
    const byAward = new Map<string, SuggestedRecipient>();
    for (const award of awards) {
      if (!award.stat_key) continue;
      const isPlayoffChampionAward =
        award.recipient_type === 'team' && award.stat_key === 'playoff_champion';
      if (award.selection_method !== 'automatic' && !isPlayoffChampionAward) continue;

      if (award.recipient_type === 'team') {
        if (award.stat_key === 'playoff_champion') {
          const suggestion = playoffChampionSuggestion(playoffSeries, seasonTeams);
          if (suggestion) byAward.set(award.award_id, suggestion);
          continue;
        }

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
  }, [awards, goalies, playoffSeries, seasonTeams, skaters, standings]);

  const trackedAwards = useMemo(
    () => awards.filter((award) => award.season_award_id),
    [awards],
  );
  const trackedAwardIds = trackedAwards.map((award) => award.award_id);
  const sortedTrackedAwardIds = [...trackedAwardIds].sort().join('|');
  const sortedAwardSelectionDraftIds = [...awardSelectionDraftIds].sort().join('|');
  const awardSelectionHasChanges = sortedTrackedAwardIds !== sortedAwardSelectionDraftIds;
  const awardSelectionCountLabel =
    awardSelectionDraftIds.length === 1 ? '1 award selected' : `${awardSelectionDraftIds.length} awards selected`;
  const filteredAwardSelectionAwards = awards.filter((award) => {
    const query = awardSelectionQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      award.name.toLowerCase().includes(query) ||
      award.description?.toLowerCase().includes(query) ||
      award.selection_method.toLowerCase().includes(query) ||
      award.recipient_type.toLowerCase().includes(query)
    );
  });

  const activeRecipientAward = recipientAward
    ? (awards.find((award) => award.award_id === recipientAward.award_id) ?? recipientAward)
    : null;
  const activeNomineeAward = nomineeAward
    ? (awards.find((award) => award.award_id === nomineeAward.award_id) ?? nomineeAward)
    : null;
  const recipientUsesWinnerChecklist =
    !!activeRecipientAward && usesWinnerChecklist(activeRecipientAward);
  const activeRecipientNominees =
    activeRecipientAward?.recipients.filter((recipient) => recipient.role === 'nominee') ?? [];
  const activeRecipientWinners =
    activeRecipientAward?.recipients.filter((recipient) => recipient.role === 'winner') ?? [];
  const activeRecipientWinnerOptions = activeRecipientAward
    ? supportsNominees(activeRecipientAward)
      ? activeRecipientNominees
          .map(nomineeToWinnerOption)
          .filter((option): option is WinnerChecklistOption => option !== null)
      : activeRecipientAward.recipient_type === 'player'
        ? players.map(playerToWinnerOption)
        : seasonTeams.map(teamToWinnerOption)
    : [];
  const activeRecipientWinnerIds = activeRecipientWinners
    .map(recipientValueId)
    .filter((id): id is string => !!id);
  const sortedActiveRecipientWinnerIds = [...activeRecipientWinnerIds].sort().join('|');
  const sortedRecipientWinnerDraftIds = [...recipientWinnerDraftIds].sort().join('|');
  const recipientWinnerHasChanges =
    sortedActiveRecipientWinnerIds !== sortedRecipientWinnerDraftIds;
  const recipientWinnerCountLabel =
    recipientWinnerDraftIds.length === 1
      ? '1 winner selected'
      : `${recipientWinnerDraftIds.length} winners selected`;
  const activeRecipientWinnerSourceLabel =
    activeRecipientAward && supportsNominees(activeRecipientAward) ? 'nominees' : 'recipients';
  const filteredRecipientWinnerOptions = activeRecipientWinnerOptions.filter((option) => {
    const query = recipientWinnerQuery.trim().toLowerCase();
    if (!query) return true;
    return option.searchText.toLowerCase().includes(query);
  });

  const openAwardSelectionModal = () => {
    setAwardSelectionDraftIds(trackedAwardIds);
    setAwardSelectionQuery('');
    setAwardSelectionOpen(true);
  };

  const closeAwardSelectionModal = () => {
    setAwardSelectionOpen(false);
    setAwardSelectionDraftIds([]);
    setAwardSelectionQuery('');
    setAwardSelectionSaving(false);
  };

  const toggleAwardSelection = (award: SeasonAwardRecord) => {
    const selected = awardSelectionDraftIds.includes(award.award_id);
    const locked = selected && !!award.season_award_id && award.recipients.length > 0;
    if (locked) return;
    setAwardSelectionDraftIds((draftIds) =>
      selected
        ? draftIds.filter((awardId) => awardId !== award.award_id)
        : [...draftIds, award.award_id],
    );
  };

  const saveAwardSelection = async () => {
    if (!awardSelectionHasChanges || awardSelectionSaving) return;
    setAwardSelectionSaving(true);
    const ok = await updateTrackedAwards(awardSelectionDraftIds);
    setAwardSelectionSaving(false);
    if (ok) closeAwardSelectionModal();
  };

  const openRecipientModal = (award: SeasonAwardRecord) => {
    const winnerIds = award.recipients
      .filter((recipient) => recipient.role === 'winner')
      .map(recipientValueId)
      .filter((id): id is string => !!id);
    setRecipientAward(award);
    setRecipientWinnerDraftIds(award.allow_multiple_winners ? winnerIds : winnerIds.slice(0, 1));
    setRecipientWinnerQuery('');
    setRecipientWinnerSaving(false);
    recipientForm.reset({
      recipient_id: award.allow_multiple_winners ? '' : (winnerIds[0] ?? ''),
    });
  };

  const closeRecipientModal = () => {
    setRecipientAward(null);
    setRecipientWinnerDraftIds([]);
    setRecipientWinnerQuery('');
    setRecipientWinnerSaving(false);
    recipientForm.reset();
  };

  const toggleRecipientWinner = (recipientId: string) => {
    if (!activeRecipientAward || recipientWinnerSaving) return;
    const selected = recipientWinnerDraftIds.includes(recipientId);
    setRecipientWinnerDraftIds((draftIds) =>
      selected
        ? draftIds.filter((id) => id !== recipientId)
        : activeRecipientAward.allow_multiple_winners
          ? [...draftIds, recipientId]
          : [recipientId],
    );
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
    if (!activeRecipientAward.allow_multiple_winners) {
      for (const recipient of activeRecipientWinners) {
        const ok = await deleteRecipient(activeRecipientAward.season_award_id, recipient.id, {
          silent: true,
          refresh: false,
        });
        if (!ok) return;
      }
    }
    const ok = await addRecipient(activeRecipientAward.season_award_id, {
      recipient_type: activeRecipientAward.recipient_type,
      player_id: activeRecipientAward.recipient_type === 'player' ? values.recipient_id : null,
      team_id: activeRecipientAward.recipient_type === 'team' ? values.recipient_id : null,
      role: 'winner',
    });
    if (ok) closeRecipientModal();
  });

  const submitRecipientWinners = async () => {
    if (
      !activeRecipientAward?.season_award_id ||
      !recipientUsesWinnerChecklist ||
      !recipientWinnerHasChanges ||
      recipientWinnerSaving
    ) {
      return;
    }

    setRecipientWinnerSaving(true);

    const desiredRecipientIds = new Set(recipientWinnerDraftIds);
    const allowedRecipientIds = new Set(activeRecipientWinnerOptions.map((option) => option.id));
    const winnersToKeep = new Set<string>();

    for (const recipient of activeRecipientWinners) {
      const recipientId = recipientValueId(recipient);
      if (recipientId && desiredRecipientIds.has(recipientId) && !winnersToKeep.has(recipientId)) {
        winnersToKeep.add(recipientId);
        desiredRecipientIds.delete(recipientId);
        continue;
      }

      const ok = await deleteRecipient(activeRecipientAward.season_award_id, recipient.id, {
        silent: true,
        refresh: false,
      });
      if (!ok) {
        setRecipientWinnerSaving(false);
        return;
      }
    }

    for (const recipientId of desiredRecipientIds) {
      if (!allowedRecipientIds.has(recipientId)) continue;

      const ok = await addRecipient(
        activeRecipientAward.season_award_id,
        {
          recipient_type: activeRecipientAward.recipient_type,
          player_id: activeRecipientAward.recipient_type === 'player' ? recipientId : null,
          team_id: activeRecipientAward.recipient_type === 'team' ? recipientId : null,
          role: 'winner',
        },
        {
          silent: true,
          refresh: false,
        },
      );
      if (!ok) {
        setRecipientWinnerSaving(false);
        return;
      }
    }

    refresh();
    closeRecipientModal();
  };

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
    const existingWinners = award.recipients.filter((recipient) => recipient.role === 'winner');
    const suggestionAlreadyRecorded = existingWinners.some(
      (recipient) =>
        recipient.recipient_type === suggestion.type && recipientValueId(recipient) === suggestion.id,
    );
    if (suggestionAlreadyRecorded) return;

    setSuggestedWinnerSavingAwardId(award.award_id);
    if (!award.allow_multiple_winners) {
      for (const recipient of existingWinners) {
        const ok = await deleteRecipient(award.season_award_id, recipient.id, {
          silent: true,
          refresh: false,
        });
        if (!ok) {
          setSuggestedWinnerSavingAwardId(null);
          return;
        }
      }
    }

    try {
      await addRecipient(award.season_award_id, {
        recipient_type: suggestion.type,
        player_id: suggestion.type === 'player' ? suggestion.id : null,
        team_id: suggestion.type === 'team' ? suggestion.id : null,
        role: 'winner',
      });
    } finally {
      setSuggestedWinnerSavingAwardId(null);
    }
  };

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
      <Card
        title="Awards"
        action={
          !loading && awards.length > 0 ? (
            <Button
              type="button"
              size="sm"
              intent="accent"
              icon="playlist_add"
              onClick={openAwardSelectionModal}
            >
              Update Awards
            </Button>
          ) : null
        }
      >
        {loading ? (
          <p className={styles.tabPlaceholder}>Loading awards...</p>
        ) : awards.length === 0 ? (
          <p className={styles.tabPlaceholder}>No league award definitions yet.</p>
        ) : trackedAwards.length === 0 ? (
          <p className={styles.tabPlaceholder}>No awards tracked for this season.</p>
        ) : (
          <div className={styles.awardsList}>
            {trackedAwards.map((award) => {
              const winners = award.recipients.filter((recipient) => recipient.role === 'winner');
              const winnerRecipientIds = new Set(
                winners.map(recipientValueId).filter((id): id is string => !!id),
              );
              const nominees = award.recipients.filter((recipient) => recipient.role === 'nominee');
              const visibleNominees = nominees.filter((recipient) => {
                const recipientId = recipientValueId(recipient);
                return !recipientId || !winnerRecipientIds.has(recipientId);
              });
              const suggestion = suggestions.get(award.award_id);
              const isGroupedAward = isTeamSelectionAward(award.name);
              const canManageNominees = supportsNominees(award);
              const awardRequiresNominees = canManageNominees && nominees.length === 0;
              const awardRecipientLabel =
                award.recipient_type === 'player' ? 'Award Player' : 'Award Team';
              const winnerEmptyMessage =
                award.stat_key === 'playoff_champion'
                  ? 'No winner recorded.'
                  : 'No winners recorded.';
              const winnerSubtitle =
                award.stat_key === 'playoff_champion'
                  ? playoffChampionFinalSubtitle(playoffSeries)
                  : null;
              const isSuggestedWinnerSaving = suggestedWinnerSavingAwardId === award.award_id;
              const hasAutomaticWinnerAction =
                award.selection_method === 'automatic' || award.stat_key === 'playoff_champion';
              const hideRecordedAutomaticAction =
                hasAutomaticWinnerAction && !award.allow_multiple_winners && winners.length > 0;
              const showAwardAction = !hideRecordedAutomaticAction;
              const rendersColumnList =
                isGroupedAward || (!canManageNominees && award.allow_multiple_winners);
              const awardLabel = (
                <div className={styles.awardTitleBlock}>
                  <h4>
                    <span>{award.name}</span>
                    {award.description && (
                      <InfoTooltip
                        text={award.description}
                        size="0.9rem"
                      />
                    )}
                  </h4>
                </div>
              );
              const awardActions = canManageNominees || showAwardAction ? (
                <div className={styles.awardActions}>
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
                    {showAwardAction && isGroupedAward ? (
                      <Button
                        size="sm"
                        icon="groups"
                        tooltip="Set team"
                        aria-label="Set team"
                        onClick={() => openTeamSelectionModal(award)}
                      />
                    ) : showAwardAction ? (
                      <Button
                        size="sm"
                        icon="emoji_events"
                        tooltip="Set Winner"
                        aria-label={awardRecipientLabel}
                        disabled={awardRequiresNominees || isSuggestedWinnerSaving}
                        onClick={() => {
                          if (suggestion) {
                            void addSuggestedWinner(award, suggestion);
                            return;
                          }
                          openRecipientModal(award);
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null;

              return (
                <Accordion
                  key={award.award_id}
                  variant="static"
                  className={styles.awardItem}
                  rowClassName={styles.awardHeader}
                  bodyClassName={[
                    styles.awardContent,
                    rendersColumnList ? styles.awardContentList : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  label={awardLabel}
                  headerRight={awardActions}
                >
                  <div
                    className={[
                      styles.awardContentInner,
                      !canManageNominees && !isGroupedAward
                        ? styles.awardContentInnerNoNominees
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {isSuggestedWinnerSaving ? (
                      <AwardWinnerListSkeleton />
                    ) : isGroupedAward ? (
                      <AwardPlayerList
                        recipients={winners}
                        empty="No team recorded."
                        layout="column"
                        getRecipientHref={recipientHref}
                      />
                    ) : !canManageNominees && award.allow_multiple_winners ? (
                      <AwardPlayerList
                        recipients={winners}
                        empty="No winners recorded."
                        layout="column"
                        getRecipientHref={recipientHref}
                      />
                    ) : (
                      <>
                        <AwardWinnerList
                          recipients={winners}
                          empty={winnerEmptyMessage}
                          subtitle={winnerSubtitle}
                          getRecipientHref={recipientHref}
                        />
                        {canManageNominees && (
                          <AwardPlayerList
                            recipients={visibleNominees}
                            empty="No nominees recorded."
                            divided
                            getRecipientHref={recipientHref}
                          />
                        )}
                      </>
                    )}
                  </div>
                </Accordion>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={awardSelectionOpen}
        title="Update Awards"
        onClose={closeAwardSelectionModal}
        onConfirm={saveAwardSelection}
        confirmLabel={awardSelectionSaving ? 'Saving...' : 'Save Awards'}
        confirmIcon="save"
        confirmDisabled={awardSelectionSaving || !awardSelectionHasChanges}
        busy={awardSelectionSaving}
        footerStart={<span>{awardSelectionCountLabel}</span>}
      >
        <div className={styles.awardSelectionModal}>
          <SearchField
            value={awardSelectionQuery}
            onChange={setAwardSelectionQuery}
            placeholder="Search awards"
          />
          <ul className={styles.awardSelectionList}>
            {filteredAwardSelectionAwards.length === 0 ? (
              <li className={styles.awardSelectionEmpty}>No awards found.</li>
            ) : (
              filteredAwardSelectionAwards.map((award) => {
                const checked = awardSelectionDraftIds.includes(award.award_id);
                const locked = checked && !!award.season_award_id && award.recipients.length > 0;
                return (
                  <SelectableListItem
                    key={award.award_id}
                    checked={checked}
                    onToggle={() => toggleAwardSelection(award)}
                    hideImage
                    disabled={awardSelectionSaving || locked}
                    name={award.name}
                    subtitle={awardSelectionSubtitle(award)}
                    rightContent={
                      locked ? (
                        <span className={styles.awardSelectionLocked}>Recorded</span>
                      ) : undefined
                    }
                  />
                );
              })
            )}
          </ul>
        </div>
      </Modal>

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
        onConfirm={recipientUsesWinnerChecklist ? submitRecipientWinners : undefined}
        confirmForm={recipientUsesWinnerChecklist ? undefined : 'season-award-recipient-form'}
        confirmLabel={
          recipientUsesWinnerChecklist
            ? recipientWinnerSaving
              ? 'Saving...'
              : 'Save Winners'
            : recipientForm.formState.isSubmitting
            ? 'Saving...'
            : activeRecipientAward?.recipient_type === 'team'
              ? 'Award Team'
              : 'Award Player'
        }
        confirmIcon={recipientUsesWinnerChecklist ? 'save' : 'emoji_events'}
        confirmDisabled={
          recipientUsesWinnerChecklist
            ? recipientWinnerSaving || !recipientWinnerHasChanges
            : recipientForm.formState.isSubmitting ||
              !recipientForm.formState.isDirty ||
              !recipientForm.formState.isValid
        }
        busy={recipientUsesWinnerChecklist ? recipientWinnerSaving : recipientForm.formState.isSubmitting}
        footerStart={recipientUsesWinnerChecklist ? <span>{recipientWinnerCountLabel}</span> : undefined}
      >
        {activeRecipientAward && recipientUsesWinnerChecklist ? (
          <div className={styles.awardPlayerChecklist}>
            <div className={styles.awardPlayerChecklistControls}>
              <SearchField
                className={styles.awardPlayerChecklistSearch}
                value={recipientWinnerQuery}
                onChange={setRecipientWinnerQuery}
                placeholder={`Search ${activeRecipientWinnerSourceLabel}...`}
                autoFocus
              />
            </div>

            {filteredRecipientWinnerOptions.length === 0 ? (
              <p className={styles.awardPlayerChecklistEmpty}>
                {activeRecipientWinnerOptions.length === 0
                  ? `No ${activeRecipientWinnerSourceLabel} are available for this award.`
                  : `No ${activeRecipientWinnerSourceLabel} match "${recipientWinnerQuery}".`}
              </p>
            ) : (
              <ul className={styles.awardPlayerChecklistList}>
                {filteredRecipientWinnerOptions.map((option) => {
                  return (
                    <SelectableListItem
                      key={option.id}
                      checked={recipientWinnerDraftIds.includes(option.id)}
                      onToggle={() => toggleRecipientWinner(option.id)}
                      leadingImage={option.leadingImage}
                      leadingImagePlaceholder={option.leadingImagePlaceholder}
                      leadingImagePrimaryColor={option.leadingImagePrimaryColor}
                      leadingImageTextColor={option.leadingImageTextColor}
                      image={option.image}
                      imageShape={option.imageShape}
                      imagePlaceholder={option.imagePlaceholder}
                      imagePrimaryColor={option.imagePrimaryColor}
                      imageTextColor={option.imageTextColor}
                      name={option.name}
                      subtitle={option.subtitle}
                      disabled={recipientWinnerSaving}
                    />
                  );
                })}
              </ul>
            )}
          </div>
        ) : activeRecipientAward ? (
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
        ) : null}
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
                    placeholder={slot.label}
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

interface WinnerListProps {
  recipients: SeasonAwardRecipient[];
  empty: string;
  subtitle?: string | null;
  getRecipientHref: (recipient: SeasonAwardRecipient) => string | undefined;
}

const recipientName = (recipient: SeasonAwardRecipient) =>
  recipient.player_name ?? recipient.team_name ?? 'Unknown';

const recipientInitials = (recipient: SeasonAwardRecipient) => {
  const name = recipientName(recipient);
  const parts = name.split(' ').filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2);
};

const recipientPositionLabel = (recipient: SeasonAwardRecipient) =>
  recipient.position ? (POSITION_LABELS[recipient.position] ?? recipient.position) : undefined;

const AwardRecipientMeta = ({
  recipient,
  className,
}: {
  recipient: SeasonAwardRecipient;
  className?: string;
}) => {
  const textParts = [
    recipient.jersey_number != null ? `#${recipient.jersey_number}` : null,
    recipientPositionLabel(recipient),
  ].filter(Boolean);
  const hasTeam = !!recipient.team_code;

  return (
    <span className={[styles.awardRecipientMeta, className].filter(Boolean).join(' ')}>
      {textParts.map((part, index) => (
        <span key={part}>
          {index > 0 && <span aria-hidden="true"> | </span>}
          {part}
        </span>
      ))}
      {hasTeam && (
        <>
          {textParts.length > 0 && <span aria-hidden="true">|</span>}
          <span className={styles.awardRecipientMetaTeam}>
            <TeamLogo
              logo={recipient.team_logo}
              code={recipient.team_code ?? 'T'}
              primaryColor={recipient.team_primary_color}
              textColor={recipient.team_text_color}
              size={16}
            />
            <span>{recipient.team_code}</span>
          </span>
        </>
      )}
    </span>
  );
};

const AwardWinnerList = ({ recipients, empty, subtitle, getRecipientHref }: WinnerListProps) => {
  const cardImageSize = recipients.length > 1 ? 64 : 88;

  return (
    <ul
      className={[
        styles.awardWinnerCards,
        recipients.length > 1 ? styles.awardWinnerCardsMultiple : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {recipients.length === 0 ? (
        <li className={[styles.awardWinnerCard, styles.awardWinnerCardEmpty].join(' ')}>
          <span className={styles.awardEmptyMessage}>{empty}</span>
        </li>
      ) : (
        recipients.map((recipient) => {
          const href = getRecipientHref(recipient);
          return (
            <li
              key={recipient.id}
              className={[
                styles.awardWinnerCard,
                href ? styles.awardWinnerCardClickable : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {href && (
                <Link
                  to={href}
                  className={styles.awardWinnerCardLink}
                  aria-label={`View ${recipientName(recipient)}`}
                />
              )}
              <div className={styles.awardWinnerImageWrap}>
                {recipient.recipient_type === 'team' ? (
                  <TeamLogo
                    logo={recipient.team_logo}
                    code={recipient.team_code ?? 'T'}
                    primaryColor={recipient.team_primary_color}
                    textColor={recipient.team_text_color}
                    size={cardImageSize}
                    className={styles.awardWinnerTeamLogo}
                  />
                ) : (
                  <PlayerAvatar
                    photo={recipient.player_photo}
                    initials={recipientInitials(recipient)}
                    primaryColor={recipient.team_primary_color ?? undefined}
                    textColor={recipient.team_text_color ?? undefined}
                    ringColor={recipient.team_primary_color ?? undefined}
                    size={cardImageSize}
                  />
                )}
              </div>
              <div className={styles.awardWinnerInfo}>
                <strong>{recipientName(recipient)}</strong>
                {recipient.recipient_type === 'player' ? (
                  <AwardRecipientMeta
                    recipient={recipient}
                    className={styles.awardWinnerMeta}
                  />
                ) : subtitle ? (
                  <span>{subtitle}</span>
                ) : null}
              </div>
            </li>
          );
        })
      )}
    </ul>
  );
};

const AwardWinnerListSkeleton = () => (
  <ul className={styles.awardWinnerCards}>
    <li className={[styles.awardWinnerCard, styles.awardWinnerSkeleton].join(' ')}>
      <Skeleton
        type="circle"
        width={88}
        height={88}
      />
      <div className={styles.awardWinnerSkeletonInfo}>
        <Skeleton
          type="text"
          width="68%"
        />
        <Skeleton
          type="subtitle"
          width="48%"
        />
      </div>
    </li>
  </ul>
);

const AwardPlayerList = ({
  recipients,
  empty,
  divided = false,
  layout = 'row',
  getRecipientHref,
}: {
  recipients: SeasonAwardRecipient[];
  empty?: string;
  divided?: boolean;
  layout?: 'row' | 'column';
  getRecipientHref: (recipient: SeasonAwardRecipient) => string | undefined;
}) => (
  <div
    className={[
      styles.awardPlayerList,
      divided ? styles.awardPlayerListDivided : '',
      layout === 'column' ? styles.awardPlayerListColumn : '',
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {recipients.length === 0 ? (
      empty ? (
        <span className={styles.awardEmptyMessage}>{empty}</span>
      ) : null
    ) : (
      <ul
        className={[
          styles.awardPlayerListScroller,
          layout === 'column' ? styles.awardPlayerListScrollerColumn : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {recipients.map((recipient) => {
          const href = getRecipientHref(recipient);
          return (
            <ListItem
              key={recipient.id}
              imageNode={
                recipient.recipient_type === 'team' ? (
                  <TeamLogo
                    logo={recipient.team_logo}
                    code={recipient.team_code ?? 'T'}
                    primaryColor={recipient.team_primary_color}
                    textColor={recipient.team_text_color}
                    size={48}
                  />
                ) : (
                  <PlayerAvatar
                    photo={recipient.player_photo}
                    initials={recipientInitials(recipient)}
                    primaryColor={recipient.team_primary_color}
                    textColor={recipient.team_text_color}
                    ringColor={recipient.team_primary_color}
                    size={48}
                  />
                )
              }
              name={recipientName(recipient)}
              href={href}
              className={styles.awardPlayerListItem}
            >
              <AwardRecipientMeta recipient={recipient} />
            </ListItem>
          );
        })}
      </ul>
    )}
  </div>
);

export default SeasonAwardsTab;
