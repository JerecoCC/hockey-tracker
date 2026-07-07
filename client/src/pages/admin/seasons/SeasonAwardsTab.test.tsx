import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import useSeasonAwards, {
  type SeasonAwardRecipient,
  type SeasonAwardRecord,
} from '@/hooks/useSeasonAwards';
import { usePlayoffSeries } from '@/hooks/useGames';
import useLeaguePlayers from '@/hooks/useLeaguePlayers';
import type { TeamStandingRecord } from '@/hooks/useSeasonStandings';
import SeasonAwardsTab from './SeasonAwardsTab';

jest.mock('@/hooks/useSeasonAwards', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/hooks/useGames', () => ({
  __esModule: true,
  usePlayoffSeries: jest.fn(),
}));

jest.mock('@/hooks/useLeaguePlayers', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseSeasonAwards = useSeasonAwards as jest.Mock;
const mockUsePlayoffSeries = usePlayoffSeries as jest.Mock;
const mockUseLeaguePlayers = useLeaguePlayers as jest.Mock;

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

const secondSkater = {
  ...skater,
  player_id: 'player-2',
  first_name: 'Jane',
  last_name: 'Doe',
  jersey_number: 27,
  goals: 2,
  assists: 3,
  points: 5,
};

const rosterGoalie = {
  id: 'goalie-1',
  first_name: 'Marlène',
  last_name: 'Boissonnault',
  photo: null,
  date_of_birth: null,
  birth_city: null,
  birth_country: null,
  height_cm: null,
  weight_lbs: null,
  position: 'G',
  shoots: null,
  is_active: false,
  created_at: '2026-01-01T00:00:00.000Z',
  jersey_number: 35,
  player_team_id: 'player-team-1',
  team_id: 'team-1',
  team_name: 'Toronto',
  team_code: 'TOR',
  team_logo: null,
  team_logo_dark: null,
  team_logo_light: null,
  primary_color: '#003e7e',
  text_color: '#ffffff',
  is_prospect: false,
  start_date: '2026-01-01',
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

const westTeam = {
  ...team,
  id: 'team-2',
  name: 'Vancouver',
  code: 'VAN',
};

const eastGroup = {
  id: 'conference-east',
  league_id: 'league-1',
  stable_key: 'conference:east',
  parent_id: null,
  name: 'Eastern Conference',
  sort_order: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  role: 'conference' as const,
  teams: [team],
  has_season_override: false,
  is_inherited: false,
  is_auto: false,
};

const westGroup = {
  ...eastGroup,
  id: 'conference-west',
  stable_key: 'conference:west',
  name: 'Western Conference',
  sort_order: 1,
  teams: [westTeam],
};

const makeAward = (overrides: Partial<SeasonAwardRecord> = {}): SeasonAwardRecord => ({
  award_id: 'award-1',
  league_id: 'league-1',
  name: 'Ilana Kloss Playoff MVP',
  description: null,
  recipient_type: 'player',
  selection_method: 'voted',
  competition_scope: 'full_season',
  stat_key: null,
  awarded_after_playoffs: true,
  uses_nominees: false,
  allow_multiple_winners: false,
  uses_team_selection: false,
  player_eligibility: null,
  team_eligibility: null,
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
  options: {
    saveNominees?: jest.Mock;
    skaters?: (typeof skater)[];
    rosterPlayers?: unknown[];
    seasonTeams?: (typeof team)[];
    groups?: typeof eastGroup[];
    standings?: TeamStandingRecord[];
  } = {},
) => {
  mockUseSeasonAwards.mockReturnValue({
    awards: [award],
    loading: false,
    updateTrackedAwards: jest.fn(async () => true),
    addRecipient,
    saveNominees: options.saveNominees ?? jest.fn(async () => true),
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
  mockUseLeaguePlayers.mockReturnValue({
    players: options.rosterPlayers ?? [],
    total: options.rosterPlayers?.length ?? 0,
    loading: false,
    fetching: false,
    busy: null,
    addPlayer: jest.fn(),
    bulkAddPlayers: jest.fn(),
    updatePlayer: jest.fn(),
    deletePlayer: jest.fn(),
  });

  return render(
    <MemoryRouter>
      <SeasonAwardsTab
        seasonId="season-1"
        leagueCode="PWHL"
        leagueId="league-1"
        seasonName="2025-26"
        playoffsStarted={playoffsStarted}
        seasonTeams={options.seasonTeams ?? [team]}
        groups={options.groups ?? []}
        skaters={options.skaters ?? [skater]}
        goalies={[]}
        standings={options.standings ?? []}
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

  it('does not automatically record post-playoff awards before playoffs start', () => {
    const addRecipient = jest.fn(async () => true);
    renderTab(
      makeAward({
        awarded_after_playoffs: true,
        selection_method: 'automatic',
        stat_key: 'points',
      }),
      addRecipient,
      [],
      false,
    );

    expect(addRecipient).not.toHaveBeenCalled();
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

  it('uses season roster players when adding nominees', async () => {
    const user = userEvent.setup();
    const saveNominees = jest.fn(async () => true);
    renderTab(
      makeAward({
        name: 'Intact Impact Award',
        uses_nominees: true,
      }),
      undefined,
      [],
      true,
      {
        saveNominees,
        skaters: [],
        rosterPlayers: [rosterGoalie],
      },
    );

    await user.click(screen.getByRole('button', { name: 'Nominees' }));
    await user.click(screen.getByLabelText('Nominee 1'));

    expect(
      await screen.findByRole('option', { name: /Marlène Boissonnault/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByText('Marlène Boissonnault'));
    await user.click(screen.getByRole('button', { name: 'Save Nominees' }));

    expect(saveNominees).toHaveBeenCalledWith('season-award-1', [
      {
        recipient_type: 'player',
        player_id: 'goalie-1',
        team_id: null,
        role: 'nominee',
        rank: 1,
      },
    ]);
  });

  it('reorders nominee drafts locally and saves the final order once', async () => {
    const user = userEvent.setup();
    const saveNominees = jest.fn(async () => true);
    renderTab(
      makeAward({
        uses_nominees: true,
        recipients: [
          {
            ...makeWinner('nominee-1', 'player-1', 'John Smith'),
            role: 'nominee',
            rank: 1,
          },
          {
            ...makeWinner('nominee-2', 'player-2', 'Jane Doe'),
            role: 'nominee',
            rank: 2,
          },
        ],
      }),
      undefined,
      [],
      true,
      {
        saveNominees,
        skaters: [skater, secondSkater],
      },
    );

    await user.click(screen.getByRole('button', { name: 'Nominees' }));
    const saveButton = screen.getByRole('button', { name: 'Save Nominees' });

    expect(saveButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Move nominee 1 down' }));

    expect(saveNominees).not.toHaveBeenCalled();
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    expect(saveNominees).toHaveBeenCalledTimes(1);
    expect(saveNominees).toHaveBeenCalledWith('season-award-1', [
      {
        recipient_type: 'player',
        player_id: 'player-2',
        team_id: null,
        role: 'nominee',
        rank: 1,
      },
      {
        recipient_type: 'player',
        player_id: 'player-1',
        team_id: null,
        role: 'nominee',
        rank: 2,
      },
    ]);
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
        selection_method: 'automatic',
        competition_scope: 'playoffs',
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

    expect(screen.getByText('Team | Automatic | Playoff Champion | Playoffs')).toBeInTheDocument();
    expect(screen.queryByText(/playoff_champion/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Team | Automatic | Playoff Champion | Playoffs | Recorded'),
    ).not.toBeInTheDocument();
  });

  it('limits team winner options to the configured conference', async () => {
    const user = userEvent.setup();
    renderTab(
      makeAward({
        name: 'Eastern Conference Champion',
        recipient_type: 'team',
        selection_method: 'manual',
        team_eligibility: { conference_names: ['Eastern Conference'] },
      }),
      undefined,
      [],
      true,
      {
        seasonTeams: [team, westTeam],
        groups: [eastGroup, westGroup],
      },
    );

    await user.click(screen.getByRole('button', { name: 'Award Team' }));
    await user.click(screen.getByRole('textbox', { name: /Team/ }));

    expect(await screen.findByRole('option', { name: /Toronto/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Vancouver/ })).not.toBeInTheDocument();
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

  it('automatically records stat winners with the stat value', async () => {
    const addRecipient = jest.fn(async () => true);
    renderTab(
      makeAward({
        selection_method: 'automatic',
        stat_key: 'points',
      }),
      addRecipient,
    );

    expect(screen.queryByRole('button', { name: 'Award Player' })).not.toBeInTheDocument();

    await waitFor(() =>
      expect(addRecipient).toHaveBeenCalledWith(
        'season-award-1',
        {
          recipient_type: 'player',
          player_id: 'player-1',
          team_id: null,
          role: 'winner',
          stat_value: '10',
        },
        {
          silent: true,
          refresh: false,
        },
      ),
    );
  });

  it('uses team conference eligibility when automatically recording a stat winner', async () => {
    const addRecipient = jest.fn(async () => true);
    renderTab(
      makeAward({
        name: 'Eastern Team Points Leader',
        recipient_type: 'team',
        selection_method: 'automatic',
        competition_scope: 'regular_season',
        stat_key: 'standings_points',
        team_eligibility: { conference_names: ['Eastern Conference'] },
      }),
      addRecipient,
      [],
      true,
      {
        seasonTeams: [team, westTeam],
        groups: [eastGroup, westGroup],
        standings: [
          {
            team_id: 'team-1',
            team_name: 'Toronto',
            team_code: 'TOR',
            team_logo: null,
            team_primary_color: '#003e7e',
            team_text_color: '#ffffff',
            gp: 10,
            wins: 5,
            reg_wins: 5,
            ot_wins: 0,
            losses: 3,
            otl: 2,
            points: 12,
            games_remaining: 0,
          },
          {
            team_id: 'team-2',
            team_name: 'Vancouver',
            team_code: 'VAN',
            team_logo: null,
            team_primary_color: '#003e7e',
            team_text_color: '#ffffff',
            gp: 10,
            wins: 9,
            reg_wins: 9,
            ot_wins: 0,
            losses: 1,
            otl: 0,
            points: 18,
            games_remaining: 0,
          },
        ],
      },
    );

    expect(screen.queryByRole('button', { name: 'Award Team' })).not.toBeInTheDocument();

    await waitFor(() =>
      expect(addRecipient).toHaveBeenCalledWith(
        'season-award-1',
        {
          recipient_type: 'team',
          player_id: null,
          team_id: 'team-1',
          role: 'winner',
          stat_value: '12',
        },
        {
          silent: true,
          refresh: false,
        },
      ),
    );
  });

  it('hides the set winner action for recorded playoff champion awards', () => {
    renderTab(
      makeAward({
        name: 'Walter Cup Winner',
        recipient_type: 'team',
        selection_method: 'automatic',
        competition_scope: 'playoffs',
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
        selection_method: 'automatic',
        competition_scope: 'playoffs',
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

  it('uses a radio list when awarding a single player from nominees', async () => {
    const user = userEvent.setup();
    const addRecipient = jest.fn(async () => true);
    renderTab(
      makeAward({
        uses_nominees: true,
        recipients: [
          {
            ...makeWinner('nominee-1', 'player-1', 'John Smith'),
            role: 'nominee',
          },
          {
            ...makeWinner('nominee-2', 'player-2', 'Jane Doe'),
            role: 'nominee',
          },
          makeWinner('winner-1', 'player-1', 'John Smith'),
        ],
      }),
      addRecipient,
    );

    await user.click(screen.getByRole('button', { name: 'Award Player' }));

    expect(screen.getByRole('radiogroup', { name: 'Ilana Kloss Playoff MVP nominees' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Player' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'John Smith' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Jane Doe' })).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByRole('radio', { name: 'Jane Doe' }));
    const awardPlayerButtons = screen.getAllByRole('button', { name: 'Award Player' });
    await user.click(awardPlayerButtons[awardPlayerButtons.length - 1]);

    expect(addRecipient).toHaveBeenCalledWith('season-award-1', {
      recipient_type: 'player',
      player_id: 'player-2',
      team_id: null,
      role: 'winner',
    });
  });

  it('uses the checklist winner flow for multiple-winner awards without nominees', async () => {
    const user = userEvent.setup();
    const addRecipient = jest.fn(async () => true);
    const { container } = renderTab(makeAward({ allow_multiple_winners: true }), addRecipient);

    await user.click(screen.getByRole('button', { name: 'Award Player' }));
    expect(screen.getByPlaceholderText('Search recipients...')).toBeInTheDocument();
    expect(container.querySelector('.awardPlayerChecklistFooter')).toBeInTheDocument();

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

  it('places selected checklist winners at the start', async () => {
    const user = userEvent.setup();
    const { container } = renderTab(
      makeAward({
        allow_multiple_winners: true,
        recipients: [makeWinner('winner-1', 'player-1', 'John Smith')],
      }),
      undefined,
      [],
      true,
      {
        skaters: [skater, secondSkater],
      },
    );

    await user.click(screen.getByRole('button', { name: 'Award Player' }));

    const items = container.querySelectorAll('.awardPlayerChecklistList > li');
    expect(items[0]).toHaveTextContent('John Smith');
    expect(items[1]).toHaveTextContent('Jane Doe');
  });

  it('shows an awardee card skeleton while automatically saving a playoff champion winner', async () => {
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
        selection_method: 'automatic',
        competition_scope: 'playoffs',
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
    expect(screen.queryByRole('button', { name: 'Award Team' })).not.toBeInTheDocument();

    await waitFor(() =>
      expect(container.querySelector('.awardWinnerSkeleton')).toBeInTheDocument(),
    );
    expect(addRecipient).toHaveBeenCalledWith(
      'season-award-1',
      {
        recipient_type: 'team',
        player_id: null,
        team_id: 'team-1',
        role: 'winner',
      },
      {
        silent: true,
        refresh: false,
      },
    );

    resolveAddRecipient(true);
    await waitFor(() =>
      expect(container.querySelector('.awardWinnerSkeleton')).not.toBeInTheDocument(),
    );
  });
});
