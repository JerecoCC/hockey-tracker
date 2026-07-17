import { type TeamDetailRecord } from '@/hooks/useTeamDetails';
import InfoItem from '@jerecocc/tracker-ui/components/InfoItem/InfoItem';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import styles from './TeamDetails.module.scss';

export interface SeasonOption {
  value: string;
  label: string;
}

const normalizeDescription = (html: string | null | undefined): string | null => {
  if (!html || html === '<p></p>') return null;
  return html;
};

interface Props {
  team: TeamDetailRecord;
  /** The single group label to display, or null to hide the group badge entirely. */
  groupLabel: string | null;
}

const LeagueBadge = ({ team }: { team: TeamDetailRecord }) => (
  <InfoItem
    type="custom"
    label="League"
  >
    {team.league_id ? (
      <div className={styles.leagueBadge}>
        <TeamLogo
          logo={team.league_logo}
          code={team.league_code ?? ''}
          alt={team.league_name ?? team.league_code ?? ''}
          primaryColor={team.league_primary_color}
          textColor={team.league_text_color}
          size={28}
          shape="square"
          className={styles.leagueLogo}
        />
        <span className={styles.infoValue}>{team.league_name}</span>
      </div>
    ) : (
      <span className={styles.infoValueMuted}>Unassigned</span>
    )}
  </InfoItem>
);

const GroupBadge = ({ label }: { label: string }) => (
  <InfoItem
    type="custom"
    label="Group"
  >
    <span className={styles.infoValue}>{label}</span>
  </InfoItem>
);

const ActiveSeasonsBadge = ({ team }: { team: TeamDetailRecord }) => {
  if (!team.start_season_start_date && !team.latest_season_end_date) return null;
  return (
    <InfoItem
      label="Active Seasons"
      data={`${team.start_season_start_date?.slice(0, 4) ?? '?'} – ${team.latest_season_end_date?.slice(0, 4) ?? 'present'}`}
    />
  );
};

const TeamInfoGrid = ({ team, groupLabel }: Props) => {
  return (
    <div className={styles.infoGrid}>
      <LeagueBadge team={team} />
      <InfoItem
        label="City"
        data={team.city ?? '-'}
      />
      <InfoItem
        label="Home Arena"
        data={team.home_arena ?? '-'}
      />
      {groupLabel && <GroupBadge label={groupLabel} />}
      <ActiveSeasonsBadge team={team} />
      {team.location && (
        <InfoItem
          label="Location"
          data={team.location}
          icon="location_on"
        />
      )}
      <div className={styles.infoFullRow}>
        <InfoItem
          type="html"
          label="Description"
          data={normalizeDescription(team.description) ? team.description : null}
          muted="No description"
          full
        />
      </div>
    </div>
  );
};

export default TeamInfoGrid;
