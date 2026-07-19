import { type ReactNode, useEffect, useRef, useState } from 'react';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import ConfirmModal from '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal';
import ListItem, { type ListItemAction } from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import Pagination from '@jerecocc/tracker-ui/components/Pagination/Pagination';
import PlayerAvatar from '@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar';
import { buildLeaguePlayerDetailsPath } from '@/lib/routeSlugs';
import SearchableList from '@jerecocc/tracker-ui/components/SearchableList/SearchableList';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import Skeleton from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import Tag from '@jerecocc/tracker-ui/components/Tag/Tag';
import Toggle from '@jerecocc/tracker-ui/components/Toggle/Toggle';
import { type PlayerRecord } from '@/hooks/useLeaguePlayers';
import { missingPlayerDataIndicator } from '@/lib/playerDataStatus';
import { formatPlayerPosition } from '@/lib/playerPosition';
import { normalizePlayerSearchText, playerSearchTextIncludes } from '@/lib/playerSearch';
import { getPlayerStatus, PLAYER_STATUS_LABELS, type PlayerStatus } from '@/lib/playerStatus';
import { useLeagueDetailsContext } from './leagueDetailsState';
import { TabActionSkeleton, type TabSkeletonProps } from './LeagueTabSkeletonHelpers';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import styles from './LeagueDetails.module.scss';

interface Props {
  className?: string;
}

interface PlayerListLeague {
  id: string;
  code: string;
}

