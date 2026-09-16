import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import useGames from '@/hooks/useGames';
import SeasonGamesTab from './SeasonGamesTab';

jest.mock('@/hooks/useGames', () => jest.fn());
jest.mock('./BulkCreateGamesModal', () => () => null);
jest.mock('./GameFormModal', () => () => null);
jest.mock('@/shared/GameCard/GameCard', () => () => null);
jest.mock('@/shared/CalendarGameListItem/CalendarGameListItem', () => () => null);
jest.mock('@/pages/admin/games/game-details/nhlGameAutofill', () => ({}));
jest.mock('@/pages/admin/games/game-details/pwhlGameAutofill', () => ({}));
jest.mock('@/pages/admin/games/game-details/GameAutofillManualMoveReportModal', () => () => null);

const mockUseGames = useGames as jest.Mock;

describe('SeasonGamesTab calendar counts', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('season-games-calendar-month:season-1', '2026-09');
    const game = {
      season_id: 'season-1',
      status: 'scheduled',
      game_type: 'regular',
      scheduled_time: '19:00',
      home_team: { id: 'home', name: 'Home', code: 'HOM' },
      away_team: { id: 'away', name: 'Away', code: 'AWY' },
    };
    mockUseGames.mockReturnValue({
      games: [
        { ...game, id: 'one', scheduled_at: '2026-09-10' },
        { ...game, id: 'two', scheduled_at: '2026-09-11' },
        { ...game, id: 'three', scheduled_at: '2026-09-11' },
        { ...game, id: 'outside-season', scheduled_at: '2026-09-01' },
      ],
      loading: false,
    });
  });

  it('uses metric tags with singular and plural labels only on populated season days', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SeasonGamesTab
            leagueId="league-1"
            leagueCode="NHL"
            seasonId="season-1"
            seasonName="2026-27"
            seasonStartDate="2026-09-05"
            seasonEndDate="2027-06-30"
            seasonTeams={[]}
            isEnded
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Month view' }));

    const singleGame = screen.getByLabelText('1 game');
    const multipleGames = screen.getByLabelText('2 games');
    expect(singleGame).toHaveClass('metricTag', 'calendarDayGameCount');
    expect(multipleGames).toHaveClass('metricTag', 'calendarDayGameCount');
    expect(Array.from(singleGame.children).map((child) => child.textContent)).toEqual(['1', 'game']);
    expect(Array.from(multipleGames.children).map((child) => child.textContent)).toEqual(['2', 'games']);
    expect(container.querySelectorAll('.calendarDayGameCount')).toHaveLength(2);
    expect(screen.queryByLabelText('0 games')).not.toBeInTheDocument();
  });
});
