import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { toast, type TypeOptions } from 'react-toastify';
import Accordion from '@jerecocc/tracker-ui/components/Accordion/Accordion';
import AwardBanner from '@/shared/AwardBanner/AwardBanner';
import Badge from '@jerecocc/tracker-ui/components/Badge/Badge';
import Banner from '@jerecocc/tracker-ui/components/Banner/Banner';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Card from '@jerecocc/tracker-ui/components/Card/Card';
import Chip from '@jerecocc/tracker-ui/components/Chip/Chip';
import ConfirmModal from '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import InfoTooltip from '@jerecocc/tracker-ui/components/InfoTooltip/InfoTooltip';
import ImagePreviewModal from '@jerecocc/tracker-ui/components/ImagePreviewModal/ImagePreviewModal';
import ListItem from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import MoreActionsMenu from '@jerecocc/tracker-ui/components/MoreActionsMenu/MoreActionsMenu';
import PlayerAvatar from '@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar';
import StatusTag from '@/shared/StatusTag/StatusTag';
import SegmentedControl from '@jerecocc/tracker-ui/components/SegmentedControl/SegmentedControl';
import SeasonSelect from '@/shared/SeasonSelect/SeasonSelect';
import StatItem from '@jerecocc/tracker-ui/components/StatItem/StatItem';
import Table, { type Column } from '@jerecocc/tracker-ui/components/Table/Table';
import Tabs from '@jerecocc/tracker-ui/components/Tabs/Tabs';
import Tag, { type TagIntent } from '@jerecocc/tracker-ui/components/Tag/Tag';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import Tooltip from '@jerecocc/tracker-ui/components/Tooltip/Tooltip';
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
  type ReconcilePlayerStintInput,
  type TeamPlayerRecord,
} from '@/hooks/useTeamPlayers';
import {
  type CreatePlayerData,
  type PlayerPosition,
  type PlayerShoots,
} from '@/hooks/useLeaguePlayers';
import useTabState from '@/hooks/useTabState';
import useLeagueDraftDates, { type LeagueDraftDateRecord } from '@/hooks/useLeagueDraftDates';
import { getDraftPickStartDate } from '@/lib/draftDates';
import { formatPlayerPosition } from '@/lib/playerPosition';
import { PLAYER_STATUS_LABELS, getPlayerStatus, type PlayerStatus } from '@/lib/playerStatus';
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
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import styles from './PlayerDetails.module.scss';
import useDocumentIcon from '@/hooks/useDocumentIcon';

import { API, authHeaders, getApiErrorMessage as apiError } from '@/lib/apiClient';
const PWHL_BASE_URL = 'https://lscluster.hockeytech.com/feed/index.php';
const PWHL_APP_KEY = '446521baf8c38984';
const PWHL_CLIENT_CODE = 'pwhl';
const PWHL_LEAGUE_ID = '1';
const NHL_PLAYER_PAGE_BASE_URL = 'https://www.nhl.com/utah/player';
const GAME_LOG_PAGE_SIZE = 20;
const AUTOFILL_RESULT_TOAST_MS = 4000;
const AUTOFILL_FAILURE_TOAST_MS = 12000;
const PLAYER_AUTOFILL_PROGRESS_STEPS = 2;
const HERO_AVATAR_SIZE = 88;
const MANUAL_MOVEMENT_START_SEASON_NAME = '2025-26';
const MANUAL_MOVEMENT_START_FALLBACK_DATE = '2025-10-01';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLAYER_POSITION_TAG_INTENTS: Record<PlayerPosition, TagIntent> = {
  F: 'accent',
  C: 'accent',
  LW: 'accent',
  RW: 'accent',
  D: 'info',
  LD: 'info',
  RD: 'info',
  G: 'warning',
};

const buildNhlPlayerPageUrl = (leaguePlayerNumber: string) =>
  `${NHL_PLAYER_PAGE_BASE_URL}/${encodeURIComponent(leaguePlayerNumber)}`;

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
  isActive?: boolean | null;
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
  draftDetails?: {
    year?: number | string | null;
    teamAbbrev?: string | null;
    round?: number | string | null;
    overallPick?: number | string | null;
  } | null;
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
}

interface PlayerManualDraftReport {
  teamCode: string | null;
  teamName: string | null;
  year: string;
  round: string;
}

interface PlayerManualMovementReportEntry {
  id: string;
  acquisitionType: string;
  startDate: string | null;
  endDate: string | null;
  previousEndDate: string | null;
  fromTeamName: string | null;
  toTeamName: string | null;
  detail: string;
}

interface PlayerManualMovementImportWarning {
  movementId: string;
  message: string;
}

interface PlayerManualMovementSeasonBoundary {
  name: string;
  endDate: string | null;
}

interface PlayerManualJerseyReportEntry {
  id: string;
  date: string;
  teamName: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  detail: string;
}

interface PlayerManualStatusReport {
  status: PlayerStatus;
  date: string | null;
  detail: string;
}

interface PlayerManualMovementAnchor {
  stintId?: string | null;
  teamCode: string | null;
  teamName: string | null;
  seasonName: string | null;
  seasonStartDate: string | null;
  stintStartDate: string | null;
  acquisitionType: string | null;
}

interface PlayerManualMovementReport {
  playerName: string;
  sourceUrl: string;
  draft: PlayerManualDraftReport | null;
  playerStatus: PlayerManualStatusReport | null;
  movementAnchor?: PlayerManualMovementAnchor | null;
  movements: PlayerManualMovementReportEntry[];
  jerseyChanges?: PlayerManualJerseyReportEntry[];
  error?: string;
}

interface PlayerManualMovementSourceForm {
  sourceText: string;
}

interface PuckPediaRawMovementEvent {
  date: string;
  type: 'signing' | 'trade' | 'waiver' | 'jersey';
  teamName?: string | null;
  fromTeamName?: string | null;
  toTeamName?: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
  detail: string;
}

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

const normalizeIsoDate = (value: string | null | undefined) => {
  const date = value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  return date;
};

type TeamReportLookupRecord = {
  id?: string | null;
  code?: string | null;
  name?: string | null;
};

const NHL_FRANCHISE_TRANSFER_TEAM_ALIASES = [
  {
    historicalCodes: ['ARI', 'PHX', 'PHO'],
    historicalNames: ['Arizona Coyotes', 'Phoenix Coyotes', 'Coyotes'],
    currentCodes: ['UTA'],
    currentNames: ['Utah Mammoth', 'Utah Hockey Club', 'Mammoth'],
    historicalDisplayName: 'Arizona Coyotes',
  },
  {
    historicalCodes: ['ATL'],
    historicalNames: ['Atlanta Thrashers', 'Thrashers'],
    currentCodes: ['WPG'],
    currentNames: ['Winnipeg Jets', 'Jets'],
    historicalDisplayName: 'Atlanta Thrashers',
  },
  {
    historicalCodes: ['QUE'],
    historicalNames: ['Quebec Nordiques', 'Nordiques'],
    currentCodes: ['COL'],
    currentNames: ['Colorado Avalanche', 'Avalanche'],
    historicalDisplayName: 'Quebec Nordiques',
  },
  {
    historicalCodes: ['HFD', 'HAR'],
    historicalNames: ['Hartford Whalers', 'Whalers'],
    currentCodes: ['CAR'],
    currentNames: ['Carolina Hurricanes', 'Hurricanes'],
    historicalDisplayName: 'Hartford Whalers',
  },
  {
    historicalCodes: ['MNS'],
    historicalNames: ['Minnesota North Stars', 'North Stars'],
    currentCodes: ['DAL'],
    currentNames: ['Dallas Stars', 'Stars'],
    historicalDisplayName: 'Minnesota North Stars',
  },
] as const;

const PUCKPEDIA_BASE_URL = 'https://puckpedia.com';
const PUCKPEDIA_MOVEMENT_FILTER_QUERY = 'transaction_type=trade,waiver,signing,roster';
const PUCKPEDIA_MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

const normalizePuckPediaSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const puckPediaMovementReportUrl = (playerPath: string) =>
  `${PUCKPEDIA_BASE_URL}${playerPath}/transactions?${PUCKPEDIA_MOVEMENT_FILTER_QUERY}`;

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");

const htmlToTextLines = (html: string) =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<img\b[^>]*alt=["']([^"']+)["'][^>]*>/gi, '\n$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:article|div|h[1-6]|li|p|section|td|th|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n+/)
    .map((line) => decodeHtmlEntities(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const parsePuckPediaDateLine = (line: string) => {
  const match = line.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),?\s+(\d{4})(?:\s*\|\s*(.+))?$/);
  if (!match) return null;
  const month = PUCKPEDIA_MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  return {
    date: `${match[3]}-${month}-${match[2].padStart(2, '0')}`,
    teamName: match[4]?.trim() || null,
  };
};

