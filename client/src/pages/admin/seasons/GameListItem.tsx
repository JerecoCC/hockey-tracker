import { Link } from 'react-router-dom';
import ActionOverlay from '@/components/ActionOverlay/ActionOverlay';
import Badge from '@/components/Badge/Badge';
import type { BadgeIntent } from '@/components/Badge/Badge';
import Button from '@/components/Button/Button';
import type { ButtonIntent } from '@/components/Button/Button';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import type { GameType } from '@/hooks/useGames';
import styles from './GameListItem.module.scss';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GameListItemAction {
  icon: string;
  intent?: ButtonIntent;
  tooltip?: string;
  disabled?: boolean;
  onClick: () => void;
}

interface TeamInfo {
  logo: string | null;
  code: string;
  primaryColor: string;
  textColor: string;
}

interface Props {
  awayTeam: TeamInfo;
  homeTeam: TeamInfo;
  /** Scores derived from period_scores totals. */
  awayScore: number;
  homeScore: number;
  /** When true the scores are rendered; false hides the score column. */
  showScore: boolean;
  /** When true winner/loser dimming is applied based on score comparison. */
  isFinal: boolean;
  statusLabel: string;
  statusIntent: BadgeIntent;
  /** Formatted date string e.g. "Oct 5, 2024" */
  date?: string;
  /** Time string as stored e.g. "19:30" */
  time?: string;
  /** Venue / arena name */
  venue?: string;
  /** Playoff round number (1–4) */
  round?: number | null;
  /** Custom display label for the playoff round (overrides "Round N" when provided). */
  roundLabel?: string | null;
  /** Game number within a playoff series (1–7) */
  gameNumberInSeries?: number | null;
  /** Sequential game number within the regular season */
  gameNumber?: number | null;
  gameType?: GameType;
  /** When provided, renders a stretched anchor so the item can be right-clicked to open in a new tab. */
  href?: string;
  actions?: (GameListItemAction | false | null | undefined)[];
}

// ── Internal: small team logo block ──────────────────────────────────────────

// ── Component ─────────────────────────────────────────────────────────────────

const GAME_TYPE_CLASS: Record<GameType, string> = {
  preseason: styles.typePreseason,
  regular: styles.typeRegular,
  playoff: styles.typePlayoff,
};

const GameListItem = ({
  awayTeam,
  homeTeam,
  awayScore,
  homeScore,
  showScore,
  isFinal,
  statusLabel,
  statusIntent,
  date,
  time,
  venue,
  round,
  roundLabel,
  gameNumberInSeries,
  gameNumber,
  gameType,
  href,
  actions,
}: Props) => {
  const visibleActions = actions?.filter((a): a is GameListItemAction => Boolean(a)) ?? [];

  const awayLost = isFinal && awayScore < homeScore;
  const homeLost = isFinal && homeScore < awayScore;

  const dateLine = [date, time].filter(Boolean).join(' • ') || 'TBD';

  // Secondary meta line shown in the middle column.
  // Playoff games: "Quarterfinals · Game 3" (or "Round 1 · Game 3")  Regular games: "Game 12"
  const resolvedRoundLabel = round != null ? (roundLabel ?? `Round ${round}`) : null;
  const metaLine =
    resolvedRoundLabel == null && gameNumberInSeries != null
      ? `Game ${gameNumberInSeries}`
      : resolvedRoundLabel != null && gameNumberInSeries != null
      ? `${resolvedRoundLabel} · Game ${gameNumberInSeries}`
      : resolvedRoundLabel != null && round != null
        ? resolvedRoundLabel
        : gameNumber != null
          ? `Game ${gameNumber}`
          : null;

  const itemClass = [styles.item, gameType && GAME_TYPE_CLASS[gameType]].filter(Boolean).join(' ');

  return (
    <li className={itemClass}>
      {href && (
        <Link
          to={href}
          className={styles.itemLink}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
      {/* Main: date line + stacked teams */}
      <div className={styles.main}>
        <span className={styles.dateLine}>{dateLine}</span>

        {/* Away row */}
        <div className={[styles.teamRow, awayLost && styles.teamLoser].filter(Boolean).join(' ')}>
          <TeamLogo
            {...awayTeam}
            size={24}
            shape="circle"
          />
          <span className={styles.teamCode}>{awayTeam.code}</span>
          {showScore && (
            <span
              className={[styles.scoreNum, awayLost && styles.scoreLoser].filter(Boolean).join(' ')}
            >
              {awayScore}
            </span>
          )}
        </div>

        {/* Home row */}
        <div className={[styles.teamRow, homeLost && styles.teamLoser].filter(Boolean).join(' ')}>
          <TeamLogo
            {...homeTeam}
            size={24}
            shape="circle"
          />
          <span className={styles.teamCode}>{homeTeam.code}</span>
          {showScore && (
            <span
              className={[styles.scoreNum, homeLost && styles.scoreLoser].filter(Boolean).join(' ')}
            >
              {homeScore}
            </span>
          )}
        </div>
      </div>

      {/* Middle — always present so the badge is always pushed to the right */}
      <div className={styles.middle}>
        {metaLine && <b className={styles.metaLine}>{metaLine}</b>}
        {venue && <span className={styles.venue}>{venue}</span>}
      </div>

      {/* Status badge — rightmost */}
      <Badge
        label={statusLabel}
        intent={statusIntent}
      />

      {/* Hover-revealed actions */}
      {visibleActions.length > 0 && (
        <ActionOverlay className={styles.actions}>
          {visibleActions.map((action, i) => (
            <Button
              key={i}
              variant="outlined"
              intent={action.intent ?? 'neutral'}
              icon={action.icon}
              size="sm"
              tooltip={action.tooltip}
              disabled={action.disabled}
              onClick={action.onClick}
            />
          ))}
        </ActionOverlay>
      )}
    </li>
  );
};

export default GameListItem;
