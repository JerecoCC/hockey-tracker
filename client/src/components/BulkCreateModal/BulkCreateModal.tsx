import { type ReactNode, useEffect, useState } from 'react';
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
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Icon from '@/components/Icon/Icon';
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
  addRowDisabled = false,
  addRowHint,
}: Props<FormValues, RowValues>) => {
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoFocusIndex, setAutoFocusIndex] = useState(0);

  const { control, handleSubmit, reset, setValue, formState } = useForm<FormValues>({
    defaultValues: createDefaultValues(),
  });

  const { fields, append, remove } = useFieldArray({ control, name: rowArrayName as never });
  const watchedRows =
    (useWatch({ control, name: rowArrayName as never }) as RowValues[] | undefined) ?? [];

  useEffect(() => {
    if (!open) return;
    reset(createDefaultValues());
    setAutoFocusIndex(0);
    setConfirmRemoveIndex(null);
  }, [open, createDefaultValues, reset]);

  const handleClose = () => {
    reset(createDefaultValues());
    setAutoFocusIndex(0);
    setConfirmRemoveIndex(null);
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

  return (
    <>
      <Modal
        open={open}
        title={title}
        size={size}
        disableBackdropClose={disableBackdropClose}
        onClose={handleClose}
        confirmForm={formId}
        confirmIcon={confirmIcon}
        confirmLabel={getConfirmLabel(fields.length, isSubmitting)}
        confirmDisabled={isSubmitting || resolvedConfirmDisabled}
        busy={isSubmitting}
      >
        <form
          id={formId}
          onSubmit={onSubmit}
        >
          {renderBeforeRows?.(context)}

          <div
            className={styles.headerRow}
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

          <div className={styles.rowList}>
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
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteClick(index)}
                        disabled={isSubmitting}
                        aria-label={`Remove ${itemLabel}`}
                      >
                        <Icon
                          name="delete"
                          size="1em"
                        />
                      </button>
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