const parsePuckPediaInlineDate = (value: string) => {
  const match = value.match(/\b([A-Z][a-z]{2})\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (!match) return null;
  const month = PUCKPEDIA_MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${match[2].padStart(2, '0')}`;
};

const normalizeTeamNameKey = (value: string | null | undefined) =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null;

const teamsMatch = (left: string | null | undefined, right: string | null | undefined) => {
  const leftKey = normalizeTeamNameKey(left);
  const rightKey = normalizeTeamNameKey(right);
  return !!leftKey && !!rightKey && leftKey === rightKey;
};

const reportTeamTextMatches = (
  candidate: string | null | undefined,
  value: string | null | undefined,
) => {
  const candidateKey = normalizeTeamNameKey(candidate);
  const valueKey = normalizeTeamNameKey(value);
  return (
    !!candidateKey &&
    !!valueKey &&
    (candidateKey === valueKey ||
      candidateKey.startsWith(`${valueKey} `) ||
      candidateKey.endsWith(` ${valueKey}`) ||
      valueKey.startsWith(`${candidateKey} `) ||
      valueKey.endsWith(` ${candidateKey}`))
  );
};

const compactReportText = (value: string) => value.replace(/\s+/g, ' ').trim();

const normalizePlayerNameMatchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const playerReportNameKeys = (playerName: string) => {
  const parts = normalizePlayerNameMatchText(playerName).split(/\s+/).filter(Boolean);
  const fullName = compactReportText(parts.join(' '));
  const lastName = parts[parts.length - 1] ?? '';
  return [fullName, lastName].filter(
    (key, index, keys) => key.length > 1 && keys.indexOf(key) === index,
  );
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const textMatchesPlayerName = (value: string, playerName: string) => {
  const normalizedValue = normalizePlayerNameMatchText(value);
  return playerReportNameKeys(playerName).some((key) =>
    new RegExp(`(^|\\s)${escapeRegExp(key)}(?=\\s|$)`).test(normalizedValue),
  );
};

const detailMatchesPlayer = (detail: string, playerName: string) =>
  textMatchesPlayerName(detail, playerName);

const findReportTeamByCode = (
  teams: TeamReportLookupRecord[],
  teamCode: string | null | undefined,
) => {
  const code = normalizeTeamCode(teamCode);
  return code ? (teams.find((team) => normalizeTeamCode(team.code) === code) ?? null) : null;
};

const reportTeamMatchesAliasCurrent = (
  team: TeamReportLookupRecord,
  alias: (typeof NHL_FRANCHISE_TRANSFER_TEAM_ALIASES)[number],
) => {
  const teamCode = normalizeTeamCode(team.code);
  return (
    (!!teamCode && (alias.currentCodes as readonly string[]).includes(teamCode)) ||
    alias.currentNames.some((name) => reportTeamTextMatches(team.name, name))
  );
};

const reportHasAliasCurrentTeam = (
  teams: TeamReportLookupRecord[],
  alias: (typeof NHL_FRANCHISE_TRANSFER_TEAM_ALIASES)[number],
) => teams.some((team) => reportTeamMatchesAliasCurrent(team, alias));

const findReportFranchiseTransferAliasByHistoricalCode = (
  teams: TeamReportLookupRecord[],
  teamCode: string | null | undefined,
) => {
  const code = normalizeTeamCode(teamCode);
  if (!code) return null;
  return (
    NHL_FRANCHISE_TRANSFER_TEAM_ALIASES.find(
      (alias) =>
        (alias.historicalCodes as readonly string[]).includes(code) &&
        reportHasAliasCurrentTeam(teams, alias),
    ) ?? null
  );
};

const reportValueMatchesFranchiseAlias = (
  alias: (typeof NHL_FRANCHISE_TRANSFER_TEAM_ALIASES)[number],
  value: string | null | undefined,
) => {
  const valueCode = normalizeTeamCode(value);
  return (
    (!!valueCode &&
      ((alias.historicalCodes as readonly string[]).includes(valueCode) ||
        (alias.currentCodes as readonly string[]).includes(valueCode))) ||
    alias.historicalNames.some((name) => reportTeamTextMatches(name, value)) ||
    alias.currentNames.some((name) => reportTeamTextMatches(name, value))
  );
};

const findReportFranchiseTransferAliasByText = (
  teams: TeamReportLookupRecord[],
  value: string | null | undefined,
) =>
  NHL_FRANCHISE_TRANSFER_TEAM_ALIASES.find(
    (alias) =>
      reportHasAliasCurrentTeam(teams, alias) && reportValueMatchesFranchiseAlias(alias, value),
  ) ?? null;

const reportTeamsShareFranchiseTransfer = (
  teams: TeamReportLookupRecord[],
  left: string | null | undefined,
  right: string | null | undefined,
) => {
  if (teamsMatch(left, right)) return false;
  const leftAlias = findReportFranchiseTransferAliasByText(teams, left);
  const rightAlias = findReportFranchiseTransferAliasByText(teams, right);
  return !!leftAlias && leftAlias === rightAlias;
};

const resolveReportTeamName = (
  teams: TeamReportLookupRecord[],
  teamCode: string | null | undefined,
  fallbackName?: string | null,
) =>
  findReportTeamByCode(teams, teamCode)?.name ??
  findReportFranchiseTransferAliasByHistoricalCode(teams, teamCode)?.historicalDisplayName ??
  fallbackName ??
  null;

const resolveReportTeamNameByText = (
  teams: TeamReportLookupRecord[],
  value: string | null | undefined,
) => {
  const teamName = value?.replace(/^the\s+/i, '').trim();
  const teamKey = normalizeTeamNameKey(teamName);
  if (!teamName || !teamKey) return null;

  const matchedTeam = teams.find((team) => {
    const codeKey = normalizeTeamCode(team.code)?.toLowerCase() ?? null;
    return codeKey === teamKey || reportTeamTextMatches(team.name, teamName);
  });

  return (
    matchedTeam?.name ??
    findReportFranchiseTransferAliasByText(teams, teamName)?.historicalDisplayName ??
    teamName
  );
};

const findReportTeamByText = (
  teams: TeamReportLookupRecord[],
  value: string | null | undefined,
) => {
  const teamName = value?.replace(/^the\s+/i, '').trim();
  const teamKey = normalizeTeamNameKey(teamName);
  if (!teamName || !teamKey) return null;

  const directMatch = teams.find((team) => {
    const codeKey = normalizeTeamCode(team.code)?.toLowerCase() ?? null;
    return codeKey === teamKey || reportTeamTextMatches(team.name, teamName);
  });
  if (directMatch) return directMatch;

  const alias = findReportFranchiseTransferAliasByText(teams, teamName);
  return alias ? (teams.find((team) => reportTeamMatchesAliasCurrent(team, alias)) ?? null) : null;
};

const draftReportFromLanding = (
  landing: NhlPlayerLanding,
  teams: TeamReportLookupRecord[],
): PlayerManualDraftReport | null => {
  const year = landing.draftDetails?.year == null ? null : String(landing.draftDetails.year);
  const round = landing.draftDetails?.round == null ? null : String(landing.draftDetails.round);
  if (!year || !round) return null;

  const teamCode = normalizeTeamCode(landing.draftDetails?.teamAbbrev);
  return {
    teamCode,
    teamName: resolveReportTeamName(teams, teamCode),
    year,
    round,
  };
};

const statusReportFromNhlLanding = (landing: NhlPlayerLanding): PlayerManualStatusReport | null =>
  landing.isActive === false
    ? {
        status: 'inactive',
        date: null,
        detail: 'NHL API lists this player as inactive.',
      }
    : null;

const extractPuckPediaSigningTeam = (detail: string) => {
  const match =
    detail.match(/\bdeal with (?:the\s+)?(.+?)(?:\.|$)/i) ??
    detail.match(/\bcontract with (?:the\s+)?(.+?)(?:\.|$)/i) ??
    detail.match(/\bsigns?.*?\bwith (?:the\s+)?(.+?)(?:\.|$)/i);
  return match?.[1]?.trim() ?? null;
};

const parsePuckPediaJerseyChange = (detail: string) => {
  const fromToMatch = detail.match(/\bfrom\s+#?(\d{1,3})\s+to\s+#?(\d{1,3})\b/i);
  if (fromToMatch) {
    return {
      fromNumber: fromToMatch[1],
      toNumber: fromToMatch[2],
    };
  }

  const toMatch =
    detail.match(/\b(?:will wear|wears?|switch(?:es|ed)? to|changes? to)\s+#?(\d{1,3})\b/i) ??
    detail.match(/\bnumber\s+#?(\d{1,3})\b/i);
  if (!toMatch) return null;
  return {
    fromNumber: null,
    toNumber: toMatch[1],
  };
};

const cleanPuckPediaTradeTeamName = (value: string) =>
  value
    .replace(/^the\s+/i, '')
    .replace(/[,\s]+$/g, '')
    .trim();

const parsePuckPediaAcquiredTrade = (detail: string, playerName: string) => {
  const tradeMatch = detail.match(
    /\b(?:The\s+)?(.+?)\s+acquir(?:e|es|ed)\s+(.+?)\s+from\s+(?:the\s+)?(.+?)(?:\s+(?:for|in exchange(?: for)?)\s+(.+?))?(?:\.|$)/i,
  );
  if (!tradeMatch) return null;

  const acquiringTeamName = cleanPuckPediaTradeTeamName(tradeMatch[1]);
  const acquiredAssets = tradeMatch[2].trim();
  const sourceTeamName = cleanPuckPediaTradeTeamName(tradeMatch[3]);
  const outgoingAssets = tradeMatch[4]?.trim() ?? '';

  if (textMatchesPlayerName(acquiredAssets, playerName)) {
    return {
      toTeamName: acquiringTeamName,
      fromTeamName: sourceTeamName,
    };
  }

  if (outgoingAssets && textMatchesPlayerName(outgoingAssets, playerName)) {
    return {
      toTeamName: sourceTeamName,
      fromTeamName: acquiringTeamName,
    };
  }

  return {
    toTeamName: acquiringTeamName,
    fromTeamName: sourceTeamName,
  };
};

const PUCKPEDIA_EVENT_TYPE_PATTERN =
  'SIGNING|TRADE|MOVES?|WAIVERS?|ROSTER|JERSEY(?:\\s+NUMBER)?|NEWS|INJURY';

const parsePuckPediaDateTypeLine = (line: string) => {
  const match = line.match(
    new RegExp(
      `^([A-Z][a-z]{2}\\s+\\d{1,2},?\\s+\\d{4})\\s+(${PUCKPEDIA_EVENT_TYPE_PATTERN})(?:\\s+(.+))?$`,
      'i',
    ),
  );
  if (!match) return null;

  const parsedDate = parsePuckPediaDateLine(match[1]);
  if (!parsedDate) return null;

  return {
    date: parsedDate.date,
    eventType: match[2],
    detail: match[3]?.trim() ?? '',
    teamName: parsedDate.teamName,
  };
};

const rawPuckPediaEventFromDetail = ({
  date,
  eventType,
  detail,
  teamName,
  playerName,
}: {
  date: string;
  eventType: string | null;
  detail: string;
  teamName?: string | null;
  playerName: string;
}): PuckPediaRawMovementEvent | null => {
  const lowerDetail = detail.toLowerCase();
  const normalizedType = eventType?.trim().toLowerCase() ?? '';
  const isPlayerDetail = detailMatchesPlayer(detail, playerName);
  const jerseyChange = isPlayerDetail ? parsePuckPediaJerseyChange(detail) : null;

  if (jerseyChange && (lowerDetail.includes('jersey') || lowerDetail.includes('number'))) {
    return {
      date,
      type: 'jersey',
      teamName,
      fromNumber: jerseyChange.fromNumber,
      toNumber: jerseyChange.toNumber,
      detail,
    };
  }

  if (/\bacquir(?:e|es|ed)\b/i.test(detail) && isPlayerDetail) {
    const acquiredTrade = parsePuckPediaAcquiredTrade(detail, playerName);
    if (acquiredTrade) {
      return {
        date,
        type: 'trade',
        toTeamName: acquiredTrade.toTeamName,
        fromTeamName: acquiredTrade.fromTeamName,
        detail,
      };
    }
  }

  if (lowerDetail.includes(' traded to ') && isPlayerDetail) {
    const tradeMatch = detail.match(
      /\btraded to\s+(?:the\s+)?(.+?)\s+from\s+(?:the\s+)?(.+?)(?:\s+in exchange\b|,|\.|\s+on\b|$)/i,
    );
    if (tradeMatch) {
      return {
        date,
        type: 'trade',
        toTeamName: tradeMatch[1].trim(),
        fromTeamName: tradeMatch[2].trim(),
        detail,
      };
    }
  }

  if (/\bclaimed\b.*\boff waivers\b/i.test(detail) && isPlayerDetail) {
    const claimedByMatch = detail.match(
      /\bclaimed off waivers by\s+(?:the\s+)?(.+?)(?:\s+on\s+\w+)?\s+from\s+(?:the\s+)?(.+?)(?:\s+on\b|,|\.|$)/i,
    );
    if (claimedByMatch) {
      return {
        date,
        type: 'waiver',
        toTeamName: claimedByMatch[1].trim(),
        fromTeamName: claimedByMatch[2].trim(),
        detail,
      };
    }

    const claimedByTeamOnlyMatch = detail.match(
      /\bclaimed off waivers by\s+(?:the\s+)?(.+?)(?:\s+on\b|,|\.|$)/i,
    );
    if (claimedByTeamOnlyMatch) {
      return {
        date,
        type: 'waiver',
        toTeamName: claimedByTeamOnlyMatch[1].trim(),
        detail,
      };
    }

    const teamClaimedMatch = detail.match(
      /\b(?:The\s+)?(.+?)\s+claimed\s+.+?\s+off waivers from\s+(?:the\s+)?(.+?)(?:\s+on\b|,|\.|$)/i,
    );
    if (teamClaimedMatch) {
      return {
        date,
        type: 'waiver',
        toTeamName: teamClaimedMatch[1].trim(),
        fromTeamName: teamClaimedMatch[2].trim(),
        detail,
      };
    }
  }

  if (/\bclaimed by\b/i.test(detail) && lowerDetail.includes('on waivers') && isPlayerDetail) {
    const placedClaimedByMatch = detail.match(
      /\b(?:The\s+)?(.+?)\s+placed\s+.+?\s+on waivers(?:\s+on\s+[A-Z][a-z]{2}\s+\d{1,2},?\s+\d{4})?\.\s*Claimed by\s+(?:the\s+)?(.+?)(?:\.|$)/i,
    );
    if (placedClaimedByMatch) {
      return {
        date: parsePuckPediaInlineDate(detail) ?? date,
        type: 'waiver',
        toTeamName: placedClaimedByMatch[2].trim(),
        fromTeamName: placedClaimedByMatch[1].trim(),
        detail,
      };
    }
  }

  const signingTeamName = teamName ?? extractPuckPediaSigningTeam(detail);
  const isTryoutAgreement =
    /\b(?:professional\s+|amateur\s+)?tryout(?:\s+agreement)?\b|\bPTO\b/i.test(detail);
  const isSigning =
    !isTryoutAgreement &&
    (normalizedType === 'signing' ||
      /(?:standard|entry level|two-way|arbitration|offer sheet)\s*\|\s*\d+\s*yrs/i.test(detail) ||
      /\bsigns?.*?\bwith\b/i.test(detail));

  if (signingTeamName && isPlayerDetail && isSigning) {
    return {
      date,
      type: 'signing',
      teamName: signingTeamName,
      detail,
    };
  }

  return null;
};

const parsePuckPediaTableRow = (
  line: string,
  playerName: string,
): PuckPediaRawMovementEvent | null => {
  const row = parsePuckPediaDateTypeLine(line);
  if (!row?.detail) return null;

  return rawPuckPediaEventFromDetail({
    date: row.date,
    eventType: row.eventType,
    detail: compactReportText(row.detail),
    teamName: row.teamName,
    playerName,
  });
};

const parsePuckPediaTransactions = (
  html: string,
  playerName: string,
): PuckPediaRawMovementEvent[] => {
  const lines = htmlToTextLines(html);
  const events: PuckPediaRawMovementEvent[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const parsedDateType = parsePuckPediaDateTypeLine(lines[index]);
    if (parsedDateType) {
      let nextIndex = index + 1;
      while (
        nextIndex < lines.length &&
        !parsePuckPediaDateTypeLine(lines[nextIndex]) &&
        !parsePuckPediaDateLine(lines[nextIndex])
      ) {
        nextIndex += 1;
      }

      const detail = compactReportText(
        [parsedDateType.detail, ...lines.slice(index + 1, nextIndex)]
          .filter((line) => !/^(DATE|TYPE|TEAMS|DETAILS)$/i.test(line))
          .join(' '),
      );
      const event = rawPuckPediaEventFromDetail({
        date: parsedDateType.date,
        eventType: parsedDateType.eventType,
        detail,
        teamName: parsedDateType.teamName,
        playerName,
      });
      if (event) events.push(event);

      index = nextIndex - 1;
      continue;
    }

    const rowEvent = parsePuckPediaTableRow(lines[index], playerName);
    if (rowEvent) {
      events.push(rowEvent);
      continue;
    }

    const parsedDate = parsePuckPediaDateLine(lines[index]);
    if (!parsedDate) continue;

    let nextIndex = index + 1;
    while (
      nextIndex < lines.length &&
      !parsePuckPediaDateLine(lines[nextIndex]) &&
      !parsePuckPediaDateTypeLine(lines[nextIndex])
    ) {
      nextIndex += 1;
    }

    const blockLines = lines
      .slice(index + 1, nextIndex)
      .filter((line) => !/^(DATE|TYPE|TEAMS|DETAILS)$/i.test(line));
    const eventType = blockLines.find((line) =>
      /^(SIGNING|TRADE|MOVES?|WAIVERS?|ROSTER|JERSEY(?:\s+NUMBER)?|NEWS|INJURY)$/i.test(line),
    );
    const detail = compactReportText(blockLines.join(' '));
    const event = rawPuckPediaEventFromDetail({
      date: parsedDate.date,
      eventType: eventType ?? null,
      detail,
      teamName: parsedDate.teamName,
      playerName,
    });
    if (event) events.push(event);

    index = nextIndex - 1;
  }

  return events;
};

const movementDatesAreNear = (left: string | null, right: string | null) => {
  if (!left || !right) return left === right;
  const leftTime = Date.parse(`${left}T00:00:00.000Z`);
  const rightTime = Date.parse(`${right}T00:00:00.000Z`);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return left === right;
  const daysApart = Math.abs(leftTime - rightTime) / (24 * 60 * 60 * 1000);
  return daysApart <= 2;
};

const buildManualMovementReport = ({
  playerName,
  sourceUrl,
  transactionsHtml,
  draft,
  playerStatus,
  movementAnchor,
  teams,
  draftDates,
}: {
  playerName: string;
  sourceUrl: string;
  transactionsHtml: string;
  draft: PlayerManualDraftReport | null;
  playerStatus?: PlayerManualStatusReport | null;
  movementAnchor?: PlayerManualMovementAnchor | null;
  teams?: TeamReportLookupRecord[];
  draftDates?: LeagueDraftDateRecord[];
}): PlayerManualMovementReport => {
  const rawEvents = parsePuckPediaTransactions(transactionsHtml, playerName).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const teamLookup = teams ?? [];
  const movements: PlayerManualMovementReportEntry[] = [];
  const jerseyChanges: PlayerManualJerseyReportEntry[] = [];
  const movementKeys = new Set<string>();
  const anchorTeamName = resolveReportTeamNameByText(teamLookup, movementAnchor?.teamName);
  const anchorSeasonStartDate = movementAnchor?.seasonStartDate ?? null;
  const anchorStintStartDate = movementAnchor?.stintStartDate ?? anchorSeasonStartDate;
  const anchorKnownFromDate = anchorSeasonStartDate ?? anchorStintStartDate;
  const draftTeamName = resolveReportTeamName(teamLookup, draft?.teamCode, draft?.teamName);
  const normalizedDraft = draft
    ? {
        ...draft,
        teamName: draftTeamName ?? draft.teamName ?? null,
      }
    : null;
  const draftStartDate = getDraftPickStartDate(normalizedDraft, draftDates ?? []);
  const anchorHasDraftAcquisition =
    movementAnchor?.acquisitionType === MANUAL_MOVEMENT_ACQUISITION_TYPES.draft;
  const anchorIsDraftStint = anchorHasDraftAcquisition || teamsMatch(anchorTeamName, draftTeamName);
  const anchorDraftStartDate =
    draftStartDate ?? (anchorHasDraftAcquisition ? anchorStintStartDate : null);
  const anchorIsTeamTransferStint =
    movementAnchor?.acquisitionType === MANUAL_MOVEMENT_ACQUISITION_TYPES.teamTransfer ||
    reportTeamsShareFranchiseTransfer(teamLookup, draftTeamName, anchorTeamName);
  let activeTeamName = draftTeamName;
  let anchorAppliedToActiveTeam = false;
  let activeTeamHasTransactionEvidence = false;

  const addMovement = (movement: PlayerManualMovementReportEntry) => {
    const duplicateIndex = movements.findIndex(
      (existingMovement) =>
        existingMovement.acquisitionType === movement.acquisitionType &&
        teamsMatch(existingMovement.fromTeamName, movement.fromTeamName) &&
        teamsMatch(existingMovement.toTeamName, movement.toTeamName) &&
        movementDatesAreNear(existingMovement.startDate, movement.startDate),
    );
    if (duplicateIndex >= 0) {
      const existingMovement = movements[duplicateIndex];
      if (
        movement.startDate &&
        (!existingMovement.startDate || movement.startDate < existingMovement.startDate)
      ) {
        movements[duplicateIndex] = {
          ...existingMovement,
          id: movement.id,
          startDate: movement.startDate,
          previousEndDate: movement.previousEndDate,
          detail: movement.detail || existingMovement.detail,
        };
      }
      return;
    }

    const key = [
      movement.acquisitionType,
      movement.startDate,
      normalizeTeamNameKey(movement.fromTeamName),
      normalizeTeamNameKey(movement.toTeamName),
    ].join('|');
    if (movementKeys.has(key)) return;
    movementKeys.add(key);
    movements.push(movement);
  };

  const activeTeamNameForEvent = (eventDate: string) => {
    if (
      !anchorAppliedToActiveTeam &&
      !activeTeamHasTransactionEvidence &&
      anchorTeamName &&
      anchorKnownFromDate &&
      eventDate >= anchorKnownFromDate
    ) {
      activeTeamName = anchorTeamName;
      anchorAppliedToActiveTeam = true;
    }
    return activeTeamName;
  };

  const movementsVisibleFromDate = (startDate: string | null) => {
    if (!startDate) return movements;
    const activeMovementIndex = movements.findIndex((movement, index) => {
      const nextMovementStartDate = movements[index + 1]?.startDate ?? null;
      return (
        (!movement.startDate || movement.startDate <= startDate) &&
        (!nextMovementStartDate || nextMovementStartDate > startDate)
      );
    });
    if (activeMovementIndex >= 0) return movements.slice(activeMovementIndex);
    return movements.filter((movement) => !movement.startDate || movement.startDate >= startDate);
  };

  rawEvents.forEach((event) => {
    const sourceEventId = `event:${event.date}`;

    if (event.type === 'jersey') {
      jerseyChanges.push({
        id: `${event.date}-jersey-${event.toNumber ?? event.detail}`,
        date: event.date,
        teamName: resolveReportTeamNameByText(teamLookup, event.teamName),
        fromNumber: event.fromNumber ?? null,
        toNumber: event.toNumber ?? null,
        detail: event.detail,
      });
      return;
    }

    if ((event.type === 'trade' || event.type === 'waiver') && event.toTeamName) {
      const eventActiveTeamName = activeTeamNameForEvent(event.date);
      const fromTeamName = resolveReportTeamNameByText(
        teamLookup,
        event.fromTeamName ?? eventActiveTeamName,
      );
      const toTeamName = resolveReportTeamNameByText(teamLookup, event.toTeamName);
      addMovement({
        id: sourceEventId,
        acquisitionType:
          event.type === 'waiver'
            ? MANUAL_MOVEMENT_ACQUISITION_TYPES.waivers
            : MANUAL_MOVEMENT_ACQUISITION_TYPES.trade,
        startDate: event.date,
        endDate: null,
        previousEndDate: event.date,
        fromTeamName,
        toTeamName,
        detail: event.detail,
      });
      activeTeamName = toTeamName;
      activeTeamHasTransactionEvidence = true;
      return;
    }

    if (event.type === 'signing' && event.teamName) {
      const toTeamName = resolveReportTeamNameByText(teamLookup, event.teamName);
      const eventActiveTeamName = activeTeamNameForEvent(event.date);
      const signingKeepsSameTeam = teamsMatch(eventActiveTeamName, toTeamName);
      if (
        signingKeepsSameTeam ||
        reportTeamsShareFranchiseTransfer(teamLookup, eventActiveTeamName, toTeamName)
      ) {
        if (signingKeepsSameTeam) {
          activeTeamName = toTeamName;
          activeTeamHasTransactionEvidence = true;
        }
        return;
      }
      addMovement({
        id: sourceEventId,
        acquisitionType: MANUAL_MOVEMENT_ACQUISITION_TYPES.freeAgency,
        startDate: event.date,
        endDate: null,
        previousEndDate: eventActiveTeamName ? event.date : null,
        fromTeamName: eventActiveTeamName,
        toTeamName,
        detail: event.detail,
      });
      activeTeamName = toTeamName;
      activeTeamHasTransactionEvidence = true;
    }
  });

  let reportStartDate = anchorSeasonStartDate;
  let visibleMovements = movements;

  if (anchorTeamName) {
    let anchorMovementIndex = -1;
    movements.forEach((movement, index) => {
      if (!teamsMatch(movement.toTeamName, anchorTeamName)) return;
      if (
        anchorSeasonStartDate &&
        movement.startDate &&
        movement.startDate > anchorSeasonStartDate
      ) {
        return;
      }
      anchorMovementIndex = index;
    });

    if (anchorMovementIndex >= 0) {
      visibleMovements = movements.slice(anchorMovementIndex);
      const anchorMovementIsKnownDraftStart =
        anchorIsDraftStint &&
        visibleMovements[0] &&
        (!visibleMovements[0].startDate ||
          (!!anchorDraftStartDate &&
            movementDatesAreNear(visibleMovements[0].startDate, anchorDraftStartDate)));
      if (anchorMovementIsKnownDraftStart && visibleMovements[0]) {
        visibleMovements = [
          {
            ...visibleMovements[0],
            id: `anchor:${movementAnchor?.stintId ?? anchorDraftStartDate ?? 'unknown'}`,
            acquisitionType: MANUAL_MOVEMENT_ACQUISITION_TYPES.draft,
            startDate: anchorDraftStartDate,
            previousEndDate: null,
            fromTeamName: null,
            detail: visibleMovements[0].detail,
          },
          ...visibleMovements.slice(1),
        ];
      }
      reportStartDate = anchorMovementIsKnownDraftStart
        ? (anchorSeasonStartDate ?? reportStartDate)
        : (movements[anchorMovementIndex].startDate ?? reportStartDate);
    } else {
      visibleMovements = movementsVisibleFromDate(anchorSeasonStartDate);
      const hasVisibleAnchorMovement = visibleMovements.some((movement) =>
        teamsMatch(movement.toTeamName, anchorTeamName),
      );
      if (!hasVisibleAnchorMovement) {
        const anchorAcquisitionType = anchorIsDraftStint
          ? MANUAL_MOVEMENT_ACQUISITION_TYPES.draft
          : anchorIsTeamTransferStint
            ? MANUAL_MOVEMENT_ACQUISITION_TYPES.teamTransfer
            : MANUAL_MOVEMENT_CURRENT_STINT_ACQUISITION;
        const anchorStartDate = anchorIsDraftStint ? draftStartDate : anchorStintStartDate;
        visibleMovements = [
          {
            id: `anchor:${movementAnchor?.stintId ?? anchorStartDate ?? 'unknown'}`,
            acquisitionType: anchorAcquisitionType,
            startDate: anchorStartDate,
            endDate: null,
            previousEndDate: null,
            fromTeamName: null,
            toTeamName: anchorTeamName,
            detail: '',
          },
          ...visibleMovements,
        ];
      }
      reportStartDate = anchorStintStartDate ?? reportStartDate;
    }
  }

  const movementDateCounts = visibleMovements.reduce<Map<string, number>>((counts, movement) => {
    if (movement.startDate) counts.set(movement.startDate, (counts.get(movement.startDate) ?? 0) + 1);
    return counts;
  }, new Map());
  let anchoredEventSequence = 0;
  const movementsWithEndDates = visibleMovements.map((movement, index) => {
    const isPersistedAnchor = index === 0 && !!movementAnchor?.stintId;
    let id = movement.id;
    if (isPersistedAnchor) {
      id = `anchor:${movementAnchor.stintId}`;
    } else if (movementAnchor?.stintId) {
      anchoredEventSequence += 1;
      id =
        movement.startDate && (movementDateCounts.get(movement.startDate) ?? 0) > 1
          ? `ambiguous:${movementAnchor.stintId}:${movement.startDate}`
          : `event:${movementAnchor.stintId}:${anchoredEventSequence}`;
    }

    return {
      ...movement,
      id,
      endDate: visibleMovements[index + 1]?.startDate ?? null,
    };
  });
  const visibleJerseyChanges = reportStartDate
    ? jerseyChanges.filter((change) => change.date >= reportStartDate)
    : jerseyChanges;

  return {
    playerName,
    sourceUrl,
    draft: normalizedDraft,
    playerStatus: playerStatus ?? null,
    movementAnchor,
    movements: movementsWithEndDates,
    jerseyChanges: visibleJerseyChanges,
  };
};

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

const MANUAL_MOVEMENT_SOURCE_FORM_ID = 'manual-movement-source-form';
const MANUAL_MOVEMENT_CURRENT_STINT_ACQUISITION = 'current_stint';
const MANUAL_MOVEMENT_ACQUISITION_TYPES = {
  draft: 'draft',
  trade: 'trade',
  freeAgency: 'free_agency',
  waivers: 'waivers',
  teamTransfer: 'team_transfer',
} as const;

const formatManualMovementAcquisitionType = (acquisitionType: string) =>
  acquisitionType === MANUAL_MOVEMENT_CURRENT_STINT_ACQUISITION
    ? 'Current stint'
    : (ACQUISITION_TYPE_LABELS[acquisitionType] ?? acquisitionType);

export const buildManualMovementStintImport = (
  report: PlayerManualMovementReport,
  teams: TeamReportLookupRecord[],
  position: string | null | undefined,
  latestPlayedSeason?: PlayerManualMovementSeasonBoundary | null,
): {
  stints: ReconcilePlayerStintInput[];
  issues: string[];
  warnings: PlayerManualMovementImportWarning[];
} => {
  const stints: ReconcilePlayerStintInput[] = [];
  const issues: string[] = [];
  const warnings: PlayerManualMovementImportWarning[] = [];
  const importKeys = new Set<string>();

  [...report.movements]
    .sort((left, right) => (left.startDate ?? '').localeCompare(right.startDate ?? ''))
    .forEach((movement) => {
      const acquisitionType =
        movement.acquisitionType === MANUAL_MOVEMENT_CURRENT_STINT_ACQUISITION
          ? (report.movementAnchor?.acquisitionType ?? null)
          : movement.acquisitionType;

      if (!movement.startDate) {
        issues.push(`${movement.toTeamName ?? 'Unknown team'} is missing a start date.`);
        return;
      }
      if (latestPlayedSeason?.endDate && movement.startDate > latestPlayedSeason.endDate) {
        warnings.push({
          movementId: movement.id,
          message: `${movement.toTeamName ?? 'This team'} movement occurred after ${latestPlayedSeason.name}, the player's latest played season. Select the appropriate season and move the player manually so they are added to that team's roster.`,
        });
        return;
      }
      if (movement.endDate && movement.endDate < movement.startDate) {
        issues.push(
          `${movement.toTeamName ?? 'Unknown team'} has dates outside the tracked history.`,
        );
        return;
      }

      const team = findReportTeamByText(teams, movement.toTeamName);
      if (!team?.id) {
        issues.push(`${movement.toTeamName ?? 'Unknown team'} does not match an NHL team.`);
        return;
      }

      const importKey = `nhl_puckpedia:v1:${movement.id}`;
      if (importKeys.has(importKey)) {
        issues.push(`${movement.startDate} has multiple team-changing events; review them manually.`);
        return;
      }
      importKeys.add(importKey);

      const endDate =
        movement.endDate &&
        latestPlayedSeason?.endDate &&
        movement.endDate > latestPlayedSeason.endDate
          ? null
          : movement.endDate;

      stints.push({
        import_key: importKey,
        team_id: team.id,
        position: position ?? null,
        acquisition_type: acquisitionType,
        start_date: movement.startDate,
        end_date: endDate,
      });
    });

  return {
    stints,
    issues: [...new Set(issues)],
    warnings: [...new Map(warnings.map((warning) => [warning.movementId, warning])).values()],
  };
};

const manualMovementStintColumns: Column<PlayerManualMovementReportEntry>[] = [
  { header: 'Team', key: 'toTeamName' },
  {
    type: 'custom',
    header: 'Acquisition',
    render: (movement) => formatManualMovementAcquisitionType(movement.acquisitionType),
  },
  {
    type: 'custom',
    header: 'Start Date',
    render: (movement) => formatDate(movement.startDate) ?? '-',
  },
  {
    type: 'custom',
    header: 'End Date',
    render: (movement) => formatDate(movement.endDate) ?? 'Present',
  },
];

const manualMovementJerseyColumns: Column<PlayerManualJerseyReportEntry>[] = [
  {
    type: 'custom',
    header: 'Date',
    render: (change) => formatDate(change.date) ?? '-',
  },
  { header: 'Team', key: 'teamName' },
  {
    type: 'custom',
    header: 'From',
    render: (change) => (change.fromNumber ? `#${change.fromNumber}` : '-'),
  },
  {
    type: 'custom',
    header: 'To',
    render: (change) => (change.toNumber ? `#${change.toNumber}` : '-'),
  },
];

