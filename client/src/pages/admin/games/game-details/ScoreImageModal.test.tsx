import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import { toPng } from 'html-to-image';
import { ThemeContext } from '@/context/ThemeContext';
import type { GameRecord } from '@/hooks/useGames';
import useLeagues from '@/hooks/useLeagues';
import useTeams from '@/hooks/useTeams';
import ScoreImageModal from './ScoreImageModal';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('html-to-image', () => ({ toPng: jest.fn() }));
jest.mock('@/hooks/useLeagues', () => jest.fn());
jest.mock('@/hooks/useTeams', () => jest.fn());

const mockUseQuery = useQuery as jest.Mock;
const mockToPng = toPng as jest.Mock;
const mockUseLeagues = useLeagues as jest.Mock;
const mockUseTeams = useTeams as jest.Mock;

beforeAll(() => {
  window.scrollTo = jest.fn();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  Object.defineProperty(HTMLImageElement.prototype, 'complete', {
    configurable: true,
    get: () => true,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: [] });
  mockUseLeagues.mockReturnValue({ leagues: [] });
  mockUseTeams.mockReturnValue({ teams: [] });
  mockToPng.mockResolvedValue('data:image/png;base64,test');
});

describe('ScoreImageModal', () => {
  it('toggles playoff fields when the Playoff Game label is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ScoreImageModal
        open
        onClose={jest.fn()}
        showForm
      />,
    );

    expect(screen.queryByPlaceholderText('e.g. Quarterfinals')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview Image' })).not.toBeInTheDocument();

    await user.click(screen.getByText('Playoff Game'));

    expect(screen.getByPlaceholderText('e.g. Quarterfinals')).toBeInTheDocument();
    expect(screen.getByLabelText('Game #')).toBeInTheDocument();
    expect(screen.getByLabelText('Away Wins')).toBeInTheDocument();
    expect(screen.getByLabelText('Home Wins')).toBeInTheDocument();

    await user.click(screen.getByText('Playoff Game'));

    expect(screen.queryByPlaceholderText('e.g. Quarterfinals')).not.toBeInTheDocument();
  });

  it('downloads using away vs home and game date in the filename', async () => {
    const user = userEvent.setup();
    const originalCreateElement = document.createElement.bind(document);
    const clickMock = jest.fn();
    let createdAnchor: HTMLAnchorElement | null = null;
    mockUseLeagues.mockReturnValue({
      leagues: [
        {
          id: 'league-1',
          name: 'Hockey League',
          code: 'HL',
          logo: 'https://example.com/league.png',
          icon: null,
          primary_color: '#111111',
          text_color: '#ffffff',
          best_of_playoff: 7,
          best_of_shootout: 3,
          scoring_system: '2-1-0',
          playoff_format: null,
        },
      ],
    });
    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (String(tagName).toLowerCase() === 'a') {
        createdAnchor = element as HTMLAnchorElement;
        Object.defineProperty(element, 'click', { value: clickMock });
      }
      return element;
    });

    render(
      <ThemeContext.Provider
        value={{
          theme: 'light',
          isDarkMode: false,
          setTheme: jest.fn(),
          toggleTheme: jest.fn(),
        }}
      >
        <ScoreImageModal
          open
          onClose={jest.fn()}
          game={
            {
              away_team: {
                id: 'team-away',
                name: 'Away Bears',
                place_name: 'Away',
                team_name: 'Bears',
                code: 'AWY',
                logo: '/logos/away-default.png',
                logo_dark: '/logos/away-dark.png',
                logo_light: '/logos/away-light.png',
                primary_color: '#111111',
                secondary_color: '#222222',
                text_color: '#ffffff',
              },
              home_team: {
                id: 'team-home',
                name: 'Home Wolves',
                place_name: 'Home',
                team_name: 'Wolves',
                code: 'HOM',
                logo: '/logos/home-default.png',
                logo_dark: '/logos/home-dark.png',
                logo_light: '/logos/home-light.png',
                primary_color: '#333333',
                secondary_color: '#444444',
                text_color: '#ffffff',
              },
              scheduled_at: '2026-03-05T19:00:00Z',
              league_code: 'HL',
              league_name: 'Hockey League',
              season_name: '2026 Season',
              league_id: 'league-1',
              league_primary_color: '#0055aa',
              game_type: 'regular',
              series_games_to_win: null,
              series_home_wins: null,
              series_away_wins: null,
              series_home_team_id: null,
              game_number_in_series: null,
              playoff_round: null,
              playoff_round_names: null,
            } as Partial<GameRecord> as GameRecord
          }
          liveAwayScore={1}
          liveHomeScore={2}
          allowPreview
        />
      </ThemeContext.Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'Preview Image' }));
    expect(await screen.findByAltText('Generated score card preview')).toHaveAttribute(
      'src',
      'data:image/png;base64,test',
    );

    await user.click(screen.getByRole('button', { name: 'Download Image' }));

    await waitFor(() => expect(clickMock).toHaveBeenCalled());
    expect(screen.getByText('REGULAR SEASON')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Wolves')).toBeInTheDocument();
    expect(screen.queryByText('Winner')).not.toBeInTheDocument();
    expect(screen.getByAltText('HL logo')).toHaveAttribute(
      'src',
      'https://example.com/league.png',
    );
    expect(mockToPng).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.objectContaining({
        width: 1440,
        height: 2560,
        backgroundColor: '#0f172a',
      }),
    );
    expect(mockToPng.mock.calls[0][0]).toHaveAttribute('data-theme', 'dark');
    expect(mockToPng.mock.calls[0][0]).toHaveStyle('--league-band: #003d7a');
    const exportedImageSources = Array.from(document.querySelectorAll('img')).map((img) =>
      img.getAttribute('src'),
    );
    expect(exportedImageSources).toEqual(
      expect.arrayContaining(['/logos/away-dark.png', '/logos/home-dark.png']),
    );
    expect(exportedImageSources).not.toContain('/logos/away-light.png');
    expect(exportedImageSources).not.toContain('/logos/home-light.png');
    expect(createdAnchor?.download).toBe('AWY vs HOM - 2026-03-05.png');
  });

  it('uses league code, playoffs, and game year in the top title for playoff games', () => {
    render(
      <ScoreImageModal
        open
        onClose={jest.fn()}
        game={
          {
            away_team: {
              id: 'team-away',
              name: 'Away Bears',
              code: 'AWY',
              logo: null,
              primary_color: '#111111',
              secondary_color: '#222222',
              text_color: '#ffffff',
            },
            home_team: {
              id: 'team-home',
              name: 'Home Wolves',
              code: 'HOM',
              logo: null,
              primary_color: '#333333',
              secondary_color: '#444444',
              text_color: '#ffffff',
            },
            scheduled_at: '2026-06-18T19:00:00Z',
            league_code: 'HL',
            league_name: 'Hockey League',
            season_name: '2026 Season',
            game_type: 'playoff',
            series_games_to_win: 4,
            series_home_wins: 2,
            series_away_wins: 1,
            series_home_team_id: 'team-home',
            game_number_in_series: 4,
            playoff_round: 1,
            playoff_round_names: { 1: 'Finals' },
          } as Partial<GameRecord> as GameRecord
        }
        liveAwayScore={1}
        liveHomeScore={2}
      />,
    );

    expect(screen.getAllByText('HL').length).toBeGreaterThan(0);
    expect(screen.getByText('Playoffs 2026')).toBeInTheDocument();
  });
});
