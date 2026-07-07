import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast, type TypeOptions } from 'react-toastify';
import Accordion from '@/components/Accordion/Accordion';
import AwardBanner from '@/components/AwardBanner/AwardBanner';
import Badge from '@/components/Badge/Badge';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import Chip from '@/components/Chip/Chip';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Divider from '@/components/Divider/Divider';
import Icon from '@/components/Icon/Icon';
import Section from '@/components/Section/Section';
import InfoTooltip from '@/components/InfoTooltip/InfoTooltip';
import ImagePreviewModal from '@/components/ImagePreviewModal/ImagePreviewModal';
import ListItem from '@/components/ListItem/ListItem';
import MoreActionsMenu from '@/components/MoreActionsMenu/MoreActionsMenu';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import SeasonSelect from '@/components/SeasonSelect/SeasonSelect';
import StatItem from '@/components/StatItem/StatItem';
import Table, { type Column } from '@/components/Table/Table';
import Tabs from '@/components/Tabs/Tabs';
import Tag from '@/components/Tag/Tag';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import Tooltip from '@/components/Tooltip/Tooltip';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import usePlayerDetails, {
  usePlayerAwards,
  usePlayerCurrentSeasonStats,
  usePlayerGameLogs,
  usePlayerLastFiveGames,
  usePlayerRouteLookup,
  type PlayerAwardRecord,
  type PlayerCareerStatRecord,
  type PlayerCurrentSeasonStats,
  type PlayerCurrentSeasonStatBlock,
  type PlayerLastFiveGameRecord,
} from '@/hooks/usePlayerDetails';
import useTeamDetails from '@/hooks/useTeamDetails';
import useSeasons, { type SeasonRecord } from '@/hooks/useSeasons';
import useTeams from '@/hooks/useTeams';
import {
  usePlayerTradeHistory,
  useStintActions,
  useJerseyHistory,
  usePlayerPhotoHistory,
  type JerseyHistoryEntry,
  type PlayerPhotoEntry,
  type PlayerStintRecord,
  type TeamPlayerRecord,
} from '@/hooks/useTeamPlayers';
import {
  type CreatePlayerData,
  type PlayerPosition,
  type PlayerShoots,
} from '@/hooks/useLeaguePlayers';
import useTabState from '@/hooks/useTabState';
import { formatPlayerPosition } from '@/lib/playerPosition';
import { getPlayerStatus, PLAYER_STATUS_LABELS } from '@/lib/playerStatus';
import { getLatestEndedSeasonId } from '@/lib/seasonSelection';
import {
  buildGameDetailsPath,
  buildLeagueDetailsPath,
  buildPlayerDetailsPath,
  buildTeamDetailsPath,
  buildUserGameDetailsPath,
  buildUserTeamDetailsPath,
  toRouteSlug,
} from '@/lib/routeSlugs';
import TeamPlayerEditModal from '../teams/TeamPlayerEditModal';
import MovePlayerModal from '../teams/MovePlayerModal';
import StintEditModal, { ACQUISITION_TYPE_LABELS } from './StintEditModal';
import ChangeJerseyModal from './ChangeJerseyModal';
import JerseyHistoryEditModal from './JerseyHistoryEditModal';
import ChangePhotoModal from './ChangePhotoModal';
import PlayerInfoEditModal from './PlayerInfoEditModal';
import RetirePlayerModal from './RetirePlayerModal';
import styles from './PlayerDetails.module.scss';
import useDocumentIcon from '@/hooks/useDocumentIcon';

const API = import.meta.env.VITE_API_URL || '/api';
const PWHL_BASE_URL = 'https://lscluster.hockeytech.com/feed/index.php';
const PWHL_APP_KEY = '446521baf8c38984';
const PWHL_CLIENT_CODE = 'pwhl';
const PWHL_LEAGUE_ID = '1';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const apiError = (err: unknown, fallback: string): string =>
  axios.isAxiosError(err) && typeof err.response?.data?.error === 'string'
    ? err.response.data.error
    : fallback;
const GAME_LOG_PAGE_SIZE = 20;
const AUTOFILL_RESULT_TOAST_MS = 4000;
const AUTOFILL_FAILURE_TOAST_MS = 12000;
const PLAYER_AUTOFILL_PROGRESS_STEPS = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PlayerAwardGroup {
  awardId: string;
  awardName: string;
  awards: PlayerAwardRecord[];
}

type AwardViewMode = 'list' | 'banner';

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

interface NhlLocalizedText {
  default?: string;
  en?: string;
  [key: string]: string | undefined;
}

interface NhlPlayerLanding {
  firstName?: NhlLocalizedText;
  lastName?: NhlLocalizedText;
  birthDate?: string | null;
  birthCity?: NhlLocalizedText | string | null;
  birthStateProvince?: NhlLocalizedText | string | null;
  birthState?: NhlLocalizedText | string | null;
  birthProvince?: NhlLocalizedText | string | null;
  stateProvince?: NhlLocalizedText | string | null;
  birthCountry?: string | null;
  heightInCentimeters?: number | null;
  heightInInches?: number | null;
  weightInPounds?: number | null;
  position?: string | null;
  shootsCatches?: string | null;
  currentTeamAbbrev?: string | null;
  sweaterNumber?: number | null;
  currentTeamStartDate?: string | null;
  currentTeamRosterDate?: string | null;
  acquisitionDate?: string | null;
  acquiredDate?: string | null;
  currentJerseyNumberEffectiveDate?: string | null;
  jerseyNumberEffectiveDate?: string | null;
  currentSweaterNumberEffectiveDate?: string | null;
  sweaterNumberEffectiveDate?: string | null;
  jerseyNumberDate?: string | null;
  sweaterNumberDate?: string | null;
  acquisitionType?: string | null;
  currentTeamAcquisitionType?: string | null;
}

interface NhlPlayerGameLogEntry {
  gameId?: number | string | null;
  gameDate?: string | null;
  teamAbbrev?: NhlLocalizedText | string | null;
  sweaterNumber?: number | null;
  jerseyNumber?: number | null;
}

interface NhlPlayerGameLogResponse {
  gameLog?: NhlPlayerGameLogEntry[];
  games?: NhlPlayerGameLogEntry[];
}

type NhlBoxscorePlayerGroup = 'forwards' | 'defense' | 'goalies';

interface NhlBoxscorePlayerStats {
  playerId?: number | string | null;
  sweaterNumber?: number | string | null;
}

type NhlBoxscoreTeamStats = Partial<Record<NhlBoxscorePlayerGroup, NhlBoxscorePlayerStats[]>>;

interface NhlBoxscoreResponse {
  awayTeam?: { abbrev?: NhlLocalizedText | string | null } | null;
  homeTeam?: { abbrev?: NhlLocalizedText | string | null } | null;
  playerByGameStats?: {
    awayTeam?: NhlBoxscoreTeamStats | null;
    homeTeam?: NhlBoxscoreTeamStats | null;
  } | null;
  gameDate?: string | null;
}

interface PwhlPlayerProfile {
  info?: PwhlPlayerProfileInfo | null;
}

interface PwhlPlayerProfileInfo {
  firstName?: string | number | null;
  lastName?: string | number | null;
  playerId?: string | number | null;
  jerseyNumber?: string | number | null;
  position?: string | null;
  shoots?: string | null;
  catches?: string | null;
  height?: string | null;
  height_sans_hyphen?: string | null;
  height_hyphenated?: string | null;
  weight?: string | number | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  profileImage?: string | null;
}

const NHL_JERSEY_INFERENCE_GAME_TYPES = [2, 3] as const;

const PWHL_BIRTH_COUNTRY_CODES: Record<string, string> = {
  canada: 'CAN',
  czechia: 'CZE',
  'czech republic': 'CZE',
  denmark: 'DEN',
  finland: 'FIN',
  france: 'FRA',
  germany: 'GER',
  hungary: 'HUN',
  japan: 'JPN',
  russia: 'RUS',
  slovakia: 'SVK',
  sweden: 'SWE',
  switzerland: 'SUI',
  'united kingdom': 'GBR',
  'united states': 'USA',
  'united states of america': 'USA',
  us: 'USA',
  usa: 'USA',
};

const readNhlText = (value: NhlLocalizedText | string | null | undefined) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.default ?? value.en ?? Object.values(value).find(Boolean) ?? null;
};

const readPwhlText = (value: string | number | null | undefined) => {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
};

const formatNhlBirthCity = (landing: NhlPlayerLanding) => {
  const city = readNhlText(landing.birthCity)?.trim();
  if (!city) return null;

  const stateProvince = readNhlText(
    landing.birthStateProvince ??
      landing.birthState ??
      landing.birthProvince ??
      landing.stateProvince,
  )?.trim();
  if (!stateProvince) return city;

  const cityParts = city.split(',').map((part) => part.trim().toLowerCase());
  if (cityParts.includes(stateProvince.toLowerCase())) return city;
  return `${city}, ${stateProvince}`;
};

const normalizeTeamCode = (value: string | null | undefined) => value?.trim().toUpperCase() ?? null;

const normalizeNhlPosition = (value: string | null | undefined): PlayerPosition | null => {
  const position = value?.trim().toUpperCase();
  if (!position) return null;
  if (['C', 'LW', 'RW', 'F', 'D', 'LD', 'RD', 'G'].includes(position)) {
    return position as PlayerPosition;
  }
  if (position === 'L') return 'LW';
  if (position === 'R') return 'RW';
  return null;
};

const normalizeShoots = (value: string | null | undefined): PlayerShoots | null => {
  const shoots = value?.trim().toUpperCase();
  return shoots === 'L' || shoots === 'R' ? shoots : null;
};

const normalizePwhlBirthCountry = (value: string | null | undefined) => {
  const country = value?.trim();
  if (!country) return null;
  const key = country.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
  return PWHL_BIRTH_COUNTRY_CODES[key] ?? country;
};

const formatPwhlBirthPlace = (value: string | null | undefined) => {
  const parts = String(value ?? '')
    .split(',')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (parts.length === 0) return { city: null, country: null };
  if (parts.length === 1) return { city: parts[0], country: null };

  return {
    city: parts.slice(0, -1).join(', '),
    country: normalizePwhlBirthCountry(parts[parts.length - 1]),
  };
};

const pwhlPlayerProfileUrl = (playerNumber: string) => {
  const params = new URLSearchParams({
    feed: 'statviewfeed',
    view: 'player',
    player_id: playerNumber,
    key: PWHL_APP_KEY,
    client_code: PWHL_CLIENT_CODE,
    lang: 'en',
    league_id: PWHL_LEAGUE_ID,
    fmt: 'json',
  });
  return `${PWHL_BASE_URL}?${params.toString()}`;
};

