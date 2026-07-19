import { useState } from 'react';
import Accordion from '@jerecocc/tracker-ui/components/Accordion/Accordion';
import AwardBanner from '@/shared/AwardBanner/AwardBanner';
import Badge from '@jerecocc/tracker-ui/components/Badge/Badge';
import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
import InfoTooltip from '@jerecocc/tracker-ui/components/InfoTooltip/InfoTooltip';
import ListItem from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import SegmentedControl from '@jerecocc/tracker-ui/components/SegmentedControl/SegmentedControl';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import { useTeamAwards, type TeamAwardRecord } from '@/hooks/useTeamDetails';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import styles from './TeamDetails.module.scss';

interface Props {
  teamId: string;
  mode?: 'admin' | 'user';
}

interface TeamAwardGroup {
  awardId: string;
  awardName: string;
  awards: TeamAwardRecord[];
}

type AwardViewMode = 'list' | 'banner';

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const AWARD_VIEW_OPTIONS = [
  {
    value: 'list',
    label: (
      <span className={styles.awardViewOption}>
        <Icon
          name="view_list"
          size="0.85rem"
        />
        List
      </span>
    ),
  },
  {
    value: 'banner',
    label: (
      <span className={styles.awardViewOption}>
        <Icon
          name="flag"
          size="0.85rem"
        />
        Banner
      </span>
    ),
  },
];

const PLAYOFF_CHAMPIONSHIP_AWARD_NAME = /\b(champions?|championship|cup winners?)\b/i;
const AWARD_NAME_HAS_CHAMPIONS_LABEL = /\b(champions?|championship)\b/i;

const teamCode = (code: string | null, name: string | null) =>
  code ?? (name ? name.slice(0, 3).toUpperCase() : 'TEAM');

const awardTeamPlaceName = (award: TeamAwardRecord) => {
  const placeName = award.team_place_name?.trim();
  return placeName || null;
};

const awardTeamDisplayName = (award: TeamAwardRecord) => {
  const splitName = award.team_team_name?.trim();
  if (splitName) return splitName;

  const fullName = award.team_name?.trim();
  const placeName = awardTeamPlaceName(award);
  if (fullName && placeName && fullName.toLowerCase().startsWith(placeName.toLowerCase())) {
    return fullName.slice(placeName.length).trim() || fullName;
  }

  return fullName || 'Team not recorded';
};

const sortTeamAwards = (awards: TeamAwardRecord[]) =>
  [...awards].sort(
    (a, b) =>
      (b.awarded_at ?? '').localeCompare(a.awarded_at ?? '') ||
      b.season_name.localeCompare(a.season_name) ||
      a.award_name.localeCompare(b.award_name),
  );

const isPlayoffChampionshipAward = (award: TeamAwardRecord) =>
  award.stat_key === 'playoff_champion' ||
  (award.competition_scope === 'playoffs' &&
    PLAYOFF_CHAMPIONSHIP_AWARD_NAME.test(award.award_name));

const shouldShowChampionsLabel = (award: TeamAwardRecord) =>
  isPlayoffChampionshipAward(award) && !AWARD_NAME_HAS_CHAMPIONS_LABEL.test(award.award_name);

const groupTeamAwards = (awards: TeamAwardRecord[]): TeamAwardGroup[] => {
  const groups = new Map<string, TeamAwardGroup>();

  awards.forEach((award) => {
    const groupKey = award.award_id || award.award_name;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.awards.push(award);
      return;
    }

    groups.set(groupKey, {
      awardId: groupKey,
      awardName: award.award_name,
      awards: [award],
    });
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    awards: sortTeamAwards(group.awards),
  }));
};

const formatShortDate = (iso: string | null) => {
  if (!iso) return null;
  return DATE_FMT.format(new Date(iso));
};

const awardSubtitle = (award: TeamAwardRecord) =>
  [award.team_name, award.awarded_at ? `Awarded ${formatShortDate(award.awarded_at)}` : null]
    .filter(Boolean)
    .join(' | ');

