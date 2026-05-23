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
  GoalieStatRecord,
  GoalieStintRecord,
  UpdateGoalieStintData,
} from '@/hooks/useGameGoalieStats';
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

/** Format a single stint's entry→exit window for display. */
const fmtStintWindow = (stint: GoalieStintRecord) => {
  const label = (p: string, t: string | null) => `${PERIOD_LABEL[p] ?? p}${t ? ` ${t}` : ''}`;
  const enter = label(stint.entered_period, stint.entered_time);
  const exit = stint.exited_period ? label(stint.exited_period, stint.exited_time) : null;
  return exit ? `${enter} → ${exit}` : enter;
};

/**
 * Returns the stint-window lines to show under a goalie's name:
 * - Single game-start stint (P1, no entered_time) → nothing (starter, no extra info needed)
 * - Single mid-game stint → one "Px @ time → Py" line (backup)
 * - Multiple stints → one line per stint (starter who re-entered, etc.)
 * Falls back to the legacy entered_period / sub_time fields for old data that
 * has no stints array.
 */
const stintLabels = (stat: GoalieStatRecord): string[] => {
  if (stat.stints && stat.stints.length > 0) {
    // Pure game-start starter with one uninterrupted stint — nothing to annotate
    if (
      stat.stints.length === 1 &&
      stat.stints[0].entered_period === '1' &&
      !stat.stints[0].entered_time
    ) {
      return [];
    }
    return stat.stints.map(fmtStintWindow);
  }
  // Legacy fallback: no stints data, use the top-level entered_period / sub_time
  if (stat.entered_period) {
    const p = PERIOD_LABEL[stat.entered_period] ?? stat.entered_period;
    return [`entered ${p}${stat.sub_time ? ` @ ${stat.sub_time}` : ''}`];
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
  getPlayerHref?: (teamId: string, playerId: string) => string;
  isFinal: boolean;
  isInProgress?: boolean;
  onSwitchGoalie?: () => void;
  updateGoalieStint?: (
    stintId: string,
    data: UpdateGoalieStintData,
  ) => Promise<GoalieStatRecord[] | null>;
  removeGoalieStint?: (stintId: string) => Promise<boolean>;
  removeGoalieStat?: (goalieId: string) => Promise<boolean>;
}

// ── Component ─────────────────────────────────────────────────────────────────

const GoalieStatsCard = ({
  game,
  awayRoster,
  homeRoster,
  goalieStats,
  lineup,
  getPlayerHref,
  isFinal,
  isInProgress,
  onSwitchGoalie,
  updateGoalieStint,
  removeGoalieStint,
  removeGoalieStat,
}: Props) => {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const canEdit = !!updateGoalieStint && !!removeGoalieStint && !!removeGoalieStat;

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
                const svPct =
                  stat.shots_against > 0
                    ? (stat.saves / stat.shots_against).toFixed(3).replace(/^0/, '')
                    : '1.000';
                const windows = stintLabels(stat);
                const playerHref = getPlayerHref?.(goalie.team_id, goalie.player_id);
                return (
                  <tr
                    key={goalie.player_id}
                    className={styles.goalieRow}
                    onClick={playerHref ? () => navigate(playerHref) : undefined}
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
          removeGoalieStint={removeGoalieStint}
          removeGoalieStat={removeGoalieStat}
        />
      )}
    </>
  );
};

export default GoalieStatsCard;
