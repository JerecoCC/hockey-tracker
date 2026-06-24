import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import Pagination from '@/components/Pagination/Pagination';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import { buildLeaguePlayerDetailsPath } from '@/lib/routeSlugs';
import SearchableList from '@/components/SearchableList/SearchableList';
import Select from '@/components/Select/Select';
import Skeleton from '@/components/Skeleton/Skeleton';
import { type PlayerRecord } from '@/hooks/useLeaguePlayers';
import { missingPlayerDataIndicator } from '@/lib/playerDataStatus';
import { useLeagueDetailsContext } from './LeagueDetailsContext';
import { TabActionSkeleton, type TabSkeletonProps } from './LeagueTabSkeletonHelpers';
import styles from './LeagueDetails.module.scss';

const POSITION_LABELS: Record<string, string> = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defense',
  G: 'Goalie',
};

interface Props {
  className?: string;
}

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
    onPageChange,
    onSearchChange,
    onSeasonChange,
    loading,
    fetching,
    busy,
    onAdd,
    onBulkAdd,
    onEdit,
    onDelete,
  } = playersContext;
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState<PlayerRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const playerDataIndicator = (player: PlayerRecord) => {
    const hasMissingData = !player.date_of_birth || !player.start_date || !player.acquisition_type;
    if (!player.has_games || !hasMissingData) return '';
    return ` ${missingPlayerDataIndicator}`;
  };

  useEffect(() => {
    if (!loading && total > 0 && page > pageCount) onPageChange(pageCount);
  }, [loading, page, pageCount, total, onPageChange]);

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
        <Card
          className={[styles.col12, className].filter(Boolean).join(' ')}
          title="Players"
          action={
            seasons.length > 0 ? (
              <Select
                value={selectedSeasonId}
                options={seasons.map((s) => ({
                  value: s.id,
                  label: s.is_current ? `${s.name} ✦` : s.name,
                }))}
                onChange={(value) => {
                  onSeasonChange(value);
                }}
              />
            ) : undefined
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
                          jerseyNumber={p.jersey_number}
                          variant="plain"
                          subtitle={
                            p.position ? (POSITION_LABELS[p.position] ?? p.position) : undefined
                          }
                          rightContent={{
                            type: 'tag',
                            label: p.is_active ? 'Active' : 'Inactive',
                            intent: p.is_active ? 'success' : 'neutral',
                          }}
                          actions={
                            [
                              {
                                icon: 'open_in_new',
                                intent: 'neutral',
                                tooltip: 'View player',
                                onClick: () => navigate(playerHref),
                              },
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
                    onPageChange={onPageChange}
                  />
                </>
              );
            }}
            placeholder="Search players…"
            query={search}
            onQueryChange={onSearchChange}
            disableClientFilter
            actions={
              <>
                {fetching && (
                  <span
                    className={styles.listSpinner}
                    aria-label="Loading players"
                  />
                )}
                <Button
                  variant="outlined"
                  intent="neutral"
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
              </>
            }
            emptyMessage="No players in this league yet."
            noResultsMessage={(q) => `No players match "${q}".`}
          />
        </Card>
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
    <Card
      className={[styles.col12, className].filter(Boolean).join(' ')}
      title="Players"
      action={<TabActionSkeleton width="148px" />}
      role="status"
      aria-busy="true"
      aria-label="Loading players"
    >
      <div className={styles.tabSkeletonControls}>
        <Skeleton
          type="text"
          className={styles.tabSkeletonSearch}
        />
        <span className={styles.tabSkeletonActions}>
          <TabActionSkeleton width="118px" />
          <TabActionSkeleton width="124px" />
        </span>
      </div>
      <ul className={styles.tabSkeletonStack}>
        {Array.from({ length: 5 }, (_, index) => (
          <li
            key={index}
            className={styles.tabSkeletonRow}
          >
            <Skeleton type="picture" />
            <Skeleton type="avatar" />
            <span className={styles.tabSkeletonTextStack}>
              <Skeleton
                type="text"
                className={styles.tabSkeletonName}
              />
              <Skeleton
                type="subtitle"
                className={styles.tabSkeletonEyebrow}
              />
            </span>
            <Skeleton
              type="text"
              className={styles.tabSkeletonTag}
            />
          </li>
        ))}
      </ul>
    </Card>
  </div>
);

export default LeaguePlayersTab;
