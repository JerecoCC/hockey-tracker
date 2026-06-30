import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '@/components/Modal/Modal';
import SearchField from '@/components/SearchField/SearchField';
import SelectableListItem from '@/components/SelectableListItem/SelectableListItem';
import { type PlayerRecord } from '@/hooks/useLeaguePlayers';
import { type PlayerRosterInput } from '@/hooks/useTeamPlayers';
import { formatPlayerPosition } from '@/lib/playerPosition';
import styles from './AddPlayersModal.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

interface Props {
  open: boolean;
  onClose: () => void;
  teamId: string;
  leagueId: string;
  seasonId: string | null;
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
  seasonId,
  existingPlayerIds,
  addPlayersToRoster,
}: Props) => {
  const [query, setQuery] = useState('');
  // Map from player_id -> jersey number string (empty = null)
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: allPlayers = [] } = useQuery<PlayerRecord[]>({
    queryKey: ['players', { league_id: leagueId, season_id: seasonId, unassigned: true }],
    queryFn: async () => {
      const { data } = await axios.get<PlayerRecord[]>(`${API}/admin/players`, {
        headers: authHeaders(),
        params: { league_id: leagueId, season_id: seasonId, unassigned: 'true' },
      });
      return data;
    },
    enabled: open && !!leagueId && !!seasonId,
  });

  // The API returns league-scoped unassigned players; this keeps the modal safe
  // if cached data is briefly stale after roster changes.
  const available = allPlayers.filter((p) => !existingPlayerIds.has(p.id));

  const filtered = query.trim()
    ? available.filter((p) => {
        const q = query.trim().toLowerCase();
        const name = `${p.first_name} ${p.last_name}`.toLowerCase();
        const jersey = p.jersey_number != null ? String(p.jersey_number) : '';
        const team = `${p.team_name ?? ''} ${p.team_code ?? ''}`.toLowerCase();
        return (
          name.includes(q) ||
          (p.position ?? '').toLowerCase().includes(q) ||
          jersey.startsWith(q.replace('#', '')) ||
          team.includes(q)
        );
      })
    : available;

  const toggle = (player: PlayerRecord) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (player.id in next) delete next[player.id];
      else next[player.id] = player.jersey_number != null ? String(player.jersey_number) : '';
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
      size="md"
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
        <SearchField
          className={styles.searchWrap}
          placeholder="Search players…"
          value={query}
          onChange={setQuery}
          autoFocus
        />
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {available.length === 0
            ? 'No unassigned players are available for this league.'
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
                onToggle={() => toggle(p)}
                leadingImage={p.team_logo}
                leadingImageDark={p.team_logo_dark}
                leadingImageLight={p.team_logo_light}
                leadingImagePlaceholder={p.team_code ?? undefined}
                leadingImagePrimaryColor={p.primary_color}
                leadingImageTextColor={p.text_color}
                image={p.photo}
                imagePlaceholder={`${p.first_name[0]}${p.last_name[0]}`}
                imageShape="circle"
                imagePrimaryColor={p.primary_color}
                imageTextColor={p.text_color}
                name={`${p.first_name} ${p.last_name}`}
                subtitle={formatPlayerPosition(p.position) ?? undefined}
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
