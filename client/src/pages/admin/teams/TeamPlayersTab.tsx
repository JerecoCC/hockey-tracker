import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '@jerecocc/tracker-ui/components/Badge/Badge';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import ConfirmModal from '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import ListItem, { type ListItemAction } from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import MoreActionsMenu from '@jerecocc/tracker-ui/components/MoreActionsMenu/MoreActionsMenu';
import PlayerAvatar from '@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar';
import { SearchInput } from '@jerecocc/tracker-ui';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import SegmentedControl from '@jerecocc/tracker-ui/components/SegmentedControl/SegmentedControl';
import SeasonSelect from '@/shared/SeasonSelect/SeasonSelect';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import useSeasons from '@/hooks/useSeasons';
import useTeamPlayers, { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import { formatPlayerPosition } from '@/lib/playerPosition';
import { normalizePlayerSearchText, playerSearchTextIncludes } from '@/lib/playerSearch';
import { getPlayerStatus } from '@/lib/playerStatus';
import { buildPlayerDetailsPath, buildUserPlayerDetailsPath } from '@/lib/routeSlugs';
import LineupCreatePlayersModal from '../games/game-details/lineups/LineupCreatePlayersModal';
import AddPlayersModal from './AddPlayersModal';
import BulkTradeModal from './BulkTradeModal';
import TeamPlayerEditModal from './TeamPlayerEditModal';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import styles from './TeamDetails.module.scss';

const FORWARD_ADD_PLAYER_POSITIONS = ['C', 'LW', 'RW', 'L', 'R', 'F'] as const;
const DEFENSE_POSITIONS = new Set(['D', 'LD', 'RD']);
const GOALIE_POSITIONS = new Set(['G']);
const PLAYER_SECTION_SKELETON_ROW_COUNT = 3;

const PLAYER_SECTIONS = [
  {
    title: 'Forwards',
    addPlayerPositions: FORWARD_ADD_PLAYER_POSITIONS,
    matches: (p: TeamPlayerRecord) => {
      const position = (p.position ?? '').toUpperCase();
      return !GOALIE_POSITIONS.has(position) && !DEFENSE_POSITIONS.has(position);
    },
  },
  {
    title: 'Defense',
    addPlayerPositions: ['D', 'LD', 'RD'],
    matches: (p: TeamPlayerRecord) => DEFENSE_POSITIONS.has((p.position ?? '').toUpperCase()),
  },
  {
    title: 'Goalies',
    addPlayerPositions: ['G'],
    matches: (p: TeamPlayerRecord) => GOALIE_POSITIONS.has((p.position ?? '').toUpperCase()),
  },
];

type PlayerSection = (typeof PLAYER_SECTIONS)[number];

type PlayerView = 'roster' | 'prospects';

interface Props {
  teamId: string;
  teamName: string;
  leagueId: string;
  leagueCode: string | null;
  teamCode: string | null;
  defaultSeasonId?: string | null;
  readOnly?: boolean;
  mode?: 'admin' | 'user';
}

const TeamPlayersTab = ({
  teamId,
  teamName,
  leagueId,
  leagueCode,
  teamCode,
  defaultSeasonId,
  readOnly = false,
  mode = 'admin',
}: Props) => {
  const navigate = useNavigate();
  const { seasons: leagueSeasons } = useSeasons(leagueId, { mode });
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(defaultSeasonId ?? null);
  const [playerView, setPlayerView] = useState<PlayerView>('roster');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!selectedSeasonId && defaultSeasonId) setSelectedSeasonId(defaultSeasonId);
  }, [defaultSeasonId, selectedSeasonId]);

  const isProspectsView = playerView === 'prospects';
  const {
    players,
    loading,
    busy,
    addPlayersToRoster,
    updatePlayer,
    updatePlayerTeam,
    updatePlayerRosterRole,
    removePlayerFromTeam,
    uploadPlayerPhoto,
    createAndRosterPlayers,
    bulkTradePlayers,
  } = useTeamPlayers(teamId, selectedSeasonId ?? undefined, {
    mode,
    prospectsOnly: isProspectsView,
  });
  const { players: allTeamPlayers } = useTeamPlayers(teamId, selectedSeasonId ?? undefined, {
    mode,
    includeProspects: true,
  });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalSection, setAddModalSection] = useState<PlayerSection | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamPlayerRecord | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<TeamPlayerRecord | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const rosterPlayers = allTeamPlayers.filter((p) => !p.is_prospect);
  const existingPlayerIds = new Set(allTeamPlayers.map((p) => p.id));
  const rosterPlayerCount = rosterPlayers.length;
  const rosterGoalieCount = rosterPlayers.filter((p) => p.position === 'G').length;
  const normalizedQuery = normalizePlayerSearchText(query);
  const filteredPlayers = normalizedQuery
    ? players.filter((p) => {
        const name = `${p.first_name} ${p.last_name}`;
        const jersey = p.jersey_number != null ? String(p.jersey_number) : '';
        return (
          playerSearchTextIncludes(name, normalizedQuery) ||
          playerSearchTextIncludes(p.position, normalizedQuery) ||
          jersey.startsWith(normalizedQuery.replace('#', ''))
        );
      })
    : players;

  const sortPlayers = (items: TeamPlayerRecord[]) =>
    [...items].sort((a, b) => {
      if (isProspectsView) {
        return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
      }
      if (a.jersey_number == null && b.jersey_number == null) {
        return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
      }
      if (a.jersey_number == null) return 1;
      if (b.jersey_number == null) return -1;
      return a.jersey_number - b.jersey_number;
    });

  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;
    setIsRemoving(true);
    const ok = await removePlayerFromTeam(confirmRemove);
    setIsRemoving(false);
    if (ok) setConfirmRemove(null);
  };

  const openAddPlayersModal = (section: PlayerSection | null = null) => {
    setAddModalSection(section);
    setAddModalOpen(true);
  };

  const closeAddPlayersModal = () => {
    setAddModalOpen(false);
    setAddModalSection(null);
  };

  const renderPlayer = (p: TeamPlayerRecord) => {
    const playerName = `${p.first_name} ${p.last_name}`;
    const status = getPlayerStatus(p);
    const playerDetailsPath =
      mode === 'user'
        ? buildUserPlayerDetailsPath({
            leagueCode,
            teamCode,
            firstName: p.first_name,
            lastName: p.last_name,
            jerseyNumber: p.jersey_number,
          })
        : buildPlayerDetailsPath({
            leagueCode,
            teamCode,
            firstName: p.first_name,
            lastName: p.last_name,
            jerseyNumber: p.jersey_number,
          });
    const actions: ListItemAction[] = [];

    if (!readOnly) {
      if (isProspectsView) {
        actions.push(
          {
            icon: 'north',
            intent: 'neutral',
            tooltip: 'Move to roster',
            disabled: busy === p.id,
            onClick: () => updatePlayerRosterRole(p, false),
          },
          {
            icon: 'person_remove',
            intent: 'danger',
            tooltip: 'Remove From Team',
            disabled: busy === p.id,
            onClick: () => setConfirmRemove(p),
          },
        );
      } else {
        actions.push(
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
            icon: 'person_remove',
            intent: 'danger',
            tooltip: 'Remove From Team',
            disabled: busy === p.id,
            onClick: () => setConfirmRemove(p),
          },
        );
      }
    }

    return (
      <ListItem
        key={p.id}
        fullWidth
        imageNode={
          <PlayerAvatar
            photo={p.photo}
            initials={
              `${p.first_name?.charAt(0) ?? ''}${p.last_name?.charAt(0) ?? ''}`.trim() || '?'
            }
            primaryColor={p.primary_color}
            textColor={p.text_color}
            size={48}
          />
        }
        name={playerName}
        placeholder={`${p.first_name[0]}${p.last_name[0]}`}
        primaryColor={p.primary_color ?? undefined}
        textColor={p.text_color ?? undefined}
        chip={{ label: p.jersey_number ?? '-' }}
        subtitle={formatPlayerPosition(p.position) ?? undefined}
        rightContent={
          isProspectsView
            ? { type: 'tag', label: 'Prospect', intent: 'neutral' }
            : {
                type: 'tag',
                label:
                  status === 'active' ? 'Active' : status === 'retired' ? 'Retired' : 'Inactive',
                intent: status === 'active' ? 'success' : 'neutral',
              }
        }
        onClick={() => navigate(playerDetailsPath)}
        ariaLabel={`Open ${playerName}`}
        actions={actions}
      />
    );
  };

  const renderPlayerSkeletons = (sectionTitle: string) => (
    <ResponsiveList
      className={[styles.rosterList, styles.listSkeletonList].join(' ')}
      aria-label={`${sectionTitle} loading`}
    >
      {Array.from({ length: PLAYER_SECTION_SKELETON_ROW_COUNT }, (_, index) => (
        <Skeleton
          as="li"
          key={`${sectionTitle}-skeleton-${index}`}
          variant="card"
          className={styles.listSkeletonRow}
        />
      ))}
    </ResponsiveList>
  );

  const playerViewControl = (
    <SegmentedControl
      className={styles.playerViewSegmentedControl}
      variant="field"
      value={playerView}
      onChange={(value) => setPlayerView(value as PlayerView)}
      options={[
        { value: 'roster', label: 'Roster' },
        { value: 'prospects', label: 'Prospects' },
      ]}
    />
  );

  const rosterActions = readOnly ? null : (
    <div className={styles.rosterActions}>
      <Button
        intent="accent"
        icon="group_add"
        disabled={!selectedSeasonId}
        onClick={() => openAddPlayersModal()}
      >
        Add Players
      </Button>
      <MoreActionsMenu
        items={[
          {
            label: 'Create Players',
            icon: 'person_edit',
            disabled: !selectedSeasonId,
            onClick: () => setCreateModalOpen(true),
          },
          {
            label: 'Move Players',
            icon: 'swap_horiz',
            disabled: !selectedSeasonId || players.length === 0,
            onClick: () => setTradeModalOpen(true),
          },
        ]}
      />
    </div>
  );

  return (
    <>
      <Section
        title="Players"
        titleAccessory={
          leagueSeasons.length > 0 ? (
            <div className={styles.playerHeaderSeasonGroup}>
              <Divider orientation="vertical" />
              <div className={styles.playerSeasonSelect}>
                <SeasonSelect
                  value={selectedSeasonId}
                  seasons={leagueSeasons}
                  onChange={setSelectedSeasonId}
                  defaultSeasonMode="latest-ended"
                  width="content"
                />
              </div>
            </div>
          ) : null
        }
        action={playerViewControl}
      >
        <div className={styles.rosterToolbar}>
          <SearchInput
            className={styles.rosterSearch}
            placeholder={isProspectsView ? 'Search prospects...' : 'Search players...'}
            value={query}
            onChange={setQuery}
          />
          {rosterActions}
        </div>
      </Section>

      <div className={styles.rosterSections}>
        {PLAYER_SECTIONS.map((section) => {
          const sectionPlayers = sortPlayers(filteredPlayers.filter(section.matches));
          return (
            <Section
              key={section.title}
              title={section.title}
              titleAccessory={
                <Badge
                  value={sectionPlayers.length}
                  aria-label={`${section.title} count`}
                />
              }
              action={
                readOnly ? null : (
                  <Button
                    variant="outlined"
                    intent="accent"
                    icon="group_add"
                    size="medium"
                    tooltip={`Add ${section.title}`}
                    aria-label={`Add ${section.title}`}
                    disabled={!selectedSeasonId}
                    onClick={() => openAddPlayersModal(section)}
                  />
                )
              }
            >
              {loading ? (
                renderPlayerSkeletons(section.title)
              ) : sectionPlayers.length > 0 ? (
                <ResponsiveList className={styles.rosterList}>
                  {sectionPlayers.map(renderPlayer)}
                </ResponsiveList>
              ) : (
                <p className={styles.rosterEmpty}>
                  {players.length === 0
                    ? isProspectsView
                      ? 'No prospects for this season.'
                      : 'No players on this roster yet.'
                    : normalizedQuery
                      ? `No ${section.title.toLowerCase()} match "${query}".`
                      : isProspectsView
                        ? `No ${section.title.toLowerCase()} prospects.`
                        : `No ${section.title.toLowerCase()} on this roster.`}
                </p>
              )}
            </Section>
          );
        })}
      </div>

      {!readOnly && (
        <>
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
            onClose={closeAddPlayersModal}
            teamId={teamId}
            leagueId={leagueId}
            seasonId={selectedSeasonId}
            existingPlayerIds={existingPlayerIds}
            positionFilter={addModalSection?.addPlayerPositions}
            positionFilterLabel={addModalSection?.title}
            addPlayersToRoster={addPlayersToRoster}
          />

          {selectedSeasonId && (
            <LineupCreatePlayersModal
              open={createModalOpen}
              onClose={() => setCreateModalOpen(false)}
              teamId={teamId}
              leagueId={leagueId}
              seasonId={selectedSeasonId}
              teamName={teamName}
              existingCount={rosterPlayerCount}
              existingGoalieCount={rosterGoalieCount}
              existingRoster={allTeamPlayers.map((p) => ({
                first_name: p.first_name,
                last_name: p.last_name,
                jersey_number: p.jersey_number ?? null,
              }))}
              allowRosterOverflow
              createAndRosterPlayers={createAndRosterPlayers}
            />
          )}

          <ConfirmModal
            open={!!confirmRemove}
            title="Remove From Team"
            body={
              confirmRemove ? (
                <>
                  Remove{' '}
                  <strong>
                    {confirmRemove.first_name} {confirmRemove.last_name}
                  </strong>{' '}
                  from {teamName} for this season?
                </>
              ) : (
                ''
              )
            }
            confirmLabel="Remove From Team"
            confirmIcon="person_remove"
            intent="danger"
            busy={isRemoving}
            onConfirm={handleConfirmRemove}
            onCancel={() => setConfirmRemove(null)}
          />
        </>
      )}
    </>
  );
};

export default TeamPlayersTab;
