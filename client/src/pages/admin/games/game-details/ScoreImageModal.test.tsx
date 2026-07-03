import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import { toPng } from 'html-to-image';
import { ThemeContext } from '@/context/ThemeContext';
import type { GameRecord } from '@/hooks/useGames';
import useLeagues from '@/hooks/useLeagues';
import ScoreImageModal from './ScoreImageModal';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('html-to-image', () => ({ toPng: jest.fn() }));
jest.mock('@/hooks/useLeagues', () => jest.fn());

const mockUseQuery = useQuery as jest.Mock;
const mockToPng = toPng as jest.Mock;
const mockUseLeagues = useLeagues as jest.Mock;

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
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: [] });
  mockUseLeagues.mockReturnValue({ leagues: [] });
  mockToPng.mockResolvedValue('data:image/png;base64,test');
});

describe('ScoreImageModal', () => {
  it('disables game fields until a season is selected and tracks the last period', async () => {
    const user = userEvent.setup();
    const seasons = [
      {
        id: 'season-1',
        name: '2025-26',
        start_date: '2025-10-01',
        created_at: '2025-09-01T00:00:00Z',
        is_current: true,
        best_of_playoff: null,
        league_best_of_playoff: 5,
        bracket_rule_set_id: 'rule-set-1',
        playoff_round_names: {
          1: 'Wild Card',
          2: 'Finals',
        },
        playoff_matchup_names: {
          r1m0: 'Opening Matchup',
        },
      },
    ];
    const seasonTeams = [
      {
        id: 'team-away',
        league_id: 'league-1',
        name: 'Away Bears',
        place_name: 'Away',
        team_name: 'Bears',
        code: 'AWY',
        logo: null,
        logo_dark: null,
        logo_light: null,
        primary_color: '#111111',
        secondary_color: '#222222',
        text_color: '#ffffff',
      },
      {
        id: 'team-home',
        league_id: 'league-1',
        name: 'Home Wolves',
        place_name: 'Home',
        team_name: 'Wolves',
        code: 'HOM',
        logo: null,
        logo_dark: null,
        logo_light: null,
        primary_color: '#333333',
        secondary_color: '#444444',
        text_color: '#ffffff',
      },
    ];
    mockUseQuery.mockImplementation(({ queryKey }) => {
      if (queryKey?.[0] === 'user-form-seasons') {
        return { data: queryKey[1] ? seasons : [] };
      }
      if (queryKey?.[0] === 'user-form-season-teams') {
        return { data: queryKey[1] ? seasonTeams : [] };
      }
      return { data: [] };
    });
    mockUseLeagues.mockReturnValue({
      leagues: [
        {
          id: 'league-1',
          name: 'Hockey League',
          code: 'HL',
          logo: null,
          icon: null,
          primary_color: '#111111',
          text_color: '#ffffff',
          best_of_playoff: 5,
          best_of_shootout: 3,
          scoring_system: '2-1-0',
          playoff_format: null,
        },
      ],
    });
    render(
      <ScoreImageModal
        open
        onClose={jest.fn()}
        overtimeSuffix=""
        showForm
      />,
    );

    expect(screen.queryByPlaceholderText('e.g. Quarterfinals')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Playoff Game' })).not.toBeInTheDocument();
    const previewButton = screen.getByRole('button', { name: 'Preview Image' });
    expect(previewButton).toBeDisabled();
    expect(screen.getByText('Last Period')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Playoff Game' })).toBeDisabled();
    expect(screen.getByLabelText(/Game Date/)).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Away Score')).toBeDisabled();
    expect(screen.getByLabelText('Home Score')).toBeDisabled();
    expect(screen.getByLabelText('Away Score')).toHaveDisplayValue('');
    expect(screen.getByLabelText('Away Score')).toHaveAttribute('placeholder', '0');
    expect(screen.getByLabelText('Home Score')).toHaveDisplayValue('');
    expect(screen.getByLabelText('Home Score')).toHaveAttribute('placeholder', '0');
    expect(screen.getByRole('button', { name: 'Regular' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'OT' })).toBeDisabled();
    const downloadButton = screen.getByRole('button', { name: 'Download Image' });
    expect(downloadButton).toBeDisabled();

    await user.click(screen.getAllByRole('combobox')[0]);
    const leagueOption = await screen.findByRole('option', { name: /Hockey League/ });
    await user.click(within(leagueOption).getByRole('button'));

    const playoffToggle = screen.getByRole('checkbox', { name: 'Playoff Game' });
    await waitFor(() => expect(playoffToggle).not.toBeDisabled());
    expect(screen.getByText(/2025-26/)).toBeInTheDocument();
    expect(downloadButton).toBeDisabled();

    await user.click(screen.getAllByPlaceholderText('— Select team —')[0]);
    const awayOption = await screen.findByRole('option', { name: /Away Bears/ });
    await user.click(within(awayOption).getByRole('button'));
    await user.click(screen.getAllByPlaceholderText('— Select team —')[1]);
    const homeOption = await screen.findByRole('option', { name: /Home Wolves/ });
    await user.click(within(homeOption).getByRole('button'));
    await user.click(screen.getByRole('button', { name: 'Open calendar' }));
    await user.click(screen.getByRole('button', { name: 'Today' }));

    expect(downloadButton).toBeDisabled();
    expect(screen.getByLabelText('Away Score')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Home Score')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText("Can't be tied with home.")).not.toBeInTheDocument();
    expect(screen.queryByText("Can't be tied with away.")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Away Score'), '0');
    expect(screen.getByText("Can't be tied with home.")).toBeInTheDocument();
    expect(screen.getByText("Can't be tied with away.")).toBeInTheDocument();
    expect(screen.getByLabelText('Away Score')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Home Score')).toHaveAttribute('aria-invalid', 'true');
    await user.type(screen.getByLabelText('Home Score'), '3');
    await waitFor(() =>
      expect(screen.queryByText("Can't be tied with home.")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Can't be tied with away.")).not.toBeInTheDocument();

    await waitFor(() => expect(downloadButton).not.toBeDisabled());
    expect(previewButton).not.toBeDisabled();

    await user.click(previewButton);
    expect(await screen.findByAltText('Generated score card preview')).toHaveAttribute(
      'src',
      'data:image/png;base64,test',
    );
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByAltText('Generated score card preview')).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'SO' }));

    expect(screen.getByTitle('Final in SO')).toBeInTheDocument();

    await user.click(playoffToggle);

    expect(screen.getByRole('region', { name: 'Playoff Game' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SO' })).not.toBeInTheDocument();
    expect(screen.queryByText('Playoff Details')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. Quarterfinals')).not.toBeInTheDocument();
    expect((await screen.findAllByText('Opening Matchup')).length).toBeGreaterThan(0);
    await user.click(screen.getAllByText('Opening Matchup')[0]);
    expect(await screen.findByRole('option', { name: /Finals/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Round 3/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^Final$/ })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByLabelText(/Game #/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Game #/)).toHaveAttribute('max', '5');
    expect(screen.getByLabelText(/Away Wins/)).toHaveAttribute('max', '3');
    expect(screen.getByLabelText(/Home Wins/)).toHaveAttribute('max', '3');
    expect(screen.getByLabelText(/Away Wins/)).toHaveDisplayValue('');
    expect(screen.getByLabelText(/Away Wins/)).toHaveAttribute('placeholder', '0');
    expect(screen.getByLabelText(/Home Wins/)).toHaveDisplayValue('');
    expect(screen.getByLabelText(/Home Wins/)).toHaveAttribute('placeholder', '0');
    await user.clear(screen.getByLabelText(/Game #/));
    await user.type(screen.getByLabelText(/Game #/), '8');
    expect(screen.getByText('Must not exceed 5.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Game #/));
    await user.type(screen.getByLabelText(/Game #/), '3');
    expect(await screen.findAllByText('Must add up to Game #.')).toHaveLength(2);
    await user.type(screen.getByLabelText(/Away Wins/), '1');
    await user.type(screen.getByLabelText(/Home Wins/), '1');
    expect(screen.getAllByText('Must add up to Game #.')).toHaveLength(2);
    await user.clear(screen.getByLabelText(/Home Wins/));
    await user.type(screen.getByLabelText(/Home Wins/), '2');
    await waitFor(() =>
      expect(screen.queryByText('Must add up to Game #.')).not.toBeInTheDocument(),
    );
    expect(downloadButton).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'OT' }));

    expect(screen.getByTitle('Final in OT')).toBeInTheDocument();

    await user.click(playoffToggle);

    expect(screen.queryByRole('region', { name: 'Playoff Game' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SO' })).toBeInTheDocument();
  });

  it('clears game form values when the selected league changes', async () => {
    const user = userEvent.setup();
    const seasonsByLeague = {
      'league-1': [
        {
          id: 'season-1',
          name: '2025-26',
          start_date: '2025-10-01',
          created_at: '2025-09-01T00:00:00Z',
          is_current: true,
          best_of_playoff: null,
          league_best_of_playoff: 7,
          bracket_rule_set_id: 'rule-set-1',
          playoff_round_names: { 1: 'Round 1', 2: 'Finals' },
          playoff_matchup_names: null,
        },
      ],
      'league-2': [
        {
          id: 'season-2',
          name: '2026-27',
          start_date: '2026-10-01',
          created_at: '2026-09-01T00:00:00Z',
          is_current: true,
          best_of_playoff: null,
          league_best_of_playoff: 5,
          bracket_rule_set_id: 'rule-set-2',
          playoff_round_names: { 1: 'Semifinals', 2: 'Finals' },
          playoff_matchup_names: null,
        },
      ],
    };
    const teamsBySeason = {
      'season-1': [
        {
          id: 'team-away',
          league_id: 'league-1',
          name: 'Away Bears',
          place_name: 'Away',
          team_name: 'Bears',
          code: 'AWY',
          logo: null,
          logo_dark: null,
          logo_light: null,
          primary_color: '#111111',
          secondary_color: '#222222',
          text_color: '#ffffff',
        },
        {
          id: 'team-home',
          league_id: 'league-1',
          name: 'Home Wolves',
          place_name: 'Home',
          team_name: 'Wolves',
          code: 'HOM',
          logo: null,
          logo_dark: null,
          logo_light: null,
          primary_color: '#333333',
          secondary_color: '#444444',
          text_color: '#ffffff',
        },
      ],
      'season-2': [
        {
          id: 'team-other-away',
          league_id: 'league-2',
          name: 'Other Falcons',
          place_name: 'Other',
          team_name: 'Falcons',
          code: 'OTF',
          logo: null,
          logo_dark: null,
          logo_light: null,
          primary_color: '#555555',
          secondary_color: '#666666',
          text_color: '#ffffff',
        },
      ],
    };
    mockUseQuery.mockImplementation(({ queryKey }) => {
      if (queryKey?.[0] === 'user-form-seasons') {
        return { data: seasonsByLeague[queryKey[1] as keyof typeof seasonsByLeague] ?? [] };
      }
      if (queryKey?.[0] === 'user-form-season-teams') {
        return { data: teamsBySeason[queryKey[1] as keyof typeof teamsBySeason] ?? [] };
      }
      return { data: [] };
    });
    mockUseLeagues.mockReturnValue({
      leagues: [
        {
          id: 'league-1',
          name: 'Hockey League',
          code: 'HL',
          logo: null,
          icon: null,
          primary_color: '#111111',
          text_color: '#ffffff',
          best_of_playoff: 7,
          best_of_shootout: 3,
          scoring_system: '2-1-0',
          playoff_format: null,
        },
        {
          id: 'league-2',
          name: 'Other League',
          code: 'OL',
          logo: null,
          icon: null,
          primary_color: '#222222',
          text_color: '#ffffff',
          best_of_playoff: 5,
          best_of_shootout: 3,
          scoring_system: '2-1-0',
          playoff_format: null,
        },
      ],
    });

    render(
      <ScoreImageModal
        open
        onClose={jest.fn()}
        showForm
      />,
    );

    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(within(await screen.findByRole('option', { name: /Hockey League/ })).getByRole('button'));
    await waitFor(() => expect(screen.getByText(/2025-26/)).toBeInTheDocument());
    await user.click(screen.getAllByPlaceholderText('— Select team —')[0]);
    await user.click(within(await screen.findByRole('option', { name: /Away Bears/ })).getByRole('button'));
    await user.click(screen.getAllByPlaceholderText('— Select team —')[1]);
    await user.click(within(await screen.findByRole('option', { name: /Home Wolves/ })).getByRole('button'));
    await user.click(screen.getByRole('button', { name: 'Open calendar' }));
    await user.click(screen.getByRole('button', { name: 'Today' }));
    await user.type(screen.getByLabelText('Away Score'), '1');
    await user.type(screen.getByLabelText('Home Score'), '2');
    await user.click(screen.getByRole('button', { name: 'OT' }));
    await user.click(screen.getByRole('checkbox', { name: 'Playoff Game' }));

    expect(screen.getByRole('region', { name: 'Playoff Game' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(within(await screen.findByRole('option', { name: /Other League/ })).getByRole('button'));

    await waitFor(() => expect(screen.getByText(/2026-27/)).toBeInTheDocument());
    expect(screen.queryByText('Away Bears')).not.toBeInTheDocument();
    expect(screen.queryByText('Home Wolves')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Game Date/)).toHaveDisplayValue('MM/DD/YYYY');
    expect(screen.getByLabelText('Away Score')).toHaveDisplayValue('');
    expect(screen.getByLabelText('Home Score')).toHaveDisplayValue('');
    expect(screen.queryByRole('region', { name: 'Playoff Game' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regular' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SO' })).toBeInTheDocument();
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
    expect(mockToPng.mock.calls[0][0].querySelector('footer')).toHaveAttribute(
      'data-theme',
      'light',
    );
    expect(within(mockToPng.mock.calls[0][0]).getByText('1')).toHaveClass(
      'scoreCardLosingScore',
    );
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

  it('uses league code, playoffs, game year, and matchup label for playoff games', () => {
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
            playoff_matchup_names: { r1m0: 'Eastern Final' },
            bracket_slot_key: 'r1m0',
          } as Partial<GameRecord> as GameRecord
        }
        liveAwayScore={1}
        liveHomeScore={2}
      />,
    );

    expect(screen.getAllByText('HL').length).toBeGreaterThan(0);
    expect(screen.getByText('Playoffs 2026')).toBeInTheDocument();
    expect(screen.getByText('Eastern Final')).toBeInTheDocument();
    expect(screen.queryByText('Finals')).not.toBeInTheDocument();
  });
});
