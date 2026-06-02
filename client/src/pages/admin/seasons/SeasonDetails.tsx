import { useEffect, useState, useMemo } from 'react';
import InfoItem from '@/components/InfoItem/InfoItem';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Badge from '@/components/Badge/Badge';
import MoreActionsMenu from '@/components/MoreActionsMenu/MoreActionsMenu';
import { PaginatedTable } from '@/components/Pagination/Pagination';
import Table, { type Column } from '@/components/Table/Table';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import Tabs from '@/components/Tabs/Tabs';
import { usePageBreadcrumbs } from '@/context/BreadcrumbContext';
import useLeagueDetails from '@/hooks/useLeagueDetails';
import useLeagues from '@/hooks/useLeagues';
import useGames from '@/hooks/useGames';
import useSeasonDetails, {
  type SeasonGroupRecord,
  type SeasonTeam,
} from '@/hooks/useSeasonDetails';
import { type SeasonRecord } from '@/hooks/useSeasons';
import useSeasonStandings, { type TeamStandingRecord } from '@/hooks/useSeasonStandings';
import { computeClinched, computeEliminated } from '@/lib/computeClinched';
import {
  UUID_PATTERN,
  buildLeagueDetailsPath,
  buildPlayerDetailsPath,
  buildSeasonDetailsPath,
  buildTeamDetailsPath,
  toRouteSlug,
} from '@/lib/routeSlugs';
import useSeasonStats, {
  type SkaterStatRecord,
  type GoalieStatRecord,
} from '@/hooks/useSeasonStats';
import useTabState from '@/hooks/useTabState';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import SeasonEndModal from './SeasonEndModal';
import SeasonFormModal from './SeasonFormModal';
import SeasonGamesTab from './SeasonGamesTab';
import SeasonPlayoffsTab from './SeasonPlayoffsTab';
import SeasonTeamsCard from './SeasonTeamsCard';
import StatsLeaderCard from './StatsLeaderCard';
import styles from './SeasonDetails.module.scss';

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const parseLocal = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const formatDate = (d: string | null) => (d ? DATE_FMT.format(parseLocal(d)) : '—');
const formatEndDate = (d: string | null, isCurrent: boolean) =>
  d ? DATE_FMT.format(parseLocal(d)) : isCurrent ? 'Present' : '—';

const FORWARD_POSITIONS = new Set(['C', 'LW', 'RW']);
const DEFENSE_POSITIONS = new Set(['D', 'LD', 'RD']);

type SkaterStatType = 'points' | 'goals' | 'assists';

const PAGE_SIZE = 10;
const sortBySkaterStat = (arr: SkaterStatRecord[], stat: SkaterStatType) =>
  [...arr]
    .sort((a, b) => ((b[stat] as number) ?? 0) - ((a[stat] as number) ?? 0))
    .slice(0, PAGE_SIZE);

/** Recursively collect all team IDs in a group and its descendant groups. */
function getAllTeamIds(groupId: string, allGroups: SeasonGroupRecord[]): Set<string> {
  const ids = new Set<string>();
  const collect = (gid: string) => {
    const group = allGroups.find((g) => g.id === gid);
    if (!group) return;
    group.teams.forEach((t) => ids.add(t.id));
    allGroups.filter((g) => g.parent_id === gid).forEach((child) => collect(child.id));
  };
  collect(groupId);
  return ids;
}

