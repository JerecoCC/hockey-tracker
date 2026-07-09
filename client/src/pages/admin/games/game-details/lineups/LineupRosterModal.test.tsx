import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import LineupRosterModal from './LineupRosterModal';

jest.mock('axios');
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@jerecocc/tracker-ui/Icon', () => ({ name }: { name: string }) => <span>{name}</span>);

const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeAll(() => {
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    value: jest.fn(),
  });
});

const player = (overrides: Record<string, unknown>) => ({
  id: 'player-1',
  first_name: 'John',
  last_name: 'Smith',
  photo: null,
  date_of_birth: null,
  birth_city: null,
  birth_country: null,
  height_cm: null,
  weight_lbs: null,
  position: 'C',
  shoots: null,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  player_team_id: 'pt-1',
  jersey_number: 19,
  team_id: 'team-1',
  team_name: 'Sharks',
  primary_color: '#111111',
  text_color: '#ffffff',
  is_prospect: false,
  ...overrides,
});

const renderModal = (
  existingPlayerIds = new Set<string>(),
  addToGameRoster = jest.fn().mockResolvedValue(true),
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LineupRosterModal
        open
        onClose={jest.fn()}
        teamId="team-1"
        seasonId="season-1"
        teamName="Sharks"
        existingPlayerIds={existingPlayerIds}
        addToGameRoster={addToGameRoster}
      />
    </QueryClientProvider>,
  );
};

describe('LineupRosterModal jersey quick-add', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  it('names already-added players and identifies hidden prospect jersey matches', async () => {
    mockedAxios.get.mockResolvedValue({
      data: [
        player({ id: 'player-1', first_name: 'John', last_name: 'Smith', jersey_number: 19 }),
        player({
          id: 'player-2',
          first_name: 'Jane',
          last_name: 'Doe',
          player_team_id: 'pt-2',
          jersey_number: 27,
          is_prospect: true,
        }),
      ],
    });

    const addToGameRoster = jest.fn().mockResolvedValue(true);
    renderModal(new Set(['player-1']), addToGameRoster);

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());

    expect(await screen.findByPlaceholderText(/search players/i)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /show prospects/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/jersey numbers/i), '19 27');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(screen.getByText(/already in lineup/i)).toHaveTextContent(
      'Already in lineup: #19 John Smith',
    );
    expect(screen.getByText(/#27 Jane Doe/)).toHaveTextContent(
      'Prospect: #27 Jane Doe - will be moved to roster when added.',
    );
    expect(screen.getByText('1 player selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /add to lineup/i }));

    expect(addToGameRoster).toHaveBeenCalledWith(['player-2']);
  });

  it('moves selected players to the top of the list', async () => {
    mockedAxios.get.mockResolvedValue({
      data: [
        player({ id: 'player-1', first_name: 'John', last_name: 'Smith', jersey_number: 19 }),
        player({
          id: 'player-2',
          first_name: 'Jane',
          last_name: 'Doe',
          player_team_id: 'pt-2',
          jersey_number: 27,
        }),
        player({
          id: 'player-3',
          first_name: 'Megan',
          last_name: 'Keller',
          player_team_id: 'pt-3',
          jersey_number: 5,
        }),
      ],
    });

    renderModal();

    const user = userEvent.setup();
    const list = await screen.findByRole('list');
    const names = () =>
      within(list)
        .getAllByRole('listitem')
        .map((item) => {
          if (item.textContent?.includes('Megan Keller')) return 'Megan Keller';
          if (item.textContent?.includes('John Smith')) return 'John Smith';
          if (item.textContent?.includes('Jane Doe')) return 'Jane Doe';
          return '';
        });

    expect(names()).toEqual(['Megan Keller', 'John Smith', 'Jane Doe']);

    await user.click(screen.getByText('Jane Doe'));

    expect(names()).toEqual(['Jane Doe', 'Megan Keller', 'John Smith']);
  });
});

