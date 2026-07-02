import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import useSeasonAwards, {
  type SeasonAwardRecipient,
  type SeasonAwardRecord,
} from '@/hooks/useSeasonAwards';
import { usePlayoffSeries } from '@/hooks/useGames';
import SeasonAwardsTab from './SeasonAwardsTab';

jest.mock('@/hooks/useSeasonAwards', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/hooks/useGames', () => ({
  __esModule: true,
  usePlayoffSeries: jest.fn(),
}));

const mockUseSeasonAwards = useSeasonAwards as jest.Mock;
const mockUsePlayoffSeries = usePlayoffSeries as jest.Mock;

const skater = {
  player_id: 'player-1',
  first_name: 'John',
  last_name: 'Smith',
  photo: null,
  position: 'C',
  jersey_number: 19,
  team_id: 'team-1',
  team_code: 'TOR',
  team_name: 'Toronto',
  team_logo: null,
  team_primary_color: '#003e7e',
  team_text_color: '#ffffff',
  gp: 10,
  goals: 4,
  assists: 6,
  points: 10,
};

const team = {
  id: 'team-1',
  name: 'Toronto',
  code: 'TOR',
  logo: null,
  primary_color: '#003e7e',
  text_color: '#ffffff',
  secondary_color: '#ffffff',
  home_arena: null,
  inherited: false,
};

const makeAward = (overrides: Partial<SeasonAwardRecord> = {}): SeasonAwardRecord => ({
  award_id: 'award-1',
  league_id: 'league-1',
  name: 'Ilana Kloss Playoff MVP',
  description: null,
  recipient_type: 'player',
  selection_method: 'voted',
  stat_key: null,
  awarded_after_playoffs: true,
  uses_nominees: false,
  allow_multiple_winners: false,
  uses_team_selection: false,
  sort_order: 0,
  season_award_id: 'season-award-1',
  awarded_at: null,
  season_notes: null,
  recipients: [],
  ...overrides,
});

const makeWinner = (
  id: string,
  playerId: string,
  playerName: string,
): SeasonAwardRecipient => ({
  id,
  recipient_type: 'player',
  player_id: playerId,
  team_id: null,
  role: 'winner',
  rank: null,
  vote_points: null,
  stat_value: null,
  notes: null,
  player_name: playerName,
  player_photo: null,
  position: 'C',
  jersey_number: 19,
  team_name: 'Toronto',
  team_code: 'TOR',
  team_logo: null,
  team_primary_color: '#003e7e',
  team_text_color: '#ffffff',
});

const renderTab = (
  award: SeasonAwardRecord,
  addRecipient = jest.fn(async () => true),
  playoffSeries: unknown[] = [],
  playoffsStarted = true,
) => {
  mockUseSeasonAwards.mockReturnValue({
    awards: [award],
    loading: false,
    updateTrackedAwards: jest.fn(async () => true),
    addRecipient,
    deleteRecipient: jest.fn(async () => true),
    refresh: jest.fn(),
  });
  mockUsePlayoffSeries.mockReturnValue({
    series: playoffSeries,
    loading: false,
    busy: null,
    createSeries: jest.fn(),
    updateSeries: jest.fn(),
    deleteSeries: jest.fn(),
    startSeries: jest.fn(),
    advanceBracket: jest.fn(),
    forceAdvance: jest.fn(),
  });

  return render(
    <MemoryRouter>
      <SeasonAwardsTab
        seasonId="season-1"
        leagueCode="PWHL"
        leagueId="league-1"
        seasonName="2025-26"
        playoffsStarted={playoffsStarted}
        seasonTeams={[team]}
        skaters={[skater]}
        goalies={[]}
        standings={[]}
      />
    </MemoryRouter>,
  );
};

