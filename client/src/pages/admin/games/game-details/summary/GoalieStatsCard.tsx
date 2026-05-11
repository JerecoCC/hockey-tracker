import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import Card from '@/components/Card/Card';
import Tooltip from '@/components/Tooltip/Tooltip';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import GoalieStatsEditModal from '../GoalieStatsEditModal';
import type { GameRecord } from '@/hooks/useGames';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type { GoalieStatRecord, UpdateGoalieStintData } from '@/hooks/useGameGoalieStats';
import type { LineupEntry } from '@/hooks/useGameLineup';
import { formatPlayerName } from '../formatUtils';
import styles from './GoalieStatsCard.module.scss';

const PERIOD_LABEL: Record<string, string> = {
  '1': 'P1',
  '2': 'P2',
  '3': 'P3',
  OT: 'OT',
  SO: 'SO',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  goalieStats: GoalieStatRecord[];
  lineup: LineupEntry[];
  leagueId: string;
  isFinal: boolean;
  isInProgress?: boolean;
  onSwitchGoalie?: () => void;
  updateGoalieStint: (
    stintId: string,
    data: UpdateGoalieStintData,
  ) => Promise<GoalieStatRecord[] | null>;
  removeGoalieStint: (stintId: string) => Promise<boolean>;
  removeGoalieStat: (goalieId: string) => Promise<boolean>;
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
  isInProgress,
  onSwitchGoalie,
  updateGoalieStint,
  removeGoalieStint,
  removeGoalieStat,
}: Props) => {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const goalies = [...awayRoster, ...homeRoster].filter((e) => e.position === 'G');
  const goaliesWithStats = goalies.filter((g) =>
    goalieStats.some((gs) => gs.goalie_id === g.player_id),
  );

  return (
    <>
      <Card
        title="Goalie Stats"
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            {isInProgress && onSwitchGoalie && (
              <Button
                variant="outlined"
                intent="neutral"
                icon="swap_horiz"
                size="sm"
                tooltip="Switch Goalie"
                onClick={onSwitchGoalie}
              />
            )}
            {isFinal && (
              <Button
                variant="outlined"
                intent="neutral"
                icon="edit"
                size="sm"
                tooltip="Edit goalie stats"
                onClick={() => setEditOpen(true)}
              />
            )}
          </div>
        }
      >
        {goaliesWithStats.length === 0 ? (
          <p className={styles.empty}>No goalie stats recorded yet.</p>
        ) : (
          <table className={styles.goalieTable}>
            <thead>
              <tr>
                <th className={styles.goalieThTeam}></th>
                <th className={styles.goalieTh}>
                  <Tooltip text="Shots Against">SA</Tooltip>
                </th>
                <th className={styles.goalieTh}>
                  <Tooltip text="Saves">SV</Tooltip>
                </th>
                <th className={styles.goalieTh}>
                  <Tooltip text="Goals Against">GA</Tooltip>
                </th>
                <th className={styles.goalieTh}>
                  <Tooltip text="Save Percentage">SV%</Tooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {goaliesWithStats.map((goalie) => {
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
                const isBackup = !!stat.entered_period;
                const playerHref = `/admin/leagues/${leagueId}/teams/${goalie.team_id}/players/${goalie.player_id}`;
                return (
                  <tr
                    key={goalie.player_id}
                    className={styles.goalieRow}
                    onClick={() => navigate(playerHref)}
                  >
                    <td className={styles.goalieTdName}>
                      <span className={styles.goalieNameCell}>
                        <TeamLogo
                          logo={teamLogo}
                          code={teamCode ?? '?'}
                          primaryColor={primaryColor}
                          textColor={textColor}
                          size={36}
                          shape="square"
                        />
                        <PlayerAvatar
                          photo={goalie.photo}
                          initials={
                            `${goalie.first_name?.charAt(0) ?? ''}${goalie.last_name?.charAt(0) ?? ''}`.trim() ||
                            '?'
                          }
                          primaryColor={primaryColor}
                          textColor={textColor}
                          size={48}
                        />
                        <div className={styles.goalInfo}>
                          {goalie.jersey_number != null && (
                            <span className={styles.goalAssists}>#{goalie.jersey_number}</span>
                          )}
                          <span className={styles.goalScorer}>
                            {formatPlayerName(goalie.first_name, goalie.last_name)}
                          </span>
                          {isBackup && (
                            <span className={styles.goalAssists}>
                              entered {PERIOD_LABEL[stat.entered_period!] ?? stat.entered_period}
                              {stat.sub_time && ` @ ${stat.sub_time}`}
                            </span>
                          )}
                        </div>
                      </span>
                    </td>
                    <td className={styles.goalieTd}>{stat.shots_against}</td>
                    <td className={styles.goalieTd}>{stat.saves}</td>
                    <td className={styles.goalieTd}>{stat.goals_against}</td>
                    <td className={styles.goalieTd}>{svPct}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <GoalieStatsEditModal
        open={editOpen}
        game={game}
        awayRoster={awayRoster}
        homeRoster={homeRoster}
        goalieStats={goalieStats}
        onClose={() => setEditOpen(false)}
        updateGoalieStint={updateGoalieStint}
        removeGoalieStint={removeGoalieStint}
        removeGoalieStat={removeGoalieStat}
      />
    </>
  );
};

export default GoalieStatsCard;
