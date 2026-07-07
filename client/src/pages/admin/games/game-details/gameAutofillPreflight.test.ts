import type { GameRecord, GameStatus, GameType, TeamInfo } from '@/hooks/useGames';
import { validateAutofillGamePreflight } from './gameAutofillPreflight';

const team = (id: string, code: string): TeamInfo => ({
  id,
  code,
  name: code,
  logo: null,
  primary_color: '#000000',
  secondary_color: '#ffffff',
  text_color: '#ffffff',
});

const teams = {
  car: team('car-team', 'CAR'),
  min: team('min-team', 'MIN'),
  bos: team('bos-team', 'BOS'),
};

function makeGame(
  overrides: Partial<GameRecord> & {
    id: string;
    home_team?: TeamInfo;
    away_team?: TeamInfo;
    game_type?: GameType;
    status?: GameStatus;
  },
): GameRecord {
  const { id, ...rest } = overrides;
  return {
    id,
    season_id: 'season-1',
    game_type: 'regular',
    status: 'scheduled',
    scheduled_at: '2025-11-19T02:00:00Z',
    scheduled_time: null,
    venue: null,
    time_start: null,
    time_end: null,
    home_team: teams.min,
    away_team: teams.car,
    home_score: 0,
    away_score: 0,
    overtime_periods: null,
    shootout: false,
    shootout_first_team_id: null,
    playoff_series_id: null,
    game_number_in_series: null,
    game_number: null,
    league_game_number: null,
    playoff_round: null,
    series_home_team_id: null,
    series_away_team_id: null,
    series_home_wins: null,
    series_away_wins: null,
    series_games_to_win: null,
    notes: null,
    created_at: '2025-11-01T00:00:00Z',
    current_period: '1',
    period_scores: [],
    period_shots: [],
    star_1_id: null,
    star_2_id: null,
    star_3_id: null,
    best_of_shootout: 3,
    ...rest,
  } as GameRecord;
}

describe('validateAutofillGamePreflight', () => {
  it('rejects a playoff game when the official round and local round differ', () => {
    const game = makeGame({
      id: 'game-3',
      game_type: 'playoff',
      playoff_series_id: 'series-1',
      playoff_round: 2,
      game_number_in_series: 3,
    });

    expect(() =>
      validateAutofillGamePreflight(game, [game], {
        leagueLabel: 'NHL',
        gameType: 'playoff',
        playoffRound: 1,
        playoffGameNumberInSeries: 3,
      }),
    ).toThrow(/NHL playoff game is from round 1, but this page is round 2/i);
  });

  it('rejects a playoff game when the official game number and local series game differ', () => {
    const game = makeGame({
      id: 'game-3',
      game_type: 'playoff',
      playoff_series_id: 'series-1',
      playoff_round: 2,
      game_number_in_series: 3,
    });

    expect(() =>
      validateAutofillGamePreflight(game, [game], {
        leagueLabel: 'NHL',
        gameType: 'playoff',
        playoffRound: 2,
        playoffGameNumberInSeries: 4,
      }),
    ).toThrow(/NHL playoff game is Game 4, but this page is Game 3/i);
  });

  it('rejects a playoff game when the previous game in the series is not final', () => {
    const game1 = makeGame({
      id: 'game-1',
      game_type: 'playoff',
      status: 'final',
      playoff_series_id: 'series-1',
      playoff_round: 1,
      game_number_in_series: 1,
    });
    const game2 = makeGame({
      id: 'game-2',
      game_type: 'playoff',
      status: 'scheduled',
      playoff_series_id: 'series-1',
      playoff_round: 1,
      game_number_in_series: 2,
    });
    const game3 = makeGame({
      id: 'game-3',
      game_type: 'playoff',
      playoff_series_id: 'series-1',
      playoff_round: 1,
      game_number_in_series: 3,
    });

    expect(() =>
      validateAutofillGamePreflight(game3, [game1, game2, game3], {
        leagueLabel: 'NHL',
        gameType: 'playoff',
        playoffRound: 1,
        playoffGameNumberInSeries: 3,
      }),
    ).toThrow(/Game 2 .* is not final/i);
  });

  it('rejects a regular season game when the official game number differs', () => {
    const game = makeGame({
      id: 'game-318',
      game_number: 318,
    });

    expect(() =>
      validateAutofillGamePreflight(game, [game], {
        leagueLabel: 'NHL',
        gameType: 'regular',
        regularGameNumber: 317,
      }),
    ).toThrow(/NHL game number 317 does not match local regular season game 318/i);
  });

  it('rejects a regular season game when either team has an earlier non-final game', () => {
    const unrelated = makeGame({
      id: 'game-3',
      status: 'scheduled',
      home_team: teams.bos,
      away_team: team('nyr-team', 'NYR'),
      game_number: 3,
    });
    const blocker = makeGame({
      id: 'game-4',
      status: 'scheduled',
      home_team: teams.bos,
      away_team: teams.car,
      game_number: 4,
    });
    const current = makeGame({
      id: 'game-5',
      game_number: 5,
      home_team: teams.min,
      away_team: teams.car,
    });

    expect(() =>
      validateAutofillGamePreflight(current, [unrelated, blocker, current], {
        leagueLabel: 'PWHL',
        gameType: 'regular',
        regularGameNumber: 5,
      }),
    ).toThrow(/Game 4 .* is not final/i);
  });
});
