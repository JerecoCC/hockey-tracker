import { getPlayoffScoreMetaLabel } from './playoffScoreMeta';

describe('getPlayoffScoreMetaLabel', () => {
  it('prefers a custom matchup label over a custom round name', () => {
    expect(
      getPlayoffScoreMetaLabel({
        playoff_round: 2,
        playoff_round_names: { 2: 'Semifinal' },
        playoff_matchup_names: { r2m0: 'Eastern Semifinal' },
        bracket_slot_key: 'r2m0',
      }),
    ).toBe('Eastern Semifinal');
  });

  it('falls back to the custom round name when no matchup label exists', () => {
    expect(
      getPlayoffScoreMetaLabel({
        playoff_round: 2,
        playoff_round_names: { 2: 'Semifinal' },
        playoff_matchup_names: { r2m1: 'Western Semifinal' },
        bracket_slot_key: 'r2m0',
      }),
    ).toBe('Semifinal');
  });

  it('keeps the game number suffix with the selected label', () => {
    expect(
      getPlayoffScoreMetaLabel({
        playoff_round: 1,
        playoff_round_names: { 1: 'Quarterfinals' },
        playoff_matchup_names: { r1m0: 'Opening Matchup' },
        bracket_slot_key: 'r1m0',
        game_number_in_series: 3,
      }),
    ).toBe('Opening Matchup · Game 3');
  });
});
