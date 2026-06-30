import { useEffect, useRef, useState } from 'react';
import Button from '@/components/Button/Button';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Divider from '@/components/Divider/Divider';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import Pagination from '@/components/Pagination/Pagination';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import { buildLeaguePlayerDetailsPath } from '@/lib/routeSlugs';
import SearchableList from '@/components/SearchableList/SearchableList';
import Section from '@/components/Section/Section';
import Select from '@/components/Select/Select';
import Skeleton from '@/components/Skeleton/Skeleton';
import Tag from '@/components/Tag/Tag';
import ToggleButton from '@/components/ToggleButton/ToggleButton';
import { type PlayerRecord } from '@/hooks/useLeaguePlayers';
import { missingPlayerDataIndicator } from '@/lib/playerDataStatus';
import { formatPlayerPosition } from '@/lib/playerPosition';
import { useLeagueDetailsContext } from './LeagueDetailsContext';
import { TabActionSkeleton, type TabSkeletonProps } from './LeagueTabSkeletonHelpers';
import styles from './LeagueDetails.module.scss';

interface Props {
  className?: string;
}

const PLAYER_SKELETON_ROW_COUNT = 15;
const PLAYER_SEARCH_DEBOUNCE_MS = 350;
const PLAYER_SEARCH_MIN_LENGTH = 3;

const buildFilterFetchKey = ({
  search,
  rookiesOnly,
  includeRetiredPlayers,
}: {
  search: string;
  rookiesOnly: boolean;
  includeRetiredPlayers: boolean;
}) =>
  `${search}|${rookiesOnly ? 'rookies' : 'all'}|${
    includeRetiredPlayers ? 'retired' : 'active'
  }`;

const playerSkeletonRow = (key: number) => (
  <Skeleton
    as="li"
    key={key}
    type="card"
    className={styles.tabSkeletonRow}
  />
);

const LeaguePlayerRowsSkeleton = ({
  rowCount = PLAYER_SKELETON_ROW_COUNT,
}: {
  rowCount?: number;
}) => (
  <ul className={styles.tabSkeletonStack}>
    {Array.from({ length: rowCount }, (_, index) => playerSkeletonRow(index))}
  </ul>
);

