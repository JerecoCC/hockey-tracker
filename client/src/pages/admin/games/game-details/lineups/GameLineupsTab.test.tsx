import { render, screen } from '@testing-library/react';
import type { GameRecord } from '@/hooks/useGames';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type { LineupEntry } from '@/hooks/useGameLineup';
import GameLineupsTab from './GameLineupsTab';

jest.mock('@/hooks/useTeamPlayers', () => () => ({ createAndRosterPlayers: jest.fn() }));
jest.mock('@/components/Accordion/Accordion', () => ({ label, children }: any) => <div><div>{label}</div>{children}</div>);
jest.mock('@/components/Card/Card', () => ({ children, title }: any) => <div><div>{title}</div>{children}</div>);
jest.mock('@/components/SegmentedControl/SegmentedControl', () => () => null);
jest.mock('@/components/TeamLogo/TeamLogo', () => () => <span>logo</span>);
jest.mock('./LineupRosterModal', () => () => null);
jest.mock('./LineupCreatePlayersModal', () => () => null);
jest.mock('./SetLineupModal', () => () => null);
jest.mock('./RemoveFromLineupModal', () => () => null);
jest.mock('@/components/ListItem/ListItem', () => ({ name, rightContent }: any) => (
  <div>
    <span>{name}</span>
    {rightContent?.type === 'tag' && <span>{rightContent.label}</span>}
  </div>
));

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
    position: 'C',
    inherited: false,
  },
] as GameRosterEntry[];

const inheritedLineup: LineupEntry[] = [
  {
    id: 'lineup-1',
    game_id: 'game-1',
    team_id: 'team-away',
    player_id: 'player-1',
    position_slot: 'C',
    inherited: true,
  },
] as LineupEntry[];

const renderTab = (isEditMode: boolean) =>
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
    />,
  );

describe('GameLineupsTab starter tags', () => {
  it('shows Starter for inherited starters when the game is final and not in edit mode', () => {
    renderTab(false);

    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.queryByText('Last Starter')).not.toBeInTheDocument();
  });

  it('keeps Last Starter for inherited starters while editing a final game', () => {
    renderTab(true);

    expect(screen.getByText('Last Starter')).toBeInTheDocument();
    expect(screen.queryByText('Starter')).not.toBeInTheDocument();
  });
});