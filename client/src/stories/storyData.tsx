import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import type { GameRecord, TeamInfo } from '@/hooks/useGames';

export const noop = () => {};

export const svgDataUri = (label: string, background = '#334155', color = '#ffffff') =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <rect width="160" height="160" rx="24" fill="${background}" />
      <text x="80" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="${color}">${label}</text>
    </svg>
  `)}`;

export const vicLogo = svgDataUri('MTL', '#7a1f2d');
export const minLogo = svgDataUri('MIN', '#6f4bb2');
export const bosLogo = svgDataUri('BOS', '#0f766e');
export const torLogo = svgDataUri('TOR', '#d6a600', '#1f2937');

export const teams = {
  montreal: {
    id: 'team-mtl',
    name: 'Montreal Victoire',
    place_name: 'Montreal',
    team_name: 'Victoire',
    code: 'MTL',
    logo: vicLogo,
    logo_dark: vicLogo,
    logo_light: vicLogo,
    primary_color: '#7a1f2d',
    secondary_color: '#d1d5db',
    text_color: '#ffffff',
  },
  minnesota: {
    id: 'team-min',
    name: 'Minnesota Frost',
    place_name: 'Minnesota',
    team_name: 'Frost',
    code: 'MIN',
    logo: minLogo,
    logo_dark: minLogo,
    logo_light: minLogo,
    primary_color: '#6f4bb2',
    secondary_color: '#a78bfa',
    text_color: '#ffffff',
  },
  boston: {
    id: 'team-bos',
    name: 'Boston Fleet',
    place_name: 'Boston',
    team_name: 'Fleet',
    code: 'BOS',
    logo: bosLogo,
    logo_dark: bosLogo,
    logo_light: bosLogo,
    primary_color: '#0f766e',
    secondary_color: '#99f6e4',
    text_color: '#ffffff',
  },
  toronto: {
    id: 'team-tor',
    name: 'Toronto Sceptres',
    place_name: 'Toronto',
    team_name: 'Sceptres',
    code: 'TOR',
    logo: torLogo,
    logo_dark: torLogo,
    logo_light: torLogo,
    primary_color: '#d6a600',
    secondary_color: '#fde68a',
    text_color: '#1f2937',
  },
} satisfies Record<string, TeamInfo>;

export const sampleGame: GameRecord = {
  id: 'game-1',
  season_id: 'season-1',
  game_type: 'regular',
  status: 'final',
  scheduled_at: '2026-01-18',
  scheduled_time: '19:00',
  venue: 'Example Arena',
  time_start: null,
  time_end: null,
  home_team: teams.montreal,
  away_team: teams.minnesota,
  home_score: 4,
  away_score: 2,
  overtime_periods: null,
  shootout: false,
  winner_team_id: teams.montreal.id,
  shootout_first_team_id: null,
  playoff_series_id: null,
  game_number_in_series: null,
  game_number: 32,
  playoff_round: null,
  series_home_team_id: null,
  series_away_team_id: null,
  series_home_wins: null,
  series_away_wins: null,
  series_games_to_win: null,
  notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
  period_scores: [
    { period: '1', home_goals: 1, away_goals: 0 },
    { period: '2', home_goals: 2, away_goals: 1 },
    { period: '3', home_goals: 1, away_goals: 1 },
  ],
  period_shots: [],
  star_1_id: null,
  star_2_id: null,
  star_3_id: null,
  season_name: '2025-26',
  league_id: 'pwhl',
  league_code: 'PWHL',
  league_name: 'Professional Women Hockey League',
  league_primary_color: '#6f4bb2',
  league_text_color: '#ffffff',
  watched_by_user: true,
  watched_on: '2026-01-18',
  skipped_by_user: false,
  scheduled_for: '2026-01-18',
  best_of_shootout: 3,
  playoff_round_names: null,
};

export const samplePlayers = [
  {
    id: 'player-1',
    name: 'Taylor Heise',
    team: teams.minnesota,
    position: 'Forward',
    jersey: 27,
  },
  {
    id: 'player-2',
    name: 'Marie-Philip Poulin',
    team: teams.montreal,
    position: 'Center',
    jersey: 29,
  },
  {
    id: 'player-3',
    name: 'Aerin Frankel',
    team: teams.boston,
    position: 'Goalie',
    jersey: 31,
  },
];

export const StoryPage = ({ children }: { children: ReactNode }) => (
  <div className="storybook-page">{children}</div>
);

export const StorySection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="storybook-section">
    <h2>{title}</h2>
    {children}
  </section>
);

export const StoryGrid = ({ children }: { children: ReactNode }) => (
  <div className="storybook-grid">{children}</div>
);

export const StoryPanel = ({ children }: { children: ReactNode }) => (
  <div className="storybook-panel">{children}</div>
);

export const Stateful = <T,>({
  initial,
  children,
}: {
  initial: T;
  children: (value: T, setValue: (value: T) => void) => ReactNode;
}) => {
  const [value, setValue] = useState(initial);
  return <>{children(value, setValue)}</>;
};

export const FormFieldDemo = () => {
  const form = useForm({
    defaultValues: {
      name: 'Montreal Victoire',
      description: 'A compact reusable form field gallery.',
      team: 'mtl',
      date: '2026-01-18',
      time: '19:00',
      color: '#7a1f2d',
      logo: null as File | string | null,
    },
  });

  return (
    <StoryGrid>
      <Field
        control={form.control}
        name="name"
        label="Name"
        required
      />
      <Field
        control={form.control}
        name="team"
        type="select"
        label="Team"
        options={[
          { value: 'mtl', label: 'Montreal Victoire', logo: vicLogo, code: 'MTL' },
          { value: 'min', label: 'Minnesota Frost', logo: minLogo, code: 'MIN' },
          { value: 'bos', label: 'Boston Fleet', logo: bosLogo, code: 'BOS' },
        ]}
        searchable
      />
      <Field
        control={form.control}
        name="date"
        type="datepicker"
        label="Date"
      />
      <Field
        control={form.control}
        name="time"
        type="timepicker"
        label="Time"
      />
      <Field
        control={form.control}
        name="color"
        type="color"
        label="Primary Color"
      />
      <Field
        control={form.control}
        name="description"
        type="textarea"
        label="Description"
        rows={4}
      />
    </StoryGrid>
  );
};
