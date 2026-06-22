import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Accordion from '@/components/Accordion/Accordion';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import Select from '@/components/Select/Select';
import Skeleton from '@/components/Skeleton/Skeleton';
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
        label={<span className={styles.groupLabel}>{group.name}</span>}
        labelMeta={
          <span
            className={styles.groupTeamCount}
            title={`${teamCount} ${teamCount === 1 ? 'team' : 'teams'}`}
          >
            ({teamCount} {teamCount === 1 ? 'team' : 'teams'})
          </span>
        }
        headerRight={
          roleLabel ? (
            <span className={`${styles.groupRoleBadge} ${styles[`groupRoleBadge_${group.role}`]}`}>
              {roleLabel}
            </span>
          ) : null
        }
      >
        {isLeaf && group.teams.length > 0 && (
          <ul className={styles.groupTeamList}>
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

const alignmentGroupsToSeasonGroups = (
  alignmentGroups: AlignmentGroupRecord[] | undefined,
): SeasonGroupRecord[] =>
  (alignmentGroups ?? []).map((group) => ({
    ...group,
    has_season_override: group.has_season_override ?? false,
    is_inherited: group.is_inherited ?? false,
    is_auto: group.is_auto ?? false,
  }));

const TeamList = ({ teams, leagueCode, leagueId, seasonId, seasonName }: TeamListProps) => {
  const navigate = useNavigate();

  return (
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
            eyebrow={team.place_name || ''}
            name={team.team_name || team.name}
            rightContent={{ type: 'code', value: team.code }}
            primaryColor={team.primary_color}
            textColor={team.text_color}
            href={teamHref}
            actions={
              [
                {
                  icon: 'open_in_new',
                  intent: 'neutral',
                  tooltip: 'View team',
                  onClick: () => navigate(teamHref),
                },
              ] satisfies ListItemAction[]
            }
          />
        );
      })}
    </ul>
  );
};

const SeasonTeamsSkeleton = ({ variant }: { variant: 'groups' | 'teams' }) => {
  if (variant === 'groups') {
    return (
      <ul
        className={styles.skeletonGroupList}
        aria-hidden="true"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <li
            key={index}
            className={styles.skeletonGroupItem}
          >
            <Skeleton
              type="text"
              className={styles.skeletonGroupTitle}
            />
            <Skeleton type="circle" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul
      className={styles.skeletonTeamList}
      aria-hidden="true"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <li
          key={index}
          className={styles.skeletonTeamItem}
        >
          <Skeleton type="picture" />
          <span className={styles.skeletonTextStack}>
            <Skeleton
              type="subtitle"
              className={styles.skeletonEyebrow}
            />
            <Skeleton
              type="text"
              className={styles.skeletonName}
            />
          </span>
          <Skeleton type="code" />
        </li>
      ))}
    </ul>
  );
};

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
  const userGroups =
    showPreview && draftAlignment?.structure_type === 'groups' ? previewGroups : savedUserGroups;
  const userRoots = userGroups
    .filter((group) => group.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const flatTeams: TeamDisplayRecord[] =
    showPreview && draftAlignment?.structure_type === 'league'
      ? (draftAlignmentDetails?.teams ?? [])
      : savedFlatTeams;
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
  const handleSaveAlignment = async () => {
    if (!hasDraftAlignmentChange || !draftAlignmentSetId) return;
    await updateSeason(seasonId, {
      group_alignment_set_id: draftAlignmentSetId,
    });
  };
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
          <span className={styles.readonlyAlignmentLabel}>{alignmentLabel}</span>
        </div>
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
              size="sm"
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
    <Card
      title={draftAlignment?.structure_type === 'groups' ? 'Team Groups' : 'Teams'}
      action={alignmentControl}
    >
      {loading || (showPreview && previewLoading) ? (
        <SeasonTeamsSkeleton
          variant={draftAlignment?.structure_type === 'groups' ? 'groups' : 'teams'}
        />
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
          {draftAlignment
            ? 'No teams are defined for this alignment set.'
            : 'Select an alignment set to view this season team structure.'}
        </p>
      )}
    </Card>
  );
};

export default SeasonTeamsCard;
