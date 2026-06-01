import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ImagePreviewModal from '@/components/ImagePreviewModal/ImagePreviewModal';
import ListItem from '@/components/ListItem/ListItem';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import Select from '@/components/Select/Select';
import Table, { type Column } from '@/components/Table/Table';
import Tabs from '@/components/Tabs/Tabs';
import Tooltip from '@/components/Tooltip/Tooltip';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import usePlayerDetails, {
  usePlayerCurrentSeasonStats,
  usePlayerGameLogs,
  usePlayerLastFiveGames,
  usePlayerRouteLookup,
  type PlayerCareerStatRecord,
  type PlayerCurrentSeasonStatBlock,
  type PlayerLastFiveGameRecord,
} from '@/hooks/usePlayerDetails';
import useTeamDetails from '@/hooks/useTeamDetails';
import useSeasons from '@/hooks/useSeasons';
import useTeams from '@/hooks/useTeams';
import {
  usePlayerTradeHistory,
  useStintActions,
  useJerseyHistory,
  usePlayerPhotoHistory,
  type PlayerStintRecord,
  type TeamPlayerRecord,
} from '@/hooks/useTeamPlayers';
import { type CreatePlayerData } from '@/hooks/useLeaguePlayers';
import useTabState from '@/hooks/useTabState';
import { buildPlayerDetailsPath, toRouteSlug } from '@/lib/routeSlugs';
import TeamPlayerEditModal from '../teams/TeamPlayerEditModal';
import MovePlayerModal from '../teams/MovePlayerModal';
import StintEditModal, { ACQUISITION_TYPE_LABELS } from './StintEditModal';
import ChangeJerseyModal from './ChangeJerseyModal';
import ChangePhotoModal from './ChangePhotoModal';
import PlayerInfoEditModal from './PlayerInfoEditModal';
import styles from './PlayerDetails.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const GAME_LOG_PAGE_SIZE = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const POSITION_LABELS: Record<string, string> = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  F: 'Forward',
  D: 'Defense',
  LD: 'Left Defense',
  RD: 'Right Defense',
  G: 'Goalie',
};

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
  GA: 'Goals Against',
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

const teamCode = (code: string | null, name: string | null) =>
  code ?? (name ? name.slice(0, 3).toUpperCase() : 'TEAM');

const formatShortDate = (iso: string | null) => {
  if (!iso) return '—';
  return DATE_FMT.format(new Date(iso));
};

