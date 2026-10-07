import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import type { GameRecord } from '@/hooks/useGames';
import PersonalGameModal from './PersonalGameModal';
import PersonalGameScoreModal from './PersonalGameScoreModal';
import PersonalGamesBulkModal from './PersonalGamesBulkModal';

jest.mock('axios');

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockRecordScore = jest.fn();
const mockBulkCreate = jest.fn();
jest.mock('@/hooks/usePersonalGames', () => ({
  __esModule: true,
  default: () => ({
    createPersonalGame: mockCreate,
    updatePersonalGame: mockUpdate,
    deletePersonalGame: mockDelete,
    recordPersonalGameScore: mockRecordScore,
    bulkCreatePersonalGames: mockBulkCreate,
  }),
}));

// The real controlled fields pull in the full tracker-ui bundle; plain inputs keep the form logic.
jest.mock('@/components/form/ControlledFields', () => {
  const { Controller } = jest.requireActual('react-hook-form');
  const Field = ({
    control,
    name,
    label,
    rules,
    options,
    disabled,
    onChange,
  }: {
    control: unknown;
    name: string;
    label: string;
    rules?: object;
    options?: { value: string; label: string }[];
    disabled?: boolean;
    onChange?: (value: string) => void;
  }) => (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({
        field,
        fieldState,
      }: {
        field: { value: string; onChange: (value: string) => void };
        fieldState: { error?: { message?: string } };
      }) => {
        const update = (value: string) => {
          field.onChange(value);
          onChange?.(value);
        };
        return (
          <div>
            {options ? (
              <select
                aria-label={label}
                value={field.value}
                disabled={disabled}
                onChange={(event) => update(event.target.value)}
              >
                <option value="" />
                {options.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={label}
                value={field.value}
                disabled={disabled}
                onChange={(event) => update(event.target.value)}
              />
            )}
            {fieldState.error?.message && <span>{fieldState.error.message}</span>}
          </div>
        );
      }}
    />
  );
  return {
    ControlledInputField: Field,
    ControlledSelectField: Field,
    ControlledDatePickerField: Field,
    ControlledTimePickerField: Field,
  };
});

const LEAGUES = [
  { id: 'league-pwhl', name: 'PWHL', code: 'PWHL' },
  { id: 'league-nhl', name: 'NHL', code: 'NHL' },
];
const SEASONS: Record<string, { id: string; name: string; is_current: boolean }[]> = {
  'league-pwhl': [
    { id: 'pwhl-2027', name: '2026-27', is_current: true },
    { id: 'pwhl-2026', name: '2025-26', is_current: false },
  ],
  'league-nhl': [{ id: 'nhl-2027', name: '2026-27', is_current: true }],
};
const ALL_TEAMS = [
  { id: 'team-ott', name: 'Ottawa Charge', code: 'OTT', league_id: 'league-pwhl' },
  { id: 'team-mtl', name: 'Montreal Victoire', code: 'MTL', league_id: 'league-pwhl' },
  { id: 'team-tor', name: 'Toronto Maple Leafs', code: 'TOR', league_id: 'league-nhl' },
];
const SEASON_TEAMS: Record<string, typeof ALL_TEAMS> = {
  'pwhl-2027': ALL_TEAMS.filter((team) => team.league_id === 'league-pwhl'),
  'pwhl-2026': ALL_TEAMS.filter((team) => team.league_id === 'league-pwhl'),
  'nhl-2027': ALL_TEAMS.filter((team) => team.league_id === 'league-nhl'),
};

const mockApi = () =>
  (axios.get as jest.Mock).mockImplementation(
    (url: string, config?: { params?: Record<string, string> }) => {
      const params = config?.params ?? {};
      if (url.endsWith('/user/leagues')) return Promise.resolve({ data: LEAGUES });
      if (url.endsWith('/user/seasons')) {
        return Promise.resolve({ data: SEASONS[params.league_id] ?? [] });
      }
      if (url.endsWith('/user/teams')) {
        return Promise.resolve({
          data: params.season_id ? (SEASON_TEAMS[params.season_id] ?? []) : ALL_TEAMS,
        });
      }
      return Promise.reject(new Error(`Unexpected ${url}`));
    },
  );

