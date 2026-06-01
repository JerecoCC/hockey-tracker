import { render } from '@testing-library/react';
import type { GameRecord } from '@/hooks/useGames';
import ShootoutAccordion from './ShootoutAccordion';

jest.mock('@/components/TeamLogo/TeamLogo', () => () => <span>logo</span>);
jest.mock('@/components/PlayerAvatar/PlayerAvatar', () => () => <span>avatar</span>);

const game = {
  id: 'game-1',
  season_id: 'season-1',
  game_type: 'regular',
  status: 'in_progress',
  scheduled_at: '2024-10-10T19:00:00Z',
  scheduled_time: '19:00',
  venue: null,
  time_start: null,
  time_end: null,
  home_team: {
    id: 'home-team',
    name: 'Home',
    code: 'HOM',
    logo: null,
    primary_color: '#111111',
    secondary_color: '#222222',
    text_color: '#ffffff',
  },
  away_team: {
    id: 'away-team',
    name: 'Away',
    code: 'AWY',
    logo: null,
    primary_color: '#333333',
    secondary_color: '#444444',
    text_color: '#ffffff',
  },
  overtime_periods: 1,
  shootout: false,
  shootout_first_team_id: 'away-team',
  playoff_series_id: null,
  game_number_in_series: null,
  game_number: null,
  playoff_round: null,
  series_home_team_id: null,
  series_away_team_id: null,
  series_home_wins: null,
  series_away_wins: null,
  series_games_to_win: null,
  notes: null,
  created_at: '2024-10-10T00:00:00Z',
  current_period: 'SO',
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
} as GameRecord;

describe('ShootoutAccordion empty attempts', () => {
  it('pre-renders one alternating empty attempt row per league shootout attempt', () => {
    const { container } = render(
      <ShootoutAccordion
        game={game}
        attempts={[]}
        goals={[]}
        isFinal={false}
        isInProgress
        soComplete={false}
        busy={null}
        deletingAttemptId={null}
        onAddAttempt={jest.fn()}
        onEndGame={jest.fn()}
      />,
    );

    const rows = Array.from(container.querySelectorAll('.soAttemptRow'));
    expect(rows).toHaveLength(6);

    rows.forEach((row, index) => {
      const cells = Array.from(row.children);
      expect(cells).toHaveLength(2);
      const expectedAway = index % 2 === 0;
      expect(cells[0]).toHaveClass(expectedAway ? 'soAttemptCell' : 'soAttemptSpacer');
      expect(cells[1]).toHaveClass(expectedAway ? 'soAttemptSpacer' : 'soAttemptCell');
    });
  });
});
