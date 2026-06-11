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
import type {
  GoalieSwitchData,
  GoalieStatRecord,
  GoalieStintRecord,
  UpdateGoalieStintData,
} from '@/hooks/useGameGoalieStats';
import type { LineupEntry } from '@/hooks/useGameLineup';
import { formatPlayerName } from '../formatUtils';
import styles from './GoalieStatsCard.module.scss';
import { playerDataComplete } from '../gameUtils';
import { PERIOD } from '../constants';
import {
  compareGoalieStats,
  gameHasGoalieSwitch,
  goalieStatIsStarter,
} from '../goalieStatsOrdering';

const PERIOD_LABEL: Record<string, string> = {
  [PERIOD.FIRST]: 'P1',
  [PERIOD.SECOND]: 'P2',
  [PERIOD.THIRD]: 'P3',
  [PERIOD.OVERTIME]: PERIOD.OVERTIME,
  [PERIOD.SHOOTOUT]: PERIOD.SHOOTOUT,
};

const isGameStart = (period: string | null | undefined, time: string | null | undefined) =>
  period === PERIOD.FIRST && (!time || time === '00:00');

const fmtStintPoint = (period: string, time: string | null) => {
  const periodLabel = PERIOD_LABEL[period] ?? period;
  const timeLabel = isGameStart(period, time) ? '00:00' : time;
  return timeLabel ? `${periodLabel} ${timeLabel}` : periodLabel;
};

/** Format a single stint's entry→exit window for display. */
const fmtStintWindow = (stint: GoalieStintRecord) => {
  const enter = fmtStintPoint(stint.entered_period, stint.entered_time);
  const exit = stint.exited_period
    ? fmtStintPoint(stint.exited_period, stint.exited_time)
    : 'end of game';
  return `${enter} \u2192 ${exit}`;
};

/**
 * Returns the stint-window lines to show under a goalie's name:
 * - Single uninterrupted game-start stint -> nothing.
 * - Any switch stint -> one "Px time -> Py time/end of game" line.
 * - Multiple stints -> one line per stint.
 * Falls back to the legacy entered_period / sub_time fields for old data that
 * has no stints array.
 */
const stintLabels = (stat: GoalieStatRecord): string[] => {
  if (stat.stints && stat.stints.length > 0) {
    // Pure game-start starter with one uninterrupted stint: nothing to annotate.
    const onlyStint = stat.stints[0];
    if (
      stat.stints.length === 1 &&
      isGameStart(onlyStint.entered_period, onlyStint.entered_time) &&
      !onlyStint.exited_period
    ) {
      return [];
    }
    return stat.stints.map(fmtStintWindow);
  }
  // Legacy fallback: no stints data, use the top-level entered_period / sub_time
  if (stat.entered_period) {
    if (isGameStart(stat.entered_period, stat.sub_time)) return [];
    return [`${fmtStintPoint(stat.entered_period, stat.sub_time)} → end of game`];
  }
  return [];
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  goalieStats: GoalieStatRecord[];
  lineup: LineupEntry[];
  getPlayerHref?: (
    teamId: string,
    playerId: string,
    firstName: string | null | undefined,
    lastName: string | null | undefined,
  ) => string;
  isFinal: boolean;
  isInProgress?: boolean;
  onSwitchGoalie?: () => void;
  updateGoalieStint?: (
    stintId: string,
    data: UpdateGoalieStintData,
  ) => Promise<GoalieStatRecord[] | null>;
  addGoalieStint?: (data: GoalieSwitchData) => Promise<GoalieStatRecord[] | null>;
  removeGoalieStint?: (stintId: string) => Promise<boolean>;
  removeGoalieStat?: (goalieId: string) => Promise<boolean>;
  showPlayerDataStatus?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

const GoalieStatsCard = ({
  game,
  awayRoster,
  homeRoster,
  goalieStats,
  getPlayerHref,
  isFinal,
  isInProgress,
  onSwitchGoalie,
  updateGoalieStint,
  addGoalieStint,
  removeGoalieStint,
  removeGoalieStat,
  showPlayerDataStatus = false,
}: Props) => {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const canEdit = !!updateGoalieStint && !!addGoalieStint && !!removeGoalieStint && !!removeGoalieStat;

  const goalies = [...awayRoster, ...homeRoster].filter((e) => e.position === 'G');
  const goaliesWithStats = goalies
    .filter((g) => goalieStats.some((gs) => gs.goalie_id === g.player_id))
    .sort((a, b) => {
      const aStat = goalieStats.find((gs) => gs.goalie_id === a.player_id);
      const bStat = goalieStats.find((gs) => gs.goalie_id === b.player_id);
      if (!aStat || !bStat) return 0;
      return compareGoalieStats(aStat, a, bStat, b, game.away_team.id);
    });
  const gameSwitchedGoalies = gameHasGoalieSwitch(goalieStats);

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
            {isFinal && canEdit && (
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
                const hasNoRecordedStats =
                  stat.shots_against === 0 && stat.saves === 0 && stat.goals_against === 0;
                const svPct = hasNoRecordedStats
                  ? '--'
                  : stat.shots_against > 0
                    ? (stat.saves / stat.shots_against).toFixed(3).replace(/^0/, '')
                    : '1.000';
                const windows = stintLabels(stat);
                const isStarter = goalieStatIsStarter(stat);
                const playerHref = getPlayerHref?.(
                  goalie.team_id,
                  goalie.player_id,
                  goalie.first_name,
                  goalie.last_name,
                );
                return (
                  <tr
                    key={goalie.player_id}
                    className={`${styles.goalieRow} ${
                      isStarter && gameSwitchedGoalies ? styles.goalieRowStarterSwitch : ''
                    }`}
                    onClick={playerHref ? () => navigate(playerHref) : undefined}
                  >
                    <td className={styles.goalieTdName}>
                      <span className={styles.goalieNameCell}>
                        <TeamLogo
                          logo={teamLogo}
                          code={teamCode ?? '?'}
                          primaryColor={primaryColor}
                          textColor={textColor}
                          size={30}
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
                            {playerDataComplete(
                              goalie.date_of_birth,
                              goalie.start_date,
                              goalie.acquisition_type,
                              showPlayerDataStatus,
                            )}
                          </span>
                          {windows.map((w, i) => (
                            <span
                              key={i}
                              className={styles.goalAssists}
                            >
                              {w}
                            </span>
                          ))}
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

      {canEdit && (
        <GoalieStatsEditModal
          open={editOpen}
          game={game}
          awayRoster={awayRoster}
          homeRoster={homeRoster}
          goalieStats={goalieStats}
          onClose={() => setEditOpen(false)}
          updateGoalieStint={updateGoalieStint}
          addGoalieStint={addGoalieStint}
          removeGoalieStint={removeGoalieStint}
          removeGoalieStat={removeGoalieStat}
        />
      )}
    </>
  );
};

export default GoalieStatsCard;
