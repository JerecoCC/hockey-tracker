import ListItem from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import { useTeamSeasons } from '@/hooks/useTeamDetails';
import { buildTeamSeasonDetailsPath } from '@/lib/routeSlugs';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import { getSeasonPhase, seasonPhasePresentation } from '@/lib/seasonPhase';
import styles from './TeamDetails.module.scss';

interface Props {
  teamId: string;
  teamCode: string | null;
  leagueId: string | null;
  leagueCode: string | null;
}

const formatDateRange = (
  startDate: string | null,
  endDate: string | null,
  isUnderway: boolean,
) => {
  if (!startDate && !endDate) return undefined;
  return [startDate ?? 'Unknown', endDate ?? (isUnderway ? 'Present' : 'Unknown')].join(' – ');
};

const TeamSeasonsTab = ({ teamId, teamCode, leagueId, leagueCode }: Props) => {
  const { seasons, loading } = useTeamSeasons(teamId);

  return (
    <Section title="Seasons">
      {loading ? (
        <ResponsiveList>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              as="li"
              key={index}
              variant="card"
            />
          ))}
        </ResponsiveList>
      ) : seasons.length === 0 ? (
        <p className={styles.tabPlaceholder}>No seasons recorded for this team.</p>
      ) : (
        <ResponsiveList>
          {seasons.map((season) => {
            const phase = getSeasonPhase(season);
            const phasePresentation = seasonPhasePresentation(phase);
            return (
              <ListItem
                key={season.id}
                fullWidth
                hideImage
                name={season.name}
                subtitle={formatDateRange(
                  season.start_date,
                  season.end_date,
                  phase === 'in_progress' || phase === 'playoffs',
                )}
                rightContent={{ type: 'tag', ...phasePresentation }}
                href={buildTeamSeasonDetailsPath({
                  leagueCode,
                  leagueId,
                  teamCode,
                  teamId,
                  seasonName: season.name,
                  seasonId: season.id,
                })}
                ariaLabel={`Open ${season.name} team details`}
              />
            );
          })}
        </ResponsiveList>
      )}
    </Section>
  );
};

export default TeamSeasonsTab;
