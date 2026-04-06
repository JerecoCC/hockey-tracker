import { useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Button from '../../../components/Button/Button';
import Icon from '../../../components/Icon/Icon';
import RichTextEditor from '../../../components/RichTextEditor/RichTextEditor';
import useLeagues from '../../../hooks/useLeagues';
import LeagueFormModal from './LeagueFormModal';
import styles from './LeagueDetails.module.scss';

const LeagueDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { leagues, loading, busy, uploadLogo, addLeague, updateLeague } = useLeagues();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionHtml, setDescriptionHtml] = useState<string>('');
  const [savingDescription, setSavingDescription] = useState(false);

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