const parsePwhlHeightCm = (value: string | null | undefined) => {
  const text = value?.trim();
  if (!text) return null;
  const match = text.match(/^(\d+)\s*(?:'|-)\s*(\d{1,2})/);
  if (!match) return null;

  const feet = Number(match[1]);
  const inches = Number(match[2]);
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
  return Math.round((feet * 12 + inches) * 2.54);
};

const parsePwhlWeightLbs = (value: string | number | null | undefined) => {
  if (value == null || value === '') return null;
  const weight = Number(value);
  return weight != null && weight > 0 ? weight : null;
};

const normalizeAcquisitionType = (value: string | null | undefined) => {
  const type = value?.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!type) return null;
  if (type === 'free_agent') return 'free_agency';
  if (
    [
      'draft',
      'trade',
      'free_agency',
      'waivers',
      'signing',
      'foundational_signing',
      'expansion_signing',
      'expansion_draft',
      'team_transfer',
      'loan',
      'other',
    ].includes(type)
  ) {
    return type;
  }
  return null;
};

const officialNhlCurrentTeamMovement = (landing: NhlPlayerLanding) => ({
  date:
    landing.currentTeamStartDate?.slice(0, 10) ??
    landing.currentTeamRosterDate?.slice(0, 10) ??
    landing.acquisitionDate?.slice(0, 10) ??
    landing.acquiredDate?.slice(0, 10) ??
    null,
  acquisitionType: normalizeAcquisitionType(
    landing.currentTeamAcquisitionType ?? landing.acquisitionType,
  ),
});

const officialNhlJerseyNumberDate = (landing: NhlPlayerLanding) =>
  landing.currentJerseyNumberEffectiveDate?.slice(0, 10) ??
  landing.jerseyNumberEffectiveDate?.slice(0, 10) ??
  landing.currentSweaterNumberEffectiveDate?.slice(0, 10) ??
  landing.sweaterNumberEffectiveDate?.slice(0, 10) ??
  landing.jerseyNumberDate?.slice(0, 10) ??
  landing.sweaterNumberDate?.slice(0, 10) ??
  null;

const normalizeIsoDate = (value: string | null | undefined) => {
  const date = value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  return date;
};

const nhlSeasonCode = (seasonName: string | null | undefined, fallbackDate?: string | null) => {
  const seasonMatch = seasonName?.match(/(\d{4})\D+(\d{2,4})/);
  if (seasonMatch) {
    const start = Number(seasonMatch[1]);
    let end = Number(seasonMatch[2]);
    if (seasonMatch[2].length === 2) {
      end = Math.floor(start / 100) * 100 + end;
      if (end < start) end += 100;
    }
    return `${start}${end}`;
  }

  const date = normalizeIsoDate(fallbackDate);
  if (!date) return null;
  const [yearText, monthText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const start = month >= 7 ? year : year - 1;
  return `${start}${start + 1}`;
};

const nhlGameLogEntries = (
  response: NhlPlayerGameLogResponse | NhlPlayerGameLogEntry[],
) => {
  if (Array.isArray(response)) return response;
  return response.gameLog ?? response.games ?? [];
};

const optionalNumber = (value: unknown) => {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function nhlBoxscorePlayerHasJersey(
  boxscore: NhlBoxscoreResponse,
  playerNumber: string,
  jerseyNumber: number,
  teamCode: string | null,
) {
  const nhlPlayerNumber = Number(playerNumber);
  return (['away', 'home'] as const).some((side) => {
    const boxscoreTeam = boxscore?.[`${side}Team`];
    const boxscoreTeamAbbrev = readNhlText(boxscoreTeam?.abbrev);
    const boxscoreTeamCode = normalizeTeamCode(
      boxscoreTeamAbbrev,
    );
    if (teamCode && boxscoreTeamCode && boxscoreTeamCode !== teamCode) return false;

    const stats: NhlBoxscoreTeamStats = boxscore?.playerByGameStats?.[`${side}Team`] ?? {};
    return (['forwards', 'defense', 'goalies'] as const).some((group) =>
      Array.isArray(stats[group]) &&
      stats[group].some(
        (row) =>
          Number(row.playerId) === nhlPlayerNumber &&
          Number(row.sweaterNumber) === jerseyNumber,
      ),
    );
  });
}

async function inferNhlJerseyNumberDateFromGames({
  fetchNhlProxy,
  playerNumber,
  seasonCode,
  teamCode,
  jerseyNumber,
  stintStartDate,
}: {
  fetchNhlProxy: <T>(url: string) => Promise<T>;
  playerNumber: string;
  seasonCode: string | null;
  teamCode: string | null;
  jerseyNumber: number;
  stintStartDate?: string | null;
}) {
  if (!seasonCode || !teamCode || !playerNumber) return null;

  const entries: NhlPlayerGameLogEntry[] = [];
  for (const gameType of NHL_JERSEY_INFERENCE_GAME_TYPES) {
    try {
      const response = await fetchNhlProxy<NhlPlayerGameLogResponse | NhlPlayerGameLogEntry[]>(
        `https://api-web.nhle.com/v1/player/${playerNumber}/game-log/${seasonCode}/${gameType}`,
      );
      entries.push(...nhlGameLogEntries(response));
    } catch {
      // Playoff logs may not exist for every player; regular-season matches are enough.
    }
  }

  const stintStart = normalizeIsoDate(stintStartDate);
  const seenGameIds = new Set<string>();
  const candidates = entries
    .map((entry) => {
      const teamAbbrev =
        readNhlText(entry.teamAbbrev) ??
        (typeof entry.teamAbbrev === 'string' ? entry.teamAbbrev : null);
      return {
        gameId: entry.gameId == null ? null : String(entry.gameId),
        gameDate: normalizeIsoDate(entry.gameDate),
        teamCode: normalizeTeamCode(teamAbbrev),
        entryJerseyNumber: optionalNumber(entry.sweaterNumber ?? entry.jerseyNumber),
      };
    })
    .filter((entry) => entry.gameId && entry.gameDate)
    .filter((entry) => !stintStart || entry.gameDate! >= stintStart)
    .filter((entry) => !entry.teamCode || entry.teamCode === teamCode)
    .sort((a, b) => a.gameDate!.localeCompare(b.gameDate!))
    .filter((entry) => {
      if (!entry.gameId || seenGameIds.has(entry.gameId)) return false;
      seenGameIds.add(entry.gameId);
      return true;
    });

  for (const candidate of candidates) {
    if (candidate.entryJerseyNumber === jerseyNumber) return candidate.gameDate;

    try {
      const boxscore = await fetchNhlProxy<NhlBoxscoreResponse>(
        `https://api-web.nhle.com/v1/gamecenter/${candidate.gameId}/boxscore`,
      );
      if (nhlBoxscorePlayerHasJersey(boxscore, playerNumber, jerseyNumber, teamCode)) {
        return normalizeIsoDate(boxscore?.gameDate) ?? candidate.gameDate;
      }
    } catch {
      // Keep looking; an unavailable boxscore should not block later evidence.
    }
  }

  return null;
}

const formatHeight = (cm: number | null) => {
  if (!cm) return null;
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}" (${cm} cm)`;
};

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// ── Career stats table columns ──────────────────────────────────────────────
const statColumns: Column<PlayerCareerStatRecord>[] = [
  {
    type: 'logo',
    header: 'Team',
    getLogo: (r) => r.team_logo,
    getLogoDark: (r) => r.team_logo_dark,
    getLogoLight: (r) => r.team_logo_light,
    getName: (r) => r.team_name ?? '—',
    getCode: (r) => r.team_name?.slice(0, 3).toUpperCase() ?? '?',
  },
  { header: 'Season', key: 'season_name' },
  { header: '#', key: 'jersey_number', align: 'center' },
  { header: 'GP', key: 'gp', align: 'center' },
  { header: 'G', key: 'goals', align: 'center' },
  { header: 'A', key: 'assists', align: 'center' },
  { header: 'PTS', key: 'points', align: 'center' },
];

const STAT_LABELS = {
  GP: 'Games Played',
  G: 'Goals',
  A: 'Assists',
  P: 'Points',
  W: 'Wins',
  SO: 'Shootout Wins',
  GAA: 'Goals Against Average',
  'SV%': 'Save Percentage',
} as const;

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const teamCodePlaceholder = (stint: PlayerStintRecord) =>
  stint.team.code ?? (stint.team.name ? stint.team.name.slice(0, 3).toUpperCase() : 'TEAM');

const formatStintDates = (stint: PlayerStintRecord) => {
  const start = stint.start_date ? DATE_FMT.format(new Date(stint.start_date)) : null;
  const end = stint.end_date ? DATE_FMT.format(new Date(stint.end_date)) : null;
  if (start && end) return `${start} - ${end}`;
  if (start) return `${start} - Present`;
  if (end) return `Until ${end}`;
  return 'Dates not set';
};

type TeamHistoryStint = PlayerStintRecord & {
  collapsed_stints: PlayerStintRecord[];
};

export const collapseSameTeamStints = (stints: PlayerStintRecord[]): TeamHistoryStint[] => {
  const groups: PlayerStintRecord[][] = [];

  for (const stint of stints) {
    const currentGroup = groups[groups.length - 1];
    if (currentGroup?.[0]?.team_id === stint.team_id) {
      currentGroup.push(stint);
    } else {
      groups.push([stint]);
    }
  }

  return groups.map((group) => {
    const newest = group[0];
    const oldest = group[group.length - 1];

    return {
      ...newest,
      start_date: oldest.start_date ?? newest.start_date,
      end_date: newest.end_date,
      has_stats: group.some((stint) => stint.has_stats),
      can_delete: group.every((stint) => stint.can_delete !== false),
      collapsed_stints: group,
    };
  });
};

const teamCode = (code: string | null, name: string | null) =>
  code ?? (name ? name.slice(0, 3).toUpperCase() : 'TEAM');

const awardTeamPlaceName = (award: PlayerAwardRecord) => {
  const placeName = award.team_place_name?.trim();
  return placeName || null;
};

const awardTeamDisplayName = (award: PlayerAwardRecord) => {
  const splitName = award.team_team_name?.trim();
  if (splitName) return splitName;

  const fullName = award.team_name?.trim();
  const placeName = awardTeamPlaceName(award);
  if (fullName && placeName && fullName.toLowerCase().startsWith(placeName.toLowerCase())) {
    return fullName.slice(placeName.length).trim() || fullName;
  }

  return fullName || 'Team not recorded';
};

const sortPlayerAwards = (awards: PlayerAwardRecord[]) =>
  [...awards].sort(
    (a, b) =>
      (b.awarded_at ?? '').localeCompare(a.awarded_at ?? '') ||
      b.season_name.localeCompare(a.season_name) ||
      a.award_name.localeCompare(b.award_name),
  );

const PLAYOFF_CHAMPIONSHIP_AWARD_NAME = /\b(champions?|championship|cup winners?)\b/i;
const AWARD_NAME_HAS_CHAMPIONS_LABEL = /\b(champions?|championship)\b/i;

const isPlayoffChampionshipAward = (award: PlayerAwardRecord) =>
  award.stat_key === 'playoff_champion' ||
  (award.competition_scope === 'playoffs' &&
    PLAYOFF_CHAMPIONSHIP_AWARD_NAME.test(award.award_name));

const shouldShowChampionsLabel = (award: PlayerAwardRecord) =>
  isPlayoffChampionshipAward(award) && !AWARD_NAME_HAS_CHAMPIONS_LABEL.test(award.award_name);

const groupPlayerAwards = (awards: PlayerAwardRecord[]): PlayerAwardGroup[] => {
  const groups = new Map<string, PlayerAwardGroup>();

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
    awards: sortPlayerAwards(group.awards),
  }));
};

const awardInfoLabel = (group: PlayerAwardGroup) => {
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

const formatShortDate = (iso: string | null) => {
  if (!iso) return '—';
  return DATE_FMT.format(new Date(iso));
};

const dayBefore = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
};

const formatHistoryDateRange = (startDate: string, endDate: string | null) =>
  `${formatShortDate(startDate)} - ${endDate ? formatShortDate(endDate) : 'Present'}`;

const stintHistoryKey = (stint: PlayerStintRecord) => stint.roster_player_team_id ?? stint.id;

const hasCollapsedStints = (stint: PlayerStintRecord): stint is TeamHistoryStint =>
  'collapsed_stints' in stint && Array.isArray(stint.collapsed_stints);

const getCollapsedStints = (stint: PlayerStintRecord) =>
  hasCollapsedStints(stint) && stint.collapsed_stints.length > 0
    ? stint.collapsed_stints
    : [stint];

