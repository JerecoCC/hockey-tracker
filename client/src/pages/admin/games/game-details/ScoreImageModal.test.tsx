import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import useLeagues from '@/hooks/useLeagues';
import useTeams from '@/hooks/useTeams';
import ScoreImageModal from './ScoreImageModal';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@/hooks/useLeagues', () => jest.fn());
jest.mock('@/hooks/useTeams', () => jest.fn());

const mockUseQuery = useQuery as jest.Mock;
const mockUseLeagues = useLeagues as jest.Mock;
const mockUseTeams = useTeams as jest.Mock;

beforeAll(() => {
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
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: [] });
  mockUseLeagues.mockReturnValue({ leagues: [] });
  mockUseTeams.mockReturnValue({ teams: [] });
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
    const mockContext = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      globalAlpha: 1,
      beginPath: jest.fn(),
      closePath: jest.fn(),
      clip: jest.fn(),
      rect: jest.fn(),
      drawImage: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      fillText: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      arc: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
      measureText: jest.fn(() => ({ width: 120 })),
    } as unknown as CanvasRenderingContext2D;

    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockContext);
    jest
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,test');

    const originalCreateElement = document.createElement.bind(document);
    const clickMock = jest.fn();
    let createdAnchor: HTMLAnchorElement | null = null;
    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (String(tagName).toLowerCase() === 'a') {
        createdAnchor = element as HTMLAnchorElement;
        Object.defineProperty(element, 'click', { value: clickMock });
      }
      return element;
    });

    render(
      <ScoreImageModal
        open
        onClose={jest.fn()}
        game={
          {
            away_team: {
              id: 'team-away',
              name: 'Away',
              code: 'AWY',
              logo: null,
              primary_color: '#111111',
              secondary_color: '#222222',
              text_color: '#ffffff',
            },
            home_team: {
              id: 'team-home',
              name: 'Home',
              code: 'HOM',
              logo: null,
              primary_color: '#333333',
              secondary_color: '#444444',
              text_color: '#ffffff',
            },
            scheduled_at: '2026-03-05T19:00:00Z',
            game_type: 'regular',
            series_games_to_win: null,
            series_home_wins: null,
            series_away_wins: null,
            series_home_team_id: null,
            game_number_in_series: null,
            playoff_round: null,
            playoff_round_names: null,
          } as any
        }
        liveAwayScore={1}
        liveHomeScore={2}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Download Image' }));

    await waitFor(() => expect(clickMock).toHaveBeenCalled());
    expect(createdAnchor?.download).toBe('AWY vs HOM - 2026-03-05.png');
  });
});
