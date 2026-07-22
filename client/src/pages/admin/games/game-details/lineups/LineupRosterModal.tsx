import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'react-toastify';
import Tag from '@jerecocc/tracker-ui/components/Tag/Tag';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Checklist from '@jerecocc/tracker-ui/components/Checklist/Checklist';
import { ControlledInputField } from '@/components/form/ControlledFields';
import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
import LoadingSpinner from '@jerecocc/tracker-ui/components/LoadingSpinner/LoadingSpinner';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import Toggle from '@jerecocc/tracker-ui/components/Toggle/Toggle';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import { formatPlayerPosition } from '@/lib/playerPosition';
import { normalizePlayerSearchText, playerSearchTextIncludes } from '@/lib/playerSearch';
import styles from './LineupRosterModal.module.scss';

import { API, authHeaders, getApiErrorMessage as apiError } from '@/lib/apiClient';

const playerFullName = (player: Pick<TeamPlayerRecord, 'first_name' | 'last_name'>) =>
  `${player.first_name} ${player.last_name}`.trim();

type JerseyNotice = {
  number: number;
  name: string;
};

type FormValues = {
  jerseyInput: string;
  query: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  teamId: string;
  seasonId: string;
  /** YYYY-MM-DD date of the game — used to filter players active on that date. */
  gameDate?: string;
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
  gameDate,
  teamName,
  existingPlayerIds,
  addToGameRoster,
  onMissingJerseys,
}: Props) => {
  const queryClient = useQueryClient();
  const { control, watch, setValue, reset } = useForm<FormValues>({
    defaultValues: {
      jerseyInput: '',
      query: '',
    },
  });
  const jerseyInput = watch('jerseyInput');
  const query = watch('query');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [pendingMissing, setPendingMissing] = useState<number[]>([]);
  const [alreadyAdded, setAlreadyAdded] = useState<JerseyNotice[]>([]);
  const [prospectMatches, setProspectMatches] = useState<JerseyNotice[]>([]);
  const [showProspects, setShowProspects] = useState(false);
  const [movingPlayerId, setMovingPlayerId] = useState<string | null>(null);

  const { data: allPlayers = [], isFetching } = useQuery<TeamPlayerRecord[]>({
    queryKey: [
      'players',
      { team_id: teamId, season_id: seasonId, game_date: gameDate, includeProspects: true },
    ],
    queryFn: async () => {
      const { data } = await axios.get<TeamPlayerRecord[]>(`${API}/admin/players`, {
        headers: authHeaders(),
        params: {
          team_id: teamId,
          season_id: seasonId,
          game_date: gameDate,
          include_prospects: 'true',
        },
      });
      return data;
    },
    enabled: open,
  });
  const loadingPlayers = isFetching && allPlayers.length === 0;
  const controlsDisabled = submitting;

  const hasProspects = allPlayers.some((p) => p.is_prospect);

  const available = allPlayers
    .filter((p) => !existingPlayerIds.has(p.id))
    .filter((p) => showProspects || !p.is_prospect)
    .sort((a, b) => {
      // Jersey numbers first (null last), then alphabetically
      if (a.jersey_number != null && b.jersey_number != null)
        return a.jersey_number - b.jersey_number;
      if (a.jersey_number != null) return -1;
      if (b.jersey_number != null) return 1;
      return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
    });

  const selectedCount = selected.size;

  const matchesPlayerSearch = (player: TeamPlayerRecord, searchQuery: string) => {
    const q = normalizePlayerSearchText(searchQuery);
    const name = `${player.first_name} ${player.last_name}`;
    const jersey = player.jersey_number != null ? String(player.jersey_number) : '';
    return (
      playerSearchTextIncludes(name, q) ||
      playerSearchTextIncludes(player.position, q) ||
      jersey.startsWith(q.replace('#', ''))
    );
  };

  const toggle = (playerId: string) => {
    if (controlsDisabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  const handleApplyJerseys = () => {
    if (controlsDisabled) return;
    const nums = jerseyInput
      .split(/[\s,]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => !isNaN(n));
    if (nums.length === 0) return;

    const matched: string[] = [];
    const missing: number[] = [];
    const inLineup: JerseyNotice[] = [];
    const prospects: JerseyNotice[] = [];

    for (const num of nums) {
      const player = allPlayers.find((p) => p.jersey_number === num);
      if (!player) {
        missing.push(num);
      } else if (existingPlayerIds.has(player.id)) {
        inLineup.push({ number: num, name: playerFullName(player) });
      } else {
        matched.push(player.id);
        if (player.is_prospect) prospects.push({ number: num, name: playerFullName(player) });
      }
    }

    if (matched.length > 0) {
      setSelected((prev) => {
        const next = new Set(prev);
        matched.forEach((id) => next.add(id));
        return next;
      });
    }
    setPendingMissing(missing);
    setAlreadyAdded(inLineup);
    setProspectMatches(prospects);
    setValue('jerseyInput', '');
  };

  const updateProspectStatus = async (player: TeamPlayerRecord, isProspect: boolean) => {
    if (controlsDisabled) return;
    setMovingPlayerId(player.id);
    try {
      if (player.player_team_id) {
        await axios.patch(
          `${API}/admin/player-teams/${player.player_team_id}`,
          { is_prospect: isProspect },
          { headers: authHeaders() },
        );
      } else {
        await axios.patch(
          `${API}/admin/player-teams`,
          {
            player_id: player.id,
            team_id: player.team_id ?? teamId,
            season_id: seasonId,
            is_prospect: isProspect,
          },
          { headers: authHeaders() },
        );
      }
      if (isProspect) {
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(player.id);
          return next;
        });
      }
      toast.success(isProspect ? 'Player moved to prospects' : 'Player moved to roster');
      await queryClient.invalidateQueries({ queryKey: ['players'] });
    } catch (err) {
      toast.error(apiError(err, 'Failed to update roster status'));
    } finally {
      setMovingPlayerId(null);
    }
  };

  const handleClose = () => {
    reset();
    setSelected(new Set());
    setPendingMissing([]);
    setAlreadyAdded([]);
    setProspectMatches([]);
    setShowProspects(false);
    setMovingPlayerId(null);
    onClose();
  };

  const handleClear = () => {
    if (controlsDisabled) return;
    setSelected(new Set());
    setPendingMissing([]);
    setAlreadyAdded([]);
    setProspectMatches([]);
  };

  const handleSubmit = async () => {
    if (selectedCount === 0 && pendingMissing.length === 0) return;
    if (selectedCount > 0) {
      setSubmitting(true);
      let ok = false;
      try {
        ok = await addToGameRoster([...selected]);
      } finally {
        setSubmitting(false);
      }
      if (!ok) return;
    }
    if (pendingMissing.length > 0) {
      onMissingJerseys?.(pendingMissing);
    }
    handleClose();
  };

  const footerSummary =
    selectedCount > 0
      ? `${selectedCount} player${selectedCount !== 1 ? 's' : ''} selected`
      : pendingMissing.length > 0
        ? 'Will create missing players'
        : 'No players selected';

  return (
    <Modal
      open={open}
      title={`Add to ${teamName} Lineup`}
      onClose={handleClose}
      size="md"
      busy={submitting}
      footer={
        <div className={styles.footerActions}>
          <span className={styles.footerSummary}>{footerSummary}</span>
          <Button
            variant="outlined"
            intent="danger"
            icon="clear_all"
            onClick={handleClear}
            type="button"
            disabled={controlsDisabled || (selectedCount === 0 && pendingMissing.length === 0)}
            className={styles.footerClear}
          >
            Clear
          </Button>
          <Button
            variant="outlined"
            intent="neutral"
            onClick={handleClose}
            type="button"
            disabled={controlsDisabled}
            className={styles.footerCancel}
          >
            Cancel
          </Button>
          <Button
            intent="accent"
            icon="group_add"
            onClick={handleSubmit}
            type="button"
            disabled={controlsDisabled || (selectedCount === 0 && pendingMissing.length === 0)}
            className={styles.footerSave}
          >
            {submitting ? 'Adding...' : 'Add to Lineup'}
          </Button>
        </div>
      }
    >
      <div className={styles.controls}>
        <div className={styles.quickAddWrap}>
          <ControlledInputField
            control={control}
            name="jerseyInput"
            type="text"
            placeholder="Jersey numbers (e.g. 7 11 25)..."
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              handleApplyJerseys();
            }}
            disabled={controlsDisabled}
            autoFocus
          />
          <Button
            variant="outlined"
            intent="info"
            onClick={handleApplyJerseys}
            disabled={controlsDisabled || !jerseyInput.trim()}
          >
            Apply
          </Button>
        </div>
        {alreadyAdded.length > 0 && (
          <p className={styles.alreadyAddedNote}>
            <Icon
              name="info"
              size="0.85em"
            />
            Already in lineup: {alreadyAdded.map((p) => `#${p.number} ${p.name}`).join(', ')}
          </p>
        )}
        {prospectMatches.length > 0 && (
          <p className={styles.prospectNote}>
            <Icon
              name="info"
              size="0.85em"
            />
            Prospect{prospectMatches.length !== 1 ? 's' : ''}:{' '}
            {prospectMatches.map((p) => `#${p.number} ${p.name}`).join(', ')}
            {' - will be moved to roster when added.'}
          </p>
        )}
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
      </div>

      {loadingPlayers ? (
        <LoadingSpinner message="Loading players..." />
      ) : (
        <Checklist
          options={available.map((player) => ({
            id: player.id,
            player,
            searchText: `${player.first_name} ${player.last_name} ${player.position ?? ''} ${
              player.jersey_number ?? ''
            }`,
            image: player.photo,
            imagePlaceholder: `${player.first_name[0] ?? ''}${player.last_name[0] ?? ''}`,
            imageShape: 'circle' as const,
            imagePrimaryColor: player.primary_color,
            imageTextColor: player.text_color,
            chip:
              player.jersey_number != null
                ? {
                    label: player.jersey_number,
                    primaryColor: player.primary_color,
                    textColor: player.text_color,
                  }
                : null,
            subtitle: formatPlayerPosition(player.position) ?? undefined,
            name: `${player.first_name} ${player.last_name}`.trim(),
            disabled: controlsDisabled,
            rightContent: player.is_prospect ? <Tag label="Prospect" /> : undefined,
            actions: [
              player.is_prospect
                ? {
                    icon: 'north',
                    tooltip: 'Move to roster',
                    disabled: controlsDisabled || movingPlayerId === player.id,
                    onClick: () => updateProspectStatus(player, false),
                  }
                : {
                    icon: 'south',
                    tooltip: 'Move to prospects',
                    disabled: controlsDisabled || movingPlayerId === player.id,
                    onClick: () => updateProspectStatus(player, true),
                  },
            ],
          }))}
          selectedIds={selected}
          onToggle={(option) => toggle(option.id)}
          searchable
          filterOption={(option, searchQuery) => matchesPlayerSearch(option.player, searchQuery)}
          query={query}
          onQueryChange={(value) => setValue('query', value)}
          placeholder="Search players..."
          searchDisabled={controlsDisabled}
          actions={
            <Toggle
              variant="toggle"
              active={showProspects}
              onActiveChange={() => setShowProspects((v) => !v)}
              activeIcon="visibility"
              inactiveIcon="visibility_off"
              activeTooltip="Hide prospects"
              inactiveTooltip="Show prospects"
              disabled={controlsDisabled || !hasProspects}
            />
          }
          emptyMessage="All team players are already in this lineup."
          getNoResultsMessage={(searchQuery) => `No players match "${searchQuery}".`}
        />
      )}
    </Modal>
  );
};

export default LineupRosterModal;
