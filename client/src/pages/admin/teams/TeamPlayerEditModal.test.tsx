import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import TeamPlayerEditModal from './TeamPlayerEditModal';

jest.mock('@/components/Modal/Modal', () => {
  const MockModal = ({ open, title, children }: any) =>
    open ? (
      <div
        role="dialog"
        aria-label={title}
      >
        {children}
      </div>
    ) : null;

  MockModal.displayName = 'MockModal';
  return MockModal;
});

jest.mock('@/components/LogoUpload/LogoUpload', () => () => null);

const player = {
  id: 'player-1',
  league_player_number: '8478402',
  first_name: 'John',
  last_name: 'Smith',
  photo: null,
  date_of_birth: null,
  birth_city: null,
  birth_country: null,
  height_cm: null,
  weight_lbs: null,
  position: 'C',
  shoots: 'L',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  player_team_id: 'player-team-1',
  jersey_number: 12,
  team_id: 'team-1',
  team_name: 'Sharks',
  primary_color: '#006272',
  text_color: '#ffffff',
  is_prospect: false,
} as TeamPlayerRecord;

describe('TeamPlayerEditModal', () => {
  it('does not expose league player number in the edit player form', async () => {
    const updatePlayer = jest.fn().mockResolvedValue(true);
    const updatePlayerTeam = jest.fn().mockResolvedValue(true);

    render(
      <TeamPlayerEditModal
        open
        editTarget={player}
        teamId="team-1"
        seasonId="season-1"
        onClose={jest.fn()}
        updatePlayer={updatePlayer}
        updatePlayerTeam={updatePlayerTeam}
        uploadPlayerPhoto={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText('League Player Number')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/First Name/), { target: { value: 'Jane' } });
    fireEvent.submit(document.getElementById('team-player-edit-form') as HTMLFormElement);

    await waitFor(() => expect(updatePlayer).toHaveBeenCalled());
    expect(updatePlayer.mock.calls[0][1]).not.toHaveProperty('league_player_number');
  });
});
