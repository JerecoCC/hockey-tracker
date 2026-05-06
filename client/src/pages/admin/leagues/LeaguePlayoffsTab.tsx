import { useState } from 'react';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import useBracketRuleSets, { type BracketRuleSet } from '@/hooks/useBracketRuleSets';
import useLeagueGroups from '@/hooks/useLeagueGroups';
import BracketRulesModal from '../seasons/BracketRulesModal';
import styles from './LeagueDetails.module.scss';

interface Props {
  leagueId: string;
  className?: string;
}

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

  return (
    <>
      <Card
        className={className}
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
        {loading ? (
          <p className={styles.emptyMsg}>Loading…</p>
        ) : ruleSets.length === 0 ? (
          <p className={styles.emptyMsg}>No rule sets yet. Create one to get started.</p>
        ) : (
          <ul className={styles.ruleSetList}>
            {ruleSets.map((rs) => (
              <li
                key={rs.id}
                className={styles.ruleSetItem}
              >
                <span className={styles.ruleSetName}>{rs.name}</span>
                <div className={styles.ruleSetActions}>
                  <Button
                    variant="outlined"
                    intent="neutral"
                    icon="edit"
                    size="sm"
                    tooltip="Edit rule set"
                    onClick={() => openEdit(rs)}
                  />
                  <Button
                    variant="outlined"
                    intent="danger"
                    icon="delete"
                    size="sm"
                    tooltip="Delete rule set"
                    onClick={() => setConfirmDelete(rs)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

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

export default LeaguePlayoffsTab;
