import { useState, useMemo } from 'react';
import InfoItem from '@/components/InfoItem/InfoItem';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '@/components/Breadcrumbs/Breadcrumbs';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Badge from '@/components/Badge/Badge';
import MoreActionsMenu from '@/components/MoreActionsMenu/MoreActionsMenu';
import Table, { type Column } from '@/components/Table/Table';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import Tabs from '@/components/Tabs/Tabs';
import TitleRow from '@/components/TitleRow/TitleRow';
import useSeasonDetails, { type SeasonGroupRecord } from '@/hooks/useSeasonDetails';
import { type SeasonRecord } from '@/hooks/useSeasons';
import useSeasonStandings, { type TeamStandingRecord } from '@/hooks/useSeasonStandings';
import { computeClinched } from '@/lib/computeClinched';
import useSeasonStats, {
  type SkaterStatRecord,
  type GoalieStatRecord,
} from '@/hooks/useSeasonStats';
import useTabState from '@/hooks/useTabState';
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

const SeasonDetailsPage = () => {
  const { leagueId, id } = useParams<{ leagueId: string; id: string }>();
  const navigate = useNavigate();
  const [activeTab, handleTabChange] = useTabState('tab:season-details');
  const [statsSubTab, setStatsSubTab] = useState('Summary');

  const {
    season,
    groups,
    seasonTeams,
    leagueTeams,
    loading,
    busy,
    groupBusy,
    setSeasonTeams,
    setSeasonGroupTeams,
    resetSeasonGroupTeams,
    addGroup,
    updateGroup,
    deleteGroup,
    setCurrentSeason,
    endSeason,
    updateSeason,
  } = useSeasonDetails(id);

  const { skaters, goalies, loading: statsLoading } = useSeasonStats(id);
  const { standings, loading: standingsLoading } = useSeasonStandings(id);

  const clinchedIds = useMemo(
    () =>
      computeClinched(
        standings,
        season?.playoff_format ?? null,
        groups,
        season?.scoring_system ?? season?.league_scoring_system ?? '2-1-0',
      ),
    [
      standings,
      season?.playoff_format,
      season?.scoring_system,
      season?.league_scoring_system,
      groups,
    ],
  );

  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<SeasonGroupRecord | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

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
  // Standings sort
  const [standingsSort, setStandingsSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'points',
    dir: 'desc',
  });

  const computeTieRanks = (values: (number | null)[]): string[] =>
    values.map((val) => {
      const firstIdx = values.findIndex((v) => v === val);
      const rank = firstIdx + 1;
      const count = values.filter((v) => v === val).length;
      return count > 1 ? `T${rank}` : `${rank}`;
    });

  const forwards = useMemo(
    () => skaters.filter((s) => FORWARD_POSITIONS.has(s.position ?? '')),
    [skaters],
  );
  const defensemen = useMemo(
    () => skaters.filter((s) => DEFENSE_POSITIONS.has(s.position ?? '')),
    [skaters],
  );

  const summarySkaters = useMemo(
    () => sortBySkaterStat(skaters, summarySkaterStat),
    [skaters, summarySkaterStat],
  );
  const sortSkaterTable = (arr: SkaterStatRecord[], sort: { key: string; dir: 'asc' | 'desc' }) =>
    [...arr].sort((a, b) => {
      const av = a[sort.key as keyof SkaterStatRecord] ?? '';
      const bv = b[sort.key as keyof SkaterStatRecord] ?? '';
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });

  const sortedForwards = useMemo(() => sortSkaterTable(forwards, fwdSort), [forwards, fwdSort]);
  const fwdPageCount = Math.max(1, Math.ceil(sortedForwards.length / PAGE_SIZE));
  const pagedForwards = sortedForwards.slice((fwdPage - 1) * PAGE_SIZE, fwdPage * PAGE_SIZE);
  const handleFwdSort = (key: string, dir: 'asc' | 'desc') => {
    setFwdSort({ key, dir });
    setFwdPage(1);
  };

  const sortedDefensemen = useMemo(
    () => sortSkaterTable(defensemen, defSort),
    [defensemen, defSort],
  );
  const defPageCount = Math.max(1, Math.ceil(sortedDefensemen.length / PAGE_SIZE));
  const pagedDefensemen = sortedDefensemen.slice((defPage - 1) * PAGE_SIZE, defPage * PAGE_SIZE);
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

  const sortedGoalies = useMemo(() => {
    return [...goalies].sort((a, b) => {
      const av = a[goalieSort.key as keyof GoalieStatRecord] ?? -Infinity;
      const bv = b[goalieSort.key as keyof GoalieStatRecord] ?? -Infinity;
      if (av < bv) return goalieSort.dir === 'asc' ? -1 : 1;
      if (av > bv) return goalieSort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [goalies, goalieSort]);

  const goaliePageCount = Math.max(1, Math.ceil(sortedGoalies.length / PAGE_SIZE));
  const pagedGoalies = sortedGoalies.slice((goaliePage - 1) * PAGE_SIZE, goaliePage * PAGE_SIZE);

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
      {row.team_logo ? (
        <img
          src={row.team_logo}
          alt={row.team_name ?? ''}
          className={styles.statsTeamLogo}
        />
      ) : (
        <span className={styles.statsTeamLogoPlaceholder}>
          {(row.team_code ?? '?').slice(0, 3)}
        </span>
      )}
      {row.photo ? (
        <img
          src={row.photo}
          alt={`${row.first_name} ${row.last_name}`}
          className={styles.statsPlayerPhoto}
        />
      ) : (
        <span
          className={styles.statsPlayerPhotoPlaceholder}
          style={{
            background: row.team_primary_color ?? undefined,
            color: row.team_text_color ?? undefined,
          }}
        >
          {row.first_name.charAt(0)}
          {row.last_name.charAt(0)}
        </span>
      )}
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

  const leagueHref = `/admin/leagues/${leagueId}`;

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
      <>
        <Breadcrumbs
          items={[
            { label: 'Leagues', path: '/admin/leagues' },
            { label: 'League', path: leagueHref },
            { label: 'Not Found' },
          ]}
        />
        <p style={{ color: 'var(--text-dim)' }}>Season not found.</p>
      </>
    );
  }

  return (
    <>
      <TitleRow
        left={
          <Button
            variant="outlined"
            intent="neutral"
            icon="arrow_back"
            tooltip={`Back to ${season.league_name}`}
            onClick={() => navigate(leagueHref)}
          />
        }
        right={
          <Breadcrumbs
            items={[
              { label: 'Leagues', path: '/admin/leagues' },
              { label: season.league_name, path: leagueHref },
              { label: season.name },
            ]}
          />
        }
      />

      <Tabs
        activeIndex={activeTab}
        onTabChange={handleTabChange}
        tabs={[
          {
            label: 'Info',
            content: (
              <Card
                title={
                  <>
                    {season.name}
                    {season.is_current && (
                      <Badge
                        label="Current"
                        intent="success"
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
                    <MoreActionsMenu
                      items={[
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
                      ]}
                    />
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
            content: (
              <SeasonTeamsCard
                seasonTeams={seasonTeams}
                groups={groups}
                leagueTeams={leagueTeams}
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
            content: (
              <SeasonGamesTab
                leagueId={leagueId!}
                seasonId={id!}
                seasonTeams={seasonTeams}
                isEnded={season.is_ended}
              />
            ),
          },
          {
            label: 'Stats',
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
                    { value: 'Teams', label: 'Teams' },
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
                    <Table
                      columns={skaterColumns}
                      data={pagedForwards}
                      rowKey={(r) => r.player_id}
                      loading={statsLoading}
                      emptyMessage="No forward stats recorded yet."
                      activeSortKey={fwdSort.key}
                      sortDir={fwdSort.dir}
                      onSort={handleFwdSort}
                    />
                    {fwdPageCount > 1 && (
                      <div className={styles.statsPagination}>
                        <button
                          className={styles.statsPageBtn}
                          onClick={() => setFwdPage((p) => p - 1)}
                          disabled={fwdPage === 1}
                        >
                          ‹
                        </button>
                        <span className={styles.statsPageInfo}>
                          {fwdPage} / {fwdPageCount}
                        </span>
                        <button
                          className={styles.statsPageBtn}
                          onClick={() => setFwdPage((p) => p + 1)}
                          disabled={fwdPage === fwdPageCount}
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </Card>
                )}

                {statsSubTab === 'Defense' && (
                  <Card>
                    <Table
                      columns={skaterColumns}
                      data={pagedDefensemen}
                      rowKey={(r) => r.player_id}
                      loading={statsLoading}
                      emptyMessage="No defense stats recorded yet."
                      activeSortKey={defSort.key}
                      sortDir={defSort.dir}
                      onSort={handleDefSort}
                    />
                    {defPageCount > 1 && (
                      <div className={styles.statsPagination}>
                        <button
                          className={styles.statsPageBtn}
                          onClick={() => setDefPage((p) => p - 1)}
                          disabled={defPage === 1}
                        >
                          ‹
                        </button>
                        <span className={styles.statsPageInfo}>
                          {defPage} / {defPageCount}
                        </span>
                        <button
                          className={styles.statsPageBtn}
                          onClick={() => setDefPage((p) => p + 1)}
                          disabled={defPage === defPageCount}
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </Card>
                )}

                {statsSubTab === 'Goalies' && (
                  <Card>
                    <Table
                      columns={goalieColumns}
                      data={pagedGoalies}
                      rowKey={(r) => r.player_id}
                      loading={statsLoading}
                      emptyMessage="No goalie stats recorded yet."
                      activeSortKey={goalieSort.key}
                      sortDir={goalieSort.dir}
                      onSort={handleGoalieSort}
                    />
                    {goaliePageCount > 1 && (
                      <div className={styles.statsPagination}>
                        <button
                          className={styles.statsPageBtn}
                          onClick={() => setGoaliePage((p) => p - 1)}
                          disabled={goaliePage === 1}
                        >
                          ‹
                        </button>
                        <span className={styles.statsPageInfo}>
                          {goaliePage} / {goaliePageCount}
                        </span>
                        <button
                          className={styles.statsPageBtn}
                          onClick={() => setGoaliePage((p) => p + 1)}
                          disabled={goaliePage === goaliePageCount}
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </Card>
                )}

                {statsSubTab === 'Teams' && (
                  <Card>
                    {standingsLoading ? (
                      <p className={styles.tabPlaceholder}>Loading standings…</p>
                    ) : standings.length === 0 ? (
                      <p className={styles.tabPlaceholder}>No standings data yet.</p>
                    ) : (
                      <Table
                        columns={standingsColumns}
                        data={[...standings].sort((a, b) => {
                          const av =
                            (a as unknown as Record<string, unknown>)[standingsSort.key] ?? 0;
                          const bv =
                            (b as unknown as Record<string, unknown>)[standingsSort.key] ?? 0;
                          const cmp = Number(bv) - Number(av);
                          return standingsSort.dir === 'desc' ? cmp : -cmp;
                        })}
                        rowKey={(row) => row.team_id}
                        activeSortKey={standingsSort.key}
                        sortDir={standingsSort.dir}
                        onSort={(key, dir) => setStandingsSort({ key, dir })}
                      />
                    )}
                  </Card>
                )}
              </div>
            ),
          },
          {
            label: 'Playoffs',
            content: (
              <SeasonPlayoffsTab
                seasonId={id!}
                leagueId={season.league_id}
                bracketRuleSetId={season.bracket_rule_set_id ?? null}
                groups={groups}
                isEnded={season.is_ended}
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