const awardInfoLabel = (group: TeamAwardGroup) => {
  const description = group.awards[0]?.award_description?.trim();

  return (
    <span className={styles.awardGroupLabel}>
      <span>{group.awardName}</span>
      {description && (
        <span data-accordion-ignore-toggle>
          <InfoTooltip
            ariaLabel={`${group.awardName} award details`}
            size="0.85rem"
            content={<span className={styles.awardInfoTooltip}>{description}</span>}
          />
        </span>
      )}
    </span>
  );
};

const TeamAwardsTab = ({ teamId, mode = 'admin' }: Props) => {
  const { awards, loading } = useTeamAwards(teamId, { mode });
  const [awardViewMode, setAwardViewMode] = useState<AwardViewMode>('list');
  const awardGroups = groupTeamAwards(awards);
  const sortedAwards = sortTeamAwards(awards);

  return (
    <Section
      title="Awards"
      action={
        <div className={styles.awardHeaderRight}>
          <SegmentedControl
            value={awardViewMode}
            onChange={(value) => setAwardViewMode(value === 'banner' ? 'banner' : 'list')}
            options={AWARD_VIEW_OPTIONS}
            variant="field"
            className={styles.awardViewControl}
          />
        </div>
      }
    >
      {loading ? (
        <p className={styles.tabPlaceholder}>Loading awards...</p>
      ) : awardGroups.length === 0 ? (
        <p className={styles.tabPlaceholder}>No awards recorded yet.</p>
      ) : awardViewMode === 'banner' ? (
        <div
          className={styles.awardBannerRack}
          aria-label="Award banners"
        >
          {sortedAwards.map((award) => (
            <AwardBanner
              key={award.id}
              awardName={award.award_name}
              champions={shouldShowChampionsLabel(award)}
              dateText={award.awarded_at ? `Awarded ${formatShortDate(award.awarded_at)}` : null}
              media={
                <TeamLogo
                  logo={award.team_logo}
                  logoDark={award.team_logo_dark}
                  logoLight={award.team_logo_light}
                  code={teamCode(award.team_code, award.team_name)}
                  alt=""
                  primaryColor={award.team_primary_color}
                  textColor={award.team_text_color}
                  size={76}
                />
              }
              placeName={awardTeamPlaceName(award)}
              primaryColor={award.team_primary_color}
              secondaryColor={award.team_secondary_color ?? award.team_primary_color}
              seasonName={award.season_name}
              shape={isPlayoffChampionshipAward(award) ? 'pointed' : 'rounded'}
              teamName={awardTeamDisplayName(award)}
              textColor={award.team_text_color}
            />
          ))}
        </div>
      ) : (
        <div className={styles.awardGroups}>
          {awardGroups.map((group) => (
            <Accordion
              key={group.awardId}
              label={awardInfoLabel(group)}
              labelMeta={
                <Badge
                  value={group.awards.length}
                  label={group.awards.length === 1 ? 'win' : 'wins'}
                  aria-label={`${group.awards.length} ${
                    group.awards.length === 1 ? 'win' : 'wins'
                  }`}
                />
              }
              defaultOpen
              variant="light"
              className={styles.awardGroup}
              bodyClassName={styles.awardAccordionBody}
            >
              <ResponsiveList className={styles.awardTeamList}>
                {group.awards.map((award) => (
                  <ListItem
                    key={award.id}
                    fullWidth
                    variant="plain"
                    image={award.team_logo}
                    imageDark={award.team_logo_dark}
                    imageLight={award.team_logo_light}
                    imageShape="square"
                    name={award.season_name}
                    placeholder={teamCode(award.team_code, award.team_name)}
                    primaryColor={award.team_primary_color}
                    textColor={award.team_text_color}
                    subtitle={awardSubtitle(award)}
                    rightContent={{
                      type: 'tag',
                      label: award.team_code ?? 'TEAM',
                      intent: 'info',
                    }}
                  />
                ))}
              </ResponsiveList>
            </Accordion>
          ))}
        </div>
      )}
    </Section>
  );
};

export default TeamAwardsTab;
