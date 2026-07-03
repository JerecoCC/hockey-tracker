import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'react-toastify';
import Accordion from '@/components/Accordion/Accordion';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import Chip from '@/components/Chip/Chip';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Field from '@/components/Field/Field';
import Section from '@/components/Section/Section';
import ImagePreviewModal from '@/components/ImagePreviewModal/ImagePreviewModal';
import ListItem from '@/components/ListItem/ListItem';
import Modal from '@/components/Modal/Modal';
import MoreActionsMenu from '@/components/MoreActionsMenu/MoreActionsMenu';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import SeasonSelect from '@/components/SeasonSelect/SeasonSelect';
import StatItem from '@/components/StatItem/StatItem';
import Table, { type Column } from '@/components/Table/Table';
import Tabs from '@/components/Tabs/Tabs';
import Tag from '@/components/Tag/Tag';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import Tooltip from '@/components/Tooltip/Tooltip';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import usePlayerDetails, {
  usePlayerAwards,
  usePlayerCurrentSeasonStats,
  usePlayerGameLogs,
  usePlayerLastFiveGames,
  usePlayerRouteLookup,
  type PlayerCareerStatRecord,
  type PlayerCurrentSeasonStats,
  type PlayerCurrentSeasonStatBlock,
  type PlayerLastFiveGameRecord,
} from '@/hooks/usePlayerDetails';
import useTeamDetails from '@/hooks/useTeamDetails';
import useSeasons, { type SeasonRecord } from '@/hooks/useSeasons';
import useTeams from '@/hooks/useTeams';
import {
  usePlayerTradeHistory,
  useStintActions,
  useJerseyHistory,
  usePlayerPhotoHistory,
  type JerseyHistoryEntry,
  type PlayerPhotoEntry,
  type PlayerStintRecord,
  type TeamPlayerRecord,
} from '@/hooks/useTeamPlayers';
import { type CreatePlayerData } from '@/hooks/useLeaguePlayers';
import useTabState from '@/hooks/useTabState';
import { formatPlayerPosition } from '@/lib/playerPosition';
import {
  buildGameDetailsPath,
  buildLeagueDetailsPath,
  buildLeaguePlayerDetailsPath,
  buildPlayerDetailsPath,
  buildTeamDetailsPath,
  buildUserGameDetailsPath,
  buildUserLeaguePlayerDetailsPath,
  buildUserPlayerDetailsPath,
  buildUserTeamDetailsPath,
  toRouteSlug,
} from '@/lib/routeSlugs';
import TeamPlayerEditModal from '../teams/TeamPlayerEditModal';
import MovePlayerModal from '../teams/MovePlayerModal';
import StintEditModal, { ACQUISITION_TYPE_LABELS } from './StintEditModal';
import ChangeJerseyModal from './ChangeJerseyModal';
import ChangePhotoModal from './ChangePhotoModal';
import PlayerInfoEditModal from './PlayerInfoEditModal';
import styles from './PlayerDetails.module.scss';
import useDocumentIcon from '@/hooks/useDocumentIcon';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const GAME_LOG_PAGE_SIZE = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const formatHeight = (cm: number | null) => {
  if (!cm) return null;
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}" (${cm} cm)`;
};

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// ── Career stats table columns ──────────────────────────────────────────────
const statColumns: Column<PlayerCareerStatRecord>[] = [
  {
    type: 'logo',
    header: 'Team',
    getLogo: (r) => r.team_logo,
    getLogoDark: (r) => r.team_logo_dark,
    getLogoLight: (r) => r.team_logo_light,
    getName: (r) => r.team_name ?? '—',
    getCode: (r) => r.team_name?.slice(0, 3).toUpperCase() ?? '?',
  },
  { header: 'Season', key: 'season_name' },
  { header: '#', key: 'jersey_number', align: 'center' },
  { header: 'GP', key: 'gp', align: 'center' },
  { header: 'G', key: 'goals', align: 'center' },
  { header: 'A', key: 'assists', align: 'center' },
  { header: 'PTS', key: 'points', align: 'center' },
];

const STAT_LABELS = {
  GP: 'Games Played',
  G: 'Goals',
  A: 'Assists',
  P: 'Points',
  W: 'Wins',
  SO: 'Shootout Wins',
  GAA: 'Goals Against Average',
  'SV%': 'Save Percentage',
} as const;

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const teamCodePlaceholder = (stint: PlayerStintRecord) =>
  stint.team.code ?? (stint.team.name ? stint.team.name.slice(0, 3).toUpperCase() : 'TEAM');

const formatStintDates = (stint: PlayerStintRecord) => {
  const start = stint.start_date ? DATE_FMT.format(new Date(stint.start_date)) : null;
  const end = stint.end_date ? DATE_FMT.format(new Date(stint.end_date)) : null;
  if (start && end) return `${start} - ${end}`;
  if (start) return `${start} - Present`;
  if (end) return `Until ${end}`;
  return 'Dates not set';
};

export const collapseSameTeamStints = (stints: PlayerStintRecord[]): PlayerStintRecord[] => {
  const groups: PlayerStintRecord[][] = [];

  for (const stint of stints) {
    const currentGroup = groups[groups.length - 1];
    if (currentGroup?.[0]?.team_id === stint.team_id) {
      currentGroup.push(stint);
    } else {
      groups.push([stint]);
    }
  }

  return groups.map((group) => {
    const newest = group[0];
    const oldest = group[group.length - 1];

    return {
      ...newest,
      start_date: oldest.start_date ?? newest.start_date,
      end_date: newest.end_date,
      has_stats: group.some((stint) => stint.has_stats),
      can_delete: group.every((stint) => stint.can_delete !== false),
    };
  });
};

const teamCode = (code: string | null, name: string | null) =>
  code ?? (name ? name.slice(0, 3).toUpperCase() : 'TEAM');

const formatShortDate = (iso: string | null) => {
  if (!iso) return '—';
  return DATE_FMT.format(new Date(iso));
};

const dayBefore = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
};

const formatHistoryDateRange = (startDate: string, endDate: string | null) =>
  `${formatShortDate(startDate)} - ${endDate ? formatShortDate(endDate) : 'Present'}`;

const stintHistoryKey = (stint: PlayerStintRecord) => stint.roster_player_team_id ?? stint.id;

