import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import Tag from '@jerecocc/tracker-ui/components/Tag/Tag';
import Tooltip from '@jerecocc/tracker-ui/components/Tooltip/Tooltip';
import StickyHeroCard from '@jerecocc/tracker-ui/components/StickyHeroCard/StickyHeroCard';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import type { GameStatus, TeamInfo } from '@/hooks/useGames';
import { GAME_STATUS_TAG_INTENT } from '@/lib/gamePresentation';
import { buildTeamDetailsPath, buildUserTeamDetailsPath } from '@/lib/routeSlugs';
import {
  DATE_FMT_LONG,
  LOCAL_DATE_FMT_LONG,
  formatScheduledDate,
  formatScheduledDateLocal,
} from './formatUtils';
import { getPlayoffScoreMetaDisplay } from './playoffScoreMeta';
import styles from './ScoreboardCard.module.scss';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<GameStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  final: 'Final',
  postponed: 'Postponed',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface ScoreboardGame {
  status: GameStatus;
  scheduled_at: string | null;
  scheduled_time?: string | null;
  playoff_round?: number | null;
  playoff_round_names?: Record<string, string> | null;
  playoff_matchup_names?: Record<string, string> | null;
  bracket_slot_key?: string | null;
  game_number_in_series?: number | null;
  home_team: TeamInfo;
  away_team: TeamInfo;
}

interface Props {
  game: ScoreboardGame;
  isFinal: boolean;
  isInProgress: boolean;
  isEditMode?: boolean;
  liveAwayScore: number;
  liveHomeScore: number;
  seriesScore?: {
    awayWins: number;
    homeWins: number;
    winsNeeded: number;
  };
  overtimeSuffix: string;
  /** When omitted, team logo buttons don't navigate anywhere. */
  leagueId?: string;
  leagueCode?: string | null;
  mode?: 'admin' | 'user';
  disabled?: boolean;
  useLocalTimezone?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** WCAG relative luminance of a hex color. */
function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * toLinear(parseInt(h.slice(0, 2), 16)) +
    0.7152 * toLinear(parseInt(h.slice(2, 4), 16)) +
    0.0722 * toLinear(parseInt(h.slice(4, 6), 16))
  );
}

/** WCAG contrast ratio between two hex colors (1–21). */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Returns a shadow color string when the text/background contrast is below
 * the threshold (default 3.0), or 'transparent' when contrast is sufficient.
 */
function teamTextShadow(textHex: string, bgHex: string, threshold = 3): string {
  return contrastRatio(textHex, bgHex) < threshold ? 'rgba(0,0,0,0.75)' : 'transparent';
}

const teamPlaceLabel = (team: TeamInfo) => team.place_name?.trim() || '';
const teamNameLabel = (team: TeamInfo) => team.team_name?.trim() || team.name?.trim() || team.code;
const teamScoreLabel = (team: TeamInfo) => team.name?.trim() || teamNameLabel(team);
const clampSeriesWins = (wins: number, total: number) =>
  Math.min(Math.max(Math.trunc(wins), 0), total);

