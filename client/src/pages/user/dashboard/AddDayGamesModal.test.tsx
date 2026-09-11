import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import type { ListItemAction } from '@jerecocc/tracker-ui/components/ListItem/ListItem';
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

const setup = (
  games: GameRecord[],
  scheduledGames: GameRecord[] = [],
  getGameActions?: (game: GameRecord) => (ListItemAction | false)[],
) => {
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
        getGameActions={getGameActions}
        onAdded={onAdded}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { onAdded, onClose };
};

beforeEach(() => jest.resetAllMocks());

it('shows games to watch with dashboard actions and full-name team tooltips', async () => {
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
  const onView = jest.fn();
  setup([game], [game], () => [
    { icon: 'open_in_new', tooltip: 'View game details', onClick: onView },
  ]);
  const watchList = await screen.findByRole('list', { name: 'Games to Watch' });
  expect(within(watchList).queryByRole('checkbox')).not.toBeInTheDocument();
  expect(within(watchList).queryByText('Already scheduled')).not.toBeInTheDocument();
  expect(
    within(watchList)
      .getAllByText('BOS')
      .some((element) => element.className === 'teamCode'),
  ).toBe(true);
  expect(
    within(watchList)
      .getAllByText('TOR')
      .some((element) => element.className === 'teamCode'),
  ).toBe(true);
  expect(within(watchList).queryByText(/Boston|Toronto/)).not.toBeInTheDocument();
  fireEvent.click(within(watchList).getByRole('button', { name: 'View game details' }));
  expect(onView).toHaveBeenCalled();
  const awayTeam = within(watchList).getByLabelText('Boston Bruins');
  expect(awayTeam).toHaveTextContent('BOS');
  fireEvent.mouseEnter(awayTeam);
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Boston Bruins');
  fireEvent.mouseLeave(awayTeam);
  fireEvent.focus(within(watchList).getByLabelText('Toronto Maple Leafs'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Toronto Maple Leafs');
});

it('groups local-day games into games to watch and other games', async () => {
  const other = makeGame('other', { skipped_by_user: true, scheduled_for: '2026-07-10' });
  const outsideDay = makeGame('outside', { scheduled_at: '2026-06-23' });
  setup([other, favoriteGame, outsideDay]);

  const watchList = await screen.findByRole('list', { name: 'Games to Watch' });
  const others = screen.getByRole('list', { name: 'Other games' });
  expect(within(watchList).queryByRole('checkbox')).not.toBeInTheDocument();
  expect(within(watchList).getAllByRole('listitem')).toHaveLength(1);
  expect(
    within(others).getByRole('listitem', { name: 'other-away at other-home' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('listitem', { name: /outside/ })).not.toBeInTheDocument();
  expect(within(watchList).getByText('@')).toBeInTheDocument();
  expect(
    within(watchList).getByText(
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

it('moves an added game into games to watch and keeps existing games out of other games', async () => {
  const other = makeGame('other', { skipped_by_user: true });
  const alreadyAdded = makeGame('existing');
  mockAxios.put.mockResolvedValue({ data: {} });
  const { onAdded, onClose } = setup([favoriteGame, other], [favoriteGame, alreadyAdded]);

  const watchList = await screen.findByRole('list', { name: 'Games to Watch' });
  const others = screen.getByRole('list', { name: 'Other games' });
  expect(
    within(watchList).getByRole('listitem', { name: 'existing-away at existing-home' }),
  ).toBeInTheDocument();
  expect(
    within(others).queryByRole('listitem', { name: 'existing-away at existing-home' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Already scheduled')).not.toBeInTheDocument();

  const otherRow = within(others).getByRole('listitem', { name: 'other-away at other-home' });
  fireEvent.click(within(otherRow).getByRole('button', { name: 'Add to games to watch' }));

  await waitFor(() =>
    expect(
      within(watchList).getByRole('listitem', { name: 'other-away at other-home' }),
    ).toBeInTheDocument(),
  );
  expect(mockAxios.put).not.toHaveBeenCalled();
  expect(onAdded).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();

  const stagedRow = within(watchList).getByRole('listitem', {
    name: 'other-away at other-home',
  });
  fireEvent.click(within(stagedRow).getByRole('button', { name: 'Cancel watch' }));
  const restoredOthers = screen.getByRole('list', { name: 'Other games' });
  expect(
    within(restoredOthers).getByRole('listitem', { name: 'other-away at other-home' }),
  ).toBeInTheDocument();
  fireEvent.click(within(restoredOthers).getByRole('button', { name: 'Add to games to watch' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
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

it('does not add a game when its list row is clicked', async () => {
  const { onClose } = setup([makeGame('other')]);
  const row = await screen.findByRole('listitem', { name: 'other-away at other-home' });
  fireEvent.click(row);
  expect(mockAxios.put).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
});

it('keeps a game available for retry when adding it fails', async () => {
  mockAxios.put.mockRejectedValueOnce(new Error('Offline'));
  const { onAdded, onClose } = setup([makeGame('other')]);
  const addButton = await screen.findByRole('button', { name: 'Add to games to watch' });
  fireEvent.click(addButton);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(onAdded).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  mockAxios.put.mockResolvedValueOnce({ data: {} });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(onAdded).toHaveBeenCalledWith([expect.objectContaining({ id: 'other' })]),
  );
  expect(mockAxios.put).toHaveBeenCalledTimes(2);
  expect(onClose).toHaveBeenCalled();
});

it('places postponed games first and shows their original local date instead of the time', async () => {
  const postponed = makeGame('postponed', {
    scheduled_at: '2026-06-18',
    scheduled_for: dateKey,
  });
  setup([favoriteGame], [favoriteGame, postponed]);

  const watchList = await screen.findByRole('list', { name: 'Games to Watch' });
  const rows = within(watchList).getAllByRole('listitem');
  expect(rows[0]).toHaveAccessibleName('postponed-away at postponed-home');
  const originalDateKey = getOriginalGameDateKey(postponed, 'local')!;
  const [year, month, day] = originalDateKey.split('-').map(Number);
  const originalDateLabel = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
  expect(within(rows[0]).getByText(originalDateLabel)).toHaveClass('time');
  expect(
    within(rows[0]).queryByText(
      formatGameTime(postponed.scheduled_at, postponed.scheduled_time, 'local'),
    ),
  ).not.toBeInTheDocument();
});

it('shows empty groups when no games fall on the local day', async () => {
  setup([]);
  expect(await screen.findByText('No games to watch on this day.')).toBeInTheDocument();
  expect(screen.getByText('No other games on this day.')).toBeInTheDocument();
});

it('offers a retry when loading fails', async () => {
  mockAxios.get.mockRejectedValueOnce(new Error('Offline'));
  setup([]);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load games.');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No other games on this day.')).toBeInTheDocument();
});
