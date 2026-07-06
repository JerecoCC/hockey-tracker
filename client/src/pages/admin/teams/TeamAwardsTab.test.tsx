import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTeamAwards } from '@/hooks/useTeamDetails';
import TeamAwardsTab from './TeamAwardsTab';

jest.mock('@/hooks/useTeamDetails', () => ({
  __esModule: true,
  useTeamAwards: jest.fn(),
}));

const mockUseTeamAwards = useTeamAwards as jest.Mock;

const awards = [
  {
    id: 'recipient-1',
    award_id: 'award-1',
    season_award_id: 'season-award-1',
    award_name: 'Presidents Trophy',
    competition_scope: 'regular_season',
    stat_key: null,
    season_id: 'season-1',
    season_name: '2025-26',
    awarded_at: '2026-04-20',
    team_id: 'team-1',
    team_name: 'Toronto Maple Leafs',
    team_place_name: 'Toronto',
    team_team_name: 'Maple Leafs',
    team_code: 'TOR',
    team_logo: null,
    team_logo_dark: null,
    team_logo_light: null,
    team_primary_color: '#003e7e',
    team_secondary_color: '#b9975b',
    team_text_color: '#ffffff',
  },
  {
    id: 'recipient-2',
    award_id: 'award-2',
    season_award_id: 'season-award-2',
    award_name: 'Walter Cup Winner',
    competition_scope: 'playoffs',
    stat_key: 'playoff_champion',
    season_id: 'season-2',
    season_name: '2024-25',
    awarded_at: null,
    team_id: 'team-1',
    team_name: 'Toronto Maple Leafs',
    team_place_name: 'Toronto',
    team_team_name: 'Maple Leafs',
    team_code: 'TOR',
    team_logo: null,
    team_logo_dark: null,
    team_logo_light: null,
    team_primary_color: '#003e7e',
    team_secondary_color: '#b9975b',
    team_text_color: '#ffffff',
  },
];

describe('TeamAwardsTab', () => {
  beforeEach(() => {
    mockUseTeamAwards.mockReturnValue({ awards, loading: false });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders team awards grouped by award and switches to championship banner view', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TeamAwardsTab
        teamId="team-1"
        mode="user"
      />,
    );

    expect(mockUseTeamAwards).toHaveBeenCalledWith('team-1', { mode: 'user' });
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('data-active', 'true');
    expect(screen.getByText('Presidents Trophy')).toBeInTheDocument();
    expect(screen.getByText('Walter Cup Winner')).toBeInTheDocument();
    expect(screen.getAllByLabelText('1 win')).toHaveLength(2);
    expect(screen.getByText(/Awarded Apr 20, 2026/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Banner' }));

    expect(screen.getByRole('button', { name: 'Banner' })).toHaveAttribute('data-active', 'true');
    expect(container.querySelector('.awardGroup')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.awardArenaBanner')).toHaveLength(2);
    const regularBanner = screen.getByText('Presidents Trophy').closest('.awardArenaBanner');
    expect(regularBanner).not.toBeNull();
    expect(regularBanner as HTMLElement).not.toHaveClass('awardArenaBannerChampionship');
    expect((regularBanner as HTMLElement).style.getPropertyValue('--award-banner-color')).toBe(
      '#003e7e',
    );
    expect(
      (regularBanner as HTMLElement).style.getPropertyValue('--award-banner-secondary-color'),
    ).toBe('#b9975b');
    expect((regularBanner as HTMLElement).style.getPropertyValue('--award-banner-text-color')).toBe(
      '#ffffff',
    );
    expect(
      within(regularBanner as HTMLElement).queryByText('Champions'),
    ).not.toBeInTheDocument();
    expect(
      (regularBanner as HTMLElement).querySelector('.awardBannerPanel')?.lastElementChild,
    ).toHaveTextContent('2025-26');
    expect(within(regularBanner as HTMLElement).getByText('Toronto')).toHaveClass(
      'awardBannerTeamPlace',
    );
    expect(within(regularBanner as HTMLElement).getByText('Maple Leafs')).toHaveClass(
      'awardBannerTeamName',
    );

    const championshipBanner = screen.getByText('Walter Cup Winner').closest('.awardArenaBanner');
    expect(championshipBanner).not.toBeNull();
    expect(championshipBanner as HTMLElement).toHaveClass('awardArenaBannerChampionship');
    expect(within(championshipBanner as HTMLElement).getByText('Champions')).toBeInTheDocument();
  });
});
