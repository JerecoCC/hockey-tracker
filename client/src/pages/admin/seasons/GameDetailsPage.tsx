import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Badge from '../../../components/Badge/Badge';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Accordion, { type AccordionAction } from '../../../components/Accordion/Accordion';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import Modal from '../../../components/Modal/Modal';
import MoreActionsMenu from '../../../components/MoreActionsMenu/MoreActionsMenu';
import Tabs from '../../../components/Tabs/Tabs';
import TitleRow from '../../../components/TitleRow/TitleRow';
import {
  useGameDetails,
  type CurrentPeriod,
  type GameStatus,
  type GameType,
} from '../../../hooks/useGames';
import styles from './GameDetailsPage.module.scss';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const STATUS_LABEL: Record<GameStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  final: 'Final',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

const STATUS_INTENT: Record<GameStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  scheduled: 'neutral',
  in_progress: 'warning',
  final: 'success',
  postponed: 'warning',
  cancelled: 'danger',
};

const PERIOD_IDS = ['1', '2', '3'] as const;
const PERIODS: { num: number; label: string; periodId: CurrentPeriod }[] = [
  { num: 1, label: '1st Period', periodId: '1' },
  { num: 2, label: '2nd Period', periodId: '2' },
  { num: 3, label: '3rd Period', periodId: '3' },
];

const GAME_TYPE_LABEL: Record<GameType, string> = {
  preseason: 'Preseason',
  regular: 'Regular Season',
  playoff: 'Playoffs',
};

// ── Component ─────────────────────────────────────────────────────────────────

