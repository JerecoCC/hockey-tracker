import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import calendarItemStyles from '@/components/CalendarGameListItem/CalendarGameListItem.module.scss';
import gameCardStyles from '@/components/GameCard/GameCard.module.scss';
import scheduleLayoutStyles from '@/components/ScheduleGamesLayout/ScheduleGamesLayout.module.scss';
import UserGames from './UserGames';
import styles from './UserGames.module.scss';

const mockNavigate = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockSetQueriesData = jest.fn();

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: any) => (
    <a
      href={to}
      {...props}
    >
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
}));
jest.mock('axios');
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(), useQueryClient: jest.fn() }));
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock(
  '@/components/Modal/Modal',
  () =>
    ({
      open,
      title,
      children,
      onClose,
      onConfirm,
      confirmLabel,
      confirmDisabled,
      footerStart,
    }: any) =>
      open ? (
        <div>
          <div>{title}</div>
          {children}
          {footerStart}
          {onConfirm && (
            <button
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmLabel ?? 'Save'}
            </button>
          )}
          <button onClick={onClose}>Cancel</button>
        </div>
      ) : null,
);
jest.mock('@/components/Section/Section', () => {
  const React = require('react');
  return React.forwardRef(({ title, action, children, className }: any, ref: any) => (
    <section
      ref={ref}
      className={className}
    >
      {title && <div>{title}</div>}
      {action}
      {children}
    </section>
  ));
});
jest.mock(
  '@/components/DatePicker/DatePicker',
  () => (props: any) =>
    props.triggerLabel ? (
      <button
        type="button"
        aria-label={props.triggerAriaLabel ?? props.triggerLabel ?? 'date-picker'}
      >
        {props.triggerLabel ?? props.value}
      </button>
    ) : (
      <input
        aria-label={props.placeholder ?? 'date-picker'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    ),
);
jest.mock('@/components/Icon/Icon', () => ({ name }: any) => <span>{name}</span>);
jest.mock(
  '@/components/Button/Button',
  () =>
    ({ children, tooltip, icon, onClick, disabled, 'aria-label': ariaLabel }: any) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel ?? tooltip ?? icon}
      >
        {children ?? tooltip ?? icon}
      </button>
    ),
);
jest.mock('@/components/TeamLogo/TeamLogo', () => ({ code }: any) => <span>{code || 'LOGO'}</span>);
jest.mock('@/pages/admin/games/game-details/ScoreImageModal', () => ({
  __esModule: true,
  default: ({ open, game, liveAwayScore, liveHomeScore, overtimeSuffix, showForm, onClose }: any) =>
    open ? (
      <div>
        <div>Generate Score Card</div>
        {showForm && <div>Score image form</div>}
        {game && <div>{`${game.away_team.code} @ ${game.home_team.code}`}</div>}
        {game && <div>{`Score ${liveAwayScore}-${liveHomeScore}`}</div>}
        {game && <div>{`Suffix ${overtimeSuffix ?? ''}`}</div>}
        <button onClick={onClose}>Close score card</button>
      </div>
    ) : null,
}));
jest.mock('@/components/Select/Select', () => ({
  __esModule: true,
  default: ({ value, options, onChange, disabled }: any) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {options.map((option: any) => (
        <option
          key={option.value}
          value={option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
jest.mock('@/components/MultiSelect/MultiSelect', () => ({
  __esModule: true,
  default: ({ value, options, onChange, onExit, placeholder }: any) => (
    <div
      role="combobox"
      aria-label={placeholder ?? 'multi-select'}
    >
      {options.map((option: any) => (
        <button
          key={option.value}
          type="button"
          aria-label={`Toggle ${option.label}`}
          onClick={() =>
            onChange(
              value.includes(option.value)
                ? value.filter((entry: string) => entry !== option.value)
                : [...value, option.value],
            )
          }
        >
          Toggle {option.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onExit}
      >
        Exit {placeholder ?? 'multi-select'}
      </button>
    </div>
  ),
}));

const mockUseQuery = useQuery as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockAxios = axios as jest.Mocked<typeof axios>;

const currentDate = new Date(2026, 4, 15, 12, 0, 0);
const dateOffset = (days: number) => new Date(currentDate.getTime() + days * 86_400_000);
const localDateString = (days: number) => {
  const d = dateOffset(days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const currentMonthIso = (days: number, time = 19) => {
  const d = dateOffset(days);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), time, 0, 0)).toISOString();
};
const formatWeekRange = (start: Date, end: Date) => {
  const shortFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const shortFmtYear = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (start.getFullYear() === end.getFullYear()) {
    return `${shortFmt.format(start)} – ${shortFmtYear.format(end)}`;
  }
  return `${shortFmtYear.format(start)} – ${shortFmtYear.format(end)}`;
};
const formatHeading = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};
const formatNumericDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
};
const localDateKeyForIso = (iso: string, scheduledTime: string | null) => {
  if (!scheduledTime) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })
    .formatToParts(new Date(iso))
    .find((part) => part.type === 'timeZoneName')?.value;
  const etDatePart = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
    new Date(iso),
  );
  const zoneOffset = offset === 'EDT' ? '-04:00' : '-05:00';
  const instant = new Date(`${etDatePart}T${scheduledTime}:00${zoneOffset}`);
  return `${instant.getFullYear()}-${String(instant.getMonth() + 1).padStart(2, '0')}-${String(instant.getDate()).padStart(2, '0')}`;
};
const localDateKeyForEtDateTime = (dateKey: string, scheduledTime: string | null) => {
  if (!scheduledTime) return dateKey;
  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })
    .formatToParts(new Date(`${dateKey}T17:00:00Z`))
    .find((part) => part.type === 'timeZoneName')?.value;
  const zoneOffset = offset === 'EDT' ? '-04:00' : '-05:00';
  const instant = new Date(`${dateKey}T${scheduledTime}:00${zoneOffset}`);
  return `${instant.getFullYear()}-${String(instant.getMonth() + 1).padStart(2, '0')}-${String(instant.getDate()).padStart(2, '0')}`;
};
const localDateKeyForGame = (game: { scheduled_at: string | null; scheduled_time: string | null }) => {
  if (!game.scheduled_at) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(game.scheduled_at)) {
    return localDateKeyForEtDateTime(game.scheduled_at, game.scheduled_time);
  }
  const rawDateKey = game.scheduled_at.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const isMidnightPlaceholder =
    !!game.scheduled_time &&
    game.scheduled_time !== '00:00' &&
    !!rawDateKey &&
    /T00:00(?::00(?:\.0+)?)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(game.scheduled_at);
  if (isMidnightPlaceholder) {
    return localDateKeyForEtDateTime(rawDateKey, game.scheduled_time);
  }
  return localDateKeyForIso(game.scheduled_at, null);
};
const scheduledWatchDate = localDateString(0);
const watchedDate = localDateString(1);
const games = [
  {
    id: 'game-1',
    season_id: 'season-1',
    game_type: 'playoff',
    status: 'final',
    scheduled_at: currentMonthIso(1),
    scheduled_time: '19:00',
    venue: null,
    time_start: null,
    time_end: null,
    home_team: {
      id: 'team-home',
      name: 'Home Team',
      code: 'HOM',
      logo: null,
      primary_color: '#111',
      secondary_color: '#222',
      text_color: '#fff',
    },
    away_team: {
      id: 'team-away',
      name: 'Away Team',
      code: 'AWY',
      logo: null,
      primary_color: '#333',
      secondary_color: '#444',
      text_color: '#fff',
    },
    home_score: 11,
    away_score: 7,
    overtime_periods: null,
    shootout: false,
    shootout_first_team_id: null,
    playoff_series_id: 'series-1',
    game_number_in_series: 3,
    game_number: 1,
    playoff_round: 2,
    series_home_team_id: 'team-home',
    series_away_team_id: 'team-away',
    series_home_wins: 2,
    series_away_wins: 3,
    series_home_wins_at_game: 2,
    series_away_wins_at_game: 1,
    series_games_to_win: 4,
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    current_period: null,
    period_scores: [{ period: '1', away_goals: 7, home_goals: 11 }],
    period_shots: [],
    star_1_id: null,
    star_2_id: null,
    star_3_id: null,
    best_of_shootout: 3,
    playoff_round_names: { 2: 'Round 2' },
    season_name: '2024-25',
    league_id: 'league-1',
    league_name: 'NHL',
    league_primary_color: '#0a4fa3',
    league_text_color: '#ffffff',
    watched_by_user: false,
    skipped_by_user: false,
    watched_on: null,
    scheduled_for: scheduledWatchDate,
  },
  {
    id: 'game-2',
    season_id: 'season-1',
    game_type: 'regular',
    status: 'final',
    scheduled_at: currentMonthIso(0, 22),
    scheduled_time: '22:00',
    venue: null,
    time_start: null,
    time_end: null,
    home_team: {
      id: 'team-home',
      name: 'Home Team',
      code: 'HOM',
      logo: null,
      primary_color: '#111',
      secondary_color: '#222',
      text_color: '#fff',
    },
    away_team: {
      id: 'team-opp',
      name: 'Opponent',
      code: 'OPP',
      logo: null,
      primary_color: '#555',
      secondary_color: '#666',
      text_color: '#fff',
    },
    home_score: 2,
    away_score: 1,
    overtime_periods: null,
    shootout: false,
    shootout_first_team_id: null,
    playoff_series_id: null,
    game_number_in_series: null,
    game_number: 2,
    playoff_round: null,
    series_home_team_id: null,
    series_away_team_id: null,
    series_home_wins: null,
    series_away_wins: null,
    series_home_wins_at_game: null,
    series_away_wins_at_game: null,
    series_games_to_win: null,
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    current_period: null,
    period_scores: [{ period: '1', away_goals: 1, home_goals: 1 }],
    period_shots: [],
    star_1_id: null,
    star_2_id: null,
    star_3_id: null,
    best_of_shootout: 3,
    playoff_round_names: null,
    season_name: '2024-25',
    league_id: 'league-1',
    league_name: 'NHL',
    league_primary_color: '#0a4fa3',
    league_text_color: '#ffffff',
    watched_by_user: true,
    skipped_by_user: false,
    watched_on: watchedDate,
    scheduled_for: null,
  },
];

const skippedGame = {
  ...games[0],
  id: 'game-skipped',
  away_team: {
    ...games[0].away_team,
    id: 'team-skipped',
    name: 'Skipped Away',
    code: 'SKP',
  },
  watched_by_user: false,
  skipped_by_user: true,
  watched_on: null,
  scheduled_for: scheduledWatchDate,
};

const allTeams = [
  { id: 'team-home', name: 'Home Team', code: 'HOM', logo: null, league_id: 'league-1' },
  { id: 'team-away', name: 'Away Team', code: 'AWY', logo: null, league_id: 'league-1' },
  { id: 'team-opp', name: 'Opponent', code: 'OPP', logo: null, league_id: 'league-1' },
  { id: 'team-idle', name: 'Idle Team', code: 'IDL', logo: null, league_id: 'league-1' },
];

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.sessionStorage.setItem('user-games-week-start', localDateString(0));
  window.sessionStorage.setItem(
    'user-games-calendar-month',
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
  );
  mockUseQueryClient.mockReturnValue({
    invalidateQueries: mockInvalidateQueries,
    setQueriesData: mockSetQueriesData,
  });
  mockAxios.post.mockResolvedValue({ data: {} } as any);
  mockAxios.delete.mockResolvedValue({ data: {} } as any);
  mockAxios.put.mockResolvedValue({ data: {} } as any);
  mockUseQuery.mockImplementation(({ queryKey }: any) => {
    if (queryKey[0] === 'user-leagues')
      return { data: [{ id: 'league-1', name: 'NHL', code: 'NHL', logo: null }] };
    if (queryKey[0] === 'user-favorites') return { data: ['team-home', 'team-opp'] };
    if (queryKey[0] === 'user-teams') return { data: allTeams, isLoading: false };
    if (queryKey[0] === 'user-games')
      return { data: queryKey[4] ? [...games, skippedGame] : games, isLoading: false };
    return { data: [], isLoading: false };
  });
});

