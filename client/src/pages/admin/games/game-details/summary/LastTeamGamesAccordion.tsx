import Accordion from '@/components/Accordion/Accordion';
import Tooltip from '@/components/Tooltip/Tooltip';
import type { LastFiveGame } from '@/hooks/useGames';
import { buildFormRecord } from '../gameUtils';
import LastGameList from './LastGameList';
import LastGameSquare from './LastGameSquare';
import styles from './LastFiveCard.module.scss';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  label: string;
  logo: string | null;
  code: string;
  primary: string;
  text: string;
  games: LastFiveGame[];
  view: 'list' | 'square';
  onNavigate: (gameId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LastTeamGamesAccordion({
  label,
  logo,
  code,
  primary,
  text,
  games,
  view,
  onNavigate,
}: Props) {
  const { w, otw, otl, l } = buildFormRecord(games);

  return (
    <Accordion
      variant="static"
      label={
        <span className={styles.linescoreTeam}>
          {logo ? (
            <img src={logo} alt={code} className={styles.linescoreLogo} />
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
      {games.length === 0 ? (
        <p className={styles.noGoalsText}>No recent games</p>
      ) : view === 'list' ? (
        <div className={styles.lastFiveListRows}>
          {games.map((lg) => (
            <LastGameList key={lg.game_id} lg={lg} onNavigate={onNavigate} />
          ))}
        </div>
      ) : (
        <div className={styles.lastFiveGames}>
          {games.map((lg) => (
            <LastGameSquare
              key={lg.game_id}
              lg={lg}
              teamPrimary={primary}
              teamText={text}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </Accordion>
  );
}