const LeaguePlayersTab = ({ className }: Props) => {
  const { league, players: playersContext } = useLeagueDetailsContext();
  const {
    players,
    total,
    page,
    pageSize,
    search,
    seasons,
    selectedSeasonId,
    rookiesOnly,
    includeRetiredPlayers,
    onPageChange,
    onSearchChange,
    onSeasonChange,
    onRookiesOnlyChange,
    onIncludeRetiredPlayersChange,
    loading,
    fetching,
    busy,
    onAdd,
    onBulkAdd,
    onEdit,
    onDelete,
  } = playersContext;
  const [confirmDelete, setConfirmDelete] = useState<PlayerRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [paginationFetchPage, setPaginationFetchPage] = useState<number | null>(null);
  const [seasonFetchId, setSeasonFetchId] = useState<string | null>(null);
  const [filterFetchKey, setFilterFetchKey] = useState<string | null>(null);
  const paginationFetchStartedRef = useRef(false);
  const seasonFetchStartedRef = useRef(false);
  const filterFetchStartedRef = useRef(false);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const emptyMessage = rookiesOnly
    ? 'No rookies for this season.'
    : includeRetiredPlayers
      ? 'No players in this league yet.'
      : 'No active players in this league yet.';
  const showPaginationSkeleton = fetching && paginationFetchPage === page;
  const showSeasonSkeleton =
    fetching && seasonFetchId !== null && seasonFetchId === selectedSeasonId;
  const currentFilterFetchKey = buildFilterFetchKey({
    search,
    rookiesOnly,
    includeRetiredPlayers,
  });
  const showFilterSkeleton =
    fetching && filterFetchKey !== null && filterFetchKey === currentFilterFetchKey;
  const showListSkeleton = showPaginationSkeleton || showSeasonSkeleton || showFilterSkeleton;
  const playerDataIndicator = (player: PlayerRecord) => {
    const hasMissingData = !player.date_of_birth || !player.start_date || !player.acquisition_type;
    const hasSingleSeasonPoint = player.season_points === 1;
    if (!hasSingleSeasonPoint || !hasMissingData) return '';
    return ` ${missingPlayerDataIndicator}`;
  };
  const renderPlayerTags = (player: PlayerRecord) => {
    const isRookie = !!selectedSeasonId && player.rookie_season_id === selectedSeasonId;
    const isRetired = !player.is_active;
    if (!isRookie && !isRetired) return undefined;

    return (
      <span className={styles.playerRowTags}>
        {isRookie && (
          <Tag
            label="Rookie"
            intent="accent"
          />
        )}
        {isRetired && <Tag label="Retired" />}
      </span>
    );
  };

  useEffect(() => {
    if (!loading && total > 0 && page > pageCount) onPageChange(pageCount);
  }, [loading, page, pageCount, total, onPageChange]);

  useEffect(() => {
    if (showPaginationSkeleton) {
      paginationFetchStartedRef.current = true;
      return;
    }

    if (!fetching && paginationFetchStartedRef.current) {
      paginationFetchStartedRef.current = false;
      setPaginationFetchPage(null);
    }
  }, [fetching, showPaginationSkeleton]);

  useEffect(() => {
    if (showSeasonSkeleton) {
      seasonFetchStartedRef.current = true;
      return;
    }

    if (!fetching && seasonFetchStartedRef.current) {
      seasonFetchStartedRef.current = false;
      setSeasonFetchId(null);
    }
  }, [fetching, showSeasonSkeleton]);

  useEffect(() => {
    if (showFilterSkeleton) {
      filterFetchStartedRef.current = true;
      return;
    }

    if (!fetching && filterFetchStartedRef.current) {
      filterFetchStartedRef.current = false;
      setFilterFetchKey(null);
    }
  }, [fetching, showFilterSkeleton]);

  const handlePageChange = (nextPage: number) => {
    if (nextPage !== page) setPaginationFetchPage(nextPage);
    onPageChange(nextPage);
  };

  const handleSeasonChange = (seasonId: string) => {
    if (seasonId !== selectedSeasonId) setSeasonFetchId(seasonId);
    onSeasonChange(seasonId);
  };

  const handleSearchChange = (query: string) => {
    if (query !== search) {
      setFilterFetchKey(
        buildFilterFetchKey({
          search: query,
          rookiesOnly,
          includeRetiredPlayers,
        }),
      );
    }

    onSearchChange(query);
  };

  const handleRookiesOnlyToggle = () => {
    const nextRookiesOnly = !rookiesOnly;
    setFilterFetchKey(
      buildFilterFetchKey({
        search,
        rookiesOnly: nextRookiesOnly,
        includeRetiredPlayers,
      }),
    );
    onRookiesOnlyChange(nextRookiesOnly);
  };

  const handleIncludeRetiredToggle = () => {
    const nextIncludeRetiredPlayers = !includeRetiredPlayers;
    setFilterFetchKey(
      buildFilterFetchKey({
        search,
        rookiesOnly,
        includeRetiredPlayers: nextIncludeRetiredPlayers,
      }),
    );
    onIncludeRetiredPlayersChange(nextIncludeRetiredPlayers);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    await onDelete(confirmDelete.id);
    setIsDeleting(false);
    setConfirmDelete(null);
  };

  if (loading) return <LeaguePlayersTabSkeleton className={className} />;

  return (
    <>
      <div className={styles.grid}>
        <Section
          className={[styles.col12, className].filter(Boolean).join(' ')}
          title="Players"
          titleAccessory={
            seasons.length > 0 ? (
              <div className={styles.playerHeaderSeasonGroup}>
                <Divider variant="vertical" />
                <div className={styles.playerHeaderSeasonSelect}>
                  <Select
                    value={selectedSeasonId}
                    options={seasons.map((s) => ({
                      value: s.id,
                      label: s.is_current ? `${s.name} ✦` : s.name,
                    }))}
                    onChange={handleSeasonChange}
                    width="content"
                  />
                </div>
              </div>
            ) : null
          }
          action={
            <div className={styles.playerActionButtons}>
              <Button
                variant="outlined"
                intent="accent"
                icon="group_add"
                size="sm"
                onClick={onBulkAdd}
              >
                Bulk Create
              </Button>
              <Button
                icon="add"
                size="sm"
                onClick={onAdd}
              >
                Create Player
              </Button>
            </div>
          }
        >
          <SearchableList
            items={[...players].sort((a, b) =>
              `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
            )}
            filterFn={(p, q) => {
              const query = q.toLowerCase();
              const name = `${p.first_name} ${p.last_name}`.toLowerCase();
              const pos = (p.position ?? '').toLowerCase();
              const jersey = p.jersey_number != null ? String(p.jersey_number) : '';
              return (
                name.includes(query) || pos.includes(query) || jersey.startsWith(q.replace('#', ''))
              );
            }}
            renderItems={(filtered) => {
              return (
                <>
                  <ul className={styles.rosterList}>
                    {filtered.map((p) => {
                      const initials = `${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}` || '?';
                      const playerHref = buildLeaguePlayerDetailsPath({
                        leagueCode: league.code,
                        leagueId: league.id,
                        firstName: p.first_name,
                        lastName: p.last_name,
                      });

                      return (
                        <ListItem
                          key={p.id}
                          leadingImage={p.team_logo}
                          leadingImageDark={p.team_logo_dark}
                          leadingImageLight={p.team_logo_light}
                          leadingImagePlaceholder={
                            (p.team_code ?? (p.team_name ?? '').slice(0, 3)) || undefined
                          }
                          leadingImagePrimaryColor={p.primary_color ?? undefined}
                          leadingImageTextColor={p.text_color ?? undefined}
                          imageNode={
                            <PlayerAvatar
                              photo={p.photo}
                              initials={initials}
                              primaryColor={p.primary_color}
                              textColor={p.text_color}
                              size={48}
                            />
                          }
                          name={`${p.first_name} ${p.last_name}${playerDataIndicator(p)}`}
                          placeholder={`${p.first_name[0]}${p.last_name[0]}`}
                          primaryColor={p.primary_color ?? undefined}
                          textColor={p.text_color ?? undefined}
                          href={playerHref}
                          chip={p.jersey_number != null ? { label: p.jersey_number } : null}
                          variant="framed"
                          subtitle={formatPlayerPosition(p.position) ?? undefined}
                          rightContent={renderPlayerTags(p)}
                          actions={
                            [
                              {
                                icon: 'edit',
                                intent: 'neutral',
                                tooltip: 'Edit player',
                                disabled: busy === p.id,
                                onClick: () => onEdit(p),
                              },
                              {
                                icon: 'delete',
                                intent: 'danger',
                                tooltip: 'Delete player',
                                disabled: busy === p.id,
                                onClick: () => setConfirmDelete(p),
                              },
                            ] satisfies ListItemAction[]
                          }
                        />
                      );
                    })}
                  </ul>

                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={handlePageChange}
                  />
                </>
              );
            }}
            placeholder="Search players…"
            onQueryChange={handleSearchChange}
            searchDebounceMs={PLAYER_SEARCH_DEBOUNCE_MS}
            minSearchLength={PLAYER_SEARCH_MIN_LENGTH}
            disableClientFilter
            loading={showListSkeleton}
            loadingRowCount={PLAYER_SKELETON_ROW_COUNT}
            loadingFooter={
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={handlePageChange}
              />
            }
            actions={
              <div className={styles.playerFilterToggles}>
                <ToggleButton
                  variant="switch"
                  active={rookiesOnly}
                  onClick={handleRookiesOnlyToggle}
                  icon="stars"
                  activeTooltip="Rookies only"
                  inactiveTooltip="Rookies only"
                  disabled={!selectedSeasonId}
                />
                <ToggleButton
                  variant="switch"
                  active={includeRetiredPlayers}
                  onClick={handleIncludeRetiredToggle}
                  activeIcon="visibility"
                  inactiveIcon="visibility_off"
                  activeTooltip="Show retired players"
                  inactiveTooltip="Show retired players"
                />
              </div>
            }
            emptyMessage={emptyMessage}
            noResultsMessage={(q) => `No players match "${q}".`}
          />
        </Section>
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Player"
        body={
          confirmDelete ? (
            <>
              Are you sure you want to delete{' '}
              <strong>
                {confirmDelete.first_name} {confirmDelete.last_name}
              </strong>
              ? This cannot be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete"
        confirmIcon="delete"
        variant="danger"
        busy={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
};

export const LeaguePlayersTabSkeleton = ({ className }: TabSkeletonProps) => (
  <div className={styles.grid}>
    <Section
      className={[styles.col12, className].filter(Boolean).join(' ')}
      title="Players"
      titleAccessory={
        <div className={styles.playerHeaderSeasonGroup}>
          <Divider variant="vertical" />
          <TabActionSkeleton width="148px" />
        </div>
      }
      action={
        <span className={styles.tabSkeletonActions}>
          <TabActionSkeleton width="118px" />
          <TabActionSkeleton width="124px" />
        </span>
      }
      role="status"
      aria-busy="true"
      aria-label="Loading players"
    >
      <div className={styles.tabSkeletonControls}>
        <Skeleton
          type="text"
          className={[styles.tabSkeletonSearch, styles.tabSkeletonSearchFull].join(' ')}
        />
        <span className={styles.tabSkeletonActions}>
          <TabActionSkeleton width="66px" />
          <TabActionSkeleton width="66px" />
        </span>
      </div>
      <LeaguePlayerRowsSkeleton />
    </Section>
  </div>
);

export default LeaguePlayersTab;