describe('UserGames schedule views', () => {
  it('shows schedule skeletons for calendar and Week views', async () => {
    const user = userEvent.setup();
    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'user-leagues')
        return { data: [{ id: 'league-1', name: 'NHL', code: 'NHL', logo: null }] };
      if (queryKey[0] === 'user-favorites') return { data: ['team-home', 'team-opp'] };
      if (queryKey[0] === 'user-teams') return { data: allTeams, isLoading: false };
      if (queryKey[0] === 'user-games') return { data: [], isLoading: true };
      return { data: [], isLoading: false };
    });

    render(<UserGames />);

    expect(
      screen
        .getAllByLabelText(/^Loading games for /)
        .filter((element) => element.tagName.toLowerCase() === 'div'),
    ).toHaveLength(7);
    expect(document.querySelectorAll(`.${scheduleLayoutStyles.weekGameSkeleton}`)).toHaveLength(21);

    await user.click(screen.getByRole('button', { name: 'Month view' }));

    expect(document.querySelector(`.${scheduleLayoutStyles.calendarCard}`)).toBeInTheDocument();
    expect(
      screen.getAllByLabelText(/^Loading (calendar slot|games for)/).length,
    ).toBeGreaterThan(0);
  });
  it('shows team filtering with favorite teams first and uses dashboard cards in Week view', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    const teamFilter = screen.getByRole('combobox', { name: 'Teams' });
    expect(teamFilter).toBeInTheDocument();
    expect(within(teamFilter).getByRole('button', { name: 'Toggle Home Team' })).toBeInTheDocument();
    expect(within(teamFilter).getByRole('button', { name: 'Toggle Opponent' })).toBeInTheDocument();
    expect(within(teamFilter).getByRole('button', { name: 'Toggle Away Team' })).toBeInTheDocument();
    expect(within(teamFilter).getByRole('button', { name: 'Toggle Idle Team' })).toBeInTheDocument();
    expect(
      within(teamFilter)
        .getAllByRole('button', { name: /^Toggle/ })
        .map((button) => button.textContent),
    ).toEqual(['Toggle Home Team', 'Toggle Opponent', 'Toggle Away Team', 'Toggle Idle Team']);

    const firstGameCard = screen.getAllByText('AWY')[0].closest(`.${gameCardStyles.card}`);
    expect(firstGameCard).not.toBeNull();
    expect(within(firstGameCard as HTMLElement).getByText('FINAL')).toBeInTheDocument();
    expect(within(firstGameCard as HTMLElement).queryByText('11')).not.toBeInTheDocument();
    expect(within(firstGameCard as HTMLElement).queryByText('7')).not.toBeInTheDocument();
    expect(
      within(firstGameCard as HTMLElement).queryByText(
        `Watching ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(dateOffset(0))}`,
      ),
    ).not.toBeInTheDocument();
    expect(
      within(firstGameCard as HTMLElement).getByText((content) =>
        content.includes(formatNumericDate(localDateKeyForGame(games[0]) ?? scheduledWatchDate)),
      ),
    ).toBeInTheDocument();
    expect(within(firstGameCard as HTMLElement).getByText('R2 - G3')).toBeInTheDocument();
    expect(
      within(firstGameCard as HTMLElement).queryByRole('button', { name: 'View game details' }),
    ).not.toBeInTheDocument();
    expect(
      within(firstGameCard as HTMLElement).getByRole('button', { name: 'Mark as watched' }),
    ).toBeInTheDocument();

    const scheduledDayCard = screen.getByText(formatHeading(scheduledWatchDate)).parentElement;
    expect(within(scheduledDayCard as HTMLElement).getAllByText('AWY').length).toBeGreaterThan(0);
    expect(
      within(
        screen.getByText(
          formatHeading(localDateKeyForGame(games[0]) ?? scheduledWatchDate),
        ).parentElement as HTMLElement,
      ).queryByText('AWY'),
    ).not.toBeInTheDocument();

    const watchedGameCard = screen.getAllByText('OPP')[0].closest(`.${gameCardStyles.card}`);
    expect(watchedGameCard).not.toBeNull();
    expect(within(watchedGameCard as HTMLElement).getByText('2')).toBeInTheDocument();
    expect(within(watchedGameCard as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(
      within(watchedGameCard as HTMLElement).queryByText(
        `Watched ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(dateOffset(1))}`,
      ),
    ).not.toBeInTheDocument();
    expect(
      within(watchedGameCard as HTMLElement).getByRole('button', { name: 'View game details' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Mark as watched' }).length,
    ).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole('button', { name: 'Month view' }));
    const calendarGameItem = screen.getAllByText('AWY')[0].closest(`.${calendarItemStyles.item}`);
    expect(calendarGameItem).toHaveClass(styles.calendarGameLeagueTint);
    expect(calendarGameItem).toHaveStyle('--game-league-primary: #0a4fa3');
  });
  it('shows skipped games when the filter switch is enabled', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'Month view' }));

    expect(screen.queryByText('SKP')).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Show skipped games' }));

    expect(screen.getByRole('switch', { name: 'Hide skipped games' })).toBeInTheDocument();
    const skippedCard = screen.getAllByText('SKP')[0].closest(`.${calendarItemStyles.item}`);
    expect(skippedCard).toHaveClass(styles.calendarGameSkipped);
    expect(
      within(skippedCard as HTMLElement).getByRole('button', { name: 'View game details' }),
    ).toBeInTheDocument();
    expect(
      within(skippedCard as HTMLElement).getByRole('button', { name: 'Undo skip' }),
    ).toBeInTheDocument();
    expect(
      within(skippedCard as HTMLElement).queryByRole('button', { name: 'Schedule watch' }),
    ).not.toBeInTheDocument();
    expect(
      within(skippedCard as HTMLElement).queryByRole('button', { name: 'Edit watch schedule' }),
    ).not.toBeInTheDocument();
    expect(
      within(skippedCard as HTMLElement).queryByRole('button', { name: 'Mark as watched' }),
    ).not.toBeInTheDocument();
    expect(
      within(skippedCard as HTMLElement).queryByRole('button', { name: 'Skip game' }),
    ).not.toBeInTheDocument();
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          'user-games',
          'all',
          'all',
          'team-home,team-opp',
          true,
          '',
          `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
        ],
      }),
    );
  });
  it('shows a scheduled watch game original date in the user timezone', async () => {
    const user = userEvent.setup();
    const originalEtDate = localDateString(1);
    const timezoneShiftedGame = {
      ...games[0],
      id: 'game-scheduled-local-original',
      scheduled_at: `${originalEtDate}T04:00:00.000Z`,
      scheduled_time: '23:30',
      scheduled_for: scheduledWatchDate,
    };

    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'user-leagues')
        return { data: [{ id: 'league-1', name: 'NHL', code: 'NHL', logo: null }] };
      if (queryKey[0] === 'user-favorites') return { data: ['team-home', 'team-opp'] };
      if (queryKey[0] === 'user-games') return { data: [timezoneShiftedGame], isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<UserGames />);

    expect(
      screen.getByText((content) =>
        content.includes(formatNumericDate(localDateKeyForEtDateTime(originalEtDate, '23:30'))),
      ),
    ).toBeInTheDocument();
  });

  it('shows playoff round metadata on calendar cards but hides series dots until watched', async () => {
    const user = userEvent.setup();
    render(<UserGames />);
    await user.click(screen.getByRole('button', { name: 'Month view' }));

    expect(screen.getByText('R2 - G3')).toHaveClass(calendarItemStyles.bottomLabel);
    expect(screen.queryByLabelText('Series record 1 of 4')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Series record 2 of 4')).not.toBeInTheDocument();
  });

  it('shows watched calendar scores differently for winners and losers', async () => {
    const user = userEvent.setup();
    render(<UserGames />);
    await user.click(screen.getByRole('button', { name: 'Month view' }));

    const watchedCard = screen
      .getByRole('button', { name: 'Download score card' })
      .closest(`.${calendarItemStyles.item}`);

    expect(watchedCard).not.toBeNull();

    const winnerScore = within(watchedCard as HTMLElement)
      .getByText('2')
      .closest(`.${calendarItemStyles.score}`);
    const loserScore = within(watchedCard as HTMLElement)
      .getByText('1')
      .closest(`.${calendarItemStyles.score}`);
    const loserLogoSlot = within(watchedCard as HTMLElement)
      .getByText('OPP')
      .closest(`.${calendarItemStyles.logoSlot}`);

    expect(watchedCard).toHaveClass(calendarItemStyles.itemPlainScores);
    expect(winnerScore).toHaveClass(calendarItemStyles.scoreWin);
    expect(loserScore).toHaveClass(calendarItemStyles.scoreLose);
    expect(loserLogoSlot).toHaveClass(calendarItemStyles.logoSlotDimmed);
  });

  it('shows muted plain dash scores for watched games without recorded scores', async () => {
    const user = userEvent.setup();
    const watchedMissingScoreGame = {
      ...games[0],
      id: 'game-watched-missing-score',
      status: 'scheduled',
      away_team: { ...games[0].away_team, name: 'Missing Score Away', code: 'MSA' },
      home_score: 0,
      away_score: 0,
      watched_by_user: true,
      watched_on: scheduledWatchDate,
      scheduled_for: scheduledWatchDate,
    };

    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'user-leagues')
        return { data: [{ id: 'league-1', name: 'NHL', code: 'NHL', logo: null }] };
      if (queryKey[0] === 'user-favorites') return { data: ['team-home', 'team-opp'] };
      if (queryKey[0] === 'user-games') return { data: [watchedMissingScoreGame], isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<UserGames />);
    await user.click(screen.getByRole('button', { name: 'Month view' }));

    const watchedCard = screen.getByText('MSA').closest(`.${calendarItemStyles.item}`);
    const missingScores = within(watchedCard as HTMLElement)
      .getAllByText('-')
      .map((score) => score.closest(`.${calendarItemStyles.score}`));

    expect(watchedCard).toHaveClass(calendarItemStyles.itemPlainScores);
    expect(missingScores).toHaveLength(2);
    for (const score of missingScores) {
      expect(score).toHaveClass(calendarItemStyles.scoreMissing);
    }
  });

  it('orders calendar day games by watched scheduled, watched, scheduled watch, unwatched, then skipped', async () => {
    const user = userEvent.setup();
    const watchedSameDayGame = {
      ...games[1],
      id: 'game-same-day-watched',
      away_team: { ...games[1].away_team, name: 'Same Day Watched', code: 'SDW' },
      scheduled_for: watchedDate,
      watched_by_user: true,
      watched_on: watchedDate,
      scheduled_time: '22:00',
    };
    const watchedUnscheduledSameDayGame = {
      ...games[1],
      id: 'game-same-day-watched-unscheduled',
      away_team: { ...games[1].away_team, name: 'Same Day Plain Watched', code: 'SDP' },
      scheduled_for: null,
      watched_by_user: true,
      skipped_by_user: false,
      watched_on: watchedDate,
      scheduled_at: watchedDate,
      scheduled_time: null,
    };
    const scheduledSameDayGame = {
      ...games[0],
      id: 'game-same-day-scheduled',
      away_team: { ...games[0].away_team, name: 'Same Day Scheduled', code: 'SDS' },
      scheduled_for: watchedDate,
      watched_by_user: false,
      skipped_by_user: false,
      watched_on: null,
      scheduled_time: '18:00',
    };
    const unwatchedSameDayGame = {
      ...games[0],
      id: 'game-same-day-unwatched',
      away_team: { ...games[0].away_team, name: 'Same Day Away', code: 'SDA' },
      scheduled_for: null,
      watched_by_user: false,
      skipped_by_user: false,
      watched_on: null,
      scheduled_at: watchedDate,
      scheduled_time: null,
    };
    const skippedSameDayGame = {
      ...games[0],
      id: 'game-same-day-skipped',
      away_team: { ...games[0].away_team, name: 'Same Day Skipped', code: 'SDK' },
      scheduled_for: watchedDate,
      watched_by_user: false,
      skipped_by_user: true,
      watched_on: null,
      scheduled_time: '16:00',
    };

    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'user-leagues')
        return { data: [{ id: 'league-1', name: 'NHL', code: 'NHL', logo: null }] };
      if (queryKey[0] === 'user-favorites') return { data: ['team-home', 'team-opp'] };
      if (queryKey[0] === 'user-games')
        return {
          data: [
            skippedSameDayGame,
            unwatchedSameDayGame,
            scheduledSameDayGame,
            watchedUnscheduledSameDayGame,
            watchedSameDayGame,
          ],
          isLoading: false,
        };
      return { data: [], isLoading: false };
    });

    render(<UserGames />);
    await user.click(screen.getByRole('switch', { name: 'Show skipped games' }));
    await user.click(screen.getByRole('button', { name: 'Month view' }));

    const orderedItems = ['SDW', 'SDP', 'SDS', 'SDA', 'SDK'].map(
      (code) => screen.getByText(code).closest(`.${calendarItemStyles.item}`) as HTMLElement,
    );
    for (let index = 0; index < orderedItems.length - 1; index += 1) {
      expect(orderedItems[index].compareDocumentPosition(orderedItems[index + 1])).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });

  it('opens the score image form from the games toolbar', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: /Generate Score Image/ }));

    expect(screen.getByText('Generate Score Card')).toBeInTheDocument();
    expect(screen.getByText('Score image form')).toBeInTheDocument();
  });

  it('opens the score card modal from a watched game hover action', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'Download score card' }));

    expect(screen.getByText('Generate Score Card')).toBeInTheDocument();
    expect(screen.getByText('OPP @ HOM')).toBeInTheDocument();
    expect(screen.getByText('Score 1-2')).toBeInTheDocument();
    expect(screen.getByText((content) => content.startsWith('Suffix'))).toBeInTheDocument();
  });

  it('shows playoff series dots once a playoff game has been watched', async () => {
    const user = userEvent.setup();
    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'user-leagues')
        return { data: [{ id: 'league-1', name: 'NHL', code: 'NHL', logo: null }] };
      if (queryKey[0] === 'user-favorites') return { data: ['team-home', 'team-opp'] };
      if (queryKey[0] === 'user-games')
        return {
          data: [
            {
              ...games[0],
              watched_by_user: true,
              watched_on: watchedDate,
            },
            games[1],
          ],
          isLoading: false,
        };
      return { data: [], isLoading: false };
    });

    render(<UserGames />);
    await user.click(screen.getByRole('button', { name: 'Month view' }));

    expect(screen.getByLabelText('Series record 1 of 4')).toBeInTheDocument();
    expect(screen.getByLabelText('Series record 2 of 4')).toBeInTheDocument();
    expect(screen.queryByLabelText('Series record 3 of 4')).not.toBeInTheDocument();
  });

  it('uses the game-specific series score for a watched game 1 instead of the final series total', async () => {
    const user = userEvent.setup();
    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'user-leagues')
        return { data: [{ id: 'league-1', name: 'NHL', code: 'NHL', logo: null }] };
      if (queryKey[0] === 'user-favorites') return { data: ['team-home', 'team-opp'] };
      if (queryKey[0] === 'user-games')
        return {
          data: [
            {
              ...games[0],
              game_number_in_series: 1,
              series_home_wins: 4,
              series_away_wins: 1,
              series_home_wins_at_game: 1,
              series_away_wins_at_game: 0,
              watched_by_user: true,
              watched_on: watchedDate,
              scheduled_for: null,
            },
            games[1],
          ],
          isLoading: false,
        };
      return { data: [], isLoading: false };
    });

    render(<UserGames />);
    await user.click(screen.getByRole('button', { name: 'Month view' }));

    expect(screen.getByLabelText('Series record 1 of 4')).toBeInTheDocument();
    expect(screen.getByLabelText('Series record 0 of 4')).toBeInTheDocument();
    expect(screen.queryByLabelText('Series record 4 of 4')).not.toBeInTheDocument();
  });

  it('keeps local date placement correct for games with a date-only scheduled_at', async () => {
    const user = userEvent.setup();
    const dateOnlyKey = localDateString(1);
    const dateOnlyGame = {
      ...games[0],
      id: 'game-date-only',
      away_team: { ...games[0].away_team, name: 'Date Only Team', code: 'DOT' },
      scheduled_for: null,
      scheduled_at: dateOnlyKey,
      scheduled_time: '19:00',
    };

    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'user-leagues')
        return { data: [{ id: 'league-1', name: 'NHL', code: 'NHL', logo: null }] };
      if (queryKey[0] === 'user-favorites') return { data: ['team-home', 'team-away'] };
      if (queryKey[0] === 'user-games') return { data: [dateOnlyGame], isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<UserGames />);

    const expectedDateKey = localDateKeyForGame(dateOnlyGame) ?? dateOnlyKey;
    const daySection = screen.getByText(formatHeading(expectedDateKey)).parentElement;
    expect(daySection).not.toBeNull();
    expect(within(daySection as HTMLElement).getAllByText('DOT').length).toBeGreaterThan(0);
  });

  it('keeps local date placement correct for midnight-UTC scheduled_at placeholders', async () => {
    const user = userEvent.setup();
    const intendedEtDate = localDateString(1);
    const midnightPlaceholderGame = {
      ...games[0],
      id: 'game-midnight-placeholder',
      away_team: { ...games[0].away_team, name: 'Midnight Placeholder', code: 'MDN' },
      scheduled_for: null,
      scheduled_at: `${intendedEtDate}T00:00:00.000Z`,
      scheduled_time: '19:00',
    };

    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'user-leagues')
        return { data: [{ id: 'league-1', name: 'NHL', code: 'NHL', logo: null }] };
      if (queryKey[0] === 'user-favorites') return { data: ['team-home', 'team-away'] };
      if (queryKey[0] === 'user-games')
        return { data: [midnightPlaceholderGame], isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<UserGames />);

    const expectedDateKey = localDateKeyForGame(midnightPlaceholderGame) ?? intendedEtDate;
    const intendedDaySection = screen.getByText(formatHeading(expectedDateKey)).parentElement;
    expect(intendedDaySection).not.toBeNull();
    expect(within(intendedDaySection as HTMLElement).getAllByText('MDN').length).toBeGreaterThan(0);

    for (const key of [localDateString(0), localDateString(1)]) {
      if (key === expectedDateKey) continue;
      const daySection = screen.getByText(formatHeading(key)).parentElement;
      expect(within(daySection as HTMLElement).queryByText('MDN')).not.toBeInTheDocument();
    }
  });

  it('refetches user games when the selected teams change', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'Toggle Home Team' }));

    const userGamesQueriesBeforeExit = mockUseQuery.mock.calls
      .map(([options]) => options)
      .filter((options) => options.queryKey?.[0] === 'user-games');
    const draftTeamQuery = userGamesQueriesBeforeExit[userGamesQueriesBeforeExit.length - 1];

    expect(draftTeamQuery.queryKey[3]).toBe('team-home,team-opp');

    await user.click(screen.getByRole('button', { name: 'Exit Teams' }));

    const userGamesQueries = mockUseQuery.mock.calls
      .map(([options]) => options)
      .filter((options) => options.queryKey?.[0] === 'user-games');
    const selectedTeamQuery = userGamesQueries[userGamesQueries.length - 1];

    expect(selectedTeamQuery).toEqual(
      expect.objectContaining({
        queryKey: [
          'user-games',
          'all',
          'all',
          'team-opp',
          false,
          localDateString(0),
          '',
        ],
      }),
    );

    mockAxios.get.mockResolvedValueOnce({ data: [] });
    await selectedTeamQuery.queryFn();

    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/user/games'),
      expect.objectContaining({
        params: expect.objectContaining({ team_ids: 'team-opp' }),
      }),
    );
  });

  it('lets watched non-favorite teams be selected from the team filter', async () => {
    const user = userEvent.setup();
    const watchedNonFavoriteGame = {
      ...games[1],
      id: 'game-watched-nonfavorite',
      home_team: {
        ...games[1].home_team,
        id: 'team-extra-home',
        name: 'Extra Home',
        code: 'EXH',
      },
      away_team: {
        ...games[1].away_team,
        id: 'team-extra-away',
        name: 'Extra Away',
        code: 'EXA',
      },
      watched_by_user: true,
      watched_on: watchedDate,
    };

    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'user-leagues')
        return { data: [{ id: 'league-1', name: 'NHL', code: 'NHL', logo: null }] };
      if (queryKey[0] === 'user-favorites') return { data: ['team-home'] };
      if (queryKey[0] === 'user-teams')
        return {
          data: [
            ...allTeams,
            {
              id: 'team-extra-home',
              name: 'Extra Home',
              code: 'EXH',
              logo: null,
              league_id: 'league-1',
            },
            {
              id: 'team-extra-away',
              name: 'Extra Away',
              code: 'EXA',
              logo: null,
              league_id: 'league-1',
            },
          ],
          isLoading: false,
        };
      if (queryKey[0] === 'user-games')
        return {
          data: String(queryKey[3]).includes('team-extra-home')
            ? [watchedNonFavoriteGame]
            : [games[0]],
          isLoading: false,
        };
      return { data: [], isLoading: false };
    });

    render(<UserGames />);

    expect(screen.queryByText('EXH')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Toggle Extra Home' }));
    await user.click(screen.getByRole('button', { name: 'Exit Teams' }));
    expect(screen.getAllByText('EXH').length).toBeGreaterThan(0);
  });

  it('allows dragging a calendar game to another date to schedule it', async () => {
    const user = userEvent.setup();
    render(<UserGames />);
    await user.click(screen.getByRole('button', { name: 'Month view' }));

    const originalDate = localDateKeyForGame(games[0]) ?? scheduledWatchDate;
    const targetDate = localDateString(3);
    const sourceCard = screen.getByText('AWY').closest('[draggable="true"]');
    const targetCell = document.querySelector(`[data-date-key="${targetDate}"]`);
    const dataTransfer = {
      store: {} as Record<string, string>,
      effectAllowed: 'all',
      dropEffect: 'move',
      setData(type: string, value: string) {
        this.store[type] = value;
      },
      getData(type: string) {
        return this.store[type] ?? '';
      },
    };

    expect(sourceCard).not.toBeNull();
    expect(targetCell).not.toBeNull();
    expect(sourceCard).toHaveClass(calendarItemStyles.itemDraggable);

    fireEvent.dragStart(sourceCard as HTMLElement, { dataTransfer });
    fireEvent.dragOver(targetCell as Element, { dataTransfer });
    expect(targetCell).not.toHaveClass(styles.calendarDayDropTarget);
    expect(targetCell?.querySelector(`.${styles.calendarDayDropTarget}`)).not.toBeNull();
    fireEvent.drop(targetCell as Element, { dataTransfer });
    expect(targetCell?.querySelector(`.${styles.calendarDayDropTarget}`)).toBeNull();
    fireEvent.dragEnd(sourceCard as HTMLElement, { dataTransfer });

    await waitFor(() =>
      expect(mockAxios.put).toHaveBeenCalledWith(
        expect.stringContaining('/user/watched-games/game-1/schedule'),
        { scheduled_for: targetDate },
        expect.objectContaining({ headers: expect.any(Object) }),
      ),
    );

    expect(mockSetQueriesData).toHaveBeenCalledWith(
      { queryKey: ['user-games'] },
      expect.any(Function),
    );

    const updater = mockSetQueriesData.mock.calls.at(-1)?.[1];
    expect(updater(games)[0]).toEqual(
      expect.objectContaining({
        id: 'game-1',
        scheduled_for: targetDate,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('AWY @ HOM scheduled for May 18, 2026');
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('clears the schedule when dragging a game back to its original date', async () => {
    const user = userEvent.setup();
    render(<UserGames />);
    await user.click(screen.getByRole('button', { name: 'Month view' }));

    const originalDate = localDateKeyForGame(games[0]) ?? scheduledWatchDate;
    const sourceCard = screen.getByText('AWY').closest('[draggable="true"]');
    const targetCell = document.querySelector(`[data-date-key="${originalDate}"]`);
    const dataTransfer = {
      store: {} as Record<string, string>,
      effectAllowed: 'all',
      dropEffect: 'move',
      setData(type: string, value: string) {
        this.store[type] = value;
      },
      getData(type: string) {
        return this.store[type] ?? '';
      },
    };

    expect(sourceCard).not.toBeNull();
    expect(targetCell).not.toBeNull();

    fireEvent.dragStart(sourceCard as HTMLElement, { dataTransfer });
    fireEvent.dragOver(targetCell as Element, { dataTransfer });
    fireEvent.drop(targetCell as Element, { dataTransfer });
    fireEvent.dragEnd(sourceCard as HTMLElement, { dataTransfer });

    await waitFor(() =>
      expect(mockAxios.put).toHaveBeenCalledWith(
        expect.stringContaining('/user/watched-games/game-1/schedule'),
        { scheduled_for: null },
        expect.objectContaining({ headers: expect.any(Object) }),
      ),
    );

    const updater = mockSetQueriesData.mock.calls.at(-1)?.[1];
    expect(updater(games)[0]).toEqual(
      expect.objectContaining({
        id: 'game-1',
        scheduled_for: null,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('AWY @ HOM watch schedule cleared');
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('marks an unwatched game as watched from the hover action', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getAllByRole('button', { name: 'Mark as watched' })[0]);

    expect(mockAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/user/watched-games/game-1'),
      {},
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(mockSetQueriesData).toHaveBeenCalledWith(
      { queryKey: ['user-games'] },
      expect.any(Function),
    );
    const updater = mockSetQueriesData.mock.calls.at(-1)?.[1];
    expect(updater(games)[0]).toEqual(
      expect.objectContaining({
        id: 'game-1',
        watched_by_user: true,
        watched_on: scheduledWatchDate,
        scheduled_for: scheduledWatchDate,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('AWY @ HOM marked as watched');
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('skips a game from the hover action and removes it from cached user games', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getAllByRole('button', { name: 'Skip game' })[0]);

    expect(mockAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/user/watched-games/game-1/skip'),
      {},
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(screen.queryByText('Skip Game')).not.toBeInTheDocument();
    expect(screen.queryByText('Move AWY @ HOM to skipped games?')).not.toBeInTheDocument();
    expect(mockSetQueriesData).toHaveBeenCalledWith(
      { queryKey: ['user-games'] },
      expect.any(Function),
    );

    const updater = mockSetQueriesData.mock.calls.at(-1)?.[1];
    expect(updater(games)).toEqual([games[1]]);
    expect(toast.success).toHaveBeenCalledWith('AWY @ HOM skipped');
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('undoes a skipped game from the hover action', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('switch', { name: 'Show skipped games' }));
    await user.click(screen.getByRole('button', { name: 'Undo skip' }));

    expect(mockAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/user/watched-games/game-skipped'),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(mockSetQueriesData).toHaveBeenCalledWith(
      { queryKey: ['user-games'] },
      expect.any(Function),
    );

    const updater = mockSetQueriesData.mock.calls.at(-1)?.[1];
    expect(updater([skippedGame])[0]).toEqual(
      expect.objectContaining({
        id: 'game-skipped',
        watched_by_user: false,
        watched_on: null,
        skipped_by_user: false,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('SKP @ HOM restored');
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('unwatches a watched game and clears only the watched state in cache', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'Unwatch' }));

    expect(mockAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/user/watched-games/game-2'),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(mockSetQueriesData).toHaveBeenCalledWith(
      { queryKey: ['user-games'] },
      expect.any(Function),
    );

    const updater = mockSetQueriesData.mock.calls.at(-1)?.[1];
    expect(updater(games)[1]).toEqual(
      expect.objectContaining({
        id: 'game-2',
        watched_by_user: false,
        watched_on: null,
        scheduled_for: null,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('OPP @ HOM marked as unwatched');
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('opens schedule watch and saves the selected watch date', async () => {
    const user = userEvent.setup();
    const targetDate = localDateString(3);
    render(<UserGames />);

    await user.click(screen.getAllByRole('button', { name: 'Edit watch schedule' })[0]);

    expect(screen.getByText('Schedule Watch')).toBeInTheDocument();
    expect(screen.getByText(/saved in your local timezone/i)).toBeInTheDocument();
    const input = screen.getByLabelText('Watch date');
    await user.clear(input);
    await user.type(input, targetDate);
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    expect(mockAxios.put).toHaveBeenCalledWith(
      expect.stringContaining('/user/watched-games/game-1/schedule'),
      { scheduled_for: targetDate },
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(mockSetQueriesData).toHaveBeenCalledWith(
      { queryKey: ['user-games'] },
      expect.any(Function),
    );
    expect(toast.success).toHaveBeenCalledWith('AWY @ HOM scheduled for May 18, 2026');
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('prevents scheduling a watch on or before the local game date', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getAllByRole('button', { name: 'Edit watch schedule' })[0]);
    const input = screen.getByLabelText('Watch date');
    await user.clear(input);
    await user.type(input, localDateKeyForGame(games[0]) ?? scheduledWatchDate);

    expect(screen.getByText(/after the game's scheduled date/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Schedule' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));
    expect(mockAxios.put).not.toHaveBeenCalled();
  });

  it('keeps the selected calendar month after saving a watch schedule', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'Month view' }));

    const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
    );

    await user.click(screen.getAllByRole('button', { name: 'Edit watch schedule' })[0]);
    const input = screen.getByLabelText('Watch date');
    await user.clear(input);
    await user.type(input, localDateString(3));
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    expect(screen.getByRole('button', { name: `Select month: ${monthLabel}` })).toBeInTheDocument();
  });

  it('keeps the selected calendar month after marking a scheduled game as watched', async () => {
    const user = userEvent.setup();
    render(<UserGames />);
    await user.click(screen.getByRole('button', { name: 'Month view' }));

    const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
    );

    await user.click(screen.getAllByRole('button', { name: 'Mark as watched' })[0]);

    expect(screen.getByRole('button', { name: `Select month: ${monthLabel}` })).toBeInTheDocument();
  });

  it('keeps the selected week after marking a scheduled game as watched in Week view', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'Week view' }));

    const weekLabel = formatWeekRange(currentDate, dateOffset(6));
    await user.click(screen.getAllByRole('button', { name: 'Mark as watched' })[0]);

    expect(screen.getByRole('button', { name: `Select week: ${weekLabel}` })).toBeInTheDocument();
  });

  it('stores and restores the selected week in session storage', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'Week view' }));
    await user.click(screen.getByRole('button', { name: 'Next week' }));

    const expectedWeekStart = localDateString(7);
    const expectedWeekLabel = formatWeekRange(dateOffset(7), dateOffset(13));

    expect(window.sessionStorage.getItem('user-games-week-start')).toBe(expectedWeekStart);

    unmount();
    render(<UserGames />);
    await user.click(screen.getByRole('button', { name: 'Week view' }));

    expect(
      screen.getByRole('button', { name: `Select week: ${expectedWeekLabel}` }),
    ).toBeInTheDocument();
  });

  it('stores the selected month in session storage', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'Month view' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));

    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const expectedMonthValue = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    const expectedMonthLabel = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
    }).format(nextMonth);

    expect(window.sessionStorage.getItem('user-games-calendar-month')).toBe(expectedMonthValue);
    expect(
      screen.getByRole('button', { name: `Select month: ${expectedMonthLabel}` }),
    ).toBeInTheDocument();
  });

  it('renders compact calendar game cards and navigates when clicked', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'Month view' }));

    expect(
      screen.getByRole('button', {
        name: `Select month: ${new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))}`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        formatNumericDate(localDateKeyForGame(games[0]) ?? scheduledWatchDate),
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'View game details' })).toHaveLength(1);

    await user.click(screen.getAllByRole('button', { name: 'View game details' })[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/games/05-15-2026/opp-vs-hom');
  });

  it('uses local date placement for timezone-sensitive games', async () => {
    const user = userEvent.setup();
    const timezoneSensitiveGame = {
      ...games[0],
      id: 'game-tz',
      away_team: { ...games[0].away_team, name: 'Timezone Team', code: 'TZN' },
      scheduled_for: null,
      scheduled_at: currentMonthIso(1, 16),
      scheduled_time: '23:30',
    };

    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'user-leagues')
        return { data: [{ id: 'league-1', name: 'NHL', code: 'NHL', logo: null }] };
      if (queryKey[0] === 'user-favorites') return { data: ['team-home', 'team-tz'] };
      if (queryKey[0] === 'user-games') return { data: [timezoneSensitiveGame], isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<UserGames />);

    const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
    );
    const localHeading = formatHeading(
      localDateKeyForGame(timezoneSensitiveGame) ?? localDateString(1),
    );

    await user.click(screen.getByRole('button', { name: 'Week view' }));
    expect(screen.getByText(localHeading)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Month view' }));
    expect(screen.getByRole('button', { name: `Select month: ${monthLabel}` })).toBeInTheDocument();
  });
});
