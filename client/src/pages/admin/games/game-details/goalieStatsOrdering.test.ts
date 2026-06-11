import type { GoalieStatRecord } from '@/hooks/useGameGoalieStats';
import type { GameRosterEntry } from '@/hooks/useGameRoster';
import {
  compareGoalieStats,
  gameHasGoalieSwitch,
  goalieStatIsStarter,
  teamHasGoalieSwitch,
} from './goalieStatsOrdering';

const roster = (playerId: string, teamId: string, lastName: string): GameRosterEntry =>
  ({
    player_id: playerId,
    team_id: teamId,
    first_name: 'Goalie',
    last_name: lastName,
    position: 'G',
  }) as GameRosterEntry;

const stat = (
  goalieId: string,
  teamId: string,
  stints: GoalieStatRecord['stints'],
): GoalieStatRecord =>
  ({
    id: goalieId,
    game_id: 'game-1',
    team_id: teamId,
    goalie_id: goalieId,
    shots_against: stints.reduce((sum, stint) => sum + stint.shots_against, 0),
    goals_against: stints.reduce((sum, stint) => sum + stint.goals_against, 0),
    saves: stints.reduce((sum, stint) => sum + stint.saves, 0),
    entered_period: null,
    sub_time: null,
    created_at: '',
    stints,
    goalie_first_name: 'Goalie',
    goalie_last_name: goalieId,
    goalie_photo: null,
    goalie_jersey_number: null,
    team_name: teamId,
    team_code: teamId,
    team_logo: null,
    team_primary_color: '#000',
    team_text_color: '#fff',
  }) as GoalieStatRecord;

const stint = (
  id: string,
  enteredPeriod: string,
  enteredTime: string | null,
): GoalieStatRecord['stints'][number] => ({
  id,
  stint_ord: 1,
  entered_period: enteredPeriod,
  entered_time: enteredTime,
  exited_period: null,
  exited_time: null,
  shots_against: 1,
  goals_against: 0,
  goals_against_override: null,
  saves: 1,
});

describe('goalieStatsOrdering', () => {
  it('orders away team first, then starters before switched-in goalies', () => {
    const awayStarter = stat('away-starter', 'away', [stint('as', '1', '00:00')]);
    const awayBackup = stat('away-backup', 'away', [stint('ab', '2', '00:00')]);
    const homeStarter = stat('home-starter', 'home', [stint('hs', '1', '00:00')]);

    const rows = [
      { stat: homeStarter, roster: roster('home-starter', 'home', 'Home') },
      { stat: awayBackup, roster: roster('away-backup', 'away', 'Backup') },
      { stat: awayStarter, roster: roster('away-starter', 'away', 'Starter') },
    ].sort((a, b) => compareGoalieStats(a.stat, a.roster, b.stat, b.roster, 'away'));

    expect(rows.map((row) => row.stat.goalie_id)).toEqual([
      'away-starter',
      'away-backup',
      'home-starter',
    ]);
  });

  it('detects starters and team switches from recorded appearances', () => {
    const starter = stat('starter', 'away', [stint('s', '1', '00:00')]);
    const backup = stat('backup', 'away', [stint('b', '3', '10:00')]);

    expect(goalieStatIsStarter(starter)).toBe(true);
    expect(goalieStatIsStarter(backup)).toBe(false);
    expect(teamHasGoalieSwitch([starter, backup], 'away')).toBe(true);
    expect(gameHasGoalieSwitch([starter, backup])).toBe(true);
  });
});
