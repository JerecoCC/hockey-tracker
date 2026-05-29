import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/Card/Card';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import SearchableList from '@/components/SearchableList/SearchableList';
import Select from '@/components/Select/Select';
import useSeasons from '@/hooks/useSeasons';
import useTeamPlayers from '@/hooks/useTeamPlayers';
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

const TeamProspectsTab = ({ teamId, leagueId, latestSeasonId }: Props) => {
  const navigate = useNavigate();
  const { seasons: leagueSeasons } = useSeasons(leagueId);
  const currentSeason = leagueSeasons.find((s) => s.is_current);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedSeasonId === null && leagueSeasons.length > 0) {
      setSelectedSeasonId(currentSeason?.id ?? leagueSeasons[0]?.id ?? latestSeasonId);
    }
  }, [currentSeason?.id, latestSeasonId, leagueSeasons.length, selectedSeasonId]);

  const { players, loading, busy, updatePlayerRosterRole } = useTeamPlayers(
    teamId,
    selectedSeasonId ?? undefined,
    { prospectsOnly: true },
  );

  return (
    <Card
      title="Prospects"
      action={
        leagueSeasons.length > 0 ? (
          <Select
            value={selectedSeasonId}
            options={leagueSeasons.map((s) => ({
              value: s.id,
              label: s.is_current ? `${s.name} *` : s.name,
            }))}
            onChange={setSelectedSeasonId}
          />
        ) : undefined
      }
    >
      <SearchableList
        items={players}
        filterFn={(p, q) => {
          const query = q.toLowerCase();
          const name = `${p.first_name} ${p.last_name}`.toLowerCase();
          const jersey = p.jersey_number != null ? String(p.jersey_number) : '';
          return (
            name.includes(query) ||
            (p.position ?? '').toLowerCase().includes(query) ||
            jersey.startsWith(query.replace('#', ''))
          );
        }}
        renderItems={(filtered) => (
          <ul className={styles.rosterList}>
            {[...filtered]
              .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`))
              .map((p) => (
                <ListItem
                  key={p.id}
                  image={p.photo}
                  image_shape="circle"
                  name={`${p.jersey_number != null ? `#${p.jersey_number} ` : ''}${p.first_name} ${p.last_name}`}
                  placeholder={`${p.first_name[0]}${p.last_name[0]}`}
                  primaryColor={p.primary_color ?? undefined}
                  textColor={p.text_color ?? undefined}
                  subtitle={p.position ? (POSITION_LABELS[p.position] ?? p.position) : undefined}
                  rightContent={{ type: 'tag', label: 'Prospect', intent: 'neutral' }}
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
                        icon: 'north',
                        intent: 'neutral',
                        tooltip: 'Move to roster',
                        disabled: busy === p.id,
                        onClick: () => updatePlayerRosterRole(p, false),
                      },
                    ] satisfies ListItemAction[]
                  }
                />
              ))}
          </ul>
        )}
        placeholder="Search prospects..."
        loading={loading}
        emptyMessage="No prospects for this season."
        noResultsMessage={(q) => `No prospects match "${q}".`}
      />
    </Card>
  );
};

export default TeamProspectsTab;
