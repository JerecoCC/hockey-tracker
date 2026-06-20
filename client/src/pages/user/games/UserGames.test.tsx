import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toPng } from 'html-to-image';
import calendarItemStyles from '@/components/CalendarGameListItem/CalendarGameListItem.module.scss';
import monthCalendarStyles from '@/components/MonthCalendar/MonthCalendar.module.scss';
import UserGames from './UserGames';
import styles from './UserGames.module.scss';

const mockNavigate = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockSetQueriesData = jest.fn();

jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('axios');
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(), useQueryClient: jest.fn() }));
jest.mock('html-to-image', () => ({ toPng: jest.fn() }));
jest.mock(
  '@/components/Modal/Modal',
  () =>
    ({ open, title, children, onClose, onConfirm, confirmLabel, footerStart }: any) =>
      open ? (
        <div>
          <div>{title}</div>
          {children}
          {footerStart}
          {onConfirm && <button onClick={onConfirm}>{confirmLabel ?? 'Save'}</button>}
          <button onClick={onClose}>Cancel</button>
        </div>
      ) : null,
);
jest.mock('@/components/Card/Card', () => ({ title, action, children, className }: any) => (
  <section className={className}>
    {title && <div>{title}</div>}
    {action}
    {children}
  </section>
));
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
    ({ children, tooltip, icon, onClick, disabled }: any) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip ?? icon}
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
  default: ({ value, options, onChange, placeholder }: any) => (
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
    </div>
  ),
}));

const mockUseQuery = useQuery as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockAxios = axios as jest.Mocked<typeof axios>;
const mockToPng = toPng as jest.Mock;

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
const etDateKeyForIso = (iso: string, scheduledTime: string | null) => {
  if (!scheduledTime) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso));
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
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(instant);
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
const scheduledWatchDate = localDateString(0);
const watchedDate = localDateString(1);
const alternateCurrentMonthDate = (excluded: string[] = []) => {
  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const excludedSet = new Set(excluded);

  for (let day = 1; day <= lastDay; day++) {
    const candidate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!excludedSet.has(candidate)) return candidate;
  }

  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
};

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
  mockToPng.mockResolvedValue('data:image/png;base64,test');
  mockUseQuery.mockImplementation(({ queryKey }: any) => {
    if (queryKey[0] === 'user-leagues')
      return { data: [{ id: 'league-1', name: 'NHL', code: 'NHL', logo: null }] };
    if (queryKey[0] === 'user-favorites') return { data: ['team-home', 'team-opp'] };
    if (queryKey[0] === 'user-games')
      return { data: queryKey[3] ? [...games, skippedGame] : games, isLoading: false };
    return { data: [], isLoading: false };
  });
});

