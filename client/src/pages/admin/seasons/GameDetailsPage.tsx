import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Badge from '../../../components/Badge/Badge';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Accordion, { type AccordionAction } from '../../../components/Accordion/Accordion';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
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
import useGameRoster, { type GameRosterEntry } from '../../../hooks/useGameRoster';
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

const POSITION_LABEL: Record<string, string> = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defense',
  G: 'Goalie',
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

  // ── Goal form state ───────────────────────────────────────────────────────
  const [goalPeriod, setGoalPeriod] = useState<1 | 2 | 3 | null>(null);
  const [goalTeam, setGoalTeam] = useState<'away' | 'home'>('away');
  const [goalTimeMins, setGoalTimeMins] = useState('');
  const [goalTimeSecs, setGoalTimeSecs] = useState('');
  const [goalType, setGoalType] = useState('even-strength');
  const [goalScorerId, setGoalScorerId] = useState('');
  const [goalAssist1Id, setGoalAssist1Id] = useState('');
  const [goalAssist2Id, setGoalAssist2Id] = useState('');

  // Season rosters — used as player pool for "Add from Roster" / "Create Player" modals
  const { createAndRosterPlayers: createAndRosterAway } = useTeamPlayers(
    game?.away_team_id,
    seasonId,
  );
  const { createAndRosterPlayers: createAndRosterHome } = useTeamPlayers(
    game?.home_team_id,
    seasonId,
  );

  // ── Game-day rosters ───────────────────────────────────────────────────────
  const { roster, addToRoster, removeFromRoster } = useGameRoster(id);
  const awayRoster = roster.filter((e) => e.team_id === game?.away_team_id);
  const homeRoster = roster.filter((e) => e.team_id === game?.home_team_id);

  // ── Lineup modal state ────────────────────────────────────────────────────
  const [lineupAddTeam, setLineupAddTeam] = useState<'away' | 'home' | null>(null);
  const [lineupCreateTeam, setLineupCreateTeam] = useState<'away' | 'home' | null>(null);
  const [lineupSetTeam, setLineupSetTeam] = useState<'away' | 'home' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{
    entry: GameRosterEntry;
  } | null>(null);
  const [removingFromRoster, setRemovingFromRoster] = useState(false);

  // ── Starting lineup data ───────────────────────────────────────────────────
  const { lineup, saveTeamLineup } = useGameLineup(id);

  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;
    setRemovingFromRoster(true);
    await removeFromRoster(confirmRemove.entry.id);
    setRemovingFromRoster(false);
    setConfirmRemove(null);
  };

  const openGoalModal = (period: 1 | 2 | 3) => {
    setGoalPeriod(period);
    setGoalTeam('away');
    setGoalTimeMins('');
    setGoalTimeSecs('');
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

  const handleTimeMinsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    if (val !== '' && parseInt(val, 10) > 20) return;
    setGoalTimeMins(val);
  };

  const handleTimeSecsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    if (val !== '' && parseInt(val, 10) > 59) return;
    setGoalTimeSecs(val);
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
          <button
            type="button"
            className={`${styles.teamBlock} ${styles.teamBlockClickable}`}
            onClick={() => navigate(`/admin/leagues/${leagueId}/teams/${game.away_team_id}`)}
          >
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
          </button>

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

          <button
            type="button"
            className={`${styles.teamBlock} ${styles.teamBlockHome} ${styles.teamBlockClickable}`}
            onClick={() => navigate(`/admin/leagues/${leagueId}/teams/${game.home_team_id}`)}
          >
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
          </button>
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
              // Lookup: player_id → starting lineup entry (for italic + position_slot info)
              const awayLineupMap = new Map(
                lineup.filter((e) => e.team_id === game.away_team_id).map((e) => [e.player_id, e]),
              );
              const homeLineupMap = new Map(
                lineup.filter((e) => e.team_id === game.home_team_id).map((e) => [e.player_id, e]),
              );

              const renderTeamAccordion = (
                side: 'away' | 'home',
                teamName: string,
                teamCode: string,
                teamLogo: string | null | undefined,
                primaryColor: string,
                textColor: string,
                rosterEntries: GameRosterEntry[],
                lineupMap: typeof awayLineupMap,
              ) => (
                <Accordion
                  variant="static"
                  label={
                    <span className={styles.accordionTeamLabel}>
                      {teamLogo ? (
                        <img
                          src={teamLogo}
                          alt={teamCode}
                          className={styles.accordionTeamLogo}
                        />
                      ) : (
                        <span className={styles.accordionTeamLogoPlaceholder}>
                          {teamCode.slice(0, 3)}
                        </span>
                      )}
                      {teamName}
                    </span>
                  }
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
                  {rosterEntries.length > 0 ? (
                    (() => {
                      const byJersey = (a: GameRosterEntry, b: GameRosterEntry) => {
                        if (a.jersey_number == null && b.jersey_number == null) return 0;
                        if (a.jersey_number == null) return 1;
                        if (b.jersey_number == null) return -1;
                        return a.jersey_number - b.jersey_number;
                      };
                      const skaters = rosterEntries
                        .filter((e) => e.position !== 'G')
                        .sort(byJersey);
                      const goalies = rosterEntries
                        .filter((e) => e.position === 'G')
                        .sort(byJersey);

                      const renderPlayer = (e: GameRosterEntry) => {
                        const isStarter = lineupMap.has(e.player_id);
                        const jerseyPrefix = e.jersey_number != null ? `#${e.jersey_number} ` : '';
                        return (
                          <ListItem
                            key={e.id}
                            image={e.photo}
                            image_shape="circle"
                            primaryColor={primaryColor}
                            textColor={textColor}
                            name={`${jerseyPrefix}${e.last_name}, ${e.first_name}`}
                            placeholder={`${e.first_name[0]}${e.last_name[0]}`}
                            subtitle={
                              e.position ? (POSITION_LABEL[e.position] ?? e.position) : undefined
                            }
                            rightContent={
                              isStarter
                                ? { type: 'tag', label: 'Starter', intent: 'accent' }
                                : undefined
                            }
                            actions={[
                              {
                                icon: 'person_remove',
                                intent: 'danger',
                                tooltip: 'Remove from game roster',
                                onClick: () => setConfirmRemove({ entry: e }),
                              },
                            ]}
                          />
                        );
                      };

                      return (
                        <>
                          <ul className={styles.lineupPlayerList}>{skaters.map(renderPlayer)}</ul>
                          {goalies.length > 0 && (
                            <>
                              <div className={styles.lineupDivider} />
                              <ul className={styles.lineupPlayerList}>
                                {goalies.map(renderPlayer)}
                              </ul>
                            </>
                          )}
                        </>
                      );
                    })()
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
                        game.away_team_name,
                        game.away_team_code,
                        game.away_team_logo,
                        game.away_team_primary_color,
                        game.away_team_text_color,
                        awayRoster,
                        awayLineupMap,
                      )}
                      {renderTeamAccordion(
                        'home',
                        game.home_team_name,
                        game.home_team_code,
                        game.home_team_logo,
                        game.home_team_primary_color,
                        game.home_team_text_color,
                        homeRoster,
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
        const teamRoster = goalTeam === 'away' ? awayRoster : homeRoster;
        const playerOptions = teamRoster.map((e) => ({
          value: e.player_id,
          label:
            e.jersey_number != null
              ? `#${e.jersey_number} ${e.first_name} ${e.last_name}`
              : `${e.first_name} ${e.last_name}`,
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
                disabled={!!busy || !goalScorerId || !goalTimeMins || !goalTimeSecs}
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

              {/* Period time + Goal type row */}
              <div className={styles.goalFormTimeRow}>
                {/* Period time — one label, two inputs with colon */}
                <div className={styles.goalFormField}>
                  <label className={styles.goalFormLabel}>
                    Period Time <span className={styles.required}>*</span>
                  </label>
                  <div className={styles.timeInputRow}>
                    <input
                      type="text"
                      className={styles.timeSegmentInput}
                      placeholder="MM"
                      value={goalTimeMins}
                      onChange={handleTimeMinsChange}
                      inputMode="numeric"
                      maxLength={2}
                    />
                    <span className={styles.timeColon}>:</span>
                    <input
                      type="text"
                      className={styles.timeSegmentInput}
                      placeholder="SS"
                      value={goalTimeSecs}
                      onChange={handleTimeSecsChange}
                      inputMode="numeric"
                      maxLength={2}
                    />
                  </div>
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
                  searchable
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
                    searchable
                  />
                </div>
                <div className={styles.goalFormField}>
                  <label className={styles.goalFormLabel}>2nd Assist</label>
                  <Select
                    value={goalAssist2Id || null}
                    options={playerOptions}
                    placeholder="— Optional —"
                    onChange={setGoalAssist2Id}
                    searchable
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
          teamName={lineupAddTeam === 'away' ? game.away_team_name : game.home_team_name}
          existingPlayerIds={
            new Set((lineupAddTeam === 'away' ? awayRoster : homeRoster).map((e) => e.player_id))
          }
          addToGameRoster={(playerIds) =>
            addToRoster(lineupAddTeam === 'away' ? game.away_team_id : game.home_team_id, playerIds)
          }
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
          onPlayersCreated={(playerIds) =>
            addToRoster(
              lineupCreateTeam === 'away' ? game.away_team_id : game.home_team_id,
              playerIds,
            ).then(() => {})
          }
        />
      )}

      {/* ── Lineup: Set Starting Lineup ── */}
      {lineupSetTeam !== null &&
        game &&
        (() => {
          // Map game roster entries to the shape SetLineupModal expects (id = player_id)
          const rosterForSide = (lineupSetTeam === 'away' ? awayRoster : homeRoster).map((e) => ({
            ...e,
            id: e.player_id,
          }));
          return (
            <SetLineupModal
              open={lineupSetTeam !== null}
              onClose={() => setLineupSetTeam(null)}
              teamId={lineupSetTeam === 'away' ? game.away_team_id : game.home_team_id}
              teamName={lineupSetTeam === 'away' ? game.away_team_name : game.home_team_name}
              players={rosterForSide as unknown as Parameters<typeof SetLineupModal>[0]['players']}
              lineup={lineup}
              saveTeamLineup={saveTeamLineup}
            />
          );
        })()}

      {/* ── Lineup: Remove from Game Roster (confirm) ── */}
      <ConfirmModal
        open={!!confirmRemove}
        title="Remove from Roster"
        body={
          confirmRemove ? (
            <>
              Remove{' '}
              <strong>
                {confirmRemove.entry.first_name} {confirmRemove.entry.last_name}
              </strong>{' '}
              from this game&apos;s roster?
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Remove"
        confirmIcon="person_remove"
        variant="danger"
        busy={removingFromRoster}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </>
  );
};

export default GameDetailsPage;
