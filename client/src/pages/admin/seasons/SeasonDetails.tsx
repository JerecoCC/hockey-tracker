import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import TitleRow from '../../../components/TitleRow/TitleRow';
import useSeasonDetails, { type SeasonGroupRecord } from '../../../hooks/useSeasonDetails';
import SeasonGroupsCard from './SeasonGroupsCard';
import SeasonTeamOverrideModal from './SeasonTeamOverrideModal';
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

  const { season, groups, leagueTeams, loading, busy, setSeasonGroupTeams, resetSeasonGroupTeams } =
    useSeasonDetails(id);

  const [overrideTarget, setOverrideTarget] = useState<SeasonGroupRecord | null>(null);

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
          </div>
        </Card>

        {/* ── Season groups ──────────────────────────────────────────────── */}
        <SeasonGroupsCard
          className={styles.col12}
          groups={groups}
          loading={loading}
          busy={busy}
          onOverride={setOverrideTarget}
          onReset={resetSeasonGroupTeams}
        />
      </div>

      <SeasonTeamOverrideModal
        open={overrideTarget !== null}
        group={overrideTarget}
        leagueTeams={leagueTeams}
        onClose={() => setOverrideTarget(null)}
        onSave={async (groupId, teamIds) => {
          const ok = await setSeasonGroupTeams(groupId, teamIds);
          if (ok) setOverrideTarget(null);
          return ok;
        }}
      />
    </>
  );
};

export default SeasonDetailsPage;
