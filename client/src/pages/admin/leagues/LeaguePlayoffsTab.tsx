import { useState } from 'react';
import Button from '@/components/Button/Button';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import ListItem, { type ListItemAction } from '@/components/ListItem/ListItem';
import Section from '@/components/Section/Section';
import Skeleton from '@/components/Skeleton/Skeleton';
import useBracketRuleSets, { type BracketRuleSet } from '@/hooks/useBracketRuleSets';
import useLeagueGroups from '@/hooks/useLeagueGroups';
import usePlayoffQualificationFormats, {
  type PlayoffQualificationFormat,
} from '@/hooks/usePlayoffQualificationFormats';
import BracketRulesModal from '../seasons/BracketRulesModal';
import PlayoffQualificationFormatModal from '../seasons/PlayoffQualificationFormatModal';
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

const describeRuleSet = (ruleSet: BracketRuleSet): string => {
  const bracketLabel = `${inferBracketSizeFromSlots(ruleSet.slots)}-team bracket`;
  const qualificationLabel = ruleSet.qualification_format_name ?? 'No qualification format';
  return `${bracketLabel} - ${qualificationLabel}`;
};

const describeQualificationRules = (rules: PlayoffQualificationFormat['rules']): string => {
  if (rules.length === 0) return 'No qualification rules';

  return rules
    .map((rule) => {
      const scope =
        rule.scope === 'league'
          ? 'league'
          : rule.scope === 'conference'
            ? 'conference'
            : 'division';
      const qualifier =
        rule.method === 'top'
          ? `Top ${rule.count}`
          : `${rule.count} wildcard${rule.count === 1 ? '' : 's'}`;
      return `${qualifier} per ${scope}`;
    })
    .join(' + ');
};

const LeaguePlayoffsTab = ({ leagueId, className }: Props) => {
  const { ruleSets, loading, deleteRuleSet } = useBracketRuleSets(leagueId);
  const {
    formats: qualificationFormats,
    loading: qualificationFormatsLoading,
    createFormat,
    updateFormat,
    deleteFormat,
  } = usePlayoffQualificationFormats(leagueId);
  const { groups } = useLeagueGroups(leagueId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BracketRuleSet | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BracketRuleSet | null>(null);
  const [qualificationModalOpen, setQualificationModalOpen] = useState(false);
  const [qualificationEditTarget, setQualificationEditTarget] =
    useState<PlayoffQualificationFormat | null>(null);
  const [confirmDeleteQualification, setConfirmDeleteQualification] =
    useState<PlayoffQualificationFormat | null>(null);

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

  const openCreateQualification = () => {
    setQualificationEditTarget(null);
    setQualificationModalOpen(true);
  };

  const openEditQualification = (format: PlayoffQualificationFormat) => {
    setQualificationEditTarget(format);
    setQualificationModalOpen(true);
  };

  const handleCloseQualification = () => {
    setQualificationModalOpen(false);
    setQualificationEditTarget(null);
  };

  if (loading || qualificationFormatsLoading) {
    return <LeaguePlayoffsTabSkeleton className={className} />;
  }

  return (
    <>
      <div className={[styles.grid, styles.playoffsTabGrid].join(' ')}>
        <Section
          className={[styles.playoffsTabCard, className].filter(Boolean).join(' ')}
          title="Playoff Rule Sets"
          action={
            <Button
              icon="add"
              size="sm"
              onClick={openCreate}
            >
              Create Rule Set
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
                  subtitle={describeRuleSet(rs)}
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
        </Section>

        <Section
          className={[styles.playoffsTabCard, className].filter(Boolean).join(' ')}
          title="Qualification Formats"
          action={
            <Button
              icon="add"
              size="sm"
              onClick={openCreateQualification}
            >
              Create Format
            </Button>
          }
        >
          {qualificationFormats.length === 0 ? (
            <p className={styles.emptyMsg}>
              No qualification formats yet. Create one to get started.
            </p>
          ) : (
            <ul className={styles.ruleSetList}>
              {qualificationFormats.map((format) => (
                <ListItem
                  key={format.id}
                  hideImage
                  name={format.name}
                  subtitle={describeQualificationRules(format.rules)}
                  actions={
                    [
                      {
                        icon: 'edit',
                        intent: 'neutral',
                        tooltip: 'Edit qualification format',
                        onClick: () => openEditQualification(format),
                      },
                      {
                        icon: 'delete',
                        intent: 'danger',
                        tooltip: 'Delete qualification format',
                        onClick: () => setConfirmDeleteQualification(format),
                      },
                    ] satisfies ListItemAction[]
                  }
                />
              ))}
            </ul>
          )}
        </Section>
      </div>

      <BracketRulesModal
        open={modalOpen}
        leagueId={leagueId}
        ruleSetId={editTarget?.id ?? null}
        groups={groups}
        onClose={handleClose}
      />

      <PlayoffQualificationFormatModal
        open={qualificationModalOpen}
        mode={qualificationEditTarget ? 'edit' : 'create'}
        initialName={qualificationEditTarget?.name ?? ''}
        initialRules={qualificationEditTarget?.rules ?? null}
        onSubmit={(values) =>
          qualificationEditTarget
            ? updateFormat(qualificationEditTarget.id, values)
            : createFormat(values)
        }
        onClose={handleCloseQualification}
      />

      <ConfirmModal
        open={confirmDelete !== null}
        title="Delete Rule Set"
        body={
          <>
            Are you sure you want to delete <strong>{confirmDelete?.name}</strong>? Any seasons
            using this rule set will lose their playoff configuration.
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

      <ConfirmModal
        open={confirmDeleteQualification !== null}
        title="Delete Qualification Format"
        body={
          <>
            Are you sure you want to delete <strong>{confirmDeleteQualification?.name}</strong>? Any
            seasons using this format will lose their qualification configuration.
          </>
        }
        confirmLabel="Delete"
        confirmIntent="danger"
        onConfirm={async () => {
          if (confirmDeleteQualification) await deleteFormat(confirmDeleteQualification.id);
          setConfirmDeleteQualification(null);
        }}
        onClose={() => setConfirmDeleteQualification(null)}
      />
    </>
  );
};

export const LeaguePlayoffsTabSkeleton = ({ className }: TabSkeletonProps) => (
  <div className={[styles.grid, styles.playoffsTabGrid].join(' ')}>
    <Section
      className={[styles.playoffsTabCard, className].filter(Boolean).join(' ')}
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
          </li>
        ))}
      </ul>
    </Section>
    <Section
      className={[styles.playoffsTabCard, className].filter(Boolean).join(' ')}
      title="Qualification Formats"
      action={<TabActionSkeleton width="112px" />}
      role="status"
      aria-busy="true"
      aria-label="Loading qualification formats"
    >
      <ul className={styles.ruleSetList}>
        {Array.from({ length: 3 }, (_, index) => (
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
          </li>
        ))}
      </ul>
    </Section>
  </div>
);

export default LeaguePlayoffsTab;
