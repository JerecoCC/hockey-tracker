import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import Tag from '../../../components/Tag/Tag';
import TitleRow from '../../../components/TitleRow/TitleRow';
import useSeasonDetails, { type SeasonGroupRecord } from '../../../hooks/useSeasonDetails';
import SeasonEndModal from './SeasonEndModal';
import SeasonTeamsCard from './SeasonTeamsCard';
import styles from './SeasonDetails.module.scss';

const US_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const formatDate = (d: string | null) =>
  d ? US_DATE.format(new Date(`${d.slice(0, 10)}T12:00:00Z`)) : '—';

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
  } = useSeasonDetails(id);

  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<SeasonGroupRecord | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);

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

      <div className={styles.grid}>
        {/* ── Season info ────────────────────────────────────────────────── */}
        <Card
          className={styles.col12}
          title="Info"
          action={
            <div className={styles.infoCardActions}>
              {!season.is_current && (
                <Button
                  variant="outlined"
                  intent="neutral"
                  icon="stars"
                  disabled={busy === 'set-current'}
                  onClick={() => setCurrentSeason(true)}
                >
                  Set as Current
                </Button>
              )}
              <Button
                variant="outlined"
                intent="danger"
                icon="flag"
                disabled={busy === 'end-season'}
                onClick={() => setShowEndModal(true)}
              >
                End Season
              </Button>
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
              <span className={styles.infoValue}>{formatDate(season.end_date)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Status</span>
              <span className={styles.infoValue}>
                {season.is_current ? (
                  <Tag
                    label="Current Season"
                    intent="success"
                  />
                ) : (
                  '—'
                )}
              </span>
            </div>
          </div>
        </Card>

        {/* ── Teams + Groups ─────────────────────────────────────────────── */}
        <SeasonTeamsCard
          className={styles.col12}
          seasonTeams={seasonTeams}
          groups={groups}
          leagueTeams={leagueTeams}
          loading={loading}
          busy={busy}
          groupBusy={groupBusy}
          setSeasonTeams={setSeasonTeams}
          setSeasonGroupTeams={setSeasonGroupTeams}
          resetSeasonGroupTeams={resetSeasonGroupTeams}
          addGroup={addGroup}
          updateGroup={updateGroup}
          onDeleteGroup={setConfirmDeleteGroup}
        />
      </div>

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
    </>
  );
};

export default SeasonDetailsPage;
