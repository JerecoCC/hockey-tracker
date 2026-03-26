import { useState, useRef, useEffect } from 'react';
import Icon from '../../../components/Icon/Icon';
import Table, { Column } from '../../../components/Table/Table';
import useTeams, { TeamRecord, CreateTeamData } from '../../../hooks/useTeams';
import useLeagues, { LeagueRecord } from '../../../hooks/useLeagues';
import TeamDeleteModal from './TeamDeleteModal';
import TeamFormModal, { FormState, emptyForm } from './TeamFormModal';
import styles from './Teams.module.scss';

const TeamsPage = () => {
  const { teams, loading, busy, uploadLogo, addTeam, updateTeam, deleteTeam } = useTeams();
  const { leagues } = useLeagues();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<TeamRecord | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
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
          <button className={styles.deleteBtn} title="Delete" disabled={busy === t.id} onClick={() => { setConfirmDelete(t); setConfirmDeleteOpen(true); }}>
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

      <TeamDeleteModal
        open={confirmDeleteOpen}
        busy={busy}
        target={confirmDelete}
        onCancel={() => { setConfirmDeleteOpen(false); setConfirmDelete(null); }}
        onConfirm={async () => { await deleteTeam(confirmDelete!.id); setConfirmDeleteOpen(false); setConfirmDelete(null); }}
      />

      <TeamFormModal
        open={modalOpen}
        editTarget={editTarget}
        form={form}
        setForm={setForm}
        submitting={submitting}
        leagues={leagues}
        leagueMap={leagueMap}
        leagueDropdownOpen={leagueDropdownOpen}
        setLeagueDropdownOpen={setLeagueDropdownOpen}
        leagueDropdownRef={leagueDropdownRef}
        fileInputRef={fileInputRef}
        onClose={closeModal}
        onSubmit={handleSubmit}
        onFileChange={handleFileChange}
        onClearFile={clearFile}
      />
    </main>
  );
};

export default TeamsPage;

