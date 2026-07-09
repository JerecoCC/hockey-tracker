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
    loading: jest.fn(() => 'game-autofill-toast'),
    update: jest.fn(),
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

jest.mock('@jerecocc/tracker-ui/components/Modal/Modal', () => {
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
    expect(toast.loading).toHaveBeenCalledWith(
      'Auto-filling NHL game: starting...',
      expect.objectContaining({
        hideProgressBar: false,
        progress: 0,
        progressClassName: 'gameAutofillProgressBar',
      }),
    );
    expect(toast.update).toHaveBeenCalledWith(
      'game-autofill-toast',
      expect.objectContaining({
        render: 'Auto-filling NHL game: Added goal 1 of 3.',
        isLoading: true,
        hideProgressBar: false,
        progress: expect.any(Number),
        progressClassName: 'gameAutofillProgressBar',
      }),
    );
    expect(
      (toast.update as jest.Mock).mock.calls.some(([, options]) => options?.isLoading === false),
    ).toBe(false);

    refresh.resolve();
    await waitFor(() =>
      expect(toast.update).toHaveBeenCalledWith(
        'game-autofill-toast',
        expect.objectContaining({
          render: expect.stringContaining('Filled NHL game 317'),
          type: 'success',
          isLoading: false,
          hideProgressBar: true,
          progress: 1,
          progressClassName: 'gameAutofillProgressBar',
        }),
      ),
    );
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
    expect(toast.loading).toHaveBeenCalledWith(
      'Auto-filling PWHL game: starting...',
      expect.objectContaining({
        hideProgressBar: false,
        progress: 0,
        progressClassName: 'gameAutofillProgressBar',
      }),
    );
    expect(toast.update).toHaveBeenCalledWith(
      'game-autofill-toast',
      expect.objectContaining({
        render: 'Auto-filling PWHL game: Added goal 1 of 3.',
        isLoading: true,
        hideProgressBar: false,
        progress: expect.any(Number),
        progressClassName: 'gameAutofillProgressBar',
      }),
    );
    expect(
      (toast.update as jest.Mock).mock.calls.some(([, options]) => options?.isLoading === false),
    ).toBe(false);

    refresh.resolve();
    await waitFor(() =>
      expect(toast.update).toHaveBeenCalledWith(
        'game-autofill-toast',
        expect.objectContaining({
          render: expect.stringContaining('Filled PWHL game 317'),
          type: 'success',
          isLoading: false,
          hideProgressBar: true,
          progress: 1,
          progressClassName: 'gameAutofillProgressBar',
        }),
      ),
    );
  });
});
