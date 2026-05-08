import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Badge from '@/components/Badge/Badge';
import Card from '@/components/Card/Card';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import { useScoreboardPortalContainer } from '@/context/ScoreboardPortalContext';
import type { GameRecord, GameStatus } from '@/hooks/useGames';
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
  liveAwayScore: number;
  liveHomeScore: number;
  overtimeSuffix: string;
  /** When omitted, team logo buttons don't navigate anywhere (read-only user view). */
  leagueId?: string;
}

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
}: Props) => {
  const navigate = useNavigate();
  const portalContainer = useScoreboardPortalContainer();

  // sentinelRef: zero-height div that stays in-place at all times so we can
  // track where the card's natural top is relative to the viewport.
  const sentinelRef = useRef<HTMLDivElement>(null);
  // wrapperRef: wraps the Card when rendered in-place; used to measure height.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);

  // Track card height so the placeholder keeps the layout intact while portaled.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver(() => setCardHeight(wrapper.offsetHeight));
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [isStuck]); // re-run when card mounts / unmounts (isStuck toggles)

  // Detect when the sentinel's top edge passes under the PageHeader.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !portalContainer) return;

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
  }, [portalContainer]);

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
              '--team-text': game.away_team.text_color,
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
            onClick={
              leagueId
                ? () => navigate(`/admin/leagues/${leagueId}/teams/${game.away_team.id}`)
                : undefined
            }
          >
            <TeamLogo
              logo={game.away_team.logo}
              code={game.away_team.code}
              primaryColor={game.away_team.primary_color}
              textColor={game.away_team.text_color}
              size={68}
              shape="circle"
              className={styles.teamLogoResponsive}
            />
            <div className={styles.teamInfo}>
              <span className={styles.teamFullName}>{game.away_team.name}</span>
              <span className={styles.teamSubInfo}>{game.away_team.code}</span>
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
              '--team-text': game.home_team.text_color,
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
            onClick={
              leagueId
                ? () => navigate(`/admin/leagues/${leagueId}/teams/${game.home_team.id}`)
                : undefined
            }
          >
            <div className={`${styles.teamInfo} ${styles.teamInfoHome}`}>
              <span className={styles.teamFullName}>{game.home_team.name}</span>
              <span className={styles.teamSubInfo}>{game.home_team.code}</span>
            </div>
            <TeamLogo
              logo={game.home_team.logo}
              code={game.home_team.code}
              primaryColor={game.home_team.primary_color}
              textColor={game.home_team.text_color}
              size={68}
              shape="circle"
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
      {isStuck ? (
        <>
          {/* Placeholder preserves the space the card occupied so content below doesn't jump */}
          <div
            style={{ height: cardHeight }}
            aria-hidden="true"
          />
          {portalContainer && createPortal(card, portalContainer)}
        </>
      ) : (
        <div ref={wrapperRef}>{card}</div>
      )}
    </>
  );
};

export default ScoreboardCard;