const getManualMovementDisplayDate = (movement: PlayerManualMovementReportEntry) =>
  movement.endDate ?? movement.startDate ?? '';

const sortManualMovementReportMovementsForDisplay = (
  movements: PlayerManualMovementReportEntry[],
) =>
  [...movements].sort((a, b) => {
    const aIsCurrent = a.endDate === null;
    const bIsCurrent = b.endDate === null;

    if (aIsCurrent !== bIsCurrent) {
      return aIsCurrent ? -1 : 1;
    }

    return (
      getManualMovementDisplayDate(b).localeCompare(getManualMovementDisplayDate(a)) ||
      (b.startDate ?? '').localeCompare(a.startDate ?? '') ||
      (a.toTeamName ?? '').localeCompare(b.toTeamName ?? '')
    );
  });

const manualMovementStatusTagIntents: Record<PlayerStatus, TagIntent> = {
  active: 'success',
  inactive: 'warning',
  retired: 'danger',
};

const ManualMovementReportSection = ({
  report,
  applyBusy,
  applyIssues,
  applyWarnings,
  applyStintCount,
  onApply,
  onOpenSource,
}: {
  report: PlayerManualMovementReport | null;
  applyBusy: boolean;
  applyIssues: string[];
  applyWarnings: PlayerManualMovementImportWarning[];
  applyStintCount: number;
  onApply: () => void;
  onOpenSource: () => void;
}) => {
  const reportMovements = report
    ? sortManualMovementReportMovementsForDisplay(report.movements)
    : [];
  const jerseyChanges = report?.jerseyChanges
    ? [...report.jerseyChanges].sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const warningByMovementId = new Map(
    applyWarnings.map((warning) => [warning.movementId, warning.message]),
  );

  return (
    <Section
      title="Manual Movement Report"
      className={styles.stintHistorySection}
      action={
        <div className={styles.manualMovementActions}>
          {report && applyStintCount > 0 && (
            <Button
              type="button"
              variant="outlined"
              intent="neutral"
              icon="sync"
              size="medium"
              tooltip={
                applyIssues.length > 0
                  ? 'Resolve unmatched teams or missing dates before applying'
                  : applyWarnings.length > 0
                    ? 'Apply eligible stints; highlighted movements require a manual move'
                  : 'Apply reviewed team stints'
              }
              disabled={applyBusy || applyIssues.length > 0}
              onClick={onApply}
            >
              {applyBusy
                ? 'Applying...'
                : `Apply ${applyStintCount} Stint${applyStintCount === 1 ? '' : 's'}`}
            </Button>
          )}
          <Button
            type="button"
            variant="outlined"
            intent="neutral"
            icon="description"
            size="medium"
            tooltip="PuckPedia source"
            onClick={onOpenSource}
          >
            PuckPedia Source
          </Button>
        </div>
      }
    >
      {!report && <p className={styles.placeholder}>No manual movement report generated yet.</p>}

      {report && applyIssues.length > 0 && (
        <Banner
          intent="warning"
          icon="warning"
        >
          {applyIssues.join(' ')}
        </Banner>
      )}

      {report && applyWarnings.length > 0 && (
        <Banner
          intent="warning"
          icon="warning"
        >
          {applyWarnings.map((warning) => warning.message).join(' ')}
        </Banner>
      )}

      {report?.draft && (
        <ResponsiveList className={styles.stintHistoryList}>
          <ListItem
            fullWidth
            hideImage
            name={report.draft.teamName ?? report.draft.teamCode ?? 'Unknown team'}
            subtitle={`Draft Year: ${report.draft.year} | Round: ${report.draft.round}`}
            rightContent={{ type: 'tag', label: 'Draft', intent: 'info' }}
          />
        </ResponsiveList>
      )}

      {report?.playerStatus && (
        <>
          <h4>Player Status</h4>
          <ResponsiveList className={styles.stintHistoryList}>
            <ListItem
              fullWidth
              hideImage
              name={PLAYER_STATUS_LABELS[report.playerStatus.status]}
              subtitle={`Date: ${formatDate(report.playerStatus.date) ?? '-'}`}
              rightContent={{
                type: 'tag',
                label: PLAYER_STATUS_LABELS[report.playerStatus.status],
                intent: manualMovementStatusTagIntents[report.playerStatus.status],
              }}
            />
          </ResponsiveList>
        </>
      )}

      {report && (
        <Table
          columns={manualMovementStintColumns}
          data={reportMovements}
          rowKey={(movement) => movement.id}
          rowClassName={(movement) =>
            warningByMovementId.has(movement.id)
              ? styles.manualMovementWarningRow
              : undefined
          }
          emptyMessage="No team stints generated yet."
        />
      )}

      {jerseyChanges.length > 0 && (
        <>
          <h4>Jersey Number Changes</h4>
          <Table
            columns={manualMovementJerseyColumns}
            data={jerseyChanges}
            rowKey={(change) => change.id}
          />
        </>
      )}
    </Section>
  );
};

