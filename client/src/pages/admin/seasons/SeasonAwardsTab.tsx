import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import Accordion from '@jerecocc/tracker-ui/components/Accordion/Accordion';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Card from '@jerecocc/tracker-ui/components/Card/Card';
import Checklist, { type ChecklistOption } from '@jerecocc/tracker-ui/components/Checklist/Checklist';
import ConfirmModal from '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import GroupedFields from '@jerecocc/tracker-ui/components/GroupedFields/GroupedFields';
import InfoTooltip from '@jerecocc/tracker-ui/components/InfoTooltip/InfoTooltip';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import RadioList, { type RadioListOption } from '@jerecocc/tracker-ui/components/RadioList/RadioList';
import ReorderableField from '@jerecocc/tracker-ui/components/ReorderableField/ReorderableField';
import Select, { type SelectOption } from '@jerecocc/tracker-ui/components/Select/Select';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import StatItem from '@jerecocc/tracker-ui/components/StatItem/StatItem';
import Tag from '@jerecocc/tracker-ui/components/Tag/Tag';
import { usePlayoffSeries, type PlayoffSeriesRecord } from '@/hooks/useGames';
import useLeaguePlayers, { type PlayerRecord } from '@/hooks/useLeaguePlayers';
import useSeasonAwards, {
  type AddAwardRecipientPayload,
  type AwardRecipientType,
  type SeasonAwardRecipient,
  type SeasonAwardRecord,
} from '@/hooks/useSeasonAwards';
import type { SeasonGroupRecord, SeasonTeam } from '@/hooks/useSeasonDetails';
import type { TeamStandingRecord } from '@/hooks/useSeasonStandings';
import type { GoalieStatRecord, SkaterStatRecord } from '@/hooks/useSeasonStats';
import {
  buildLeaguePlayerDetailsPath,
  buildPlayerDetailsPath,
  buildTeamDetailsPath,
} from '@/lib/routeSlugs';
import {
  awardCompetitionScopeLabel,
  awardPlayerEligibilityLabel,
  awardSelectionSourceLabel,
  awardTeamEligibilityLabel,
  getAwardCompetitionScope,
  getAwardRecordingGate,
  getAwardSelectionSource,
  getAwardWinnerMode,
  playerMatchesAwardEligibility,
  teamMatchesAwardEligibility,
} from '@/lib/awardDefinitions';
import { formatPlayerPosition } from '@/lib/playerPosition';
import PlayerCard from '@/shared/PlayerCard/PlayerCard';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import styles from './SeasonDetails.module.scss';

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

interface AwardPlayerRecord {
  player_id: string;
  first_name: string;
  last_name: string;
  photo: string | null;
  position: string | null;
  jersey_number: number | null;
  team_id: string | null;
  team_code: string | null;
  team_name: string | null;
  team_logo: string | null;
  team_logo_dark?: string | null;
  team_logo_light?: string | null;
  team_primary_color: string | null;
  team_text_color: string | null;
  team_stint_created: string | null;
  rookie_season_id: string | null;
}

interface AwardTeamRecord extends SeasonTeam {
  conference_names: string[];
  conference_keys: string[];
}

interface AwardRecipientStatDisplay {
  label: string;
  value: string;
}

interface WinnerChecklistOption extends ChecklistOption {
  id: string;
  recipient_type: AwardRecipientType;
  searchText: string;
}

interface Props {
  seasonId: string;
  leagueCode: string | null;
  leagueId: string | null;
  seasonName: string | null;
  playoffsStarted: boolean;
  isEnded: boolean;
  seasonTeams: SeasonTeam[];
  groups: SeasonGroupRecord[];
  skaters: SkaterStatRecord[];
  goalies: GoalieStatRecord[];
  standings: TeamStandingRecord[];
}

const playerName = (player: { first_name: string; last_name: string }) =>
  [player.first_name, player.last_name].filter(Boolean).join(' ');

const sortAwardPlayersByName = (players: AwardPlayerRecord[]) =>
  [...players].sort((a, b) => playerName(a).localeCompare(playerName(b)));

const statPlayerToAwardPlayer = (
  player: SkaterStatRecord | GoalieStatRecord,
): AwardPlayerRecord => ({
  player_id: player.player_id,
  first_name: player.first_name,
  last_name: player.last_name,
  photo: player.photo,
  position: 'position' in player ? player.position : 'G',
  jersey_number: player.jersey_number,
  team_id: player.team_id,
  team_code: player.team_code,
  team_name: player.team_name,
  team_logo: player.team_logo,
  team_logo_dark: player.team_logo_dark,
  team_logo_light: player.team_logo_light,
  team_primary_color: player.team_primary_color,
  team_text_color: player.team_text_color,
  team_stint_created: player.team_stint_created,
  rookie_season_id:
    'rookie_season_id' in player && typeof player.rookie_season_id === 'string'
      ? player.rookie_season_id
      : null,
});

const rosterPlayerToAwardPlayer = (player: PlayerRecord): AwardPlayerRecord => ({
  player_id: player.id,
  first_name: player.first_name,
  last_name: player.last_name,
  photo: player.photo,
  position: player.position,
  jersey_number: player.jersey_number ?? null,
  team_id: player.team_id ?? null,
  team_code: player.team_code ?? null,
  team_name: player.team_name ?? null,
  team_logo: player.team_logo ?? null,
  team_logo_dark: player.team_logo_dark,
  team_logo_light: player.team_logo_light,
  team_primary_color: player.primary_color ?? null,
  team_text_color: player.text_color ?? null,
  team_stint_created: player.start_date ?? player.created_at ?? null,
  rookie_season_id: player.rookie_season_id ?? null,
});

const statLabel = (statKey: string | null | undefined) =>
  statKey ? (STAT_LABELS[statKey] ?? statKey) : null;

const awardSelectionSubtitle = (award: SeasonAwardRecord) => {
  const competitionScope = getAwardCompetitionScope(award);
  const winnerMode = getAwardWinnerMode(award);

  return [
    award.recipient_type === 'player' ? 'Player' : 'Team',
    awardSelectionSourceLabel(getAwardSelectionSource(award)),
    awardPlayerEligibilityLabel(award),
    awardTeamEligibilityLabel(award),
    statLabel(award.stat_key),
    awardCompetitionScopeLabel(competitionScope),
    award.uses_nominees && winnerMode !== 'team_selection' ? 'Nominees' : null,
    winnerMode === 'team_selection'
      ? 'Team selection'
      : winnerMode === 'multiple'
        ? 'Multiple winners'
        : null,
  ]
    .filter(Boolean)
    .join(' | ');
};