describe('UserGames calendar view', () => {
  it('shows favorite team filtering and hides status text in list view', async () => {
    const user = userEvent.setup();
    render(<UserGames />);
    await user.click(screen.getByRole('button', { name: 'List view' }));

    expect(screen.getByRole('combobox', { name: 'All Favorite Teams' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle Home Team' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle Opponent' })).toBeInTheDocument();

    const firstGameCard = screen.getAllByText('Away Team')[0].closest('[style]');
    expect(within(firstGameCard as HTMLElement).queryByText('Upcoming')).not.toBeInTheDocument();
    expect(within(firstGameCard as HTMLElement).queryByText('Final')).not.toBeInTheDocument();
    expect(within(firstGameCard as HTMLElement).queryByText('11')).not.toBeInTheDocument();
    expect(within(firstGameCard as HTMLElement).queryByText('7')).not.toBeInTheDocument();
    expect(within(firstGameCard as HTMLElement).getAllByText('–').length).toBeGreaterThanOrEqual(3);
    expect(
      within(firstGameCard as HTMLElement).queryByText(
        `Watching ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(dateOffset(0))}`,
      ),
    ).not.toBeInTheDocument();
    expect(
      within(firstGameCard as HTMLElement).getByText(
        formatNumericDate(etDateKeyForIso(games[0].scheduled_at, games[0].scheduled_time)),
      ),
    ).toBeInTheDocument();
    expect(firstGameCard).toHaveStyle('--game-league-primary: #0a4fa3');

    const scheduledDayCard = screen.getByText(formatHeading(scheduledWatchDate)).parentElement;
    expect(within(scheduledDayCard as HTMLElement).getByText('Away Team')).toBeInTheDocument();
    expect(
      within(
        screen.getByText(
          formatHeading(etDateKeyForIso(games[0].scheduled_at, games[0].scheduled_time)),
        ).parentElement as HTMLElement,
      ).queryByText('Away Team'),
    ).not.toBeInTheDocument();

    const watchedGameCard = screen.getAllByText('Opponent')[0].closest('[role="button"]');
    expect(within(watchedGameCard as HTMLElement).getByText('2')).toBeInTheDocument();
    expect(within(watchedGameCard as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(
      within(watchedGameCard as HTMLElement).queryByText(
        `Watched ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(dateOffset(1))}`,
      ),
    ).not.toBeInTheDocument();
    expect(
      within(firstGameCard as HTMLElement).queryByRole('button', { name: 'View game details' }),
    ).not.toBeInTheDocument();
    expect(
      within(watchedGameCard as HTMLElement).getByRole('button', { name: 'View game details' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Mark as watched' }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows won't watch games when the filter switch is enabled", async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    expect(screen.queryByText('SKP')).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: "Show won't watch games" }));

    expect(screen.getByRole('switch', { name: "Hide won't watch games" })).toBeInTheDocument();
    expect(screen.getByText('SKP')).toBeInTheDocument();
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['user-games', 'all', 'all', true],
      }),
    );
  });

  it('shows playoff round metadata on calendar cards but hides series dots until watched', () => {
    render(<UserGames />);

    expect(screen.getByText('R2 - G3')).toBeInTheDocument();
    expect(screen.queryByLabelText('Series record 1 of 4')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Series record 2 of 4')).not.toBeInTheDocument();
  });

  it('styles watched calendar teams differently for winners and losers', () => {
    render(<UserGames />);

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

    expect(winnerScore).toHaveClass(calendarItemStyles.scoreWin);
    expect(loserScore).toHaveClass(calendarItemStyles.scoreLose);
  });

  it('opens the score image form from the games toolbar', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
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

  it('downloads the current calendar month as an image from calendar view', async () => {
    const user = userEvent.setup();
    const originalCreateElement = document.createElement.bind(document);
    const clickMock = jest.fn();
    let createdAnchor: HTMLAnchorElement | null = null;
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (String(tagName).toLowerCase() === 'a') {
        createdAnchor = element as HTMLAnchorElement;
        Object.defineProperty(element, 'click', { value: clickMock });
      }
      return element;
    });

    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('button', { name: /Download Month Image/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Download Month Image/ }));

    await waitFor(() => expect(clickMock).toHaveBeenCalled());
    const capturedNode = mockToPng.mock.calls[0][0] as HTMLElement;
    expect(mockToPng).toHaveBeenCalledWith(
      expect.objectContaining({ dataset: expect.objectContaining({ calendarExport: 'true' }) }),
      expect.objectContaining({
        backgroundColor: expect.any(String),
        cacheBust: true,
        pixelRatio: 2,
      }),
    );
    expect(capturedNode.textContent).toContain(
      new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(currentDate),
    );
    expect(capturedNode.querySelector(`.${monthCalendarStyles.grid}`)).not.toBeNull();
    expect(createdAnchor?.download).toContain('user-games-');
    expect(createdAnchor?.href).toBe('data:image/png;base64,test');

    createElementSpy.mockRestore();
  });

  it('shows playoff series dots once a playoff game has been watched', () => {
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

    expect(screen.getByLabelText('Series record 1 of 4')).toBeInTheDocument();
    expect(screen.getByLabelText('Series record 2 of 4')).toBeInTheDocument();
    expect(screen.queryByLabelText('Series record 3 of 4')).not.toBeInTheDocument();
  });

  it('uses the game-specific series score for a watched game 1 instead of the final series total', () => {
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

    expect(screen.getByLabelText('Series record 1 of 4')).toBeInTheDocument();
    expect(screen.getByLabelText('Series record 0 of 4')).toBeInTheDocument();
    expect(screen.queryByLabelText('Series record 4 of 4')).not.toBeInTheDocument();
  });

  it('keeps ET date placement correct for games with a date-only scheduled_at', async () => {
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
    await user.click(screen.getByRole('button', { name: 'List view' }));

    const daySection = screen.getByText(formatHeading(dateOnlyKey)).parentElement;
    expect(daySection).not.toBeNull();
    expect(within(daySection as HTMLElement).getByText('Date Only Team')).toBeInTheDocument();
  });

  it('keeps ET date placement correct for midnight-UTC scheduled_at placeholders', async () => {
    const user = userEvent.setup();
    const intendedEtDate = localDateString(1);
    const previousEtDate = localDateString(0);
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
    await user.click(screen.getByRole('button', { name: 'List view' }));

    const intendedDaySection = screen.getByText(formatHeading(intendedEtDate)).parentElement;
    expect(intendedDaySection).not.toBeNull();
    expect(
      within(intendedDaySection as HTMLElement).getByText('Midnight Placeholder'),
    ).toBeInTheDocument();

    const previousDaySection = screen.getByText(formatHeading(previousEtDate)).parentElement;
    expect(
      within(previousDaySection as HTMLElement).queryByText('Midnight Placeholder'),
    ).not.toBeInTheDocument();
  });

  it('filters user games by selected favorite teams', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'List view' }));
    await user.click(screen.getByRole('button', { name: 'Toggle Opponent' }));

    expect(screen.queryByText('Away Team')).not.toBeInTheDocument();
    expect(screen.getByText('Opponent')).toBeInTheDocument();
  });

  it('allows dragging a calendar game to another date to schedule it', async () => {
    render(<UserGames />);

    const originalDate = etDateKeyForIso(games[0].scheduled_at, games[0].scheduled_time);
    const targetDate = alternateCurrentMonthDate([originalDate, scheduledWatchDate]);
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

    fireEvent.dragStart(sourceCard as HTMLElement, { dataTransfer });
    fireEvent.dragOver(targetCell as Element, { dataTransfer });
    fireEvent.drop(targetCell as Element, { dataTransfer });
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
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('clears the schedule when dragging a game back to its original date', async () => {
    render(<UserGames />);

    const originalDate = etDateKeyForIso(games[0].scheduled_at, games[0].scheduled_time);
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
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('skips a game from the hover action and removes it from cached user games', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getAllByRole('button', { name: 'Won’t watch' })[0]);

    expect(screen.getByText('Won’t Watch Game')).toBeInTheDocument();
    expect(screen.getByText('Hide AWY @ HOM from your games feed?')).toBeInTheDocument();
    expect(mockAxios.post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Hide game' }));

    expect(mockAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/user/watched-games/game-1/skip'),
      {},
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(mockSetQueriesData).toHaveBeenCalledWith(
      { queryKey: ['user-games'] },
      expect.any(Function),
    );

    const updater = mockSetQueriesData.mock.calls.at(-1)?.[1];
    expect(updater(games)).toEqual([games[1]]);
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
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('opens schedule watch and saves the selected watch date', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getAllByRole('button', { name: 'Edit watch schedule' })[0]);

    expect(screen.getByText('Schedule Watch')).toBeInTheDocument();
    expect(screen.getByText(/saved in your local timezone/i)).toBeInTheDocument();
    const input = screen.getByLabelText('Watch date');
    await user.clear(input);
    await user.type(input, '2024-10-20');
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    expect(mockAxios.put).toHaveBeenCalledWith(
      expect.stringContaining('/user/watched-games/game-1/schedule'),
      { scheduled_for: '2024-10-20' },
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(mockSetQueriesData).toHaveBeenCalledWith(
      { queryKey: ['user-games'] },
      expect.any(Function),
    );
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('keeps the selected calendar month and timezone after saving a watch schedule', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'Calendar view' }));
    await user.selectOptions(screen.getAllByRole('combobox')[3], 'local');

    const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
    );

    await user.click(screen.getAllByRole('button', { name: 'Edit watch schedule' })[0]);
    const input = screen.getByLabelText('Watch date');
    await user.clear(input);
    await user.type(input, '2024-10-20');
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    expect(screen.getByRole('button', { name: `Select month: ${monthLabel}` })).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')[3]).toHaveValue('local');
  });

  it('keeps the selected calendar month and timezone after marking a scheduled game as watched', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.selectOptions(screen.getAllByRole('combobox')[3], 'local');

    const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
    );

    await user.click(screen.getAllByRole('button', { name: 'Mark as watched' })[0]);

    expect(screen.getByRole('button', { name: `Select month: ${monthLabel}` })).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')[3]).toHaveValue('local');
  });

  it('keeps the selected week after marking a scheduled game as watched in list view', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'List view' }));

    const weekLabel = formatWeekRange(currentDate, dateOffset(6));
    await user.click(screen.getAllByRole('button', { name: 'Mark as watched' })[0]);

    expect(screen.getByRole('button', { name: `Select week: ${weekLabel}` })).toBeInTheDocument();
  });

  it('stores the selected timezone in local storage', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.selectOptions(screen.getAllByRole('combobox')[3], 'local');

    expect(window.localStorage.getItem('user-games-tz-pref')).toBe('local');
  });

  it('stores and restores the selected week in session storage', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'List view' }));
    await user.click(screen.getByRole('button', { name: 'Next week' }));

    const expectedWeekStart = localDateString(7);
    const expectedWeekLabel = formatWeekRange(dateOffset(7), dateOffset(13));

    expect(window.sessionStorage.getItem('user-games-week-start')).toBe(expectedWeekStart);

    unmount();
    render(<UserGames />);
    await user.click(screen.getByRole('button', { name: 'List view' }));

    expect(
      screen.getByRole('button', { name: `Select week: ${expectedWeekLabel}` }),
    ).toBeInTheDocument();
  });

  it('stores and restores the selected month in session storage', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'Next month' }));

    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const expectedMonthValue = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    const expectedMonthLabel = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
    }).format(nextMonth);

    expect(window.sessionStorage.getItem('user-games-calendar-month')).toBe(expectedMonthValue);

    unmount();
    render(<UserGames />);

    expect(
      screen.getByRole('button', { name: `Select month: ${expectedMonthLabel}` }),
    ).toBeInTheDocument();
  });

  it('renders compact calendar game cards and navigates when clicked', async () => {
    const user = userEvent.setup();
    render(<UserGames />);

    await user.click(screen.getByRole('button', { name: 'Calendar view' }));

    expect(
      screen.getByRole('button', {
        name: `Select month: ${new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))}`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        formatNumericDate(etDateKeyForIso(games[0].scheduled_at, games[0].scheduled_time)),
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'View game details' })).toHaveLength(1);

    await user.click(screen.getAllByRole('button', { name: 'View game details' })[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/games/game-2');
  });

  it('changes displayed game dates when timezone changes without changing the rendered month', async () => {
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
    const etHeading = formatHeading(
      etDateKeyForIso(timezoneSensitiveGame.scheduled_at, timezoneSensitiveGame.scheduled_time),
    );
    const localHeading = formatHeading(
      localDateKeyForIso(timezoneSensitiveGame.scheduled_at, timezoneSensitiveGame.scheduled_time),
    );

    await user.click(screen.getByRole('button', { name: 'List view' }));

    if (etHeading !== localHeading) {
      expect(screen.getByText(etHeading)).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: 'Calendar view' }));
    expect(screen.getByRole('button', { name: `Select month: ${monthLabel}` })).toBeInTheDocument();
    await user.selectOptions(screen.getAllByRole('combobox')[3], 'local');
    expect(screen.getByRole('button', { name: `Select month: ${monthLabel}` })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'List view' }));

    if (etHeading !== localHeading) {
      expect(screen.getByText(localHeading)).toBeInTheDocument();
    }
  });
});
