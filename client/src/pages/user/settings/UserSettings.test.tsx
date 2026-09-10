import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import UserSettings from './UserSettings';

jest.mock('axios');
jest.mock('@jerecocc/tracker-ui', () => ({
  SearchInput: jest.requireActual('@jerecocc/tracker-ui/components/SearchField/SearchInput').default,
}));
jest.mock('react-toastify', () => ({ toast: { error: jest.fn() } }));
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { display_name: 'Taylor', role: 'user' } }),
}));
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false, toggleTheme: jest.fn() }),
}));
jest.mock('@/hooks/useLeagues', () => ({
  __esModule: true,
  default: () => ({ leagues: [], loading: false }),
}));
jest.mock('@/hooks/useTeams', () => ({
  __esModule: true,
  default: () => ({
    loading: false,
    teams: [
      {
        id: 'team-1',
        name: 'Toronto Maple Leafs',
        team_name: 'Maple Leafs',
        place_name: 'Toronto',
        code: 'TOR',
        logo: null,
        primary_color: '#123456',
        text_color: '#ffffff',
      },
    ],
  }),
}));

const mockAxios = jest.mocked(axios);
const warning = {
  isAxiosError: true,
  response: {
    status: 409,
    data: { code: 'scheduled_games_confirmation_required', schedule_count: 2 },
  },
};
const setup = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(['user-favorites'], ['team-1', 'team-2']);
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <UserSettings />
    </QueryClientProvider>,
  );
  return { client, invalidate };
};

beforeEach(() => {
  jest.resetAllMocks();
  mockAxios.isAxiosError.mockImplementation((error) => error?.isAxiosError === true);
  jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('warns before unfavoriting, leaves the favorite intact on cancel, and sends the local timezone', async () => {
  mockAxios.delete.mockRejectedValueOnce(warning);
  const { client } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Remove from favorites' }));
  expect(await screen.findByText('Remove favorite team?')).toBeInTheDocument();
  expect(
    screen.getByText(/delete 2 custom watch schedules dated today or later/),
  ).toHaveTextContent('Games involving another favorite team will keep their schedules.');
  expect(client.getQueryData(['user-favorites'])).toEqual(['team-1', 'team-2']);
  expect(mockAxios.delete).toHaveBeenCalledWith(
    expect.stringContaining('/user/favorites/team-1'),
    expect.objectContaining({
      data: {
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        confirm_schedule_removal: false,
      },
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByText('Remove favorite team?')).not.toBeInTheDocument());
  expect(mockAxios.delete).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(['user-favorites'])).toEqual(['team-1', 'team-2']);
});

it('confirms schedule deletion, removes only the selected favorite, and refreshes schedules', async () => {
  mockAxios.delete
    .mockRejectedValueOnce(warning)
    .mockResolvedValueOnce({ data: { cleared_schedule_count: 2 } });
  const { client, invalidate } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Remove from favorites' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Remove favorite and schedules' }));
  await waitFor(() => expect(client.getQueryData(['user-favorites'])).toEqual(['team-2']));
  expect(mockAxios.delete).toHaveBeenLastCalledWith(
    expect.stringContaining('/user/favorites/team-1'),
    expect.objectContaining({
      data: {
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        confirm_schedule_removal: true,
      },
    }),
  );
  expect(screen.queryByText('Remove favorite team?')).not.toBeInTheDocument();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['user-dashboard-games'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['user-games'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['user-dashboard-available-games'] });
});

it('removes a favorite immediately when the server finds no affected schedules', async () => {
  mockAxios.delete.mockResolvedValueOnce({ data: { cleared_schedule_count: 0 } });
  const { client } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Remove from favorites' }));
  await waitFor(() => expect(client.getQueryData(['user-favorites'])).toEqual(['team-2']));
  expect(screen.queryByText('Remove favorite team?')).not.toBeInTheDocument();
  expect(mockAxios.delete).toHaveBeenCalledTimes(1);
});

it('retains the favorite and confirmation dialog if saving fails, allowing a retry', async () => {
  mockAxios.delete.mockRejectedValueOnce(warning).mockRejectedValueOnce(new Error('Offline'));
  const { client } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Remove from favorites' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Remove favorite and schedules' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to update favorites'));
  expect(client.getQueryData(['user-favorites'])).toEqual(['team-1', 'team-2']);
  expect(screen.getByText('Remove favorite team?')).toBeInTheDocument();
  mockAxios.delete.mockResolvedValueOnce({ data: {} });
  fireEvent.click(screen.getByRole('button', { name: 'Remove favorite and schedules' }));
  await waitFor(() => expect(client.getQueryData(['user-favorites'])).toEqual(['team-2']));
});

it('ignores repeated removal clicks while the request is pending', async () => {
  let complete!: (value: unknown) => void;
  mockAxios.delete.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const { client } = setup();
  const remove = screen.getByRole('button', { name: 'Remove from favorites' });
  fireEvent.click(remove);
  fireEvent.click(remove);
  expect(mockAxios.delete).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(['user-favorites'])).toEqual(['team-1', 'team-2']);
  complete({ data: {} });
  await waitFor(() => expect(client.getQueryData(['user-favorites'])).toEqual(['team-2']));
});
