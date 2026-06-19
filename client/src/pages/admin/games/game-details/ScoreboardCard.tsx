import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '@/components/Badge/Badge';
import Card from '@/components/Card/Card';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import type { GameRecord, GameStatus } from '@/hooks/useGames';
import { buildTeamDetailsPath } from '@/lib/routeSlugs';
import styles from './ScoreboardCard.module.scss';

// ── Constants ─────────────────────────────────────────────────────────────────

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

const STATUS_INTENT: Record<GameStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  scheduled: 'info',
  in_progress: 'warning',
  final: 'success',
  postponed: 'warning',
  cancelled: 'danger',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  isFinal: boolean;
  isInProgress: boolean;
  isEditMode?: boolean;
  liveAwayScore: number;
  liveHomeScore: number;
  overtimeSuffix: string;
  /** When omitted, team logo buttons don't navigate anywhere (read-only user view). */
  leagueId?: string;
  leagueCode?: string | null;
  disabled?: boolean;
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

const teamPlaceLabel = (team: GameRecord['home_team']) => team.place_name?.trim() || '';
const teamNameLabel = (team: GameRecord['home_team']) =>
  team.team_name?.trim() || team.name?.trim() || team.code;

// ── Component ─────────────────────────────────────────────────────────────────

// Walk up the DOM to find the nearest scrollable ancestor.
const getScrollParent = (el: HTMLElement): HTMLElement => {
  let p = el.parentElement;
  while (p) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
    p = p.parentElement;
  }
  return document.documentElement;
};

const ScoreboardCard = ({
  game,
  isFinal,
  isInProgress,
  liveAwayScore,
  liveHomeScore,
  overtimeSuffix,
  leagueId,
  leagueCode,
  disabled = false,
}: Props) => {
  const navigate = useNavigate();

  // sentinelRef: zero-height div that stays in-place at all times so we can
  // track where the card's natural top is relative to the viewport.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  // Detect when the sentinel's top edge passes under the PageHeader.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const isMobile = () => window.innerWidth <= 768;
    const headerHeight = () => (isMobile() ? 88 : 52);
    const scrollEl = getScrollParent(sentinel);

    const check = () => {
      if (isMobile()) {
        setIsStuck(false);
        return;
      }
      const rect = sentinel.getBoundingClientRect();
      setIsStuck(rect.top <= headerHeight());
    };

    scrollEl.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    check(); // evaluate immediately on mount

    return () => {
      scrollEl.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  const card = (
    <Card
      className={[styles.scoreboardCard, isStuck ? styles.scoreboardCardStuck : '']
        .filter(Boolean)
        .join(' ')}
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
            } as React.CSSProperties
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
              leagueId && !disabled
                ? () =>
                    navigate(
                      buildTeamDetailsPath({
                        leagueCode,
                        leagueId,
                        teamCode: game.away_team.code,
                        teamId: game.away_team.id,
                      }),
                    )
                : undefined
            }
          >
            <TeamLogo
              logo={game.away_team.logo}
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
          {(isFinal || isInProgress) && (
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
          )}
          <div className={styles.scoreBlock}>
            {game.playoff_round != null && (
              <span className={styles.scoreMeta}>
                {(() => {
                  const roundLabel =
                    game.playoff_round_names?.[game.playoff_round] ?? `Round ${game.playoff_round}`;
                  return game.game_number_in_series != null
                    ? `${roundLabel} · Game ${game.game_number_in_series}`
                    : roundLabel;
                })()}
              </span>
            )}
            {isFinal ? (
              <Badge
                label={`Final${overtimeSuffix}`}
                intent="success"
              />
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
          {(isFinal || isInProgress) && (
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
          )}
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
            } as React.CSSProperties
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
              leagueId && !disabled
                ? () =>
                    navigate(
                      buildTeamDetailsPath({
                        leagueCode,
                        leagueId,
                        teamCode: game.home_team.code,
                        teamId: game.home_team.id,
                      }),
                    )
                : undefined
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
    </Card>
  );

  return (
    <>
      {/* Sentinel stays in the natural position at all times for scroll tracking */}
      <div
        ref={sentinelRef}
        style={{ height: 0 }}
      />
      {card}
    </>
  );
};

export default ScoreboardCard;
