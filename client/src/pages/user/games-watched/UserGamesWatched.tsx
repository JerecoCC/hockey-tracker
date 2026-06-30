import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import ListItem from '@/components/ListItem/ListItem';
import Section from '@/components/Section/Section';
import Select, { type SelectOption } from '@/components/Select/Select';
import useFavoriteTeams from '@/hooks/useFavoriteTeams';
import type { GameRecord } from '@/hooks/useGames';
import { getWatchedTeamSummaries, getWatchedYears, type TeamWatchSummary } from '@/lib/watchedTeams';
import styles from './UserGamesWatched.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const ALL_YEARS = 'all';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const WatchedTeamItem = ({ summary }: { summary: TeamWatchSummary }) => {
  const { team, count } = summary;

  return (
    <ListItem
      image={team.logo}
      imageDark={team.logo_dark}
      imageLight={team.logo_light}
      eyebrow={team.place_name || undefined}
      name={team.team_name || team.name}
      rightContent={
        <span
          className={styles.watchCount}
          aria-label={`${count} watched ${count === 1 ? 'game' : 'games'}`}
        >
          <strong>{count}</strong>
          <span>{count === 1 ? 'game' : 'games'}</span>
        </span>
      }
      primaryColor={team.primary_color}
      textColor={team.text_color}
    />
  );
};

const UserGamesWatched = () => {
  const { favorites } = useFavoriteTeams();
  const [selectedYear, setSelectedYear] = useState(ALL_YEARS);

  const { data: watchedGames = [], isLoading } = useQuery<GameRecord[]>({
    queryKey: ['user-games-watched'],
    queryFn: async () => {
      const { data } = await axios.get<GameRecord[]>(`${API}/user/games`, {
        headers: authHeaders(),
        params: { watched: true },
      });
      return data;
    },
  });

  const years = useMemo(
    () => getWatchedYears(watchedGames, favorites),
    [favorites, watchedGames],
  );
  const yearOptions = useMemo<SelectOption[]>(
    () => [
      { value: ALL_YEARS, label: 'All' },
      ...years.map((year) => ({ value: year, label: year })),
    ],
    [years],
  );
  const summaries = useMemo(
    () => getWatchedTeamSummaries(watchedGames, favorites, selectedYear),
    [favorites, selectedYear, watchedGames],
  );

  useEffect(() => {
    if (selectedYear !== ALL_YEARS && !years.includes(selectedYear)) {
      setSelectedYear(ALL_YEARS);
    }
  }, [selectedYear, years]);

  return (
    <div className={styles.page}>
      <Section
        title="Games Watched"
        action={
          <div className={styles.yearFilter}>
            <span className={styles.yearLabel}>Year</span>
            <Select
              value={selectedYear}
              options={yearOptions}
              onChange={setSelectedYear}
              width="content"
            />
          </div>
        }
      >
        {isLoading ? (
          <p className={styles.empty}>Loading...</p>
        ) : summaries.length === 0 ? (
          <p className={styles.empty}>No watched games yet.</p>
        ) : (
          <ul className={styles.watchList}>
            {summaries.map((summary) => (
              <WatchedTeamItem
                key={summary.team.id}
                summary={summary}
              />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
};

export default UserGamesWatched;
