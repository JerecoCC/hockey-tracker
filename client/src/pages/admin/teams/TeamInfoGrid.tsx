import type { FormEvent } from 'react';
import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import Field from '../../../components/Field/Field';
import RichTextEditor from '../../../components/RichTextEditor/RichTextEditor';
import { type TeamDetailRecord } from '../../../hooks/useTeamDetails';
import InfoItem from './InfoItem';
import styles from './TeamDetails.module.scss';

export interface FormValues {
  logo: File | string | null;
  name: string;
  code: string;
  city: string;
  home_arena: string;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  description: string | null;
}

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

interface ViewProps {
  isEditing?: false;
  team: TeamDetailRecord;
  teamGroupLabels: string[];
}

interface EditProps {
  isEditing: true;
  team: TeamDetailRecord;
  teamGroupLabels: string[];
  control: Control<FormValues>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
}

type Props = ViewProps | EditProps;

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

const GroupBadge = ({ teamGroupLabels }: { teamGroupLabels: string[] }) => (
  <InfoItem
    type="custom"
    label="Group"
  >
    {teamGroupLabels.length > 0 ? (
      teamGroupLabels.map((label, i) => (
        <span
          key={i}
          className={styles.infoValue}
        >
          {label}
        </span>
      ))
    ) : (
      <span className={styles.infoValueMuted}>No groups</span>
    )}
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

const TeamInfoGrid = (props: Props) => {
  const { team, teamGroupLabels } = props;

  if (props.isEditing) {
    const { control, onSubmit, isSubmitting } = props;
    return (
      <form
        id="team-edit-form"
        className={styles.editForm}
        onSubmit={onSubmit}
      >
        <div className={styles.infoGrid}>
          <div className={styles.infoBadgeRow}>
            <LeagueBadge team={team} />
            <GroupBadge teamGroupLabels={teamGroupLabels} />
            <ActiveSeasonsBadge team={team} />
          </div>
          <Field
            label="City"
            control={control}
            name="city"
            placeholder="e.g. Toronto"
            disabled={isSubmitting}
          />
          <Field
            label="Home Arena"
            control={control}
            name="home_arena"
            placeholder="e.g. Scotiabank Arena"
            disabled={isSubmitting}
          />
          <InfoItem
            type="custom"
            label="Description"
            full
          >
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <RichTextEditor
                  content={field.value ?? ''}
                  onChange={field.onChange}
                  autoFocus={false}
                />
              )}
            />
          </InfoItem>
        </div>
      </form>
    );
  }

  return (
    <div className={styles.infoGrid}>
      <div className={styles.infoBadgeRow}>
        <LeagueBadge team={team} />
        <GroupBadge teamGroupLabels={teamGroupLabels} />
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
