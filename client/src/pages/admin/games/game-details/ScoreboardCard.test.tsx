import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CSSProperties, ReactNode } from 'react';
import ScoreboardCard from './ScoreboardCard';
import styles from './ScoreboardCard.module.scss';

jest.mock('@jerecocc/tracker-ui/components/Tag/Tag', () => {
  return {
    __esModule: true,
    default: function MockTag({
      label,
      className,
      intent,
    }: {
      label: string;
      className?: string;
      intent?: string;
    }) {
      return (
        <span
          className={className}
          data-intent={intent}
        >
          {label}
        </span>
      );
    },
  };
});

jest.mock('@jerecocc/tracker-ui/components/Tooltip/Tooltip', () => {
  return {
    __esModule: true,
    default: function MockTooltip({
      text,
      children,
      className,
    }: {
      text: string;
      children: ReactNode;
      className?: string;
    }) {
      return (
        <span className={className}>
          {children}
          <span role="tooltip">{text}</span>
        </span>
      );
    },
  };
});

jest.mock('@jerecocc/tracker-ui/components/StickyHeroCard/StickyHeroCard', () => {
  return {
    __esModule: true,
    default: function MockStickyHeroCard({
      children,
      className,
      style,
    }: {
      children: ReactNode;
      className?: string;
      style?: CSSProperties;
    }) {
      return (
        <div
          className={className}
          style={style}
        >
          {children}
        </div>
      );
    },
  };
});

jest.mock('@jerecocc/tracker-ui/components/TeamLogo/TeamLogo', () => {
  return {
    __esModule: true,
    default: function MockTeamLogo({ code, className }: { code: string; className?: string }) {
      return <span className={className}>{code}</span>;
    },
  };
});

const team = (side: 'home' | 'away') => ({
  id: `${side}-team`,
  name: side === 'home' ? 'Toronto Maple Leafs' : 'Detroit Red Wings',
  place_name: side === 'home' ? 'Toronto' : 'Detroit',
  team_name: side === 'home' ? 'Maple Leafs' : 'Red Wings',
  code: side === 'home' ? 'TOR' : 'DET',
  logo: `/${side}.png`,
  logo_dark: `/${side}-dark.png`,
  logo_light: `/${side}-light.png`,
  primary_color: side === 'home' ? '#00205b' : '#ce1126',
  secondary_color: '#ffffff',
  text_color: '#ffffff',
});

describe('ScoreboardCard', () => {
  it('shows Postgres midnight placeholder dates on the stored schedule day', () => {
    render(
      <MemoryRouter>
        <ScoreboardCard
          game={{
            status: 'scheduled',
            scheduled_at: '2026-04-18 00:00:00+00',
            scheduled_time: '15:00',
            home_team: team('home'),
            away_team: team('away'),
          }}
          isFinal={false}
          isInProgress={false}
          liveAwayScore={0}
          liveHomeScore={0}
          overtimeSuffix=""
          leagueId="league-1"
          leagueCode="NHL"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Saturday, April 18, 2026')).toBeInTheDocument();
    expect(screen.queryByText('Friday, April 17, 2026')).not.toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toHaveAttribute('data-intent', 'neutral');
  });

  it('renders playoff matchup meta with stable fixed-size styling', () => {
    render(
      <MemoryRouter>
        <ScoreboardCard
          game={{
            status: 'final',
            scheduled_at: '2025-05-01T23:00:00Z',
            scheduled_time: '19:00',
            playoff_round: 2,
            playoff_round_names: { 2: 'Semifinal' },
            playoff_matchup_names: { r2m0: 'Atlantic Division Semifinal' },
            bracket_slot_key: 'r2m0',
            game_number_in_series: 5,
            home_team: team('home'),
            away_team: team('away'),
          }}
          isFinal
          isInProgress={false}
          liveAwayScore={2}
          liveHomeScore={3}
          overtimeSuffix=""
          leagueId="league-1"
          leagueCode="NHL"
        />
      </MemoryRouter>,
    );

    const meta = screen.getByText('ADS · Game 5');

    expect(meta).toHaveClass(styles.scoreMeta);
    expect(meta.tagName).toBe('SPAN');
    expect(meta).toHaveAccessibleName('Atlantic Division Semifinal · Game 5');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Atlantic Division Semifinal · Game 5');
    expect(meta).not.toHaveStyle({ fontSize: '8px' });
    expect(meta.getAttribute('style')).toBeNull();
    expect(screen.getByText('Final')).toHaveAttribute('data-intent', 'success');
  });

  it('renders playoff series dots instead of numeric scores when series score is supplied', () => {
    render(
      <MemoryRouter>
        <ScoreboardCard
          game={{
            status: 'in_progress',
            scheduled_at: null,
            scheduled_time: null,
            home_team: team('home'),
            away_team: team('away'),
          }}
          isFinal={false}
          isInProgress
          liveAwayScore={2}
          liveHomeScore={1}
          seriesScore={{
            awayWins: 2,
            homeWins: 1,
            winsNeeded: 4,
          }}
          overtimeSuffix=""
          leagueId="league-1"
          leagueCode="NHL"
        />
      </MemoryRouter>,
    );

    const awayDots = screen.getByRole('img', {
      name: 'Detroit Red Wings series wins 2 of 4',
    });
    const homeDots = screen.getByRole('img', {
      name: 'Toronto Maple Leafs series wins 1 of 4',
    });

    expect(awayDots.querySelectorAll(`.${styles.scoreSeriesDot}`)).toHaveLength(4);
    expect(awayDots.querySelectorAll(`.${styles.scoreSeriesDotFilled}`)).toHaveLength(2);
    expect(homeDots.querySelectorAll(`.${styles.scoreSeriesDot}`)).toHaveLength(4);
    expect(homeDots.querySelectorAll(`.${styles.scoreSeriesDotFilled}`)).toHaveLength(1);
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });
});
