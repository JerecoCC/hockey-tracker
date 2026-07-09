import type { LeagueSeasonRecord } from '@/hooks/useLeagueDetails';
import type { PlayoffSeriesRecord } from '@/hooks/useGames';
import { getPlayoffScoreMetaBaseLabel } from '@/pages/admin/games/game-details/playoffScoreMeta';

type SeriesTitleTeam = {
  code?: string | null;
  name?: string | null;
  placeName?: string | null;
  teamName?: string | null;
};

const stripPlaceName = (name: string, placeName?: string | null) => {
  const cleanPlaceName = placeName?.trim();
  if (!cleanPlaceName) return name;

  const prefix = `${cleanPlaceName} `;
  return name.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())
    ? name.slice(prefix.length).trim()
    : name;
};

export const playoffSeriesTitleTeamName = ({
  code,
  name,
  placeName,
  teamName,
}: SeriesTitleTeam) => {
  const cleanTeamName = teamName?.trim();
  if (cleanTeamName) return cleanTeamName;

  const cleanName = name?.trim();
  if (cleanName) return stripPlaceName(cleanName, placeName) || cleanName;

  return code?.trim() || 'TBD';
};

export const playoffSeasonEndYear = (
  season?: Pick<LeagueSeasonRecord, 'end_date' | 'name'> | null,
) => {
  const endDateYear = season?.end_date?.match(/^\d{4}/)?.[0];
  if (endDateYear) return endDateYear;

  const seasonName = season?.name?.trim();
  if (!seasonName) return null;

  const yearRange = seasonName.match(/\b(\d{4})\s*[-/]\s*(\d{2})\b/);
  if (yearRange) {
    const startYear = Number(yearRange[1]);
    const endYearSuffix = Number(yearRange[2]);
    if (Number.isFinite(startYear) && Number.isFinite(endYearSuffix)) {
      const century = Math.floor(startYear / 100) * 100;
      const endYear = century + endYearSuffix;
      return String(endYear < startYear ? endYear + 100 : endYear);
    }
  }

  const years = seasonName.match(/\b\d{4}\b/g);
  return years?.[years.length - 1] ?? null;
};

export const buildPlayoffSeriesDocumentTitle = (
  series: PlayoffSeriesRecord | null | undefined,
  season?: Pick<LeagueSeasonRecord, 'end_date' | 'name'> | null,
) => {
  if (!series) return 'Series Details';

  const slot1TeamName = playoffSeriesTitleTeamName({
    code: series.home_team_code,
    name: series.home_team_name,
    placeName: series.home_team_place_name,
    teamName: series.home_team_team_name,
  });
  const slot2TeamName = playoffSeriesTitleTeamName({
    code: series.away_team_code,
    name: series.away_team_name,
    placeName: series.away_team_place_name,
    teamName: series.away_team_team_name,
  });
  const seriesName =
    getPlayoffScoreMetaBaseLabel({
      playoff_round: series.round,
      playoff_round_names: series.playoff_round_names,
      playoff_matchup_names: series.playoff_matchup_names,
      bracket_slot_key: series.bracket_slot_key,
    }) ?? 'Playoffs';
  const endYear = playoffSeasonEndYear(season);

  return [
    `${slot1TeamName} - ${slot2TeamName}`,
    seriesName,
    `Playoffs ${endYear ?? 'Season'}`,
  ].join(' · ');
};
