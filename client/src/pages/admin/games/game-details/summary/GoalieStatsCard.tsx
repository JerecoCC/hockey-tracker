import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import GoalieStatsEditModal from '../GoalieStatsEditModal';
import type { GameRecord } from '@/hooks/useGames';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type { GoalieStatRecord, UpsertGoalieStatData } from '@/hooks/useGameGoalieStats';
import type { LineupEntry } from '@/hooks/useGameLineup';
import { formatPlayerName } from '../formatUtils';
import styles from './GoalieStatsCard.module.scss';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  goalieStats: GoalieStatRecord[];
  lineup: LineupEntry[];
  leagueId: string;
  isFinal: boolean;
  upsertGoalieStat: (data: UpsertGoalieStatData) => Promise<GoalieStatRecord | null>;
}

// ── Component ─────────────────────────────────────────────────────────────────

const GoalieStatsCard = ({
  game,
  awayRoster,
  homeRoster,
  goalieStats,
  lineup,
  leagueId,
  isFinal,
  upsertGoalieStat,
}: Props) => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const goalies = [...awayRoster, ...homeRoster].filter((e) => e.position === 'G');
  const goaliesWithStats = goalies.filter((g) =>
    goalieStats.some((gs) => gs.goalie_id === g.player_id),
  );

  if (goaliesWithStats.length === 0) return null;

  return (
    <>
      <Card
        title="Goalie Stats"
        action={
          isFinal ? (
            <Button
              variant="outlined"
              intent="neutral"
              icon="edit"
              size="sm"
              tooltip="Edit goalie stats"
              onClick={() => setModalOpen(true)}
            />
          ) : undefined
        }
      >
        <table className={styles.goalieTable}>
          <thead>
            <tr>
              <th className={styles.goalieThTeam}></th>
              <th className={styles.goalieTh}>SA</th>
              <th className={styles.goalieTh}>SV</th>
              <th className={styles.goalieTh}>SV%</th>
            </tr>
          </thead>
          <tbody>
            {goalies.map((goalie) => {
              const stat = goalieStats.find((gs) => gs.goalie_id === goalie.player_id);
              if (!stat) return null;
              const isAway = goalie.team_id === game.away_team.id;
              const primaryColor = isAway
                ? game.away_team.primary_color
                : game.home_team.primary_color;
              const textColor = isAway ? game.away_team.text_color : game.home_team.text_color;
              const teamLogo = isAway ? game.away_team.logo : game.home_team.logo;
              const teamCode = isAway ? game.away_team.code : game.home_team.code;
              const svPct =
                stat.shots_against > 0
                  ? (stat.saves / stat.shots_against).toFixed(3).replace(/^0/, '')
                  : '1.000';
              const playerHref = `/admin/leagues/${leagueId}/teams/${goalie.team_id}/players/${goalie.player_id}`;
              return (
                <tr
                  key={goalie.player_id}
                  className={styles.goalieRow}
                  onClick={() => navigate(playerHref)}
                >
                  <td className={styles.goalieTdName}>
                    <span className={styles.goalieNameCell}>
                      {teamLogo ? (
                        <img
                          src={teamLogo}
                          alt={teamCode}
                          className={styles.goalTeamLogo}
                        />
                      ) : (
                        <span
                          className={styles.goalTeamLogoPlaceholder}
                          style={{ background: primaryColor, color: textColor }}
                        >
                          {teamCode?.slice(0, 1)}
                        </span>
                      )}
                      {goalie.photo ? (
                        <img
                          src={goalie.photo}
                          alt=""
                          className={styles.goalScorerPhoto}
                        />
                      ) : (
                        <span
                          className={styles.goalScorerPhotoPlaceholder}
                          style={{ background: primaryColor, color: textColor }}
                        >
                          {goalie.last_name?.charAt(0)}
                        </span>
                      )}
                      <div className={styles.goalInfo}>
                        {goalie.jersey_number != null && (
                          <span className={styles.goalAssists}>#{goalie.jersey_number}</span>
                        )}
                        <span className={styles.goalScorer}>
                          {formatPlayerName(goalie.first_name, goalie.last_name)}
                        </span>
                      </div>
                    </span>
                  </td>
                  <td className={styles.goalieTd}>{stat.shots_against}</td>
                  <td className={styles.goalieTd}>{stat.saves}</td>
                  <td className={styles.goalieTd}>{svPct}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <GoalieStatsEditModal
        open={modalOpen}
        game={game}
        awayRoster={awayRoster}
        homeRoster={homeRoster}
        goalieStats={goalieStats}
        lineup={lineup}
        onClose={() => setModalOpen(false)}
        upsertGoalieStat={async (data) => {
          await upsertGoalieStat(data);
        }}
      />
    </>
  );
};

export default GoalieStatsCard;