const getCollapsedJerseyHistory = (
  stint: PlayerStintRecord,
  jerseyHistoryByStint: Record<string, JerseyHistoryEntry[]>,
) => {
  const seenIds = new Set<string>();

  return getCollapsedStints(stint).flatMap((collapsedStint) => {
    const history = jerseyHistoryByStint[stintHistoryKey(collapsedStint)] ?? [];

    return history.filter((entry) => {
      if (seenIds.has(entry.id)) return false;
      seenIds.add(entry.id);
      return true;
    });
  });
};

const dateKey = (date: string | null | undefined) => date?.slice(0, 10) ?? null;

const seasonOverlapsStint = (season: SeasonRecord, stint: PlayerStintRecord) => {
  if (season.id === stint.season_id) return true;

  const seasonStart = dateKey(season.start_date);
  const seasonEnd = dateKey(season.end_date) ?? (season.is_current ? null : seasonStart);
  const stintStart = dateKey(stint.start_date);
  const stintEnd = dateKey(stint.end_date);

  if (stintStart && seasonEnd && seasonEnd < stintStart) return false;
  if (stintEnd && seasonStart && seasonStart > stintEnd) return false;

  return seasonStart != null || seasonEnd != null;
};

const findMissingPhotoSeason = (
  stint: PlayerStintRecord,
  seasons: SeasonRecord[],
  photoHistory: PlayerPhotoEntry[],
  teamLeagueId?: string | null,
) => {
  const fallbackLeagueId = seasons.find((season) => season.id === stint.season_id)?.league_id;
  const leagueId = teamLeagueId ?? fallbackLeagueId ?? null;
  const photoSeasonIds = new Set(
    photoHistory
      .filter((entry) => entry.team_id === stint.team_id)
      .map((entry) => entry.season_id),
  );

  return seasons
    .filter((season) => {
      if (leagueId && season.league_id !== leagueId) return false;
      return seasonOverlapsStint(season, stint) && !photoSeasonIds.has(season.id);
    })
    .sort(
      (a, b) =>
        (dateKey(b.start_date) ?? '').localeCompare(dateKey(a.start_date) ?? '') ||
        b.name.localeCompare(a.name),
    )[0];
};

type PhotoModalMode = 'set' | 'edit';

const buildJerseyHistoryRows = (
  stint: PlayerStintRecord,
  history: JerseyHistoryEntry[],
  currentStintKey: string | null,
  currentJerseyNumber: number | null,
) => {
  const historyKey = stintHistoryKey(stint);
  const entries = history.map((entry) => ({
    id: entry.id,
    jerseyNumber: entry.jersey_number,
    effectiveFrom: entry.effective_from,
    stintKey: entry.player_teams_id,
    historyEntry: entry as JerseyHistoryEntry | null,
  }));

  if (
    entries.length === 0 &&
    stint.jersey_number != null &&
    stint.start_date
  ) {
    entries.push({
      id: `assumed-${stint.id}`,
      jerseyNumber: stint.jersey_number,
      effectiveFrom: stint.start_date,
      stintKey: historyKey,
      historyEntry: null,
    });
  }

  return entries
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    .reverse()
    .map((entry, idx, reversed) => {
      const newerEntry = reversed[idx - 1];
      const endDate = idx === 0 ? (stint.end_date ?? null) : dayBefore(newerEntry.effectiveFrom);

      return {
        id: entry.id,
        jerseyNumber: entry.jerseyNumber,
        effectiveFrom: entry.effectiveFrom,
        historyEntry: entry.historyEntry,
        dateRange: formatHistoryDateRange(entry.effectiveFrom, endDate),
        current:
          entry.stintKey === currentStintKey &&
          idx === 0 &&
          currentJerseyNumber != null &&
          entry.jerseyNumber === currentJerseyNumber,
      };
    });
};

const formatSavePct = (value: number | null) => {
  if (value == null) return '—';
  return value.toFixed(3).replace(/^0/, '');
};

// Goals-against average = goals against per 60 minutes of ice time.
const formatGaa = (ga: number | null | undefined, toi: number | null | undefined) => {
  if (ga == null || !toi) return '—';
  return ((ga * 3600) / toi).toFixed(2);
};

const StatHeader = ({ label, tooltip }: { label: string; tooltip: string }) => (
  <Tooltip text={tooltip}>
    <span>{label}</span>
  </Tooltip>
);

const TeamCodeCell = ({ code, name }: { code: string | null; name: string | null }) => (
  <Tooltip text={name ?? teamCode(code, name)}>
    <span className={styles.teamCodeCell}>{teamCode(code, name)}</span>
  </Tooltip>
);

