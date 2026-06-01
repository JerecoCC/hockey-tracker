import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import AddPlayersModal from './AddPlayersModal';

jest.mock('axios');
jest.mock('@/hooks/useSeasons', () => ({
  __esModule: true,
  default: () => ({
    seasons: [{ id: 'season-1', name: '2025-26', league_id: 'league-1' }],
  }),
}));

const mockedAxios = jest.mocked(axios);

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderModal = () => {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <AddPlayersModal
        open
        onClose={jest.fn()}
        teamId="team-1"
        leagueId="league-1"
        latestSeasonId="season-1"
        existingPlayerIds={new Set()}
        addPlayersToRoster={jest.fn()}
      />
    </Wrapper>,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'test-token');
  mockedAxios.get.mockResolvedValue({ data: [] });
});

afterEach(() => localStorage.clear());

describe('AddPlayersModal', () => {
  it('fetches only unassigned players for the team league', async () => {
    renderModal();

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/admin/players'),
        expect.objectContaining({
          params: { league_id: 'league-1', unassigned: 'true' },
        }),
      );
    });
  });

  it('shows an empty state for league players without an available roster spot', async () => {
    renderModal();

    expect(await screen.findByText('No unassigned players are available for this league.')).toBeInTheDocument();
  });
});
