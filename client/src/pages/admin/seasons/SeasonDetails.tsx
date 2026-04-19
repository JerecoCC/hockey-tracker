import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import Icon from '../../../components/Icon/Icon';
import Badge from '../../../components/Badge/Badge';
import Tabs from '../../../components/Tabs/Tabs';
import TitleRow from '../../../components/TitleRow/TitleRow';
import useSeasonDetails, { type SeasonGroupRecord } from '../../../hooks/useSeasonDetails';
import { type SeasonRecord } from '../../../hooks/useSeasons';
import SeasonEndModal from './SeasonEndModal';
import SeasonFormModal from './SeasonFormModal';
import SeasonGamesTab from './SeasonGamesTab';
import SeasonTeamsCard from './SeasonTeamsCard';
import styles from './SeasonDetails.module.scss';

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const parseLocal = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const formatDate = (d: string | null) => (d ? DATE_FMT.format(parseLocal(d)) : '—');
const formatEndDate = (d: string | null, isCurrent: boolean) =>
  d ? DATE_FMT.format(parseLocal(d)) : isCurrent ? 'Present' : '—';

const SeasonDetailsPage = () => {
  const { leagueId, id } = useParams<{ leagueId: string; id: string }>();
  const navigate = useNavigate();

  const {
    season,
    groups,
    seasonTeams,
    leagueTeams,
    loading,
    busy,
    groupBusy,
    setSeasonTeams,
    setSeasonGroupTeams,
    resetSeasonGroupTeams,
    addGroup,
    updateGroup,
    deleteGroup,
    setCurrentSeason,
    endSeason,
    updateSeason,
  } = useSeasonDetails(id);

  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<SeasonGroupRecord | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const leagueHref = `/admin/leagues/${leagueId}`;

  if (loading && !season) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading season…</p>
      </div>
    );
  }

  if (!season) {
    return (
      <>
        <Breadcrumbs
          items={[
            { label: 'Leagues', path: '/admin/leagues' },
            { label: 'League', path: leagueHref },
            { label: 'Not Found' },
          ]}
        />
        <p style={{ color: 'var(--text-dim)' }}>Season not found.</p>
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
            tooltip={`Back to ${season.league_name}`}
            onClick={() => navigate(leagueHref)}
          />
        }
        right={
          <Breadcrumbs
            items={[
              { label: 'Leagues', path: '/admin/leagues' },
              { label: season.league_name, path: leagueHref },
              { label: season.name },
            ]}
          />
        }
      />

      <Tabs
        tabs={[
          {
            label: 'Info',
            content: (
              <Card
                title={
                  <>
                    {season.name}
                    {season.is_current && (
                      <Badge
                        label="Current"
                        intent="success"
                      />
                    )}
                    {season.is_ended && (
                      <Badge
                        label="Ended"
                        intent="neutral"
                      />
                    )}
                  </>
                }
                action={
                  <div className={styles.infoCardActions}>
                    <Button
                      variant="outlined"
                      intent="neutral"
                      icon="edit"
                      onClick={() => setShowEditModal(true)}
                    >
                      Edit
                    </Button>
                    <div
                      className={styles.menuWrapper}
                      ref={menuRef}
                    >
                      <Button
                        variant="ghost"
                        intent="neutral"
                        icon="more_vert"
                        onClick={() => setShowMenu((o) => !o)}
                      />
                      {showMenu && (
                        <div className={styles.menu}>
                          {!season.is_current && (
                            <button
                              className={styles.menuItem}
                              disabled={busy === 'set-current'}
                              onClick={() => {
                                setShowMenu(false);
                                setCurrentSeason(true);
                              }}
                            >
                              <Icon name="stars" />
                              Set as Current
                            </button>
                          )}
                          {season.is_current && (
                            <button
                              className={`${styles.menuItem} ${styles.menuItemDanger}`}
                              disabled={busy === 'end-season'}
                              onClick={() => {
                                setShowMenu(false);
                                setShowEndModal(true);
                              }}
                            >
                              <Icon name="flag" />
                              End Season
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                }
              >
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>League</span>
                    <span className={styles.infoValue}>{season.league_name}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Start Date</span>
                    <span className={styles.infoValue}>{formatDate(season.start_date)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>End Date</span>
                    <span className={styles.infoValue}>
                      {formatEndDate(season.end_date, season.is_current)}
                    </span>
                  </div>
                </div>
              </Card>
            ),
          },
          {
            label: 'Teams',
            content: (
              <SeasonTeamsCard
                seasonTeams={seasonTeams}
                groups={groups}
                leagueTeams={leagueTeams}
                loading={loading}
                busy={busy}
                groupBusy={groupBusy}
                isEnded={season.is_ended}
                setSeasonTeams={setSeasonTeams}
                setSeasonGroupTeams={setSeasonGroupTeams}
                resetSeasonGroupTeams={resetSeasonGroupTeams}
                addGroup={addGroup}
                updateGroup={updateGroup}
                onDeleteGroup={setConfirmDeleteGroup}
              />
            ),
          },
          {
            label: 'Games',
            content: (
              <SeasonGamesTab
                seasonId={id!}
                seasonTeams={seasonTeams}
                isEnded={season.is_ended}
              />
            ),
          },
          {
            label: 'Players',
            content: (
              <Card>
                <p className={styles.tabPlaceholder}>Players coming soon.</p>
              </Card>
            ),
          },
          {
            label: 'Playoffs',
            content: (
              <Card>
                <p className={styles.tabPlaceholder}>Playoffs coming soon.</p>
              </Card>
            ),
          },
        ]}
      />

      <ConfirmModal
        open={confirmDeleteGroup !== null}
        title="Delete Division"
        body={
          <>
            Delete <strong>{confirmDeleteGroup?.name}</strong>? This will also remove any
            sub-divisions and all season team assignments for this division.
          </>
        }
        confirmLabel="Delete"
        confirmIcon="delete"
        variant="danger"
        busy={groupBusy === confirmDeleteGroup?.id}
        onCancel={() => setConfirmDeleteGroup(null)}
        onConfirm={async () => {
          if (!confirmDeleteGroup) return;
          await deleteGroup(confirmDeleteGroup.id);
          setConfirmDeleteGroup(null);
        }}
      />

      <SeasonEndModal
        open={showEndModal}
        currentEndDate={season?.end_date ?? null}
        busy={busy === 'end-season'}
        onClose={() => setShowEndModal(false)}
        onConfirm={endSeason}
      />

      <SeasonFormModal
        open={showEditModal}
        editTarget={season as SeasonRecord}
        leagueOptions={[{ value: season.league_id, label: season.league_name }]}
        addSeason={async () => false}
        updateSeason={updateSeason}
        lockedLeagueId={season.league_id}
        onClose={() => setShowEditModal(false)}
      />
    </>
  );
};

export default SeasonDetailsPage;
