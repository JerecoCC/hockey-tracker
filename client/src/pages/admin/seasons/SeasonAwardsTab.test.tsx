import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useSeasonAwards, {
  type SeasonAwardRecipient,
  type SeasonAwardRecord,
} from '@/hooks/useSeasonAwards';
import SeasonAwardsTab from './SeasonAwardsTab';

jest.mock('@/hooks/useSeasonAwards', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseSeasonAwards = useSeasonAwards as jest.Mock;

const skater = {
  player_id: 'player-1',
  first_name: 'John',
  last_name: 'Smith',
  photo: null,
  position: 'C',
  jersey_number: 19,
  team_id: 'team-1',
  team_code: 'TOR',
  team_name: 'Toronto',
  team_logo: null,
  team_primary_color: '#003e7e',
  team_text_color: '#ffffff',
  gp: 10,
  goals: 4,
  assists: 6,
  points: 10,
};

const team = {
  id: 'team-1',
  name: 'Toronto',
  code: 'TOR',
  logo: null,
  primary_color: '#003e7e',
  text_color: '#ffffff',
  secondary_color: '#ffffff',
  home_arena: null,
  inherited: false,
};

const makeAward = (overrides: Partial<SeasonAwardRecord> = {}): SeasonAwardRecord => ({
  award_id: 'award-1',
  league_id: 'league-1',
  name: 'Ilana Kloss Playoff MVP',
  description: null,
  recipient_type: 'player',
  selection_method: 'voted',
  stat_key: null,
  awarded_after_playoffs: true,
  uses_nominees: false,
  allow_multiple_winners: false,
  sort_order: 0,
  season_award_id: 'season-award-1',
  awarded_at: null,
  season_notes: null,
  recipients: [],
  ...overrides,
});

const makeWinner = (
  id: string,
  playerId: string,
  playerName: string,
): SeasonAwardRecipient => ({
  id,
  recipient_type: 'player',
  player_id: playerId,
  team_id: null,
  role: 'winner',
  rank: null,
  vote_points: null,
  stat_value: null,
  notes: null,
  player_name: playerName,
  player_photo: null,
  position: 'C',
  jersey_number: 19,
  team_name: 'Toronto',
  team_code: 'TOR',
  team_logo: null,
  team_primary_color: '#003e7e',
  team_text_color: '#ffffff',
});

const renderTab = (award: SeasonAwardRecord, addRecipient = jest.fn(async () => true)) => {
  mockUseSeasonAwards.mockReturnValue({
    awards: [award],
    loading: false,
    updateTrackedAwards: jest.fn(async () => true),
    addRecipient,
    deleteRecipient: jest.fn(async () => true),
    refresh: jest.fn(),
  });

  return render(
    <SeasonAwardsTab
      seasonId="season-1"
      seasonTeams={[team]}
      skaters={[skater]}
      goalies={[]}
      standings={[]}
    />,
  );
};

describe('SeasonAwardsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.scrollTo = jest.fn();
  });

  it('does not require nominees when the award definition has nominees disabled', () => {
    const { container } = renderTab(makeAward());

    expect(screen.queryByRole('button', { name: 'Nominees' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Award Player' })).toBeEnabled();
    expect(screen.queryByText('No nominees recorded.')).not.toBeInTheDocument();
    expect(container.querySelector('.awardContentInnerNoNominees')).toBeInTheDocument();
  });

  it('renders multiple winners without nominees as a single-column player list', () => {
    const { container } = renderTab(
      makeAward({
        allow_multiple_winners: true,
        recipients: [
          makeWinner('winner-1', 'player-1', 'John Smith'),
          makeWinner('winner-2', 'player-2', 'Jane Smith'),
        ],
      }),
    );

    expect(container.querySelector('.awardPlayerListColumn')).toBeInTheDocument();
    expect(container.querySelector('.awardWinnerCards')).not.toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('fills the single-winner nominee select with the current winner', async () => {
    const user = userEvent.setup();
    renderTab(
      makeAward({
        uses_nominees: true,
        recipients: [
          {
            ...makeWinner('nominee-1', 'player-1', 'John Smith'),
            role: 'nominee',
          },
          makeWinner('winner-1', 'player-1', 'John Smith'),
        ],
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Award Player' }));

    expect(screen.getByDisplayValue('John Smith')).toBeInTheDocument();
  });

  it('uses the checklist winner flow for multiple-winner awards without nominees', async () => {
    const user = userEvent.setup();
    const addRecipient = jest.fn(async () => true);
    renderTab(makeAward({ allow_multiple_winners: true }), addRecipient);

    await user.click(screen.getByRole('button', { name: 'Award Player' }));
    expect(screen.getByPlaceholderText('Search recipients...')).toBeInTheDocument();

    await user.click(screen.getByText('John Smith'));
    await user.click(screen.getByRole('button', { name: 'Save Winners' }));

    expect(addRecipient).toHaveBeenCalledWith(
      'season-award-1',
      {
        recipient_type: 'player',
        player_id: 'player-1',
        team_id: null,
        role: 'winner',
      },
      {
        silent: true,
        refresh: false,
      },
    );
  });
});
