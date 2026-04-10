import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Button from '../../../components/Button/Button';
import TitleRow from '../../../components/TitleRow/TitleRow';
import useLeagueDetails, { type LeagueSeasonRecord } from '../../../hooks/useLeagueDetails';
import { type TeamRecord } from '../../../hooks/useTeams';
import { type SeasonRecord } from '../../../hooks/useSeasons';
import LeagueFormModal from './LeagueFormModal';
import LeagueInfoCard from './LeagueInfoCard';
import LeagueTeamsCard from './LeagueTeamsCard';
import LeagueSeasonsCard from './LeagueSeasonsCard';
import TeamDeleteModal from '../teams/TeamDeleteModal';
import TeamFormModal from '../teams/TeamFormModal';
import SeasonFormModal from '../seasons/SeasonFormModal';
import SeasonDeleteModal from '../seasons/SeasonDeleteModal';
import styles from './LeagueDetails.module.scss';

const LeagueDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
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
  // Team modal state
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editTargetTeam, setEditTargetTeam] = useState<TeamRecord | null>(null);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<TeamRecord | null>(null);
  const [confirmDeleteTeamOpen, setConfirmDeleteTeamOpen] = useState(false);
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

      <div className={styles.grid}>
        <LeagueInfoCard
          className={styles.col12}
          league={league}
          busy={busy}
          uploadLogo={uploadLogo}
          updateLeague={updateLeague}
          onEditLeague={() => setEditModalOpen(true)}
        />

        <LeagueTeamsCard
          className={styles.col4}
          leagueId={league.id}
          teams={teams}
          loading={loading}
          busy={busy}
          onAdd={() => setTeamModalOpen(true)}
          onEdit={(t) => {
            setEditTargetTeam(t);
            setTeamModalOpen(true);
          }}
          onDelete={(t) => {
            setConfirmDeleteTeam(t);
            setConfirmDeleteTeamOpen(true);
          }}
        />

        <LeagueSeasonsCard
          className={styles.col6}
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

      <TeamDeleteModal
        open={confirmDeleteTeamOpen}
        busy={busy}
        target={confirmDeleteTeam}
        onCancel={() => {
          setConfirmDeleteTeamOpen(false);
          setConfirmDeleteTeam(null);
        }}
        onConfirm={async () => {
          await deleteTeam(confirmDeleteTeam!.id);
          setConfirmDeleteTeamOpen(false);
          setConfirmDeleteTeam(null);
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
        editTarget={editTargetTeam}
        leagueOptions={
          league
            ? [{ value: league.id, label: league.name, logo: league.logo, code: league.code }]
            : []
        }
        lockedLeagueId={id}
        onClose={() => {
          setTeamModalOpen(false);
          setEditTargetTeam(null);
        }}
        addTeam={addTeam}
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
