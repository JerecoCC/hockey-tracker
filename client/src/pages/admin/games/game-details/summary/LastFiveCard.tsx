import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import type { GameRecord } from '@/hooks/useGames';
import LastTeamGamesAccordion from './LastTeamGamesAccordion';
import styles from './LastFiveCard.module.scss';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  leagueId: string;
  seasonId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LastFiveCard({ game, leagueId, seasonId }: Props) {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'square'>('list');

  if (!game.home_last_five && !game.away_last_five) return null;

  const awayGames = game.away_last_five ?? [];
  const homeGames = game.home_last_five ?? [];

  const goToGame = (gameId: string) =>
    navigate(`/admin/leagues/${leagueId}/seasons/${seasonId}/games/${gameId}`);

  return (
    <Card
      title="Last 5 Games"
      action={
        <div className={styles.lastFiveViewToggle}>
          <Button
            variant="ghost"
            intent={view === 'list' ? 'accent' : 'neutral'}
            icon="view_list"
            size="sm"
            tooltip="List view"
            onClick={() => setView('list')}
          />
          <Button
            variant="ghost"
            intent={view === 'square' ? 'accent' : 'neutral'}
            icon="grid_view"
            size="sm"
            tooltip="Grid view"
            onClick={() => setView('square')}
          />
        </div>
      }
    >
      <div className={styles.lastFiveList}>
        <div className={styles.lastFiveTeamCol}>
          <LastTeamGamesAccordion
            label={game.away_team.name}
            logo={game.away_team.logo}
            code={game.away_team.code}
            primary={game.away_team.primary_color}
            text={game.away_team.text_color}
            games={awayGames}
            view={view}
            onNavigate={goToGame}
          />
        </div>
        <div className={styles.lastFiveTeamCol}>
          <LastTeamGamesAccordion
            label={game.home_team.name}
            logo={game.home_team.logo}
            code={game.home_team.code}
            primary={game.home_team.primary_color}
            text={game.home_team.text_color}
            games={homeGames}
            view={view}
            onNavigate={goToGame}
          />
        </div>
      </div>
    </Card>
  );
}
