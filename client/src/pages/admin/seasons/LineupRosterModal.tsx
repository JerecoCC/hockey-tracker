import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Button from '../../../components/Button/Button';
import Icon from '../../../components/Icon/Icon';
import Modal from '../../../components/Modal/Modal';
import SelectableListItem from '../../../components/SelectableListItem/SelectableListItem';
import { type TeamPlayerRecord } from '../../../hooks/useTeamPlayers';
import styles from './LineupRosterModal.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const POSITION_LABELS: Record<string, string> = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defense',
  G: 'Goalie',
};

interface Props {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  existingPlayerIds: Set<string>;
  /** Called with selected player IDs to add them to the game roster */
  addToGameRoster: (playerIds: string[]) => Promise<boolean>;
}

const LineupRosterModal = ({
  open,
  onClose,
  teamId,
  teamName,
  existingPlayerIds,
  addToGameRoster,
}: Props) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const { data: allPlayers = [] } = useQuery<TeamPlayerRecord[]>({
    queryKey: ['players', { team_id: teamId }],
    queryFn: async () => {
      const { data } = await axios.get<TeamPlayerRecord[]>(`${API}/admin/players`, {
        headers: authHeaders(),
        params: { team_id: teamId },
      });
      return data;
    },
    enabled: open,
  });

  const available = allPlayers.filter((p) => !existingPlayerIds.has(p.id));
  const filtered = query.trim()
    ? available.filter((p) => {
        const q = query.trim().toLowerCase();
        const name = `${p.first_name} ${p.last_name}`.toLowerCase();
        return name.includes(q) || (p.position ?? '').toLowerCase().includes(q);
      })
    : available;

  const selectedCount = selected.size;

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const toggle = (playerId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  const handleClose = () => {
    setQuery('');
    setSelected(new Set());
    onClose();
  };

  const handleSubmit = async () => {
    if (selectedCount === 0) return;
    setSubmitting(true);
    const ok = await addToGameRoster([...selected]);
    setSubmitting(false);
    if (ok) handleClose();
  };

  return (
    <Modal
      open={open}
      title={`Add to ${teamName} Lineup`}
      onClose={handleClose}
      size="lg"
    >
      <div className={styles.controls}>
        <div className={styles.searchWrap}>
          <Icon
            name="search"
            size="1em"
            className={styles.searchIcon}
          />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search players…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {available.length === 0
            ? 'All team players are already in this lineup.'
            : `No players match "${query}".`}
        </p>
      ) : (
        <>
          <ul className={styles.selectAllRow}>
            <SelectableListItem
              checked={allFilteredSelected}
              onToggle={toggleAll}
              name="Select All"
              hideImage
            />
          </ul>
          <div className={styles.listDivider} />
          <ul className={styles.list}>
            {filtered.map((p) => (
              <SelectableListItem
                key={p.id}
                checked={selected.has(p.id)}
                onToggle={() => toggle(p.id)}
                image={p.photo}
                imagePlaceholder={`${p.first_name[0]}${p.last_name[0]}`}
                imageShape="circle"
                name={`${p.first_name} ${p.last_name}`}
                subtitle={p.position ? POSITION_LABELS[p.position] : undefined}
                rightContent={undefined}
              />
            ))}
          </ul>
        </>
      )}

      <div className={styles.footer}>
        <span className={styles.footerCount}>
          {selectedCount > 0
            ? `${selectedCount} player${selectedCount !== 1 ? 's' : ''} selected`
            : 'No players selected'}
        </span>
        <Button
          variant="outlined"
          intent="neutral"
          onClick={handleClose}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          intent="accent"
          icon="group_add"
          onClick={handleSubmit}
          disabled={submitting || selectedCount === 0}
        >
          {submitting ? 'Adding…' : 'Add to Lineup'}
        </Button>
      </div>
    </Modal>
  );
};

export default LineupRosterModal;
