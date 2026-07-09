import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScoreboardCard from './ScoreboardCard';
import styles from './ScoreboardCard.module.scss';

jest.mock('@/components/Tag/Tag', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ label, className }: { label: string; className?: string }) =>
      React.createElement('span', { className }, label),
  };
});

jest.mock('@/components/Tooltip/Tooltip', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({
      text,
      children,
      className,
    }: {
      text: string;
      children: React.ReactNode;
      className?: string;
    }) =>
      React.createElement(
        'span',
        { className },
        children,
        React.createElement('span', { role: 'tooltip' }, text),
      ),
  };
});

jest.mock('@/components/StickyHeroCard/StickyHeroCard', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(
      (
        {
          children,
          className,
          style,
        }: {
          children: React.ReactNode;
          className?: string;
          style?: React.CSSProperties;
        },
        ref: React.ForwardedRef<HTMLDivElement>,
      ) => React.createElement('div', { ref, className, style }, children),
    ),
  };
});

jest.mock('@/components/TeamLogo/TeamLogo', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ code, className }: { code: string; className?: string }) =>
      React.createElement('span', { className }, code),
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
  });
});
