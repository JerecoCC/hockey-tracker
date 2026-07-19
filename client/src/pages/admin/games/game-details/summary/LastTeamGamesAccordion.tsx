import Accordion from '@jerecocc/tracker-ui/components/Accordion/Accordion';
import Tooltip from '@jerecocc/tracker-ui/components/Tooltip/Tooltip';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import type { LastFiveGame } from '@/hooks/useGames';
import { buildFormRecord } from '../gameUtils';
import LastGameList from './LastGameList';
import LastGameSquare from './LastGameSquare';
import styles from './LastFiveCard.module.scss';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  label: string;
  logo: string | null;
  logoDark?: string | null;
  logoLight?: string | null;
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
  logoDark,
  logoLight,
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
      mode="static"
      headerVariant="light"
      label={
        <span className={styles.lastFiveTeamHeader}>
          <TeamLogo
            logo={logo}
            logoDark={logoDark}
            logoLight={logoLight}
            code={code}
            primaryColor={primary}
            textColor={text}
            size={20}
            shape="square"
          />
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
            <LastGameList
              key={lg.game_id}
              lg={lg}
              onNavigate={onNavigate}
            />
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