const GameDetailsPage = () => {
  const { leagueId, seasonId, id } = useParams<{
    leagueId: string;
    seasonId: string;
    id: string;
  }>();
  const navigate = useNavigate();
  const { game, loading, busy, updateStatus, scoreGoal, advancePeriod } = useGameDetails(id);
  const [goalPeriod, setGoalPeriod] = useState<1 | 2 | 3 | null>(null);

  const seasonHref = `/admin/leagues/${leagueId}/seasons/${seasonId}`;

  if (loading) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading game…</p>
      </div>
    );
  }

  if (!game) {
    return (
      <>
        <Breadcrumbs
          items={[
            { label: 'Leagues', path: '/admin/leagues' },
            { label: 'Season', path: seasonHref },
            { label: 'Not Found' },
          ]}
        />
        <p style={{ color: 'var(--text-dim)' }}>Game not found.</p>
      </>
    );
  }

  const leagueName = game.league_name ?? 'League';
  const seasonName = game.season_name ?? 'Season';
  const leagueHref = `/admin/leagues/${leagueId}`;

  const isFinal = game.status === 'final';
  const isInProgress = game.status === 'in_progress';
  const hasPeriods = isFinal && game.periods && game.periods.length > 0;
  const awayScore = game.away_score ?? 0;
  const homeScore = game.home_score ?? 0;

  const overtimeSuffix = game.shootout ? ' (SO)' : (game.overtime_periods ?? 0) > 0 ? ' (OT)' : '';

  return (
    <>
      <TitleRow
        left={
          <Button
            variant="outlined"
            intent="neutral"
            icon="arrow_back"
            tooltip={`Back to ${seasonName}`}
            onClick={() => navigate(seasonHref)}
          />
        }
        right={
          <Breadcrumbs
            items={[
              { label: 'Leagues', path: '/admin/leagues' },
              { label: leagueName, path: leagueHref },
              { label: seasonName, path: seasonHref },
              { label: `${game.away_team_code} @ ${game.home_team_code}` },
            ]}
          />
        }
      />

      {/* ── Game actions ── */}
      {(game.status === 'scheduled' || game.status === 'in_progress') && (
        <div className={styles.gameActions}>
          {game.status === 'scheduled' && (
            <>
              <Button
                variant="filled"
                intent="accent"
                icon="play_arrow"
                size="sm"
                disabled={!!busy}
                onClick={() => updateStatus('in_progress')}
              >
                Start Game
              </Button>
              <MoreActionsMenu
                disabled={!!busy}
                items={[
                  {
                    label: 'Reschedule Game',
                    icon: 'calendar',
                    onClick: () => updateStatus('postponed'),
                  },
                  {
                    label: 'Cancel Game',
                    icon: 'close',
                    intent: 'danger',
                    onClick: () => updateStatus('cancelled'),
                  },
                ]}
              />
            </>
          )}
          {game.status === 'in_progress' && (
            <Button
              variant="filled"
              intent="accent"
              icon="flag"
              size="sm"
              disabled={!!busy}
              onClick={() => updateStatus('final')}
            >
              End Game
            </Button>
          )}
        </div>
      )}

      {/* ── Scoreboard card ── */}
      <Card className={styles.scoreboardCard}>
        <div className={styles.scoreboard}>
          <div className={styles.teamBlock}>
            {game.away_team_logo ? (
              <img
                src={game.away_team_logo}
                alt={game.away_team_code}
                className={styles.teamLogo}
              />
            ) : (
              <span className={styles.teamLogoPlaceholder}>{game.away_team_code.slice(0, 3)}</span>
            )}
            <span className={styles.teamCode}>{game.away_team_code}</span>
            <span className={styles.teamName}>{game.away_team_name}</span>
          </div>

          <div className={styles.scoreBlock}>
            {isFinal ? (
              <>
                <span className={styles.score}>
                  {awayScore} – {homeScore}
                </span>
                <span className={styles.scoreSuffix}>{overtimeSuffix || 'Final'}</span>
              </>
            ) : (
              <Badge
                label={STATUS_LABEL[game.status]}
                intent={STATUS_INTENT[game.status]}
              />
            )}
            {game.scheduled_at && (
              <span className={styles.scoreDate}>
                {DATE_FMT.format(new Date(game.scheduled_at))}
              </span>
            )}
          </div>

          <div className={`${styles.teamBlock} ${styles.teamBlockHome}`}>
            {game.home_team_logo ? (
              <img
                src={game.home_team_logo}
                alt={game.home_team_code}
                className={styles.teamLogo}
              />
            ) : (
              <span className={styles.teamLogoPlaceholder}>{game.home_team_code.slice(0, 3)}</span>
            )}
            <span className={styles.teamCode}>{game.home_team_code}</span>
            <span className={styles.teamName}>{game.home_team_name}</span>
          </div>
        </div>
      </Card>

      {/* ── Tabs ── */}
      <Tabs
        tabs={[
          {
            label: 'Summary',
            content: (
              <div className={styles.tabContent}>
                {/* Scoring section when in progress, Game Info otherwise */}
                {isInProgress ? (
                  <Card title="Scoring">
                    <div className={styles.periodList}>
                      {PERIODS.map(({ num, label, periodId }, idx) => {
                        const awayGoals =
                          (game[`p${num}_away_goals` as keyof typeof game] as number) ?? 0;
                        const homeGoals =
                          (game[`p${num}_home_goals` as keyof typeof game] as number) ?? 0;
                        const currentIdx = PERIOD_IDS.indexOf(
                          game.current_period as '1' | '2' | '3',
                        );
                        const isActive = game.current_period === periodId;
                        const isDone = currentIdx > idx;

                        return (
                          <Accordion
                            key={num}
                            className={
                              [
                                isActive ? styles.periodItemActive : '',
                                isDone ? styles.periodItemDone : '',
                              ]
                                .filter(Boolean)
                                .join(' ') || undefined
                            }
                            label={<span className={styles.periodLabel}>{label}</span>}
                            headerRight={
                              <span
                                className={
                                  isDone || isActive ? styles.periodScore : styles.periodScoreMuted
                                }
                              >
                                {isDone || isActive ? `${awayGoals} – ${homeGoals}` : '—'}
                              </span>
                            }
                            hoverActions={
                              isActive
                                ? ([
                                    {
                                      icon: 'sports_hockey',
                                      tooltip: 'Score Goal',
                                      intent: 'neutral' as const,
                                      disabled: !!busy,
                                      onClick: () => setGoalPeriod(num as 1 | 2 | 3),
                                    },
                                    num < 3
                                      ? {
                                          icon: 'flag',
                                          tooltip: 'End Period',
                                          intent: 'accent' as const,
                                          disabled: !!busy,
                                          onClick: () =>
                                            advancePeriod(String(num + 1) as CurrentPeriod),
                                        }
                                      : null,
                                  ].filter(Boolean) as AccordionAction[])
                                : undefined
                            }
                          />
                        );
                      })}
                    </div>
                  </Card>
                ) : (
                  <Card title="Game Info">
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Venue</span>
                        <span className={game.venue ? styles.infoValue : styles.infoValueMuted}>
                          {game.venue ?? '—'}
                        </span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Type</span>
                        <span className={styles.infoValue}>{GAME_TYPE_LABEL[game.game_type]}</span>
                      </div>
                      {game.game_number != null && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Game #</span>
                          <span className={styles.infoValue}>{game.game_number}</span>
                        </div>
                      )}
                      {game.notes && (
                        <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
                          <span className={styles.infoLabel}>Notes</span>
                          <span className={styles.infoValue}>{game.notes}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Period breakdown — final games only */}
                {hasPeriods && (
                  <Card title="Period Scores">
                    <table className={styles.periodsTable}>
                      <thead>
                        <tr>
                          <th className={styles.thTeam} />
                          {game.periods!.map((p) => (
                            <th
                              key={p.period}
                              className={styles.thPeriod}
                            >
                              {periodLabel(p, game.periods!)}
                            </th>
                          ))}
                          <th className={styles.thTotal}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className={styles.tdTeam}>{game.away_team_code}</td>
                          {game.periods!.map((p) => (
                            <td
                              key={p.period}
                              className={styles.tdGoals}
                            >
                              {p.away_goals}
                            </td>
                          ))}
                          <td className={styles.tdTotal}>{awayScore}</td>
                        </tr>
                        <tr>
                          <td className={styles.tdTeam}>{game.home_team_code}</td>
                          {game.periods!.map((p) => (
                            <td
                              key={p.period}
                              className={styles.tdGoals}
                            >
                              {p.home_goals}
                            </td>
                          ))}
                          <td className={styles.tdTotal}>{homeScore}</td>
                        </tr>
                      </tbody>
                    </table>
                  </Card>
                )}
              </div>
            ),
          },
          {
            label: 'Lineup',
            content: (
              <div className={styles.tabContent}>
                <Card title="Lineup">
                  <p className={styles.emptyText}>Lineup tracking coming soon.</p>
                </Card>
              </div>
            ),
          },
        ]}
      />

      {/* ── Goal Scorer Picker ── */}
      <Modal
        open={goalPeriod !== null}
        title="Who scored?"
        onClose={() => setGoalPeriod(null)}
      >
        <div className={styles.goalPickerActions}>
          <Button
            variant="outlined"
            intent="neutral"
            size="lg"
            disabled={!!busy}
            onClick={async () => {
              await scoreGoal(goalPeriod!, 'away');
              setGoalPeriod(null);
            }}
          >
            {game.away_team_code}
          </Button>
          <Button
            variant="outlined"
            intent="neutral"
            size="lg"
            disabled={!!busy}
            onClick={async () => {
              await scoreGoal(goalPeriod!, 'home');
              setGoalPeriod(null);
            }}
          >
            {game.home_team_code}
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default GameDetailsPage;
