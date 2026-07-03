import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  type Control,
  type FieldValues,
  type FormState,
  type UseFormSetValue,
  useFieldArray,
  useForm,
  useWatch,
} from 'react-hook-form';
import AddRowBar from '@/components/AddRowBar/AddRowBar';
import Button from '@/components/Button/Button';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Modal from '@/components/Modal/Modal';
import styles from './BulkCreateModal.module.scss';

export interface BulkCreateHeaderCell {
  label: ReactNode;
  required?: boolean;
}

export interface BulkCreateModalContext<
  FormValues extends FieldValues,
  RowValues extends FieldValues,
> {
  control: Control<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  formState: FormState<FormValues>;
  isSubmitting: boolean;
  rows: RowValues[];
  rowCount: number;
}

export interface BulkCreateRowRenderProps<
  FormValues extends FieldValues,
  RowValues extends FieldValues,
> extends BulkCreateModalContext<FormValues, RowValues> {
  index: number;
  autoFocus: boolean;
  deleteButton: ReactNode;
}

interface Props<FormValues extends FieldValues, RowValues extends FieldValues> {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmitForm: (data: FormValues) => Promise<boolean>;
  createDefaultValues: () => FormValues;
  rowArrayName: string;
  createRow: () => RowValues;
  formId: string;
  headerCells: BulkCreateHeaderCell[];
  columnsTemplate: string;
  addRowLabel: string;
  itemLabel: string;
  renderRow: (props: BulkCreateRowRenderProps<FormValues, RowValues>) => ReactNode;
  getConfirmLabel: (count: number, isSubmitting: boolean) => string;
  shouldConfirmRemove?: (row: RowValues, index: number) => boolean;
  getRemoveConfirmBody?: (row: RowValues, index: number) => ReactNode;
  renderBeforeRows?: (ctx: BulkCreateModalContext<FormValues, RowValues>) => ReactNode;
  renderAfterRows?: (ctx: BulkCreateModalContext<FormValues, RowValues>) => ReactNode;
  size?: 'md' | 'lg' | 'xl';
  disableBackdropClose?: boolean;
  confirmIcon?: string;
  confirmDisabled?: boolean | ((ctx: BulkCreateModalContext<FormValues, RowValues>) => boolean);
  requiredRowFields?: Array<keyof RowValues>;
  requiredFormFields?: string[];
  addRowDisabled?: boolean | ((ctx: BulkCreateModalContext<FormValues, RowValues>) => boolean);
  addRowHint?: ReactNode | ((ctx: BulkCreateModalContext<FormValues, RowValues>) => ReactNode);
}

