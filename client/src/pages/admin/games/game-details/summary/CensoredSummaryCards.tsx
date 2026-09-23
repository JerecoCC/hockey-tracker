/**
 * Placeholder versions of the summary cards that give a game's result away.
 *
 * A viewer who has not marked a finished game as watched still gets the page,
 * just with these standing in for the real cards. They render filler only — the
 * goals, stars, goalie lines, linescore and shots never reach the DOM — and the
 * shape is deliberately uniform (three periods, one goalie per team) so the
 * layout itself cannot hint at overtime or a pulled goalie.
 */
import Accordion from '@jerecocc/tracker-ui/components/Accordion/Accordion';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
import PlayerAvatar from '@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import StatItem from '@jerecocc/tracker-ui/components/StatItem/StatItem';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import type { GameRecord } from '@/hooks/useGames';
import PlayerCard from '@/shared/PlayerCard/PlayerCard';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import SpoilerOverlay from '@/shared/SpoilerOverlay/SpoilerOverlay';
import { PERIODS } from '../constants';
import pageStyles from '../GameDetailsPage.module.scss';
import scoringStyles from '../ScoringCard.module.scss';
import starStyles from './ThreeStarsCard.module.scss';

// ── Filler ────────────────────────────────────────────────────────────────────

const FILLER_NAME = 'Player Name';
const FILLER_INITIALS = '--';
const FILLER_NUMBER = '--';
const FILLER_GOALS_PER_PERIOD = 2;

/** Teams are named all over the page already, so only results are held back. */
const teamRows = (game: GameRecord) => [
  { key: 'away', team: game.away_team },
  { key: 'home', team: game.home_team },
];

// ── Three Stars ───────────────────────────────────────────────────────────────

export const CensoredThreeStarsCard = () => (
  <Section title="Three Stars">
    <SpoilerOverlay>
      <div className={starStyles.starsRow}>
        {[1, 2, 3].map((starCount) => (
          <div
            key={starCount}
            className={starStyles.starItem}
          >
            <PlayerCard
              compact
              className={starStyles.starPlayerCard}
              topContent={
                <span className={starStyles.starIcons}>
                  {Array.from({ length: starCount }).map((_, index) => (
                    <Icon
                      key={index}
                      name="stars"
                    />
                  ))}
                </span>
              }
              name={FILLER_NAME}
              initials={FILLER_INITIALS}
              photo={null}
              imageSize={72}
              footer={
                <div className={starStyles.starStatsGrid}>
                  {['G', 'A', 'P'].map((label) => (
                    <StatItem
                      key={label}
                      as="span"
                      label={label}
                      value={FILLER_NUMBER}
                    />
                  ))}
                </div>
              }
            />
          </div>
        ))}
      </div>
    </SpoilerOverlay>
  </Section>
);

// ── Scoring ───────────────────────────────────────────────────────────────────

export const CensoredScoringCard = () => (
  <Section title="Scoring">
    <SpoilerOverlay>
      <div className={scoringStyles.periodList}>
        {PERIODS.map(({ num, label }) => (
          <Accordion
            key={num}
            mode="static"
            variant="light"
            className={{ body: scoringStyles.periodAccordionBody }}
            label={<span className={scoringStyles.periodLabel}>{label}</span>}
          >
            <ResponsiveList className={scoringStyles.goalList}>
              {Array.from({ length: FILLER_GOALS_PER_PERIOD }).map((_, index) => (
                <li
                  key={index}
                  className={scoringStyles.goalItem}
                >
                  <span className={scoringStyles.goalTimeGroup}>
                    <span className={scoringStyles.goalTime}>--:--</span>
                    <Divider
                      orientation="vertical"
                      className={scoringStyles.goalTimeDivider}
                    />
                  </span>
                  <PlayerAvatar
                    initials={FILLER_INITIALS}
                    size={48}
                  />
                  <div className={scoringStyles.goalInfo}>
                    <span className={scoringStyles.goalScorer}>{FILLER_NAME}</span>
                    <span className={scoringStyles.goalAssists}>
                      {FILLER_NAME}, {FILLER_NAME}
                    </span>
                  </div>
                  <span className={scoringStyles.goalScore}>
                    {FILLER_NUMBER} - {FILLER_NUMBER}
                  </span>
                </li>
              ))}
            </ResponsiveList>
          </Accordion>
        ))}
      </div>
    </SpoilerOverlay>
  </Section>
);

// ── Linescore / Shots ─────────────────────────────────────────────────────────

const CensoredPeriodsTable = ({ game }: { game: GameRecord }) => (
  <table className={pageStyles.periodsTable}>
    <thead>
      <tr>
        <th className={pageStyles.thTeam}></th>
        {PERIODS.map((period) => (
          <th
            key={period.num}
            className={pageStyles.thPeriod}
          >
            {period.num}
          </th>
        ))}
        <th className={pageStyles.thTotal}>T</th>
      </tr>
    </thead>
    <tbody>
      {teamRows(game).map(({ key, team }) => (
        <tr key={key}>
          <td className={pageStyles.tdTeam}>
            <span className={pageStyles.linescoreTeam}>
              <TeamLogo
                logo={team.logo}
                logoDark={team.logo_dark}
                logoLight={team.logo_light}
                code={team.code ?? '?'}
                primaryColor={team.primary_color}
                textColor={team.text_color}
                size={24}
                shape="square"
              />
              <span className={pageStyles.linescoreCode}>{team.code}</span>
            </span>
          </td>
          {PERIODS.map((period) => (
            <td
              key={period.num}
              className={pageStyles.tdGoals}
            >
              {FILLER_NUMBER}
            </td>
          ))}
          <td className={pageStyles.tdTotal}>{FILLER_NUMBER}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const CensoredLinescoreCard = ({ game }: { game: GameRecord }) => (
  <Section title="Linescore">
    <SpoilerOverlay>
      <CensoredPeriodsTable game={game} />
    </SpoilerOverlay>
  </Section>
);

export const CensoredShotsCard = ({ game }: { game: GameRecord }) => (
  <Section title="Shots">
    <SpoilerOverlay>
      <CensoredPeriodsTable game={game} />
    </SpoilerOverlay>
  </Section>
);
