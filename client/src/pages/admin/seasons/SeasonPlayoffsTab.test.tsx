import {
  canonicalSlotKey,
  getSeasonGroupTeamIds,
  normalizeBracketSlotRule,
} from './SeasonPlayoffsTab';
import { type GroupTeamRecord } from '@/hooks/useLeagueGroups';
import { getMatchupLabel, getRoundLabel } from './BracketRulesModal';
import {
  getBracketSlotFooterLabel,
  getBracketSlotHeaderLabel,
} from './seasonPlayoffBracketLabels';
import { hasRecordedRegularSeasonGame } from './seasonPlayoffEligibility';

const groupTeam = (id: string): GroupTeamRecord => ({
  id,
  name: id,
  code: id.toUpperCase(),
  logo: null,
});

describe('playoff bracket slot key normalization', () => {
  it('maps legacy home and away suffixes to canonical team slots', () => {
    expect(canonicalSlotKey('r1m0away')).toBe('r1m0team1');
    expect(canonicalSlotKey('r1m0home')).toBe('r1m0team2');
  });

  it('normalizes fetched bracket rules before simulation uses them', () => {
    expect(
      normalizeBracketSlotRule({
        slot_key: 'r1m0away',
        rule_type: 'unchosen',
        rank: null,
        scope: null,
        group_id: null,
        pool: [],
        choice_ref: 'r1m0home',
        matchup_ref: null,
      }),
    ).toMatchObject({
      slot_key: 'r1m0team1',
      choice_ref: 'r1m0team2',
    });
  });

  it('leaves canonical slot keys unchanged', () => {
    expect(canonicalSlotKey('r2m1team2')).toBe('r2m1team2');
  });

  it('resolves legacy group ids through alignment stable keys', () => {
    const teams = getSeasonGroupTeamIds(
      [
        {
          id: 'alignment-conference',
          stable_key: 'legacy:legacy-conference',
          league_id: 'league-1',
          parent_id: null,
          name: 'Eastern',
          sort_order: 0,
          created_at: '2024-01-01T00:00:00.000Z',
          role: 'conference',
          teams: [groupTeam('team-1')],
          has_season_override: false,
          is_inherited: false,
          is_auto: false,
        },
        {
          id: 'alignment-division',
          league_id: 'league-1',
          parent_id: 'alignment-conference',
          name: 'Atlantic',
          sort_order: 0,
          created_at: '2024-01-01T00:00:00.000Z',
          role: 'division',
          teams: [groupTeam('team-2')],
          has_season_override: false,
          is_inherited: false,
          is_auto: false,
        },
      ],
      'legacy-conference',
    );

    expect([...teams].sort()).toEqual(['team-1', 'team-2']);
  });

  it('keeps shared round labels independent from matchup labels', () => {
    expect(getRoundLabel(3, 4, { 3: 'Conference Finals' })).toBe('Conference Finals');
    expect(getMatchupLabel('r3m0', null)).toBeNull();
  });

  it('resolves matchup labels by neutral bracket slot key', () => {
    expect(
      getMatchupLabel('r3m1', {
        r3m0: 'Eastern Conference Final',
        r3m1: 'Western Conference Final',
      }),
    ).toBe('Western Conference Final');
  });

  it('uses round labels on the first series unless that series has a matchup label', () => {
    expect(
      getBracketSlotHeaderLabel({
        slotIndex: 0,
        slotKey: 'r2m0',
        round: 2,
        totalRounds: 4,
        roundNames: { 2: 'Semifinals' },
        matchupNames: null,
      }),
    ).toBe('Semifinals');
    expect(
      getBracketSlotHeaderLabel({
        slotIndex: 1,
        slotKey: 'r2m1',
        round: 2,
        totalRounds: 4,
        roundNames: { 2: 'Semifinals' },
        matchupNames: null,
      }),
    ).toBeNull();
    expect(
      getBracketSlotHeaderLabel({
        slotIndex: 0,
        slotKey: 'r2m0',
        round: 2,
        totalRounds: 4,
        roundNames: { 2: 'Semifinals' },
        matchupNames: { r2m0: 'Eastern Semifinal' },
      }),
    ).toBe('Eastern Semifinal');
  });

  it('uses round labels below the last series only for rounds with more than two series', () => {
    expect(
      getBracketSlotFooterLabel({
        slotIndex: 3,
        seriesCount: 4,
        round: 1,
        totalRounds: 4,
        roundNames: { 1: 'Quarterfinals' },
      }),
    ).toBe('Quarterfinals');
    expect(
      getBracketSlotFooterLabel({
        slotIndex: 2,
        seriesCount: 4,
        round: 1,
        totalRounds: 4,
        roundNames: { 1: 'Quarterfinals' },
      }),
    ).toBeNull();
    expect(
      getBracketSlotFooterLabel({
        slotIndex: 1,
        seriesCount: 2,
        round: 2,
        totalRounds: 4,
        roundNames: { 2: 'Semifinals' },
      }),
    ).toBeNull();
  });

  it('only treats standings as simulation-ready after a team has played', () => {
    expect(hasRecordedRegularSeasonGame([{ gp: 0 }, { gp: 0 }])).toBe(false);
    expect(hasRecordedRegularSeasonGame([{ gp: 0 }, { gp: 1 }])).toBe(true);
  });
});