const StintHistoryDetails = ({
  stint,
  jerseyHistory,
  photoHistory,
  currentJerseyNumber,
  currentJerseyStintKey,
  currentPhotoHistoryId,
  initials,
  onPreviewPhoto,
  onChangePhoto,
  onEditJerseyHistoryEntry,
  onDeletePhotoEntry,
  onDeleteJerseyHistoryEntry,
}: {
  stint: PlayerStintRecord;
  jerseyHistory: JerseyHistoryEntry[];
  photoHistory: PlayerPhotoEntry[];
  currentJerseyNumber: number | null;
  currentJerseyStintKey: string | null;
  currentPhotoHistoryId: string | null;
  initials: string;
  onPreviewPhoto: (photo: string) => void;
  onChangePhoto: (
    stint: PlayerStintRecord,
    seasonId?: string | null,
    mode?: PhotoModalMode,
  ) => void;
  onEditJerseyHistoryEntry: (entry: JerseyHistoryEntry) => void;
  onDeletePhotoEntry: (entry: PlayerPhotoEntry) => void;
  onDeleteJerseyHistoryEntry: (entry: JerseyHistoryEntry) => void;
}) => {
  const jerseyRows = buildJerseyHistoryRows(
    stint,
    jerseyHistory,
    currentJerseyStintKey,
    currentJerseyNumber,
  );

  return (
    <div className={styles.stintHistoryGrid}>
      <div className={styles.stintHistorySection}>
        <span className={styles.stintHistoryTitle}>Season Photos</span>
        {photoHistory.length === 0 ? (
          <p className={styles.stintHistoryEmpty}>No season photos yet.</p>
        ) : (
          <ul className={styles.stintHistoryList}>
            {photoHistory.map((entry) => {
              const current = entry.id === currentPhotoHistoryId;

              return (
                <ListItem
                  key={entry.id}
                  size="compact"
                  className={styles.stintHistoryListItem}
                  name={entry.season_name ?? 'Season'}
                  preTextContent={
                    <PlayerAvatar
                      photo={entry.photo}
                      initials={initials}
                      primaryColor={stint.team.primary_color}
                      textColor={stint.team.text_color}
                      size={32}
                    />
                  }
                  rightContent={
                    current ? (
                      <Tag
                        label="Current"
                        intent="success"
                      />
                    ) : null
                  }
                  actions={[
                    {
                      icon: 'image',
                      tooltip: 'Edit season photo',
                      ariaLabel: 'Edit season photo',
                      onClick: () => onChangePhoto(stint, entry.season_id, 'edit'),
                    },
                    {
                      icon: 'delete',
                      intent: 'danger' as const,
                      tooltip: 'Delete season photo',
                      ariaLabel: 'Delete season photo',
                      onClick: () => onDeletePhotoEntry(entry),
                    },
                  ]}
                  ariaLabel={`Preview ${entry.season_name ?? 'season'} photo`}
                  onClick={() => onPreviewPhoto(entry.photo)}
                />
              );
            })}
          </ul>
        )}
      </div>

      <div className={styles.stintHistorySection}>
        <span className={styles.stintHistoryTitle}>Jersey Numbers</span>
        {jerseyRows.length === 0 ? (
          <p className={styles.stintHistoryEmpty}>No jersey number history yet.</p>
        ) : (
          <ul className={styles.stintHistoryList}>
            {jerseyRows.map((entry) => {
              return (
                <ListItem
                  key={entry.id}
                  size="compact"
                  className={styles.stintHistoryListItem}
                  name={entry.dateRange}
                  preTextContent={
                    <Chip
                      primaryColor={stint.team.primary_color}
                      textColor={stint.team.text_color}
                    >
                      {entry.jerseyNumber}
                    </Chip>
                  }
                  rightContent={
                    entry.current ? (
                      <Tag
                        label="Current"
                        intent="success"
                      />
                    ) : null
                  }
                  actions={
                    entry.historyEntry
                      ? [
                          {
                            icon: 'edit',
                            tooltip: 'Edit jersey number change',
                            onClick: () => onEditJerseyHistoryEntry(entry.historyEntry!),
                          },
                          {
                            icon: 'delete',
                            intent: 'danger' as const,
                            tooltip: 'Delete jersey number change',
                            ariaLabel: 'Delete jersey number change',
                            onClick: () => onDeleteJerseyHistoryEntry(entry.historyEntry!),
                          },
                        ]
                      : undefined
                  }
                />
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

const buildGameLogColumns = (isGoalie: boolean): Column<PlayerLastFiveGameRecord>[] => [
  {
    type: 'custom',
    header: 'Date',
    render: (row) => formatShortDate(row.scheduled_at),
  },
  {
    type: 'custom',
    header: 'Team',
    render: (row) => (
      <TeamCodeCell
        code={row.team_code}
        name={row.team_name}
      />
    ),
  },
  {
    type: 'custom',
    header: 'Opponent',
    render: (row) => (
      <span className={styles.opponentCell}>
        <span className={styles.opponentPrefix}>{row.is_home ? 'vs' : '@'}</span>
        <TeamCodeCell
          code={row.opponent_code}
          name={row.opponent_name}
        />
      </span>
    ),
  },
  ...(isGoalie
    ? [
        {
          type: 'custom' as const,
          header: (
            <StatHeader
              label="GS"
              tooltip="Games Started"
            />
          ),
          render: (row: PlayerLastFiveGameRecord) => (row.goalie_started ? 'Yes' : 'No'),
          align: 'center' as const,
        },
        {
          type: 'custom' as const,
          header: (
            <StatHeader
              label="SA"
              tooltip="Shots Against"
            />
          ),
          render: (row: PlayerLastFiveGameRecord) => row.shots_against ?? '—',
          align: 'center' as const,
        },
        {
          type: 'custom' as const,
          header: (
            <StatHeader
              label="GAA"
              tooltip="Goals Against Average"
            />
          ),
          render: (row: PlayerLastFiveGameRecord) => formatGaa(row.goals_against, row.time_on_ice),
          align: 'center' as const,
        },
        {
          type: 'custom' as const,
          header: (
            <StatHeader
              label="SV%"
              tooltip="Save Percentage"
            />
          ),
          render: (row: PlayerLastFiveGameRecord) => formatSavePct(row.save_pct),
          align: 'center' as const,
        },
      ]
    : [
        {
          header: (
            <StatHeader
              label="G"
              tooltip="Goals"
            />
          ),
          key: 'goals' as const,
          align: 'center' as const,
        },
        {
          header: (
            <StatHeader
              label="A"
              tooltip="Assist"
            />
          ),
          key: 'assists' as const,
          align: 'center' as const,
        },
        {
          header: (
            <StatHeader
              label="PTS"
              tooltip="Points"
            />
          ),
          key: 'points' as const,
          align: 'center' as const,
        },
      ]),
];

// ── Page ────────────────────────────────────────────────────────────────────
interface PlayerDetailsPageProps {
  mode?: 'admin' | 'user';
}

const PlayerDetailsPage = ({ mode = 'admin' }: PlayerDetailsPageProps) => {
  const navigate = useNavigate();
  const isAdminView = mode === 'admin';
  const {
    leagueCode,
    teamCode: routeTeamCode,
    playerSlug,
  } = useParams<{
    leagueCode: string;
    teamCode?: string;
    playerSlug: string;
  }>();
  const isLegacyIdRoute = !!playerSlug && UUID_PATTERN.test(playerSlug);
  const { routeLookup, loading: routeLookupLoading } = usePlayerRouteLookup(
    leagueCode,
    routeTeamCode,
    playerSlug,
    !isLegacyIdRoute,
    { mode },
  );
  const id = isLegacyIdRoute ? playerSlug : routeLookup?.player_id;
  const leagueId = isLegacyIdRoute ? leagueCode : routeLookup?.league_id;
  const teamId = isLegacyIdRoute ? routeTeamCode : routeLookup?.team_id;
  const { player, stats, loading: playerDetailsLoading } = usePlayerDetails(id, { mode });
  const loading = routeLookupLoading || playerDetailsLoading;
  const { awards: playerAwards, loading: playerAwardsLoading } = usePlayerAwards(id, { mode });
  const { lastFiveGames, loading: lastFiveGamesLoading } = usePlayerLastFiveGames(id, { mode });
  const { team: teamDetails } = useTeamDetails(teamId, { mode });
  const documentIcon =
    teamDetails?.icon ??
    teamDetails?.logo ??
    teamDetails?.logo_dark ??
    teamDetails?.logo_light ??
    player?.team_logo ??
    player?.team_logo_dark ??
    player?.team_logo_light;
  useDocumentIcon(documentIcon);
  const adminPlayerId = isAdminView ? (id ?? null) : null;
  const { stints } = usePlayerTradeHistory(adminPlayerId);
  const { byStint: jerseyHistoryByStint } = useJerseyHistory(adminPlayerId);
  const { photos: photoHistoryEntries = [], byTeam: photoHistoryByTeam } =
    usePlayerPhotoHistory(adminPlayerId);
  const {
    createStint,
    updateStint,
    deleteStint,
    changeJerseyNumber,
    updateJerseyHistoryEntry,
    deleteJerseyHistoryEntry,
    changePlayerPhoto,
    deletePlayerPhoto,
    uploadStintPhoto,
    saving: stintSaving,
  } = useStintActions(adminPlayerId);
  const { teams } = useTeams({ mode });
  const { seasons } = useSeasons(leagueId, { mode });
  const gameLogSeasons = seasons.filter((season) => !leagueId || season.league_id === leagueId);
  const playerSeasonIds = new Set<string>();
  stats.forEach((row) => {
    if (row.season_id) playerSeasonIds.add(row.season_id);
  });
  stints.forEach((stint) => {
    if (stint.season_id) playerSeasonIds.add(stint.season_id);
  });
  const playerSeasonOptions = gameLogSeasons.filter((season) => playerSeasonIds.has(season.id));
  const defaultPlayerSeasonId = getLatestEndedSeasonId(playerSeasonOptions);
  const [seasonStatsSeasonId, setSeasonStatsSeasonId] = useState<string | null>(null);
  const effectiveSeasonStatsSeasonId = seasonStatsSeasonId ?? defaultPlayerSeasonId;
  const {
    currentSeasonStats: seasonStats,
    loading: seasonStatsLoading,
  } = usePlayerCurrentSeasonStats(id, {
    mode,
    seasonId: effectiveSeasonStatsSeasonId,
    requireSeasonId: true,
  });
  const renderedPlayerSeasonOptions =
    seasonStats?.season_id && !playerSeasonOptions.some((season) => season.id === seasonStats.season_id)
      ? gameLogSeasons.filter(
          (season) => playerSeasonIds.has(season.id) || season.id === seasonStats.season_id,
        )
      : playerSeasonOptions;
  const queryClient = useQueryClient();
  const [activeTab, handleTabChange] = useTabState(
    isAdminView ? 'tab:player-details' : 'tab:user-player-details',
  );
  const [editPlayerOpen, setEditPlayerOpen] = useState(false);
  const [editPlayerInfoOpen, setEditPlayerInfoOpen] = useState(false);
  const [editingStint, setEditingStint] = useState<PlayerStintRecord | null>(null);
  const [deletingStint, setDeletingStint] = useState<PlayerStintRecord | null>(null);
  const [creatingStint, setCreatingStint] = useState(false);
  const [changingJerseyStint, setChangingJerseyStint] = useState<PlayerStintRecord | null>(null);
  const [editingJerseyHistoryEntry, setEditingJerseyHistoryEntry] =
    useState<JerseyHistoryEntry | null>(null);
  const [deletingJerseyHistoryEntry, setDeletingJerseyHistoryEntry] =
    useState<JerseyHistoryEntry | null>(null);
  const [changingPhotoStint, setChangingPhotoStint] = useState<PlayerStintRecord | null>(null);
  const [deletingPhotoEntry, setDeletingPhotoEntry] = useState<PlayerPhotoEntry | null>(null);
  const [changingPhotoSeasonId, setChangingPhotoSeasonId] = useState<string | null>(null);
  const [changingPhotoMode, setChangingPhotoMode] = useState<PhotoModalMode>('set');
  const [photoPreviewSrc, setPhotoPreviewSrc] = useState<string | null>(null);
  const [movePlayerOpen, setMovePlayerOpen] = useState(false);
  const [autoFillPlayerBusy, setAutoFillPlayerBusy] = useState(false);
  const [retirePlayerOpen, setRetirePlayerOpen] = useState(false);
  const [playerStatusSaving, setPlayerStatusSaving] = useState(false);
  const [gameLogSeasonId, setGameLogSeasonId] = useState('all');
  const [gameLogType, setGameLogType] = useState('all');
  const [gameLogPage, setGameLogPage] = useState(1);
  const [awardViewMode, setAwardViewMode] = useState<AwardViewMode>('list');
  const {
    gameLogs,
    total: gameLogsTotal,
    loading: gameLogsLoading,
  } = usePlayerGameLogs(
    id,
    {
      seasonId: gameLogSeasonId === 'all' ? null : gameLogSeasonId,
      gameType: gameLogType === 'all' ? null : gameLogType,
      page: gameLogPage,
      pageSize: GAME_LOG_PAGE_SIZE,
    },
    { mode },
  );

  const openChangePhotoModal = (
    stint: PlayerStintRecord,
    seasonId: string | null = null,
    modalMode: PhotoModalMode = 'set',
  ) => {
    setChangingPhotoStint(stint);
    setChangingPhotoSeasonId(seasonId);
    setChangingPhotoMode(modalMode);
  };

  const closeChangePhotoModal = () => {
    setChangingPhotoStint(null);
    setChangingPhotoSeasonId(null);
    setChangingPhotoMode('set');
  };

  const updatePlayer = async (
    playerId: string,
    payload: Partial<CreatePlayerData>,
  ): Promise<boolean> => {
    try {
      await axios.patch(`${API}/admin/players/${playerId}`, payload, { headers: authHeaders() });
      toast.success('Player updated!');
      await queryClient.invalidateQueries({ queryKey: ['player', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      await queryClient.invalidateQueries({ queryKey: ['game-goals'] });
      return true;
    } catch {
      toast.error('Failed to update player');
      return false;
    }
  };

  const invalidatePlayerStatusQueries = async (playerId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['player', playerId] }),
      queryClient.invalidateQueries({ queryKey: ['players'] }),
      queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] }),
      queryClient.invalidateQueries({ queryKey: ['game-roster'] }),
      queryClient.invalidateQueries({ queryKey: ['game-lineup'] }),
      queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['game-goals'] }),
      queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] }),
    ]);
  };

  const retirePlayer = async (retirementDate: string): Promise<boolean> => {
    if (!adminPlayerId) return false;
    setPlayerStatusSaving(true);
    try {
      await axios.patch(
        `${API}/admin/players/${adminPlayerId}/retire`,
        { retirement_date: retirementDate },
        { headers: authHeaders() },
      );
      toast.success('Player retired!');
      await invalidatePlayerStatusQueries(adminPlayerId);
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Failed to retire player'));
      return false;
    } finally {
      setPlayerStatusSaving(false);
    }
  };

  const unretirePlayer = async () => {
    if (!adminPlayerId) return;
    setPlayerStatusSaving(true);
    try {
      await axios.patch(
        `${API}/admin/players/${adminPlayerId}/unretire`,
        {},
        { headers: authHeaders() },
      );
      toast.success('Player unretired!');
      await invalidatePlayerStatusQueries(adminPlayerId);
    } catch (err) {
      toast.error(apiError(err, 'Failed to unretire player'));
    } finally {
      setPlayerStatusSaving(false);
    }
  };

  // Wraps updateStint so TeamPlayerEditModal can save jersey_number + photo on the latest stint.
  const updatePlayerTeam = async (
    _playerId: string,
    _teamId: string,
    _seasonId: string,
    payload: { jersey_number?: number | null; photo?: string | null },
  ): Promise<boolean> => {
    const stint = stints[0];
    if (!stint) return false;
    return updateStint(stint.id, payload);
  };

  const handleDeleteStint = async () => {
    if (!deletingStint) return;
    const ok = await deleteStint(deletingStint.id);
    if (ok) setDeletingStint(null);
  };

  const handleDeletePhotoEntry = async () => {
    if (!deletingPhotoEntry) return;
    const ok = await deletePlayerPhoto(deletingPhotoEntry.id);
    if (ok) setDeletingPhotoEntry(null);
  };

  const handleDeleteJerseyHistoryEntry = async () => {
    if (!deletingJerseyHistoryEntry) return;
    const ok = await deleteJerseyHistoryEntry(deletingJerseyHistoryEntry.id);
    if (ok) setDeletingJerseyHistoryEntry(null);
  };

  const movePlayer = async (
    playerId: string,
    seasonId: string,
    toTeamId: string,
    moveDate: string,
    jerseyNumber?: number | null,
    position?: string | null,
    acquisitionType?: string | null,
    options: { showToast?: boolean; navigateAfter?: boolean } = {},
  ): Promise<boolean> => {
    try {
      await axios.post(
        `${API}/admin/player-teams/trade`,
        {
          player_id: playerId,
          season_id: seasonId,
          to_team_id: toTeamId,
          trade_date: moveDate,
          jersey_number: jerseyNumber ?? null,
          position: position ?? null,
          acquisition_type: acquisitionType ?? null,
        },
        { headers: authHeaders() },
      );

      if (options.showToast !== false) toast.success('Player moved successfully!');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['player', playerId] }),
        queryClient.invalidateQueries({ queryKey: ['player-trade-history', playerId] }),
        queryClient.invalidateQueries({ queryKey: ['jersey-history', playerId] }),
        queryClient.invalidateQueries({ queryKey: ['players'] }),
        queryClient.invalidateQueries({ queryKey: ['teams', teamId] }),
        queryClient.invalidateQueries({ queryKey: ['teams', toTeamId] }),
        queryClient.invalidateQueries({ queryKey: ['game-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['game-lineup'] }),
        queryClient.invalidateQueries({ queryKey: ['game-goalie-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['game-goals'] }),
        queryClient.invalidateQueries({ queryKey: ['shootout-attempts'] }),
      ]);

      if (options.navigateAfter !== false) {
        const toTeam = teams.find((team) => team.id === toTeamId);
        navigate(
          buildPlayerDetailsPath({
            leagueCode,
            teamCode: toTeam?.code ?? toTeamId,
            firstName: player?.first_name,
            lastName: player?.last_name,
            jerseyNumber,
          }),
        );
      }
      return true;
    } catch (err) {
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : 'Failed to move player';
      toast.error(message);
      return false;
    }
  };

  const latestStint = stints[0];
  const teamHistoryStints = collapseSameTeamStints(stints);
  const fullName = player ? `${player.first_name} ${player.last_name}` : 'Not Found';
  const currentLeagueCode = normalizeTeamCode(
    routeLookup?.league_code ?? teamDetails?.league_code ?? leagueCode,
  );

  const fetchNhlProxy = async <T,>(url: string) => {
    const { data } = await axios.get<T>(`${API}/admin/games/nhl-api`, {
      headers: authHeaders(),
      params: { url },
    });
    return data;
  };

  const fetchPwhlProxy = async <T,>(url: string) => {
    const { data } = await axios.get<T>(`${API}/admin/games/pwhl-api`, {
      headers: authHeaders(),
      params: { url },
    });
    return data;
  };

  const handleAutoFillPlayerData = async () => {
    if (
      !player?.id ||
      !player.league_player_number ||
      !['NHL', 'PWHL'].includes(currentLeagueCode ?? '')
    ) {
      return;
    }

    const autoFillLeagueLabel = currentLeagueCode === 'PWHL' ? 'PWHL' : 'NHL';
    setAutoFillPlayerBusy(true);
    const progressToastId = toast.loading(
      `Auto-filling player data: fetching ${autoFillLeagueLabel} player...`,
      {
        autoClose: false,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        hideProgressBar: false,
        pauseOnHover: false,
        progress: 0,
        progressClassName: styles.autoFillProgressBar,
      },
    );

    const updateProgressToast = (completedSteps: number, message: string) => {
      toast.update(progressToastId, {
        render: message,
        isLoading: true,
        autoClose: false,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        hideProgressBar: false,
        pauseOnHover: false,
        progress: Math.min(completedSteps / PLAYER_AUTOFILL_PROGRESS_STEPS, 0.98),
        progressClassName: styles.autoFillProgressBar,
      });
    };

    const finishProgressToast = (type: TypeOptions, message: string) => {
      toast.update(progressToastId, {
        render: message,
        type,
        isLoading: false,
        autoClose: type === 'success' ? AUTOFILL_RESULT_TOAST_MS : AUTOFILL_FAILURE_TOAST_MS,
        closeButton: true,
        closeOnClick: true,
        draggable: true,
        hideProgressBar: true,
        pauseOnHover: true,
        progress: 1,
        progressClassName: styles.autoFillProgressBar,
      });
    };

    try {
      if (currentLeagueCode === 'PWHL') {
        const profile = await fetchPwhlProxy<PwhlPlayerProfile>(
          pwhlPlayerProfileUrl(player.league_player_number),
        );
        const info = profile.info;
        if (!info) throw new Error('PWHL player profile did not include player info.');

        updateProgressToast(1, 'Auto-filling player data: saving PWHL player details...');
        const birthPlace = formatPwhlBirthPlace(info.birthPlace);
        const position = normalizeNhlPosition(info.position);
        const shoots = normalizeShoots(
          position === 'G'
            ? readPwhlText(info.catches) ?? readPwhlText(info.shoots)
            : readPwhlText(info.shoots) ?? readPwhlText(info.catches),
        );
        const heightCm = parsePwhlHeightCm(
          info.height ?? info.height_sans_hyphen ?? info.height_hyphenated,
        );
        const weightLbs = parsePwhlWeightLbs(info.weight);
        const payload: Partial<CreatePlayerData> = {};
        const firstName = readPwhlText(info.firstName);
        const lastName = readPwhlText(info.lastName);
        const birthDate = normalizeIsoDate(info.birthDate);

        if (firstName) payload.first_name = firstName;
        if (lastName) payload.last_name = lastName;
        if (birthDate) payload.date_of_birth = birthDate;
        if (birthPlace.city) payload.birth_city = birthPlace.city;
        if (birthPlace.country) payload.birth_country = birthPlace.country;
        if (heightCm != null) payload.height_cm = heightCm;
        if (weightLbs != null) payload.weight_lbs = weightLbs;
        if (position) payload.position = position;
        if (shoots) payload.shoots = shoots;

        await axios.patch(`${API}/admin/players/${player.id}`, payload, { headers: authHeaders() });

        const profileImage = readPwhlText(info.profileImage);
        let photoUpdated = false;
        if (latestStint && profileImage) {
          updateProgressToast(2, 'Auto-filling player data: saving PWHL player photo...');
          await axios.post(
            `${API}/admin/player-teams/history/${player.id}/photos`,
            {
              team_id: latestStint.team_id,
              season_id: latestStint.season_id,
              photo: profileImage,
            },
            { headers: authHeaders() },
          );
          photoUpdated = true;
        }

        updateProgressToast(4, 'Auto-filling player data: refreshing player data...');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['player', player.id] }),
          queryClient.invalidateQueries({ queryKey: ['player-trade-history', player.id] }),
          queryClient.invalidateQueries({ queryKey: ['player-photo-history', player.id] }),
          queryClient.invalidateQueries({ queryKey: ['players'] }),
          queryClient.invalidateQueries({ queryKey: ['game-roster'] }),
          queryClient.invalidateQueries({ queryKey: ['game-lineup'] }),
        ]);

        finishProgressToast(
          'success',
          photoUpdated ? 'Player data and photo auto-filled.' : 'Player data auto-filled.',
        );
        return;
      }

      const landing = await fetchNhlProxy<NhlPlayerLanding>(
        `https://api-web.nhle.com/v1/player/${player.league_player_number}/landing`,
      );
      updateProgressToast(1, 'Auto-filling player data: saving NHL player details...');
      const firstName = readNhlText(landing.firstName);
      const lastName = readNhlText(landing.lastName);
      const heightCm =
        landing.heightInCentimeters ??
        (landing.heightInInches == null ? null : Math.round(landing.heightInInches * 2.54));
      const birthCity = formatNhlBirthCity(landing);
      const position = normalizeNhlPosition(landing.position);
      const shoots = normalizeShoots(landing.shootsCatches);
      const payload: Partial<CreatePlayerData> = {};
      if (firstName) payload.first_name = firstName;
      if (lastName) payload.last_name = lastName;
      if (landing.birthDate) payload.date_of_birth = landing.birthDate;
      if (birthCity) payload.birth_city = birthCity;
      if (landing.birthCountry) payload.birth_country = landing.birthCountry;
      if (heightCm != null) payload.height_cm = heightCm;
      if (landing.weightInPounds != null) payload.weight_lbs = landing.weightInPounds;
      if (position) payload.position = position;
      if (shoots) payload.shoots = shoots;

      await axios.patch(`${API}/admin/players/${player.id}`, payload, { headers: authHeaders() });
      updateProgressToast(2, 'Auto-filling player data: checking team and jersey history...');

      const officialMovement = officialNhlCurrentTeamMovement(landing);
      const landingTeamCode = normalizeTeamCode(landing.currentTeamAbbrev);
      const destinationTeam = landingTeamCode
        ? teams.find(
            (team) =>
              normalizeTeamCode(team.code) === landingTeamCode &&
              (!leagueId || team.league_id === leagueId),
          )
        : null;
      let movementRecorded = false;
      let jerseyUpdated = false;
      let jerseyDateInferred = false;
      let movementSkippedMissingDate = false;
      let jerseySkippedMissingDate = false;

      if (latestStint && destinationTeam && destinationTeam.id !== latestStint.team_id) {
        if (officialMovement.date) {
          updateProgressToast(3, 'Auto-filling player data: recording team movement...');
          movementRecorded = await movePlayer(
            player.id,
            latestStint.season_id,
            destinationTeam.id,
            officialMovement.date,
            landing.sweaterNumber ?? null,
            position,
            officialMovement.acquisitionType,
            { showToast: false, navigateAfter: false },
          );
        } else {
          movementSkippedMissingDate = true;
        }
      } else if (
        latestStint &&
        landing.sweaterNumber != null &&
        landing.sweaterNumber !== latestStint.jersey_number
      ) {
        let jerseyEffectiveDate = officialNhlJerseyNumberDate(landing);
        if (!jerseyEffectiveDate) {
          updateProgressToast(
            3,
            `Auto-filling player data: finding first game with #${landing.sweaterNumber}...`,
          );
          const latestStintSeason = seasons.find((season) => season.id === latestStint.season_id);
          jerseyEffectiveDate = await inferNhlJerseyNumberDateFromGames({
            fetchNhlProxy,
            playerNumber: player.league_player_number,
            seasonCode: nhlSeasonCode(latestStintSeason?.name, latestStint.start_date),
            teamCode: landingTeamCode ?? normalizeTeamCode(latestStint.team.code),
            jerseyNumber: landing.sweaterNumber,
            stintStartDate: latestStint.start_date,
          });
          jerseyDateInferred = !!jerseyEffectiveDate;
        }
        if (jerseyEffectiveDate) {
          updateProgressToast(4, 'Auto-filling player data: recording jersey number change...');
          jerseyUpdated = await changeJerseyNumber(
            latestStint,
            landing.sweaterNumber,
            jerseyEffectiveDate,
          );
          if (jerseyUpdated && position && position !== latestStint.position) {
            await updateStint(latestStint.id, { position });
          }
        } else {
          jerseySkippedMissingDate = true;
        }
      }

      updateProgressToast(4, 'Auto-filling player data: refreshing player data...');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['player', player.id] }),
        queryClient.invalidateQueries({ queryKey: ['player-trade-history', player.id] }),
        queryClient.invalidateQueries({ queryKey: ['jersey-history', player.id] }),
        queryClient.invalidateQueries({ queryKey: ['players'] }),
        queryClient.invalidateQueries({ queryKey: ['game-roster'] }),
        queryClient.invalidateQueries({ queryKey: ['game-lineup'] }),
      ]);

      if (movementSkippedMissingDate) {
        finishProgressToast(
          'warning',
          'Player data auto-filled. Movement needs an official acquisition date.',
        );
      } else if (jerseySkippedMissingDate) {
        finishProgressToast(
          'warning',
          'Player data auto-filled. Jersey change was skipped because no first game with the new number was found.',
        );
      } else if (movementRecorded) {
        finishProgressToast('success', 'Player data auto-filled and movement recorded.');
      } else if (jerseyUpdated && jerseyDateInferred) {
        finishProgressToast(
          'success',
          'Player data and jersey number auto-filled from first game with new number.',
        );
      } else if (jerseyUpdated) {
        finishProgressToast('success', 'Player data and jersey number auto-filled.');
      } else {
        finishProgressToast('success', 'Player data auto-filled.');
      }
    } catch (err) {
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : 'Failed to auto-fill player data';
      finishProgressToast('error', message);
    } finally {
      setAutoFillPlayerBusy(false);
    }
  };

  const leagueHref = isAdminView
    ? buildLeagueDetailsPath({
        leagueCode: teamDetails?.league_code ?? routeLookup?.league_code ?? leagueCode,
        leagueId,
      })
    : '/games';
  const hasTeamRoute = !!(teamId || routeLookup?.team_id || routeTeamCode);
  const teamHref = hasTeamRoute
    ? isAdminView
      ? buildTeamDetailsPath({
          leagueCode: teamDetails?.league_code ?? routeLookup?.league_code ?? leagueCode,
          leagueId,
          teamCode: teamDetails?.code ?? routeLookup?.team_code ?? routeTeamCode,
          teamId,
        })
      : buildUserTeamDetailsPath({
          leagueCode: teamDetails?.league_code ?? routeLookup?.league_code ?? leagueCode,
          leagueId,
          teamCode: teamDetails?.code ?? routeLookup?.team_code ?? routeTeamCode,
          teamId,
        })
    : leagueHref;
  const canonicalPlayerPath =
    player && routeLookup
      ? routeLookup.team_id && routeLookup.team_code
        ? isAdminView
          ? `${buildTeamDetailsPath({
              leagueCode: routeLookup.league_code,
              teamCode: routeLookup.team_code,
              teamId: routeLookup.team_id,
            })}/players/${routeLookup.player_slug}`
          : `${buildUserTeamDetailsPath({
              leagueCode: routeLookup.league_code,
              teamCode: routeLookup.team_code,
              teamId: routeLookup.team_id,
            })}/players/${routeLookup.player_slug}`
        : isAdminView
          ? `${buildLeagueDetailsPath({
              leagueCode: routeLookup.league_code,
              leagueId: routeLookup.league_id,
            })}/players/${routeLookup.player_slug}`
          : `/leagues/${toRouteSlug(routeLookup.league_code) || routeLookup.league_id}/players/${
              routeLookup.player_slug
            }`
      : null;

  useEffect(() => {
    if (isLegacyIdRoute || !canonicalPlayerPath) return;
    const leagueMatches = toRouteSlug(leagueCode) === toRouteSlug(routeLookup?.league_code);
    const teamMatches =
      routeLookup?.team_code == null ||
      toRouteSlug(routeTeamCode) === toRouteSlug(routeLookup.team_code);
    if (leagueMatches && teamMatches && playerSlug === routeLookup?.player_slug) {
      return;
    }
    navigate(canonicalPlayerPath, { replace: true });
  }, [
    canonicalPlayerPath,
    isLegacyIdRoute,
    leagueCode,
    navigate,
    playerSlug,
    routeLookup?.league_code,
    routeLookup?.player_slug,
    routeLookup?.team_code,
    routeTeamCode,
  ]);

  useEffect(() => {
    if (!player) return;
    document.title = fullName;
    return () => {
      document.title = 'Hockey Tracker';
    };
  }, [player, fullName]);

  usePageBreadcrumbs(
    loading
      ? null
      : {
          backPath: isAdminView ? teamHref : hasTeamRoute ? teamHref : '/games',
          backLabel: isAdminView
            ? hasTeamRoute
              ? `Back to ${teamDetails?.name ?? 'Team'}`
              : 'Back to League'
            : hasTeamRoute
              ? `Back to ${teamDetails?.name ?? 'Team'}`
              : 'Back to Games',
          items: isAdminView
            ? [
                {
                  label:
                    teamDetails?.league_code ?? routeLookup?.league_code ?? leagueCode ?? '...',
                  path: leagueHref,
                },
                ...(hasTeamRoute
                  ? [
                      {
                        label: latestStint?.team.name ?? teamDetails?.name ?? '...',
                        path: teamHref,
                      },
                    ]
                  : []),
                { label: fullName },
              ]
            : [
                { label: 'Games', path: '/games' },
                {
                  label:
                    teamDetails?.league_code ?? routeLookup?.league_code ?? leagueCode ?? '...',
                },
                ...(hasTeamRoute
                  ? [
                      {
                        label: latestStint?.team.name ?? teamDetails?.name ?? '...',
                        path: teamHref,
                      },
                    ]
                  : []),
                { label: fullName },
              ],
        },
    [
      loading,
      teamHref,
      teamDetails?.name,
      teamDetails?.league_code,
      teamDetails?.league_name,
      latestStint?.team.name,
      fullName,
      hasTeamRoute,
      isAdminView,
      leagueCode,
      leagueId,
      leagueHref,
      routeLookup?.league_code,
    ],
  );

  useEffect(() => {
    if (loading || player) return;
    navigate(teamHref, { replace: true });
  }, [loading, navigate, player, teamHref]);

  if (loading) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading player…</p>
      </div>
    );
  }

  if (!player) return <p className={styles.loaderText}>Player not found.</p>;

  const playerStatus = getPlayerStatus(player);
  const initials = `${player.first_name[0]}${player.last_name[0]}`;
  const heroTeam =
    latestStint?.team ??
    (teamDetails
      ? {
          id: teamDetails.id,
          name: teamDetails.name,
          code: teamDetails.code,
          logo: teamDetails.logo,
          logo_dark: teamDetails.logo_dark,
          logo_light: teamDetails.logo_light,
          primary_color: teamDetails.primary_color,
          text_color: teamDetails.text_color,
        }
      : player.team_id
        ? {
            id: player.team_id,
            name: player.team_name ?? null,
            code: player.team_code ?? null,
            logo: player.team_logo ?? null,
            logo_dark: player.team_logo_dark ?? null,
            logo_light: player.team_logo_light ?? null,
            primary_color: player.primary_color ?? null,
            text_color: player.text_color ?? null,
          }
        : null);
  const jerseyNumber = latestStint?.jersey_number ?? player.jersey_number ?? null;
  // Use the first stint (active) photo; if that's missing, fall back to the most-recent
  // historical stint that does have a photo; then fall back to the global player photo.
  const heroPhotoStint = stints.find((s) => s.photo);
  const photo = heroPhotoStint?.photo ?? player.photo;
  const currentPhotoHistoryId =
    photo == null
      ? null
      : (photoHistoryEntries.find(
          (entry) =>
            entry.photo === photo &&
            (heroPhotoStint == null || entry.team_id === heroPhotoStint.team_id),
        )?.id ?? null);
  const currentJerseyStintKey = latestStint ? stintHistoryKey(latestStint) : null;
  const avatarBg = heroTeam?.primary_color ?? undefined;
  const avatarColor = heroTeam?.text_color ?? undefined;
  const effectivePosition = latestStint?.position ?? player.position;
  const canMovePlayer = !!(
    isAdminView &&
    latestStint?.team_id &&
    latestStint?.season_id &&
    !latestStint?.end_date
  );
  const canAutoFillPlayerData = !!(
    isAdminView &&
    (currentLeagueCode === 'NHL' || currentLeagueCode === 'PWHL') &&
    player.league_player_number
  );
  const copyLeaguePlayerNumber = async () => {
    if (!player.league_player_number) return;

    try {
      await copyTextToClipboard(player.league_player_number);
      toast.success('League player number copied.');
    } catch {
      toast.error('Failed to copy league player number.');
    }
  };
  const playerActionItems = [
    ...(canAutoFillPlayerData
      ? [
          {
            label: autoFillPlayerBusy ? 'Auto-filling Player Data...' : 'Auto-fill Player Data',
            icon: 'manage_search',
            disabled: autoFillPlayerBusy,
            onClick: handleAutoFillPlayerData,
          },
        ]
      : []),
    ...(canMovePlayer
      ? [
          {
            label: 'Move Player',
            icon: 'swap_horiz',
            onClick: () => setMovePlayerOpen(true),
          },
        ]
      : []),
    ...(isAdminView
      ? playerStatus === 'retired'
        ? [
            {
              label: 'Unretire Player',
              icon: 'undo',
              disabled: playerStatusSaving,
              onClick: unretirePlayer,
            },
          ]
        : [
            {
              label: 'Retire Player',
              icon: 'event_busy',
              intent: 'danger' as const,
              disabled: playerStatusSaving,
              onClick: () => setRetirePlayerOpen(true),
            },
          ]
      : []),
  ];
  const positionLabel = formatPlayerPosition(effectivePosition);
  const isGoalie = effectivePosition === 'G';
  const buildGamePath = (row: PlayerLastFiveGameRecord) =>
    isAdminView
      ? buildGameDetailsPath({
          leagueCode: routeLookup?.league_code ?? leagueCode,
          leagueId,
          seasonName: row.season_name,
          seasonId: row.season_id,
          gameId: row.game_id,
          awayTeamCode: row.is_home ? row.opponent_code : row.team_code,
          homeTeamCode: row.is_home ? row.team_code : row.opponent_code,
          scheduledAt: row.scheduled_at,
        })
      : buildUserGameDetailsPath({
          gameId: row.game_id,
          awayTeamCode: row.is_home ? row.opponent_code : row.team_code,
          homeTeamCode: row.is_home ? row.team_code : row.opponent_code,
          scheduledAt: row.scheduled_at,
        });
  const recentGameColumns: Column<PlayerLastFiveGameRecord>[] = [
    {
      type: 'custom',
      header: 'Date',
      render: (row) => formatShortDate(row.scheduled_at),
    },
    {
      type: 'custom',
      header: 'Team',
      render: (row) => (
        <TeamCodeCell
          code={row.team_code}
          name={row.team_name}
        />
      ),
    },
    {
      type: 'custom',
      header: 'Opponent',
      render: (row) => (
        <span className={styles.opponentCell}>
          <span className={styles.opponentPrefix}>{row.is_home ? 'vs' : '@'}</span>
          <TeamCodeCell
            code={row.opponent_code}
            name={row.opponent_name}
          />
        </span>
      ),
    },
    ...(isGoalie
      ? [
          {
            type: 'custom' as const,
            header: (
              <StatHeader
                label="GS"
                tooltip="Games Started"
              />
            ),
            render: (row: PlayerLastFiveGameRecord) => (row.goalie_started ? 'Yes' : 'No'),
            align: 'center' as const,
          },
          {
            type: 'custom' as const,
            header: (
              <StatHeader
                label="SA"
                tooltip="Shots Against"
              />
            ),
            render: (row: PlayerLastFiveGameRecord) => row.shots_against ?? '—',
            align: 'center' as const,
          },
          {
            type: 'custom' as const,
            header: (
              <StatHeader
                label="GAA"
                tooltip="Goals Against Average"
              />
            ),
            render: (row: PlayerLastFiveGameRecord) =>
              formatGaa(row.goals_against, row.time_on_ice),
            align: 'center' as const,
          },
          {
            type: 'custom' as const,
            header: (
              <StatHeader
                label="SV%"
                tooltip="Save Percentage"
              />
            ),
            render: (row: PlayerLastFiveGameRecord) => formatSavePct(row.save_pct),
            align: 'center' as const,
          },
        ]
      : [
          {
            header: (
              <StatHeader
                label="G"
                tooltip="Goals"
              />
            ),
            key: 'goals' as const,
            align: 'center' as const,
          },
          {
            header: (
              <StatHeader
                label="A"
                tooltip="Assist"
              />
            ),
            key: 'assists' as const,
            align: 'center' as const,
          },
          {
            header: (
              <StatHeader
                label="PTS"
                tooltip="Points"
              />
            ),
            key: 'points' as const,
            align: 'center' as const,
          },
        ]),
  ];
  const gameLogColumns = buildGameLogColumns(isGoalie);
  const gameLogPageCount = Math.max(1, Math.ceil(gameLogsTotal / GAME_LOG_PAGE_SIZE));
  const playerAwardGroups = groupPlayerAwards(playerAwards);
  const sortedPlayerAwards = sortPlayerAwards(playerAwards);
  const handleSeasonChange = (value: string) => {
    setGameLogSeasonId(value);
    setGameLogPage(1);
  };

  const playerEditTarget: TeamPlayerRecord = {
    ...player,
    photo,
    player_team_id: latestStint?.roster_player_team_id ?? null,
    jersey_number: latestStint?.jersey_number ?? null,
    team_id: latestStint?.team_id ?? null,
    team_name: latestStint?.team.name ?? null,
    primary_color: latestStint?.team.primary_color ?? null,
    text_color: latestStint?.team.text_color ?? null,
    is_prospect: latestStint?.is_prospect ?? false,
  };

  const playerInfoCard = (
    <Section
      title="Player Info"
      className={styles.playerInfoCard}
      action={
        isAdminView ? (
          <Button
            variant="outlined"
            intent="neutral"
            icon="edit"
            size="medium"
            onClick={() => setEditPlayerInfoOpen(true)}
          />
        ) : null
      }
    >
      <div className={styles.infoPrimary}>
        <div className={styles.infoPrimaryRow}>
          <InfoCell
            label="League Player Number"
            value={player.league_player_number}
            onCopy={copyLeaguePlayerNumber}
          />
          <InfoCell
            label="Rookie Season"
            value={player.rookie_season_name}
          />
        </div>
        <Divider className={styles.infoPrimaryDivider} />
      </div>
      <div className={styles.infoGrid}>
        <InfoCell
          label="Date of Birth"
          value={formatDate(player.date_of_birth)}
        />
        <InfoCell
          label="Birth City"
          value={player.birth_city}
        />
        <InfoCell
          label="Birth Country"
          value={player.birth_country}
        />
        <InfoCell
          label="Height"
          value={formatHeight(player.height_cm)}
        />
        <InfoCell
          label="Weight"
          value={player.weight_lbs ? `${player.weight_lbs} lbs` : null}
        />
        <InfoCell
          label={player.position === 'G' ? 'Catches' : 'Shoots'}
          value={player.shoots === 'L' ? 'Left' : player.shoots === 'R' ? 'Right' : null}
        />
      </div>
    </Section>
  );

  const seasonStatsCard = (
    <SeasonStatsSection
      stats={seasonStats}
      isGoalie={isGoalie}
      seasons={renderedPlayerSeasonOptions}
      selectedSeasonId={effectiveSeasonStatsSeasonId ?? seasonStats?.season_id ?? null}
      loading={seasonStatsLoading}
      onSeasonChange={setSeasonStatsSeasonId}
    />
  );

  const recentGamesCard = (
    <Section
      title="Last 5 Games"
      className={styles.recentGamesCard}
    >
      <Table
        columns={recentGameColumns}
        data={lastFiveGames}
        rowKey={(row) => row.game_id}
        loading={lastFiveGamesLoading}
        emptyMessage="No recent games recorded yet."
        onRowClick={(row) => navigate(buildGamePath(row))}
      />
    </Section>
  );

  const gameLogsCard = (
    <Section
      title="Game Logs"
      action={
        <div className={styles.gameLogFilters}>
          <div className={styles.gameLogSeasonSelect}>
            <SeasonSelect
              value={gameLogSeasonId}
              seasons={renderedPlayerSeasonOptions}
              onChange={handleSeasonChange}
              placeholder="All seasons"
              includeAllOption
              defaultSeasonMode="latest-ended"
            />
          </div>
          <SegmentedControl
            value={gameLogType}
            onChange={(value) => {
              setGameLogType(value);
              setGameLogPage(1);
            }}
            variant="field"
            options={[
              { value: 'all', label: 'All' },
              { value: 'regular', label: 'Regular' },
              { value: 'playoff', label: 'Playoffs' },
            ]}
            className={styles.gameLogTypeControl}
          />
        </div>
      }
    >
      <Table
        columns={gameLogColumns}
        data={gameLogs}
        rowKey={(row) => row.game_id}
        loading={gameLogsLoading}
        emptyMessage="No game logs found."
        onRowClick={(row) => navigate(buildGamePath(row))}
      />
      <div className={styles.paginationBar}>
        <span className={styles.paginationSummary}>
          {gameLogsTotal === 0
            ? 'No games'
            : `${(gameLogPage - 1) * GAME_LOG_PAGE_SIZE + 1}-${Math.min(
                gameLogPage * GAME_LOG_PAGE_SIZE,
                gameLogsTotal,
              )} of ${gameLogsTotal}`}
        </span>
        <div className={styles.paginationActions}>
          <Button
            variant="outlined"
            intent="neutral"
            icon="chevron_left"
            tooltip="Previous page"
            disabled={gameLogPage <= 1}
            onClick={() => setGameLogPage((page) => Math.max(1, page - 1))}
          />
          <span className={styles.paginationPage}>
            Page {gameLogPage} of {gameLogPageCount}
          </span>
          <Button
            variant="outlined"
            intent="neutral"
            icon="chevron_right"
            tooltip="Next page"
            disabled={gameLogPage >= gameLogPageCount}
            onClick={() => setGameLogPage((page) => Math.min(gameLogPageCount, page + 1))}
          />
        </div>
      </div>
    </Section>
  );

  const awardsCard = (
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
      {playerAwardsLoading ? (
        <p className={styles.placeholder}>Loading awards...</p>
      ) : playerAwardGroups.length === 0 ? (
        <p className={styles.placeholder}>No awards recorded yet.</p>
      ) : awardViewMode === 'banner' ? (
        <div
          className={styles.awardBannerRack}
          aria-label="Award banners"
        >
          {sortedPlayerAwards.map((award) => (
            <AwardBanner
              key={award.id}
              awardName={award.award_name}
              champions={shouldShowChampionsLabel(award)}
              dateText={award.awarded_at ? `Awarded ${formatShortDate(award.awarded_at)}` : null}
              media={
                award.recipient_type === 'player' ? (
                  <PlayerAvatar
                    photo={award.player_photo}
                    initials={initials}
                    primaryColor={award.team_primary_color}
                    textColor={award.team_text_color}
                    size={76}
                  />
                ) : (
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
                )
              }
              placeName={awardTeamPlaceName(award)}
              primaryColor={award.team_primary_color}
              secondaryColor={award.team_secondary_color ?? award.team_primary_color}
              seasonName={award.season_name}
              shape={
                isPlayoffChampionshipAward(award)
                  ? 'pointed'
                  : award.recipient_type === 'player'
                    ? 'forked'
                    : 'rounded'
              }
              teamName={awardTeamDisplayName(award)}
              textColor={award.team_text_color}
            />
          ))}
        </div>
      ) : (
        <div className={styles.awardGroups}>
          {playerAwardGroups.map((group) => (
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
              headerType="light"
              className={styles.awardGroup}
              bodyClassName={styles.awardAccordionBody}
            >
              <ul className={styles.awardTeamList}>
                {group.awards.map((award) => (
                  <ListItem
                    key={award.id}
                    variant="plain"
                    image={award.team_logo}
                    imageDark={award.team_logo_dark}
                    imageLight={award.team_logo_light}
                    image_shape="square"
                    name={award.team_name ?? 'Team not recorded'}
                    placeholder={teamCode(award.team_code, award.team_name)}
                    primaryColor={award.team_primary_color}
                    textColor={award.team_text_color}
                    rightContent={{
                      type: 'tag',
                      label: award.season_name,
                      intent: 'info',
                    }}
                  />
                ))}
              </ul>
            </Accordion>
          ))}
        </div>
      )}
    </Section>
  );

  return (
    <>
      {/* Hero card */}
      <Card>
        <div className={styles.hero}>
          {photo ? (
            <button
              type="button"
              className={styles.avatarButton}
              onClick={() => setPhotoPreviewSrc(photo)}
              aria-label={`View photo of ${fullName}`}
            >
              <PlayerAvatar
                photo={photo}
                initials={initials}
                primaryColor={avatarBg}
                textColor={avatarColor}
                size={80}
              />
            </button>
          ) : (
            <PlayerAvatar
              photo={photo}
              initials={initials}
              primaryColor={avatarBg}
              textColor={avatarColor}
              size={80}
            />
          )}
          <div className={styles.heroInfo}>
            <div className={styles.heroTitleRow}>
              <h2 className={styles.heroName}>{fullName}</h2>
            </div>
            <div className={styles.heroMeta}>
              {heroTeam?.name && (
                <span className={styles.heroTeamMeta}>
                  <TeamLogo
                    logo={heroTeam.logo}
                    logoDark={heroTeam.logo_dark}
                    logoLight={heroTeam.logo_light}
                    code={heroTeam.code ?? '?'}
                    primaryColor={heroTeam.primary_color}
                    textColor={heroTeam.text_color}
                    size={18}
                    shape="square"
                  />
                  {heroTeam.name}
                </span>
              )}
              {jerseyNumber != null && <span>#{jerseyNumber}</span>}
              {positionLabel && <span>{positionLabel}</span>}
            </div>
          </div>
          <div className={styles.heroRightCol}>
            {isAdminView && (
              <div className={styles.heroActions}>
                <Button
                  variant="outlined"
                  intent="neutral"
                  icon="edit"
                  size="large"
                  iconHeight="button"
                  tooltip="Edit player"
                  onClick={() => setEditPlayerOpen(true)}
                />
                {playerActionItems.length > 0 && (
                  <MoreActionsMenu
                    items={playerActionItems}
                    size="large"
                    iconHeight="button"
                  />
                )}
              </div>
            )}
            <div className={styles.heroStatus}>
              <Tag
                label={PLAYER_STATUS_LABELS[playerStatus]}
                intent={playerStatus === 'active' ? 'success' : 'neutral'}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className={styles.tabsWrapper}>
        <Tabs
          activeIndex={activeTab}
          onTabChange={handleTabChange}
          tabs={[
            {
              label: 'Info',
              content: (
                <div className={styles.infoSummaryGrid}>
                  {playerInfoCard}
                  {recentGamesCard}
                  {seasonStatsCard}
                </div>
              ),
            },
            {
              label: 'Game Logs',
              content: gameLogsCard,
            },
            {
              label: 'Career Stats',
              content: (
                <Section title="Career Statistics">
                  <Table
                    columns={statColumns}
                    data={stats}
                    rowKey={(r) => `${r.season_id}-${r.team_id ?? 'teamless'}`}
                    emptyMessage="No stats recorded yet."
                  />
                </Section>
              ),
            },
            {
              label: 'Awards',
              content: awardsCard,
            },
            isAdminView
              ? {
                  label: 'History',
                  content: (
                    <Section
                      title="History"
                      action={
                        <Button
                          variant="filled"
                          intent="accent"
                          icon="add"
                          size="medium"
                          onClick={() => setCreatingStint(true)}
                        >
                          Record Stint
                        </Button>
                      }
                    >
                      {teamHistoryStints.length === 0 ? (
                        <p className={styles.placeholder}>No team history yet.</p>
                      ) : (
                        <ul className={styles.stintList}>
                          {teamHistoryStints.map((s) => {
                            const jerseyHistory = getCollapsedJerseyHistory(
                              s,
                              jerseyHistoryByStint,
                            );
                            const photoHistory = photoHistoryByTeam[s.team_id] ?? [];
                            const teamLeagueId = teams.find((team) => team.id === s.team_id)?.league_id;
                            const missingPhotoSeason = findMissingPhotoSeason(
                              s,
                              seasons,
                              photoHistory,
                              teamLeagueId,
                            );
                            const acquisitionLabel = s.acquisition_type
                              ? (ACQUISITION_TYPE_LABELS[s.acquisition_type] ?? s.acquisition_type)
                              : null;
                            const actions = [
                              missingPhotoSeason
                                ? {
                                    icon: 'image',
                                    tooltip: 'Set team photo',
                                    onClick: () => openChangePhotoModal(s, missingPhotoSeason.id),
                                  }
                                : null,
                              !s.end_date
                                ? {
                                    icon: 'jersey',
                                    tooltip: 'Record jersey number change',
                                    onClick: () => setChangingJerseyStint(s),
                                  }
                                : null,
                              {
                                icon: 'edit',
                                tooltip: 'Edit stint',
                                onClick: () => setEditingStint(s),
                              },
                              s.can_delete
                                ? {
                                    icon: 'delete',
                                    intent: 'danger' as const,
                                    tooltip: 'Delete stint',
                                    onClick: () => setDeletingStint(s),
                                  }
                                : null,
                            ].filter((action): action is NonNullable<typeof action> => action != null);

                            return (
                              <li
                                key={s.id}
                                className={styles.stintListItem}
                              >
                                <Accordion
                                  defaultOpen={false}
                                  headerType="light"
                                  className={styles.stintAccordion}
                                  rowClassName={styles.stintHeader}
                                  labelWrapClassName={styles.stintHeaderLabelWrap}
                                  labelClassName={styles.stintHeaderAccordionLabel}
                                  bodyClassName={styles.stintBody}
                                  label={
                                    <span className={styles.stintHeaderLabel}>
                                      <TeamLogo
                                        logo={s.team.logo}
                                        logoDark={s.team.logo_dark}
                                        logoLight={s.team.logo_light}
                                        code={teamCodePlaceholder(s)}
                                        primaryColor={s.team.primary_color}
                                        textColor={s.team.text_color}
                                        size={32}
                                        shape="square"
                                      />
                                      {s.jersey_number != null && (
                                        <Chip
                                          primaryColor={s.team.primary_color}
                                          textColor={s.team.text_color}
                                        >
                                          {s.jersey_number}
                                        </Chip>
                                      )}
                                      <span className={styles.stintHeaderInfo}>
                                        <span className={styles.stintHeaderName}>
                                          {s.team.name ?? 'Unknown team'}
                                        </span>
                                        <span className={styles.stintHeaderDates}>
                                          {formatStintDates(s)}
                                        </span>
                                      </span>
                                    </span>
                                  }
                                  headerRight={
                                    acquisitionLabel ? (
                                      <Tag
                                        label={acquisitionLabel}
                                        intent="info"
                                      />
                                    ) : null
                                  }
                                  hoverActions={actions}
                                >
                                  <StintHistoryDetails
                                    stint={s}
                                    jerseyHistory={jerseyHistory}
                                    photoHistory={photoHistory}
                                    currentJerseyNumber={jerseyNumber}
                                    currentJerseyStintKey={currentJerseyStintKey}
                                    currentPhotoHistoryId={currentPhotoHistoryId}
                                    initials={initials}
                                    onPreviewPhoto={(src) => setPhotoPreviewSrc(src)}
                                    onChangePhoto={openChangePhotoModal}
                                    onEditJerseyHistoryEntry={setEditingJerseyHistoryEntry}
                                    onDeletePhotoEntry={setDeletingPhotoEntry}
                                    onDeleteJerseyHistoryEntry={setDeletingJerseyHistoryEntry}
                                  />
                                </Accordion>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Section>
                  ),
                }
              : null,
          ].filter((tab): tab is NonNullable<typeof tab> => tab !== null)}
        />
      </div>

      {isAdminView && (
        <>
          <TeamPlayerEditModal
            open={editPlayerOpen}
            editTarget={playerEditTarget}
            teamId={latestStint?.team_id ?? ''}
            seasonId={latestStint?.season_id ?? null}
            onClose={() => setEditPlayerOpen(false)}
            updatePlayer={updatePlayer}
            updatePlayerTeam={updatePlayerTeam}
            uploadPlayerPhoto={uploadStintPhoto}
          />

          <MovePlayerModal
            open={movePlayerOpen}
            player={playerEditTarget}
            currentTeamId={latestStint?.team_id ?? teamId ?? ''}
            seasonId={latestStint?.season_id ?? ''}
            leagueId={leagueId ?? ''}
            onClose={() => setMovePlayerOpen(false)}
            movePlayer={movePlayer}
          />

          <RetirePlayerModal
            open={retirePlayerOpen}
            playerName={fullName}
            busy={playerStatusSaving}
            onClose={() => setRetirePlayerOpen(false)}
            onRetire={retirePlayer}
          />

          <PlayerInfoEditModal
            open={editPlayerInfoOpen}
            player={player}
            seasons={gameLogSeasons}
            onClose={() => setEditPlayerInfoOpen(false)}
            updatePlayer={updatePlayer}
          />

          <ChangeJerseyModal
            open={!!changingJerseyStint}
            stint={changingJerseyStint}
            onClose={() => setChangingJerseyStint(null)}
            changeJerseyNumber={changeJerseyNumber}
          />

          <JerseyHistoryEditModal
            open={!!editingJerseyHistoryEntry}
            entry={editingJerseyHistoryEntry}
            onClose={() => setEditingJerseyHistoryEntry(null)}
            updateJerseyHistoryEntry={updateJerseyHistoryEntry}
          />

          <StintEditModal
            open={creatingStint || !!editingStint}
            stint={editingStint}
            teams={teams}
            seasons={seasons}
            leagueId={leagueId ?? null}
            currentTeamId={latestStint?.team_id ?? teamId ?? null}
            onClose={() => {
              setEditingStint(null);
              setCreatingStint(false);
            }}
            createStint={createStint}
            updateStint={updateStint}
          />

          <ChangePhotoModal
            open={!!changingPhotoStint}
            stint={changingPhotoStint}
            initialSeasonId={changingPhotoSeasonId}
            mode={changingPhotoMode}
            seasons={seasons.filter(
              (s) =>
                s.league_id === teams.find((t) => t.id === changingPhotoStint?.team_id)?.league_id,
            )}
            history={photoHistoryByTeam[changingPhotoStint?.team_id ?? ''] ?? []}
            onClose={closeChangePhotoModal}
            uploadPhoto={uploadStintPhoto}
            changePlayerPhoto={changePlayerPhoto}
          />

          <ConfirmModal
            open={!!deletingPhotoEntry}
            title="Delete Season Photo"
            body={
              deletingPhotoEntry ? (
                <>
                  Delete the {deletingPhotoEntry.season_name ?? 'selected season'} photo record?{' '}
                  This removes the saved season photo from the player&apos;s history.
                </>
              ) : (
                ''
              )
            }
            confirmLabel="Delete Season Photo"
            confirmIcon="delete"
            variant="danger"
            busy={stintSaving}
            onConfirm={handleDeletePhotoEntry}
            onCancel={() => setDeletingPhotoEntry(null)}
          />

          <ConfirmModal
            open={!!deletingJerseyHistoryEntry}
            title="Delete Jersey Number Change"
            body={
              deletingJerseyHistoryEntry ? (
                <>
                  Delete the #{deletingJerseyHistoryEntry.jersey_number} jersey number record from{' '}
                  {formatShortDate(deletingJerseyHistoryEntry.effective_from)}?
                </>
              ) : (
                ''
              )
            }
            confirmLabel="Delete Jersey Number Change"
            confirmIcon="delete"
            variant="danger"
            busy={stintSaving}
            onConfirm={handleDeleteJerseyHistoryEntry}
            onCancel={() => setDeletingJerseyHistoryEntry(null)}
          />

          <ConfirmModal
            open={!!deletingStint}
            title="Delete Stint"
            body={
              deletingStint ? (
                <>
                  Delete the {deletingStint.team.name ?? 'selected team'} stint from this
                  player&apos;s
                  team history? This is only allowed when the player has no stats for that team.
                </>
              ) : (
                ''
              )
            }
            confirmLabel="Delete Stint"
            confirmIcon="delete"
            variant="danger"
            busy={stintSaving}
            onConfirm={handleDeleteStint}
            onCancel={() => setDeletingStint(null)}
          />
        </>
      )}

      <ImagePreviewModal
        open={!!photoPreviewSrc}
        src={photoPreviewSrc}
        alt={fullName}
        onClose={() => setPhotoPreviewSrc(null)}
      />
    </>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────
// ── Helper: label/value cell ────────────────────────────────────────────────
const copyTextToClipboard = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) throw new Error('Clipboard copy failed');
};

interface InfoCellProps {
  label: string;
  value: string | null | undefined;
  onCopy?: () => void | Promise<void>;
}

const InfoCell = ({ label, value, onCopy }: InfoCellProps) => (
  <div className={styles.infoCell}>
    <span className={styles.infoCellLabel}>{label}</span>
    {value ? (
      onCopy ? (
        <button
          type="button"
          className={styles.infoCellCopyButton}
          onClick={() => {
            void onCopy();
          }}
          aria-label={`Copy ${label.toLowerCase()} ${value}`}
          title={`Copy ${label.toLowerCase()}`}
        >
          <span className={styles.infoCellValue}>{value}</span>
          <span
            className={styles.infoCellCopyIndicator}
            aria-hidden
          >
            <Icon
              name="clone"
              size="0.85rem"
            />
          </span>
        </button>
      ) : (
        <span className={styles.infoCellValue}>{value}</span>
      )
    ) : (
      <span className={styles.infoCellMuted}>—</span>
    )}
  </div>
);

export default PlayerDetailsPage;

// ── Helper: selected-season stat section ────────────────────────────────────
const SeasonStatsSection = ({
  stats,
  isGoalie,
  seasons,
  selectedSeasonId,
  loading,
  onSeasonChange,
}: {
  stats: PlayerCurrentSeasonStats | null;
  isGoalie: boolean;
  seasons: SeasonRecord[];
  selectedSeasonId: string | null;
  loading: boolean;
  onSeasonChange: (seasonId: string) => void;
}) => (
  <Section
    title="Season Stats"
    className={styles.currentSeasonCards}
    action={
      !loading || stats ? (
        <div className={styles.seasonStatsSelect}>
          <SeasonSelect
            value={selectedSeasonId}
            seasons={seasons}
            onChange={onSeasonChange}
            placeholder="Select season..."
            defaultSeasonMode="latest-ended"
          />
        </div>
      ) : null
    }
  >
    {loading && !stats ? (
      <p className={styles.placeholder}>Loading season stats...</p>
    ) : !stats ? (
      <p className={styles.placeholder}>No season stats recorded yet.</p>
    ) : (
      <div className={styles.seasonStatsGroups}>
        <SeasonStatBlock
          title="Regular Season"
          stats={stats.regular}
          isGoalie={isGoalie}
        />
        <SeasonStatBlock
          title="Playoffs"
          stats={stats.playoffs}
          isGoalie={isGoalie}
        />
      </div>
    )}
  </Section>
);

const SeasonStatBlock = ({
  title,
  stats,
  isGoalie,
}: {
  title: string;
  stats: PlayerCurrentSeasonStatBlock | null;
  isGoalie: boolean;
}) => {
  const fmtSavePct = (v: number | null) => {
    if (v == null) return '—';
    return v.toFixed(3).replace(/^0/, '');
  };

  return (
    <div className={styles.seasonStatsGroup}>
      <h3 className={styles.seasonStatsGroupTitle}>{title}</h3>
      {!stats ? (
        <p className={styles.placeholder}>No games played.</p>
      ) : isGoalie ? (
        <div className={`${styles.statGrid} ${styles.statGridGoalie}`}>
          <StatCell
            label="GP"
            tooltip={STAT_LABELS.GP}
            value={stats.gp}
          />
          <StatCell
            label="W"
            tooltip={STAT_LABELS.W}
            value={stats.wins}
          />
          <StatCell
            label="SO"
            tooltip={STAT_LABELS.SO}
            value={stats.shootout_wins}
          />
          <StatCell
            label="GAA"
            tooltip={STAT_LABELS.GAA}
            value={formatGaa(stats.goals_against, stats.time_on_ice)}
          />
          <StatCell
            label="SV%"
            tooltip={STAT_LABELS['SV%']}
            value={fmtSavePct(stats.save_pct)}
          />
        </div>
      ) : (
        <div className={styles.statGrid}>
          <StatCell
            label="GP"
            tooltip={STAT_LABELS.GP}
            value={stats.gp}
          />
          <StatCell
            label="G"
            tooltip={STAT_LABELS.G}
            value={stats.goals}
          />
          <StatCell
            label="A"
            tooltip={STAT_LABELS.A}
            value={stats.assists}
          />
          <StatCell
            label="P"
            tooltip={STAT_LABELS.P}
            value={stats.points}
          />
        </div>
      )}
    </div>
  );
};

const StatCell = ({
  label,
  tooltip,
  value,
}: {
  label: string;
  tooltip: string;
  value: number | string;
}) => (
  <StatItem
    className={styles.statCell}
    label={label}
    tooltip={tooltip}
    value={value}
  />
);
