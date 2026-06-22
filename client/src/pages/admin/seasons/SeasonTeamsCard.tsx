import Accordion from '@/components/Accordion/Accordion';
import Card from '@/components/Card/Card';
import GroupTeamCount from '@/components/GroupTeamCount/GroupTeamCount';
import ListItem from '@/components/ListItem/ListItem';
import Select from '@/components/Select/Select';
import { type GroupAlignmentSet } from '@/hooks/useGroupAlignmentSets';
import { type GroupTeamRecord } from '@/hooks/useLeagueGroups';
import { type SeasonGroupRecord, type SeasonTeam } from '@/hooks/useSeasonDetails';
import { type CreateSeasonData } from '@/hooks/useSeasons';
import { buildTeamDetailsPath } from '@/lib/routeSlugs';
import styles from './SeasonTeamsCard.module.scss';

const ROLE_LABELS: Record<string, string> = { conference: 'Conference', division: 'Division' };

const countGroupTeams = (group: SeasonGroupRecord, allGroups: SeasonGroupRecord[]) => {
  const teamIds = new Set<string>();
  const collect = (current: SeasonGroupRecord) => {
    current.teams.forEach((team) => teamIds.add(team.id));
    allGroups
      .filter((candidate) => candidate.parent_id === current.id)
      .forEach((child) => collect(child));
  };

  collect(group);
  return teamIds.size;
};

interface GroupNodeProps {
  group: SeasonGroupRecord;
  allGroups: SeasonGroupRecord[];
  leagueCode: string | null | undefined;
  seasonId: string;
  seasonName: string | null | undefined;
}

