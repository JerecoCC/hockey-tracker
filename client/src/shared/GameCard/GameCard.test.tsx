import { render, screen } from '@testing-library/react';
import type { GameRecord } from '@/hooks/useGames';
import GameCard from './GameCard';

const game: GameRecord = {
  id: 'game-1',
  season_id: 'season-1',
  game_type: 'regular',
  status: 'final',
  scheduled_at: '2024-05-01T19:00:00Z',
  scheduled_time: '19:00',
  venue: 'Arena',
  time_start: null,
  time_end: null,
  home_team: {
    id: 'team-1',
    name: 'Home',
    code: 'HOM',
    logo: null,
    primary_color: '#000',
    secondary_color: '#111',
    text_color: '#fff',
  },
  away_team: {
    id: 'team-2',
    name: 'Away',
    code: 'AWY',
    logo: null,
    primary_color: '#222',
    secondary_color: '#333',
    text_color: '#fff',
  },
  overtime_periods: null,
  shootout: false,
  shootout_first_team_id: null,
  playoff_series_id: null,
  game_number_in_series: null,
  game_number: null,
  league_game_number: null,
  playoff_round: null,
  series_home_team_id: null,
  series_away_team_id: null,
  series_home_wins: null,
  series_away_wins: null,
  series_games_to_win: null,
  notes: null,
  created_at: '2024-04-01T00:00:00Z',
  current_period: null,
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
};

describe('GameCard', () => {
  it('renders the card variant status with the default Tag intent', () => {
    render(<GameCard game={game} />);

    expect(screen.getByText('FINAL')).toHaveClass('tag', 'solid', 'success');
  });

  it('applies custom status Tag props to the card variant', () => {
    render(
      <GameCard
        game={game}
        statusLabel="Under review"
        statusIntent="warning"
      />,
    );

    expect(screen.getByText('Under review')).toHaveClass('tag', 'solid', 'warning');
  });

  it('opts into the mobile actions aside layout', () => {
    const { container } = render(
      <GameCard
        game={game}
        mobileActionsAside
        actions={<button type="button">Action</button>}
      />,
    );

    expect(container.querySelector('[data-game-card-variant="card"]')).toHaveAttribute(
      'data-mobile-actions-layout',
      'aside',
    );
    expect(container.querySelector('[data-game-card-actions]')).toBeInTheDocument();
  });
});
