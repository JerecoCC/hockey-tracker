import { useState, useRef } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Button from '../../../components/Button/Button';
import Icon from '../../../components/Icon/Icon';
import Table, { Column } from '../../../components/Table/Table';
import useLeagues, { LeagueRecord } from '../../../hooks/useLeagues';
import LeagueDeleteModal from './LeagueDeleteModal';
import LeagueFormModal, { FormState, emptyForm } from './LeagueFormModal';
import styles from './Leagues.module.scss';

const LeaguesPage = () => {
  const { leagues, loading, busy, uploadLogo, addLeague, updateLeague, deleteLeague } = useLeagues();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeagueRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<LeagueRecord | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const columns: Column<LeagueRecord>[] = [
    { type: 'logo', header: 'Logo', getLogo: (l) => l.logo, getName: (l) => l.name, getCode: (l) => l.code, align: 'center' },
    { header: 'Code', key: 'code' },
    { header: 'Name', key: 'name' },
    {
      type: 'custom',
      header: 'Actions',
      align: 'center',
      render: (l) => (
        <div className={styles.actions}>
          <Button variant="outlined" intent="accent" icon="edit" size="sm" title="Edit" disabled={busy === l.id} onClick={() => openEditModal(l)} />
          <Button variant="outlined" intent="danger" icon="delete" size="sm" title="Delete" disabled={busy === l.id} onClick={() => { setConfirmDelete(l); setConfirmDeleteOpen(true); }} />
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
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

  const handleSubmit = async (e: FormEvent) => {
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
        <Button icon="add" onClick={openModal}>Add League</Button>
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

      <LeagueDeleteModal
        open={confirmDeleteOpen}
        busy={busy}
        target={confirmDelete}
        onCancel={() => { setConfirmDeleteOpen(false); setConfirmDelete(null); }}
        onConfirm={async () => { await deleteLeague(confirmDelete!.id); setConfirmDeleteOpen(false); setConfirmDelete(null); }}
      />

      <LeagueFormModal
        open={modalOpen}
        editTarget={editTarget}
        form={form}
        setForm={setForm}
        submitting={submitting}
        fileInputRef={fileInputRef}
        onClose={closeModal}
        onSubmit={handleSubmit}
        onFileChange={handleFileChange}
        onClearFile={clearFile}
      />
    </main>
  );
};

export default LeaguesPage;