const ManualMovementReportModal = ({
  open,
  report,
  teams,
  draftDates,
  onReportBuilt,
  onClose,
}: {
  open: boolean;
  report: PlayerManualMovementReport | null;
  teams: TeamReportLookupRecord[];
  draftDates: LeagueDraftDateRecord[];
  onReportBuilt: (report: PlayerManualMovementReport) => void;
  onClose: () => void;
}) => {
  const { control, handleSubmit, reset, watch } = useForm<PlayerManualMovementSourceForm>({
    defaultValues: { sourceText: '' },
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const sourceText = watch('sourceText') ?? '';

  useEffect(() => {
    reset({ sourceText: '' });
    setParseError(null);
  }, [report, reset]);

  useEffect(() => {
    setParseError(null);
  }, [sourceText]);

  if (!open || !report) return null;

  const buildReport = handleSubmit(({ sourceText }) => {
    const trimmedSource = sourceText.trim();
    if (!trimmedSource) {
      setParseError('Paste PuckPedia transaction text or HTML first.');
      return;
    }
    const nextReport = buildManualMovementReport({
      playerName: report.playerName,
      sourceUrl: report.sourceUrl,
      transactionsHtml: trimmedSource,
      draft: report.draft,
      playerStatus: report.playerStatus,
      movementAnchor: report.movementAnchor,
      teams,
      draftDates,
    });

    if (
      !nextReport.playerStatus &&
      nextReport.movements.length === 0 &&
      (nextReport.jerseyChanges?.length ?? 0) === 0
    ) {
      setParseError(
        'No team-changing movements or jersey changes were detected in the pasted text.',
      );
      return;
    }

    onReportBuilt(nextReport);
    onClose();
  });

  return (
    <Modal
      open
      title="PuckPedia Source"
      onClose={onClose}
      cancelLabel="Close"
      size="lg"
      confirmForm={MANUAL_MOVEMENT_SOURCE_FORM_ID}
      confirmLabel="Build report"
      confirmIcon="playlist_add_check"
      confirmDisabled={!sourceText.trim()}
      disableBackdropClose
    >
      <p>
        <InlineAction
          className={styles.infoCellCopyButton}
          href={report.sourceUrl}
          target="_blank"
          rel="noreferrer"
          ariaLabel="Open PuckPedia"
          tooltip="Open PuckPedia"
          tooltipClassName={styles.infoCellCopyTooltip}
          indicatorClassName={styles.infoCellCopyIndicator}
          icon="open_in_new"
        >
          Open PuckPedia
        </InlineAction>
      </p>
      <form
        id={MANUAL_MOVEMENT_SOURCE_FORM_ID}
        onSubmit={buildReport}
      >
        <Field
          type="textarea"
          label="PuckPedia transactions text or HTML"
          control={control}
          name="sourceText"
          rows={10}
        />
      </form>
      {parseError && (
        <Banner
          intent="warning"
          icon="warning"
        >
          {parseError}
        </Banner>
      )}
    </Modal>
  );
};

// ── Career stats table columns ──────────────────────────────────────────────
const skaterCareerStatColumns: Column<PlayerCareerStatRecord>[] = [
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
  hasCollapsedStints(stint) && stint.collapsed_stints.length > 0 ? stint.collapsed_stints : [stint];

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

const photoHistoryKey = (entry: PlayerPhotoEntry) =>
  entry.id ?? `${entry.team_id}:${entry.season_id}`;

const hasSavedPhoto = (entry: PlayerPhotoEntry) => Boolean(entry.has_saved_photo ?? entry.id);

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
      .filter((entry) => entry.team_id === stint.team_id && hasSavedPhoto(entry))
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

const getStintPhotoHistory = (
  stint: PlayerStintRecord,
  seasons: SeasonRecord[],
  photoHistory: PlayerPhotoEntry[],
  teamLeagueId?: string | null,
) => {
  const fallbackLeagueId = seasons.find((season) => season.id === stint.season_id)?.league_id;
  const leagueId = teamLeagueId ?? fallbackLeagueId ?? null;

  return photoHistory.filter((entry) => {
    if (entry.team_id !== stint.team_id) return false;
    const season = seasons.find((candidate) => candidate.id === entry.season_id);
    if (!season) return true;
    if (leagueId && season.league_id !== leagueId) return false;
    return seasonOverlapsStint(season, stint);
  });
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

  if (entries.length === 0 && stint.jersey_number != null && stint.start_date) {
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

const formatSavePct = (value: number | string | null | undefined) => {
  if (value == null) return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toFixed(3).replace(/^0/, '');
};

// Goals-against average = goals against per 60 minutes of ice time.
const formatGaa = (
  ga: number | string | null | undefined,
  toi: number | string | null | undefined,
) => {
  if (ga == null || !toi) return '—';
  const goalsAgainst = Number(ga);
  const seconds = Number(toi);
  if (!Number.isFinite(goalsAgainst) || !Number.isFinite(seconds) || seconds <= 0) {
    return '—';
  }
  return ((goalsAgainst * 3600) / seconds).toFixed(2);
};

const goalieCareerStatColumns: Column<PlayerCareerStatRecord>[] = [
  ...skaterCareerStatColumns.slice(0, 3),
  { header: 'GP', key: 'gp', align: 'center' },
  { header: 'W', key: 'wins', align: 'center' },
  { header: 'SO', key: 'shootout_wins', align: 'center' },
  {
    type: 'custom',
    header: 'GAA',
    render: (row) => formatGaa(row.goals_against, row.time_on_ice),
    align: 'center',
  },
  {
    type: 'custom',
    header: 'SV%',
    render: (row) => formatSavePct(row.save_pct),
    align: 'center',
  },
];

export const buildCareerStatColumns = (isGoalie: boolean): Column<PlayerCareerStatRecord>[] =>
  isGoalie ? goalieCareerStatColumns : skaterCareerStatColumns;

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
  currentPhotoHistoryKey,
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
  currentPhotoHistoryKey: string | null;
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
          <ResponsiveList className={styles.stintHistoryList}>
            {photoHistory.map((entry) => {
              const savedPhoto = hasSavedPhoto(entry);
              const current = photoHistoryKey(entry) === currentPhotoHistoryKey;
              const photo = entry.photo;

              return (
                <ListItem
                  key={photoHistoryKey(entry)}
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
                      tooltip: savedPhoto ? 'Edit season photo' : 'Set season photo',
                      ariaLabel: savedPhoto ? 'Edit season photo' : 'Set season photo',
                      onClick: () =>
                        onChangePhoto(stint, entry.season_id, savedPhoto ? 'edit' : 'set'),
                    },
                    savedPhoto && {
                      icon: 'delete',
                      intent: 'danger' as const,
                      tooltip: 'Delete season photo',
                      ariaLabel: 'Delete season photo',
                      onClick: () => onDeletePhotoEntry(entry),
                    },
                  ]}
                  ariaLabel={`Preview ${entry.season_name ?? 'season'} photo`}
                  onClick={photo ? () => onPreviewPhoto(photo) : undefined}
                />
              );
            })}
          </ResponsiveList>
        )}
      </div>

      <div className={styles.stintHistorySection}>
        <span className={styles.stintHistoryTitle}>Jersey Numbers</span>
        {jerseyRows.length === 0 ? (
          <p className={styles.stintHistoryEmpty}>No jersey number history yet.</p>
        ) : (
          <ResponsiveList className={styles.stintHistoryList}>
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
          </ResponsiveList>
        )}
      </div>
    </div>
  );
};

