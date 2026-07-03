import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import type { GroupAlignmentSet } from '@/hooks/useGroupAlignmentSets';
import type { GroupTeamRecord } from '@/hooks/useLeagueGroups';
import type { SeasonGroupRecord, SeasonTeam } from '@/hooks/useSeasonDetails';
import SeasonTeamsCard from './SeasonTeamsCard';

type SeasonTeamsCardProps = ComponentProps<typeof SeasonTeamsCard>;

const makeTeam = (
  id: string,
  placeName: string,
  teamName: string,
  code: string,
): GroupTeamRecord => ({
  id,
  name: `${placeName} ${teamName}`,
  place_name: placeName,
  team_name: teamName,
  code,
  logo: null,
  logo_dark: null,
  logo_light: null,
  primary_color: '#123456',
  text_color: '#ffffff',
  home_arena: null,
});

const makeSeasonTeam = (
  id: string,
  placeName: string,
  teamName: string,
  code: string,
): SeasonTeam => ({
  ...makeTeam(id, placeName, teamName, code),
  secondary_color: '#abcdef',
  inherited: false,
});

const makeGroup = (
  id: string,
  name: string,
  role: SeasonGroupRecord['role'],
  parentId: string | null,
  teams: GroupTeamRecord[] = [],
): SeasonGroupRecord => ({
  id,
  league_id: 'league-1',
  stable_key: null,
  parent_id: parentId,
  name,
  sort_order: 0,
  created_at: '',
  role,
  teams,
  has_season_override: false,
  is_inherited: false,
  is_auto: false,
});

const makeAlignmentSet = (
  id: string,
  structureType: GroupAlignmentSet['structure_type'],
): GroupAlignmentSet => ({
  id,
  league_id: 'league-1',
  name: structureType === 'groups' ? 'League Groups' : 'League Wide',
  structure_type: structureType,
  created_at: '',
});

const defaultProps: SeasonTeamsCardProps = {
  seasonId: 'season-1',
  seasonName: '2024-25',
  leagueId: 'league-1',
  leagueCode: 'NHL',
  groups: [],
  seasonTeams: [],
  alignmentSets: [makeAlignmentSet('align-groups', 'groups')],
  fetchAlignmentSet: jest.fn(),
  loading: false,
  busy: null,
  isEnded: false,
  hasScheduledGames: false,
  groupAlignmentSetId: 'align-groups',
  updateSeason: jest.fn(),
};

const renderCard = (overrides: Partial<SeasonTeamsCardProps> = {}) =>
  render(
    <MemoryRouter>
      <SeasonTeamsCard
        {...defaultProps}
        {...overrides}
      />
    </MemoryRouter>,
  );

describe('SeasonTeamsCard', () => {
  it('renders group parents as alignment parent rows and subgroup teams in the grid list', () => {
    const wolves = makeTeam('team-1', 'Seattle', 'Wolves', 'SEA');
    const bears = makeTeam('team-2', 'Boston', 'Bears', 'BOS');
    const groups = [
      makeGroup('east', 'Eastern', 'conference', null),
      makeGroup('metro', 'Metropolitan', 'division', 'east', [wolves, bears]),
    ];
    const { container } = renderCard({ groups });

    expect(screen.getByRole('heading', { name: 'Team Groups' })).toBeInTheDocument();

    const rootItem = container.querySelector('.groupList > .groupItem');
    const parentGroup = rootItem?.firstElementChild;
    expect(parentGroup).toHaveClass('alignmentParentGroup');
    expect(parentGroup).not.toHaveClass('accordion');
    expect(parentGroup?.querySelector('.alignmentParentGroupHeader')).toHaveTextContent(
      'Eastern Conference (2 teams)',
    );
    expect(
      parentGroup?.querySelector('.alignmentParentGroupHeaderDivider.divider.horizontal'),
    ).toBeInTheDocument();

    expect(container.querySelectorAll('.accordion')).toHaveLength(1);
    const subgroupAccordion = container.querySelector('.accordion');
    expect(subgroupAccordion).toHaveTextContent('Metropolitan');
    expect(parentGroup?.querySelector('.groupSubgroupList')).toBeInTheDocument();

    const teamList = subgroupAccordion?.querySelector('.teamList');
    expect(teamList).toBeInTheDocument();
    expect(Array.from(teamList?.children ?? [])).toHaveLength(2);
    expect(container.querySelector('.groupTeamList')).not.toBeInTheDocument();
  });

  it('keeps league-wide alignment teams on the same grid list', () => {
    const teams = [
      makeSeasonTeam('team-1', 'Seattle', 'Wolves', 'SEA'),
      makeSeasonTeam('team-2', 'Boston', 'Bears', 'BOS'),
    ];
    const { container } = renderCard({
      alignmentSets: [makeAlignmentSet('align-league', 'league')],
      groupAlignmentSetId: 'align-league',
      seasonTeams: teams,
    });

    const teamList = container.querySelector('.teamList');
    expect(screen.getByRole('heading', { name: 'Teams' })).toBeInTheDocument();
    expect(teamList).toBeInTheDocument();
    expect(Array.from(teamList?.children ?? [])).toHaveLength(2);
  });
});