const GroupNode = ({ group, allGroups, leagueCode, seasonId, seasonName }: GroupNodeProps) => {
  const children = allGroups
    .filter((g) => g.parent_id === group.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const roleLabel = group.role ? ROLE_LABELS[group.role] : null;
  const isLeaf = children.length === 0;
  const teamCount = countGroupTeams(group, allGroups);

  return (
    <li className={styles.groupItem}>
      <Accordion
        label={
          <span className={styles.groupLabel}>
            {group.name}
            {roleLabel && (
              <span
                className={`${styles.groupRoleBadge} ${styles[`groupRoleBadge_${group.role}`]}`}
              >
                {roleLabel}
              </span>
            )}
          </span>
        }
        headerRight={<GroupTeamCount count={teamCount} />}
      >
        {isLeaf && group.teams.length > 0 && (
          <ul className={styles.teamList}>
            {group.teams.map((team) => (
              <ListItem
                key={team.id}
                image={team.logo}
                eyebrow={team.place_name || ''}
                name={team.team_name || team.name}
                variant="plain"
                rightContent={{ type: 'code', value: team.code }}
                primaryColor={team.primary_color}
                textColor={team.text_color}
                href={buildTeamDetailsPath({
                  leagueCode,
                  leagueId: group.league_id,
                  teamCode: team.code,
                  teamId: team.id,
                  seasonName,
                  seasonId,
                })}
              />
            ))}
          </ul>
        )}
        {isLeaf && group.teams.length === 0 && (
          <p className={styles.emptyMsg}>No teams assigned to this group.</p>
        )}
        {children.length > 0 && (
          <div className={styles.groupNestedList}>
            <ul className={styles.groupList}>
              {children.map((child) => (
                <GroupNode
                  key={child.id}
                  group={child}
                  allGroups={allGroups}
                  leagueCode={leagueCode}
                  seasonId={seasonId}
                  seasonName={seasonName}
                />
              ))}
            </ul>
          </div>
        )}
      </Accordion>
    </li>
  );
};

interface TeamListProps {
  teams: TeamDisplayRecord[];
  leagueCode: string | null | undefined;
  leagueId: string;
  seasonId: string;
  seasonName: string | null | undefined;
}

type TeamDisplayRecord = Pick<
  SeasonTeam | GroupTeamRecord,
  'id' | 'name' | 'place_name' | 'team_name' | 'code' | 'logo' | 'primary_color' | 'text_color'
>;

const TeamList = ({ teams, leagueCode, leagueId, seasonId, seasonName }: TeamListProps) => (
  <ul className={styles.teamList}>
    {teams.map((team) => (
      <ListItem
        key={team.id}
        image={team.logo}
        eyebrow={team.place_name || ''}
        name={team.team_name || team.name}
        variant="plain"
        rightContent={{ type: 'code', value: team.code }}
        primaryColor={team.primary_color}
        textColor={team.text_color}
        href={buildTeamDetailsPath({
          leagueCode,
          leagueId,
          teamCode: team.code,
          teamId: team.id,
          seasonName,
          seasonId,
        })}
      />
    ))}
  </ul>
);

interface Props {
  seasonId: string;
  seasonName: string | null | undefined;
  leagueId: string;
  leagueCode: string | null | undefined;
  groups: SeasonGroupRecord[];
  seasonTeams: SeasonTeam[];
  alignmentSets: GroupAlignmentSet[];
  loading: boolean;
  busy: string | null;
  isEnded: boolean;
  hasScheduledGames: boolean;
  groupAlignmentSetId: string | null;
  updateSeason: (id: string, payload: Partial<CreateSeasonData>) => Promise<boolean>;
}

const SeasonTeamsCard = ({
  seasonId,
  seasonName,
  leagueId,
  leagueCode,
  groups,
  seasonTeams,
  alignmentSets,
  loading,
  busy,
  isEnded,
  hasScheduledGames,
  groupAlignmentSetId,
  updateSeason,
}: Props) => {
  const userGroups = groups.filter((group) => !group.is_auto);
  const userRoots = userGroups
    .filter((group) => group.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const autoGroup = groups.find((group) => group.is_auto);
  const flatTeams: TeamDisplayRecord[] = autoGroup?.teams.length ? autoGroup.teams : seasonTeams;
  const selectedAlignment = alignmentSets.find((set) => set.id === groupAlignmentSetId) ?? null;
  const alignmentOptions = alignmentSets.map((set) => ({
    value: set.id,
    label: set.structure_type === 'league' ? `${set.name} (league-wide)` : set.name,
  }));
  const alignmentLocked = isEnded || hasScheduledGames;
  const alignmentLabel = selectedAlignment
    ? selectedAlignment.structure_type === 'league'
      ? `${selectedAlignment.name} (league-wide)`
      : selectedAlignment.name
    : 'No alignment assigned';
  const alignmentControl = (
    <div className={styles.alignmentHeaderControl}>
      {alignmentLocked ? (
        <div
          className={styles.readonlyAlignmentBox}
          title={
            hasScheduledGames
              ? 'Alignment cannot be changed after games are scheduled.'
              : 'Alignment cannot be changed after the season ends.'
          }
        >
          {alignmentLabel}
        </div>
      ) : (
        <Select
          value={groupAlignmentSetId}
          options={alignmentOptions}
          placeholder={
            alignmentSets.length === 0
              ? 'No alignment sets - create one in the league Alignments tab'
              : 'Select an alignment set...'
          }
          onChange={async (value) => {
            await updateSeason(seasonId, {
              group_alignment_set_id: value,
            });
          }}
          disabled={busy === 'update' || alignmentSets.length === 0}
        />
      )}
    </div>
  );

  return (
    <Card
      title={selectedAlignment?.structure_type === 'groups' ? 'Team Groups' : 'Teams'}
      action={alignmentControl}
    >
      {loading ? (
        <p className={styles.emptyMsg}>Loading...</p>
      ) : userRoots.length > 0 ? (
        <ul className={styles.groupList}>
          {userRoots.map((group) => (
            <GroupNode
              key={group.id}
              group={group}
              allGroups={userGroups}
              leagueCode={leagueCode}
              seasonId={seasonId}
              seasonName={seasonName}
            />
          ))}
        </ul>
      ) : flatTeams.length > 0 ? (
        <TeamList
          teams={flatTeams}
          leagueCode={leagueCode}
          leagueId={leagueId}
          seasonId={seasonId}
          seasonName={seasonName}
        />
      ) : (
        <p className={styles.emptyMsg}>
          {selectedAlignment
            ? 'No teams are defined for this alignment set.'
            : 'Select an alignment set to view this season team structure.'}
        </p>
      )}
    </Card>
  );
};

export default SeasonTeamsCard;
