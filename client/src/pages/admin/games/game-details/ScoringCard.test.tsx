import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { GameRecord } from '@/hooks/useGames';
import type { ShootoutAttempt } from '@/hooks/useShootoutAttempts';
import ScoringCard from './ScoringCard';

jest.mock('@/components/TeamLogo/TeamLogo', () => () => <span>logo</span>);
jest.mock('@/components/PlayerAvatar/PlayerAvatar', () => () => <span>avatar</span>);

const baseGame = {
  id: 'game-1',
  season_id: 'season-1',
  game_type: 'regular',
  status: 'in_progress',
  scheduled_at: '2025-11-20T02:30:00Z',
  scheduled_time: '21:30',
  venue: null,
  time_start: null,
  time_end: null,
  home_team: { id: 'home', name: 'Home', code: 'HOM', logo: null, primary_color: '#111', secondary_color: '#222', text_color: '#fff' },
  away_team: { id: 'away', name: 'Away', code: 'AWY', logo: null, primary_color: '#333', secondary_color: '#444', text_color: '#fff' },
  overtime_periods: 1,
  shootout: true,
  shootout_first_team_id: 'away',
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
  created_at: '2025-11-20T00:00:00Z',
  current_period: 'SO',
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
} as GameRecord;

// Away shoots first and wins 1-0 over three full rounds → shootout decided.
const attempt = (order: number, team_id: string, scored: boolean): ShootoutAttempt => ({
  id: `a${order}`,
  game_id: 'game-1',
  team_id,
  shooter_id: `p${order}`,
  scored,
  attempt_order: order,
  created_at: '2025-11-20T03:00:00Z',
  shooter_first_name: 'Test',
  shooter_last_name: `Shooter${order}`,
  shooter_photo: null,
  shooter_jersey_number: order,
  shooter_date_of_birth: null,
  shooter_start_date: null,
  shooter_acquisition_type: null,
} as ShootoutAttempt);

const decidedAttempts: ShootoutAttempt[] = [
  attempt(1, 'away', true),
  attempt(2, 'home', false),
  attempt(3, 'away', false),
  attempt(4, 'home', false),
  attempt(5, 'away', false),
  attempt(6, 'home', false),
];

const renderCard = (overrides: Partial<React.ComponentProps<typeof ScoringCard>>) =>
  render(
    <MemoryRouter>
      <ScoringCard
        game={baseGame}
        goals={[]}
        isFinal={false}
        isInProgress
        isEditMode
        busy={null}
        liveAwayScore={1}
        liveHomeScore={1}
        tallyByGoalId={new Map()}
        lastCurrentPeriodGoalId={undefined}
        attempts={decidedAttempts}
        soComplete
        deletingAttemptId={null}
        awayTeamId="away"
        homeTeamId="home"
        onScoreGoal={jest.fn()}
        onOpenShotsModal={jest.fn()}
        onAddAttempt={jest.fn()}
        {...overrides}
      />
    </MemoryRouter>,
  );

describe('ScoringCard shootout End Game', () => {
  it('offers End Game on a decided shootout that is still in progress (even as admin)', () => {
    // isEditMode is true on the admin route; End Game must still appear during live play.
    const { getAllByText } = renderCard({});
    expect(getAllByText('End Game').length).toBeGreaterThan(0);
  });

  it('does not offer End Game once the game is no longer in progress', () => {
    const { queryByText } = renderCard({
      isInProgress: false,
      isFinal: true,
      game: { ...baseGame, status: 'final' } as GameRecord,
    });
    expect(queryByText('End Game')).toBeNull();
  });
});
