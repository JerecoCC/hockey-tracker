import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import SearchableList from '@/components/SearchableList/SearchableList';
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

interface Props {
  teamId: string;
  leagueId: string;
  latestSeasonId: string | null;
}

const TeamRosterTab = ({ teamId, leagueId, latestSeasonId }: Props) => {
  const navigate = useNavigate();
  // Load all seasons for this league
  const { seasons: leagueSeasons } = useSeasons(leagueId);
  const currentSeason = leagueSeasons.find((s) => s.is_current);

  // Selected season — null until seasons load, then defaults to current (or most recent)
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

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
    uploadPlayerPhoto,
    deletePlayer,
    bulkTradePlayers,
  } = useTeamPlayers(teamId, selectedSeasonId ?? undefined);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamPlayerRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TeamPlayerRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const existingPlayerIds = new Set(players.map((p) => p.id));

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    await deletePlayer(confirmDelete.id);
    setIsDeleting(false);
    setConfirmDelete(null);
  };

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
                  label: s.is_current ? `${s.name} ✦` : s.name,
                }))}
                onChange={setSelectedSeasonId}
              />
            )}
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
        <SearchableList
          items={players}
          filterFn={(p, q) => {
            const name = `${p.first_name} ${p.last_name}`.toLowerCase();
            const pos = (p.position ?? '').toLowerCase();
            return name.includes(q.toLowerCase()) || pos.includes(q.toLowerCase());
          }}
          renderItems={(filtered) => {
            const sorted = [...filtered].sort((a, b) => {
              if (a.jersey_number == null && b.jersey_number == null) return 0;
              if (a.jersey_number == null) return 1;
              if (b.jersey_number == null) return -1;
              return a.jersey_number - b.jersey_number;
            });
            return (
              <ul className={styles.rosterList}>
                {sorted.map((p) => (
                  <ListItem
                    key={p.id}
                    image={p.photo}
                    image_shape="circle"
                    name={`${p.jersey_number != null ? `#${p.jersey_number} ` : ''}${p.first_name} ${p.last_name}`}
                    placeholder={`${p.first_name[0]}${p.last_name[0]}`}
                    primaryColor={p.primary_color ?? undefined}
                    textColor={p.text_color ?? undefined}
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
                          onClick: () =>
                            navigate(`/admin/leagues/${leagueId}/teams/${teamId}/players/${p.id}`),
                        },
                        {
                          icon: 'edit',
                          intent: 'neutral',
                          tooltip: 'Edit player',
                          disabled: busy === p.id,
                          onClick: () => setEditTarget(p),
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
                ))}
              </ul>
            );
          }}
          placeholder="Search players…"
          actions={
            <Button
              intent="accent"
              icon="group_add"
              size="sm"
              onClick={() => setAddModalOpen(true)}
            >
              Add Players
            </Button>
          }
          loading={loading}
          emptyMessage="No players on this roster yet."
          noResultsMessage={(q) => `No players match "${q}".`}
        />
      </Card>

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
