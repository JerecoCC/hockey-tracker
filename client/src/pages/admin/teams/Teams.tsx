import { useState, useRef, useEffect } from 'react';
import Icon from '../../../components/Icon/Icon';
import Table, { Column } from '../../../components/Table/Table';
import useTeams, { TeamRecord, CreateTeamData } from '../../../hooks/useTeams';
import useLeagues, { LeagueRecord } from '../../../hooks/useLeagues';
import styles from './Teams.module.scss';

interface FormState extends Omit<CreateTeamData, 'logo'> {
  logoFile: File | null;
  logoPreview: string;
  existingLogoUrl: string;
}

const emptyForm = (): FormState => ({
  name: '', code: '', description: '', location: '', league_id: null,
  logoFile: null, logoPreview: '', existingLogoUrl: '',
});

const TeamsPage = () => {
  const { teams, loading, busy, uploadLogo, addTeam, updateTeam, deleteTeam } = useTeams();
  const { leagues } = useLeagues();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<TeamRecord | null>(null);
  const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const leagueDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!leagueDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (leagueDropdownRef.current && !leagueDropdownRef.current.contains(e.target as Node)) {
        setLeagueDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [leagueDropdownOpen]);

  const leagueMap = leagues.reduce<Record<string, LeagueRecord>>((acc, l) => {
    acc[l.id] = l;
    return acc;
  }, {});

  const columns: Column<TeamRecord>[] = [
    {
      type: 'custom',
      header: 'Logo',
      align: 'center',
      render: (t) =>
        t.logo
          ? <img src={t.logo} alt={t.name} className={styles.logoThumb} />
          : <span className={styles.noLogo}>—</span>,
    },
    { header: 'Name', key: 'name' },
    { header: 'Code', key: 'code' },
    {
      type: 'custom',
      header: 'Location',
      render: (t) => <span>{t.location ?? '—'}</span>,
    },
    {
      type: 'custom',
      header: 'League',
      render: (t) => <span>{t.league_id ? (leagueMap[t.league_id]?.name ?? '—') : '—'}</span>,
    },
    {
      type: 'custom',
      header: 'Actions',
      align: 'center',
      render: (t) => (
        <div className={styles.actions}>
          <button className={styles.editBtn} title="Edit" disabled={busy === t.id} onClick={() => openEditModal(t)}>
            <Icon name="edit" size="1.1em" />
          </button>
          <button className={styles.deleteBtn} title="Delete" disabled={busy === t.id} onClick={() => setConfirmDelete(t)}>
            <Icon name="delete" size="1.1em" />
          </button>
        </div>
      ),
    },
  ];

  const openModal = () => { setEditTarget(null); setForm(emptyForm()); setModalOpen(true); };

  const openEditModal = (team: TeamRecord) => {
    setEditTarget(team);
    setForm({
      name: team.name, code: team.code,
      description: team.description ?? '', location: team.location ?? '',
      league_id: team.league_id ?? null,
      logoFile: null, logoPreview: '', existingLogoUrl: team.logo ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (form.logoPreview) URL.revokeObjectURL(form.logoPreview);
    setModalOpen(false);
    setEditTarget(null);
    setLeagueDropdownOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (form.logoPreview) URL.revokeObjectURL(form.logoPreview);
    setForm({ ...form, logoFile: file, logoPreview: URL.createObjectURL(file) });
  };

  const clearFile = () => {
    if (form.logoPreview) URL.revokeObjectURL(form.logoPreview);
    setForm({ ...form, logoFile: null, logoPreview: '', existingLogoUrl: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    let logoUrl: string | undefined = form.existingLogoUrl || undefined;
    if (form.logoFile) {
      const url = await uploadLogo(form.logoFile);
      if (!url) { setSubmitting(false); return; }
      logoUrl = url;
    }
    const payload: CreateTeamData = {
      name: form.name, code: form.code,
      description: form.description || undefined,
      location: form.location || undefined,
      logo: logoUrl,
      league_id: form.league_id || null,
    };
    const ok = editTarget ? await updateTeam(editTarget.id, payload) : await addTeam(payload);
    setSubmitting(false);
    if (ok) closeModal();
  };

  return (
    <main className={styles.main}>
      <div className={styles.titleRow}>
        <h2 className={styles.sectionTitle}>
          <Icon name="groups" size="1em" /> Teams
        </h2>
        <button className={styles.addBtn} onClick={openModal}>
          <Icon name="add" size="1.1em" /> Add Team
        </button>
      </div>

      <div className={styles.card}>
        <Table columns={columns} data={teams} rowKey={(t) => t.id} loading={loading} emptyMessage="No teams yet. Add one to get started." />
      </div>

      {confirmDelete && (
        <div className={styles.overlay} onClick={() => setConfirmDelete(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Delete Team</h3>
              <button className={styles.closeBtn} onClick={() => setConfirmDelete(null)} type="button">
                <Icon name="close" size="1.2em" />
              </button>
            </div>
            <p className={styles.confirmBody}>
              Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This cannot be undone.
            </p>
            <div className={styles.formActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmDelete(null)} type="button">Cancel</button>
              <button
                className={styles.confirmDeleteBtn}
                disabled={busy === confirmDelete.id}
                onClick={async () => { await deleteTeam(confirmDelete.id); setConfirmDelete(null); }}
                type="button"
              >
                <Icon name="delete" size="1em" />
                {busy === confirmDelete.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editTarget ? 'Edit Team' : 'Add Team'}</h3>
              <button className={styles.closeBtn} onClick={closeModal} type="button">
                <Icon name="close" size="1.2em" />
              </button>
            </div>
            <form className={styles.form} onSubmit={handleSubmit}>
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
                      <button type="button" className={styles.clearBtn} onClick={clearFile}><Icon name="close" size="0.9em" /></button>
                    </div>
                  )}
                  <label className={styles.fileLabel}>
                    <Icon name="upload" size="1em" />
                    {form.logoFile ? form.logoFile.name : 'Choose image…'}
                    <input ref={fileInputRef} className={styles.fileInput} type="file" accept="image/*,image/svg+xml,.svg" onChange={handleFileChange} />
                  </label>
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  {submitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default TeamsPage;

