import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import type { GameRecord, TeamInfo } from '@/hooks/useGames';
import { getOriginalGameDateKey, formatGameTime } from '@/lib/gameSchedule';
import AddDayGamesModal from './AddDayGamesModal';

jest.mock('axios');
jest.mock('react-toastify', () => ({ toast: { error: jest.fn() } }));

const mockAxios = axios as jest.Mocked<typeof axios>;
const team = (id: string): TeamInfo => ({
  id,
  name: id,
  code: id.toUpperCase(),
  logo: null,
  primary_color: '#123456',
  secondary_color: '#ffffff',
  text_color: '#ffffff',
});
const makeGame = (id: string, overrides: Partial<GameRecord> = {}): GameRecord =>
  ({
    id,
    home_team: team(`${id}-home`),
    away_team: team(`${id}-away`),
    scheduled_at: '2026-06-21',
    scheduled_time: '23:30',
    scheduled_for: null,
    ...overrides,
  }) as GameRecord;
const favoriteGame = makeGame('favorite');
// This becomes the next day in Manila, while remaining June 21 in North America.
const dateKey = getOriginalGameDateKey(favoriteGame, 'local')!;

const setup = (games: GameRecord[], scheduledGames: GameRecord[] = []) => {
  mockAxios.get.mockResolvedValue({ data: games });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onAdded = jest.fn();
  const onClose = jest.fn();
  render(
    <QueryClientProvider client={client}>
      <AddDayGamesModal
        dateKey={dateKey}
        dateLabel="Selected day"
        favoriteTeamIds={['favorite-away', 'favorite-home']}
        scheduledGames={scheduledGames}
        onAdded={onAdded}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { onAdded, onClose };
};

beforeEach(() => jest.resetAllMocks());

it('shows favorite games without selection or schedule labels, with codes and full-name logo tooltips', async () => {
  const game = makeGame('favorite', {
    away_team: {
      ...team('favorite-away'),
      name: 'Boston Bruins',
      code: 'BOS',
      place_name: 'Boston',
      team_name: 'Bruins',
    },
    home_team: {
      ...team('favorite-home'),
      name: 'Toronto Maple Leafs',
      place_name: 'Toronto',
      code: 'TOR',
    },
  });
  setup([game], [game]);
  const favorites = await screen.findByRole('list', { name: 'Favorite teams' });
  expect(within(favorites).queryByRole('checkbox')).not.toBeInTheDocument();
  expect(within(favorites).queryByText('Already scheduled')).not.toBeInTheDocument();
  expect(
    within(favorites)
      .getAllByText('BOS')
      .some((element) => element.className === 'teamCode'),
  ).toBe(true);
  expect(
    within(favorites)
      .getAllByText('TOR')
      .some((element) => element.className === 'teamCode'),
  ).toBe(true);
  expect(within(favorites).queryByText(/Boston|Toronto/)).not.toBeInTheDocument();
  fireEvent.click(within(favorites).getByRole('listitem'));
  expect(screen.getByRole('button', { name: 'Add selected games' })).toBeDisabled();
  const awayLogo = within(favorites).getByLabelText('Boston Bruins');
  fireEvent.mouseEnter(awayLogo);
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Boston Bruins');
  fireEvent.mouseLeave(awayLogo);
  fireEvent.focus(within(favorites).getByLabelText('Toronto Maple Leafs'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Toronto Maple Leafs');
});

it('groups all local-day games by favorites and includes skipped and rescheduled games', async () => {
  const other = makeGame('other', { skipped_by_user: true, scheduled_for: '2026-07-10' });
  const outsideDay = makeGame('outside', { scheduled_at: '2026-06-23' });
  setup([other, favoriteGame, outsideDay]);

  const favorites = await screen.findByRole('list', { name: 'Favorite teams' });
  const others = screen.getByRole('list', { name: 'Other games' });
  expect(within(favorites).queryByRole('checkbox')).not.toBeInTheDocument();
  expect(within(favorites).getAllByRole('listitem')).toHaveLength(1);
  expect(
    within(others).getByRole('checkbox', { name: 'other-away at other-home' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: /outside/ })).not.toBeInTheDocument();
  expect(within(favorites).getByText('@')).toBeInTheDocument();
  expect(
    within(favorites).getByText(
      formatGameTime(favoriteGame.scheduled_at, favoriteGame.scheduled_time, 'local'),
    ),
  ).toHaveClass('time');
  expect(mockAxios.get).toHaveBeenCalledWith(
    expect.stringContaining('/user/games'),
    expect.objectContaining({
      params: { original_date: dateKey, all_teams: true, include_skipped: true },
    }),
  );
});

it('adds selected nonfavorite games to the displayed date and keeps existing games checked', async () => {
  const other = makeGame('other', { skipped_by_user: true });
  const alreadyAdded = makeGame('existing');
  mockAxios.put.mockResolvedValue({ data: {} });
  const { onAdded, onClose } = setup(
    [favoriteGame, other, alreadyAdded],
    [favoriteGame, alreadyAdded],
  );

  const existing = await screen.findByRole('checkbox', { name: 'existing-away at existing-home' });
  expect(existing).toHaveAttribute('aria-checked', 'true');
  expect(existing).toHaveAttribute('aria-disabled', 'true');
  const checkbox = screen.getByRole('checkbox', { name: 'other-away at other-home' });
  fireEvent.keyDown(checkbox, { key: ' ' });
  expect(checkbox).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Add selected games' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(mockAxios.put).toHaveBeenCalledTimes(1);
  expect(mockAxios.put).toHaveBeenCalledWith(
    expect.stringContaining('/user/watched-games/other/schedule'),
    { scheduled_for: dateKey },
    expect.any(Object),
  );
  expect(onAdded).toHaveBeenCalledWith([
    expect.objectContaining({ id: 'other', scheduled_for: dateKey, skipped_by_user: false }),
  ]);
});

it('allows row toggling and cancels without saving', async () => {
  const { onClose } = setup([makeGame('other')]);
  const checkbox = await screen.findByRole('checkbox');
  fireEvent.click(checkbox.closest('li')!);
  expect(checkbox).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(checkbox);
  expect(checkbox).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('button', { name: 'Add selected games' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
  expect(mockAxios.put).not.toHaveBeenCalled();
});

it('keeps failed selections available for retry without re-saving successful additions', async () => {
  mockAxios.put.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce(new Error('Offline'));
  const { onAdded, onClose } = setup([makeGame('first'), makeGame('other')]);
  const checkboxes = await screen.findAllByRole('checkbox');
  checkboxes.forEach((checkbox) => fireEvent.click(checkbox));
  fireEvent.click(screen.getByRole('button', { name: 'Add selected games' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(onAdded).toHaveBeenCalledWith([expect.objectContaining({ id: 'first' })]);
  expect(onClose).not.toHaveBeenCalled();
  mockAxios.put.mockResolvedValueOnce({ data: {} });
  fireEvent.click(screen.getByRole('button', { name: 'Add selected games' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(mockAxios.put).toHaveBeenCalledTimes(3);
});

it('shows empty groups when no games fall on the local day', async () => {
  setup([]);
  expect(await screen.findByText('No favorite-team games on this day.')).toBeInTheDocument();
  expect(screen.getByText('No other games on this day.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add selected games' })).toBeDisabled();
});

it('offers a retry when loading fails', async () => {
  mockAxios.get.mockRejectedValueOnce(new Error('Offline'));
  setup([]);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load games.');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No other games on this day.')).toBeInTheDocument();
});
