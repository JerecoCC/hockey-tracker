import { type TeamDetailRecord } from '../../../hooks/useTeamDetails';
import InfoItem from './InfoItem';
import styles from './TeamDetails.module.scss';

export interface SeasonOption {
  value: string;
  label: string;
}

/** Derives a short label like "2024-25" from a season's start/end dates. */
export const seasonLabel = (
  startDate: string | null,
  endDate: string | null,
  name: string,
): string => {
  if (!startDate) return name;
  const sy = startDate.slice(0, 4);
  const ey = endDate?.slice(0, 4);
  if (!ey || ey === sy) return sy;
  return `${sy}-${ey.slice(2)}`;
};

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
        {team.league_logo ? (
          <img
            src={team.league_logo}
            alt={team.league_name ?? ''}
            className={styles.leagueLogo}
          />
        ) : (
          <span
            className={styles.leagueLogoPlaceholder}
            style={
              team.league_primary_color
                ? {
                    background: team.league_primary_color,
                    color: team.league_text_color ?? undefined,
                  }
                : undefined
            }
          >
            {team.league_code?.slice(0, 3)}
          </span>
        )}
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
      <div className={styles.infoBadgeRow}>
        <LeagueBadge team={team} />
        {groupLabel && <GroupBadge label={groupLabel} />}
        <ActiveSeasonsBadge team={team} />
      </div>
      <InfoItem
        label="City"
        data={team.city ?? '-'}
      />
      <InfoItem
        label="Home Arena"
        data={team.home_arena ?? '-'}
      />
      {team.location && (
        <InfoItem
          label="Location"
          data={team.location}
          icon="location_on"
        />
      )}
      <InfoItem
        type="html"
        label="Description"
        data={normalizeDescription(team.description) ? team.description : null}
        muted="No description"
        full
      />
    </div>
  );
};

export default TeamInfoGrid;