export const buildGameLogColumns = (isGoalie: boolean): Column<PlayerLastFiveGameRecord>[] => [
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
              label="GA"
              tooltip="Goals Against"
            />
          ),
          render: (row: PlayerLastFiveGameRecord) => row.goals_against ?? '—',
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
    reconcilePlayerStints,
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
  const { draftDates: leagueDraftDates } = useLeagueDraftDates(leagueId, {
    enabled: isAdminView && !isLegacyIdRoute,
  });
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
  const latestPlayedSeason =
    playerSeasonOptions.find((season) => season.id === defaultPlayerSeasonId) ?? null;
  const [seasonStatsSeasonId, setSeasonStatsSeasonId] = useState<string | null>(null);
  const effectiveSeasonStatsSeasonId = seasonStatsSeasonId ?? defaultPlayerSeasonId;
  const { currentSeasonStats: seasonStats, loading: seasonStatsLoading } =
    usePlayerCurrentSeasonStats(id, {
      mode,
      seasonId: effectiveSeasonStatsSeasonId,
      requireSeasonId: true,
    });
  const renderedPlayerSeasonOptions =
    seasonStats?.season_id &&
    !playerSeasonOptions.some((season) => season.id === seasonStats.season_id)
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
  const [manualMovementReport, setManualMovementReport] =
    useState<PlayerManualMovementReport | null>(null);
  const [manualMovementSourceOpen, setManualMovementSourceOpen] = useState(false);
  const [manualMovementApplyOpen, setManualMovementApplyOpen] = useState(false);
  const [manualMovementApplying, setManualMovementApplying] = useState(false);
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
    if (!deletingPhotoEntry?.id) {
      setDeletingPhotoEntry(null);
      return;
    }
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
    targetSeasonId?: string | null,
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
          target_season_id: targetSeasonId ?? null,
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
  const manualMovementReportTeams = leagueId
    ? teams.filter((team) => team.league_id === leagueId)
    : teams;
  const manualMovementStintImport =
    manualMovementReport && player
      ? buildManualMovementStintImport(
          manualMovementReport,
          manualMovementReportTeams,
          player.position,
          latestPlayedSeason
            ? {
                name: latestPlayedSeason.name,
                endDate: dateKey(latestPlayedSeason.end_date),
              }
            : null,
        )
      : { stints: [], issues: [], warnings: [] };
  const manualMovementStartSeason =
    gameLogSeasons.find((season) => season.name === MANUAL_MOVEMENT_START_SEASON_NAME) ??
    playerSeasonOptions.find((season) => season.name === MANUAL_MOVEMENT_START_SEASON_NAME) ??
    null;
  const manualMovementStartSeasonStart =
    dateKey(manualMovementStartSeason?.start_date) ?? MANUAL_MOVEMENT_START_FALLBACK_DATE;
  const manualMovementAnchorStint =
    (manualMovementStartSeasonStart
      ? stints.find((stint) => {
          const stintStart = dateKey(stint.start_date);
          const stintEnd = dateKey(stint.end_date);
          return (
            (!stintStart || stintStart <= manualMovementStartSeasonStart) &&
            (!stintEnd || stintEnd >= manualMovementStartSeasonStart)
          );
        })
      : null) ??
    stints.find((stint) => stint.season_id === manualMovementStartSeason?.id) ??
    null;
  const manualMovementAnchor: PlayerManualMovementAnchor | null = manualMovementAnchorStint
    ? {
        stintId: manualMovementAnchorStint.id,
        teamCode: normalizeTeamCode(manualMovementAnchorStint.team.code),
        teamName: manualMovementAnchorStint.team.name ?? null,
        seasonName: manualMovementStartSeason?.name ?? MANUAL_MOVEMENT_START_SEASON_NAME,
        seasonStartDate: manualMovementStartSeasonStart,
        stintStartDate: dateKey(manualMovementAnchorStint.start_date),
        acquisitionType: manualMovementAnchorStint.acquisition_type ?? null,
      }
    : null;

  const createManualMovementReportSeed = (
    reportPlayerName: string,
    draft: PlayerManualDraftReport | null = null,
    playerStatus: PlayerManualStatusReport | null = null,
  ): PlayerManualMovementReport => {
    const puckPediaPlayerPath = `/player/${normalizePuckPediaSlug(reportPlayerName)}`;
    return {
      playerName: reportPlayerName,
      sourceUrl: puckPediaMovementReportUrl(puckPediaPlayerPath),
      draft,
      playerStatus,
      movementAnchor: manualMovementAnchor,
      movements: [],
    };
  };

  const openManualMovementReport = () => {
    if (!player) return;
    setManualMovementReport((currentReport) =>
      currentReport?.playerName === fullName
        ? currentReport
        : createManualMovementReportSeed(fullName),
    );
    setManualMovementSourceOpen(true);
  };

  const handleApplyManualMovementStints = async () => {
    if (
      manualMovementStintImport.stints.length === 0 ||
      manualMovementStintImport.issues.length > 0
    ) {
      return;
    }

    setManualMovementApplying(true);
    try {
      const result = await reconcilePlayerStints(manualMovementStintImport.stints, {
        source: 'nhl_puckpedia',
      });
      if (!result) return;

      const { create, update, adopt, unchanged, conflict } = result.summary;
      const applied = create + update + adopt;
      if (conflict > 0) {
        toast.warn(
          `${applied} team stint${applied === 1 ? '' : 's'} applied; ${conflict} manual conflict${conflict === 1 ? '' : 's'} preserved.`,
        );
      } else {
        toast.success(
          `${applied} team stint${applied === 1 ? '' : 's'} applied${unchanged > 0 ? `; ${unchanged} already up to date` : ''}.`,
        );
      }
      setManualMovementApplyOpen(false);
    } finally {
      setManualMovementApplying(false);
    }
  };

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
    const autoFillProgressSteps = PLAYER_AUTOFILL_PROGRESS_STEPS;
    setAutoFillPlayerBusy(true);
    setManualMovementReport(null);
    setManualMovementSourceOpen(false);
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
        progress: Math.min(completedSteps / autoFillProgressSteps, 0.98),
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
            ? (readPwhlText(info.catches) ?? readPwhlText(info.shoots))
            : (readPwhlText(info.shoots) ?? readPwhlText(info.catches)),
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

        updateProgressToast(2, 'Auto-filling player data: refreshing player data...');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['player', player.id] }),
          queryClient.invalidateQueries({ queryKey: ['players'] }),
        ]);

        finishProgressToast('success', 'Player data auto-filled.');
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
      const landingStatus =
        typeof landing.isActive === 'boolean' ? (landing.isActive ? 'active' : 'inactive') : null;
      if (firstName) payload.first_name = firstName;
      if (lastName) payload.last_name = lastName;
      if (landing.birthDate) payload.date_of_birth = landing.birthDate;
      if (birthCity) payload.birth_city = birthCity;
      if (landing.birthCountry) payload.birth_country = landing.birthCountry;
      if (heightCm != null) payload.height_cm = heightCm;
      if (landing.weightInPounds != null) payload.weight_lbs = landing.weightInPounds;
      if (position) payload.position = position;
      if (shoots) payload.shoots = shoots;
      if (landingStatus && getPlayerStatus(player) !== 'retired') payload.status = landingStatus;

      await axios.patch(`${API}/admin/players/${player.id}`, payload, { headers: authHeaders() });
      const reportPlayerName =
        [firstName ?? player.first_name, lastName ?? player.last_name].filter(Boolean).join(' ') ||
        fullName;
      const draft = draftReportFromLanding(landing, manualMovementReportTeams);
      setManualMovementReport(
        createManualMovementReportSeed(
          reportPlayerName,
          draft,
          statusReportFromNhlLanding(landing),
        ),
      );
      setManualMovementSourceOpen(true);

      updateProgressToast(2, 'Auto-filling player data: refreshing player data...');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['player', player.id] }),
        queryClient.invalidateQueries({ queryKey: ['players'] }),
      ]);

      finishProgressToast('success', 'Player data auto-filled. Manual movement report ready.');
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
  const heroTeamHref =
    heroTeam && (heroTeam.code || heroTeam.id)
      ? isAdminView
        ? buildTeamDetailsPath({
            leagueCode: teamDetails?.league_code ?? routeLookup?.league_code ?? leagueCode,
            leagueId,
            teamCode: heroTeam.code,
            teamId: heroTeam.id,
          })
        : buildUserTeamDetailsPath({
            leagueCode: teamDetails?.league_code ?? routeLookup?.league_code ?? leagueCode,
            leagueId,
            teamCode: heroTeam.code,
            teamId: heroTeam.id,
          })
      : null;
  const jerseyNumber = latestStint?.jersey_number ?? player.jersey_number ?? null;
  // Use the first stint (active) photo; if that's missing, fall back to the most-recent
  // historical stint that does have a photo; then fall back to the global player photo.
  const heroPhotoStint = stints.find((s) => s.photo);
  const photo = heroPhotoStint?.photo ?? player.photo;
  const currentPhotoHistoryEntry =
    photo == null
      ? null
      : (photoHistoryEntries.find(
          (entry) =>
            entry.photo === photo &&
            (heroPhotoStint == null || entry.team_id === heroPhotoStint.team_id),
        ) ?? null);
  const currentPhotoHistoryKey = currentPhotoHistoryEntry
    ? photoHistoryKey(currentPhotoHistoryEntry)
    : null;
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
  const leaguePlayerNumberHref =
    currentLeagueCode === 'NHL' && player.league_player_number
      ? buildNhlPlayerPageUrl(player.league_player_number)
      : undefined;
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
  const positionTagIntent = effectivePosition
    ? PLAYER_POSITION_TAG_INTENTS[effectivePosition]
    : 'neutral';
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
  const recentGameColumns = buildGameLogColumns(isGoalie);
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
            href={leaguePlayerNumberHref}
            onCopy={currentLeagueCode === 'PWHL' ? copyLeaguePlayerNumber : undefined}
            rel={leaguePlayerNumberHref ? 'noreferrer' : undefined}
            target={leaguePlayerNumberHref ? '_blank' : undefined}
            tooltip={leaguePlayerNumberHref ? 'Open NHL player page' : undefined}
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
              <ResponsiveList className={styles.awardTeamList}>
                {group.awards.map((award) => (
                  <ListItem
                    key={award.id}
                    fullWidth
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
              </ResponsiveList>
            </Accordion>
          ))}
        </div>
      )}
    </Section>
  );

  return (
    <>
      {/* Hero card */}
      <Card className={styles.heroCard}>
        <div className={styles.heroHeader}>
          <div className={styles.heroHeaderIdentity}>
            <Chip
              className={styles.heroJerseyChip}
              primaryColor={heroTeam?.primary_color}
              textColor={heroTeam?.text_color}
            >
              {jerseyNumber ?? '-'}
            </Chip>
            {heroTeamHref ? (
              <InlineAction
                className={styles.heroHeaderTeamLink}
                tooltipClassName={styles.heroHeaderTeamTooltip}
                href={heroTeamHref}
                ariaLabel={`View ${heroTeam?.name ?? 'team'} details`}
                tooltip={`View ${heroTeam?.name ?? 'team'} details`}
                indicatorClassName={styles.heroHeaderTeamActionIndicator}
                icon="open_in_new"
              >
                <TeamLogo
                  logo={heroTeam?.logo}
                  logoDark={heroTeam?.logo_dark}
                  logoLight={heroTeam?.logo_light}
                  code={heroTeam?.code ?? 'TEAM'}
                  primaryColor={heroTeam?.primary_color}
                  textColor={heroTeam?.text_color}
                  size={32}
                  shape="square"
                />
                <span className={styles.heroHeaderTeamName}>
                  {heroTeam?.name ?? 'No team assigned'}
                </span>
              </InlineAction>
            ) : (
              <span className={styles.heroHeaderTeamStatic}>
                <TeamLogo
                  logo={heroTeam?.logo}
                  logoDark={heroTeam?.logo_dark}
                  logoLight={heroTeam?.logo_light}
                  code={heroTeam?.code ?? 'TEAM'}
                  primaryColor={heroTeam?.primary_color}
                  textColor={heroTeam?.text_color}
                  size={32}
                  shape="square"
                />
                <span className={styles.heroHeaderTeamName}>
                  {heroTeam?.name ?? 'No team assigned'}
                </span>
              </span>
            )}
          </div>
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
        </div>
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
                size={HERO_AVATAR_SIZE}
              />
            </button>
          ) : (
            <PlayerAvatar
              photo={photo}
              initials={initials}
              primaryColor={avatarBg}
              textColor={avatarColor}
              size={HERO_AVATAR_SIZE}
            />
          )}
          <div className={styles.heroInfo}>
            <div className={styles.heroTitleRow}>
              <h2
                className={styles.heroName}
                aria-label={fullName}
              >
                <span className={styles.heroFirstName}>{player.first_name}</span>
                <span className={styles.heroLastName}>{player.last_name}</span>
              </h2>
              {positionLabel && (
                <Tag
                  className={styles.heroPositionTag}
                  label={positionLabel}
                  intent={positionTagIntent}
                  variant="outlined"
                />
              )}
            </div>
          </div>
          <div className={styles.heroRightCol}>
            <StatusTag status={playerStatus} />
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
                    columns={buildCareerStatColumns(isGoalie)}
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
                    <div
                      className={currentLeagueCode === 'NHL' ? styles.stintHistoryGrid : undefined}
                    >
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
                          <ResponsiveList className={styles.stintList}>
                            {teamHistoryStints.map((s) => {
                              const jerseyHistory = getCollapsedJerseyHistory(
                                s,
                                jerseyHistoryByStint,
                              );
                              const teamLeagueId = teams.find(
                                (team) => team.id === s.team_id,
                              )?.league_id;
                              const photoHistory = getStintPhotoHistory(
                                s,
                                seasons,
                                photoHistoryByTeam[s.team_id] ?? [],
                                teamLeagueId,
                              );
                              const missingPhotoSeason = findMissingPhotoSeason(
                                s,
                                seasons,
                                photoHistory,
                                teamLeagueId,
                              );
                              const acquisitionLabel = s.acquisition_type
                                ? (ACQUISITION_TYPE_LABELS[s.acquisition_type] ??
                                  s.acquisition_type)
                                : null;
                              const actions = [
                                missingPhotoSeason
                                  ? {
                                      icon: 'image',
                                      tooltip: 'Set team photo',
                                      onClick: () => openChangePhotoModal(s, missingPhotoSeason.id),
                                    }
                                  : null,
                                !s.end_date && s.roster_player_team_id
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
                              ].filter(
                                (action): action is NonNullable<typeof action> => action != null,
                              );

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
                                      currentPhotoHistoryKey={currentPhotoHistoryKey}
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
                          </ResponsiveList>
                        )}
                      </Section>
                      {currentLeagueCode === 'NHL' && (
                        <ManualMovementReportSection
                          report={manualMovementReport}
                          applyBusy={manualMovementApplying}
                          applyIssues={manualMovementStintImport.issues}
                          applyWarnings={manualMovementStintImport.warnings}
                          applyStintCount={manualMovementStintImport.stints.length}
                          onApply={() => setManualMovementApplyOpen(true)}
                          onOpenSource={openManualMovementReport}
                        />
                      )}
                    </div>
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
            seasons={seasons}
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

          <ManualMovementReportModal
            open={manualMovementSourceOpen}
            report={manualMovementReport}
            teams={manualMovementReportTeams}
            draftDates={leagueDraftDates}
            onReportBuilt={setManualMovementReport}
            onClose={() => setManualMovementSourceOpen(false)}
          />

          <ConfirmModal
            open={manualMovementApplyOpen}
            title="Apply Team Stints"
            body={
              <>
                Apply {manualMovementStintImport.stints.length} reviewed NHL team stint
                {manualMovementStintImport.stints.length === 1 ? '' : 's'} to this player&apos;s
                career history? Existing manual values are preserved, and season rosters are not
                changed.
              </>
            }
            confirmLabel="Apply Team Stints"
            confirmIcon="sync"
            busy={manualMovementApplying}
            onConfirm={handleApplyManualMovementStints}
            onCancel={() => setManualMovementApplyOpen(false)}
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
                  player&apos;s team history? This is only allowed when the player has no stats for
                  that team.
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
  href?: string;
  label: string;
  rel?: string;
  target?: string;
  tooltip?: string;
  value: string | null | undefined;
  onCopy?: () => void | Promise<void>;
}

