import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Button from '@/components/Button/Button';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import SelectableListItem from '@/components/SelectableListItem/SelectableListItem';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
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
  seasonId: string;
  teamName: string;
  existingPlayerIds: Set<string>;
  /** Called with selected player IDs to add them to the game roster */
  addToGameRoster: (playerIds: string[]) => Promise<boolean>;
  /** Called with jersey numbers that had no matching player, so the caller can open the create modal */
  onMissingJerseys?: (jerseyNumbers: number[]) => void;
}

const LineupRosterModal = ({
  open,
  onClose,
  teamId,
  seasonId,
  teamName,
  existingPlayerIds,
  addToGameRoster,
  onMissingJerseys,
}: Props) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [jerseyInput, setJerseyInput] = useState('');
  const [pendingMissing, setPendingMissing] = useState<number[]>([]);

  const { data: allPlayers = [] } = useQuery<TeamPlayerRecord[]>({
    queryKey: ['players', { team_id: teamId, season_id: seasonId }],
    queryFn: async () => {
      const { data } = await axios.get<TeamPlayerRecord[]>(`${API}/admin/players`, {
        headers: authHeaders(),
        params: { team_id: teamId, season_id: seasonId },
      });
      return data;
    },
    enabled: open,
  });

  const available = allPlayers
    .filter((p) => !existingPlayerIds.has(p.id))
    .sort((a, b) => {
      // Jersey numbers first (null last), then alphabetically
      if (a.jersey_number != null && b.jersey_number != null)
        return a.jersey_number - b.jersey_number;
      if (a.jersey_number != null) return -1;
      if (b.jersey_number != null) return 1;
      return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
    });

  const filtered = query.trim()
    ? available.filter((p) => {
        const q = query.trim().toLowerCase();
        const name = `${p.first_name} ${p.last_name}`.toLowerCase();
        const jersey = p.jersey_number != null ? String(p.jersey_number) : '';
        return (
          name.includes(q) ||
          (p.position ?? '').toLowerCase().includes(q) ||
          jersey.startsWith(q.replace('#', ''))
        );
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

  const handleApplyJerseys = () => {
    const nums = jerseyInput
      .split(/[\s,]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => !isNaN(n));
    if (nums.length === 0) return;

    const matched: string[] = [];
    const missing: number[] = [];
    for (const num of nums) {
      const player = available.find((p) => p.jersey_number === num);
      if (player) matched.push(player.id);
      else missing.push(num);
    }

    if (matched.length > 0) {
      setSelected((prev) => {
        const next = new Set(prev);
        matched.forEach((id) => next.add(id));
        return next;
      });
    }
    setPendingMissing(missing);
    setJerseyInput('');
  };

  const handleClose = () => {
    setQuery('');
    setSelected(new Set());
    setJerseyInput('');
    setPendingMissing([]);
    onClose();
  };

  const handleSubmit = async () => {
    if (selectedCount === 0 && pendingMissing.length === 0) return;
    if (selectedCount > 0) {
      setSubmitting(true);
      const ok = await addToGameRoster([...selected]);
      setSubmitting(false);
      if (!ok) return;
    }
    if (pendingMissing.length > 0) {
      onMissingJerseys?.(pendingMissing);
    }
    handleClose();
  };

  return (
    <Modal
      open={open}
      title={`Add to ${teamName} Lineup`}
      onClose={handleClose}
      size="md"
      onConfirm={handleSubmit}
      confirmLabel={submitting ? 'Adding…' : 'Add to Lineup'}
      confirmIcon="group_add"
      confirmDisabled={submitting || (selectedCount === 0 && pendingMissing.length === 0)}
      busy={submitting}
      footerStart={
        <span>
          {selectedCount > 0
            ? `${selectedCount} player${selectedCount !== 1 ? 's' : ''} selected`
            : pendingMissing.length > 0
              ? 'Will create missing players'
              : 'No players selected'}
        </span>
      }
    >
      <div className={styles.content}>
        <div className={styles.controls}>
          <div className={styles.quickAddWrap}>
            <input
              className={styles.quickAddInput}
              type="text"
              placeholder="Jersey numbers (e.g. 7 11 25)…"
              value={jerseyInput}
              onChange={(e) => setJerseyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyJerseys()}
            />
            <Button
              size="sm"
              variant="outlined"
              intent="neutral"
              onClick={handleApplyJerseys}
              disabled={!jerseyInput.trim()}
            >
              Apply
            </Button>
          </div>
          {pendingMissing.length > 0 && (
            <p className={styles.missingNote}>
              <Icon
                name="warning"
                size="0.85em"
              />
              No match for jersey{pendingMissing.length !== 1 ? 's' : ''}{' '}
              {pendingMissing.map((n) => `#${n}`).join(', ')} — will open Create Players on confirm.
            </p>
          )}
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
              autoFocus
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
                  jerseyNumber={p.jersey_number ?? null}
                  image={p.photo}
                  imagePlaceholder={`${p.first_name[0]}${p.last_name[0]}`}
                  imageShape="circle"
                  imagePrimaryColor={p.primary_color}
                  imageTextColor={p.text_color}
                  eyebrow={p.position ? (POSITION_LABELS[p.position] ?? p.position) : undefined}
                  name={`${p.last_name}, ${p.first_name}`}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
};

export default LineupRosterModal;