const formatSavePct = (value: number | null) => {
  if (value == null) return '—';
  return value.toFixed(3).replace(/^0/, '');
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
              label="GA"
              tooltip="Goals Against"
            />
          ),
          render: (row: PlayerLastFiveGameRecord) => row.goals_against ?? '—',
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
const PlayerDetailsPage = () => {
  const navigate = useNavigate();
  const { leagueCode, teamCode: routeTeamCode, playerSlug } = useParams<{
    leagueCode: string;
    teamCode: string;
    playerSlug: string;
  }>();
  const isLegacyIdRoute = !!playerSlug && UUID_PATTERN.test(playerSlug);
  const { routeLookup, loading: routeLookupLoading } = usePlayerRouteLookup(
    leagueCode,
    routeTeamCode,
    playerSlug,
    !isLegacyIdRoute,
  );
  const id = isLegacyIdRoute ? playerSlug : routeLookup?.player_id;
  const leagueId = isLegacyIdRoute ? leagueCode : routeLookup?.league_id;
  const teamId = isLegacyIdRoute ? routeTeamCode : routeLookup?.team_id;
  const { player, stats, loading: playerDetailsLoading } = usePlayerDetails(id);
  const loading = routeLookupLoading || playerDetailsLoading;
  const { currentSeasonStats: latestSeasonStats } = usePlayerCurrentSeasonStats(id);
  const { lastFiveGames, loading: lastFiveGamesLoading } = usePlayerLastFiveGames(id);
  const { team: teamDetails } = useTeamDetails(teamId);
  const { stints } = usePlayerTradeHistory(id ?? null);
  const { byStint: jerseyHistoryByStint } = useJerseyHistory(id ?? null);
  const { byTeam: photoHistoryByTeam } = usePlayerPhotoHistory(id ?? null);
  const { createStint, updateStint, changeJerseyNumber, changePlayerPhoto, uploadStintPhoto } =
    useStintActions(id ?? null);
  const { teams } = useTeams();
  const { seasons } = useSeasons();
  const queryClient = useQueryClient();
  const [activeTab, handleTabChange] = useTabState('tab:player-details');
  const [editPlayerOpen, setEditPlayerOpen] = useState(false);
  const [editPlayerInfoOpen, setEditPlayerInfoOpen] = useState(false);
  const [editingStint, setEditingStint] = useState<PlayerStintRecord | null>(null);
  const [creatingStint, setCreatingStint] = useState(false);
  const [changingJerseyStint, setChangingJerseyStint] = useState<PlayerStintRecord | null>(null);
  const [changingPhotoStint, setChangingPhotoStint] = useState<PlayerStintRecord | null>(null);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [movePlayerOpen, setMovePlayerOpen] = useState(false);
  const [gameLogSeasonId, setGameLogSeasonId] = useState('all');
  const [gameLogType, setGameLogType] = useState('all');
  const [gameLogPage, setGameLogPage] = useState(1);
  const {
    gameLogs,
    total: gameLogsTotal,
    loading: gameLogsLoading,
  } = usePlayerGameLogs(id, {
    seasonId: gameLogSeasonId === 'all' ? null : gameLogSeasonId,
    gameType: gameLogType === 'all' ? null : gameLogType,
    page: gameLogPage,
    pageSize: GAME_LOG_PAGE_SIZE,
  });

  const updatePlayer = async (
    playerId: string,
    payload: Partial<CreatePlayerData>,
  ): Promise<boolean> => {
    try {
      await axios.patch(`${API}/admin/players/${playerId}`, payload, { headers: authHeaders() });
      toast.success('Player updated!');
      await queryClient.invalidateQueries({ queryKey: ['player', playerId] });
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

  const latestStint = stints[0];
  const fullName = player ? `${player.first_name} ${player.last_name}` : 'Not Found';
  const teamHref = `/admin/leagues/${leagueId}/teams/${teamId}`;
  const canonicalPlayerPath =
    player && routeLookup
      ? buildPlayerDetailsPath({
          leagueCode: routeLookup.league_code,
          teamCode: routeLookup.team_code,
          firstName: player.first_name,
          lastName: player.last_name,
        })
      : null;

  useEffect(() => {
    if (isLegacyIdRoute || !canonicalPlayerPath) return;
    if (
      toRouteSlug(leagueCode) === toRouteSlug(routeLookup?.league_code) &&
      toRouteSlug(routeTeamCode) === toRouteSlug(routeLookup?.team_code) &&
      playerSlug === routeLookup?.player_slug
    ) {
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
          backPath: teamHref,
          backLabel: `Back to ${teamDetails?.name ?? 'Team'}`,
          items: [
            { label: teamDetails?.league_name ?? '...', path: `/admin/leagues/${leagueId}` },
            {
              label: latestStint?.team.name ?? teamDetails?.name ?? '...',
              path: teamHref,
            },
            { label: fullName },
          ],
        },
    [
      loading,
      teamHref,
      teamDetails?.name,
      teamDetails?.league_name,
      latestStint?.team.name,
      fullName,
      leagueId,
    ],
  );

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
  const jerseyNumber = latestStint?.jersey_number ?? null;
  // Use the first stint (active) photo; if that's missing, fall back to the most-recent
  // historical stint that does have a photo; then fall back to the global player photo.
  const photo = stints.find((s) => s.photo)?.photo ?? player.photo;
  const avatarBg = latestStint?.team.primary_color ?? undefined;
  const avatarColor = latestStint?.team.text_color ?? undefined;
  const effectivePosition = latestStint?.position ?? player.position;
  const canMovePlayer = !!(
    latestStint?.team_id &&
    latestStint?.season_id &&
    !latestStint?.end_date
  );
  const positionLabel = effectivePosition
    ? (POSITION_LABELS[effectivePosition] ?? effectivePosition)
    : null;
  const isGoalie = effectivePosition === 'G';
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
                label="GA"
                tooltip="Goals Against"
              />
            ),
            render: (row: PlayerLastFiveGameRecord) => row.goals_against ?? '—',
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
  const filteredSeasonOptions = [
    { value: 'all', label: 'All seasons' },
    ...seasons
      .filter((season) => !leagueId || season.league_id === leagueId)
      .map((season) => ({ value: season.id, label: season.name })),
  ];

  const playerEditTarget: TeamPlayerRecord = {
    ...player,
    photo,
    player_team_id: latestStint?.id ?? null,
    jersey_number: latestStint?.jersey_number ?? null,
    team_id: latestStint?.team_id ?? null,
    team_name: latestStint?.team.name ?? null,
    primary_color: latestStint?.team.primary_color ?? null,
    text_color: latestStint?.team.text_color ?? null,
    is_prospect: latestStint?.is_prospect ?? false,
  };

  const playerInfoCard = (
    <Card
      title="Player Info"
      className={styles.playerInfoCard}
      action={
        <Button
          variant="outlined"
          intent="neutral"
          icon="edit"
          size="sm"
          onClick={() => setEditPlayerInfoOpen(true)}
        />
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
          label="Nationality"
          value={player.nationality}
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
    </Card>
  );

  const recentGamesCard = (
    <Card
      title="Last 5 Games"
      className={styles.recentGamesCard}
    >
      <Table
        columns={recentGameColumns}
        data={lastFiveGames}
        rowKey={(row) => row.game_id}
        loading={lastFiveGamesLoading}
        emptyMessage="No recent games recorded yet."
        onRowClick={(row) =>
          navigate(`/admin/leagues/${leagueId}/seasons/${row.season_id}/games/${row.game_id}`)
        }
      />
    </Card>
  );

  const gameLogsCard = (
    <Card
      title="Game Logs"
      action={
        <div className={styles.gameLogFilters}>
          <div className={styles.gameLogSeasonSelect}>
            <Select
              value={gameLogSeasonId}
              options={filteredSeasonOptions}
              onChange={(value) => {
                setGameLogSeasonId(value);
                setGameLogPage(1);
              }}
              placeholder="All seasons"
            />
          </div>
          <SegmentedControl
            value={gameLogType}
            onChange={(value) => {
              setGameLogType(value);
              setGameLogPage(1);
            }}
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
        onRowClick={(row) =>
          navigate(`/admin/leagues/${leagueId}/seasons/${row.season_id}/games/${row.game_id}`)
        }
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
    </Card>
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
              onClick={() => setPhotoPreviewOpen(true)}
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
            <h2 className={styles.heroName}>{fullName}</h2>
            <div className={styles.heroMeta}>
              {positionLabel && <span>{positionLabel}</span>}
              {jerseyNumber != null && <span>#{jerseyNumber}</span>}
              {latestStint?.team.name && <span>{latestStint.team.name}</span>}
            </div>
          </div>
          <span
            className={`${styles.statusBadge} ${player.is_active ? styles.statusActive : styles.statusInactive}`}
          >
            {player.is_active ? 'Active' : 'Inactive'}
          </span>
          <div className={styles.heroActions}>
            {canMovePlayer && (
              <Button
                variant="outlined"
                intent="neutral"
                icon="swap_horiz"
                size="sm"
                tooltip="Move player"
                onClick={() => setMovePlayerOpen(true)}
              />
            )}
            <Button
              variant="outlined"
              intent="neutral"
              icon="edit"
              size="sm"
              tooltip="Edit player"
              onClick={() => setEditPlayerOpen(true)}
            />
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
                  {latestSeasonStats && (
                    <div className={styles.currentSeasonCards}>
                      <SeasonStatCard
                        title={`${latestSeasonStats.season_name} Regular Season`}
                        stats={latestSeasonStats.regular}
                        isGoalie={isGoalie}
                      />
                      <SeasonStatCard
                        title={`${latestSeasonStats.season_name} Playoffs`}
                        stats={latestSeasonStats.playoffs}
                        isGoalie={isGoalie}
                      />
                    </div>
                  )}
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
                <Card title="Career Statistics">
                  <Table
                    columns={statColumns}
                    data={stats}
                    rowKey={(r) => `${r.season_id}-${r.team_id ?? 'teamless'}`}
                    emptyMessage="No stats recorded yet."
                  />
                </Card>
              ),
            },
            {
              label: 'Team History',
              content: (
                <Card
                  title="Team History"
                  action={
                    <Button
                      variant="outlined"
                      intent="neutral"
                      icon="add"
                      size="sm"
                      onClick={() => setCreatingStint(true)}
                    >
                      Record Stint
                    </Button>
                  }
                >
                  {stints.length === 0 ? (
                    <p className={styles.placeholder}>No team history yet.</p>
                  ) : (
                    <ul className={styles.stintList}>
                      {stints.map((s) => (
                        <ListItem
                          key={s.id}
                          className={styles.stintItem}
                          image={s.team.logo}
                          image_shape="square"
                          name={s.team.name ?? 'Unknown team'}
                          placeholder={teamCodePlaceholder(s)}
                          primaryColor={s.team.primary_color}
                          textColor={s.team.text_color}
                          jerseyNumber={s.jersey_number}
                          subtitle={formatStintDates(s)}
                          rightContent={
                            s.acquisition_type
                              ? {
                                  type: 'tag',
                                  label:
                                    ACQUISITION_TYPE_LABELS[s.acquisition_type] ??
                                    s.acquisition_type,
                                  intent: 'info',
                                }
                              : undefined
                          }
                          actions={[
                            !s.end_date && {
                              icon: 'jersey',
                              tooltip: 'Change jersey number',
                              onClick: () => setChangingJerseyStint(s),
                            },
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
                          ]}
                        />
                      ))}
                    </ul>
                  )}
                </Card>
              ),
            },
          ]}
        />
      </div>

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

      <PlayerInfoEditModal
        open={editPlayerInfoOpen}
        player={player}
        onClose={() => setEditPlayerInfoOpen(false)}
        updatePlayer={updatePlayer}
      />

      <ChangeJerseyModal
        open={!!changingJerseyStint}
        stint={changingJerseyStint}
        history={jerseyHistoryByStint[changingJerseyStint?.id ?? ''] ?? []}
        onClose={() => setChangingJerseyStint(null)}
        changeJerseyNumber={changeJerseyNumber}
      />

      <StintEditModal
        open={creatingStint || !!editingStint}
        stint={editingStint}
        teams={teams}
        seasons={seasons}
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
          (s) => s.league_id === teams.find((t) => t.id === changingPhotoStint?.team_id)?.league_id,
        )}
        history={photoHistoryByTeam[changingPhotoStint?.team_id ?? ''] ?? []}
        onClose={() => setChangingPhotoStint(null)}
        uploadPhoto={uploadStintPhoto}
        changePlayerPhoto={changePlayerPhoto}
      />

      <ImagePreviewModal
        open={photoPreviewOpen}
        src={photo}
        alt={fullName}
        onClose={() => setPhotoPreviewOpen(false)}
      />
    </>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────
// ── Helper: label/value cell ────────────────────────────────────────────────
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

// ── Helper: current-season stat card ────────────────────────────────────────
const SeasonStatCard = ({
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
    <Card title={title}>
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
            label="GA"
            tooltip={STAT_LABELS.GA}
            value={stats.goals_against}
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
    </Card>
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
  <div className={styles.statCell}>
    <Tooltip text={tooltip}>
      <span className={styles.statCellLabel}>{label}</span>
    </Tooltip>
    <span className={value === '—' ? styles.statCellMuted : styles.statCellValue}>{value}</span>
  </div>
);