const SeriesScoreDots = ({
  label,
  wins,
  total,
  isLoser,
}: {
  label: string;
  wins: number;
  total: number;
  isLoser: boolean;
}) => {
  const safeWins = clampSeriesWins(wins, total);

  return (
    <span
      role="img"
      aria-label={`${label} series wins ${safeWins} of ${total}`}
      className={[styles.scoreSeriesDots, isLoser ? styles.scoreSeriesDotsLoser : '']
        .filter(Boolean)
        .join(' ')}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={[styles.scoreSeriesDot, index < safeWins ? styles.scoreSeriesDotFilled : '']
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </span>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const ScoreboardCard = ({
  game,
  isFinal,
  isInProgress,
  liveAwayScore,
  liveHomeScore,
  seriesScore,
  overtimeSuffix,
  leagueId,
  leagueCode,
  mode = 'admin',
  disabled = false,
  useLocalTimezone = false,
}: Props) => {
  const navigate = useNavigate();
  const playoffScoreMeta = getPlayoffScoreMetaDisplay(game);
  const seriesWinsNeeded =
    seriesScore && Number.isFinite(seriesScore.winsNeeded)
      ? Math.max(Math.trunc(seriesScore.winsNeeded), 0)
      : 0;
  const showSeriesScoreDots = !!seriesScore && seriesWinsNeeded > 0;
  const showNumberScore = !showSeriesScoreDots && (isFinal || isInProgress);
  const buildTeamPath = (team: TeamInfo) =>
    mode === 'user'
      ? buildUserTeamDetailsPath({
          leagueCode,
          leagueId,
          teamCode: team.code,
          teamId: team.id,
        })
      : buildTeamDetailsPath({
          leagueCode,
          leagueId,
          teamCode: team.code,
          teamId: team.id,
        });

  return (
    <StickyHeroCard
      className={styles.scoreboardCard}
      stuckClassName={styles.scoreboardCardStuck}
      style={{ padding: 0 }}
    >
      <div className={styles.scoreboard}>
        {/* ── Away side ── */}
        <div
          className={[
            styles.teamSide,
            isFinal && liveAwayScore < liveHomeScore ? styles.teamSideLoser : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={
            {
              '--team-primary': game.away_team.primary_color,
              '--team-secondary': game.away_team.secondary_color,
              '--team-text': game.away_team.text_color,
              '--team-text-shadow': teamTextShadow(
                game.away_team.text_color,
                game.away_team.primary_color,
              ),
            } as CSSProperties
          }
        >
          <div className={styles.teamStripe}>
            <div
              className={styles.teamStripePrimary}
              style={{ background: game.away_team.primary_color }}
            />
            <div
              className={styles.teamStripeSecondary}
              style={{ background: game.away_team.text_color }}
            />
            <div
              className={styles.teamStripeSecondary2}
              style={{ background: game.away_team.text_color }}
            />
          </div>
          <button
            type="button"
            className={styles.teamLogoBtn}
            disabled={disabled}
            onClick={
              leagueId && !disabled ? () => navigate(buildTeamPath(game.away_team)) : undefined
            }
          >
            <TeamLogo
              logo={game.away_team.logo}
              logoDark={game.away_team.logo_dark}
              logoLight={game.away_team.logo_light}
              code={game.away_team.code}
              primaryColor={game.away_team.primary_color}
              textColor={game.away_team.text_color}
              size={60}
              shape={game.away_team.logo ? 'square' : 'circle'}
              className={styles.teamLogoResponsive}
            />
            <div className={styles.teamInfo}>
              {teamPlaceLabel(game.away_team) && (
                <span className={styles.teamPlaceName}>{teamPlaceLabel(game.away_team)}</span>
              )}
              <span className={styles.teamFullName}>{teamNameLabel(game.away_team)}</span>
              <span className={styles.teamMobileCode}>{game.away_team.code}</span>
            </div>
          </button>
          {/* Right stripe — stacked mode only */}
          <div className={`${styles.teamStripe} ${styles.teamStripeRight}`}>
            <div
              className={styles.teamStripePrimary}
              style={{ background: game.away_team.primary_color }}
            />
            <div
              className={styles.teamStripeSecondary}
              style={{ background: game.away_team.text_color }}
            />
            <div
              className={styles.teamStripeSecondary2}
              style={{ background: game.away_team.text_color }}
            />
          </div>
        </div>

        {/* ── Center: score + status ── */}
        <div className={styles.scoreCenter}>
          {showSeriesScoreDots ? (
            <SeriesScoreDots
              label={teamScoreLabel(game.away_team)}
              wins={seriesScore.awayWins}
              total={seriesWinsNeeded}
              isLoser={isFinal && liveAwayScore < liveHomeScore}
            />
          ) : showNumberScore ? (
            <span
              className={[
                styles.scoreNumber,
                isFinal && liveAwayScore < liveHomeScore ? styles.scoreNumberLoser : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {liveAwayScore}
            </span>
          ) : null}
          <div className={styles.scoreBlock}>
            {playoffScoreMeta &&
              (playoffScoreMeta.tooltip ? (
                <Tooltip
                  text={playoffScoreMeta.tooltip}
                  className={styles.scoreMetaTooltip}
                >
                  <span
                    className={styles.scoreMeta}
                    aria-label={playoffScoreMeta.tooltip}
                  >
                    {playoffScoreMeta.label}
                  </span>
                </Tooltip>
              ) : (
                <span className={styles.scoreMeta}>{playoffScoreMeta.label}</span>
              ))}
            {isFinal ? (
              <Tag
                label={`Final${overtimeSuffix}`}
                intent={GAME_STATUS_TAG_INTENT.final}
              />
            ) : (
              <Tag
                label={STATUS_LABEL[game.status]}
                intent={GAME_STATUS_TAG_INTENT[game.status]}
              />
            )}
            {game.scheduled_at && (
              <span className={styles.scoreDate}>
                {useLocalTimezone
                  ? formatScheduledDateLocal(
                      game.scheduled_at,
                      game.scheduled_time,
                      LOCAL_DATE_FMT_LONG,
                    )
                  : formatScheduledDate(game.scheduled_at, DATE_FMT_LONG)}
              </span>
            )}
          </div>
          {showSeriesScoreDots ? (
            <SeriesScoreDots
              label={teamScoreLabel(game.home_team)}
              wins={seriesScore.homeWins}
              total={seriesWinsNeeded}
              isLoser={isFinal && liveHomeScore < liveAwayScore}
            />
          ) : showNumberScore ? (
            <span
              className={[
                styles.scoreNumber,
                isFinal && liveHomeScore < liveAwayScore ? styles.scoreNumberLoser : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {liveHomeScore}
            </span>
          ) : null}
        </div>

        {/* ── Home side ── */}
        <div
          className={[
            styles.teamSide,
            styles.teamSideHome,
            isFinal && liveHomeScore < liveAwayScore ? styles.teamSideLoser : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={
            {
              '--team-primary': game.home_team.primary_color,
              '--team-secondary': game.home_team.secondary_color,
              '--team-text': game.home_team.text_color,
              '--team-text-shadow': teamTextShadow(
                game.home_team.text_color,
                game.home_team.primary_color,
              ),
            } as CSSProperties
          }
        >
          <div className={`${styles.teamStripe} ${styles.teamStripeHome}`}>
            <div
              className={styles.teamStripePrimary}
              style={{ background: game.home_team.primary_color }}
            />
            <div
              className={styles.teamStripeSecondary}
              style={{ background: game.home_team.text_color }}
            />
            <div
              className={styles.teamStripeSecondary2}
              style={{ background: game.home_team.text_color }}
            />
          </div>
          <button
            type="button"
            className={`${styles.teamLogoBtn} ${styles.teamLogoBtnHome}`}
            disabled={disabled}
            onClick={
              leagueId && !disabled ? () => navigate(buildTeamPath(game.home_team)) : undefined
            }
          >
            <div className={`${styles.teamInfo} ${styles.teamInfoHome}`}>
              {teamPlaceLabel(game.home_team) && (
                <span className={styles.teamPlaceName}>{teamPlaceLabel(game.home_team)}</span>
              )}
              <span className={styles.teamFullName}>{teamNameLabel(game.home_team)}</span>
              <span className={styles.teamMobileCode}>{game.home_team.code}</span>
            </div>
            <TeamLogo
              logo={game.home_team.logo}
              logoDark={game.home_team.logo_dark}
              logoLight={game.home_team.logo_light}
              code={game.home_team.code}
              primaryColor={game.home_team.primary_color}
              textColor={game.home_team.text_color}
              size={60}
              shape={game.home_team.logo ? 'square' : 'circle'}
              className={styles.teamLogoResponsive}
            />
          </button>
          {/* Right stripe — stacked mode only */}
          <div className={`${styles.teamStripe} ${styles.teamStripeRight}`}>
            <div
              className={styles.teamStripePrimary}
              style={{ background: game.home_team.primary_color }}
            />
            <div
              className={styles.teamStripeSecondary}
              style={{ background: game.home_team.text_color }}
            />
            <div
              className={styles.teamStripeSecondary2}
              style={{ background: game.home_team.text_color }}
            />
          </div>
        </div>
      </div>
    </StickyHeroCard>
  );
};

export default ScoreboardCard;
