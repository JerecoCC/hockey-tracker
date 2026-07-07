import type { PlayoffSeriesRecord } from '@/hooks/useGames';
import {
  buildPlayoffSeriesDocumentTitle,
  playoffSeasonEndYear,
  playoffSeriesTitleTeamName,
} from './playoffSeriesDocumentTitle';

const makeSeries = (overrides: Partial<PlayoffSeriesRecord> = {}): PlayoffSeriesRecord => ({
  id: 'series-1',
  season_id: 'season-1',
  round: 2,
  series_letter: null,
  playoff_round_names: { 2: 'Semifinal' },
  playoff_matchup_names: { r2m0: 'Atlantic Final' },
  home_team_id: 'home-team',
  home_team_name: 'Toronto Maple Leafs',
  home_team_place_name: 'Toronto',
  home_team_team_name: 'Maple Leafs',
  home_team_code: 'TOR',
  home_team_logo: null,
  home_team_logo_dark: null,
  home_team_logo_light: null,
  home_team_primary_color: '#00205b',
  home_team_secondary_color: '#ffffff',
  home_team_text_color: '#ffffff',
  away_team_id: 'away-team',
  away_team_name: 'Detroit Red Wings',
  away_team_place_name: 'Detroit',
  away_team_team_name: 'Red Wings',
  away_team_code: 'DET',
  away_team_logo: null,
  away_team_logo_dark: null,
  away_team_logo_light: null,
  away_team_primary_color: '#ce1126',
  away_team_secondary_color: '#ffffff',
  away_team_text_color: '#ffffff',
  games_to_win: 4,
  home_wins: 0,
  away_wins: 0,
  status: 'upcoming',
  winner_team_id: null,
  bracket_slot_key: 'r2m0',
  created_at: '2025-04-15T00:00:00.000Z',
  games: [],
  ...overrides,
});

describe('playoff series document title', () => {
  it('uses slot team nicknames, custom matchup name, and playoff season end year', () => {
    expect(
      buildPlayoffSeriesDocumentTitle(makeSeries(), {
        id: 'season-1',
        name: '2024-25',
        league_id: 'league-1',
        start_date: '2024-10-01',
        end_date: '2025-06-30',
        is_current: false,
        games_per_season: 82,
        created_at: '2024-01-01T00:00:00.000Z',
      }),
    ).toBe('Maple Leafs - Red Wings · Atlantic Final · Playoffs 2025');
  });

  it('removes the place name from combined fallback team names', () => {
    expect(
      playoffSeriesTitleTeamName({
        name: 'Toronto Maple Leafs',
        placeName: 'Toronto',
        teamName: null,
      }),
    ).toBe('Maple Leafs');
  });

  it('falls back to a season-name year range when the end date is missing', () => {
    expect(playoffSeasonEndYear({ name: '2024-25', end_date: null })).toBe('2025');
  });

  it('uses the custom round name when no custom matchup name matches', () => {
    expect(
      buildPlayoffSeriesDocumentTitle(
        makeSeries({
          playoff_matchup_names: { r2m1: 'Other Semifinal' },
        }),
        { name: '2024-25', end_date: null },
      ),
    ).toBe('Maple Leafs - Red Wings · Semifinal · Playoffs 2025');
  });
});
