import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import LeagueAlignmentsTab, { LeagueAlignmentsTabSkeleton } from './LeagueAlignmentsTab';
import LeagueAwardsTab, { LeagueAwardsTabSkeleton } from './LeagueAwardsTab';
import LeagueEditModal from './LeagueEditModal';
import LeagueInfoTab, { LeagueInfoTabSkeleton } from './LeagueInfoTab';
import LeaguePlayersTab, { LeaguePlayersTabSkeleton } from './LeaguePlayersTab';
import LeaguePlayoffsTab, { LeaguePlayoffsTabSkeleton } from './LeaguePlayoffsTab';
import LeagueTeamsTab, { LeagueTeamsTabSkeleton } from './LeagueTeamsTab';
import LeagueSeasonsTab, { LeagueSeasonsTabSkeleton } from './LeagueSeasonsTab';
import BulkAddPlayersModal from './BulkAddPlayersModal';
import PlayerFormModal from './PlayerFormModal';
import SeasonDeleteModal from '../seasons/SeasonDeleteModal';
import SeasonFormModal from '../seasons/SeasonFormModal';
import Skeleton from '@/components/Skeleton/Skeleton';
import Tabs from '@/components/Tabs/Tabs';
import TeamFormModal from '../teams/TeamFormModal';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import useDocumentIcon from '@/hooks/useDocumentIcon';
import useLeagueDetails, { type LeagueSeasonRecord } from '@/hooks/useLeagueDetails';
import useLeaguePlayers, { type PlayerRecord } from '@/hooks/useLeaguePlayers';
import useLeagues from '@/hooks/useLeagues';
import useTabState from '@/hooks/useTabState';
import { type TeamRecord } from '@/hooks/useTeams';
import { type SeasonRecord } from '@/hooks/useSeasons';
import {
  UUID_PATTERN,
  buildLeagueDetailsPath,
  buildSeasonDetailsPath,
  toRouteSlug,
} from '@/lib/routeSlugs';
import { LeagueDetailsProvider } from './LeagueDetailsContext';
import styles from './LeagueDetails.module.scss';

const PLAYERS_PAGE_SIZE = 15;

