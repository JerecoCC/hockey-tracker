import { render, screen } from '@testing-library/react';
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
});