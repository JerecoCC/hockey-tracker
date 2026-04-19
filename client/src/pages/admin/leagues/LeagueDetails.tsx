import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams, useBlocker } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Button from '../../../components/Button/Button';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import LeagueInfoCard from './LeagueInfoCard';
import LeaguePlayersTab from './LeaguePlayersTab';
import LeagueTeamsTab from './LeagueTeamsTab';
import LeagueSeasonsCard from './LeagueSeasonsCard';
import BulkAddPlayersModal from './BulkAddPlayersModal';
import PlayerFormModal from './PlayerFormModal';
import RichTextEditor from '../../../components/RichTextEditor/RichTextEditor';
import SeasonDeleteModal from '../seasons/SeasonDeleteModal';
import SeasonFormModal from '../seasons/SeasonFormModal';
import Tabs from '../../../components/Tabs/Tabs';
import TeamFormModal from '../teams/TeamFormModal';
import TitleRow from '../../../components/TitleRow/TitleRow';
import useLeagueDetails, { type LeagueSeasonRecord } from '../../../hooks/useLeagueDetails';
import useLeaguePlayers, { type PlayerRecord } from '../../../hooks/useLeaguePlayers';
import { type CreateLeagueData } from '../../../hooks/useLeagues';
import { type TeamRecord } from '../../../hooks/useTeams';
import { type SeasonRecord } from '../../../hooks/useSeasons';
import styles from './LeagueDetails.module.scss';

interface LeagueFormValues {
  logo: File | string | null;
  name: string;
  code: string;
  primary_color: string;
  text_color: string;
  description: string | null;
}

/** Treats empty-paragraph HTML from the rich-text editor as null. */
const normalizeDescription = (html: string | null | undefined): string | null => {
  if (!html || html === '<p></p>') return null;
  return html;
};

const LeagueDetailsPage = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
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
  const [isEditing, setIsEditing] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<LeagueFormValues>({
    defaultValues: {
      logo: null,
      name: '',
      code: '',
      primary_color: '#334155',
      text_color: '#ffffff',
      description: null,
    },
  });

  useEffect(() => {
    if (isEditing && league) {
      reset({
        logo: league.logo ?? null,
        name: league.name,
        code: league.code,
        primary_color: league.primary_color,
        text_color: league.text_color,
        description: league.description ?? null,
      });
    }
  }, [isEditing, league, reset]);

  const blocker = useBlocker(isEditing);

  const handleCancelLeagueEdit = () => {
    setIsEditing(false);
    reset();
  };

  const onLeagueSubmit = handleSubmit(async (data) => {
    if (!league) return;
    let logoUrl: string | null = typeof data.logo === 'string' ? data.logo : null;
    if (data.logo instanceof File) {
      const url = await uploadLogo(data.logo);
      if (!url) return;
      logoUrl = url;
    }
    const payload: Partial<CreateLeagueData> = {
      logo: logoUrl,
      name: data.name,
      code: data.code,
      primary_color: data.primary_color,
      text_color: data.text_color,
      description: normalizeDescription(data.description) ?? undefined,
    };
    const ok = await updateLeague(league.id, payload);
    if (ok) setIsEditing(false);
  });
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

  useEffect(() => {
    if (selectedSeasonId === null && seasons.length > 0) {
      const current = seasons.find((s) => s.is_current);
      setSelectedSeasonId(current?.id ?? seasons[0].id);
    }
  }, [seasons.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    players,
    loading: playersLoading,
    busy: playerBusy,
    addPlayer,
    bulkAddPlayers,
    updatePlayer,
    deletePlayer,
  } = useLeaguePlayers(id, selectedSeasonId ?? undefined);

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
        defaultIndex={(state as { activeTab?: number } | null)?.activeTab ?? 0}
        disabled={isEditing}
        tabs={[
          {
            label: 'Info',
            content: (
              <div className={styles.grid}>
                <LeagueInfoCard
                  className={styles.col12}
                  league={league}
                  isEditing={isEditing}
                  onEdit={() => setIsEditing(true)}
                  control={control}
                  formId="league-edit-form"
                  onCancel={handleCancelLeagueEdit}
                  isSubmitting={isSubmitting}
                  editForm={
                    <form
                      id="league-edit-form"
                      className={styles.editForm}
                      onSubmit={onLeagueSubmit}
                    >
                      <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
                        <span className={styles.infoLabel}>Description</span>
                        <Controller
                          control={control}
                          name="description"
                          render={({ field }) => (
                            <RichTextEditor
                              content={field.value ?? ''}
                              onChange={field.onChange}
                              autoFocus={false}
                            />
                          )}
                        />
                      </div>
                    </form>
                  }
                />

                {!isEditing && (
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
                    onView={(s) => navigate(`/admin/leagues/${id}/seasons/${s.id}`)}
                  />
                )}
              </div>
            ),
          },
          {
            label: 'Teams',
            content: (
              <div className={styles.grid}>
                <LeagueTeamsTab
                  className={styles.col12}
                  leagueId={league.id}
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
            content: (
              <div className={styles.grid}>
                <LeaguePlayersTab
                  className={styles.col12}
                  players={players}
                  seasons={seasons}
                  selectedSeasonId={selectedSeasonId}
                  onSeasonChange={setSelectedSeasonId}
                  loading={playersLoading}
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

      {/* Navigation guard modal */}
      <ConfirmModal
        open={blocker.state === 'blocked'}
        title="Unsaved Changes"
        body="You have unsaved changes. Are you sure you want to leave?"
        confirmLabel="Leave without saving"
        variant="danger"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />

      <TeamFormModal
        open={teamModalOpen}
        editTarget={editTargetTeam}
        lockedLeagueId={id}
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
        lockedLeagueId={id}
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
