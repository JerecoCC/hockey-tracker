import { useRef, useState, type ChangeEvent } from 'react';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import Icon from '../../../components/Icon/Icon';
import RichTextEditor from '../../../components/RichTextEditor/RichTextEditor';
import Tooltip from '../../../components/Tooltip/Tooltip';
import { type LeagueFullRecord } from '../../../hooks/useLeagueDetails';
import { type CreateLeagueData } from '../../../hooks/useLeagues';
import styles from './LeagueDetails.module.scss';

interface Props {
  league: LeagueFullRecord;
  busy: string | null;
  uploadLogo: (file: File) => Promise<string | null>;
  updateLeague: (id: string, payload: Partial<CreateLeagueData>) => Promise<boolean>;
  onEditLeague: () => void;
  className?: string;
}

const LeagueInfoCard = ({ league, busy, uploadLogo, updateLeague, onEditLeague, className }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionHtml, setDescriptionHtml] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);

  const isBusy = busy === league.id;

  const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const url = await uploadLogo(file);
    if (url) await updateLeague(league.id, { logo: url });
  };

  return (
    <Card className={className}>
      <div className={styles.leagueHeader}>
        <div className={styles.logoWrapper}>
          {league.logo ? (
            <img src={league.logo} alt={league.name} className={styles.logo} />
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
            <button className={styles.logoEditOverlay} onClick={() => fileInputRef.current?.click()}>
              <Icon name="edit" size="1.25em" />
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
            <button className={styles.nameEditBtn} onClick={onEditLeague} disabled={isBusy}>
              <Icon name="edit" size="0.9em" />
              <span className={styles.nameEditTooltip}>Edit League</span>
            </button>
          </div>
          <span className={styles.leagueCode}>{league.code}</span>
        </div>

        <div className={styles.headerColors}>
          <div className={styles.headerColorItem}>
            <span className={styles.headerColorLabel}>Primary</span>
            <Tooltip text={league.primary_color}>
              <span className={styles.headerColorDot} style={{ background: league.primary_color }} />
            </Tooltip>
          </div>
          <div className={styles.headerColorItem}>
            <span className={styles.headerColorLabel}>Text</span>
            <Tooltip text={league.text_color}>
              <span className={styles.headerColorDot} style={{ background: league.text_color }} />
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
                    const normalized = descriptionHtml.trim() === '<p></p>' ? '' : descriptionHtml;
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
              onClick={() => { setDescriptionHtml(league.description ?? ''); setEditingDescription(true); }}
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
                <div className={styles.infoValue} dangerouslySetInnerHTML={{ __html: league.description }} />
              ) : (
                <span className={styles.infoValueMuted}>Click to add a description…</span>
              )}
              <Icon name="edit" className={styles.descriptionEditIcon} size="0.85em" />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default LeagueInfoCard;