interface InlineActionProps {
  ariaLabel: string;
  children: ReactNode;
  className: string;
  icon: string;
  href?: string;
  indicatorClassName?: string;
  onClick?: () => void | Promise<void>;
  rel?: string;
  target?: string;
  tooltip?: string;
  tooltipClassName?: string;
}

const InlineAction = ({
  ariaLabel,
  children,
  className,
  href,
  icon,
  indicatorClassName,
  onClick,
  rel,
  target,
  tooltip,
  tooltipClassName,
}: InlineActionProps) => {
  const content = (
    <>
      {children}
      <span
        className={indicatorClassName ?? styles.inlineActionIndicator}
        aria-hidden
      >
        <Icon
          name={icon}
          size="0.85rem"
        />
      </span>
    </>
  );

  const action = href ? (
    <a
      className={className}
      href={href}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
    >
      {content}
    </a>
  ) : (
    <button
      type="button"
      className={className}
      onClick={() => {
        void onClick?.();
      }}
      aria-label={ariaLabel}
    >
      {content}
    </button>
  );

  return tooltip ? (
    <Tooltip
      text={tooltip}
      className={tooltipClassName}
    >
      {action}
    </Tooltip>
  ) : (
    action
  );
};

const InfoCell = ({ href, label, rel, target, tooltip, value, onCopy }: InfoCellProps) => (
  <div className={styles.infoCell}>
    <span className={styles.infoCellLabel}>{label}</span>
    {value ? (
      href || onCopy ? (
        <InlineAction
          className={styles.infoCellCopyButton}
          href={href}
          onClick={onCopy}
          rel={rel}
          target={target}
          ariaLabel={`${href ? 'Open' : 'Copy'} ${label.toLowerCase()} ${value}`}
          tooltip={tooltip ?? `${href ? 'Open' : 'Copy'} ${label.toLowerCase()}`}
          tooltipClassName={styles.infoCellCopyTooltip}
          indicatorClassName={styles.infoCellCopyIndicator}
          icon={href ? 'open_in_new' : 'clone'}
        >
          <span className={styles.infoCellValue}>{value}</span>
        </InlineAction>
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
