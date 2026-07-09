import { useCallback, type ReactNode } from 'react';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import BulkCreateModal, {
  type BulkCreateRowRenderProps,
} from '@jerecocc/tracker-ui/components/BulkCreateModal/BulkCreateModal';
import { type PlayoffFormatRule } from '@/hooks/useLeagues';
import styles from './PlayoffQualificationFormatModal.module.scss';

const SCOPE_OPTIONS = [
  { value: 'league' as PlayoffFormatRule['scope'], label: 'Whole League' },
  { value: 'conference' as PlayoffFormatRule['scope'], label: 'Per Conference' },
  { value: 'division' as PlayoffFormatRule['scope'], label: 'Per Division' },
];

const METHOD_OPTIONS = [
  { value: 'top' as PlayoffFormatRule['method'], label: 'Top N (direct)' },
  { value: 'wildcard' as PlayoffFormatRule['method'], label: 'Wildcard (best remaining)' },
];

interface RuleRowValues {
  scope: PlayoffFormatRule['scope'];
  method: PlayoffFormatRule['method'];
  count: number | string;
}

interface FormValues {
  name: string;
  rules: RuleRowValues[];
}

const EMPTY_RULE: RuleRowValues = { scope: 'league', method: 'top', count: 4 };

interface RuleRowProps {
  index: number;
  control: BulkCreateRowRenderProps<FormValues, RuleRowValues>['control'];
  isSubmitting: boolean;
  deleteButton: ReactNode;
}

const RuleRow = ({ index, control, isSubmitting, deleteButton }: RuleRowProps) => (
  <>
    <Field
      type="select"
      control={control}
      name={`rules.${index}.scope`}
      options={SCOPE_OPTIONS}
      disabled={isSubmitting}
    />
    <Field
      type="select"
      control={control}
      name={`rules.${index}.method`}
      options={METHOD_OPTIONS}
      disabled={isSubmitting}
    />
    <Field
      type="number"
      control={control}
      name={`rules.${index}.count`}
      min={1}
      max={32}
      disabled={isSubmitting}
      rules={{
        required: 'Count is required',
        min: { value: 1, message: 'Count must be at least 1' },
        max: { value: 32, message: 'Count must be 32 or less' },
      }}
    />
    {deleteButton}
  </>
);

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initialName?: string;
  initialRules?: PlayoffFormatRule[] | null;
  onSubmit: (values: { name: string; rules: PlayoffFormatRule[] }) => Promise<boolean>;
  onClose: () => void;
}

const normalizeInitialRules = (rules: PlayoffFormatRule[] | null): RuleRowValues[] =>
  rules && rules.length > 0 ? rules.map((rule) => ({ ...rule })) : [{ ...EMPTY_RULE }];

const shouldConfirmRemoveRule = (rule: RuleRowValues) =>
  rule.scope !== EMPTY_RULE.scope ||
  rule.method !== EMPTY_RULE.method ||
  Number(rule.count) !== EMPTY_RULE.count;

const PlayoffQualificationFormatModal = ({
  open,
  mode,
  initialName = '',
  initialRules = null,
  onSubmit,
  onClose,
}: Props) => {
  const createDefaultValues = useCallback(
    () => ({
      name: initialName,
      rules: normalizeInitialRules(initialRules),
    }),
    [initialName, initialRules],
  );

  const isCreate = mode === 'create';

  return (
    <BulkCreateModal<FormValues, RuleRowValues>
      open={open}
      title={isCreate ? 'Create Qualification Format' : 'Edit Qualification Format'}
      size="lg"
      onClose={onClose}
      formId="playoff-qualification-format-form"
      createDefaultValues={createDefaultValues}
      rowArrayName="rules"
      createRow={() => ({ ...EMPTY_RULE })}
      columnsTemplate="1.1fr 1.4fr 0.7fr"
      headerCells={[
        { label: 'Scope', required: true },
        { label: 'Method', required: true },
        { label: 'Count', required: true },
      ]}
      requiredFormFields={['name']}
      requiredRowFields={['scope', 'method', 'count']}
      addRowLabel="Add Rule"
      itemLabel="rule"
      getConfirmLabel={(_, isSubmitting) =>
        isSubmitting ? 'Saving...' : isCreate ? 'Create Format' : 'Save Changes'
      }
      shouldConfirmRemove={shouldConfirmRemoveRule}
      getRemoveConfirmBody={() => 'Remove this rule from the format?'}
      onSubmitForm={(data) =>
        onSubmit({
          name: data.name.trim(),
          rules: data.rules.map((rule) => ({
            scope: rule.scope,
            method: rule.method,
            count: Number(rule.count),
          })),
        })
      }
      renderBeforeRows={({ control, isSubmitting }) => (
        <div className={styles.nameField}>
          <Field
            label="Name"
            control={control}
            name="name"
            type="text"
            autoFocus
            required
            disabled={isSubmitting}
            rules={{
              required: 'Name is required',
              validate: (value) => String(value).trim().length > 0 || 'Name is required',
            }}
          />
        </div>
      )}
      renderRow={({ index, control, isSubmitting, deleteButton }) => (
        <RuleRow
          index={index}
          control={control}
          isSubmitting={isSubmitting}
          deleteButton={deleteButton}
        />
      )}
    />
  );
};

export default PlayoffQualificationFormatModal;
