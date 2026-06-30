import Button from '@/components/Button/Button';
import MoreActionsMenu from '@/components/MoreActionsMenu/MoreActionsMenu';
import Section from '@/components/Section/Section';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import type { GameRecord } from '@/hooks/useGames';
import type { ShootoutAttempt } from '@/hooks/useShootoutAttempts';
import { PERIOD, PERIOD_IDS, otPeriodId } from '../constants';
import styles from '../GameDetailsPage.module.scss';

interface LinescorePeriod {
  id: string;
  label: string;
  shortLabel: string;
}

interface Props {
  game: GameRecord;
  isFinal: boolean;
  busy: string | null;
  liveAwayScore: number;
  liveHomeScore: number;
  linescorePeriods: LinescorePeriod[];
  attempts: ShootoutAttempt[];
  rosterReady: boolean;
  lineupsReady: boolean;
  /** True when the End Game button should be shown (in-progress + period/score conditions met). */
  canEndGame: boolean;
  // ── Action callbacks ──
  onStartGame?: () => void;
  onAutofillGame?: () => void;
  onReschedule?: () => void;
  onDelete?: () => void;
  onEndGame?: () => void;
  onDownloadScoreCard: () => void;
}

const LinescoreCard = ({
  game,
  isFinal,
  busy,
  liveAwayScore,
  liveHomeScore,
  linescorePeriods,
  attempts,
  rosterReady,
  lineupsReady,
  canEndGame,
  onStartGame,
  onAutofillGame,
  onReschedule,
  onDelete,
  onEndGame,
  onDownloadScoreCard,
}: Props) => {
  const currentPeriodIdx = PERIOD_IDS.indexOf(game.current_period as '1' | '2' | '3');
  // When the game is in OT or SO, all regular periods are complete.
  const isPostRegulation =
    game.current_period === PERIOD.OVERTIME || game.current_period === PERIOD.SHOOTOUT;

  const rows = [
    {
      teamId: game.away_team.id,
      teamCode: game.away_team.code,
      teamLogo: game.away_team.logo,
      teamLogoDark: game.away_team.logo_dark,
      teamLogoLight: game.away_team.logo_light,
      primaryColor: game.away_team.primary_color,
      textColor: game.away_team.text_color,
      total: liveAwayScore,
      isLoser: isFinal && liveAwayScore < liveHomeScore,
    },
    {
      teamId: game.home_team.id,
      teamCode: game.home_team.code,
      teamLogo: game.home_team.logo,
      teamLogoDark: game.home_team.logo_dark,
      teamLogoLight: game.home_team.logo_light,
      primaryColor: game.home_team.primary_color,
      textColor: game.home_team.text_color,
      total: liveHomeScore,
      isLoser: isFinal && liveHomeScore < liveAwayScore,
    },
  ];

  return (
    <Section
      title="Linescore"
      action={
        <div className={styles.linescoreActions}>
          {onAutofillGame && (
            <Button
              variant="outlined"
              intent="info"
              icon="sports_hockey"
              size="sm"
              tooltip="Auto-fill NHL game"
              disabled={!!busy}
              onClick={onAutofillGame}
            />
          )}
          {game.status === 'scheduled' && onStartGame && onReschedule && onDelete && (
            <>
              <Button
                variant="filled"
                intent="success"
                icon="play_arrow"
                size="sm"
                tooltip={
                  !rosterReady
                    ? 'Set lineups for both teams first'
                    : !lineupsReady
                      ? 'Set starting lineups for both teams'
                      : 'Start Game'
                }
                tooltipIntent={rosterReady && lineupsReady ? undefined : 'error'}
                disabled={!!busy || !rosterReady || !lineupsReady}
                onClick={onStartGame}
              />
              <MoreActionsMenu
                disabled={!!busy}
                items={[
                  { label: 'Reschedule Game', icon: 'calendar', onClick: onReschedule },
                  { label: 'Delete Game', icon: 'delete', intent: 'danger', onClick: onDelete },
                ]}
              />
            </>
          )}
          {canEndGame && onEndGame && (
            <Button
              variant="filled"
              intent="danger"
              icon="flag"
              size="sm"
              tooltip="End Game"
              disabled={!!busy}
              onClick={onEndGame}
            />
          )}
          {isFinal && (
            <Button
              variant="outlined"
              intent="neutral"
              icon="download"
              size="sm"
              tooltip="Download score card"
              onClick={onDownloadScoreCard}
            />
          )}
          {game.status !== 'scheduled' && onDelete && (
            <MoreActionsMenu
              disabled={!!busy}
              items={[
                {
                  label: 'Delete Game',
                  icon: 'delete',
                  intent: 'danger' as const,
                  onClick: onDelete,
                },
              ]}
            />
          )}
        </div>
      }
    >
      <table className={styles.periodsTable}>
        <thead>
          <tr>
            <th className={styles.thTeam}></th>
            {linescorePeriods.map((p) => (
              <th
                key={p.id}
                className={styles.thPeriod}
              >
                {p.shortLabel}
              </th>
            ))}
            <th className={styles.thTotal}>T</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId}>
              <td className={styles.tdTeam}>
                <span className={styles.linescoreTeam}>
                  <TeamLogo
                    logo={row.teamLogo}
                    logoDark={row.teamLogoDark}
                    logoLight={row.teamLogoLight}
                    code={row.teamCode ?? '?'}
                    primaryColor={row.primaryColor}
                    textColor={row.textColor}
                    size={24}
                    shape="square"
                  />
                  <span className={styles.linescoreCode}>{row.teamCode}</span>
                </span>
              </td>
              {linescorePeriods.map((p) => {
                // For numbered OT periods (OT1, OT2, …) only the last one maps to
                // the actual 'OT' goals; earlier ones always show 0.
                const isNumberedOT = /^OT[0-9]+$/.test(p.id);
                const isLastOT = isNumberedOT && p.id === otPeriodId(game.overtime_periods ?? 1);
                const ps = isNumberedOT
                  ? isLastOT
                    ? game.period_scores.find((s) => s.period === PERIOD.OVERTIME)
                    : undefined
                  : game.period_scores.find((s) => s.period === p.id);
                const pIdx = PERIOD_IDS.indexOf(p.id as '1' | '2' | '3');
                const isPeriodDone =
                  isFinal ||
                  (pIdx >= 0 ? isPostRegulation || currentPeriodIdx > pIdx : true);
                if (p.id === PERIOD.SHOOTOUT) {
                  const teamAttempts = attempts.filter((a) => a.team_id === row.teamId);
                  const soDisplay =
                    teamAttempts.length > 0
                      ? `${teamAttempts.filter((a) => a.scored).length}/${teamAttempts.length}`
                      : '—';
                  return (
                    <td
                      key={p.id}
                      className={styles.tdGoals}
                    >
                      {soDisplay}
                    </td>
                  );
                }
                const rawGoals = row.teamId === game.away_team.id ? ps?.away_goals : ps?.home_goals;
                const goals: number | string = rawGoals ?? (isPeriodDone ? 0 : '—');
                return (
                  <td
                    key={p.id}
                    className={styles.tdGoals}
                  >
                    {goals}
                  </td>
                );
              })}
              <td
                className={`${styles.tdTotal}${row.isLoser ? ` ${styles.scoreNumberLoser}` : ''}`}
              >
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
};

export default LinescoreCard;
