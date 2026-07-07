import {
  getPlayoffScoreMetaBaseLabel,
  getPlayoffScoreMetaDisplay,
  getPlayoffScoreMetaLabel,
} from './playoffScoreMeta';

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

  it('returns the selected label without a game suffix when requested', () => {
    expect(
      getPlayoffScoreMetaBaseLabel({
        playoff_round: 3,
        playoff_round_names: { 3: 'Finals' },
        playoff_matchup_names: { r3m0: 'Championship Matchup' },
        bracket_slot_key: 'r3m0',
        game_number_in_series: 6,
      }),
    ).toBe('Championship Matchup');
  });

  it('uses initials for custom matchup display labels and keeps the full label for the tooltip', () => {
    expect(
      getPlayoffScoreMetaDisplay({
        playoff_round: 2,
        playoff_round_names: { 2: 'Semifinal' },
        playoff_matchup_names: { r2m0: 'Atlantic Division Semifinal' },
        bracket_slot_key: 'r2m0',
        game_number_in_series: 5,
      }),
    ).toEqual({
      label: 'ADS · Game 5',
      tooltip: 'Atlantic Division Semifinal · Game 5',
    });
  });

  it('uses initials for custom round fallback display labels', () => {
    expect(
      getPlayoffScoreMetaDisplay({
        playoff_round: 2,
        playoff_round_names: { 2: 'Western Conference Final' },
        playoff_matchup_names: { r2m1: 'Eastern Conference Final' },
        bracket_slot_key: 'r2m0',
      }),
    ).toEqual({
      label: 'WCF',
      tooltip: 'Western Conference Final',
    });
  });

  it('keeps default round labels readable without a tooltip', () => {
    expect(
      getPlayoffScoreMetaDisplay({
        playoff_round: 2,
        game_number_in_series: 3,
      }),
    ).toEqual({
      label: 'Round 2 · Game 3',
      tooltip: null,
    });
  });
});