interface LeaguePlayersListSectionProps {
  className?: string;
  title?: string;
  titleAccessory?: ReactNode;
  action?: ReactNode;
  league: PlayerListLeague;
  players: PlayerRecord[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  warningsOnly?: boolean;
  fetching: boolean;
  busy: string | null;
  selectedSeasonId?: string | null;
  showLastSeasonSubtitle?: boolean;
  minimumGamesForDataIndicator?: PlayerDataIndicatorMinimumGames;
  emptyMessage: ReactNode;
  onPageChange: (page: number) => void;
  onSearchChange: (query: string) => void;
  onWarningsOnlyChange?: (warningsOnly: boolean) => void;
  onEdit?: (player: PlayerRecord) => void;
  onDelete?: (playerId: string) => Promise<void>;
}

const PLAYER_SKELETON_ROW_COUNT = 15;
const PLAYER_SEARCH_DEBOUNCE_MS = 350;
const PLAYER_SEARCH_MIN_LENGTH = 3;
interface PlayerDataIndicatorMinimumGames {
  skater: number;
  goalie: number;
}

const LEAGUE_PLAYER_DATA_MINIMUM_GAMES: PlayerDataIndicatorMinimumGames = {
  skater: 41,
  goalie: 15,
};
const PLAYER_STATUS_TAG_INTENTS: Record<PlayerStatus, 'success' | 'neutral' | 'warning'> = {
  active: 'success',
  inactive: 'neutral',
  retired: 'warning',
};

const playerSkeletonRow = (key: number) => (
  <Skeleton
    as="li"
    key={key}
    variant="card"
    className={styles.tabSkeletonRow}
  />
);

const LeaguePlayerRowsSkeleton = ({
  rowCount = PLAYER_SKELETON_ROW_COUNT,
}: {
  rowCount?: number;
}) => (
  <ResponsiveList className={styles.tabSkeletonStack}>
    {Array.from({ length: rowCount }, (_, index) => playerSkeletonRow(index))}
  </ResponsiveList>
);

const playerDataIndicator = (
  player: PlayerRecord,
  minimumGames?: PlayerDataIndicatorMinimumGames,
) => {
  const minimumGamesRequired =
    (player.position ?? '').toUpperCase() === 'G' ? minimumGames?.goalie : minimumGames?.skater;
  const meetsGameMinimum =
    minimumGamesRequired === undefined || (player.games_played ?? 0) >= minimumGamesRequired;
  if (!meetsGameMinimum) return '';

  const hasMissingData = !player.date_of_birth || !player.start_date || !player.acquisition_type;
  if (!hasMissingData) return '';
  return ` ${missingPlayerDataIndicator}`;
};

const playerSubtitle = (player: PlayerRecord, showLastSeasonSubtitle: boolean) => {
  const position = formatPlayerPosition(player.position);
  const status = getPlayerStatus(player);
  const showLastSeason = status === 'inactive' || status === 'retired';
  const lastSeason =
    showLastSeasonSubtitle && showLastSeason && player.last_season_name
      ? `Last played: ${player.last_season_name}`
      : null;
  return [position, lastSeason].filter(Boolean).join(' | ') || undefined;
};

const renderPlayerTags = (player: PlayerRecord, rookieSeasonId?: string | null) => {
  const isRookie = !!rookieSeasonId && player.rookie_season_id === rookieSeasonId;
  const status = getPlayerStatus(player);
  const showStatusTag = status !== 'active';
  if (!isRookie && !showStatusTag) return undefined;

  return (
    <span className={styles.playerRowTags}>
      {isRookie && (
        <Tag
          label="Rookie"
          intent="accent"
        />
      )}
      {showStatusTag && (
        <Tag
          label={PLAYER_STATUS_LABELS[status]}
          intent={PLAYER_STATUS_TAG_INTENTS[status]}
        />
      )}
    </span>
  );
};

export const LeaguePlayersListSection = ({
  className,
  title = 'Players',
  titleAccessory,
  action,
  league,
  players,
  total,
  page,
  pageSize,
  search,
  warningsOnly = false,
  fetching,
  busy,
  selectedSeasonId,
  showLastSeasonSubtitle = false,
  minimumGamesForDataIndicator,
  emptyMessage,
  onPageChange,
  onSearchChange,
  onWarningsOnlyChange,
  onEdit,
  onDelete,
}: LeaguePlayersListSectionProps) => {
  const [confirmDelete, setConfirmDelete] = useState<PlayerRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [paginationFetchPage, setPaginationFetchPage] = useState<number | null>(null);
  const [searchFetchKey, setSearchFetchKey] = useState<string | null>(null);
  const paginationFetchStartedRef = useRef(false);
  const searchFetchStartedRef = useRef(false);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const showPaginationSkeleton = fetching && paginationFetchPage === page;
  const showSearchSkeleton = fetching && searchFetchKey !== null && searchFetchKey === search;
  const showListSkeleton = showPaginationSkeleton || showSearchSkeleton;

  useEffect(() => {
    if (total > 0 && page > pageCount) onPageChange(pageCount);
  }, [page, pageCount, total, onPageChange]);

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
    if (showSearchSkeleton) {
      searchFetchStartedRef.current = true;
      return;
    }

    if (!fetching && searchFetchStartedRef.current) {
      searchFetchStartedRef.current = false;
      setSearchFetchKey(null);
    }
  }, [fetching, showSearchSkeleton]);

  const handlePageChange = (nextPage: number) => {
    if (nextPage !== page) setPaginationFetchPage(nextPage);
    onPageChange(nextPage);
  };

  const handleSearchChange = (query: string) => {
    if (query !== search) setSearchFetchKey(query);
    onSearchChange(query);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete || !onDelete) return;
    setIsDeleting(true);
    await onDelete(confirmDelete.id);
    setIsDeleting(false);
    setConfirmDelete(null);
  };

  return (
    <>
      <div className={styles.grid}>
        <Section
          className={[styles.col12, className].filter(Boolean).join(' ')}
          title={title}
          titleAccessory={titleAccessory}
          action={action}
        >
          <SearchableList
            items={[...players].sort((a, b) =>
              `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
            )}
            filterItem={(p, q) => {
              const query = normalizePlayerSearchText(q);
              const name = `${p.first_name} ${p.last_name}`;
              const jersey = p.jersey_number != null ? String(p.jersey_number) : '';
              return (
                playerSearchTextIncludes(name, query) ||
                playerSearchTextIncludes(p.position, query) ||
                jersey.startsWith(query.replace('#', ''))
              );
            }}
            renderItems={(filtered) => {
              return (
                <>
                  <ResponsiveList className={styles.rosterList}>
                    {filtered.map((p) => {
                      const initials = `${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}` || '?';
                      const playerHref = buildLeaguePlayerDetailsPath({
                        leagueCode: league.code,
                        leagueId: league.id,
                        leaguePlayerNumber: p.league_player_number,
                        firstName: p.first_name,
                        lastName: p.last_name,
                      });
                      const rookieSeasonId = showLastSeasonSubtitle
                        ? p.last_season_id
                        : selectedSeasonId;
                      const actions: (ListItemAction | null)[] = [
                        onEdit
                          ? {
                              icon: 'edit',
                              intent: 'neutral',
                              tooltip: 'Edit player',
                              disabled: busy === p.id,
                              onClick: () => onEdit(p),
                            }
                          : null,
                        onDelete
                          ? {
                              icon: 'delete',
                              intent: 'danger',
                              tooltip: 'Delete player',
                              disabled: busy === p.id,
                              onClick: () => setConfirmDelete(p),
                            }
                          : null,
                      ];

                      return (
                        <ListItem
                          key={p.id}
                          fullWidth
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
                          name={`${p.first_name} ${p.last_name}${playerDataIndicator(
                            p,
                            minimumGamesForDataIndicator,
                          )}`}
                          placeholder={`${p.first_name[0]}${p.last_name[0]}`}
                          primaryColor={p.primary_color ?? undefined}
                          textColor={p.text_color ?? undefined}
                          href={playerHref}
                          chip={p.jersey_number != null ? { label: p.jersey_number } : null}
                          variant="framed"
                          subtitle={playerSubtitle(p, showLastSeasonSubtitle)}
                          rightContent={renderPlayerTags(p, rookieSeasonId)}
                          actions={actions}
                        />
                      );
                    })}
                  </ResponsiveList>

                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={handlePageChange}
                  />
                </>
              );
            }}
            placeholder="Search players..."
            onQueryChange={handleSearchChange}
            searchDebounceMs={PLAYER_SEARCH_DEBOUNCE_MS}
            minSearchLength={PLAYER_SEARCH_MIN_LENGTH}
            disableClientFilter
            actions={
              onWarningsOnlyChange ? (
                <span className={styles.playerFilterToggles}>
                  <Toggle
                    active={warningsOnly}
                    variant="toggle"
                    ariaLabel="Warnings only"
                    activeIcon="warning"
                    inactiveIcon="warning"
                    activeTooltip="Show all players"
                    inactiveTooltip="Show players with warnings"
                    onActiveChange={() => onWarningsOnlyChange(!warningsOnly)}
                  />
                </span>
              ) : undefined
            }
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
            emptyMessage={emptyMessage}
            getNoResultsMessage={(q) => `No players match "${q}".`}
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
        intent="danger"
        busy={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
};

const LeaguePlayersTab = ({ className }: Props) => {
  const { league, players: playersContext } = useLeagueDetailsContext();
  const {
    players,
    total,
    page,
    pageSize,
    search,
    warningsOnly,
    loading,
    fetching,
    busy,
    onPageChange,
    onSearchChange,
    onWarningsOnlyChange,
    onAdd,
    onBulkAdd,
    onEdit,
    onDelete,
  } = playersContext;

  if (loading) return <LeaguePlayersTabSkeleton className={className} />;

  return (
    <LeaguePlayersListSection
      className={className}
      league={league}
      players={players}
      total={total}
      page={page}
      pageSize={pageSize}
      search={search}
      warningsOnly={warningsOnly}
      fetching={fetching}
      busy={busy}
      showLastSeasonSubtitle
      minimumGamesForDataIndicator={LEAGUE_PLAYER_DATA_MINIMUM_GAMES}
      emptyMessage={
        warningsOnly
          ? 'No players with warnings.'
          : 'No players from the last five seasons yet.'
      }
      action={
        <div className={styles.playerActionButtons}>
          <Button
            variant="outlined"
            intent="accent"
            icon="group_add"
            size="medium"
            onClick={onBulkAdd}
          >
            Bulk Create
          </Button>
          <Button
            icon="add"
            size="medium"
            onClick={onAdd}
          >
            Create Player
          </Button>
        </div>
      }
      onPageChange={onPageChange}
      onSearchChange={onSearchChange}
      onWarningsOnlyChange={onWarningsOnlyChange}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
};

export const LeaguePlayersTabSkeleton = ({
  className,
  showActionSkeleton = true,
}: TabSkeletonProps & { showActionSkeleton?: boolean }) => (
  <div className={styles.grid}>
    <Section
      className={[styles.col12, className].filter(Boolean).join(' ')}
      title="Players"
      action={
        showActionSkeleton ? (
          <span className={styles.tabSkeletonActions}>
            <TabActionSkeleton width="118px" />
            <TabActionSkeleton width="124px" />
          </span>
        ) : undefined
      }
      role="status"
      aria-busy="true"
      aria-label="Loading players"
    >
      <div className={styles.tabSkeletonControls}>
        <Skeleton
          variant="text"
          className={[styles.tabSkeletonSearch, styles.tabSkeletonSearchFull].join(' ')}
        />
      </div>
      <LeaguePlayerRowsSkeleton />
    </Section>
  </div>
);

export default LeaguePlayersTab;
