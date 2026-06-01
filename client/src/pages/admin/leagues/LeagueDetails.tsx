import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import LeagueEditModal from './LeagueEditModal';
import LeagueInfoCard from './LeagueInfoCard';
import LeaguePlayersTab from './LeaguePlayersTab';
import LeaguePlayoffsTab from './LeaguePlayoffsTab';
import LeagueTeamsTab from './LeagueTeamsTab';
import LeagueSeasonsCard from './LeagueSeasonsCard';
import BulkAddPlayersModal from './BulkAddPlayersModal';
import PlayerFormModal from './PlayerFormModal';
import SeasonDeleteModal from '../seasons/SeasonDeleteModal';
import SeasonFormModal from '../seasons/SeasonFormModal';
import Tabs from '@/components/Tabs/Tabs';
import TeamFormModal from '../teams/TeamFormModal';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
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
import styles from './LeagueDetails.module.scss';

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
        (item) =>
          toRouteSlug(item.code) === leagueSlug ||
          toRouteSlug(item.name) === leagueSlug,
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
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [playersPage, setPlayersPage] = useState(1);
  const [playersSearch, setPlayersSearch] = useState('');

  usePageBreadcrumbs(
    loading || (!isLegacyIdRoute && leaguesLoading)
      ? null
      : {
          backPath: '/admin/leagues',
          backLabel: 'Back to Leagues',
          items: [
            { label: 'Leagues', path: '/admin/leagues' },
            league
              ? { label: league.name, shortLabel: league.code }
              : { label: 'Not Found' },
          ],
        },
    [loading, leaguesLoading, isLegacyIdRoute, league?.name, league?.code],
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
    if (selectedSeasonId === null && seasons.length > 0) {
      const current = seasons.find((s) => s.is_current);
      setSelectedSeasonId(current?.id ?? seasons[0].id);
    }
  }, [seasons.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
  } = useLeaguePlayers(id, selectedSeasonId ?? undefined, {
    page: playersPage,
    pageSize: 20,
    search: playersSearch,
  });

  if (loading || (!isLegacyIdRoute && leaguesLoading)) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading league…</p>
      </div>
    );
  }

  if (!league) {
    return (
      <p style={{ color: 'var(--text-dim)' }}>League not found.</p>
    );
  }

  return (
    <>
      <Tabs
        activeIndex={activeTab}
        onTabChange={handleTabChange}
        tabs={[
          {
            label: 'Info',
            icon: 'info',
            content: (
              <div className={styles.grid}>
                <LeagueInfoCard
                  className={styles.col12}
                  league={league}
                  onEdit={() => setEditModalOpen(true)}
                />
              </div>
            ),
          },
          {
            label: 'Seasons',
            icon: 'calendar_month',
            content: (
              <div className={styles.grid}>
                <LeagueSeasonsCard
                  className={styles.col12}
                  seasons={seasons}
                  loading={loading}
                  busy={busy}
                  onAdd={() => {
                    setEditTargetSeason(null);
                    setSeasonModalOpen(true);
                  }}
                  onEdit={(s) => {
                    setEditTargetSeason(s);
                    setSeasonModalOpen(true);
                  }}
                  onDelete={(s) => {
                    setConfirmDeleteSeason(s);
                    setConfirmDeleteSeasonOpen(true);
                  }}
                  onView={(s) =>
                    navigate(
                      buildSeasonDetailsPath({
                        leagueCode: league.code,
                        leagueId: league.id,
                        seasonName: s.name,
                        seasonId: s.id,
                      }),
                    )
                  }
                />
              </div>
            ),
          },
          {
            label: 'Teams',
            icon: 'group',
            content: (
              <div className={styles.grid}>
                <LeagueTeamsTab
                  className={styles.col12}
                  leagueId={league.id}
                  leagueCode={league.code}
                  teams={teams}
                  loading={loading}
                  busy={busy}
                  onAdd={() => {
                    setEditTargetTeam(null);
                    setTeamModalOpen(true);
                  }}
                  onEdit={(t) => {
                    setEditTargetTeam(t);
                    setTeamModalOpen(true);
                  }}
                  onDelete={(t) => setConfirmDeleteTeam(t)}
                />
              </div>
            ),
          },
          {
            label: 'Players',
            icon: 'groups',
            content: (
              <div className={styles.grid}>
                <LeaguePlayersTab
                  className={styles.col12}
                  leagueId={league.id}
                  leagueCode={league?.code}
                  players={players}
                  total={playersTotal}
                  page={playersPage}
                  pageSize={20}
                  search={playersSearch}
                  seasons={seasons}
                  selectedSeasonId={selectedSeasonId}
                  onPageChange={setPlayersPage}
                  onSearchChange={(query) => {
                    setPlayersPage(1);
                    setPlayersSearch(query);
                  }}
                  onSeasonChange={(seasonId) => {
                    setPlayersPage(1);
                    setSelectedSeasonId(seasonId);
                  }}
                  loading={playersLoading}
                  fetching={playersFetching}
                  busy={playerBusy}
                  onAdd={() => {
                    setEditTargetPlayer(null);
                    setPlayerModalOpen(true);
                  }}
                  onBulkAdd={() => setBulkAddOpen(true)}
                  onEdit={(p) => {
                    setEditTargetPlayer(p);
                    setPlayerModalOpen(true);
                  }}
                  onDelete={deletePlayer}
                />
              </div>
            ),
          },
          {
            label: 'Playoffs',
            icon: 'emoji_events',
            content: (
              <div className={styles.grid}>
                <LeaguePlayoffsTab
                  className={styles.col12}
                  leagueId={league.id}
                />
              </div>
            ),
          },
        ]}
      />

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
