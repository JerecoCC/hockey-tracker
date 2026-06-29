import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '@/components/Button/Button';
import Field from '@/components/Field/Field';
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
  saveTeamLineup: (
    teamId: string,
    slots: Array<{ position_slot: LineupPositionSlot; player_id: string | null }>,
    teamName?: string,
  ) => Promise<boolean>;
}

type FormValues = {
  jerseyInput: string;
  query: string;
};

type JerseyNotice = {
  number: number;
  name?: string;
};

const MAX_STARTERS = 6;
const REQUIRED_SKATERS = 5;
const REQUIRED_GOALIES = 1;
const SKATER_SLOTS: LineupPositionSlot[] = ['F1', 'F2', 'F3', 'D1', 'D2'];

const playerFullName = (player: Pick<TeamPlayerRecord, 'first_name' | 'last_name'>) =>
  `${player.first_name} ${player.last_name}`.trim();

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

const formatJerseyNotice = (label: string, notices: JerseyNotice[]) =>
  notices.length > 0
    ? `${label}: ${notices.map((notice) => `#${notice.number}${notice.name ? ` ${notice.name}` : ''}`).join(', ')}`
    : null;

const SetLineupModal = ({
  open,
  onClose,
  teamId,
  teamName,
  players,
  lineup,
  saveTeamLineup,
}: Props) => {
  const { control, watch, setValue, reset } = useForm<FormValues>({
    defaultValues: {
      jerseyInput: '',
      query: '',
    },
  });
  const jerseyInput = watch('jerseyInput');
  const query = watch('query');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedSelected, setSavedSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [jerseyNotice, setJerseyNotice] = useState<string | null>(null);

  const sortedPlayers = useMemo(() => [...players].sort(compareByRosterOrder), [players]);

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
  const selectedSkaterCount = selectedCount - selectedGoalieCount;
  const lineupError =
    selectedCount === MAX_STARTERS && selectedGoalieCount !== REQUIRED_GOALIES
      ? 'Select exactly one goalie for the starting lineup.'
      : selectedCount === MAX_STARTERS && selectedSkaterCount !== REQUIRED_SKATERS
        ? 'Select five skaters and one goalie for the starting lineup.'
        : null;
  const canSave =
    !saving &&
    selectedCount === MAX_STARTERS &&
    selectedGoalieCount === REQUIRED_GOALIES &&
    selectedSkaterCount === REQUIRED_SKATERS &&
    hasChanges;

  useEffect(() => {
    if (!open) return;

    const playerIds = new Set(players.map((player) => player.id));
    const teamEntries = lineup.filter((entry) => entry.team_id === teamId);
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
    setJerseyNotice(null);
    reset({ jerseyInput: '', query: '' });
  }, [lineup, open, players, reset, teamId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedPlayers;
    const jerseyQuery = q.replace('#', '');
    return sortedPlayers.filter((player) => {
      const name = playerFullName(player).toLowerCase();
      const displayName = `${player.last_name}, ${player.first_name}`.toLowerCase();
      const position = (player.position ?? '').toLowerCase();
      const jersey = player.jersey_number != null ? String(player.jersey_number) : '';
      return (
        name.includes(q) ||
        displayName.includes(q) ||
        position.includes(q) ||
        jersey.startsWith(jerseyQuery)
      );
    });
  }, [query, sortedPlayers]);

  const toggle = (playerId: string) => {
    if (saving) return;
    setJerseyNotice(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else if (next.size < MAX_STARTERS) {
        next.add(playerId);
      }
      return next;
    });
  };

  const handleApplyJerseys = () => {
    if (saving) return;
    const nums = jerseyInput
      .split(/[\s,]+/)
      .map((value) => parseInt(value, 10))
      .filter((value) => !Number.isNaN(value));
    if (nums.length === 0) return;

    const missing: JerseyNotice[] = [];
    const alreadySelected: JerseyNotice[] = [];
    const skippedFull: JerseyNotice[] = [];
    const nextSelected = new Set(selected);

    nums.forEach((number) => {
      const player = sortedPlayers.find((candidate) => candidate.jersey_number === number);
      if (!player) {
        missing.push({ number });
        return;
      }
      const notice = { number, name: playerFullName(player) };
      if (nextSelected.has(player.id)) {
        alreadySelected.push(notice);
        return;
      }
      if (nextSelected.size >= MAX_STARTERS) {
        skippedFull.push(notice);
        return;
      }
      nextSelected.add(player.id);
    });
    setSelected(nextSelected);

    const notices = [
      formatJerseyNotice('Already selected', alreadySelected),
      formatJerseyNotice('No match', missing),
      formatJerseyNotice('Skipped after six starters', skippedFull),
    ].filter((notice): notice is string => Boolean(notice));
    setJerseyNotice(notices.length > 0 ? notices.join(' ') : null);
    setValue('jerseyInput', '');
  };

  const handleSave = async () => {
    if (!canSave) return;
    const skaters = selectedPlayers.filter((player) => !isGoalie(player));
    const goalie = selectedPlayers.find(isGoalie);
    const slots: Array<{ position_slot: LineupPositionSlot; player_id: string | null }> = [
      ...SKATER_SLOTS.map((positionSlot, index) => ({
        position_slot: positionSlot,
        player_id: skaters[index]?.id ?? null,
      })),
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

  const handleClear = () => {
    if (saving) return;
    setSelected(new Set());
    setJerseyNotice(null);
  };

  const footerSummary =
    selectedCount > 0
      ? `${selectedCount}/${MAX_STARTERS} starter${selectedCount !== 1 ? 's' : ''} selected`
      : 'No starters selected';

  return (
    <Modal
      open={open}
      title={`Set Starting Lineup - ${teamName}`}
      onClose={handleClose}
      size="md"
      busy={saving}
      footer={
        <div className={styles.footerActions}>
          <span className={styles.footerSummary}>{footerSummary}</span>
          <Button
            variant="outlined"
            intent="danger"
            icon="clear_all"
            onClick={handleClear}
            disabled={saving || selectedCount === 0}
            className={styles.footerClear}
          >
            Clear
          </Button>
          <Button
            variant="outlined"
            intent="neutral"
            onClick={handleClose}
            type="button"
            disabled={saving}
            className={styles.footerCancel}
          >
            Cancel
          </Button>
          <Button
            intent="accent"
            icon="set_lineup"
            onClick={handleSave}
            type="button"
            disabled={!canSave || !!lineupError}
            className={styles.footerSave}
          >
            {saving ? 'Saving...' : 'Save Lineup'}
          </Button>
        </div>
      }
    >
      <div className={styles.content}>
        <div className={styles.groupHeader}>
          <span className={styles.slotGroupLabel}>
            Starting players <span className={styles.required}>*</span>
          </span>
          <span className={styles.groupMeta}>5 skaters + 1 goalie</span>
        </div>

        <div className={styles.controls}>
          <div className={styles.quickAddWrap}>
            <Field
              control={control}
              name="jerseyInput"
              type="text"
              className={styles.quickAddField}
              placeholder="Jersey numbers (e.g. 7 11 25)..."
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                handleApplyJerseys();
              }}
              disabled={saving}
              autoFocus
            />
            <Button
              size="sm"
              variant="outlined"
              intent="info"
              onClick={handleApplyJerseys}
              disabled={saving || !jerseyInput.trim() || selectedCount >= MAX_STARTERS}
            >
              Apply
            </Button>
          </div>
          <div className={styles.controlsDivider} />
          {jerseyNotice && <p className={styles.notice}>{jerseyNotice}</p>}
          <div className={styles.searchRow}>
            <Field
              control={control}
              name="query"
              type="search"
              className={styles.searchField}
              placeholder="Search players..."
              disabled={saving}
            />
          </div>
        </div>

        {lineupError && <p className={styles.error}>{lineupError}</p>}

        {filtered.length === 0 ? (
          <p className={styles.empty}>
            {sortedPlayers.length === 0
              ? 'No players are in this game lineup yet.'
              : `No players match "${query}".`}
          </p>
        ) : (
          <ul className={styles.list}>
            {filtered.map((player) => {
              const checked = selected.has(player.id);
              const disabled = saving || (!checked && selectedCount >= MAX_STARTERS);
              return (
                <SelectableListItem
                  key={player.id}
                  checked={checked}
                  onToggle={() => toggle(player.id)}
                  imagePlaceholder={
                    player.jersey_number != null
                      ? String(player.jersey_number)
                      : `${player.first_name[0] ?? ''}${player.last_name[0] ?? ''}`
                  }
                  imageShape="square"
                  imagePrimaryColor={player.primary_color}
                  imageTextColor={player.text_color}
                  subtitle={formatPlayerPosition(player.position) ?? undefined}
                  name={`${player.last_name}, ${player.first_name}`}
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