const renderModal = (game: GameRecord | null = null) => {
  mockApi();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = jest.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <PersonalGameModal
        open
        game={game}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { onClose };
};

const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const submit = () => fireEvent.submit(document.getElementById('personal-game-form')!);

/** Picks a league and waits for its current season and that season's teams. */
const chooseLeague = async (leagueId: string, seasonId: string, teamLabel: string) => {
  await screen.findByRole('option', { name: 'PWHL' });
  change('League', leagueId);
  await waitFor(() => expect(screen.getByLabelText('Season')).toHaveValue(seasonId));
  await screen.findAllByRole('option', { name: teamLabel });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'personal-1' });
  mockUpdate.mockResolvedValue({ id: 'personal-1' });
});

describe('PersonalGameModal', () => {
  it('needs a league before teams can be picked', async () => {
    renderModal();
    await screen.findByRole('option', { name: 'PWHL' });

    expect(screen.getByLabelText('Season')).toBeDisabled();
    expect(screen.getByLabelText('Away Team')).toBeDisabled();
    expect(screen.getByLabelText('Home Team')).toBeDisabled();
  });

  it("picks the league's current season and lists only its teams", async () => {
    renderModal();
    await chooseLeague('league-pwhl', 'pwhl-2027', 'OTT · Ottawa Charge');

    const awayOptions = Array.from(
      (screen.getByLabelText('Away Team') as HTMLSelectElement).options,
      (option) => option.textContent,
    ).filter(Boolean);
    expect(awayOptions).toEqual(['MTL · Montreal Victoire', 'OTT · Ottawa Charge']);
  });

  it('adds a scored game under its season with its schedule and postponed watch date', async () => {
    const { onClose } = renderModal();
    await chooseLeague('league-pwhl', 'pwhl-2027', 'OTT · Ottawa Charge');

    change('Away Team', 'team-ott');
    change('Home Team', 'team-mtl');
    change('Away Score', '2');
    change('Home Score', '3');
    change('Result', 'overtime');
    change('Game Type', 'playoff');
    change('Game Date', '2026-05-14');
    change('Start Time (ET)', '19:00');
    change('Postpone Watch To', '2026-05-16');
    submit();

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        season_id: 'pwhl-2027',
        away_team_id: 'team-ott',
        home_team_id: 'team-mtl',
        game_type: 'playoff',
        scheduled_at: '2026-05-14',
        scheduled_time: '19:00',
        away_score: 2,
        home_score: 3,
        result_type: 'overtime',
        scheduled_for: '2026-05-16',
        watched_on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('clears the season and teams when the league changes', async () => {
    renderModal();
    await chooseLeague('league-pwhl', 'pwhl-2027', 'OTT · Ottawa Charge');
    change('Away Team', 'team-ott');

    change('League', 'league-nhl');

    await waitFor(() => expect(screen.getByLabelText('Season')).toHaveValue('nhl-2027'));
    await waitFor(() => expect(screen.getByLabelText('Away Team')).toHaveValue(''));
  });

  it('needs both scores, and a watch date after the game', async () => {
    renderModal();
    await chooseLeague('league-pwhl', 'pwhl-2027', 'OTT · Ottawa Charge');

    change('Away Team', 'team-ott');
    change('Home Team', 'team-mtl');
    change('Game Date', '2026-05-14');
    change('Away Score', '2');
    change('Postpone Watch To', '2026-05-14');
    submit();

    expect(await screen.findAllByText('Enter both scores, or neither')).not.toHaveLength(0);
    expect(screen.getByText('Choose a watch date after the game date')).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("loads an existing personal game with its league and saved season", async () => {
    renderModal({
      id: 'personal-1',
      is_personal: true,
      status: 'final',
      game_type: 'regular',
      league_id: 'league-pwhl',
      season_id: 'pwhl-2026',
      scheduled_at: '2026-05-14T00:00:00.000Z',
      scheduled_time: '19:00',
      away_score: 2,
      home_score: 3,
      result_type: 'shootout',
      scheduled_for: null,
      away_team: { id: 'team-ott' },
      home_team: { id: 'team-mtl' },
    } as unknown as GameRecord);
    await screen.findAllByRole('option', { name: 'OTT · Ottawa Charge' });

    // The saved (non-current) season stays selected, and its teams stay picked.
    expect(screen.getByLabelText('League')).toHaveValue('league-pwhl');
    expect(screen.getByLabelText('Season')).toHaveValue('pwhl-2026');
    expect(screen.getByLabelText('Away Team')).toHaveValue('team-ott');
    expect(screen.getByLabelText('Game Date')).toHaveValue('2026-05-14');
    expect(screen.getByLabelText('Result')).toHaveValue('shootout');
    expect(screen.getByRole('button', { name: /Delete/ })).toBeInTheDocument();
  });
});

describe('PersonalGameScoreModal', () => {
  const unscoredGame = {
    id: 'personal-1',
    is_personal: true,
    status: 'scheduled',
    away_team: { id: 'team-ott', code: 'OTT' },
    home_team: { id: 'team-mtl', code: 'MTL' },
  } as unknown as GameRecord;

  it('records the score when a personal game is marked watched', async () => {
    mockRecordScore.mockResolvedValue({ id: 'personal-1' });
    const onClose = jest.fn();
    render(
      <PersonalGameScoreModal
        game={unscoredGame}
        onClose={onClose}
      />,
    );

    change('OTT Score', '2');
    change('MTL Score', '3');
    change('Result', 'shootout');
    fireEvent.submit(document.getElementById('personal-game-score-form')!);

    await waitFor(() =>
      expect(mockRecordScore).toHaveBeenCalledWith('personal-1', {
        away_score: 2,
        home_score: 3,
        result_type: 'shootout',
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('needs both scores before marking watched', async () => {
    render(
      <PersonalGameScoreModal
        game={unscoredGame}
        onClose={jest.fn()}
      />,
    );

    change('OTT Score', '2');
    fireEvent.submit(document.getElementById('personal-game-score-form')!);

    expect(await screen.findByText('Score is required')).toBeInTheDocument();
    expect(mockRecordScore).not.toHaveBeenCalled();
  });
});

describe('PersonalGamesBulkModal', () => {
  const renderBulk = () => {
    mockApi();
    mockBulkCreate.mockResolvedValue(true);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onClose = jest.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <PersonalGamesBulkModal
          open
          onClose={onClose}
        />
      </QueryClientProvider>,
    );
    return { onClose };
  };

  // Row fields have no labels; they're the selects and inputs after League and Season.
  const rowFields = () => {
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const [, , away, home, gameType] = selects;
    const date = screen
      .getAllByRole('textbox')
      .find((input) => !input.getAttribute('aria-label')) as HTMLInputElement;
    return { away, home, gameType, date };
  };

  it('adds every row under the single league and season', async () => {
    renderBulk();
    await screen.findByRole('option', { name: 'PWHL' });
    expect(rowFields().away).toBeDisabled();

    change('League', 'league-pwhl');
    await waitFor(() => expect(screen.getByLabelText('Season')).toHaveValue('pwhl-2027'));
    await screen.findAllByRole('option', { name: 'OTT · Ottawa Charge' });

    const { away, home, gameType, date } = rowFields();
    expect(away).not.toBeDisabled();
    fireEvent.change(away, { target: { value: 'team-ott' } });
    fireEvent.change(home, { target: { value: 'team-mtl' } });
    fireEvent.change(gameType, { target: { value: 'playoff' } });
    fireEvent.change(date, { target: { value: '2026-05-14' } });
    fireEvent.submit(document.getElementById('bulk-personal-games-form')!);

    await waitFor(() =>
      expect(mockBulkCreate).toHaveBeenCalledWith({
        season_id: 'pwhl-2027',
        games: [
          {
            away_team_id: 'team-ott',
            home_team_id: 'team-mtl',
            game_type: 'playoff',
            scheduled_at: '2026-05-14',
          },
        ],
      }),
    );
  });

  it("clears a row's teams when the league changes", async () => {
    renderBulk();
    await screen.findByRole('option', { name: 'PWHL' });
    change('League', 'league-pwhl');
    await screen.findAllByRole('option', { name: 'OTT · Ottawa Charge' });
    fireEvent.change(rowFields().away, { target: { value: 'team-ott' } });

    change('League', 'league-nhl');

    await waitFor(() => expect(screen.getByLabelText('Season')).toHaveValue('nhl-2027'));
    await waitFor(() => expect(rowFields().away).toHaveValue(''));
  });
});
