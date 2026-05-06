import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import Icon from '@/components/Icon/Icon';
import Tooltip from '@/components/Tooltip/Tooltip';
import Accordion from '@/components/Accordion/Accordion';
import TitleRow from '@/components/TitleRow/TitleRow';
import { useGameDetails, type LastFiveGame, type PreviousMeeting } from '@/hooks/useGames';
import useGameGoals from '@/hooks/useGameGoals';
import useGameGoalieStats from '@/hooks/useGameGoalieStats';
import useShootoutAttempts from '@/hooks/useShootoutAttempts';
import useGameRoster from '@/hooks/useGameRoster';
import ScoreboardCard from '@/pages/admin/games/game-details/ScoreboardCard';
import ScoringCard from '@/pages/admin/games/game-details/ScoringCard';
import ScoreImageModal from '@/pages/admin/games/game-details/ScoreImageModal';
import {
  formatPlayerName,
  formatScheduledTime,
  DATE_FMT_SHORT,
  TIME_FMT,
} from '@/pages/admin/games/game-details/formatUtils';
import { PERIOD_IDS, GAME_TYPE_LABEL } from '@/pages/admin/games/game-details/constants';
import { buildFormRecord } from '@/pages/admin/games/game-details/gameUtils';
import styles from '@/pages/admin/games/game-details/GameDetailsPage.module.scss';

// ── Component ─────────────────────────────────────────────────────────────────

const UserGameDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { game, loading } = useGameDetails(id);
  const { goals } = useGameGoals(id);
  const { goalieStats } = useGameGoalieStats(id);
  const { attempts } = useShootoutAttempts(id);
  const { roster } = useGameRoster(id);

  const [scoreImageOpen, setScoreImageOpen] = useState(false);
  const [lastFiveView, setLastFiveView] = useState<'square' | 'list'>('list');

  // ── Roster splits ──────────────────────────────────────────────────────────
  const awayRoster = roster.filter((e) => e.team_id === game?.away_team.id);
  const homeRoster = roster.filter((e) => e.team_id === game?.home_team.id);

  // ── Shootout completion + winner (merged for efficiency) ──────────────────
  const { soComplete, soWinnerSide } = useMemo(() => {
    if (!game) return { soComplete: false, soWinnerSide: null as 'away' | 'home' | null };
    const bestOf = game.best_of_shootout ?? 3;
    const firstTeamId = game.shootout_first_team_id;
    const firstSideId =
      firstTeamId === game.away_team.id
        ? game.away_team.id
        : firstTeamId === game.home_team.id
          ? game.home_team.id
          : game.away_team.id;
    const firstSide: 'away' | 'home' = firstSideId === game.away_team.id ? 'away' : 'home';
    const secondSide: 'away' | 'home' = firstSide === 'away' ? 'home' : 'away';
    const secondSideId = firstSideId === game.away_team.id ? game.home_team.id : game.away_team.id;
    const fAttempts = attempts.filter((a) => a.team_id === firstSideId);
    const sAttempts = attempts.filter((a) => a.team_id === secondSideId);
    const fReg = fAttempts.slice(0, bestOf).filter((a) => a.scored).length;
    const sReg = sAttempts.slice(0, bestOf).filter((a) => a.scored).length;
    const fRem = Math.max(0, bestOf - fAttempts.length);
    const sRem = Math.max(0, bestOf - sAttempts.length);
    if (fReg > sReg + sRem) return { soComplete: true, soWinnerSide: firstSide };
    if (sReg > fReg + fRem) return { soComplete: true, soWinnerSide: secondSide };
    if (fAttempts.length < bestOf || sAttempts.length < bestOf)
      return { soComplete: false, soWinnerSide: null };
    if (fReg !== sReg)
      return { soComplete: true, soWinnerSide: fReg > sReg ? firstSide : secondSide };
    let sd = 0;
    while (true) {
      const sdF = fAttempts[bestOf + sd];
      const sdS = sAttempts[bestOf + sd];
      if (!sdF || !sdS) return { soComplete: false, soWinnerSide: null };
      if (sdF.scored && !sdS.scored) return { soComplete: true, soWinnerSide: firstSide };
      if (!sdF.scored && sdS.scored) return { soComplete: true, soWinnerSide: secondSide };
      sd++;
    }
  }, [game, attempts]);

  // ── Goal tally per goal (running totals for scorer/assists) ───────────────
  const tallyByGoalId = useMemo(() => {
    const gc = new Map<string, number>();
    const ac = new Map<string, number>();
    const map = new Map<
      string,
      { scorerGoals: number; assist1Assists: number | null; assist2Assists: number | null }
    >();
    for (const g of goals) {
      if (!gc.has(g.scorer_id)) gc.set(g.scorer_id, g.scorer_prior_goals ?? 0);
      const sg = gc.get(g.scorer_id)! + 1;
      gc.set(g.scorer_id, sg);
      let a1: number | null = null;
      if (g.assist_1_id) {
        if (!ac.has(g.assist_1_id)) ac.set(g.assist_1_id, g.assist_1_prior_assists ?? 0);
        const n = ac.get(g.assist_1_id)! + 1;
        ac.set(g.assist_1_id, n);
        a1 = n;
      }
      let a2: number | null = null;
      if (g.assist_2_id) {
        if (!ac.has(g.assist_2_id)) ac.set(g.assist_2_id, g.assist_2_prior_assists ?? 0);
        const n = ac.get(g.assist_2_id)! + 1;
        ac.set(g.assist_2_id, n);
        a2 = n;
      }
      map.set(g.id, { scorerGoals: sg, assist1Assists: a1, assist2Assists: a2 });
    }
    return map;
  }, [goals]);

  // ── Player game-stat totals (for Three Stars) ─────────────────────────────
  const playerGameStats = useMemo(() => {
    const stats = new Map<string, { goals: number; assists: number }>();
    for (const goal of goals) {
      const s = stats.get(goal.scorer_id) ?? { goals: 0, assists: 0 };
      stats.set(goal.scorer_id, { ...s, goals: s.goals + 1 });
      if (goal.assist_1_id) {
        const a = stats.get(goal.assist_1_id) ?? { goals: 0, assists: 0 };
        stats.set(goal.assist_1_id, { ...a, assists: a.assists + 1 });
      }
      if (goal.assist_2_id) {
        const a = stats.get(goal.assist_2_id) ?? { goals: 0, assists: 0 };
        stats.set(goal.assist_2_id, { ...a, assists: a.assists + 1 });
      }
    }
    return stats;
  }, [goals]);

  // ── Loading / not found ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading game…</p>
      </div>
    );
  }
  if (!game) return <p style={{ color: 'var(--text-dim)' }}>Game not found.</p>;

  // ── Derived values ─────────────────────────────────────────────────────────
  const isFinal = game.status === 'final';
  const isInProgress = game.status === 'in_progress';
  const hasSoPeriodScore = game.period_scores.some((ps) => ps.period === 'SO');
  const soScoreAdj = soWinnerSide && !hasSoPeriodScore ? 1 : 0;
  const liveAwayScore =
    game.period_scores.reduce((s, ps) => s + ps.away_goals, 0) +
    (soWinnerSide === 'away' ? soScoreAdj : 0);
  const liveHomeScore =
    game.period_scores.reduce((s, ps) => s + ps.home_goals, 0) +
    (soWinnerSide === 'home' ? soScoreAdj : 0);
  const overtimeSuffix =
    game.shootout || game.period_scores.some((ps) => ps.period === 'SO')
      ? '/SO'
      : (game.overtime_periods ?? 0) > 0 || game.period_scores.some((ps) => ps.period === 'OT')
        ? '/OT'
        : '';
  const currentPeriodGoals = goals.filter((g) => g.period === game.current_period);
  const lastCurrentPeriodGoalId = currentPeriodGoals[currentPeriodGoals.length - 1]?.id;
  const hasStars = isFinal && !!(game.star_1_id && game.star_2_id && game.star_3_id);
  const linescorePeriods: { id: string; label: string }[] = [
    { id: '1', label: '1st' },
    { id: '2', label: '2nd' },
    { id: '3', label: '3rd' },
    ...(game.period_scores.some((ps) => ps.period === 'OT') ||
    (game.overtime_periods ?? 0) > 0 ||
    game.current_period === 'OT' ||
    game.current_period === 'SO'
      ? [{ id: 'OT', label: 'OT' }]
      : []),
    ...(game.period_scores.some((ps) => ps.period === 'SO') ||
    game.shootout ||
    game.current_period === 'SO'
      ? [{ id: 'SO', label: 'SO' }]
      : []),
  ];

  return (
    <>
      {/* ── Back navigation ── */}
      <TitleRow
        left={
          <Button
            variant="outlined"
            intent="neutral"
            icon="arrow_back"
            tooltip="Back to Games"
            onClick={() => navigate('/games')}
          />
        }
      />

      {/* ── Scoreboard ── */}
      <ScoreboardCard
        game={game}
        isFinal={isFinal}
        isInProgress={isInProgress}
        liveAwayScore={liveAwayScore}
        liveHomeScore={liveHomeScore}
        overtimeSuffix={overtimeSuffix}
      />

      {/* ── Summary grid ── */}
      <div className={styles.summaryGrid}>
        {/* ── Left column ── */}
        <div className={styles.summaryLeft}>
          {/* Three Stars */}
          {hasStars &&
            (() => {
              const starDefs = [
                { starCount: 1, playerId: game.star_1_id! },
                { starCount: 2, playerId: game.star_2_id! },
                { starCount: 3, playerId: game.star_3_id! },
              ];
              return (
                <Card title="Three Stars">
                  <div className={styles.starsRow}>
                    {starDefs.map(({ starCount, playerId }) => {
                      const player = roster.find((e) => e.player_id === playerId);
                      if (!player) return null;
                      const isAway = player.team_id === game.away_team.id;
                      const teamCode = isAway ? game.away_team.code : game.home_team.code;
                      const primaryColor = isAway
                        ? game.away_team.primary_color
                        : game.home_team.primary_color;
                      const textColor = isAway
                        ? game.away_team.text_color
                        : game.home_team.text_color;
                      const gameStats = playerGameStats.get(playerId) ?? { goals: 0, assists: 0 };
                      const nameLabel = `${player.first_name} ${player.last_name}`;
                      const subLabel = [
                        player.jersey_number != null ? `#${player.jersey_number}` : null,
                        teamCode,
                        player.position ?? null,
                      ]
                        .filter(Boolean)
                        .join(' • ');
                      const gs = goalieStats.find((s) => s.goalie_id === playerId);
                      return (
                        <div
                          key={starCount}
                          className={styles.starItem}
                        >
                          {player.photo ? (
                            <img
                              src={player.photo}
                              alt=""
                              className={styles.starPhoto}
                            />
                          ) : (
                            <span
                              className={styles.starPhotoPlaceholder}
                              style={{ background: primaryColor, color: textColor }}
                            >
                              {player.first_name[0]}
                              {player.last_name[0]}
                            </span>
                          )}
                          <span className={styles.starIcons}>
                            {Array.from({ length: starCount }).map((_, i) => (
                              <Icon
                                key={i}
                                name="stars"
                              />
                            ))}
                          </span>
                          <span className={styles.starName}>{nameLabel}</span>
                          <span className={styles.starTeam}>{subLabel}</span>
                          {player.position === 'G' && gs ? (
                            <span className={styles.starStats}>
                              SA: {gs.shots_against} | SV: {gs.saves}
                            </span>
                          ) : (
                            <span className={styles.starStats}>
                              G: {gameStats.goals} | A: {gameStats.assists}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })()}

          {/* Scoring */}
          <ScoringCard
            game={game}
            goals={goals}
            isFinal={isFinal}
            isInProgress={isInProgress}
            busy={null}
            liveAwayScore={liveAwayScore}
            liveHomeScore={liveHomeScore}
            tallyByGoalId={tallyByGoalId}
            lastCurrentPeriodGoalId={lastCurrentPeriodGoalId}
            attempts={attempts}
            soComplete={soComplete}
            deletingAttemptId={null}
          />

          {/* Goalie Stats */}
          {(isFinal || isInProgress) &&
            (() => {
              const goalies = [...awayRoster, ...homeRoster].filter((e) => e.position === 'G');
              const goaliesWithStats = goalies.filter((g) =>
                goalieStats.some((gs) => gs.goalie_id === g.player_id),
              );
              if (goaliesWithStats.length === 0) return null;
              return (
                <Card title="Goalie Stats">
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
                        const textColor = isAway
                          ? game.away_team.text_color
                          : game.home_team.text_color;
                        const teamLogo = isAway ? game.away_team.logo : game.home_team.logo;
                        const teamCode = isAway ? game.away_team.code : game.home_team.code;
                        const svPct =
                          stat.shots_against > 0
                            ? (stat.saves / stat.shots_against).toFixed(3).replace(/^0/, '')
                            : '1.000';
                        const isBackup = !!stat.entered_period;
                        return (
                          <tr
                            key={goalie.player_id}
                            className={styles.goalieRow}
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
                                    <span className={styles.goalAssists}>
                                      #{goalie.jersey_number}
                                    </span>
                                  )}
                                  <span className={styles.goalScorer}>
                                    {formatPlayerName(goalie.first_name, goalie.last_name)}
                                  </span>
                                  {isBackup && stat.entered_period && (
                                    <span className={styles.goalAssists}>
                                      entered P{stat.entered_period}
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
                </Card>
              );
            })()}

          {/* Previous Meetings */}
          {game.previous_meetings && game.previous_meetings.length > 0 && (
            <Card title="Previous Meetings">
              <div className={styles.prevMeetingsRows}>
                {game.previous_meetings.map((pm: PreviousMeeting) => {
                  const isOT = pm.overtime_periods != null && pm.overtime_periods > 0;
                  const isSO = pm.shootout;
                  const suffix = isSO ? '(SO)' : isOT ? '(OT)' : null;
                  const leftTeam = pm.current_home_was_home
                    ? {
                        code: game.away_team.code,
                        logo: game.away_team.logo,
                        primary: game.away_team.primary_color,
                        text: game.away_team.text_color,
                      }
                    : {
                        code: game.home_team.code,
                        logo: game.home_team.logo,
                        primary: game.home_team.primary_color,
                        text: game.home_team.text_color,
                      };
                  const rightTeam = pm.current_home_was_home
                    ? {
                        code: game.home_team.code,
                        logo: game.home_team.logo,
                        primary: game.home_team.primary_color,
                        text: game.home_team.text_color,
                      }
                    : {
                        code: game.away_team.code,
                        logo: game.away_team.logo,
                        primary: game.away_team.primary_color,
                        text: game.away_team.text_color,
                      };
                  const homeWon = pm.home_score > pm.away_score;
                  const renderLogo = (t: typeof leftTeam) =>
                    t.logo ? (
                      <img
                        src={t.logo}
                        alt={t.code}
                        className={styles.prevMeetingLogo}
                      />
                    ) : (
                      <span
                        className={styles.prevMeetingLogoPlaceholder}
                        style={{ background: t.primary, color: t.text }}
                      >
                        {t.code?.slice(0, 3)}
                      </span>
                    );
                  return (
                    <div
                      key={pm.game_id}
                      className={styles.prevMeetingRow}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/games/${pm.game_id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') navigate(`/games/${pm.game_id}`);
                      }}
                    >
                      {pm.scheduled_at && (
                        <span className={styles.prevMeetingDate}>
                          {DATE_FMT_SHORT.format(new Date(pm.scheduled_at))}
                        </span>
                      )}
                      <span className={styles.prevMeetingTeam}>
                        {renderLogo(leftTeam)}
                        <span className={styles.prevMeetingCode}>{leftTeam.code}</span>
                      </span>
                      <span className={styles.prevMeetingScore}>
                        <span
                          className={
                            homeWon ? styles.prevMeetingScoreDim : styles.prevMeetingScoreBright
                          }
                        >
                          {pm.away_score}
                        </span>
                        <span className={styles.prevMeetingScoreSep}>–</span>
                        <span
                          className={
                            homeWon ? styles.prevMeetingScoreBright : styles.prevMeetingScoreDim
                          }
                        >
                          {pm.home_score}
                        </span>
                        {suffix && <span className={styles.prevMeetingSuffix}>{suffix}</span>}
                      </span>
                      <span className={`${styles.prevMeetingTeam} ${styles.prevMeetingTeamRight}`}>
                        <span className={styles.prevMeetingCode}>{rightTeam.code}</span>
                        {renderLogo(rightTeam)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Last 5 Games */}
          {(game.home_last_five || game.away_last_five) &&
            (() => {
              const awayGames = game.away_last_five ?? [];
              const homeGames = game.home_last_five ?? [];
              const renderListRow = (lg: LastFiveGame) => {
                const isOT = lg.overtime_periods != null && lg.overtime_periods > 0;
                const isSO = lg.shootout;
                const suffix = isSO ? '(SO)' : isOT ? '(OT)' : null;
                const resultClass =
                  lg.result === 'W'
                    ? styles.lastFiveListResultW
                    : lg.result === 'L'
                      ? styles.lastFiveListResultL
                      : styles.lastFiveListResultT;
                return (
                  <div
                    key={lg.game_id}
                    className={styles.lastFiveListRow}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/games/${lg.game_id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') navigate(`/games/${lg.game_id}`);
                    }}
                  >
                    <span className={`${styles.lastFiveListResult} ${resultClass}`}>
                      {lg.result}
                    </span>
                    <span className={styles.lastFiveListLogo}>
                      {lg.opponent_logo ? (
                        <img
                          src={lg.opponent_logo}
                          alt={lg.opponent_code}
                          className={styles.lastFiveListLogoImg}
                        />
                      ) : (
                        <span className={styles.lastFiveListLogoPlaceholder}>
                          {lg.opponent_code?.slice(0, 3)}
                        </span>
                      )}
                    </span>
                    <span className={styles.lastFiveListOpp}>
                      {lg.is_home ? 'vs' : '@'} {lg.opponent_name ?? lg.opponent_code}
                    </span>
                    <span className={styles.lastFiveListScore}>
                      {lg.away_score}–{lg.home_score}
                      {suffix && <span className={styles.lastFiveListSuffix}>{suffix}</span>}
                    </span>
                    {lg.scheduled_at && (
                      <span className={styles.lastFiveListDate}>
                        {DATE_FMT_SHORT.format(new Date(lg.scheduled_at))}
                      </span>
                    )}
                  </div>
                );
              };
              const renderTeamAccordion = (
                label: string,
                logo: string | null,
                code: string,
                primary: string,
                text: string,
                games: LastFiveGame[],
              ) => {
                const { w, otw, otl, l } = buildFormRecord(games);
                return (
                  <Accordion
                    variant="static"
                    label={
                      <span className={styles.linescoreTeam}>
                        {logo ? (
                          <img
                            src={logo}
                            alt={code}
                            className={styles.linescoreLogo}
                          />
                        ) : (
                          <span
                            className={styles.goalTeamLogoPlaceholder}
                            style={{ background: primary, color: text }}
                          >
                            {code?.slice(0, 1)}
                          </span>
                        )}
                        <span>{label}</span>
                      </span>
                    }
                    headerRight={
                      <span className={styles.lastFiveForm}>
                        <Tooltip text="Wins">
                          <span>{w}</span>
                        </Tooltip>
                        <span className={styles.lastFiveFormSep}>-</span>
                        <Tooltip text="OT/SO Wins">
                          <span>{otw}</span>
                        </Tooltip>
                        <span className={styles.lastFiveFormSep}>-</span>
                        <Tooltip text="OT/SO Losses">
                          <span>{otl}</span>
                        </Tooltip>
                        <span className={styles.lastFiveFormSep}>-</span>
                        <Tooltip text="Losses">
                          <span>{l}</span>
                        </Tooltip>
                      </span>
                    }
                  >
                    <div className={styles.lastFiveListRows}>
                      {games.length === 0 ? (
                        <p className={styles.noGoalsText}>No recent games</p>
                      ) : (
                        games.map((lg) => renderListRow(lg))
                      )}
                    </div>
                  </Accordion>
                );
              };
              return (
                <Card
                  title="Last 5 Games"
                  action={
                    <div className={styles.lastFiveViewToggle}>
                      <Button
                        variant="ghost"
                        intent={lastFiveView === 'list' ? 'accent' : 'neutral'}
                        icon="view_list"
                        size="sm"
                        tooltip="List view"
                        onClick={() => setLastFiveView('list')}
                      />
                      <Button
                        variant="ghost"
                        intent={lastFiveView === 'square' ? 'accent' : 'neutral'}
                        icon="grid_view"
                        size="sm"
                        tooltip="Grid view"
                        onClick={() => setLastFiveView('square')}
                      />
                    </div>
                  }
                >
                  <div className={styles.lastFiveList}>
                    <div className={styles.lastFiveTeamCol}>
                      {renderTeamAccordion(
                        game.away_team.name,
                        game.away_team.logo,
                        game.away_team.code,
                        game.away_team.primary_color,
                        game.away_team.text_color,
                        awayGames,
                      )}
                    </div>
                    <div className={styles.lastFiveTeamCol}>
                      {renderTeamAccordion(
                        game.home_team.name,
                        game.home_team.logo,
                        game.home_team.code,
                        game.home_team.primary_color,
                        game.home_team.text_color,
                        homeGames,
                      )}
                    </div>
                  </div>
                </Card>
              );
            })()}
        </div>
        {/* end summaryLeft */}

        {/* ── Right column: Linescore + Shots + Game Info ── */}
        <div className={styles.summaryRight}>
          <Card
            title="Linescore"
            action={
              isFinal ? (
                <Button
                  variant="outlined"
                  intent="neutral"
                  icon="download"
                  size="sm"
                  tooltip="Download score card"
                  onClick={() => setScoreImageOpen(true)}
                />
              ) : undefined
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
                      {p.label}
                    </th>
                  ))}
                  <th className={styles.thTotal}>T</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const currentPeriodIdx = PERIOD_IDS.indexOf(
                    game.current_period as '1' | '2' | '3',
                  );
                  return [
                    {
                      teamId: game.away_team.id,
                      teamCode: game.away_team.code,
                      teamLogo: game.away_team.logo,
                      primaryColor: game.away_team.primary_color,
                      textColor: game.away_team.text_color,
                      total: liveAwayScore,
                      isLoser: isFinal && liveAwayScore < liveHomeScore,
                    },
                    {
                      teamId: game.home_team.id,
                      teamCode: game.home_team.code,
                      teamLogo: game.home_team.logo,
                      primaryColor: game.home_team.primary_color,
                      textColor: game.home_team.text_color,
                      total: liveHomeScore,
                      isLoser: isFinal && liveHomeScore < liveAwayScore,
                    },
                  ].map((row) => (
                    <tr key={row.teamId}>
                      <td className={styles.tdTeam}>
                        <span className={styles.linescoreTeam}>
                          {row.teamLogo ? (
                            <img
                              src={row.teamLogo}
                              alt={row.teamCode}
                              className={styles.linescoreLogo}
                            />
                          ) : (
                            <span
                              className={styles.linescoreLogoPlaceholder}
                              style={{ background: row.primaryColor, color: row.textColor }}
                            >
                              {row.teamCode?.slice(0, 1)}
                            </span>
                          )}
                          <span className={styles.linescoreCode}>{row.teamCode}</span>
                        </span>
                      </td>
                      {linescorePeriods.map((p) => {
                        const ps = game.period_scores.find((s) => s.period === p.id);
                        const pIdx = PERIOD_IDS.indexOf(p.id as '1' | '2' | '3');
                        const isPeriodDone =
                          isFinal || (pIdx >= 0 ? currentPeriodIdx > pIdx : true);
                        if (p.id === 'SO') {
                          const teamAttempts = attempts.filter((a) => a.team_id === row.teamId);
                          return (
                            <td
                              key={p.id}
                              className={styles.tdGoals}
                            >
                              {teamAttempts.length > 0
                                ? `${teamAttempts.filter((a) => a.scored).length}/${teamAttempts.length}`
                                : '—'}
                            </td>
                          );
                        }
                        const rawGoals =
                          row.teamId === game.away_team.id ? ps?.away_goals : ps?.home_goals;
                        return (
                          <td
                            key={p.id}
                            className={styles.tdGoals}
                          >
                            {rawGoals ?? (isPeriodDone ? 0 : '—')}
                          </td>
                        );
                      })}
                      <td
                        className={`${styles.tdTotal}${row.isLoser ? ` ${styles.scoreNumberLoser}` : ''}`}
                      >
                        {row.total}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </Card>

          {/* ── Shots breakdown card ── */}
          {(game.period_shots.length > 0 || isInProgress || isFinal) && (
            <Card title="Shots">
              <table className={styles.periodsTable}>
                <thead>
                  <tr>
                    <th className={styles.thTeam}></th>
                    {linescorePeriods
                      .filter((p) => p.id !== 'SO')
                      .map((p) => (
                        <th
                          key={p.id}
                          className={styles.thPeriod}
                        >
                          {p.label}
                        </th>
                      ))}
                    <th className={styles.thTotal}>T</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      key: 'away',
                      isAway: true,
                      logo: game.away_team.logo,
                      code: game.away_team.code,
                      primary: game.away_team.primary_color,
                      text: game.away_team.text_color,
                    },
                    {
                      key: 'home',
                      isAway: false,
                      logo: game.home_team.logo,
                      code: game.home_team.code,
                      primary: game.home_team.primary_color,
                      text: game.home_team.text_color,
                    },
                  ].map((row) => (
                    <tr key={row.key}>
                      <td className={styles.tdTeam}>
                        <span className={styles.linescoreTeam}>
                          {row.logo ? (
                            <img
                              src={row.logo}
                              alt={row.code}
                              className={styles.linescoreLogo}
                            />
                          ) : (
                            <span
                              className={styles.linescoreLogoPlaceholder}
                              style={{ background: row.primary, color: row.text }}
                            >
                              {row.code?.slice(0, 1)}
                            </span>
                          )}
                          <span className={styles.linescoreCode}>{row.code}</span>
                        </span>
                      </td>
                      {linescorePeriods
                        .filter((p) => p.id !== 'SO')
                        .map((p) => {
                          const ps = game.period_shots.find((s) => s.period === p.id);
                          const shots = row.isAway ? ps?.away_shots : ps?.home_shots;
                          return (
                            <td
                              key={p.id}
                              className={styles.tdGoals}
                            >
                              {shots ?? '—'}
                            </td>
                          );
                        })}
                      <td className={styles.tdTotal}>
                        {game.period_shots.reduce(
                          (sum, ps) => sum + (row.isAway ? ps.away_shots : ps.home_shots),
                          0,
                        ) || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* ── Game Info card ── */}
          <Card title="Game Info">
            <div className={styles.infoGrid}>
              <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
                <span className={styles.infoLabel}>Type</span>
                <span className={styles.infoValue}>{GAME_TYPE_LABEL[game.game_type]}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Scheduled Date</span>
                <span className={game.scheduled_at ? styles.infoValue : styles.infoValueMuted}>
                  {game.scheduled_at ? DATE_FMT_SHORT.format(new Date(game.scheduled_at)) : '—'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Scheduled Time</span>
                <span className={game.scheduled_time ? styles.infoValue : styles.infoValueMuted}>
                  {game.scheduled_time
                    ? formatScheduledTime(game.scheduled_time, game.scheduled_at)
                    : '—'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Start Time</span>
                <span className={game.time_start ? styles.infoValue : styles.infoValueMuted}>
                  {game.time_start ? TIME_FMT.format(new Date(game.time_start)) : '—'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>End Time</span>
                <span className={game.time_end ? styles.infoValue : styles.infoValueMuted}>
                  {game.time_end ? TIME_FMT.format(new Date(game.time_end)) : '—'}
                </span>
              </div>
              <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
                <span className={styles.infoLabel}>Venue</span>
                <span className={game.venue ? styles.infoValue : styles.infoValueMuted}>
                  {game.venue ?? '—'}
                </span>
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
        </div>
      </div>

      {/* ── Score image modal ── */}
      {isFinal && (
        <ScoreImageModal
          game={game}
          liveAwayScore={liveAwayScore}
          liveHomeScore={liveHomeScore}
          overtimeSuffix={overtimeSuffix}
          open={scoreImageOpen}
          onClose={() => setScoreImageOpen(false)}
        />
      )}
    </>
  );
};

export default UserGameDetailsPage;
