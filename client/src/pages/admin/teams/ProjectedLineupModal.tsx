import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { faGripLinesVertical } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Card from '@jerecocc/tracker-ui/components/Card/Card';
import ListItem from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import PlayerAvatar from '@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar';
import SearchableList from '@jerecocc/tracker-ui/components/SearchableList/SearchableList';
import SegmentedControl from '@jerecocc/tracker-ui/components/SegmentedControl/SegmentedControl';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import Tabs from '@jerecocc/tracker-ui/components/Tabs/Tabs';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import { useProjectedLineup, type ProjectedLineupSlot } from '@/hooks/useProjectedLineup';
import { normalizePlayerSearchText, playerSearchTextIncludes } from '@/lib/playerSearch';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import styles from './ProjectedLineupModal.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
  teamId: string;
  seasonId: string;
  teamName: string;
  players: TeamPlayerRecord[];
}

type PositionGroup = 'F' | 'D' | 'G';
type PlayerSort = 'jersey' | 'lastName';
type SlotAssignments = Record<string, string | null>;

interface SlotDefinition {
  key: string;
  detail: string;
  dropLabel?: string;
}

interface PositionTabDefinition {
  group: PositionGroup;
  label: string;
  lineupTitle: string;
  availableTitle: string;
  columns: string[];
  slots: SlotDefinition[];
}

const FORWARD_SLOTS: SlotDefinition[] = Array.from({ length: 4 }, (_, lineIndex) =>
  ['LW', 'C', 'RW'].map((position) => ({
    key: `F${lineIndex + 1}_${position}`,
    detail: `Line ${lineIndex + 1}`,
  })),
).flat();

const DEFENSE_SLOTS: SlotDefinition[] = Array.from({ length: 3 }, (_, pairingIndex) =>
  ['LD', 'RD'].map((position) => ({
    key: `D${pairingIndex + 1}_${position}`,
    detail: `Pairing ${pairingIndex + 1}`,
  })),
).flat();

const GOALIE_SLOTS: SlotDefinition[] = [
  { key: 'G1', detail: 'Goalie 1', dropLabel: 'Drop starter here' },
  { key: 'G2', detail: 'Goalie 2', dropLabel: 'Drop backup here' },
];

const POSITION_TABS: PositionTabDefinition[] = [
  {
    group: 'F',
    label: 'Forwards',
    lineupTitle: 'Forward lines',
    availableTitle: 'Available forwards',
    columns: ['Left Wing', 'Center', 'Right Wing'],
    slots: FORWARD_SLOTS,
  },
  {
    group: 'D',
    label: 'Defense',
    lineupTitle: 'Defense pairings',
    availableTitle: 'Available defense',
    columns: ['Left Defense', 'Right Defense'],
    slots: DEFENSE_SLOTS,
  },
  {
    group: 'G',
    label: 'Goalies',
    lineupTitle: 'Goalies',
    availableTitle: 'Available goalies',
    columns: [],
    slots: GOALIE_SLOTS,
  },
];

const ALL_SLOTS = POSITION_TABS.flatMap((tab) => tab.slots);
const ALL_SLOT_KEYS = new Set(ALL_SLOTS.map((slot) => slot.key));
const REQUIRED_SLOT_KEYS = ALL_SLOTS.map((slot) => slot.key);
const PLAYER_DRAG_TYPE = 'text/projected-lineup-player-id';

const positionGroup = (position: string | null): PositionGroup => {
  const normalized = position?.toUpperCase();
  if (normalized === 'G') return 'G';
  if (normalized === 'D' || normalized === 'LD' || normalized === 'RD') return 'D';
  return 'F';
};

const emptyAssignments = (): SlotAssignments =>
  Object.fromEntries(ALL_SLOTS.map((slot) => [slot.key, null]));

const assignmentsFromSlots = (savedSlots: ProjectedLineupSlot[]): SlotAssignments => {
  const assignments = emptyAssignments();
  const legacyIndexes: Record<PositionGroup, number> = { F: 0, D: 0, G: 0 };
  const slotKeysByGroup: Record<PositionGroup, string[]> = {
    F: FORWARD_SLOTS.map((slot) => slot.key),
    D: DEFENSE_SLOTS.map((slot) => slot.key),
    G: GOALIE_SLOTS.map((slot) => slot.key),
  };

  savedSlots.forEach((slot) => {
    if (ALL_SLOT_KEYS.has(slot.slot_key)) {
      assignments[slot.slot_key] = slot.player_id;
      return;
    }

    const legacyMatch = /^([FDG])(\d+)$/.exec(slot.slot_key);
    if (!legacyMatch) return;
    const group = legacyMatch[1] as PositionGroup;
    const legacyIndex = Number(legacyMatch[2]) - 1;
    const targetKey =
      slotKeysByGroup[group][legacyIndex] ?? slotKeysByGroup[group][legacyIndexes[group]];
    legacyIndexes[group] += 1;
    if (targetKey) assignments[targetKey] = slot.player_id;
  });

  return assignments;
};

