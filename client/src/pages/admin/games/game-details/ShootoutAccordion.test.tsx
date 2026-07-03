import { render, screen } from '@testing-library/react';
import type { GameRecord } from '@/hooks/useGames';
import type { ShootoutAttempt } from '@/hooks/useShootoutAttempts';
import ShootoutAccordion from './ShootoutAccordion';

jest.mock('@/components/TeamLogo/TeamLogo', () => () => <span>logo</span>);
jest.mock('@/components/PlayerAvatar/PlayerAvatar', () => ({
  __esModule: true,
  default: ({ initials }: { initials: string }) => (
    <span data-testid="player-avatar">{initials}</span>
  ),
}));

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

const attempt = (overrides: Partial<ShootoutAttempt> = {}): ShootoutAttempt => ({
  id: 'a1',
  game_id: game.id,
  team_id: 'away-team',
  shooter_id: 'p1',
  scored: true,
  attempt_order: 0,
  created_at: '2024-10-10T00:00:00Z',
  shooter_first_name: 'Away',
  shooter_last_name: 'One',
  shooter_photo: null,
  shooter_jersey_number: 11,
  shooter_date_of_birth: null,
  shooter_start_date: null,
  shooter_acquisition_type: null,
  team_name: 'Away',
  team_code: 'AWY',
  team_logo: null,
  team_primary_color: '#333333',
  team_text_color: '#ffffff',
  ...overrides,
});

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

  it('uses first and last initials for recorded attempt avatars', () => {
    render(
      <ShootoutAccordion
        game={game}
        attempts={[attempt({ shooter_first_name: 'Alex', shooter_last_name: 'Ovechkin' })]}
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

    expect(screen.getByTestId('player-avatar')).toHaveTextContent('AO');
  });

  it('does not pre-render empty future attempts once a shootout game is final', () => {
    const attempts: ShootoutAttempt[] = [
      { id: 'a1', game_id: game.id, team_id: 'away-team', shooter_id: 'p1', scored: true, attempt_order: 0, created_at: '2024-10-10T00:00:00Z', shooter_first_name: 'Away', shooter_last_name: 'One', shooter_photo: null, shooter_jersey_number: 11, shooter_date_of_birth: null, shooter_start_date: null, shooter_acquisition_type: null, team_name: 'Away', team_code: 'AWY', team_logo: null, team_primary_color: '#333333', team_text_color: '#ffffff' },
      { id: 'h1', game_id: game.id, team_id: 'home-team', shooter_id: 'p2', scored: false, attempt_order: 1, created_at: '2024-10-10T00:00:00Z', shooter_first_name: 'Home', shooter_last_name: 'One', shooter_photo: null, shooter_jersey_number: 21, shooter_date_of_birth: null, shooter_start_date: null, shooter_acquisition_type: null, team_name: 'Home', team_code: 'HOM', team_logo: null, team_primary_color: '#111111', team_text_color: '#ffffff' },
      { id: 'a2', game_id: game.id, team_id: 'away-team', shooter_id: 'p3', scored: true, attempt_order: 2, created_at: '2024-10-10T00:00:00Z', shooter_first_name: 'Away', shooter_last_name: 'Two', shooter_photo: null, shooter_jersey_number: 12, shooter_date_of_birth: null, shooter_start_date: null, shooter_acquisition_type: null, team_name: 'Away', team_code: 'AWY', team_logo: null, team_primary_color: '#333333', team_text_color: '#ffffff' },
      { id: 'h2', game_id: game.id, team_id: 'home-team', shooter_id: 'p4', scored: false, attempt_order: 3, created_at: '2024-10-10T00:00:00Z', shooter_first_name: 'Home', shooter_last_name: 'Two', shooter_photo: null, shooter_jersey_number: 22, shooter_date_of_birth: null, shooter_start_date: null, shooter_acquisition_type: null, team_name: 'Home', team_code: 'HOM', team_logo: null, team_primary_color: '#111111', team_text_color: '#ffffff' },
    ];

    const { container } = render(
      <ShootoutAccordion
        game={{ ...game, status: 'final', shootout: true }}
        attempts={attempts}
        goals={[]}
        isFinal
        isInProgress={false}
        canUseEditControls
        soComplete
        busy={null}
        deletingAttemptId={null}
        onAddAttempt={jest.fn()}
        onEndGame={jest.fn()}
      />,
    );

    const rows = Array.from(container.querySelectorAll('.soAttemptRow'));
    expect(rows).toHaveLength(attempts.length);
    expect(container.querySelectorAll('.soAttemptCellEmpty')).toHaveLength(0);
  });
});
