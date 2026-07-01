import { render, screen, waitFor } from '@testing-library/react';
import useTeamHistory from '@/hooks/useTeamHistory';
import TeamHistoryTab from './TeamHistoryTab';

jest.mock('@/hooks/useTeamHistory', () => jest.fn());

const mockUseTeamHistory = useTeamHistory as jest.Mock;

const defaultHistoryState = {
  iterations: [],
  isLoading: false,
  busy: false,
  addIteration: jest.fn(),
  updateIteration: jest.fn(),
  deleteIteration: jest.fn(),
};

const renderTeamHistoryTab = () =>
  render(
    <TeamHistoryTab
      teamId="team-1"
      leagueId={null}
      teamName="Toronto Maple Leafs"
      teamPlaceName="Toronto"
      teamNickname="Maple Leafs"
      teamCode="TOR"
      teamLogoDark={null}
      teamLogoLight={null}
      teamIcon={null}
      primaryColor="#00205b"
      textColor="#ffffff"
      uploadLogo={jest.fn()}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTeamHistory.mockReturnValue(defaultHistoryState);
});

describe('TeamHistoryTab', () => {
  it('renders list item skeleton loaders while team history is loading', async () => {
    mockUseTeamHistory.mockReturnValue({
      ...defaultHistoryState,
      isLoading: true,
    });

    const { container } = renderTeamHistoryTab();

    expect(await screen.findByLabelText('Team history loading')).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll('.listSkeletonRow')).toHaveLength(3));
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });
});
