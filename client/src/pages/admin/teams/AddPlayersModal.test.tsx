import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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

const renderModal = (props: Partial<React.ComponentProps<typeof AddPlayersModal>> = {}) => {
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
        {...props}
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
    expect(screen.getByText('Center')).toBeInTheDocument();
    expect(screen.queryByText(/Last:/)).not.toBeInTheDocument();
  });

  it('displays generic forward positions as Forward', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: [
        {
          id: 'player-forward',
          first_name: 'Hilary',
          last_name: 'Knight',
          photo: null,
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'F',
          shoots: null,
          is_active: true,
          created_at: '2026-01-01T00:00:00.000Z',
          jersey_number: 21,
          team_name: null,
          team_code: null,
          team_logo: null,
          primary_color: null,
          text_color: null,
        },
      ],
    });

    renderModal();

    expect(await screen.findByText('Hilary Knight')).toBeInTheDocument();
    expect(screen.getByText('Forward')).toBeInTheDocument();
    expect(screen.queryByText('F')).not.toBeInTheDocument();
  });

  it('moves selected players to the top of the list', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: [
        {
          id: 'player-first',
          first_name: 'Amanda',
          last_name: 'Kessel',
          photo: null,
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'C',
          shoots: null,
          is_active: true,
          created_at: '2026-01-01T00:00:00.000Z',
          jersey_number: 28,
          team_name: null,
          team_code: null,
          team_logo: null,
          primary_color: null,
          text_color: null,
        },
        {
          id: 'player-second',
          first_name: 'Blayre',
          last_name: 'Turnbull',
          photo: null,
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'F',
          shoots: null,
          is_active: true,
          created_at: '2026-01-01T00:00:00.000Z',
          jersey_number: 40,
          team_name: null,
          team_code: null,
          team_logo: null,
          primary_color: null,
          text_color: null,
        },
        {
          id: 'player-third',
          first_name: 'Claire',
          last_name: 'Thompson',
          photo: null,
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'D',
          shoots: null,
          is_active: true,
          created_at: '2026-01-01T00:00:00.000Z',
          jersey_number: 42,
          team_name: null,
          team_code: null,
          team_logo: null,
          primary_color: null,
          text_color: null,
        },
      ],
    });

    renderModal();

    const list = await screen.findByRole('list');
    const names = () =>
      within(list)
        .getAllByRole('listitem')
        .map((item) => {
          if (item.textContent?.includes('Amanda Kessel')) return 'Amanda Kessel';
          if (item.textContent?.includes('Blayre Turnbull')) return 'Blayre Turnbull';
          if (item.textContent?.includes('Claire Thompson')) return 'Claire Thompson';
          return '';
        });

    expect(names()).toEqual(['Amanda Kessel', 'Blayre Turnbull', 'Claire Thompson']);

    await userEvent.click(screen.getByText('Claire Thompson'));

    expect(names()).toEqual(['Claire Thompson', 'Amanda Kessel', 'Blayre Turnbull']);
  });

  it('filters available players by section position filter', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: [
        {
          id: 'player-forward',
          first_name: 'Sarah',
          last_name: 'Nurse',
          photo: null,
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'C',
          shoots: null,
          is_active: true,
          created_at: '2026-01-01T00:00:00.000Z',
          jersey_number: 20,
          team_name: null,
          team_code: null,
          team_logo: null,
          primary_color: null,
          text_color: null,
        },
        {
          id: 'player-defense',
          first_name: 'Erin',
          last_name: 'Ambrose',
          photo: null,
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'D',
          shoots: null,
          is_active: true,
          created_at: '2026-01-01T00:00:00.000Z',
          jersey_number: 23,
          team_name: null,
          team_code: null,
          team_logo: null,
          primary_color: null,
          text_color: null,
        },
        {
          id: 'player-goalie',
          first_name: 'Ann-Renee',
          last_name: 'Desbiens',
          photo: null,
          date_of_birth: null,
          birth_city: null,
          birth_country: null,
          height_cm: null,
          weight_lbs: null,
          position: 'G',
          shoots: null,
          is_active: true,
          created_at: '2026-01-01T00:00:00.000Z',
          jersey_number: 35,
          team_name: null,
          team_code: null,
          team_logo: null,
          primary_color: null,
          text_color: null,
        },
      ],
    });

    renderModal({
      positionFilter: ['C', 'LW', 'RW', 'L', 'R', 'F'],
      positionFilterLabel: 'Forwards',
    });

    expect(await screen.findByText('Sarah Nurse')).toBeInTheDocument();
    expect(screen.getByText('Add Forwards to Roster')).toBeInTheDocument();
    expect(screen.getByText('Sarah Nurse').closest('li')).toHaveClass('item');
    expect(screen.queryByText('Erin Ambrose')).not.toBeInTheDocument();
    expect(screen.queryByText('Ann-Renee Desbiens')).not.toBeInTheDocument();
  });
});

