import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/Card/Card';
import Icon from '@/components/Icon/Icon';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import type { GameRecord } from '@/hooks/useGames';
import LastTeamGamesAccordion from './LastTeamGamesAccordion';
import styles from './LastFiveCard.module.scss';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  gameHrefBuilder: (gameId: string) => string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LastFiveCard({ game, gameHrefBuilder }: Props) {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'square'>('list');

  if (!game.home_last_five && !game.away_last_five) return null;

  const awayGames = game.away_last_five ?? [];
  const homeGames = game.home_last_five ?? [];

  const goToGame = (gameId: string) => navigate(gameHrefBuilder(gameId));

  return (
    <Card
      title="Last 5 Games"
      action={
        <SegmentedControl
          value={view}
          onChange={(value) => setView(value as 'list' | 'square')}
          className={styles.lastFiveViewToggle}
          options={[
            {
              value: 'list',
              label: <Icon name="view_list" />,
              tooltip: 'List view',
              ariaLabel: 'List view',
            },
            {
              value: 'square',
              label: <Icon name="grid_view" />,
              tooltip: 'Grid view',
              ariaLabel: 'Grid view',
            },
          ]}
        />
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
