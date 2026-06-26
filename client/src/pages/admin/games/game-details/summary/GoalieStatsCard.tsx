import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import Card from '@/components/Card/Card';
import Table, { type Column } from '@/components/Table/Table';
import Tooltip from '@/components/Tooltip/Tooltip';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import GoalieStatsEditModal from '../GoalieStatsEditModal';
import GoalieTimeOnIceModal from '../GoalieTimeOnIceModal';
import type { GameRecord } from '@/hooks/useGames';
import type { GoalRecord } from '@/hooks/useGameGoals';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type {
  GoalieSwitchData,
  GoalieStatRecord,
  GoalieStintRecord,
  UpdateGoalieStintData,
} from '@/hooks/useGameGoalieStats';
import { formatPlayerName } from '../formatUtils';
import { defaultStintToi, secondsToMMSS } from '../goalieTimeOnIce';
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

const fmtStintPoint = (period: string, time: string | null, isEnter?: boolean) => {
  const periodLabel = PERIOD_LABEL[period] ?? period;
  const timeLabel = isEnter
    ? time === '00:00'
      ? ''
      : time
    : isGameStart(period, time)
      ? '00:00'
      : time === '20:00'
        ? ''
        : time;
  return timeLabel ? `${periodLabel} ${timeLabel}` : periodLabel;
};

