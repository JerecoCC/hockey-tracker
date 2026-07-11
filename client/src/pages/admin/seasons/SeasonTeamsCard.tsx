import { useEffect, useMemo, useState } from 'react';
import Accordion from '@jerecocc/tracker-ui/components/Accordion/Accordion';
import Badge from '@jerecocc/tracker-ui/components/Badge/Badge';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import ListItem from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import SearchableList from '@jerecocc/tracker-ui/components/SearchableList/SearchableList';
import Select from '@jerecocc/tracker-ui/components/Select/Select';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import Tag from '@jerecocc/tracker-ui/components/Tag/Tag';
import Tooltip from '@jerecocc/tracker-ui/components/Tooltip/Tooltip';
import { type AlignmentGroupRecord, type GroupAlignmentSet } from '@/hooks/useGroupAlignmentSets';
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

type TeamDisplayRecord = Pick<
  SeasonTeam | GroupTeamRecord,
  | 'id'
  | 'name'
  | 'place_name'
  | 'team_name'
  | 'code'
  | 'logo'
  | 'logo_dark'
  | 'logo_light'
  | 'primary_color'
  | 'text_color'
>;

const teamMatchesSearch = (team: TeamDisplayRecord, query: string) => {
  const normalizedQuery = query.toLowerCase();
  return [team.name, team.place_name, team.team_name, team.code]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
};

const getLeafGroupTeams = (groups: SeasonGroupRecord[]): TeamDisplayRecord[] => {
  const parentIds = new Set(
    groups.map((group) => group.parent_id).filter((id): id is string => id !== null),
  );
  const teams = groups
    .filter((group) => !parentIds.has(group.id))
    .flatMap((group) => group.teams);

  return Array.from(new Map(teams.map((team) => [team.id, team])).values());
};

const filterGroupsByTeams = (
  groups: SeasonGroupRecord[],
  matchingTeamIds: Set<string>,
): SeasonGroupRecord[] => {
  const childrenByParentId = new Map<string, SeasonGroupRecord[]>();
  groups.forEach((group) => {
    if (!group.parent_id) return;
    const children = childrenByParentId.get(group.parent_id) ?? [];
    children.push(group);
    childrenByParentId.set(group.parent_id, children);
  });

  const keptGroupIds = new Set<string>();
  const keepGroup = (group: SeasonGroupRecord): boolean => {
    const hasMatchingTeam = group.teams.some((team) => matchingTeamIds.has(team.id));
    let hasMatchingChild = false;
    (childrenByParentId.get(group.id) ?? []).forEach((child) => {
      if (keepGroup(child)) hasMatchingChild = true;
    });
    if (hasMatchingTeam || hasMatchingChild) keptGroupIds.add(group.id);
    return hasMatchingTeam || hasMatchingChild;
  };

  groups.filter((group) => group.parent_id === null).forEach(keepGroup);

  return groups
    .filter((group) => keptGroupIds.has(group.id))
    .map((group) => ({
      ...group,
      teams: group.teams.filter((team) => matchingTeamIds.has(team.id)),
    }));
};

interface TeamListProps {
  teams: TeamDisplayRecord[];
  leagueCode: string | null | undefined;
  leagueId: string;
  seasonId: string;
  seasonName: string | null | undefined;
}

const TeamList = ({ teams, leagueCode, leagueId, seasonId, seasonName }: TeamListProps) => (
  <ul className={styles.teamList}>
    {teams.map((team) => {
      const teamHref = buildTeamDetailsPath({
        leagueCode,
        leagueId,
        teamCode: team.code,
        teamId: team.id,
        seasonName,
        seasonId,
      });

      return (
        <ListItem
          key={team.id}
          image={team.logo}
          imageDark={team.logo_dark}
          imageLight={team.logo_light}
          eyebrow={team.place_name || ''}
          name={team.team_name || team.name}
          rightContent={{ type: 'code', value: team.code }}
          primaryColor={team.primary_color}
          textColor={team.text_color}
          href={teamHref}
        />
      );
    })}
  </ul>
);

interface GroupNodeProps {
  group: SeasonGroupRecord;
  allGroups: SeasonGroupRecord[];
  leagueCode: string | null | undefined;
  seasonId: string;
  seasonName: string | null | undefined;
  depth?: number;
}

