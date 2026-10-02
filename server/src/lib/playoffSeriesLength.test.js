'use strict';

jest.mock('../db', () => ({ sql: jest.fn() }));

const { sql } = require('../db');
const { normalizeRoundBestOf, resolveSeriesGamesToWin } = require('./playoffSeriesLength');

describe('normalizeRoundBestOf', () => {
  it('keeps valid per-round lengths as numbers keyed by round', () => {
    expect(normalizeRoundBestOf({ 1: '3', 2: 5, 3: 5 })).toEqual({ 1: 3, 2: 5, 3: 5 });
  });

  it('drops blank rounds and returns null when nothing is set', () => {
    expect(normalizeRoundBestOf({ 1: 3, 2: null, 3: '' })).toEqual({ 1: 3 });
    expect(normalizeRoundBestOf({ 1: null })).toBeNull();
    expect(normalizeRoundBestOf(null)).toBeNull();
  });

  it.each([
    [{ 1: 4 }, 'round_best_of values must be 3, 5, or 7'],
    [{ 5: 3 }, 'round_best_of keys must be round numbers 1-4'],
    [[3, 5], 'round_best_of must be an object keyed by round number'],
  ])('rejects %j', (value, message) => {
    expect(() => normalizeRoundBestOf(value)).toThrow(message);
    try {
      normalizeRoundBestOf(value);
    } catch (err) {
      expect(err.status).toBe(400);
    }
  });
});

describe('resolveSeriesGamesToWin', () => {
  beforeEach(() => sql.mockReset());

  it('converts the resolved series length into wins needed', async () => {
    sql.mockResolvedValueOnce([{ best_of: 3 }]);
    await expect(resolveSeriesGamesToWin('season-1', 1)).resolves.toBe(2);

    sql.mockResolvedValueOnce([{ best_of: 5 }]);
    await expect(resolveSeriesGamesToWin('season-1', 2)).resolves.toBe(3);
  });

  it('looks up the requested round in the rule set before the season and league', async () => {
    sql.mockResolvedValueOnce([{ best_of: 5 }]);
    await resolveSeriesGamesToWin('season-1', 3);

    const [strings, ...values] = sql.mock.calls[0];
    const query = strings.join('?');
    expect(query).toMatch(/brs\.round_best_of ->> \?\)::smallint,\s*s\.best_of_playoff,\s*l\.best_of_playoff/);
    expect(values).toEqual(['3', 'season-1']);
  });

  it('defaults to best of 7 when the season is missing', async () => {
    sql.mockResolvedValueOnce([]);
    await expect(resolveSeriesGamesToWin('missing', 1)).resolves.toBe(4);
  });
});
