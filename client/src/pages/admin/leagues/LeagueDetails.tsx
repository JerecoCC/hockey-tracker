import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Button from '../../../components/Button/Button';
import Tabs from '../../../components/Tabs/Tabs';
import TitleRow from '../../../components/TitleRow/TitleRow';
import useLeagueDetails, { type LeagueSeasonRecord } from '../../../hooks/useLeagueDetails';
import useLeagueGroups, { type GroupRecord } from '../../../hooks/useLeagueGroups';
import { type SeasonRecord } from '../../../hooks/useSeasons';
import LeagueFormModal from './LeagueFormModal';
import LeagueInfoCard from './LeagueInfoCard';
import LeagueSeasonsCard from './LeagueSeasonsCard';
import LeagueGroupsCard from './LeagueGroupsCard';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import TeamFormModal from '../teams/TeamFormModal';
import SeasonFormModal from '../seasons/SeasonFormModal';
import SeasonDeleteModal from '../seasons/SeasonDeleteModal';
import styles from './LeagueDetails.module.scss';

const LeagueDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const {
    league,
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
  const {
    groups,
    loading: groupsLoading,
    busy: groupsBusy,
    addGroup,
    updateGroup,
    deleteGroup,
    setGroupTeams,
  } = useLeagueGroups(league?.id);
  const [editModalOpen, setEditModalOpen] = useState(false);
  // Group state
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<GroupRecord | null>(null);
  // Team modal state — opened from a group's "Create Team" button
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [createTeamForGroup, setCreateTeamForGroup] = useState<GroupRecord | null>(null);
  // Season modal state
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  const [editTargetSeason, setEditTargetSeason] = useState<LeagueSeasonRecord | null>(null);
  const [confirmDeleteSeason, setConfirmDeleteSeason] = useState<LeagueSeasonRecord | null>(null);
  const [confirmDeleteSeasonOpen, setConfirmDeleteSeasonOpen] = useState(false);

  if (loading) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading league…</p>
      </div>
    );
  }

  if (!league) {
    return (
      <>
        <Breadcrumbs
          items={[{ label: 'Leagues', path: '/admin/leagues' }, { label: 'Not Found' }]}
        />
        <p style={{ color: 'var(--text-dim)' }}>League not found.</p>
      </>
    );
  }

  return (
    <>
      <TitleRow
        left={
          <Button
            variant="outlined"
            intent="neutral"
            icon="arrow_back"
            tooltip="Back to Leagues"
            onClick={() => navigate('/admin/leagues')}
          />
        }
        right={
          <Breadcrumbs
            items={[{ label: 'Leagues', path: '/admin/leagues' }, { label: league.name }]}
          />
        }
      />

      <Tabs
        tabs={[
          {
            label: 'Info & Seasons',
            content: (
              <div className={styles.grid}>
                <LeagueInfoCard
                  className={styles.col12}
                  league={league}
                  busy={busy}
                  uploadLogo={uploadLogo}
                  updateLeague={updateLeague}
                  onEditLeague={() => setEditModalOpen(true)}
                />
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
                />
              </div>
            ),
          },
          {
            label: 'Teams',
            content: (
              <div className={styles.grid}>
                <LeagueGroupsCard
                  className={styles.col12}
                  leagueId={league.id}
                  groups={groups}
                  loading={groupsLoading}
                  busy={groupsBusy}
                  addGroup={addGroup}
                  updateGroup={updateGroup}
                  onAddTeam={(g) => {
                    setCreateTeamForGroup(g);
                    setTeamModalOpen(true);
                  }}
                  onDelete={(g) => setConfirmDeleteGroup(g)}
                  onDeleteTeam={deleteTeam}
                />
              </div>
            ),
          },
        ]}
      />

      <ConfirmModal
        open={confirmDeleteGroup !== null}
        title="Delete Group"
        body={`Delete "${confirmDeleteGroup?.name}"? This will also remove any subgroups and team assignments.`}
        confirmLabel="Delete"
        confirmIcon="delete"
        variant="danger"
        busy={groupsBusy === confirmDeleteGroup?.id}
        onCancel={() => setConfirmDeleteGroup(null)}
        onConfirm={async () => {
          if (!confirmDeleteGroup) return;
          await deleteGroup(confirmDeleteGroup.id);
          setConfirmDeleteGroup(null);
        }}
      />

      <LeagueFormModal
        open={editModalOpen}
        editTarget={league}
        onClose={() => setEditModalOpen(false)}
        addLeague={async () => false}
        updateLeague={updateLeague}
        uploadLogo={uploadLogo}
      />

      <TeamFormModal
        open={teamModalOpen}
        editTarget={null}
        leagueOptions={
          league
            ? [{ value: league.id, label: league.name, logo: league.logo, code: league.code }]
            : []
        }
        lockedLeagueId={id}
        onClose={() => {
          setTeamModalOpen(false);
          setCreateTeamForGroup(null);
        }}
        addTeam={async (payload) => {
          const newTeamId = await addTeam(payload);
          if (newTeamId && createTeamForGroup) {
            const currentIds = createTeamForGroup.teams.map((t) => t.id);
            await setGroupTeams(createTeamForGroup.id, [...currentIds, newTeamId]);
          }
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
        lockedLeagueId={id}
        onClose={() => {
          setSeasonModalOpen(false);
          setEditTargetSeason(null);
        }}
        addSeason={addSeason}
        updateSeason={updateSeason}
      />
    </>
  );
};

export default LeagueDetailsPage;
