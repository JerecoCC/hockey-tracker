import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import useLeagues from '@/hooks/useLeagues';
import useLeagueDetails from '@/hooks/useLeagueDetails';
import useDocumentIcon from '@/hooks/useDocumentIcon';
import useGames, { usePlayoffSeries, type PlayoffSeriesRecord } from '@/hooks/useGames';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import PlayoffSeriesDetailsPage from './PlayoffSeriesDetailsPage';

const mockUseParams = jest.fn();
const mockStartSeries = jest.fn();
const mockScoreboardCard = jest.fn((props: unknown) => {
  void props;
  return <div>scoreboard</div>;
});

jest.mock('react-router-dom', () => ({
  useParams: () => mockUseParams(),
}));
jest.mock('@/hooks/useLeagues', () => jest.fn());
jest.mock('@/hooks/useLeagueDetails', () => jest.fn());
jest.mock('@/hooks/useDocumentIcon', () => jest.fn());
jest.mock('@/hooks/useGames', () => ({
  __esModule: true,
  default: jest.fn(),
  usePlayoffSeries: jest.fn(),
}));
jest.mock('@/context/BreadcrumbContext', () => ({
  usePageBreadcrumbs: jest.fn(),
}));
jest.mock(
  '@jerecocc/tracker-ui/components/Section/Section',
  () =>
    function MockSection({
      title,
      action,
      children,
    }: {
      title?: ReactNode;
      action?: ReactNode;
      children?: ReactNode;
    }) {
      return (
        <section>
          {title && <h2>{title}</h2>}
          {action}
          {children}
        </section>
      );
    },
);
jest.mock(
  '@jerecocc/tracker-ui/components/Button/Button',
  () =>
    function MockButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
      return <button {...props}>{children}</button>;
    },
);
jest.mock(
  '@jerecocc/tracker-ui/components/LoadingSpinner/LoadingSpinner',
  () =>
    function MockLoadingSpinner({ message }: { message?: ReactNode }) {
      return <div>{message}</div>;
    },
);
jest.mock(
  '@jerecocc/tracker-ui/components/Skeleton/Skeleton',
  () =>
    function MockSkeleton(props: HTMLAttributes<HTMLDivElement>) {
      return <div {...props} />;
    },
);
jest.mock(
  '@/pages/admin/games/game-details/ScoreboardCard',
  () => (props: unknown) => mockScoreboardCard(props),
);
jest.mock(
  '@/shared/GameCard/GameCard',
  () =>
    function MockGameListItem() {
      return <li>game item</li>;
    },
);
jest.mock(
  './GameFormModal',
  () =>
    function MockGameFormModal() {
      return null;
    },
);

const mockUseLeagues = useLeagues as jest.Mock;
const mockUseLeagueDetails = useLeagueDetails as jest.Mock;
const mockUseDocumentIcon = useDocumentIcon as jest.Mock;
const mockUseGames = useGames as jest.Mock;
const mockUsePlayoffSeries = usePlayoffSeries as jest.Mock;
const mockUsePageBreadcrumbs = usePageBreadcrumbs as jest.Mock;

const series: PlayoffSeriesRecord = {
  id: 'series-1',
  season_id: 'season-1',
  round: 1,
  series_letter: null,
  playoff_round_names: { 1: 'Quarterfinal' },
  playoff_matchup_names: { r1m0: 'Opening Series' },
  home_team_id: 'home-team',
  home_team_name: 'Toronto Maple Leafs',
  home_team_place_name: 'Toronto',
  home_team_team_name: 'Maple Leafs',
  home_team_code: 'TOR',
  home_team_logo: null,
  home_team_logo_dark: null,
  home_team_logo_light: null,
  home_team_primary_color: '#00205b',
  home_team_secondary_color: '#ffffff',
  home_team_text_color: '#ffffff',
  away_team_id: 'away-team',
  away_team_name: 'Detroit Red Wings',
  away_team_place_name: 'Detroit',
  away_team_team_name: 'Red Wings',
  away_team_code: 'DET',
  away_team_logo: null,
  away_team_logo_dark: null,
  away_team_logo_light: null,
  away_team_primary_color: '#ce1126',
  away_team_secondary_color: '#ffffff',
  away_team_text_color: '#ffffff',
  games_to_win: 4,
  home_wins: 0,
  away_wins: 0,
  status: 'upcoming',
  winner_team_id: null,
  bracket_slot_key: 'r1m0',
  created_at: '2025-04-15T00:00:00.000Z',
  games: [],
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PlayoffSeriesDetailsPage />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseParams.mockReturnValue({
    leagueSlug: 'nhl',
    seasonSlug: '2024-25',
    seriesSlug: 'series-1',
  });
  mockUseLeagues.mockReturnValue({
    leagues: [{ id: 'league-1', code: 'NHL', name: 'National Hockey League' }],
    loading: false,
  });
  mockUseLeagueDetails.mockReturnValue({
    league: { id: 'league-1', code: 'NHL', name: 'National Hockey League', icon: null },
    seasons: [
      {
        id: 'season-1',
        name: '2024-25',
        league_id: 'league-1',
        start_date: '2024-10-01',
        end_date: '2025-06-30',
        is_current: false,
        games_per_season: 82,
        created_at: '2024-01-01T00:00:00.000Z',
      },
    ],
    loading: false,
  });
  mockUseDocumentIcon.mockReturnValue(undefined);
  mockUseGames.mockReturnValue({
    createGame: jest.fn(),
    updateGame: jest.fn(),
  });
  mockUsePlayoffSeries.mockReturnValue({
    series: [series],
    loading: false,
    busy: null,
    startSeries: mockStartSeries,
  });
  mockUsePageBreadcrumbs.mockReturnValue(undefined);
  mockStartSeries.mockReturnValue(new Promise(() => {}));
});

describe('PlayoffSeriesDetailsPage', () => {
  it('starts an empty series from the games section header and shows game skeletons', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /start series/i }));

    expect(mockStartSeries).toHaveBeenCalledWith('series-1');
    expect(await screen.findByLabelText(/loading series games/i)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    expect(screen.queryByText(/no games have been generated/i)).not.toBeInTheDocument();
  });

  it('passes playoff series wins to the scoreboard as dot data', () => {
    mockUsePlayoffSeries.mockReturnValue({
      series: [
        {
          ...series,
          status: 'active',
          away_wins: 2,
          home_wins: 1,
        },
      ],
      loading: false,
      busy: null,
      startSeries: mockStartSeries,
    });

    renderPage();

    expect(mockScoreboardCard.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        liveAwayScore: 2,
        liveHomeScore: 1,
        seriesScore: {
          awayWins: 2,
          homeWins: 1,
          winsNeeded: 4,
        },
      }),
    );
  });
});