const LeagueDetailsPage = () => {
  const navigate = useNavigate();
  const { leagueSlug: routeLeagueSlug, id: legacyLeagueId } = useParams<{
    leagueSlug?: string;
    id?: string;
  }>();
  const leagueSlug = routeLeagueSlug ?? legacyLeagueId;
  const isLegacyIdRoute = !!leagueSlug && UUID_PATTERN.test(leagueSlug);
  const { leagues: allLeagues, loading: leaguesLoading } = useLeagues();
  const routeLeague = isLegacyIdRoute
    ? null
    : allLeagues.find(
        (item) => toRouteSlug(item.code) === leagueSlug || toRouteSlug(item.name) === leagueSlug,
      );
  const id = isLegacyIdRoute ? leagueSlug : routeLeague?.id;
  const [activeTab, handleTabChange] = useTabState('tab:league-details');
  const {
    league,
    teams,
    seasons,
    loading,
    busy,
    uploadLogo,
    uploadTeamLogo,
    updateLeague,
    addTeam,
    updateTeam,
    deleteTeam,
    addSeason,
    updateSeason,
    deleteSeason,
  } = useLeagueDetails(id);
  useDocumentIcon(league?.icon);
  const leagueLoading = loading || (!isLegacyIdRoute && leaguesLoading);
  useEffect(() => {
    if (!league?.code) return;
    document.title = league.code;
    return () => {
      document.title = 'Hockey Tracker';
    };
  }, [league?.code]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  // Team modal / delete state
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editTargetTeam, setEditTargetTeam] = useState<TeamRecord | null>(null);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<TeamRecord | null>(null);
  // Season modal state
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  const [editTargetSeason, setEditTargetSeason] = useState<LeagueSeasonRecord | null>(null);
  const [confirmDeleteSeason, setConfirmDeleteSeason] = useState<LeagueSeasonRecord | null>(null);
  const [confirmDeleteSeasonOpen, setConfirmDeleteSeasonOpen] = useState(false);
  // Player modal state
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [editTargetPlayer, setEditTargetPlayer] = useState<PlayerRecord | null>(null);
  const [playersPage, setPlayersPage] = useState(1);
  const [playersSearch, setPlayersSearch] = useState('');

  usePageBreadcrumbs(
    leagueLoading
      ? {
          backPath: '/admin/leagues',
          backLabel: 'Back to Leagues',
          items: [
            {
              label: (
                <Skeleton
                  type="text"
                  className={styles.breadcrumbSkeleton}
                />
              ),
            },
          ],
        }
      : {
          backPath: '/admin/leagues',
          backLabel: 'Back to Leagues',
          items: [league ? { label: league.code } : { label: 'Not Found' }],
        },
    [leagueLoading, league?.name, league?.code],
  );

  useEffect(() => {
    if (isLegacyIdRoute || !league) return;
    const canonicalPath = buildLeagueDetailsPath({
      leagueCode: league.code,
      leagueId: league.id,
    });
    if (leagueSlug !== toRouteSlug(league.code)) {
      navigate(canonicalPath, { replace: true });
    }
  }, [isLegacyIdRoute, league, leagueSlug, navigate]);

  useEffect(() => {
    if (leagueLoading || league) return;
    navigate('/admin/leagues', { replace: true });
  }, [league, leagueLoading, navigate]);

  const {
    players,
    total: playersTotal,
    loading: playersLoading,
    fetching: playersFetching,
    busy: playerBusy,
    addPlayer,
    bulkAddPlayers,
    updatePlayer,
    deletePlayer,
  } = useLeaguePlayers(id, undefined, {
    page: playersPage,
    pageSize: PLAYERS_PAGE_SIZE,
    search: playersSearch,
    includeInactive: true,
    includeProspects: true,
    recentSeasons: 5,
  });
  const leagueContextValue = useMemo(
    () =>
      league
        ? {
            league,
            teams,
            seasons,
            loading,
            busy,
            players: {
              players,
              total: playersTotal,
              page: playersPage,
              pageSize: PLAYERS_PAGE_SIZE,
              search: playersSearch,
              loading: playersLoading,
              fetching: playersFetching,
              busy: playerBusy,
              onPageChange: setPlayersPage,
              onSearchChange: (query: string) => {
                setPlayersPage(1);
                setPlayersSearch(query);
              },
              onAdd: () => {
                setEditTargetPlayer(null);
                setPlayerModalOpen(true);
              },
              onBulkAdd: () => setBulkAddOpen(true),
              onEdit: (p: PlayerRecord) => {
                setEditTargetPlayer(p);
                setPlayerModalOpen(true);
              },
              onDelete: deletePlayer,
            },
            onAddTeam: () => {
              setEditTargetTeam(null);
              setTeamModalOpen(true);
            },
            onEditTeam: (t: TeamRecord) => {
              setEditTargetTeam(t);
              setTeamModalOpen(true);
            },
            onDeleteTeam: (t: TeamRecord) => setConfirmDeleteTeam(t),
            onAddSeason: () => {
              setEditTargetSeason(null);
              setSeasonModalOpen(true);
            },
            onEditSeason: (s: LeagueSeasonRecord) => {
              setEditTargetSeason(s);
              setSeasonModalOpen(true);
            },
            onDeleteSeason: (s: LeagueSeasonRecord) => {
              setConfirmDeleteSeason(s);
              setConfirmDeleteSeasonOpen(true);
            },
            getSeasonHref: (s: LeagueSeasonRecord) =>
              buildSeasonDetailsPath({
                leagueCode: league.code,
                leagueId: league.id,
                seasonName: s.name,
                seasonId: s.id,
              }),
          }
        : null,
    [
      busy,
      deletePlayer,
      league,
      loading,
      navigate,
      playerBusy,
      players,
      playersFetching,
      playersLoading,
      playersPage,
      playersSearch,
      playersTotal,
      seasons,
      teams,
    ],
  );

  if (leagueLoading) {
    return (
      <Tabs
        activeIndex={activeTab}
        onTabChange={handleTabChange}
        tabs={[
          {
            label: 'Info',
            icon: 'info',
            content: <LeagueInfoTabSkeleton />,
          },
          {
            label: 'Seasons',
            icon: 'calendar_month',
            content: <LeagueSeasonsTabSkeleton />,
          },
          {
            label: 'Teams',
            icon: 'group',
            content: <LeagueTeamsTabSkeleton />,
          },
          {
            label: 'Players',
            icon: 'groups',
            content: <LeaguePlayersTabSkeleton />,
          },
          {
            label: 'Alignments',
            icon: 'account_tree',
            content: <LeagueAlignmentsTabSkeleton />,
          },
          {
            label: 'Playoffs',
            icon: 'emoji_events',
            content: <LeaguePlayoffsTabSkeleton />,
          },
          {
            label: 'Awards',
            icon: 'workspace_premium',
            content: <LeagueAwardsTabSkeleton />,
          },
        ]}
      />
    );
  }

  if (!league) {
    return <p style={{ color: 'var(--text-dim)' }}>League not found.</p>;
  }

  if (!leagueContextValue) {
    return null;
  }

  return (
    <>
      <LeagueDetailsProvider value={leagueContextValue}>
        <Tabs
          activeIndex={activeTab}
          onTabChange={handleTabChange}
          tabs={[
            {
              label: 'Info',
              icon: 'info',
              content: (
                <LeagueInfoTab
                  league={league}
                  onEdit={() => setEditModalOpen(true)}
                />
              ),
            },
            {
              label: 'Seasons',
              icon: 'calendar_month',
              content: <LeagueSeasonsTab />,
            },
            {
              label: 'Teams',
              icon: 'group',
              content: <LeagueTeamsTab />,
            },
            {
              label: 'Players',
              icon: 'groups',
              content: <LeaguePlayersTab />,
            },
            {
              label: 'Alignments',
              icon: 'account_tree',
              content: <LeagueAlignmentsTab />,
            },
            {
              label: 'Playoffs',
              icon: 'emoji_events',
              content: <LeaguePlayoffsTab leagueId={league.id} />,
            },
            {
              label: 'Awards',
              icon: 'workspace_premium',
              content: <LeagueAwardsTab leagueId={league.id} />,
            },
          ]}
        />
      </LeagueDetailsProvider>

      <ConfirmModal
        open={confirmDeleteTeam !== null}
        title="Delete Team"
        body={
          <>
            Are you sure you want to delete <strong>{confirmDeleteTeam?.name}</strong>? This cannot
            be undone.
          </>
        }
        confirmLabel="Delete"
        confirmIcon="delete"
        variant="danger"
        busy={busy === confirmDeleteTeam?.id}
        onCancel={() => setConfirmDeleteTeam(null)}
        onConfirm={async () => {
          if (!confirmDeleteTeam) return;
          await deleteTeam(confirmDeleteTeam.id);
          setConfirmDeleteTeam(null);
        }}
      />

      <LeagueEditModal
        open={editModalOpen}
        league={league}
        uploadLogo={uploadLogo}
        updateLeague={updateLeague}
        onClose={() => setEditModalOpen(false)}
      />

      <TeamFormModal
        open={teamModalOpen}
        editTarget={editTargetTeam}
        lockedLeagueId={league.id}
        onClose={() => {
          setTeamModalOpen(false);
          setEditTargetTeam(null);
        }}
        addTeam={async (payload) => {
          const newTeamId = await addTeam(payload);
          return newTeamId !== null;
        }}
        updateTeam={updateTeam}
        uploadLogo={uploadTeamLogo}
      />

      <SeasonDeleteModal
        open={confirmDeleteSeasonOpen}
        busy={busy}
        target={confirmDeleteSeason as SeasonRecord | null}
        onCancel={() => {
          setConfirmDeleteSeasonOpen(false);
          setConfirmDeleteSeason(null);
        }}
        onConfirm={async () => {
          await deleteSeason(confirmDeleteSeason!.id);
          setConfirmDeleteSeasonOpen(false);
          setConfirmDeleteSeason(null);
        }}
      />

      <SeasonFormModal
        open={seasonModalOpen}
        editTarget={editTargetSeason as SeasonRecord | null}
        leagueOptions={
          league
            ? [{ value: league.id, label: league.name, logo: league.logo, code: league.code }]
            : []
        }
        lockedLeagueId={league.id}
        onClose={() => {
          setSeasonModalOpen(false);
          setEditTargetSeason(null);
        }}
        addSeason={addSeason}
        updateSeason={updateSeason}
      />

      <PlayerFormModal
        open={playerModalOpen}
        editTarget={editTargetPlayer}
        seasons={seasons}
        onClose={() => {
          setPlayerModalOpen(false);
          setEditTargetPlayer(null);
        }}
        addPlayer={addPlayer}
        updatePlayer={updatePlayer}
      />

      <BulkAddPlayersModal
        open={bulkAddOpen}
        onClose={() => setBulkAddOpen(false)}
        bulkAddPlayers={bulkAddPlayers}
      />
    </>
  );
};

export default LeagueDetailsPage;
