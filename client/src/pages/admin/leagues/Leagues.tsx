import { useState } from 'react';
import Icon from '../../../components/Icon/Icon';
import Table, { Column } from '../../../components/Table/Table';
import useLeagues, { LeagueRecord, CreateLeagueData } from '../../../hooks/useLeagues';
import styles from './Leagues.module.scss';

const LeaguesPage = () => {
  const { leagues, loading, addLeague } = useLeagues();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateLeagueData>({ name: '', code: '', description: '', logo: '' });

  const columns: Column<LeagueRecord>[] = [
    {
      type: 'custom',
      header: 'Logo',
      render: (l) =>
        l.logo
          ? <img src={l.logo} alt={l.name} className={styles.logoThumb} />
          : <span className={styles.noLogo}>—</span>,
    },
    { header: 'Name', key: 'name' },
    { header: 'Code', key: 'code' },
    { header: 'Description', key: 'description' },
    { type: 'date', header: 'Created', key: 'created_at' },
  ];

  const openModal = () => {
    setForm({ name: '', code: '', description: '', logo: '' });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await addLeague({
      name: form.name,
      code: form.code,
      description: form.description || undefined,
      logo: form.logo || undefined,
    });
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

      {modalOpen && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add League</h3>
              <button className={styles.closeBtn} onClick={closeModal} type="button">
                <Icon name="close" size="1.2em" />
              </button>
            </div>
            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.label}>
                Name <span className={styles.required}>*</span>
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
                Code <span className={styles.required}>*</span>
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
              <label className={styles.label}>
                Logo URL
                <input
                  className={styles.input}
                  type="url"
                  value={form.logo}
                  onChange={(e) => setForm({ ...form, logo: e.target.value })}
                  placeholder="https://..."
                />
              </label>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  {submitting ? 'Saving…' : 'Add League'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default LeaguesPage;