const SeasonDetailsPage = () => {
  const {
    leagueSlug: routeLeagueSlug,
    leagueId: legacyLeagueId,
    seasonSlug: routeSeasonSlug,
    id: legacySeasonId,
  } = useParams<{
    leagueSlug?: string;
    leagueId?: string;
    seasonSlug?: string;
    id?: string;
  }>();
  const leagueSlug = routeLeagueSlug ?? legacyLeagueId;
  const seasonSlug = routeSeasonSlug ?? legacySeasonId;
  const navigate = useNavigate();
  const isLegacyLeagueRoute = !!leagueSlug && UUID_PATTERN.test(leagueSlug);
  const isLegacySeasonRoute = !!seasonSlug && UUID_PATTERN.test(seasonSlug);
  const { leagues: allLeagues, loading: leaguesLoading } = useLeagues();
  const routeLeague = isLegacyLeagueRoute
    ? null
    : allLeagues.find(
        (item) =>
          toRouteSlug(item.code) === leagueSlug ||
          toRouteSlug(item.name) === leagueSlug,
      );
  const leagueId = isLegacyLeagueRoute ? leagueSlug : routeLeague?.id;
  const { seasons: routeSeasons, loading: leagueDetailsLoading } = useLeagueDetails(leagueId);
  const routeSeason = isLegacySeasonRoute
    ? null
    : routeSeasons.find((item) => toRouteSlug(item.name) === seasonSlug);
  const id = isLegacySeasonRoute ? seasonSlug : routeSeason?.id;
  const [activeTab, handleTabChange] = useTabState('tab:season-details');
  const [statsSubTab, setStatsSubTab] = useState('Summary');

  const {
    season,
    groups,
    seasonTeams,
    leagueTeams,
    loading: detailsLoading,
    busy,
    groupBusy,
    setSeasonTeams,
    setSeasonGroupTeams,
    resetSeasonGroupTeams,
    addGroup,
    updateGroup,
    deleteGroup,
    setCurrentSeason,
    startPlayoffs,
    endSeason,
    updateSeason,
  } = useSeasonDetails(id);
  const loading =
    detailsLoading ||
    (!isLegacyLeagueRoute && leaguesLoading) ||
    (!isLegacySeasonRoute && leagueDetailsLoading);

  const { skaters, goalies, loading: statsLoading } = useSeasonStats(id);
  const { standings, loading: standingsLoading } = useSeasonStandings(id);

  // Shared cache with SeasonGamesTab — no extra network request when that tab is loaded.
  const { games } = useGames({ seasonId: id });
  const hasUnfinishedRegularGames = games.some(
    (g) => g.game_type === 'regular' && (g.status === 'scheduled' || g.status === 'in_progress'),
  );

  const clinchedIds = useMemo(
    () =>
      computeClinched(
        standings,
        season?.playoff_format ?? null,
        groups,
        season?.scoring_system ?? season?.league_scoring_system ?? '2-1-0',
        season?.games_per_season,
      ),
    [
      standings,
      season?.playoff_format,
      season?.scoring_system,
      season?.league_scoring_system,
      season?.games_per_season,
      groups,
    ],
  );

  // When teams are managed via user groups (group-based seasons), the flat season_teams
  // table is empty and seasonTeams will be []. Fall back to collecting unique teams from
  // all groups so the game creation dropdowns always have options to pick from.
  const effectiveSeasonTeams = useMemo<SeasonTeam[]>(() => {
    if (seasonTeams.length > 0) return seasonTeams;
    const seen = new Set<string>();
    const result: SeasonTeam[] = [];
    for (const group of groups) {
      for (const t of group.teams) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          result.push({
            ...t,
            secondary_color: '',
            home_arena: t.home_arena ?? null,
            inherited: false,
          });
        }
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [seasonTeams, groups]);

  const eliminatedIds = useMemo(
    () =>
      computeEliminated(
        standings,
        season?.playoff_format ?? null,
        groups,
        season?.scoring_system ?? season?.league_scoring_system ?? '2-1-0',
        season?.games_per_season,
      ),
    [
      standings,
      season?.playoff_format,
      season?.scoring_system,
      season?.league_scoring_system,
      season?.games_per_season,
      groups,
    ],
  );

  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<SeasonGroupRecord | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStartPlayoffsConfirm, setShowStartPlayoffsConfirm] = useState(false);

  // ── Stats state ───────────────────────────────────────────────────────────────
  type GoalieLeaderStat = 'save_pct' | 'gaa' | 'shutouts';
  // Summary sub-section state
  const [summarySkaterStat, setSummarySkaterStat] = useState<SkaterStatType>('points');
  const [summaryDefStat, setSummaryDefStat] = useState<SkaterStatType>('points');
  const [summaryGoalieStat, setSummaryGoalieStat] = useState<GoalieLeaderStat>('save_pct');
  // Hover-to-feature index for each summary card (0 = #1 player by default)
  const [hoveredSkaterIdx, setHoveredSkaterIdx] = useState(0);
  const [hoveredDefIdx, setHoveredDefIdx] = useState(0);
  const [hoveredGoalieIdx, setHoveredGoalieIdx] = useState(0);
  // Skaters full table sort + pagination
  const [fwdSort, setFwdSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'points',
    dir: 'desc',
  });
  const [fwdPage, setFwdPage] = useState(1);
  // Defense full table sort + pagination
  const [defSort, setDefSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'points',
    dir: 'desc',
  });
  const [defPage, setDefPage] = useState(1);
  // Goalies full table sort + pagination
  const [goalieSort, setGoalieSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'save_pct',
    dir: 'desc',
  });
  const [goaliePage, setGoaliePage] = useState(1);

  const {
    items: forwardStatItems,
    total: rawForwardStatsTotal,
    loading: forwardStatsLoading,
    fetching: forwardStatsFetching,
  } = useSeasonStats(id, {
    group: 'forwards',
    page: fwdPage,
    pageSize: PAGE_SIZE,
    sortKey: fwdSort.key,
    sortDir: fwdSort.dir,
  });
  const {
    items: defenseStatItems,
    total: rawDefenseStatsTotal,
    loading: defenseStatsLoading,
    fetching: defenseStatsFetching,
  } = useSeasonStats(id, {
    group: 'defense',
    page: defPage,
    pageSize: PAGE_SIZE,
    sortKey: defSort.key,
    sortDir: defSort.dir,
  });
  const {
    items: goalieStatItems,
    total: rawGoalieStatsTotal,
    loading: goalieStatsLoading,
    fetching: goalieStatsFetching,
  } = useSeasonStats(id, {
    group: 'goalies',
    page: goaliePage,
    pageSize: PAGE_SIZE,
    sortKey: goalieSort.key,
    sortDir: goalieSort.dir,
  });

  const sortSkaterTable = (arr: SkaterStatRecord[], sort: { key: string; dir: 'asc' | 'desc' }) =>
    [...arr].sort((a, b) => {
      const av = a[sort.key as keyof SkaterStatRecord] ?? '';
      const bv = b[sort.key as keyof SkaterStatRecord] ?? '';
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });

  const forwards = useMemo(
    () => skaters.filter((s) => FORWARD_POSITIONS.has(s.position ?? '')),
    [skaters],
  );
  const defensemen = useMemo(
    () => skaters.filter((s) => DEFENSE_POSITIONS.has(s.position ?? '')),
    [skaters],
  );

  const fallbackForwardStats = useMemo(
    () => sortSkaterTable(forwards, fwdSort).slice((fwdPage - 1) * PAGE_SIZE, fwdPage * PAGE_SIZE),
    [forwards, fwdSort, fwdPage],
  );
  const fallbackDefenseStats = useMemo(
    () => sortSkaterTable(defensemen, defSort).slice((defPage - 1) * PAGE_SIZE, defPage * PAGE_SIZE),
    [defensemen, defSort, defPage],
  );
  const fallbackGoalieStats = useMemo(
    () =>
      [...goalies]
        .sort((a, b) => {
          const av = a[goalieSort.key as keyof GoalieStatRecord] ?? -Infinity;
          const bv = b[goalieSort.key as keyof GoalieStatRecord] ?? -Infinity;
          if (av < bv) return goalieSort.dir === 'asc' ? -1 : 1;
          if (av > bv) return goalieSort.dir === 'asc' ? 1 : -1;
          return 0;
        })
        .slice((goaliePage - 1) * PAGE_SIZE, goaliePage * PAGE_SIZE),
    [goalies, goalieSort, goaliePage],
  );

  const forwardStats = Array.isArray(forwardStatItems)
    ? (forwardStatItems as SkaterStatRecord[])
    : fallbackForwardStats;
  const defenseStats = Array.isArray(defenseStatItems)
    ? (defenseStatItems as SkaterStatRecord[])
    : fallbackDefenseStats;
  const goalieStats = Array.isArray(goalieStatItems)
    ? (goalieStatItems as GoalieStatRecord[])
    : fallbackGoalieStats;
  const forwardStatsTotal = typeof rawForwardStatsTotal === 'number' ? rawForwardStatsTotal : forwards.length;
  const defenseStatsTotal = typeof rawDefenseStatsTotal === 'number' ? rawDefenseStatsTotal : defensemen.length;
  const goalieStatsTotal = typeof rawGoalieStatsTotal === 'number' ? rawGoalieStatsTotal : goalies.length;
  const fwdPageCount = Math.max(1, Math.ceil(forwardStatsTotal / PAGE_SIZE));
  const defPageCount = Math.max(1, Math.ceil(defenseStatsTotal / PAGE_SIZE));
  const goaliePageCount = Math.max(1, Math.ceil(goalieStatsTotal / PAGE_SIZE));

  useEffect(() => {
    if (!forwardStatsLoading && forwardStatsTotal > 0 && fwdPage > fwdPageCount) {
      setFwdPage(fwdPageCount);
    }
  }, [forwardStatsLoading, forwardStatsTotal, fwdPage, fwdPageCount]);

  useEffect(() => {
    if (!defenseStatsLoading && defenseStatsTotal > 0 && defPage > defPageCount) {
      setDefPage(defPageCount);
    }
  }, [defenseStatsLoading, defenseStatsTotal, defPage, defPageCount]);

  useEffect(() => {
    if (!goalieStatsLoading && goalieStatsTotal > 0 && goaliePage > goaliePageCount) {
      setGoaliePage(goaliePageCount);
    }
  }, [goalieStatsLoading, goalieStatsTotal, goaliePage, goaliePageCount]);

  // Standings sort + sub-tab
  const [standingsSort, setStandingsSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'points',
    dir: 'desc',
  });
  const [standingsSubTab, setStandingsSubTab] = useState<string>('all');

  // Top-level (non-auto) groups — conferences or league-wide groupings.
  const standingsTopGroups = useMemo(() => {
    const groupIds = new Set(groups.map((g) => g.id));
    return groups
      .filter((g) => (!g.parent_id || !groupIds.has(g.parent_id)) && !g.is_auto)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [groups]);

  // Division-level groups.
  const standingsDivisionGroups = useMemo(
    () =>
      groups
        .filter((g) => g.role === 'division')
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [groups],
  );

  // Pre-computed recursive team-ID set for every conference + division group.
  const standingsGroupTeamIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const g of [...standingsTopGroups, ...standingsDivisionGroups]) {
      if (!map.has(g.id)) map.set(g.id, getAllTeamIds(g.id, groups));
    }
    return map;
  }, [standingsTopGroups, standingsDivisionGroups, groups]);

  // Current division leader: the highest-ranked team (by pts) in each division.
  // standings is already sorted points-desc from the API.
  const divisionLeaderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const div of standingsDivisionGroups) {
      const divIds = standingsGroupTeamIds.get(div.id);
      if (!divIds) continue;
      const leader = standings.find((t) => divIds.has(t.team_id));
      if (leader) ids.add(leader.team_id);
    }
    return ids;
  }, [standingsDivisionGroups, standingsGroupTeamIds, standings]);

  // Wildcard tab requires at least 2 conferences and at least 2 divisions.
  const hasWildcard = standingsTopGroups.length >= 2 && standingsDivisionGroups.length >= 2;

  // Fixed-label SegmentedControl options — categories only, not individual group names.
  const standingsSubTabOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [{ value: 'all', label: 'League' }];
    if (standingsTopGroups.length >= 2) opts.push({ value: 'conference', label: 'Conference' });
    if (standingsDivisionGroups.length >= 2) opts.push({ value: 'division', label: 'Division' });
    if (hasWildcard) opts.push({ value: 'wildcard', label: 'Wildcard' });
    return opts;
  }, [standingsTopGroups.length, standingsDivisionGroups.length, hasWildcard]);

  const computeTieRanks = (values: (number | null)[]): string[] =>
    values.map((val) => {
      const firstIdx = values.findIndex((v) => v === val);
      const rank = firstIdx + 1;
      const count = values.filter((v) => v === val).length;
      return count > 1 ? `T${rank}` : `${rank}`;
    });

  const summarySkaters = useMemo(
    () => sortBySkaterStat(skaters, summarySkaterStat),
    [skaters, summarySkaterStat],
  );
  const handleFwdSort = (key: string, dir: 'asc' | 'desc') => {
    setFwdSort({ key, dir });
    setFwdPage(1);
  };

  const handleDefSort = (key: string, dir: 'asc' | 'desc') => {
    setDefSort({ key, dir });
    setDefPage(1);
  };

  const summaryGoalies = useMemo(() => {
    const isAsc = summaryGoalieStat === 'gaa';
    return [...goalies]
      .sort((a, b) => {
        const av = (a[summaryGoalieStat] ?? (isAsc ? Infinity : -Infinity)) as number;
        const bv = (b[summaryGoalieStat] ?? (isAsc ? Infinity : -Infinity)) as number;
        return isAsc ? av - bv : bv - av;
      })
      .slice(0, PAGE_SIZE);
  }, [goalies, summaryGoalieStat]);

  const handleGoalieSort = (key: string, dir: 'asc' | 'desc') => {
    setGoalieSort({ key, dir });
    setGoaliePage(1);
  };

  const summaryDefensemen = useMemo(
    () => sortBySkaterStat(defensemen, summaryDefStat),
    [defensemen, summaryDefStat],
  );

  const skaterTieRanks = useMemo(
    () => computeTieRanks(summarySkaters.map((s) => s[summarySkaterStat])),
    [summarySkaters, summarySkaterStat],
  );
  const defTieRanks = useMemo(
    () => computeTieRanks(summaryDefensemen.map((s) => s[summaryDefStat])),
    [summaryDefensemen, summaryDefStat],
  );
  const goalieTieRanks = useMemo(
    () => computeTieRanks(summaryGoalies.map((g) => g[summaryGoalieStat] ?? null)),
    [summaryGoalies, summaryGoalieStat],
  );

  const formatGoalieVal = (g: GoalieStatRecord, stat: GoalieLeaderStat): string => {
    if (stat === 'save_pct')
      return g.save_pct != null ? Number(g.save_pct).toFixed(3).replace(/^0/, '') : '—';
    if (stat === 'gaa') return g.gaa != null ? Number(g.gaa).toFixed(2) : '—';
    return String(g.shutouts ?? 0);
  };

  const STAT_OPTIONS: { value: SkaterStatType; label: string; tooltip: string }[] = [
    { value: 'points', label: 'PTS', tooltip: 'Points (Goals + Assists)' },
    { value: 'goals', label: 'G', tooltip: 'Goals' },
    { value: 'assists', label: 'A', tooltip: 'Assists' },
  ];
  const GOALIE_OPTIONS: { value: GoalieLeaderStat; label: string; tooltip: string }[] = [
    { value: 'save_pct', label: 'SV%', tooltip: 'Save Percentage' },
    { value: 'gaa', label: 'GAA', tooltip: 'Goals Against Average' },
    { value: 'shutouts', label: 'SO', tooltip: 'Shutouts' },
  ];

  const renderPlayerCell = (row: SkaterStatRecord | GoalieStatRecord) => (
    <div className={styles.statsPlayerCell}>
      <TeamLogo
        logo={row.team_logo}
        code={row.team_code ?? '?'}
        size={24}
        shape="square"
      />
      <PlayerAvatar
        photo={row.photo}
        initials={`${row.first_name.charAt(0)}${row.last_name.charAt(0)}`}
        primaryColor={row.team_primary_color}
        textColor={row.team_text_color}
        size={28}
      />
      <span className={styles.statsPlayerName}>
        {row.last_name}, {row.first_name}
      </span>
    </div>
  );

  const skaterColumns: Column<SkaterStatRecord>[] = [
    { type: 'custom', header: 'Player', render: renderPlayerCell },
    { header: 'POS', key: 'position', align: 'center' },
    { header: 'GP', key: 'gp', align: 'center', sortable: true },
    { header: 'G', key: 'goals', align: 'center', sortable: true },
    { header: 'A', key: 'assists', align: 'center', sortable: true },
    { header: 'PTS', key: 'points', align: 'center', sortable: true },
  ];

  const goalieColumns: Column<GoalieStatRecord>[] = [
    {
      type: 'custom',
      header: 'Player',
      render: renderPlayerCell,
      sortable: true,
      sortKey: 'last_name',
    },
    { header: 'GP', key: 'gp', align: 'center', sortable: true },
    { header: 'SA', key: 'shots_against', align: 'center', sortable: true },
    { header: 'SV', key: 'saves', align: 'center', sortable: true },
    { header: 'GA', key: 'goals_against', align: 'center', sortable: true },
    {
      type: 'custom',
      header: 'SV%',
      render: (row) =>
        row.save_pct != null ? Number(row.save_pct).toFixed(3).replace(/^0/, '') : '—',
      sortable: true,
      sortKey: 'save_pct',
      align: 'center',
    },
  ];

  const standingsColumns: Column<TeamStandingRecord>[] = [
    {
      type: 'custom',
      header: 'Team',
      render: (row) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {row.team_logo ? (
            <img
              src={row.team_logo}
              alt={row.team_name ?? ''}
              style={{ width: 24, height: 24, objectFit: 'contain' }}
            />
          ) : (
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                fontWeight: 700,
                background: row.team_primary_color ?? '#888',
                color: row.team_text_color ?? '#fff',
              }}
            >
              {row.team_code?.slice(0, 2) ?? '??'}
            </span>
          )}
          {row.team_name ?? row.team_code ?? '—'}
          {clinchedIds.has(row.team_id) && (
            <Badge
              label="x"
              intent="success"
            />
          )}
          {!clinchedIds.has(row.team_id) && eliminatedIds.has(row.team_id) && (
            <Badge
              label="e"
              intent="danger"
            />
          )}
        </span>
      ),
    },
    { header: 'GP', key: 'gp', align: 'center', sortable: true },
    {
      type: 'custom',
      header: 'GR',
      render: (row) => (row.games_remaining != null ? String(row.games_remaining) : '—'),
      sortable: true,
      sortKey: 'games_remaining',
      align: 'center',
    },
    { header: 'PTS', key: 'points', align: 'center', sortable: true },
    { header: 'W', key: 'reg_wins', align: 'center', sortable: true },
    { header: 'OTW', key: 'ot_wins', align: 'center', sortable: true },
    { header: 'OTL', key: 'otl', align: 'center', sortable: true },
    { header: 'L', key: 'losses', align: 'center', sortable: true },
  ];

  const leagueHref = buildLeagueDetailsPath({
    leagueCode: season?.league_code ?? routeLeague?.code,
    leagueId,
  });
  const seasonHref = season
    ? buildSeasonDetailsPath({
        leagueCode: season.league_code,
        leagueId: season.league_id,
        seasonName: season.name,
        seasonId: season.id,
      })
    : null;
  useEffect(() => {
    if (!season || isLegacyLeagueRoute || isLegacySeasonRoute || !seasonHref) return;
    if (
      leagueSlug !== toRouteSlug(season.league_code) ||
      seasonSlug !== toRouteSlug(season.name)
    ) {
      navigate(seasonHref, { replace: true });
    }
  }, [
    isLegacyLeagueRoute,
    isLegacySeasonRoute,
    leagueSlug,
    navigate,
    season,
    seasonHref,
    seasonSlug,
  ]);
  usePageBreadcrumbs(
    loading && !season
      ? null
      : {
          backPath: leagueHref,
          backLabel: `Back to ${season?.league_name ?? 'League'}`,
          items: [
            season
              ? { label: season.league_code, path: leagueHref }
              : { label: 'League', path: leagueHref },
            { label: season?.name ?? 'Not Found' },
          ],
        },
    [
      loading,
      leagueHref,
      season?.league_name,
      season?.league_code,
      season?.name,
    ],
  );
  const navigateToPlayer = (row: SkaterStatRecord | GoalieStatRecord) =>
    navigate(
      row.team_id
        ? buildPlayerDetailsPath({
            leagueCode: season?.league_code,
            teamCode: row.team_code,
            firstName: row.first_name,
            lastName: row.last_name,
          })
        : leagueHref,
    );
  const navigateToTeam = (row: TeamStandingRecord) =>
    navigate(
      buildTeamDetailsPath({
        leagueCode: season?.league_code,
        leagueId,
        teamCode: row.team_code,
        teamId: row.team_id,
      }),
    );

  if (loading && !season) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading season…</p>
      </div>
    );
  }

  if (!season) {
    return (
      <p style={{ color: 'var(--text-dim)' }}>Season not found.</p>
    );
  }

  return (
    <>
      <Tabs
        activeIndex={activeTab}
        onTabChange={handleTabChange}
        tabs={[
          {
            label: 'Info',
            icon: 'info',
            content: (
              <Card
                title={
                  <>
                    {season.name}
                    {season.is_current && !season.playoffs_started && (
                      <Badge
                        label="Current"
                        intent="success"
                      />
                    )}
                    {season.is_current && season.playoffs_started && (
                      <Badge
                        label="Playoffs"
                        intent="accent"
                      />
                    )}
                    {season.is_ended && (
                      <Badge
                        label="Ended"
                        intent="neutral"
                      />
                    )}
                  </>
                }
                action={
                  <div className={styles.infoCardActions}>
                    <Button
                      variant="outlined"
                      intent="neutral"
                      icon="edit"
                      onClick={() => setShowEditModal(true)}
                    >
                      Edit
                    </Button>
                    {(() => {
                      const moreItems = [
                        ...(!season.is_current
                          ? [
                              {
                                label: 'Set as Current',
                                icon: 'stars',
                                disabled: busy === 'set-current',
                                onClick: () => setCurrentSeason(true),
                              },
                            ]
                          : []),
                        ...(season.is_current &&
                        !season.playoffs_started &&
                        !hasUnfinishedRegularGames
                          ? [
                              {
                                label: 'End Regular Season',
                                icon: 'emoji_events',
                                disabled: busy === 'start-playoffs',
                                onClick: () => setShowStartPlayoffsConfirm(true),
                              },
                            ]
                          : []),
                        ...(season.is_current
                          ? [
                              {
                                label: 'End Season',
                                icon: 'flag',
                                intent: 'danger' as const,
                                disabled: busy === 'end-season',
                                onClick: () => setShowEndModal(true),
                              },
                            ]
                          : []),
                      ];
                      return moreItems.length > 0 ? (
                        <MoreActionsMenu
                          size="md"
                          buttonClassName={styles.moreActionsBtn}
                          items={moreItems}
                        />
                      ) : null;
                    })()}
                  </div>
                }
              >
                <div className={styles.infoGrid}>
                  <InfoItem
                    label="League"
                    data={season.league_name}
                  />
                  <InfoItem
                    label="Start Date"
                    data={formatDate(season.start_date)}
                  />
                  <InfoItem
                    label="End Date"
                    data={formatEndDate(season.end_date, season.is_current)}
                  />
                  <InfoItem
                    label="Games Per Season"
                    data={season.games_per_season != null ? String(season.games_per_season) : null}
                  />
                </div>
              </Card>
            ),
          },
          {
            label: 'Teams',
            icon: 'group',
            content: (
              <SeasonTeamsCard
                seasonTeams={seasonTeams}
                groups={groups}
                leagueTeams={leagueTeams}
                leagueCode={season.league_code}
                loading={loading}
                busy={busy}
                groupBusy={groupBusy}
                isEnded={season.is_ended}
                setSeasonTeams={setSeasonTeams}
                setSeasonGroupTeams={setSeasonGroupTeams}
                resetSeasonGroupTeams={resetSeasonGroupTeams}
                addGroup={addGroup}
                updateGroup={updateGroup}
                onDeleteGroup={setConfirmDeleteGroup}
              />
            ),
          },
          {
            label: 'Games',
            icon: 'sports_hockey',
            content: (
              <SeasonGamesTab
                leagueId={leagueId!}
                leagueCode={season.league_code}
                seasonId={id!}
                seasonName={season.name}
                seasonTeams={effectiveSeasonTeams}
                isEnded={season.is_ended}
              />
            ),
          },
          {
            label: 'Stats',
            icon: 'query_stats',
            content: (
              <div className={styles.statsSubTabs}>
                <SegmentedControl
                  value={statsSubTab}
                  onChange={setStatsSubTab}
                  options={[
                    { value: 'Summary', label: 'Summary' },
                    { value: 'Forwards', label: 'Forwards' },
                    { value: 'Defense', label: 'Defense' },
                    { value: 'Goalies', label: 'Goalies' },
                  ]}
                />

                {statsSubTab === 'Summary' && (
                  <div className={styles.statsLeadersPage}>
                    {/* ── Forwards card ── */}
                    <Card
                      title="Forwards"
                      action={
                        <SegmentedControl
                          value={summarySkaterStat}
                          onChange={(v) => {
                            setSummarySkaterStat(v as SkaterStatType);
                            setHoveredSkaterIdx(0);
                          }}
                          options={STAT_OPTIONS}
                          className={styles.statsSegmentedControl}
                        />
                      }
                    >
                      {summarySkaters.length > 0 ? (
                        <StatsLeaderCard
                          items={summarySkaters}
                          featuredIdx={hoveredSkaterIdx}
                          onHover={setHoveredSkaterIdx}
                          tieRanks={skaterTieRanks}
                          statLabel={
                            STAT_OPTIONS.find((o) => o.value === summarySkaterStat)?.label ??
                            summarySkaterStat
                          }
                          getFeaturedStat={(s) => s[summarySkaterStat] ?? 0}
                          getRowStat={(s) => s[summarySkaterStat] ?? 0}
                          onSelectItem={navigateToPlayer}
                          onAllLeaders={() => setStatsSubTab('Forwards')}
                        />
                      ) : (
                        !statsLoading && (
                          <p className={styles.tabPlaceholder}>No forward stats yet.</p>
                        )
                      )}
                    </Card>

                    {/* ── Defense card ── */}
                    <Card
                      title="Defense"
                      action={
                        <SegmentedControl
                          value={summaryDefStat}
                          onChange={(v) => {
                            setSummaryDefStat(v as SkaterStatType);
                            setHoveredDefIdx(0);
                          }}
                          options={STAT_OPTIONS}
                          className={styles.statsSegmentedControl}
                        />
                      }
                    >
                      {summaryDefensemen.length > 0 ? (
                        <StatsLeaderCard
                          items={summaryDefensemen}
                          featuredIdx={hoveredDefIdx}
                          onHover={setHoveredDefIdx}
                          tieRanks={defTieRanks}
                          statLabel={
                            STAT_OPTIONS.find((o) => o.value === summaryDefStat)?.label ??
                            summaryDefStat
                          }
                          getFeaturedStat={(s) => s[summaryDefStat] ?? 0}
                          getRowStat={(s) => s[summaryDefStat] ?? 0}
                          onSelectItem={navigateToPlayer}
                          onAllLeaders={() => setStatsSubTab('Defense')}
                        />
                      ) : (
                        !statsLoading && (
                          <p className={styles.tabPlaceholder}>No defense stats yet.</p>
                        )
                      )}
                    </Card>

                    {/* ── Goalies card ── */}
                    <Card
                      title="Goalies"
                      action={
                        <SegmentedControl
                          value={summaryGoalieStat}
                          onChange={(v) => {
                            setSummaryGoalieStat(v as GoalieLeaderStat);
                            setHoveredGoalieIdx(0);
                          }}
                          options={GOALIE_OPTIONS}
                          className={styles.statsSegmentedControl}
                        />
                      }
                    >
                      {summaryGoalies.length > 0 ? (
                        <StatsLeaderCard
                          items={summaryGoalies}
                          featuredIdx={hoveredGoalieIdx}
                          onHover={setHoveredGoalieIdx}
                          tieRanks={goalieTieRanks}
                          statLabel={
                            GOALIE_OPTIONS.find((o) => o.value === summaryGoalieStat)?.label ??
                            summaryGoalieStat
                          }
                          getFeaturedStat={(g) => formatGoalieVal(g, summaryGoalieStat)}
                          getRowStat={(g) => formatGoalieVal(g, summaryGoalieStat)}
                          onSelectItem={navigateToPlayer}
                          onAllLeaders={() => setStatsSubTab('Goalies')}
                        />
                      ) : (
                        !statsLoading && (
                          <p className={styles.tabPlaceholder}>No goalie stats yet.</p>
                        )
                      )}
                    </Card>
                  </div>
                )}

                {statsSubTab === 'Forwards' && (
                  <Card>
                    <PaginatedTable
                      columns={skaterColumns}
                      data={forwardStats}
                      rowKey={(r) => r.player_id}
                      loading={forwardStatsLoading}
                      fetching={forwardStatsFetching}
                      emptyMessage="No forward stats recorded yet."
                      activeSortKey={fwdSort.key}
                      sortDir={fwdSort.dir}
                      onSort={handleFwdSort}
                      onRowClick={navigateToPlayer}
                      page={fwdPage}
                      pageSize={PAGE_SIZE}
                      total={forwardStatsTotal}
                      onPageChange={setFwdPage}
                      loadingMessage="Loading forwards..."
                    />
                  </Card>
                )}

                {statsSubTab === 'Defense' && (
                  <Card>
                    <PaginatedTable
                      columns={skaterColumns}
                      data={defenseStats}
                      rowKey={(r) => r.player_id}
                      loading={defenseStatsLoading}
                      fetching={defenseStatsFetching}
                      emptyMessage="No defense stats recorded yet."
                      activeSortKey={defSort.key}
                      sortDir={defSort.dir}
                      onSort={handleDefSort}
                      onRowClick={navigateToPlayer}
                      page={defPage}
                      pageSize={PAGE_SIZE}
                      total={defenseStatsTotal}
                      onPageChange={setDefPage}
                      loadingMessage="Loading defense..."
                    />
                  </Card>
                )}

                {statsSubTab === 'Goalies' && (
                  <Card>
                    <PaginatedTable
                      columns={goalieColumns}
                      data={goalieStats}
                      rowKey={(r) => r.player_id}
                      loading={goalieStatsLoading}
                      fetching={goalieStatsFetching}
                      emptyMessage="No goalie stats recorded yet."
                      activeSortKey={goalieSort.key}
                      sortDir={goalieSort.dir}
                      onSort={handleGoalieSort}
                      onRowClick={navigateToPlayer}
                      page={goaliePage}
                      pageSize={PAGE_SIZE}
                      total={goalieStatsTotal}
                      onPageChange={setGoaliePage}
                      loadingMessage="Loading goalies..."
                    />
                  </Card>
                )}
              </div>
            ),
          },
          {
            label: 'Standings',
            icon: 'leaderboard',
            content: (
              <div className={styles.statsSubTabs}>
                {standingsSubTabOptions.length > 1 && (
                  <SegmentedControl
                    value={standingsSubTab}
                    onChange={setStandingsSubTab}
                    options={standingsSubTabOptions}
                  />
                )}

                {(() => {
                  const sortRows = (rows: TeamStandingRecord[]) =>
                    [...rows].sort((a, b) => {
                      const av = (a as unknown as Record<string, unknown>)[standingsSort.key] ?? 0;
                      const bv = (b as unknown as Record<string, unknown>)[standingsSort.key] ?? 0;
                      const cmp = Number(bv) - Number(av);
                      return standingsSort.dir === 'desc' ? cmp : -cmp;
                    });

                  const renderTable = (rows: TeamStandingRecord[], emptyMsg: string) =>
                    standingsLoading ? (
                      <p className={styles.tabPlaceholder}>Loading standings…</p>
                    ) : rows.length === 0 ? (
                      <p className={styles.tabPlaceholder}>{emptyMsg}</p>
                    ) : (
                      <Table
                        columns={standingsColumns}
                        data={rows}
                        rowKey={(row) => row.team_id}
                        activeSortKey={standingsSort.key}
                        sortDir={standingsSort.dir}
                        onSort={(key, dir) => setStandingsSort({ key, dir })}
                        onRowClick={navigateToTeam}
                      />
                    );

                  // ── Conference: one card per conference ──────────────────────────
                  if (standingsSubTab === 'conference') {
                    return standingsTopGroups.map((conf) => {
                      const ids = standingsGroupTeamIds.get(conf.id) ?? new Set<string>();
                      const rows = sortRows(standings.filter((t) => ids.has(t.team_id)));
                      return (
                        <Card
                          key={conf.id}
                          title={conf.name}
                        >
                          {renderTable(rows, 'No standings data yet.')}
                        </Card>
                      );
                    });
                  }

                  // ── Division: one card per division ──────────────────────────────
                  if (standingsSubTab === 'division') {
                    return standingsDivisionGroups.map((div) => {
                      const ids = standingsGroupTeamIds.get(div.id) ?? new Set<string>();
                      const rows = sortRows(standings.filter((t) => ids.has(t.team_id)));
                      return (
                        <Card
                          key={div.id}
                          title={div.name}
                        >
                          {renderTable(rows, 'No standings data yet.')}
                        </Card>
                      );
                    });
                  }

                  // ── Wildcard: one card per conference, non-division-leaders only ─
                  if (standingsSubTab === 'wildcard') {
                    return standingsTopGroups.map((conf) => {
                      const ids = standingsGroupTeamIds.get(conf.id) ?? new Set<string>();
                      const rows = sortRows(
                        standings.filter(
                          (t) => ids.has(t.team_id) && !divisionLeaderIds.has(t.team_id),
                        ),
                      );
                      return (
                        <Card
                          key={conf.id}
                          title={conf.name}
                        >
                          {renderTable(rows, 'No wildcard contenders yet.')}
                        </Card>
                      );
                    });
                  }

                  // ── League: all teams in one table (default) ─────────────────────
                  return <Card>{renderTable(sortRows(standings), 'No standings data yet.')}</Card>;
                })()}
              </div>
            ),
          },
          {
            label: 'Playoffs',
            icon: 'emoji_events',
            content: (
              <SeasonPlayoffsTab
                seasonId={id!}
                leagueId={season.league_id}
                leagueCode={season.league_code}
                seasonName={season.name}
                bracketRuleSetId={season.bracket_rule_set_id ?? null}
                groups={groups}
                isEnded={season.is_ended}
                playoffsStarted={season.playoffs_started}
                playoffFormat={season.playoff_format ?? null}
                bestOfPlayoff={season.best_of_playoff ?? null}
                bestOfShootout={season.best_of_shootout ?? null}
                scoringSystem={season.scoring_system ?? null}
                leagueBestOfPlayoff={season.league_best_of_playoff}
                leagueBestOfShootout={season.league_best_of_shootout}
                leagueScoringSystem={season.league_scoring_system}
                updateSeason={updateSeason}
              />
            ),
          },
        ]}
      />

      <ConfirmModal
        open={confirmDeleteGroup !== null}
        title="Delete Division"
        body={
          <>
            Delete <strong>{confirmDeleteGroup?.name}</strong>? This will also remove any
            sub-divisions and all season team assignments for this division.
          </>
        }
        confirmLabel="Delete"
        confirmIcon="delete"
        variant="danger"
        busy={groupBusy === confirmDeleteGroup?.id}
        onCancel={() => setConfirmDeleteGroup(null)}
        onConfirm={async () => {
          if (!confirmDeleteGroup) return;
          await deleteGroup(confirmDeleteGroup.id);
          setConfirmDeleteGroup(null);
        }}
      />

      <ConfirmModal
        open={showStartPlayoffsConfirm}
        title="End Regular Season"
        body={
          <>
            This will mark the regular season as complete and open the playoff matchup
            configuration. Regular-season games can still be edited, but standings will be
            considered final. Continue?
          </>
        }
        confirmLabel={busy === 'start-playoffs' ? 'Starting…' : 'Start Playoffs'}
        confirmIcon="emoji_events"
        variant="accent"
        busy={busy === 'start-playoffs'}
        onCancel={() => setShowStartPlayoffsConfirm(false)}
        onConfirm={async () => {
          const ok = await startPlayoffs();
          if (ok) {
            setShowStartPlayoffsConfirm(false);
            handleTabChange(5); // index of 'Playoffs' tab
          }
        }}
      />

      <SeasonEndModal
        open={showEndModal}
        currentEndDate={season?.end_date ?? null}
        busy={busy === 'end-season'}
        onClose={() => setShowEndModal(false)}
        onConfirm={endSeason}
      />

      <SeasonFormModal
        open={showEditModal}
        editTarget={season as SeasonRecord}
        leagueOptions={[{ value: season.league_id, label: season.league_name }]}
        addSeason={async () => false}
        updateSeason={updateSeason}
        lockedLeagueId={season.league_id}
        onClose={() => setShowEditModal(false)}
      />
    </>
  );
};

export default SeasonDetailsPage;
