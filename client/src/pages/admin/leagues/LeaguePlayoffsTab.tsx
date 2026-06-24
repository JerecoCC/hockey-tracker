import { useState } from 'react';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import Skeleton from '@/components/Skeleton/Skeleton';
import useBracketRuleSets, { type BracketRuleSet } from '@/hooks/useBracketRuleSets';
import useLeagueGroups from '@/hooks/useLeagueGroups';
import BracketRulesModal from '../seasons/BracketRulesModal';
import { TabActionSkeleton, type TabSkeletonProps } from './LeagueTabSkeletonHelpers';
import styles from './LeagueDetails.module.scss';

interface Props {
  leagueId: string;
  className?: string;
}

const inferBracketSizeFromSlots = (slots: BracketRuleSet['slots'] | undefined): number => {
  const round1Matchups = new Set(
    (slots ?? [])
      .map((slot) => slot.slot_key.match(/^r1m(\d+)/)?.[1])
      .filter((value): value is string => value !== undefined),
  ).size;
  return Math.max(4, round1Matchups * 2);
};

const LeaguePlayoffsTab = ({ leagueId, className }: Props) => {
  const { ruleSets, loading, deleteRuleSet } = useBracketRuleSets(leagueId);
  const { groups } = useLeagueGroups(leagueId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BracketRuleSet | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BracketRuleSet | null>(null);

  const openCreate = () => {
    setEditTarget(null);
    setModalOpen(true);
  };

  const openEdit = (rs: BracketRuleSet) => {
    setEditTarget(rs);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditTarget(null);
  };

  if (loading) return <LeaguePlayoffsTabSkeleton className={className} />;

  return (
    <>
      <div className={styles.grid}>
        <Card
          className={[styles.col12, className].filter(Boolean).join(' ')}
          title="Playoff Rule Sets"
          action={
            <Button
              icon="add"
              size="sm"
              onClick={openCreate}
            >
              New Rule Set
            </Button>
          }
        >
          {ruleSets.length === 0 ? (
            <p className={styles.emptyMsg}>No rule sets yet. Create one to get started.</p>
          ) : (
            <ul className={styles.ruleSetList}>
              {ruleSets.map((rs) => (
                <ListItem
                  key={rs.id}
                  hideImage
                  name={rs.name}
                  subtitle={`${inferBracketSizeFromSlots(rs.slots)}-team bracket`}
                  actions={
                    [
                      {
                        icon: 'edit',
                        intent: 'neutral',
                        tooltip: 'Edit rule set',
                        onClick: () => openEdit(rs),
                      },
                      {
                        icon: 'delete',
                        intent: 'danger',
                        tooltip: 'Delete rule set',
                        onClick: () => setConfirmDelete(rs),
                      },
                    ] satisfies ListItemAction[]
                  }
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <BracketRulesModal
        open={modalOpen}
        leagueId={leagueId}
        ruleSetId={editTarget?.id ?? null}
        groups={groups}
        onClose={handleClose}
      />

      <ConfirmModal
        open={confirmDelete !== null}
        title="Delete Rule Set"
        body={
          <>
            Are you sure you want to delete <strong>{confirmDelete?.name}</strong>? Any seasons
            using this rule set will lose their bracket configuration.
          </>
        }
        confirmLabel="Delete"
        confirmIntent="danger"
        onConfirm={async () => {
          if (confirmDelete) await deleteRuleSet(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  );
};

export const LeaguePlayoffsTabSkeleton = ({ className }: TabSkeletonProps) => (
  <div className={styles.grid}>
    <Card
      className={[styles.col12, className].filter(Boolean).join(' ')}
      title="Playoff Rule Sets"
      action={<TabActionSkeleton width="126px" />}
      role="status"
      aria-busy="true"
      aria-label="Loading playoff rule sets"
    >
      <ul className={styles.ruleSetList}>
        {Array.from({ length: 5 }, (_, index) => (
          <li
            key={index}
            className={styles.ruleSetItem}
          >
            <span className={styles.ruleSetName}>
              <Skeleton
                type="text"
                className={styles.tabSkeletonName}
              />
              <Skeleton
                type="text"
                className={styles.tabSkeletonMetaLine}
              />
            </span>
            <span className={styles.tabSkeletonActions}>
              <Skeleton type="circle" />
              <Skeleton type="circle" />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  </div>
);

export default LeaguePlayoffsTab;