/** Format a single stint's entry→exit window for display. */
const fmtStintWindow = (stint: GoalieStintRecord) => {
  const enter = fmtStintPoint(stint.entered_period, stint.entered_time, true);
  const exit = stint.exited_period
    ? fmtStintPoint(stint.exited_period, stint.exited_time)
    : 'End of game';
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
    return [`${fmtStintPoint(stat.entered_period, stat.sub_time, true)} → End of game`];
  }
  return [];
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  goalieStats: GoalieStatRecord[];
  goals: GoalRecord[];
  getPlayerHref?: (
    teamId: string,
    playerId: string,
    firstName: string | null | undefined,
    lastName: string | null | undefined,
  ) => string;
  isFinal: boolean;
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
  goals,
  getPlayerHref,
  isFinal,
  updateGoalieStint,
  addGoalieStint,
  removeGoalieStint,
  removeGoalieStat,
  showPlayerDataStatus = false,
}: Props) => {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [toiOpen, setToiOpen] = useState(false);
  const canEdit =
    !!updateGoalieStint && !!addGoalieStint && !!removeGoalieStint && !!removeGoalieStat;

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

  interface GoalieStatRow {
    id: string;
    goalie: GameRosterEntry;
    primaryColor: string;
    textColor: string;
    teamLogo: string | null;
    teamCode: string | null;
    sa: number;
    sv: number;
    gaa: string;
    svPct: string;
    toi: string;
    windows: string[];
    isStarter: boolean;
    playerHref?: string;
  }

  const goalieRows: GoalieStatRow[] = goaliesWithStats.flatMap((goalie) => {
    const stat = goalieStats.find((gs) => gs.goalie_id === goalie.player_id);
    if (!stat) return [];
    const isAway = goalie.team_id === game.away_team.id;
    const team = isAway ? game.away_team : game.home_team;
    const hasNoRecordedStats =
      stat.shots_against === 0 && stat.saves === 0 && stat.goals_against === 0;
    const toiSec = stat.stints.reduce(
      (sum, st) => sum + (st.time_on_ice ?? defaultStintToi(st, game)),
      0,
    );
    return [
      {
        id: goalie.player_id,
        goalie,
        primaryColor: team.primary_color,
        textColor: team.text_color,
        teamLogo: team.logo,
        teamCode: team.code,
        sa: stat.shots_against,
        sv: stat.saves,
        gaa:
          hasNoRecordedStats || toiSec === 0
            ? '--'
            : ((stat.goals_against * 3600) / toiSec).toFixed(2),
        svPct: hasNoRecordedStats
          ? '--'
          : stat.shots_against > 0
            ? (stat.saves / stat.shots_against).toFixed(3).replace(/^0/, '')
            : '1.000',
        toi: toiSec > 0 ? secondsToMMSS(toiSec) : '--',
        windows: stintLabels(stat),
        isStarter: goalieStatIsStarter(stat),
        playerHref: getPlayerHref?.(
          goalie.team_id,
          goalie.player_id,
          goalie.first_name,
          goalie.last_name,
        ),
      },
    ];
  });

  const statHeader = (label: string, tooltip: string) => <Tooltip text={tooltip}>{label}</Tooltip>;

  const columns: Column<GoalieStatRow>[] = [
    {
      type: 'custom',
      header: '',
      render: (row) => (
        <span className={styles.goalieNameCell}>
          <TeamLogo
            logo={row.teamLogo}
            code={row.teamCode ?? '?'}
            primaryColor={row.primaryColor}
            textColor={row.textColor}
            size={30}
            shape="square"
          />
          <PlayerAvatar
            photo={row.goalie.photo}
            initials={
              `${row.goalie.first_name?.charAt(0) ?? ''}${row.goalie.last_name?.charAt(0) ?? ''}`.trim() ||
              '?'
            }
            primaryColor={row.primaryColor}
            textColor={row.textColor}
            size={48}
          />
          <div className={styles.goalInfo}>
            {row.goalie.jersey_number != null && (
              <span className={styles.goalAssists}>#{row.goalie.jersey_number}</span>
            )}
            <span className={styles.goalScorer}>
              {formatPlayerName(row.goalie.first_name, row.goalie.last_name)}
              {playerDataComplete(
                row.goalie.date_of_birth,
                row.goalie.start_date,
                row.goalie.acquisition_type,
                showPlayerDataStatus,
              )}
            </span>
            {row.windows.map((w, i) => (
              <span
                key={i}
                className={styles.goalAssists}
              >
                {w}
              </span>
            ))}
          </div>
        </span>
      ),
    },
    { type: 'custom', header: statHeader('SA', 'Shots Against'), align: 'center', render: (r) => r.sa },
    { type: 'custom', header: statHeader('SV', 'Saves'), align: 'center', render: (r) => r.sv },
    {
      type: 'custom',
      header: statHeader('GAA', 'Goals Against Average'),
      align: 'center',
      render: (r) => r.gaa,
    },
    {
      type: 'custom',
      header: statHeader('SV%', 'Save Percentage'),
      align: 'center',
      render: (r) => r.svPct,
    },
    {
      type: 'custom',
      header: statHeader('TOI', 'Time on Ice'),
      align: 'center',
      render: (r) => r.toi,
    },
  ];

  return (
    <>
      <Card
        title="Goalie Stats"
        action={
          isFinal && canEdit ? (
            <div className={styles.goalieCardActions}>
              <Button
                variant="outlined"
                intent="neutral"
                icon="schedule"
                size="sm"
                tooltip="Edit time on ice"
                onClick={() => setToiOpen(true)}
              />
              <Button
                variant="outlined"
                intent="neutral"
                icon="edit"
                size="sm"
                tooltip="Edit goalie stats"
                onClick={() => setEditOpen(true)}
              />
            </div>
          ) : undefined
        }
      >
        {goaliesWithStats.length === 0 ? (
          <p className={styles.empty}>No goalie stats recorded yet.</p>
        ) : (
          <Table
            columns={columns}
            data={goalieRows}
            rowKey={(r) => r.id}
            onRowClick={getPlayerHref ? (r) => r.playerHref && navigate(r.playerHref) : undefined}
            rowClassName={(r) =>
              r.isStarter && gameSwitchedGoalies ? styles.goalieRowStarterSwitch : undefined
            }
          />
        )}
      </Card>

      {canEdit && (
        <>
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
          <GoalieTimeOnIceModal
            open={toiOpen}
            game={game}
            goalieStats={goalieStats}
            goals={goals}
            onClose={() => setToiOpen(false)}
            updateGoalieStint={updateGoalieStint}
          />
        </>
      )}
    </>
  );
};

export default GoalieStatsCard;
