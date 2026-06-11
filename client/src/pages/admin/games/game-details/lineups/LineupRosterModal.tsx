import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import Badge from '@/components/Badge/Badge';
import Button from '@/components/Button/Button';
import Icon from '@/components/Icon/Icon';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import Modal from '@/components/Modal/Modal';
import SelectableListItem from '@/components/SelectableListItem/SelectableListItem';
import ToggleButton from '@/components/ToggleButton/ToggleButton';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import styles from './LineupRosterModal.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const apiError = (err: unknown, fallback: string): string =>
  (err as AxiosError<{ error: string }>).response?.data?.error ?? fallback;

const POSITION_LABELS: Record<string, string> = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  F: 'Forward',
  D: 'Defense',
  LD: 'Left Defense',
  RD: 'Right Defense',
  G: 'Goalie',
};

const playerFullName = (player: Pick<TeamPlayerRecord, 'first_name' | 'last_name'>) =>
  `${player.first_name} ${player.last_name}`.trim();

type JerseyNotice = {
  number: number;
  name: string;
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
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [jerseyInput, setJerseyInput] = useState('');
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
    setJerseyInput('');
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
    setQuery('');
    setSelected(new Set());
    setJerseyInput('');
    setPendingMissing([]);
    setAlreadyAdded([]);
    setProspectMatches([]);
    setShowProspects(false);
    setMovingPlayerId(null);
    onClose();
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
              disabled={controlsDisabled}
              autoFocus
            />
            <Button
              size="sm"
              variant="outlined"
              intent="info"
              onClick={handleApplyJerseys}
              disabled={controlsDisabled || !jerseyInput.trim()}
            >
              Apply
            </Button>
          </div>
          <div className={styles.controlsDivider} />
          {alreadyAdded.length > 0 && (
            <p className={styles.alreadyAddedNote}>
              <Icon
                name="info"
                size="0.85em"
              />
              Already in lineup:{' '}
              {alreadyAdded.map((p) => `#${p.number} ${p.name}`).join(', ')}
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
          <div className={styles.searchRow}>
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
                disabled={controlsDisabled}
              />
            </div>
            <ToggleButton
              active={showProspects}
              onClick={() => setShowProspects((v) => !v)}
              icon={showProspects ? 'visibility_off' : 'visibility'}
              size="sm"
              iconHeight="field"
              activeTooltip="Hide prospects"
              inactiveTooltip="Show prospects"
              disabled={controlsDisabled || !hasProspects}
            />
          </div>
        </div>

        {loadingPlayers ? (
          <LoadingSpinner message="Loading players..." />
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>
            {available.length === 0
              ? 'All team players are already in this lineup.'
              : `No players match "${query}".`}
          </p>
        ) : (
          <ul className={styles.list}>
            {filtered.map((p) => (
              <SelectableListItem
                key={p.id}
                checked={selected.has(p.id)}
                onToggle={() => toggle(p.id)}
                imagePlaceholder={
                  p.jersey_number != null
                    ? String(p.jersey_number)
                    : `${p.first_name[0]}${p.last_name[0]}`
                }
                imageShape="square"
                imagePrimaryColor={p.primary_color}
                imageTextColor={p.text_color}
                subtitle={p.position ? (POSITION_LABELS[p.position] ?? p.position) : undefined}
                name={`${p.last_name}, ${p.first_name}`}
                rightContent={p.is_prospect ? <Badge label="Prospect" /> : undefined}
                disabled={controlsDisabled}
                actions={[
                  p.is_prospect
                    ? {
                        icon: 'north',
                        tooltip: 'Move to roster',
                        disabled: controlsDisabled || movingPlayerId === p.id,
                        onClick: () => updateProspectStatus(p, false),
                      }
                    : {
                        icon: 'south',
                        tooltip: 'Move to prospects',
                        disabled: controlsDisabled || movingPlayerId === p.id,
                        onClick: () => updateProspectStatus(p, true),
                      },
                ]}
              />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
};

export default LineupRosterModal;
