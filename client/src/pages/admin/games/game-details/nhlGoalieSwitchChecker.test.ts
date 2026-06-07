import {
  buildGoalieStints,
  detectGoalieSwitch,
  extractGameIdFromNhlUrl,
  formatEasternStartTime,
  getGoaliesFromLanding,
  goalieActuallyPlayed,
} from './nhlGoalieSwitchChecker';

describe('NHL goalie switch checker helpers', () => {
  it('extracts the GameCenter game id from supported endpoint URLs', () => {
    expect(
      extractGameIdFromNhlUrl('https://api-web.nhle.com/v1/gamecenter/2025020237/landing'),
    ).toBe('2025020237');
    expect(
      extractGameIdFromNhlUrl('https://api-web.nhle.com/v1/gamecenter/2025020237/boxscore'),
    ).toBe('2025020237');
    expect(
      extractGameIdFromNhlUrl('https://api-web.nhle.com/v1/gamecenter/2025020237/play-by-play'),
    ).toBe('2025020237');
    expect(extractGameIdFromNhlUrl('https://example.com/game/2025020237')).toBeNull();
  });

  it('formats scheduled starts in Eastern Time', () => {
    expect(formatEasternStartTime('2025-11-09T00:00:00Z')).toBe('Nov 8, 2025, 7:00 PM EST');
  });

  it('normalizes goalies from boxscore-style playerByGameStats data', () => {
    const goalies = getGoaliesFromLanding({
      awayTeam: { id: 1, abbrev: 'AWY' },
      homeTeam: { id: 2, abbrev: 'HOM' },
      playerByGameStats: {
        awayTeam: {
          goalies: [
            {
              playerId: 10,
              name: { default: 'A. Starter' },
              toi: '60:00',
              shotsAgainst: 25,
              saves: 24,
              goalsAgainst: 1,
              starter: true,
            },
          ],
        },
        homeTeam: {
          goalies: [
            {
              playerId: 20,
              name: { default: 'H. Starter' },
              toi: '00:00',
              shotsAgainst: 0,
              saves: 0,
              goalsAgainst: 0,
            },
          ],
        },
      },
    });

    expect(goalies.away[0]).toMatchObject({
      playerId: 10,
      name: 'A. Starter',
      teamId: 1,
      teamAbbrev: 'AWY',
    });
    expect(goalies.home[0].name).toBe('H. Starter');
  });

  it('does not count dressed backup goalies as true appearances', () => {
    expect(
      goalieActuallyPlayed({
        playerId: 1,
        name: 'Backup',
        toi: '00:00',
        shotsAgainst: 0,
        saves: 0,
        goalsAgainst: 0,
      }),
    ).toBe(false);
    expect(goalieActuallyPlayed({ playerId: 2, name: 'Relief', toi: '00:01' })).toBe(true);
    expect(detectGoalieSwitch([{ playerId: 1, name: 'Starter', toi: '60:00' }])).toBe(false);
    expect(
      detectGoalieSwitch([
        { playerId: 1, name: 'Starter', toi: '42:00' },
        { playerId: 2, name: 'Relief', toi: '18:00' },
      ]),
    ).toBe(true);
  });

  it('derives goalie stints from on-ice goalie ids without treating backups as switches', () => {
    const stints = buildGoalieStints(
      {
        plays: [
          {
            periodDescriptor: { number: 1 },
            timeInPeriod: '01:00',
            timeRemaining: '19:00',
            sortOrder: 10,
            typeDescKey: 'shot-on-goal',
            details: { goalieInNetId: 100 },
          },
          {
            periodDescriptor: { number: 2 },
            timeInPeriod: '10:00',
            timeRemaining: '10:00',
            sortOrder: 20,
            typeDescKey: 'goal',
            details: { goalieInNetId: 100 },
          },
          {
            periodDescriptor: { number: 2 },
            timeInPeriod: '10:30',
            timeRemaining: '09:30',
            sortOrder: 30,
            typeDescKey: 'shot-on-goal',
            details: { goalieInNetId: 101 },
          },
        ],
      },
      {
        away: [{ playerId: 200, name: 'Away Starter', teamAbbrev: 'AWY', toi: '60:00' }],
        home: [
          { playerId: 100, name: 'Home Starter', teamAbbrev: 'HOM', toi: '30:00' },
          { playerId: 101, name: 'Home Relief', teamAbbrev: 'HOM', toi: '30:00' },
          { playerId: 102, name: 'Home Backup', teamAbbrev: 'HOM', toi: '00:00' },
        ],
      },
    );

    expect(stints.filter((stint) => stint.teamSide === 'home')).toEqual([
      {
        teamSide: 'home',
        teamAbbrev: 'HOM',
        goalieId: 100,
        goalieName: 'Home Starter',
        enteredPeriod: 'P1',
        enteredTime: '20:00',
        exitedPeriod: 'P2',
        exitedTime: '10:00',
        toi: '30:00',
      },
      {
        teamSide: 'home',
        teamAbbrev: 'HOM',
        goalieId: 101,
        goalieName: 'Home Relief',
        enteredPeriod: 'P2',
        enteredTime: '10:00',
        exitedPeriod: null,
        exitedTime: null,
        toi: '30:00',
      },
    ]);
  });
});
