import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Icon from '@/components/Icon/Icon';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import Select from '@/components/Select/Select';
import useSeasons from '@/hooks/useSeasons';
import useTeamPlayers, { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import AddPlayersModal from './AddPlayersModal';
import BulkTradeModal from './BulkTradeModal';
import TeamPlayerEditModal from './TeamPlayerEditModal';
import styles from './TeamDetails.module.scss';

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

const DEFENSE_POSITIONS = new Set(['D', 'LD', 'RD', 'D1', 'D2']);

const ROSTER_SECTIONS = [
  {
    title: 'Forwards',
    matches: (p: TeamPlayerRecord) => p.position !== 'G' && !DEFENSE_POSITIONS.has(p.position ?? ''),
  },
  {
    title: 'Defense',
    matches: (p: TeamPlayerRecord) => DEFENSE_POSITIONS.has(p.position ?? ''),
  },
  {
    title: 'Goalies',
    matches: (p: TeamPlayerRecord) => p.position === 'G',
  },
];

interface Props {
  teamId: string;
  leagueId: string;
  latestSeasonId: string | null;
}

const TeamRosterTab = ({ teamId, leagueId, latestSeasonId }: Props) => {
  const navigate = useNavigate();
  const { seasons: leagueSeasons } = useSeasons(leagueId);
  const currentSeason = leagueSeasons.find((s) => s.is_current);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (selectedSeasonId === null && leagueSeasons.length > 0) {
      setSelectedSeasonId(currentSeason?.id ?? leagueSeasons[0]?.id ?? latestSeasonId);
    }
  }, [leagueSeasons.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    players,
    loading,
    busy,
    addPlayersToRoster,
    updatePlayer,
    updatePlayerTeam,
    updatePlayerRosterRole,
    uploadPlayerPhoto,
    deletePlayer,
    bulkTradePlayers,
  } = useTeamPlayers(teamId, selectedSeasonId ?? undefined);
  const { players: allTeamPlayers } = useTeamPlayers(teamId, selectedSeasonId ?? undefined, {
    includeProspects: true,
  });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamPlayerRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TeamPlayerRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const existingPlayerIds = new Set(allTeamPlayers.map((p) => p.id));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlayers = normalizedQuery
    ? players.filter((p) => {
        const name = `${p.first_name} ${p.last_name}`.toLowerCase();
        const pos = (p.position ?? '').toLowerCase();
        const jersey = p.jersey_number != null ? String(p.jersey_number) : '';
        return (
          name.includes(normalizedQuery) ||
          pos.includes(normalizedQuery) ||
          jersey.startsWith(normalizedQuery.replace('#', ''))
        );
      })
    : players;

  const sortPlayers = (items: TeamPlayerRecord[]) =>
    [...items].sort((a, b) => {
      if (a.jersey_number == null && b.jersey_number == null) {
        return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
      }
      if (a.jersey_number == null) return 1;
      if (b.jersey_number == null) return -1;
      return a.jersey_number - b.jersey_number;
    });

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    await deletePlayer(confirmDelete.id);
    setIsDeleting(false);
    setConfirmDelete(null);
  };

  const renderPlayer = (p: TeamPlayerRecord) => (
    <ListItem
      key={p.id}
      className={styles.rosterItem}
      imageNode={
        <PlayerAvatar
          photo={p.photo}
          initials={`${p.first_name?.charAt(0) ?? ''}${p.last_name?.charAt(0) ?? ''}`.trim() || '?'}
          primaryColor={p.primary_color}
          textColor={p.text_color}
          size={48}
        />
      }
      name={`${p.first_name} ${p.last_name}`}
      placeholder={`${p.first_name[0]}${p.last_name[0]}`}
      primaryColor={p.primary_color ?? undefined}
      textColor={p.text_color ?? undefined}
      jerseyNumber={p.jersey_number}
      subtitle={p.position ? (POSITION_LABELS[p.position] ?? p.position) : undefined}
      rightContent={{
        type: 'tag',
        label: p.is_active ? 'Active' : 'Inactive',
        intent: p.is_active ? 'success' : 'neutral',
      }}
      actions={
        [
          {
            icon: 'open_in_new',
            intent: 'neutral',
            tooltip: 'View player',
            onClick: () => navigate(`/admin/leagues/${leagueId}/teams/${teamId}/players/${p.id}`),
          },
          {
            icon: 'edit',
            intent: 'neutral',
            tooltip: 'Edit player',
            disabled: busy === p.id,
            onClick: () => setEditTarget(p),
          },
          {
            icon: 'south',
            intent: 'neutral',
            tooltip: 'Move to prospects',
            disabled: busy === p.id,
            onClick: () => updatePlayerRosterRole(p, true),
          },
          {
            icon: 'delete',
            intent: 'danger',
            tooltip: 'Delete player',
            disabled: busy === p.id,
            onClick: () => setConfirmDelete(p),
          },
        ] satisfies ListItemAction[]
      }
    />
  );

  return (
    <>
      <Card
        title="Roster"
        action={
          <div className={styles.rosterActions}>
            {leagueSeasons.length > 0 && (
              <Select
                value={selectedSeasonId}
                options={leagueSeasons.map((s) => ({
                  value: s.id,
                  label: s.is_current ? `${s.name} *` : s.name,
                }))}
                onChange={setSelectedSeasonId}
              />
            )}
            <Button
              intent="accent"
              icon="group_add"
              size="sm"
              onClick={() => setAddModalOpen(true)}
            >
              Add Players
            </Button>
            <Button
              variant="outlined"
              intent="neutral"
              icon="swap_horiz"
              size="sm"
              disabled={!selectedSeasonId || players.length === 0}
              onClick={() => setTradeModalOpen(true)}
            >
              Trade Players
            </Button>
          </div>
        }
      >
        <div className={styles.rosterToolbar}>
          <div className={styles.rosterSearch}>
            <Icon
              name="search"
              size="1em"
              className={styles.rosterSearchIcon}
            />
            <input
              className={styles.rosterSearchInput}
              type="text"
              placeholder="Search players..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className={styles.rosterSearchClear}
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <Icon
                  name="close"
                  size="0.8em"
                />
              </button>
            )}
          </div>
        </div>
      </Card>

      <div className={styles.rosterSections}>
        {ROSTER_SECTIONS.map((section) => {
          const sectionPlayers = sortPlayers(filteredPlayers.filter(section.matches));
          return (
            <Card
              key={section.title}
              title={`${section.title} (${sectionPlayers.length})`}
            >
              {loading ? (
                <p className={styles.rosterEmpty}>Loading...</p>
              ) : sectionPlayers.length > 0 ? (
                <ul className={styles.rosterList}>{sectionPlayers.map(renderPlayer)}</ul>
              ) : (
                <p className={styles.rosterEmpty}>
                  {players.length === 0
                    ? 'No players on this roster yet.'
                    : normalizedQuery
                      ? `No ${section.title.toLowerCase()} match "${query}".`
                      : `No ${section.title.toLowerCase()} on this roster.`}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <TeamPlayerEditModal
        open={!!editTarget}
        editTarget={editTarget}
        teamId={teamId}
        seasonId={selectedSeasonId}
        onClose={() => setEditTarget(null)}
        updatePlayer={updatePlayer}
        updatePlayerTeam={updatePlayerTeam}
        uploadPlayerPhoto={uploadPlayerPhoto}
      />

      <BulkTradeModal
        open={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        players={players}
        teamId={teamId}
        leagueId={leagueId}
        seasonId={selectedSeasonId}
        bulkTradePlayers={bulkTradePlayers}
      />

      <AddPlayersModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        teamId={teamId}
        leagueId={leagueId}
        latestSeasonId={latestSeasonId}
        existingPlayerIds={existingPlayerIds}
        addPlayersToRoster={addPlayersToRoster}
      />

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Player"
        body={
          confirmDelete ? (
            <>
              Are you sure you want to delete{' '}
              <strong>
                {confirmDelete.first_name} {confirmDelete.last_name}
              </strong>
              ? This cannot be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete"
        confirmIcon="delete"
        variant="danger"
        busy={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
};

export default TeamRosterTab;