describe('SeasonAwardsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.scrollTo = jest.fn();
  });

  it('does not require nominees when the award definition has nominees disabled', () => {
    const { container } = renderTab(makeAward());

    expect(screen.queryByRole('button', { name: 'Nominees' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Award Player' })).toBeEnabled();
    expect(screen.queryByText('No nominees recorded.')).not.toBeInTheDocument();
    expect(container.querySelector('.awardContentInnerNoNominees')).toBeInTheDocument();
  });

  it('hides winner actions for post-playoff awards before playoffs start', () => {
    renderTab(makeAward({ awarded_after_playoffs: true }), undefined, [], false);

    expect(screen.queryByRole('button', { name: 'Award Player' })).not.toBeInTheDocument();
  });

  it('keeps winner actions for regular-season awards before playoffs start', () => {
    renderTab(makeAward({ awarded_after_playoffs: false }), undefined, [], false);

    expect(screen.getByRole('button', { name: 'Award Player' })).toBeEnabled();
  });

  it('renders the winner stat for stat-based player awards', () => {
    const { container } = renderTab(
      makeAward({
        selection_method: 'automatic',
        stat_key: 'points',
        recipients: [
          {
            ...makeWinner('winner-1', 'player-1', 'John Smith'),
            stat_value: '14',
          },
        ],
      }),
    );

    expect(screen.getByText('Player Points')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(container.querySelector('.awardWinnerStatStack')).toBeInTheDocument();
    expect(container.querySelector('.awardRecipientStatDivider')).toBeInTheDocument();
    expect(container.querySelector('.awardRecipientStatCard')).toHaveTextContent('Player Points14');
  });

  it('renders winner cards with full positions and dot-separated player info', () => {
    renderTab(
      makeAward({
        recipients: [makeWinner('winner-1', 'player-1', 'John Smith')],
      }),
    );

    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('#19')).toBeInTheDocument();
    expect(screen.getByText('Center')).toBeInTheDocument();
    expect(screen.getAllByText('•').length).toBe(2);
  });

  it('renders multiple winners without nominees as a single-column player list', () => {
    const { container } = renderTab(
      makeAward({
        allow_multiple_winners: true,
        recipients: [
          makeWinner('winner-1', 'player-1', 'John Smith'),
          makeWinner('winner-2', 'player-2', 'Jane Smith'),
        ],
      }),
    );

    expect(container.querySelector('.awardPlayerListColumn')).toBeInTheDocument();
    expect(container.querySelector('.awardWinnerCards')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.awardPlayerListItem.list')).toHaveLength(2);
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('renders nominees with the shared player card list variant', () => {
    const { container } = renderTab(
      makeAward({
        uses_nominees: true,
        recipients: [
          {
            ...makeWinner('nominee-1', 'player-1', 'John Smith'),
            role: 'nominee',
          },
        ],
      }),
    );

    const nomineeCard = container.querySelector('.awardPlayerListItem.list');
    expect(nomineeCard).toBeInTheDocument();
    expect(nomineeCard).toHaveTextContent('John Smith');

    const metaItems = nomineeCard?.querySelectorAll('.metaItem') ?? [];
    expect(metaItems).toHaveLength(3);
    expect(metaItems[0]).toHaveTextContent('TOR');
    expect(metaItems[1]).toHaveTextContent('#19');
    expect(metaItems[2]).toHaveTextContent('Center');
  });

  it('uses the grouped team selection flow only when the award definition is flagged', () => {
    renderTab(
      makeAward({
        name: 'First All-Star Team',
        uses_team_selection: true,
      }),
    );

    expect(screen.getByRole('button', { name: 'Set team' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Award Player' })).not.toBeInTheDocument();
  });

  it('does not use grouped team selection based on award name alone', () => {
    renderTab(
      makeAward({
        name: 'First All-Star Team',
        allow_multiple_winners: true,
      }),
    );

    expect(screen.getByRole('button', { name: 'Award Player' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Set team' })).not.toBeInTheDocument();
  });

  it('uses readable award selection subtitles without recorded status', async () => {
    const user = userEvent.setup();
    renderTab(
      makeAward({
        name: 'Walter Cup Winner',
        recipient_type: 'team',
        selection_method: 'playoff',
        stat_key: 'playoff_champion',
        recipients: [
          {
            ...makeWinner('winner-1', 'player-1', 'Toronto'),
            recipient_type: 'team',
            player_id: null,
            team_id: 'team-1',
            player_name: null,
          },
        ],
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Update Awards' }));

    expect(screen.getByText('Team | Automatic | Playoff Champion | Playoff award')).toBeInTheDocument();
    expect(screen.queryByText(/playoff_champion/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Team | Automatic | Playoff Champion | Playoff award | Recorded'),
    ).not.toBeInTheDocument();
  });

  it('hides the set winner action for automatic awards after a winner is recorded', () => {
    renderTab(
      makeAward({
        selection_method: 'automatic',
        stat_key: 'points',
        recipients: [makeWinner('winner-1', 'player-1', 'John Smith')],
      }),
    );

    expect(screen.queryByRole('button', { name: 'Award Player' })).not.toBeInTheDocument();
  });

  it('saves the stat value when recording a suggested stat winner', async () => {
    const user = userEvent.setup();
    const addRecipient = jest.fn(async () => true);
    renderTab(
      makeAward({
        selection_method: 'automatic',
        stat_key: 'points',
      }),
      addRecipient,
    );

    await user.click(screen.getByRole('button', { name: 'Award Player' }));

    expect(addRecipient).toHaveBeenCalledWith('season-award-1', {
      recipient_type: 'player',
      player_id: 'player-1',
      team_id: null,
      role: 'winner',
      stat_value: '10',
    });
  });

  it('hides the set winner action for recorded playoff champion awards', () => {
    renderTab(
      makeAward({
        name: 'Walter Cup Winner',
        recipient_type: 'team',
        selection_method: 'playoff',
        stat_key: 'playoff_champion',
        recipients: [
          {
            ...makeWinner('winner-1', 'player-1', 'Toronto'),
            recipient_type: 'team',
            player_id: null,
            team_id: 'team-1',
            player_name: null,
          },
        ],
      }),
    );

    expect(screen.queryByRole('button', { name: 'Award Team' })).not.toBeInTheDocument();
  });

  it('shows the final score subtitle for recorded playoff champion awards', () => {
    renderTab(
      makeAward({
        name: 'Walter Cup Winner',
        recipient_type: 'team',
        selection_method: 'playoff',
        stat_key: 'playoff_champion',
        recipients: [
          {
            ...makeWinner('winner-1', 'player-1', 'Toronto'),
            recipient_type: 'team',
            player_id: null,
            team_id: 'team-1',
            player_name: null,
          },
        ],
      }),
      undefined,
      [
        {
          id: 'series-1',
          season_id: 'season-1',
          round: 2,
          series_letter: 'F',
          home_team_id: 'team-1',
          home_team_name: 'Toronto',
          home_team_code: 'TOR',
          away_team_id: 'team-2',
          away_team_name: 'Montreal',
          away_team_code: 'MTL',
          games_to_win: 3,
          home_wins: 3,
          away_wins: 2,
          status: 'complete',
          winner_team_id: 'team-1',
          bracket_slot_key: null,
          created_at: '2026-01-01T00:00:00.000Z',
          games: [],
        },
      ],
    );

    expect(screen.getByText('Champion - Final 3-2')).toBeInTheDocument();
  });

  it('keeps the set winner action for non-automatic awards after a winner is recorded', () => {
    renderTab(
      makeAward({
        recipients: [makeWinner('winner-1', 'player-1', 'John Smith')],
      }),
    );

    expect(screen.getByRole('button', { name: 'Award Player' })).toBeInTheDocument();
  });

  it('fills the single-winner nominee select with the current winner', async () => {
    const user = userEvent.setup();
    renderTab(
      makeAward({
        uses_nominees: true,
        recipients: [
          {
            ...makeWinner('nominee-1', 'player-1', 'John Smith'),
            role: 'nominee',
          },
          makeWinner('winner-1', 'player-1', 'John Smith'),
        ],
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Award Player' }));

    expect(screen.getByDisplayValue('John Smith')).toBeInTheDocument();
  });

  it('uses the checklist winner flow for multiple-winner awards without nominees', async () => {
    const user = userEvent.setup();
    const addRecipient = jest.fn(async () => true);
    renderTab(makeAward({ allow_multiple_winners: true }), addRecipient);

    await user.click(screen.getByRole('button', { name: 'Award Player' }));
    expect(screen.getByPlaceholderText('Search recipients...')).toBeInTheDocument();

    await user.click(screen.getByText('John Smith'));
    await user.click(screen.getByRole('button', { name: 'Save Winners' }));

    expect(addRecipient).toHaveBeenCalledWith(
      'season-award-1',
      {
        recipient_type: 'player',
        player_id: 'player-1',
        team_id: null,
        role: 'winner',
      },
      {
        silent: true,
        refresh: false,
      },
    );
  });

  it('shows an awardee card skeleton while saving a suggested playoff champion winner', async () => {
    const user = userEvent.setup();
    let resolveAddRecipient: (value: boolean) => void = () => {};
    const addRecipient = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveAddRecipient = resolve;
        }),
    );
    const { container } = renderTab(
      makeAward({
        name: 'Walter Cup Winner',
        recipient_type: 'team',
        selection_method: 'playoff',
        stat_key: 'playoff_champion',
      }),
      addRecipient,
      [
        {
          id: 'series-1',
          season_id: 'season-1',
          round: 1,
          series_letter: 'A',
          home_team_id: 'team-2',
          home_team_name: 'Montreal',
          home_team_code: 'MTL',
          away_team_id: 'team-3',
          away_team_name: 'Boston',
          away_team_code: 'BOS',
          games_to_win: 3,
          home_wins: 3,
          away_wins: 1,
          status: 'complete',
          winner_team_id: 'team-2',
          bracket_slot_key: null,
          created_at: '2026-01-01T00:00:00.000Z',
          games: [],
        },
        {
          id: 'series-2',
          season_id: 'season-1',
          round: 2,
          series_letter: 'F',
          home_team_id: 'team-1',
          home_team_name: 'Toronto',
          home_team_code: 'TOR',
          away_team_id: 'team-2',
          away_team_name: 'Montreal',
          away_team_code: 'MTL',
          games_to_win: 3,
          home_wins: 3,
          away_wins: 2,
          status: 'complete',
          winner_team_id: 'team-1',
          bracket_slot_key: null,
          created_at: '2026-01-01T00:00:00.000Z',
          games: [],
        },
      ],
    );

    expect(
      screen.queryByRole('button', { name: 'Use suggested winner: Toronto' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Award Team' }));

    expect(container.querySelector('.awardWinnerSkeleton')).toBeInTheDocument();
    expect(addRecipient).toHaveBeenCalledWith('season-award-1', {
      recipient_type: 'team',
      player_id: null,
      team_id: 'team-1',
      role: 'winner',
    });

    resolveAddRecipient(true);
    await waitFor(() =>
      expect(container.querySelector('.awardWinnerSkeleton')).not.toBeInTheDocument(),
    );
  });
});
