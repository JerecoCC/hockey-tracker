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
  position: text('position'),
  photo: text('photo'),
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
  playerPhotos,
  jerseyNumberHistory,
  bracketRuleSets,
  bracketSlotRules,
};
