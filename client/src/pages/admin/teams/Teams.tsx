import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Button from '../../../components/Button/Button';
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
      type: 'logo',
      header: 'Logo',
      getLogo: (t) => t.logo,
      getName: (t) => t.name,
      getCode: (t) => t.code,
      align: 'center',
    },
    { header: 'Code', key: 'code' },
    { header: 'Team', key: 'name' },

    {
      type: 'logo',
      header: 'League',
      getLogo: (t) => (t.league_id ? (leagueMap[t.league_id]?.logo ?? null) : null),
      getName: (t) => (t.league_id ? (leagueMap[t.league_id]?.name ?? '—') : '—'),
      getCode: (t) => (t.league_id ? (leagueMap[t.league_id]?.code ?? '—') : '—'),
      align: 'center',
    },
    {
      type: 'custom',
      header: 'Actions',
      align: 'center',
      render: (t) => (
        <div className={styles.actions}>
          <Button
            variant="outlined"
            intent="accent"
            icon="edit"
            size="sm"
            title="Edit"
            disabled={busy === t.id}
            onClick={() => openEditModal(t)}
          />
          <Button
            variant="outlined"
            intent="danger"
            icon="delete"
            size="sm"
            title="Delete"
            disabled={busy === t.id}
            onClick={() => {
              setConfirmDelete(t);
              setConfirmDeleteOpen(true);
            }}
          />
        </div>
      ),
    },
  ];

  const openModal = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEditModal = (team: TeamRecord) => {
    setEditTarget(team);
    setForm({
      name: team.name,
      code: team.code,
      description: team.description ?? '',
      location: team.location ?? '',
      league_id: team.league_id ?? null,
      logoFile: null,
      logoPreview: '',
      existingLogoUrl: team.logo ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (form.logoPreview) URL.revokeObjectURL(form.logoPreview);
    setModalOpen(false);
    setEditTarget(null);
    setLeagueDropdownOpen(false);
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
    let logoUrl: string | null = form.existingLogoUrl || null;
    if (form.logoFile) {
      const url = await uploadLogo(form.logoFile);
      if (!url) {
        setSubmitting(false);
        return;
      }
      logoUrl = url;
    }
    const payload: CreateTeamData = {
      name: form.name,
      code: form.code,
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
          <Icon
            name="groups"
            size="1em"
          />{' '}
          Teams
        </h2>
        <Button
          icon="add"
          onClick={openModal}
        >
          Add Team
        </Button>
      </div>

      <div className={styles.card}>
        <Table
          columns={columns}
          data={teams}
          rowKey={(t) => t.id}
          loading={loading}
          emptyMessage="No teams yet. Add one to get started."
        />
      </div>

      <TeamDeleteModal
        open={confirmDeleteOpen}
        busy={busy}
        target={confirmDelete}
        onCancel={() => {
          setConfirmDeleteOpen(false);
          setConfirmDelete(null);
        }}
        onConfirm={async () => {
          await deleteTeam(confirmDelete!.id);
          setConfirmDeleteOpen(false);
          setConfirmDelete(null);
        }}
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
