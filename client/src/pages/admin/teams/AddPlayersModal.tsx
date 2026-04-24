import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import Icon from '../../../components/Icon/Icon';
import Modal from '../../../components/Modal/Modal';
import Select, { type SelectOption } from '../../../components/Select/Select';
import SelectableListItem from '../../../components/SelectableListItem/SelectableListItem';
import useSeasons from '../../../hooks/useSeasons';
import { type PlayerRecord } from '../../../hooks/useLeaguePlayers';
import { type PlayerRosterInput } from '../../../hooks/useTeamPlayers';
import styles from './AddPlayersModal.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const POSITION_LABELS: Record<string, string> = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defenseman',
  G: 'Goalie',
};

interface Props {
  open: boolean;
  onClose: () => void;
  teamId: string;
  leagueId: string;
  latestSeasonId: string | null;
  existingPlayerIds: Set<string>;
  addPlayersToRoster: (
    teamId: string,
    seasonId: string,
    players: PlayerRosterInput[],
  ) => Promise<boolean>;
}

const AddPlayersModal = ({
  open,
  onClose,
  teamId,
  leagueId,
  latestSeasonId,
  existingPlayerIds,
  addPlayersToRoster,
}: Props) => {
  const { seasons } = useSeasons();
  const leagueSeasons = seasons.filter((s) => s.league_id === leagueId);
  const seasonOptions: SelectOption[] = leagueSeasons.map((s) => ({ value: s.id, label: s.name }));

  const [seasonId, setSeasonId] = useState<string>(() => latestSeasonId ?? '');
  const [query, setQuery] = useState('');
  // Map from player_id -> jersey number string (empty = null)
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: allPlayers = [] } = useQuery<PlayerRecord[]>({
    queryKey: ['players'],
    queryFn: async () => {
      const { data } = await axios.get<PlayerRecord[]>(`${API}/admin/players`, {
        headers: authHeaders(),
      });
      return data;
    },
    enabled: open,
  });

  // Exclude players already on this team's roster
  const available = allPlayers.filter((p) => !existingPlayerIds.has(p.id));

  const filtered = query.trim()
    ? available.filter((p) => {
        const q = query.trim().toLowerCase();
        const name = `${p.first_name} ${p.last_name}`.toLowerCase();
        return name.includes(q) || (p.position ?? '').toLowerCase().includes(q);
      })
    : available;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = '';
      return next;
    });
  };

  const setJersey = (id: string, value: string) => {
    setSelected((prev) => ({ ...prev, [id]: value }));
  };

  const selectedCount = Object.keys(selected).length;

  const handleClose = () => {
    setSelected({});
    setQuery('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!seasonId) {
      toast.error('Please select a season');
      return;
    }
    if (selectedCount === 0) {
      toast.error('Select at least one player');
      return;
    }
    const players: PlayerRosterInput[] = Object.entries(selected).map(([player_id, num]) => ({
      player_id,
      jersey_number: num !== '' ? Number(num) : null,
    }));
    setSubmitting(true);
    const ok = await addPlayersToRoster(teamId, seasonId, players);
    setSubmitting(false);
    if (ok) handleClose();
  };

  return (
    <Modal
      open={open}
      title="Add Players to Roster"
      onClose={handleClose}
      size="lg"
      onConfirm={handleSubmit}
      confirmLabel={submitting ? 'Adding…' : 'Add to Roster'}
      confirmIcon="group_add"
      confirmDisabled={submitting || selectedCount === 0}
      busy={submitting}
      footerStart={
        <span>
          {selectedCount > 0
            ? `${selectedCount} player${selectedCount !== 1 ? 's' : ''} selected`
            : 'No players selected'}
        </span>
      }
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

        <Select
          value={seasonId || null}
          options={seasonOptions}
          placeholder="— Select season —"
          onChange={setSeasonId}
        />
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {available.length === 0
            ? 'All players are already on this roster.'
            : `No players match "${query}".`}
        </p>
      ) : (
        <ul className={styles.list}>
          {filtered.map((p) => {
            const isChecked = p.id in selected;
            return (
              <SelectableListItem
                key={p.id}
                checked={isChecked}
                onToggle={() => toggle(p.id)}
                image={p.photo}
                imagePlaceholder={`${p.first_name[0]}${p.last_name[0]}`}
                imageShape="circle"
                imagePrimaryColor={p.primary_color}
                imageTextColor={p.text_color}
                name={`${p.first_name} ${p.last_name}`}
                subtitle={p.position ? (POSITION_LABELS[p.position] ?? p.position) : undefined}
                rightContent={
                  isChecked ? (
                    <div
                      className={styles.jerseyWrap}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className={styles.jerseyLabel}>#</span>
                      <input
                        type="number"
                        className={styles.jerseyInput}
                        placeholder="—"
                        min={1}
                        max={99}
                        value={selected[p.id]}
                        onChange={(e) => setJersey(p.id, e.target.value)}
                      />
                    </div>
                  ) : undefined
                }
              />
            );
          })}
        </ul>
      )}
    </Modal>
  );
};

export default AddPlayersModal;