const numericFieldValue = (record: object, field: string | null | undefined) => {
  if (!field) return null;
  const value = (record as Record<string, unknown>)[field];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const SKATER_STAT_KEYS = new Set(['points', 'goals', 'assists']);
const GOALIE_STAT_KEYS = new Set(['save_pct', 'gaa', 'shutouts']);

const statFieldForAward = (statKey: string | null | undefined) =>
  statKey === 'standings_points' ? 'points' : statKey;

const formatAwardStatValue = (statKey: string | null | undefined, value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  if (statKey === 'save_pct') return parsed.toFixed(3).replace(/^0/, '');
  if (statKey === 'gaa') return parsed.toFixed(2);
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
};

const statValueForSelection = (
  award: Pick<SeasonAwardRecord, 'stat_key'>,
  recipientType: AwardRecipientType,
  recipientId: string | null | undefined,
  skaters: SkaterStatRecord[],
  goalies: GoalieStatRecord[],
  standings: TeamStandingRecord[],
) => {
  const field = statFieldForAward(award.stat_key);
  if (!field || field === 'playoff_champion' || !recipientId) return null;

  if (recipientType === 'team') {
    const team = standings.find((row) => row.team_id === recipientId);
    return team ? numericFieldValue(team, field) : null;
  }

  const player =
    SKATER_STAT_KEYS.has(field)
      ? skaters.find((row) => row.player_id === recipientId)
      : GOALIE_STAT_KEYS.has(field)
        ? goalies.find((row) => row.player_id === recipientId)
        : null;
  return player ? numericFieldValue(player, field) : null;
};

const isTeamSelectionAward = (award: SeasonAwardRecord) =>
  getAwardWinnerMode(award) === 'team_selection';

const supportsNominees = (award: SeasonAwardRecord) =>
  award.uses_nominees && !isTeamSelectionAward(award);

const usesWinnerChecklist = (award: SeasonAwardRecord) =>
  getAwardWinnerMode(award) === 'multiple';

const canAwardWinners = (award: SeasonAwardRecord, playoffsStarted: boolean) =>
  getAwardRecordingGate(award) === 'anytime' || playoffsStarted;

const isAutomaticWinnerAward = (award: SeasonAwardRecord) =>
  award.selection_method === 'automatic' || award.stat_key === 'playoff_champion';

const canRecordAutomaticWinner = (
  award: SeasonAwardRecord,
  playoffsStarted: boolean,
  isEnded: boolean,
) => {
  const competitionScope = getAwardCompetitionScope(award);
  if (competitionScope === 'playoffs' || award.stat_key === 'playoff_champion') {
    return isEnded;
  }
  return playoffsStarted;
};

// A player who changed teams mid-season can appear as more than one stat row
// (multiple team stints, or split duplicate records that share only a name).
// Collapse them to a single entry — their most-recent stint (the latest
// stint creation date) — so player select fields don't show repeats.
const dedupePlayersByName = <
  T extends { first_name: string; last_name: string; team_stint_created: string | null },
>(
  records: T[],
): T[] => {
  const byName = new Map<string, T>();
  for (const record of records) {
    const key = `${record.first_name} ${record.last_name}`.toLowerCase();
    const existing = byName.get(key);
    if (!existing || (record.team_stint_created ?? '') > (existing.team_stint_created ?? '')) {
      byName.set(key, record);
    }
  }
  return [...byName.values()];
};

const playoffChampionSuggestion = (
  series: PlayoffSeriesRecord[],
  seasonTeams: SeasonTeam[],
  eligibleTeamIds?: Set<string>,
): SuggestedRecipient | null => {
  const maxRound = series.reduce((round, item) => Math.max(round, item.round), 0);
  if (maxRound <= 0) return null;

  const finalWinners = series.filter((item) => item.round === maxRound && item.winner_team_id);
  if (finalWinners.length !== 1) return null;

  const finalSeries = finalWinners[0];
  const id = finalSeries.winner_team_id;
  if (!id) return null;
  if (eligibleTeamIds && !eligibleTeamIds.has(id)) return null;

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

const nomineeRank = (recipient: SeasonAwardRecipient) =>
  recipient.rank ?? Number.MAX_SAFE_INTEGER;

const sortNominees = (recipients: SeasonAwardRecipient[]) =>
  [...recipients].sort((a, b) => nomineeRank(a) - nomineeRank(b));

const reorderDrafts = <T,>(drafts: T[], fromIndex: number, toIndex: number) => {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= drafts.length ||
    toIndex >= drafts.length ||
    fromIndex === toIndex
  ) {
    return drafts;
  }

  const next = [...drafts];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

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
  playoffsStarted,
  isEnded,
  seasonTeams,
  groups,
  skaters,
  goalies,
  standings,
}: Props) => {
  const {
    awards,
    loading,
    updateTrackedAwards,
    addRecipient,
    saveNominees,
    deleteRecipient,
    clearWinners,
    refresh,
  } = useSeasonAwards(seasonId);
  const { series: playoffSeries } = usePlayoffSeries(seasonId);
  const { players: rosterPlayers } = useLeaguePlayers(
    leagueId ?? undefined,
    leagueId ? seasonId : undefined,
    {
      includeInactive: true,
      enabled: !!leagueId,
    },
  );
  const [awardSelectionOpen, setAwardSelectionOpen] = useState(false);
  const [awardSelectionDraftIds, setAwardSelectionDraftIds] = useState<string[]>([]);
  const [awardSelectionQuery, setAwardSelectionQuery] = useState('');
  const [awardSelectionSaving, setAwardSelectionSaving] = useState(false);
  const [recipientAward, setRecipientAward] = useState<SeasonAwardRecord | null>(null);
  const [recipientWinnerDraftIds, setRecipientWinnerDraftIds] = useState<string[]>([]);
  const [recipientWinnerQuery, setRecipientWinnerQuery] = useState('');
  const [recipientWinnerSaving, setRecipientWinnerSaving] = useState(false);
  const [clearWinnersTarget, setClearWinnersTarget] = useState<SeasonAwardRecord | null>(null);
  const [clearWinnersSaving, setClearWinnersSaving] = useState(false);
  const [nomineeAward, setNomineeAward] = useState<SeasonAwardRecord | null>(null);
  const [nomineeDrafts, setNomineeDrafts] = useState<NomineeDraft[]>([]);
  const [nomineesSaving, setNomineesSaving] = useState(false);
  const [draggingNomineeDraftId, setDraggingNomineeDraftId] = useState<string | null>(null);
  const [teamSelectionAward, setTeamSelectionAward] = useState<SeasonAwardRecord | null>(null);
  const [automaticWinnerSavingAwardIds, setAutomaticWinnerSavingAwardIds] = useState<string[]>([]);
  const automaticWinnerRecordKeysRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const addRecipientRef = useRef(addRecipient);
  const refreshRef = useRef(refresh);

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

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );
  useEffect(() => {
    addRecipientRef.current = addRecipient;
    refreshRef.current = refresh;
  }, [addRecipient, refresh]);

  // Collapse multi-team / split-record players to a single option (most-played
  // team) so the select fields below never list the same player twice.
  const dedupedSkaters = useMemo(() => dedupePlayersByName(skaters), [skaters]);
  const dedupedGoalies = useMemo(() => dedupePlayersByName(goalies), [goalies]);

  const statAwardPlayers = useMemo(() => {
    const byId = new Map<string, AwardPlayerRecord>();
    dedupedSkaters.forEach((player) => byId.set(player.player_id, statPlayerToAwardPlayer(player)));
    dedupedGoalies.forEach((player) => {
      if (!byId.has(player.player_id)) byId.set(player.player_id, statPlayerToAwardPlayer(player));
    });
    return sortAwardPlayersByName([...byId.values()]);
  }, [dedupedGoalies, dedupedSkaters]);

  const rosterAwardPlayers = useMemo(
    () => rosterPlayers.map(rosterPlayerToAwardPlayer),
    [rosterPlayers],
  );

  const awardPlayers = useMemo(() => {
    const byId = new Map<string, AwardPlayerRecord>();
    statAwardPlayers.forEach((player) => byId.set(player.player_id, player));
    rosterAwardPlayers.forEach((player) => byId.set(player.player_id, player));
    return sortAwardPlayersByName([...byId.values()]);
  }, [rosterAwardPlayers, statAwardPlayers]);

  const seasonTeamConferenceMap = useMemo(() => {
    const byTeamId = new Map<string, { conference_names: Set<string>; conference_keys: Set<string> }>();
    const groupsByParent = new Map<string | null, SeasonGroupRecord[]>();

    groups.forEach((group) => {
      const list = groupsByParent.get(group.parent_id) ?? [];
      list.push(group);
      groupsByParent.set(group.parent_id, list);
    });

    const addConferenceTeam = (teamId: string, conference: SeasonGroupRecord) => {
      const entry =
        byTeamId.get(teamId) ?? { conference_names: new Set<string>(), conference_keys: new Set<string>() };
      entry.conference_names.add(conference.name);
      if (conference.stable_key) entry.conference_keys.add(conference.stable_key);
      byTeamId.set(teamId, entry);
    };

    const addGroupTeams = (conference: SeasonGroupRecord, group: SeasonGroupRecord) => {
      group.teams.forEach((team) => addConferenceTeam(team.id, conference));
      (groupsByParent.get(group.id) ?? []).forEach((child) => addGroupTeams(conference, child));
    };

    groups
      .filter((group) => group.role === 'conference')
      .forEach((conference) => addGroupTeams(conference, conference));

    return byTeamId;
  }, [groups]);

  const awardTeams = useMemo<AwardTeamRecord[]>(
    () =>
      seasonTeams.map((team) => {
        const conferences = seasonTeamConferenceMap.get(team.id);
        return {
          ...team,
          conference_names: conferences ? [...conferences.conference_names] : [],
          conference_keys: conferences ? [...conferences.conference_keys] : [],
        };
      }),
    [seasonTeamConferenceMap, seasonTeams],
  );

  const awardPlayerById = useMemo(
    () => new Map(awardPlayers.map((player) => [player.player_id, player])),
    [awardPlayers],
  );

  const eligibleAwardPlayersForAward = (award: SeasonAwardRecord | null | undefined) =>
    award
      ? awardPlayers.filter((player) => playerMatchesAwardEligibility(award, player, seasonId))
      : awardPlayers;

  const eligibleAwardTeamsForAward = useCallback(
    (award: SeasonAwardRecord | null | undefined) =>
      award ? awardTeams.filter((team) => teamMatchesAwardEligibility(award, team)) : awardTeams,
    [awardTeams],
  );

  const playerToSelectOption = (player: AwardPlayerRecord): SelectOption => ({
    value: player.player_id,
    label: playerName(player),
    logo: player.team_logo,
    logoDark: player.team_logo_dark,
    logoLight: player.team_logo_light,
    code: player.team_code ?? undefined,
  });

  const playerOptions = awardPlayers.map(playerToSelectOption);
  const eligibleTeamSelectionPlayers = eligibleAwardPlayersForAward(teamSelectionAward);

  const forwardOptions = eligibleTeamSelectionPlayers
    .filter((player) => !isDefensePosition(player.position) && !isGoaliePosition(player.position))
    .map(playerToSelectOption);

  const defenderOptions = eligibleTeamSelectionPlayers
    .filter((player) => isDefensePosition(player.position))
    .map(playerToSelectOption);

  const goalieOptions = eligibleTeamSelectionPlayers
    .filter((player) => isGoaliePosition(player.position))
    .map(playerToSelectOption);

  const teamSelectionOptions = {
    Forward: forwardOptions,
    Defender: defenderOptions,
    Goalie: goalieOptions,
  } satisfies Record<AwardTeamSelectionGroup, typeof playerOptions>;
  const teamSelectionValues = teamSelectionForm.watch();
  const teamSelectionIds = Object.values(teamSelectionValues).filter(Boolean);
  const teamSelectionComplete = teamSelectionIds.length === TEAM_SELECTION_SLOTS.length;
  const teamSelectionHasDuplicates = new Set(teamSelectionIds).size !== teamSelectionIds.length;

  const teamToSelectOption = (team: AwardTeamRecord): SelectOption => ({
    value: team.id,
    label: team.name,
    logo: team.logo,
    logoDark: team.logo_dark,
    logoLight: team.logo_light,
    code: team.code,
  });

  const selectedStatValue = useCallback(
    (
      award: SeasonAwardRecord,
      recipientType: AwardRecipientType,
      recipientId: string | null | undefined,
    ) => {
      const value = statValueForSelection(
        award,
        recipientType,
        recipientId,
        dedupedSkaters,
        dedupedGoalies,
        standings,
      );
      return value === null ? null : String(value);
    },
    [dedupedGoalies, dedupedSkaters, standings],
  );

  const withAwardStatValue = useCallback(
    (award: SeasonAwardRecord, payload: AddAwardRecipientPayload): AddAwardRecipientPayload => {
      const recipientId = payload.recipient_type === 'team' ? payload.team_id : payload.player_id;
      const statValue = selectedStatValue(award, payload.recipient_type, recipientId);
      return statValue === null ? payload : { ...payload, stat_value: statValue };
    },
    [selectedStatValue],
  );

  const recipientStatDisplay = (
    award: SeasonAwardRecord,
    recipient: SeasonAwardRecipient,
  ): AwardRecipientStatDisplay | null => {
    if (!award.stat_key || award.stat_key === 'playoff_champion') return null;
    const recipientId = recipientValueId(recipient);
    const rawValue =
      recipient.stat_value ??
      selectedStatValue(award, recipient.recipient_type, recipientId);
    const value = formatAwardStatValue(award.stat_key, rawValue);
    const label = statLabel(award.stat_key);
    return value && label ? { label, value } : null;
  };

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
      jerseyNumber: recipient.jersey_number,
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
          logoDark: recipient.team_logo_dark,
          logoLight: recipient.team_logo_light,
          code: recipient.team_code ?? undefined,
        }))
        .filter((option) => option.value);
    }

    return award.recipient_type === 'player'
      ? eligibleAwardPlayersForAward(award).map(playerToSelectOption)
      : eligibleAwardTeamsForAward(award).map(teamToSelectOption);
  };

  const playerToWinnerOption = (player: AwardPlayerRecord): WinnerChecklistOption => {
    const subtitle = formatPlayerPosition(player.position) ?? undefined;
    const name = playerName(player);

    return {
      id: player.player_id,
      name,
      recipient_type: 'player',
      leadingImage: player.team_logo,
      leadingImageDark: player.team_logo_dark,
      leadingImageLight: player.team_logo_light,
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
    imageDark: team.logo_dark,
    imageLight: team.logo_light,
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
      recipient.recipient_type === 'player'
        ? (formatPlayerPosition(recipient.position) ?? undefined)
        : undefined;

    return {
      id,
      name,
      recipient_type: recipient.recipient_type,
      leadingImage: recipient.recipient_type === 'player' ? recipient.team_logo : undefined,
      leadingImageDark:
        recipient.recipient_type === 'player' ? recipient.team_logo_dark : undefined,
      leadingImageLight:
        recipient.recipient_type === 'player' ? recipient.team_logo_light : undefined,
      leadingImagePlaceholder:
        recipient.recipient_type === 'player' ? (recipient.team_code ?? undefined) : undefined,
      leadingImagePrimaryColor: recipient.team_primary_color,
      leadingImageTextColor: recipient.team_text_color,
      image: recipient.recipient_type === 'player' ? recipient.player_photo : recipient.team_logo,
      imageDark: recipient.recipient_type === 'team' ? recipient.team_logo_dark : undefined,
      imageLight: recipient.recipient_type === 'team' ? recipient.team_logo_light : undefined,
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

  const statPlayerMatchesAwardEligibility = useCallback(
    (award: SeasonAwardRecord, player: SkaterStatRecord | GoalieStatRecord) => {
      const metadata = awardPlayerById.get(player.player_id);
      return playerMatchesAwardEligibility(
        award,
        {
          position: 'position' in player ? player.position : (metadata?.position ?? 'G'),
          rookie_season_id: metadata?.rookie_season_id ?? null,
        },
        seasonId,
      );
    },
    [awardPlayerById, seasonId],
  );

  const suggestions = useMemo(() => {
    const byAward = new Map<string, SuggestedRecipient>();
    for (const award of awards) {
      if (!award.stat_key) continue;
      const isPlayoffChampionAward =
        award.recipient_type === 'team' && award.stat_key === 'playoff_champion';
      if (award.selection_method !== 'automatic' && !isPlayoffChampionAward) continue;

      if (award.recipient_type === 'team') {
        const eligibleTeams = eligibleAwardTeamsForAward(award);
        const eligibleTeamIds = new Set(eligibleTeams.map((team) => team.id));
        if (award.stat_key === 'playoff_champion') {
          const suggestion = playoffChampionSuggestion(playoffSeries, awardTeams, eligibleTeamIds);
          if (suggestion) byAward.set(award.award_id, suggestion);
          continue;
        }

        const field = award.stat_key === 'standings_points' ? 'points' : award.stat_key;
        const candidates = standings.filter(
          (team) => eligibleTeamIds.has(team.team_id) && numericFieldValue(team, field) !== null,
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
        const top = dedupedSkaters
          .filter((player) => statPlayerMatchesAwardEligibility(award, player))
          .sort(
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
        const candidates = dedupedGoalies.filter(
          (goalie) =>
            numericFieldValue(goalie, award.stat_key) !== null &&
            statPlayerMatchesAwardEligibility(award, goalie),
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
  }, [
    awards,
    awardTeams,
    dedupedGoalies,
    dedupedSkaters,
    eligibleAwardTeamsForAward,
    playoffSeries,
    standings,
    statPlayerMatchesAwardEligibility,
  ]);

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

  const activeRecipientAward = recipientAward
    ? (awards.find((award) => award.award_id === recipientAward.award_id) ?? recipientAward)
    : null;
  const activeNomineeAward = nomineeAward
    ? (awards.find((award) => award.award_id === nomineeAward.award_id) ?? nomineeAward)
    : null;
  const recipientUsesWinnerChecklist =
    !!activeRecipientAward && usesWinnerChecklist(activeRecipientAward);
  const recipientUsesNomineeRadioList =
    !!activeRecipientAward &&
    !recipientUsesWinnerChecklist &&
    activeRecipientAward.recipient_type === 'player' &&
    supportsNominees(activeRecipientAward);
  // Drive the simple-form confirm off the selected value rather than
  // isDirty/isValid, which can lag with a Controller-backed select after reset().
  const recipientSelectedId = recipientForm.watch('recipient_id');
  const activeRecipientNominees = activeRecipientAward
    ? sortNominees(activeRecipientAward.recipients.filter((recipient) => recipient.role === 'nominee'))
    : [];
  const activeRecipientWinners =
    activeRecipientAward?.recipients.filter((recipient) => recipient.role === 'winner') ?? [];
  const activeRecipientWinnerOptions = activeRecipientAward
    ? supportsNominees(activeRecipientAward)
      ? activeRecipientNominees
          .map(nomineeToWinnerOption)
          .filter((option): option is WinnerChecklistOption => option !== null)
      : activeRecipientAward.recipient_type === 'player'
        ? eligibleAwardPlayersForAward(activeRecipientAward).map(playerToWinnerOption)
        : eligibleAwardTeamsForAward(activeRecipientAward).map(teamToWinnerOption)
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
  const activeRecipientNomineeRadioOptions: RadioListOption[] = recipientUsesNomineeRadioList
    ? activeRecipientWinnerOptions.map((option) => ({
        value: option.id,
        leadingImage: option.leadingImage,
        leadingImageDark: option.leadingImageDark,
        leadingImageLight: option.leadingImageLight,
        leadingImagePlaceholder: option.leadingImagePlaceholder,
        leadingImagePrimaryColor: option.leadingImagePrimaryColor,
        leadingImageTextColor: option.leadingImageTextColor,
        image: option.image,
        imageDark: option.imageDark,
        imageLight: option.imageLight,
        imagePlaceholder: option.imagePlaceholder,
        imageShape: option.imageShape,
        imagePrimaryColor: option.imagePrimaryColor,
        imageTextColor: option.imageTextColor,
        name: option.name,
        subtitle: option.subtitle,
      }))
    : [];

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
    if (!canAwardWinners(award, playoffsStarted)) return;
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

  const suppressAutomaticWinnerRecordKeys = (
    award: SeasonAwardRecord,
    winners: SeasonAwardRecipient[],
  ) => {
    if (!award.season_award_id || !isAutomaticWinnerAward(award)) return;

    const suggestion = suggestions.get(award.award_id);
    if (suggestion) {
      automaticWinnerRecordKeysRef.current.add(
        `${award.season_award_id}:${suggestion.type}:${suggestion.id}`,
      );
    }

    winners.forEach((winner) => {
      const winnerId = recipientValueId(winner);
      if (!winnerId) return;
      automaticWinnerRecordKeysRef.current.add(
        `${award.season_award_id}:${winner.recipient_type}:${winnerId}`,
      );
    });
  };

  const openClearWinnersModal = (award: SeasonAwardRecord) => {
    setClearWinnersTarget(award);
    setClearWinnersSaving(false);
  };

  const closeClearWinnersModal = () => {
    if (clearWinnersSaving) return;
    setClearWinnersTarget(null);
  };

  const confirmClearWinners = async () => {
    if (!clearWinnersTarget?.season_award_id || clearWinnersSaving) return;

    const winners = clearWinnersTarget.recipients.filter(
      (recipient) => recipient.role === 'winner',
    );
    const winnerIds = winners.map((recipient) => recipient.id);
    if (winnerIds.length === 0) {
      setClearWinnersTarget(null);
      return;
    }

    setClearWinnersSaving(true);
    const ok = await clearWinners(clearWinnersTarget.season_award_id, winnerIds, {
      refresh: false,
    });
    setClearWinnersSaving(false);

    if (ok) {
      suppressAutomaticWinnerRecordKeys(clearWinnersTarget, winners);
      refresh();
      setClearWinnersTarget(null);
    }
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
    const drafts = sortNominees(award.recipients.filter((recipient) => recipient.role === 'nominee'))
      .map((recipient) => ({
        id: recipient.id,
        recipient_id: recipientValueId(recipient) ?? '',
      }));
    setNomineeDrafts(drafts.length > 0 ? drafts : [createNomineeDraft()]);
    setDraggingNomineeDraftId(null);
  };

  const closeNomineesModal = () => {
    setNomineeAward(null);
    setNomineeDrafts([]);
    setNomineesSaving(false);
    setDraggingNomineeDraftId(null);
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

  const moveNomineeDraft = (draftId: string, delta: number) => {
    setNomineeDrafts((drafts) => {
      const fromIndex = drafts.findIndex((draft) => draft.id === draftId);
      return reorderDrafts(drafts, fromIndex, fromIndex + delta);
    });
  };

  const moveNomineeDraftTo = (
    draftId: string,
    targetDraftId: string,
    placement: 'before' | 'after',
  ) => {
    if (draftId === targetDraftId) return;

    setNomineeDrafts((drafts) => {
      const fromIndex = drafts.findIndex((draft) => draft.id === draftId);
      const targetIndex = drafts.findIndex((draft) => draft.id === targetDraftId);
      if (fromIndex < 0 || targetIndex < 0) return drafts;

      let toIndex = targetIndex + (placement === 'after' ? 1 : 0);
      if (fromIndex < toIndex) toIndex -= 1;
      return reorderDrafts(drafts, fromIndex, toIndex);
    });
  };

  const handleNomineeDragStart =
    (draftId: string) => (event: DragEvent<HTMLDivElement>) => {
      if (nomineesSaving) {
        event.preventDefault();
        return;
      }
      setDraggingNomineeDraftId(draftId);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/season-award-nominee-id', draftId);
    };

  const handleNomineeDragOver =
    (targetDraftId: string) => (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const draggedId =
        draggingNomineeDraftId || event.dataTransfer.getData('text/season-award-nominee-id');
      if (!draggedId || draggedId === targetDraftId) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const placement = event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
      moveNomineeDraftTo(draggedId, targetDraftId, placement);
    };

  const handleNomineeDragEnd = () => {
    setDraggingNomineeDraftId(null);
  };

  const openTeamSelectionModal = (award: SeasonAwardRecord) => {
    if (!canAwardWinners(award, playoffsStarted)) return;
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
    if (!canAwardWinners(activeRecipientAward, playoffsStarted)) return;
    if (!activeRecipientAward.allow_multiple_winners) {
      for (const recipient of activeRecipientWinners) {
        const ok = await deleteRecipient(activeRecipientAward.season_award_id, recipient.id, {
          silent: true,
          refresh: false,
        });
        if (!ok) return;
      }
    }
    const ok = await addRecipient(
      activeRecipientAward.season_award_id,
      withAwardStatValue(activeRecipientAward, {
        recipient_type: activeRecipientAward.recipient_type,
        player_id: activeRecipientAward.recipient_type === 'player' ? values.recipient_id : null,
        team_id: activeRecipientAward.recipient_type === 'team' ? values.recipient_id : null,
        role: 'winner',
      }),
    );
    if (ok) closeRecipientModal();
  });

  const submitRecipientWinners = async () => {
    if (
      !activeRecipientAward?.season_award_id ||
      !canAwardWinners(activeRecipientAward, playoffsStarted) ||
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
        withAwardStatValue(activeRecipientAward, {
          recipient_type: activeRecipientAward.recipient_type,
          player_id: activeRecipientAward.recipient_type === 'player' ? recipientId : null,
          team_id: activeRecipientAward.recipient_type === 'team' ? recipientId : null,
          role: 'winner',
        }),
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

  const activeNominees = activeNomineeAward
    ? sortNominees(activeNomineeAward.recipients.filter((recipient) => recipient.role === 'nominee'))
    : [];
  const activeNomineeRecipientIds = activeNominees
    .map(recipientValueId)
    .filter((id): id is string => !!id);
  const nomineeDraftRecipientIds = nomineeDrafts
    .map((draft) => draft.recipient_id)
    .filter((id): id is string => !!id);
  const nomineeDraftHasDuplicates =
    new Set(nomineeDraftRecipientIds).size !== nomineeDraftRecipientIds.length;
  const nomineeDraftHasEmpty = nomineeDraftRecipientIds.length !== nomineeDrafts.length;
  const activeNomineeOrderKey = activeNomineeRecipientIds.join('|');
  const draftNomineeOrderKey = nomineeDraftRecipientIds.join('|');
  const nomineeDraftHasChanges = activeNomineeOrderKey !== draftNomineeOrderKey;
  const nomineeDraftCanSave =
    !nomineeDraftHasEmpty && !nomineeDraftHasDuplicates && nomineeDraftHasChanges;

  const submitNominees = async () => {
    if (!activeNomineeAward?.season_award_id || !nomineeDraftCanSave) return;
    const award = activeNomineeAward;
    setNomineesSaving(true);

    const nominees = nomineeDraftRecipientIds.map((recipientId, index) =>
      withAwardStatValue(award, {
        recipient_type: award.recipient_type,
        player_id: award.recipient_type === 'player' ? recipientId : null,
        team_id: award.recipient_type === 'team' ? recipientId : null,
        role: 'nominee',
        rank: index + 1,
      }),
    );

    const ok = await saveNominees(award.season_award_id, nominees);
    setNomineesSaving(false);
    if (ok) {
      closeNomineesModal();
    }
  };

  useEffect(() => {
    const recordAutomaticWinners = async () => {
      let recordedAny = false;

      for (const award of trackedAwards) {
        if (!isAutomaticWinnerAward(award) || isTeamSelectionAward(award)) continue;
        if (!award.season_award_id) continue;
        if (!canRecordAutomaticWinner(award, playoffsStarted, isEnded)) continue;

        const suggestion = suggestions.get(award.award_id);
        if (!suggestion) continue;

        const existingWinners = award.recipients.filter(
          (recipient) => recipient.role === 'winner',
        );
        const suggestionAlreadyRecorded = existingWinners.some(
          (recipient) =>
            recipient.recipient_type === suggestion.type &&
            recipientValueId(recipient) === suggestion.id,
        );
        if (suggestionAlreadyRecorded) continue;
        if (!award.allow_multiple_winners && existingWinners.length > 0) continue;

        const recordKey = `${award.season_award_id}:${suggestion.type}:${suggestion.id}`;
        if (automaticWinnerRecordKeysRef.current.has(recordKey)) continue;
        automaticWinnerRecordKeysRef.current.add(recordKey);

        setAutomaticWinnerSavingAwardIds((awardIds) =>
          awardIds.includes(award.award_id) ? awardIds : [...awardIds, award.award_id],
        );

        const ok = await addRecipientRef.current(
          award.season_award_id,
          withAwardStatValue(award, {
            recipient_type: suggestion.type,
            player_id: suggestion.type === 'player' ? suggestion.id : null,
            team_id: suggestion.type === 'team' ? suggestion.id : null,
            role: 'winner',
          }),
          {
            silent: true,
            refresh: false,
          },
        );

        recordedAny = recordedAny || ok;

        if (mountedRef.current) {
          setAutomaticWinnerSavingAwardIds((awardIds) =>
            awardIds.filter((awardId) => awardId !== award.award_id),
          );
        }
      }

      if (recordedAny) refreshRef.current();
    };

    void recordAutomaticWinners();
  }, [isEnded, playoffsStarted, suggestions, trackedAwards, withAwardStatValue]);

  const submitTeamSelection = teamSelectionForm.handleSubmit(async (values) => {
    if (
      !teamSelectionAward?.season_award_id ||
      !canAwardWinners(teamSelectionAward, playoffsStarted) ||
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
        withAwardStatValue(teamSelectionAward, {
          recipient_type: 'player',
          player_id: values[slot.field],
          role: 'winner',
          rank: slot.rank,
          notes: slot.group,
        }),
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
    activeNomineeAward?.recipient_type === 'team'
      ? eligibleAwardTeamsForAward(activeNomineeAward).map(teamToSelectOption)
      : activeNomineeAward
        ? eligibleAwardPlayersForAward(activeNomineeAward).map(playerToSelectOption)
        : playerOptions;
  const nomineeOptionsForDraft = (draft: NomineeDraft) =>
    nomineeRecipientOptions.filter((option) => {
      if ('divider' in option) return true;
      const selectedInAnotherDraft = nomineeDrafts.some(
        (candidate) => candidate.id !== draft.id && candidate.recipient_id === option.value,
      );
      return option.value === draft.recipient_id || !selectedInAnotherDraft;
    });
  const clearWinnersTargetCount =
    clearWinnersTarget?.recipients.filter((recipient) => recipient.role === 'winner').length ?? 0;
  const clearWinnersConfirmLabel =
    clearWinnersTargetCount === 1 ? 'Clear Winner' : 'Clear Winners';

  return (
    <>
      <Section
        title="Awards"
        action={
          !loading && awards.length > 0 ? (
            <Button
              type="button"
              size="medium"
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
              const nominees = sortNominees(
                award.recipients.filter((recipient) => recipient.role === 'nominee'),
              );
              const visibleNominees = nominees.filter((recipient) => {
                const recipientId = recipientValueId(recipient);
                return !recipientId || !winnerRecipientIds.has(recipientId);
              });
              const isGroupedAward = isTeamSelectionAward(award);
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
              const isAutomaticWinnerSaving = automaticWinnerSavingAwardIds.includes(
                award.award_id,
              );
              const isAutomaticAward = isAutomaticWinnerAward(award);
              const showAwardAction =
                !isAutomaticAward && canAwardWinners(award, playoffsStarted);
              const canClearWinners = !!award.season_award_id && winners.length > 0;
              const isClearWinnersSaving =
                clearWinnersSaving && clearWinnersTarget?.award_id === award.award_id;
              const rendersColumnList =
                isGroupedAward || (!canManageNominees && award.allow_multiple_winners);
              const getAwardRecipientStat = (recipient: SeasonAwardRecipient) =>
                recipientStatDisplay(award, recipient);
              const awardLabel = (
                <div className={styles.awardTitleBlock}>
                  <h4>
                    <span className={styles.awardTitleText}>{award.name}</span>
                    {award.description && (
                      <span className={styles.awardTitleInfo}>
                        <InfoTooltip
                          text={award.description}
                          size="0.9rem"
                        />
                      </span>
                    )}
                  </h4>
                </div>
              );
              const awardActions = canManageNominees || showAwardAction || canClearWinners ? (
                <div className={styles.awardActions}>
                  <div className={styles.awardRecipientActions}>
                    {canManageNominees && (
                      <Button
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
                        icon="groups"
                        tooltip="Set team"
                        aria-label="Set team"
                        onClick={() => openTeamSelectionModal(award)}
                      />
                    ) : showAwardAction ? (
                      <Button
                        icon="emoji_events"
                        tooltip="Set Winner"
                        aria-label={awardRecipientLabel}
                        disabled={awardRequiresNominees}
                        onClick={() => openRecipientModal(award)}
                      />
                    ) : null}
                    {canClearWinners && (
                      <Button
                        variant="outlined"
                        intent="danger"
                        icon="delete"
                        tooltip={winners.length === 1 ? 'Clear winner' : 'Clear winners'}
                        tooltipIntent="error"
                        aria-label={winners.length === 1 ? 'Clear winner' : 'Clear winners'}
                        disabled={isAutomaticWinnerSaving || isClearWinnersSaving}
                        onClick={() => openClearWinnersModal(award)}
                      />
                    )}
                  </div>
                </div>
              ) : null;

              return (
                <Accordion
                  key={award.award_id}
                  mode="static"
                  variant="light"
                  className={{
                    root: styles.awardItem,
                    header: styles.awardHeader,
                    body: [
                      styles.awardContent,
                      rendersColumnList ? styles.awardContentList : '',
                    ]
                      .filter(Boolean)
                      .join(' '),
                  }}
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
                    {isAutomaticWinnerSaving ? (
                      <AwardWinnerListSkeleton />
                    ) : isGroupedAward ? (
                      <AwardPlayerList
                        recipients={winners}
                        empty="No team recorded."
                        layout="column"
                        getRecipientHref={recipientHref}
                        getRecipientStat={getAwardRecipientStat}
                      />
                    ) : !canManageNominees && award.allow_multiple_winners ? (
                      <AwardPlayerList
                        recipients={winners}
                        empty="No winners recorded."
                        layout="column"
                        getRecipientHref={recipientHref}
                        getRecipientStat={getAwardRecipientStat}
                      />
                    ) : (
                      <>
                        <AwardWinnerList
                          recipients={winners}
                          empty={winnerEmptyMessage}
                          subtitle={winnerSubtitle}
                          getRecipientHref={recipientHref}
                          getRecipientStat={getAwardRecipientStat}
                        />
                        {canManageNominees && (
                          <AwardPlayerList
                            recipients={visibleNominees}
                            empty="No nominees recorded."
                            divided
                            getRecipientHref={recipientHref}
                            getRecipientStat={getAwardRecipientStat}
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
      </Section>

      <ConfirmModal
        open={!!clearWinnersTarget}
        title={clearWinnersConfirmLabel}
        body={
          clearWinnersTarget ? (
            <>
              {clearWinnersTargetCount === 1
                ? 'Clear the recorded winner for '
                : `Clear all ${clearWinnersTargetCount} winners recorded for `}
              <strong>{clearWinnersTarget.name}</strong>?
            </>
          ) : null
        }
        confirmLabel={clearWinnersSaving ? 'Clearing...' : clearWinnersConfirmLabel}
        confirmIcon="delete"
        intent="danger"
        busy={clearWinnersSaving}
        onCancel={closeClearWinnersModal}
        onConfirm={confirmClearWinners}
      />

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
          <Checklist
            options={awards.map((award) => {
              const checked = awardSelectionDraftIds.includes(award.award_id);
              const locked = checked && !!award.season_award_id && award.recipients.length > 0;
              return {
                id: award.award_id,
                award,
                hideImage: true,
                disabled: awardSelectionSaving || locked,
                name: award.name,
                subtitle: awardSelectionSubtitle(award),
                searchText: [
                  award.name,
                  award.description,
                  award.selection_method,
                  award.recipient_type,
                ]
                  .filter(Boolean)
                  .join(' '),
                rightContent: locked ? (
                  <Tag
                    label="Recorded"
                    intent="success"
                  />
                ) : undefined,
              };
            })}
            selectedIds={awardSelectionDraftIds}
            onToggle={(option) => toggleAwardSelection(option.award)}
            searchable
            query={awardSelectionQuery}
            onQueryChange={setAwardSelectionQuery}
            placeholder="Search awards"
            listClassName={styles.awardSelectionList}
            emptyClassName={styles.awardSelectionEmpty}
            emptyMessage="No awards found."
            getNoResultsMessage={() => 'No awards found.'}
          />
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
            : recipientForm.formState.isSubmitting || !recipientSelectedId
        }
        busy={
          recipientUsesWinnerChecklist ? recipientWinnerSaving : recipientForm.formState.isSubmitting
        }
        footerStart={
          recipientUsesWinnerChecklist ? <span>{recipientWinnerCountLabel}</span> : undefined
        }
        footerClassName={recipientUsesWinnerChecklist ? styles.awardPlayerChecklistFooter : undefined}
        footerDividerClassName={
          recipientUsesWinnerChecklist ? styles.awardPlayerChecklistFooterDivider : undefined
        }
      >
        {activeRecipientAward && recipientUsesWinnerChecklist ? (
          <Checklist
            className={styles.awardPlayerChecklist}
            listClassName={styles.awardPlayerChecklistList}
            emptyClassName={styles.awardPlayerChecklistEmpty}
            options={activeRecipientWinnerOptions}
            selectedIds={recipientWinnerDraftIds}
            onToggle={(option) => toggleRecipientWinner(option.id)}
            searchable
            query={recipientWinnerQuery}
            onQueryChange={setRecipientWinnerQuery}
            filterOption={(option, query) =>
              option.searchText.toLowerCase().includes(query.toLowerCase())
            }
            placeholder={`Search ${activeRecipientWinnerSourceLabel}...`}
            autoFocus
            emptyMessage={`No ${activeRecipientWinnerSourceLabel} are available for this award.`}
            getNoResultsMessage={(query) =>
              `No ${activeRecipientWinnerSourceLabel} match "${query}".`
            }
            disabled={recipientWinnerSaving}
          />
        ) : activeRecipientAward ? (
          <form
            id="season-award-recipient-form"
            className={styles.awardForm}
            onSubmit={submitRecipient}
          >
            {recipientUsesNomineeRadioList ? (
              <>
                <input
                  type="hidden"
                  {...recipientForm.register('recipient_id', {
                    required: 'Recipient is required',
                  })}
                />
                {activeRecipientNomineeRadioOptions.length === 0 ? (
                  <p className={styles.awardPlayerChecklistEmpty}>
                    No nominees are available for this award.
                  </p>
                ) : (
                  <RadioList
                    value={recipientSelectedId || null}
                    onChange={(value) =>
                      recipientForm.setValue('recipient_id', value, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                    }
                    options={activeRecipientNomineeRadioOptions}
                    disabled={recipientForm.formState.isSubmitting}
                    ariaLabel={`${activeRecipientAward.name} nominees`}
                    className={styles.awardPlayerRadioList}
                  />
                )}
              </>
            ) : (
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
            )}
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
                const isDragging = draggingNomineeDraftId === draft.id;
                return (
                  <div
                    key={draft.id}
                    className={styles.awardNomineeDraftRow}
                  >
                    <span
                      id={labelId}
                      className={styles.awardNomineeDraftLabel}
                    >
                      Nominee {index + 1}
                    </span>
                    <ReorderableField
                      dragging={isDragging}
                      draggable={!nomineesSaving}
                      disabled={nomineesSaving}
                      moveUpDisabled={index === 0}
                      moveDownDisabled={index === nomineeDrafts.length - 1}
                      moveUpLabel={`Move nominee ${index + 1} up`}
                      moveDownLabel={`Move nominee ${index + 1} down`}
                      onMoveUp={() => moveNomineeDraft(draft.id, -1)}
                      onMoveDown={() => moveNomineeDraft(draft.id, 1)}
                      onDragStart={handleNomineeDragStart(draft.id)}
                      onDragOver={handleNomineeDragOver(draft.id)}
                      onDrop={handleNomineeDragEnd}
                      onDragEnd={handleNomineeDragEnd}
                    >
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
                    </ReorderableField>
                    <Button
                      type="button"
                      variant="outlined"
                      intent="danger"
                      icon="close"
                      iconHeight="field"
                      tooltip="Remove nominee"
                      aria-label={`Remove nominee ${index + 1}`}
                      disabled={nomineesSaving || nomineeDrafts.length <= 1}
                      onClick={() => removeNomineeDraft(draft.id)}
                    />
                  </div>
                );
              })}
              <div className={styles.awardNomineeAddRow}>
                <Button
                  type="button"
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
            <GroupedFields
              key={group.group}
              legend={group.label}
            >
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
            </GroupedFields>
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
  getRecipientStat?: (recipient: SeasonAwardRecipient) => AwardRecipientStatDisplay | null;
}

const recipientName = (recipient: SeasonAwardRecipient) =>
  recipient.player_name ?? recipient.team_name ?? 'Unknown';

const recipientInitials = (recipient: SeasonAwardRecipient) => {
  const name = recipientName(recipient);
  const parts = name.split(' ').filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2);
};

const recipientPlayerCardProps = (recipient: SeasonAwardRecipient) => ({
  kind: recipient.recipient_type,
  name: recipientName(recipient),
  photo: recipient.player_photo,
  initials: recipientInitials(recipient),
  teamLogo: recipient.team_logo,
  teamLogoDark: recipient.team_logo_dark,
  teamLogoLight: recipient.team_logo_light,
  teamCode: recipient.team_code,
  teamPrimaryColor: recipient.team_primary_color,
  teamTextColor: recipient.team_text_color,
  jerseyNumber: recipient.recipient_type === 'player' ? recipient.jersey_number : null,
  position: recipient.recipient_type === 'player' ? recipient.position : null,
});

const AwardRecipientStatCard = ({ stat }: { stat: AwardRecipientStatDisplay }) => (
  <Card
    variant="border"
    className={styles.awardRecipientStatCard}
  >
    <StatItem
      as="span"
      className={styles.awardRecipientStat}
      label={stat.label}
      value={stat.value}
    />
  </Card>
);

const AwardWinnerList = ({
  recipients,
  empty,
  subtitle,
  getRecipientHref,
  getRecipientStat,
}: WinnerListProps) => {
  const compactCards = recipients.length > 1;

  return (
    <ResponsiveList
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
          const stat = getRecipientStat?.(recipient);
          return stat ? (
            <li
              key={recipient.id}
              className={styles.awardWinnerStatStack}
            >
              <PlayerCard
                {...recipientPlayerCardProps(recipient)}
                subtitle={recipient.recipient_type === 'team' ? subtitle : undefined}
                href={getRecipientHref(recipient)}
                compact
                className={styles.awardWinnerCard}
              />
              <Divider className={styles.awardRecipientStatDivider} />
              <AwardRecipientStatCard stat={stat} />
            </li>
          ) : (
            <PlayerCard
              key={recipient.id}
              {...recipientPlayerCardProps(recipient)}
              as="li"
              subtitle={recipient.recipient_type === 'team' ? subtitle : undefined}
              href={getRecipientHref(recipient)}
              compact={compactCards}
              className={styles.awardWinnerCard}
            />
          );
        })
      )}
    </ResponsiveList>
  );
};

const AwardWinnerListSkeleton = () => (
                    <ResponsiveList className={styles.awardWinnerCards}>
    <Skeleton
      as="li"
      variant="card"
      className={[styles.awardWinnerCard, styles.awardWinnerSkeleton].join(' ')}
    />
                    </ResponsiveList>
);

const AwardPlayerList = ({
  recipients,
  empty,
  divided = false,
  layout = 'row',
  getRecipientHref,
  getRecipientStat,
}: {
  recipients: SeasonAwardRecipient[];
  empty?: string;
  divided?: boolean;
  layout?: 'row' | 'column';
  getRecipientHref: (recipient: SeasonAwardRecipient) => string | undefined;
  getRecipientStat?: (recipient: SeasonAwardRecipient) => AwardRecipientStatDisplay | null;
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
      <ResponsiveList
        className={[
          styles.awardPlayerListScroller,
          layout === 'column' ? styles.awardPlayerListScrollerColumn : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {recipients.map((recipient) => {
          const href = getRecipientHref(recipient);
          const stat = getRecipientStat?.(recipient);
          return stat ? (
            <li
              key={recipient.id}
              className={styles.awardPlayerListItemStack}
            >
              <PlayerCard
                {...recipientPlayerCardProps(recipient)}
                variant="list"
                href={href}
                className={styles.awardPlayerListItem}
              />
              <Divider
                orientation="vertical"
                className={styles.awardRecipientStatListDivider}
              />
              <AwardRecipientStatCard stat={stat} />
            </li>
          ) : (
            <PlayerCard
              key={recipient.id}
              {...recipientPlayerCardProps(recipient)}
              as="li"
              variant="list"
              href={href}
              className={styles.awardPlayerListItem}
            />
          );
        })}
      </ResponsiveList>
    )}
  </div>
);

export default SeasonAwardsTab;
