import { forwardRef, useState } from 'react';
import type { HTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';
import ActionOverlay from '../ActionOverlay/ActionOverlay';
import Button from '../Button/Button';
import type { ButtonIntent, ButtonVariant } from '../Button/Button';
import Divider from '../Divider/Divider';
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
  /**
   * When true, hover actions are revealed on hover/focus only — even in the
   * `static` variant, which otherwise shows them permanently. Lets a
   * non-collapsible accordion keep tidy, hover-revealed actions.
   */
  hoverRevealActions?: boolean;
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
  /**
   * Header background treatment.
   * 'filled' (default) — solid header background.
   * 'light' — faded overlay header background (as on the season awards tab).
   * 'transparent' — no header background.
   */
  headerType?: 'filled' | 'light' | 'transparent';
  /** Extra class applied to the root element (for border-color overrides, etc.). */
  className?: string;
  /** Extra class applied to the header row. */
  rowClassName?: string;
  /** Extra class applied to the toggle button. */
  toggleClassName?: string;
  /** Extra class applied to the label wrapper. */
  labelWrapClassName?: string;
  /** Extra class applied to the label content. */
  labelClassName?: string;
  /** Extra class applied to the body wrapper. */
  bodyClassName?: string;
  /** Ref forwarded to the body wrapper. */
  bodyRef?: Ref<HTMLDivElement>;
  /** Collapsible body content. */
  children?: ReactNode;
}

const HEADER_TOGGLE_IGNORE_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[data-accordion-ignore-toggle]',
  '[data-hover-actions]',
].join(',');

const shouldIgnoreHeaderToggle = (target: EventTarget | null) =>
  target instanceof Element && target.closest(HEADER_TOGGLE_IGNORE_SELECTOR) != null;

const Accordion = forwardRef<HTMLDivElement, Props>(
  (
    {
      label,
      labelMeta,
      headerRight,
      hoverActions,
      hoverRevealActions = false,
      defaultOpen = true,
      open: controlledOpen,
      onOpenChange,
      toggleDisabled = false,
      variant = 'collapsible',
      headerType = 'filled',
      className,
      rowClassName,
      toggleClassName,
      labelWrapClassName,
      labelClassName,
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
    const toggleOpen = () => {
      if (!toggleDisabled) setOpen(!open);
    };
    const handleRowClick = (event: MouseEvent<HTMLDivElement>) => {
      if (isStatic || toggleDisabled || shouldIgnoreHeaderToggle(event.target)) return;
      toggleOpen();
    };
    const handleToggleClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      toggleOpen();
    };

    return (
      <div
        {...rootProps}
        ref={ref}
        className={[
          styles.accordion,
          headerType === 'light' ? styles.headerLight : '',
          headerType === 'transparent' ? styles.headerTransparent : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          className={[
            styles.row,
            !(bodyVisible && children != null) ? styles.rowCollapsed : '',
            isStatic ? styles.rowStatic : '',
            !isStatic && !toggleDisabled ? styles.rowClickable : '',
            hasHoverActions ? styles.rowWithActions : '',
            isStatic && hasHoverActions && !hoverRevealActions
              ? styles.rowStaticActionsVisible
              : '',
            rowClassName,
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={handleRowClick}
        >
          {!isStatic && (
            <span className={styles.toggleShell}>
              <Button
                type="button"
                variant="ghost"
                intent="neutral"
                size="sm"
                icon="expand_more"
                iconSize="0.8rem"
                className={[
                  styles.toggle,
                  open ? styles.toggleOpen : '',
                  toggleDisabled ? styles.toggleDisabled : '',
                  toggleClassName,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={handleToggleClick}
                aria-label={open ? 'Collapse' : 'Expand'}
                aria-expanded={open}
                aria-disabled={toggleDisabled}
                tabIndex={toggleDisabled ? -1 : undefined}
                disabled={toggleDisabled}
              />
              <Divider
                variant="vertical"
                className={styles.toggleDivider}
              />
            </span>
          )}
          <div className={[styles.labelWrap, labelWrapClassName].filter(Boolean).join(' ')}>
            <div className={[styles.label, labelClassName].filter(Boolean).join(' ')}>
              {label}
            </div>
            {labelMeta != null && <div className={styles.labelMeta}>{labelMeta}</div>}
          </div>
          {headerRight != null && <div className={styles.headerRight}>{headerRight}</div>}
          {hasHoverActions && (
            <ActionOverlay
              data-hover-actions
              className={styles.hoverActions}
              onClick={(event) => event.stopPropagation()}
            >
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
