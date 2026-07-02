import type { DragEventHandler, ReactNode } from 'react';
import cn from 'classnames';
import Icon from '../Icon/Icon';
import Tooltip from '../Tooltip/Tooltip';
import styles from './ReorderableField.module.scss';

interface ReorderableFieldProps {
  children: ReactNode;
  className?: string;
  dragging?: boolean;
  draggable?: boolean;
  disabled?: boolean;
  moveUpDisabled?: boolean;
  moveDownDisabled?: boolean;
  moveUpLabel?: string;
  moveDownLabel?: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
  onDragEnd?: DragEventHandler<HTMLDivElement>;
}

interface MoveButtonProps {
  direction: 'up' | 'down';
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

const MoveButton = ({ direction, label, disabled = false, onClick }: MoveButtonProps) => {
  const button = (
    <button
      type="button"
      className={styles.moveButton}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon
        name={direction === 'up' ? 'caret_up' : 'caret_down'}
        size="0.95rem"
      />
    </button>
  );

  return (
    <Tooltip
      text={label}
      className={styles.moveButtonTooltip}
    >
      {button}
    </Tooltip>
  );
};

const ReorderableField = ({
  children,
  className,
  dragging = false,
  draggable = true,
  disabled = false,
  moveUpDisabled = false,
  moveDownDisabled = false,
  moveUpLabel = 'Move up',
  moveDownLabel = 'Move down',
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: ReorderableFieldProps) => {
  const canDrag = draggable && !disabled;

  return (
    <div
      className={cn(
        styles.field,
        canDrag && styles.fieldDraggable,
        dragging && styles.fieldDragging,
        disabled && styles.fieldDisabled,
        className,
      )}
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragOver={canDrag ? onDragOver : undefined}
      onDrop={canDrag ? onDrop : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
    >
      <span
        className={styles.handle}
        aria-hidden="true"
      >
        <Icon name="drag_handle" />
      </span>
      <div className={styles.content}>{children}</div>
      <div className={styles.moveControls}>
        <MoveButton
          direction="up"
          label={moveUpLabel}
          disabled={disabled || moveUpDisabled}
          onClick={onMoveUp}
        />
        <MoveButton
          direction="down"
          label={moveDownLabel}
          disabled={disabled || moveDownDisabled}
          onClick={onMoveDown}
        />
      </div>
    </div>
  );
};

export default ReorderableField;