const buildJerseyHistoryRows = (
  stint: PlayerStintRecord,
  history: JerseyHistoryEntry[],
  currentStintKey: string | null,
  currentJerseyNumber: number | null,
) => {
  const historyKey = stintHistoryKey(stint);
  const entries = history.map((entry) => ({
    id: entry.id,
    jerseyNumber: entry.jersey_number,
    effectiveFrom: entry.effective_from,
  }));

  if (
    stint.jersey_number != null &&
    stint.start_date &&
    !entries.some((entry) => entry.effectiveFrom === stint.start_date)
  ) {
    entries.push({
      id: `assumed-${stint.id}`,
      jerseyNumber: stint.jersey_number,
      effectiveFrom: stint.start_date,
    });
  }

  return entries
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    .reverse()
    .map((entry, idx, reversed) => {
      const newerEntry = reversed[idx - 1];
      const endDate = idx === 0 ? (stint.end_date ?? null) : dayBefore(newerEntry.effectiveFrom);

      return {
        id: entry.id,
        jerseyNumber: entry.jerseyNumber,
        dateRange: formatHistoryDateRange(entry.effectiveFrom, endDate),
        current:
          historyKey === currentStintKey &&
          idx === 0 &&
          currentJerseyNumber != null &&
          entry.jerseyNumber === currentJerseyNumber,
      };
    });
};

const formatSavePct = (value: number | null) => {
  if (value == null) return '—';
  return value.toFixed(3).replace(/^0/, '');
};

// Goals-against average = goals against per 60 minutes of ice time.
const formatGaa = (ga: number | null | undefined, toi: number | null | undefined) => {
  if (ga == null || !toi) return '—';
  return ((ga * 3600) / toi).toFixed(2);
};

const StatHeader = ({ label, tooltip }: { label: string; tooltip: string }) => (
  <Tooltip text={tooltip}>
    <span>{label}</span>
  </Tooltip>
);

const TeamCodeCell = ({ code, name }: { code: string | null; name: string | null }) => (
  <Tooltip text={name ?? teamCode(code, name)}>
    <span className={styles.teamCodeCell}>{teamCode(code, name)}</span>
  </Tooltip>
);

