import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal/Modal';
import SelectableListItem from '@/components/SelectableListItem/SelectableListItem';
import { type LineupEntry, type LineupPositionSlot } from '@/hooks/useGameLineup';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import { formatPlayerPosition } from '@/lib/playerPosition';
import styles from './SetLineupModal.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  players: TeamPlayerRecord[];
  /** All lineup entries for the game, filtered here to this team's entries. */
  lineup: LineupEntry[];
  correctionMode?: boolean;
  saveTeamLineup: (
    teamId: string,
    slots: Array<{ position_slot: LineupPositionSlot; player_id: string | null }>,
    teamName?: string,
  ) => Promise<boolean>;
}

const MAX_STARTERS = 1;
const REQUIRED_GOALIES = 1;

const isGoalie = (player: Pick<TeamPlayerRecord, 'position'>) => (player.position ?? '') === 'G';

const compareByRosterOrder = (a: TeamPlayerRecord, b: TeamPlayerRecord) => {
  const goalieOrder = Number(isGoalie(a)) - Number(isGoalie(b));
  if (goalieOrder !== 0) return goalieOrder;
  if (a.jersey_number != null && b.jersey_number != null) {
    if (a.jersey_number !== b.jersey_number) return a.jersey_number - b.jersey_number;
  } else if (a.jersey_number != null) {
    return -1;
  } else if (b.jersey_number != null) {
    return 1;
  }
  return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
};

const SetLineupModal = ({
  open,
  onClose,
  teamId,
  teamName,
  players,
  lineup,
  correctionMode = false,
  saveTeamLineup,
}: Props) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedSelected, setSavedSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const sortedPlayers = useMemo(
    () => players.filter(isGoalie).sort(compareByRosterOrder),
    [players],
  );

  const selectedPlayers = useMemo(
    () => sortedPlayers.filter((player) => selected.has(player.id)),
    [selected, sortedPlayers],
  );

  const savedPlayers = useMemo(
    () => sortedPlayers.filter((player) => savedSelected.has(player.id)),
    [savedSelected, sortedPlayers],
  );

  const selectedKey = selectedPlayers.map((player) => player.id).join('|');
  const savedKey = savedPlayers.map((player) => player.id).join('|');
  const hasChanges = selectedKey !== savedKey;
  const selectedCount = selected.size;
  const selectedGoalieCount = selectedPlayers.filter(isGoalie).length;
  const canSave =
    !saving &&
    selectedCount === MAX_STARTERS &&
    selectedGoalieCount === REQUIRED_GOALIES &&
    hasChanges;

  useEffect(() => {
    if (!open) return;

    const playerIds = new Set(players.map((player) => player.id));
    const teamEntries = lineup.filter(
      (entry) => entry.team_id === teamId && entry.position_slot === 'G',
    );
    const savedEntries = teamEntries.filter((entry) => !entry.inherited);
    const initialEntries = savedEntries.length > 0 ? savedEntries : teamEntries;
    const initialSelected = new Set(
      initialEntries.map((entry) => entry.player_id).filter((playerId) => playerIds.has(playerId)),
    );
    const nextSavedSelected = new Set(
      savedEntries.map((entry) => entry.player_id).filter((playerId) => playerIds.has(playerId)),
    );

    setSelected(initialSelected);
    setSavedSelected(nextSavedSelected);
  }, [lineup, open, players, teamId]);

  const displayedPlayers = useMemo(
    () =>
      [...sortedPlayers].sort((a, b) => {
        const aSelected = selected.has(a.id);
        const bSelected = selected.has(b.id);
        if (aSelected === bSelected) return 0;
        return aSelected ? -1 : 1;
      }),
    [selected, sortedPlayers],
  );

  const toggle = (playerId: string) => {
    if (saving) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.clear();
        next.add(playerId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!canSave) return;
    const goalie = selectedPlayers.find(isGoalie);
    const slots: Array<{ position_slot: LineupPositionSlot; player_id: string | null }> = [
      { position_slot: 'G', player_id: goalie?.id ?? null },
    ];

    setSaving(true);
    let ok = false;
    try {
      ok = await saveTeamLineup(teamId, slots, teamName);
    } finally {
      setSaving(false);
    }
    if (ok) onClose();
  };

  const handleClose = () => {
    if (!saving) onClose();
  };

  return (
    <Modal
      open={open}
      title={`${correctionMode ? 'Correct Final Starting Goalie' : 'Set Starting Goalie'} - ${teamName}`}
      onClose={handleClose}
      size="md"
      bodyClassName={styles.rosterBody}
      busy={saving}
      onConfirm={handleSave}
      confirmLabel={saving ? 'Saving...' : correctionMode ? 'Save Correction' : 'Save'}
      confirmIcon="set_lineup"
      confirmDisabled={!canSave}
    >
      <div className={styles.content}>
        {sortedPlayers.length === 0 ? (
          <p className={styles.empty}>No goalies are in this game lineup yet.</p>
        ) : (
          <ul className={styles.list}>
            {displayedPlayers.map((player) => {
              const checked = selected.has(player.id);
              const disabled = saving || (!checked && selectedCount >= MAX_STARTERS);
              return (
                <SelectableListItem
                  key={player.id}
                  checked={checked}
                  onToggle={() => toggle(player.id)}
                  image={player.photo}
                  imagePlaceholder={`${player.first_name[0] ?? ''}${player.last_name[0] ?? ''}`}
                  imageShape="circle"
                  imagePrimaryColor={player.primary_color}
                  imageTextColor={player.text_color}
                  chip={
                    player.jersey_number != null
                      ? {
                          label: player.jersey_number,
                          primaryColor: player.primary_color,
                          textColor: player.text_color,
                        }
                      : null
                  }
                  subtitle={formatPlayerPosition(player.position) ?? undefined}
                  name={`${player.first_name} ${player.last_name}`}
                  disabled={disabled}
                />
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
};

export default SetLineupModal;
