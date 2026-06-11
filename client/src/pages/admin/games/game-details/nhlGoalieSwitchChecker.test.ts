import {
  buildGoalieStintsFromShiftChart,
  buildNhlGamecenterGameId,
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

  it('builds the full GameCenter id from a short game number and season context', () => {
    expect(
      buildNhlGamecenterGameId('257', {
        seasonName: '2025-26',
        scheduledAt: '2026-01-15T00:00:00Z',
      }),
    ).toBe('2025020257');
    expect(
      buildNhlGamecenterGameId('260', {
        scheduledAt: '2026-02-01T00:00:00Z',
      }),
    ).toBe('2025020260');
    expect(
      buildNhlGamecenterGameId(
        'https://api-web.nhle.com/v1/gamecenter/2025020237/boxscore',
      ),
    ).toBe('2025020237');
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
            timeInPeriod: '08:00',
            timeRemaining: '12:00',
            sortOrder: 20,
            typeDescKey: 'goal',
            details: { goalieInNetId: 100 },
          },
          {
            periodDescriptor: { number: 2 },
            timeInPeriod: '08:30',
            timeRemaining: '11:30',
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
        enteredTime: '00:00',
        exitedPeriod: 'P2',
        exitedTime: '08:00',
        toi: '30:00',
      },
      {
        teamSide: 'home',
        teamAbbrev: 'HOM',
        goalieId: 101,
        goalieName: 'Home Relief',
        enteredPeriod: 'P2',
        enteredTime: '08:00',
        exitedPeriod: null,
        exitedTime: null,
        toi: '30:00',
      },
    ]);
  });

  it('uses goalie TOI to place a played goalie with no shot observations', () => {
    const stints = buildGoalieStints(
      {
        plays: [
          {
            periodDescriptor: { number: 1 },
            timeInPeriod: '02:18',
            timeRemaining: '17:42',
            sortOrder: 10,
            typeDescKey: 'shot-on-goal',
            details: { goalieInNetId: 8475883 },
          },
          {
            periodDescriptor: { number: 3 },
            timeInPeriod: '14:41',
            timeRemaining: '05:19',
            sortOrder: 20,
            typeDescKey: 'shot-on-goal',
            details: { goalieInNetId: 8475883 },
          },
        ],
      },
      {
        away: [{ playerId: 8480313, name: 'Away Starter', teamAbbrev: 'WSH', toi: '60:00' }],
        home: [
          {
            playerId: 8475883,
            name: 'F. Andersen',
            teamAbbrev: 'CAR',
            toi: '54:50',
            starter: true,
          },
          {
            playerId: 8481611,
            name: 'P. Kochetkov',
            teamAbbrev: 'CAR',
            toi: '03:36',
            starter: false,
          },
        ],
      },
    );

    expect(stints.filter((stint) => stint.teamSide === 'home')).toEqual([
      {
        teamSide: 'home',
        teamAbbrev: 'CAR',
        goalieId: 8475883,
        goalieName: 'F. Andersen',
        enteredPeriod: 'P1',
        enteredTime: '00:00',
        exitedPeriod: 'P3',
        exitedTime: '14:50',
        toi: '54:50',
      },
      {
        teamSide: 'home',
        teamAbbrev: 'CAR',
        goalieId: 8481611,
        goalieName: 'P. Kochetkov',
        enteredPeriod: 'P3',
        enteredTime: '14:50',
        exitedPeriod: null,
        exitedTime: null,
        toi: '03:36',
      },
    ]);
  });

  it('uses NHL shift chart start and end times for goalie stints', () => {
    const stints = buildGoalieStintsFromShiftChart(
      {
        data: [
          {
            playerId: 100,
            period: 1,
            startTime: '00:00',
            endTime: '20:00',
            duration: '20:00',
            teamAbbrev: 'HOM',
          },
          {
            playerId: 100,
            period: 2,
            startTime: '00:00',
            endTime: '10:30',
            duration: '10:30',
            teamAbbrev: 'HOM',
          },
          {
            playerId: 101,
            period: 2,
            startTime: '10:30',
            endTime: '20:00',
            duration: '09:30',
            teamAbbrev: 'HOM',
          },
        ],
      },
      {
        away: [{ playerId: 200, name: 'Away Starter', teamAbbrev: 'AWY', toi: '60:00' }],
        home: [
          { playerId: 100, name: 'Home Starter', teamAbbrev: 'HOM', toi: '30:30' },
          { playerId: 101, name: 'Home Relief', teamAbbrev: 'HOM', toi: '09:30' },
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
        enteredTime: '00:00',
        exitedPeriod: 'P1',
        exitedTime: '20:00',
        toi: '20:00',
      },
      {
        teamSide: 'home',
        teamAbbrev: 'HOM',
        goalieId: 100,
        goalieName: 'Home Starter',
        enteredPeriod: 'P2',
        enteredTime: '00:00',
        exitedPeriod: 'P2',
        exitedTime: '10:30',
        toi: '10:30',
      },
      {
        teamSide: 'home',
        teamAbbrev: 'HOM',
        goalieId: 101,
        goalieName: 'Home Relief',
        enteredPeriod: 'P2',
        enteredTime: '10:30',
        exitedPeriod: 'P2',
        exitedTime: '20:00',
        toi: '09:30',
      },
    ]);
  });
});
