import { useState } from 'react';
import type { ReactNode } from 'react';
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

interface Props {
  /** Header label – any ReactNode. */
  label: ReactNode;
  /** Always-visible right-side header content (badges, scores, etc.). */
  headerRight?: ReactNode;
  /** Hover-revealed action buttons rendered from a config array. */
  hoverActions?: AccordionAction[];
  /** Whether the body is expanded on first render. Defaults to true. */
  defaultOpen?: boolean;
  /** When true the toggle button is inert — the row cannot be expanded or collapsed. */
  toggleDisabled?: boolean;
  /**
   * 'collapsible' (default) — standard expand/collapse behaviour.
   * 'static' — always open, no toggle button rendered at all.
   */
  variant?: 'collapsible' | 'static';
  /** Extra class applied to the root element (for border-color overrides, etc.). */
  className?: string;
  /** Collapsible body content. */
  children?: ReactNode;
}

const Accordion = ({
  label,
  headerRight,
  hoverActions,
  defaultOpen = true,
  toggleDisabled = false,
  variant = 'collapsible',
  className,
  children,
}: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  const isStatic = variant === 'static';
  const bodyVisible = isStatic || open;

  return (
    <div className={[styles.accordion, className].filter(Boolean).join(' ')}>
      <div
        className={[
          styles.row,
          !bodyVisible ? styles.rowCollapsed : '',
          isStatic ? styles.rowStatic : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {!isStatic && (
          <button
            className={[styles.toggle, toggleDisabled ? styles.toggleDisabled : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => !toggleDisabled && setOpen((v) => !v)}
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
            aria-disabled={toggleDisabled}
            tabIndex={toggleDisabled ? -1 : undefined}
          >
            <Icon
              name="expand_more"
              size="0.8em"
              className={open ? styles.toggleIconOpen : styles.toggleIcon}
            />
          </button>
        )}
        <div className={styles.label}>{label}</div>
        {headerRight != null && <div className={styles.headerRight}>{headerRight}</div>}
        {hoverActions != null && hoverActions.length > 0 && (
          <div className={styles.hoverActions}>
            {hoverActions.map((action, i) => (
              <Button
                key={i}
                variant={action.variant ?? 'outlined'}
                intent={action.intent ?? 'neutral'}
                size="sm"
                icon={action.icon}
                disabled={action.disabled}
                tooltip={action.tooltip}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {bodyVisible && children != null && <div className={styles.body}>{children}</div>}
    </div>
  );
};

export default Accordion;
