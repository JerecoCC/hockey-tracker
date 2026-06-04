const {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} = require('drizzle-orm/pg-core');
const { sql } = require('drizzle-orm');

const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

const users = pgTable('users', {
  id: id(),
  googleId: text('google_id').unique(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password'),
  photo: text('photo'),
  role: text('role').notNull().default('user'),
  createdAt: createdAt(),
});

const leagues = pgTable('leagues', {
  id: id(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  description: text('description'),
  logo: text('logo'),
  primaryColor: text('primary_color').notNull().default('#334155'),
  textColor: text('text_color').notNull().default('#ffffff'),
  currentSeasonId: uuid('current_season_id'),
  bestOfPlayoff: smallint('best_of_playoff').notNull().default(7),
  bestOfShootout: smallint('best_of_shootout').notNull().default(3),
  scoringSystem: text('scoring_system').notNull().default('2-1-0'),
  playoffFormat: jsonb('playoff_format'),
  createdAt: createdAt(),
});

const teams = pgTable('teams', {
  id: id(),
  description: text('description'),
  location: text('location'),
  leagueId: uuid('league_id').references(() => leagues.id, { onDelete: 'set null' }),
  primaryColor: text('primary_color').notNull().default('#334155'),
  secondaryColor: text('secondary_color').notNull().default('#1e293b'),
  textColor: text('text_color').notNull().default('#ffffff'),
  city: text('city'),
  homeArena: text('home_arena'),
  startSeasonId: uuid('start_season_id'),
  latestSeasonId: uuid('latest_season_id'),
  createdAt: createdAt(),
});

const seasons = pgTable('seasons', {
  id: id(),
  name: text('name').notNull(),
  leagueId: uuid('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  isCurrent: boolean('is_current').notNull().default(false),
  isEnded: boolean('is_ended').notNull().default(false),
  gamesPerSeason: smallint('games_per_season'),
  playoffFormat: jsonb('playoff_format'),
  bracketRuleSetId: uuid('bracket_rule_set_id'),
  bestOfPlayoff: smallint('best_of_playoff'),
  bestOfShootout: smallint('best_of_shootout'),
  scoringSystem: text('scoring_system'),
  playoffsStarted: boolean('playoffs_started').notNull().default(false),
  createdAt: createdAt(),
});

const groups = pgTable('groups', {
  id: id(),
  leagueId: uuid('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  seasonId: uuid('season_id').references(() => seasons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isAuto: boolean('is_auto').notNull().default(false),
  createdAt: createdAt(),
});

const groupTeams = pgTable('group_teams', {
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (table) => ({
  pk: primaryKey({ columns: [table.groupId, table.teamId] }),
}));

const seasonGroupTeams = pgTable('season_group_teams', {
  seasonId: uuid('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (table) => ({
  pk: primaryKey({ columns: [table.seasonId, table.groupId, table.teamId] }),
}));

const seasonTeams = pgTable('season_teams', {
  seasonId: uuid('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (table) => ({
  pk: primaryKey({ columns: [table.seasonId, table.teamId] }),
}));

const teamIterations = pgTable('team_iterations', {
  id: id(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  seasonId: uuid('season_id').references(() => seasons.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  code: text('code'),
  logo: text('logo'),
  note: text('note'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  startSeasonId: uuid('start_season_id'),
  latestSeasonId: uuid('latest_season_id'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
});

const players = pgTable('players', {
  id: id(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  photo: text('photo'),
  dateOfBirth: date('date_of_birth'),
  birthCity: text('birth_city'),
  birthCountry: text('birth_country'),
  nationality: text('nationality'),
  heightCm: smallint('height_cm'),
  weightLbs: smallint('weight_lbs'),
  position: text('position'),
  shoots: text('shoots'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

const playerTeams = pgTable('player_teams', {
  id: id(),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  seasonId: uuid('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  jerseyNumber: smallint('jersey_number'),
  isProspect: boolean('is_prospect').notNull().default(false),
  position: text('position'),
  photo: text('photo'),
  acquisitionType: text('acquisition_type'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  createdAt: createdAt(),
});

const playerTeamStints = pgTable('player_team_stints', {
  id: id(),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  position: text('position'),
  acquisitionType: text('acquisition_type'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  createdAt: createdAt(),
});

const playerPhotos = pgTable('player_photos', {
  id: id(),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  seasonId: uuid('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  photo: text('photo').notNull(),
  createdAt: createdAt(),
}, (table) => ({
  playerTeamSeasonUnique: unique().on(table.playerId, table.teamId, table.seasonId),
}));

const jerseyNumberHistory = pgTable('jersey_number_history', {
  id: id(),
  playerTeamsId: uuid('player_teams_id').notNull().references(() => playerTeams.id, { onDelete: 'cascade' }),
  jerseyNumber: smallint('jersey_number').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  createdAt: createdAt(),
});

const bracketRuleSets = pgTable('bracket_rule_sets', {
  id: id(),
  leagueId: uuid('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  roundNames: jsonb('round_names'),
  createdAt: createdAt(),
});

const playoffSeries = pgTable('playoff_series', {
  id: id(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  round: smallint('round').notNull(),
  seriesLetter: text('series_letter'),
  homeTeamId: uuid('home_team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  awayTeamId: uuid('away_team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  gamesToWin: smallint('games_to_win').notNull().default(4),
  homeWins: smallint('home_wins').notNull().default(0),
  awayWins: smallint('away_wins').notNull().default(0),
  status: text('status').notNull().default('upcoming'),
  winnerTeamId: uuid('winner_team_id').references(() => teams.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

const games = pgTable('games', {
  id: id(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  homeTeamId: uuid('home_team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  awayTeamId: uuid('away_team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  scheduledTime: text('scheduled_time'),
  venue: text('venue'),
  gameType: text('game_type').notNull().default('regular'),
  status: text('status').notNull().default('scheduled'),
  overtimePeriods: smallint('overtime_periods'),
  shootout: boolean('shootout').notNull().default(false),
  shootoutFirstTeamId: uuid('shootout_first_team_id').references(() => teams.id, { onDelete: 'set null' }),
  playoffSeriesId: uuid('playoff_series_id').references(() => playoffSeries.id, { onDelete: 'set null' }),
  gameNumberInSeries: smallint('game_number_in_series'),
  gameNumber: smallint('game_number'),
  notes: text('notes'),
  currentPeriod: text('current_period'),
  periodShots: jsonb('period_shots').notNull().default(sql`'[]'::jsonb`),
  star1Id: uuid('star_1_id').references(() => players.id, { onDelete: 'set null' }),
  star2Id: uuid('star_2_id').references(() => players.id, { onDelete: 'set null' }),
  star3Id: uuid('star_3_id').references(() => players.id, { onDelete: 'set null' }),
  timeStart: timestamp('time_start', { withTimezone: true }),
  timeEnd: timestamp('time_end', { withTimezone: true }),
  createdAt: createdAt(),
});

const goals = pgTable('goals', {
  id: id(),
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  period: text('period').notNull(),
  goalType: text('goal_type').notNull().default('even-strength'),
  periodTime: text('period_time'),
  emptyNet: boolean('empty_net').notNull().default(false),
  penaltyShot: boolean('penalty_shot').notNull().default(false),
  scorerId: uuid('scorer_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  assist1Id: uuid('assist_1_id').references(() => players.id, { onDelete: 'set null' }),
  assist2Id: uuid('assist_2_id').references(() => players.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

const shootoutAttempts = pgTable('shootout_attempts', {
  id: id(),
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  shooterId: uuid('shooter_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  scored: boolean('scored').notNull().default(false),
  attemptOrder: integer('attempt_order').notNull(),
  createdAt: createdAt(),
});

const bracketSlotRules = pgTable('bracket_slot_rules', {
  id: id(),
  ruleSetId: uuid('rule_set_id').notNull().references(() => bracketRuleSets.id, { onDelete: 'cascade' }),
  slotKey: text('slot_key').notNull(),
  ruleType: text('rule_type').notNull(),
  rank: smallint('rank'),
  scope: text('scope'),
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
  pool: jsonb('pool').notNull().default(sql`'[]'::jsonb`),
  choiceRef: text('choice_ref'),
  matchupRef: text('matchup_ref'),
  createdAt: createdAt(),
}, (table) => ({
  ruleSetSlotUnique: unique().on(table.ruleSetId, table.slotKey),
}));

module.exports = {
  users,
  leagues,
  teams,
  seasons,
  groups,
  groupTeams,
  seasonGroupTeams,
  seasonTeams,
  teamIterations,
  players,
  playerTeams,
  playerTeamStints,
  playerPhotos,
  jerseyNumberHistory,
  bracketRuleSets,
  playoffSeries,
  games,
  goals,
  shootoutAttempts,
  bracketSlotRules,
};
