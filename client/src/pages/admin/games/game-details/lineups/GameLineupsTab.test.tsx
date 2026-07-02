import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ListItemAction } from '@/components/ListItem/ListItem';
import type { GameRecord } from '@/hooks/useGames';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type { LineupEntry } from '@/hooks/useGameLineup';
import GameLineupsTab from './GameLineupsTab';

jest.mock('@/hooks/useTeamPlayers', () => () => ({ createAndRosterPlayers: jest.fn() }));
jest.mock('@/components/Accordion/Accordion', () =>
  function MockAccordion({ label, children }: { label: ReactNode; children: ReactNode }) {
    return <div><div>{label}</div>{children}</div>;
  },
);
jest.mock('@/components/Card/Card', () =>
  function MockCard({ children, title }: { children: ReactNode; title: ReactNode }) {
    return <div><div>{title}</div>{children}</div>;
  },
);
jest.mock('@/components/SegmentedControl/SegmentedControl', () =>
  function MockSegmentedControl() {
    return null;
  },
);
jest.mock('@/components/TeamLogo/TeamLogo', () =>
  function MockTeamLogo() {
    return <span>logo</span>;
  },
);
jest.mock('./LineupRosterModal', () =>
  function MockLineupRosterModal() {
    return null;
  },
);
jest.mock('./LineupCreatePlayersModal', () =>
  function MockLineupCreatePlayersModal() {
    return null;
  },
);
jest.mock('./SetLineupModal', () =>
  function MockSetLineupModal() {
    return null;
  },
);
jest.mock('./RemoveFromLineupModal', () =>
  function MockRemoveFromLineupModal() {
    return null;
  },
);
jest.mock('@/components/ListItem/ListItem', () =>
  function MockListItem({
    name,
    rightContent,
    subtitle,
    actions,
  }: {
    name: ReactNode;
    rightContent?: { type?: string; label?: ReactNode };
    subtitle?: ReactNode;
    actions?: (ListItemAction | false | null | undefined)[];
  }) {
    const visibleActions = actions?.filter((action): action is ListItemAction => Boolean(action)) ?? [];

    return (
      <div>
        <span>{name}</span>
        {subtitle && <span>{subtitle}</span>}
        {rightContent?.type === 'tag' && <span>{rightContent.label}</span>}
        {visibleActions.map((action) => (
          <button
            key={action.tooltip ?? action.icon}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.tooltip ?? action.icon}
          </button>
        ))}
      </div>
    );
  },
);

const game = {
  id: 'game-1',
  season_id: 'season-1',
  game_type: 'regular',
  status: 'final',
  scheduled_at: '2024-10-10T19:00:00Z',
  scheduled_time: '19:00',
  venue: null,
  time_start: null,
  time_end: null,
  home_team: { id: 'team-home', name: 'Home Team', code: 'HOM', logo: null, primary_color: '#111', secondary_color: '#222', text_color: '#fff' },
  away_team: { id: 'team-away', name: 'Away Team', code: 'AWY', logo: null, primary_color: '#333', secondary_color: '#444', text_color: '#fff' },
  overtime_periods: null,
  shootout: false,
  shootout_first_team_id: null,
  playoff_series_id: null,
  game_number_in_series: null,
  game_number: null,
  playoff_round: null,
  series_home_team_id: null,
  series_away_team_id: null,
  series_home_wins: null,
  series_away_wins: null,
  series_games_to_win: null,
  notes: null,
  created_at: '2024-09-01T00:00:00Z',
  current_period: '3',
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
} as GameRecord;

const awayRoster: GameRosterEntry[] = [
  {
    id: 'entry-1',
    game_id: 'game-1',
    team_id: 'team-away',
    player_id: 'player-1',
    first_name: 'John',
    last_name: 'Smith',
    photo: null,
    jersey_number: 19,
    position: 'G',
    inherited: false,
  },
] as GameRosterEntry[];

