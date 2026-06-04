import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
        seasonId="season-1"
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
          params: { league_id: 'league-1', season_id: 'season-1', unassigned: 'true' },
        }),
      );
    });
  });

  it('shows an empty state for league players without an available roster spot', async () => {
    renderModal();

    expect(await screen.findByText('No unassigned players are available for this league.')).toBeInTheDocument();
  });

  it('defaults the jersey number from the player latest roster context', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: [
        {
          id: 'player-24',
          first_name: 'Sarah',
          last_name: 'Nurse',
          photo: 'player.jpg',
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          nationality: null,
          height_cm: null,
          weight_lbs: null,
          position: 'C',
          shoots: null,
          is_active: true,
          created_at: '2026-01-01T00:00:00.000Z',
          jersey_number: 24,
          team_name: 'Toronto Sceptres',
          team_code: 'TOR',
          team_logo: 'team.png',
          primary_color: '#003f7f',
          text_color: '#ffffff',
        },
      ],
    });

    renderModal();

    await userEvent.click(await screen.findByText('Sarah Nurse'));

    expect(screen.getByRole('spinbutton')).toHaveValue(24);
    expect(screen.getByText('Center · Last: Toronto Sceptres')).toBeInTheDocument();
  });
});
