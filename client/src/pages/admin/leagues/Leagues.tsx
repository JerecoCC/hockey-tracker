import { useState, useRef } from 'react';
import Icon from '../../../components/Icon/Icon';
import Modal from '../../../components/Modal/Modal';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import Table, { Column } from '../../../components/Table/Table';
import useLeagues, { LeagueRecord, CreateLeagueData } from '../../../hooks/useLeagues';
import styles from './Leagues.module.scss';

interface FormState extends Omit<CreateLeagueData, 'logo'> {
  logoFile: File | null;
  logoPreview: string;      // blob URL for newly picked file
  existingLogoUrl: string;  // current saved URL (populated in edit mode)
}

const emptyForm = (): FormState => ({ name: '', code: '', description: '', logoFile: null, logoPreview: '', existingLogoUrl: '' });

const LeaguesPage = () => {
  const { leagues, loading, busy, uploadLogo, addLeague, updateLeague, deleteLeague } = useLeagues();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeagueRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<LeagueRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const columns: Column<LeagueRecord>[] = [
    {
      type: 'custom',
      header: 'Logo',
      align: 'center',
      render: (l) =>
        l.logo
          ? <img src={l.logo} alt={l.name} className={styles.logoThumb} />
          : <span className={styles.logoPlaceholder}>{l.code[0]}</span>,
    },
    { header: 'Name', key: 'name' },
    { header: 'Code', key: 'code' },
    {
      type: 'custom',
      header: 'Actions',
      align: 'center',
      render: (l) => (
        <div className={styles.actions}>
          <button
            className={styles.editBtn}
            title="Edit"
            disabled={busy === l.id}
            onClick={() => openEditModal(l)}
          >
            <Icon name="edit" size="1.1em" />
          </button>
          <button
            className={styles.deleteBtn}
            title="Delete"
            disabled={busy === l.id}
            onClick={() => setConfirmDelete(l)}
          >
            <Icon name="delete" size="1.1em" />
          </button>
        </div>
      ),
    },
  ];

  const openModal = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEditModal = (league: LeagueRecord) => {
    setEditTarget(league);
    setForm({
      name: league.name,
      code: league.code,
      description: league.description ?? '',
      logoFile: null,
      logoPreview: '',
      existingLogoUrl: league.logo ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (form.logoPreview) URL.revokeObjectURL(form.logoPreview);
    setModalOpen(false);
    setEditTarget(null);
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
    const payload = {
      name: form.name,
      code: form.code,
      description: form.description || undefined,
      logo: logoUrl,
    };
    const ok = editTarget
      ? await updateLeague(editTarget.id, payload)
      : await addLeague(payload);
    setSubmitting(false);
    if (ok) closeModal();
  };

  return (
    <main className={styles.main}>
      <div className={styles.titleRow}>
        <h2 className={styles.sectionTitle}>
          <Icon name="emoji_events" size="1em" /> Leagues
        </h2>
        <button className={styles.addBtn} onClick={openModal}>
          <Icon name="add" size="1.1em" /> Add League
        </button>
      </div>

      <div className={styles.card}>
        <Table
          columns={columns}
          data={leagues}
          rowKey={(l) => l.id}
          loading={loading}
          emptyMessage="No leagues yet. Add one to get started."
        />
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Delete League"
          body={<>Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This cannot be undone.</>}
          confirmLabel={busy === confirmDelete.id ? 'Deleting…' : 'Delete'}
          confirmIcon="delete"
          variant="danger"
          busy={busy === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => { await deleteLeague(confirmDelete.id); setConfirmDelete(null); }}
        />
      )}

      {modalOpen && (
        <Modal title={editTarget ? 'Edit League' : 'Add League'} onClose={closeModal}>
            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.label}>
                <span className={styles.labelText}>Name <span className={styles.required}>*</span></span>
                <input
                  className={styles.input}
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. National Hockey League"
                  required
                  autoFocus
                />
              </label>
              <label className={styles.label}>
                <span className={styles.labelText}>Code <span className={styles.required}>*</span></span>
                <input
                  className={styles.input}
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. NHL"
                  required
                />
              </label>
              <label className={styles.label}>
                Description
                <textarea
                  className={styles.textarea}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                />
              </label>
              <div className={styles.label}>
                Logo
                <div className={styles.fileRow}>
                  {(form.logoPreview || form.existingLogoUrl) && (
                    <div className={styles.previewWrapper}>
                      <img src={form.logoPreview || form.existingLogoUrl} alt="Preview" className={styles.logoPreview} />
                      <button type="button" className={styles.clearBtn} onClick={clearFile}>
                        <Icon name="close" size="0.9em" />
                      </button>
                    </div>
                  )}
                  <label className={styles.fileLabel}>
                    <Icon name="upload" size="1em" />
                    {form.logoFile ? form.logoFile.name : 'Choose image…'}
                    <input
                      ref={fileInputRef}
                      className={styles.fileInput}
                      type="file"
                      accept="image/*,image/svg+xml,.svg"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  {submitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Add League'}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </main>
  );
};

export default LeaguesPage;