const inheritedLineup: LineupEntry[] = [
  {
    id: 'lineup-1',
    game_id: 'game-1',
    team_id: 'team-away',
    player_id: 'player-1',
    position_slot: 'G',
    inherited: false,
  },
] as LineupEntry[];

const renderTab = (
  isEditMode: boolean,
  overrides: Partial<Parameters<typeof GameLineupsTab>[0]> = {},
) =>
  render(
    <GameLineupsTab
      game={game}
      isEditMode={isEditMode}
      isFinal
      leagueId="league-1"
      seasonId="season-1"
      awayRoster={awayRoster}
      homeRoster={[]}
      awayRosterInherited={[]}
      homeRosterInherited={[]}
      lineup={inheritedLineup}
      saveTeamLineup={jest.fn()}
      addToRoster={jest.fn()}
      removeFromRoster={jest.fn()}
      {...overrides}
    />,
  );

beforeAll(() => {
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    value: jest.fn(),
  });
});

describe('GameLineupsTab starting goalies', () => {
  it('shows the Starting Goalie tag for saved starting goalies', () => {
    renderTab(false);

    expect(screen.getByText('Starting Goalie')).toBeInTheDocument();
    expect(screen.getByText('Goalie')).toBeInTheDocument();
  });

  it('locks final admin starting goalies until correction is confirmed', () => {
    renderTab(true, { lineup: [] });

    expect(screen.queryByRole('button', { name: 'Set as starting goalie' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /correct final starting goalie/i }));
    expect(screen.getByText(/corrections can change goalie game logs/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /start correction/i }));

    expect(screen.getByRole('button', { name: 'Set as starting goalie' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove from lineup' })).toBeInTheDocument();
  });

  it('sets a roster goalie as the starting goalie', async () => {
    const saveTeamLineup = jest.fn().mockResolvedValue(true);

    renderTab(false, {
      game: { ...game, status: 'scheduled' },
      isFinal: false,
      lineup: [],
      saveTeamLineup,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Set as starting goalie' }));

    await waitFor(() =>
      expect(saveTeamLineup).toHaveBeenCalledWith(
        'team-away',
        [{ position_slot: 'G', player_id: 'player-1' }],
        'Away Team',
      ),
    );
  });

  it('replaces an existing starting goalie', async () => {
    const saveTeamLineup = jest.fn().mockResolvedValue(true);
    const rosterWithReplacement = [
      awayRoster[0],
      {
        id: 'entry-2',
        game_id: 'game-1',
        team_id: 'team-away',
        player_id: 'player-2',
        first_name: 'Jane',
        last_name: 'Doe',
        photo: null,
        jersey_number: 20,
        position: 'G',
        inherited: false,
      },
    ] as GameRosterEntry[];

    renderTab(false, {
      game: { ...game, status: 'scheduled' },
      isFinal: false,
      awayRoster: rosterWithReplacement,
      lineup: inheritedLineup,
      saveTeamLineup,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Set as starting goalie' }));

    await waitFor(() =>
      expect(saveTeamLineup).toHaveBeenCalledWith(
        'team-away',
        [{ position_slot: 'G', player_id: 'player-2' }],
        'Away Team',
      ),
    );
  });

  it('does not offer starting goalie actions for skaters', () => {
    const saveTeamLineup = jest.fn().mockResolvedValue(true);
    const skaterRoster = [
      {
        id: 'entry-skater',
        game_id: 'game-1',
        team_id: 'team-away',
        player_id: 'player-skater',
        first_name: 'Jane',
        last_name: 'Doe',
        photo: null,
        jersey_number: 20,
        position: 'F',
        inherited: false,
      },
    ] as GameRosterEntry[];

    renderTab(false, {
      game: { ...game, status: 'scheduled' },
      isFinal: false,
      awayRoster: skaterRoster,
      lineup: [],
      saveTeamLineup,
    });

    expect(screen.queryByRole('button', { name: 'Set as starting goalie' })).not.toBeInTheDocument();
    expect(saveTeamLineup).not.toHaveBeenCalled();
  });
});