const GroupNode = ({
  group,
  allGroups,
  leagueCode,
  seasonId,
  seasonName,
  depth = 0,
}: GroupNodeProps) => {
  const children = allGroups
    .filter((g) => g.parent_id === group.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const roleLabel = group.role ? ROLE_LABELS[group.role] : null;
  const isLeaf = children.length === 0;
  const teamCount = countGroupTeams(group, allGroups);
  const teamCountLabel = teamCount === 1 ? 'team' : 'teams';
  const groupName = roleLabel ? `${group.name} ${roleLabel}` : group.name;

  const groupBody = (
    <>
      {isLeaf && group.teams.length > 0 && (
        <TeamList
          teams={group.teams}
          leagueCode={leagueCode}
          leagueId={group.league_id}
          seasonId={seasonId}
          seasonName={seasonName}
        />
      )}
      {isLeaf && group.teams.length === 0 && (
        <p className={styles.emptyMsg}>No teams assigned to this group.</p>
      )}
      {children.length > 0 && (
        <div className={styles.groupNestedList}>
          <ul className={`${styles.groupList} ${styles.groupSubgroupList}`}>
            {children.map((child) => (
              <GroupNode
                key={child.id}
                group={child}
                allGroups={allGroups}
                leagueCode={leagueCode}
                seasonId={seasonId}
                seasonName={seasonName}
                depth={depth + 1}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  );

  return (
    <li className={styles.groupItem}>
      {depth === 0 ? (
        <div className={styles.alignmentParentGroup}>
          <div className={styles.alignmentParentGroupHeader}>
            <div className={styles.alignmentParentGroupTitle}>
              <span className={styles.alignmentParentGroupName}>
                {groupName}
                <Badge
                  className={styles.alignmentGroupNameCount}
                  value={teamCount}
                  label={teamCountLabel}
                />
              </span>
            </div>
            <Divider className={styles.alignmentParentGroupHeaderDivider} />
          </div>
          <div className={styles.alignmentParentGroupBody}>{groupBody}</div>
        </div>
      ) : (
        <Accordion
          headerType="light"
          className={styles.groupAccordion}
          rowClassName={styles.groupHeader}
          bodyClassName={styles.groupBody}
          label={<span className={styles.groupLabel}>{group.name}</span>}
          labelMeta={
            <Badge
              className={styles.groupTeamCount}
              value={teamCount}
              label={teamCountLabel}
            />
          }
          headerRight={
            roleLabel ? (
              <Tag
                label={roleLabel}
                intent={group.role === 'division' ? 'success' : 'accent'}
              />
            ) : null
          }
        >
          {groupBody}
        </Accordion>
      )}
    </li>
  );
};

const alignmentGroupsToSeasonGroups = (
  alignmentGroups: AlignmentGroupRecord[] | undefined,
): SeasonGroupRecord[] =>
  (alignmentGroups ?? []).map((group) => ({
    ...group,
    has_season_override: group.has_season_override ?? false,
    is_inherited: group.is_inherited ?? false,
    is_auto: group.is_auto ?? false,
  }));

const SeasonTeamsSkeleton = () => (
  <ul
    className={styles.skeletonList}
    aria-hidden="true"
  >
    {Array.from({ length: 5 }, (_, index) => (
      <Skeleton
        as="li"
        key={index}
        type="card"
        className={styles.skeletonItem}
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
  fetchAlignmentSet: (alignmentSetId: string) => Promise<GroupAlignmentSet | null>;
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
  fetchAlignmentSet,
  loading,
  busy,
  isEnded,
  hasScheduledGames,
  groupAlignmentSetId,
  updateSeason,
}: Props) => {
  const [draftAlignmentSetId, setDraftAlignmentSetId] = useState<string | null>(
    groupAlignmentSetId,
  );
  const [alignmentDetails, setAlignmentDetails] = useState<Record<string, GroupAlignmentSet>>({});
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    setDraftAlignmentSetId(groupAlignmentSetId);
  }, [groupAlignmentSetId]);

  const selectedAlignment = alignmentSets.find((set) => set.id === groupAlignmentSetId) ?? null;
  const draftAlignment =
    alignmentSets.find((set) => set.id === draftAlignmentSetId) ?? selectedAlignment;
  const hasDraftAlignmentChange = draftAlignmentSetId !== groupAlignmentSetId;
  const draftAlignmentDetails = draftAlignmentSetId ? alignmentDetails[draftAlignmentSetId] : null;

  useEffect(() => {
    if (!hasDraftAlignmentChange || !draftAlignmentSetId || alignmentDetails[draftAlignmentSetId]) {
      setPreviewLoading(false);
      return;
    }

    let ignore = false;
    setPreviewLoading(true);
    fetchAlignmentSet(draftAlignmentSetId)
      .then((details) => {
        if (ignore || !details) return;
        setAlignmentDetails((current) => ({ ...current, [draftAlignmentSetId]: details }));
      })
      .finally(() => {
        if (!ignore) setPreviewLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [alignmentDetails, draftAlignmentSetId, fetchAlignmentSet, hasDraftAlignmentChange]);

  const savedUserGroups = groups.filter((group) => !group.is_auto);
  const savedAutoGroup = groups.find((group) => group.is_auto);
  const savedFlatTeams: TeamDisplayRecord[] = savedAutoGroup?.teams.length
    ? savedAutoGroup.teams
    : seasonTeams;
  const previewGroups = useMemo(
    () => alignmentGroupsToSeasonGroups(draftAlignmentDetails?.groups),
    [draftAlignmentDetails?.groups],
  );
  const showPreview = hasDraftAlignmentChange && !!draftAlignment;
  const isLeagueWideAlignment = draftAlignment?.structure_type === 'league';
  const isGroupedAlignment = draftAlignment?.structure_type === 'groups';
  const userGroups = isLeagueWideAlignment
    ? []
    : showPreview && isGroupedAlignment
      ? previewGroups
      : savedUserGroups;
  const userRoots = userGroups
    .filter((group) => group.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const flatTeams: TeamDisplayRecord[] =
    showPreview && isLeagueWideAlignment
      ? (draftAlignmentDetails?.teams ?? [])
      : savedFlatTeams;
  const searchableTeams = userRoots.length > 0 ? getLeafGroupTeams(userGroups) : flatTeams;
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
  const alignmentLockedTooltip = hasScheduledGames
    ? 'Alignment cannot be changed after games are scheduled.'
    : 'Alignment cannot be changed after the season ends.';
  const handleSaveAlignment = async () => {
    if (!hasDraftAlignmentChange || !draftAlignmentSetId) return;
    await updateSeason(seasonId, {
      group_alignment_set_id: draftAlignmentSetId,
    });
  };
  const alignmentControl = (
    <div className={styles.alignmentHeaderControl}>
      {alignmentLocked ? (
        <Tooltip
          text={alignmentLockedTooltip}
          className={styles.readonlyAlignmentTooltip}
        >
          <div className={styles.readonlyAlignmentBox}>
            <span className={styles.readonlyAlignmentLabel}>{alignmentLabel}</span>
          </div>
        </Tooltip>
      ) : (
        <>
          <div className={styles.alignmentSelectField}>
            <Select
              value={draftAlignmentSetId}
              options={alignmentOptions}
              placeholder={
                alignmentSets.length === 0
                  ? 'No alignment sets - create one in the league Alignments tab'
                  : 'Select an alignment set...'
              }
              onChange={setDraftAlignmentSetId}
              disabled={busy === 'update' || alignmentSets.length === 0}
            />
          </div>
          {hasDraftAlignmentChange && (
            <Button
              type="button"
              icon="save"
              size="medium"
              variant="filled"
              intent="accent"
              iconHeight="field"
              tooltip="Save alignment"
              disabled={busy === 'update' || !draftAlignmentSetId}
              onClick={handleSaveAlignment}
            />
          )}
        </>
      )}
    </div>
  );

  return (
    <Section
      title={isGroupedAlignment ? 'Team Groups' : 'Teams'}
      action={alignmentControl}
    >
      {loading || (showPreview && previewLoading) ? (
        <SeasonTeamsSkeleton />
      ) : (
        <SearchableList
          items={searchableTeams}
          filterFn={teamMatchesSearch}
          renderItems={(filteredTeams) => {
            if (userRoots.length > 0) {
              const matchingTeamIds = new Set(filteredTeams.map((team) => team.id));
              const filteredGroups = filterGroupsByTeams(userGroups, matchingTeamIds);
              const filteredRoots = filteredGroups
                .filter((group) => group.parent_id === null)
                .sort(
                  (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
                );

              return (
                <ul className={styles.groupList}>
                  {filteredRoots.map((group) => (
                    <GroupNode
                      key={group.id}
                      group={group}
                      allGroups={filteredGroups}
                      leagueCode={leagueCode}
                      seasonId={seasonId}
                      seasonName={seasonName}
                    />
                  ))}
                </ul>
              );
            }

            return (
              <TeamList
                teams={filteredTeams}
                leagueCode={leagueCode}
                leagueId={leagueId}
                seasonId={seasonId}
                seasonName={seasonName}
              />
            );
          }}
          placeholder="Search teams..."
          emptyMessage={
            draftAlignment
              ? 'No teams are defined for this alignment set.'
              : 'Select an alignment set to view this season team structure.'
          }
          noResultsMessage={(query) => `No teams match "${query}".`}
        />
      )}
    </Section>
  );
};

export default SeasonTeamsCard;
