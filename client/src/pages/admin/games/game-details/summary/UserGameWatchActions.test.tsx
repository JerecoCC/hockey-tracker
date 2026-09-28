import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GameRecord } from '@/hooks/useGames';
import useFavoriteTeams from '@/hooks/useFavoriteTeams';
import useUserGameWatchActions from '@/hooks/useUserGameWatchActions';
import UserGameWatchActions from './UserGameWatchActions';

jest.mock('@/hooks/useFavoriteTeams', () => jest.fn());
jest.mock('@/hooks/useUserGameWatchActions', () => jest.fn());
jest.mock('@/shared/ScheduleWatchModal/ScheduleWatchModal', () => ({ open }: { open: boolean }) =>
  open ? <div role="dialog">postpone watch</div> : null,
);

const mockUseFavoriteTeams = useFavoriteTeams as unknown as jest.Mock;
const mockUseUserGameWatchActions = useUserGameWatchActions as unknown as jest.Mock;

const actions = {
  busy: false,
  markWatched: jest.fn(),
  unwatch: jest.fn(),
  undoSkip: jest.fn(),
  skip: jest.fn(),
  postponeWatch: jest.fn(),
};

const game = {
  id: 'game-1',
  status: 'final',
  scheduled_for: null,
  home_team: { id: 'home', code: 'HOM' },
  away_team: { id: 'away', code: 'AWY' },
} as unknown as GameRecord;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFavoriteTeams.mockReturnValue({ favorites: [] });
  mockUseUserGameWatchActions.mockReturnValue(actions);
});

describe('UserGameWatchActions', () => {
  it('leads with mark as watched and keeps the rest behind the menu', async () => {
    const user = userEvent.setup();
    render(
      <UserGameWatchActions
        game={game}
        onDownloadScoreCard={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Mark as watched' }));
    expect(actions.markWatched).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    // Not a favourite team, so the watch is cancelled rather than skipped.
    expect(screen.getByRole('button', { name: /Cancel watch/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Postpone watch/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Unwatch/ })).not.toBeInTheDocument();
  });

  it('offers skip instead of cancel for a favourite team game', async () => {
    const user = userEvent.setup();
    mockUseFavoriteTeams.mockReturnValue({ favorites: ['home'] });
    render(
      <UserGameWatchActions
        game={game}
        onDownloadScoreCard={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: /Skip game/ }));

    expect(actions.skip).toHaveBeenCalled();
  });

  it('swaps in the watched actions once the game is marked watched', async () => {
    const user = userEvent.setup();
    const onDownloadScoreCard = jest.fn();
    render(
      <UserGameWatchActions
        game={{ ...game, watched_by_user: true } as GameRecord}
        onDownloadScoreCard={onDownloadScoreCard}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Mark as watched' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: /Download score card/ }));

    expect(onDownloadScoreCard).toHaveBeenCalled();
  });
});
