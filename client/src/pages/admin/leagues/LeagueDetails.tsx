import { useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Icon from '../../../components/Icon/Icon';
import useLeagues from '../../../hooks/useLeagues';
import LeagueFormModal from './LeagueFormModal';
import styles from './LeagueDetails.module.scss';

const LeagueDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { leagues, loading, busy, uploadLogo, addLeague, updateLeague } = useLeagues();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const league = leagues.find((l) => l.id === id);
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
        <p style={{ color: 'var(--text-dim)' }}>Loading…</p>
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

        <h2 className={styles.sectionTitle}>
          <Icon
            name="emoji_events"
            size="1em"
          />
          League Details
        </h2>

        <div className={styles.card}>
          <div className={styles.leagueHeader}>
            <div className={styles.logoWrapper}>
              {league.logo ? (
                <img
                  src={league.logo}
                  alt={league.name}
                  className={styles.logo}
                />
              ) : (
                <span className={styles.logoPlaceholder}>{league.code.slice(0, 3)}</span>
              )}
              <button
                className={styles.logoEditOverlay}
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
              >
                <Icon
                  name="edit"
                  size="1.25em"
                />
                <span className={styles.logoEditTooltip}>Edit League Icon</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,image/svg+xml,.svg"
                className={styles.fileInput}
                onChange={handleLogoChange}
              />
            </div>
            <div>
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
          </div>

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Description</span>
              {league.description ? (
                <span className={styles.infoValue}>{league.description}</span>
              ) : (
                <span className={styles.infoValueMuted}>No description provided.</span>
              )}
            </div>
          </div>
        </div>
      </main>

      <LeagueFormModal
        open={editModalOpen}
        editTarget={league}
        onClose={() => setEditModalOpen(false)}
        addLeague={addLeague}
        updateLeague={updateLeague}
        uploadLogo={uploadLogo}
      />
    </>
  );
};

export default LeagueDetailsPage;