const StintHistoryDetails = ({
  stint,
  jerseyHistory,
  photoHistory,
  currentJerseyNumber,
  currentJerseyStintKey,
  currentPhotoHistoryId,
  initials,
  onPreviewPhoto,
}: {
  stint: PlayerStintRecord;
  jerseyHistory: JerseyHistoryEntry[];
  photoHistory: PlayerPhotoEntry[];
  currentJerseyNumber: number | null;
  currentJerseyStintKey: string | null;
  currentPhotoHistoryId: string | null;
  initials: string;
  onPreviewPhoto: (photo: string) => void;
}) => {
  const jerseyRows = buildJerseyHistoryRows(
    stint,
    jerseyHistory,
    currentJerseyStintKey,
    currentJerseyNumber,
  );

  return (
    <div className={styles.stintHistoryGrid}>
      <div className={styles.stintHistorySection}>
        <span className={styles.stintHistoryTitle}>Season Photos</span>
        {photoHistory.length === 0 ? (
          <p className={styles.stintHistoryEmpty}>No season photos yet.</p>
        ) : (
          <ul className={styles.stintHistoryList}>
            {photoHistory.map((entry) => {
              const current = entry.id === currentPhotoHistoryId;

              return (
                <ListItem
                  key={entry.id}
                  size="compact"
                  className={styles.stintHistoryListItem}
                  name={entry.season_name ?? 'Season'}
                  preTextContent={
                    <PlayerAvatar
                      photo={entry.photo}
                      initials={initials}
                      primaryColor={stint.team.primary_color}
                      textColor={stint.team.text_color}
                      size={32}
                    />
                  }
                  rightContent={
                    <Tag
                      label={current ? 'Current' : 'Past'}
                      intent={current ? 'success' : 'neutral'}
                    />
                  }
                  ariaLabel={`Preview ${entry.season_name ?? 'season'} photo`}
                  onClick={() => onPreviewPhoto(entry.photo)}
                />
              );
            })}
          </ul>
        )}
      </div>

      <div className={styles.stintHistorySection}>
        <span className={styles.stintHistoryTitle}>Jersey Numbers</span>
        {jerseyRows.length === 0 ? (
          <p className={styles.stintHistoryEmpty}>No jersey number history yet.</p>
        ) : (
          <ul className={styles.stintHistoryList}>
            {jerseyRows.map((entry) => (
              <ListItem
                key={entry.id}
                size="compact"
                className={styles.stintHistoryListItem}
                name={entry.dateRange}
                preTextContent={
                  <Chip
                    primaryColor={stint.team.primary_color}
                    textColor={stint.team.text_color}
                  >
                    {entry.jerseyNumber}
                  </Chip>
                }
                rightContent={
                  <Tag
                    label={entry.current ? 'Current' : 'Past'}
                    intent={entry.current ? 'success' : 'neutral'}
                  />
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const buildGameLogColumns = (isGoalie: boolean): Column<PlayerLastFiveGameRecord>[] => [
  {
    type: 'custom',
    header: 'Date',
    render: (row) => formatShortDate(row.scheduled_at),
  },
  {
    type: 'custom',
    header: 'Team',
    render: (row) => (
      <TeamCodeCell
        code={row.team_code}
        name={row.team_name}
      />
    ),
  },
  {
    type: 'custom',
    header: 'Opponent',
    render: (row) => (
      <span className={styles.opponentCell}>
        <span className={styles.opponentPrefix}>{row.is_home ? 'vs' : '@'}</span>
        <TeamCodeCell
          code={row.opponent_code}
          name={row.opponent_name}
        />
      </span>
    ),
  },
  ...(isGoalie
    ? [
        {
          type: 'custom' as const,
          header: (
            <StatHeader
              label="GS"
              tooltip="Games Started"
            />
          ),
          render: (row: PlayerLastFiveGameRecord) => (row.goalie_started ? 'Yes' : 'No'),
          align: 'center' as const,
        },
        {
          type: 'custom' as const,
          header: (
            <StatHeader
              label="SA"
              tooltip="Shots Against"
            />
          ),
          render: (row: PlayerLastFiveGameRecord) => row.shots_against ?? '—',
          align: 'center' as const,
        },
        {
          type: 'custom' as const,
          header: (
            <StatHeader
              label="GAA"
              tooltip="Goals Against Average"
            />
          ),
          render: (row: PlayerLastFiveGameRecord) => formatGaa(row.goals_against, row.time_on_ice),
          align: 'center' as const,
        },
        {
          type: 'custom' as const,
          header: (
            <StatHeader
              label="SV%"
              tooltip="Save Percentage"
            />
          ),
          render: (row: PlayerLastFiveGameRecord) => formatSavePct(row.save_pct),
          align: 'center' as const,
        },
      ]
    : [
        {
          header: (
            <StatHeader
              label="G"
              tooltip="Goals"
            />
          ),
          key: 'goals' as const,
          align: 'center' as const,
        },
        {
          header: (
            <StatHeader
              label="A"
              tooltip="Assist"
            />
          ),
          key: 'assists' as const,
          align: 'center' as const,
        },
        {
          header: (
            <StatHeader
              label="PTS"
              tooltip="Points"
            />
          ),
          key: 'points' as const,
          align: 'center' as const,
        },
      ]),
];

// ── Page ────────────────────────────────────────────────────────────────────
interface PlayerDetailsPageProps {
  mode?: 'admin' | 'user';
}

const PlayerDetailsPage = ({ mode = 'admin' }: PlayerDetailsPageProps) => {
  const navigate = useNavigate();
  const isAdminView = mode === 'admin';
  const {
    leagueCode,
    teamCode: routeTeamCode,
    playerSlug,
  } = useParams<{
    leagueCode: string;
    teamCode?: string;
    playerSlug: string;
  }>();
  const isLegacyIdRoute = !!playerSlug && UUID_PATTERN.test(playerSlug);
  const { routeLookup, loading: routeLookupLoading } = usePlayerRouteLookup(
    leagueCode,
    routeTeamCode,
    playerSlug,
    !isLegacyIdRoute,
    { mode },
  );
  const id = isLegacyIdRoute ? playerSlug : routeLookup?.player_id;
  const leagueId = isLegacyIdRoute ? leagueCode : routeLookup?.league_id;
  const teamId = isLegacyIdRoute ? routeTeamCode : routeLookup?.team_id;
  const { player, stats, loading: playerDetailsLoading } = usePlayerDetails(id, { mode });
  const loading = routeLookupLoading || playerDetailsLoading;
  const { awards: playerAwards, loading: playerAwardsLoading } = usePlayerAwards(id, { mode });
  const [seasonStatsSeasonId, setSeasonStatsSeasonId] = useState<string | null>(null);
  const {
    currentSeasonStats: seasonStats,
    loading: seasonStatsLoading,
  } = usePlayerCurrentSeasonStats(id, { mode, seasonId: seasonStatsSeasonId });
  const { lastFiveGames, loading: lastFiveGamesLoading } = usePlayerLastFiveGames(id, { mode });
  const { team: teamDetails } = useTeamDetails(teamId, { mode });
  useDocumentIcon(teamDetails?.icon);
  const adminPlayerId = isAdminView ? (id ?? null) : null;
  const { stints } = usePlayerTradeHistory(adminPlayerId);
  const { byStint: jerseyHistoryByStint } = useJerseyHistory(adminPlayerId);
  const { photos: photoHistoryEntries = [], byTeam: photoHistoryByTeam } =
    usePlayerPhotoHistory(adminPlayerId);
  const {
    createStint,
    updateStint,
    deleteStint,
    changeJerseyNumber,
    changePlayerPhoto,
    uploadStintPhoto,
    saving: stintSaving,
  } = useStintActions(adminPlayerId);
  const { teams } = useTeams({ mode });
  const { seasons } = useSeasons(leagueId, { mode });
  const queryClient = useQueryClient();
  const [activeTab, handleTabChange] = useTabState(
    isAdminView ? 'tab:player-details' : 'tab:user-player-details',
  );
  const [editPlayerOpen, setEditPlayerOpen] = useState(false);
  const [editPlayerInfoOpen, setEditPlayerInfoOpen] = useState(false);
  const [editingStint, setEditingStint] = useState<PlayerStintRecord | null>(null);
  const [deletingStint, setDeletingStint] = useState<PlayerStintRecord | null>(null);
  const [creatingStint, setCreatingStint] = useState(false);
  const [changingJerseyStint, setChangingJerseyStint] = useState<PlayerStintRecord | null>(null);
  const [changingPhotoStint, setChangingPhotoStint] = useState<PlayerStintRecord | null>(null);
  const [photoPreviewSrc, setPhotoPreviewSrc] = useState<string | null>(null);
  const [movePlayerOpen, setMovePlayerOpen] = useState(false);
  const [retirePlayerOpen, setRetirePlayerOpen] = useState(false);
  const [retirePlayerBusy, setRetirePlayerBusy] = useState(false);
  const [gameLogSeasonId, setGameLogSeasonId] = useState('all');
  const [gameLogType, setGameLogType] = useState('all');
  const [gameLogPage, setGameLogPage] = useState(1);
  const {
    gameLogs,
    total: gameLogsTotal,
    loading: gameLogsLoading,
  } = usePlayerGameLogs(
    id,
    {
      seasonId: gameLogSeasonId === 'all' ? null : gameLogSeasonId,
      gameType: gameLogType === 'all' ? null : gameLogType,
      page: gameLogPage,
      pageSize: GAME_LOG_PAGE_SIZE,
    },
    { mode },
  );

  const updatePlayer = async (
    playerId: string,
    payload: Partial<CreatePlayerData>,
  ): Promise<boolean> => {
    try {
      await axios.patch(`${API}/admin/players/${playerId}`, payload, { headers: authHeaders() });
      toast.success('Player updated!');
      await queryClient.invalidateQueries({ queryKey: ['player', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
      return true;
    } catch {
      toast.error('Failed to update player');
      return false;
    }
  };

  // Wraps updateStint so TeamPlayerEditModal can save jersey_number + photo on the latest stint.
  const updatePlayerTeam = async (
    _playerId: string,
    _teamId: string,
    _seasonId: string,
    payload: { jersey_number?: number | null; photo?: string | null },
  ): Promise<boolean> => {
    const stint = stints[0];
    if (!stint) return false;
    return updateStint(stint.id, payload);
  };

  const handleDeleteStint = async () => {
    if (!deletingStint) return;
    const ok = await deleteStint(deletingStint.id);
    if (ok) setDeletingStint(null);
  };

  const movePlayer = async (
    playerId: string,
    seasonId: string,
    toTeamId: string,
    moveDate: string,
    jerseyNumber?: number | null,
    position?: string | null,
    acquisitionType?: string | null,
  ): Promise<boolean> => {
    try {
      await axios.post(
        `${API}/admin/player-teams/trade`,
        {
          player_id: playerId,
          season_id: seasonId,
          to_team_id: toTeamId,
          trade_date: moveDate,
          jersey_number: jerseyNumber ?? null,
          position: position ?? null,
          acquisition_type: acquisitionType ?? 'trade',
        },
        { headers: authHeaders() },
      );

      toast.success('Player moved successfully!');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['player', playerId] }),
        queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] }),
        queryClient.invalidateQueries({ queryKey: ['jersey-history', playerId] }),
        queryClient.invalidateQueries({ queryKey: ['players'] }),
        queryClient.invalidateQueries({ queryKey: ['teams', teamId] }),
        queryClient.invalidateQueries({ queryKey: ['teams', toTeamId] }),
        queryClient.invalidateQueries({ queryKey: ['game-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['game-lineup'] }),
        queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['game-goals'] }),
        queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] }),
      ]);

      const toTeam = teams.find((team) => team.id === toTeamId);
      navigate(
        buildPlayerDetailsPath({
          leagueCode,
          teamCode: toTeam?.code ?? toTeamId,
          firstName: player?.first_name,
          lastName: player?.last_name,
        }),
      );
      return true;
    } catch (err) {
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : 'Failed to move player';
      toast.error(message);
      return false;
    }
  };

  const retirePlayer = async (retirementDate: string): Promise<boolean> => {
    if (!id) return false;
    setRetirePlayerBusy(true);
    try {
      await axios.patch(
        `${API}/admin/players/${id}/retire`,
        { retirement_date: retirementDate },
        { headers: authHeaders() },
      );

      toast.success('Player retired successfully!');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['player', id] }),
        queryClient.invalidateQueries({ queryKey: ['player-trade-history', id] }),
        queryClient.invalidateQueries({ queryKey: ['players'] }),
        queryClient.invalidateQueries({ queryKey: ['teams', teamId] }),
        queryClient.invalidateQueries({ queryKey: ['game-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['game-lineup'] }),
        queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['game-goals'] }),
        queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] }),
      ]);

      return true;
    } catch (err) {
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : 'Failed to retire player';
      toast.error(message);
      return false;
    } finally {
      setRetirePlayerBusy(false);
    }
  };

  const latestStint = stints[0];
  const teamHistoryStints = collapseSameTeamStints(stints);
  const fullName = player ? `${player.first_name} ${player.last_name}` : 'Not Found';
  const leagueHref = isAdminView
    ? buildLeagueDetailsPath({
        leagueCode: teamDetails?.league_code ?? routeLookup?.league_code ?? leagueCode,
        leagueId,
      })
    : '/games';
  const hasTeamRoute = !!(teamId || routeLookup?.team_id || routeTeamCode);
  const teamHref = hasTeamRoute
    ? isAdminView
      ? buildTeamDetailsPath({
          leagueCode: teamDetails?.league_code ?? routeLookup?.league_code ?? leagueCode,
          leagueId,
          teamCode: teamDetails?.code ?? routeLookup?.team_code ?? routeTeamCode,
          teamId,
        })
      : buildUserTeamDetailsPath({
          leagueCode: teamDetails?.league_code ?? routeLookup?.league_code ?? leagueCode,
          leagueId,
          teamCode: teamDetails?.code ?? routeLookup?.team_code ?? routeTeamCode,
          teamId,
        })
    : leagueHref;
  const canonicalPlayerPath =
    player && routeLookup
      ? routeLookup.team_id && routeLookup.team_code
        ? isAdminView
          ? buildPlayerDetailsPath({
              leagueCode: routeLookup.league_code,
              teamCode: routeLookup.team_code,
              firstName: player.first_name,
              lastName: player.last_name,
            })
          : buildUserPlayerDetailsPath({
              leagueCode: routeLookup.league_code,
              teamCode: routeLookup.team_code,
              firstName: player.first_name,
              lastName: player.last_name,
            })
        : isAdminView
          ? buildLeaguePlayerDetailsPath({
              leagueCode: routeLookup.league_code,
              leagueId: routeLookup.league_id,
              firstName: player.first_name,
              lastName: player.last_name,
            })
          : buildUserLeaguePlayerDetailsPath({
              leagueCode: routeLookup.league_code,
              leagueId: routeLookup.league_id,
              firstName: player.first_name,
              lastName: player.last_name,
            })
      : null;

  useEffect(() => {
    if (isLegacyIdRoute || !canonicalPlayerPath) return;
    const leagueMatches = toRouteSlug(leagueCode) === toRouteSlug(routeLookup?.league_code);
    const teamMatches =
      routeLookup?.team_code == null ||
      toRouteSlug(routeTeamCode) === toRouteSlug(routeLookup.team_code);
    if (leagueMatches && teamMatches && playerSlug === routeLookup?.player_slug) {
      return;
    }
    navigate(canonicalPlayerPath, { replace: true });
  }, [
    canonicalPlayerPath,
    isLegacyIdRoute,
    leagueCode,
    navigate,
    playerSlug,
    routeLookup?.league_code,
    routeLookup?.player_slug,
    routeLookup?.team_code,
    routeTeamCode,
  ]);

  useEffect(() => {
    if (!player) return;
    document.title = fullName;
    return () => {
      document.title = 'Hockey Tracker';
    };
  }, [player, fullName]);

  usePageBreadcrumbs(
    loading
      ? null
      : {
          backPath: isAdminView ? teamHref : hasTeamRoute ? teamHref : '/games',
          backLabel: isAdminView
            ? hasTeamRoute
              ? `Back to ${teamDetails?.name ?? 'Team'}`
              : 'Back to League'
            : hasTeamRoute
              ? `Back to ${teamDetails?.name ?? 'Team'}`
              : 'Back to Games',
          items: isAdminView
            ? [
                {
                  label:
                    teamDetails?.league_code ?? routeLookup?.league_code ?? leagueCode ?? '...',
                  path: leagueHref,
                },
                ...(hasTeamRoute
                  ? [
                      {
                        label: latestStint?.team.name ?? teamDetails?.name ?? '...',
                        path: teamHref,
                      },
                    ]
                  : []),
                { label: fullName },
              ]
            : [
                { label: 'Games', path: '/games' },
                {
                  label:
                    teamDetails?.league_code ?? routeLookup?.league_code ?? leagueCode ?? '...',
                },
                ...(hasTeamRoute
                  ? [
                      {
                        label: latestStint?.team.name ?? teamDetails?.name ?? '...',
                        path: teamHref,
                      },
                    ]
                  : []),
                { label: fullName },
              ],
        },
    [
      loading,
      teamHref,
      teamDetails?.name,
      teamDetails?.league_code,
      teamDetails?.league_name,
      latestStint?.team.name,
      fullName,
      hasTeamRoute,
      isAdminView,
      leagueCode,
      leagueId,
      leagueHref,
      routeLookup?.league_code,
    ],
  );

  useEffect(() => {
    if (loading || player) return;
    navigate(teamHref, { replace: true });
  }, [loading, navigate, player, teamHref]);

  if (loading) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading player…</p>
      </div>
    );
  }

  if (!player) return <p className={styles.loaderText}>Player not found.</p>;

  const initials = `${player.first_name[0]}${player.last_name[0]}`;
  const heroTeam =
    latestStint?.team ??
    (teamDetails
      ? {
          id: teamDetails.id,
          name: teamDetails.name,
          code: teamDetails.code,
          logo: teamDetails.logo,
          logo_dark: teamDetails.logo_dark,
          logo_light: teamDetails.logo_light,
          primary_color: teamDetails.primary_color,
          text_color: teamDetails.text_color,
        }
      : player.team_id
        ? {
            id: player.team_id,
            name: player.team_name ?? null,
            code: player.team_code ?? null,
            logo: player.team_logo ?? null,
            logo_dark: player.team_logo_dark ?? null,
            logo_light: player.team_logo_light ?? null,
            primary_color: player.primary_color ?? null,
            text_color: player.text_color ?? null,
          }
        : null);
  const jerseyNumber = latestStint?.jersey_number ?? player.jersey_number ?? null;
  // Use the first stint (active) photo; if that's missing, fall back to the most-recent
  // historical stint that does have a photo; then fall back to the global player photo.
  const heroPhotoStint = stints.find((s) => s.photo);
  const photo = heroPhotoStint?.photo ?? player.photo;
  const currentPhotoHistoryId =
    photo == null
      ? null
      : (photoHistoryEntries.find(
          (entry) =>
            entry.photo === photo &&
            (heroPhotoStint == null || entry.team_id === heroPhotoStint.team_id),
        )?.id ?? null);
  const currentJerseyStintKey = latestStint ? stintHistoryKey(latestStint) : null;
  const avatarBg = heroTeam?.primary_color ?? undefined;
  const avatarColor = heroTeam?.text_color ?? undefined;
  const effectivePosition = latestStint?.position ?? player.position;
  const canMovePlayer = !!(
    isAdminView &&
    latestStint?.team_id &&
    latestStint?.season_id &&
    !latestStint?.end_date
  );
  const playerActionItems = [
    ...(canMovePlayer
      ? [
          {
            label: 'Move Player',
            icon: 'swap_horiz',
            onClick: () => setMovePlayerOpen(true),
          },
        ]
      : []),
    ...(isAdminView && player.is_active
      ? [
          {
            label: 'Retire Player',
            icon: 'person_remove',
            intent: 'danger' as const,
            onClick: () => setRetirePlayerOpen(true),
          },
        ]
      : []),
  ];
  const positionLabel = formatPlayerPosition(effectivePosition);
  const isGoalie = effectivePosition === 'G';
  const buildGamePath = (row: PlayerLastFiveGameRecord) =>
    isAdminView
      ? buildGameDetailsPath({
          leagueCode: routeLookup?.league_code ?? leagueCode,
          leagueId,
          seasonName: row.season_name,
          seasonId: row.season_id,
          gameId: row.game_id,
          awayTeamCode: row.is_home ? row.opponent_code : row.team_code,
          homeTeamCode: row.is_home ? row.team_code : row.opponent_code,
          scheduledAt: row.scheduled_at,
        })
      : buildUserGameDetailsPath({
          gameId: row.game_id,
          awayTeamCode: row.is_home ? row.opponent_code : row.team_code,
          homeTeamCode: row.is_home ? row.team_code : row.opponent_code,
          scheduledAt: row.scheduled_at,
        });
  const recentGameColumns: Column<PlayerLastFiveGameRecord>[] = [
    {
      type: 'custom',
      header: 'Date',
      render: (row) => formatShortDate(row.scheduled_at),
    },
    {
      type: 'custom',
      header: 'Team',
      render: (row) => (
        <TeamCodeCell
          code={row.team_code}
          name={row.team_name}
        />
      ),
    },
    {
      type: 'custom',
      header: 'Opponent',
      render: (row) => (
        <span className={styles.opponentCell}>
          <span className={styles.opponentPrefix}>{row.is_home ? 'vs' : '@'}</span>
          <TeamCodeCell
            code={row.opponent_code}
            name={row.opponent_name}
          />
        </span>
      ),
    },
    ...(isGoalie
      ? [
          {
            type: 'custom' as const,
            header: (
              <StatHeader
                label="GS"
                tooltip="Games Started"
              />
            ),
            render: (row: PlayerLastFiveGameRecord) => (row.goalie_started ? 'Yes' : 'No'),
            align: 'center' as const,
          },
          {
            type: 'custom' as const,
            header: (
              <StatHeader
                label="SA"
                tooltip="Shots Against"
              />
            ),
            render: (row: PlayerLastFiveGameRecord) => row.shots_against ?? '—',
            align: 'center' as const,
          },
          {
            type: 'custom' as const,
            header: (
              <StatHeader
                label="GAA"
                tooltip="Goals Against Average"
              />
            ),
            render: (row: PlayerLastFiveGameRecord) =>
              formatGaa(row.goals_against, row.time_on_ice),
            align: 'center' as const,
          },
          {
            type: 'custom' as const,
            header: (
              <StatHeader
                label="SV%"
                tooltip="Save Percentage"
              />
            ),
            render: (row: PlayerLastFiveGameRecord) => formatSavePct(row.save_pct),
            align: 'center' as const,
          },
        ]
      : [
          {
            header: (
              <StatHeader
                label="G"
                tooltip="Goals"
              />
            ),
            key: 'goals' as const,
            align: 'center' as const,
          },
          {
            header: (
              <StatHeader
                label="A"
                tooltip="Assist"
              />
            ),
            key: 'assists' as const,
            align: 'center' as const,
          },
          {
            header: (
              <StatHeader
                label="PTS"
                tooltip="Points"
              />
            ),
            key: 'points' as const,
            align: 'center' as const,
          },
        ]),
  ];
  const gameLogColumns = buildGameLogColumns(isGoalie);
  const gameLogPageCount = Math.max(1, Math.ceil(gameLogsTotal / GAME_LOG_PAGE_SIZE));
  const gameLogSeasons = seasons.filter((season) => !leagueId || season.league_id === leagueId);
  const filteredPlayerAwards =
    gameLogSeasonId === 'all'
      ? playerAwards
      : playerAwards.filter((award) => award.season_id === gameLogSeasonId);
  const handleSeasonChange = (value: string) => {
    setGameLogSeasonId(value);
    setGameLogPage(1);
  };

  const playerEditTarget: TeamPlayerRecord = {
    ...player,
    photo,
    player_team_id: latestStint?.roster_player_team_id ?? null,
    jersey_number: latestStint?.jersey_number ?? null,
    team_id: latestStint?.team_id ?? null,
    team_name: latestStint?.team.name ?? null,
    primary_color: latestStint?.team.primary_color ?? null,
    text_color: latestStint?.team.text_color ?? null,
    is_prospect: latestStint?.is_prospect ?? false,
  };

  const playerInfoCard = (
    <Section
      title="Player Info"
      className={styles.playerInfoCard}
      action={
        isAdminView ? (
          <Button
            variant="outlined"
            intent="neutral"
            icon="edit"
            size="sm"
            onClick={() => setEditPlayerInfoOpen(true)}
          />
        ) : null
      }
    >
      <div className={styles.infoGrid}>
        <InfoCell
          label="Date of Birth"
          value={formatDate(player.date_of_birth)}
        />
        <InfoCell
          label="Birth City"
          value={player.birth_city}
        />
        <InfoCell
          label="Birth Country"
          value={player.birth_country}
        />
        <InfoCell
          label="Rookie Season"
          value={player.rookie_season_name}
        />
        <InfoCell
          label="Height"
          value={formatHeight(player.height_cm)}
        />
        <InfoCell
          label="Weight"
          value={player.weight_lbs ? `${player.weight_lbs} lbs` : null}
        />
        <InfoCell
          label={player.position === 'G' ? 'Catches' : 'Shoots'}
          value={player.shoots === 'L' ? 'Left' : player.shoots === 'R' ? 'Right' : null}
        />
      </div>
    </Section>
  );

  const seasonStatsCard = (
    <SeasonStatsSection
      stats={seasonStats}
      isGoalie={isGoalie}
      seasons={gameLogSeasons}
      selectedSeasonId={seasonStatsSeasonId ?? seasonStats?.season_id ?? null}
      loading={seasonStatsLoading}
      onSeasonChange={setSeasonStatsSeasonId}
    />
  );

  const recentGamesCard = (
    <Section
      title="Last 5 Games"
      className={styles.recentGamesCard}
    >
      <Table
        columns={recentGameColumns}
        data={lastFiveGames}
        rowKey={(row) => row.game_id}
        loading={lastFiveGamesLoading}
        emptyMessage="No recent games recorded yet."
        onRowClick={(row) => navigate(buildGamePath(row))}
      />
    </Section>
  );

  const gameLogsCard = (
    <Section
      title="Game Logs"
      action={
        <div className={styles.gameLogFilters}>
          <div className={styles.gameLogSeasonSelect}>
            <SeasonSelect
              value={gameLogSeasonId}
              seasons={gameLogSeasons}
              onChange={handleSeasonChange}
              placeholder="All seasons"
              includeAllOption
            />
          </div>
          <SegmentedControl
            value={gameLogType}
            onChange={(value) => {
              setGameLogType(value);
              setGameLogPage(1);
            }}
            variant="field"
            options={[
              { value: 'all', label: 'All' },
              { value: 'regular', label: 'Regular' },
              { value: 'playoff', label: 'Playoffs' },
            ]}
            className={styles.gameLogTypeControl}
          />
        </div>
      }
    >
      <Table
        columns={gameLogColumns}
        data={gameLogs}
        rowKey={(row) => row.game_id}
        loading={gameLogsLoading}
        emptyMessage="No game logs found."
        onRowClick={(row) => navigate(buildGamePath(row))}
      />
      <div className={styles.paginationBar}>
        <span className={styles.paginationSummary}>
          {gameLogsTotal === 0
            ? 'No games'
            : `${(gameLogPage - 1) * GAME_LOG_PAGE_SIZE + 1}-${Math.min(
                gameLogPage * GAME_LOG_PAGE_SIZE,
                gameLogsTotal,
              )} of ${gameLogsTotal}`}
        </span>
        <div className={styles.paginationActions}>
          <Button
            variant="outlined"
            intent="neutral"
            icon="chevron_left"
            size="sm"
            tooltip="Previous page"
            disabled={gameLogPage <= 1}
            onClick={() => setGameLogPage((page) => Math.max(1, page - 1))}
          />
          <span className={styles.paginationPage}>
            Page {gameLogPage} of {gameLogPageCount}
          </span>
          <Button
            variant="outlined"
            intent="neutral"
            icon="chevron_right"
            size="sm"
            tooltip="Next page"
            disabled={gameLogPage >= gameLogPageCount}
            onClick={() => setGameLogPage((page) => Math.min(gameLogPageCount, page + 1))}
          />
        </div>
      </div>
    </Section>
  );

  const awardsCard = (
    <Section
      title="Awards"
      action={
        <div className={styles.awardSeasonSelect}>
          <SeasonSelect
            value={gameLogSeasonId}
            seasons={gameLogSeasons}
            onChange={handleSeasonChange}
            placeholder="All seasons"
            includeAllOption
          />
        </div>
      }
    >
      {playerAwardsLoading ? (
        <p className={styles.placeholder}>Loading awards...</p>
      ) : filteredPlayerAwards.length === 0 ? (
        <p className={styles.placeholder}>
          {gameLogSeasonId === 'all'
            ? 'No awards recorded yet.'
            : 'No awards recorded for this season.'}
        </p>
      ) : (
        <ul className={styles.awardList}>
          {filteredPlayerAwards.map((award) => (
            <ListItem
              key={award.id}
              image={award.team_logo}
              imageDark={award.team_logo_dark}
              imageLight={award.team_logo_light}
              image_shape="square"
              name={award.award_name}
              placeholder={teamCode(award.team_code, award.team_name)}
              primaryColor={award.team_primary_color}
              textColor={award.team_text_color}
              subtitle={award.team_name ?? 'Team not recorded'}
              rightContent={{
                type: 'tag',
                label: award.season_name,
                intent: 'info',
              }}
            />
          ))}
        </ul>
      )}
    </Section>
  );

  return (
    <>
      {/* Hero card */}
      <Card>
        <div className={styles.hero}>
          {photo ? (
            <button
              type="button"
              className={styles.avatarButton}
              onClick={() => setPhotoPreviewSrc(photo)}
              aria-label={`View photo of ${fullName}`}
            >
              <PlayerAvatar
                photo={photo}
                initials={initials}
                primaryColor={avatarBg}
                textColor={avatarColor}
                size={80}
              />
            </button>
          ) : (
            <PlayerAvatar
              photo={photo}
              initials={initials}
              primaryColor={avatarBg}
              textColor={avatarColor}
              size={80}
            />
          )}
          <div className={styles.heroInfo}>
            <div className={styles.heroTitleRow}>
              <h2 className={styles.heroName}>{fullName}</h2>
            </div>
            <div className={styles.heroMeta}>
              {heroTeam?.name && (
                <span className={styles.heroTeamMeta}>
                  <TeamLogo
                    logo={heroTeam.logo}
                    logoDark={heroTeam.logo_dark}
                    logoLight={heroTeam.logo_light}
                    code={heroTeam.code ?? '?'}
                    primaryColor={heroTeam.primary_color}
                    textColor={heroTeam.text_color}
                    size={18}
                    shape="square"
                  />
                  {heroTeam.name}
                </span>
              )}
              {jerseyNumber != null && <span>#{jerseyNumber}</span>}
              {positionLabel && <span>{positionLabel}</span>}
            </div>
          </div>
          <div className={styles.heroRightCol}>
            {isAdminView && (
              <div className={styles.heroActions}>
                <Button
                  variant="outlined"
                  intent="neutral"
                  icon="edit"
                  size="sm"
                  tooltip="Edit player"
                  onClick={() => setEditPlayerOpen(true)}
                />
                {playerActionItems.length > 0 && (
                  <MoreActionsMenu
                    items={playerActionItems}
                  />
                )}
              </div>
            )}
            <div className={styles.heroStatus}>
              <Tag
                label={player.is_active ? 'Active' : 'Retired'}
                intent={player.is_active ? 'success' : 'neutral'}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className={styles.tabsWrapper}>
        <Tabs
          activeIndex={activeTab}
          onTabChange={handleTabChange}
          tabs={[
            {
              label: 'Info',
              content: (
                <div className={styles.infoSummaryGrid}>
                  {playerInfoCard}
                  {recentGamesCard}
                  {seasonStatsCard}
                </div>
              ),
            },
            {
              label: 'Game Logs',
              content: gameLogsCard,
            },
            {
              label: 'Career Stats',
              content: (
                <Section title="Career Statistics">
                  <Table
                    columns={statColumns}
                    data={stats}
                    rowKey={(r) => `${r.season_id}-${r.team_id ?? 'teamless'}`}
                    emptyMessage="No stats recorded yet."
                  />
                </Section>
              ),
            },
            {
              label: 'Awards',
              content: awardsCard,
            },
            isAdminView
              ? {
                  label: 'History',
                  content: (
                    <Section
                      title="History"
                      action={
                        <Button
                          variant="filled"
                          intent="accent"
                          icon="add"
                          size="sm"
                          onClick={() => setCreatingStint(true)}
                        >
                          Record Stint
                        </Button>
                      }
                    >
                      {teamHistoryStints.length === 0 ? (
                        <p className={styles.placeholder}>No team history yet.</p>
                      ) : (
                        <ul className={styles.stintList}>
                          {teamHistoryStints.map((s) => {
                            const jerseyHistory = jerseyHistoryByStint[stintHistoryKey(s)] ?? [];
                            const photoHistory = photoHistoryByTeam[s.team_id] ?? [];
                            const acquisitionLabel = s.acquisition_type
                              ? (ACQUISITION_TYPE_LABELS[s.acquisition_type] ?? s.acquisition_type)
                              : null;
                            const actions = [
                              !s.end_date
                                ? {
                                    icon: 'jersey',
                                    tooltip: 'Change jersey number',
                                    onClick: () => setChangingJerseyStint(s),
                                  }
                                : null,
                              {
                                icon: 'image',
                                tooltip: 'Change season photo',
                                onClick: () => setChangingPhotoStint(s),
                              },
                              {
                                icon: 'edit',
                                tooltip: 'Edit stint',
                                onClick: () => setEditingStint(s),
                              },
                              s.can_delete
                                ? {
                                    icon: 'delete',
                                    intent: 'danger' as const,
                                    tooltip: 'Delete stint',
                                    onClick: () => setDeletingStint(s),
                                  }
                                : null,
                            ].filter((action): action is NonNullable<typeof action> => action != null);

                            return (
                              <li
                                key={s.id}
                                className={styles.stintListItem}
                              >
                                <Accordion
                                  defaultOpen={false}
                                  headerType="light"
                                  className={styles.stintAccordion}
                                  rowClassName={styles.stintHeader}
                                  labelWrapClassName={styles.stintHeaderLabelWrap}
                                  labelClassName={styles.stintHeaderAccordionLabel}
                                  bodyClassName={styles.stintBody}
                                  label={
                                    <span className={styles.stintHeaderLabel}>
                                      <TeamLogo
                                        logo={s.team.logo}
                                        logoDark={s.team.logo_dark}
                                        logoLight={s.team.logo_light}
                                        code={teamCodePlaceholder(s)}
                                        primaryColor={s.team.primary_color}
                                        textColor={s.team.text_color}
                                        size={32}
                                        shape="square"
                                      />
                                      {s.jersey_number != null && (
                                        <Chip
                                          primaryColor={s.team.primary_color}
                                          textColor={s.team.text_color}
                                        >
                                          {s.jersey_number}
                                        </Chip>
                                      )}
                                      <span className={styles.stintHeaderInfo}>
                                        <span className={styles.stintHeaderName}>
                                          {s.team.name ?? 'Unknown team'}
                                        </span>
                                        <span className={styles.stintHeaderDates}>
                                          {formatStintDates(s)}
                                        </span>
                                      </span>
                                    </span>
                                  }
                                  headerRight={
                                    acquisitionLabel ? (
                                      <Tag
                                        label={acquisitionLabel}
                                        intent="info"
                                      />
                                    ) : null
                                  }
                                  hoverActions={actions}
                                >
                                  <StintHistoryDetails
                                    stint={s}
                                    jerseyHistory={jerseyHistory}
                                    photoHistory={photoHistory}
                                    currentJerseyNumber={jerseyNumber}
                                    currentJerseyStintKey={currentJerseyStintKey}
                                    currentPhotoHistoryId={currentPhotoHistoryId}
                                    initials={initials}
                                    onPreviewPhoto={(src) => setPhotoPreviewSrc(src)}
                                  />
                                </Accordion>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Section>
                  ),
                }
              : null,
          ].filter((tab): tab is NonNullable<typeof tab> => tab !== null)}
        />
      </div>

      {isAdminView && (
        <>
          <TeamPlayerEditModal
            open={editPlayerOpen}
            editTarget={playerEditTarget}
            teamId={latestStint?.team_id ?? ''}
            seasonId={latestStint?.season_id ?? null}
            onClose={() => setEditPlayerOpen(false)}
            updatePlayer={updatePlayer}
            updatePlayerTeam={updatePlayerTeam}
            uploadPlayerPhoto={uploadStintPhoto}
          />

          <MovePlayerModal
            open={movePlayerOpen}
            player={playerEditTarget}
            currentTeamId={latestStint?.team_id ?? teamId ?? ''}
            seasonId={latestStint?.season_id ?? ''}
            leagueId={leagueId ?? ''}
            onClose={() => setMovePlayerOpen(false)}
            movePlayer={movePlayer}
          />

          <RetirePlayerModal
            open={retirePlayerOpen}
            playerName={fullName}
            busy={retirePlayerBusy}
            onClose={() => setRetirePlayerOpen(false)}
            onConfirm={retirePlayer}
          />

          <PlayerInfoEditModal
            open={editPlayerInfoOpen}
            player={player}
            seasons={gameLogSeasons}
            onClose={() => setEditPlayerInfoOpen(false)}
            updatePlayer={updatePlayer}
          />

          <ChangeJerseyModal
            open={!!changingJerseyStint}
            stint={changingJerseyStint}
            onClose={() => setChangingJerseyStint(null)}
            changeJerseyNumber={changeJerseyNumber}
          />

          <StintEditModal
            open={creatingStint || !!editingStint}
            stint={editingStint}
            teams={teams}
            seasons={seasons}
            leagueId={leagueId ?? null}
            currentTeamId={latestStint?.team_id ?? teamId ?? null}
            onClose={() => {
              setEditingStint(null);
              setCreatingStint(false);
            }}
            createStint={createStint}
            updateStint={updateStint}
          />

          <ChangePhotoModal
            open={!!changingPhotoStint}
            stint={changingPhotoStint}
            seasons={seasons.filter(
              (s) =>
                s.league_id === teams.find((t) => t.id === changingPhotoStint?.team_id)?.league_id,
            )}
            history={photoHistoryByTeam[changingPhotoStint?.team_id ?? ''] ?? []}
            onClose={() => setChangingPhotoStint(null)}
            uploadPhoto={uploadStintPhoto}
            changePlayerPhoto={changePlayerPhoto}
          />

          <ConfirmModal
            open={!!deletingStint}
            title="Delete Stint"
            body={
              deletingStint ? (
                <>
                  Delete the {deletingStint.team.name ?? 'selected team'} stint from this
                  player&apos;s
                  team history? This is only allowed when the player has no stats for that team.
                </>
              ) : (
                ''
              )
            }
            confirmLabel="Delete Stint"
            confirmIcon="delete"
            variant="danger"
            busy={stintSaving}
            onConfirm={handleDeleteStint}
            onCancel={() => setDeletingStint(null)}
          />
        </>
      )}

      <ImagePreviewModal
        open={!!photoPreviewSrc}
        src={photoPreviewSrc}
        alt={fullName}
        onClose={() => setPhotoPreviewSrc(null)}
      />
    </>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────
// ── Helper: label/value cell ────────────────────────────────────────────────
const RetirePlayerModal = ({
  open,
  playerName,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  playerName: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (retirementDate: string) => Promise<boolean>;
}) => {
  const { control, handleSubmit, reset, watch } = useForm<{ retirement_date: string }>({
    defaultValues: { retirement_date: '' },
  });
  const retirementDate = watch('retirement_date');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    reset({ retirement_date: '' });
    setIsSubmitting(false);
  }, [open, reset]);

  const handleClose = () => {
    reset({ retirement_date: '' });
    onClose();
  };

  const onSubmit = handleSubmit(async ({ retirement_date }) => {
    if (!retirement_date) return;

    setIsSubmitting(true);
    const ok = await onConfirm(retirement_date);
    setIsSubmitting(false);
    if (ok) handleClose();
  });

  return (
    <Modal
      open={open}
      title="Retire Player"
      onClose={handleClose}
      confirmLabel={isSubmitting || busy ? 'Retiring...' : 'Retire Player'}
      confirmForm="retire-player-form"
      confirmIntent="danger"
      confirmDisabled={isSubmitting || busy || !retirementDate}
      busy={isSubmitting || busy}
    >
      <form
        id="retire-player-form"
        className={styles.retireForm}
        onSubmit={onSubmit}
      >
        <p className={styles.retireCopy}>
          This will mark {playerName} as retired and close their latest active team stint.
        </p>
        <Field
          label="Retirement Date"
          type="datepicker"
          control={control}
          name="retirement_date"
          rules={{ required: 'Retirement date is required' }}
          placeholder="Select retirement date..."
          required
          autoFocus
        />
      </form>
    </Modal>
  );
};

const InfoCell = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className={styles.infoCell}>
    <span className={styles.infoCellLabel}>{label}</span>
    {value ? (
      <span className={styles.infoCellValue}>{value}</span>
    ) : (
      <span className={styles.infoCellMuted}>—</span>
    )}
  </div>
);

export default PlayerDetailsPage;

// ── Helper: selected-season stat section ────────────────────────────────────
const SeasonStatsSection = ({
  stats,
  isGoalie,
  seasons,
  selectedSeasonId,
  loading,
  onSeasonChange,
}: {
  stats: PlayerCurrentSeasonStats | null;
  isGoalie: boolean;
  seasons: SeasonRecord[];
  selectedSeasonId: string | null;
  loading: boolean;
  onSeasonChange: (seasonId: string) => void;
}) => (
  <Section
    title="Season Stats"
    className={styles.currentSeasonCards}
    action={
      !loading || stats ? (
        <div className={styles.seasonStatsSelect}>
          <SeasonSelect
            value={selectedSeasonId}
            seasons={seasons}
            onChange={onSeasonChange}
            placeholder="Select season..."
          />
        </div>
      ) : null
    }
  >
    {loading && !stats ? (
      <p className={styles.placeholder}>Loading season stats...</p>
    ) : !stats ? (
      <p className={styles.placeholder}>No season stats recorded yet.</p>
    ) : (
      <div className={styles.seasonStatsGroups}>
        <SeasonStatBlock
          title="Regular Season"
          stats={stats.regular}
          isGoalie={isGoalie}
        />
        <SeasonStatBlock
          title="Playoffs"
          stats={stats.playoffs}
          isGoalie={isGoalie}
        />
      </div>
    )}
  </Section>
);

const SeasonStatBlock = ({
  title,
  stats,
  isGoalie,
}: {
  title: string;
  stats: PlayerCurrentSeasonStatBlock | null;
  isGoalie: boolean;
}) => {
  const fmtSavePct = (v: number | null) => {
    if (v == null) return '—';
    return v.toFixed(3).replace(/^0/, '');
  };

  return (
    <div className={styles.seasonStatsGroup}>
      <h3 className={styles.seasonStatsGroupTitle}>{title}</h3>
      {!stats ? (
        <p className={styles.placeholder}>No games played.</p>
      ) : isGoalie ? (
        <div className={`${styles.statGrid} ${styles.statGridGoalie}`}>
          <StatCell
            label="GP"
            tooltip={STAT_LABELS.GP}
            value={stats.gp}
          />
          <StatCell
            label="W"
            tooltip={STAT_LABELS.W}
            value={stats.wins}
          />
          <StatCell
            label="SO"
            tooltip={STAT_LABELS.SO}
            value={stats.shootout_wins}
          />
          <StatCell
            label="GAA"
            tooltip={STAT_LABELS.GAA}
            value={formatGaa(stats.goals_against, stats.time_on_ice)}
          />
          <StatCell
            label="SV%"
            tooltip={STAT_LABELS['SV%']}
            value={fmtSavePct(stats.save_pct)}
          />
        </div>
      ) : (
        <div className={styles.statGrid}>
          <StatCell
            label="GP"
            tooltip={STAT_LABELS.GP}
            value={stats.gp}
          />
          <StatCell
            label="G"
            tooltip={STAT_LABELS.G}
            value={stats.goals}
          />
          <StatCell
            label="A"
            tooltip={STAT_LABELS.A}
            value={stats.assists}
          />
          <StatCell
            label="P"
            tooltip={STAT_LABELS.P}
            value={stats.points}
          />
        </div>
      )}
    </div>
  );
};

const StatCell = ({
  label,
  tooltip,
  value,
}: {
  label: string;
  tooltip: string;
  value: number | string;
}) => (
  <StatItem
    className={styles.statCell}
    label={label}
    tooltip={tooltip}
    value={value}
  />
);
