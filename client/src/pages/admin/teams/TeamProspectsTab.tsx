import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Icon from '@/components/Icon/Icon';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import SeasonSelect from '@/components/SeasonSelect/SeasonSelect';
import useSeasons from '@/hooks/useSeasons';
import useTeamPlayers, { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import { buildPlayerDetailsPath } from '@/lib/routeSlugs';
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

const PROSPECT_SECTIONS = [
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
  leagueCode: string | null;
  teamCode: string | null;
}

const TeamProspectsTab = ({ teamId, leagueId, leagueCode, teamCode }: Props) => {
  const navigate = useNavigate();
  const { seasons: leagueSeasons } = useSeasons(leagueId);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<TeamPlayerRecord | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const { players, loading, busy, updatePlayerRosterRole, removePlayerFromTeam } = useTeamPlayers(
    teamId,
    selectedSeasonId ?? undefined,
    { prospectsOnly: true },
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlayers = normalizedQuery
    ? players.filter((p) => {
        const name = `${p.first_name} ${p.last_name}`.toLowerCase();
        const jersey = p.jersey_number != null ? String(p.jersey_number) : '';
        return (
          name.includes(normalizedQuery) ||
          (p.position ?? '').toLowerCase().includes(normalizedQuery) ||
          jersey.startsWith(normalizedQuery.replace('#', ''))
        );
      })
    : players;

  const sortPlayers = (items: TeamPlayerRecord[]) =>
    [...items].sort((a, b) =>
      `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
    );

  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;
    setIsRemoving(true);
    const ok = await removePlayerFromTeam(confirmRemove);
    setIsRemoving(false);
    if (ok) setConfirmRemove(null);
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
      rightContent={{ type: 'tag', label: 'Prospect', intent: 'neutral' }}
      actions={
        [
          {
            icon: 'open_in_new',
            intent: 'neutral',
            tooltip: 'View player',
            onClick: () =>
              navigate(
                buildPlayerDetailsPath({
                  leagueCode,
                  teamCode,
                  firstName: p.first_name,
                  lastName: p.last_name,
                }),
              ),
          },
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
        ] satisfies ListItemAction[]
      }
    />
  );

  return (
    <>
      <Card
        title="Prospects"
        action={
          leagueSeasons.length > 0 ? (
            <SeasonSelect
              value={selectedSeasonId}
              seasons={leagueSeasons}
              onChange={setSelectedSeasonId}
            />
          ) : undefined
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
              placeholder="Search prospects..."
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
        {PROSPECT_SECTIONS.map((section) => {
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
                    ? 'No prospects for this season.'
                    : normalizedQuery
                      ? `No ${section.title.toLowerCase()} match "${query}".`
                      : `No ${section.title.toLowerCase()} prospects.`}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <ConfirmModal
        open={!!confirmRemove}
        title="Remove From Team"
        body={
          confirmRemove ? (
            <>
              Remove{' '}
              <strong>
                {confirmRemove.first_name} {confirmRemove.last_name}
              </strong>
              {' '}from this team for this season?
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Remove From Team"
        confirmIcon="person_remove"
        variant="danger"
        busy={isRemoving}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </>
  );
};

export default TeamProspectsTab;
