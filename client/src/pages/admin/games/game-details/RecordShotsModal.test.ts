import type { GoalieStatRecord } from '@/hooks/useGameGoalieStats';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import type { GameRecord } from '@/hooks/useGames';
import { computeAutoSA } from './RecordShotsModal';

const game = {
  away_team: { id: 'tbl' },
  home_team: { id: 'mtl' },
} as GameRecord;

const goalie = {
  player_id: 'tbl-goalie',
  team_id: 'tbl',
} as GameRosterEntry;

const goalieStats = [
  {
    goalie_id: 'tbl-goalie',
    team_id: 'tbl',
    stints: [
      {
        entered_period: '1',
        entered_time: null,
        exited_period: null,
        exited_time: null,
      },
    ],
  },
] as GoalieStatRecord[];

describe('computeAutoSA', () => {
  it('includes playoff overtime shots and ignores shootout rows', () => {
    const periodShots = [
      { period: '1', away_shots: 8, home_shots: 10 },
      { period: '2', away_shots: 7, home_shots: 9 },
      { period: '3', away_shots: 9, home_shots: 11 },
      { period: 'OT1', away_shots: 2, home_shots: 7 },
      { period: 'SO', away_shots: 5, home_shots: 5 },
    ];

    expect(computeAutoSA(goalie, goalieStats, game, periodShots, [])).toBe('37');
  });
});
