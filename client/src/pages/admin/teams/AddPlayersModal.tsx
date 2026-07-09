import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'react-toastify';
import Checklist from '@jerecocc/tracker-ui/components/Checklist/Checklist';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import { type PlayerRecord } from '@/hooks/useLeaguePlayers';
import { type PlayerRosterInput } from '@/hooks/useTeamPlayers';
import { formatPlayerPosition } from '@/lib/playerPosition';
import { normalizePlayerSearchText, playerSearchTextIncludes } from '@/lib/playerSearch';
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
  positionFilter?: readonly string[];
  positionFilterLabel?: string;
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
  positionFilter,
  positionFilterLabel,
  addPlayersToRoster,
}: Props) => {
  const [query, setQuery] = useState('');
  // Map from player_id -> jersey number string (empty = null)
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const { control, reset, setValue, unregister } = useForm<{ jerseys: Record<string, string> }>({
    defaultValues: { jerseys: {} },
  });

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

  const normalizedPositionFilter = new Set(
    (positionFilter ?? []).map((position) => position.toUpperCase()),
  );
  const positionFilteredPlayers =
    normalizedPositionFilter.size > 0
      ? allPlayers.filter((p) => normalizedPositionFilter.has((p.position ?? '').toUpperCase()))
      : allPlayers;
  // The API returns league-scoped unassigned players; this keeps the modal safe
  // if cached data is briefly stale after roster changes.
  const available = positionFilteredPlayers.filter((p) => !existingPlayerIds.has(p.id));
  const titlePlayerLabel = positionFilterLabel ?? 'Players';
  const playerLabel = titlePlayerLabel.toLowerCase();

  const matchesPlayerSearch = (player: PlayerRecord, searchQuery: string) => {
    const q = normalizePlayerSearchText(searchQuery);
    const name = `${player.first_name} ${player.last_name}`;
    const jersey = player.jersey_number != null ? String(player.jersey_number) : '';
    const team = `${player.team_name ?? ''} ${player.team_code ?? ''}`;
    return (
      playerSearchTextIncludes(name, q) ||
      playerSearchTextIncludes(player.position, q) ||
      jersey.startsWith(q.replace('#', '')) ||
      playerSearchTextIncludes(team, q)
    );
  };

  const toggle = (player: PlayerRecord) => {
    if (player.id in selected) {
      unregister(`jerseys.${player.id}`);
      setSelected((prev) => {
        const next = { ...prev };
        delete next[player.id];
        return next;
      });
      return;
    }

    const jerseyNumber = player.jersey_number != null ? String(player.jersey_number) : '';
    setValue(`jerseys.${player.id}`, jerseyNumber);
    setSelected((prev) => ({ ...prev, [player.id]: jerseyNumber }));
  };

  const setJersey = (id: string, value: string) => {
    setSelected((prev) => ({ ...prev, [id]: value }));
  };

  const selectedCount = Object.keys(selected).length;

  const handleClose = () => {
    setSelected({});
    reset({ jerseys: {} });
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
      title={`Add ${titlePlayerLabel} to Roster`}
      onClose={handleClose}
      size="md"
      bodyClassName={styles.rosterBody}
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
      <Checklist
        options={available.map((player) => ({
          id: player.id,
          player,
          searchText: `${player.first_name} ${player.last_name} ${player.position ?? ''} ${
            player.jersey_number ?? ''
          } ${player.team_name ?? ''} ${player.team_code ?? ''}`,
          leadingImage: player.team_logo,
          leadingImageDark: player.team_logo_dark,
          leadingImageLight: player.team_logo_light,
          leadingImagePlaceholder: player.team_code ?? undefined,
          leadingImagePrimaryColor: player.primary_color,
          leadingImageTextColor: player.text_color,
          image: player.photo,
          imagePlaceholder: `${player.first_name[0] ?? ''}${player.last_name[0] ?? ''}`,
          imageShape: 'circle' as const,
          imagePrimaryColor: player.primary_color,
          imageTextColor: player.text_color,
          name: `${player.first_name} ${player.last_name}`,
          subtitle: formatPlayerPosition(player.position) ?? undefined,
          rightContent:
            player.id in selected ? (
              <div
                className={styles.jerseyWrap}
                onClick={(e) => e.stopPropagation()}
              >
                <span className={styles.jerseyLabel}>#</span>
                <Field
                  control={control}
                  name={`jerseys.${player.id}`}
                  type="number"
                  wrapperClassName={styles.jerseyField}
                  className={styles.jerseyInput}
                  aria-label={`Jersey number for ${player.first_name} ${player.last_name}`}
                  placeholder="-"
                  min={1}
                  max={99}
                  inputMode="numeric"
                  transform={(value) => {
                    setJersey(player.id, value);
                    return value;
                  }}
                />
              </div>
            ) : undefined,
        }))}
        selectedIds={Object.keys(selected)}
        onToggle={(option) => toggle(option.player)}
        searchable
        filterOption={(option, searchQuery) => matchesPlayerSearch(option.player, searchQuery)}
        query={query}
        onQueryChange={setQuery}
        placeholder="Search players..."
        autoFocus
        emptyMessage={`No unassigned ${playerLabel} are available for this league.`}
        noResultsMessage={(searchQuery) => `No players match "${searchQuery}".`}
      />
    </Modal>
  );
};

export default AddPlayersModal;
