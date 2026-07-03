import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import GoalieStatsCard from './GoalieStatsCard';

type GoalieStatsCardProps = ComponentProps<typeof GoalieStatsCard>;

const team = {
  id: 'away-team',
  name: 'Away Team',
  code: 'AWY',
  logo: null,
  logo_dark: null,
  logo_light: null,
  primary_color: '#111111',
  secondary_color: '#222222',
  text_color: '#ffffff',
};

const game = {
  id: 'game-1',
  season_id: 'season-1',
  game_type: 'regular',
  status: 'final',
  scheduled_at: '2024-10-10T19:00:00Z',
  scheduled_time: null,
  venue: null,
  time_start: null,
  time_end: null,
  home_team: {
    ...team,
    id: 'home-team',
    name: 'Home Team',
    code: 'HOM',
  },
  away_team: team,
  home_score: 2,
  away_score: 3,
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
  created_at: '2024-09-01T12:00:00Z',
  period_scores: [],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  best_of_shootout: 3,
} as GoalieStatsCardProps['game'];

const goalie = {
  id: 'roster-1',
  game_id: 'game-1',
  team_id: 'away-team',
  player_id: 'goalie-1',
  first_name: 'Sarah',
  last_name: 'Nurse',
  photo: null,
  position: 'G',
  jersey_number: 20,
  date_of_birth: null,
  start_date: null,
  acquisition_type: null,
} as GoalieStatsCardProps['awayRoster'][number];

const reliefGoalie = {
  ...goalie,
  id: 'roster-2',
  player_id: 'goalie-2',
  first_name: 'Marie-Philip',
  last_name: 'Poulin',
  jersey_number: 29,
} as GoalieStatsCardProps['awayRoster'][number];

const goalieStats = [
  {
    id: 'goalie-stat-1',
    game_id: 'game-1',
    team_id: 'away-team',
    goalie_id: 'goalie-1',
    shots_against: 31,
    goals_against: 2,
    saves: 29,
    entered_period: '1',
    sub_time: '00:00',
    created_at: '2024-10-10T22:00:00Z',
    stints: [
      {
        id: 'stint-1',
        stint_ord: 1,
        entered_period: '1',
        entered_time: '00:00',
        exited_period: null,
        exited_time: null,
        shots_against: 31,
        goals_against: 2,
        goals_against_override: null,
        time_on_ice: 3600,
        saves: 29,
      },
    ],
    goalie_first_name: 'Sarah',
    goalie_last_name: 'Nurse',
    goalie_photo: null,
    goalie_jersey_number: 20,
    team_name: 'Away Team',
    team_code: 'AWY',
    team_logo: null,
    team_primary_color: '#111111',
    team_text_color: '#ffffff',
  },
] as GoalieStatsCardProps['goalieStats'];

const switchedGoalieStats = [
  {
    ...goalieStats[0],
    stints: [
      {
        ...goalieStats[0].stints[0],
        exited_period: '2',
        exited_time: '05:30',
        time_on_ice: 1530,
      },
    ],
  },
  {
    ...goalieStats[0],
    id: 'goalie-stat-2',
    goalie_id: 'goalie-2',
    saves: 15,
    shots_against: 16,
    goals_against: 1,
    goalie_first_name: 'Marie-Philip',
    goalie_last_name: 'Poulin',
    goalie_jersey_number: 29,
    stints: [
      {
        id: 'stint-2',
        stint_ord: 1,
        entered_period: '2',
        entered_time: '05:30',
        exited_period: null,
        exited_time: null,
        shots_against: 16,
        goals_against: 1,
        goals_against_override: null,
        time_on_ice: 2070,
        saves: 15,
      },
    ],
  },
] as GoalieStatsCardProps['goalieStats'];

describe('GoalieStatsCard', () => {
  it('renders goalie stats as list item stat cells with the compact stat set', () => {
    render(
      <MemoryRouter>
        <GoalieStatsCard
          game={game}
          awayRoster={[goalie]}
          homeRoster={[]}
          goalieStats={goalieStats}
          goals={[]}
          getPlayerHref={() => '/players/goalie-1'}
          isFinal
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Sarah Nurse')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    expect(screen.getByText('SA')).toBeInTheDocument();
    expect(screen.getByText('SV')).toBeInTheDocument();
    expect(screen.getByText('GA')).toBeInTheDocument();
    expect(screen.getByText('SV%')).toBeInTheDocument();
    expect(screen.getByText('TOI')).toBeInTheDocument();
    expect(screen.queryByText('GAA')).not.toBeInTheDocument();

    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.getByText('29')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('.935')).toBeInTheDocument();
    expect(screen.getByText('60:00')).toBeInTheDocument();
  });

  it('places goalie switch-in windows in the list item subtitle', () => {
    render(
      <MemoryRouter>
        <GoalieStatsCard
          game={game}
          awayRoster={[goalie, reliefGoalie]}
          homeRoster={[]}
          goalieStats={switchedGoalieStats}
          goals={[]}
          isFinal
        />
      </MemoryRouter>,
    );

    const switchInSubtitle = screen.getByText('P2 05:30 \u2192 End of game');
    expect(switchInSubtitle).toHaveClass('subtitle');
    expect(screen.getByText('Marie-Philip Poulin')).toBeInTheDocument();
  });
});
