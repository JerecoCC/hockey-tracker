import ActionOverlay from '../../../components/ActionOverlay/ActionOverlay';
import Badge from '../../../components/Badge/Badge';
import type { BadgeIntent } from '../../../components/Badge/Badge';
import Button from '../../../components/Button/Button';
import type { ButtonIntent } from '../../../components/Button/Button';
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
  /** When true the scores are rendered; false shows a 'vs' separator instead. */
  showScore: boolean;
  /** When true winner/loser dimming is applied based on score comparison. */
  isFinal: boolean;
  statusLabel: string;
  statusIntent: BadgeIntent;
  subtitle?: string;
  actions?: (GameListItemAction | false | null | undefined)[];
}

// ── Internal: small team logo block ──────────────────────────────────────────

const TeamLogo = ({ logo, code, primaryColor, textColor }: TeamInfo) =>
  logo ? (
    <img
      src={logo}
      alt={code}
      className={styles.logo}
    />
  ) : (
    <span
      className={styles.logoPlaceholder}
      style={{ background: primaryColor, color: textColor }}
    >
      {code.slice(0, 3)}
    </span>
  );

// ── Component ─────────────────────────────────────────────────────────────────

const GameListItem = ({
  awayTeam,
  homeTeam,
  awayScore,
  homeScore,
  showScore,
  isFinal,
  statusLabel,
  statusIntent,
  subtitle,
  actions,
}: Props) => {
  const visibleActions = actions?.filter((a): a is GameListItemAction => Boolean(a)) ?? [];

  const awayLost = isFinal && awayScore < homeScore;
  const homeLost = isFinal && homeScore < awayScore;

  return (
    <li className={styles.item}>
      {/* Main content: matchup + subtitle */}
      <div className={styles.content}>
        <div className={styles.matchup}>
          {/* Away */}
          <div className={[styles.team, awayLost && styles.teamLoser].filter(Boolean).join(' ')}>
            <TeamLogo {...awayTeam} />
            <span className={styles.teamCode}>{awayTeam.code}</span>
          </div>

          {/* Score or 'vs' */}
          <div className={styles.scoreArea}>
            {showScore ? (
              <>
                <span
                  className={[styles.scoreNum, awayLost && styles.scoreLoser]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {awayScore}
                </span>
                <span className={styles.scoreSep}>–</span>
                <span
                  className={[styles.scoreNum, homeLost && styles.scoreLoser]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {homeScore}
                </span>
              </>
            ) : (
              <span className={styles.scoreSep}>vs</span>
            )}
          </div>

          {/* Home */}
          <div className={[styles.team, homeLost && styles.teamLoser].filter(Boolean).join(' ')}>
            <TeamLogo {...homeTeam} />
            <span className={styles.teamCode}>{homeTeam.code}</span>
          </div>
        </div>

        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>

      {/* Status badge */}
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
