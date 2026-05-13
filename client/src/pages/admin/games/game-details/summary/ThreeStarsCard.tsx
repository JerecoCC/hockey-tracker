import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import type { GameRecord } from '@/hooks/useGames';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type { GoalieStatRecord } from '@/hooks/useGameGoalieStats';
import StarCard from './StarCard';
import styles from './ThreeStarsCard.module.scss';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  roster: GameRosterEntry[];
  goalieStats: GoalieStatRecord[];
  playerGameStats: Map<string, { goals: number; assists: number }>;
  leagueId: string;
  onEdit?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ThreeStarsCard = ({
  game,
  roster,
  goalieStats,
  playerGameStats,
  leagueId,
  onEdit,
}: Props) => {
  const starDefs = [
    { starCount: 1, playerId: game.star_1_id! },
    { starCount: 2, playerId: game.star_2_id! },
    { starCount: 3, playerId: game.star_3_id! },
  ];

  return (
    <Card
      title="Three Stars"
      action={
        onEdit ? (
          <Button
            variant="outlined"
            intent="neutral"
            icon="edit"
            size="sm"
            tooltip="Edit three stars"
            onClick={onEdit}
          />
        ) : undefined
      }
    >
      <div className={styles.starsRow}>
        {starDefs.map(({ starCount, playerId }) => {
          const player = roster.find((e) => e.player_id === playerId);
          if (!player) return null;

          const isAway = player.team_id === game.away_team.id;
          const team = isAway ? game.away_team : game.home_team;
          const stats = playerGameStats.get(playerId) ?? { goals: 0, assists: 0 };
          const goalieStatRecord = goalieStats.find((s) => s.goalie_id === playerId) ?? null;

          return (
            <StarCard
              key={starCount}
              starCount={starCount}
              player={player}
              leagueId={leagueId}
              primaryColor={team.primary_color}
              textColor={team.text_color}
              teamCode={team.code}
              teamLogo={team.logo}
              teamName={team.name}
              stats={stats}
              goalieStatRecord={goalieStatRecord}
            />
          );
        })}
      </div>
    </Card>
  );
};

export default ThreeStarsCard;
