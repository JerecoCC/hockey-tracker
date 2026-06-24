import { forwardRef, useState } from 'react';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import ActionOverlay from '../ActionOverlay/ActionOverlay';
import Button from '../Button/Button';
import type { ButtonIntent, ButtonVariant } from '../Button/Button';
import Icon from '../Icon/Icon';
import styles from './Accordion.module.scss';

export interface AccordionAction {
  /** Button text label. */
  label?: string;
  /** Material Icons ligature name. */
  icon?: string;
  /** Button variant. Defaults to 'outlined'. */
  variant?: ButtonVariant;
  /** Color intent. Defaults to 'neutral'. */
  intent?: ButtonIntent;
  disabled?: boolean;
  tooltip?: string;
  onClick: () => void;
}

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Header label – any ReactNode. */
  label: ReactNode;
  /** Small content rendered immediately after the label, such as counts. */
  labelMeta?: ReactNode;
  /** Always-visible right-side header content (badges, scores, etc.). */
  headerRight?: ReactNode;
  /** Hover-revealed action buttons rendered from a config array. */
  hoverActions?: AccordionAction[];
  /** Whether the body is expanded on first render. Defaults to true. */
  defaultOpen?: boolean;
  /** Optional controlled expanded state. */
  open?: boolean;
  /** Called when the expanded state changes. */
  onOpenChange?: (open: boolean) => void;
  /** When true the toggle button is inert — the row cannot be expanded or collapsed. */
  toggleDisabled?: boolean;
  /**
   * 'collapsible' (default) — standard expand/collapse behaviour.
   * 'static' — always open, no toggle button rendered at all.
   */
  variant?: 'collapsible' | 'static';
  /** Extra class applied to the root element (for border-color overrides, etc.). */
  className?: string;
  /** Extra class applied to the header row. */
  rowClassName?: string;
  /** Extra class applied to the body wrapper. */
  bodyClassName?: string;
  /** Ref forwarded to the body wrapper. */
  bodyRef?: Ref<HTMLDivElement>;
  /** Collapsible body content. */
  children?: ReactNode;
}

const Accordion = forwardRef<HTMLDivElement, Props>(
  (
    {
      label,
      labelMeta,
      headerRight,
      hoverActions,
      defaultOpen = true,
      open: controlledOpen,
      onOpenChange,
      toggleDisabled = false,
      variant = 'collapsible',
      className,
      rowClassName,
      bodyClassName,
      bodyRef,
      children,
      ...rootProps
    },
    ref,
  ) => {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const open = controlledOpen ?? uncontrolledOpen;
    const isStatic = variant === 'static';
    const hasHoverActions = hoverActions != null && hoverActions.length > 0;
    const bodyVisible = isStatic || open;
    const setOpen = (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    };

    return (
      <div
        {...rootProps}
        ref={ref}
        className={[styles.accordion, className].filter(Boolean).join(' ')}
      >
        <div
          className={[
            styles.row,
            !(bodyVisible && children != null) ? styles.rowCollapsed : '',
            isStatic ? styles.rowStatic : '',
            hasHoverActions ? styles.rowWithActions : '',
            rowClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {!isStatic && (
            <button
              className={[styles.toggle, toggleDisabled ? styles.toggleDisabled : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => !toggleDisabled && setOpen(!open)}
              aria-label={open ? 'Collapse' : 'Expand'}
              aria-expanded={open}
              aria-disabled={toggleDisabled}
              tabIndex={toggleDisabled ? -1 : undefined}
            >
              <Icon
                name="expand_more"
                size="0.8rem"
                className={open ? styles.toggleIconOpen : styles.toggleIcon}
              />
            </button>
          )}
          <div className={styles.labelWrap}>
            <div className={styles.label}>{label}</div>
            {labelMeta != null && <div className={styles.labelMeta}>{labelMeta}</div>}
          </div>
          {headerRight != null && <div className={styles.headerRight}>{headerRight}</div>}
          {hasHoverActions && (
            <ActionOverlay className={styles.hoverActions}>
              {hoverActions.map((action, i) => (
                <Button
                  key={i}
                  variant={action.variant ?? 'outlined'}
                  intent={action.intent ?? 'neutral'}
                  size="sm"
                  icon={action.icon}
                  disabled={action.disabled}
                  tooltip={action.tooltip ?? action.label}
                  aria-label={action.tooltip ?? action.label}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </ActionOverlay>
          )}
        </div>
        {bodyVisible && children != null && (
          <div
            ref={bodyRef}
            className={[styles.body, bodyClassName].filter(Boolean).join(' ')}
          >
            {children}
          </div>
        )}
      </div>
    );
  },
);

Accordion.displayName = 'Accordion';

export default Accordion;
