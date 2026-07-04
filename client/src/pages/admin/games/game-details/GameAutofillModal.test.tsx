import { fireEvent, render, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import type { GameRecord } from '@/hooks/useGames';
import NhlGameAutofillModal from './NhlGameAutofillModal';
import PwhlGameAutofillModal from './PwhlGameAutofillModal';
import { autofillGameFromNhlGamecenter } from './nhlGameAutofill';
import { autofillGameFromPwhlGamecenter } from './pwhlGameAutofill';

const mockInvalidateQueries = jest.fn();
const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
};

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
}));

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('./nhlGameAutofill', () => ({
  autofillGameFromNhlGamecenter: jest.fn(),
  nhlAutofillApiError: (_err: unknown, fallback: string) => fallback,
}));

jest.mock('./pwhlGameAutofill', () => ({
  autofillGameFromPwhlGamecenter: jest.fn(),
  pwhlAutofillApiError: (_err: unknown, fallback: string) => fallback,
}));

jest.mock('@/components/Modal/Modal', () => {
  const MockModal = ({ open, title, children }: any) =>
    open ? (
      <div
        role="dialog"
        aria-label={title}
      >
        {children}
      </div>
    ) : null;

  MockModal.displayName = 'MockModal';
  return MockModal;
});

const baseGame = {
  id: 'game-1',
  game_number: 317,
  league_game_number: '317',
  status: 'scheduled',
} as GameRecord;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('game autofill modals', () => {
  it('does not block NHL autofill progress on detail query refreshes', async () => {
    const refresh = deferred();
    const continuedAfterProgress = jest.fn();
    mockInvalidateQueries.mockReturnValue(refresh.promise);
    (autofillGameFromNhlGamecenter as jest.Mock).mockImplementation(
      async (_game: GameRecord, _input: string, options: any) => {
        await options.onProgress({
          step: 'goals',
          message: 'Added goal 1 of 3.',
          refresh: true,
        });
        continuedAfterProgress();
        return {
          summary: { gameId: '317', goalsCreated: 1, rosterPlayers: 40 },
          warnings: [],
        };
      },
    );

    render(
      <NhlGameAutofillModal
        open
        game={baseGame}
        onClose={jest.fn()}
      />,
    );

    fireEvent.submit(document.getElementById('nhl-game-autofill-form') as HTMLFormElement);

    await waitFor(() => expect(continuedAfterProgress).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();

    refresh.resolve();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('does not block PWHL autofill progress on detail query refreshes', async () => {
    const refresh = deferred();
    const continuedAfterProgress = jest.fn();
    mockInvalidateQueries.mockReturnValue(refresh.promise);
    (autofillGameFromPwhlGamecenter as jest.Mock).mockImplementation(
      async (_game: GameRecord, _input: string, options: any) => {
        await options.onProgress({
          step: 'goals',
          message: 'Added goal 1 of 3.',
          refresh: true,
        });
        continuedAfterProgress();
        return {
          summary: { gameId: '317', goalsCreated: 1, rosterPlayers: 40 },
          warnings: [],
        };
      },
    );

    render(
      <PwhlGameAutofillModal
        open
        game={baseGame}
        onClose={jest.fn()}
      />,
    );

    fireEvent.submit(document.getElementById('pwhl-game-autofill-form') as HTMLFormElement);

    await waitFor(() => expect(continuedAfterProgress).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();

    refresh.resolve();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
