import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Badge from '../../../components/Badge/Badge';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Accordion, { type AccordionAction } from '../../../components/Accordion/Accordion';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ListItem from '../../../components/ListItem/ListItem';
import Modal from '../../../components/Modal/Modal';
import MoreActionsMenu from '../../../components/MoreActionsMenu/MoreActionsMenu';
import Select from '../../../components/Select/Select';
import Tabs from '../../../components/Tabs/Tabs';
import TitleRow from '../../../components/TitleRow/TitleRow';
import {
  useGameDetails,
  type CurrentPeriod,
  type GameStatus,
  type GameType,
} from '../../../hooks/useGames';
import useTeamPlayers from '../../../hooks/useTeamPlayers';
import useGameLineup from '../../../hooks/useGameLineup';
import LineupRosterModal from './LineupRosterModal';
import LineupCreatePlayersModal from './LineupCreatePlayersModal';
import SetLineupModal from './SetLineupModal';
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

const GOAL_TYPES = [
  { value: 'even-strength', label: 'Even Strength' },
  { value: 'power-play', label: 'Power Play' },
  { value: 'shorthanded', label: 'Shorthanded' },
  { value: 'empty-net', label: 'Empty Net' },
  { value: 'penalty-shot', label: 'Penalty Shot' },
  { value: 'own', label: 'Own Goal' },
];

// ── Component ─────────────────────────────────────────────────────────────────

