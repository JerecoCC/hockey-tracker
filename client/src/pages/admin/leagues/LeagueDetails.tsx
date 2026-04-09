import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Button from '../../../components/Button/Button';
import Icon from '../../../components/Icon/Icon';
import Tooltip from '../../../components/Tooltip/Tooltip';
import RichTextEditor from '../../../components/RichTextEditor/RichTextEditor';
import useLeagueDetails, { type LeagueSeasonRecord } from '../../../hooks/useLeagueDetails';
import { type TeamRecord } from '../../../hooks/useTeams';
import { type SeasonRecord } from '../../../hooks/useSeasons';
import LeagueFormModal from './LeagueFormModal';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  // Description state
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionHtml, setDescriptionHtml] = useState<string>('');
  const [savingDescription, setSavingDescription] = useState(false);

  const isBusy = busy === id;

  const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !league) return;
    e.target.value = '';
    const url = await uploadLogo(file);
    if (url) await updateLeague(league.id, { logo: url });
  };

  if (loading) {
    return (
      <main className={styles.main}>
        <div className={styles.loaderWrapper}>
          <span className={styles.spinner} />
          <p className={styles.loaderText}>Loading league…</p>
        </div>
      </main>
    );
  }

  if (!league) {
    return (
      <main className={styles.main}>
        <Breadcrumbs
          items={[{ label: 'Leagues', path: '/admin/leagues' }, { label: 'Not Found' }]}
        />
        <p style={{ color: 'var(--text-dim)' }}>League not found.</p>
      </main>
    );
  }

  return (
    <>
      <main className={styles.main}>
        <Breadcrumbs
          items={[{ label: 'Leagues', path: '/admin/leagues' }, { label: league.name }]}
        />

        <div className={styles.titleRow}>
          <Button
            variant="outlined"
            intent="neutral"
            icon="arrow_back"
            tooltip="Back to Leagues"
            onClick={() => navigate('/admin/leagues')}
          />
          <h2 className={styles.sectionTitle}>
            <Icon
              name="emoji_events"
              size="1em"
            />
            League Details
          </h2>
        </div>

        <div className={styles.grid}>
          <div className={`${styles.card} ${styles.col12}`}>
            <div className={styles.leagueHeader}>
              <div className={styles.logoWrapper}>
                {league.logo ? (
                  <img
                    src={league.logo}
                    alt={league.name}
                    className={styles.logo}
                  />
                ) : (
                  <span
                    className={styles.logoPlaceholder}
                    style={{ background: league.primary_color, color: league.text_color }}
                  >
                    {league.code.slice(0, 3)}
                  </span>
                )}
                {isBusy ? (
                  <div className={styles.logoSpinnerOverlay}>
                    <span className={styles.logoSpinner} />
                  </div>
                ) : (
                  <button
                    className={styles.logoEditOverlay}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Icon
                      name="edit"
                      size="1.25em"
                    />
                    <span className={styles.logoEditTooltip}>Edit League Icon</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,image/svg+xml,.svg"
                  className={styles.fileInput}
                  onChange={handleLogoChange}
                />
              </div>
              <div className={styles.leagueNameBlock}>
                <div className={styles.leagueNameRow}>
                  <h3 className={styles.leagueName}>{league.name}</h3>
                  <button
                    className={styles.nameEditBtn}
                    onClick={() => setEditModalOpen(true)}
                    disabled={isBusy}
                  >
                    <Icon
                      name="edit"
                      size="0.9em"
                    />
                    <span className={styles.nameEditTooltip}>Edit League</span>
                  </button>
                </div>
                <span className={styles.leagueCode}>{league.code}</span>
              </div>

              <div className={styles.headerColors}>
                <div className={styles.headerColorItem}>
                  <span className={styles.headerColorLabel}>Primary</span>
                  <Tooltip text={league.primary_color}>
                    <span
                      className={styles.headerColorDot}
                      style={{ background: league.primary_color }}
                    />
                  </Tooltip>
                </div>
                <div className={styles.headerColorItem}>
                  <span className={styles.headerColorLabel}>Text</span>
                  <Tooltip text={league.text_color}>
                    <span
                      className={styles.headerColorDot}
                      style={{ background: league.text_color }}
                    />
                  </Tooltip>
                </div>
              </div>
            </div>

            <div className={styles.infoGrid}>
              <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
                <span className={styles.infoLabel}>Description</span>
                {editingDescription ? (
                  <div className={styles.descriptionEditor}>
                    <RichTextEditor
                      content={descriptionHtml}
                      onChange={setDescriptionHtml}
                      editable={!savingDescription}
                    />
                    <div className={styles.descriptionActions}>
                      <Button
                        size="sm"
                        intent="accent"
                        disabled={
                          savingDescription ||
                          (descriptionHtml.trim() === '<p></p>' ? '' : descriptionHtml) ===
                            (league.description ?? '')
                        }
                        onClick={async () => {
                          setSavingDescription(true);
                          const normalized =
                            descriptionHtml.trim() === '<p></p>' ? '' : descriptionHtml;
                          const ok = await updateLeague(league.id, { description: normalized });
                          setSavingDescription(false);
                          if (ok) setEditingDescription(false);
                        }}
                      >
                        {savingDescription ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outlined"
                        intent="neutral"
                        disabled={savingDescription}
                        onClick={() => setEditingDescription(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={styles.descriptionReadArea}
                    onClick={() => {
                      setDescriptionHtml(league.description ?? '');
                      setEditingDescription(true);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setDescriptionHtml(league.description ?? '');
                        setEditingDescription(true);
                      }
                    }}
                  >
                    {league.description && league.description !== '<p></p>' ? (
                      <div
                        className={styles.infoValue}
                        dangerouslySetInnerHTML={{ __html: league.description }}
                      />
                    ) : (
                      <span className={styles.infoValueMuted}>Click to add a description…</span>
                    )}
                    <Icon
                      name="edit"
                      className={styles.descriptionEditIcon}
                      size="0.85em"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={`${styles.card} ${styles.col6}`}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Teams</h3>
              <Button
                icon="add"
                size="sm"
                onClick={() => setTeamModalOpen(true)}
              >
                Add Team
              </Button>
            </div>
            {loading ? (
              <p className={styles.teamsEmpty}>Loading…</p>
            ) : teams.length === 0 ? (
              <p className={styles.teamsEmpty}>No teams assigned to this league yet.</p>
            ) : (
              <ul
                className={`${styles.teamList} ${teams.length > 5 ? styles.teamListLimited : ''}`}
              >
                {teams.map((t) => (
                  <li
                    key={t.id}
                    className={`${styles.teamListItem} ${styles.teamListItemClickable}`}
                    onClick={() => navigate(`/admin/leagues/${league.id}/teams/${t.id}`)}
                  >
                    {t.logo ? (
                      <img
                        src={t.logo}
                        alt=""
                        className={styles.teamLogoThumb}
                      />
                    ) : (
                      <span className={styles.teamLogoPlaceholder}>{t.code.slice(0, 3)}</span>
                    )}
                    <span className={styles.teamListName}>{t.name}</span>
                    <span className={styles.seasonListDates}>{t.code}</span>
                    <span className={styles.teamActions}>
                      <Button
                        variant="outlined"
                        intent="accent"
                        icon="edit"
                        size="sm"
                        disabled={busy === t.id}
                        tooltip="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTargetTeam(t);
                          setTeamModalOpen(true);
                        }}
                      />
                      <Button
                        variant="outlined"
                        intent="danger"
                        icon="delete"
                        size="sm"
                        disabled={busy === t.id}
                        tooltip="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteTeam(t);
                          setConfirmDeleteTeamOpen(true);
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`${styles.card} ${styles.col6}`}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Seasons</h3>
              <Button
                icon="add"
                size="sm"
                onClick={() => {
                  setEditTargetSeason(null);
                  setSeasonModalOpen(true);
                }}
              >
                Add Season
              </Button>
            </div>
            {loading ? (
              <p className={styles.teamsEmpty}>Loading…</p>
            ) : seasons.length === 0 ? (
              <p className={styles.teamsEmpty}>No seasons for this league yet.</p>
            ) : (
              <ul
                className={`${styles.seasonList} ${seasons.length > 5 ? styles.seasonListLimited : ''}`}
              >
                {seasons.map((s) => (
                  <li
                    key={s.id}
                    className={styles.seasonListItem}
                  >
                    <span className={styles.seasonListName}>{s.name}</span>
                    <span className={styles.seasonListDates}>
                      {s.start_date || s.end_date
                        ? [s.start_date, s.end_date]
                            .map((d) =>
                              d
                                ? new Intl.DateTimeFormat('en-US', {
                                    timeZone: 'UTC',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  }).format(new Date(d))
                                : '?',
                            )
                            .join(' – ')
                        : 'No dates'}
                    </span>
                    <span className={styles.seasonActions}>
                      <Button
                        variant="outlined"
                        intent="accent"
                        icon="edit"
                        size="sm"
                        disabled={busy === s.id}
                        tooltip="Edit"
                        onClick={() => {
                          setEditTargetSeason(s);
                          setSeasonModalOpen(true);
                        }}
                      />
                      <Button
                        variant="outlined"
                        intent="danger"
                        icon="delete"
                        size="sm"
                        disabled={busy === s.id}
                        tooltip="Delete"
                        onClick={() => {
                          setConfirmDeleteSeason(s);
                          setConfirmDeleteSeasonOpen(true);
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

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