const BulkCreateModal = <FormValues extends FieldValues, RowValues extends FieldValues>({
  open,
  title,
  onClose,
  onSubmitForm,
  createDefaultValues,
  rowArrayName,
  createRow,
  formId,
  headerCells,
  columnsTemplate,
  addRowLabel,
  itemLabel,
  renderRow,
  getConfirmLabel,
  shouldConfirmRemove,
  getRemoveConfirmBody,
  renderBeforeRows,
  renderAfterRows,
  size = 'xl',
  disableBackdropClose = false,
  confirmIcon,
  confirmDisabled = false,
  requiredRowFields,
  requiredFormFields,
  addRowDisabled = false,
  addRowHint,
}: Props<FormValues, RowValues>) => {
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoFocusIndex, setAutoFocusIndex] = useState(0);
  const createDefaultValuesRef = useRef(createDefaultValues);
  const rowListRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToBottomRef = useRef(false);

  const { control, handleSubmit, reset, setValue, formState } = useForm<FormValues>({
    defaultValues: createDefaultValues(),
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({ control, name: rowArrayName as never });
  const watchedValues = useWatch({ control }) as FormValues | undefined;
  const watchedRows =
    (useWatch({ control, name: rowArrayName as never }) as RowValues[] | undefined) ?? [];

  useEffect(() => {
    createDefaultValuesRef.current = createDefaultValues;
  }, [createDefaultValues]);

  useEffect(() => {
    if (!open) return;
    reset(createDefaultValuesRef.current());
    setAutoFocusIndex(0);
    setConfirmRemoveIndex(null);
    shouldScrollToBottomRef.current = false;
  }, [open, reset]);

  useLayoutEffect(() => {
    if (!shouldScrollToBottomRef.current) return;
    shouldScrollToBottomRef.current = false;
    const rowList = rowListRef.current;
    if (!rowList) return;

    requestAnimationFrame(() => {
      if (typeof rowList.scrollTo === 'function') {
        rowList.scrollTo({ top: rowList.scrollHeight, behavior: 'smooth' });
      } else {
        rowList.scrollTop = rowList.scrollHeight;
      }
    });
  }, [fields.length]);

  const handleClose = () => {
    reset(createDefaultValuesRef.current());
    setAutoFocusIndex(0);
    setConfirmRemoveIndex(null);
    shouldScrollToBottomRef.current = false;
    onClose();
  };

  const handleDeleteClick = (index: number) => {
    if (fields.length === 1) return;
    const row = watchedRows[index];
    if (row && shouldConfirmRemove?.(row as RowValues, index)) {
      setConfirmRemoveIndex(index);
      return;
    }
    remove(index);
  };

  const onSubmit = handleSubmit(async (data) => {
    setIsSubmitting(true);
    try {
      const ok = await onSubmitForm(data);
      if (ok) handleClose();
    } finally {
      setIsSubmitting(false);
    }
  });

  const gridTemplateColumns = `${columnsTemplate} 2rem`;
  const confirmRow = confirmRemoveIndex != null ? watchedRows[confirmRemoveIndex] : null;
  const context: BulkCreateModalContext<FormValues, RowValues> = {
    control,
    setValue,
    formState,
    isSubmitting,
    rows: watchedRows,
    rowCount: fields.length,
  };
  const resolvedConfirmDisabled =
    typeof confirmDisabled === 'function' ? confirmDisabled(context) : confirmDisabled;
  const resolvedAddRowDisabled =
    typeof addRowDisabled === 'function' ? addRowDisabled(context) : addRowDisabled;
  const resolvedAddRowHint = typeof addRowHint === 'function' ? addRowHint(context) : addRowHint;
  const hasValue = (value: unknown) => value != null && String(value).trim() !== '';
  const getPathValue = (source: unknown, path: string) =>
    path.split('.').reduce<unknown>((current, key) => {
      if (current == null || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, source);
  const requiredRowsValid =
    !requiredRowFields ||
    watchedRows.every((row) =>
      requiredRowFields.every((field) => hasValue(row[field as keyof RowValues])),
    );
  const requiredFormValid =
    !requiredFormFields ||
    requiredFormFields.every((field) => hasValue(getPathValue(watchedValues, field)));
  const hasConfiguredRequiredFields = !!requiredRowFields || !!requiredFormFields;
  const formValid = hasConfiguredRequiredFields
    ? requiredRowsValid && requiredFormValid && Object.keys(formState.errors).length === 0
    : formState.isValid;

  return (
    <>
      <Modal
        open={open}
        title={title}
        size={size}
        className={styles.modal}
        bodyClassName={styles.body}
        disableBackdropClose={disableBackdropClose}
        onClose={handleClose}
        confirmForm={formId}
        confirmIcon={confirmIcon}
        confirmLabel={getConfirmLabel(fields.length, isSubmitting)}
        confirmDisabled={
          isSubmitting || !formState.isDirty || !formValid || resolvedConfirmDisabled
        }
        busy={isSubmitting}
      >
        <form
          id={formId}
          className={styles.form}
          onSubmit={onSubmit}
        >
          {renderBeforeRows?.(context)}

          <div
            className={[styles.headerRow, renderBeforeRows ? styles.headerRowWithIntro : '']
              .filter(Boolean)
              .join(' ')}
            style={{ gridTemplateColumns }}
          >
            {headerCells.map((cell, index) => (
              <span
                key={index}
                className={styles.headerCell}
              >
                {cell.label}
                {cell.required && <span className={styles.required}>*</span>}
              </span>
            ))}
            <span />
          </div>

          <div
            ref={rowListRef}
            className={styles.rowList}
          >
            {fields.map((field, index) => (
              <div
                key={field.id}
                className={styles.row}
                style={{ gridTemplateColumns }}
              >
                {renderRow({
                  index,
                  ...context,
                  autoFocus: index === autoFocusIndex,
                  deleteButton:
                    fields.length > 1 ? (
                      <Button
                        type="button"
                        variant="outlined"
                        intent="danger"
                        icon="close"
                        size="sm"
                        tooltip={`Remove ${itemLabel}`}
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteClick(index)}
                        disabled={isSubmitting}
                        aria-label={`Remove ${itemLabel}`}
                      />
                    ) : (
                      <span />
                    ),
                })}
              </div>
            ))}
          </div>

          <AddRowBar
            label={addRowLabel}
            disabled={isSubmitting || resolvedAddRowDisabled}
            hint={resolvedAddRowHint}
            onClick={() => {
              setAutoFocusIndex(fields.length);
              shouldScrollToBottomRef.current = true;
              append(createRow());
            }}
          />

          {renderAfterRows?.(context)}
        </form>
      </Modal>

      <ConfirmModal
        open={confirmRemoveIndex !== null}
        title={`Remove ${itemLabel.charAt(0).toUpperCase()}${itemLabel.slice(1)}`}
        body={
          confirmRow && getRemoveConfirmBody
            ? getRemoveConfirmBody(confirmRow as RowValues, confirmRemoveIndex!)
            : `Remove this ${itemLabel} from the list?`
        }
        confirmLabel="Remove"
        confirmIcon="delete"
        variant="danger"
        onCancel={() => setConfirmRemoveIndex(null)}
        onConfirm={() => {
          if (confirmRemoveIndex !== null) remove(confirmRemoveIndex);
          setConfirmRemoveIndex(null);
        }}
      />
    </>
  );
};

export default BulkCreateModal;