const GameDetailsPage = () => {
  const { leagueId, seasonId, id } = useParams<{
    leagueId: string;
    seasonId: string;
    id: string;
  }>();
  const navigate = useNavigate();
  const { game, loading, busy, updateStatus, scoreGoal, advancePeriod } = useGameDetails(id);

  // ── Goal form state ───────────────────────────────────────────────────────
  const [goalPeriod, setGoalPeriod] = useState<1 | 2 | 3 | null>(null);
  const [goalTeam, setGoalTeam] = useState<'away' | 'home'>('away');
  const [goalTime, setGoalTime] = useState('');
  const [goalType, setGoalType] = useState('even-strength');
  const [goalScorerId, setGoalScorerId] = useState('');
  const [goalAssist1Id, setGoalAssist1Id] = useState('');
  const [goalAssist2Id, setGoalAssist2Id] = useState('');

  // Fetch both rosters up-front; enabled only when team IDs are available.
  const {
    players: awayPlayers,
    addPlayersToRoster: addAwayToRoster,
    createAndRosterPlayers: createAndRosterAway,
  } = useTeamPlayers(game?.away_team_id, seasonId);
  const {
    players: homePlayers,
    addPlayersToRoster: addHomeToRoster,
    createAndRosterPlayers: createAndRosterHome,
  } = useTeamPlayers(game?.home_team_id, seasonId);

  // ── Lineup modal state ────────────────────────────────────────────────────
  const [lineupAddTeam, setLineupAddTeam] = useState<'away' | 'home' | null>(null);
  const [lineupCreateTeam, setLineupCreateTeam] = useState<'away' | 'home' | null>(null);
  const [lineupSetTeam, setLineupSetTeam] = useState<'away' | 'home' | null>(null);

  // ── Starting lineup data ───────────────────────────────────────────────────
  const { lineup, saveTeamLineup, removeFromLineup } = useGameLineup(id);

  const openGoalModal = (period: 1 | 2 | 3) => {
    setGoalPeriod(period);
    setGoalTeam('away');
    setGoalTime('');
    setGoalType('even-strength');
    setGoalScorerId('');
    setGoalAssist1Id('');
    setGoalAssist2Id('');
  };
  const closeGoalModal = () => setGoalPeriod(null);

  const handleTeamChange = (team: 'away' | 'home') => {
    setGoalTeam(team);
    setGoalScorerId('');
    setGoalAssist1Id('');
    setGoalAssist2Id('');
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    if (digits.length >= 2 && parseInt(digits.slice(0, 2), 10) > 20) return;
    if (digits.length === 4) {
      const mins = parseInt(digits.slice(0, 2), 10);
      const secs = parseInt(digits.slice(2), 10);
      if ((mins === 20 && secs > 0) || secs > 59) return;
    }
    setGoalTime(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
  };

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

                        const hasGoals = awayGoals > 0 || homeGoals > 0;
                        const isPending = !isActive && !isDone;

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
                            toggleDisabled={isPending}
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
                                      onClick: () => openGoalModal(num as 1 | 2 | 3),
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
                          >
                            {isActive && !hasGoals && (
                              <p className={styles.noGoalsText}>No goals scored</p>
                            )}
                          </Accordion>
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
            content: (() => {
              // Build a quick lookup: player_id → lineup entry (for this game)
              const awayLineupMap = new Map(
                lineup.filter((e) => e.team_id === game.away_team_id).map((e) => [e.player_id, e]),
              );
              const homeLineupMap = new Map(
                lineup.filter((e) => e.team_id === game.home_team_id).map((e) => [e.player_id, e]),
              );

              const renderTeamAccordion = (
                side: 'away' | 'home',
                teamId: string,
                teamName: string,
                players: typeof awayPlayers,
                lineupMap: typeof awayLineupMap,
              ) => (
                <Accordion
                  variant="static"
                  label={teamName}
                  hoverActions={[
                    {
                      icon: 'set_lineup',
                      tooltip: 'Set Starting Lineup',
                      onClick: () => setLineupSetTeam(side),
                    },
                    {
                      icon: 'group_add',
                      tooltip: 'Add from Roster',
                      onClick: () => setLineupAddTeam(side),
                    },
                    {
                      icon: 'person_add',
                      tooltip: 'Create Player',
                      onClick: () => setLineupCreateTeam(side),
                    },
                  ]}
                >
                  {players.length > 0 ? (
                    <ul className={styles.lineupPlayerList}>
                      {players.map((p) => {
                        const entry = lineupMap.get(p.id);
                        return (
                          <ListItem
                            key={p.id}
                            image={p.photo}
                            image_shape="circle"
                            name={`${p.first_name} ${p.last_name}`}
                            nameItalic={!!entry}
                            placeholder={`${p.first_name[0]}${p.last_name[0]}`}
                            subtitle={p.jersey_number != null ? `#${p.jersey_number}` : undefined}
                            rightContent={
                              p.position ? { type: 'tag', label: p.position } : undefined
                            }
                            actions={[
                              !!entry && {
                                icon: 'remove',
                                intent: 'danger',
                                tooltip: 'Remove from lineup',
                                onClick: () => removeFromLineup(entry.id),
                              },
                            ]}
                          />
                        );
                      })}
                    </ul>
                  ) : (
                    <p className={styles.noGoalsText}>No players in roster yet.</p>
                  )}
                </Accordion>
              );

              return (
                <div className={styles.tabContent}>
                  <Card title="Lineup">
                    <div className={styles.lineupGrid}>
                      {renderTeamAccordion(
                        'away',
                        game.away_team_id,
                        game.away_team_name,
                        awayPlayers,
                        awayLineupMap,
                      )}
                      {renderTeamAccordion(
                        'home',
                        game.home_team_id,
                        game.home_team_name,
                        homePlayers,
                        homeLineupMap,
                      )}
                    </div>
                  </Card>
                </div>
              );
            })(),
          },
        ]}
      />

      {/* ── Score Goal Form ── */}
      {(() => {
        const teamPlayers = goalTeam === 'away' ? awayPlayers : homePlayers;
        const playerOptions = teamPlayers.map((p) => ({
          value: p.id,
          label:
            p.jersey_number != null
              ? `#${p.jersey_number} ${p.first_name} ${p.last_name}`
              : `${p.first_name} ${p.last_name}`,
        }));

        return (
          <Modal
            open={goalPeriod !== null}
            title="Score Goal"
            onClose={closeGoalModal}
            footer={
              <Button
                variant="filled"
                intent="accent"
                disabled={!!busy || !goalScorerId}
                onClick={async () => {
                  await scoreGoal(goalPeriod!, goalTeam);
                  closeGoalModal();
                }}
              >
                Record Goal
              </Button>
            }
          >
            <div className={styles.goalForm}>
              {/* Team segmented control */}
              <div className={styles.teamSegment}>
                <button
                  type="button"
                  className={[
                    styles.teamSegmentBtn,
                    goalTeam === 'away' ? styles.teamSegmentBtnActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleTeamChange('away')}
                >
                  {game.away_team_code}
                </button>
                <button
                  type="button"
                  className={[
                    styles.teamSegmentBtn,
                    goalTeam === 'home' ? styles.teamSegmentBtnActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleTeamChange('home')}
                >
                  {game.home_team_code}
                </button>
              </div>

              {/* Period time */}
              <div className={styles.goalFormField}>
                <label className={styles.goalFormLabel}>Period Time</label>
                <input
                  type="text"
                  className={styles.timeInput}
                  placeholder="MM:SS"
                  value={goalTime}
                  onChange={handleTimeChange}
                  inputMode="numeric"
                />
              </div>

              {/* Goal type */}
              <div className={styles.goalFormField}>
                <label className={styles.goalFormLabel}>Goal Type</label>
                <Select
                  value={goalType}
                  options={GOAL_TYPES}
                  onChange={setGoalType}
                />
              </div>

              {/* Scorer */}
              <div className={styles.goalFormField}>
                <label className={styles.goalFormLabel}>
                  Scorer <span className={styles.required}>*</span>
                </label>
                <Select
                  value={goalScorerId || null}
                  options={playerOptions}
                  placeholder="— Select scorer —"
                  onChange={setGoalScorerId}
                />
              </div>

              {/* Assists row */}
              <div className={styles.goalFormRow}>
                <div className={styles.goalFormField}>
                  <label className={styles.goalFormLabel}>1st Assist</label>
                  <Select
                    value={goalAssist1Id || null}
                    options={playerOptions}
                    placeholder="— Optional —"
                    onChange={setGoalAssist1Id}
                  />
                </div>
                <div className={styles.goalFormField}>
                  <label className={styles.goalFormLabel}>2nd Assist</label>
                  <Select
                    value={goalAssist2Id || null}
                    options={playerOptions}
                    placeholder="— Optional —"
                    onChange={setGoalAssist2Id}
                  />
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ── Lineup: Add from Roster ── */}
      {lineupAddTeam !== null && game && (
        <LineupRosterModal
          open={lineupAddTeam !== null}
          onClose={() => setLineupAddTeam(null)}
          teamId={lineupAddTeam === 'away' ? game.away_team_id : game.home_team_id}
          seasonId={seasonId!}
          teamName={lineupAddTeam === 'away' ? game.away_team_name : game.home_team_name}
          existingPlayerIds={
            new Set((lineupAddTeam === 'away' ? awayPlayers : homePlayers).map((p) => p.id))
          }
          addPlayersToRoster={lineupAddTeam === 'away' ? addAwayToRoster : addHomeToRoster}
        />
      )}

      {/* ── Lineup: Create Player ── */}
      {lineupCreateTeam !== null && game && (
        <LineupCreatePlayersModal
          open={lineupCreateTeam !== null}
          onClose={() => setLineupCreateTeam(null)}
          teamId={lineupCreateTeam === 'away' ? game.away_team_id : game.home_team_id}
          seasonId={seasonId!}
          teamName={lineupCreateTeam === 'away' ? game.away_team_name : game.home_team_name}
          createAndRosterPlayers={
            lineupCreateTeam === 'away' ? createAndRosterAway : createAndRosterHome
          }
        />
      )}

      {/* ── Lineup: Set Starting Lineup ── */}
      {lineupSetTeam !== null && game && (
        <SetLineupModal
          open={lineupSetTeam !== null}
          onClose={() => setLineupSetTeam(null)}
          teamId={lineupSetTeam === 'away' ? game.away_team_id : game.home_team_id}
          teamName={lineupSetTeam === 'away' ? game.away_team_name : game.home_team_name}
          players={lineupSetTeam === 'away' ? awayPlayers : homePlayers}
          lineup={lineup}
          saveTeamLineup={saveTeamLineup}
        />
      )}
    </>
  );
};

export default GameDetailsPage;