const playerName = (player: TeamPlayerRecord) => `${player.first_name} ${player.last_name}`;

const playerMatchesSearch = (player: TeamPlayerRecord, query: string) => {
  const normalizedQuery = normalizePlayerSearchText(query);
  return [
    playerName(player),
    player.first_name,
    player.last_name,
    player.position,
    player.jersey_number?.toString(),
  ].some((value) => playerSearchTextIncludes(value, normalizedQuery));
};

const sortPlayers = (players: TeamPlayerRecord[], sortBy: PlayerSort) =>
  [...players].sort((left, right) => {
    const byLastName =
      left.last_name.localeCompare(right.last_name) ||
      left.first_name.localeCompare(right.first_name);
    const byJerseyNumber =
      (left.jersey_number ?? Number.POSITIVE_INFINITY) -
      (right.jersey_number ?? Number.POSITIVE_INFINITY);

    return sortBy === 'jersey' ? byJerseyNumber || byLastName : byLastName || byJerseyNumber;
  });

const ProjectedLineupModal = ({ open, onClose, teamId, seasonId, teamName, players }: Props) => {
  const { slots, loading, saving, save } = useProjectedLineup(teamId, seasonId);
  const [selectedTab, setSelectedTab] = useState(0);
  const [assignments, setAssignments] = useState<SlotAssignments>(emptyAssignments);
  const [playerSort, setPlayerSort] = useState<PlayerSort>('jersey');
  const [dragPlayerId, setDragPlayerId] = useState<string | null>(null);
  const [dropSlotKey, setDropSlotKey] = useState<string | null>(null);
  const savedAssignments = useMemo(() => assignmentsFromSlots(slots), [slots]);

  useEffect(() => {
    if (open && !loading) setAssignments(savedAssignments);
  }, [loading, open, savedAssignments]);

  useEffect(() => {
    if (!open) {
      setSelectedTab(0);
      setPlayerSort('jersey');
    }
  }, [open]);

  useEffect(() => {
    if (saving) {
      setDragPlayerId(null);
      setDropSlotKey(null);
    }
  }, [saving]);

  const playersById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );
  const assignedPlayerIds = useMemo(
    () => new Set(Object.values(assignments).filter((id): id is string => Boolean(id))),
    [assignments],
  );
  const requiredSlotsFilled = REQUIRED_SLOT_KEYS.every((slotKey) => assignments[slotKey]);
  const hasChanges = ALL_SLOTS.some((slot) => assignments[slot.key] !== savedAssignments[slot.key]);
  const canSave = !loading && !saving && requiredSlotsFilled && hasChanges;

  const updateAssignment = (playerId: string, targetKey: string) => {
    if (saving) return;
    setAssignments((current) => {
      const next = { ...current };
      const sourceKey = Object.keys(next).find((key) => next[key] === playerId);
      const displacedPlayerId = next[targetKey];

      if (sourceKey === targetKey) return current;
      if (sourceKey) next[sourceKey] = displacedPlayerId ?? null;
      next[targetKey] = playerId;
      return next;
    });
  };

  const removeAssignment = (slotKey: string) => {
    if (saving) return;
    setAssignments((current) => ({ ...current, [slotKey]: null }));
  };

  const handleDragStart = (event: DragEvent, playerId: string) => {
    if (saving) {
      event.preventDefault();
      event.dataTransfer.effectAllowed = 'none';
      return;
    }
    setDragPlayerId(playerId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(PLAYER_DRAG_TYPE, playerId);
  };

  const getDraggedPlayerId = (event: DragEvent) =>
    dragPlayerId || event.dataTransfer.getData(PLAYER_DRAG_TYPE);

  const setDropTarget = (event: DragEvent, slotKey: string, disabled: boolean) => {
    const playerId = getDraggedPlayerId(event);
    const player = playersById.get(playerId);
    const sourceKey = Object.keys(assignments).find((key) => assignments[key] === playerId);
    const valid =
      !saving &&
      !disabled &&
      sourceKey !== slotKey &&
      player &&
      positionGroup(player.position) === slotKey.charAt(0);

    if (!valid) {
      event.dataTransfer.dropEffect = 'none';
      setDropSlotKey(null);
      return null;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropSlotKey((current) => (current === slotKey ? current : slotKey));
    return playerId;
  };

  const handleDragEnd = () => {
    setDragPlayerId(null);
    setDropSlotKey(null);
  };

  const handleDragLeave = (event: DragEvent, slotKey: string) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setDropSlotKey((current) => (current === slotKey ? null : current));
  };

  const handleDrop = (event: DragEvent, slotKey: string, disabled: boolean) => {
    const playerId = setDropTarget(event, slotKey, disabled);
    setDragPlayerId(null);
    setDropSlotKey(null);
    if (playerId) updateAssignment(playerId, slotKey);
  };

  const addToFirstOpenSlot = (playerId: string, tab: PositionTabDefinition) => {
    if (saving) return;
    const target = tab.slots.find((slot) => !assignments[slot.key]);
    if (target) updateAssignment(playerId, target.key);
  };

  const handleSave = async () => {
    if (!canSave) return;
    const projectedSlots = ALL_SLOTS.flatMap((slot) => {
      const playerId = assignments[slot.key];
      return playerId ? [{ slot_key: slot.key, player_id: playerId }] : [];
    });
    if (await save(projectedSlots)) onClose();
  };

  const renderLoadingTab = (tab: PositionTabDefinition) => (
    <div
      className={styles.tabContent}
      aria-label={`Loading ${tab.label.toLowerCase()} projection`}
    >
      <Section
        className={styles.section}
        title={tab.lineupTitle}
      >
        {tab.columns.length > 0 && (
          <div className={`${styles.columnHeaders} ${styles[`slotGrid${tab.group}`]}`}>
            {tab.columns.map((column) => (
              <span key={column}>{column}</span>
            ))}
          </div>
        )}
        <div className={`${styles.slotGrid} ${styles[`slotGrid${tab.group}`]}`}>
          {tab.slots.map((slot) => (
            <Skeleton
              key={slot.key}
              variant="card"
              className={`${styles.slot} ${styles.slotSkeleton}`}
            />
          ))}
        </div>
      </Section>

      <div className={styles.listSectionFrame}>
        <Section
          className={`${styles.section} ${styles.listSection}`}
          title={tab.availableTitle}
          action={
            <Skeleton
              variant="block"
              className={styles.sortSkeleton}
            />
          }
        >
          <div className={styles.loadingSearchToolbar}>
            <Skeleton
              variant="block"
              className={styles.searchSkeleton}
            />
          </div>
          <ResponsiveList className={styles.playerList}>
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton
                as="li"
                key={index}
                variant="card"
                className={styles.playerSkeleton}
              />
            ))}
          </ResponsiveList>
        </Section>
      </div>
    </div>
  );

  const renderTab = (tab: PositionTabDefinition) => {
    const availablePlayers = players.filter(
      (player) => positionGroup(player.position) === tab.group && !assignedPlayerIds.has(player.id),
    );
    const hasOpenSlot = tab.slots.some((slot) => !assignments[slot.key]);

    return (
      <div className={styles.tabContent}>
        <Section
          className={styles.section}
          title={tab.lineupTitle}
        >
          {tab.columns.length > 0 && (
            <div className={`${styles.columnHeaders} ${styles[`slotGrid${tab.group}`]}`}>
              {tab.columns.map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>
          )}
          <div className={`${styles.slotGrid} ${styles[`slotGrid${tab.group}`]}`}>
            {tab.slots.map((slot) => {
              const playerId = assignments[slot.key];
              const player = playerId ? playersById.get(playerId) : undefined;
              const disabled = saving;
              return (
                <Card
                  key={slot.key}
                  variant="border"
                  className={`${styles.slot} ${player ? styles.slotFilled : ''} ${disabled ? styles.slotDisabled : ''} ${dropSlotKey === slot.key ? styles.slotDropTarget : ''}`}
                  data-testid={`lineup-slot-${slot.key}`}
                  data-dragging={player && dragPlayerId === player.id ? true : undefined}
                  aria-disabled={disabled}
                  onDragEnter={(event) => setDropTarget(event, slot.key, disabled)}
                  onDragOver={(event) => setDropTarget(event, slot.key, disabled)}
                  onDragLeave={(event) => handleDragLeave(event, slot.key)}
                  onDrop={(event) => handleDrop(event, slot.key, disabled)}
                >
                  {player ? (
                    <>
                      <span
                        className={styles.dragHandle}
                        aria-hidden="true"
                      >
                        <FontAwesomeIcon icon={faGripLinesVertical} />
                      </span>
                      <div
                        className={`${styles.assignedPlayer} ${saving ? styles.interactionDisabled : ''}`}
                        draggable={!saving}
                        aria-disabled={saving}
                        onDragStart={(event) => handleDragStart(event, player.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <ListItem
                          fullWidth
                          variant="plain"
                          className={styles.playerListItem}
                          imageNode={
                            <PlayerAvatar
                              photo={player.photo}
                              initials={`${player.first_name.charAt(0)}${player.last_name.charAt(0)}`}
                              primaryColor={player.primary_color}
                              textColor={player.text_color}
                              size={48}
                            />
                          }
                          eyebrow={player.first_name}
                          name={player.last_name}
                          ariaLabel={playerName(player)}
                          placeholder={`${player.first_name.charAt(0)}${player.last_name.charAt(0)}`}
                          primaryColor={player.primary_color ?? undefined}
                          textColor={player.text_color ?? undefined}
                          chip={{ label: player.jersey_number ?? '-' }}
                          actions={[
                            {
                              icon: 'close',
                              intent: 'neutral',
                              tooltip: `Remove ${playerName(player)} from ${slot.detail}`,
                              disabled: saving,
                              onClick: () => removeAssignment(slot.key),
                            },
                          ]}
                        />
                      </div>
                    </>
                  ) : (
                    <span className={styles.emptySlotText}>
                      {slot.dropLabel ?? 'Drop player here'}
                    </span>
                  )}
                </Card>
              );
            })}
          </div>
        </Section>

        <div className={styles.listSectionFrame}>
          <Section
            className={`${styles.section} ${styles.listSection}`}
            title={tab.availableTitle}
            action={
              <SegmentedControl
                className={styles.playerSortControl}
                value={playerSort}
                onChange={(value) => setPlayerSort(value as PlayerSort)}
                disabled={saving}
                ariaLabel="Sort available players"
                options={[
                  {
                    value: 'jersey',
                    label: '#',
                    ariaLabel: 'Sort by jersey number',
                    tooltip: 'Sort by jersey number',
                  },
                  {
                    value: 'lastName',
                    label: 'A–Z',
                    ariaLabel: 'Sort by last name',
                    tooltip: 'Sort by last name',
                  },
                ]}
              />
            }
          >
            <SearchableList
              items={availablePlayers}
              filterItem={playerMatchesSearch}
              placeholder={`Search ${tab.label.toLowerCase()}...`}
              emptyMessage="No unassigned players at this position."
              getNoResultsMessage={(query) => `No players match “${query}”.`}
              className={styles.searchablePlayers}
              renderItems={(filteredPlayers) => (
                <ResponsiveList className={styles.playerList}>
                  {sortPlayers(filteredPlayers, playerSort).map((player) => (
                    <div
                      key={player.id}
                      className={`${styles.draggablePlayer} ${dragPlayerId === player.id ? styles.draggingPlayer : ''} ${saving ? styles.interactionDisabled : ''}`}
                      draggable={!saving}
                      aria-disabled={saving}
                      onDragStart={(event) => handleDragStart(event, player.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <span
                        className={styles.dragHandle}
                        aria-hidden="true"
                      >
                        <FontAwesomeIcon icon={faGripLinesVertical} />
                      </span>
                      <ListItem
                        fullWidth
                        className={styles.playerListItem}
                        imageNode={
                          <PlayerAvatar
                            photo={player.photo}
                            initials={`${player.first_name.charAt(0)}${player.last_name.charAt(0)}`}
                            primaryColor={player.primary_color}
                            textColor={player.text_color}
                            size={48}
                          />
                        }
                        eyebrow={player.first_name}
                        name={player.last_name}
                        ariaLabel={playerName(player)}
                        placeholder={`${player.first_name.charAt(0)}${player.last_name.charAt(0)}`}
                        primaryColor={player.primary_color ?? undefined}
                        textColor={player.text_color ?? undefined}
                        chip={{ label: player.jersey_number ?? '-' }}
                        actions={[
                          {
                            icon: 'add',
                            intent: 'neutral',
                            tooltip: `Add ${playerName(player)} to lineup`,
                            disabled: saving || !hasOpenSlot,
                            onClick: () => addToFirstOpenSlot(player.id, tab),
                          },
                        ]}
                      />
                    </div>
                  ))}
                </ResponsiveList>
              )}
            />
          </Section>
        </div>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      title={`Projected Lineup - ${teamName}`}
      className={styles.modal}
      onClose={onClose}
      onConfirm={handleSave}
      confirmLabel="Save Projection"
      confirmIcon="set_lineup"
      confirmDisabled={!canSave}
      busy={saving}
      size="xl"
    >
      <Tabs
        selectedIndex={selectedTab}
        onSelectedIndexChange={setSelectedTab}
        keepMounted
        tabs={POSITION_TABS.map((tab) => ({
          label: tab.label,
          content: loading ? renderLoadingTab(tab) : renderTab(tab),
        }))}
      />
    </Modal>
  );
};

export default ProjectedLineupModal;
