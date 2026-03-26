import type { ChangeEvent, Dispatch, FormEvent, RefObject, SetStateAction } from 'react';
import Button from '../../../components/Button/Button';
import Icon from '../../../components/Icon/Icon';
import Modal from '../../../components/Modal/Modal';
import { TeamRecord } from '../../../hooks/useTeams';
import { LeagueRecord } from '../../../hooks/useLeagues';
import styles from './Teams.module.scss';

export interface FormState {
  name: string;
  code: string;
  description: string;
  location: string;
  league_id: string | null;
  logoFile: File | null;
  logoPreview: string;
  existingLogoUrl: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const emptyForm = (): FormState => ({
  name: '', code: '', description: '', location: '', league_id: null,
  logoFile: null, logoPreview: '', existingLogoUrl: '',
});

interface Props {
  open: boolean;
  editTarget: TeamRecord | null;
  form: FormState;
  setForm: (form: FormState) => void;
  submitting: boolean;
  leagues: LeagueRecord[];
  leagueMap: Record<string, LeagueRecord>;
  leagueDropdownOpen: boolean;
  setLeagueDropdownOpen: Dispatch<SetStateAction<boolean>>;
  leagueDropdownRef: RefObject<HTMLDivElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
}

const TeamFormModal = ({
  open, editTarget, form, setForm, submitting,
  leagues, leagueMap, leagueDropdownOpen, setLeagueDropdownOpen, leagueDropdownRef,
  fileInputRef, onClose, onSubmit, onFileChange, onClearFile,
}: Props) => (
  <Modal open={open} title={editTarget ? 'Edit Team' : 'Add Team'} onClose={onClose}>
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.label}>
        <span className={styles.labelText}>Name <span className={styles.required}>*</span></span>
        <input className={styles.input} type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Toronto Maple Leafs" required autoFocus />
      </label>
      <label className={styles.label}>
        <span className={styles.labelText}>Code <span className={styles.required}>*</span></span>
        <input className={styles.input} type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. TOR" required />
      </label>
      <label className={styles.label}>
        Location
        <input className={styles.input} type="text" value={form.location ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Toronto, ON" />
      </label>
      <div className={styles.label}>
        <span className={styles.labelText}>League <span className={styles.required}>*</span></span>
        <div className={styles.leagueDropdown} ref={leagueDropdownRef}>
          <button
            type="button"
            className={`${styles.leagueTrigger} ${leagueDropdownOpen ? styles.leagueTriggerOpen : ''}`}
            onClick={() => setLeagueDropdownOpen((o) => !o)}
          >
            {form.league_id && leagueMap[form.league_id] ? (
              <span className={styles.leagueOptionInner}>
                {leagueMap[form.league_id].logo
                  ? <img src={leagueMap[form.league_id].logo!} alt="" className={styles.leagueOptionLogo} />
                  : <span className={styles.leagueOptionNoLogo}>{leagueMap[form.league_id].code[0]}</span>}
                {leagueMap[form.league_id].name}
              </span>
            ) : (
              <span className={styles.leaguePlaceholder}>— Select a league —</span>
            )}
            <Icon name="expand_more" size="1em" className={`${styles.leagueCaret} ${leagueDropdownOpen ? styles.leagueCaretOpen : ''}`} />
          </button>
          {leagueDropdownOpen && (
            <ul className={styles.leagueMenu}>
              {leagues.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className={`${styles.leagueOption} ${form.league_id === l.id ? styles.leagueOptionActive : ''}`}
                    onClick={() => { setForm({ ...form, league_id: l.id }); setLeagueDropdownOpen(false); }}
                  >
                    {l.logo
                      ? <img src={l.logo} alt="" className={styles.leagueOptionLogo} />
                      : <span className={styles.leagueOptionNoLogo}>{l.code[0]}</span>}
                    {l.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <label className={styles.label}>
        Description
        <textarea className={styles.textarea} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" rows={3} />
      </label>
      <div className={styles.label}>
        Logo
        <div className={styles.fileRow}>
          {(form.logoPreview || form.existingLogoUrl) && (
            <div className={styles.previewWrapper}>
              <img src={form.logoPreview || form.existingLogoUrl} alt="Preview" className={styles.logoPreview} />
              <button type="button" className={styles.clearBtn} onClick={onClearFile}><Icon name="close" size="0.9em" /></button>
            </div>
          )}
          <label className={styles.fileLabel}>
            <Icon name="upload" size="1em" />
            {form.logoFile ? form.logoFile.name : 'Choose image…'}
            <input ref={fileInputRef} className={styles.fileInput} type="file" accept="image/*,image/svg+xml,.svg" onChange={onFileChange} />
          </label>
        </div>
      </div>
      <div className={styles.formActions}>
        <Button type="button" variant="outlined" intent="neutral" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Team'}
        </Button>
      </div>
    </form>
  </Modal>
);

export default TeamFormModal;

