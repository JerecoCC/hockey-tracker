import type { FormEvent } from 'react';
import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import Field from '../../../components/Field/Field';
import Icon from '../../../components/Icon/Icon';
import RichTextEditor from '../../../components/RichTextEditor/RichTextEditor';
import { type TeamDetailRecord } from '../../../hooks/useTeamDetails';
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
  <div className={styles.infoItem}>
    <span className={styles.infoLabel}>League</span>
    {team.league_id ? (
      <div className={styles.leagueBadge}>
        {team.league_logo ? (
          <img
            src={team.league_logo}
            alt={team.league_name ?? ''}
            className={styles.leagueLogo}
          />
        ) : (
          <span className={styles.leagueLogoPlaceholder}>{team.league_code?.slice(0, 3)}</span>
        )}
        <span className={styles.infoValue}>{team.league_name}</span>
      </div>
    ) : (
      <span className={styles.infoValueMuted}>Unassigned</span>
    )}
  </div>
);

const GroupBadge = ({ teamGroupLabels }: { teamGroupLabels: string[] }) => (
  <div className={styles.infoItem}>
    <span className={styles.infoLabel}>Group</span>
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
  </div>
);

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
          <LeagueBadge team={team} />
          <GroupBadge teamGroupLabels={teamGroupLabels} />
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
          <div className={styles.infoItemFull}>
            <span className={styles.infoLabel}>Description</span>
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
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className={styles.infoGrid}>
      <LeagueBadge team={team} />
      <GroupBadge teamGroupLabels={teamGroupLabels} />
      {team.location && (
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Location</span>
          <span className={styles.infoValue}>
            <Icon
              name="location_on"
              size="0.9em"
            />
            {team.location}
          </span>
        </div>
      )}
      {team.city && (
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>City</span>
          <span className={styles.infoValue}>{team.city}</span>
        </div>
      )}
      {team.home_arena && (
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Home Arena</span>
          <span className={styles.infoValue}>{team.home_arena}</span>
        </div>
      )}
      {(team.start_season_start_date || team.latest_season_end_date) && (
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Active Seasons</span>
          <span className={styles.infoValue}>
            {team.start_season_start_date?.slice(0, 4) ?? '?'}
            {' – '}
            {team.latest_season_end_date?.slice(0, 4) ?? 'present'}
          </span>
        </div>
      )}
      <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
        <span className={styles.infoLabel}>Description</span>
        {normalizeDescription(team.description) ? (
          <div
            className={styles.infoValue}
            dangerouslySetInnerHTML={{ __html: team.description! }}
          />
        ) : (
          <span className={styles.infoValueMuted}>No description</span>
        )}
      </div>
    </div>
  );
};

export default TeamInfoGrid;
